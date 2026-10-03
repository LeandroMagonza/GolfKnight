// Abe, el mago que te invocó: el segundo jugador (ver docs/multijugador.md). Es el primero que entra a mirar
// tu partida, y juega táctico: elige uno de sus **cuatro hechizos** y toca el piso donde va. Ahí aparece un
// círculo que se llena, y al llenarse hace lo suyo. Ninguno pega: Abe prepara, el que mata sos vos. Por
// eso todos duran poco (hay que aprovecharlos a tiempo), llegan a toda la cancha y agarran un área chica.
//
// - **Granizo**: los frena (frío). El único que tarda: es una marca para que veas dónde va a caer.
// - **Fila**: los pone en fila **hacia vos**, sobre la línea que va de tu puesto al centro del círculo.
//   Uno detrás del otro: el driver los atraviesa a todos.
// - **Maldición**: crecen y reciben 1 más por golpe, un rato (la lupa del caballero).
// - **Silencio**: se les apagan los poderes un rato (escudo, blindaje, burbuja, auras, esquiva).
//
// La magia cae de arriba: no la paran los escudos ni la burbuja, como a las pelotas. Silenciar al chamán
// le apaga el aura a todos los que protegía.
//
// Todo pasa en el juego del que juega (`cast` y `update`); el que mira solo lo dibuja (`applyRemote`).
import * as THREE from 'three';
import { heightAt, relief } from '../core/terrain';
import type { Effects } from '../game/effects';
import type { Enemy, Horde } from '../game/enemies';
import { FIELD_HALF_WIDTH, GATE_Z, SPAWN_Z } from '../game/world';
import { r2, r3 } from '../net/snapshot';

export type SpellId = 'hail' | 'row' | 'curse' | 'hush';
/** El orden de los botones (y de las teclas 1 a 4). */
export const SPELL_ORDER: SpellId[] = ['hail', 'row', 'curse', 'hush'];

/**
 * Los números de cada hechizo. Se tocan en el panel de balance (tecla B): cuentan los del que juega.
 * `cooldown` es la recarga, `delay` lo que tarda en llenarse el círculo, `radius` su tamaño y `seconds`
 * lo que dura el efecto.
 */
export const ABE_SPELLS = {
  hail: { cooldown: 8, delay: 1.5, radius: 3.5, seconds: 4, freeze: 0 },
  row: { cooldown: 8, delay: 0.6, radius: 3.5 },
  curse: { cooldown: 10, delay: 0.6, radius: 3, seconds: 3 },
  hush: { cooldown: 10, delay: 0.6, radius: 3, seconds: 2.5 },
};

/** Cómo se ve y cómo se explica cada hechizo, en los botones de Abe. */
export const SPELL_INFO: Record<SpellId, { name: string; icon: string; color: number; hint: string }> = {
  hail: { name: 'Granizo', icon: '❄', color: 0x9fe3ff, hint: 'Al rato cae hielo: los frena' },
  row: { name: 'Fila', icon: '🌬', color: 0x8fe3b0, hint: 'Los pone en fila hacia el caballero' },
  curse: { name: 'Maldición', icon: '🎯', color: 0xc6f06a, hint: 'Crecen y reciben 1 más por golpe' },
  hush: { name: 'Silencio', icon: '🔇', color: 0xff8a6b, hint: 'Se les apagan los poderes' },
};

/** Un hechizo en camino: cuál, dónde, de qué tamaño, cuánto le falta (0 recién marcado, 1 sale) y hacia dónde va la fila. */
export type StrikeSnap = [id: number, spell: number, x: number, z: number, r: number, t: number, yaw: number];

interface Strike {
  id: number;
  spell: SpellId;
  x: number;
  z: number;
  radius: number;
  t: number;
  /** La fila: hacia dónde mira la línea (de tu puesto al centro). */
  yaw: number;
  group: THREE.Group;
  fill: THREE.Mesh;
  edge: THREE.Mesh;
  extras: THREE.Mesh[];
}

const discGeo = new THREE.CircleGeometry(1, 48);
const edgeGeo = new THREE.RingGeometry(0.93, 1, 64);
const shardGeo = new THREE.OctahedronGeometry(0.35, 0);
const shardMat = new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: SPELL_INFO.hail.color, emissiveIntensity: 0.8, roughness: 0.3 });
/** La línea de la fila, a lo largo del círculo. */
const lineGeo = new THREE.PlaneGeometry(0.22, 2);
/** Dónde caen los trozos de hielo, en radios del círculo. */
const SHARDS: [number, number][] = [[0, 0], [0.55, 0.2], [-0.45, 0.4], [0.2, -0.55], [-0.35, -0.4]];
/** Desde qué parte de la espera empiezan a caer, y desde qué altura. */
const FALL_FROM = 0.6;
const FALL_HEIGHT = 16;

export class AbeStrikes {
  /** Segundos que le faltan a cada hechizo para poder tirarlo otra vez. */
  readonly cooldowns: Record<SpellId, number> = { hail: 0, row: 0, curse: 0, hush: 0 };
  /** Salió un hechizo: cuál, dónde y a cuántos agarró (para el sonido y los avisos). */
  onLand: ((spell: SpellId, pos: THREE.Vector3, hits: number) => void) | null = null;
  /** Dónde está el caballero: la fila se arma hacia ahí. */
  origin: () => { x: number; z: number } = () => ({ x: 0, z: 9 });
  private readonly strikes: Strike[] = [];
  private nextId = 1;

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {}

  /** Abe marca un hechizo en (x, z). Devuelve false si todavía está recargando. */
  cast(spell: SpellId, x: number, z: number): boolean {
    if (!(spell in ABE_SPELLS) || this.cooldowns[spell] > 0) return false;
    this.cooldowns[spell] = ABE_SPELLS[spell].cooldown;
    const cx = THREE.MathUtils.clamp(x, -FIELD_HALF_WIDTH, FIELD_HALF_WIDTH);
    const cz = THREE.MathUtils.clamp(z, GATE_Z + 2, SPAWN_Z + 4);
    const o = this.origin();
    const yaw = Math.atan2(cx - o.x, cz - o.z);
    this.strikes.push(this.make(this.nextId++, spell, cx, cz, ABE_SPELLS[spell].radius, yaw));
    return true;
  }

  /** El juego del que juega: corre la espera y hace salir el hechizo. */
  update(dt: number): void {
    for (const id of SPELL_ORDER) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t = Math.min(1, s.t + dt / Math.max(0.1, ABE_SPELLS[s.spell].delay));
      this.draw(s);
      if (s.t < 1) continue;
      this.land(s);
      this.remove(i);
    }
  }

  /** Los del círculo: vivos y todavía en juego. La magia cae de arriba: escudos y burbuja no la paran. */
  private inside(pos: THREE.Vector3, radius: number): Enemy[] {
    return this.horde.enemies.filter((e) => e.alive && !e.passed && Math.hypot(e.position.x - pos.x, e.position.z - pos.z) - e.radius <= radius);
  }

  private land(s: Strike): void {
    const pos = new THREE.Vector3(s.x, heightAt(s.x, s.z), s.z);
    const color = SPELL_INFO[s.spell].color;
    let hits = 0;
    switch (s.spell) {
      case 'hail': {
        const n = ABE_SPELLS.hail;
        this.effects.frost(pos, s.radius);
        for (const e of this.inside(pos, s.radius)) {
          this.horde.applyIce(e, n.seconds);
          if (n.freeze) this.horde.freeze(e);
          hits++;
        }
        break;
      }
      case 'row': {
        // la fila va de tu puesto al centro del círculo: el jefe no se mueve
        const along = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw));
        const skip = new Set(this.horde.enemies.filter((e) => e.stats.boss).map((e) => e.id));
        hits = this.horde.sweep(pos, along, s.radius, s.radius, skip, true);
        this.effects.swipe(pos, s.radius);
        break;
      }
      case 'curse':
        this.effects.explosion(pos, s.radius, color);
        for (const e of this.inside(pos, s.radius)) {
          e.grow(ABE_SPELLS.curse.seconds);
          hits++;
        }
        break;
      case 'hush':
        this.effects.explosion(pos, s.radius, color);
        for (const e of this.inside(pos, s.radius)) {
          this.horde.silence(e, ABE_SPELLS.hush.seconds);
          hits++;
        }
        break;
    }
    this.onLand?.(s.spell, pos, hits);
  }

  /** Para mandárselo al que mira. */
  get view(): StrikeSnap[] {
    return this.strikes.map((s) => [s.id, SPELL_ORDER.indexOf(s.spell), r2(s.x), r2(s.z), r2(s.radius), r3(s.t), r3(s.yaw)]);
  }

  /** Cómo están las recargas, en el orden de los botones: lo que falta, de cuánto, y el radio. */
  get status(): [number, number, number][] {
    return SPELL_ORDER.map((id) => [Math.round(this.cooldowns[id] * 10) / 10, ABE_SPELLS[id].cooldown, ABE_SPELLS[id].radius]);
  }

  /** El que mira: los hechizos como están en el del que juega. */
  applyRemote(list: StrikeSnap[]): void {
    const ids = new Set<number>();
    for (const [id, k, x, z, r, t, yaw] of list) {
      const spell = SPELL_ORDER[k];
      if (!spell) continue;
      ids.add(id);
      let s = this.strikes.find((o) => o.id === id);
      if (!s) {
        s = this.make(id, spell, x, z, r, yaw);
        this.strikes.push(s);
      }
      s.t = t;
      this.draw(s);
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) if (!ids.has(this.strikes[i].id)) this.remove(i);
  }

  private make(id: number, spell: SpellId, x: number, z: number, radius: number, yaw: number): Strike {
    const color = SPELL_INFO[spell].color;
    const group = new THREE.Group();
    const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    // sobre una pendiente lo plano se hundiría en el terreno: con relieve va por encima
    if (relief.on) fillMat.depthTest = edgeMat.depthTest = false;
    const fill = new THREE.Mesh(discGeo, fillMat);
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    fill.rotation.x = edge.rotation.x = -Math.PI / 2;
    edge.scale.setScalar(radius);
    group.add(fill, edge);
    const extras: THREE.Mesh[] = [];
    if (spell === 'hail') {
      for (const [sx, sz] of SHARDS) {
        const m = new THREE.Mesh(shardGeo, shardMat);
        m.position.set(sx * radius, FALL_HEIGHT, sz * radius);
        m.scale.set(1, 2.2, 1);
        m.visible = false;
        group.add(m);
        extras.push(m);
      }
    } else if (spell === 'row') {
      // la línea donde van a quedar, apuntando a tu puesto
      const line = new THREE.Mesh(lineGeo, edgeMat);
      // acostada, y girada para que su largo quede sobre (sin yaw, cos yaw)
      line.rotation.set(-Math.PI / 2, 0, yaw);
      line.scale.set(1, radius, 1);
      line.position.y = 0.01;
      group.add(line);
    }
    group.position.set(x, heightAt(x, z) + 0.07, z);
    this.scene.add(group);
    return { id, spell, x, z, radius, t: 0, yaw, group, fill, edge, extras };
  }

  /** La marca se llena de afuera hacia el centro mientras espera; al granizo, al final, le caen los trozos de hielo. */
  private draw(s: Strike): void {
    s.fill.scale.setScalar(Math.max(0.01, s.radius * s.t));
    // late cada vez más rápido cuando está por salir
    (s.edge.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.abs(Math.sin(s.t * (4 + 18 * s.t)));
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
