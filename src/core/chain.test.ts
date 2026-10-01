import { describe, expect, it } from 'vitest';
import { chainJumps, type ChainPoint } from './chain';

/** Una fila de enemigos uno al lado del otro, cada `gap` metros. */
const row = (n: number, gap = 2): ChainPoint[] => Array.from({ length: n }, (_, i) => ({ id: i, x: i * gap, z: 30 }));
const hit = (jumps: ReturnType<typeof chainJumps>) => jumps.map((j) => j.to.id).sort();

describe('la cadena del rayo', () => {
  it('tres en fila y la pelota en el de la punta: el rayo va al del medio y de ahí al otro', () => {
    const r = row(3);
    const jumps = chainJumps(r[0], r, 2, 6);
    expect(jumps.map((j) => [j.from.id, j.to.id])).toEqual([[0, 1], [1, 2]]);
  });

  it('cinco en fila y la pelota en el del medio: una rama para cada lado, y el rayo le pega a los otros cuatro', () => {
    const r = row(5);
    const jumps = chainJumps(r[2], r, 2, 6);
    expect(hit(jumps)).toEqual([0, 1, 3, 4]);
    // primero un salto de cada rama, después el segundo de cada una
    expect(jumps.slice(0, 2).every((j) => j.from.id === 2)).toBe(true);
  });

  it('nunca le pega dos veces al mismo, ni vuelve al que lo largó', () => {
    const r = row(6, 1);
    for (let k = 0; k < r.length; k++) {
      const ids = chainJumps(r[k], r, 5, 6).map((j) => j.to.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain(k);
    }
  });

  it('dos en fila: el rayo de cada uno le pega al otro', () => {
    const r: ChainPoint[] = [{ id: 0, x: 0, z: 30 }, { id: 1, x: 0, z: 32 }];
    expect(hit(chainJumps(r[0], r, 1, 6))).toEqual([1]);
    expect(hit(chainJumps(r[1], r, 1, 6))).toEqual([0]);
  });

  it('no salta más lejos que su alcance', () => {
    const r = row(3, 7);
    expect(chainJumps(r[0], r, 3, 6)).toEqual([]);
  });
});
