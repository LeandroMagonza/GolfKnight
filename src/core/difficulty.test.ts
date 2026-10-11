import { describe, expect, it, vi } from 'vitest';
import { choiceAt, choose, DIFFICULTY, earnLevel, hillsOn, LADDER, ladderFrom, loadProgress, MAX_LEVEL, optionText, picksOf, rulesFor, setLevel, stepOf, TALENTS, type Progress } from './difficulty';
import { ELITE, HARDEST, INTERMISSION } from './waves';

describe('dificultad', () => {
  it('doce talentos, dieciocho pasos: la velocidad tiene tres, y olas especiales, apoyos, más con poder y la recarga lenta, dos', () => {
    expect(TALENTS).toHaveLength(12);
    expect(TALENTS.reduce((n, t) => n + t.levels.length, 0)).toBe(18);
    expect(TALENTS.filter((t) => t.levels.length === 3).map((t) => t.id)).toEqual(['speed']);
    expect(TALENTS.filter((t) => t.levels.length === 2).map((t) => t.id).sort()).toEqual(['cooldown', 'powered', 'special', 'support']);
    expect(TALENTS.find((t) => t.id === 'cooldown')!.levels.map((f) => f())).toEqual(['Tus habilidades tardan un 50 % más en recargar', 'Tus habilidades tardan el doble en recargar']);
    for (const t of TALENTS) for (const text of t.levels) expect(text(), t.id).not.toBe('');
    expect(TALENTS.find((t) => t.id === 'powered')!.levels[0]()).toBe('Un tercio de los enemigos trae poder, en vez de un cuarto');
    expect(TALENTS.find((t) => t.id === 'powered')!.levels[1]()).toBe('La mitad de los enemigos trae poder');
    expect(TALENTS.find((t) => t.id === 'elite')!.levels[0]()).toBe('Los élites tienen 4 de vida más');
  });

  it('sin puntos es la partida más simple; con todos, la más difícil', () => {
    const easy = rulesFor({});
    expect(easy).toMatchObject({ stack: false, specials: 0, supports: 0, escort: false, rest: INTERMISSION, speed: DIFFICULTY.speed[0], share: DIFFICULTY.share[0] });
    expect(easy.hard.cap).toBe(2);
    expect(easy.hard.recharge).toBeGreaterThan(1);
    expect(easy.hard).toMatchObject({ armorRolls: 1, regen: DIFFICULTY.regen[0], shut: 1, ghostHp: 0, ghostEliteHp: 0 });
    expect(easy.cooldown).toBe(1);
    expect(easy.eliteHp).toEqual(ELITE.hp.map((h) => h - 2));
    const all = Object.fromEntries(TALENTS.map((t) => [t.id, t.levels.length]));
    // el golpe 4 es aparte: no existía antes del 3/10
    const hard = rulesFor({ ...all, fourth: 0 });
    // lo mismo que la de antes del 3/10 en todo, salvo que va más rápido, descansa menos, la mitad trae
    // poder y las habilidades recargan el doble de lento
    expect({ ...hard, speed: 1, rest: INTERMISSION, share: HARDEST.share, cooldown: 1 }).toEqual(HARDEST);
    expect(hard.cooldown).toBe(2);
    expect(rulesFor({ cooldown: 1 }).cooldown).toBe(1.5);
    expect(hard.speed).toBeGreaterThan(1);
    expect(hard.rest).toBeLessThan(INTERMISSION);
    expect(hard.share).toBe(0.5);
    // con tres puntos de velocidad, lo que antes era con dos
    expect(rulesFor({ speed: 3 }).speed).toBe(1.12);
    expect(rulesFor({ speed: 2 }).speed).toBe(1);
    // y un número de más no pasa del máximo
    expect(rulesFor({ special: 9 }).specials).toBe(2);
    // un solo punto en poderes más duros pone todo: escudos hasta 3, más blindajes de 2, la recarga de
    // siempre, el que se cura y el intocable más duros, y el fantasma con 1 de vida más
    expect(rulesFor({ powers: 1 }).hard).toEqual(HARDEST.hard);
    expect(HARDEST.hard).toMatchObject({ cap: 3, armorRolls: 2, recharge: 1, regen: 1, ghostHp: 1, ghostEliteHp: 2 });
    expect(HARDEST.hard.shut).toBeGreaterThan(1);
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

  it('la escalera: diez escalones, ningún talento más veces que sus niveles, y todos los pasos en algún escalón', () => {
    expect(MAX_LEVEL).toBe(10);
    expect(LADDER).toHaveLength(MAX_LEVEL);
    const times: Record<string, number> = {};
    for (const options of LADDER) {
      // en un mismo escalón no se repite un talento
      expect(new Set(options).size).toBe(options.length);
      expect(options.length).toBeGreaterThanOrEqual(1);
      expect(options.length).toBeLessThanOrEqual(3);
      for (const id of options) times[id] = (times[id] ?? 0) + 1;
    }
    for (const t of TALENTS) expect(times[t.id], t.id).toBe(t.levels.length);
  });

  it('cada opción elegida suma un paso a su talento; lo de los escalones sin poner no cuenta', () => {
    const p: Progress = { unlocked: MAX_LEVEL, level: 0, choices: [] };
    expect(picksOf(p)).toEqual({});
    p.level = 2;
    expect(picksOf(p)).toEqual({ [LADDER[0][0]]: 1, speed: 1 });
    // la velocidad está en tres escalones: con los tres, el paso 3
    p.level = MAX_LEVEL;
    expect(picksOf(p).speed).toBe(3);
    expect(rulesFor(picksOf(p)).speed).toBe(DIFFICULTY.speed[3]);
    // en el séptimo, la recarga lenta en vez de la velocidad: un paso menos de velocidad
    const i = LADDER.findIndex((o, j) => j > 1 && o.includes('speed') && o.includes('cooldown'));
    expect(choose(p, i, LADDER[i].indexOf('cooldown'))).toBe(true);
    expect(picksOf(p).speed).toBe(2);
    expect(picksOf(p).cooldown).toBe(1);
  });

  it('el nombre y la línea de la opción dicen el paso que da: el segundo «Más rápidos» es el II', () => {
    const p: Progress = { unlocked: MAX_LEVEL, level: MAX_LEVEL, choices: [] };
    const second = LADDER.findIndex((o, j) => j > 1 && o.includes('speed'));
    const o = LADDER[second].indexOf('speed');
    expect(stepOf(p, second, o)).toBe(2);
    expect(optionText(p, second, o)).toEqual({ name: 'Más rápidos II', line: 'Los enemigos caminan más rápido todavía' });
    expect(optionText(p, 1, 0)).toEqual({ name: 'Más rápidos', line: 'Los enemigos caminan más rápido' });
    // sin el primero puesto, el segundo es el paso 1
    p.level = 0;
    expect(stepOf(p, second, o)).toBe(1);
    // todas las líneas dicen algo
    for (let i = 0; i < MAX_LEVEL; i++) for (let k = 0; k < LADDER[i].length; k++) expect(optionText(p, i, k).line).not.toBe('');
  });

  it('elegir en un escalón desbloqueado lo pone (y a los de antes); arriba de lo desbloqueado, no', () => {
    const p: Progress = { unlocked: 3, level: 0, choices: [] };
    expect(choose(p, 3, 0)).toBe(false);
    expect(choose(p, 2, 1)).toBe(true);
    expect(p.level).toBe(3);
    expect(choiceAt(p, 2)).toBe(1);
    // cambiar uno de abajo no baja el nivel
    expect(choose(p, 0, 1)).toBe(true);
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
    // la primera victoria, en el nivel 0: desbloquea el 1
    expect(earnLevel(p)).toBe(true);
    expect(p.unlocked).toBe(1);
    // ganar otra vez sin subir no da
    expect(earnLevel(p)).toBe(false);
    setLevel(p, 1);
    expect(earnLevel(p)).toBe(true);
    expect(p.unlocked).toBe(2);
    // y no pasa del último
    const top: Progress = { unlocked: MAX_LEVEL, level: MAX_LEVEL, choices: [] };
    expect(earnLevel(top)).toBe(false);
  });

  it('?escalera=0,1,0 es el nivel 3 con esas opciones, todo desbloqueado', () => {
    const p = ladderFrom('0,1,0');
    expect(p.level).toBe(3);
    expect(p.unlocked).toBe(MAX_LEVEL);
    expect(choiceAt(p, 0)).toBe(0);
    expect(choiceAt(p, 1)).toBe(0); // el segundo tiene una sola: la 1 no existe
    expect(choiceAt(p, 2)).toBe(0);
    expect(ladderFrom('').level).toBe(0);
  });

  it('sin localStorage arranca de cero', () => {
    expect(loadProgress()).toEqual({ unlocked: 0, level: 0, choices: LADDER.map(() => 0) });
  });

  it('lo guardado con puntos (antes del 11/10) pasa a la escalera en la misma proporción, con lo que tenía puesto', () => {
    const store: Record<string, string> = { 'gk.dificultad': JSON.stringify({ points: 9, picks: { speed: 2, elite: 1, powers: 1 } }) };
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } });
    try {
      const p = loadProgress();
      // 9 de 18 puntos: 5 de 10 niveles; 4 puestos: el nivel 2
      expect(p.unlocked).toBe(5);
      expect(p.level).toBe(2);
      expect(LADDER[0][choiceAt(p, 0)]).toBe('elite');
      expect(picksOf(p)).toEqual({ elite: 1, speed: 1 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
