// Qué versión del juego es esta compilación (7/10, pedido de Leandro: ver docs/monetizacion.md). Sale de
// GK_EDITION al compilar (tools/build.mjs) y se fija ahí: lo que una versión no tiene, directamente no se
// compila, así no se puede destrabar desde la consola del navegador.
//
// - **full**, la completa: todo. Mientras se desarrolla trae también las herramientas de prueba.
// - **demo**: gratis, para difundir. Sin los talentos de dificultad (se ven, con candado). Con Abe.
// - **abe**: solo para ser Abe en la partida de otro (el amigo que no tiene el juego). Mira y ayuda, pero no
//   puede arrancar una partida: la parte del caballero (oleadas, cartas, tutorial) no se compila.

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
