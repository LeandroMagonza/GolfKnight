import { describe, expect, it } from 'vitest';
import { behaviorOf, canTake, ENEMIES, spawnOrder, WaveDirector, WAVES, type DirectorEvent, type EnemyMods, type Wave } from './waves';

const TEST_WAVES: Wave[] = [
  { title: 'uno', interval: 1, groups: [{ kind: 'goblin', count: 3 }] },
  { title: 'dos', interval: 0.5, groups: [{ kind: 'goblin', count: 2 }, { kind: 'golem', count: 1 }] },
];

describe('waves', () => {
  it('spawnOrder respeta las cantidades y mezcla los grupos', () => {
    for (const wave of WAVES) {
      const order = spawnOrder(wave).map((s) => s.kind);
      // un tipo puede venir en dos grupos (con y sin modificadores): se cuenta el total
      for (const g of wave.groups) {
        const total = wave.groups.filter((o) => o.kind === g.kind).reduce((n, o) => n + o.count, 0);
        expect(order.filter((k) => k === g.kind).length).toBe(total);
      }
    }
    const mixed = spawnOrder(WAVES[1]).map((s) => s.kind);
    expect(mixed.slice(0, 3)).toContain('goblina');
    expect(mixed.slice(0, 3)).toContain('goblin');
  });

  it('el jefe y los chamanes salen hacia la mitad de la oleada', () => {
    const order = spawnOrder(WAVES[WAVES.length - 1]).map((s) => s.kind);
    for (const kind of ['golem', 'wraith'] as const) {
      const at = order.indexOf(kind) / order.length;
      expect(at).toBeGreaterThan(0.25);
      expect(at).toBeLessThan(0.75);
    }
  });

  it('desde la segunda, cada oleada presenta como mucho dos cosas nuevas (cuerpos o poderes)', () => {
    const seen = new Set<string>();
    const things = (w: Wave) => [
      ...w.groups.map((g) => g.kind as string),
      ...[...w.groups.map((g) => g.mods), ...(w.powers ?? []).map((p) => p.mods)].flatMap((m) => Object.keys(m ?? {})),
    ];
    WAVES.forEach((w, i) => {
      const fresh = [...new Set(things(w))].filter((t) => !seen.has(t));
      if (i > 0) expect(fresh.length, `${w.title}: ${fresh.join(', ')}`).toBeLessThanOrEqual(2);
      for (const t of fresh) seen.add(t);
    });
  });

  it('la vida de los cuerpos es una escalera: cada uno pega un salto sobre el anterior', () => {
    const ladder = ['goblin', 'goblina', 'orc', 'skeleton', 'warchief', 'shaman', 'healer', 'knight', 'stoneling'] as const;
    ladder.forEach((k, i) => { if (i) expect(ENEMIES[k].hp, k).toBeGreaterThan(ENEMIES[ladder[i - 1]].hp); });
  });

  it('los poderes se reparten al azar, uno por enemigo, y solo a quien puede tenerlos', () => {
    const wave: Wave = { title: 'p', interval: 1, groups: [{ kind: 'goblin', count: 6 }, { kind: 'shaman', count: 1 }, { kind: 'golem', count: 1 }], powers: [{ mods: { explode: true }, count: 3 }, { mods: { armor: 2 }, count: 2 }] };
    const kinds = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      let s = seed;
      const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      const order = spawnOrder(wave, rand);
      expect(order.filter((o) => o.mods?.explode)).toHaveLength(3);
      expect(order.filter((o) => o.mods?.armor === 2)).toHaveLength(2);
      // el jefe nunca; el chamán puede tener blindaje, pero no explotar
      expect(order.find((o) => o.kind === 'golem')?.mods).toBeUndefined();
      expect(order.find((o) => o.kind === 'shaman')?.mods?.explode).toBeUndefined();
      order.forEach((o, i) => { if (o.mods?.explode) kinds.add(String(i)); });
    }
    // al azar de verdad: no siempre explotan los mismos
    expect(kinds.size).toBeGreaterThan(3);
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
    const order = spawnOrder(wave);
    expect(order.filter((s) => s.kind === 'skeleton').every((s) => s.mods?.armor === 2)).toBe(true);
    expect(order.find((s) => s.kind === 'goblin')?.mods).toBeUndefined();
  });
});
