import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_KEYS, ABILITY_ORDER, GRENADE, grenadeShift, ICE, WIND } from './abilities';
import { CLUBS, KNOCK_DECAY } from './clubs';

describe('habilidades', () => {
  it('son tres, van en Q, W y E, y cada una tiene su recarga', () => {
    expect(ABILITY_ORDER).toEqual(['grenade', 'ice', 'wind']);
    expect(ABILITY_KEYS).toEqual(['Q', 'W', 'E']);
    for (const id of ABILITY_ORDER) {
      expect(ABILITIES[id].id).toBe(id);
      expect(ABILITIES[id].cooldown, id).toBeGreaterThan(0);
      expect(ABILITIES[id].range, id).toBeGreaterThan(0);
    }
    // cada una con su color, para distinguir las pelotas en el aire
    expect(new Set(ABILITY_ORDER.map((id) => ABILITIES[id].color)).size).toBe(ABILITY_ORDER.length);
  });

  it('el hielo deja una zona que dura, y al salir el frío se va enseguida', () => {
    expect(ICE.radius).toBeGreaterThan(0);
    expect(ICE.duration).toBeGreaterThan(ICE.linger);
    expect(ICE.linger).toBe(0.5);
    // frena, pero no congela
    expect(ICE.slow).toBeGreaterThan(0);
    expect(ICE.slow).toBeLessThan(1);
  });

  it('el vendaval llega como el driver y solo los junta', () => {
    expect(ABILITIES.wind.range).toBe(CLUBS.driver.fixedRange);
    // con el silencio encima quedaba demasiado fuerte: ahora eso es de la granada
    expect(Object.keys(WIND)).toEqual(['halfWidth']);
  });

  it('la granada silencia y deja vulnerables, con un centro que no se mueve', () => {
    expect(GRENADE.silence).toBeGreaterThan(0);
    expect(GRENADE.vulnerable).toBe(1);
    // el centro es un tercio: tirada encima de un grupo, los deja donde están
    expect(GRENADE.core).toBeCloseTo(1 / 3);
    // y la fuerza los saca del área, así las dos filas quedan afuera
    expect(GRENADE.push).toBeGreaterThan(GRENADE.radius);
  });

  it('la granada deja a todos a la misma distancia de la línea, cada uno de su lado', () => {
    const { push } = GRENADE;
    for (const lateral of [-3.5, -1, -0.2, 0.2, 1, 3.5]) {
      const end = lateral + grenadeShift(lateral, push);
      expect(Math.abs(end)).toBeCloseTo(push);
      // nadie se pasa al otro lado de la línea
      expect(Math.sign(end)).toBe(Math.sign(lateral));
    }
    // al que ya está más lejos que eso no lo mueve: ordena, no aleja
    expect(grenadeShift(push + 2, push)).toBe(0);
    expect(grenadeShift(-(push + 2), push)).toBe(0);
    // el empujón recorre velocidad / KNOCK_DECAY, así que termina justo donde tiene que terminar
    const shift = grenadeShift(1, push);
    expect((Math.abs(shift) * KNOCK_DECAY) / KNOCK_DECAY).toBeCloseTo(push - 1);
  });
});
