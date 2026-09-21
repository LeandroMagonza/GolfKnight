import { describe, expect, it } from 'vitest';
import { CHARGE_LEVELS, chargeLevel, CLUB_ORDER, CLUBS, CRIT_DAMAGE, HEIGHT_DEFAULT, HEIGHT_LEVELS, ICE_LEVELS, ICE_RADIUS, iceLevel, isLob, KNOCK_DECAY, LOFT_MAX, LOFT_MIN, loftFor, PUSH_HALF_WIDTHS, pushHalfWidth, TRAP_DAMAGE, trapDamage } from './clubs';
import { ROLL_FRICTION } from './ballistics';
import { MIN_POWER, PERFECT_FROM } from './swing';
import { ENEMIES } from './waves';

describe('clubs', () => {
  it('solo el driver hace daño; el hierro y el wedge son globos', () => {
    expect(CLUBS.putter.enchant).toBe('trap');
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
    expect(ICE_RADIUS).toBeGreaterThan(1);
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

  it('la altura del tiro va por escalones y no cambia el alcance, solo el loft', () => {
    expect(HEIGHT_LEVELS[HEIGHT_DEFAULT].delta).toBe(0);
    // cada escalón levanta más que el anterior, y el normal es el loft del palo
    for (let i = 1; i < HEIGHT_LEVELS.length; i++) expect(HEIGHT_LEVELS[i].delta).toBeGreaterThan(HEIGHT_LEVELS[i - 1].delta);
    expect(loftFor(CLUBS.driver, HEIGHT_DEFAULT)).toBe(CLUBS.driver.loftDeg);
    expect(loftFor(CLUBS.wedge, HEIGHT_DEFAULT)).toBe(CLUBS.wedge.loftDeg);
    // el driver rasante está en el piso del loft: no se puede aplastar más
    expect(loftFor(CLUBS.driver, 0)).toBe(LOFT_MIN);
    // bombeado, hasta el driver se levanta de verdad, pero nadie pasa del techo
    expect(loftFor(CLUBS.driver, 3)).toBeGreaterThan(25);
    expect(loftFor(CLUBS.wedge, 3)).toBeLessThanOrEqual(LOFT_MAX);
    // el putter nunca se levanta: rueda
    for (let i = 0; i < HEIGHT_LEVELS.length; i++) expect(loftFor(CLUBS.putter, i)).toBe(0);
  });

  it('el tótem del putter pega más cuanto mejor cargado sale el putt', () => {
    expect(TRAP_DAMAGE).toHaveLength(CHARGE_LEVELS + 1);
    for (let i = 1; i < TRAP_DAMAGE.length; i++) expect(TRAP_DAMAGE[i]).toBeGreaterThan(TRAP_DAMAGE[i - 1]);
    expect(trapDamage(0)).toBe(2);
    expect(trapDamage(0.5)).toBe(3);
    expect(trapDamage(0.8)).toBe(4);
    expect(trapDamage(1, true)).toBe(10);
    // el putter rueda lento: menos fricción que el pasto normal
    expect(CLUBS.putter.rollFriction).toBeLessThan(ROLL_FRICTION);
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
