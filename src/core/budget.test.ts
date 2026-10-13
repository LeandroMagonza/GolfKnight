import { describe, expect, it } from 'vitest';
import { BUDGET, perHit, POWER_WEIGHT, shotsFor } from './budget';
import { rulesFor } from './difficulty';
import { buildRun, ENEMIES, HARDEST, SCENARIO_POWERS, spawnOrder, type Spawn } from './waves';

const seeded = (seed: number) => {
  let s = seed;
  const next = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 5; i++) next();
  return next;
};

/** La vida con la que sale uno (la del cuerpo y todo lo que le sumaron). */
const hpOf = (s: Spawn) => ENEMIES[s.kind].hp + (s.mods?.hp ?? 0);
const scenarioPower = (s: Spawn) => SCENARIO_POWERS.some((p) => s.mods?.[p]);

describe('el presupuesto de las oleadas', () => {
  it('cada poder multiplica lo que pide el mismo enemigo', () => {
    const plain = shotsFor('orc', undefined, 4);
    expect(plain).toBeCloseTo(4 / (BUDGET.connect * perHit()));
    // lo que suma cada poder, por su peso (ver POWER_WEIGHT); el élite, sin peso
    const times = (m: number, p: string) => 1 + (m - 1) * POWER_WEIGHT[p];
    // el fantasma: cada golpe le saca 1
    expect(shotsFor('orc', { ethereal: true }, 4) / plain).toBeCloseTo(times(perHit(), 'ethereal'), 5);
    expect(shotsFor('orc', { ethereal: true, size: 1.5 }, 4) / plain).toBeCloseTo(perHit(), 5);
    // el bendito y el escurridizo: el doble
    expect(shotsFor('orc', { divine: 5 }, 4) / plain).toBeCloseTo(times(2, 'divine'));
    expect(shotsFor('orc', { dodge: true }, 4) / plain).toBeCloseTo(times(2, 'dodge'));
    // el escudo, por arriba: nada
    expect(shotsFor('orc', { shield: 3 }, 4)).toBeCloseTo(plain);
    // el que se cura pide más
    expect(shotsFor('orc', { regen: 1.2 }, 6)).toBeGreaterThan(shotsFor('orc', undefined, 6));
    // los chicos, menos: caen de paso
    expect(shotsFor('goblin', undefined, 1)).toBeCloseTo((1 / (BUDGET.connect * perHit())) * BUDGET.small[0]);
  });

  it('el tope: el chamán fantasma de 8 se pasa, el orco fantasma de 5 no', () => {
    expect(shotsFor('shaman', { ethereal: true }, 8)).toBeGreaterThan(BUDGET.cap);
    expect(shotsFor('orc', { ethereal: true }, 5)).toBeLessThanOrEqual(BUDGET.cap);
    // el orco gigante que se cura, de 9
    expect(shotsFor('orc', { regen: 1.2, giant: 1.7 }, 9)).toBeGreaterThan(BUDGET.cap);
  });

  it('ningún común con poder pide más que el tope, con cualquier dificultad', () => {
    const hard = { ...HARDEST };
    const tenth = rulesFor({ rest: 1, speed: 0.2, stack: 1, fourth: 1, powers: 1, powered: 1, special: 2, support: 2, casters: 0.15 });
    for (const rules of [hard, tenth, rulesFor({})]) {
      for (let i = 1; i <= 25; i++) {
        const run = buildRun(seeded(i), rules);
        for (const w of run.waves) {
          for (const s of spawnOrder(w, seeded(i * 31))) {
            if (s.mods?.size || ENEMIES[s.kind].boss || !scenarioPower(s)) continue;
            expect(shotsFor(s.kind, s.mods, hpOf(s)), `${w.title}: ${s.kind} ${JSON.stringify(s.mods)}`).toBeLessThanOrEqual(BUDGET.cap + 1e-9);
          }
        }
      }
    }
  });

  it('el élite paga de su oleada: con el élite fantasma salen menos comunes con poder que con el del escudo', () => {
    const rules = rulesFor({ rest: 1, speed: 0.2, stack: 1, fourth: 1, powers: 1, powered: 1, special: 1, support: 2 });
    const powered = (second: 'ethereal' | 'shield') => {
      let n = 0;
      for (let i = 1; i <= 60; i++) {
        const run = buildRun(seeded(i), { ...rules, order: ['divine', second, 'armor'], specialAt: [null, null, null] });
        n += spawnOrder(run.waves[5], seeded(i * 7)).filter((s) => !s.mods?.size && scenarioPower(s)).length;
      }
      return n / 60;
    };
    expect(powered('ethereal')).toBeLessThan(powered('shield'));
  });

  it('las marcas suman lo suyo y no más: la estampida trae menos de diez si no entran', () => {
    const rules = rulesFor({ rest: 1, speed: 0.2, stack: 1, fourth: 1, powers: 1, powered: 1, special: 1, support: 2 });
    for (let i = 1; i <= 10; i++) {
      const on = buildRun(seeded(i), { ...rules, order: ['divine', 'ethereal', 'armor'], specialAt: ['stampede', null, null] });
      const off = buildRun(seeded(i), { ...rules, order: ['divine', 'ethereal', 'armor'], specialAt: [null, null, null] });
      for (const k of [3, 6]) {
        const more = spawnOrder(on.waves[k], seeded(3)).length - spawnOrder(off.waves[k], seeded(3)).length;
        expect(more).toBeGreaterThan(0);
        expect(more).toBeLessThanOrEqual(10);
      }
    }
  });
});
