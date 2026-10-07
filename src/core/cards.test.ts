import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_LIST, cooldownAt, MAX_LEVEL, maxLevelOf, SLOTS, upgradeNote } from './abilities';
import { candidates, cooldownNote, describe as describeCard, drawCards, mixPartners, needsHeal, PERK_NUMBERS, PERKS, type Build } from './cards';

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

  it('las maestrías mixtas salen con una habilidad de cada elemento, y ponen el otro', () => {
    const has = (b: Build, id: string) => candidates(b).some((c) => c.card.kind === 'perk' && c.card.id === id);
    expect(has(fresh({ slots: [{ id: 'driver-fire', level: 1 }] }), 'mixIceFire')).toBe(false);
    expect(has(fresh({ slots: [{ id: 'driver-fire', level: 1 }, { id: 'glove-ice', level: 1 }] }), 'mixIceFire')).toBe(true);
    expect(has(fresh({ slots: [{ id: 'driver-fire', level: 1 }, { id: 'glove-ice', level: 1 }] }), 'mixFireLightning')).toBe(false);
    expect(mixPartners({ mixIceFire: 1, mixFireLightning: 1 }, 'fire').sort()).toEqual(['ice', 'lightning']);
    expect(mixPartners({ mixIceFire: 1 }, 'lightning')).toEqual([]);
    expect(mixPartners({}, 'ice')).toEqual([]);
  });

  it('las bloqueadas (la demo) no salen nunca', () => {
    const locked = new Set(ABILITY_LIST.filter((id) => ABILITIES[id].element === 'ghost' || ABILITIES[id].element === 'silence'));
    expect(locked.size).toBeGreaterThan(0);
    for (let seed = 1; seed < 40; seed++) {
      for (const c of drawCards(fresh({ locked }), 3, seeded(seed))) expect(c.kind === 'ability' && locked.has(c.id)).toBe(false);
    }
    expect(candidates(fresh({ locked })).some((c) => c.card.kind === 'ability' && locked.has(c.card.id))).toBe(false);
    // las mejoras también
    const perks = new Set<string>(['rhythm', 'hotStreak']);
    expect(candidates(fresh({ locked: perks })).some((c) => c.card.kind === 'perk' && perks.has(c.card.id))).toBe(false);
    expect(candidates(fresh()).some((c) => c.card.kind === 'perk' && c.card.id === 'rhythm')).toBe(true);
  });

  it('una habilidad en el nivel máximo ya no sale', () => {
    const pool = candidates(fresh({ slots: [{ id: 'cart', level: MAX_LEVEL }] }));
    expect(pool.some((c) => c.card.kind === 'ability' && c.card.id === 'cart')).toBe(false);
  });

  it('la maestría de un elemento sale recién con dos habilidades de ese elemento', () => {
    const has = (b: Build) => candidates(b).some((c) => c.card.kind === 'perk' && c.card.id === 'masteryIce');
    expect(has(fresh({ slots: [{ id: 'iron-ice', level: 1 }] }))).toBe(false);
    expect(has(fresh({ slots: [{ id: 'iron-ice', level: 1 }, { id: 'driver-ice', level: 1 }] }))).toBe(true);
    expect(PERKS.masteryIce.needs).toBe('ice');
  });

  it('ya no hay cartas de curarse: si la partida viene mal, sale sí o sí el botiquín', () => {
    expect(candidates(fresh({ gate: 2, hp: 1 })).some((c) => c.card.kind === 'heal')).toBe(false);
    expect(needsHeal(fresh({ gate: 4 }))).toBe('gate');
    expect(needsHeal(fresh({ hp: 1 }))).toBe('player');
    for (let seed = 1; seed < 20; seed++) {
      const cards = drawCards(fresh({ gate: 3 }), 3, seeded(seed));
      expect(cards.some((c) => c.kind === 'perk' && c.id === 'medkit')).toBe(true);
    }
    // con el botiquín al tope no hay nada que forzar
    const full = drawCards(fresh({ gate: 3, perks: { medkit: PERKS.medkit.max } }), 3, seeded(3));
    expect(full.some((c) => c.kind === 'perk' && c.id === 'medkit')).toBe(false);
  });

  it('una mejora no sale más veces que su tope', () => {
    const pool = candidates(fresh({ perks: { quickWrist: PERKS.quickWrist.max, rhythm: 1 } }));
    expect(pool.some((c) => c.card.kind === 'perk' && (c.card.id === 'quickWrist' || c.card.id === 'rhythm'))).toBe(false);
  });

  it('la carta de habilidad dice su recarga: la de base si es nueva, y de cuánto a cuánto si sube', () => {
    const base = ABILITIES.cart.cooldown;
    expect(cooldownNote('cart', 1)).toEqual({ text: `Recarga: ${base} s`, slower: false });
    // subir el carrito no la cambia: la carta no dice nada de la recarga
    expect(cooldownNote('cart', 2)).toBeNull();
    expect(describeCard({ kind: 'ability', id: 'cart', level: 2 }).cool).toBeUndefined();
    // el palazo sí recarga más lento al subir
    const up = cooldownNote('shove', 2)!;
    expect(up.slower).toBe(true);
    expect(up.text).toBe(`Recarga: ${ABILITIES.shove.cooldown} s → ${+cooldownAt(ABILITIES.shove, 2).toFixed(1)} s · más lenta`);
    expect(describeCard({ kind: 'ability', id: 'shove', level: 2 }).cool).toEqual(up);
    expect(describeCard({ kind: 'perk', id: 'rhythm', level: 1 }).cool).toBeUndefined();
  });

  it('la carta de subir de nivel dice qué mejora; la que no mejora nada no sale', () => {
    for (const id of ABILITY_LIST) {
      expect(describeCard({ kind: 'ability', id, level: 1 }).up, id).toBeUndefined();
      // con la mano de antes, que es la que dice cuánto sube el elemento entero
      for (let level = 2; level <= maxLevelOf(id); level++) expect(describeCard({ kind: 'ability', id, level }, fresh({ slots: [{ id, level: level - 1 }] })).up, `${id} ${level}`).toBeTruthy();
    }
    // el wedge saltea la pifia: su nivel 1 sale con el golpe 2, así que el área es la del 2 y la del 3
    expect(upgradeNote('wedge-lightning', 2)).toBe('Área: 4.2 → 5 m');
    expect(describeCard({ kind: 'ability', id: 'wedge-lightning', level: 2 }, fresh({ slots: [{ id: 'wedge-lightning', level: 1 }] })).up).toBe('Área: 4.2 → 5 m · Todo tu rayo, saltos por lado: 2 → 3');
    // una carta nueva de un elemento que ya tenés también le sube a todo
    expect(describeCard({ kind: 'ability', id: 'putter-fire', level: 1 }, fresh({ slots: [{ id: 'driver-fire', level: 2 }] })).up).toBe('Todo tu fuego: 3 → 4 de daño');
    expect(upgradeNote('wedge-ice', 2)).toContain('Congela');
    expect(upgradeNote('driver-ghost', 2)).toBe('Golpe: 1 → 2');
    expect(upgradeNote('iron-ice', 3)).toContain('Congela');
    expect(upgradeNote('iron-ice', 2)).not.toContain('Congela');
    // la lluvia de pelotas es igual en todos los niveles: no se ofrece subirla
    expect(maxLevelOf('rain')).toBe(1);
    const pool = candidates(fresh({ slots: [{ id: 'rain', level: 1 }] }));
    expect(pool.some((c) => c.card.kind === 'ability' && c.card.id === 'rain')).toBe(false);
    // los tiros del wedge llegan hasta el 2: no se ofrece el 3
    expect(maxLevelOf('wedge-fire')).toBe(2);
    expect(maxLevelOf('iron-fire')).toBe(3);
    const wedge = candidates(fresh({ slots: [{ id: 'wedge-fire', level: 2 }] }));
    expect(wedge.some((c) => c.card.kind === 'ability' && c.card.id === 'wedge-fire')).toBe(false);
  });

  it('las mejoras que recargan dicen su recarga abajo, no en el texto', () => {
    expect(describeCard({ kind: 'perk', id: 'secondWind', level: 1 }).cool?.text).toBe(`Recarga: ${PERK_NUMBERS.secondWindCooldown} s`);
    expect(describeCard({ kind: 'perk', id: 'quiver', level: 1 }).cool?.text).toBe(`Recarga: ${PERK_NUMBERS.quiverCooldown} s`);
    expect(PERKS.secondWind.hint).not.toContain('segundos');
  });
});
