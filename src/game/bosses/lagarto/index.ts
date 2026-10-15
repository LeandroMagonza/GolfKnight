// El lagarto lancero (14/10, idea de Leandro): pone a prueba **interceptar lo que vuela**. Se planta a media
// cancha, va de costado y rueda, y tira lanzas derechas por carriles donde no hay enemigos: a la puerta o a
// tu puesto. Cada carril se marca en el piso desde que apunta hasta la muralla, y el anillo en la línea dice
// por dónde cruza. Tu horda te cubre (no tira donde hay enemigos, y la lanza se clava en el que se cruza):
// limpiar el campo le abre carriles. Lo que no se para le pega a quien encuentra: a vos, si estás en el
// carril, o a la puerta.
//
// Las versiones (ver docs/jefes/lagarto.md) cambian cómo se para una lanza (bajarla a pelotazos,
// devolverla pegándole cuando llega, o las dos), a quién le tira (solo a la puerta, o también a vos) y cómo
// esquiva (al apuntarle, como la esquiva, o con pasos y rolls al azar).
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startLagarto, type LagartoCfg } from './pelea';

const NAME = L('El Lagarto lancero', 'The Lizard Lancer');
const SHOOT_HINT = L('¡Bajá las lanzas a pelotazos!', 'Shoot the spears down!');
const PARRY_HINT = L('¡Pegale a la pelota cuando llega la lanza!', 'Swing as the spear arrives!');

function version(id: string, blurb: string, cfg: LagartoCfg): BossDef {
  return {
    id: `lagarto.${id}`,
    name: NAME,
    blurb,
    start: (ctx) => startLagarto(ctx, cfg, cfg.shoot ? SHOOT_HINT : PARRY_HINT),
  };
}

export const BOSSES: BossDef[] = [
  version('lanzas', 'Lanzas a la puerta y a vos; se bajan a pelotazos. Esquiva rodando al apuntarle (no mientras apunta).', { shoot: true, parry: false, atPlayer: true, evade: 'aim' }), // i18n-ok: el panel de pruebas
  version('puerta', 'Como lanzas, pero solo tira a la puerta: interceptar puro, sin correrse.', { shoot: true, parry: false, atPlayer: false, evade: 'aim' }), // i18n-ok: el panel de pruebas
  version('pasos', 'Como lanzas, pero no esquiva al apuntarle: se mueve solo, a pasos y rolls al azar.', { shoot: true, parry: false, atPlayer: true, evade: 'random' }), // i18n-ok: el panel de pruebas
  version('atajada', 'Las lanzas no se bajan: se devuelven pegándole a la pelota en su carril justo cuando llegan (y le pegan a él).', { shoot: false, parry: true, atPlayer: true, evade: 'aim' }), // i18n-ok: el panel de pruebas
  version('doble', 'Se bajan a pelotazos de lejos, o se devuelven de cerca pegándole cuando llegan (le pegan a él).', { shoot: true, parry: true, atPlayer: true, evade: 'aim' }), // i18n-ok: el panel de pruebas
];
