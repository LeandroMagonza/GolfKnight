// El Caballero negro: un reflejo oscuro del golfista que los chamanes conjuraron. Le pega con tu misma
// barra, que se ve arriba de su cabeza; pegale mientras carga y le cortás el swing. Ver fight.ts y
// docs/jefes/caballero.md. Las versiones cambian una sola cosa cada una respecto de la base (`puerta`).
import { L } from '../../../i18n';
import type { Wave } from '../../../core/waves';
import type { BossDef } from '../types';
import { startKnight, type KnightOpts } from './fight';

/**
 * La escolta: la de siempre (sin el gólem), estirada para que dure casi toda la pelea y no te deje mirarlo
 * solo a él. Más goblins y goblinas, y más espaciados.
 */
const ESCORT = { interval: 2.6, small: 1.5 };

function escort(wave: Wave): void {
  wave.interval = ESCORT.interval;
  for (const g of wave.groups) if (g.kind === 'goblin' || g.kind === 'goblina') g.count = Math.round(g.count * ESCORT.small);
}

const BASE: KnightOpts = { target: 'gate', minCut: 1, catchable: false, parry: false };
const NAME = L('Caballero negro', 'Black Knight');

function version(id: string, blurb: string, opts: Partial<KnightOpts>): BossDef {
  return {
    id: `caballero.${id}`,
    name: NAME,
    blurb,
    models: ['club.glb'],
    escort,
    start: (ctx) => startKnight(ctx, { ...BASE, ...opts }),
  };
}

export const BOSSES: BossDef[] = [
  version('puerta', 'Le tira a la puerta con tu misma barra (rojo 3, amarillo 2, verde 1); cualquier golpe mientras carga le corta el swing.', {}), // i18n-ok: el panel de pruebas
  version('puesto', 'Te tira a vos: marca tu puesto al soltar y hay que correrse (el rojo cae en 0.8 s); no le pega a la puerta.', { target: 'player' }), // i18n-ok: el panel de pruebas
  version('fuerte', 'Como la base, pero solo le corta el swing un golpe 2 o 3: el flojo lo aguanta.', { minCut: 2 }), // i18n-ok: el panel de pruebas
  version('atajable', 'Como la base, pero su pelota va rasante y lenta a la puerta: se la puede bajar de un pelotazo.', { catchable: true }), // i18n-ok: el panel de pruebas
  version('devuelve', 'Como la base, pero si le pegás cuando no carga te devuelve la pelota a tu puesto (sin pelotas, no).', { parry: true }), // i18n-ok: el panel de pruebas
];
