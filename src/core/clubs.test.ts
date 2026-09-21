import { describe, expect, it } from 'vitest';
import { CHARGE_LEVELS, chargeLevel, CLUB_ORDER, CLUBS, CRIT_DAMAGE, ICE_CORE, ICE_LEVELS, ICE_RADIUS, iceLevel, isLob, KNOCK_DECAY, PUSH_HALF_WIDTHS, pushHalfWidth } from './clubs';
import { MIN_POWER, PERFECT_FROM } from './swing';
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

  it('la carga va por niveles: 1 sin cargar y 3 al tope, un tercio de barra cada uno', () => {
    expect(CHARGE_LEVELS).toBe(3);
    expect(chargeLevel(0)).toBe(1);
    expect(chargeLevel(MIN_POWER)).toBe(1);
    expect(chargeLevel(0.32)).toBe(1);
    expect(chargeLevel(1 / 3)).toBe(2);
    expect(chargeLevel(0.66)).toBe(2);
    expect(chargeLevel(2 / 3)).toBe(3);
    expect(chargeLevel(1)).toBe(3);
    expect(chargeLevel(PERFECT_FROM)).toBe(3);
  });

  it('la vida de los enemigos está en la escala del daño: el crítico baja a todos menos al caballero y al jefe', () => {
    expect(ENEMIES.goblin.hp).toBe(2);
    expect(ENEMIES.skeleton.hp).toBe(4);
    expect(ENEMIES.knight.hp).toBe(10);
    expect(CRIT_DAMAGE).toBe(8);
    for (const e of Object.values(ENEMIES)) if (!e.boss && e.kind !== 'knight') expect(e.hp).toBeLessThanOrEqual(CRIT_DAMAGE);
    // el caballero aguanta un crítico, pero no dos
    expect(ENEMIES.knight.hp).toBeGreaterThan(CRIT_DAMAGE);
    expect(ENEMIES.knight.hp).toBeLessThanOrEqual(CRIT_DAMAGE * 2);
    // sin crítico, un esqueleto no cae de un tiro: hacer daño dejó de ser fácil
    expect(ENEMIES.skeleton.hp).toBeGreaterThan(CHARGE_LEVELS);
  });

  it('el hierro carga igual que el driver, y cada escalón de hielo es mejor que el anterior', () => {
    expect(CLUBS.iron.chargeTime).toBe(CLUBS.driver.chargeTime);
    expect(ICE_CORE).toBeLessThan(ICE_RADIUS / 2);
    expect(ICE_LEVELS).toHaveLength(CHARGE_LEVELS + 1);
    expect(iceLevel(0)).toEqual({ area: 1, seconds: 3 });
    for (let i = 1; i < ICE_LEVELS.length; i++) {
      expect(ICE_LEVELS[i].area).toBeGreaterThan(ICE_LEVELS[i - 1].area);
      expect(ICE_LEVELS[i].seconds).toBeGreaterThan(ICE_LEVELS[i - 1].seconds);
    }
    expect(iceLevel(0.5)).toBe(ICE_LEVELS[1]);
    expect(iceLevel(0.8)).toBe(ICE_LEVELS[2]);
    expect(iceLevel(1, true)).toBe(ICE_LEVELS[3]);
  });

  it('el wedge barre más ancho con cada escalón, y deja a todos los de un lado en la misma columna', () => {
    for (let i = 1; i < PUSH_HALF_WIDTHS.length; i++) expect(PUSH_HALF_WIDTHS[i]).toBeGreaterThan(PUSH_HALF_WIDTHS[i - 1]);
    expect(pushHalfWidth(0)).toBe(PUSH_HALF_WIDTHS[0]);
    expect(pushHalfWidth(1, true)).toBe(PUSH_HALF_WIDTHS[3]);
    // velocidad (ancho - distancia) * KNOCK_DECAY, que se apaga con exp(-KNOCK_DECAY t): recorre ancho - distancia
    const half = pushHalfWidth(0.8);
    for (const dx of [0.5, 2, 4.5]) expect(dx + ((half - dx) * KNOCK_DECAY) / KNOCK_DECAY).toBeCloseTo(half);
  });
});
