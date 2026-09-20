import { describe, expect, it } from 'vitest';
import { CLUB_ORDER, CLUBS, driverPowerFactor, ICE_CORE, ICE_RADIUS, iceSeconds, isLob, STREAK_MAX, streakBonus } from './clubs';
import { MIN_POWER } from './swing';
import { ENEMIES } from './waves';

describe('clubs', () => {
  it('solo el driver hace daño; el hierro y el wedge son globos', () => {
    for (const id of CLUB_ORDER) expect(CLUBS[id].damage > 0).toBe(id === 'driver');
    expect(isLob(CLUBS.driver)).toBe(false);
    expect(isLob(CLUBS.iron)).toBe(true);
    expect(isLob(CLUBS.wedge)).toBe(true);
  });

  it('el putter no está en la rueda: va en la barra espaciadora', () => {
    expect(CLUB_ORDER).not.toContain('putter');
  });

  it('la racha suma 10 % por escalón y se planta en el tope', () => {
    expect(streakBonus(0)).toBe(1);
    expect(streakBonus(3)).toBeCloseTo(1.3);
    expect(streakBonus(STREAK_MAX)).toBeCloseTo(1.5);
    expect(streakBonus(STREAK_MAX + 4)).toBeCloseTo(1.5);
  });

  it('un toque de driver mata justo a un goblin, y nada más grande', () => {
    const tap = Math.round(CLUBS.driver.damage * driverPowerFactor(MIN_POWER));
    expect(tap).toBeGreaterThanOrEqual(ENEMIES.goblin.hp);
    expect(tap).toBeLessThan(ENEMIES.kamikaze.hp);
  });

  it('con la racha al tope, un driver a fondo baja de un tiro a un esqueleto y a un guerrero', () => {
    const full = CLUBS.driver.damage * driverPowerFactor(0.9) * streakBonus(STREAK_MAX);
    expect(full).toBeLessThan(ENEMIES.skeleton.hp + 1);
    const maxed = CLUBS.driver.damage * driverPowerFactor(1) * streakBonus(STREAK_MAX);
    expect(maxed).toBeGreaterThanOrEqual(ENEMIES.skeleton.hp);
    expect(maxed).toBeGreaterThanOrEqual(ENEMIES.warrior.hp);
  });

  it('el hielo congela en un centro más chico que la zona fría, y el perfecto dura más', () => {
    expect(ICE_CORE).toBeLessThan(ICE_RADIUS / 2);
    expect(iceSeconds(0)).toBeCloseTo(3);
    expect(iceSeconds(1)).toBeCloseTo(5);
    expect(iceSeconds(1, true)).toBeGreaterThan(iceSeconds(1));
  });
});
