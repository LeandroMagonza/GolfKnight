import { describe, expect, it } from 'vitest';
import { DIFFICULTY, earnPoint, hillsOn, loadProgress, MAX_POINTS, rulesFor, setLevel, TALENTS, used, type Progress } from './difficulty';
import { ELITE, HARDEST, INTERMISSION } from './waves';

describe('dificultad', () => {
  it('once talentos, dieciséis puntos: la velocidad tiene tres, y olas especiales, apoyos y más con poder, dos', () => {
    expect(TALENTS).toHaveLength(11);
    expect(MAX_POINTS).toBe(16);
    expect(TALENTS.filter((t) => t.levels.length === 3).map((t) => t.id)).toEqual(['speed']);
    expect(TALENTS.filter((t) => t.levels.length === 2).map((t) => t.id).sort()).toEqual(['powered', 'special', 'support']);
    for (const t of TALENTS) for (const text of t.levels) expect(text(), t.id).not.toBe('');
    expect(TALENTS.find((t) => t.id === 'powered')!.levels[0]()).toBe('Un tercio de los enemigos trae poder, en vez de un cuarto');
    expect(TALENTS.find((t) => t.id === 'powered')!.levels[1]()).toBe('La mitad trae poder');
    expect(TALENTS.find((t) => t.id === 'elite')!.levels[0]()).toBe('Los élites tienen 2 de vida más');
  });

  it('sin puntos es la partida más simple; con todos, la más difícil', () => {
    const easy = rulesFor({});
    expect(easy).toMatchObject({ stack: false, specials: 0, supports: 0, escort: false, rest: INTERMISSION, speed: DIFFICULTY.speed[0], share: DIFFICULTY.share[0] });
    expect(easy.hard.cap).toBe(2);
    expect(easy.hard.recharge).toBeGreaterThan(1);
    expect(easy.eliteHp).toEqual(ELITE.hp.map((h) => h - 2));
    const all = Object.fromEntries(TALENTS.map((t) => [t.id, t.levels.length]));
    // el golpe 4 es aparte: no existía antes del 3/10
    const hard = rulesFor({ ...all, fourth: 0 });
    // lo mismo que la de antes del 3/10 en todo, salvo que va más rápido, descansa menos y la mitad trae poder
    expect({ ...hard, speed: 1, rest: INTERMISSION, share: HARDEST.share }).toEqual(HARDEST);
    expect(hard.speed).toBeGreaterThan(1);
    expect(hard.rest).toBeLessThan(INTERMISSION);
    expect(hard.share).toBe(0.5);
    // con tres puntos de velocidad, lo que antes era con dos
    expect(rulesFor({ speed: 3 }).speed).toBe(1.12);
    expect(rulesFor({ speed: 2 }).speed).toBe(1);
    // y un número de más no pasa del máximo
    expect(rulesFor({ special: 9 }).specials).toBe(2);
    // un solo punto en poderes más duros pone todo: escudos hasta 3 y la recarga de siempre
    expect(rulesFor({ powers: 1 }).hard).toEqual(HARDEST.hard);
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

  it('los puntos se ponen sin pasar de los que hay ni del máximo de cada talento', () => {
    const p: Progress = { points: 3, picks: {} };
    expect(setLevel(p, 'special', 2)).toBe(true);
    expect(setLevel(p, 'stack', 1)).toBe(true);
    expect(used(p.picks)).toBe(3);
    // no queda ninguno
    expect(setLevel(p, 'rest', 1)).toBe(false);
    // se puede mover: sacar de uno y poner en otro
    expect(setLevel(p, 'special', 1)).toBe(true);
    expect(setLevel(p, 'rest', 1)).toBe(true);
    // ni más del máximo
    p.points = 10;
    expect(setLevel(p, 'stack', 2)).toBe(false);
    expect(p.picks.stack).toBe(1);
  });

  it('ganar con todos los puntos puestos suma uno; con puntos sin poner, no', () => {
    const p: Progress = { points: 0, picks: {} };
    // la primera victoria, sin puntos: suma
    expect(earnPoint(p)).toBe(true);
    expect(p.points).toBe(1);
    // ganar otra vez sin ponerlo no suma
    expect(earnPoint(p)).toBe(false);
    setLevel(p, 'speed', 1);
    expect(earnPoint(p)).toBe(true);
    expect(p.points).toBe(2);
    // y no pasa del total
    const full: Progress = { points: MAX_POINTS, picks: Object.fromEntries(TALENTS.map((t) => [t.id, t.levels.length])) };
    expect(earnPoint(full)).toBe(false);
  });

  it('sin localStorage arranca de cero', () => {
    expect(loadProgress()).toEqual({ points: 0, picks: {} });
  });
});
