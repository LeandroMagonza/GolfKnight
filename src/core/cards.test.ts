import { describe, expect, it } from 'vitest';
import { ABILITY_LIST, MAX_LEVEL, SLOTS } from './abilities';
import { candidates, drawCards, needsHeal, PERKS, type Build } from './cards';

const fresh = (over: Partial<Build> = {}): Build => ({ slots: [], perks: {}, hp: 3, hpMax: 3, gate: 10, gateMax: 10, ...over });

/** Un azar fijo, para que el sorteo se pueda repetir. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('cartas', () => {
  it('salen tres, todas distintas', () => {
    for (let seed = 1; seed < 30; seed++) {
      const cards = drawCards(fresh(), 3, seeded(seed));
      expect(cards).toHaveLength(3);
      expect(new Set(cards.map((c) => `${c.kind}:${c.id}`)).size).toBe(3);
    }
  });

  it('con la mano llena solo salen subidas de nivel de las que tenés, no habilidades nuevas', () => {
    const slots = ABILITY_LIST.slice(0, SLOTS).map((id) => ({ id, level: 1 }));
    const pool = candidates(fresh({ slots }));
    for (const { card } of pool) {
      if (card.kind !== 'ability') continue;
      expect(slots.map((s) => s.id)).toContain(card.id);
      expect(card.level).toBe(2);
    }
  });

  it('una habilidad en el nivel máximo ya no sale', () => {
    const pool = candidates(fresh({ slots: [{ id: 'grenade', level: MAX_LEVEL }] }));
    expect(pool.some((c) => c.card.kind === 'ability' && c.card.id === 'grenade')).toBe(false);
  });

  it('la maestría de un elemento sale recién con dos habilidades de ese elemento', () => {
    const has = (b: Build) => candidates(b).some((c) => c.card.kind === 'perk' && c.card.id === 'masteryIce');
    expect(has(fresh({ slots: [{ id: 'ice', level: 1 }] }))).toBe(false);
    expect(has(fresh({ slots: [{ id: 'ice', level: 1 }, { id: 'driver-ice', level: 1 }] }))).toBe(true);
    expect(PERKS.masteryIce.needs).toBe('ice');
  });

  it('curarse sale solo si falta algo, y sí o sí si la partida viene mal', () => {
    expect(candidates(fresh()).some((c) => c.card.kind === 'heal')).toBe(false);
    expect(needsHeal(fresh({ gate: 4 }))).toBe('gate');
    expect(needsHeal(fresh({ hp: 1 }))).toBe('player');
    for (let seed = 1; seed < 20; seed++) {
      const cards = drawCards(fresh({ gate: 3 }), 3, seeded(seed));
      expect(cards.some((c) => c.kind === 'heal' && c.id === 'gate')).toBe(true);
    }
  });

  it('una mejora no sale más veces que su tope', () => {
    const pool = candidates(fresh({ perks: { quickWrist: PERKS.quickWrist.max, rhythm: 1 } }));
    expect(pool.some((c) => c.card.kind === 'perk' && (c.card.id === 'quickWrist' || c.card.id === 'rhythm'))).toBe(false);
  });
});
