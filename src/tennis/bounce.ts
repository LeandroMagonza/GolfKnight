// Modo tenis: cómo va y cómo vuelve la pelota. Las reglas, pensadas para que se lean como en un
// rompeladrillos (ver docs/diseno-combate.md, «tenis desde cero»):
//
// - **De ida** sale rasante, con piques, a la velocidad del golpe. Las paredes de los costados la
//   rebotan (tiros con banda), pocas veces.
// - **De vuelta** (del primer enemigo que toca, de la pared mágica del fondo o del globo que reventó)
//   vuelve por el aire y tarda **siempre lo mismo** en llegar a tu línea: del enemigo que está encima,
//   en un globo alto; del de lejos, más tenso. Cae **en espejo**: si le tiraste cruzado, sigue para el
//   otro lado; de frente, vuelve a donde estabas. Nunca se sale de la cancha.
// - **El golpe** se decide por timing: soltar cuando la pelota llega es el golpe 3, cerca es el 2; si
//   estás ahí y no soltás, la devolvés igual con el 1.
import { BALL_RADIUS, GRAVITY, type BallState } from '../core/ballistics';

/** Los números del modo tenis. Se tocan en el panel de balance (tecla B). */
export const TENNIS = {
  /** Velocidad de salida del golpe, por nivel de golpe, en m/s. */
  outSpeed: [50, 60, 70],
  /** Lo que tarda en llegar a tu línea la pelota que vuelve, en s, venga de donde venga. */
  returnTime: 1.4,
  /** Altura de ese globo: tanto si el rebote fue encima tuyo, tanto si fue a `arcSpan` m o más. */
  arcNear: 6,
  arcFar: 1.5,
  arcSpan: 40,
  /** La pared mágica del fondo: a cuántos metros de la línea del tenista. Devuelve todo lo que llega. */
  backWall: 50,
  /** Lo que conserva de ida al rebotar contra una pared de los costados: de 0 a 1. */
  wallKeep: 0.9,
  /** Cuántos rebotes en los costados aguanta de ida: al llegar a ese número, vuelve. 0: sin límite. */
  wallLimit: 2,
  /** Altura de los piques de ida, en m. */
  hop: 1,
  /** Alcance de la raqueta: metros de x a cada lado del tenista. */
  reach: 1.8,
  /** El timing: a cuántos segundos del momento justo es golpe 3, y a cuántos golpe 2. */
  perfect: 0.07,
  good: 0.18,
  /** El saque: cuánto tarda la pelota en subir hasta arriba, que es el momento justo, en s. */
  tossTime: 0.6,
  /** Racha: cada tantas devoluciones de una misma pelota, +1 de daño. */
  rallyStep: 2,
  /** A qué velocidad corre el tenista de costado, en m/s, y qué parte de eso mientras se prepara. */
  runSpeed: 14,
  chargeMove: 0.6,
  /** Pelotas en el bolsillo al empezar, y cuántas entran. */
  pocketStart: 1,
  pocketMax: 6,
  /** A cuántos metros de x hay que pasarle a una pelota del piso para levantarla. */
  pickReach: 1.1,
  /** 1: los enemigos te pegan como en el golf. 0: te atraviesan, y solo cuenta la puerta. */
  hurtPlayer: 0,
};

/** En qué anda una pelota de tenis: de ida, de vuelta (por el aire), en la raqueta o en el piso. */
export type TennisPhase = 'out' | 'back' | 'floor' | 'held';

/** Lo más rápido que puede ir una pelota, en m/s: con números locos en el panel el juego se colgaba. */
export const MAX_BALL_SPEED = 150;

/**
 * Dónde cae en tu línea la pelota que rebota en (`bx`, `bz`) viniendo con velocidad (`vx`, `vz`): en
 * espejo, como en un ladrillo, sin salirse de ±`edge`.
 */
export function mirrorLanding(bx: number, bz: number, vx: number, vz: number, lineZ: number, edge: number): number {
  const x = vz > 1e-6 ? bx + (vx / vz) * (bz - lineZ) : bx;
  return Math.min(edge, Math.max(-edge, x));
}

/** Qué tan alto va el globo de vuelta, según a cuántos metros de tu línea rebotó: más cerca, más alto. */
export function returnHeight(dist: number): number {
  const k = Math.max(0, 1 - dist / Math.max(1, TENNIS.arcSpan));
  return TENNIS.arcFar + (TENNIS.arcNear - TENNIS.arcFar) * k;
}

/** El nivel del golpe según a cuántos segundos del momento justo se soltó. */
export function timingQuality(err: number): number {
  const e = Math.abs(err);
  return e <= TENNIS.perfect ? 3 : e <= TENNIS.good ? 2 : 1;
}

/**
 * Un paso de la pelota de ida. Avanza en el plano, pica siempre a la misma altura y rebota en las
 * paredes laterales (en x = ±`half`). Devuelve true si pegó en una pared.
 */
export function stepTennis(s: BallState, dt: number, half: number, hop = TENNIS.hop, keep = TENNIS.wallKeep): boolean {
  const wallKeep = Math.min(1, Math.max(0, keep));
  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.z * dt;
  s.vel.y -= GRAVITY * dt;
  s.pos.y += s.vel.y * dt;
  if (s.pos.y < BALL_RADIUS) {
    s.pos.y = BALL_RADIUS;
    s.bounces++;
    s.vel.y = hop > 0.02 ? Math.sqrt(2 * GRAVITY * hop) : 0;
  }
  let wall = false;
  const edge = half - BALL_RADIUS;
  if (s.pos.x > edge && s.vel.x > 0) {
    s.pos.x = edge;
    s.vel.x = -s.vel.x * wallKeep;
    s.vel.z *= wallKeep;
    wall = true;
  } else if (s.pos.x < -edge && s.vel.x < 0) {
    s.pos.x = -edge;
    s.vel.x = -s.vel.x * wallKeep;
    s.vel.z *= wallKeep;
    wall = true;
  }
  return wall;
}
