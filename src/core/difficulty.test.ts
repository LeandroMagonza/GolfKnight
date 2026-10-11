import { describe, expect, it, vi } from 'vitest';
import { choiceAt, choose, defaultChoice, DIFFICULTY, earnLevel, hillsOn, LADDER, ladderFrom, loadProgress, MAX_LEVEL, optionText, picksOf, rulesFor, saveProgress, setLevel, talent, TALENTS, type Progress } from './difficulty';
import { ELITE, HARDEST, INTERMISSION } from './waves';

/** localStorage de mentira, para cargar y guardar. */
function withStore(store: Record<string, string>, f: () => void): void {
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } });
  try {
    f();
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('dificultad', () => {
  it('trece talentos; los que se suman dicen su número, y los demás, siempre lo mismo', () => {
    expect(TALENTS).toHaveLength(13);
    expect(TALENTS.filter((t) => t.adds).map((t) => t.id).sort()).toEqual(['casters', 'cooldown', 'speed']);
    expect(talent('speed').text(0.15)).toBe('Los enemigos caminan un 15 % más rápido');
    expect(talent('cooldown').text(0.35)).toBe('Tus habilidades tardan un 35 % más en recargar');
    expect(talent('casters').text(0.1)).toMatch(/^Se suma un 10 % de hechiceros/);
    expect(talent('powered').text(0)).toBe('Un tercio de los enemigos trae poder, en vez de un cuarto');
    expect(talent('elite').text(0)).toBe('Los élites tienen 4 de vida más');
    for (const t of TALENTS) expect(t.text(0.1), t.id).not.toBe('');
  });

  it('en el nivel 0 es la partida más simple', () => {
    const easy = rulesFor({});
    expect(easy).toMatchObject({ stack: false, specials: 0, supports: 0, escort: false, rest: INTERMISSION, speed: DIFFICULTY.speedBase, share: DIFFICULTY.share[0], cooldown: 1, casters: 0 });
    expect(easy.hard.cap).toBe(2);
    expect(easy.hard.recharge).toBeGreaterThan(1);
    expect(easy.hard).toMatchObject({ armorRolls: 1, regen: DIFFICULTY.regen[0], ghostHp: 0, ghostEliteHp: 0 });
    expect(easy.eliteHp).toEqual(ELITE.hp.map((h) => h - 2));
  });

  it('los que se suman: la velocidad, la recarga y los hechiceros suman los números de sus opciones', () => {
    expect(rulesFor({ speed: 0.25 }).speed).toBeCloseTo(DIFFICULTY.speedBase * 1.25);
    expect(rulesFor({ cooldown: 1 }).cooldown).toBe(2);
    expect(rulesFor({ casters: 0.25 }).casters).toBe(0.25);
    // los demás cuentan, hasta su máximo
    expect(rulesFor({ special: 9 }).specials).toBe(2);
    expect(rulesFor({ support: 2 }).supports).toBe(2);
    // con todo lo de antes del 3/10 (dos olas especiales, apoyos en dos escenarios, acumulados, escolta,
    // poderes más duros y los élites con su vida), es la partida de entonces, salvo la velocidad, el
    // descanso, cuántos traen poder, la recarga y los hechiceros, que no existían
    const old = rulesFor({ stack: 1, special: 2, support: 2, powers: 1, escort: 1, elite: 1 });
    expect({ ...old, speed: 1, rest: INTERMISSION, share: HARDEST.share, cooldown: 1, casters: undefined }).toEqual(HARDEST);
    // un solo «Poderes más duros» pone todo: escudos hasta 3, más blindajes de 2, la recarga de siempre,
    // el que se cura y el intocable más duros, y el fantasma con 1 de vida más
    expect(rulesFor({ powers: 1 }).hard).toEqual(HARDEST.hard);
    expect(HARDEST.hard).toMatchObject({ cap: 3, armorRolls: 2, recharge: 1, regen: 1, ghostHp: 1, ghostEliteHp: 2 });
  });

  it('el golpe 4: lo prende, y todos traen vida de más (los élites y el jefe, más)', () => {
    const off = rulesFor({});
    const on = rulesFor({ fourth: 1 });
    expect(off).toMatchObject({ fourth: false, extraHp: 0, bossHp: 0 });
    expect(on).toMatchObject({ fourth: true, extraHp: DIFFICULTY.fourthHp, bossHp: DIFFICULTY.fourthBossHp });
    expect(on.eliteHp).toEqual(off.eliteHp.map((h) => h + DIFFICULTY.fourthEliteHp));
    expect(DIFFICULTY.fourthEliteHp).toBeGreaterThan(DIFFICULTY.fourthHp);
  });

  it('sin el talento se juega en el campo liso', () => {
    expect(hillsOn({})).toBe(false);
    expect(hillsOn({ terrain: 1 })).toBe(true);
  });

  it('la escalera: diez escalones de una a tres opciones, todos los talentos, y el golpe 4 al final y solo', () => {
    expect(MAX_LEVEL).toBe(10);
    expect(LADDER).toHaveLength(MAX_LEVEL);
    const times: Record<string, number> = {};
    for (const options of LADDER) {
      expect(options.length).toBeGreaterThanOrEqual(1);
      expect(options.length).toBeLessThanOrEqual(3);
      // en un mismo escalón no se repite un talento
      expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
      for (const o of options) {
        times[o.id] = (times[o.id] ?? 0) + 1;
        // los que se suman traen su número; los demás, no
        expect(o.add !== undefined, o.id).toBe(!!talent(o.id).adds);
      }
    }
    for (const t of TALENTS) {
      expect(times[t.id], t.id).toBeGreaterThanOrEqual(1);
      if (!t.adds) expect(times[t.id], t.id).toBeLessThanOrEqual(t.max);
    }
    expect(LADDER[MAX_LEVEL - 1]).toEqual([{ id: 'fourth' }]);
    // los «Más rápidos» de más arriba suman más (Leandro)
    const speeds = LADDER.flat().filter((o) => o.id === 'speed').map((o) => o.add!);
    expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
    expect(new Set(speeds).size).toBe(speeds.length);
  });

  it('de entrada, la opción del medio (con dos, la de arriba)', () => {
    const p: Progress = { unlocked: MAX_LEVEL, level: MAX_LEVEL, choices: [] };
    LADDER.forEach((options, i) => {
      expect(choiceAt(p, i)).toBe(defaultChoice(i));
      expect(defaultChoice(i)).toBe(options.length === 3 ? 1 : 0);
    });
  });

  it('cada opción hace lo suyo, se haya elegido lo que se haya elegido en los otros escalones', () => {
    const p: Progress = { unlocked: MAX_LEVEL, level: 0, choices: [] };
    expect(picksOf(p)).toEqual({});
    p.level = 2;
    expect(picksOf(p)).toEqual({ elite: 1, speed: LADDER[1][0].add });
    // los hechiceros del 8, sin los del 6: dicen y hacen lo mismo que con ellos
    const six = LADDER.findIndex((o) => o.some((x) => x.id === 'casters'));
    const eight = LADDER.findIndex((o, j) => j > six && o.some((x) => x.id === 'casters'));
    const c8 = LADDER[eight].findIndex((x) => x.id === 'casters');
    const c6 = LADDER[six].findIndex((x) => x.id === 'casters');
    p.level = MAX_LEVEL;
    const before = optionText(eight, c8);
    choose(p, eight, c8);
    const alone = picksOf(p).casters;
    choose(p, six, c6);
    expect(optionText(eight, c8)).toEqual(before);
    expect(picksOf(p).casters).toBeCloseTo((alone ?? 0) + LADDER[six][c6].add!);
    expect(alone).toBe(LADDER[eight][c8].add);
  });

  it('elegir en un escalón desbloqueado lo pone (y a los de antes); arriba de lo desbloqueado, no', () => {
    const p: Progress = { unlocked: 3, level: 0, choices: [] };
    expect(choose(p, 3, 0)).toBe(false);
    expect(choose(p, 2, 1)).toBe(true);
    expect(p.level).toBe(3);
    expect(choiceAt(p, 2)).toBe(1);
    // cambiar uno de abajo no baja el nivel
    expect(choose(p, 0, 0)).toBe(true);
    expect(p.level).toBe(3);
    // el nivel, sin pasar de lo desbloqueado
    expect(setLevel(p, 5)).toBe(false);
    expect(setLevel(p, 1)).toBe(true);
    expect(p.level).toBe(1);
    // lo elegido arriba se recuerda
    expect(choiceAt(p, 2)).toBe(1);
  });

  it('ganar en el nivel más alto desbloquea el siguiente; más abajo, no', () => {
    const p: Progress = { unlocked: 0, level: 0, choices: [] };
    expect(earnLevel(p)).toBe(true);
    expect(p.unlocked).toBe(1);
    expect(earnLevel(p)).toBe(false);
    setLevel(p, 1);
    expect(earnLevel(p)).toBe(true);
    expect(p.unlocked).toBe(2);
    const top: Progress = { unlocked: MAX_LEVEL, level: MAX_LEVEL, choices: [] };
    expect(earnLevel(top)).toBe(false);
  });

  it('?escalera=0,1,0 es el nivel 3 con esas opciones, todo desbloqueado', () => {
    const p = ladderFrom('0,1,0');
    expect(p.level).toBe(3);
    expect(p.unlocked).toBe(MAX_LEVEL);
    expect(choiceAt(p, 0)).toBe(0);
    expect(choiceAt(p, 1)).toBe(0); // el segundo tiene una sola: la 1 no existe, va la de entrada
    expect(choiceAt(p, 2)).toBe(0);
    expect(ladderFrom('-,-').level).toBe(2);
    expect(choiceAt(ladderFrom('-'), 0)).toBe(defaultChoice(0));
    expect(ladderFrom('').level).toBe(0);
  });

  it('sin localStorage arranca de cero, con las opciones de entrada', () => {
    const p = loadProgress();
    expect(p).toMatchObject({ unlocked: 0, level: 0 });
    LADDER.forEach((_, i) => expect(choiceAt(p, i)).toBe(defaultChoice(i)));
  });

  it('se guarda y se carga igual', () => {
    const store: Record<string, string> = {};
    withStore(store, () => {
      const p: Progress = { unlocked: 6, level: 4, choices: [] };
      choose(p, 2, 1);
      saveProgress(p);
      const back = loadProgress();
      expect(back.unlocked).toBe(6);
      expect(back.level).toBe(4);
      expect(choiceAt(back, 2)).toBe(1);
      expect(choiceAt(back, 0)).toBe(defaultChoice(0));
    });
  });

  it('lo de la primera escalera (sin versión) queda con lo desbloqueado, y las opciones de entrada', () => {
    withStore({ 'gk.dificultad': JSON.stringify({ unlocked: 5, level: 3, choices: [2, 0, 1, 0, 0, 0, 0, 0, 0, 0] }) }, () => {
      const p = loadProgress();
      expect(p).toMatchObject({ unlocked: 5, level: 3 });
      LADDER.forEach((_, i) => expect(choiceAt(p, i)).toBe(defaultChoice(i)));
    });
  });

  it('lo guardado con puntos (antes de la escalera) pasa en la misma proporción, con lo que tenía puesto', () => {
    withStore({ 'gk.dificultad': JSON.stringify({ points: 9, picks: { speed: 2, elite: 1, powers: 1 } }) }, () => {
      const p = loadProgress();
      // 9 de 18 puntos: 5 de 10 niveles; 4 puestos: el nivel 2
      expect(p.unlocked).toBe(5);
      expect(p.level).toBe(2);
      expect(LADDER[0][choiceAt(p, 0)].id).toBe('elite');
      expect(picksOf(p)).toEqual({ elite: 1, speed: LADDER[1][0].add });
    });
  });
});
