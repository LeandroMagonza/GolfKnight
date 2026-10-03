// Abe, el mago que te invocó: el segundo jugador (ver docs/multijugador.md). Por ahora es el primero que
// entra a mirar tu partida, y tiene un poder: el **granizo**. Marca un círculo en el piso y, unos segundos
// después, cae el hielo ahí: enfría a todos los que agarra (y con `freeze`, los congela). No pega: Abe
// ayuda, el que mata sos vos. La marca se va llenando para que veas cuándo cae y aproveches.
//
// Todo pasa en el juego del que juega (`cast` y `update`); el que mira solo lo dibuja (`applyRemote`).
import * as THREE from 'three';
import { heightAt, relief } from '../core/terrain';
import type { Effects } from '../game/effects';
import type { Enemy, Horde } from '../game/enemies';
import { FIELD_HALF_WIDTH, GATE_Z, SPAWN_Z } from '../game/world';
import { r2, r3 } from '../net/snapshot';

/** Los números del granizo de Abe. Se tocan en el panel de balance (tecla B). */
export const ABE = {
  /** Segundos entre un granizo y el siguiente. */
  cooldown: 8,
  /** Segundos desde que marca hasta que cae. */
  delay: 1.5,
  /** Radio del círculo, en m. */
  radius: 3.5,
  /** Segundos de frío a los que agarra. */
  chill: 4,
  /** 1: además los congela (quietos del todo, y el próximo golpe pega el doble). 0: solo enfría. */
  freeze: 0,
};

/** El color del granizo: el del hielo, un poco más claro. */
export const ABE_COLOR = 0x9fe3ff;

/** Un granizo en camino: dónde, de qué tamaño y cuánto le falta (0 recién marcado, 1 cae). */
export type StrikeSnap = [id: number, x: number, z: number, r: number, t: number];

interface Strike {
  id: number;
  x: number;
  z: number;
  radius: number;
  t: number;
  group: THREE.Group;
  fill: THREE.Mesh;
  edge: THREE.Mesh;
  shards: THREE.Mesh[];
}

const discGeo = new THREE.CircleGeometry(1, 48);
const edgeGeo = new THREE.RingGeometry(0.93, 1, 64);
const shardGeo = new THREE.OctahedronGeometry(0.35, 0);
const shardMat = new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: ABE_COLOR, emissiveIntensity: 0.8, roughness: 0.3 });
/** Dónde caen los trozos de hielo, en radios del círculo. */
const SHARDS: [number, number][] = [[0, 0], [0.55, 0.2], [-0.45, 0.4], [0.2, -0.55], [-0.35, -0.4]];
/** Desde qué parte de la espera empiezan a caer, y desde qué altura. */
const FALL_FROM = 0.6;
const FALL_HEIGHT = 16;

export class AbeStrikes {
  /** Segundos que faltan para poder tirar otro. */
  cooldownLeft = 0;
  /** Cayó un granizo: dónde y a cuántos agarró (para el sonido y los avisos). */
  onLand: ((pos: THREE.Vector3, hits: number) => void) | null = null;
  private readonly strikes: Strike[] = [];
  private nextId = 1;

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {}

  /** Abe marca un granizo en (x, z). Devuelve false si todavía está recargando. */
  cast(x: number, z: number): boolean {
    if (this.cooldownLeft > 0) return false;
    this.cooldownLeft = ABE.cooldown;
    const cx = THREE.MathUtils.clamp(x, -FIELD_HALF_WIDTH, FIELD_HALF_WIDTH);
    const cz = THREE.MathUtils.clamp(z, GATE_Z + 2, SPAWN_Z + 4);
    this.strikes.push(this.make(this.nextId++, cx, cz, ABE.radius));
    return true;
  }

  /** El juego del que juega: corre la espera y hace caer el hielo. */
  update(dt: number): void {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t = Math.min(1, s.t + dt / Math.max(0.1, ABE.delay));
      this.draw(s);
      if (s.t < 1) continue;
      this.land(s);
      this.remove(i);
    }
  }

  private land(s: Strike): void {
    const pos = new THREE.Vector3(s.x, heightAt(s.x, s.z), s.z);
    this.effects.frost(pos, s.radius);
    const hits = this.horde.touchArea(pos, s.radius, undefined, (e: Enemy) => {
      this.horde.applyIce(e, ABE.chill);
      if (ABE.freeze) this.horde.freeze(e);
    });
    this.onLand?.(pos, hits);
  }

  /** Para mandárselo al que mira. */
  get view(): StrikeSnap[] {
    return this.strikes.map((s) => [s.id, r2(s.x), r2(s.z), r2(s.radius), r3(s.t)]);
  }

  /** El que mira: los granizos como están en el del que juega. */
  applyRemote(list: StrikeSnap[]): void {
    const ids = new Set<number>();
    for (const [id, x, z, r, t] of list) {
      ids.add(id);
      let s = this.strikes.find((o) => o.id === id);
      if (!s) {
        s = this.make(id, x, z, r);
        this.strikes.push(s);
      }
      s.t = t;
      this.draw(s);
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) if (!ids.has(this.strikes[i].id)) this.remove(i);
  }

  private make(id: number, x: number, z: number, radius: number): Strike {
    const group = new THREE.Group();
    const fillMat = new THREE.MeshBasicMaterial({ color: ABE_COLOR, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color: ABE_COLOR, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    // sobre una pendiente lo plano se hundiría en el terreno: con relieve va por encima
    if (relief.on) fillMat.depthTest = edgeMat.depthTest = false;
    const fill = new THREE.Mesh(discGeo, fillMat);
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    fill.rotation.x = edge.rotation.x = -Math.PI / 2;
    edge.scale.setScalar(radius);
    group.add(fill, edge);
    const shards = SHARDS.map(([sx, sz]) => {
      const m = new THREE.Mesh(shardGeo, shardMat);
      m.position.set(sx * radius, FALL_HEIGHT, sz * radius);
      m.scale.set(1, 2.2, 1);
      m.visible = false;
      group.add(m);
      return m;
    });
    group.position.set(x, heightAt(x, z) + 0.07, z);
    this.scene.add(group);
    return { id, x, z, radius, t: 0, group, fill, edge, shards };
  }

  /** La marca se llena de afuera hacia el centro mientras espera; al final caen los trozos de hielo. */
  private draw(s: Strike): void {
    s.fill.scale.setScalar(Math.max(0.01, s.radius * s.t));
    // late cada vez más rápido cuando está por caer
    (s.edge.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.abs(Math.sin(s.t * (4 + 18 * s.t)));
    const fall = (s.t - FALL_FROM) / (1 - FALL_FROM);
    for (const m of s.shards) {
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
