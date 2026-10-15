// Los modelos de la hidra, hechos por código (cajas y piedras facetadas, como los de PolygonDungeon): el
// cuerpo, la cabeza y lo que no es un enemigo (los pedazos de cuello, el muñón que brilla, el escupitajo).
// Todo mira a +z (adelante, como los enemigos). Colores que se leen sobre el pasto desde la cámara alta:
// escamas azul pizarra, panza clara, cuernos de hueso, ojos amarillos y la golilla naranja.
import * as THREE from 'three';
import { facet, flatMat } from '../kit';

export const COLORS = {
  scale: 0x3b5a8c,
  dark: 0x263b5e,
  belly: 0xa9bac6,
  bone: 0xe8d9ae,
  eye: 0xffd64a,
  mouth: 0xc23b4b,
  frill: 0xe07b39,
  /** La cabeza que vuelve más fuerte (la versión «fuerte»): roja. */
  strong: 0x8c3b4a,
  /** El escupitajo y su marca: verde ácido. */
  acid: 0xa6f03a,
  /** El que va a la puerta: naranja fuego, para que no se confunda con el de tu puesto. */
  gate: 0xff9a2a,
  /** El muñón abierto: brasa. */
  ember: 0xff7a1a,
  /** El muñón quemado. */
  char: 0x2b2522,
};

/** Altura de la cabeza (el centro del cráneo) sobre el piso, quieta: el cuello la sostiene ahí. */
export const HEAD_Y = 3.4;
/** Dónde le entra el cuello a la cabeza, en el modelo de la cabeza (atrás del cráneo). */
export const NECK_JOINT = new THREE.Vector3(0, HEAD_Y - 0.12, -0.5);

const ico = new THREE.IcosahedronGeometry(1, 1);
const lowIco = new THREE.IcosahedronGeometry(1, 0);

function blob(parent: THREE.Object3D, mat: THREE.Material, seed: number, pos: [number, number, number], size: [number, number, number], detail = 1): THREE.Mesh {
  const m = new THREE.Mesh(facet((detail ? ico : lowIco).clone(), 0.1, seed), mat);
  m.position.set(...pos);
  m.scale.set(...size);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function cone(parent: THREE.Object3D, mat: THREE.Material, r: number, h: number, pos: [number, number, number], rotX = 0, rotZ = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), mat);
  m.position.set(...pos);
  m.rotation.set(rotX, 0, rotZ);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function box(parent: THREE.Object3D, mat: THREE.Material, size: [number, number, number], pos: [number, number, number], seed = 1): THREE.Mesh {
  const m = new THREE.Mesh(facet(new THREE.BoxGeometry(...size, 2, 1, 2), 0.06, seed), mat);
  m.position.set(...pos);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/**
 * El cuerpo: un lomo grande y bajo, cuatro patas cortas, púas en el lomo y la cola atrás. Adelante, el
 * pecho de donde salen los cuellos (ver `SHOULDERS` en fight.ts). Adelante del pecho, el corazón (`heart`),
 * que brilla cuando queda al descubierto.
 */
export function bodyLook(): THREE.Group {
  const g = new THREE.Group();
  const scale = flatMat(COLORS.scale);
  const dark = flatMat(COLORS.dark);
  const belly = flatMat(COLORS.belly);
  const bone = flatMat(COLORS.bone);
  blob(g, scale, 3, [0, 1.6, -0.2], [1.95, 1.2, 2.2]);
  blob(g, belly, 5, [0, 1.05, 0.1], [1.65, 0.75, 1.95]);
  blob(g, scale, 7, [0, 2.0, 1.35], [1.6, 0.95, 1.05]);
  for (const [x, z] of [[-1.45, 1.05], [1.45, 1.05], [-1.5, -1.3], [1.5, -1.3]]) {
    const leg = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.42, 0.52, 1.2, 6), 0.08, x * 3 + z), dark);
    leg.position.set(x, 0.6, z);
    leg.castShadow = true;
    g.add(leg);
    for (const dx of [-0.2, 0, 0.2]) cone(g, bone, 0.08, 0.3, [x + dx, 0.1, z + 0.48], Math.PI / 2);
  }
  // púas del lomo, de adelante hacia atrás, cada vez más chicas
  for (let k = 0; k < 6; k++) cone(g, bone, 0.26 - k * 0.025, 0.85 - k * 0.07, [0, 2.78 - k * 0.1, 0.9 - k * 0.62], -0.55);
  // la cola, en pedazos que se afinan, con una púa en la punta
  const tail: [number, number, number, number][] = [[0, 1.3, -2.3, 0.85], [0, 1.0, -3.3, 0.62], [0, 0.75, -4.1, 0.45], [0, 0.55, -4.75, 0.3]];
  tail.forEach(([x, y, z, r], i) => blob(g, i % 2 ? dark : scale, 11 + i, [x, y, z], [r, r * 0.85, r * 1.25]));
  cone(g, bone, 0.2, 0.7, [0, 0.5, -5.25], -Math.PI / 2);
  // el corazón: una gema roja en el pecho, entre los cuellos
  const heart = blob(g, flatMat(0x7a1f2b, { emissive: 0x000000 }), 17, [0, 1.75, 2.25], [0.42, 0.5, 0.25], 0);
  heart.name = 'heart';
  return g;
}

/**
 * Una cabeza de serpiente: el cráneo, el hocico, la mandíbula (`jaw`, que se abre), los ojos (`eye`), la
 * boca (`mouth`, que brilla mientras carga el escupitajo), los cuernos y la golilla. Todo dentro de `head`,
 * que se mueve entero (se echa atrás, se sacude) sobre la columna del enemigo: el enemigo está en el piso
 * debajo de la cabeza, y las pelotas le pegan a toda esa columna. `tint`: la cabeza fuerte, roja.
 */
export function headLook(tint = COLORS.scale): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, HEAD_Y, 0);
  g.add(head);
  const scale = flatMat(tint);
  const dark = flatMat(COLORS.dark);
  const bone = flatMat(COLORS.bone);
  const frill = flatMat(COLORS.frill);
  blob(head, scale, 21, [0, 0.1, -0.05], [0.58, 0.48, 0.68]);
  box(head, scale, [0.66, 0.38, 0.9], [0, -0.02, 0.72], 22);
  box(head, dark, [0.78, 0.14, 0.34], [0, 0.32, 0.3], 23);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), flatMat(COLORS.eye, { emissive: COLORS.eye, emissiveIntensity: 0.6 }));
    eye.name = 'eye';
    eye.position.set(0.31 * s, 0.22, 0.44);
    head.add(eye);
    cone(head, bone, 0.13, 0.75, [0.27 * s, 0.5, -0.3], -1.05, -0.25 * s);
    cone(head, frill, 0.2, 0.7, [0.42 * s, 0.05, -0.45], -1.3, -0.9 * s);
    // colmillos de arriba
    cone(head, bone, 0.05, 0.2, [0.2 * s, -0.27, 1.02], Math.PI);
  }
  cone(head, frill, 0.22, 0.8, [0, 0.42, -0.55], -1.2);
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  jaw.position.set(0, -0.2, 0.18);
  head.add(jaw);
  box(jaw, scale, [0.58, 0.16, 0.92], [0, -0.06, 0.5], 24);
  const mouth = box(jaw, flatMat(COLORS.mouth, { emissive: 0x000000 }), [0.48, 0.05, 0.75], [0, 0.04, 0.48], 25);
  mouth.name = 'mouth';
  for (const s of [-1, 1]) cone(jaw, bone, 0.045, 0.16, [0.2 * s, 0.1, 0.85]);
  return g;
}

/** Los pedazos de un cuello: piedras facetadas que se ponen sobre la curva del cuello (ver Neck). */
export const neckGeo = facet(lowIco.clone(), 0.12, 31);
export const spikeGeo = new THREE.ConeGeometry(0.11, 0.42, 4);
/** El corte del muñón: un disco que brilla, y una llamita encima. */
export const cutGeo = new THREE.CylinderGeometry(0.36, 0.42, 0.18, 7);
export const flameGeo = new THREE.ConeGeometry(0.28, 0.75, 6);
/** El escupitajo. */
export const globGeo = facet(lowIco.clone(), 0.18, 41);
