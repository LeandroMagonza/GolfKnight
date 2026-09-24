// Pelotas en juego: física de core/ballistics y choques contra la horda, según cómo entrega el palo.
//
// Dos cosas independientes: si el palo **atraviesa** (le pega a cada uno que toca en el aire y sigue: el
// driver) y si **abre un área** (el hierro y el wedge, más grande cuanto más alto vuela). Los palos ya
// no llevan poder: el hielo, el vendaval y la granada van con su propia pelota (ver game/abilities).
import * as THREE from 'three';
import { BALL_RADIUS, launch, launchWith, stepBall, type BallState, type BounceParams } from '../core/ballistics';
import { areaDamageFor, damageFor, hasArea, rollFrictionFor, spreadFor, type Club } from '../core/clubs';
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
  /** Rebote y rodado ya resueltos para este tiro: la fricción depende del nivel del golpe. */
  bounce: BounceParams;
  /** Nivel de calidad del golpe: 1, 2 o 3. */
  quality: number;
  /** De dónde salió, para saber a qué distancia pega. */
  from: THREE.Vector3;
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
  /** Un palo le pegó a alguien. */
  | { type: 'hit'; club: Club; enemy: Enemy; pos: THREE.Vector3; damage: number; quality: number; killed: boolean }
  /** Un palo de área abrió su área. */
  | { type: 'land'; pos: THREE.Vector3; hits: number; quality: number }
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
    // la fricción del rodado sale del nivel del golpe: con el putter, cuanto mejor le pegás, más rápido va
    const bounce: BounceParams = {
      restitution: shot.club.restitution,
      bounceKeep: shot.club.bounceKeep,
      gravity: shot.club.gravity,
      rollFriction: rollFrictionFor(shot.club, shot.quality),
    };
    const state = lift
      ? launchWith({ x: shot.from.x, y: heightAt(shot.from.x, shot.from.z) + BALL_RADIUS, z: shot.from.z }, shot.dir.x, shot.dir.z, lift.speed, lift.angle)
      : launch({ x: shot.from.x, y: BALL_RADIUS, z: shot.from.z }, shot.dir.x, shot.dir.z, range, loft, shot.club.gravity, bounce.rollFriction);
    const color = shot.club.color;
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
      state, club: shot.club, bounce, quality: shot.quality,
      from: shot.from.clone(),
      hitIds: new Set(), hits: 0, burst: false, kills: 0, settled: false, age: 0, restTime: 0, mesh, trail, trailPositions, done: false,
    };
    this.list.push(ball);
    return ball;
  }

  /** A qué distancia del golfista pegó: es lo que decide cuánto hace el palo. */
  private metersTo(ball: Ball, pos: { x: number; z: number }): number {
    return Math.hypot(pos.x - ball.from.x, pos.z - ball.from.z);
  }

  /**
   * La pelota llegó (al piso o a un enemigo): abre su área acá. `finish` dice si con eso se termina el
   * tiro (el globo se queda donde cayó) o si la pelota sigue viaje rodando (el hierro que atraviesa).
   */
  private burst(ball: Ball, finish = true, at?: { x: number; y: number; z: number }): void {
    ball.burst = true;
    const pos = new THREE.Vector3(at?.x ?? ball.state.pos.x, at?.y ?? ball.state.pos.y, at?.z ?? ball.state.pos.z);
    const radius = spreadFor(ball.club, ball.quality);
    this.effects.explosion(pos, radius, ball.club.color);
    // el área pega menos que el impacto: agarra a varios y no hay que apuntarle a nadie. Al que esta
    // misma pelota ya golpeó no le toca otra vez: un tiro es un daño por enemigo
    const damage = areaDamageFor(ball.club, this.metersTo(ball, pos), ball.quality);
    const hits = this.horde.blast(pos, radius, damage, ball.club.knockback, null, ball.hitIds);
    this.onEvent?.({ type: 'land', pos, hits, quality: ball.quality });
    ball.hits += hits;
    if (finish) ball.done = true;
  }

  /**
   * El pelotazo a un enemigo puntual, con el número de **impacto** (no el del área). `finish` dice si con
   * eso se termina el tiro: el que atraviesa sigue, y pierde un poco de velocidad.
   */
  private directHit(ball: Ball, enemy: Enemy, finish: boolean): void {
    const s = ball.state;
    ball.hitIds.add(enemy.id);
    ball.hits++;
    const pos = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
    this.effects.spark(pos, ball.club.color);
    const dir = new THREE.Vector3(s.vel.x, 0, s.vel.z).normalize();
    const damage = damageFor(ball.club, this.metersTo(ball, s.pos), ball.quality);
    const killed = this.horde.damage(enemy, damage, dir, ball.club.knockback);
    if (killed) ball.kills++;
    this.onEvent?.({ type: 'hit', club: ball.club, enemy, pos, damage, quality: ball.quality, killed });
    if (finish) ball.done = true;
  }

  /** La pelota tocó a alguien: según el palo, lo atraviesa, revienta ahí, o le pega solo a él. */
  private hitEnemy(ball: Ball, enemy: Enemy): void {
    // los que no atraviesan terminan en el primero que tocan. Si abren área, revientan **al ras del
    // piso, abajo del enemigo**, que es lo que se ve; si no, le pegan a él solo.
    if (!ball.club.pierces) {
      if (hasArea(ball.club)) {
        // El que se come el pelotazo cobra el **impacto**, que pega más; los de alrededor, el área.
        // Queda marcado en hitIds, así que la explosión no le cobra de nuevo: un daño por enemigo.
        this.directHit(ball, enemy, false);
        // el globo detona donde cayó, que es adonde apuntaste; el que revienta al contacto, en el enemigo
        const at = ball.club.burstsOnGround ? undefined : { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z };
        this.burst(ball, true, at);
      } else {
        this.directHit(ball, enemy, true);
      }
      return;
    }
    // el que atraviesa: a cada uno que toca le cobra el pelotazo y sigue
    this.directHit(ball, enemy, ball.hits + 1 >= ball.club.maxHits);
    if (!ball.done) {
      ball.state.vel.x *= 0.88;
      ball.state.vel.z *= 0.88;
    }
  }

  private collide(ball: Ball): void {
    const s = ball.state;
    for (const e of this.horde.enemies) {
      if (!e.alive || e.passed || ball.hitIds.has(e.id)) continue;
      // la altura se mide desde los pies del enemigo, que con relieve no están en y = 0
      if (s.pos.y - e.position.y > e.height + BALL_RADIUS) continue;
      const dx = s.pos.x - e.position.x;
      const dz = s.pos.z - e.position.z;
      const r = e.radius + BALL_RADIUS;
      if (dx * dx + dz * dz > r * r) continue;
      // El escudo, o el aura de un chamán, devuelven **cualquier** pelota que les llegue de frente, no
      // solo la que atraviesa: si no, el hierro reventaba contra el escudo y lo mataba igual. Lo único
      // que lo pasa es lo que cae casi a plomo, que es el globo del wedge (ver Enemy.blocks).
      if (e.warded || e.blocks(s.vel.x, s.vel.y, s.vel.z)) {
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
        const landed = stepBall(s, dt / steps, ball.bounce, relief.on ? heightAt : undefined);
        // la muralla devuelve la pelota
        if (s.pos.z < GATE_Z - 0.4 && s.vel.z < 0) {
          s.pos.z = GATE_Z - 0.4;
          s.vel.z *= -0.5;
        }
        if (landed) {
          // solo el globo abre su área por tocar el piso; los demás tienen que conectar con alguien
          if (ball.club.burstsOnGround && hasArea(ball.club) && ball.club.loftDeg > 0.001 && !ball.burst) {
            this.burst(ball, ball.club.stopsOnLand);
            if (ball.done) break;
          }
          if (s.bounces === 1) this.onEvent?.({ type: 'bounce', pos: new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z) });
        }
        this.collide(ball);
      }
      // la que para sin haber tocado a nadie y abre área por el piso (el globo) hace su efecto ahí
      if (s.resting && !ball.done && !ball.burst && ball.club.burstsOnGround && hasArea(ball.club)) this.burst(ball);
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
