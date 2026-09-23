import { describe, expect, it } from 'vitest';
import { behindShield, shieldFaces } from './shield';

// El guerrero viene hacia la puerta, así que mira hacia -Z: el golfista le queda de frente.
const facing = { x: 0, z: -1 };
const guard = { x: 0, z: 20 };

describe('la sombra del escudo', () => {
  it('el escudo cubre lo que estalla adelante, no lo que estalla atrás', () => {
    expect(shieldFaces({ x: 0, z: 16 }, guard, facing)).toBe(true);
    expect(shieldFaces({ x: 0, z: 24 }, guard, facing)).toBe(false);
  });

  it('de costado no cubre: hay que caerle bastante de frente', () => {
    // a 45 grados el coseno es 0.71 y todavía cubre; a 70 grados ya no
    expect(shieldFaces({ x: 4, z: 16 }, guard, facing)).toBe(true);
    expect(shieldFaces({ x: 11, z: 16 }, guard, facing)).toBe(false);
  });

  it('tapa a los que tiene detrás, no a los que tiene al lado ni adelante', () => {
    const from = { x: 0, z: 14 };
    // justo atrás del guerrero, en la misma línea
    expect(behindShield(from, guard, 0.5, { x: 0, z: 22 }, 0.5)).toBe(true);
    // atrás pero corrido: se asoma por el costado de la sombra
    expect(behindShield(from, guard, 0.5, { x: 3, z: 22 }, 0.5)).toBe(false);
    // más cerca de la explosión que el escudo: no lo tapa nada
    expect(behindShield(from, guard, 0.5, { x: 0, z: 17 }, 0.5)).toBe(false);
  });

  it('la sombra sale de la línea explosión-escudo, no del norte del campo', () => {
    // explosión a un costado: la sombra se corre con ella
    const from = { x: -10, z: 20 };
    expect(behindShield(from, guard, 0.5, { x: 3, z: 20 }, 0.5)).toBe(true);
    expect(behindShield(from, guard, 0.5, { x: 0, z: 24 }, 0.5)).toBe(false);
  });
});
