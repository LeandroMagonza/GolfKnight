// Cómo se ve el Caballero negro: el mismo caballero del golfista, con la armadura casi negra y la tela
// violeta (el atlas de Synty recoloreado, como en la cinemática), ojos que brillan, su palo, sus pelotas
// oscuras y su propia fila de puestos. Todo lo que no es un enemigo lo saca `dispose`.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { recolorTexture } from '../../../cine/looks';
import type { Horde } from '../../enemies';
import { keepOnlyMesh, skinnedHeight } from '../../models';
import { flatMat, heightAt } from '../kit';

export const KNIGHT_LOOK = 'caballero-negro';
export const BALL_LOOK = 'caballero-pelota';
export const KNIGHT_MESH = 'Character_Hero_Knight_Male';
/** Los colores del reflejo: armadura casi negra, la tela violeta, la piel gris de muerto. */
const DARK = { armor: 0x2e2838, accent: 0x8a3ee0, hair: 0x15101c, skin: 0.5 };
/** El violeta de su magia: el brillo del palo, los ojos, las pelotas, las marcas. */
export const PURPLE = 0xa45cff;
/** Lo que mide el golfista (main.ts, PLAYER_HEIGHT): el swing se mide en un modelo de esta altura. */
export const PLAYER_HEIGHT = 1.75;

/** Registra en la horda el modelo del reflejo (una vez por partida). */
export function addKnightLook(horde: Horde, dungeon: GLTF): void {
  if (horde.hasLook(KNIGHT_LOOK)) return;
  const model = cloneSkinned(dungeon.scene);
  keepOnlyMesh(model, KNIGHT_MESH);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // material propio: el atlas compartido no se toca (lo usa el golfista)
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    if (mat.map) mat.map = recolorTexture(mat.map, DARK);
    m.material = mat;
  });
  horde.addLook(KNIGHT_LOOK, model, dungeon.animations, KNIGHT_MESH);
}

/**
 * Un modelo del caballero de la altura del golfista, dentro de un grupo sin escala: es donde se mide el
 * swing (`analyzeSwing`), igual que en el golfista, así las fases y el palo en la mano salen iguales.
 */
export function swingProbe(dungeon: GLTF): THREE.Object3D {
  const model = cloneSkinned(dungeon.scene);
  keepOnlyMesh(model, KNIGHT_MESH);
  model.scale.multiplyScalar(PLAYER_HEIGHT / skinnedHeight(model));
  const root = new THREE.Group();
  root.add(model);
  return root;
}

const ballGeo = new THREE.SphereGeometry(1, 14, 10);
/** Su pelota: negra, con el brillo violeta (se tiene que ver volando contra el pasto y el cielo). */
export const ballMat = new THREE.MeshStandardMaterial({ color: 0x1c1026, emissive: PURPLE, emissiveIntensity: 1.1, roughness: 0.4 });

export function ballMesh(radius: number): THREE.Mesh {
  const m = new THREE.Mesh(ballGeo, ballMat);
  m.scale.setScalar(radius);
  return m;
}

/** La pelota rasante (la versión que se ataja) es un enemigo: su plantilla, apoyada en el piso. */
export function addBallLook(horde: Horde): void {
  if (horde.hasLook(BALL_LOOK)) return;
  const g = new THREE.Group();
  const m = ballMesh(0.3);
  m.position.y = 0.3;
  g.add(m);
  horde.addLook(BALL_LOOK, g);
}

/** Un brillo redondo aditivo (los ojos, el halo de la pelota): una textura chica, compartida. */
let glowTex: THREE.CanvasTexture | null = null;
export function glowSprite(color: number, size: number): THREE.Sprite {
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
 * Los ojos que brillan: dos brillos violetas delante de la cara, en el mundo (los huesos de Synty vienen
 * girados y en centímetros: es más fácil ponerlos desde la cabeza y hacia dónde mira).
 */
export class Eyes {
  readonly group = new THREE.Group();
  private readonly head: THREE.Object3D | null;
  private readonly left = glowSprite(PURPLE, 0.32);
  private readonly right = glowSprite(PURPLE, 0.32);
  private readonly p = new THREE.Vector3();
  constructor(private readonly scene: THREE.Scene, body: THREE.Object3D, private readonly scale: number) {
    this.head = body.getObjectByName('mixamorigHead') ?? null;
    this.left.scale.setScalar(0.3 * scale);
    this.right.scale.setScalar(0.3 * scale);
    this.left.renderOrder = this.right.renderOrder = 5;
    this.group.add(this.left, this.right);
    scene.add(this.group);
  }
  /** `yaw`: hacia dónde mira (0 = +z). `pulse` de 0 a 1: más fuerte mientras carga. */
  update(yaw: number, pulse: number, visible: boolean): void {
    this.group.visible = visible && !!this.head;
    if (!this.head || !visible) return;
    this.head.getWorldPosition(this.p);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // adelante de la cara, un poco arriba del hueso de la cabeza; separados hacia los costados
    const fwd = 0.17 * this.scale;
    const up = 0.1 * this.scale;
    const side = 0.065 * this.scale;
    this.left.position.set(this.p.x + fx * fwd - fz * side, this.p.y + up, this.p.z + fz * fwd + fx * side);
    this.right.position.set(this.p.x + fx * fwd + fz * side, this.p.y + up, this.p.z + fz * fwd - fx * side);
    const s = (0.26 + 0.14 * pulse) * this.scale;
    this.left.scale.setScalar(s);
    this.right.scale.setScalar(s);
  }
  dispose(): void {
    this.scene.remove(this.group);
    this.left.material.dispose();
    this.right.material.dispose();
  }
}

const stickGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6);
const flagGeo = new THREE.PlaneGeometry(0.34, 0.2);
const ringGeo = new THREE.RingGeometry(0.42, 0.55, 28);

/** Un puesto de su fila: el palito con la bandera negra, la pelota (si tiene) y su anillo. */
export interface RowSpot {
  x: number;
  z: number;
  ball: boolean;
  /** Un caddie viene para acá con una pelota. */
  incoming: boolean;
  ballMesh: THREE.Mesh;
  ring: THREE.Mesh;
}

/** Su fila de puestos, en espejo de la tuya: el palito va detrás (para él), del lado de la horda. */
export class Row {
  readonly spots: RowSpot[] = [];
  private readonly props: THREE.Object3D[] = [];
  private readonly stickMat = flatMat(0x1d1724);
  private readonly flagMat = flatMat(0x5a1fa0, { side: THREE.DoubleSide });
  private readonly ringMat = new THREE.MeshBasicMaterial({ color: PURPLE, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
  private age = 0;
  constructor(private readonly scene: THREE.Scene, xs: readonly number[], z: number, readonly ballRadius: number) {
    for (const x of xs) {
      const y = heightAt(x, z);
      const stick = new THREE.Mesh(stickGeo, this.stickMat);
      stick.position.set(x, y + 0.45, z + 1.1);
      const flag = new THREE.Mesh(flagGeo, this.flagMat);
      flag.position.set(x - 0.19, y + 0.78, z + 1.1);
      const ball = ballMesh(ballRadius);
      ball.position.set(x, y + ballRadius, z);
      ball.visible = false;
      const ring = new THREE.Mesh(ringGeo, this.ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y + 0.05, z);
      ring.visible = false;
      scene.add(stick, flag, ball, ring);
      this.props.push(stick, flag, ball, ring);
      this.spots.push({ x, z, ball: false, incoming: false, ballMesh: ball, ring });
    }
  }
  /** Pone o saca la pelota de un puesto. */
  set(i: number, on: boolean): void {
    const s = this.spots[i];
    s.ball = on;
    s.ballMesh.visible = on;
    s.ring.visible = on;
  }
  get loaded(): number {
    return this.spots.reduce((n, s) => n + (s.ball ? 1 : 0), 0);
  }
  update(dt: number): void {
    this.age += dt;
    this.ringMat.opacity = 0.55 + 0.25 * Math.sin(this.age * 4);
  }
  dispose(): void {
    for (const o of this.props) this.scene.remove(o);
    this.stickMat.dispose();
    this.flagMat.dispose();
    this.ringMat.dispose();
  }
}
