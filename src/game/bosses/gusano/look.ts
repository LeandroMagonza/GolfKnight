// Los modelos del gusano de las cavernas, hechos por código (piedras y cilindros facetados, como los de
// PolygonDungeon): el gusano (anillos que se acomodan sobre una curva, ver `poseWorm`), la tierra que se
// mueve encima de él mientras va bajo tierra, y los terrones que deja atrás. Colores que se leen sobre el
// pasto desde la cámara alta: carne rosada con anillos morados, dientes de hueso, garganta que brilla.
import * as THREE from 'three';
import { facet, flatMat } from '../kit';

export const COLORS = {
  flesh: 0xc77b8f,
  band: 0x7a3d5c,
  belly: 0xe8c8b0,
  bone: 0xf2e6c8,
  throat: 0xff7a3a,
  dirt: 0x7b5a3c,
  darkDirt: 0x4f3a26,
  /** El escupitajo a tu puesto: verde ácido. */
  acid: 0xa6f03a,
  /** El que va a la puerta: naranja fuego. */
  gate: 0xff9a2a,
  /** La marca de dónde va a salir. */
  warn: 0xffb347,
};

/** Cuántos anillos tiene el cuerpo, y lo largo que asoma entero (de la boca al piso). */
export const SEGMENTS = 7;
export const LENGTH = 5.2;

const lowIco = new THREE.IcosahedronGeometry(1, 0);
const ico = new THREE.IcosahedronGeometry(1, 1);

/**
 * El gusano: `seg0` (el de abajo) a `seg6`, y `head` (la boca redonda con su corona de dientes y la
 * garganta, `throat`, que brilla). Cada parte mira con su eje +y a lo largo del cuerpo: `poseWorm` las
 * pone sobre la curva. Armado ya asomado entero, para que `addLook` mida su altura de verdad.
 */
export function wormLook(): THREE.Group {
  const g = new THREE.Group();
  const flesh = flatMat(COLORS.flesh);
  const band = flatMat(COLORS.band);
  const belly = flatMat(COLORS.belly);
  const bone = flatMat(COLORS.bone);
  for (let k = 0; k < SEGMENTS; k++) {
    const seg = new THREE.Group();
    seg.name = `seg${k}`;
    const r = radiusAt(k / (SEGMENTS - 1));
    const ring = new THREE.Mesh(facet(new THREE.CylinderGeometry(r, r * 1.08, 0.82, 8, 1), 0.08, 50 + k), k % 2 ? band : flesh);
    ring.castShadow = true;
    seg.add(ring);
    // la panza clara, adelante
    const plate = new THREE.Mesh(facet(new THREE.BoxGeometry(r * 1.1, 0.6, 0.25, 2, 1, 1), 0.08, 60 + k), belly);
    plate.position.z = r * 0.88;
    seg.add(plate);
    // pelos duros (púas chicas) en los anillos oscuros
    if (k % 2) {
      for (const a of [-0.9, 0, 0.9, Math.PI]) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 4), bone);
        // del lado de atrás, inclinados hacia afuera
        const th = a + Math.PI;
        s.position.set(Math.sin(th) * r, 0.1, Math.cos(th) * r);
        s.rotation.set(Math.cos(th) * 1.2, 0, -Math.sin(th) * 1.2);
        seg.add(s);
      }
    }
    g.add(seg);
  }
  const head = new THREE.Group();
  head.name = 'head';
  const rHead = radiusAt(1) * 1.25;
  const collar = new THREE.Mesh(facet(new THREE.CylinderGeometry(rHead, rHead * 0.9, 0.55, 9, 1, true), 0.06, 71), band);
  collar.castShadow = true;
  head.add(collar);
  const lip = new THREE.Mesh(facet(new THREE.TorusGeometry(rHead, 0.16, 5, 9), 0.06, 72), flesh);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.28;
  head.add(lip);
  // la garganta: un disco hondo que brilla
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(rHead * 0.85, rHead * 0.5, 0.3, 9), flatMat(0x3a0d16, { emissive: COLORS.throat, emissiveIntensity: 0.6 }));
  throat.name = 'throat';
  throat.position.y = 0.08;
  head.add(throat);
  // dos coronas de dientes, mirando hacia adentro
  for (const [n, rr, y, lean] of [[10, rHead * 0.92, 0.3, 0.7], [8, rHead * 0.6, 0.2, 0.45]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rr < rHead * 0.7 ? 0.3 : 0);
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), bone);
      t.position.set(Math.sin(a) * rr, y + 0.12, Math.cos(a) * rr);
      // inclinado hacia el centro de la boca
      t.rotation.set(-Math.cos(a) * lean, 0, Math.sin(a) * lean);
      head.add(t);
    }
  }
  g.add(head);
  poseWorm(g, 1, 0, 0, 0);
  return g;
}

/** Lo grueso del cuerpo en `p` (0 abajo, 1 la boca). */
function radiusAt(p: number): number {
  return 1.0 - 0.18 * p;
}

const up = new THREE.Vector3(0, 1, 0);
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();

/** El lomo del gusano en `p` (0 en el piso, 1 la boca): sube derecho y se curva hacia adelante arriba. */
function spine(p: number, lean: number, sway: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  const reach = 1.3 + 1.6 * lean;
  out.set(
    sway * Math.sin(t * 2.3 + p * 3) * p,
    (LENGTH - 0.7 - 0.9 * lean) * Math.sin((p * Math.PI) / 2),
    reach * p * p * p + 0.25 * Math.sin(t * 1.7 + p * 2) * p,
  );
  return out;
}

/**
 * Acomoda los anillos y la boca. `rise`: cuánto asomó (0 todo bajo tierra, 1 entero: lo de abajo queda
 * tapado por el piso). `lean`: cuánto se tira para adelante (al escupir). `sway`: cuánto se mece. `t`: reloj.
 */
export function poseWorm(g: THREE.Object3D, rise: number, lean: number, sway: number, t: number): void {
  const sink = (1 - rise) * (LENGTH + 0.8);
  for (let k = 0; k <= SEGMENTS; k++) {
    const obj = k < SEGMENTS ? g.getObjectByName(`seg${k}`) : g.getObjectByName('head');
    if (!obj) continue;
    const p = k / SEGMENTS;
    spine(p, lean, sway, t, a);
    // hacia dónde sigue el cuerpo ahí: cada anillo (y la boca) mira a lo largo
    spine(Math.max(0, p - 0.03), lean, sway, t, b);
    spine(Math.min(1, p + 0.03), lean, sway, t, c);
    obj.position.copy(a).setY(a.y - sink);
    obj.quaternion.setFromUnitVectors(up, c.sub(b).normalize());
  }
}

/** La tierra que se mueve encima del gusano: un lomo de tierra con piedras sueltas. */
export function moleLook(): THREE.Group {
  const g = new THREE.Group();
  const dirt = flatMat(COLORS.dirt);
  const dark = flatMat(COLORS.darkDirt);
  const dome = new THREE.Mesh(facet(ico.clone(), 0.18, 81), dirt);
  dome.scale.set(1.1, 0.45, 1.3);
  dome.castShadow = true;
  g.add(dome);
  for (let i = 0; i < 5; i++) {
    const a2 = (i / 5) * Math.PI * 2;
    const r = new THREE.Mesh(facet(lowIco.clone(), 0.2, 82 + i), i % 2 ? dark : dirt);
    r.scale.setScalar(0.22 + 0.06 * (i % 3));
    r.position.set(Math.sin(a2) * 0.8, 0.25, Math.cos(a2) * 0.95);
    r.name = `rock${i}`;
    g.add(r);
  }
  return g;
}

/** Un terrón del surco. */
export const clodGeo = facet(lowIco.clone(), 0.25, 91);
/** El escupitajo. */
export const globGeo = facet(lowIco.clone(), 0.18, 92);
