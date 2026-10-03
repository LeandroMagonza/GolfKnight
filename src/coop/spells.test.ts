import { describe, expect, it } from 'vitest';
import { ABE_SLOTS, applyPick, nextOffer, OFFER_SIZE, spellHint, SPELL_INFO, SPELL_ORDER, type AbeSlot } from './spells';

/** Un azar fijo, para que las pruebas den siempre lo mismo. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe('cómo gana hechizos Abe', () => {
  it('al principio le ofrecen tres de nivel 1, distintos', () => {
    const o = nextOffer([], seeded())!;
    expect(o.level).toBe(1);
    expect(o.spells).toHaveLength(OFFER_SIZE);
    expect(new Set(o.spells).size).toBe(OFFER_SIZE);
  });

  it('con lugares libres, solo de los que no tiene', () => {
    const slots: AbeSlot[] = [{ id: 'hail', level: 1 }, { id: 'push', level: 1 }];
    for (let i = 0; i < 20; i++) {
      const o = nextOffer(slots, seeded(i + 1))!;
      expect(o.spells).not.toContain('hail');
      expect(o.spells).not.toContain('push');
    }
  });

  it('elegir con lugares libres lo suma', () => {
    const o = { level: 1, spells: ['hail', 'whirl', 'trap'] as const };
    expect(applyPick([], { ...o, spells: [...o.spells] }, 2, -1)).toEqual([{ id: 'trap', level: 1 }]);
  });

  it('con todo lleno, salen de un nivel más que el más bajo, y cualquiera', () => {
    const slots: AbeSlot[] = [{ id: 'hail', level: 2 }, { id: 'whirl', level: 1 }, { id: 'push', level: 2 }, { id: 'hush', level: 2 }];
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const o = nextOffer(slots, seeded(i + 1))!;
      expect(o.level).toBe(2);
      // el que ya tiene en ese nivel no sale
      expect(o.spells).not.toContain('hail');
      o.spells.forEach((s) => seen.add(s));
    }
    // salen también los que no tiene
    expect(seen.has('curse') || seen.has('trap') || seen.has('current')).toBe(true);
  });

  it('cuando todos son de nivel 2, salen de nivel 3; y en el máximo, nada', () => {
    const two: AbeSlot[] = SPELL_ORDER.slice(0, ABE_SLOTS).map((id) => ({ id, level: 2 }));
    expect(nextOffer(two, seeded())!.level).toBe(3);
    const three: AbeSlot[] = two.map((s) => ({ ...s, level: 3 }));
    expect(nextOffer(three, seeded())).toBeNull();
  });

  it('con todo lleno reemplaza el lugar que elige, o se queda como está', () => {
    const slots: AbeSlot[] = [{ id: 'hail', level: 1 }, { id: 'whirl', level: 1 }, { id: 'push', level: 1 }, { id: 'hush', level: 1 }];
    const offer = { level: 2, spells: ['hail', 'curse', 'trap'] as ('hail' | 'curse' | 'trap')[] };
    expect(applyPick(slots, offer, 1, 2)![2]).toEqual({ id: 'curse', level: 2 });
    expect(applyPick(slots, offer, -1, -1)).toEqual(slots);
    // sin decir dónde, no vale
    expect(applyPick(slots, offer, 1, -1)).toBeNull();
  });

  it('puede tener el mismo hechizo dos veces, de distinto nivel', () => {
    const slots: AbeSlot[] = [{ id: 'hail', level: 1 }, { id: 'whirl', level: 1 }, { id: 'push', level: 1 }, { id: 'hush', level: 1 }];
    const next = applyPick(slots, { level: 2, spells: ['hail', 'curse', 'trap'] }, 0, 1)!;
    expect(next.filter((s) => s.id === 'hail').map((s) => s.level)).toEqual([1, 2]);
  });
});

describe('cómo se explican', () => {
  it('nunca nombran un palo', () => {
    for (const id of SPELL_ORDER) {
      for (const level of [1, 2, 3]) expect(`${SPELL_INFO[id].name} ${spellHint(id, level)}`).not.toMatch(/driver|hierro|wedge|putter|palo/i);
    }
  });

  it('el granizo de nivel 3 además congela', () => {
    expect(spellHint('hail', 1)).not.toContain('congela');
    expect(spellHint('hail', 3)).toContain('congela');
  });
});
