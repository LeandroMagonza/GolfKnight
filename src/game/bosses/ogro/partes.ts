// Las partes del ogro bateador que no son enemigos: la pelota que te devuelve (con su marca en el piso), el
// arco que se llena en el piso (la paciencia, lo que le queda abierto) y el brillo del palo en alto.
import * as THREE from 'three';
import { GroundMark, heightAt } from '../kit';

/** El rojo de lo que viene a pegarte: el mismo de la pelota que devuelve un escudo (RICOCHET_COLOR). */
export const HURT_COLOR = 0xff3b30;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Un arco en el piso (un anillo a medias) que se llena de 0 a 1. Las geometrías se arman una vez, de a
 * escalones: rehacer el anillo en cada cuadro no hace falta para que se lea.
 */
export class ArcMark {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly geos: THREE.RingGeometry[] = [];
  private step = -1;

  constructor(private readonly scene: THREE.Scene, color: number, inner: number, outer: number, private readonly steps = 32) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    // arranca arriba (hacia el fondo de la cancha) y se llena en sentido horario visto desde la cámara
    for (let i = 0; i <= steps; i++) this.geos.push(new THREE.RingGeometry(inner, outer, 48, 1, Math.PI / 2, (-Math.PI * 2 * Math.max(0.002, i)) / steps));
    this.mesh = new THREE.Mesh(this.geos[0], this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  at(x: number, z: number): this {
    this.mesh.position.set(x, heightAt(x, z) + 0.08, z);
    return this;
  }

  fill(u: number): this {
    const i = Math.round(clamp01(u) * this.steps);
    if (i !== this.step) {
      this.step = i;
      this.mesh.geometry = this.geos[i];
    }
    this.mesh.visible = i > 0;
    return this;
  }

  color(c: number): this {
    this.mat.color.setHex(c);
    return this;
  }

  opacity(a: number): this {
    this.mat.opacity = a;
    return this;
  }

  hide(): this {
    this.mesh.visible = false;
    this.step = -1;
    return this;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    for (const g of this.geos) g.dispose();
    this.mat.dispose();
  }
}

const TRAIL_POINTS = 14;
const ballGeo = new THREE.SphereGeometry(0.2, 12, 10);

/**
 * La pelota que batea el ogro: sale de donde le pegó y va en línea, con poco arco, hasta donde estabas
 * cuando te la devolvió. La marca roja del piso queda quieta ahí y late más rápido cuanto menos falta.
 */
export class Batazo {
  readonly mesh: THREE.Mesh;
  readonly mark: GroundMark;
  private readonly trail: THREE.Line;
  private readonly trailPos: Float32Array;
  private readonly mat: THREE.MeshStandardMaterial;
  t = 0;

  /**
   * @param time segundos de vuelo
   * @param damage lo que te saca si te agarra adentro de la marca
   * @param rally el peloteo de esta pelota (0 si no hay peloteo)
   */
  constructor(
    private readonly scene: THREE.Scene,
    readonly from: THREE.Vector3,
    readonly to: THREE.Vector3,
    readonly time: number,
    readonly height: number,
    readonly radius: number,
    readonly damage: number,
    readonly rally: number,
    color = HURT_COLOR,
  ) {
    this.mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.8 });
    this.mesh = new THREE.Mesh(ballGeo, this.mat);
    this.mesh.position.copy(from);
    this.trailPos = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i++) this.trailPos.set([from.x, from.y, from.z], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    this.trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.trail.frustumCulled = false;
    scene.add(this.mesh, this.trail);
    this.mark = new GroundMark(scene, color, false, radius).at(to.x, to.z);
  }

  /** Cuánto le falta para caer, en segundos. */
  get left(): number {
    return (1 - this.t) * this.time;
  }

  /** Avanza; devuelve true en el cuadro en que cae. */
  update(dt: number): boolean {
    this.t = Math.min(1, this.t + dt / this.time);
    const u = this.t;
    const p = this.mesh.position;
    p.lerpVectors(this.from, this.to, u);
    p.y += Math.sin(Math.PI * u) * this.height;
    const tp = this.trailPos;
    tp.copyWithin(3, 0, tp.length - 3);
    tp[0] = p.x;
    tp[1] = p.y;
    tp[2] = p.z;
    this.trail.geometry.attributes.position.needsUpdate = true;
    // la marca late más rápido cuanto más cerca está de caer, como la del rebote del escudo
    this.mark.opacity(0.35 + 0.35 * Math.abs(Math.sin(u * this.time * (7 + 16 * u))));
    return u >= 1;
  }

  dispose(): void {
    this.scene.remove(this.mesh, this.trail);
    this.mat.dispose();
    this.trail.geometry.dispose();
    (this.trail.material as THREE.Material).dispose();
    this.mark.dispose();
  }
}

/**
 * El brillo del palo en alto: una bola de luz en la mano derecha del ogro (el garrote sale de ahí). Se
 * dibuja aparte, sin colgarla del hueso, para no heredar la escala del modelo.
 */
export class HandGlow {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly hand: THREE.Object3D | null;
  private readonly tmp = new THREE.Vector3();
  private age = 0;
  private level = 0;

  constructor(private readonly scene: THREE.Scene, body: THREE.Object3D, color: number, private readonly size: number) {
    this.hand = body.getObjectByName('mixamorigRightHand') ?? null;
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.mat);
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  /** `on` de 0 a 1: cuánto brilla (se prende y se apaga suave). */
  update(dt: number, on: number, color?: number): void {
    this.age += dt;
    this.level += (on - this.level) * (1 - Math.exp(-10 * dt));
    if (color !== undefined) this.mat.color.setHex(color);
    if (!this.hand || this.level < 0.02) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.hand.getWorldPosition(this.tmp);
    this.mesh.position.copy(this.tmp);
    const pulse = 1 + 0.15 * Math.sin(this.age * 9);
    this.mesh.scale.setScalar(this.size * pulse * (0.6 + 0.4 * this.level));
    this.mat.opacity = 0.55 * this.level;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
