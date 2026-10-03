import { describe, expect, it } from 'vitest';
import { DIFFICULTY, earnPoint, loadProgress, MAX_POINTS, rulesFor, setLevel, TALENTS, used, type Progress } from './difficulty';
import { ELITE, HARDEST, INTERMISSION } from './waves';

describe('dificultad', () => {
  it('nueve talentos, trece puntos: los de dos niveles son olas especiales, apoyos, poderes y velocidad', () => {
    expect(TALENTS).toHaveLength(9);
    expect(MAX_POINTS).toBe(13);
    expect(TALENTS.filter((t) => t.levels.length === 2).map((t) => t.id).sort()).toEqual(['powers', 'special', 'speed', 'support']);
    for (const t of TALENTS) for (const text of t.levels) expect(text(), t.id).not.toBe('');
    expect(TALENTS.find((t) => t.id === 'powered')!.levels[0]()).toBe('Un tercio de los enemigos trae poder, en vez de un cuarto');
    expect(TALENTS.find((t) => t.id === 'elite')!.levels[0]()).toBe('Los élites tienen 2 de vida más');
  });

  it('sin puntos es la partida más simple; con todos, la más difícil', () => {
    const easy = rulesFor({});
    expect(easy).toMatchObject({ stack: false, specials: 0, supports: 0, escort: false, rest: INTERMISSION, speed: DIFFICULTY.speed[0], share: DIFFICULTY.share[0] });
    expect(easy.hard.cap).toBe(2);
    expect(easy.hard.recharge).toBeGreaterThan(1);
    expect(easy.eliteHp).toEqual(ELITE.hp.map((h) => h - 2));
    const all = Object.fromEntries(TALENTS.map((t) => [t.id, t.levels.length]));
    const hard = rulesFor(all);
    // lo mismo que la de antes del 3/10 en todo, salvo que va más rápido y descansa menos
    expect({ ...hard, speed: 1, rest: INTERMISSION }).toEqual(HARDEST);
    expect(hard.speed).toBeGreaterThan(1);
    expect(hard.rest).toBeLessThan(INTERMISSION);
    // y un número de más no pasa del máximo
    expect(rulesFor({ special: 9 }).specials).toBe(2);
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
