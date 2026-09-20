import { describe, expect, it } from 'vitest';
import { CHARGE_LEVELS, chargeLevel, CLUBS, CRIT_DAMAGE } from './clubs';
import { MIN_POWER, PERFECT_FROM, REBOUND_SPEED, RISE_CURVE, SwingMeter } from './swing';

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

  it('después del tope rebota rápido por todo el rango: baja hasta 0 y vuelve a subir', () => {
    const m = new SwingMeter();
    m.start(1);
    m.update(1);
    m.update(1 / REBOUND_SPEED);
    expect(m.power).toBeCloseTo(0);
    m.update(0.5 / REBOUND_SPEED);
    expect(m.power).toBeCloseTo(0.5);
    m.update(0.5 / REBOUND_SPEED);
    expect(m.power).toBeCloseTo(1);
    let low = 1;
    for (let i = 0; i < 300; i++) {
      m.update(0.013);
      low = Math.min(low, m.power);
      expect(m.power).toBeGreaterThanOrEqual(-1e-9);
      expect(m.power).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(low).toBeLessThan(0.05);
  });

  it('en el rebote, la ventana del swing perfecto dura menos de una décima de segundo', () => {
    const chargeTime = 1;
    const window = (2 * (1 - PERFECT_FROM) * chargeTime) / REBOUND_SPEED;
    expect(window).toBeLessThan(0.1);
  });

  it('daño por segundo: el crítico es lo que más rinde, después la carga completa, y spamear toques lo que menos', () => {
    // Cada tiro cuesta el tiempo de carga más un fijo (bajar el palo, recuperarse, correr al otro puesto).
    const driverCharge = CLUBS.driver.chargeTime;
    const timeToPower = (p: number) => Math.pow(p, 1 / RISE_CURVE) * driverCharge;
    const dpsAt = (fixed: number) => {
      const levels: number[] = [];
      for (let level = 1; level <= CHARGE_LEVELS; level++) {
        expect(chargeLevel(Math.max(MIN_POWER, (level - 1) / CHARGE_LEVELS))).toBe(level);
        levels.push(level / (fixed + (level === 1 ? 0 : timeToPower((level - 1) / CHARGE_LEVELS))));
      }
      return { levels, crit: CRIT_DAMAGE / (fixed + timeToPower(PERFECT_FROM)) };
    };
    // Con un fijo realista cada nivel rinde más que el anterior.
    for (const fixed of [0.7, 0.9]) {
      const { levels, crit } = dpsAt(fixed);
      for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
      expect(crit).toBeGreaterThan(levels[levels.length - 1]);
    }
    // Aun siendo optimista con el fijo, el orden que importa se mantiene: crítico, carga completa, toque.
    const fast = dpsAt(0.5);
    expect(fast.crit).toBeGreaterThan(fast.levels[CHARGE_LEVELS - 1]);
    expect(fast.levels[CHARGE_LEVELS - 1]).toBeGreaterThan(fast.levels[0]);
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
