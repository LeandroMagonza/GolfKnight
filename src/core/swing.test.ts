import { describe, expect, it } from 'vitest';
import { CHARGE, qualityMarks, qualityOf, QUALITY_FROM } from './clubs';
import { arcAngle, arcLayout, MIN_POWER, NO_MODS, SwingMeter, timingWith, type ChargeTimes } from './swing';
import { PERK_NUMBERS, PERKS } from './cards';

const T: ChargeTimes = { weak: 0.6, mid: 0.2, strong: 0.1, rebound: 0.3 };
const MARKS: [number, number] = [0.55, 0.92];
const DT = 1 / 4000;

/** Cuándo abre el golpe fuerte por primera vez y cuánto dura esa pasada, simulando la barra. */
function strongWindow(times: ChargeTimes, marks = MARKS): { opens: number; lasts: number } {
  const m = new SwingMeter();
  m.start(times, marks);
  let opens = -1;
  let t = 0;
  for (; t < 5; t += DT) {
    m.update(DT);
    const on = m.power >= marks[1];
    if (opens < 0 && on) opens = t;
    if (opens >= 0 && !on) break;
  }
  return { opens, lasts: t - opens };
}

describe('SwingMeter por tiempos', () => {
  it('cada tramo dura sus segundos: débil, medio, y el fuerte sube al tope y vuelve', () => {
    const m = new SwingMeter();
    m.start(T, MARKS);
    m.update(T.weak);
    expect(m.power).toBeCloseTo(0.55);
    m.update(T.mid);
    expect(m.power).toBeCloseTo(0.92);
    m.update(T.strong / 2);
    expect(m.power).toBeCloseTo(1);
    m.update(T.strong / 2);
    expect(m.power).toBeCloseTo(0.92);
  });

  it('después del fuerte rebota por todo el rango, y el fuerte vuelve a durar lo mismo en cada pasada', () => {
    const m = new SwingMeter();
    m.start(T, MARKS);
    m.update(T.weak + T.mid + T.strong + T.rebound);
    expect(m.power).toBeCloseTo(0);
    m.update(T.rebound);
    expect(m.power).toBeCloseTo(0.92);
    // segunda pasada por el fuerte: medida a mano
    let inside = 0;
    for (let t = 0; t < T.strong * 1.5; t += DT) {
      m.update(DT);
      if (m.power >= 0.92) inside += DT;
    }
    expect(inside).toBeCloseTo(T.strong, 2);
    for (let i = 0; i < 300; i++) {
      m.update(0.013);
      expect(m.power).toBeGreaterThanOrEqual(-1e-9);
      expect(m.power).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('los tiempos de arranque son los de la barra vieja: el fuerte abre a los 0.815 s y dura unas 6 centésimas', () => {
    const w = strongWindow(CHARGE, qualityMarks());
    expect(w.opens).toBeCloseTo(0.815, 2);
    expect(w.lasts).toBeGreaterThan(0.04);
    expect(w.lasts).toBeLessThan(0.1);
  });

  it('la barra es puro timing: pasa por los tres niveles, y el mejor está al final', () => {
    const m = new SwingMeter();
    m.start(CHARGE, qualityMarks());
    const seen = new Set<number>();
    for (let t = 0; t < CHARGE.weak + CHARGE.mid + CHARGE.strong / 2; t += DT) {
      m.update(DT);
      seen.add(qualityOf(m.power));
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(CHARGE.weak + CHARGE.mid).toBeGreaterThan(0.7);
    expect(QUALITY_FROM[2]).toBeGreaterThan(QUALITY_FROM[1]);
  });

  it('el alcance llega al máximo con el tope y se queda, aunque la potencia siga rebotando', () => {
    const m = new SwingMeter();
    m.start(T, MARKS);
    m.update(T.weak);
    expect(m.reach).toBeGreaterThan(0.5);
    expect(m.reach).toBeLessThan(1);
    m.update(T.mid + T.strong + 0.1);
    expect(m.power).toBeLessThan(0.9);
    expect(m.reach).toBe(1);
    const r = m.release();
    expect(r.reach).toBe(1);
    expect(r.perfect).toBe(false);
  });

  it('setPower deja el medidor en esa potencia, y soltar arriba es perfecto', () => {
    const m = new SwingMeter();
    m.start(T, MARKS);
    for (const p of [0.1, 0.42, 0.7, 0.95, 1]) {
      m.setPower(p);
      expect(m.power).toBeCloseTo(p);
    }
    m.setPower(0.96);
    const r = m.release();
    expect(r.perfect).toBe(true);
    expect(m.charging).toBe(false);
  });

  it('un click corto sale con la potencia mínima', () => {
    const m = new SwingMeter();
    m.start(T, MARKS);
    m.update(0.01);
    const r = m.release();
    expect(r.power).toBe(MIN_POWER);
    expect(r.perfect).toBe(false);
  });
});

describe('las mejoras sobre los tiempos', () => {
  it('sin mejoras, los tiempos son los base', () => {
    expect(timingWith(T, NO_MODS)).toEqual(T);
  });

  it('apurar el débil y el medio (ritmo) adelanta el fuerte pero no achica su ventana', () => {
    // la muñeca rápida achicaba toda la barra: el perfecto llegaba antes, pero duraba un 15 % menos
    const plain = strongWindow(T);
    const quick = strongWindow(timingWith(T, { ...NO_MODS, lowMul: 0.7 }));
    expect(quick.opens).toBeCloseTo(plain.opens * 0.7, 2);
    expect(quick.lasts).toBeCloseTo(plain.lasts, 2);
  });

  it('acortar el débil (muñeca) adelanta el medio y el fuerte lo mismo, sin tocar cuánto duran', () => {
    const quick = timingWith(T, { ...NO_MODS, weakMul: 0.8 });
    expect(quick.weak).toBeCloseTo(T.weak * 0.8);
    expect(quick.mid).toBe(T.mid);
    expect(quick.strong).toBe(T.strong);
    expect(strongWindow(quick).opens).toBeCloseTo(strongWindow(T).opens - T.weak * 0.2, 2);
  });

  it('alargar el fuerte (punto dulce) abre en el mismo momento y dura más', () => {
    const plain = strongWindow(T);
    const sweet = strongWindow(timingWith(T, { ...NO_MODS, strongMul: 1.5 }));
    expect(sweet.opens).toBeCloseTo(plain.opens, 2);
    expect(sweet.lasts).toBeCloseTo(plain.lasts * 1.5, 2);
  });

  it('con la muñeca y el punto dulce al máximo la barra queda más pareja, pero el fuerte sigue siendo el más corto', () => {
    const all = timingWith(CHARGE, {
      weakMul: PERK_NUMBERS.quickWrist ** PERKS.quickWrist.max,
      lowMul: 1,
      strongMul: PERK_NUMBERS.sweetSpot ** PERKS.sweetSpot.max,
    });
    expect(all.weak / all.strong).toBeLessThan(CHARGE.weak / CHARGE.strong);
    expect(all.strong).toBeLessThan(all.mid);
    expect(all.strong).toBeLessThan(all.weak);
  });
});

describe('el arco a velocidad pareja', () => {
  const marks = qualityMarks();

  it('sin mejoras va de borde a tope en 90°, y cada tramo ocupa lo que dura', () => {
    const L = arcLayout(CHARGE, CHARGE);
    expect(L.span).toBeCloseTo(90, 9);
    const perSec = L.span / (CHARGE.weak + CHARGE.mid + CHARGE.strong / 2);
    expect(L.weak / CHARGE.weak).toBeCloseTo(perSec, 9);
    expect(L.mid / CHARGE.mid).toBeCloseTo(perSec, 9);
    expect(L.strong / (CHARGE.strong / 2)).toBeCloseTo(perSec, 9);
  });

  it('la aguja va pareja: la misma velocidad en los tres tramos', () => {
    const L = arcLayout(CHARGE, CHARGE);
    const m = new SwingMeter();
    m.start(CHARGE, marks);
    const at = (t: number) => {
      m.start(CHARGE, marks);
      m.update(t);
      return arcAngle(m.power, marks, L);
    };
    const speed = (t: number) => (at(t + 0.005) - at(t)) / 0.005;
    const v = 90 / (CHARGE.weak + CHARGE.mid + CHARGE.strong / 2);
    for (const t of [0.1, 0.5, 0.7, 0.8, 0.83]) expect(speed(t)).toBeCloseTo(v, 3);
  });

  it('el punto dulce agranda el rojo y deja igual el verde y el amarillo; la muñeca achica el verde', () => {
    const base = arcLayout(CHARGE, CHARGE);
    const sweet = arcLayout(timingWith(CHARGE, { ...NO_MODS, strongMul: 1.35 }), CHARGE);
    expect(sweet.weak).toBeCloseTo(base.weak, 9);
    expect(sweet.mid).toBeCloseTo(base.mid, 9);
    expect(sweet.strong).toBeCloseTo(base.strong * 1.35, 9);
    expect(sweet.span).toBeGreaterThan(base.span);
    const wrist = arcLayout(timingWith(CHARGE, { ...NO_MODS, weakMul: 0.8 }), CHARGE);
    expect(wrist.weak).toBeCloseTo(base.weak * 0.8, 9);
    expect(wrist.mid).toBeCloseTo(base.mid, 9);
    expect(wrist.strong).toBeCloseTo(base.strong, 9);
    expect(wrist.span).toBeLessThan(base.span);
  });
});
