// Lo que se ve de la nigromancia (ver docs/jefes/nigromante.md): la marca (una llama verde con una calavera
// sobre la cabeza y un anillo en el piso), el rayo con que marca, la tumba donde va a volver uno y las
// cadenas de luz. Todo verde, el color del nigromante, y aditivo: tiene que leerse desde la cámara alta.
import * as THREE from 'three';
import type { Enemy } from '../../enemies';
import { heightAt } from '../kit';

/** El verde de la nigromancia, y el del borde de las cosas. */
export const GREEN = 0x7dff6a;
const GREEN_DEEP = 0x2fd04a;
/** Lado del ícono de la marca, en metros (sobre la vida). */
const MARK_ICON = 1.7;
/** Cuánto más arriba de la cabeza va el ícono (la vida va a 0.45). */
const MARK_ICON_UP = 1.4;
/** Lo que dura el rayo que sale del bastón: viajando, y después apagándose. */
export const BEAM_TRAVEL = 0.32;
const BEAM_FADE = 0.3;

/** La llama verde con la calavera: se dibuja una vez y la comparten todas las marcas y tumbas. */
function drawSkullFlame(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  // la llama: una gota con tres lenguas, de verde fuerte a casi blanco en el medio
  const grad = g.createRadialGradient(64, 80, 6, 64, 70, 60);
  grad.addColorStop(0, 'rgba(235,255,225,1)');
  grad.addColorStop(0.35, 'rgba(125,255,106,0.95)');
  grad.addColorStop(0.75, 'rgba(47,208,74,0.55)');
  grad.addColorStop(1, 'rgba(20,90,30,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(64, 4);
  g.bezierCurveTo(78, 30, 112, 52, 104, 88);
  g.bezierCurveTo(98, 116, 30, 116, 24, 88);
  g.bezierCurveTo(16, 52, 50, 30, 64, 4);
  g.fill();
  // la calavera, oscura, adentro de la llama
  g.fillStyle = 'rgba(16,28,18,0.92)';
  g.beginPath();
  g.ellipse(64, 74, 22, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(52, 86, 24, 14);
  g.fillStyle = 'rgba(160,255,140,1)';
  g.beginPath();
  g.ellipse(55, 74, 6, 7, 0, 0, Math.PI * 2);
  g.ellipse(73, 74, 6, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(57, 92, 3, 7);
  g.fillRect(63, 92, 3, 7);
  g.fillRect(69, 92, 3, 7);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * El cartelito de «vuelve como esqueleto» (15/10, en `nigromante.huesos`: Leandro mataba a uno chico cerca y
 * le salía uno de 4 que no llegaba a matar; que se lea antes qué va a salir): una calavera de hueso y los 4
 * cuadraditos de vida del esqueleto. `worse`: el que va a volver es más fuerte que el de ahora (borde rojo).
 */
function drawBonesTag(worse: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 80;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(14,22,16,0.82)';
  g.strokeStyle = worse ? '#ff4d6a' : '#9fe6a0';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(4, 4, 248, 72, 18);
  g.fill();
  g.stroke();
  // la calavera
  g.fillStyle = '#efe8d6';
  g.beginPath();
  g.ellipse(46, 36, 22, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(34, 46, 24, 16);
  g.fillStyle = '#14201a';
  g.beginPath();
  g.ellipse(38, 36, 6, 7, 0, 0, Math.PI * 2);
  g.ellipse(54, 36, 6, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(40, 54, 3, 8);
  g.fillRect(46, 54, 3, 8);
  g.fillRect(52, 54, 3, 8);
  // la flecha y los 4 de vida, como los del juego
  g.fillStyle = '#efe8d6';
  g.font = '900 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('→', 92, 40); // i18n-ok: una flecha
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#5be07a';
    g.strokeStyle = '#0b0f14';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(114 + i * 34, 26, 28, 28, 6);
    g.fill();
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** El cartelito de lo que vuelve (ver drawBonesTag), en metros de ancho. */
const TAG_WIDTH = 1.9;
function tagSprite(tex: THREE.Texture): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(TAG_WIDTH, (TAG_WIDTH * 80) / 256, 1);
  s.renderOrder = 13;
  return s;
}

const additive = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });

/** Una llama de la marca o de la tumba, con su material propio (cada una late distinto). */
function flameSprite(tex: THREE.Texture, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.setScalar(size);
  s.renderOrder = 13;
  return s;
}

/** Lo que comparten las marcas, las tumbas y las cadenas de una pelea, para liberarlo al final. */
export class NecroFx {
  readonly tex = drawSkullFlame();
  /** «Vuelve como esqueleto»: igual o más flojo, y más fuerte que el de ahora. */
  readonly bonesTex = drawBonesTag(false);
  readonly bonesWorseTex = drawBonesTag(true);
  readonly ringGeo = new THREE.RingGeometry(0.78, 1, 40);
  readonly diskGeo = new THREE.CircleGeometry(1, 32);
  readonly beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  readonly orbGeo = new THREE.SphereGeometry(1, 10, 8);
  private readonly beams: Beam[] = [];

  constructor(readonly scene: THREE.Scene) {
    // el cilindro del rayo, parado sobre su base: así se estira de un punto al otro
    this.beamGeo.translate(0, 0.5, 0);
  }

  /** Un rayo del bastón al marcado: sale una bola, deja la estela y se apaga. */
  beam(from: () => THREE.Vector3, to: () => THREE.Vector3, color = GREEN): void {
    this.beams.push(new Beam(this, from, to, color));
  }

  update(dt: number): void {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      if (this.beams[i].update(dt)) continue;
      this.beams[i].dispose();
      this.beams.splice(i, 1);
    }
  }

  dispose(): void {
    for (const b of this.beams) b.dispose();
    this.beams.length = 0;
    this.tex.dispose();
    this.bonesTex.dispose();
    this.bonesWorseTex.dispose();
    this.ringGeo.dispose();
    this.diskGeo.dispose();
    this.beamGeo.dispose();
    this.orbGeo.dispose();
  }
}

/** Pone `mesh` entre a y b (un cilindro de alto 1 parado en su base), de `radius` de grosor. */
export function stretch(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number): void {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, d.length());
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  mesh.scale.set(radius, len, radius);
}
const UP = new THREE.Vector3(0, 1, 0);

class Beam {
  private t = 0;
  private readonly mesh: THREE.Mesh;
  private readonly orb: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly orbMat: THREE.MeshBasicMaterial;
  private readonly tip = new THREE.Vector3();
  constructor(private readonly fx: NecroFx, private readonly from: () => THREE.Vector3, private readonly to: () => THREE.Vector3, color: number) {
    this.mat = additive(color, 0.85);
    this.orbMat = additive(0xeaffe0, 1);
    this.mesh = new THREE.Mesh(fx.beamGeo, this.mat);
    this.orb = new THREE.Mesh(fx.orbGeo, this.orbMat);
    this.orb.scale.setScalar(0.32);
    this.mesh.renderOrder = this.orb.renderOrder = 3;
    fx.scene.add(this.mesh, this.orb);
    this.update(0);
  }
  /** False cuando terminó. */
  update(dt: number): boolean {
    this.t += dt;
    const a = this.from();
    const b = this.to();
    const u = Math.min(1, this.t / BEAM_TRAVEL);
    this.tip.lerpVectors(a, b, u);
    stretch(this.mesh, a, this.tip, 0.07 + 0.05 * u);
    this.orb.position.copy(this.tip);
    this.orb.visible = u < 1;
    const fade = this.t > BEAM_TRAVEL ? 1 - (this.t - BEAM_TRAVEL) / BEAM_FADE : 1;
    this.mat.opacity = 0.85 * Math.max(0, fade);
    return this.t < BEAM_TRAVEL + BEAM_FADE;
  }
  dispose(): void {
    this.fx.scene.remove(this.mesh, this.orb);
    this.mat.dispose();
    this.orbMat.dispose();
  }
}

/** La marca sobre un enemigo: la llama con la calavera arriba y un anillo que late en el piso. */
export class MarkFx {
  private readonly sprite: THREE.Sprite;
  private readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  /** Lo que va a volver si lo matás (en `huesos`): arriba de la llama. */
  private readonly tag: THREE.Sprite | null;
  private age = 0;
  constructor(fx: NecroFx, private readonly e: Enemy, tag: THREE.Texture | null = null) {
    this.sprite = flameSprite(fx.tex, MARK_ICON);
    this.tag = tag ? tagSprite(tag) : null;
    if (this.tag) {
      this.tag.position.y = e.stats.height + MARK_ICON_UP + MARK_ICON * 0.62;
      e.group.add(this.tag);
    }
    this.sprite.position.y = e.stats.height + MARK_ICON_UP;
    this.ringMat = additive(GREEN, 0.7);
    this.ring = new THREE.Mesh(fx.ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.08;
    this.ring.scale.setScalar(e.stats.radius * 1.8 + 0.5);
    this.ring.renderOrder = 3;
    // van en el grupo del enemigo: lo siguen solos, y crecen con él (la lupa, el élite)
    e.group.add(this.sprite, this.ring);
  }
  /** `leaving`: es la más vieja, la próxima que se suelta: titila. */
  update(dt: number, leaving: boolean): void {
    this.age += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.age * 5);
    const flicker = leaving ? 0.45 + 0.55 * Math.abs(Math.sin(this.age * 9)) : 1;
    (this.sprite.material as THREE.SpriteMaterial).opacity = flicker;
    if (this.tag) (this.tag.material as THREE.SpriteMaterial).opacity = flicker;
    // aparece creciendo (la marca que llega)
    const grow = Math.min(1, this.age / 0.25);
    this.sprite.scale.setScalar(MARK_ICON * (0.4 + 0.6 * grow) * (1 + 0.06 * pulse));
    this.ringMat.opacity = (0.45 + 0.35 * pulse) * flicker;
    this.ring.rotation.z += dt * 1.2;
  }
  dispose(): void {
    this.e.group.remove(this.sprite, this.ring);
    (this.sprite.material as THREE.Material).dispose();
    this.ringMat.dispose();
    if (this.tag) {
      this.e.group.remove(this.tag);
      (this.tag.material as THREE.Material).dispose();
    }
  }
}

/**
 * La tumba: donde murió un marcado, hasta que vuelve. Un disco verde que late, un anillo que se cierra
 * (lo que falta) y la llama chica arriba. `progress` de 0 (recién muerto) a 1 (sale).
 */
export class GraveFx {
  private readonly group = new THREE.Group();
  private readonly diskMat = additive(GREEN_DEEP, 0.3);
  private readonly ringMat = additive(GREEN, 0.8);
  private readonly ring: THREE.Mesh;
  private readonly sprite: THREE.Sprite;
  /** Lo que va a salir (en `huesos`): arriba de la llama. */
  private readonly tag: THREE.Sprite | null;
  private age = 0;
  constructor(private readonly fx: NecroFx, x: number, z: number, private readonly radius = 1.1, tag: THREE.Texture | null = null) {
    const disk = new THREE.Mesh(fx.diskGeo, this.diskMat);
    disk.rotation.x = -Math.PI / 2;
    disk.scale.setScalar(radius);
    this.ring = new THREE.Mesh(fx.ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.01;
    disk.renderOrder = this.ring.renderOrder = 3;
    this.sprite = flameSprite(fx.tex, 0.8);
    this.sprite.position.y = 0.7;
    this.group.add(disk, this.ring, this.sprite);
    this.tag = tag ? tagSprite(tag) : null;
    if (this.tag) {
      this.tag.position.y = 1.7;
      this.group.add(this.tag);
    }
    this.group.position.set(x, heightAt(x, z) + 0.07, z);
    fx.scene.add(this.group);
  }
  update(dt: number, progress: number): void {
    this.age += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.age * (6 + 10 * progress));
    this.diskMat.opacity = 0.18 + 0.25 * pulse * (0.5 + progress);
    // el anillo se cierra hacia el centro: cuando llega, sale
    this.ring.scale.setScalar(this.radius * (1.9 - 1.5 * progress));
    this.ringMat.opacity = 0.5 + 0.4 * progress;
    this.sprite.position.y = 0.5 + 0.5 * progress + 0.08 * pulse;
    (this.sprite.material as THREE.SpriteMaterial).opacity = 0.6 + 0.4 * pulse;
  }
  dispose(): void {
    this.fx.scene.remove(this.group);
    this.diskMat.dispose();
    this.ringMat.dispose();
    (this.sprite.material as THREE.Material).dispose();
    if (this.tag) (this.tag.material as THREE.Material).dispose();
  }
}

/** Una cadena de luz entre dos enemigos (a la altura de la cintura), con un anillo chico a los pies de cada uno. */
export class LinkFx {
  private readonly mesh: THREE.Mesh;
  private readonly mat = additive(GREEN, 0.75);
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  constructor(private readonly fx: NecroFx) {
    this.mesh = new THREE.Mesh(fx.beamGeo, this.mat);
    this.mesh.renderOrder = 3;
    fx.scene.add(this.mesh);
  }
  /** Entre los dos, y qué tan fuerte (0 a 1); `alarm` la hace titilar (uno ya cayó: hay que apurarse). */
  update(p: Enemy, q: Enemy, t: number, alarm: boolean): void {
    this.a.set(p.position.x, p.position.y + p.height * 0.55, p.position.z);
    this.b.set(q.position.x, q.position.y + q.height * 0.55, q.position.z);
    this.between(this.a, this.b, t, alarm);
  }
  /**
   * De un encadenado vivo a la tumba de uno que cayó (15/10): la cadena sigue atada al caído, titilando,
   * mientras su tumba cuenta (si queda alguien del grupo en pie, vuelve).
   */
  toGrave(p: Enemy, x: number, z: number, t: number): void {
    this.a.set(p.position.x, p.position.y + p.height * 0.55, p.position.z);
    this.b.set(x, heightAt(x, z) + 0.5, z);
    this.between(this.a, this.b, t, true);
  }
  private between(a: THREE.Vector3, b: THREE.Vector3, t: number, alarm: boolean): void {
    this.mesh.visible = true;
    stretch(this.mesh, a, b, alarm ? 0.11 : 0.07);
    const wave = 0.5 + 0.5 * Math.sin(t * (alarm ? 22 : 4));
    this.mat.opacity = alarm ? 0.5 + 0.5 * wave : 0.55 + 0.25 * wave;
    this.mat.color.setHex(alarm ? 0xeaffb0 : GREEN);
  }
  hide(): void {
    this.mesh.visible = false;
  }
  dispose(): void {
    this.fx.scene.remove(this.mesh);
    this.mat.dispose();
  }
}

/** El anillo a los pies de un encadenado (va en su grupo, como la marca). */
export class ChainRingFx {
  private readonly ring: THREE.Mesh;
  private readonly mat = additive(GREEN, 0.6);
  constructor(fx: NecroFx, private readonly e: Enemy) {
    this.ring = new THREE.Mesh(fx.ringGeo, this.mat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.08;
    this.ring.scale.setScalar(e.stats.radius * 1.4 + 0.25);
    this.ring.renderOrder = 3;
    e.group.add(this.ring);
  }
  update(t: number, alarm: boolean): void {
    this.mat.opacity = alarm ? 0.5 + 0.5 * Math.abs(Math.sin(t * 11)) : 0.45 + 0.15 * Math.sin(t * 4);
  }
  dispose(): void {
    this.e.group.remove(this.ring);
    this.mat.dispose();
  }
}
