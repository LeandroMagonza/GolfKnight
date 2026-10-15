import { describe, expect, it } from 'vitest';
import list from '../../public/sfx/sfx.json?raw';
import { groupOf, sampleVolume, SFX_NAMES, SFX_VOLUME, VOLUME } from './volumes';

describe('los volúmenes', () => {
  it('tienen una casilla por cada sonido grabado de public/sfx', () => {
    expect([...SFX_NAMES].sort()).toEqual(Object.keys(JSON.parse(list) as Record<string, unknown>).sort());
  });

  it('reparten cada sonido en su grupo', () => {
    expect(groupOf('club-driver')).toBe('palo');
    expect(groupOf('hit-bone')).toBe('golpes');
    expect(groupOf('hurt')).toBe('golfista');
    expect(groupOf('hurt-orc')).toBe('voces');
    expect(groupOf('cast-fire')).toBe('poderes');
    expect(groupOf('heal')).toBe('enemigos');
    expect(groupOf('explosion-big')).toBe('explosiones');
    expect(groupOf('wave-clear')).toBe('partida');
    expect(groupOf('swing-big')).toBe('palo');
    expect(groupOf('gate-fall')).toBe('golfista');
    expect(groupOf('knight-groan')).toBe('golfista');
  });

  it('multiplican el grupo por el sonido', () => {
    const before = { g: VOLUME.explosiones, s: SFX_VOLUME['explosion-big'] };
    VOLUME.explosiones = 0.5;
    SFX_VOLUME['explosion-big'] = 0.8;
    expect(sampleVolume('explosion-big')).toBeCloseTo(0.4);
    VOLUME.explosiones = before.g;
    SFX_VOLUME['explosion-big'] = before.s;
  });
});
