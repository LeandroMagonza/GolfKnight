// Análisis de los clips de golf de Mixamo: en qué momento están el address, el tope del backswing,
// el impacto y el final, hacia dónde sale la pelota y cómo va el palo respecto de la mano. Se calcula
// al cargar, muestreando el clip, así que sirve para cualquier clip de swing sin anotar tiempos a mano.
//
// Espacio del personaje: +Z es el frente del modelo, +X su izquierda, +Y arriba.
import * as THREE from 'three';

export interface HandSample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface SwingClip {
  name: string;
  /** Instantes del clip, en segundos. */
  address: number;
  top: number;
  impact: number;
  end: number;
  /** Ángulo (alrededor de Y) entre el frente del modelo y la dirección en que sale la pelota. */
  flightYaw: number;
  /** Dónde queda la pelota respecto del personaje (x, z locales). */
  tee: { x: number; z: number };
  /** Dirección del palo y de la punta de la cabeza, en el espacio local del hueso de la mano. */
  clubDirInHand: THREE.Vector3;
  toeDirInHand: THREE.Vector3;
  /** Recorrido de la mano, para saltar del backswing a medias al punto equivalente de la bajada. */
  samples: HandSample[];
}

const HAND = 'mixamorigRightHand';
const HZ = 60;
const BALL_Y = 0.04;

/** Posición de la mano derecha en espacio del personaje a lo largo del clip. */
export function sampleHand(root: THREE.Object3D, clip: THREE.AnimationClip, hz = HZ, bone = HAND): HandSample[] {
  const hand = root.getObjectByName(bone);
  if (!hand) return [];
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  const out: HandSample[] = [];
  const p = new THREE.Vector3();
  const steps = Math.floor(clip.duration * hz);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(clip.duration - 1e-4, i / hz);
    action.time = t;
    mixer.update(0);
    root.updateMatrixWorld(true);
    root.worldToLocal(hand.getWorldPosition(p));
    out.push({ t, x: p.x, y: p.y, z: p.z });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  return out;
}

/**
 * Fases del swing a partir de la velocidad de la mano: el impacto es donde la mano va más rápido en
 * horizontal; hacia atrás, el tope es la primera pausa de la mano; más atrás, el address es la
 * última vez que estuvo quieta; hacia adelante, el final es cuando vuelve a frenarse.
 */
export function analyzeSwing(root: THREE.Object3D, clip: THREE.AnimationClip, clubLength: number): SwingClip | null {
  const s = sampleHand(root, clip);
  const n = s.length;
  if (n < 20) return null;
  const W = 2;
  const vel = (i: number) => {
    const a = s[Math.max(0, i - W)];
    const b = s[Math.min(n - 1, i + W)];
    const dt = b.t - a.t || 1;
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt, z: (b.z - a.z) / dt };
  };
  const speed = (i: number) => Math.hypot(vel(i).x, vel(i).y, vel(i).z);

  let impact = 0;
  let best = 0;
  for (let i = 0; i < n; i++) {
    const v = vel(i);
    const h = Math.hypot(v.x, v.z);
    if (h > best) {
      best = h;
      impact = i;
    }
  }
  const pause = best * 0.2;
  let top = impact;
  while (top > 0 && speed(top) > pause) top--;
  // dentro de la pausa, el punto más lento
  while (top > 0 && speed(top - 1) < speed(top)) top--;
  // hacia atrás: primero sale de la pausa del tope (entra al backswing), después busca la quietud previa
  let address = top;
  const still = best * 0.04;
  while (address > 0 && speed(address) <= pause * 0.5) address--;
  while (address > 0 && speed(address) > still) address--;
  let finish = impact;
  while (finish < n - 1 && speed(finish) > pause) finish++;
  if (!(address < top && top < impact && impact < finish)) {
    console.warn(`analyzeSwing ${clip.name}: fases inválidas`, { address: s[address].t, top: s[top].t, impact: s[impact].t, finish: s[finish].t, best });
    return null;
  }

  // hacia dónde sale la pelota: la dirección horizontal de la mano en el impacto, en múltiplos de 90°
  const vi = vel(impact);
  const flightYaw = Math.round(Math.atan2(vi.x, vi.z) / (Math.PI / 2)) * (Math.PI / 2);
  const flight = new THREE.Vector3(Math.sin(flightYaw), 0, Math.cos(flightYaw));

  // la pelota: apoyada en el piso, a un palo de distancia de la mano, alejándose del cuerpo
  const h = s[impact];
  const away = new THREE.Vector3(h.x, 0, h.z).addScaledVector(flight, -(h.x * flight.x + h.z * flight.z));
  if (away.lengthSq() < 1e-4) away.set(flight.z, 0, -flight.x);
  away.normalize();
  const reach = Math.sqrt(Math.max(0.05, clubLength * clubLength - (h.y - BALL_Y) * (h.y - BALL_Y)));
  const tee = { x: h.x + away.x * reach, z: h.z + away.z * reach };

  // calibración del palo en la pose de impacto, guardada en el espacio del hueso de la mano
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  action.time = h.t;
  mixer.update(0);
  root.updateMatrixWorld(true);
  const hand = root.getObjectByName(HAND)!;
  const rootQ = root.getWorldQuaternion(new THREE.Quaternion());
  const handQInv = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
  const clubDir = new THREE.Vector3(tee.x - h.x, BALL_Y - h.y, tee.z - h.z).normalize();
  // la punta de la cabeza: perpendicular al palo y a la línea de tiro, hacia afuera y arriba
  const toeDir = new THREE.Vector3().crossVectors(clubDir, flight).normalize();
  if (toeDir.y < 0) toeDir.negate();
  const toHand = (v: THREE.Vector3) => v.applyQuaternion(rootQ).applyQuaternion(handQInv);
  const info: SwingClip = {
    name: clip.name,
    address: s[address].t,
    top: s[top].t,
    impact: s[impact].t,
    end: Math.min(clip.duration, s[finish].t + 0.1),
    flightYaw,
    tee,
    clubDirInHand: toHand(clubDir),
    toeDirInHand: toHand(toeDir),
    samples: s,
  };
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  return info;
}

/** Instante de la bajada (entre el tope y el impacto) en que la mano está más cerca de donde está en `time`. */
export function downswingTimeFor(clip: SwingClip, time: number): number {
  const s = clip.samples;
  const at = s[Math.min(s.length - 1, Math.max(0, Math.round(time * HZ)))];
  let bestT = clip.top;
  let bestD = Infinity;
  for (const p of s) {
    if (p.t < clip.top || p.t > clip.impact) continue;
    const d = (p.x - at.x) ** 2 + (p.y - at.y) ** 2 + (p.z - at.z) ** 2;
    if (d < bestD) {
      bestD = d;
      bestT = p.t;
    }
  }
  return bestT;
}
