// Física de la pelota, sin dependencias: tiro parabólico, piques y rodado. Sobre piso plano (y = 0) o,
// si se le pasa una función de altura, sobre un terreno con relieve: ahí pica según la pendiente y
// rueda cuesta abajo.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const GRAVITY = 22;
/** Desaceleración del rodado en m/s². */
export const ROLL_FRICTION = 9;
export const BALL_RADIUS = 0.12;
/** Por debajo de esta velocidad la pelota rodando se considera quieta. */
const REST_SPEED = 0.4;
/** Un pique con menos velocidad vertical que esta pasa a rodado. */
const MIN_BOUNCE_SPEED = 1.6;

export interface BallState {
  pos: Vec3;
  vel: Vec3;
  rolling: boolean;
  resting: boolean;
  /** Veces que tocó el piso. */
  bounces: number;
}

export interface BounceParams {
  restitution: number;
  bounceKeep: number;
  /** Cuánto la frena el pasto al rodar, en m/s². Menos fricción = rueda lento y tarda en parar. */
  rollFriction?: number;
  /** Gravedad propia, si el palo vuela con otra que la normal (el wedge, para llegar rápido). */
  gravity?: number;
}

/** Altura del piso en un punto. Sin esto, el piso es el plano y = 0. */
export type Ground = (x: number, z: number) => number;

/**
 * Velocidad de salida para volar `range` metros con ángulo `loftRad`. `rise` es cuánto más alto (o más
 * bajo, si es negativo) está el punto de caída que el de salida: 0 sobre piso plano.
 */
export function launchSpeed(range: number, loftRad: number, gravity = GRAVITY, rise = 0, rollFriction = ROLL_FRICTION): number {
  if (loftRad <= 0.001) return Math.sqrt(2 * rollFriction * range);
  if (rise === 0) return Math.sqrt((range * gravity) / Math.sin(2 * loftRad));
  // y = x tan(a) - g x² / (2 v² cos²(a)), despejando v para que pase por (range, rise)
  const cos = Math.cos(loftRad);
  const drop = Math.max(range * 0.05, range * Math.tan(loftRad) - rise);
  return Math.sqrt((gravity * range * range) / (2 * cos * cos * drop));
}

/** Pelota que sale con una velocidad y un ángulo dados (para tiros sobre terreno con relieve). */
export function launchWith(from: Vec3, dirX: number, dirZ: number, speed: number, angleRad: number): BallState {
  const h = speed * Math.cos(angleRad);
  return { pos: { x: from.x, y: from.y, z: from.z }, vel: { x: dirX * h, y: speed * Math.sin(angleRad), z: dirZ * h }, rolling: false, resting: false, bounces: 0 };
}

/** Estado inicial de una pelota que sale desde `from` hacia `dirX, dirZ` (unitario en el plano). */
export function launch(from: Vec3, dirX: number, dirZ: number, range: number, loftRad: number, gravity = GRAVITY, rollFriction = ROLL_FRICTION): BallState {
  const v = launchSpeed(range, loftRad, gravity, 0, rollFriction);
  const h = v * Math.cos(loftRad);
  const rolling = loftRad <= 0.001;
  return {
    pos: { x: from.x, y: rolling ? BALL_RADIUS : Math.max(from.y, BALL_RADIUS), z: from.z },
    vel: { x: dirX * h, y: rolling ? 0 : v * Math.sin(loftRad), z: dirZ * h },
    rolling,
    resting: false,
    bounces: 0,
  };
}

/**
 * Avanza la pelota dt segundos. Devuelve true si en este paso tocó el piso (pique o aterrizaje).
 */
export function stepBall(s: BallState, dt: number, p: BounceParams, ground?: Ground): boolean {
  if (s.resting) return false;
  if (ground) return stepOnTerrain(s, dt, p, ground);
  if (s.rolling) {
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const next = speed - (p.rollFriction ?? ROLL_FRICTION) * dt;
    if (next <= REST_SPEED) {
      s.vel.x = s.vel.z = 0;
      s.resting = true;
      return false;
    }
    const k = next / speed;
    // avanza con la velocidad media del paso
    s.pos.x += s.vel.x * (1 + k) * 0.5 * dt;
    s.pos.z += s.vel.z * (1 + k) * 0.5 * dt;
    s.vel.x *= k;
    s.vel.z *= k;
    return false;
  }
  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.z * dt;
  const g = p.gravity ?? GRAVITY;
  s.pos.y += s.vel.y * dt - 0.5 * g * dt * dt;
  s.vel.y -= g * dt;
  if (s.pos.y > BALL_RADIUS || s.vel.y >= 0) return false;
  // tocó el piso
  s.pos.y = BALL_RADIUS;
  s.bounces++;
  s.vel.x *= p.bounceKeep;
  s.vel.z *= p.bounceKeep;
  const up = -s.vel.y * p.restitution;
  if (up < MIN_BOUNCE_SPEED) {
    s.vel.y = 0;
    s.rolling = true;
    if (Math.hypot(s.vel.x, s.vel.z) <= REST_SPEED) s.resting = true;
  } else {
    s.vel.y = up;
  }
  return true;
}

/** Puntos de la trayectoria hasta el primer contacto con el piso (o hasta frenar, si rueda). */
export function previewPath(from: Vec3, dirX: number, dirZ: number, range: number, loftRad: number, points = 24, gravity = GRAVITY): Vec3[] {
  const out: Vec3[] = [];
  if (loftRad <= 0.001) {
    for (let i = 0; i <= points; i++) {
      const d = (range * i) / points;
      out.push({ x: from.x + dirX * d, y: BALL_RADIUS, z: from.z + dirZ * d });
    }
    return out;
  }
  const v = launchSpeed(range, loftRad, gravity);
  const h = v * Math.cos(loftRad);
  const vy = v * Math.sin(loftRad);
  const y0 = Math.max(from.y, BALL_RADIUS);
  // tiempo hasta volver a la altura del piso saliendo desde y0
  const total = (vy + Math.sqrt(vy * vy + 2 * gravity * (y0 - BALL_RADIUS))) / gravity;
  for (let i = 0; i <= points; i++) {
    const t = (total * i) / points;
    out.push({ x: from.x + dirX * h * t, y: y0 + vy * t - 0.5 * gravity * t * t, z: from.z + dirZ * h * t });
  }
  return out;
}

function slopeAt(ground: Ground, x: number, z: number): { sx: number; sz: number } {
  const e = 0.25;
  return { sx: (ground(x + e, z) - ground(x - e, z)) / (2 * e), sz: (ground(x, z + e) - ground(x, z - e)) / (2 * e) };
}

/** Lo mismo que stepBall, pero contra un terreno con relieve. */
function stepOnTerrain(s: BallState, dt: number, p: BounceParams, ground: Ground): boolean {
  const g = p.gravity ?? GRAVITY;
  if (s.rolling) {
    // la pendiente lo acelera cuesta abajo; el pasto lo frena
    const { sx, sz } = slopeAt(ground, s.pos.x, s.pos.z);
    s.vel.x -= g * sx * dt;
    s.vel.z -= g * sz * dt;
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const next = speed - (p.rollFriction ?? ROLL_FRICTION) * dt;
    if (next <= REST_SPEED) {
      s.vel.x = s.vel.z = 0;
      s.resting = true;
      s.pos.y = ground(s.pos.x, s.pos.z) + BALL_RADIUS;
      return false;
    }
    const k = next / speed;
    s.pos.x += s.vel.x * (1 + k) * 0.5 * dt;
    s.pos.z += s.vel.z * (1 + k) * 0.5 * dt;
    s.vel.x *= k;
    s.vel.z *= k;
    s.pos.y = ground(s.pos.x, s.pos.z) + BALL_RADIUS;
    return false;
  }
  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.z * dt;
  s.pos.y += s.vel.y * dt - 0.5 * g * dt * dt;
  s.vel.y -= g * dt;
  const floor = ground(s.pos.x, s.pos.z) + BALL_RADIUS;
  if (s.pos.y > floor) return false;
  // tocó el terreno: se separa la velocidad en la parte que va contra el piso y la que lo roza
  const { sx, sz } = slopeAt(ground, s.pos.x, s.pos.z);
  const len = Math.hypot(sx, 1, sz);
  const nx = -sx / len;
  const ny = 1 / len;
  const nz = -sz / len;
  const into = s.vel.x * nx + s.vel.y * ny + s.vel.z * nz;
  s.pos.y = floor;
  if (into >= 0) return false;
  s.bounces++;
  const tx = (s.vel.x - into * nx) * p.bounceKeep;
  const ty = (s.vel.y - into * ny) * p.bounceKeep;
  const tz = (s.vel.z - into * nz) * p.bounceKeep;
  const up = -into * p.restitution;
  if (up < MIN_BOUNCE_SPEED) {
    s.vel.x = tx;
    s.vel.y = 0;
    s.vel.z = tz;
    s.rolling = true;
    if (Math.hypot(tx, tz) <= REST_SPEED) s.resting = true;
  } else {
    s.vel.x = tx + up * nx;
    s.vel.y = ty + up * ny;
    s.vel.z = tz + up * nz;
  }
  return true;
}

/**
 * Trayectoria de una pelota ya lanzada, hasta que toca el terreno por primera vez. Sirve para que la
 * línea de tiro se corte donde el tiro se corta de verdad: en la loma que tapa.
 */
export function previewOver(start: BallState, gravity: number, ground: Ground, points = 24, maxSeconds = 4): Vec3[] {
  const s: BallState = { pos: { ...start.pos }, vel: { ...start.vel }, rolling: false, resting: false, bounces: 0 };
  const path: Vec3[] = [{ ...s.pos }];
  const dt = 1 / 240;
  for (let t = 0; t < maxSeconds; t += dt) {
    s.pos.x += s.vel.x * dt;
    s.pos.z += s.vel.z * dt;
    s.pos.y += s.vel.y * dt - 0.5 * gravity * dt * dt;
    s.vel.y -= gravity * dt;
    const floor = ground(s.pos.x, s.pos.z) + BALL_RADIUS;
    if (s.pos.y <= floor) {
      path.push({ x: s.pos.x, y: floor, z: s.pos.z });
      break;
    }
    path.push({ ...s.pos });
  }
  // se remuestrea a una cantidad fija de puntos
  const out: Vec3[] = [];
  for (let i = 0; i <= points; i++) out.push(path[Math.round(((path.length - 1) * i) / points)]);
  return out;
}
