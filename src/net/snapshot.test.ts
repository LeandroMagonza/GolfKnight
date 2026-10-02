import { describe, expect, it } from 'vitest';
import { DELAY_MS, encodeArgs, EventQueue, HostClock, lerpAngle, Timeline } from './snapshot';

describe('las fotos en el tiempo', () => {
  const tl = () => {
    const t = new Timeline<{ t: number; x: number }>();
    t.push({ t: 100, x: 0 });
    t.push({ t: 200, x: 10 });
    return t;
  };

  it('entre dos fotos, la mezcla de las dos', () => {
    const s = tl().sample(150)!;
    expect(s.a.x).toBe(0);
    expect(s.b.x).toBe(10);
    expect(s.u).toBeCloseTo(0.5);
  });

  it('antes de la primera, la primera; después de la última, quieto en la última', () => {
    expect(tl().sample(50)!.u).toBe(0);
    const s = tl().sample(400)!;
    expect(s.a.x).toBe(10);
    expect(s.b.x).toBe(10);
  });

  it('la que llega desordenada se acomoda', () => {
    const t = tl();
    t.push({ t: 150, x: 5 });
    expect(t.frames.map((f) => f.t)).toEqual([100, 150, 200]);
    expect(t.sample(175)!.a.x).toBe(5);
  });

  it('guarda un segundo de historia', () => {
    const t = new Timeline<{ t: number }>();
    for (let i = 0; i <= 3000; i += 50) t.push({ t: i });
    expect(t.frames[0].t).toBeGreaterThanOrEqual(2000);
  });
});

describe('la hora del que juega', () => {
  it('dibuja un poco atrasado respecto de lo último que llegó', () => {
    const c = new HostClock();
    c.sync(5000, 1000);
    expect(c.renderTime(1000)).toBe(5000 - DELAY_MS);
  });

  it('una foto que llega tarde no lo atrasa de golpe', () => {
    const c = new HostClock();
    c.sync(5000, 1000);
    c.sync(5100, 1300); // tardó 200 ms más
    expect(c.renderTime(1300)).toBeGreaterThan(5100 + 200 - DELAY_MS - 10);
  });
});

describe('los eventos esperan su hora', () => {
  it('salen los que ya tocan, en orden', () => {
    const q = new EventQueue<{ t: number; n: string }>();
    q.push({ t: 300, n: 'c' });
    q.push({ t: 100, n: 'a' });
    q.push({ t: 200, n: 'b' });
    expect(q.due(250).map((e) => e.n)).toEqual(['a', 'b']);
    expect(q.size).toBe(1);
    expect(q.due(1000).map((e) => e.n)).toEqual(['c']);
  });
});

describe('cuentas', () => {
  it('el ángulo va por el camino corto', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
  });

  it('los vectores viajan como listas', () => {
    const v = { isVector3: true, x: 1.234, y: 0, z: -2 };
    expect(encodeArgs([v, 3, 'x'])).toEqual([{ v: [1.23, 0, -2] }, 3, 'x']);
  });
});
