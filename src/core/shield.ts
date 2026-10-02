// La sombra del escudo: geometría pura, sin nada del juego adentro, para poder probarla.
//
// El escudo del guerrero paraba la pelota que le llegaba de frente, pero no lo que estallaba en el
// piso: bastaba un globo a los pies para resolverlo, y entonces el wedge respondía a todo y aprender a
// congelar no hacía falta nunca. Ahora el escudo también tapa el daño en área que sale de adelante, y
// **tapa a los que tiene detrás**: una fila parapetada atrás de un guerrero se cubre con su escudo.
//
// De ahí salen las respuestas: silenciarlo, que le baja el escudo, o meter el globo
// **detrás** de él, donde el escudo no cubre. (Congelar ya no baja el escudo: el hielo solo frena.)

export interface Point {
  x: number;
  z: number;
}

/**
 * Qué tan de frente tiene que venir algo para que el escudo lo pare: el coseno del ángulo. 0.55 es un
 * arco de unos 113 grados, así que cubre el frente y los costados de adelante, no los flancos.
 */
export const SHIELD_FRONT = 0.55;

/**
 * Hasta qué altura tapa el escudo, en fracción de la altura del que lo lleva. Más arriba está la cabeza:
 * el hierro que le llega ahí (un arco apuntado un poco detrás de él) no rebota, le pega de verdad.
 */
export const SHIELD_TOP = 0.62;

/** ¿Algo que pasa en `from` le llega de frente a un escudo parado en `shield` que mira hacia `facing`? */
export function shieldFaces(from: Point, shield: Point, facing: Point): boolean {
  const sx = shield.x - from.x;
  const sz = shield.z - from.z;
  const ds = Math.hypot(sx, sz);
  if (ds < 0.001) return false;
  // la dirección en que se aleja la fuente tiene que ser la contraria a la que mira el escudo
  return -(sx * facing.x + sz * facing.z) / ds >= SHIELD_FRONT;
}

/**
 * ¿`target` queda tapado por el escudo de `shield`, visto desde `from`? Tiene que estar más lejos que
 * el escudo y dentro de su ancho, medido a lo ancho de la línea que va de la fuente al escudo.
 */
export function behindShield(from: Point, shield: Point, shieldRadius: number, target: Point, targetRadius: number): boolean {
  const sx = shield.x - from.x;
  const sz = shield.z - from.z;
  const ds = Math.hypot(sx, sz);
  if (ds < 0.001) return false;
  const ex = target.x - from.x;
  const ez = target.z - from.z;
  // más lejos que el escudo, medido sobre la línea de la explosión al escudo
  if ((ex * sx + ez * sz) / ds <= ds) return false;
  // y dentro de la sombra: lo que se aparta de esa línea
  return Math.abs((ex * sz - ez * sx) / ds) <= shieldRadius + targetRadius;
}

/**
 * **El rebote (2/10).** La pelota que para un escudo no se queda ahí: vuelve por el aire hacia vos, con
 * una marca roja en el piso, y si te agarra adentro de la marca te saca `damage`, venga como venga (no
 * importa cuánto la cargaste). Tirarle de frente a un escudo deja de ser gratis: o lo rodeás, o te corrés.
 *
 * **Te sigue mientras vuela**: el rebote llega enseguida después de pegar, cuando todavía estás en el
 * puesto del tiro, y lo normal es moverse después (a buscar la pelota que tiró el caddie). Los últimos
 * `lock` segundos deja de seguirte y la marca queda fija: ese es el momento de correrse.
 *
 * Vuela a `speed` m/s, pero nunca menos de `minFlight` segundos ni más de `maxFlight`. Sube `height`
 * metros sobre la línea recta: se la ve venir en arco.
 */
export const RICOCHET = { speed: 24, minFlight: 1, maxFlight: 1.8, lock: 0.6, height: 3, radius: 1.4, damage: 1 };

/** Cuánto tarda en volver la pelota que devolvió un escudo, según los metros que tiene que hacer. */
export function ricochetTime(distance: number): number {
  return Math.min(RICOCHET.maxFlight, Math.max(RICOCHET.minFlight, distance / Math.max(0.1, RICOCHET.speed)));
}
