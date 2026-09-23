// Pelotas en juego: física de core/ballistics, choques contra la horda, y el efecto del poder aplicado
// según cómo entrega el palo.
//
// Dos cosas independientes: si el palo **atraviesa** (le aplica el efecto a cada uno que toca en el
// aire y sigue: driver y hierro) y si **abre un área** donde toca el piso (todos menos el driver, más
// grande cuanto más alto vuela). El hierro hace las dos: atraviesa, abre un área chica donde cae, y
// después sigue rodando. El vendaval con el driver es la excepción prolija: como no tiene punto de
// caída, el viento pasa como un pasillo angosto a lo largo de todo el tiro.
import * as THREE from 'three';
import { BALL_RADIUS, launch, launchWith, stepBall, type BallState, type BounceParams } from '../core/ballistics';
import { areaDamageFor, damageFor, hasArea, powerSpreadFor, rollFrictionFor, stacksPower, ICE_LINE_SECONDS, ICE_SECONDS, PUSH_LINE_HALF_WIDTH, QUALITY_AREA, spreadFor, type Club, type Enchant, type EnchantId } from '../core/clubs';
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
  enchant: Enchant;
  /** Nivel de calidad del golpe: 1, 2 o 3. */
  quality: number;
  /** De dónde salió, para saber a qué distancia pega. */
  from: THREE.Vector3;
  /** Hacia dónde salió, en el piso (unitario). Al caer, la velocidad ya no lo dice. */
  dir: THREE.Vector3;
  hitIds: Set<number>;
  /**
   * A quiénes ya les aplicó el **efecto del poder**. Va aparte de `hitIds` porque ahora un mismo tiro
   * hace las dos cosas: nadie cobra dos veces el daño ni se enfría dos veces, pero el que cobró el
   * pelotazo también se enfría.
   */
  powerIds: Set<number>;
  /** El poder ya salió: no vuelve a salir aunque la pelota siga picando. */
  powerDone: boolean;
  hits: number;
  /**
   * Vendaval con un palo lineal: el pasillo de viento que va **detrás** de la pelota. `swept` es hasta
   * dónde llegó el viento, que nunca pasa a la pelota, y `hits` lleva la cuenta para avisar una sola
   * vez al final.
   */
  wind?: { half: number; range: number; swept: number; hits: number; toldAt: number; reported: boolean };
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
      state, club: shot.club, bounce, enchant: shot.enchant, quality: shot.quality,
      from: shot.from.clone(),
      dir: new THREE.Vector3(shot.dir.x, 0, shot.dir.z).normalize(),
      hitIds: new Set(), powerIds: new Set(), powerDone: false, hits: 0, burst: false, kills: 0, settled: false, age: 0, restTime: 0, mesh, trail, trailPositions, done: false,
    };
    this.list.push(ball);
    // El vendaval con el driver, que es lineal y no abre área, no tiene punto de caída: el viento pasa
    // por todo el tiro, en un pasillo angosto, y deja en fila a los que estaban cerca de la línea. Va
    // **detrás** de la pelota, no antes: arrastraba a los enemigos hacia la línea en el mismo instante
    // en que se soltaba el tiro, así que la pelota salía hacia un campo que ya se había reacomodado.
    if (ball.club.pierces && !hasArea(ball.club) && ball.enchant.id === 'push') {
      ball.wind = { half: PUSH_LINE_HALF_WIDTH * QUALITY_AREA[ball.quality - 1], range, swept: 0, hits: 0, toldAt: 0, reported: false };
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
  private burst(ball: Ball, finish = true, at?: { x: number; y: number; z: number }): void {
    ball.burst = true;
    const pos = new THREE.Vector3(at?.x ?? ball.state.pos.x, at?.y ?? ball.state.pos.y, at?.z ?? ball.state.pos.z);
    const radius = spreadFor(ball.club, ball.quality);
    // al que esta misma pelota ya atravesó no le toca otra vez: el hierro atraviesa y además abre un
    // área donde cae, pero un tiro es un daño por enemigo
    let hits = 0;
    if (ball.enchant.id === 'damage' || stacksPower(ball.club)) {
      this.effects.explosion(pos, radius, ball.club.color);
      // el área pega menos que el impacto: agarra a varios y no hay que apuntarle a nadie
      const damage = areaDamageFor(ball.club, this.metersTo(ball, pos), ball.quality);
      hits = this.horde.blast(pos, radius, damage, ball.club.knockback, null, ball.hitIds);
    }
    hits += this.powerAt(ball, pos);
    this.onEvent?.({ type: 'land', enchant: ball.enchant.id, pos, hits, quality: ball.quality });
    ball.hits += hits;
    if (finish) ball.done = true;
  }

  /**
   * El efecto del poder, en **su propia área** alrededor de donde llegó la pelota. Va aparte del daño:
   * el driver, el hierro y el putter hacen su número de siempre y además enfrían o juntan (ver
   * `stacksPower`). El wedge es el que no, porque su daño ya es el área.
   */
  private powerAt(ball: Ball, pos: THREE.Vector3): number {
    if (ball.enchant.id === 'damage') return 0;
    ball.powerDone = true;
    const radius = powerSpreadFor(ball.club, ball.quality);
    if (radius <= 0) return 0;
    if (ball.enchant.id === 'ice') {
      this.effects.frost(pos, radius);
      // el que atraviesa alcanza a muchos de un saque, así que su hielo dura menos
      const seconds = (ball.club.pierces ? ICE_LINE_SECONDS : ICE_SECONDS)[ball.quality - 1];
      return this.horde.chillAround(pos, radius, seconds, ball.powerIds);
    }
    this.effects.explosion(pos, radius, ball.enchant.color);
    return this.horde.sweep(pos, ball.dir, radius * 1.5, radius, ball.powerIds, true);
  }

  /**
   * El pelotazo a un enemigo puntual, con el número de **impacto** (no el del área). `finish` dice si
   * con eso se termina el tiro (el putter) o si además va a salir una explosión alrededor (el hierro).
   */
  private directHit(ball: Ball, enemy: Enemy, finish = true, withPower = true): void {
    const s = ball.state;
    ball.hitIds.add(enemy.id);
    ball.hits++;
    const pos = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
    this.effects.spark(pos, ball.enchant.id === 'damage' ? ball.club.color : ball.enchant.color);
    const dir = new THREE.Vector3(s.vel.x, 0, s.vel.z).normalize();
    const damage = damageFor(ball.club, this.metersTo(ball, s.pos), ball.quality);
    const killed = this.horde.damage(enemy, damage, dir, ball.club.knockback);
    if (killed) ball.kills++;
    this.onEvent?.({ type: 'hit', club: ball.club, enemy, pos, damage, quality: ball.quality, killed });
    // y además el efecto, alrededor del que se la comió. `withPower` en false cuando justo después va a
    // salir el área del palo, que ya lo aplica: si no, salían dos veces los mismos copos
    if (withPower) {
      const hits = this.powerAt(ball, pos);
      if (hits) this.onEvent?.({ type: 'land', enchant: ball.enchant.id, pos, hits, quality: ball.quality });
    }
    if (finish) ball.done = true;
  }

  /** La pelota tocó a alguien: según el palo, lo atraviesa, revienta ahí, o le pega solo a él. */
  private hitEnemy(ball: Ball, enemy: Enemy): void {
    const s = ball.state;
    // los que no atraviesan terminan en el primero que tocan. Si abren área, revientan **al ras del
    // piso, abajo del enemigo**, que es lo que se ve; si no, le pegan a él solo.
    if (!ball.club.pierces) {
      if (hasArea(ball.club)) {
        // El que se come el pelotazo cobra el **impacto**, que pega más; los de alrededor, el área.
        // Queda marcado en hitIds, así que la explosión no le cobra de nuevo: un daño por enemigo.
        if (ball.enchant.id === 'damage' || stacksPower(ball.club)) this.directHit(ball, enemy, false, false);
        // el globo detona donde cayó, que es adonde apuntaste; el que revienta al contacto, en el enemigo
        const at = ball.club.burstsOnGround ? undefined : { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z };
        this.burst(ball, true, at);
      } else {
        this.directHit(ball, enemy);
      }
      return;
    }
    // el que atraviesa: a cada uno que toca le cobra el pelotazo y le deja el efecto alrededor
    ball.hitIds.add(enemy.id);
    ball.hits++;
    const pos = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
    const dir = new THREE.Vector3(s.vel.x, 0, s.vel.z).normalize();
    this.effects.spark(pos, ball.enchant.id === 'damage' ? ball.club.color : ball.enchant.color);
    const damage = damageFor(ball.club, this.metersTo(ball, s.pos), ball.quality);
    const killed = this.horde.damage(enemy, damage, dir, ball.club.knockback);
    if (killed) ball.kills++;
    this.onEvent?.({ type: 'hit', club: ball.club, enemy, pos, damage, quality: ball.quality, killed });
    const powered = this.powerAt(ball, pos);
    if (powered) this.onEvent?.({ type: 'land', enchant: ball.enchant.id, pos, hits: powered, quality: ball.quality });
    if (ball.hits >= ball.club.maxHits) ball.done = true;
    else {
      s.vel.x *= 0.88;
      s.vel.z *= 0.88;
    }
  }

  /**
   * El pasillo de viento que sigue a la pelota del vendaval lineal. Barre **solo el tramo que la pelota
   * ya dejó atrás**, así que a cada uno lo acomoda después de pasarle por al lado, nunca antes. Los que
   * va agarrando quedan marcados en `hitIds`, así que el viento no los vuelve a mover.
   */
  private blowWind(ball: Ball): void {
    const w = ball.wind!;
    const s = ball.state;
    const gone = Math.min(w.range, (s.pos.x - ball.from.x) * ball.dir.x + (s.pos.z - ball.from.z) * ball.dir.z);
    if (gone > w.swept) {
      const mid = ball.from.clone().addScaledVector(ball.dir, (w.swept + gone) / 2);
      mid.y = heightAt(mid.x, mid.z);
      w.hits += this.horde.sweep(mid, ball.dir, w.half, (gone - w.swept) / 2, ball.powerIds);
      // el remolino cada tantos metros: uno por cuadro sería una nube continua
      if (gone - w.toldAt >= 6) {
        w.toldAt = gone;
        this.effects.swipe(new THREE.Vector3(s.pos.x, heightAt(s.pos.x, s.pos.z), s.pos.z), w.half);
      }
      w.swept = gone;
    }
    // el aviso sale una sola vez, cuando el viento ya terminó de pasar
    if (!w.reported && (ball.done || s.resting || w.swept >= w.range - 0.05)) {
      w.reported = true;
      ball.hits += w.hits;
      const mid = ball.from.clone().addScaledVector(ball.dir, w.swept / 2);
      mid.y = heightAt(mid.x, mid.z);
      this.onEvent?.({ type: 'land', enchant: 'push', pos: mid, hits: w.hits, quality: ball.quality });
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
          } else if (ball.club.powerOnGround && !ball.powerDone && ball.enchant.id !== 'damage') {
            // el hierro: su daño pide conectar, pero el efecto cae donde cayó la pelota
            const at = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
            const hits = this.powerAt(ball, at);
            ball.hits += hits;
            this.onEvent?.({ type: 'land', enchant: ball.enchant.id, pos: at, hits, quality: ball.quality });
          }
          if (s.bounces === 1) this.onEvent?.({ type: 'bounce', pos: new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z) });
        }
        this.collide(ball);
      }
      // el viento del vendaval lineal va detrás: barre lo que la pelota ya pasó
      if (ball.wind) this.blowWind(ball);
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
