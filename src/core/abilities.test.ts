import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_CONFIG, ABILITY_KEYS, ABILITY_LIST, chilledSpeed, configOf, cooldownAt, effectOnly, elementOf, ELEMENTS, freezeFrom, hintAt, lv, MAX_LEVEL, shotQuality, SLOTS } from './abilities';
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

  it('subir de nivel no alarga la recarga, salvo el palazo (que con poca recarga frenaría la oleada sin fin)', () => {
    for (const id of ABILITY_LIST) {
      for (let level = 2; level <= MAX_LEVEL; level++) {
        const now = cooldownAt(ABILITIES[id], level);
        const before = cooldownAt(ABILITIES[id], level - 1);
        if (ABILITIES[id].kind === 'melee') expect(now, id).toBeGreaterThan(before);
        else expect(now, id).toBe(before);
      }
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
    // la zona de hielo sola se fue (4/10): el hielo son los tiros de palo
    expect(ABILITIES.ice).toBeUndefined();
    expect(elementOf('driver-ice')).toBe('ice');
    expect(elementOf('wedge-fire')).toBe('fire');
    expect(elementOf('cart')).toBeNull();
    // la granada se fue: el silencio en área es el wedge silenciador
    expect(ABILITIES.grenade).toBeUndefined();
    expect(ABILITIES['wedge-silence']?.element).toBe('silence');
  });

  it('el rayo salta pocas veces por rama: no puede dar vueltas matando a todo', () => {
    // sin daño de la pelota, salta una vez más que cuando pegaba (1/10): 2, 3 y 4 por rama
    expect(ELEMENTS.chainJumps[0]).toBe(2);
    expect(Math.max(...ELEMENTS.chainJumps)).toBeLessThanOrEqual(4);
  });

  it('el palo pega y la habilidad pone el efecto: los tiros de elemento no pegan, menos el fantasma', () => {
    for (const element of ['ice', 'fire', 'lightning', 'wind', 'silence'] as const) expect(effectOnly(element), element).toBe(true);
    expect(effectOnly('ghost')).toBe(false);
    expect(effectOnly(null)).toBe(false);
    expect(ABILITIES['wedge-wind'].hint).toBe('Un disparo de wedge instantáneo que atrae a los enemigos');
  });

  it('la carta de cada nivel dice lo de ese nivel, sin anunciar los de después', () => {
    expect(hintAt(ABILITIES.boost, 1)).toBe('Tu próximo tiro pega 1 más');
    expect(hintAt(ABILITIES.boost, 2)).toBe('Tu próximo tiro pega 2 más');
    expect(hintAt(ABILITIES.echo, 1)).toBe('Tu próximo tiro se repite');
    expect(hintAt(ABILITIES.echo, 3)).toBe('Tu próximo tiro se repite 3 veces');
    expect(hintAt(ABILITIES['wedge-ice'], 1)).not.toContain('congela');
    expect(hintAt(ABILITIES['wedge-ice'], ELEMENTS.iceFreezeFrom)).toContain('enfría y congela');
    // el fantasma pasa todo desde el nivel 1: la carta lo dice igual en todos
    expect(hintAt(ABILITIES['iron-ghost'], 1)).toBe('Un disparo de hierro instantáneo que atraviesa escudos, blindaje, fantasmas e inmunes');
    expect(hintAt(ABILITIES['iron-ghost'], 3)).toBe(hintAt(ABILITIES['iron-ghost'], 1));
  });

  it('los tiros del wedge saltean la pifia: dos niveles, con el golpe 2 y el 3', () => {
    expect(shotQuality('wedge', 1)).toBe(2);
    expect(shotQuality('wedge', 2)).toBe(3);
    expect(shotQuality('driver', 1)).toBe(1);
    expect(shotQuality('putter', 3)).toBe(3);
    // el hielo del wedge congela en su último nivel
    expect(freezeFrom('wedge')).toBe(2);
    expect(freezeFrom('iron')).toBe(ELEMENTS.iceFreezeFrom);
  });

  it('el frío frena mucho a los rápidos y poco a los lentos, y a todos algo', () => {
    expect(ELEMENTS.chillSlow).toBeGreaterThan(0);
    expect(ELEMENTS.chillSlow).toBeLessThan(1);
    // el goblin va a 3.6 y el caballero a 1.5
    expect(chilledSpeed(3.6)).toBeCloseTo(3.6 * ELEMENTS.chillSlow);
    expect(chilledSpeed(1.5)).toBe(ELEMENTS.chillFloor);
    expect(chilledSpeed(1.1)).toBeCloseTo(1.1 * ELEMENTS.chillLeast);
    expect(chilledSpeed(3.6) / 3.6).toBeLessThan(chilledSpeed(1.5) / 1.5);
  });

  it('el panel encuentra los números de cada una, y todos existen en su tabla', () => {
    for (const id of ABILITY_LIST) {
      const c = configOf(id);
      if (ABILITIES[id].kind === 'rain') {
        expect(c).toBeNull();
        continue;
      }
      // el fantasma no tiene números propios: pasa todo
      if (ABILITIES[id].element === 'ghost') {
        expect(c!.keys).toEqual([]);
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
