// Pelotas en juego: física de core/ballistics, choques contra la horda, y el efecto del poder aplicado
// según cómo entrega el palo.
//
// Dos cosas independientes: si el palo **atraviesa** (le aplica el efecto a cada uno que toca en el
// aire y sigue: driver y hierro) y si **abre un área** donde toca el piso (todos menos el driver, más
// grande cuanto más alto vuela). El hierro hace las dos: atraviesa, abre un área chica donde cae, y
// después sigue rodando. El vendaval con el driver es la excepción prolija: como no tiene punto de
// caída, el viento pasa como un pasillo angosto a lo largo de todo el tiro.
import * as THREE from 'three';
import { BALL_RADIUS, launch, launchWith, stepBall, type BallState } from '../core/ballistics';
import { areaDamageFor, damageFor, ICE_LINE_SECONDS, ICE_SECONDS, PUSH_LINE_HALF_WIDTH, QUALITY_AREA, type Club, type Enchant, type EnchantId } from '../core/clubs';
import type { Effects } from './effects';
import type { Enemy, Horde } from './enemies';
import type { Shot } from './player';
import type { Traps } from './traps';
import { heightAt, relief } from '../core/terrain';
import { GATE_Z } from './world';

const TRAIL_POINTS = 18;
const MAX_STEP = 0.3;
/** Segundos después de los cuales un tiro ya se da por jugado. */
const SETTLE_AFTER = 1.8;

export interface Ball {
  state: BallState;
  club: Club;
  enchant: Enchant;
  /** Nivel de calidad del golpe: 1, 2 o 3. */
  quality: number;
  /** De dónde salió, para saber a qué distancia pega. */
  from: THREE.Vector3;
  /** Hacia dónde salió, en el piso (unitario). Al caer, la velocidad ya no lo dice. */
  dir: THREE.Vector3;
  hitIds: Set<number>;
  hits: number;
  /** Ya abrió su área: no la vuelve a abrir aunque siga rodando. */
  burst: boolean;
  /** Enemigos que mató esta pelota. */
  kills: number;
  /** Ya se avisó cómo le fue (evento 'settled'). */
  settled: boolean;
  age: number;
  restTime: number;
  mesh: THREE.Mesh;
  trail: THREE.Line;
  trailPositions: Float32Array;
  done: boolean;
}

export type BallEvent =
  /** Un palo lineal atravesó a alguien. */
  | { type: 'hit'; club: Club; enemy: Enemy; pos: THREE.Vector3; damage: number; quality: number; killed: boolean }
  /** Un globo (o el putter) llegó y aplicó su efecto en un área. */
  | { type: 'land'; enchant: EnchantId; pos: THREE.Vector3; hits: number; quality: number }
  | { type: 'bounce'; pos: THREE.Vector3 }
  | { type: 'blocked'; enemy: Enemy; warded: boolean }
  /** Un tiro ya se jugó: a cuántos alcanzó y cuántas bajas hizo. */
  | { type: 'settled'; club: Club; hits: number; kills: number };

const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 12, 10);

export class Balls {
  readonly list: Ball[] = [];
  onEvent: ((e: BallEvent) => void) | null = null;
  /** Tótems: en pausa (ver core/clubs). El módulo sigue vivo para poder volver a prenderlo. */
  traps: Traps | null = null;

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {}

  /** @param lift velocidad y ángulo de salida ya calculados contra el terreno, con relieve */
  fire(shot: Shot, range: number, lift: { speed: number; angle: number } | null = null): Ball {
    const loft = THREE.MathUtils.degToRad(shot.club.loftDeg);
    const state = lift
      ? launchWith({ x: shot.from.x, y: heightAt(shot.from.x, shot.from.z) + BALL_RADIUS, z: shot.from.z }, shot.dir.x, shot.dir.z, lift.speed, lift.angle)
      : launch({ x: shot.from.x, y: BALL_RADIUS, z: shot.from.z }, shot.dir.x, shot.dir.z, range, loft, shot.club.gravity, shot.club.rollFriction);
    const color = shot.enchant.id === 'damage' ? shot.club.color : shot.enchant.color;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: shot.quality >= 3 ? 1.6 : 0.7 });
    const mesh = new THREE.Mesh(ballGeo, mat);
    mesh.position.set(state.pos.x, state.pos.y, state.pos.z);
    const trailPositions = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i++) trailPositions.set([state.pos.x, state.pos.y, state.pos.z], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    trail.frustumCulled = false;
    this.scene.add(mesh, trail);
    const ball: Ball = {
      state, club: shot.club, enchant: shot.enchant, quality: shot.quality,
      from: shot.from.clone(),
      dir: new THREE.Vector3(shot.dir.x, 0, shot.dir.z).normalize(),
      hitIds: new Set(), hits: 0, burst: false, kills: 0, settled: false, age: 0, restTime: 0, mesh, trail, trailPositions, done: false,
    };
    this.list.push(ball);
    // El vendaval con un palo sin área no tiene punto de caída: el viento pasa por todo el tiro, en un
    // pasillo angosto, y deja en fila a los que estaban cerca de la línea.
    if (ball.club.spread === 0 && ball.enchant.id === 'push') {
      const half = PUSH_LINE_HALF_WIDTH * QUALITY_AREA[ball.quality - 1];
      const mid = ball.from.clone().addScaledVector(ball.dir, range / 2);
      mid.y = heightAt(mid.x, mid.z);
      const hits = this.horde.sweep(mid, ball.dir, half, range / 2);
      this.effects.swipe(mid, half);
      this.onEvent?.({ type: 'land', enchant: 'push', pos: mid, hits, quality: ball.quality });
    }
    return ball;
  }

  /** A qué distancia del golfista pegó: es lo que decide cuánto hace el palo. */
  private metersTo(ball: Ball, pos: { x: number; z: number }): number {
    return Math.hypot(pos.x - ball.from.x, pos.z - ball.from.z);
  }

  /**
   * La pelota llegó (al piso o a un enemigo): abre su área acá. `finish` dice si con eso se termina el
   * tiro (el globo se queda donde cayó) o si la pelota sigue viaje rodando (el hierro).
   */
  private burst(ball: Ball, finish = true): void {
    ball.burst = true;
    const pos = new THREE.Vector3(ball.state.pos.x, ball.state.pos.y, ball.state.pos.z);
    const radius = ball.club.spread * QUALITY_AREA[ball.quality - 1];
    // al que esta misma pelota ya atravesó no le toca otra vez: el hierro atraviesa y además abre un
    // área donde cae, pero un tiro es un efecto por enemigo
    const skip = ball.hitIds;
    let hits = 0;
    if (ball.enchant.id === 'ice') {
      this.effects.frost(pos, radius);
      hits = this.horde.chillAround(pos, radius, ICE_SECONDS[ball.quality - 1], skip);
    } else if (ball.enchant.id === 'push') {
      this.effects.explosion(pos, radius, ball.enchant.color);
      hits = this.horde.sweep(pos, ball.dir, radius * 1.5, radius, skip);
    } else {
      this.effects.explosion(pos, radius, ball.club.color);
      // el área pega menos que el impacto: agarra a varios y no hay que apuntarle a nadie
      const damage = areaDamageFor(ball.club, this.metersTo(ball, pos), ball.quality);
      hits = this.horde.blast(pos, radius, damage, ball.club.knockback, null, skip);
    }
    this.onEvent?.({ type: 'land', enchant: ball.enchant.id, pos, hits, quality: ball.quality });
    ball.hits += hits;
    if (finish) ball.done = true;
  }

  /** Atravesó a alguien: el efecto va a ese enemigo, y la pelota sigue. */
  private hitEnemy(ball: Ball, enemy: Enemy): void {
    const s = ball.state;
    // los que no atraviesan paran en el primero que tocan: ahí abren su área
    if (!ball.club.pierces) {
      this.burst(ball);
      return;
    }
    ball.hitIds.add(enemy.id);
    ball.hits++;
    const pos = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
    const dir = new THREE.Vector3(s.vel.x, 0, s.vel.z).normalize();
    this.effects.spark(pos, ball.enchant.id === 'damage' ? ball.club.color : ball.enchant.color);
    if (ball.enchant.id === 'ice') {
      enemy.chill(ICE_LINE_SECONDS[ball.quality - 1]);
    } else {
      const damage = damageFor(ball.club, this.metersTo(ball, s.pos), ball.quality);
      const killed = this.horde.damage(enemy, damage, dir, ball.club.knockback);
      if (killed) ball.kills++;
      this.onEvent?.({ type: 'hit', club: ball.club, enemy, pos, damage, quality: ball.quality, killed });
    }
    if (ball.hits >= ball.club.maxHits) ball.done = true;
    else {
      s.vel.x *= 0.88;
      s.vel.z *= 0.88;
    }
  }

  private collide(ball: Ball): void {
    const s = ball.state;
    const linear = ball.club.pierces;
    for (const e of this.horde.enemies) {
      if (!e.alive || e.passed || ball.hitIds.has(e.id)) continue;
      // la altura se mide desde los pies del enemigo, que con relieve no están en y = 0
      if (s.pos.y - e.position.y > e.height + BALL_RADIUS) continue;
      const dx = s.pos.x - e.position.x;
      const dz = s.pos.z - e.position.z;
      const r = e.radius + BALL_RADIUS;
      if (dx * dx + dz * dz > r * r) continue;
      // el escudo, o el aura de un chamán, devuelven la pelota rasante: sin efecto, y esa pelota ya no
      // le pega a ese enemigo. Los globos no se frenan: hacen lo suyo donde tocan.
      if (linear && (e.warded || e.blocks(s.vel.x, s.vel.y, s.vel.z))) {
        ball.hitIds.add(e.id);
        const n = Math.hypot(dx, dz) || 1;
        const dot = (s.vel.x * dx + s.vel.z * dz) / n;
        s.vel.x = (s.vel.x - (2 * dot * dx) / n) * 0.4;
        s.vel.z = (s.vel.z - (2 * dot * dz) / n) * 0.4;
        this.effects.spark(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z), e.warded ? 0xb26bff : 0xcccccc);
        this.onEvent?.({ type: 'blocked', enemy: e, warded: e.warded });
        continue;
      }
      this.hitEnemy(ball, e);
      if (ball.done) return;
    }
  }

  private settle(ball: Ball): void {
    if (ball.settled) return;
    ball.settled = true;
    this.onEvent?.({ type: 'settled', club: ball.club, hits: ball.hits, kills: ball.kills });
  }

  update(dt: number): void {
    for (const ball of this.list) {
      const s = ball.state;
      ball.age += dt;
      const speed = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
      const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
      for (let i = 0; i < steps && !ball.done && !s.resting; i++) {
        const landed = stepBall(s, dt / steps, ball.club, relief.on ? heightAt : undefined);
        // la muralla devuelve la pelota
        if (s.pos.z < GATE_Z - 0.4 && s.vel.z < 0) {
          s.pos.z = GATE_Z - 0.4;
          s.vel.z *= -0.5;
        }
        if (landed) {
          // el que abre área lo hace donde toca el piso; el globo se queda ahí y el hierro sigue rodando
          if (ball.club.spread > 0 && ball.club.loftDeg > 0.001 && !ball.burst) {
            this.burst(ball, ball.club.stopsOnLand);
            if (ball.done) break;
          }
          if (s.bounces === 1) this.onEvent?.({ type: 'bounce', pos: new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z) });
        }
        this.collide(ball);
      }
      // la que va rodando (el putter) hace su efecto donde para
      if (s.resting && !ball.done && !ball.burst && ball.club.spread > 0) this.burst(ball);
      if (s.resting) ball.restTime += dt;
      if (ball.restTime > 1.2 || ball.age > 14 || Math.abs(s.pos.x) > 90 || s.pos.z > 150) ball.done = true;
      if (ball.done || s.resting || ball.age >= SETTLE_AFTER) this.settle(ball);

      ball.mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
      const t = ball.trailPositions;
      t.copyWithin(3, 0, t.length - 3);
      t[0] = s.pos.x;
      t[1] = s.pos.y;
      t[2] = s.pos.z;
      ball.trail.geometry.attributes.position.needsUpdate = true;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const ball = this.list[i];
      if (!ball.done) continue;
      this.scene.remove(ball.mesh, ball.trail);
      (ball.mesh.material as THREE.Material).dispose();
      ball.trail.geometry.dispose();
      (ball.trail.material as THREE.Material).dispose();
      this.list.splice(i, 1);
    }
  }
}
