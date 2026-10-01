import { describe, expect, it } from 'vitest';
import { BALL_RADIUS, type BallState } from '../core/ballistics';
import { mirrorLanding, returnHeight, stepTennis, TENNIS, timingQuality } from './bounce';

function ball(x: number, z: number, vx: number, vz: number): BallState {
  return { pos: { x, y: BALL_RADIUS, z }, vel: { x: vx, y: 0, z: vz }, rolling: false, resting: false, bounces: 0 };
}

describe('dónde cae la vuelta', () => {
  it('de frente vuelve a donde saliste', () => {
    expect(mirrorLanding(3, 30, 0, 50, 9, 16)).toBeCloseTo(3);
  });

  it('cruzada sigue para el otro lado, en espejo', () => {
    // salió de x = 0 en la línea (z = 9) y le pegó en x = 4, z = 29: cae en x = 8
    expect(mirrorLanding(4, 29, 4, 20, 9, 16)).toBeCloseTo(8);
  });

  it('nunca se sale de la cancha', () => {
    expect(mirrorLanding(12, 29, 10, 20, 9, 16)).toBe(16);
    expect(mirrorLanding(-12, 29, -10, 20, 9, 16)).toBe(-16);
  });
});

describe('el globo de vuelta', () => {
  it('más alto cuanto más cerca rebotó', () => {
    expect(returnHeight(0)).toBeCloseTo(TENNIS.arcNear);
    expect(returnHeight(TENNIS.arcSpan)).toBeCloseTo(TENNIS.arcFar);
    expect(returnHeight(10)).toBeGreaterThan(returnHeight(30));
  });
});

describe('el timing del golpe', () => {
  it('justo es 3, cerca es 2, lejos es 1, antes o después', () => {
    expect(timingQuality(0)).toBe(3);
    expect(timingQuality(-TENNIS.perfect + 0.01)).toBe(3);
    expect(timingQuality(TENNIS.good - 0.01)).toBe(2);
    expect(timingQuality(-TENNIS.good + 0.01)).toBe(2);
    expect(timingQuality(TENNIS.good + 0.05)).toBe(1);
  });
});

describe('la pelota de ida', () => {
  it('la pared lateral le da vuelta la velocidad de costado', () => {
    const s = ball(17.5, 30, 10, 10);
    let wall = false;
    for (let i = 0; i < 10 && !wall; i++) wall = stepTennis(s, 0.02, 18);
    expect(wall).toBe(true);
    expect(s.vel.x).toBeLessThan(0);
    expect(s.vel.z).toBeGreaterThan(0);
  });

  it('pica siempre a la misma altura', () => {
    const s = ball(0, 10, 0, 50);
    let top = 0;
    for (let i = 0; i < 200; i++) {
      stepTennis(s, 0.01, 18);
      top = Math.max(top, s.pos.y);
    }
    expect(top).toBeGreaterThan(TENNIS.hop * 0.8);
    expect(top).toBeLessThan(TENNIS.hop + BALL_RADIUS + 0.1);
  });

  it('lo que conserva en la pared nunca pasa de 1', () => {
    const s = ball(17.8, 30, 10, 10);
    stepTennis(s, 0.02, 18, 1, 70);
    expect(Math.abs(s.vel.x)).toBeLessThanOrEqual(10);
  });
});
