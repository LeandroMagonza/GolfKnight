// Las marcas en el piso (8/10, pedido de Leandro): el pique de la pelota donde cae, el pedazo de pasto
// que levantan el hierro y el wedge al pegar (el divot, delante del puesto), y las pisadas de la horda.
// Se van borrando solas.
//
// Todas son la misma manchita blanda (una textura redonda que se desvanece hacia el borde), estirada,
// girada y teñida: una sola malla repetida, con un largo de cola fijo. La más vieja deja lugar a la nueva.

import * as THREE from 'three';
import { heightAt } from '../core/terrain';
import type { Enemy } from './enemies';

/** Cuántas marcas puede haber a la vez: con más, se pisa la más vieja. */
const MAX = 900;

/**
 * Cómo es cada marca: largo y ancho (m), color, qué tan oscura (0..1) y cuántos segundos dura. Se borra
 * en el último tercio de su vida.
 */
const KINDS = {
  /** El pique: un hoyito oscuro, chico. */
  pitch: { long: 0.36, wide: 0.3, color: 0x1d2a12, alpha: 0.65, life: 20 },
  /** El divot: tierra a la vista, alargada en la dirección del golpe. */
  divot: { long: 0.5, wide: 0.24, color: 0x5b3d22, alpha: 0.85, life: 30 },
  /** Una pisada: un óvalo apenas más oscuro que el pasto. */
  step: { long: 0.3, wide: 0.15, color: 0x1f2d14, alpha: 0.32, life: 7 },
};
type Kind = keyof typeof KINDS;

/** La manchita: blanca, opaca en el medio y transparente en el borde. */
function softDisc(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Lo que se sabe de cada enemigo que camina: dónde pisó la última vez y de qué pie. */
interface Walker {
  x: number;
  z: number;
  /** Lo que caminó desde la última pisada. */
  since: number;
  left: boolean;
  seen: number;
}

export class Scuffs {
  private readonly mesh: THREE.InstancedMesh;
  private readonly alpha: THREE.InstancedBufferAttribute;
  /** De cada lugar: cuándo nació, cuánto dura y qué tan oscura empieza (el reloj es `time`). */
  private readonly born = new Float32Array(MAX).fill(-1e9);
  private readonly life = new Float32Array(MAX).fill(1);
  private readonly strength = new Float32Array(MAX);
  private next = 0;
  private time = 0;
  /** Hasta cuándo hay alguna viva: si no, no se toca nada. */
  private aliveUntil = 0;
  private readonly walkers = new Map<number, Walker>();
  private frame = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    // acostada en el piso; el largo va en z
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.alpha);
    const mat = new THREE.MeshBasicMaterial({ map: softDisc(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    // cada marca con su propia transparencia (se van borrando de a una)
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vAlpha;');
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.setColorAt(0, this.color.set(0x000000));
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    scene.add(this.mesh);
  }

  /** Pone una marca en (x, z), con el largo hacia `yaw` (radianes, 0 = hacia +z). `size` la agranda. */
  private put(kind: Kind, x: number, z: number, yaw: number, size = 1): void {
    const k = KINDS[kind];
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.p.set(x, heightAt(x, z) + 0.03, z);
    this.q.setFromAxisAngle(this.up, yaw);
    this.s.set(k.wide * size, 1, k.long * size);
    this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    this.mesh.setColorAt(i, this.color.set(k.color));
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.born[i] = this.time;
    this.life[i] = k.life;
    this.strength[i] = k.alpha;
    this.aliveUntil = Math.max(this.aliveUntil, this.time + k.life);
  }

  /** La pelota picó acá. */
  pitch(x: number, z: number): void {
    this.put('pitch', x, z, Math.random() * Math.PI);
  }

  /** El hierro o el wedge levantaron pasto delante del puesto, en la dirección del golpe. */
  divot(from: THREE.Vector3, dir: THREE.Vector3): void {
    this.put('divot', from.x + dir.x * 0.35, from.z + dir.z * 0.35, Math.atan2(dir.x, dir.z));
  }

  /**
   * Las pisadas: cada uno que camina deja una cada paso, de un pie y del otro, del tamaño de su cuerpo.
   * Los que flotan (el alma en pena) y los que ya pasaron la línea (corren, translúcidos), no.
   */
  walk(enemies: readonly Enemy[]): void {
    this.frame++;
    for (const e of enemies) {
      if (!e.alive || e.passed || e.behavior === 'grabber') continue;
      const w = this.walkers.get(e.id);
      if (!w) {
        this.walkers.set(e.id, { x: e.position.x, z: e.position.z, since: 0, left: false, seen: this.frame });
        continue;
      }
      w.seen = this.frame;
      const dx = e.position.x - w.x;
      const dz = e.position.z - w.z;
      const d = Math.hypot(dx, dz);
      // un empujón (el viento, el palazo) no es caminar: se lo lleva sin dejar huella
      if (d > 1.5) {
        w.x = e.position.x;
        w.z = e.position.z;
        continue;
      }
      if (d < 0.02) continue;
      w.since += d;
      w.x = e.position.x;
      w.z = e.position.z;
      const size = e.height / 1.8;
      if (w.since < 0.62 * size) continue;
      w.since = 0;
      w.left = !w.left;
      // al costado del camino, de un lado y del otro
      const side = (w.left ? 1 : -1) * 0.13 * size;
      this.put('step', e.position.x + (dz / d) * side, e.position.z - (dx / d) * side, Math.atan2(dx, dz), size);
    }
    // los que ya no están
    if (this.frame % 60 === 0) for (const [id, w] of this.walkers) if (w.seen !== this.frame) this.walkers.delete(id);
  }

  /** Avanza el reloj y va borrando lo viejo. */
  update(dt: number): void {
    this.time += dt;
    if (this.time > this.aliveUntil + 1) return;
    const a = this.alpha.array as Float32Array;
    for (let i = 0; i < MAX; i++) {
      const t = (this.time - this.born[i]) / this.life[i];
      // aparece enseguida y se borra en el último tercio
      a[i] = t < 0 || t >= 1 ? 0 : this.strength[i] * Math.min(1, t * 20) * Math.min(1, (1 - t) * 3);
    }
    this.alpha.needsUpdate = true;
  }
}
