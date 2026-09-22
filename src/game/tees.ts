// Los puestos de tiro. El golfista ya no camina libre: se mueve de costado entre puestos marcados con
// un palito, y solo puede pegar donde hay una pelota. Las pelotas las tiran los guardias desde atrás.
//
// Reglas de las pelotas: nunca hay más de MAX_BALLS esperando, y cuantas menos quedan más rápido
// llega la siguiente. Así, quien tira rápido no se queda sin pelota, y quien tira despacio no las
// acumula. Nunca caen en el puesto donde está parado el golfista: después de cada tiro hay que moverse.
import * as THREE from 'three';
import { BALL_RADIUS } from '../core/ballistics';
import { FIELD_HALF_WIDTH, TEE_LINE_Z } from './world';

/** Línea de los puestos, y separación entre ellos. La define world: es el 0 de las marcas del campo. */
export const TEE_Z = TEE_LINE_Z;
export const TEE_SPACING = 4;
export const MAX_BALLS = 3;
/** Segundos hasta que sale la próxima pelota, según cuántas hay (contando las que vienen en el aire). */
const REFILL_DELAY = [0.2, 0.7, 1.5];
/** Cuánto tarda en llegar una pelota tirada por un guardia. */
const TOSS_TIME = 0.4;
/** La pelota nueva cae, si puede, a esta cantidad de puestos del golfista como mucho. */
const NEAR_STEPS = 3;

interface Spot {
  x: number;
  ball: boolean;
  /** Hay una pelota en el aire que viene para acá. */
  incoming: boolean;
  ballMesh: THREE.Mesh;
  ring: THREE.Mesh;
}

interface Toss {
  spot: number;
  from: THREE.Vector3;
  t: number;
  mesh: THREE.Mesh;
}

const ballGeo = new THREE.SphereGeometry(BALL_RADIUS * 1.35, 12, 10);
const stickGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6);
const flagGeo = new THREE.PlaneGeometry(0.34, 0.2);
const ringGeo = new THREE.RingGeometry(0.42, 0.55, 28);

export class Tees {
  readonly spots: Spot[] = [];
  /** Desde dónde tiran las pelotas los guardias. */
  guards: THREE.Vector3[] = [];
  private readonly tosses: Toss[] = [];
  private timer = 0;
  private age = 0;
  private readonly ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1b8, emissiveIntensity: 0.9 });
  private readonly ringMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });

  constructor(private readonly scene: THREE.Scene) {
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.8 });
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xd8413a, side: THREE.DoubleSide, roughness: 0.9 });
    const count = Math.floor((FIELD_HALF_WIDTH - 2) / TEE_SPACING) * 2 + 1;
    const half = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const x = (i - half) * TEE_SPACING;
      // el palito va un paso atrás del puesto, para no tapar ni el tiro ni al golfista
      const stick = new THREE.Mesh(stickGeo, stickMat);
      stick.position.set(x, 0.45, TEE_Z - 1.1);
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(x + 0.19, 0.78, TEE_Z - 1.1);
      // la pelota y su anillo van **exactamente** en el puesto: es desde donde sale el tiro y desde
      // donde se miden las distancias. Estaban 0.7 m adelante, así que al empezar a cargar la pelota
      // saltaba para atrás y el anillo se quedaba donde estaba
      const ballMesh = new THREE.Mesh(ballGeo, this.ballMat);
      ballMesh.position.set(x, BALL_RADIUS * 1.35, TEE_Z);
      ballMesh.visible = false;
      const ring = new THREE.Mesh(ringGeo, this.ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.05, TEE_Z);
      ring.visible = false;
      scene.add(stick, flag, ballMesh, ring);
      this.spots.push({ x, ball: false, incoming: false, ballMesh, ring });
    }
  }

  get centerIndex(): number {
    return (this.spots.length - 1) / 2;
  }

  /** Pelotas esperando en el campo (sin contar las que vienen en el aire). */
  get loaded(): number {
    return this.spots.reduce((n, s) => n + (s.ball ? 1 : 0), 0);
  }

  hasBall(index: number): boolean {
    return this.spots[index]?.ball ?? false;
  }

  /** Puesto más cercano a una posición x del campo. */
  nearest(x: number): number {
    let best = 0;
    for (let i = 1; i < this.spots.length; i++) if (Math.abs(this.spots[i].x - x) < Math.abs(this.spots[best].x - x)) best = i;
    return best;
  }

  /** Puesto con pelota más cercano a `from`, o -1 si no hay ninguna. */
  nearestBall(from: number): number {
    let best = -1;
    for (let i = 0; i < this.spots.length; i++) {
      if (!this.spots[i].ball) continue;
      if (best < 0 || Math.abs(i - from) < Math.abs(best - from)) best = i;
    }
    return best;
  }

  /** Gasta la pelota del puesto. Devuelve false si no había. */
  take(index: number): boolean {
    const s = this.spots[index];
    if (!s?.ball) return false;
    s.ball = false;
    return true;
  }

  /** Pone una pelota ya mismo (arranque de la partida, y pruebas). */
  place(index: number): void {
    const s = this.spots[index];
    if (s) s.ball = true;
  }

  private pickSpot(playerSpot: number): number {
    const free = this.spots.map((s, i) => ({ s, i })).filter(({ s, i }) => !s.ball && !s.incoming && i !== playerSpot);
    if (!free.length) return -1;
    const near = free.filter(({ i }) => Math.abs(i - playerSpot) <= NEAR_STEPS);
    const pool = near.length ? near : free;
    return pool[Math.floor(Math.random() * pool.length)].i;
  }

  /** @param playerSpot puesto donde está (o hacia donde va) el golfista: ahí nunca cae una pelota */
  update(dt: number, playerSpot: number, hideAt: number): void {
    this.age += dt;
    const pending = this.loaded + this.tosses.length;
    if (pending < MAX_BALLS) {
      this.timer += dt;
      if (this.timer >= REFILL_DELAY[pending]) {
        this.timer = 0;
        const to = this.pickSpot(playerSpot);
        if (to >= 0) this.toss(to);
      }
    } else {
      this.timer = 0;
    }

    for (let i = this.tosses.length - 1; i >= 0; i--) {
      const t = this.tosses[i];
      t.t += dt / TOSS_TIME;
      const u = Math.min(1, t.t);
      const s = this.spots[t.spot];
      t.mesh.position.set(t.from.x + (s.x - t.from.x) * u, t.from.y * (1 - u) + BALL_RADIUS * 1.35 * u + Math.sin(u * Math.PI) * 2.4, t.from.z + (TEE_Z - t.from.z) * u);
      if (u < 1) continue;
      s.ball = true;
      s.incoming = false;
      this.scene.remove(t.mesh);
      this.tosses.splice(i, 1);
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.age * 5);
    this.ringMat.opacity = 0.45 + 0.4 * pulse;
    this.spots.forEach((s, i) => {
      // en el puesto donde el golfista ya está en postura, la pelota se dibuja en su tee
      s.ballMesh.visible = s.ball && i !== hideAt;
      s.ring.visible = s.ball;
      s.ring.scale.setScalar(1 + 0.15 * pulse);
    });
  }

  private toss(spot: number): void {
    const s = this.spots[spot];
    s.incoming = true;
    // la tira el guardia que tenga más cerca; sin guardias, cae desde la muralla
    let from = new THREE.Vector3(s.x, 1.5, 0.5);
    let best = Infinity;
    for (const g of this.guards) {
      const d = Math.abs(g.x - s.x);
      if (d < best) {
        best = d;
        from = new THREE.Vector3(g.x, 1.5, g.z);
      }
    }
    const mesh = new THREE.Mesh(ballGeo, this.ballMat);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.tosses.push({ spot, from, t: 0, mesh });
  }
}
