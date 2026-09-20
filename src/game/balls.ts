// Pelotas en juego: física de core/ballistics, choques contra la horda y el efecto del
// encantamiento de cada palo. El driver es el único que daña; el hierro y el wedge caen en un punto
// y ahí hacen lo suyo (hielo, empujón).
import * as THREE from 'three';
import { BALL_RADIUS, launch, stepBall, type BallState } from '../core/ballistics';
import { chargeLevel, CRIT_DAMAGE, EXPOSED_SECONDS, ICE_CORE, ICE_PERFECT_AREA, ICE_RADIUS, iceSeconds, PUSH_RADIUS, pushSpeed, type Club } from '../core/clubs';
import type { Effects } from './effects';
import type { Enemy, Horde } from './enemies';
import type { Shot } from './player';
import { GATE_Z } from './world';

const TRAIL_POINTS = 18;
const MAX_STEP = 0.3;
/** Segundos después de los cuales un tiro de driver ya se da por jugado, para la racha. */
const SETTLE_AFTER = 1.8;

export interface Ball {
  state: BallState;
  club: Club;
  power: number;
  perfect: boolean;
  /** Multiplicador de daño con el que salió (racha del driver). */
  damageMul: number;
  launchSpeed: number;
  hitIds: Set<number>;
  hits: number;
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
  | { type: 'hit'; club: Club; enemy: Enemy; direct: boolean; perfect: boolean; killed: boolean }
  | { type: 'ice'; pos: THREE.Vector3; frozen: number; chilled: number; perfect: boolean }
  | { type: 'push'; pos: THREE.Vector3; hits: number; exposed: boolean }
  | { type: 'bounce'; pos: THREE.Vector3 }
  | { type: 'blocked'; enemy: Enemy; warded: boolean }
  /** Un tiro de driver ya se jugó: a cuántos dañó y cuántas bajas hizo. Si no dañó a nadie, corta la racha. */
  | { type: 'settled'; club: Club; hits: number; kills: number };

const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 12, 10);

export class Balls {
  readonly list: Ball[] = [];
  onEvent: ((e: BallEvent) => void) | null = null;

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {}

  fire(shot: Shot, range: number, damageMul = 1): Ball {
    const loft = THREE.MathUtils.degToRad(shot.club.loftDeg);
    const state = launch({ x: shot.from.x, y: BALL_RADIUS, z: shot.from.z }, shot.dir.x, shot.dir.z, range, loft, shot.club.gravity);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: shot.club.color, emissiveIntensity: shot.perfect ? 1.6 : 0.7 });
    const mesh = new THREE.Mesh(ballGeo, mat);
    mesh.position.set(state.pos.x, state.pos.y, state.pos.z);
    const trailPositions = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i++) trailPositions.set([state.pos.x, state.pos.y, state.pos.z], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: shot.club.color, transparent: true, opacity: 0.85 }));
    trail.frustumCulled = false;
    this.scene.add(mesh, trail);
    const ball: Ball = {
      state, club: shot.club, power: shot.power, perfect: shot.perfect, damageMul,
      launchSpeed: Math.hypot(state.vel.x, state.vel.y, state.vel.z),
      hitIds: new Set(), hits: 0, kills: 0, settled: false, age: 0, restTime: 0, mesh, trail, trailPositions, done: false,
    };
    this.list.push(ball);
    return ball;
  }

  private damageOf(ball: Ball): number {
    const s = ball.state;
    // el daño del driver es el nivel de carga (1 a 3); el swing perfecto es el crítico
    const base = ball.club.damage * (ball.perfect ? CRIT_DAMAGE : chargeLevel(ball.power)) * ball.damageMul;
    // De aire pega con todo. Después de picar pierde fuerza con la velocidad.
    if (s.bounces === 0 && !s.rolling) return base;
    const speed = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
    return base * THREE.MathUtils.clamp(speed / (0.5 * ball.launchSpeed), 0.35, 1);
  }

  /** El globo llegó (al piso o a un enemigo): hace su efecto en ese punto y desaparece. */
  private burst(ball: Ball): void {
    const pos = new THREE.Vector3(ball.state.pos.x, ball.state.pos.y, ball.state.pos.z);
    if (ball.club.enchant === 'ice') {
      // congela en el centro y enfría alrededor; el perfecto agranda las dos zonas y dura más
      const wide = ball.perfect ? ICE_PERFECT_AREA : 1;
      this.effects.frost(pos, ICE_RADIUS * wide, false);
      this.effects.frost(pos, ICE_CORE * wide, true);
      const r = this.horde.chillAround(pos, ICE_CORE * wide, ICE_RADIUS * wide, iceSeconds(ball.power, ball.perfect));
      this.onEvent?.({ type: 'ice', pos, frozen: r.frozen, chilled: r.chilled, perfect: ball.perfect });
    } else {
      // el perfecto no empuja más: deja expuestos a los que alcanza
      this.effects.explosion(pos, PUSH_RADIUS, ball.perfect ? 0xffb347 : ball.club.color);
      const hits = this.horde.push(pos, PUSH_RADIUS, pushSpeed(ball.power), ball.perfect ? EXPOSED_SECONDS : 0);
      this.onEvent?.({ type: 'push', pos, hits, exposed: ball.perfect });
    }
    ball.done = true;
  }

  private hitEnemy(ball: Ball, enemy: Enemy): void {
    const s = ball.state;
    const club = ball.club;
    if (club.enchant !== 'pierce') {
      this.burst(ball);
      return;
    }
    ball.hitIds.add(enemy.id);
    ball.hits++;
    const direct = s.bounces === 0 && !s.rolling;
    const pos = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
    const dir = new THREE.Vector3(s.vel.x, 0, s.vel.z).normalize();
    this.effects.spark(pos, club.color);
    const killed = this.horde.damage(enemy, this.damageOf(ball), dir, club.knockback);
    if (killed) ball.kills++;
    this.onEvent?.({ type: 'hit', club, enemy, direct, perfect: ball.perfect, killed });
    if (ball.hits >= club.maxHits) ball.done = true;
    else {
      s.vel.x *= 0.88;
      s.vel.z *= 0.88;
    }
  }

  private collide(ball: Ball): void {
    const s = ball.state;
    const pierce = ball.club.enchant === 'pierce';
    for (const e of this.horde.enemies) {
      if (!e.alive || ball.hitIds.has(e.id)) continue;
      if (s.pos.y > e.height + BALL_RADIUS) continue;
      const dx = s.pos.x - e.position.x;
      const dz = s.pos.z - e.position.z;
      const r = e.radius + BALL_RADIUS;
      if (dx * dx + dz * dz > r * r) continue;
      // el escudo, o el aura de un chamán, devuelven la pelota del driver: sin daño, y esa pelota ya
      // no le pega a ese enemigo. Los globos no se frenan: hacen su efecto donde tocan.
      if (pierce && (e.warded || e.blocks(s.vel.x, s.vel.y, s.vel.z))) {
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
    if (ball.club.enchant === 'pierce') this.onEvent?.({ type: 'settled', club: ball.club, hits: ball.hits, kills: ball.kills });
  }

  update(dt: number): void {
    for (const ball of this.list) {
      const s = ball.state;
      ball.age += dt;
      const speed = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
      const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
      for (let i = 0; i < steps && !ball.done && !s.resting; i++) {
        const landed = stepBall(s, dt / steps, ball.club);
        // la muralla devuelve la pelota
        if (s.pos.z < GATE_Z - 0.4 && s.vel.z < 0) {
          s.pos.z = GATE_Z - 0.4;
          s.vel.z *= -0.5;
        }
        if (landed) {
          if (ball.club.enchant !== 'pierce') {
            this.burst(ball);
            break;
          }
          if (s.bounces === 1) this.onEvent?.({ type: 'bounce', pos: new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z) });
        }
        this.collide(ball);
      }
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
