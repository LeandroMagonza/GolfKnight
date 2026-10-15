// Las piezas a la vista de los jefes de ritmo: el dial en el piso (el blindaje en placas, o el reloj que
// se vacía), el número grande sobre la cabeza, el brillo del cuerpo y lo que tiran (esquirlas, hechizos,
// la lanza, las placas). Todo hecho por código, para leerse desde la cámara alta.
import * as THREE from 'three';
import type { Enemy } from '../../enemies';
import { arcPoint, GroundMark, heightAt, TEE_Z } from '../kit';

/** El dial arranca arriba en la pantalla (lo más lejos de la cámara) y se vacía en el sentido del reloj. */
const DIAL_START = -Math.PI / 2;

/**
 * Un anillo en el piso partido en `count` tramos. Encendidos los primeros `lit` (con decimales, el último
 * a medias): con pocos tramos y hueco entre ellos son las placas del blindaje; con muchos y sin hueco, un
 * reloj que se vacía.
 */
export class Dial {
  private readonly group = new THREE.Group();
  private readonly segs: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; len: number; start: number }[] = [];
  private key = '';
  constructor(private readonly scene: THREE.Scene, private readonly count: number, private readonly inner: number, private readonly outer: number, gap = 0.12) {
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
      const start = DIAL_START - i * step - (step - gap);
      const len = step - gap;
      const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, Math.max(2, Math.ceil(48 / count)), 1, start, len), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      this.segs.push({ mesh, mat, len, start });
    }
    scene.add(this.group);
  }
  at(x: number, z: number): this {
    this.group.position.set(x, heightAt(x, z) + 0.08, z);
    return this;
  }
  /** `lit` tramos encendidos en `on`, el resto apagados en `off` (con `offAlpha`). */
  show(lit: number, on: number, off = 0x1a1f28, alpha = 0.75, offAlpha = 0.35): void {
    const key = `${Math.round(lit * 12)}/${on}/${off}/${alpha.toFixed(2)}/${offAlpha.toFixed(2)}`;
    if (key === this.key) return;
    this.key = key;
    this.segs.forEach((s, i) => {
      const part = Math.max(0, Math.min(1, lit - i));
      s.mat.color.setHex(part > 0 ? on : off);
      s.mat.opacity = part > 0 ? alpha : offAlpha;
      // el último tramo encendido a medias: se le achica el arco
      const want = part > 0 && part < 1 ? s.len * part : s.len;
      const geo = s.mesh.geometry as THREE.RingGeometry;
      if (Math.abs(geo.parameters.thetaLength - want) > 1e-3) {
        geo.dispose();
        s.mesh.geometry = new THREE.RingGeometry(this.inner, this.outer, Math.max(2, Math.ceil((48 / this.count) * (want / s.len))), 1, s.start + s.len - want, want);
      }
    });
  }
  visible(on: boolean): void {
    this.group.visible = on;
  }
  dispose(): void {
    this.scene.remove(this.group);
    for (const s of this.segs) {
      s.mesh.geometry.dispose();
      s.mat.dispose();
    }
  }
}

/** El número (o la palabra) grande sobre la cabeza, con borde oscuro: se lee de lejos. */
export class Tag {
  readonly sprite: THREE.Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly tex: THREE.CanvasTexture;
  private last = '';
  constructor(private readonly scene: THREE.Scene, private readonly size = 1.5) {
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.sprite.renderOrder = 13;
    this.sprite.scale.set(size * 2, size, 1);
    scene.add(this.sprite);
  }
  set(text: string, color: string): void {
    const key = `${text}|${color}`;
    if (key === this.last) return;
    this.last = key;
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, 256, 128);
    c.font = `900 ${text.length > 3 ? 70 : 100}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 12;
    c.strokeStyle = '#0b0f14';
    c.strokeText(text, 128, 68);
    c.fillStyle = color;
    c.fillText(text, 128, 68);
    this.tex.needsUpdate = true;
  }
  /** Sobre `e`, por arriba de su vida. */
  over(e: Enemy, lift = 1.5): void {
    this.sprite.position.set(e.position.x, e.position.y + e.height + lift, e.position.z);
  }
  visible(on: boolean): void {
    this.sprite.visible = on;
  }
  dispose(): void {
    this.scene.remove(this.sprite);
    this.tex.dispose();
    this.sprite.material.dispose();
  }
}

const glowColor = new THREE.Color();
/**
 * Hace brillar el cuerpo de `e` en `color`, con fuerza `k` (0 a 1). Se llama desde el guion, después de
 * que el enemigo pinta lo suyo: si ya brilla por otra cosa (el golpe, el fuego, el silencio), se respeta.
 */
export function glow(e: Enemy, color: number, k: number): void {
  if (k <= 0.001) return;
  glowColor.setHex(color).multiplyScalar(k);
  e.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat.emissive) return;
    if (mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.02) return;
    mat.emissive.copy(glowColor);
  });
}

/** Algo que vuela en arco hasta un punto, con su marca en el piso desde que sale. */
interface Shot {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Si lo sigue (las placas van a un enemigo que camina): dónde está ahora. */
  follow: (() => THREE.Vector3 | null) | null;
  t: number;
  flight: number;
  height: number;
  spin: number;
  /** Apunta para donde va (la lanza), en vez de girar. */
  aim: boolean;
  mark: GroundMark | null;
  radius: number;
  /** Cae sobre la línea de los puestos: el bot lo esquiva. */
  onLine: boolean;
  land: (at: THREE.Vector3) => void;
}

export interface ShotOpts {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  follow?: () => THREE.Vector3 | null;
  flight: number;
  height: number;
  spin?: number;
  /** Apunta para donde va (su +y hacia adelante), en vez de girar. */
  aim?: boolean;
  /** La marca en el piso: color y radio. Sin esto, no marca. */
  mark?: { color: number; radius: number };
  land: (at: THREE.Vector3) => void;
}

const UP = new THREE.Vector3(0, 1, 0);
const ahead = new THREE.Vector3();

/** Lo que tira el jefe: vuela en arco y al llegar hace lo suyo (`land`). */
export class Volley {
  readonly list: Shot[] = [];
  constructor(private readonly scene: THREE.Scene) {}
  fire(o: ShotOpts): void {
    this.scene.add(o.mesh);
    o.mesh.position.copy(o.from);
    const mark = o.mark ? new GroundMark(this.scene, o.mark.color, true, o.mark.radius).at(o.to.x, o.to.z).opacity(0.15) : null;
    this.list.push({
      mesh: o.mesh, from: o.from.clone(), to: o.to.clone(), follow: o.follow ?? null, t: 0, flight: o.flight, height: o.height, spin: o.spin ?? 6,
      aim: !!o.aim, mark, radius: o.mark?.radius ?? 0, onLine: Math.abs(o.to.z - TEE_Z) < 2, land: o.land,
    });
  }
  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.t += dt;
      if (s.follow) {
        const p = s.follow();
        if (p) s.to.set(p.x, p.y + 1, p.z);
      }
      const u = Math.min(1, s.t / s.flight);
      arcPoint(s.from, s.to, u, s.height, s.mesh.position);
      if (s.aim) {
        arcPoint(s.from, s.to, Math.min(1, u + 0.02), s.height, ahead).sub(s.mesh.position);
        if (ahead.lengthSq() > 1e-6) s.mesh.quaternion.setFromUnitVectors(UP, ahead.normalize());
      } else {
        s.mesh.rotation.x += s.spin * dt;
        s.mesh.rotation.z += s.spin * 0.6 * dt;
      }
      // la marca se enciende a medida que llega, y late al final
      if (s.mark) s.mark.opacity(0.18 + 0.5 * u + (u > 0.7 ? 0.15 * Math.sin(s.t * 30) : 0));
      if (u < 1) continue;
      this.remove(i);
      s.land(s.to.clone());
    }
  }
  /** ¿Cae algo en el puesto de `x` dentro de `within` s? (Para el bot.) */
  danger(x: number, within: number): boolean {
    return this.list.some((s) => s.onLine && Math.abs(s.to.x - x) < s.radius + 0.7 && s.flight - s.t < within + 0.3);
  }
  private remove(i: number): void {
    const s = this.list[i];
    this.scene.remove(s.mesh);
    disposeMesh(s.mesh);
    s.mark?.dispose();
    this.list.splice(i, 1);
  }
  dispose(): void {
    for (let i = this.list.length - 1; i >= 0; i--) this.remove(i);
  }
}

function disposeMesh(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  });
}

/** Una esquirla de la coraza: un pedazo de acero oscuro que brilla un poco. */
export function shardMesh(): THREE.Object3D {
  const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.45), new THREE.MeshStandardMaterial({ color: 0x5d6673, emissive: 0x2a3550, roughness: 0.4, metalness: 0.6, flatShading: true }));
  m.castShadow = true;
  return m;
}

/** La lanza que tira a la puerta. */
export function spearMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0xb8c0cc, emissive: 0x30384a, metalness: 0.6, roughness: 0.4 }));
  tip.position.y = 1.9;
  g.add(shaft, tip);
  return g;
}

/** Una placa de blindaje que vuela a un enemigo de la escolta. */
export function plateMesh(): THREE.Object3D {
  return new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.55), new THREE.MeshStandardMaterial({ color: 0x9aa6b8, emissive: 0x2f7dff, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.4 }));
}

/** El hechizo del chamán: una bola verde que brilla. */
export function spellMesh(color = 0x52e07a): THREE.Object3D {
  return new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color }));
}

/** Anillos que se abren en el piso y se apagan: el pulso de la cura, el pisotón. */
export class Rings {
  private readonly list: { mark: GroundMark; t: number; life: number; from: number; to: number }[] = [];
  constructor(private readonly scene: THREE.Scene) {}
  add(x: number, z: number, color: number, from: number, to: number, life = 0.6): void {
    this.list.push({ mark: new GroundMark(this.scene, color, false, from).at(x, z), t: 0, life, from, to });
  }
  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      r.t += dt;
      const u = Math.min(1, r.t / r.life);
      r.mark.size(r.from + (r.to - r.from) * Math.sqrt(u)).opacity(0.85 * (1 - u));
      if (u < 1) continue;
      r.mark.dispose();
      this.list.splice(i, 1);
    }
  }
  dispose(): void {
    for (const r of this.list) r.mark.dispose();
    this.list.length = 0;
  }
}
