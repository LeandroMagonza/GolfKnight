// Modo tenis: el bolsillo. Sirve para juntar pelotas mientras jugás y tener varias en juego a la vez: se
// llena levantando las que quedan en el piso (y con la lluvia de pelotas o el caddie dorado). No se
// recarga solo: si te quedás sin ninguna, ni en el bolsillo, ni en el piso, ni en juego, un
// alcanzapelotas te tira una al toque.
import * as THREE from 'three';
import { BALL_RADIUS } from '../core/ballistics';
import { TENNIS } from './bounce';

/** Cuánto tarda en llegar la pelota que tira el alcanzapelotas. */
const TOSS_TIME = 0.5;

interface Toss {
  from: THREE.Vector3;
  t: number;
  mesh: THREE.Mesh;
  golden: boolean;
}

const ballGeo = new THREE.SphereGeometry(BALL_RADIUS * 1.35, 12, 10);

export class Pocket {
  count = TENNIS.pocketStart;
  /** Pelotas doradas del caddie en el bolsillo: se gastan primero, y se ven. */
  golden = 0;
  /** Desde dónde tiran los alcanzapelotas (los guardias de la muralla). */
  guards: THREE.Vector3[] = [];
  private readonly tosses: Toss[] = [];
  private readonly mat = new THREE.MeshStandardMaterial({ color: 0xe8ff6a, emissive: 0xc8e04a, emissiveIntensity: 0.7 });
  private readonly goldMat = new THREE.MeshStandardMaterial({ color: 0xffd66b, emissive: 0xffb300, emissiveIntensity: 1.1 });
  /** Llegó una pelota al bolsillo: para el sonido. */
  onCatch: (() => void) | null = null;

  constructor(private readonly scene: THREE.Scene, public max = TENNIS.pocketMax) {}

  /** Hay pelotas viniendo en el aire. */
  get incoming(): number {
    return this.tosses.length;
  }

  /** Saca una del bolsillo para sacar. Devuelve false si no hay. */
  take(): boolean {
    if (this.count <= 0) return false;
    this.count--;
    if (this.golden > 0) this.golden--;
    return true;
  }

  /** Suma pelotas, sin pasarse del máximo. Devuelve cuántas entraron. */
  add(n = 1): number {
    const room = Math.max(0, this.max - this.count);
    const k = Math.min(n, room);
    this.count += k;
    return k;
  }

  /** Un alcanzapelotas le tira una al tenista, desde el guardia más cercano. */
  toss(to: THREE.Vector3, golden = false): void {
    let from = new THREE.Vector3(to.x, 1.5, 0.5);
    let best = Infinity;
    for (const g of this.guards) {
      const d = Math.abs(g.x - to.x);
      if (d < best) {
        best = d;
        from = new THREE.Vector3(g.x, 1.5, g.z);
      }
    }
    const mesh = new THREE.Mesh(ballGeo, golden ? this.goldMat : this.mat);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.tosses.push({ from, t: 0, mesh, golden });
  }

  /** @param to dónde está el tenista: las pelotas en el aire lo siguen */
  update(dt: number, to: THREE.Vector3): void {
    for (let i = this.tosses.length - 1; i >= 0; i--) {
      const t = this.tosses[i];
      t.t += dt / TOSS_TIME;
      const u = Math.min(1, t.t);
      t.mesh.position.set(t.from.x + (to.x - t.from.x) * u, t.from.y * (1 - u) + 1.1 * u + Math.sin(u * Math.PI) * 2.4, t.from.z + (to.z - t.from.z) * u);
      if (u < 1) continue;
      this.scene.remove(t.mesh);
      this.tosses.splice(i, 1);
      if (this.add(1) && t.golden) this.golden++;
      this.onCatch?.();
    }
  }
}
