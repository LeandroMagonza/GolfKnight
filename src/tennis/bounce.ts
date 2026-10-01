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
  /**
   * Qué hace la pelota de ida con los enemigos. 1: el primero que toca la devuelve. 0: los atraviesa y
   * la devuelve la pared del fondo (los escudos igual la rebotan). 2: al que mata lo atraviesa, y el que
   * sobrevive la devuelve.
   */
  enemyBounce: 2,
  /**
   * Cuánto apunta la vuelta hacia vos (o hacia el centro, con `homeTo`), al rebotar en un enemigo o en la
   * pared del fondo: 0 es el rebote puro, como en un espejo; 1, derecho a vos.
   */
  homing: 0.5,
  /** Hacia dónde tira la vuelta: 0, hacia el tenista; 1, hacia el centro de la línea. */
  homeTo: 0,
  /**
   * La puntería de la pared del fondo, aparte: 1 la manda derecho a vos. Con menos, la que pegaba cerca de
   * una esquina volvía recta (mitad espejo hacia afuera, mitad hacia vos) y quedaba lejos, en el costado.
   */
  wallHoming: 1,
  /**
   * La que rebota en un enemigo vuelve **en globo**, y tarda por lo menos esto en llegar a tu línea, en s:
   * así, aunque el enemigo esté encima, hay tiempo de acomodarse. Cuanto más cerca, más alto el globo.
   */
  minReturn: 1.2,
  /**
   * Imán: si viene una pelota y va a pasar a menos de esto de tu alcance, sin tocar A ni D el tenista se
   * corre solo hasta donde va a llegar. En m; 0 lo apaga.
   */
  assist: 2,
  /**
   * El golpe guardado: si soltás antes de tiempo y viene una pelota a tu alcance que llega en menos de
   * esto (s), el golpe espera a que llegue en lugar de sacar del bolsillo.
   */
  buffer: 0.7,
  /**
   * Cuántos rebotes en las paredes de los costados aguanta: al llegar a ese número la pelota salta por
   * arte de magia a tus pies, en la línea. 0: sin límite.
   */
  wallLimit: 2,
  /** 1: el globo, después de reventar, vuelve por el aire a tu línea para seguir jugando. 0: se pierde. */
  lobBack: 1,
  /** Cuánto tarda ese globo de vuelta, en s, y qué tan alto va, en m. */
  lobTime: 1.6,
  lobHeight: 7,
  /** 1: los enemigos te pegan como en el golf. 0: te atraviesan, y solo cuenta la puerta. */
  hurtPlayer: 0,
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
/**
 * La vuelta con puntería: el rebote puro (`bounceOffEnemy`) torcido hacia `target` (un punto de la línea)
 * en una fracción `homing`. Con 0 es el espejo; con 1 va derecho al punto.
 */
export function homeBack(vx: number, vz: number, x: number, z: number, target: { x: number; z: number }, speed: number, homing = TENNIS.homing, minBack = TENNIS.minBack): { vx: number; vz: number } {
  const pure = bounceOffEnemy(vx, vz, 1, minBack);
  const h = Math.min(1, Math.max(0, homing));
  const tx = target.x - x;
  const tz = target.z - z;
  const tl = Math.hypot(tx, tz);
  if (h <= 0 || tl < 1e-6 || tz >= 0) return { vx: pure.vx * speed, vz: pure.vz * speed };
  const mx = pure.vx * (1 - h) + (tx / tl) * h;
  const mz = pure.vz * (1 - h) + (tz / tl) * h;
  return bounceOffEnemy(mx, mz, speed, minBack);
}

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
