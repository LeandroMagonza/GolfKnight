// Lo que se ve del gólem de las piedras y que no sale de dungeon.glb: las piedras que nacen en su línea
// (facetadas, de dos tonos para que se les vea el giro desde la cámara alta), la piedra grande que levanta
// sobre la cabeza, las estrellitas del aturdido, y cómo se agranda una parte de jefe que crece.
import * as THREE from 'three';
import type { Enemy, Horde } from '../../enemies';
import { shadowMat } from '../../enemies';
import { facet, flatMat } from '../kit';

/** La plantilla de las piedras que crecen (ver addLook). */
export const ROCK_LOOK = 'golem-piedra';

/** Gris piedra del cuerpo, el canto más claro y el musgo: el giro se lee por las manchas. */
const ROCK_COLOR = 0x80796d;
const LEDGE_COLOR = 0xa79f90;
const MOSS_COLOR = 0x5f7040;

/**
 * Una piedra de radio 1, con el centro en un pivote (`pivot`) a 1 m del piso: el guion la agranda
 * escalando el pivote y la hace girar o rodar rotándolo, sin tocar el modelo (que el juego aplasta al
 * pegarle).
 */
export function rockModel(seed = 1): THREE.Group {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.name = 'pivot';
  pivot.position.y = 1;
  root.add(pivot);
  const body = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(1, 1), 0.2, seed), flatMat(ROCK_COLOR));
  body.castShadow = true;
  pivot.add(body);
  // dos cantos claros y una mancha de musgo, de un solo lado: desde arriba se ve que gira
  const bits: [number, number, number, number, number][] = [
    [0.75, 0.35, 0.3, 0.42, LEDGE_COLOR],
    [0.45, 0.2, -0.75, 0.32, LEDGE_COLOR],
    [-0.2, 0.85, 0.35, 0.36, MOSS_COLOR],
  ];
  bits.forEach(([x, y, z, r, color], i) => {
    const m = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(r, 0), 0.25, seed * 7 + i), flatMat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    pivot.add(m);
  });
  return root;
}

/** Lo que mide la plantilla de las piedras: se la pide a esa altura para que quede escalada 1 a 1. */
let rockLookHeight = 2;

/** Arma la plantilla de las piedras si no está. Devuelve lo que mide. */
export function ensureRockLook(horde: Horde): number {
  if (!horde.hasLook(ROCK_LOOK)) rockLookHeight = horde.addLook(ROCK_LOOK, rockModel(3));
  return rockLookHeight;
}

/** La piedra grande que el gólem levanta sobre la cabeza (no es un enemigo: no se le pega). */
export function boulder(radius: number, seed = 5): { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial } {
  const mat = flatMat(0x8d8577, { emissive: 0x000000 });
  const mesh = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(radius, 1), 0.18, seed), mat);
  mesh.castShadow = true;
  return { mesh, mat };
}

/** Tres estrellitas amarillas que giran sobre la cabeza del aturdido. */
export function stunStars(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe14a });
  const geo = new THREE.OctahedronGeometry(0.28, 0);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(geo, mat);
    const a = (i / 3) * Math.PI * 2;
    s.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
    g.add(s);
  }
  return g;
}

/** Los materiales del modelo de un enemigo (cada uno tiene los suyos: el juego los clona al crearlo). */
export function materialsOf(e: Enemy): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  e.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) out.push(m.material as THREE.MeshStandardMaterial);
  });
  return out;
}

/**
 * Le suma un brillo a lo que ya brilla. El juego pisa el brillo en cada cuadro antes del guion (el golpe
 * en blanco, el frío, el fuego), así que sumar encima deja ver las dos cosas.
 */
export function addGlow(mats: readonly THREE.MeshStandardMaterial[], color: THREE.Color, k: number): void {
  if (k <= 0.001) return;
  for (const m of mats) {
    m.emissive.r = Math.min(1, m.emissive.r + color.r * k);
    m.emissive.g = Math.min(1, m.emissive.g + color.g * k);
    m.emissive.b = Math.min(1, m.emissive.b + color.b * k);
  }
}

/**
 * Le cambia el tamaño a una parte que crece: el radio y la altura que ven las pelotas, la sombra, y la vida
 * de arriba (los cartelitos se arman a la altura con la que nació: se los sube lo que creció). Devuelve la
 * altura nueva, para la próxima vez.
 */
export function fitBody(e: Enemy, radius: number, height: number, lastHeight: number): number {
  e.stats.radius = radius;
  e.stats.height = height;
  const dy = height - lastHeight;
  for (const c of e.group.children) {
    if ((c as THREE.Sprite).isSprite) c.position.y += dy;
    else if ((c as THREE.Mesh).isMesh && (c as THREE.Mesh).material === shadowMat) c.scale.setScalar(radius * 1.15);
  }
  return height;
}
