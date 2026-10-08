// Abe, el mago que te invocó: el segundo jugador (ver docs/multijugador.md). Es el primero que entra a mirar
// tu partida. Mira la cancha desde arriba y juega táctico: tocar el piso tira la **chispa**, su ataque
// básico (recarga rápido y marca a los que agarra: el próximo golpe del caballero les pega 1 más; en
// pantalla se llama «marca»). Además tiene hasta cuatro hechizos
// (ver coop/spells): elige uno y el próximo toque lo tira ahí; después vuelve a la chispa. Aparece la marca
// (un círculo, o la línea desde el caballero), se llena, y al llenarse el hechizo hace lo suyo. La trampa,
// en cambio, queda armada hasta que alguien la pisa. Ninguno pega: Abe prepara, el que mata es el caballero.
//
// La magia cae de arriba: no la paran los escudos ni la burbuja, como a las pelotas. Silenciar al chamán
// le apaga el aura a todos los que protegía.
//
// Todo pasa en el juego del que juega (`cast`, `pick` y `update`); el que mira solo lo dibuja
// (`applyRemote`), y le manda a este lo que elige.
import * as THREE from 'three';
import { heightAt, relief } from '../core/terrain';
import type { Effects } from '../game/effects';
import type { Enemy, Horde } from '../game/enemies';
import { fieldHalfAt } from '../core/field';
import { GATE_Z, SPAWN_Z } from '../game/world';
import { r2, r3 } from '../net/snapshot';
import { ABE_BOLT, ABE_SPELLS, applyPick, at, BOLT_INFO, catchUpLevels, draftOffer, nextOffer, sizeOf, SPELL_INFO, SPELL_ORDER, type AbeSlot, type Offer, type SpellId } from './spells';

export { SPELL_INFO, SPELL_ORDER, type SpellId } from './spells';

/** Un hechizo, o la chispa (el ataque básico). */
export type CastId = SpellId | 'bolt';
/** El lugar de la chispa, en los pedidos de Abe: los hechizos van de 0 a 3. */
export const BOLT_SLOT = -1;

/** El color de lo que tira Abe. */
export function castColor(id: CastId): number {
  return id === 'bolt' ? BOLT_INFO.color : SPELL_INFO[id].color;
}

/**
 * Un hechizo en camino o una trampa armada: cuál (-1 la chispa), dónde, de qué tamaño, cuánto le falta
 * para salir (0..1), hacia dónde va la línea y de qué largo, y cuánto le queda a la trampa (1 recién
 * armada, 0 se va).
 */
export type StrikeSnap = [id: number, spell: number, x: number, z: number, size: number, t: number, yaw: number, len: number, life: number];

/**
 * Lo que el que mira necesita de Abe: sus lugares (hechizo, nivel, recarga y tamaño), la oferta, cuántas le
 * deben, y la recarga de la chispa (lo que falta y de cuánto).
 */
export interface AbeSnap {
  s: [id: SpellId, level: number, left: number, total: number, size: number][];
  o: Offer | null;
  p: number;
  b: [left: number, total: number];
}

interface Strike {
  id: number;
  spell: CastId;
  level: number;
  x: number;
  z: number;
  size: number;
  t: number;
  yaw: number;
  len: number;
  /** La trampa armada: segundos que le quedan (y de cuántos). */
  life: number;
  lifeMax: number;
  group: THREE.Group;
  fill: THREE.Mesh;
  edge: THREE.Mesh;
  extras: THREE.Mesh[];
}

const discGeo = new THREE.CircleGeometry(1, 48);
const edgeGeo = new THREE.RingGeometry(0.93, 1, 64);
const planeGeo = new THREE.PlaneGeometry(1, 1);
/** La flecha del empujón: un triángulo. */
const arrowGeo = new THREE.CircleGeometry(1, 3);
const toothGeo = new THREE.ConeGeometry(0.12, 0.45, 5);
const shardGeo = new THREE.OctahedronGeometry(0.35, 0);
const shardMat = new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: SPELL_INFO.hail.color, emissiveIntensity: 0.8, roughness: 0.3 });
const toothMat = new THREE.MeshStandardMaterial({ color: 0xe8d2a8, roughness: 0.6, metalness: 0.3 });
const boltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: BOLT_INFO.color, emissiveIntensity: 1.4, roughness: 0.2 });
/** Dónde caen los trozos de hielo, en radios del círculo. */
const SHARDS: [number, number][] = [[0, 0], [0.55, 0.2], [-0.45, 0.4], [0.2, -0.55], [-0.35, -0.4]];
const FALL_FROM = 0.6;
const FALL_HEIGHT = 16;
/** La línea más corta, por si toca casi encima del caballero. */
const MIN_LINE = 3;

export class Abe {
  /** Sus hechizos, en el orden de los botones. */
  slots: AbeSlot[] = [];
  /** Segundos que le faltan a cada lugar para poder tirar otra vez: cada lugar recarga por su lado. */
  cooldowns: number[] = [];
  /** Cuántos hechizos le deben (el primero, y uno por oleada), y lo que le ofrecen ahora. */
  picks = 1;
  offer: Offer | null = null;
  /**
   * El que llegó tarde: los niveles que le faltan elegir para armar sus hechizos de una (ver
   * `catchUpLevels`). Mientras dura, `picks` son solo las que se ganan de nuevo.
   */
  private draft: number[] = [];
  /** Todas las elecciones que ganó en la partida, haya estado o no. */
  private earned = 1;
  /** Lo que le falta a la chispa para volver a salir. */
  boltCooldown = 0;
  /** Salió un hechizo, la chispa, o saltó una trampa: cuál, dónde y a cuántos agarró. */
  onLand: ((spell: CastId, pos: THREE.Vector3, hits: number) => void) | null = null;
  /** Dónde está el caballero: la corriente sale de ahí. */
  origin: () => { x: number; z: number } = () => ({ x: 0, z: 9 });
  private readonly strikes: Strike[] = [];
  private nextId = 1;

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {
    this.refreshOffer();
  }

  // ---- cómo gana hechizos ----

  /**
   * Terminó una oleada: le toca elegir otro. Si todavía no eligió ninguno (no estaba, o no le dio
   * tiempo), no le deben uno por oleada: arma sus hechizos de una, con los niveles de ahora.
   */
  grantPick(): void {
    this.earned++;
    if (!this.slots.length) {
      this.draft = catchUpLevels(this.earned);
      this.picks = this.draft.length;
      this.offer = null;
    } else {
      this.picks++;
    }
    this.refreshOffer();
  }

  /** Si le deben uno y no tiene oferta, se la arma; si ya no hay nada que darle, no le deben más. */
  private refreshOffer(): void {
    if (this.offer || this.picks <= 0) return;
    this.offer = this.draft.length ? draftOffer(this.slots, this.draft[0]) : nextOffer(this.slots);
    if (!this.offer) {
      this.picks = 0;
      this.draft = [];
    }
  }

  /** Abe elige de la oferta (`card`, o -1 para quedarse como está) y en qué lugar va. Devuelve si valió. */
  pick(card: number, slot: number): boolean {
    if (!this.offer) return false;
    const next = applyPick(this.slots, this.offer, card, slot);
    if (!next) return false;
    if (card >= 0) {
      if (next.length > this.slots.length) this.cooldowns.push(0);
      else this.cooldowns[slot] = 0;
    }
    this.slots = next;
    this.offer = null;
    this.picks--;
    this.draft.shift();
    this.refreshOffer();
    return true;
  }

  // ---- los hechizos ----

  /**
   * Abe tira el hechizo del lugar `slot` en (x, z), o la chispa (`BOLT_SLOT`). Devuelve false si no hay o
   * está recargando.
   */
  cast(slot: number, x: number, z: number): boolean {
    let cz = THREE.MathUtils.clamp(z, GATE_Z + 2, SPAWN_Z + 4);
    let cx = THREE.MathUtils.clamp(x, -fieldHalfAt(cz), fieldHalfAt(cz));
    if (slot === BOLT_SLOT) {
      if (this.boltCooldown > 0) return false;
      this.boltCooldown = ABE_BOLT.cooldown;
      this.strikes.push(this.make(this.nextId++, 'bolt', 1, cx, cz, ABE_BOLT.radius, 0, 0));
      return true;
    }
    const s = this.slots[slot];
    if (!s || this.cooldowns[slot] > 0) return false;
    const t = ABE_SPELLS[s.id];
    this.cooldowns[slot] = t.cooldown;
    let yaw = 0;
    let len = 0;
    if (s.id === 'current') {
      // la línea va del caballero hasta donde tocó: se marca en su centro
      const o = this.origin();
      len = Math.max(MIN_LINE, Math.hypot(cx - o.x, cz - o.z));
      yaw = Math.atan2(cx - o.x, cz - o.z);
      cx = o.x + Math.sin(yaw) * len / 2;
      cz = o.z + Math.cos(yaw) * len / 2;
    }
    this.strikes.push(this.make(this.nextId++, s.id, s.level, cx, cz, sizeOf(s.id, s.level), yaw, len));
    return true;
  }

  /** El juego del que juega: corre las recargas, hace salir los hechizos y vigila las trampas. */
  update(dt: number): void {
    for (let i = 0; i < this.cooldowns.length; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    this.boltCooldown = Math.max(0, this.boltCooldown - dt);
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      if (s.t < 1) {
        const delay = s.spell === 'bolt' ? ABE_BOLT.delay : ABE_SPELLS[s.spell].delay;
        s.t = Math.min(1, s.t + dt / Math.max(0.05, delay));
        this.draw(s);
        if (s.t < 1) continue;
        if (s.spell !== 'trap') {
          this.land(s);
          this.remove(i);
        }
        continue;
      }
      // la trampa armada: espera a que alguien la pise, o se va
      s.life -= dt;
      this.draw(s);
      const pos = new THREE.Vector3(s.x, heightAt(s.x, s.z), s.z);
      const trigger = ABE_SPELLS.trap.trigger;
      if (this.horde.enemies.some((e) => e.alive && !e.passed && Math.hypot(e.position.x - s.x, e.position.z - s.z) <= trigger + e.radius)) {
        this.land(s);
        this.remove(i);
      } else if (s.life <= 0) {
        this.effects.blink(pos, SPELL_INFO.trap.color);
        this.remove(i);
      }
    }
  }

  /** Los del círculo: vivos y todavía en juego. La magia cae de arriba: escudos y burbuja no la paran. */
  private inside(pos: THREE.Vector3, radius: number): Enemy[] {
    return this.horde.enemies.filter((e) => e.alive && !e.passed && Math.hypot(e.position.x - pos.x, e.position.z - pos.z) - e.radius <= radius);
  }

  /** Al jefe no lo mueve ningún hechizo. */
  private bosses(): Set<number> {
    return new Set(this.horde.enemies.filter((e) => e.stats.boss).map((e) => e.id));
  }

  private land(s: Strike): void {
    const pos = new THREE.Vector3(s.x, heightAt(s.x, s.z), s.z);
    const color = castColor(s.spell);
    const T = ABE_SPELLS;
    let hits = 0;
    switch (s.spell) {
      case 'bolt':
        this.effects.explosion(pos, s.size, color);
        for (const e of this.inside(pos, s.size)) {
          e.mark(ABE_BOLT.seconds);
          hits++;
        }
        break;
      case 'hail':
        this.effects.frost(pos, s.size);
        for (const e of this.inside(pos, s.size)) {
          this.horde.applyIce(e, at(T.hail.seconds, s.level));
          if (s.level >= T.hail.freezeFrom) this.horde.freeze(e);
          hits++;
        }
        break;
      case 'whirl':
        hits = this.horde.whirl(pos, s.size);
        this.effects.swipe(pos, s.size);
        break;
      case 'current': {
        const along = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw));
        hits = this.horde.sweep(pos, along, s.size, s.len / 2, this.bosses());
        // un remolino cada tantos metros a lo largo de la línea
        for (let d = -s.len / 2; d <= s.len / 2; d += 6) {
          const p = pos.clone().addScaledVector(along, d);
          p.y = heightAt(p.x, p.z);
          this.effects.swipe(p, s.size);
        }
        break;
      }
      case 'push':
        hits = this.horde.gust(pos, s.size, new THREE.Vector3(0, 0, 1), at(T.push.distance, s.level));
        this.effects.swipe(pos, s.size);
        break;
      case 'curse':
        this.effects.explosion(pos, s.size, color);
        for (const e of this.inside(pos, s.size)) {
          e.grow(at(T.curse.seconds, s.level));
          hits++;
        }
        break;
      case 'hush':
        this.effects.explosion(pos, s.size, color);
        for (const e of this.inside(pos, s.size)) {
          this.horde.silence(e, at(T.hush.seconds, s.level));
          hits++;
        }
        break;
      case 'trap':
        this.effects.explosion(pos, s.size, color);
        // los pesados ni se enteran (ver Enemy.stagger)
        for (const e of this.inside(pos, s.size)) {
          if (e.stats.heavy) continue;
          e.stagger(at(T.trap.seconds, s.level));
          hits++;
        }
        break;
    }
    this.onLand?.(s.spell, pos, hits);
  }

  // ---- para el que mira ----

  get view(): StrikeSnap[] {
    return this.strikes.map((s) => [s.id, s.spell === 'bolt' ? BOLT_SLOT : SPELL_ORDER.indexOf(s.spell), r2(s.x), r2(s.z), r2(s.size), r3(s.t), r3(s.yaw), r2(s.len), r3(s.lifeMax ? Math.max(0, s.life / s.lifeMax) : 1)]);
  }

  get status(): AbeSnap {
    return {
      s: this.slots.map((s, i) => [s.id, s.level, Math.round((this.cooldowns[i] ?? 0) * 10) / 10, ABE_SPELLS[s.id].cooldown, sizeOf(s.id, s.level)]),
      o: this.offer,
      p: this.picks,
      b: [Math.round(this.boltCooldown * 10) / 10, ABE_BOLT.cooldown],
    };
  }

  /** El que mira: los hechizos y las trampas como están en el del que juega. */
  applyRemote(list: StrikeSnap[]): void {
    const ids = new Set<number>();
    for (const [id, k, x, z, size, t, yaw, len, life] of list) {
      const spell: CastId | undefined = k === BOLT_SLOT ? 'bolt' : SPELL_ORDER[k];
      if (!spell) continue;
      ids.add(id);
      let s = this.strikes.find((o) => o.id === id);
      if (!s) {
        s = this.make(id, spell, 1, x, z, size, yaw, len);
        this.strikes.push(s);
      }
      s.t = t;
      if (s.lifeMax) s.life = life * s.lifeMax;
      this.draw(s);
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) if (!ids.has(this.strikes[i].id)) this.remove(i);
  }

  // ---- cómo se ve ----

  private make(id: number, spell: CastId, level: number, x: number, z: number, size: number, yaw: number, len: number): Strike {
    const color = castColor(spell);
    const group = new THREE.Group();
    const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    // sobre una pendiente lo plano se hundiría en el terreno: con relieve va por encima
    if (relief.on) fillMat.depthTest = edgeMat.depthTest = false;
    const extras: THREE.Mesh[] = [];
    let fill: THREE.Mesh;
    let edge: THREE.Mesh;
    if (spell === 'current') {
      // la línea: un pasillo del caballero hasta donde tocó, que se llena de los costados al centro
      group.rotation.y = yaw;
      edge = new THREE.Mesh(planeGeo, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.scale.set(size * 2, len, 1);
      edgeMat.opacity = 0.18;
      fill = new THREE.Mesh(planeGeo, fillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.scale.set(0.01, len, 1);
      fill.position.y = 0.01;
      group.add(edge, fill);
    } else {
      fill = new THREE.Mesh(discGeo, fillMat);
      edge = new THREE.Mesh(edgeGeo, edgeMat);
      fill.rotation.x = edge.rotation.x = -Math.PI / 2;
      edge.scale.setScalar(size);
      group.add(fill, edge);
    }
    if (spell === 'bolt') {
      // la chispa: un cristal que cae del cielo justo en el centro
      const m = new THREE.Mesh(shardGeo, boltMat);
      m.position.y = FALL_HEIGHT;
      m.scale.set(0.8, 2.4, 0.8);
      group.add(m);
      extras.push(m);
    } else if (spell === 'hail') {
      for (const [sx, sz] of SHARDS) {
        const m = new THREE.Mesh(shardGeo, shardMat);
        m.position.set(sx * size, FALL_HEIGHT, sz * size);
        m.scale.set(1, 2.2, 1);
        m.visible = false;
        group.add(m);
        extras.push(m);
      }
    } else if (spell === 'push') {
      // la flecha: para atrás, hacia el fondo
      const arrow = new THREE.Mesh(arrowGeo, edgeMat);
      arrow.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
      arrow.scale.setScalar(size * 0.4);
      arrow.position.y = 0.02;
      group.add(arrow);
    } else if (spell === 'trap') {
      // los dientes de la trampa, alrededor de donde hay que pisar
      const trigger = ABE_SPELLS.trap.trigger;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(Math.cos(a) * trigger, 0.2, Math.sin(a) * trigger);
        group.add(tooth);
        extras.push(tooth);
      }
    }
    group.position.set(x, heightAt(x, z) + 0.07, z);
    this.scene.add(group);
    const lifeMax = spell === 'trap' ? ABE_SPELLS.trap.life : 0;
    return { id, spell, level, x, z, size, t: 0, yaw, len, life: lifeMax, lifeMax, group, fill, edge, extras };
  }

  /** La marca se llena mientras espera; al granizo le caen los trozos de hielo; la trampa armada late despacio. */
  private draw(s: Strike): void {
    const edgeMat = s.edge.material as THREE.MeshBasicMaterial;
    if (s.spell === 'current') {
      s.fill.scale.x = Math.max(0.01, s.size * 2 * s.t);
      (s.fill.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.25 * s.t;
      return;
    }
    if (s.spell === 'trap') {
      const trigger = ABE_SPELLS.trap.trigger;
      s.fill.scale.setScalar(Math.max(0.01, trigger * s.t));
      const fade = s.t < 1 ? 1 : Math.min(1, s.life / 2);
      edgeMat.opacity = (0.25 + 0.15 * Math.sin(s.life * 3)) * fade;
      (s.fill.material as THREE.MeshBasicMaterial).opacity = 0.35 * fade;
      for (const m of s.extras) m.scale.setScalar(Math.max(0.01, s.t * (0.4 + 0.6 * fade)));
      return;
    }
    s.fill.scale.setScalar(Math.max(0.01, s.size * s.t));
    // late cada vez más rápido cuando está por salir
    edgeMat.opacity = 0.55 + 0.4 * Math.abs(Math.sin(s.t * (4 + 18 * s.t)));
    if (s.spell === 'bolt') {
      // la chispa cae en todo el tiempo que tarda (es corto)
      for (const m of s.extras) m.position.y = FALL_HEIGHT * (1 - s.t * s.t);
      return;
    }
    if (s.spell !== 'hail') return;
    const fall = (s.t - FALL_FROM) / (1 - FALL_FROM);
    for (const m of s.extras) {
      m.visible = fall > 0;
      m.position.y = FALL_HEIGHT * (1 - Math.max(0, fall) ** 2);
    }
  }

  private remove(i: number): void {
    const s = this.strikes[i];
    this.scene.remove(s.group);
    (s.fill.material as THREE.Material).dispose();
    (s.edge.material as THREE.Material).dispose();
    this.strikes.splice(i, 1);
  }
}
