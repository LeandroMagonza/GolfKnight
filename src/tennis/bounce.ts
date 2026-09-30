// Modo tenis: la pelota del golpe plano rebota como en un rompeladrillos.
//
// Sale rasante, con piques bajos. El primer enemigo que toca la devuelve como un ladrillo: su cara es
// plana y mira al jugador, así que de frente vuelve recta y en diagonal sale espejada para el otro lado.
// De vuelta atraviesa a los que se cruce, y si se va por un costado, la pared de la cancha la devuelve
// como en el paddle. Al fondo hay una pared mágica que devuelve todo lo que llega. Todo en el plano (x,
// z); la altura son solo los piques, para que se vea.
import { BALL_RADIUS, GRAVITY, type BallState } from '../core/ballistics';

/** Los números del modo tenis. Se tocan en el panel de balance (tecla B). */
export const TENNIS = {
  /** Velocidad de salida del golpe plano, por nivel de golpe, en m/s. */
  outSpeed: [70, 80, 90],
  /** Velocidad con la que vuelve después de rebotar (en un enemigo o en la pared del fondo), en m/s. */
  backSpeed: 50,
  /** Lo que conserva al rebotar contra una pared lateral: de 0 a 1 (más de 1 la aceleraba sin fin). */
  wallKeep: 0.9,
  /** La pared mágica del fondo: a cuántos metros de la línea del tenista. Devuelve todo lo que llega. */
  backWall: 50,
  /** 1: el primer enemigo que toca la devuelve. 0: los atraviesa y la devuelve la pared del fondo (los escudos igual la rebotan). */
  enemyBounce: 1,
  /**
   * 1: cargando, apenas una pelota que vuelve entra al alcance, el golpe sale solo y se la devuelve. 0:
   * hay que soltar a tiempo. A estas velocidades la pelota cruza la ventana en menos de una décima.
   */
  autoSwing: 1,
  /**
   * La vuelta nunca sale más cruzada que esto: al menos esta fracción de la velocidad va hacia el
   * jugador. Sin esto, una pelota que le pega de costado a un enemigo quedaba yendo de pared a pared.
   */
  minBack: 0.4,
  /** Altura de los piques, en metros. */
  hop: 1,
  /** Alcance de la raqueta: metros de x a cada lado del tenista. */
  reach: 1.6,
  /** La ventana para devolverla: desde cuántos metros delante de la línea hasta cuántos detrás. */
  ahead: 3,
  behind: 1.2,
  /** Racha: cada tantos re-golpes de una misma pelota, +1 de daño. */
  rallyStep: 2,
  /** A qué velocidad corre el tenista de costado, en m/s, y qué parte de eso mientras carga. */
  runSpeed: 16,
  chargeMove: 0.4,
  /** Pelotas en el bolsillo al empezar, y cuántas entran. */
  pocketStart: 1,
  pocketMax: 6,
  /** A cuántos metros de x hay que pasarle a una pelota del piso para levantarla. */
  pickReach: 1.1,
};

/** En qué anda una pelota de tenis: de ida, de vuelta, quieta en el piso para levantarla. */
export type TennisPhase = 'out' | 'back' | 'floor' | 'held';

/** Lo más rápido que puede ir una pelota, en m/s: con números locos en el panel el juego se colgaba. */
export const MAX_BALL_SPEED = 150;

/**
 * Rebote contra un enemigo, como contra un ladrillo: la cara plana mira al jugador. La velocidad hacia
 * adelante se da vuelta y la de costado se mantiene; después se lleva a `speed`, sin quedar más cruzada
 * que `minBack`.
 */
export function bounceOffEnemy(vx: number, vz: number, speed: number, minBack = TENNIS.minBack): { vx: number; vz: number } {
  let bx = vx;
  let bz = -Math.abs(vz);
  const len = Math.hypot(bx, bz);
  if (len < 1e-6) return { vx: 0, vz: -speed };
  bx /= len;
  bz /= len;
  if (-bz < minBack) {
    bz = -minBack;
    bx = (Math.sign(bx) || 1) * Math.sqrt(1 - minBack * minBack);
  }
  return { vx: bx * speed, vz: bz * speed };
}

/**
 * Un paso de la pelota de tenis. Avanza en el plano, pica siempre a la misma altura y rebota en las
 * paredes laterales (en x = ±`half`). Con `friction` se va frenando (el fondo): los piques se achican y
 * cuando casi no se mueve queda quieta. Devuelve true si pegó en una pared.
 */
export function stepTennis(s: BallState, dt: number, half: number, friction = 0, hop = TENNIS.hop, keep = TENNIS.wallKeep): boolean {
  const wallKeep = Math.min(1, Math.max(0, keep));
  if (friction > 0) {
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const next = Math.max(0, speed - friction * dt);
    if (next < 0.3) {
      s.vel.x = 0;
      s.vel.z = 0;
    } else {
      s.vel.x *= next / speed;
      s.vel.z *= next / speed;
    }
  }
  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.z * dt;
  s.vel.y -= GRAVITY * dt;
  s.pos.y += s.vel.y * dt;
  if (s.pos.y < BALL_RADIUS) {
    s.pos.y = BALL_RADIUS;
    s.bounces++;
    const moving = Math.hypot(s.vel.x, s.vel.z) > 0;
    // frenando, cada pique es más bajo; quieta, no pica más
    const h = friction > 0 ? Math.min(hop, Math.abs(s.vel.y) ** 2 / (2 * GRAVITY) * 0.35) : hop;
    s.vel.y = moving && h > 0.02 ? Math.sqrt(2 * GRAVITY * h) : 0;
    if (!moving && s.vel.y === 0) s.resting = true;
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

/**
 * Dónde va a cruzar la línea `lineZ` una pelota que viene de vuelta, contando los rebotes en las
 * paredes. Null si no viene hacia la línea. Es la marca que se dibuja en la línea para ir a buscarla.
 */
export function crossingX(x: number, z: number, vx: number, vz: number, lineZ: number, half: number): number | null {
  if (vz >= 0 || z <= lineZ) return null;
  const edge = half - BALL_RADIUS;
  // el recorrido en x sin paredes, y después se "dobla" entre -edge y +edge como un espejo
  const raw = x + (vx * (lineZ - z)) / vz;
  const width = 2 * edge;
  let u = (((raw + edge) % (2 * width)) + 2 * width) % (2 * width);
  if (u > width) u = 2 * width - u;
  return u - edge;
}
