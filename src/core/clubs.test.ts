import { describe, expect, it } from 'vitest';
import { ROLL_FRICTION } from './ballistics';
import {
  bandOf, BAND_LIMITS, CLUB_ORDER, CLUBS, damageFor, ENCHANT_ORDER, ENCHANTS, ICE_SECONDS, isLob,
  KNOCK_DECAY, PUSH_LINE_HALF_WIDTH, QUALITY_AREA, QUALITY_FROM, QUALITY_LEVELS, qualityOf,
} from './clubs';
import { MIN_POWER, PERFECT_FROM } from './swing';
import { ENEMIES } from './waves';

describe('palos', () => {
  it('los cuatro palos están en la rueda de Q y E', () => {
    expect(CLUB_ORDER).toHaveLength(4);
    for (const id of CLUB_ORDER) expect(CLUBS[id].id).toBe(id);
  });

  it('el driver es el único lineal: los demás caen en un punto y abren un área', () => {
    expect(CLUBS.driver.spread).toBe(0);
    expect(isLob(CLUBS.driver)).toBe(false);
    for (const id of ['iron', 'wedge', 'putter'] as const) expect(CLUBS[id].spread).toBeGreaterThan(0);
    // cuanto más alto vuela, más abre
    expect(CLUBS.wedge.spread).toBeGreaterThan(CLUBS.iron.spread);
    expect(CLUBS.wedge.loftDeg).toBeGreaterThan(CLUBS.iron.loftDeg);
    // el putter rueda: no es un globo, aunque abra un área chica donde para
    expect(CLUBS.putter.loftDeg).toBe(0);
    expect(isLob(CLUBS.putter)).toBe(false);
    expect(CLUBS.putter.rollFriction).toBeLessThan(ROLL_FRICTION);
  });

  it('cada palo cobra mejor a su distancia, y ninguno es el mejor siempre', () => {
    const [corta, media, larga] = [10, 30, 50];
    // el driver crece con la distancia y el putter al revés
    expect(damageFor(CLUBS.driver, larga, 3)).toBeGreaterThan(damageFor(CLUBS.driver, media, 3));
    expect(damageFor(CLUBS.driver, media, 3)).toBeGreaterThan(damageFor(CLUBS.driver, corta, 3));
    expect(damageFor(CLUBS.putter, corta, 3)).toBeGreaterThan(damageFor(CLUBS.putter, media, 3));
    expect(damageFor(CLUBS.putter, media, 3)).toBeGreaterThan(damageFor(CLUBS.putter, larga, 3));
    // el hierro y el wedge pegan lo mismo a cualquier distancia
    for (const id of ['iron', 'wedge'] as const) {
      const flat = damageFor(CLUBS[id], corta, 3);
      expect(damageFor(CLUBS[id], media, 3)).toBe(flat);
      expect(damageFor(CLUBS[id], larga, 3)).toBe(flat);
    }
    // a cada distancia hay un palo que conviene más que los otros
    expect(damageFor(CLUBS.putter, corta, 3)).toBeGreaterThan(damageFor(CLUBS.driver, corta, 3));
    expect(damageFor(CLUBS.driver, larga, 3)).toBeGreaterThan(damageFor(CLUBS.putter, larga, 3));
  });

  it('pegarle mejor siempre pega más, con cualquier palo y a cualquier distancia', () => {
    for (const id of CLUB_ORDER) {
      for (const meters of [5, 25, 60]) {
        for (let q = 2; q <= QUALITY_LEVELS; q++) {
          expect(damageFor(CLUBS[id], meters, q)).toBeGreaterThan(damageFor(CLUBS[id], meters, q - 1));
        }
      }
    }
  });

  it('las bandas de distancia van en metros del campo, no en fracciones del palo', () => {
    expect(bandOf(BAND_LIMITS[0] - 1)).toBe(0);
    expect(bandOf(BAND_LIMITS[0] + 1)).toBe(1);
    expect(bandOf(BAND_LIMITS[1] + 1)).toBe(2);
    // el driver llega a la banda larga y el putter no sale de la corta
    expect(bandOf(CLUBS.driver.maxRange)).toBe(2);
    expect(bandOf(CLUBS.putter.maxRange)).toBe(1);
    expect(CLUBS.putter.maxRange).toBeLessThan(CLUBS.iron.maxRange);
  });

  it('la vida de los enemigos está en la escala del daño', () => {
    const mejor = Math.max(...CLUB_ORDER.map((id) => damageFor(CLUBS[id], 50, QUALITY_LEVELS)));
    // todos caen de un golpe perfecto salvo el caballero (la armadura grande) y el jefe
    for (const e of Object.values(ENEMIES)) if (!e.boss && e.kind !== 'knight') expect(e.hp).toBeLessThanOrEqual(mejor);
    // un goblin cae de un golpe bueno; el caballero pide más que el mejor golpe de un tiro
    expect(ENEMIES.goblin.hp).toBeLessThanOrEqual(damageFor(CLUBS.iron, 30, 2));
    expect(ENEMIES.knight.hp).toBeGreaterThan(mejor);
  });
});

describe('calidad del golpe', () => {
  it('son tres niveles de puro timing, sin nada que ver con la distancia', () => {
    expect(QUALITY_LEVELS).toBe(3);
    expect(qualityOf(0)).toBe(1);
    expect(qualityOf(MIN_POWER)).toBe(1);
    expect(qualityOf(QUALITY_FROM[1] - 0.01)).toBe(1);
    expect(qualityOf(QUALITY_FROM[1])).toBe(2);
    expect(qualityOf(0.9)).toBe(2);
    expect(qualityOf(QUALITY_FROM[2])).toBe(3);
    expect(qualityOf(1)).toBe(3);
  });

  it('el nivel más alto es el del swing perfecto, y es una ventana angosta', () => {
    expect(QUALITY_FROM[QUALITY_LEVELS - 1]).toBe(PERFECT_FROM);
    expect(1 - PERFECT_FROM).toBeLessThan(0.1);
  });

  it('pegarle mejor también agranda el efecto', () => {
    expect(QUALITY_AREA).toHaveLength(QUALITY_LEVELS);
    for (let i = 1; i < QUALITY_AREA.length; i++) expect(QUALITY_AREA[i]).toBeGreaterThan(QUALITY_AREA[i - 1]);
    expect(QUALITY_AREA[0]).toBe(1);
  });
});

describe('encantamientos', () => {
  it('son tres, se eligen con 1, 2 y 3, y valen para cualquier palo', () => {
    expect(ENCHANT_ORDER).toEqual(['damage', 'ice', 'push']);
    for (const id of ENCHANT_ORDER) expect(ENCHANTS[id].id).toBe(id);
  });

  it('el golpe seco está siempre listo; los otros dos se pagan con recarga', () => {
    expect(ENCHANTS.damage.cooldown).toBe(0);
    expect(ENCHANTS.ice.cooldown).toBeGreaterThan(0);
    expect(ENCHANTS.push.cooldown).toBeGreaterThan(0);
  });

  it('la escarcha dura más cuanto mejor es el golpe', () => {
    expect(ICE_SECONDS).toHaveLength(QUALITY_LEVELS);
    for (let i = 1; i < ICE_SECONDS.length; i++) expect(ICE_SECONDS[i]).toBeGreaterThan(ICE_SECONDS[i - 1]);
  });

  it('el vendaval deja a cada uno parado sobre la línea del tiro', () => {
    // la velocidad es (lo que lo separa de la línea) * KNOCK_DECAY, y se apaga con exp(-KNOCK_DECAY t):
    // recorre exactamente esa distancia, así que termina en la línea
    for (const dx of [0.5, 2, 5]) expect(dx - (dx * KNOCK_DECAY) / KNOCK_DECAY).toBeCloseTo(0);
    // con un palo lineal el pasillo es angosto: junta sin ir a buscarlos lejos
    expect(PUSH_LINE_HALF_WIDTH).toBeLessThan(CLUBS.wedge.spread * 1.5);
  });
});
