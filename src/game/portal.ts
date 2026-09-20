// La pelota del putter. No daña a nadie: sale disparada hasta donde se la mandó y queda ahí, marcada
// con un faro, hasta que el golfista salta hacia ella o la levanta al pasarle por arriba.
import * as THREE from 'three';
import { BALL_RADIUS } from '../core/ballistics';
import { CLUBS } from '../core/clubs';
import { FIELD_HALF_WIDTH, PLAYER_MAX_Z, PLAYER_MIN_Z } from './world';

const PUTTER = CLUBS.putter;
/**
 * Frenado en m/s². Es mucho más que el de una pelota común, a propósito: la pelota tiene que llegar
 * bastante más rápido de lo que el golfista corre (5.2 m/s). Con 45, un putt de 10 m tarda 0.67 s
 * (15 m/s de media) y uno de 22 m tarda 1 s (22 m/s de media).
 */
const FRICTION = 45;
/** A esta distancia el golfista la levanta del piso. */
const PICKUP_RADIUS = 0.9;
/** Recién tirada no se levanta: sale de entre los pies. */
const PICKUP_AFTER = 0.6;

const ballGeo = new THREE.SphereGeometry(BALL_RADIUS * 1.5, 14, 10);
const beamGeo = new THREE.CylinderGeometry(0.06, 0.16, 3.2, 10, 1, true);
const ringGeo = new THREE.RingGeometry(0.55, 0.7, 32);

export class PortalBall {
  readonly group = new THREE.Group();
  private active = false;
  private speed = 0;
  private readonly dir = new THREE.Vector3();
  private age = 0;
  private readonly beamMat = new THREE.MeshBasicMaterial({ color: PUTTER.color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  private readonly ringMat = new THREE.MeshBasicMaterial({ color: PUTTER.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  private readonly ring: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: PUTTER.color, emissiveIntensity: 1.4 }));
    ball.position.y = BALL_RADIUS * 1.5;
    const beam = new THREE.Mesh(beamGeo, this.beamMat);
    beam.position.y = 1.6;
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.group.add(ball, beam, this.ring);
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Hay una pelota en el campo. */
  get out(): boolean {
    return this.active;
  }

  /** Todavía se está moviendo. */
  get moving(): boolean {
    return this.active && this.speed > 0;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Sale desde `from` hacia `dir`, para frenar a `meters`. */
  launch(from: THREE.Vector3, dir: THREE.Vector3, meters: number): void {
    const range = THREE.MathUtils.clamp(meters, PUTTER.minRange, PUTTER.maxRange);
    this.speed = Math.sqrt(2 * FRICTION * range);
    this.dir.copy(dir).setY(0).normalize();
    this.age = 0;
    this.active = true;
    this.group.position.set(from.x, 0, from.z);
    this.group.visible = true;
  }

  /** La pelota deja de existir (salto hecho, o levantada). */
  clear(): void {
    this.active = false;
    this.speed = 0;
    this.group.visible = false;
  }

  /** @returns true si el golfista la levantó en este cuadro */
  update(dt: number, playerPos: THREE.Vector3): boolean {
    if (!this.active) return false;
    this.age += dt;
    const p = this.group.position;
    if (this.speed > 0) {
      const next = Math.max(0, this.speed - FRICTION * dt);
      // avanza con la velocidad media del paso, y solo el tiempo que tardó en frenar
      const t = next > 0 ? dt : this.speed / FRICTION;
      p.addScaledVector(this.dir, (this.speed + next) * 0.5 * t);
      this.speed = next;
      // se queda adentro de la zona por donde puede andar el golfista
      if (Math.abs(p.x) > FIELD_HALF_WIDTH) {
        p.x = Math.sign(p.x) * FIELD_HALF_WIDTH;
        this.dir.x *= -1;
        this.speed *= 0.5;
      }
      if (p.z < PLAYER_MIN_Z || p.z > PLAYER_MAX_Z) {
        p.z = THREE.MathUtils.clamp(p.z, PLAYER_MIN_Z, PLAYER_MAX_Z);
        this.dir.z *= -1;
        this.speed *= 0.5;
      }
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.age * 5);
    this.beamMat.opacity = 0.25 + 0.25 * pulse;
    this.ring.scale.setScalar(1 + 0.25 * pulse);
    this.ringMat.opacity = 0.5 + 0.4 * pulse;
    if (this.age > PICKUP_AFTER && Math.hypot(playerPos.x - p.x, playerPos.z - p.z) < PICKUP_RADIUS) {
      this.clear();
      return true;
    }
    return false;
  }
}
