// Generado por tools/vfx_atlas.py: no editar a mano. Dónde está cada sprite en public/fx/atlas.webp
// (x, y, ancho, alto en px de un atlas de 1024; y las columnas y filas si es una tira de cuadros).
export const FX_ATLAS_SIZE = 1024;
export const FX_SPRITES = {
  spikes: [0, 0, 256, 256, 1, 1],
  stretchSpikes: [258, 0, 256, 256, 1, 2],
  smoke: [516, 0, 256, 256, 2, 2],
  arcs: [0, 258, 256, 256, 1, 4],
  circle: [258, 258, 256, 256, 1, 1],
  crack: [516, 258, 256, 256, 1, 1],
  hit: [774, 258, 64, 128, 1, 1],
  star: [840, 258, 128, 128, 1, 1],
  flare: [0, 516, 256, 128, 1, 1],
  flame: [258, 516, 64, 128, 1, 1],
  fireBlur: [324, 516, 128, 128, 1, 1],
  spark: [454, 516, 128, 128, 1, 1],
  glow: [584, 516, 128, 128, 1, 1],
  snow: [714, 516, 128, 128, 1, 1],
  plus: [844, 516, 128, 128, 1, 1],
  cross: [0, 646, 128, 128, 1, 1],
  crater: [130, 646, 128, 128, 1, 1],
  holy: [260, 646, 128, 128, 1, 1],
  trait: [390, 646, 256, 64, 1, 1],
  traitBlur: [648, 646, 256, 64, 1, 1],
  ember: [0, 776, 128, 64, 1, 1],
  point: [130, 776, 64, 64, 1, 1],
} as const;
export type FxSprite = keyof typeof FX_SPRITES;
