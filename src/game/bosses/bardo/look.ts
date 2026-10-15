// Cómo se ven los jefes con música. El bardo del metal: un esqueleto de PolygonDungeon (el soldado 02, que
// no usa ningún otro enemigo) con una guitarra Flying V roja colgada al pecho, ojos rojos, amplificadores
// a los costados del escenario que laten con cada beat, y las notas malditas que tira (enemigos de verdad:
// se les pega). El ogro tamborilero: el ogro con un tambor de guerra a la panza y tamborcitos que saltan.
// Todo lo que no es de dungeon.glb está hecho por código con el kit (facet, flatMat).
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Enemy, Horde } from '../../enemies';
import { facet, flatMat, heightAt } from '../kit';

export const BARD_MESH = 'Character_Skeleton_Soldier_02';
export const BARD_LOOK = 'bardo-esqueleto';
export const NOTE_LOOK = 'bardo-nota';
/** El rojo de su magia: los ojos, las notas, las marcas del piso. */
export const RED = 0xff2f4a;

export function addBardLook(horde: Horde, dungeon: GLTF): void {
  if (!horde.hasLook(BARD_LOOK)) horde.addLook(BARD_LOOK, dungeon.scene, dungeon.animations, BARD_MESH);
}

export const OGRE_LOOK = 'bardo-ogro';
/** El tamborilero: el ogro de PolygonDungeon (su propia plantilla, para no depender de la del tipo). */
export function addOgreLook(horde: Horde, dungeon: GLTF): void {
  if (!horde.hasLook(OGRE_LOOK)) horde.addLook(OGRE_LOOK, dungeon.scene, dungeon.animations, 'Character_Ogre');
}

/**
 * Una Flying V: el cuerpo en V (extruido), el mástil, la pala y las pastillas. Mide `len` de punta a punta
 * y apunta el mástil hacia +x (se gira al colgarla).
 */
function flyingV(len: number): THREE.Group {
  const g = new THREE.Group();
  const red = flatMat(0xb3121f, { emissive: 0x3a0006 });
  const black = flatMat(0x141016);
  const wood = flatMat(0x3b2416);
  const metal = flatMat(0xc9c4b8, { metalness: 0.4, roughness: 0.4 });
  // el cuerpo: dos alas que se abren hacia atrás (-x), con la muesca de la V
  const s = len * 0.42;
  const shape = new THREE.Shape();
  shape.moveTo(0.08 * s, 0.1 * s);
  shape.lineTo(-0.95 * s, 0.5 * s);
  shape.lineTo(-1.0 * s, 0.3 * s);
  shape.lineTo(-0.35 * s, 0.0);
  shape.lineTo(-1.0 * s, -0.3 * s);
  shape.lineTo(-0.95 * s, -0.5 * s);
  shape.lineTo(0.08 * s, -0.1 * s);
  shape.lineTo(0.12 * s, 0);
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.09 * s, bevelEnabled: false });
  bodyGeo.translate(0, 0, -0.045 * s);
  const body = new THREE.Mesh(facet(bodyGeo, 0.03, 4), red);
  body.castShadow = true;
  g.add(body);
  // el golpeador negro y las dos pastillas
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.22 * s, 0.02 * s), black);
  guard.position.set(-0.2 * s, 0, 0.055 * s);
  g.add(guard);
  for (const px of [-0.12, -0.32]) {
    const pu = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.16 * s, 0.03 * s), metal);
    pu.position.set(px * s, 0, 0.07 * s);
    g.add(pu);
  }
  // el mástil y la pala (en punta, como de metal)
  const neckLen = len * 0.5;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(neckLen, 0.07 * s, 0.05 * s), wood);
  neck.position.set(0.1 * s + neckLen / 2, 0, 0.02 * s);
  g.add(neck);
  const head = new THREE.Mesh(facet(new THREE.ConeGeometry(0.09 * s, 0.32 * s, 4), 0.04, 9), black);
  head.rotation.z = -Math.PI / 2;
  head.position.set(0.1 * s + neckLen + 0.14 * s, 0, 0.02 * s);
  g.add(head);
  return g;
}

/**
 * Un tambor de guerra: el casco rojo, los dos parches claros, los aros oscuros y la cuerda en zigzag. Radio
 * `r`, el eje en y (el parche de arriba mira a +y).
 */
function warDrum(r: number): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(facet(new THREE.CylinderGeometry(r, r * 0.92, r * 1.1, 14), 0.03, 6), flatMat(0x8a2a18));
  g.add(shell);
  const skinMat = flatMat(0xe8d6a8);
  const hoopMat = flatMat(0x2a2220);
  for (const y of [0.55, -0.55]) {
    const skin = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, r * 0.04, 14), skinMat);
    skin.position.y = y * r;
    g.add(skin);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.06, 5, 16), hoopMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y * r;
    g.add(hoop);
  }
  // la cuerda: palitos inclinados alrededor del casco
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rope = new THREE.Mesh(new THREE.BoxGeometry(r * 0.05, r * 1.15, r * 0.05), hoopMat);
    rope.position.set(Math.sin(a) * r * 1.01, 0, Math.cos(a) * r * 1.01);
    rope.rotation.set(0, a, i % 2 ? 0.45 : -0.45);
    g.add(rope);
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

/** El brillo redondo de los ojos (textura chica, compartida). */
let glowTex: THREE.CanvasTexture | null = null;
function glow(color: number, size: number): THREE.Sprite {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

/**
 * Lo que se le cuelga al cuerpo: la guitarra al pecho (en el espacio del modelo, así gira con él) y los
 * ojos. El modelo viene escalado: las medidas van en su unidad (`unit` = lo que mide sin escalar).
 */
export class Rig {
  /** Lo que lleva colgado (la guitarra o el tambor). */
  readonly prop: THREE.Group;
  private readonly eyes: THREE.Sprite[] = [];
  private readonly head: THREE.Object3D | null;
  private readonly p = new THREE.Vector3();

  constructor(private readonly e: Enemy, private readonly scene: THREE.Scene, kind: 'guitarra' | 'tambor', eyes: number) {
    const unit = e.stats.height / e.body.scale.y;
    if (kind === 'guitarra') {
      this.prop = flyingV(unit * 0.62);
      // al pecho, un poco a la derecha, el mástil hacia su izquierda (+x del modelo) y arriba
      this.prop.position.set(-0.04 * unit, 0.5 * unit, 0.17 * unit);
      this.prop.rotation.set(0, 0, 0.42);
    } else {
      this.prop = warDrum(unit * 0.16);
      // a la panza, adelante, con el parche inclinado hacia él (le pega de arriba)
      this.prop.position.set(0, 0.36 * unit, 0.27 * unit);
      this.prop.rotation.set(-0.55, 0, 0);
    }
    e.body.add(this.prop);
    this.head = e.body.getObjectByName('mixamorigHead') ?? null;
    for (let i = 0; i < 2; i++) {
      const s = glow(eyes, 0.3);
      s.renderOrder = 5;
      scene.add(s);
      this.eyes.push(s);
    }
  }

  /** Cada cuadro: los ojos delante de la cara (más fuertes con `pulse`, de 0 a 1). */
  update(pulse: number): void {
    const on = !!this.head && this.e.alive;
    for (const s of this.eyes) s.visible = on;
    if (!on) return;
    this.head!.getWorldPosition(this.p);
    const yaw = this.e.heading;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const k = this.e.stats.height / 1.8;
    const fwd = 0.16 * k;
    const up = 0.08 * k;
    const side = 0.06 * k;
    this.eyes[0].position.set(this.p.x + fx * fwd - fz * side, this.p.y + up, this.p.z + fz * fwd + fx * side);
    this.eyes[1].position.set(this.p.x + fx * fwd + fz * side, this.p.y + up, this.p.z + fz * fwd - fx * side);
    for (const s of this.eyes) s.scale.setScalar((0.22 + 0.16 * pulse) * k);
  }

  dispose(): void {
    for (const s of this.eyes) {
      this.scene.remove(s);
      s.material.dispose();
    }
    this.prop.parent?.remove(this.prop);
    this.prop.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
  }
}

/**
 * Los amplificadores del escenario: torres (cabezal y una caja con cuatro conos), mirando a la puerta.
 * Laten con cada beat; en rojo cuando viene el acople.
 */
export class Amps {
  readonly group = new THREE.Group();
  private readonly cones: THREE.Mesh[] = [];
  private readonly coneMat = flatMat(0x2b2b2e, { emissive: 0x000000 });
  private readonly lampMat = new THREE.MeshBasicMaterial({ color: 0xff8a3c });
  private kick = 0;

  constructor(private readonly scene: THREE.Scene, xs: readonly number[], z: number) {
    const cab = flatMat(0x1a1a1d);
    const grill = flatMat(0x3a3530);
    const trim = flatMat(0xb8a98a);
    const coneGeo = new THREE.CylinderGeometry(0.42, 0.3, 0.12, 14);
    coneGeo.rotateX(Math.PI / 2);
    for (const x of xs) {
      const y0 = heightAt(x, z);
      const tower = new THREE.Group();
      tower.position.set(x, y0, z);
      {
        const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 1.2), cab);
        box.position.y = 1.05;
        box.castShadow = true;
        tower.add(box);
        const front = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.85, 0.05), grill);
        front.position.set(0, box.position.y, -0.62);
        tower.add(front);
        for (const [cx, cy] of [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]]) {
          const cone = new THREE.Mesh(coneGeo, this.coneMat);
          cone.position.set(cx, box.position.y + cy, -0.68);
          tower.add(cone);
          this.cones.push(cone);
        }
      }
      // el cabezal, con su lucecita
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.1), cab);
      head.position.y = 2.55;
      tower.add(head);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 0.05), trim);
      plate.position.set(0, 2.55, -0.57);
      tower.add(plate);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), this.lampMat);
      lamp.position.set(0.8, 2.8, -0.57);
      tower.add(lamp);
      this.group.add(tower);
    }
    scene.add(this.group);
  }

  beat(strong: boolean): void {
    this.kick = strong ? 1 : 0.6;
  }

  /** `alarm` de 0 a 1: el rojo del acople. */
  update(dt: number, alarm: number): void {
    this.kick = Math.max(0, this.kick - dt * 5);
    const s = 1 + 0.18 * this.kick;
    for (const c of this.cones) c.scale.set(s, s, 1 + 1.2 * this.kick);
    this.coneMat.emissive.setRGB(0.5 * alarm + 0.12 * this.kick, 0.02 * this.kick, 0.02 * this.kick);
    this.lampMat.color.setHex(alarm > 0.5 ? 0xff2f2f : 0xff8a3c);
  }

  dispose(): void {
    this.scene.remove(this.group);
    const mats = new Set<THREE.Material>();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      mats.add(m.material as THREE.Material);
    });
    for (const m of mats) m.dispose();
  }
}

/** La nota maldita: una corchea negra con brillo rojo (la cabeza, la plica y el corchete), apoyada en el piso. */
export function addNoteLook(horde: Horde): void {
  if (horde.hasLook(NOTE_LOOK)) return;
  const g = new THREE.Group();
  const mat = flatMat(0x16080c, { emissive: RED, emissiveIntensity: 0.55 });
  const head = new THREE.Mesh(facet(new THREE.SphereGeometry(0.38, 10, 8), 0.06, 3), mat);
  head.scale.set(1.25, 0.85, 0.8);
  head.rotation.z = 0.45;
  head.position.set(0, 0.36, 0);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.25, 0.09), mat);
  stem.position.set(0.4, 0.98, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.09), mat);
  flag.position.set(0.62, 1.38, 0);
  flag.rotation.z = 0.75;
  for (const m of [head, stem, flag]) m.castShadow = true;
  g.add(head, stem, flag);
  // girada para que se vea de costado desde la cámara (la cámara mira hacia +z)
  g.rotation.y = 0;
  const root = new THREE.Group();
  root.add(g);
  horde.addLook(NOTE_LOOK, root);
}

export const DRUM_SHOT_LOOK = 'bardo-tamborcito';
/** Naranja de lo del ogro: las marcas y los tamborcitos. */
export const ORANGE = 0xff7a1a;

/** El tamborcito que tira el ogro: un tambor chico con brillo naranja, apoyado en el piso. */
export function addDrumShotLook(horde: Horde): void {
  if (horde.hasLook(DRUM_SHOT_LOOK)) return;
  const d = warDrum(0.45);
  d.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial);
    mat.emissive = new THREE.Color(ORANGE);
    mat.emissiveIntensity = 0.35;
  });
  d.position.y = 0.5;
  d.rotation.z = 0.35;
  const root = new THREE.Group();
  root.add(d);
  horde.addLook(DRUM_SHOT_LOOK, root);
}
