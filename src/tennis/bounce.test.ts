import { describe, expect, it } from 'vitest';
import { BALL_RADIUS, type BallState } from '../core/ballistics';
import { bounceOffEnemy, crossingX, stepTennis, TENNIS } from './bounce';

function ball(x: number, z: number, vx: number, vz: number): BallState {
  return { pos: { x, y: BALL_RADIUS, z }, vel: { x: vx, y: 0, z: vz }, rolling: false, resting: false, bounces: 0 };
}

describe('rebote contra un enemigo', () => {
  it('de frente vuelve recta', () => {
    const v = bounceOffEnemy(0, 25, 13);
    expect(v.vx).toBeCloseTo(0);
    expect(v.vz).toBeCloseTo(-13);
  });

  it('en diagonal sale espejada, para el otro lado', () => {
    const v = bounceOffEnemy(10, 20, 13);
    expect(v.vx).toBeGreaterThan(0);
    expect(v.vz).toBeLessThan(0);
    // mismo ángulo que traía, dado vuelta
    expect(v.vx / -v.vz).toBeCloseTo(10 / 20);
    expect(Math.hypot(v.vx, v.vz)).toBeCloseTo(13);
  });

  it('nunca sale más cruzada que el mínimo hacia el jugador', () => {
    const v = bounceOffEnemy(-30, 2, 13);
    expect(-v.vz / 13).toBeCloseTo(TENNIS.minBack);
    expect(v.vx).toBeLessThan(0);
  });
});

describe('la pelota en la cancha', () => {
  it('la pared lateral le da vuelta la velocidad de costado', () => {
    const s = ball(17.5, 30, 10, -10);
    let wall = false;
    for (let i = 0; i < 10 && !wall; i++) wall = stepTennis(s, 0.02, 18);
    expect(wall).toBe(true);
    expect(s.vel.x).toBeLessThan(0);
    expect(s.vel.z).toBeLessThan(0);
    expect(s.pos.x).toBeLessThanOrEqual(18);
  });

  it('pica siempre a la misma altura mientras va rápida', () => {
    const s = ball(0, 30, 0, -13);
    let top = 0;
    for (let i = 0; i < 200; i++) {
      stepTennis(s, 0.01, 18);
      top = Math.max(top, s.pos.y);
    }
    expect(top).toBeGreaterThan(TENNIS.hop * 0.8);
    expect(top).toBeLessThan(TENNIS.hop + BALL_RADIUS + 0.1);
  });

  it('con fricción termina quieta', () => {
    const s = ball(0, 8, 0, -8);
    for (let i = 0; i < 400 && !s.resting; i++) stepTennis(s, 0.01, 18, TENNIS.backFriction);
    expect(s.resting).toBe(true);
    expect(s.vel.z).toBe(0);
  });
});

describe('dónde cruza la línea', () => {
  it('derecho, donde apunta', () => {
    expect(crossingX(3, 40, 0, -13, 9, 18)).toBeCloseTo(3);
  });

  it('en diagonal sin tocar paredes', () => {
    expect(crossingX(0, 29, 5, -10, 9, 18)).toBeCloseTo(10);
  });

  it('rebotando en la pared', () => {
    // sin pared llegaría a x = 20; la pared (a 17.88) la devuelve 2.12 m
    const edge = 18 - BALL_RADIUS;
    expect(crossingX(0, 29, 10, -10, 9, 18)).toBeCloseTo(edge - (20 - edge));
  });

  it('coincide con la simulación', () => {
    const s = ball(-5, 45, -9, -11);
    for (let i = 0; i < 2000 && s.pos.z > 9; i++) stepTennis(s, 0.002, 18);
    expect(s.pos.x).toBeCloseTo(crossingX(-5, 45, -9, -11, 9, 18)!, 1);
  });

  it('si no viene para la línea, no hay cruce', () => {
    expect(crossingX(0, 30, 0, 10, 9, 18)).toBeNull();
  });
});
