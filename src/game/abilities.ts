// Las habilidades en juego: cada una tira **su propia pelota**, que no tiene nada que ver con las del
// puesto. Acá viven esas pelotas, las zonas de hielo que quedan en el piso, qué habilidades se tienen y
// cuánto le falta a cada recarga. Los números están en core/abilities.
import * as THREE from 'three';
import { ABILITIES, ABILITY_ORDER, GRENADE, ICE, WIND, type AbilityId } from '../core/abilities';
import { BALL_RADIUS, launchSpeed, launchWith, stepBall, type BallState, type BounceParams } from '../core/ballistics';
import { heightAt, relief } from '../core/terrain';
import type { Effects } from './effects';
import type { Horde } from './enemies';
import { GATE_Z } from './world';

/**
 * Cómo vuela cada una. El hielo es un globo como el del wedge, pero con más gravedad para que no tarde
 * tanto; la granada, un tiro rápido y bajo; el vendaval, rasante como el driver.
 */
const FLIGHT: Record<AbilityId, { loftDeg: number; gravity: number; bounce: BounceParams }> = {
  ice: { loftDeg: 55, gravity: 40, bounce: { restitution: 0, bounceKeep: 0, gravity: 40 } },
  grenade: { loftDeg: 30, gravity: 40, bounce: { restitution: 0, bounceKeep: 0, gravity: 40 } },
  wind: { loftDeg: 3.5, gravity: 22, bounce: { restitution: 0.3, bounceKeep: 0.8, gravity: 22 } },
};

const TRAIL_POINTS = 14;
const MAX_STEP = 0.3;
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS * 1.3, 12, 10);
const zoneGeo = new THREE.CircleGeometry(1, 48);
const zoneEdgeGeo = new THREE.RingGeometry(0.94, 1, 64);

interface AbilityBall {
  id: AbilityId;
  state: BallState;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  /** Hasta dónde va: el vendaval barre hasta acá. */
  range: number;
  /** Vendaval: hasta dónde llegó el viento, que va detrás de la pelota, y a quiénes ya agarró. */
  swept: number;
  caught: Set<number>;
  age: number;
  done: boolean;
  mesh: THREE.Mesh;
  trail: THREE.Line;
  trailPositions: Float32Array;
}

interface IceZone {
  pos: THREE.Vector3;
  radius: number;
  left: number;
  /** Todos los que alguna vez la pisaron, para el aviso. */
  seen: Set<number>;
  group: THREE.Group;
  fill: THREE.MeshBasicMaterial;
  edge: THREE.MeshBasicMaterial;
}

export type AbilityEvent =
  | { type: 'cast'; id: AbilityId }
  /** Cayó el hielo: la zona quedó armada y agarró a `hits` de entrada. */
  | { type: 'zone'; pos: THREE.Vector3; hits: number }
  /** Terminó de pasar el vendaval: `hits` juntados sobre la línea. */
  | { type: 'gust'; pos: THREE.Vector3; hits: number }
  /** Cayó la granada: `hits` silenciados. */
  | { type: 'grenade'; pos: THREE.Vector3; hits: number };

export type CastResult = 'ok' | 'locked' | 'cooling';

export class Abilities {
  /** Habilidades ya ganadas: las van dando las oleadas. */
  readonly owned = new Set<AbilityId>();
  /** Segundos de recarga que le quedan a cada una. */
  readonly cooldowns: Record<AbilityId, number> = { grenade: 0, ice: 0, wind: 0 };
  onEvent: ((e: AbilityEvent) => void) | null = null;
  private readonly balls: AbilityBall[] = [];
  private readonly zones: IceZone[] = [];

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {}

  ready(id: AbilityId): boolean {
    return this.owned.has(id) && this.cooldowns[id] <= 0;
  }

  /**
   * Tira una habilidad desde `from` hacia `dir` (unitario en el piso). `distance` es a cuántos metros
   * está el mouse: el hielo y la granada caen ahí, recortado a su alcance; el vendaval va siempre hasta
   * el final, como el driver.
   */
  cast(id: AbilityId, from: THREE.Vector3, dir: THREE.Vector3, distance: number): CastResult {
    if (!this.owned.has(id)) return 'locked';
    if (this.cooldowns[id] > 0) return 'cooling';
    const ability = ABILITIES[id];
    this.cooldowns[id] = ability.cooldown;
    const range = id === 'wind' ? ability.range : THREE.MathUtils.clamp(distance, 1, ability.range);
    const flight = FLIGHT[id];
    const angle = THREE.MathUtils.degToRad(flight.loftDeg);
    const startH = heightAt(from.x, from.z);
    // el globo y la granada se calculan para caer en el punto apuntado aunque esté más alto o más bajo;
    // el vendaval sale siempre igual, y si hay una loma en el medio, choca
    const rise = id === 'wind' || !relief.on ? 0 : heightAt(from.x + dir.x * range, from.z + dir.z * range) - startH;
    const speed = launchSpeed(range, angle, flight.gravity, rise);
    const state = launchWith({ x: from.x, y: startH + BALL_RADIUS, z: from.z }, dir.x, dir.z, speed, angle);

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: ability.color, emissiveIntensity: 1.2 });
    const mesh = new THREE.Mesh(ballGeo, mat);
    mesh.position.set(state.pos.x, state.pos.y, state.pos.z);
    const trailPositions = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i++) trailPositions.set([state.pos.x, state.pos.y, state.pos.z], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: ability.color, transparent: true, opacity: 0.85 }));
    trail.frustumCulled = false;
    this.scene.add(mesh, trail);
    this.balls.push({
      id, state, from: from.clone(), dir: new THREE.Vector3(dir.x, 0, dir.z).normalize(), range,
      swept: 0, caught: new Set(), age: 0, done: false, mesh, trail, trailPositions,
    });
    this.onEvent?.({ type: 'cast', id });
    return 'ok';
  }

  /** Cayó la pelota del hielo o de la granada: hace lo suyo ahí. */
  private land(ball: AbilityBall): void {
    ball.done = true;
    const s = ball.state;
    const pos = new THREE.Vector3(s.pos.x, heightAt(s.pos.x, s.pos.z), s.pos.z);
    if (ball.id === 'ice') {
      this.effects.frost(pos, ICE.radius);
      const zone = this.makeZone(pos);
      const hits = this.horde.chillAround(pos, zone.radius, ICE.linger, zone.seen);
      this.onEvent?.({ type: 'zone', pos, hits });
    } else if (ball.id === 'grenade') {
      this.effects.explosion(pos, GRENADE.radius, ABILITIES.grenade.color);
      // el anillo chico marca el centro, el que no se mueve
      this.effects.swipe(pos, GRENADE.radius * GRENADE.core);
      const hits = this.horde.spread(pos, ball.dir, GRENADE.radius, GRENADE.radius * GRENADE.core, GRENADE.push, GRENADE.silence);
      this.onEvent?.({ type: 'grenade', pos, hits });
    }
  }

  private makeZone(pos: THREE.Vector3): IceZone {
    const color = ABILITIES.ice.color;
    const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    const edge = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    // sobre una pendiente el disco, que es plano, se hundiría en el terreno: con relieve va por encima
    if (relief.on) fill.depthTest = edge.depthTest = false;
    const group = new THREE.Group();
    group.add(new THREE.Mesh(zoneGeo, fill), new THREE.Mesh(zoneEdgeGeo, edge));
    group.rotation.x = -Math.PI / 2;
    group.position.set(pos.x, pos.y + 0.06, pos.z);
    group.scale.setScalar(ICE.radius);
    this.scene.add(group);
    const zone: IceZone = { pos, radius: ICE.radius, left: ICE.duration, seen: new Set(), group, fill, edge };
    this.zones.push(zone);
    return zone;
  }

  /**
   * El viento del vendaval va **detrás** de la pelota: barre solo el tramo que ya pasó, así que a cada
   * uno lo acomoda después de pasarle por al lado, nunca antes. A cada uno que agarra lo junta sobre la
   * línea.
   */
  private blow(ball: AbilityBall): void {
    const s = ball.state;
    const gone = Math.min(ball.range, (s.pos.x - ball.from.x) * ball.dir.x + (s.pos.z - ball.from.z) * ball.dir.z);
    if (gone > ball.swept) {
      const mid = ball.from.clone().addScaledVector(ball.dir, (ball.swept + gone) / 2);
      mid.y = heightAt(mid.x, mid.z);
      this.horde.sweep(mid, ball.dir, WIND.halfWidth, (gone - ball.swept) / 2, ball.caught);
      // un remolino cada tantos metros: uno por cuadro sería una nube continua
      if (Math.floor(gone / 6) > Math.floor(ball.swept / 6)) {
        this.effects.swipe(new THREE.Vector3(s.pos.x, heightAt(s.pos.x, s.pos.z), s.pos.z), WIND.halfWidth);
      }
      ball.swept = gone;
    }
    if (ball.swept >= ball.range - 0.05 || s.resting || ball.age > 4) {
      ball.done = true;
      const mid = ball.from.clone().addScaledVector(ball.dir, ball.swept / 2);
      mid.y = heightAt(mid.x, mid.z);
      this.onEvent?.({ type: 'gust', pos: mid, hits: ball.caught.size });
    }
  }

  update(dt: number): void {
    for (const id of ABILITY_ORDER) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);

    for (const ball of this.balls) {
      const s = ball.state;
      ball.age += dt;
      const speed = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
      const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
      for (let i = 0; i < steps && !ball.done && !s.resting; i++) {
        const landed = stepBall(s, dt / steps, FLIGHT[ball.id].bounce, relief.on ? heightAt : undefined);
        if (s.pos.z < GATE_Z - 0.4 && s.vel.z < 0) {
          s.pos.z = GATE_Z - 0.4;
          s.vel.z *= -0.5;
        }
        if (landed && ball.id !== 'wind') this.land(ball);
      }
      if (ball.id === 'wind' && !ball.done) this.blow(ball);
      else if (!ball.done && (s.resting || ball.age > 6)) this.land(ball);

      ball.mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
      const t = ball.trailPositions;
      t.copyWithin(3, 0, t.length - 3);
      t[0] = s.pos.x;
      t[1] = s.pos.y;
      t[2] = s.pos.z;
      ball.trail.geometry.attributes.position.needsUpdate = true;
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (!ball.done) continue;
      this.scene.remove(ball.mesh, ball.trail);
      (ball.mesh.material as THREE.Material).dispose();
      ball.trail.geometry.dispose();
      (ball.trail.material as THREE.Material).dispose();
      this.balls.splice(i, 1);
    }

    // las zonas de hielo: al que está adentro se le renueva el frío en cada cuadro, así que nunca se le
    // acaba mientras esté ahí. Al salir le quedan `linger` segundos
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.left -= dt;
      if (z.left > 0) this.horde.chillAround(z.pos, z.radius, ICE.linger, z.seen);
      // se apaga en el último medio segundo, para que se vea que se termina
      const fade = Math.min(1, Math.max(0, z.left / 0.5));
      z.fill.opacity = 0.28 * fade;
      z.edge.opacity = 0.85 * fade;
      if (z.left > 0) continue;
      this.scene.remove(z.group);
      z.fill.dispose();
      z.edge.dispose();
      this.zones.splice(i, 1);
    }
  }

  /** Cuántas zonas de hielo hay en el piso y cuánto les queda, para las pruebas. */
  get zoneInfo(): { x: number; z: number; left: number }[] {
    return this.zones.map((z) => ({ x: +z.pos.x.toFixed(1), z: +z.pos.z.toFixed(1), left: +z.left.toFixed(1) }));
  }
}
