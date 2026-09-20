import { describe, expect, it } from 'vitest';
import { MIN_POWER, REBOUND_FLOOR, SwingMeter } from './swing';

describe('SwingMeter', () => {
  it('sube hasta 1 y después rebota entre 1 y el piso, sin volver al principio', () => {
    const m = new SwingMeter();
    m.start(1);
    m.update(0.5);
    expect(m.power).toBeCloseTo(0.5);
    m.update(0.5);
    expect(m.power).toBeCloseTo(1);
    m.update(0.2);
    expect(m.power).toBeCloseTo(0.8);
    m.update(0.8 - REBOUND_FLOOR);
    expect(m.power).toBeCloseTo(REBOUND_FLOOR);
    m.update(0.2);
    expect(m.power).toBeCloseTo(REBOUND_FLOOR + 0.2);
    m.update(1 - REBOUND_FLOOR - 0.2);
    expect(m.power).toBeCloseTo(1);
    for (let i = 0; i < 200; i++) {
      m.update(0.037);
      expect(m.power).toBeGreaterThanOrEqual(REBOUND_FLOOR - 1e-9);
      expect(m.power).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('el alcance llega al máximo y se queda, aunque la potencia siga rebotando', () => {
    const m = new SwingMeter();
    m.start(1);
    m.update(0.4);
    expect(m.reach).toBeCloseTo(0.4);
    m.update(0.8);
    expect(m.power).toBeCloseTo(0.8);
    expect(m.reach).toBe(1);
    const r = m.release();
    expect(r.reach).toBe(1);
    expect(r.power).toBeCloseTo(0.8);
    expect(r.perfect).toBe(false);
  });

  it('soltar cerca del tope es perfecto', () => {
    const m = new SwingMeter();
    m.start(0.8);
    m.update(0.78);
    const r = m.release();
    expect(r.perfect).toBe(true);
    expect(m.charging).toBe(false);
  });

  it('un click corto sale con la potencia mínima', () => {
    const m = new SwingMeter();
    m.start(1);
    m.update(0.01);
    const r = m.release();
    expect(r.power).toBe(MIN_POWER);
    expect(r.perfect).toBe(false);
  });
});
