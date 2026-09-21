// Relieve del campo (prototipo, se prende con ?relieve en la URL). Sin dependencias: una función de
// altura hecha de formas diseñadas, no de ruido. El driver sale rasante, así que una loma es cobertura
// y una zanja es un carril: si el relieve fuera al azar, atravesar filas sería una lotería.
//
// Cerca de los puestos y de la muralla el piso es plano (altura 0): ahí viven el golfista, los guardias,
// las pelotas y la puerta, y nada de eso tiene que enterarse del relieve.

export interface Hill {
  x: number;
  z: number;
  /** Altura en el centro, en metros (negativa = pozo). */
  height: number;
  /** Radio aproximado a lo ancho (X) y a lo largo (Z), en metros. */
  rx: number;
  rz: number;
}

/** Dos lomas que tapan, una de cada lado, a distinta profundidad. */
export const HILLS: readonly Hill[] = [
  { x: -11.5, z: 34, height: 2.0, rx: 4.5, rz: 5.5 },
  { x: 11.5, z: 47, height: 2.2, rx: 5, rz: 6.5 },
];

/** Un valle por el medio, que apunta a los puestos centrales: los que bajan por ahí quedan en fila. */
export const VALLEY = { x: 0, depth: 0.9, halfWidth: 4, fromZ: 22, toZ: 60 };

/** Hasta acá el piso es plano; de acá en adelante el relieve entra de a poco. */
export const FLAT_UNTIL_Z = 14;
export const RELIEF_FULL_Z = 22;

/** El interruptor. Apagado, el campo es el plano de siempre y heightAt devuelve 0. */
export const relief = { on: false };

function smoothstep(a: number, b: number, v: number): number {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Altura del terreno en (x, z), con el relieve prendido o no. */
export function reliefAt(x: number, z: number): number {
  let h = 0;
  for (const hill of HILLS) {
    const dx = (x - hill.x) / hill.rx;
    const dz = (z - hill.z) / hill.rz;
    h += hill.height * Math.exp(-0.5 * (dx * dx + dz * dz));
  }
  const vx = (x - VALLEY.x) / VALLEY.halfWidth;
  const along = smoothstep(VALLEY.fromZ, VALLEY.fromZ + 8, z) * (1 - smoothstep(VALLEY.toZ - 8, VALLEY.toZ, z));
  h -= VALLEY.depth * Math.exp(-0.5 * vx * vx) * along;
  return h * smoothstep(FLAT_UNTIL_Z, RELIEF_FULL_Z, z);
}

/** Altura del piso en (x, z): 0 si el relieve está apagado. */
export function heightAt(x: number, z: number): number {
  return relief.on ? reliefAt(x, z) : 0;
}

/** Normal del terreno (unitaria, hacia arriba), por diferencias finitas. */
export function normalAt(x: number, z: number, ground: (x: number, z: number) => number = heightAt): { x: number; y: number; z: number } {
  const e = 0.25;
  const sx = (ground(x + e, z) - ground(x - e, z)) / (2 * e);
  const sz = (ground(x, z + e) - ground(x, z - e)) / (2 * e);
  const n = Math.hypot(sx, 1, sz);
  return { x: -sx / n, y: 1 / n, z: -sz / n };
}

/**
 * Dónde un rayo (origen o, dirección d) toca el terreno. Marcha el rayo de a pasos y afina por
 * bisección. Devuelve null si no lo toca en `maxDist` metros.
 */
export function raycastTerrain(
  o: { x: number; y: number; z: number },
  d: { x: number; y: number; z: number },
  maxDist = 300,
  ground: (x: number, z: number) => number = heightAt,
): { x: number; y: number; z: number } | null {
  const above = (t: number) => o.y + d.y * t - ground(o.x + d.x * t, o.z + d.z * t);
  if (above(0) <= 0) return { x: o.x, y: ground(o.x, o.z), z: o.z };
  const step = 0.5;
  let prev = 0;
  for (let t = step; t <= maxDist; t += step) {
    if (above(t) <= 0) {
      let lo = prev;
      let hi = t;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (above(mid) <= 0) hi = mid;
        else lo = mid;
      }
      const x = o.x + d.x * hi;
      const z = o.z + d.z * hi;
      return { x, y: ground(x, z), z };
    }
    prev = t;
  }
  return null;
}
