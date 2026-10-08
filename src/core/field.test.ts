import { afterEach, describe, expect, it } from 'vitest';
import { FIELD_HALF_WIDTH, FIELD_SHAPE, FIELD_SHAPE_DEFAULTS, fieldHalfAt, laneX, SPAWN_Z, spawnAt, TEE_LINE_Z, trapezoidOn } from './field';

afterEach(() => Object.assign(FIELD_SHAPE, FIELD_SHAPE_DEFAULTS));

describe('forma del campo', () => {
  it('el rectángulo: el mismo ancho en todo el largo, y cada uno camina derecho', () => {
    FIELD_SHAPE.trapezoid = false;
    expect(fieldHalfAt(SPAWN_Z)).toBe(FIELD_HALF_WIDTH);
    expect(laneX(7, 60, TEE_LINE_Z)).toBe(7);
    expect(spawnAt(1)).toEqual({ x: FIELD_HALF_WIDTH - 3, z: SPAWN_Z });
  });

  it('el trapecio: adelante igual que siempre, el fondo con el ancho pedido', () => {
    FIELD_SHAPE.trapezoid = true;
    expect(trapezoidOn()).toBe(true);
    expect(fieldHalfAt(TEE_LINE_Z)).toBeCloseTo(FIELD_HALF_WIDTH);
    expect(fieldHalfAt(0)).toBe(FIELD_HALF_WIDTH);
    expect(fieldHalfAt(SPAWN_Z)).toBeCloseTo(FIELD_SHAPE.backHalf);
  });

  it('cada punto del arco cae en su punto de la línea de los puestos', () => {
    FIELD_SHAPE.trapezoid = true;
    for (const u of [-1, -0.5, 0, 0.3, 1]) {
      const s = spawnAt(u);
      expect(laneX(s.x, s.z, TEE_LINE_Z)).toBeCloseTo(u * (FIELD_HALF_WIDTH - 3));
      // adentro del campo, con margen
      expect(Math.abs(s.x)).toBeLessThan(fieldHalfAt(s.z) - 2);
    }
    // las puntas salen más cerca: es un arco
    expect(spawnAt(1).z).toBeCloseTo(SPAWN_Z - FIELD_SHAPE.arc);
    expect(spawnAt(0).z).toBe(SPAWN_Z);
  });

  it('una fila es una recta: el que sigue su fila no cambia de fila', () => {
    FIELD_SHAPE.trapezoid = true;
    const s = spawnAt(0.8);
    const mid = { x: laneX(s.x, s.z, 30), z: 30 };
    expect(laneX(mid.x, mid.z, TEE_LINE_Z)).toBeCloseTo(laneX(s.x, s.z, TEE_LINE_Z));
  });

  it('con el fondo más angosto que adelante no hay trapecio', () => {
    FIELD_SHAPE.trapezoid = true;
    FIELD_SHAPE.backHalf = 10;
    expect(trapezoidOn()).toBe(false);
    expect(fieldHalfAt(SPAWN_Z)).toBe(FIELD_HALF_WIDTH);
  });
});
