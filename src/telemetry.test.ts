import { describe, expect, it } from 'vitest';
import { releaseStats, summarizeRuns, type MyRun } from './telemetry';

const run = (over: Partial<MyRun> = {}): MyRun => ({
  at: '', level: 0, result: 'defeat', wave: 3, seconds: 120, shots: 40, hits: 30, q: [10, 10, 20, 0], abilities: 4, hurt: 2, gate: 4, ...over,
});

describe('mis números (11/10: para que el bot juegue como una persona)', () => {
  it('por minuto, qué parte pega y qué parte sale con cada golpe; sin las de menos de medio minuto', () => {
    const s = summarizeRuns([run(), run({ result: 'victory', wave: 10, seconds: 360, shots: 120, hits: 100, q: [20, 40, 60, 0] }), run({ seconds: 10 })]);
    expect(s).toMatchObject({ partidas: 2, ganadas: 1, minutos: 8, oleada: 6.5, tirosPorMinuto: 20, pegan: 0.81, golpes: [0.19, 0.31, 0.5, 0], habilidadesPorMinuto: 1, vidaPorMinuto: 0.5, puertaPorMinuto: 1 });
  });

  it('al soltar: antes del fuerte, en el fuerte o pasado, y el desvío de los que buscaban el tope', () => {
    const s = releaseStats([-400, -20, 0, 10, 25, 40, 80]);
    expect(s).toMatchObject({ soltadas: 7, antesDelFuerte: 0.14, enElFuerte: 0.57, pasado: 0.29 });
    // el de −400 no buscaba el tope: no entra en el promedio
    expect(s.cercaPromedioMs).toBe(23);
    const bins = s.cadaVeinticincoMs as number[];
    expect(bins.reduce((a, b) => a + b, 0)).toBe(7);
    // todo lo de antes de −250, en el primero
    expect(bins[0]).toBe(1);
    expect(releaseStats([])).toEqual({ soltadas: 0 });
  });
});
