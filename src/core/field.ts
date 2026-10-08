// La forma del campo. Siempre fue un rectángulo: 36 m de ancho, de la línea de los puestos al fondo.
//
// El trapecio (8/10, idea de Leandro, para probar desde el panel B o con ?trapecio): adelante, donde está
// el golfista, igual que siempre; el fondo, donde aparecen, más ancho. Los enemigos salen sobre un arco
// (los de las puntas un poco más cerca) y cada punto del arco cae en un punto de la línea de los puestos:
// la punta izquierda del arco en la punta izquierda de los puestos, el medio en el medio. Para eso todos
// caminan hacia un mismo punto de fuga detrás de la muralla, como las líneas de una perspectiva: el del
// medio, derecho; los de las puntas, en diagonal. Al que empujan (el viento, el wedge, la esquiva) sigue
// la fila del lugar adonde lo dejaron. Pasando los puestos, a la puerta como siempre.
//
// Todo sale de acá: el pasto, las rayas y los árboles (game/world), por dónde caminan y aparecen
// (game/enemies), y hasta dónde llegan el carrito y los hechizos de Abe.

/**
 * La línea de los puestos: desde acá se pega, así que es el 0 de las marcas de distancia. Vive acá y no
 * en game/tees para que las marcas del campo no puedan quedar desfasadas de los puestos.
 */
export const TEE_LINE_Z = 9;
/** El medio ancho del campo, adelante (y en todo el largo, si es un rectángulo). */
export const FIELD_HALF_WIDTH = 18;
/** Dónde aparecen las oleadas (en el trapecio, el medio del arco). */
export const SPAWN_Z = 68;
/** Lo que se deja libre contra cada borde al repartir dónde aparecen y por dónde llegan. */
const MARGIN = 3;

export const FIELD_SHAPE = {
  /** Trapecio (true) o rectángulo, como siempre. */
  trapezoid: false,
  /** El medio ancho del fondo, a la altura de SPAWN_Z. */
  backHalf: 32,
  /** Cuántos metros más cerca salen los de las puntas que los del medio: el fondo es un arco. */
  arc: 10,
};

/** Los números de fábrica, para «restaurar». */
export const FIELD_SHAPE_DEFAULTS = { ...FIELD_SHAPE };

/** ¿Se juega en el trapecio? (Con el fondo igual o más angosto que adelante, no hay trapecio.) */
export function trapezoidOn(): boolean {
  return FIELD_SHAPE.trapezoid && FIELD_SHAPE.backHalf > FIELD_HALF_WIDTH;
}

/**
 * El punto de fuga: dónde se juntarían los dos costados del trapecio, detrás de la muralla (z
 * negativa). Todas las filas apuntan a (0, vanishZ).
 */
export function vanishZ(): number {
  return TEE_LINE_Z - (FIELD_HALF_WIDTH * (SPAWN_Z - TEE_LINE_Z)) / (FIELD_SHAPE.backHalf - FIELD_HALF_WIDTH);
}

/** El medio ancho del campo a la altura `z`. Adelante de los puestos, el de siempre. */
export function fieldHalfAt(z: number): number {
  if (!trapezoidOn() || z <= TEE_LINE_Z) return FIELD_HALF_WIDTH;
  const v = vanishZ();
  return (FIELD_HALF_WIDTH * (z - v)) / (TEE_LINE_Z - v);
}

/**
 * La x de la fila que pasa por (x, z), a la altura `atZ`: por dónde va a pasar el que camina desde
 * (x, z). En el rectángulo, la misma x.
 */
export function laneX(x: number, z: number, atZ: number): number {
  if (!trapezoidOn()) return x;
  const v = vanishZ();
  return (x * (atZ - v)) / Math.max(0.01, z - v);
}

/**
 * Dónde aparece el que va a llegar a los puestos en `u` (de -1, la punta izquierda, a 1, la derecha):
 * sobre el arco del fondo, en la fila que termina en `u` de la línea de los puestos.
 */
export function spawnAt(u: number): { x: number; z: number } {
  const front = u * (FIELD_HALF_WIDTH - MARGIN);
  if (!trapezoidOn()) return { x: front, z: SPAWN_Z };
  const z = SPAWN_Z - FIELD_SHAPE.arc * u * u;
  const v = vanishZ();
  return { x: (front * (z - v)) / (TEE_LINE_Z - v), z };
}
