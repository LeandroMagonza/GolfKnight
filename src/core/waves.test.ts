import { describe, expect, it } from 'vitest';
import { behaviorOf, canTake, ENEMIES, powerPool, POWERS, spawnOrder, WaveDirector, WAVES, type DirectorEvent, type EnemyMods, type Wave } from './waves';

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

const TEST_WAVES: Wave[] = [
  { title: 'uno', interval: 1, groups: [{ kind: 'goblin', count: 3 }] },
  { title: 'dos', interval: 0.5, groups: [{ kind: 'goblin', count: 2 }, { kind: 'golem', count: 1 }] },
];

describe('waves', () => {
  it('spawnOrder respeta las cantidades y mezcla los grupos', () => {
    WAVES.forEach((wave, i) => {
      const order = spawnOrder(WAVES, i).map((s) => s.kind);
      // un tipo puede venir en dos grupos (con y sin modificadores): se cuenta el total
      for (const g of wave.groups) {
        const total = wave.groups.filter((o) => o.kind === g.kind).reduce((n, o) => n + o.count, 0);
        expect(order.filter((k) => k === g.kind).length).toBe(total);
      }
    });
    const mixed = spawnOrder(WAVES, 1).map((s) => s.kind);
    expect(mixed.slice(0, 3)).toContain('goblina');
    expect(mixed.slice(0, 3)).toContain('goblin');
  });

  it('el jefe y el alma en pena salen hacia la mitad de la oleada', () => {
    const order = spawnOrder(WAVES, WAVES.length - 1).map((s) => s.kind);
    for (const kind of ['golem', 'wraith'] as const) {
      const at = order.indexOf(kind) / order.length;
      expect(at).toBeGreaterThan(0.25);
      expect(at).toBeLessThan(0.75);
    }
  });

  it('la primera trae los cuerpos de 1 a 4; después, cada una un poder nuevo y como mucho un cuerpo', () => {
    const bodies = new Set<string>();
    const powers = new Set<string>();
    WAVES.forEach((w, i) => {
      const fresh = [...new Set(w.groups.map((g) => g.kind))].filter((k) => !bodies.has(k));
      if (i === 0) expect(fresh.sort()).toEqual(['goblin', 'goblina', 'orc', 'skeleton']);
      else expect(fresh.length, w.title).toBeLessThanOrEqual(1);
      fresh.forEach((k) => bodies.add(k));
      if (i === 0) expect(w.power, w.title).toBeUndefined();
      else {
        expect(w.power, w.title).toBeDefined();
        expect(powers.has(w.power!), w.title).toBe(false);
        powers.add(w.power!);
        if (w.extra) {
          expect(powers.has(w.extra), w.title).toBe(false);
          powers.add(w.extra);
        }
      }
    });
  });

  it('el caballero y el gólem chico cierran la oleada en que se presentan', () => {
    for (const kind of ['knight', 'stoneling'] as const) {
      const i = WAVES.findIndex((w) => w.groups.some((g) => g.kind === kind));
      const order = spawnOrder(WAVES, i, seeded(3));
      expect(order[order.length - 1].kind, WAVES[i].title).toBe(kind);
    }
  });

  it('la vida de los cuerpos es una escalera: cada uno pega un salto sobre el anterior', () => {
    const ladder = ['goblin', 'goblina', 'orc', 'skeleton', 'warchief', 'shaman', 'knight', 'stoneling'] as const;
    ladder.forEach((k, i) => { if (i) expect(ENEMIES[k].hp, k).toBeGreaterThan(ENEMIES[ladder[i - 1]].hp); });
  });

  it('un tercio sale con poder: la mitad con el nuevo, y el primero que aparece lo presenta', () => {
    WAVES.forEach((w, i) => {
      const pool = powerPool(WAVES, i);
      const bodies = new Set<string>();
      for (let seed = 1; seed < 30; seed++) {
        const order = spawnOrder(WAVES, i, seeded(seed));
        const open = order.filter((o) => !ENEMIES[o.kind].boss);
        const powered = order.filter((o) => o.mods);
        // en la primera no hay poderes todavía
        // más el de pasada, si la oleada trae uno
        expect(powered.length, w.title).toBe((pool.fresh || pool.old.length ? Math.round(open.length / 3) : 0) + (w.extra ? 1 : 0));
        // el jefe nunca; nadie recibe un poder que no pueda tener
        expect(order.filter((o) => ENEMIES[o.kind].boss).every((o) => !o.mods)).toBe(true);
        for (const o of powered) expect(canTake(o.kind, o.mods!), `${w.title}: ${o.kind}`).toBe(true);
        if (pool.fresh) {
          const isFresh = (o: { mods?: EnemyMods }) => {
            const m = o.mods ?? {};
            const key = pool.fresh!;
            return key === 'heal' ? m.aura === 'heal' : key === 'ward' ? m.aura === 'ward' : m[key as keyof EnemyMods] !== undefined;
          };
          const shared = powered.length - (w.extra ? 1 : 0);
          const want = pool.old.length ? Math.ceil(shared / 2) : shared;
          expect(powered.filter(isFresh).length, w.title).toBe(want);
          // el primero que puede tenerlo es el que lo presenta
          const probe = POWERS[pool.fresh](0, () => 0);
          expect(isFresh(order.find((o) => !ENEMIES[o.kind].boss && canTake(o.kind, probe))!), w.title).toBe(true);
        }
        powered.forEach((o) => bodies.add(o.kind));
      }
      // cualquier cuerpo puede tocarle: en las oleadas con varios, no siempre al mismo
      if (i > 1) expect(bodies.size, w.title).toBeGreaterThan(2);
    });
  });

  it('el escudo y el blindaje salen en 1 al presentarse y suben con la partida', () => {
    const levels = (i: number, key: 'shield' | 'armor') => {
      const seen = new Set<number>();
      for (let seed = 1; seed < 60; seed++) for (const o of spawnOrder(WAVES, i, seeded(seed))) if (o.mods?.[key]) seen.add(o.mods[key]!);
      return seen;
    };
    const shieldAt = WAVES.findIndex((w) => w.power === 'shield');
    const armorAt = WAVES.findIndex((w) => w.power === 'armor');
    expect([...levels(shieldAt, 'shield')]).toEqual([1]);
    expect([...levels(armorAt, 'armor')]).toEqual([1]);
    expect(Math.max(...levels(WAVES.length - 1, 'shield'))).toBeGreaterThanOrEqual(5);
    expect(Math.max(...levels(WAVES.length - 1, 'armor'))).toBe(3);
  });

  it('el comportamiento sale del poder, salvo en los que ya tienen uno propio', () => {
    const m = (mods: EnemyMods) => behaviorOf(ENEMIES.skeleton, mods);
    expect(m({})).toBe('melee');
    expect(m({ explode: true })).toBe('kamikaze');
    expect(m({ dig: true })).toBe('geomancer');
    expect(m({ banner: true })).toBe('banner');
    expect(m({ ranged: true })).toBe('ranged');
    expect(m({ aura: 'heal' })).toBe('shaman');
    expect(behaviorOf(ENEMIES.wraith, { explode: true })).toBe('grabber');
    expect(canTake('golem', { armor: 1 })).toBe(false);
    expect(canTake('wraith', { explode: true })).toBe(false);
    expect(canTake('wraith', { shield: 2 })).toBe(true);
    // el chamán es un cuerpo más: puede tocarle cualquier poder
    expect(canTake('shaman', { explode: true })).toBe(true);
    expect(behaviorOf(ENEMIES.shaman, {})).toBe('melee');
    // esquivar no cambia cómo camina: le puede tocar a cualquiera menos al jefe
    expect(behaviorOf(ENEMIES.knight, { dodge: true })).toBe('melee');
    expect(canTake('wraith', { dodge: true })).toBe(true);
    expect(canTake('golem', { dodge: true })).toBe(false);
  });

  it('todos los enemigos de las oleadas están definidos', () => {
    for (const wave of WAVES) for (const g of wave.groups) expect(ENEMIES[g.kind].mesh).toMatch(/^Character_/);
  });

  it('recorre las oleadas hasta la victoria', () => {
    const d = new WaveDirector(TEST_WAVES, 2);
    const log: DirectorEvent[] = [];
    let alive = 0;
    for (let t = 0; t < 40 && !d.done; t += 0.1) {
      for (const e of d.update(0.1, alive)) {
        log.push(e);
        if (e.type === 'spawn') alive++;
      }
      // los enemigos mueren un rato después de que termina de salir la oleada
      if (alive > 0 && d.pending === 0 && Math.random() < 0.2) alive = 0;
    }
    expect(d.done).toBe(true);
    expect(log.filter((e) => e.type === 'wave').length).toBe(2);
    expect(log.filter((e) => e.type === 'spawn').length).toBe(6);
    expect(log.filter((e) => e.type === 'cleared').length).toBe(2);
    expect(log[log.length - 1].type).toBe('victory');
  });

  it('no da por terminada una oleada mientras quedan enemigos', () => {
    const d = new WaveDirector(TEST_WAVES, 2);
    let spawned = 0;
    for (let t = 0; t < 30; t += 0.1) for (const e of d.update(0.1, 1)) if (e.type === 'spawn') spawned++;
    expect(spawned).toBe(3);
    expect(d.index).toBe(0);
  });

  it('los modificadores viajan con cada aparición', () => {
    const wave: Wave = { title: 'm', interval: 1, groups: [{ kind: 'skeleton', count: 2, mods: { armor: 2 } }, { kind: 'goblin', count: 1 }] };
    const order = spawnOrder([wave], 0);
    expect(order.filter((s) => s.kind === 'skeleton').every((s) => s.mods?.armor === 2)).toBe(true);
    expect(order.find((s) => s.kind === 'goblin')?.mods).toBeUndefined();
  });
});
