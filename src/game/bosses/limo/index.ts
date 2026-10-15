// El limo venenoso (14/10, ideas de Leandro: «que si lo matás se divida y aparezcan dos más chicos, podría
// ser el slime y que escupa», «que absorba enemigos a los que les pasa por arriba, y gane su vida»). Pone a
// prueba el área contra muchos chicos y cuidar la línea de puestos. Cada versión toma una de las ideas, y
// la completa las junta. Desde el 15/10 se arrastra en diagonal (no salta todo el tiempo) y su ataque es un
// salto con aviso que se corta con un golpe fuerte. Ver docs/jefes/limo.md.
import type { Wave } from '../../../core/waves';
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startLimo, type LimoVersion } from './pelea';

/** La escolta del que come viene más espaciada: que tenga qué comer durante la pelea. */
const FEED_INTERVAL = 1.5;
/** La completa: un poco menos, que ya hay mucho. */
const FULL_INTERVAL = 1.3;

const NAME = L('Limo venenoso', 'Poison Slime');

function version(v: LimoVersion, blurb: string, escort?: (w: Wave) => void): BossDef {
  return { id: v.id, name: NAME, blurb, escort, start: (ctx) => startLimo(ctx, v) };
}

export const BOSSES: BossDef[] = [
  version(
    { id: 'limo.divide', splits: 2, absorbs: false, spits: false, hp: [50, 18, 6] },
    'Se arrastra en diagonal y salta si no le cortás el salto con un golpe fuerte. Se divide: 2 medianos que se cruzan, y cada uno en 2 chicos.', // i18n-ok: el panel de pruebas
  ),
  version(
    { id: 'limo.come', splits: 0, absorbs: true, spits: false, hp: [50, 0, 0] },
    'Se come a la escolta que toca (va hacia ella): gana su vida, se los ve adentro y salen todos juntos al reventarlo. Salta como «divide».', // i18n-ok: el panel de pruebas
    (w) => { w.interval *= FEED_INTERVAL; },
  ),
  version(
    { id: 'limo.escupe', splits: 0, absorbs: false, spits: true, holds: true, hp: [70, 0, 0] },
    'Se planta a media cancha y te escupe (un golpe fuerte mientras se infla lo corta): el charco deja ese puesto sin pelota 14 s. La franja se acerca sin parar: si llega a la línea, cruza.', // i18n-ok: el panel de pruebas
  ),
  version(
    { id: 'limo.gotea', splits: 0, absorbs: false, spits: false, sheds: 10, hp: [60, 0, 3] },
    'Gotea: cada 10 que le sacás se le cae un limo chico que corre a la línea (pegarle fuerte suelta más). Salta como «divide».', // i18n-ok: el panel de pruebas
  ),
  version(
    { id: 'limo.completo', splits: 2, absorbs: true, spits: true, hp: [40, 16, 5] },
    'Todo junto: escupe y come (el grande y los medianos), y se divide hasta los chicos.', // i18n-ok: el panel de pruebas
    (w) => { w.interval *= FULL_INTERVAL; },
  ),
];
