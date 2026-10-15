// Lo que se ve del espectro hechicero (ver index.ts): el lazo que lo une a su huésped, la marca en el piso
// del huésped con el reloj del próximo escalón, los cartelitos que suben cuando le da algo, el brillo, y la
// burbuja del bendito (la del juego se arma solo al aparecer: al que la recibe después hay que ponérsela).
import * as THREE from 'three';
import { polished } from '../../../core/polish';
import { bubbleMaterial } from '../../bubble';
import type { Enemy } from '../../enemies';
import { GroundMark } from '../kit';

const UP = new THREE.Vector3(0, 1, 0);
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
const orbGeo = new THREE.SphereGeometry(1, 10, 8);
const bubbleGeo = new THREE.SphereGeometry(1, 18, 12);

/** Cuántas bolitas de luz corren por el lazo, y a qué velocidad (vueltas por segundo). */
const ORBS = 3;
const ORB_SPEED = 0.9;
/** Gris del lazo mientras el espectro está silenciado o congelado: el reloj no corre. */
const PAUSED = new THREE.Color(0x8a8f99);

/**
 * El lazo: un haz del espectro a su huésped, con bolitas que van del espectro al huésped (le está dando
 * algo: se lee para qué lado va). Más grueso con cada escalón.
 */
export class Tether {
  private readonly group = new THREE.Group();
  private readonly core: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private readonly orbs: THREE.Mesh[] = [];
  private readonly coreMat: THREE.MeshBasicMaterial;
  private readonly glowMat: THREE.MeshBasicMaterial;
  private readonly orbMat: THREE.MeshBasicMaterial;
  private readonly base: THREE.Color;
  private t = 0;
  private readonly dir = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene, color: number) {
    this.base = new THREE.Color(color);
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xf2e8ff, opacity: 0.9, ...add });
    this.glowMat = new THREE.MeshBasicMaterial({ color, opacity: 0.35, ...add });
    this.orbMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.95, ...add });
    this.core = new THREE.Mesh(beamGeo, this.coreMat);
    this.glow = new THREE.Mesh(beamGeo, this.glowMat);
    this.group.add(this.core, this.glow);
    for (let i = 0; i < ORBS; i++) {
      const orb = new THREE.Mesh(orbGeo, this.orbMat);
      this.orbs.push(orb);
      this.group.add(orb);
    }
    this.group.renderOrder = 4;
    this.group.visible = false;
    scene.add(this.group);
  }

  /** De `a` (el espectro) a `b` (el huésped), `width` de grueso; `paused`: el reloj no corre. */
  update(a: THREE.Vector3, b: THREE.Vector3, width: number, dt: number, paused = false): void {
    this.group.visible = true;
    if (!paused) this.t += dt;
    this.dir.subVectors(b, a);
    const len = Math.max(0.01, this.dir.length());
    this.dir.divideScalar(len);
    for (const [mesh, w] of [[this.core, width], [this.glow, width * 2.8]] as const) {
      mesh.position.lerpVectors(a, b, 0.5);
      mesh.quaternion.setFromUnitVectors(UP, this.dir);
      mesh.scale.set(w, len, w);
    }
    // titila apenas, como una llama; quieto y gris si está pausado
    const flicker = 0.8 + 0.2 * Math.sin(this.t * 17) * Math.sin(this.t * 5.3);
    this.glowMat.color.copy(paused ? PAUSED : this.base);
    this.glowMat.opacity = (paused ? 0.18 : 0.35) * flicker;
    this.coreMat.opacity = paused ? 0.35 : 0.9 * flicker;
    this.orbs.forEach((orb, i) => {
      orb.visible = !paused;
      const u = (this.t * ORB_SPEED + i / ORBS) % 1;
      orb.position.lerpVectors(a, b, u);
      orb.position.y += Math.sin(u * Math.PI) * 0.35;
      orb.scale.setScalar(width * 2.2 * (0.6 + 0.4 * Math.sin(u * Math.PI)));
    });
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.coreMat.dispose();
    this.glowMat.dispose();
    this.orbMat.dispose();
  }
}

/**
 * La marca del huésped en el piso: un anillo, y adentro un disco que crece con el reloj del próximo
 * escalón (cuando llena el anillo, le da otra cosa). En el aviso, el anillo se cierra sobre el que va a ser.
 */
export class HostMark {
  private readonly ring: GroundMark;
  private readonly fill: GroundMark;
  constructor(scene: THREE.Scene, color: number) {
    this.ring = new GroundMark(scene, color, false);
    this.fill = new GroundMark(scene, color, true);
    this.hide();
  }

  /** Sobre `e`: `progress` (0 a 1) es el reloj del escalón; `pulse` (0 a 1), cuánto late. */
  bound(e: Enemy, progress: number, pulse: number): void {
    const r = e.radius * 1.6 + 0.35;
    this.ring.at(e.position.x, e.position.z).size(r).opacity(0.55 + 0.3 * pulse);
    this.fill.at(e.position.x, e.position.z).size(Math.max(0.01, r * 0.84 * Math.min(1, progress))).opacity(0.22 + 0.2 * progress);
  }

  /** El aviso: el anillo se cierra sobre `e` (u de 0 a 1) y late cada vez más rápido. */
  warn(e: Enemy, u: number, age: number): void {
    const r = e.radius * 1.6 + 0.35;
    const pulse = 0.5 + 0.5 * Math.sin(age * (8 + 18 * u));
    this.ring.at(e.position.x, e.position.z).size(r + (1 - u) * 3.2).opacity(0.35 + 0.45 * pulse);
    this.fill.opacity(0);
  }

  /** Solo, sin huésped: un anillo latiendo donde flota. */
  alone(x: number, z: number, age: number): void {
    this.ring.at(x, z).size(1.3 + 0.15 * Math.sin(age * 4)).opacity(0.5);
    this.fill.opacity(0);
  }

  hide(): void {
    this.ring.opacity(0);
    this.fill.opacity(0);
  }

  dispose(): void {
    this.ring.dispose();
    this.fill.dispose();
  }
}

/**
 * La placa del espectro eterno (15/10, Leandro: «le pondría una barra de casteo para saber cuánto falta para
 * que termine de hacerle el buff al enemigo», y que se vea cómo escala con la vida que trae): arriba de la
 * cabeza, la vida de esta aparición en rombos grandes (y el número), y abajo la barra de casteo que se llena,
 * con lo que va a darle cuando se llene. Grande, para leerla desde la cámara alta.
 */
export class CastPlate {
  private readonly canvas = document.createElement('canvas');
  private readonly tex: THREE.CanvasTexture;
  private readonly mat: THREE.SpriteMaterial;
  private readonly sprite: THREE.Sprite;
  /** Lo último que se dibujó: se redibuja solo si cambia. */
  private key = '';
  /** Ancho en metros. */
  private static readonly WIDTH = 4.2;
  constructor(private readonly scene: THREE.Scene, private readonly color: string) {
    this.canvas.width = 320;
    this.canvas.height = 100;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.scale.set(CastPlate.WIDTH, (CastPlate.WIDTH * 100) / 320, 1);
    this.sprite.renderOrder = 15;
    this.sprite.visible = false;
    scene.add(this.sprite);
  }

  /**
   * En `at` (el centro de la placa): `hp` de `max` rombos, la barra en `progress` (0 a 1; null: sin barra) con
   * `label` (lo que va a dar), `paused` (silenciado o congelado: gris).
   */
  show(at: THREE.Vector3, hp: number, max: number, progress: number | null, label: string, labelColor: string, paused: boolean): void {
    this.sprite.visible = true;
    this.sprite.position.copy(at);
    const p = progress === null ? -1 : Math.round(progress * 60);
    const key = `${hp}/${max}/${p}/${label}/${paused}`;
    if (key === this.key) return;
    this.key = key;
    const g = this.canvas.getContext('2d')!;
    const W = this.canvas.width;
    g.clearRect(0, 0, W, this.canvas.height);
    // la vida: un rombo por punto, llenos los que le quedan
    const n = Math.max(1, max);
    const size = 30;
    const gap = 10;
    const rowW = n * size + (n - 1) * gap;
    const x0 = (W - rowW) / 2;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (size + gap) + size / 2;
      const cy = 26;
      g.beginPath();
      g.moveTo(cx, cy - size / 2);
      g.lineTo(cx + size / 2, cy);
      g.lineTo(cx, cy + size / 2);
      g.lineTo(cx - size / 2, cy);
      g.closePath();
      g.fillStyle = i < hp ? this.color : 'rgba(18, 10, 30, 0.75)';
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#f2e8ff';
      g.stroke();
    }
    if (progress === null) {
      this.tex.needsUpdate = true;
      return;
    }
    // la barra de casteo, con lo que va a dar escrito encima
    const bx = 14;
    const by = 58;
    const bw = W - 28;
    const bh = 34;
    g.fillStyle = 'rgba(18, 10, 30, 0.8)';
    g.beginPath();
    g.roundRect(bx, by, bw, bh, 8);
    g.fill();
    g.fillStyle = paused ? '#8a8f99' : this.color;
    g.beginPath();
    g.roundRect(bx, by, Math.max(0.001, bw * Math.min(1, progress)), bh, 8);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#f2e8ff';
    g.beginPath();
    g.roundRect(bx, by, bw, bh, 8);
    g.stroke();
    g.font = '900 30px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 7;
    g.strokeStyle = '#120a1e';
    g.strokeText(label, W / 2, by + bh / 2 + 1);
    g.fillStyle = labelColor;
    g.fillText(label, W / 2, by + bh / 2 + 1);
    this.tex.needsUpdate = true;
  }

  hide(): void {
    this.sprite.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.sprite);
    this.mat.dispose();
    this.tex.dispose();
  }
}

/** Los cartelitos que suben del huésped cuando el espectro le da algo («+blindaje», «¡ÉLITE!»). */
export class Labels {
  private readonly list: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; tex: THREE.CanvasTexture; age: number; y: number }[] = [];
  /** Segundos que dura cada uno, y cuánto sube. */
  private static readonly LIFE = 1.6;
  private static readonly RISE = 1.4;
  constructor(private readonly scene: THREE.Scene) {}

  add(at: THREE.Vector3, text: string, color: string, big = false): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const g = canvas.getContext('2d')!;
    g.font = `900 ${big ? 64 : 52}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#120a1e';
    g.strokeText(text, 256, 48);
    g.fillStyle = color;
    g.fillText(text, 256, 48);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const w = big ? 4.6 : 3.8;
    sprite.scale.set(w, (w * 96) / 512, 1);
    sprite.position.copy(at);
    sprite.renderOrder = 14;
    this.scene.add(sprite);
    this.list.push({ sprite, mat, tex, age: 0, y: at.y });
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const l = this.list[i];
      l.age += dt;
      const u = l.age / Labels.LIFE;
      if (u >= 1) {
        this.drop(i);
        continue;
      }
      l.sprite.position.y = l.y + Labels.RISE * Math.sqrt(u);
      l.mat.opacity = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    }
  }

  private drop(i: number): void {
    const l = this.list[i];
    this.scene.remove(l.sprite);
    l.mat.dispose();
    l.tex.dispose();
    this.list.splice(i, 1);
  }

  dispose(): void {
    for (let i = this.list.length - 1; i >= 0; i--) this.drop(i);
  }
}

/**
 * La burbuja del bendito para el que la recibe del espectro: la del juego se arma solo si el enemigo nace
 * bendito. Se ve igual (la nueva, con el pulido) y sigue la misma regla: arriba si la tiene lista, y no
 * silenciado.
 */
export class GrantedBubble {
  private readonly mesh: THREE.Mesh;
  private show = 0;
  constructor(readonly e: Enemy) {
    const mat = polished('bubble') ? bubbleMaterial() : new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.22, depthWrite: false });
    this.mesh = new THREE.Mesh(bubbleGeo, mat);
    // en el espacio del enemigo, como la del juego: el grupo ya lo agranda el élite o la lupa
    this.mesh.scale.set(e.stats.radius * 1.6, e.stats.height * 0.62, e.stats.radius * 1.6);
    this.mesh.position.y = e.stats.height * 0.5;
    e.group.add(this.mesh);
  }

  /** False cuando el enemigo ya no está (entonces hay que tirarla). */
  update(dt: number): boolean {
    const e = this.e;
    if (e.state === 'gone') return false;
    const up = e.divineReady && e.alive && !e.passed && !e.silenced;
    const mat = this.mesh.material;
    if (mat instanceof THREE.ShaderMaterial) {
      this.show = up ? Math.min(1, this.show + dt / 0.35) : Math.max(0, this.show - dt / 0.3);
      this.mesh.visible = this.show > 0.001;
      mat.uniforms.time.value += dt;
      mat.uniforms.show.value = this.show;
      mat.uniforms.popping.value = up ? 0 : 1;
    } else {
      this.mesh.visible = up;
      (mat as THREE.MeshBasicMaterial).opacity = 0.16 + 0.08 * Math.sin(performance.now() / 250);
    }
    return true;
  }

  dispose(): void {
    this.e.group.remove(this.mesh);
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Los materiales del modelo de `e` (cada enemigo tiene su copia: tocarlos no toca a los demás). */
export function materialsOf(e: Enemy): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  e.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) out.push(mat as THREE.MeshStandardMaterial);
    }
  });
  return out;
}

/**
 * Le suma un brillo de `color` (por `k`) al de este cuadro. El juego le vuelve a poner el suyo en cada
 * cuadro (el golpe, el frío...), así que hay que llamarlo en cada uno, después de la horda.
 */
export function addGlow(mats: readonly THREE.MeshStandardMaterial[], color: THREE.Color, k: number): void {
  for (const mat of mats) {
    mat.emissive.r += color.r * k;
    mat.emissive.g += color.g * k;
    mat.emissive.b += color.b * k;
  }
}
