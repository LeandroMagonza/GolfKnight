// Qué versión del juego es esta compilación (7/10, pedido de Leandro: ver docs/monetizacion.md). Sale de
// GK_EDITION al compilar (tools/build.mjs) y se fija ahí: lo que una versión no tiene, directamente no se
// compila, así no se puede destrabar desde la consola del navegador.
//
// - **full**, la completa: todo. Mientras se desarrolla trae también las herramientas de prueba.
// - **demo**: gratis, para difundir. Sin los talentos de dificultad (se ven, con candado), y sin algunos
//   poderes de los enemigos y del caballero (ver DEMO_LOCKS). Con Abe.
// - **abe**: solo para ser Abe en la partida de otro (el amigo que no tiene el juego). Mira y ayuda, pero no
//   puede arrancar una partida: la parte del caballero (oleadas, cartas, tutorial) no se compila.

import type { Element } from './core/abilities';
import type { PerkId } from './core/cards';
import type { ScenarioPower } from './core/waves';

export type Edition = 'full' | 'demo' | 'abe';

export const EDITION = __EDITION__ as Edition;
export const DEMO = __EDITION__ === 'demo';
/** Solo Abe: no se juega, se entra a la partida de otro. */
export const ABE_ONLY = __EDITION__ === 'abe';
/**
 * Las herramientas de prueba: el panel de balance (B), `__gk` en la consola, ?bot y ?palos. Solo en la
 * completa, mientras se desarrolla; en lo que se publica para jugadores, no van.
 */
export const DEV_TOOLS = __DEV_TOOLS__;

/**
 * Lo que la demo no trae, además de los talentos (7/10, pedido de Leandro): no salen en el sorteo.
 * - `powers`: poderes de escenario de los enemigos. Quedan escudo, esquiva, fantasma e intocable: uno de
 *   cada par de los que se parecen (Leandro: el divino y la esquiva; el blindaje y el fantasma, que
 *   también comparten con el escudo; el que se cura y el intocable, los dos con su reloj). Cada partida
 *   sortea tres de esos cuatro. Tienen que quedar por lo menos tres (uno por escenario).
 * - `elements`: los tiros de esos elementos, en las cartas del caballero. El fantasma pasa todo
 *   (escudos, esquivas, etéreos); el viento hoy casi no sirve, y la primera impresión no tendría que ser
 *   una carta floja. El silencio queda: está bueno que lo conozcan.
 * - `gloves`: los guantes, todos. Son una segunda versión de los elementos: en la demo alcanza con los
 *   tiros. En la completa siguen.
 * - `perks`: las mejoras de racha y las de matar a dos juntos, que son para jugadores avanzados.
 *
 * La idea (Leandro): la demo se gana en el nivel 0 sin demasiado desafío, en menos de las dos horas que da
 * Steam para devolver el juego; el que quiere más, sube la dificultad, y eso es la completa.
 */
export const DEMO_LOCKS: { powers: ScenarioPower[]; elements: Element[]; gloves: boolean; perks: PerkId[] } = {
  powers: ['armor', 'divine', 'regen'],
  elements: ['ghost', 'wind'],
  gloves: true,
  perks: ['rhythm', 'hotStreak', 'masonStreak', 'smithStreak', 'giftPerfect'],
};
