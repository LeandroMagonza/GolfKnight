// La panza del limo: a los de la escolta que se traga se los ve adentro (una copia achicada de cada uno, que
// patalea en la baba) y salen vivos, todos juntos, cuando lo revientan. Así se lee de lejos cuánto lleva
// adentro y qué va a salir.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { KNOCK_DECAY } from '../../../core/clubs';
import { ENEMIES, type EnemyKind, type EnemyMods } from '../../../core/waves';
import type { Enemy, Horde } from '../../enemies';
import { fieldHalfAt } from '../kit';

/** Lo alto de cada copia adentro, sobre lo alto del limo: que se reconozca qué es sin taparlo todo. */
const COPY_HEIGHT = 0.42;
/** Cuántos se dibujan adentro como mucho (los demás van igual, sin copia). */
const MAX_SHOWN = 7;
/** Hasta dónde del centro van las copias (sobre lo alto del limo) y a qué altura. */
const COPY_SPREAD = 0.3;
const COPY_LIFT = 0.12;
/** El tinte de la baba sobre las copias: se ven a través del limo, pero de su color. */
const GOO_TINT = new THREE.Color(0x9a5ad8);
const GOO_TINT_SHARE = 0.3;
/** Al reventar: a cuántos metros del borde salen despedidos, y cuánto quedan mareados. */
const POP_DISTANCE = 2.4;
const POP_STUN = 0.8;

export interface Swallowed {
  kind: EnemyKind;
  mods: EnemyMods;
  hp: number;
  maxHp: number;
  /** La copia que se ve adentro (null si ya hay muchas). */
  copy: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  spin: number;
  mats: THREE.Material[];
}

export class Belly {
  readonly list: Swallowed[] = [];

  /**
   * @param parent dónde van las copias: el esqueleto del limo, así saltan y se aplastan con él
   * @param rawHeight lo que mide el limo en las unidades de `parent`
   */
  constructor(private readonly parent: THREE.Object3D, private readonly rawHeight: number) {}

  /** La vida que trae todo lo que tiene adentro. */
  get hp(): number {
    return this.list.reduce((n, s) => n + s.hp, 0);
  }

  /** Lo que le sacan a la puerta los de adentro si el limo llega con ellos. */
  get gateDamage(): number {
    return this.list.reduce((n, s) => n + ENEMIES[s.kind].gateDamage, 0);
  }

  /** Se traga a `en`: lo saca del campo y deja su copia adentro. */
  swallow(en: Enemy, rng: () => number): void {
    const s: Swallowed = { kind: en.stats.kind, mods: { ...en.mods }, hp: en.hp, maxHp: en.maxHp, copy: null, mixer: null, spin: (rng() * 2 - 1) * 1.6, mats: [] };
    if (this.list.filter((x) => x.copy).length < MAX_SHOWN) this.makeCopy(s, en, rng);
    this.list.push(s);
    en.remove();
  }

  private makeCopy(s: Swallowed, en: Enemy, rng: () => number): void {
    // lo que mide el modelo sin escalar: su altura sobre la escala de su plantilla (si justo lo estaban
    // aplastando de un golpe, la escala promedio es casi la misma)
    const sc = en.body.scale;
    const raw = en.stats.height / Math.max(1e-4, Math.cbrt(Math.abs(sc.x * sc.y * sc.z)));
    const copy = cloneSkinned(en.body);
    copy.scale.setScalar((COPY_HEIGHT * this.rawHeight) / raw);
    // repartidas en la panza, cada una a su ángulo, un poco caídas
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * COPY_SPREAD * this.rawHeight;
    copy.position.set(Math.cos(a) * r, COPY_LIFT * this.rawHeight, Math.sin(a) * r);
    copy.rotation.set((rng() - 0.5) * 0.9, rng() * Math.PI * 2, (rng() - 0.5) * 0.9);
    // materiales propios (los del enemigo se liberan cuando la horda lo saca), teñidos de baba
    copy.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.color.lerp(GOO_TINT, GOO_TINT_SHARE);
      mat.emissive.setRGB(0.12, 0.03, 0.2);
      m.material = mat;
      s.mats.push(mat);
    });
    // patalea adentro: corre en el lugar, lento
    const clips = en.animator.clipList;
    const clip = clips.find((c) => c.name === 'Running') ?? clips.find((c) => c.name === 'Walking') ?? clips[0];
    if (clip) {
      s.mixer = new THREE.AnimationMixer(copy);
      const act = s.mixer.clipAction(clip);
      act.timeScale = 0.55 + rng() * 0.3;
      act.time = rng() * clip.duration;
      act.play();
    }
    this.parent.add(copy);
    s.copy = copy;
  }

  update(dt: number): void {
    for (const s of this.list) {
      s.mixer?.update(dt);
      if (s.copy) s.copy.rotation.y += s.spin * dt;
    }
  }

  /**
   * Los larga a todos, vivos y con la vida que tenían, alrededor de (x, z): salen despedidos y quedan
   * mareados un momento. Devuelve los que salieron.
   */
  release(horde: Horde, x: number, z: number, radius: number, rng: () => number): Enemy[] {
    const out: Enemy[] = [];
    const n = this.list.length;
    this.list.forEach((s, i) => {
      const a = ((i + rng() * 0.6) / Math.max(1, n)) * Math.PI * 2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const half = fieldHalfAt(z) - 0.6;
      const sx = THREE.MathUtils.clamp(x + dx * radius * 0.6, -half, half);
      try {
        const e = horde.spawnCustom(ENEMIES[s.kind], s.kind, sx, z + dz * radius * 0.6, s.mods);
        e.setHp(s.hp, s.maxHp);
        e.knock.set(dx, 0, dz).multiplyScalar((radius * 0.4 + POP_DISTANCE) * KNOCK_DECAY);
        e.stunFor(POP_STUN);
        e.heading = Math.PI;
        out.push(e);
      } catch (err) {
        console.warn('[gk] limo: no pude largar a uno de la panza', err);
      }
    });
    this.clear();
    return out;
  }

  /** Vacía la panza sin largar a nadie (se los llevó a la puerta, o terminó la partida). */
  clear(): void {
    for (const s of this.list) {
      if (s.copy) this.parent.remove(s.copy);
      s.mixer?.stopAllAction();
      for (const m of s.mats) m.dispose();
    }
    this.list.length = 0;
  }
}
