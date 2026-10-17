// El dragón (ver fight.ts y docs/jefes/dragon.md): vuela todo el tiempo, trae enemigos en las patas desde el
// fondo y tira fuego que cae en tus puestos. Se le pega en el aire, con el hierro o el wedge. Las versiones
// cambian cómo tira el fuego: todo junto con aviso, en ráfaga a tu puesto, o cruzando de un lado al otro.
import type { Wave } from '../../../core/waves';
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startDragon, type DragonCfg } from './fight';

const NAME = L('El Dragón', 'The Dragon');

/**
 * La escolta: la de siempre (sin el gólem), con un 30 % menos de cada grupo. El dragón trae los suyos en las
 * patas (de 2 a 4 cada 15-20 s, a 10-20 m de la puerta): con la escolta entera, la puerta caía antes del
 * minuto aunque se le pegara bien.
 */
const ESCORT = 0.7;

function escort(wave: Wave): void {
  for (const g of wave.groups) g.count = Math.max(1, Math.round(g.count * ESCORT));
}

function version(id: string, cfg: DragonCfg, blurb: string): BossDef {
  return { id: `dragon.${id}`, name: NAME, blurb, escort, start: (ctx) => startDragon(ctx, cfg) };
}

export const BOSSES: BossDef[] = [
  version('lluvia', { fire: 'lluvia' }, 'Pasadas con enemigos en las patas (pegale y los suelta ahí) y fuego para arriba que cae todo junto en 3, 5, 7 y 8 puestos, con aviso. Pegale mientras carga y se lo cortás.'), // i18n-ok: el panel de pruebas
  version('rafaga', { fire: 'rafaga' }, 'Pasadas con enemigos y fuego en ráfaga: de a una bola a tu puesto (3, 5, 7, 8), hay que ir esquivando. Pegale y se corta.'), // i18n-ok: el panel de pruebas
  version('cruce', { fire: 'cruce' }, 'Pasadas con enemigos y, en vez de plantarse, cruza de un lado al otro tirando fuego en los puestos por los que pasa (3, 5, 7, 8). Pegale y se corta.'), // i18n-ok: el panel de pruebas
];
