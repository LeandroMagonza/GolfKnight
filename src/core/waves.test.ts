import { describe, expect, it } from 'vitest';
import { DIFFICULTY, rulesFor } from './difficulty';
import { arrivalOrder, arrivals, behaviorOf, HEAVY_SPEED, buildRun, canTake, DIVINE, DODGE, ENEMIES, ELITE, elite, GIANTS, giantScale, HARDEST, HEAVY, hasPower, KAMIKAZE, LADDER, LIMITS, MARKS, POWERED, POWERS, SCENARIO_POWERS, SHIELD_WALL, spawnOrder, SUPPORT_POWERS, WaveDirector, type DirectorEvent, type EnemyKind, type EnemyMods, type PowerKey, type Spawn, type Wave } from './waves';

const seeded = (seed: number) => {
  let s = seed;
  const next = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  // con semillas chicas los primeros números salen casi en 0: se descartan
  for (let i = 0; i < 5; i++) next();
  return next;
};

const TEST_WAVES: Wave[] = [
  { title: 'uno', interval: 1, scenario: 0, groups: [{ kind: 'goblin', count: 3 }] },
  { title: 'dos', interval: 0.5, scenario: 0, groups: [{ kind: 'goblin', count: 2 }, { kind: 'golem', count: 1 }] },
];

/** ¿Este enemigo trae este poder? */
const has = (m: EnemyMods | undefined, key: PowerKey) => {
  if (!m) return false;
  if (key === 'heal') return m.aura === 'heal';
  if (key === 'ward') return m.aura === 'ward';
  return m[key as keyof EnemyMods] !== undefined;
};

/** Muchas partidas distintas. */
const runs = (n = 40) => Array.from({ length: n }, (_, i) => buildRun(seeded(i + 1)));

describe('waves', () => {
  it('una partida son tres escenarios de tres oleadas y la del jefe', () => {
    for (const run of runs()) {
      expect(run.waves).toHaveLength(10);
      expect(run.waves.map((w) => w.scenario)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3]);
      // tres poderes de escenario distintos, de los cinco de defensa, y dos de apoyo distintos
      expect(new Set(run.powers).size).toBe(3);
      for (const p of run.powers) expect(SCENARIO_POWERS).toContain(p);
      expect(new Set(run.supports).size).toBe(2);
      for (const p of run.supports) expect(SUPPORT_POWERS).toContain(p);
      // cada escenario presenta el suyo y acumula los anteriores
      run.waves.slice(0, 9).forEach((w, i) => {
        expect(w.focus).toBe(run.powers[Math.floor(i / 3)]);
        expect(!!w.debut).toBe(i % 3 === 0);
        expect(w.old).toEqual(run.powers.slice(0, w.scenario));
      });
      expect(run.waves[9].old).toEqual(run.powers);
      expect(run.waves[9].groups.some((g) => g.kind === 'golem')).toBe(true);
    }
    // al azar de verdad: no salen siempre los mismos
    expect(new Set(runs().map((r) => r.powers.join())).size).toBeGreaterThan(5);
  });

  it('cada escenario termina con su élite, que lleva el poder en su versión más dura', () => {
    for (const run of runs()) {
      for (const s of [0, 1, 2]) {
        const w = run.waves[s * 3 + 2];
        const order = arrivalOrder(spawnOrder(w, seeded(3)), w.interval);
        // llega al final de la oleada, con algunos detrás para que no camine solo
        const last = order.find((o) => o.mods?.size)!;
        expect(order.indexOf(last) / order.length).toBeGreaterThan(0.7);
        expect(order.indexOf(last)).toBeLessThan(order.length - 1);
        expect(has(last.mods, run.powers[s]), w.title).toBe(true);
        expect(canTake(last.kind, last.mods!)).toBe(true);
        if (run.powers[s] === 'shield') expect(last.mods!.shield).toBe(SHIELD_WALL);
        // y es más grande que su cuerpo de siempre: llega a la altura del élite, o crece lo mínimo
        const size = last.mods!.size!;
        expect(size).toBeGreaterThanOrEqual(ELITE.minScale);
        expect(ENEMIES[last.kind].height * size).toBeGreaterThanOrEqual(ELITE.height - 1e-9);
        // y trae vida de más: +2, +3 y +4 según el escenario
        expect(last.mods!.hp).toBe(ELITE.hp[s]);
      }
    }
    // el más duro que pueda: el gólem chico en el tercero, salvo que el poder no le entre
    expect(elite(2, 'dodge').kind).toBe('stoneling');
    expect(elite(2, 'ethereal').kind).toBe('knight');
    expect(elite(0, 'shield').kind).toBe('warchief');
    // el tamaño depende del modelo: el jefe goblin, chico, crece mucho más que el caballero
    expect(elite(0, 'shield').mods!.size!).toBeGreaterThan(elite(1, 'shield').mods!.size! + 0.3);
  });

  it('el cuerpo fuerte del escenario viene desde la primera oleada: 1, 3 y 3, sin poder salvo el élite', () => {
    for (const run of runs(10)) {
      for (const s of [0, 1, 2]) {
        const counts = [0, 1, 2].map((i) => run.waves[s * 3 + i].groups.filter((g) => g.kind === HEAVY[s] && !g.mods).reduce((n, g) => n + g.count, 0));
        expect(counts).toEqual([1, 3, 3]);
        for (const i of [0, 1, 2]) {
          const w = run.waves[s * 3 + i];
          // (el modificador de la oleada sí los agranda o les cambia la vida: eso no es un poder)
          for (let seed = 1; seed < 6; seed++) for (const o of spawnOrder(w, seeded(seed))) if (o.kind === HEAVY[s] && o.plain) expect(hasPower(o.mods)).toBe(false);
        }
        // en la última también salen solos: de ese cuerpo, el único con poder es el élite
        expect(run.waves[s * 3 + 2].groups.find((g) => g.kind === HEAVY[s] && !g.mods)?.plain).toBe(true);
      }
    }
  });

  it('un tercio sale con poder: la mitad con el del escenario y el primero que aparece lo presenta', () => {
    for (const run of runs(15)) {
      const unused = SCENARIO_POWERS.filter((p) => !run.powers.includes(p));
      run.waves.forEach((w, i) => {
        for (let seed = 1; seed < 8; seed++) {
          const order = spawnOrder(w, seeded(seed));
          const fixed = w.groups.filter((g) => g.mods || g.plain).reduce((n, g) => n + g.count, 0);
          const exploders = order.filter((o) => o.mods?.explode).length;
          // la marca de «todos con poder» va aparte del tercio, con los poderes que no salieron
          const isForeign = (o: Spawn) => !!w.foreign && unused.some((p) => has(o.mods, p)) && !w.groups.some((g) => g.mods === o.mods);
          const foreign = order.filter(isForeign).length;
          if (w.foreign) expect(foreign, w.title).toBe(w.foreign.count);
          const open = order.filter((o) => !ENEMIES[o.kind].boss).length - fixed - exploders - foreign;
          const drawn = order.filter((o) => hasPower(o.mods) && !o.mods!.explode && !o.plain && !isForeign(o) && !w.groups.some((g) => g.mods === o.mods));
          // con «todos con poder», todos; si no, un tercio
          expect(drawn.length, `${i} ${w.title}`).toBe(w.mod === 'powered' ? open : Math.round(open / 3));
          // el jefe nunca; nadie recibe un poder que no pueda tener
          expect(order.filter((o) => ENEMIES[o.kind].boss).every((o) => !o.mods)).toBe(true);
          for (const o of order) if (hasPower(o.mods)) expect(canTake(o.kind, o.mods!), `${w.title}: ${o.kind}`).toBe(true);
          // uno solo por enemigo: el blindaje y el etéreo nunca van juntos
          for (const o of order) expect(!!o.mods?.armor && !!o.mods?.ethereal).toBe(false);
          if (w.focus && w.mod !== 'powered') {
            const support = drawn.filter((o) => (w.supports ?? []).some((s) => has(o.mods, s.key))).length;
            const shared = drawn.length - support;
            const focus = drawn.filter((o) => has(o.mods, w.focus!)).length;
            expect(focus, w.title).toBe(w.old?.length ? Math.ceil(shared / 2) : shared);
          }
          // lo presenta el primero en llegar que puede tenerlo (con el fantasma, el primero que no es un
          // goblin); los que salen sin poder no cuentan
          if (w.debut) {
            const probe = POWERS[w.focus!](w.scenario, () => 0);
            const plain = new Set(w.groups.filter((g) => g.plain).map((g) => g.kind));
            const first = arrivalOrder(order, w.interval).find((o) => !ENEMIES[o.kind].boss && !(plain.has(o.kind) && !o.mods) && !o.mods?.explode && canTake(o.kind, probe));
            expect(has(first?.mods, w.focus!), w.title).toBe(true);
          }
        }
      });
    }
  });

  it('dos olas especiales: la segunda oleada de la partida y la segunda de otro escenario, distintas', () => {
    const orders = new Set<string>();
    for (const run of runs(30)) {
      expect(run.waves[1].mod).toBeDefined();
      const later = [4, 7].filter((i) => run.waves[i].mod);
      expect(later).toHaveLength(1);
      expect(run.waves[later[0]].mod).not.toBe(run.waves[1].mod);
      expect(run.specials).toEqual([run.waves[1].mod, run.waves[later[0]].mod]);
      orders.add(`${run.specials.join()} ${later[0]}`);
      // las demás no son especiales
      run.waves.forEach((w, i) => { if (i !== 1 && i !== later[0]) expect(w.mod, w.title).toBeUndefined(); });
    }
    expect(orders.size).toBeGreaterThan(6);
  });

  it('cada ola especial deja su marca en las oleadas que siguen', () => {
    for (const run of runs(30)) {
      const unused = SCENARIO_POWERS.filter((p) => !run.powers.includes(p));
      run.waves.forEach((w, i) => {
        const before = run.waves.slice(0, i).map((x) => x.mod);
        // los gigantes: unos cuantos gigantes por oleada, nunca el élite ni el jefe
        expect(w.giants, w.title).toBe(before.includes('giants') ? MARKS.giants : undefined);
        if (w.giants) {
          const giants = spawnOrder(w, seeded(i + 2)).filter((o) => o.mods?.giant);
          expect(giants).toHaveLength(MARKS.giants);
          for (const o of giants) expect(!o.mods?.size && !ENEMIES[o.kind].boss).toBe(true);
        }
        // todos con poder: unos pocos con los poderes que no salieron
        expect(w.foreign, w.title).toEqual(before.includes('powered') ? { keys: unused, count: MARKS.foreign } : undefined);
        // la estampida: kamikazes, y solo después de ella
        expect(!!w.kamikaze, w.title).toBe(before.includes('stampede'));
      });
    }
    // la estampida suma chicos: la misma oleada con la marca trae MARKS.stampede más
    const count = (w: Wave) => w.groups.reduce((n, g) => n + g.count, 0);
    const marked = runs(40).find((r) => r.waves[1].mod === 'stampede')!;
    const plain = buildRun(seeded(1), { ...HARDEST, specials: 0 });
    expect(count(marked.waves[2])).toBe(count(plain.waves[2]) + MARKS.stampede);
  });

  it('los gigantes: menos, bien más grandes pero más chicos que el élite, más lentos y con más vida', () => {
    for (const run of runs(20)) {
      const i = run.waves.findIndex((w) => w.mod === 'giants');
      if (i < 0) continue;
      const s = Math.floor(i / 3);
      const w = run.waves[i];
      const order = spawnOrder(w, seeded(3));
      for (const o of order) {
        const giant = o.mods!.giant!;
        expect(giant).toBe(giantScale(o.kind));
        expect(giant).toBeGreaterThan(1);
        // ninguno llega a la altura del élite
        expect(ENEMIES[o.kind].height * giant).toBeLessThan(ELITE.height);
        expect(o.mods?.size).toBeUndefined();
        expect(o.mods?.hp ?? 0).toBeGreaterThanOrEqual(GIANTS.hp);
        expect(o.mods?.speed).toBe(GIANTS.speed);
      }
      // los chicos se notan: crecen todo lo que dice GIANTS.scale
      expect(giantScale('goblin')).toBe(GIANTS.scale);
      // menos que una oleada común del mismo escenario (la primera, sin contar el cuerpo fuerte)
      const light = (x: Wave) => x.groups.filter((g) => !g.plain).reduce((n, g) => n + g.count, 0);
      expect(light(w)).toBeLessThan(light(run.waves[s * 3]));
    }
  });

  it('todos con poder: cada uno trae uno, a veces de los que no salieron sorteados, y con menos vida', () => {
    const outside = new Set<string>();
    for (const run of runs(30)) {
      const w = run.waves.find((x) => x.mod === 'powered');
      if (!w) continue;
      for (const o of spawnOrder(w, seeded(4))) {
        // (en la segunda oleada no hay élite: a todos les toca lo mismo; la marca de los gigantes, si
        // vino antes, les suma vida a unos cuantos)
        if (!o.mods?.giant) expect(o.mods?.hp, o.kind).toBe(POWERED.hp);
        for (const p of SCENARIO_POWERS) if (has(o.mods, p) && !run.powers.includes(p)) outside.add(p);
      }
    }
    expect(outside.size).toBeGreaterThan(0);
  });

  it('el kamikaze sale después de la estampida, de a poco, y solo entre los chicos', () => {
    let small = 0;
    let boom = 0;
    let seed = 1;
    for (const run of runs(30)) {
      for (const w of run.waves) {
        if (!w.kamikaze) {
          // sin estampida antes, nadie explota (salvo en la estampida misma)
          if (!w.explode) for (const o of spawnOrder(w, seeded(seed++))) expect(o.mods?.explode, w.title).toBeUndefined();
          continue;
        }
        // una semilla por oleada: el kamikaze es lo primero que se sortea, con la misma saldrían los mismos
        for (const o of spawnOrder(w, seeded(seed++ * 7919))) {
          if (o.mods?.explode) expect(canTake(o.kind, o.mods), `${w.title}: ${o.kind}`).toBe(true);
          if (o.mods?.explode) expect(ENEMIES[o.kind].hp, w.title).toBeLessThanOrEqual(2);
          // la chance se tira antes de los poderes, entre todos los chicos que pueden explotar
          if (ENEMIES[o.kind].hp <= 2 && canTake(o.kind, { explode: true }) && !o.plain) small++;
          if (o.mods?.explode) boom++;
        }
      }
    }
    // alrededor del 10 % de los chicos que quedan sin otro poder
    expect(boom / small).toBeGreaterThan(KAMIKAZE.chance * 0.5);
    expect(boom / small).toBeLessThan(KAMIKAZE.chance * 2);
  });

  it('la estampida: muchos, chicos, y los que explotan son de los más chicos', () => {
    for (const run of runs(20)) {
      const w = run.waves.find((x) => x.explode);
      if (!w) continue;
      // es la segunda oleada de algún escenario
      expect(w.mod).toBe('stampede');
      expect(run.waves.indexOf(w) % 3).toBe(1);
      const order = spawnOrder(w, seeded(5));
      expect(order.length).toBeGreaterThan(25);
      const exploders = order.filter((o) => o.mods?.explode);
      expect(exploders.length).toBe(Math.round(order.length * w.explode!));
      for (const o of exploders) expect(ENEMIES[o.kind].hp).toBeLessThanOrEqual(2);
    }
  });

  it('sin puntos de dificultad: un poder por oleada, sin olas especiales, apoyos ni kamikazes', () => {
    const rules = rulesFor({});
    for (let r = 1; r <= 30; r++) {
      const run = buildRun(seeded(r), rules);
      expect(run.specials).toEqual([]);
      expect(run.supports).toEqual([]);
      run.waves.forEach((w, i) => {
        expect(w.mod, w.title).toBeUndefined();
        expect(w.supports, w.title).toBeUndefined();
        expect(w.old ?? [], w.title).toEqual([]);
        expect(w.kamikaze || w.giants || w.foreign, w.title).toBeFalsy();
        for (const o of spawnOrder(w, seeded(r * 31 + i))) {
          if (ENEMIES[o.kind].boss) continue;
          // todos más lentos
          expect(o.mods?.speed, o.kind).toBeCloseTo(DIFFICULTY.speed[0]);
          if (!hasPower(o.mods) || o.mods?.size) continue;
          // solo el poder del escenario, más flojo; y en la del jefe, ninguno
          expect(w.focus, `${w.title}: ${o.kind}`).toBeDefined();
          expect(has(o.mods, w.focus!), w.title).toBe(true);
          expect(o.mods?.shield ?? 0).toBeLessThanOrEqual(DIFFICULTY.cap[0]);
          expect(o.mods?.armor ?? 0).toBeLessThanOrEqual(DIFFICULTY.cap[0]);
          if (o.mods?.dodge) expect(o.mods.dodgeEvery).toBeGreaterThan(DODGE.cooldown);
          if (o.mods?.divine) expect(o.mods.divine).toBeGreaterThan(DIVINE.every);
        }
      });
      // el élite, con menos vida
      for (const s of [0, 1, 2]) {
        const e = run.waves[s * 3 + 2].groups.find((g) => g.mods?.size)!;
        expect(e.mods!.hp).toBe(ELITE.hp[s] - DIFFICULTY.eliteHpLess[0]);
      }
    }
  });

  it('los apoyos: con un punto, uno solo en el último escenario; con dos, desde el segundo', () => {
    for (let r = 1; r <= 20; r++) {
      const one = buildRun(seeded(r), rulesFor({ support: 1 }));
      expect(one.supports).toHaveLength(1);
      one.waves.forEach((w) => expect(!!w.supports, w.title).toBe(w.scenario === 2));
      const two = buildRun(seeded(r), rulesFor({ support: 2 }));
      expect(two.supports).toHaveLength(2);
      two.waves.forEach((w) => expect(!!w.supports, w.title).toBe(w.scenario === 1 || w.scenario === 2));
      // con escolta, el jefe trae los poderes de la partida y los apoyos
      const escort = buildRun(seeded(r), rulesFor({ support: 2, escort: 1 }));
      expect(escort.waves[9].old).toEqual(escort.powers);
      expect(escort.waves[9].supports?.map((s) => s.key)).toEqual(escort.supports);
    }
  });

  it('el escudo y el blindaje suben con el escenario, sin pasar de 3', () => {
    const levels = (scenario: number, key: 'shield' | 'armor') => {
      const seen = new Set<number>();
      for (const run of runs(40)) {
        for (const w of run.waves.filter((x) => x.scenario === scenario)) {
          for (const o of spawnOrder(w, seeded(7))) if (o.mods?.[key] && !w.groups.some((g) => g.mods === o.mods)) seen.add(o.mods[key]!);
        }
      }
      return seen;
    };
    expect([...levels(0, 'shield')]).toEqual([1]);
    expect([...levels(0, 'armor')]).toEqual([1]);
    expect(Math.max(...levels(2, 'shield'))).toBe(3);
    expect(Math.max(...levels(3, 'armor'))).toBe(3);
    // en cada oleada, los escudos van de menor a mayor
    for (const run of runs(10)) {
      for (const w of run.waves) {
        const ls = arrivalOrder(spawnOrder(w, seeded(9)), w.interval).map((o) => o.mods?.shield).filter((l): l is number => !!l && l < SHIELD_WALL);
        expect(ls).toEqual([...ls].sort((a, b) => a - b));
      }
    }
  });

  it('los topes: nada imposible con el mejor golpe en 4', () => {
    expect(canTake('knight', { ethereal: true })).toBe(true);
    // al goblin, de 1 de vida, el etéreo no le cambia nada: no lo lleva
    expect(canTake('goblin', { ethereal: true })).toBe(false);
    expect(canTake('goblina', { ethereal: true })).toBe(true);
    expect(canTake('stoneling', { ethereal: true })).toBe(false);
    expect(ENEMIES.stoneling.hp).toBeGreaterThan(LIMITS.etherealMaxHp);
    expect(canTake('skeleton', { armor: 3 })).toBe(true);
    expect(canTake('warchief', { armor: 3 })).toBe(false);
    expect(canTake('stoneling', { armor: 2 })).toBe(true);
  });

  it('cavar no sale en ninguna partida', () => {
    for (const run of runs(20)) for (const w of run.waves) for (const o of spawnOrder(w, seeded(2))) expect(o.mods?.dig).toBeUndefined();
  });

  it('spawnOrder respeta las cantidades y mezcla los grupos', () => {
    const run = buildRun(seeded(4));
    for (const wave of run.waves) {
      const order = spawnOrder(wave).map((s) => s.kind);
      for (const g of wave.groups) {
        const total = wave.groups.filter((o) => o.kind === g.kind).reduce((n, o) => n + o.count, 0);
        expect(order.filter((k) => k === g.kind).length).toBe(total);
      }
    }
    const mixed = arrivalOrder(spawnOrder(run.waves[1]), run.waves[1].interval).map((s) => s.kind);
    expect(mixed.slice(0, 4)).toContain('goblina');
    expect(mixed.slice(0, 4)).toContain('goblin');
  });

  it('el jefe y el alma en pena llegan hacia la mitad de la oleada', () => {
    const run = buildRun(seeded(4));
    const order = arrivalOrder(spawnOrder(run.waves[9]), run.waves[9].interval).map((s) => s.kind);
    for (const kind of ['golem', 'wraith'] as const) {
      const at = order.indexOf(kind) / order.length;
      expect(at).toBeGreaterThan(0.25);
      expect(at).toBeLessThan(0.75);
    }
  });

  it('ningún pesado sale antes que el primer liviano: no queda uno solo al principio', () => {
    for (const run of runs(10)) {
      for (const w of run.waves) {
        const order = spawnOrder(w, seeded(6));
        let t = 0;
        const times = order.map((s, i) => (t += i ? s.delay ?? w.interval : 0));
        const firstLight = Math.min(...order.map((s, i) => (ENEMIES[s.kind].speed >= HEAVY_SPEED ? times[i] : Infinity)));
        order.forEach((s, i) => { if (ENEMIES[s.kind].speed < HEAVY_SPEED) expect(times[i], `${w.title} ${s.kind}`).toBeGreaterThanOrEqual(firstLight - 1e-9); });
      }
    }
  });

  it('los lentos salen antes: el grande del final llega con el montón, no solo', () => {
    for (const run of runs(10)) {
      for (const w of run.waves) {
        const order = spawnOrder(w, seeded(6));
        const t = arrivals(order, w.interval).filter((_, k) => !ENEMIES[order[k].kind].boss).sort((a, b) => a - b);
        // llegan con el ritmo de la oleada: uno por intervalo (o menos, donde está el jefe), sin huecos
        for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1], w.title).toBeLessThanOrEqual(2 * w.interval + 1e-9);
      }
    }
  });

  it('el daño crece con la vida, igual al golfista que a la puerta; el élite mata de una', () => {
    const want: Partial<Record<EnemyKind, number>> = { goblin: 1, goblina: 1, orc: 2, skeleton: 2, warchief: 2, shaman: 2, knight: 3, stoneling: 3 };
    for (const [kind, d] of Object.entries(want) as [EnemyKind, number][]) {
      expect(ENEMIES[kind].damage, kind).toBe(d);
      expect(ENEMIES[kind].gateDamage, kind).toBe(d);
    }
    // el élite mata de una, a la puerta y al golfista
    expect(ELITE.damage).toBe(Number.POSITIVE_INFINITY);
  });

  it('la vida de los cuerpos es una escalera: cada uno pega un salto sobre el anterior', () => {
    LADDER.forEach((k, i) => { if (i) expect(ENEMIES[k].hp, k).toBeGreaterThan(ENEMIES[LADDER[i - 1]].hp); });
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
    expect(canTake('shaman', { explode: true })).toBe(true);
    expect(behaviorOf(ENEMIES.shaman, {})).toBe('melee');
    expect(behaviorOf(ENEMIES.knight, { dodge: true })).toBe('melee');
    expect(canTake('wraith', { dodge: true })).toBe(true);
    expect(canTake('golem', { dodge: true })).toBe(false);
  });

  it('todos los enemigos de las oleadas están definidos', () => {
    for (const run of runs(10)) for (const wave of run.waves) for (const g of wave.groups) expect(ENEMIES[g.kind].mesh).toMatch(/^Character_/);
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
    const wave: Wave = { title: 'm', interval: 1, scenario: 0, groups: [{ kind: 'skeleton', count: 2, mods: { armor: 2 } }, { kind: 'goblin', count: 1 }] };
    const order = spawnOrder(wave);
    expect(order.filter((s) => s.kind === 'skeleton').every((s) => s.mods?.armor === 2)).toBe(true);
    expect(order.find((s) => s.kind === 'goblin')?.mods).toBeUndefined();
  });
});
