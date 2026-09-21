// Efectos visuales de corta vida: explosiones, rayos, escarcha, chispas de impacto.
import * as THREE from 'three';
import { heightAt } from '../core/terrain';

interface Effect {
  object: THREE.Object3D;
  age: number;
  life: number;
  tick(u: number): void;
}

const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
const ringGeo = new THREE.RingGeometry(0.82, 1, 40);

export class Effects {
  private readonly list: Effect[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  private add(object: THREE.Object3D, life: number, tick: (u: number) => void): void {
    this.scene.add(object);
    tick(0);
    this.list.push({ object, age: 0, life, tick });
  }

  private ring(pos: THREE.Vector3, radius: number, color: number, life: number): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, heightAt(pos.x, pos.z) + 0.06, pos.z);
    this.add(mesh, life, (u) => {
      mesh.scale.setScalar(radius * (0.2 + 0.8 * Math.sqrt(u)));
      mat.opacity = 0.9 * (1 - u);
    });
  }

  explosion(pos: THREE.Vector3, radius: number, color = 0xff7a3c): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const ball = new THREE.Mesh(sphereGeo, mat);
    ball.position.set(pos.x, Math.max(heightAt(pos.x, pos.z) + 0.3, pos.y), pos.z);
    this.add(ball, 0.45, (u) => {
      ball.scale.setScalar(radius * (0.25 + 0.75 * Math.sqrt(u)));
      mat.opacity = 0.75 * (1 - u) * (1 - u);
    });
    const core = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, depthWrite: false }));
    core.position.copy(ball.position);
    this.add(core, 0.25, (u) => {
      core.scale.setScalar(radius * 0.5 * (0.4 + 0.6 * u));
      (core.material as THREE.MeshBasicMaterial).opacity = 1 - u;
    });
    this.ring(pos, radius, color, 0.5);
  }

  /** Hielo del hierro: una cúpula celeste que se abre y un anillo en el piso. */
  frost(pos: THREE.Vector3, radius = 1.8): void {
    const color = 0x7fd4ff;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const dome = new THREE.Mesh(sphereGeo, mat);
    dome.position.set(pos.x, heightAt(pos.x, pos.z) + 0.1, pos.z);
    this.add(dome, 0.5, (u) => {
      dome.scale.set(radius * (0.3 + 0.7 * Math.sqrt(u)), radius * 0.45 * (0.3 + 0.7 * Math.sqrt(u)), radius * (0.3 + 0.7 * Math.sqrt(u)));
      mat.opacity = 0.5 * (1 - u);
    });
    this.ring(pos, radius, color, 0.7);
  }

  /** Palazo: un anillo corto y claro alrededor del golpe. */
  swipe(pos: THREE.Vector3, radius: number): void {
    this.ring(pos, radius, 0xfff1b8, 0.22);
  }

  /** Una columna de luz que se afina: el tótem que nace, y el golfista cuando cambia de lugar. */
  blink(pos: THREE.Vector3, color: number): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const col = new THREE.Mesh(sphereGeo, mat);
    col.position.set(pos.x, heightAt(pos.x, pos.z) + 1.2, pos.z);
    this.add(col, 0.35, (u) => {
      col.scale.set(0.9 * (1 - u) + 0.05, 1.6 + 2.5 * u, 0.9 * (1 - u) + 0.05);
      mat.opacity = 0.85 * (1 - u);
    });
    this.ring(pos, 1.6, color, 0.45);
  }
  spark(pos: THREE.Vector3, color: number): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const s = new THREE.Mesh(sphereGeo, mat);
    s.position.copy(pos);
    this.add(s, 0.2, (u) => {
      s.scale.setScalar(0.2 + 0.7 * u);
      mat.opacity = 1 - u;
    });
  }

  /** Rayo quebrado entre dos puntos. */
  lightning(from: THREE.Vector3, to: THREE.Vector3): void {
    const points: THREE.Vector3[] = [];
    const segments = 8;
    for (let i = 0; i <= segments; i++) {
      const p = new THREE.Vector3().lerpVectors(from, to, i / segments);
      if (i > 0 && i < segments) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9));
      points.push(p);
    }
    const mat = new THREE.LineBasicMaterial({ color: 0xcfeeff, transparent: true });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat);
    this.add(line, 0.22, (u) => {
      mat.opacity = 1 - u;
    });
    this.spark(to, 0x7fd4ff);
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.age += dt;
      if (e.age >= e.life) {
        this.scene.remove(e.object);
        const mesh = e.object as THREE.Mesh;
        (mesh.material as THREE.Material).dispose();
        if (mesh.geometry !== sphereGeo && mesh.geometry !== ringGeo) mesh.geometry.dispose();
        this.list.splice(i, 1);
      } else {
        e.tick(e.age / e.life);
      }
    }
  }
}
