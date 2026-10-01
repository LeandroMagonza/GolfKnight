import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_CONFIG, ABILITY_KEYS, ABILITY_LIST, configOf, cooldownAt, elementOf, ELEMENTS, ICE, lv, MAX_LEVEL, SLOTS } from './abilities';
import { CLUBS } from './clubs';

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
      for (const element of ['ice', 'fire', 'lightning', 'ghost', 'silence']) expect(ABILITIES[`${club}-${element}`]?.kind, `${club}-${element}`).toBe('shot');
    }
    // el fantasma del driver dice que además atraviesa lomas
    expect(ABILITIES['driver-ghost'].hint).toContain('lomas');
    expect(ABILITIES['iron-ghost'].hint).not.toContain('lomas');
    // el viento, en tres palos: con el putter no tiene sentido
    for (const club of ['driver', 'iron', 'wedge']) expect(ABILITIES[`${club}-wind`]?.element, club).toBe('wind');
    expect(ABILITIES['putter-wind']).toBeUndefined();
    expect(ABILITIES.wind).toBeUndefined();
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
    expect(elementOf('cart')).toBeNull();
    // la granada se fue: el silencio en área es el wedge silenciador
    expect(ABILITIES.grenade).toBeUndefined();
    expect(ABILITIES['wedge-silence']?.element).toBe('silence');
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
    expect(configOf('driver-fire')!.keys).toContain('burnTicks');
    expect(configOf('driver-fire')!.keys).not.toContain('chainJumps');
  });
});
