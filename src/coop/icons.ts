// Los íconos de Abe en sus botones y sus cartas (9/10, pedido de Leandro): dibujados con trazos, en el color
// de cada hechizo, como los de los palos del caballero. Antes eran emoji, que se veían de celular y cada
// sistema los dibuja distinto. Los emoji siguen en SPELL_INFO para los textos (el panel de balance, el
// cartel de cuántos agarró).
import type { SpellId } from './spells';

/** Lo de adentro de un `<svg viewBox="0 0 24 24">`, con trazo del color del texto. */
const PATHS: Record<SpellId | 'bolt', string> = {
  // la marca: un destello de cuatro puntas
  bolt: '<path d="M12 2.5l2.1 7.4 7.4 2.1-7.4 2.1L12 21.5l-2.1-7.4L2.5 12l7.4-2.1z" fill="currentColor" fill-opacity="0.25"/>',
  // el granizo: un copo
  hail: '<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2M3.3 10.3l3.2-.9-.8-3.2M20.7 13.7l-3.2.9.8 3.2M3.3 13.7l3.2.9-.8 3.2M20.7 10.3l-3.2-.9.8-3.2"/>',
  // el remolino: una espiral
  whirl: '<path d="M13 12a1 1 0 1 1-2 0 3 3 0 0 1 6 0 5 5 0 0 1-10 0 7 7 0 0 1 14 0 9 9 0 0 1-9 9"/>',
  // la corriente: líneas de viento
  current: '<path d="M3 8.5h10.5a2.75 2.75 0 1 0-2.75-2.75M3 12.5h15a3 3 0 1 1-3 3M3 16.5h6"/>',
  // el empujón: dos flechas para atrás
  push: '<path d="M5 13l7-7 7 7M5 19.5l7-7 7 7"/>',
  // la maldición: un blanco
  curse: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
  // el silencio: un parlante tachado
  hush: '<path d="M3.5 9.5h4l5-4v13l-5-4h-4z" fill="currentColor" fill-opacity="0.2"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>',
  // la trampa: los dientes de un cepo
  trap: '<path d="M2.5 16.5h19M4 16.5l2-6 2 6 2-6 2 6 2-6 2 6 2-6 2 6M6 19.5h12"/>',
};

/** El ícono de un hechizo (o de la marca), del color del texto donde va. */
export function spellIcon(id: SpellId | 'bolt'): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[id]}</svg>`;
}
