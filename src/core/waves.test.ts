import { describe, expect, it } from 'vitest';
import { ENEMIES, spawnOrder, unlockedAt, WaveDirector, WAVES, type DirectorEvent, type Wave } from './waves';

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

  it('lo que dan las oleadas son habilidades, no palos: los cuatro palos están desde el principio', () => {
    // se ganan jugando, de a una: el vendaval llega con los escudos, que es lo que los baja
    expect(unlockedAt(-1)).toEqual([]);
    expect(unlockedAt(0)).toEqual([]);
    expect(unlockedAt(1)).toEqual(['wind']);
    expect(WAVES[1].groups.some((g) => g.kind === 'warrior')).toBe(true);
    expect(unlockedAt(WAVES.length - 1).sort()).toEqual(['grenade', 'ice', 'wind']);
    // ninguna oleada estrena dos habilidades a la vez
    for (let i = 0; i < WAVES.length; i++) {
      expect(unlockedAt(i).length - unlockedAt(i - 1).length, `oleada ${i + 1}`).toBeLessThanOrEqual(1);
    }
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
