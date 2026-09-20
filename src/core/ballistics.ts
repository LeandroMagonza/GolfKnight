// Física de la pelota, sin dependencias: tiro parabólico, piques y rodado sobre piso plano (y = 0).

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
  /** Gravedad propia, si el palo vuela con otra que la normal (el wedge, para llegar rápido). */
  gravity?: number;
}

/** Velocidad de salida para volar `range` metros con ángulo `loftRad` sobre piso plano. */
export function launchSpeed(range: number, loftRad: number, gravity = GRAVITY): number {
  if (loftRad <= 0.001) return Math.sqrt(2 * ROLL_FRICTION * range);
  return Math.sqrt((range * gravity) / Math.sin(2 * loftRad));
}

/** Estado inicial de una pelota que sale desde `from` hacia `dirX, dirZ` (unitario en el plano). */
export function launch(from: Vec3, dirX: number, dirZ: number, range: number, loftRad: number, gravity = GRAVITY): BallState {
  const v = launchSpeed(range, loftRad, gravity);
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
export function stepBall(s: BallState, dt: number, p: BounceParams): boolean {
  if (s.resting) return false;
  if (s.rolling) {
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const next = speed - ROLL_FRICTION * dt;
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
