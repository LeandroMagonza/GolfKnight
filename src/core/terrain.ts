// Relieve del campo. Sin dependencias: una función de altura hecha de formas diseñadas, no de ruido.
// El driver sale rasante, así que una loma es cobertura y una zanja es un carril: si el relieve fuera
// al azar, atravesar filas sería una lotería.
//
// Por eso los mapas son **varios campos diseñados** y cada partida sale uno: cambia dónde conviene
// pararse y qué palo sirve, sin que nada quede injugable. Se fuerza uno con ?campo=N, y ?plano deja el
// campo liso de siempre (lo usan las pruebas que miden trayectorias).
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

/** Un valle: una canaleta a lo largo del campo, centrada en x. */
export interface Valley {
  x: number;
  depth: number;
  halfWidth: number;
  fromZ: number;
  toZ: number;
}

export interface Course {
  name: string;
  hills: readonly Hill[];
  valleys: readonly Valley[];
}

/**
 * Los campos. Cada uno propone una pregunta distinta: dónde está la cobertura, por dónde vienen en
 * fila, y desde qué puesto conviene pegar.
 */
export const COURSES: readonly Course[] = [
  {
    // el de siempre: dos lomas cruzadas y un carril limpio por el medio
    name: 'Valle del medio',
    hills: [
      { x: -11.5, z: 34, height: 2.0, rx: 4.5, rz: 5.5 },
      { x: 11.5, z: 47, height: 2.2, rx: 5, rz: 6.5 },
    ],
    valleys: [{ x: 0, depth: 0.9, halfWidth: 4, fromZ: 22, toZ: 60 }],
  },
  {
    // una meseta ancha en el medio parte el campo en dos: el driver no pasa, los globos sí
    name: 'La meseta',
    hills: [
      { x: 0, z: 38, height: 2.4, rx: 8, rz: 5 },
      { x: -15, z: 26, height: 1.4, rx: 4, rz: 4 },
      { x: 15, z: 26, height: 1.4, rx: 4, rz: 4 },
    ],
    valleys: [
      { x: -11, depth: 1.0, halfWidth: 3.2, fromZ: 30, toZ: 62 },
      { x: 11, depth: 1.0, halfWidth: 3.2, fromZ: 30, toZ: 62 },
    ],
  },
  {
    // dos carriles laterales y una loma cerca: hay que salir del puesto del medio
    name: 'Los dos carriles',
    hills: [
      { x: 0, z: 24, height: 1.8, rx: 5.5, rz: 4 },
      { x: -8, z: 50, height: 2.2, rx: 5, rz: 6 },
      { x: 9, z: 50, height: 2.2, rx: 5, rz: 6 },
    ],
    valleys: [
      { x: -13, depth: 1.1, halfWidth: 3.5, fromZ: 20, toZ: 64 },
      { x: 13, depth: 1.1, halfWidth: 3.5, fromZ: 20, toZ: 64 },
    ],
  },
  {
    // apenas ondulado: el campo más limpio, para tirar rasante de punta a punta
    name: 'La loma sola',
    hills: [
      { x: -6, z: 42, height: 2.4, rx: 6.5, rz: 7 },
      { x: 13, z: 30, height: 1.2, rx: 4.5, rz: 4.5 },
    ],
    valleys: [{ x: 6, depth: 0.8, halfWidth: 5, fromZ: 20, toZ: 64 }],
  },
];

/** Hasta acá el piso es plano; de acá en adelante el relieve entra de a poco. */
export const FLAT_UNTIL_Z = 14;
export const RELIEF_FULL_Z = 22;

/**
 * El campo en juego. `on` apagado deja el plano de siempre; `course` es cuál de COURSES salió esta
 * partida. Se elige antes de armar el mundo, porque la malla del terreno se construye una sola vez.
 */
export const relief = { on: true, index: 0 };

/** El campo de esta partida. */
export function course(): Course {
  return COURSES[relief.index % COURSES.length];
}

/**
 * Elige el campo de la partida. `which` sale de la URL: un número (1..N) fuerza ese campo, 'plano'
 * deja el campo liso, y cualquier otra cosa sortea uno.
 */
export function pickCourse(which?: string | null): Course {
  if (which === 'plano') {
    relief.on = false;
    relief.index = 0;
    return COURSES[0];
  }
  relief.on = true;
  const n = Number(which);
  relief.index = Number.isFinite(n) && n >= 1 ? (n - 1) % COURSES.length : Math.floor(Math.random() * COURSES.length);
  return course();
}


function smoothstep(a: number, b: number, v: number): number {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Altura del terreno del campo en juego en (x, z), esté el relieve prendido o no. */
export function reliefAt(x: number, z: number): number {
  const c = course();
  let h = 0;
  for (const hill of c.hills) {
    const dx = (x - hill.x) / hill.rx;
    const dz = (z - hill.z) / hill.rz;
    h += hill.height * Math.exp(-0.5 * (dx * dx + dz * dz));
  }
  for (const v of c.valleys) {
    const vx = (x - v.x) / v.halfWidth;
    const along = smoothstep(v.fromZ, v.fromZ + 8, z) * (1 - smoothstep(v.toZ - 8, v.toZ, z));
    h -= v.depth * Math.exp(-0.5 * vx * vx) * along;
  }
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
