/**
 * Los volúmenes (14/10, Leandro: «una pestaña en balance de sonidos para poder ajustar todos los volúmenes»).
 * Dos tablas que se multiplican con lo que pide el código: una por grupo (todo, música, la carga...) y una
 * por sonido grabado. 1 es como está; 0 lo apaga. Se tocan en el panel B (pestaña Sonido), se guardan con
 * el balance y salen en «Copiar configuración»; también `?ajuste=volumen.musica:0.5` o
 * `?ajuste=sonidos.explosion-big:0.6`.
 */
export const VOLUME = {
  /** Todo junto. */
  todo: 1,
  musica: 1,
  /** Las notas del arpegio mientras se carga. */
  carga: 1,
  /** La campana de cada baja, que sigue el arpegio. */
  bajas: 1,
  /** El palo contra la pelota, el swing y la pifia. */
  palo: 1,
  /** La pelota contra los enemigos (cuerpo, hueso, metal, rebotes). */
  golpes: 1,
  explosiones: 1,
  /** Quejidos, muertes, el élite y el jefe. */
  voces: 1,
  /** Las habilidades del golfista. */
  poderes: 1,
  /** Los poderes de los enemigos: burbuja, curación, esquiva, hechiceros, fuego. */
  enemigos: 1,
  /** La puerta y el golfista: golpes que recibe y su caída. */
  golfista: 1,
  /** La partida: oleada, cartas, botones, victoria y derrota. */
  partida: 1,
};
export type VolumeGroup = keyof typeof VOLUME;

/** Los sonidos grabados (los de public/sfx/sfx.json; el test de volumes los compara). */
export const SFX_NAMES = [
  'armor-hit', 'ball-hit', 'boss-appear', 'boss-death', 'boss-rock', 'boss-throw', 'bubble-pop', 'bubble-up', 'burn-loop',
  'burn-tick', 'card-appear', 'card-pick', 'cast-boost', 'cast-caddie', 'cast-cart', 'cast-clone', 'cast-echo', 'cast-fire',
  'cast-flag', 'cast-ghost', 'cast-glove', 'cast-hole', 'cast-ice', 'cast-lens', 'cast-lightning', 'cast-melee', 'cast-might',
  'cast-powder', 'cast-rain', 'cast-silence', 'cast-wind', 'caster-cast', 'caster-hit', 'club-driver', 'club-iron',
  'club-putter', 'club-wedge', 'death-goblin', 'death-goblina', 'death-knight', 'death-orc', 'death-shaman', 'death-skeleton',
  'death-stoneling', 'death-warchief', 'death-wraith', 'defeat', 'dodge', 'dodge-ready', 'duff', 'elite-alert', 'elite-hurt',
  'explosion-big', 'explosion-small', 'gate-hit', 'heal', 'hit-armor', 'hit-bone', 'hit-heavy', 'hit-soft', 'hit-stone',
  'hole', 'hurt', 'hurt-goblin', 'hurt-goblina', 'hurt-golem', 'hurt-knight', 'hurt-orc', 'hurt-shaman', 'hurt-skeleton',
  'hurt-stoneling', 'hurt-warchief', 'hurt-wraith', 'ice', 'lightning-chain', 'perfect', 'phase-bounce', 'player-dies',
  'ricochet', 'trample', 'ui-click', 'victory', 'wave-clear',
  // 15/10: el swing de cada palo, la puerta que cae y el caballero que se queja al perder
  'swing', 'swing-big', 'swing-short', 'gate-fall', 'knight-groan',
] as const;

/** El volumen de cada sonido grabado, aparte del de su grupo. */
export const SFX_VOLUME: Record<string, number> = Object.fromEntries(SFX_NAMES.map((n) => [n, 1]));

/** A qué grupo va cada sonido grabado. */
export function groupOf(name: string): VolumeGroup {
  if (name.startsWith('club-') || name.startsWith('swing') || name === 'perfect' || name === 'duff') return 'palo';
  if (name === 'ball-hit' || name.startsWith('hit-') || name === 'armor-hit' || name === 'ricochet' || name === 'phase-bounce') return 'golpes';
  if (name.startsWith('explosion-')) return 'explosiones';
  if (name === 'hurt' || name === 'gate-hit' || name === 'player-dies' || name === 'gate-fall' || name === 'knight-groan') return 'golfista';
  if (name.startsWith('death-') || name.startsWith('hurt-') || name.startsWith('elite-') || name.startsWith('boss-')) return 'voces';
  if (name.startsWith('cast-') || ['ice', 'lightning-chain', 'hole', 'trample'].includes(name)) return 'poderes';
  if (['wave-clear', 'card-appear', 'card-pick', 'ui-click', 'victory', 'defeat'].includes(name)) return 'partida';
  return 'enemigos';
}

/** Cuánto suena `name` (grabado) por sus dos tablas, sin contar `todo` (que va en la salida). */
export function sampleVolume(name: string): number {
  return VOLUME[groupOf(name)] * (SFX_VOLUME[name] ?? 1);
}
