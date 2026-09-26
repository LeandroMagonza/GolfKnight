import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_CONFIG, ABILITY_KEYS, ABILITY_LIST, configOf, cooldownAt, elementOf, ELEMENTS, GRENADE, grenadeShift, ICE, lv, MAX_LEVEL, SLOTS } from './abilities';
import { CLUBS, KNOCK_DECAY } from './clubs';

describe('habilidades', () => {
  it('van en cuatro lugares, Q, W, E y R', () => {
    expect(ABILITY_KEYS).toEqual(['Q', 'W', 'E', 'R']);
    expect(SLOTS).toBe(4);
  });

  it('todas tienen nombre, recarga y color, y hay una por cada palo con cada elemento', () => {
    for (const id of ABILITY_LIST) {
      const a = ABILITIES[id];
      expect(a.id).toBe(id);
      expect(a.name, id).not.toBe('');
      expect(a.cooldown, id).toBeGreaterThan(0);
    }
    for (const club of Object.keys(CLUBS)) {
      for (const element of ['ice', 'fire', 'lightning']) expect(ABILITIES[`${club}-${element}`]?.kind, `${club}-${element}`).toBe('shot');
    }
    expect(ABILITY_LIST.length).toBeGreaterThanOrEqual(20);
  });

  it('subir de nivel recarga más lento: subir no es gratis', () => {
    for (const id of ABILITY_LIST) {
      for (let level = 2; level <= MAX_LEVEL; level++) expect(cooldownAt(ABILITIES[id], level), id).toBeGreaterThan(cooldownAt(ABILITIES[id], level - 1));
    }
  });

  it('las tablas por nivel tienen un número por nivel, y ninguno baja al subir', () => {
    for (const [name, table] of Object.entries(ABILITY_CONFIG)) {
      for (const [key, value] of Object.entries(table)) {
        if (!Array.isArray(value)) continue;
        expect(value, `${name}.${key}`).toHaveLength(MAX_LEVEL);
        for (let i = 1; i < value.length; i++) expect(value[i], `${name}.${key}`).toBeGreaterThanOrEqual(value[i - 1]);
      }
    }
    expect(lv([1, 2, 3], 0)).toBe(1);
    expect(lv([1, 2, 3], 9)).toBe(3);
  });

  it('el hielo y los tiros de hielo cuentan como hielo para la maestría', () => {
    expect(elementOf('ice')).toBe('ice');
    expect(elementOf('driver-ice')).toBe('ice');
    expect(elementOf('wedge-fire')).toBe('fire');
    expect(elementOf('grenade')).toBeNull();
  });

  it('el rayo salta pocas veces: no puede dar vueltas matando a todo', () => {
    expect(ELEMENTS.chainJumps[0]).toBe(1);
    expect(Math.max(...ELEMENTS.chainJumps)).toBeLessThanOrEqual(3);
  });

  it('la zona de hielo frena y al salir se va enseguida', () => {
    expect(ICE.linger).toBe(0.5);
    expect(ICE.slow).toBeGreaterThan(0);
    expect(ICE.slow).toBeLessThan(1);
  });

  it('la granada deja a todos a la misma distancia de la línea, cada uno de su lado', () => {
    const push = GRENADE.push[0];
    for (const lateral of [-3.5, -1, -0.2, 0.2, 1, 3.5]) {
      const end = lateral + grenadeShift(lateral, push);
      expect(Math.abs(end)).toBeCloseTo(push);
      expect(Math.sign(end)).toBe(Math.sign(lateral));
    }
    // al que ya está más lejos no lo mueve: ordena, no aleja
    expect(grenadeShift(push + 2, push)).toBe(0);
    expect(grenadeShift(-(push + 2), push)).toBe(0);
    // y la fuerza los saca del área, así las dos filas quedan afuera
    for (let level = 1; level <= MAX_LEVEL; level++) expect(lv(GRENADE.push, level)).toBeGreaterThan(lv(GRENADE.radius, level));
    expect(GRENADE.core).toBeCloseTo(1 / 3);
    const shift = grenadeShift(1, push);
    expect((Math.abs(shift) * KNOCK_DECAY) / KNOCK_DECAY).toBeCloseTo(push - 1);
  });

  it('el panel encuentra los números de cada una, y todos existen en su tabla', () => {
    for (const id of ABILITY_LIST) {
      const c = configOf(id);
      if (ABILITIES[id].kind === 'rain') {
        expect(c).toBeNull();
        continue;
      }
      expect(c, id).not.toBeNull();
      expect(c!.keys.length).toBeGreaterThan(0);
      for (const k of c!.keys) expect(c!.table[k], `${id}.${k}`).toBeDefined();
    }
    // las de palo y elemento comparten la tabla del elemento, y cada una ve solo lo suyo
    expect(configOf('driver-fire')!.table).toBe(ELEMENTS);
    expect(configOf('driver-fire')!.keys).toContain('burnSeconds');
    expect(configOf('driver-fire')!.keys).not.toContain('chainJumps');
  });
});
