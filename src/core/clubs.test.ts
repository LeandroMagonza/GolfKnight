import { describe, expect, it } from 'vitest';
import { CHARGE_LEVELS, chargeLevel, CLUB_ORDER, CLUBS, ICE_CORE, ICE_RADIUS, iceSeconds, isLob, STREAK_MAX, streakBonus } from './clubs';
import { MIN_POWER, PERFECT_FROM, REBOUND_FLOOR } from './swing';
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

  it('la carga va por niveles: 1 sin cargar, 5 al tope, y el rebote queda entre 3 y 5', () => {
    expect(chargeLevel(0)).toBe(1);
    expect(chargeLevel(MIN_POWER)).toBe(1);
    expect(chargeLevel(0.2)).toBe(2);
    expect(chargeLevel(0.59)).toBe(3);
    expect(chargeLevel(0.8)).toBe(5);
    expect(chargeLevel(1)).toBe(CHARGE_LEVELS);
    expect(chargeLevel(REBOUND_FLOOR)).toBe(3);
    expect(chargeLevel(PERFECT_FROM)).toBe(CHARGE_LEVELS);
  });

  it('la vida de los enemigos está en la escala de la carga', () => {
    expect(ENEMIES.goblin.hp).toBe(2);
    expect(ENEMIES.skeleton.hp).toBe(4);
    expect(ENEMIES.knight.hp).toBe(5);
    for (const e of Object.values(ENEMIES)) if (!e.boss) expect(e.hp).toBeLessThanOrEqual(CHARGE_LEVELS);
  });

  it('el hielo congela en un centro más chico que la zona fría, y el perfecto dura más', () => {
    expect(ICE_CORE).toBeLessThan(ICE_RADIUS / 2);
    expect(iceSeconds(0)).toBeCloseTo(3);
    expect(iceSeconds(1)).toBeCloseTo(5);
    expect(iceSeconds(1, true)).toBeGreaterThan(iceSeconds(1));
  });
});
