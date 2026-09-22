import { describe, expect, it } from 'vitest';
import { BALL_RADIUS, launch, launchSpeed, previewPath, stepBall, type BallState } from './ballistics';
import { CLUBS, rangeFor } from './clubs';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Simula hasta el primer contacto con el piso y devuelve la distancia recorrida. */
function flyUntilLanding(s: BallState): number {
  const p = { restitution: 0.4, bounceKeep: 0.7 };
  for (let i = 0; i < 5000; i++) if (stepBall(s, 1 / 240, p)) break;
  return Math.hypot(s.pos.x, s.pos.z);
}

describe('ballistics', () => {
  it('la pelota cae a la distancia pedida, para cualquier loft', () => {
    for (const loft of [8, 30, 58]) {
      for (const range of [10, 35, 60]) {
        const s = launch({ x: 0, y: 0, z: 0 }, 0, 1, range, rad(loft));
        expect(flyUntilLanding(s)).toBeCloseTo(range, 0);
      }
    }
  });

  it('el putter rueda la distancia pedida y frena', () => {
    const s = launch({ x: 0, y: 0, z: 0 }, 1, 0, 12, 0);
    expect(s.rolling).toBe(true);
    for (let i = 0; i < 5000 && !s.resting; i++) stepBall(s, 1 / 120, { restitution: 0, bounceKeep: 1 });
    expect(s.resting).toBe(true);
    expect(s.pos.x).toBeGreaterThan(11);
    expect(s.pos.x).toBeLessThan(12.3);
    expect(s.pos.y).toBe(BALL_RADIUS);
  });

  it('el driver vuela rasante: nunca pasa la altura de un lobizón', () => {
    const club = CLUBS.driver;
    const s = launch({ x: 0, y: 0, z: 0 }, 0, 1, rangeFor(club, 1), rad(club.loftDeg));
    let top = 0;
    for (let i = 0; i < 5000; i++) {
      top = Math.max(top, s.pos.y);
      // la fricción del rodado es por nivel de golpe, así que el paso recibe los parámetros ya resueltos
      if (stepBall(s, 1 / 240, { restitution: club.restitution, bounceKeep: club.bounceKeep, gravity: club.gravity })) break;
    }
    expect(top).toBeLessThan(2.2);
  });

  it('pica, pierde energía y termina quieta', () => {
    const s = launch({ x: 0, y: 0, z: 0 }, 0, 1, 20, rad(30));
    for (let i = 0; i < 20000 && !s.resting; i++) stepBall(s, 1 / 120, { restitution: 0.45, bounceKeep: 0.65 });
    expect(s.resting).toBe(true);
    expect(s.bounces).toBeGreaterThan(1);
    expect(s.pos.z).toBeGreaterThan(20);
  });

  it('la vista previa termina donde cae la pelota', () => {
    const path = previewPath({ x: 1, y: 0, z: 2 }, 0, 1, 25, rad(58));
    const last = path[path.length - 1];
    expect(last.z - 2).toBeCloseTo(25, 0);
    expect(last.y).toBeCloseTo(BALL_RADIUS, 1);
    expect(Math.max(...path.map((p) => p.y))).toBeGreaterThan(8);
  });

  it('launchSpeed crece con el alcance', () => {
    expect(launchSpeed(40, rad(30))).toBeGreaterThan(launchSpeed(20, rad(30)));
  });
});
