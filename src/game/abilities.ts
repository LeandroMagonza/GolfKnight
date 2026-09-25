// Las habilidades en juego. Cada una tira **su propia pelota** (o su carrito, su bandera, su palo), que
// no tiene nada que ver con las del puesto. Acá viven las cuatro que tenés en Q, W, E y R con su nivel y
// su recarga, y todo lo que dejan en el campo: zonas de hielo, hoyos, banderas, carritos y boomerangs.
// Los números están en core/abilities.
//
// Lo que tiene que ver con el golfista o con los puestos (los tiros de palo y elemento, la lluvia de
// pelotas, el caddie, el clon y el palo que se tira) lo hace el juego, a través de `hooks`.
import * as THREE from 'three';
import {
  ABILITIES, BOOMERANG, CADDIE, CART, CLONE, cooldownAt, FLAG, GRENADE, HOLE, ICE, LENS, lv, MAX_LEVEL, POWDER, SLOTS, WIND,
  type AbilityId, type Element,
} from '../core/abilities';
import { BALL_RADIUS, launchSpeed, launchWith, stepBall, type BallState, type BounceParams } from '../core/ballistics';
import { PERK_NUMBERS } from '../core/cards';
import type { ClubId } from '../core/clubs';
import { heightAt, relief } from '../core/terrain';
import type { Effects } from './effects';
import type { Enemy, Horde } from './enemies';
import { FIELD_HALF_WIDTH, GATE_Z } from './world';

/** Lo que las habilidades le piden al juego. */
export interface AbilityHooks {
  /** Tiro de palo y elemento: sale del puesto, con pelota gratis, cargado a `quality`. */
  fireShot(club: ClubId, quality: number, element: Element): void;
  /** Lluvia de pelotas: una en cada puesto. Devuelve cuántas puso. */
  fillSpots(): number;
  /** Caddie dorado: tu puesto no se queda sin pelota durante `seconds`. */
  startCaddie(seconds: number): void;
  /** Clon: tus próximos `shots` tiros salen también desde donde estás ahora. */
  placeClone(shots: number, life: number): void;
  /** Boomerang: tira el palo de la mano. Devuelve cuál, o null si no se puede ahora. */
  throwClub(): ClubId | null;
  /** Volvió el boomerang. */
  catchClub(): void;
  /** Una copia del modelo del palo, para que el boomerang sea el palo de verdad. */
  clubMesh(): THREE.Object3D;
}

/** Cómo vuela la pelota de cada habilidad que se tira. */
type Flight = { loftDeg: number; gravity: number; bounce: BounceParams };
const LOB: Flight = { loftDeg: 55, gravity: 40, bounce: { restitution: 0, bounceKeep: 0, gravity: 40 } };
const QUICK: Flight = { loftDeg: 30, gravity: 40, bounce: { restitution: 0, bounceKeep: 0, gravity: 40 } };
const FLAT: Flight = { loftDeg: 3.5, gravity: 22, bounce: { restitution: 0.3, bounceKeep: 0.8, gravity: 22 } };

const TRAIL_POINTS = 14;
const MAX_STEP = 0.3;
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS * 1.3, 12, 10);
const discGeo = new THREE.CircleGeometry(1, 48);
const edgeGeo = new THREE.RingGeometry(0.94, 1, 64);

interface AbilityBall {
  id: AbilityId;
  level: number;
  flight: Flight;
  state: BallState;
  from: THREE.Vector3;
  dir: THREE.Vector3;
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

/** Algo que queda en el campo un rato: zona de hielo, hoyo o bandera. */
interface Mark {
  kind: 'ice' | 'hole' | 'flag';
  pos: THREE.Vector3;
  radius: number;
  left: number;
  total: number;
  /** Hoyo: a cuántos se puede tragar todavía. */
  swallows: number;
  seen: Set<number>;
  group: THREE.Group;
  mats: THREE.Material[];
}

interface Cart {
  x: number;
  z: number;
  dir: number;
  level: number;
  hit: Set<number>;
  mesh: THREE.Group;
}

interface Boomerang {
  club: ClubId;
  level: number;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  side: THREE.Vector3;
  t: number;
  out: Set<number>;
  back: Set<number>;
  mesh: THREE.Object3D;
}

export type AbilityEvent =
  | { type: 'cast'; id: AbilityId }
  /** Cayó el hielo: la zona quedó armada y agarró a `hits` de entrada. */
  | { type: 'zone'; pos: THREE.Vector3; hits: number }
  /** Terminó de pasar el vendaval: `hits` juntados sobre la línea. */
  | { type: 'gust'; pos: THREE.Vector3; hits: number }
  /** Cayó la granada: `hits` silenciados. */
  | { type: 'grenade'; pos: THREE.Vector3; hits: number }
  /** Cayó una habilidad que marca o agranda: `hits` alcanzados. */
  | { type: 'mark'; id: AbilityId; pos: THREE.Vector3; hits: number }
  /** El hoyo se tragó a uno. */
  | { type: 'swallow'; enemy: Enemy }
  /** El carrito o el boomerang le pegaron a uno. */
  | { type: 'bump'; pos: THREE.Vector3 };

export type CastResult = 'ok' | 'empty' | 'cooling' | 'blocked';

export class Abilities {
  /** Las habilidades en Q, W, E y R, en ese orden, con su nivel. */
  readonly slots: { id: AbilityId; level: number }[] = [];
  /** Segundos de recarga que le quedan a cada lugar. */
  readonly cooldowns: number[] = new Array(SLOTS).fill(0);
  /** Segundo aire: si se tiene, y cuánto le falta. */
  readonly secondWind = { owned: false, left: 0 };
  onEvent: ((e: AbilityEvent) => void) | null = null;
  hooks: AbilityHooks | null = null;
  private readonly balls: AbilityBall[] = [];
  private readonly marks: Mark[] = [];
  private readonly carts: Cart[] = [];
  private readonly boomerangs: Boomerang[] = [];

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {}

  levelOf(id: AbilityId): number {
    return this.slots.find((s) => s.id === id)?.level ?? 0;
  }

  /**
   * Aprende una habilidad (carta): si ya la tenés, sube un nivel; si no, va al primer lugar libre.
   * Devuelve false si no había lugar o ya estaba en el máximo.
   */
  learn(id: AbilityId): boolean {
    const have = this.slots.find((s) => s.id === id);
    if (have) {
      if (have.level >= MAX_LEVEL) return false;
      have.level++;
      return true;
    }
    if (this.slots.length >= SLOTS || !ABILITIES[id]) return false;
    this.slots.push({ id, level: 1 });
    return true;
  }

  /** Recarga total del lugar `i`, con el nivel de lo que tiene. */
  cooldownOf(i: number): number {
    const s = this.slots[i];
    return s ? cooldownAt(ABILITIES[s.id], s.level) : 0;
  }

  /**
   * Tira la habilidad del lugar `slot` desde `from` hacia `dir` (unitario en el piso). `aim` es el punto
   * del piso donde está el mouse: lo que cae, cae ahí, recortado a su alcance.
   */
  cast(slot: number, from: THREE.Vector3, dir: THREE.Vector3, aim: THREE.Vector3): CastResult {
    const s = this.slots[slot];
    if (!s) return 'empty';
    if (this.cooldowns[slot] > 0) {
      // segundo aire: sale igual, y la que se gasta es él
      if (!this.secondWind.owned || this.secondWind.left > 0) return 'cooling';
      this.secondWind.left = PERK_NUMBERS.secondWindCooldown;
    } else {
      this.cooldowns[slot] = this.cooldownOf(slot);
    }
    const a = ABILITIES[s.id];
    const level = s.level;
    const distance = Math.hypot(aim.x - from.x, aim.z - from.z);
    const range = THREE.MathUtils.clamp(distance, 1, a.range);
    const at = new THREE.Vector3(from.x + dir.x * range, 0, from.z + dir.z * range);
    at.y = heightAt(at.x, at.z);
    switch (a.kind) {
      case 'grenade': this.throwBall(s.id, level, QUICK, from, dir, range); break;
      case 'iceZone': case 'powder': case 'lens': this.throwBall(s.id, level, LOB, from, dir, range); break;
      case 'wind': this.throwBall(s.id, level, FLAT, from, dir, a.range); break;
      case 'hole': this.makeMark('hole', at, HOLE.radius, HOLE.life, lv(HOLE.swallows, level)); break;
      case 'flag': this.makeMark('flag', at, lv(FLAG.radius, level), lv(FLAG.seconds, level), 0); break;
      case 'cart': this.sendCart(at.z, from.x, level); break;
      case 'boomerang': {
        const club = this.hooks?.throwClub() ?? null;
        if (!club) {
          // no había palo para tirar (ya hay uno volando, o estás en pleno swing): no se gasta
          this.cooldowns[slot] = 0;
          return 'blocked';
        }
        this.throwBoomerang(club, level, from, dir);
        break;
      }
      case 'shot': this.hooks?.fireShot(a.club!, level, a.element!); break;
      case 'rain': this.hooks?.fillSpots(); break;
      case 'caddie': this.hooks?.startCaddie(lv(CADDIE.seconds, level)); break;
      case 'clone': this.hooks?.placeClone(lv(CLONE.shots, level), CLONE.life); break;
    }
    this.onEvent?.({ type: 'cast', id: s.id });
    return 'ok';
  }

  private throwBall(id: AbilityId, level: number, flight: Flight, from: THREE.Vector3, dir: THREE.Vector3, range: number): void {
    const angle = THREE.MathUtils.degToRad(flight.loftDeg);
    const startH = heightAt(from.x, from.z);
    // lo que cae se calcula para caer en el punto apuntado aunque esté más alto o más bajo; lo rasante
    // sale siempre igual, y si hay una loma en el medio, choca
    const rise = flight === FLAT || !relief.on ? 0 : heightAt(from.x + dir.x * range, from.z + dir.z * range) - startH;
    const speed = launchSpeed(range, angle, flight.gravity, rise);
    const state = launchWith({ x: from.x, y: startH + BALL_RADIUS, z: from.z }, dir.x, dir.z, speed, angle);
    const color = ABILITIES[id].color;
    const mesh = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.2 }));
    mesh.position.set(state.pos.x, state.pos.y, state.pos.z);
    const trailPositions = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i++) trailPositions.set([state.pos.x, state.pos.y, state.pos.z], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    trail.frustumCulled = false;
    this.scene.add(mesh, trail);
    this.balls.push({
      id, level, flight, state, from: from.clone(), dir: new THREE.Vector3(dir.x, 0, dir.z).normalize(), range,
      swept: 0, caught: new Set(), age: 0, done: false, mesh, trail, trailPositions,
    });
  }

  /** Cayó la pelota de una habilidad: hace lo suyo ahí. */
  private land(ball: AbilityBall): void {
    ball.done = true;
    const s = ball.state;
    const pos = new THREE.Vector3(s.pos.x, heightAt(s.pos.x, s.pos.z), s.pos.z);
    const level = ball.level;
    const kind = ABILITIES[ball.id].kind;
    if (kind === 'iceZone') {
      const radius = lv(ICE.radius, level);
      this.effects.frost(pos, radius);
      this.makeMark('ice', pos, radius, lv(ICE.duration, level), 0);
      // al caer es una fuente de hielo de verdad: con la maestría, congela al que ya estaba frío
      let hits = 0;
      for (const e of this.inside(pos, radius)) {
        this.horde.applyIce(e, ICE.linger);
        hits++;
      }
      this.onEvent?.({ type: 'zone', pos, hits });
    } else if (kind === 'grenade') {
      const radius = lv(GRENADE.radius, level);
      this.effects.explosion(pos, radius, ABILITIES[ball.id].color);
      // el anillo chico marca el centro, el que no se mueve
      this.effects.swipe(pos, radius * GRENADE.core);
      const hits = this.horde.spread(pos, ball.dir, radius, radius * GRENADE.core, lv(GRENADE.push, level), lv(GRENADE.silence, level));
      this.onEvent?.({ type: 'grenade', pos, hits });
    } else if (kind === 'powder') {
      const radius = lv(POWDER.radius, level);
      this.effects.explosion(pos, radius, ABILITIES[ball.id].color);
      this.horde.powderDamage = lv(POWDER.damage, level);
      const hit = this.inside(pos, radius);
      for (const e of hit) e.markPowder(POWDER.life);
      this.onEvent?.({ type: 'mark', id: ball.id, pos, hits: hit.length });
    } else if (kind === 'lens') {
      const radius = lv(LENS.radius, level);
      this.effects.explosion(pos, radius, ABILITIES[ball.id].color);
      const hit = this.inside(pos, radius);
      for (const e of hit) e.grow(lv(LENS.seconds, level));
      this.onEvent?.({ type: 'mark', id: ball.id, pos, hits: hit.length });
    }
  }

  /** Los enemigos en juego a `radius` de `pos` (contando su propio radio). */
  private inside(pos: THREE.Vector3, radius: number): Enemy[] {
    return this.horde.enemies.filter((e) => e.alive && !e.passed && Math.hypot(e.position.x - pos.x, e.position.z - pos.z) - e.radius <= radius);
  }

  /** Zona de hielo, hoyo o bandera: queda en el campo un rato. */
  private makeMark(kind: Mark['kind'], pos: THREE.Vector3, radius: number, life: number, swallows: number): Mark {
    const group = new THREE.Group();
    const mats: THREE.Material[] = [];
    if (kind === 'ice') {
      const color = ABILITIES.ice.color;
      const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
      const edge = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      mats.push(fill, edge);
      const disc = new THREE.Group();
      disc.add(new THREE.Mesh(discGeo, fill), new THREE.Mesh(edgeGeo, edge));
      disc.rotation.x = -Math.PI / 2;
      disc.scale.setScalar(radius);
      group.add(disc);
    } else if (kind === 'hole') {
      // un hoyo de golf: negro, con su borde claro y su banderita
      const dark = new THREE.MeshBasicMaterial({ color: 0x050607, side: THREE.DoubleSide });
      const rim = new THREE.MeshBasicMaterial({ color: 0xe9e2cf, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
      const pole = new THREE.MeshStandardMaterial({ color: 0xe9e2cf });
      const cloth = new THREE.MeshStandardMaterial({ color: 0xffd66b, side: THREE.DoubleSide });
      mats.push(dark, rim, pole, cloth);
      const disc = new THREE.Group();
      disc.add(new THREE.Mesh(discGeo, dark), new THREE.Mesh(edgeGeo, rim));
      disc.rotation.x = -Math.PI / 2;
      disc.scale.setScalar(radius);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), pole);
      stick.position.set(radius * 0.6, 0.8, 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), cloth);
      flag.position.set(radius * 0.6 + 0.25, 1.45, 0);
      group.add(disc, stick, flag);
    } else {
      // bandera: un palo alto con un paño rojo, y el círculo de hasta dónde llama
      const pole = new THREE.MeshStandardMaterial({ color: 0xe9e2cf });
      const cloth = new THREE.MeshStandardMaterial({ color: ABILITIES.flag.color, side: THREE.DoubleSide });
      const edge = new THREE.MeshBasicMaterial({ color: ABILITIES.flag.color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
      mats.push(pole, cloth, edge);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), pole);
      stick.position.y = 1.5;
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), cloth);
      flag.position.set(0.45, 2.7, 0);
      const ring = new THREE.Mesh(edgeGeo, edge);
      ring.rotation.x = -Math.PI / 2;
      ring.scale.setScalar(radius);
      group.add(stick, flag, ring);
    }
    // sobre una pendiente lo plano se hundiría en el terreno: con relieve va por encima
    if (relief.on) for (const m of mats) if (m instanceof THREE.MeshBasicMaterial) m.depthTest = false;
    group.position.set(pos.x, pos.y + 0.06, pos.z);
    this.scene.add(group);
    const mark: Mark = { kind, pos: pos.clone(), radius, left: life, total: life, swallows, seen: new Set(), group, mats };
    this.marks.push(mark);
    if (kind !== 'ice') this.effects.blink(pos, kind === 'hole' ? 0x9aa4b2 : ABILITIES.flag.color);
    return mark;
  }

  /** El carrito sale del costado donde estás y cruza todo el campo a la altura `z`. */
  private sendCart(z: number, fromX: number, level: number): void {
    const dir = fromX <= 0 ? 1 : -1;
    const x = -dir * (FIELD_HALF_WIDTH + 3);
    const mesh = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.6 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8 });
    const wheel = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.3), body);
    chassis.position.y = 0.6;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 1.4), roof);
    top.position.y = 1.9;
    mesh.add(chassis, top);
    for (const [px, pz] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), wheel);
      w.rotation.x = Math.PI / 2;
      w.position.set(px, 0.28, pz);
      mesh.add(w);
    }
    for (const px of [-0.8, 0.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), body);
      post.position.set(px, 1.4, 0.55);
      mesh.add(post);
    }
    mesh.rotation.y = dir > 0 ? 0 : Math.PI;
    this.scene.add(mesh);
    this.carts.push({ x, z, dir, level, hit: new Set(), mesh });
  }

  private throwBoomerang(club: ClubId, level: number, from: THREE.Vector3, dir: THREE.Vector3): void {
    const mesh = this.hooks?.clubMesh() ?? new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.08), new THREE.MeshStandardMaterial({ color: 0xcfd6e0 }));
    this.scene.add(mesh);
    const d = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    this.boomerangs.push({ club, level, from: from.clone(), dir: d, side: new THREE.Vector3(-d.z, 0, d.x), t: 0, out: new Set(), back: new Set(), mesh });
  }

  /**
   * El viento del vendaval va **detrás** de la pelota: barre solo el tramo que ya pasó, así que a cada
   * uno lo acomoda después de pasarle por al lado, nunca antes. A cada uno que agarra lo junta sobre la
   * línea.
   */
  private blow(ball: AbilityBall): void {
    const s = ball.state;
    const half = lv(WIND.halfWidth, ball.level);
    const gone = Math.min(ball.range, (s.pos.x - ball.from.x) * ball.dir.x + (s.pos.z - ball.from.z) * ball.dir.z);
    if (gone > ball.swept) {
      const mid = ball.from.clone().addScaledVector(ball.dir, (ball.swept + gone) / 2);
      mid.y = heightAt(mid.x, mid.z);
      this.horde.sweep(mid, ball.dir, half, (gone - ball.swept) / 2, ball.caught);
      // un remolino cada tantos metros: uno por cuadro sería una nube continua
      if (Math.floor(gone / 6) > Math.floor(ball.swept / 6)) {
        this.effects.swipe(new THREE.Vector3(s.pos.x, heightAt(s.pos.x, s.pos.z), s.pos.z), half);
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
    for (let i = 0; i < SLOTS; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    this.secondWind.left = Math.max(0, this.secondWind.left - dt);
    this.updateBalls(dt);
    this.updateMarks(dt);
    this.updateCarts(dt);
    this.updateBoomerangs(dt);
  }

  private updateBalls(dt: number): void {
    for (const ball of this.balls) {
      const s = ball.state;
      ball.age += dt;
      const speed = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
      const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
      const wind = ABILITIES[ball.id].kind === 'wind';
      for (let i = 0; i < steps && !ball.done && !s.resting; i++) {
        const landed = stepBall(s, dt / steps, ball.flight.bounce, relief.on ? heightAt : undefined);
        if (s.pos.z < GATE_Z - 0.4 && s.vel.z < 0) {
          s.pos.z = GATE_Z - 0.4;
          s.vel.z *= -0.5;
        }
        if (landed && !wind) this.land(ball);
      }
      if (wind && !ball.done) this.blow(ball);
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
  }

  private updateMarks(dt: number): void {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.left -= dt;
      if (m.left > 0) {
        if (m.kind === 'ice') {
          // al que está adentro se le renueva el frío en cada cuadro: nunca se le acaba mientras esté
          // ahí. Al salir le quedan `linger` segundos
          this.horde.chillAround(m.pos, m.radius, ICE.linger, m.seen);
        } else if (m.kind === 'flag') {
          // igual que el hielo: mientras estén cerca siguen yendo a la bandera
          for (const e of this.inside(m.pos, m.radius)) e.lureTo(m.pos.x, m.pos.z, 0.4);
        } else {
          for (const e of this.horde.enemies) {
            if (m.swallows <= 0) break;
            if (!e.alive || e.passed || e.stats.boss) continue;
            if (Math.hypot(e.position.x - m.pos.x, e.position.z - m.pos.z) > m.radius + e.radius * 0.3) continue;
            if (this.horde.swallow(e)) {
              m.swallows--;
              this.onEvent?.({ type: 'swallow', enemy: e });
            }
          }
          if (m.swallows <= 0) m.left = Math.min(m.left, 0.4);
        }
      }
      // se apaga en el último medio segundo, para que se vea que se termina
      const fade = Math.min(1, Math.max(0, m.left / 0.5));
      for (const mat of m.mats) {
        mat.transparent = true;
        mat.opacity = (mat.userData.base ??= mat.opacity) * fade;
      }
      if (m.left > 0) continue;
      this.scene.remove(m.group);
      for (const mat of m.mats) mat.dispose();
      this.marks.splice(i, 1);
    }
  }

  private updateCarts(dt: number): void {
    for (let i = this.carts.length - 1; i >= 0; i--) {
      const c = this.carts[i];
      c.x += c.dir * CART.speed * dt;
      c.mesh.position.set(c.x, heightAt(c.x, c.z), c.z);
      for (const e of this.horde.enemies) {
        if (!e.alive || e.passed || c.hit.has(e.id)) continue;
        if (Math.abs(e.position.z - c.z) > CART.width + e.radius || Math.abs(e.position.x - c.x) > 1.2 + e.radius) continue;
        c.hit.add(e.id);
        this.horde.damage(e, lv(CART.damage, c.level), new THREE.Vector3(c.dir, 0, 0.4).normalize(), 7);
        this.onEvent?.({ type: 'bump', pos: e.position.clone() });
      }
      if (Math.abs(c.x) <= FIELD_HALF_WIDTH + 4) continue;
      this.scene.remove(c.mesh);
      this.carts.splice(i, 1);
    }
  }

  private updateBoomerangs(dt: number): void {
    for (let i = this.boomerangs.length - 1; i >= 0; i--) {
      const b = this.boomerangs[i];
      b.t += dt / BOOMERANG.seconds;
      const u = Math.min(1, b.t);
      // sale hasta `reach` y vuelve, abierto hacia un costado a la ida y hacia el otro a la vuelta
      const forward = BOOMERANG.reach * Math.sin(Math.PI * u);
      const lateral = BOOMERANG.width * Math.sin(2 * Math.PI * u);
      const x = b.from.x + b.dir.x * forward + b.side.x * lateral;
      const z = b.from.z + b.dir.z * forward + b.side.z * lateral;
      b.mesh.position.set(x, heightAt(x, z) + 1.1, z);
      b.mesh.rotation.set(Math.PI / 2, 0, b.t * 40);
      const hitSet = u < 0.5 ? b.out : b.back;
      for (const e of this.horde.enemies) {
        if (!e.alive || e.passed || hitSet.has(e.id)) continue;
        if (Math.hypot(e.position.x - x, e.position.z - z) > BOOMERANG.hitRadius + e.radius) continue;
        hitSet.add(e.id);
        this.horde.damage(e, lv(BOOMERANG.damage, b.level), new THREE.Vector3(e.position.x - x, 0, e.position.z - z).normalize(), 4);
        this.onEvent?.({ type: 'bump', pos: e.position.clone() });
      }
      if (u < 1) continue;
      this.scene.remove(b.mesh);
      this.hooks?.catchClub();
      this.boomerangs.splice(i, 1);
    }
  }

  /** Cuántas zonas de hielo hay en el piso y cuánto les queda, para las pruebas. */
  get zoneInfo(): { kind: string; x: number; z: number; left: number }[] {
    return this.marks.map((m) => ({ kind: m.kind, x: +m.pos.x.toFixed(1), z: +m.pos.z.toFixed(1), left: +m.left.toFixed(1) }));
  }
}
