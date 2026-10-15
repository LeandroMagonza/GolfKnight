// Las lanzas del lagarto, hechas por código como los props del pack: asta de madera, punta de acero, una
// tira de tela y una estela de color detrás, para que se lean desde la cámara alta. La parte que le pegan
// las pelotas es aparte (un enemigo invisible, ver `colliderLook`): así la lanza se ve igual en todo el
// vuelo, también cuando ya no se la puede tocar (pasó la línea, vuelve devuelta, queda clavada).
import * as THREE from 'three';
import { facet, flatMat, heightAt } from '../kit';

/** Lo largo de la lanza (m). Más grande que una de verdad: se tiene que ver desde arriba. */
export const SPEAR_LEN = 3.2;
/** Lo largo de la estela, detrás de la cola. */
const TRAIL_LEN = 3.4;

/** La lanza que vuela: `inner` va a la altura del vuelo (se la cambia en cada cuadro), `trail` es la estela. */
export interface SpearView {
  root: THREE.Group;
  inner: THREE.Group;
  trail: THREE.Mesh;
  trailMat: THREE.MeshBasicMaterial;
  shadow: THREE.Mesh;
}

/** Arma una lanza mirando a +z (la punta adelante), con la estela del color de su carril. */
export function spearView(color: number): SpearView {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  const wood = flatMat(0x6e4b2a);
  const steel = flatMat(0xd5dde3, { metalness: 0.35, roughness: 0.4, emissive: 0x262a2e });
  const cloth = flatMat(0x2c9c8f);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, SPEAR_LEN, 6), wood);
  shaft.rotation.x = Math.PI / 2;
  const tip = new THREE.Mesh(facet(new THREE.ConeGeometry(0.24, 0.8, 6), 0.06, 3), steel);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = SPEAR_LEN / 2 + 0.36;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 6), cloth);
  band.rotation.x = Math.PI / 2;
  band.position.z = SPEAR_LEN / 2 - 0.15;
  for (const m of [shaft, tip, band]) m.castShadow = true;
  inner.add(shaft, tip, band);

  // la estela: un plano acostado detrás de la cola, que se apaga hacia atrás (alfa por vértice)
  const geo = new THREE.PlaneGeometry(0.55, TRAIL_LEN, 1, 4);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    // z va de -TRAIL_LEN/2 (la punta de atrás) a +TRAIL_LEN/2 (pegada a la cola)
    const u = pos.getZ(i) / TRAIL_LEN + 0.5;
    colors.set([1, 1, 1, u * u], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const trailMat = new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const trail = new THREE.Mesh(geo, trailMat);
  trail.position.z = -SPEAR_LEN / 2 - TRAIL_LEN / 2;
  trail.renderOrder = 3;
  inner.add(trail);

  // la sombra, larga como la lanza (la redonda de los enemigos no se lee)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.22, SPEAR_LEN * 0.55, 1);
  shadow.position.y = 0.05;
  root.add(inner, shadow);
  return { root, inner, trail, trailMat, shadow };
}

/**
 * La parte que le pegan las pelotas: una columna invisible de `height` m (la lanza vuela a la altura del
 * pecho, y lo que pasa por debajo también la toca). Es un enemigo de verdad con este modelo: lo que se ve
 * es la `spearView`.
 */
export function colliderLook(height: number): THREE.Object3D {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, height, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  mesh.position.y = height / 2;
  mesh.visible = false;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/**
 * La marca de por dónde cruza la lanza la línea de los puestos: dos puntas de flecha en el piso, apuntando
 * para donde va (15/10, Leandro: el anillo de antes «te hace pensar que hay pelota y no hay»). Se acuesta
 * en el piso y se gira con `toward`.
 */
export class CrossMark {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private yaw = 0;
  constructor(private readonly scene: THREE.Scene, color: number, private scale = 1) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    // dos «^» (la punta hacia +y), uno detrás del otro
    const chevron = (dy: number) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0.75 + dy);
      s.lineTo(0.95, -0.05 + dy);
      s.lineTo(0.95, -0.45 + dy);
      s.lineTo(0, 0.33 + dy);
      s.lineTo(-0.95, -0.45 + dy);
      s.lineTo(-0.95, -0.05 + dy);
      s.closePath();
      return s;
    };
    this.mesh = new THREE.Mesh(new THREE.ShapeGeometry([chevron(0.25), chevron(-0.55)]), this.mat);
    // 'YXZ': primero se acuesta (la punta queda hacia -z) y después se gira para el lado del carril
    this.mesh.rotation.order = 'YXZ';
    this.mesh.renderOrder = 2;
    this.mesh.scale.setScalar(scale);
    scene.add(this.mesh);
  }
  at(x: number, z: number): this {
    this.mesh.position.set(x, heightAt(x, z) + 0.06, z);
    return this;
  }
  /** Apunta para donde va la lanza (dx, dz en el piso). */
  toward(dx: number, dz: number): this {
    this.yaw = Math.atan2(-dx, -dz);
    this.mesh.rotation.set(-Math.PI / 2, this.yaw, 0);
    return this;
  }
  size(scale: number): this {
    this.mesh.scale.setScalar(scale * this.scale);
    return this;
  }
  opacity(a: number): this {
    this.mat.opacity = a;
    this.mesh.visible = a > 0.001;
    return this;
  }
  color(c: number): this {
    this.mat.color.setHex(c);
    return this;
  }
  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
