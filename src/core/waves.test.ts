import { describe, expect, it } from 'vitest';
import { ENEMIES, spawnOrder, WaveDirector, WAVES, type DirectorEvent, type Wave } from './waves';

const TEST_WAVES: Wave[] = [
  { title: 'uno', interval: 1, groups: [{ kind: 'goblin', count: 3 }] },
  { title: 'dos', interval: 0.5, groups: [{ kind: 'goblin', count: 2 }, { kind: 'golem', count: 1 }] },
];

describe('waves', () => {
  it('spawnOrder respeta las cantidades y mezcla los grupos', () => {
    for (const wave of WAVES) {
      const order = spawnOrder(wave);
      for (const g of wave.groups) expect(order.filter((k) => k === g.kind).length).toBe(g.count);
    }
    const mixed = spawnOrder(WAVES[1]);
    expect(mixed.slice(0, 3)).toContain('skeleton');
    expect(mixed.slice(0, 3)).toContain('goblin');
  });

  it('el jefe y los chamanes salen hacia la mitad de la oleada', () => {
    const order = spawnOrder(WAVES[WAVES.length - 1]);
    for (const kind of ['golem', 'shaman'] as const) {
      const at = order.indexOf(kind) / order.length;
      expect(at).toBeGreaterThan(0.25);
      expect(at).toBeLessThan(0.75);
    }
  });

  it('los enemigos nuevos se presentan solos en su oleada', () => {
    const firstWave = (kind: string) => WAVES.findIndex((w) => w.groups.some((g) => g.kind === kind));
    const before = (i: number) => new Set(WAVES.slice(0, i).flatMap((w) => w.groups.map((g) => g.kind)));
    for (const kind of ['armored', 'blessed']) {
      const i = firstWave(kind);
      const fresh = WAVES[i].groups.map((g) => g.kind).filter((k) => !before(i).has(k));
      expect(fresh, kind).toEqual([kind]);
    }
  });

  it('el acorazado le resta a cada golpe, y el bendito se come el primero', () => {
    expect(ENEMIES.armored.armor).toBe(1);
    expect(ENEMIES.blessed.divine).toBeGreaterThan(0);
    expect(WAVES.some((w) => w.groups.some((g) => g.kind === 'armored'))).toBe(true);
    expect(WAVES.some((w) => w.groups.some((g) => g.kind === 'blessed'))).toBe(true);
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
});
