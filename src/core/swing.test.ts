import { describe, expect, it } from 'vitest';
import { CHARGE_LEVELS, chargeLevel, CLUBS } from './clubs';
import { MIN_POWER, PERFECT_BONUS, PERFECT_FROM, REBOUND_FLOOR, REBOUND_SPEED, RISE_CURVE, SwingMeter } from './swing';

describe('SwingMeter', () => {
  it('sube lento al principio y rápido al final', () => {
    const m = new SwingMeter();
    m.start(1);
    m.update(0.5);
    // a mitad del tiempo va por un cuarto de la barra
    expect(m.power).toBeCloseTo(0.25);
    const early = m.power;
    m.update(0.25);
    const mid = m.power;
    m.update(0.25);
    expect(m.power).toBeCloseTo(1);
    // el último cuarto del tiempo sube más que la primera mitad entera
    expect(1 - mid).toBeGreaterThan(early);
  });

  it('después del tope rebota rápido entre 1 y el piso, sin volver al principio', () => {
    const m = new SwingMeter();
    m.start(1);
    m.update(1);
    const span = 1 - REBOUND_FLOOR;
    m.update(span / REBOUND_SPEED);
    expect(m.power).toBeCloseTo(REBOUND_FLOOR);
    m.update(span / REBOUND_SPEED);
    expect(m.power).toBeCloseTo(1);
    for (let i = 0; i < 300; i++) {
      m.update(0.013);
      expect(m.power).toBeGreaterThanOrEqual(REBOUND_FLOOR - 1e-9);
      expect(m.power).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('en el rebote, la ventana del swing perfecto dura menos de una décima de segundo', () => {
    const chargeTime = 1;
    const window = (2 * (1 - PERFECT_FROM) * chargeTime) / REBOUND_SPEED;
    expect(window).toBeLessThan(0.1);
  });

  it('el daño por segundo crece con la carga: spamear toques es lo peor y el perfecto es lo mejor', () => {
    // Cada tiro cuesta el tiempo de carga más un fijo (bajar el palo, recuperarse, correr al otro puesto).
    // Se prueba con un fijo optimista de medio segundo y con uno realista: en los dos casos cada nivel
    // tiene que rendir más que el anterior, para que contra enemigos grandes convenga cargar.
    const driverCharge = CLUBS.driver.chargeTime;
    const timeToPower = (p: number) => Math.pow(p, 1 / RISE_CURVE) * driverCharge;
    for (const fixed of [0.5, 0.8]) {
      const dps: number[] = [];
      for (let level = 1; level <= CHARGE_LEVELS; level++) {
        const t = level === 1 ? 0 : timeToPower((level - 1) / CHARGE_LEVELS);
        expect(chargeLevel(Math.max(MIN_POWER, (level - 1) / CHARGE_LEVELS))).toBe(level);
        dps.push(level / (fixed + t));
      }
      for (let i = 1; i < dps.length; i++) expect(dps[i]).toBeGreaterThan(dps[i - 1]);
      const perfect = (CHARGE_LEVELS * PERFECT_BONUS) / (fixed + timeToPower(PERFECT_FROM));
      expect(perfect).toBeGreaterThan(dps[dps.length - 1]);
    }
  });

  it('el alcance llega al máximo y se queda, aunque la potencia siga rebotando', () => {
    const m = new SwingMeter();
    m.start(1);
    m.update(0.5);
    expect(m.reach).toBeCloseTo(0.25);
    m.update(0.5 + 0.1);
    expect(m.power).toBeLessThan(0.9);
    expect(m.reach).toBe(1);
    const r = m.release();
    expect(r.reach).toBe(1);
    expect(r.perfect).toBe(false);
  });

  it('setPower deja el medidor en esa potencia', () => {
    const m = new SwingMeter();
    m.start(0.8);
    for (const p of [0.1, 0.42, 0.95]) {
      m.setPower(p);
      expect(m.power).toBeCloseTo(p);
    }
  });

  it('soltar cerca del tope es perfecto', () => {
    const m = new SwingMeter();
    m.start(0.8);
    m.setPower(0.96);
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
