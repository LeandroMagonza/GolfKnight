import { describe, expect, it } from 'vitest';
import { BeatGrid } from './beat';

/** Marca los pulsos como la canción: uno tras otro, con el tempo que devuelve cada uno. */
function play(grid: BeatGrid, beats: number, from = 0): number {
  let t = from;
  for (let i = 0; i < beats; i++) t += 60 / grid.mark(t).bpm;
  return t;
}

describe('la grilla de pulsos del jefe con música', () => {
  it('el tempo pedido entra recién al empezar el compás', () => {
    const g = new BeatGrid(120);
    play(g, 2);
    g.want(150, 1);
    expect(g.mark(1).bpm).toBe(120);
    expect(g.mark(1.5).bpm).toBe(120);
    const uno = g.mark(2);
    expect(uno.n).toBe(4);
    expect(uno.bpm).toBe(150);
    expect(g.phase).toBe(1);
  });

  it('cuánto le erró al pulso más cercano, antes o después', () => {
    const g = new BeatGrid(120);
    play(g, 8);
    expect(g.offset(1.04)).toBeCloseTo(0.04);
    expect(g.offset(1.46)).toBeCloseTo(-0.04);
    expect(g.prev(1.2)!.t).toBeCloseTo(1);
    expect(g.next(1.2)!.t).toBeCloseTo(1.5);
  });

  it('más allá de lo marcado, estima los que vienen con el tempo pedido', () => {
    const g = new BeatGrid(120);
    play(g, 4);
    g.want(60);
    // marcados: 0, .5, 1, 1.5; el próximo (2) empieza compás y va a 60: el siguiente cae en 3
    expect(g.next(1.6)!.t).toBeCloseTo(2);
    expect(g.next(2.1)!.t).toBeCloseTo(3);
    expect(g.offset(2.95)).toBeCloseTo(-0.05);
  });
});
