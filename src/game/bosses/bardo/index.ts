// Los jefes con música (15/10, idea de Leandro): ponen su propia canción y todo tiro soltado fuera del
// beat sale pifia (contra él y contra la escolta). El tempo sube solo, por fases. Ver docs/jefes/bardo.md.
//   metal   el Bardo del metal: un guitarrista esqueleto; metal a 100, 130 y 160.
//   tambor  el Ogro tamborilero: tambores de guerra a 90, 115 y 140, el beat más marcado y la ventana más
//           generosa (la versión fácil).
import { L } from '../../../i18n';
import { BARDO_TEMPOS, TAMBOR_TEMPOS } from '../../../audio/music/songs/bardo';
import type { BossDef } from '../types';
import { startBardo } from './fight';

export const BOSSES: BossDef[] = [
  {
    id: 'bardo.metal',
    name: L('El Bardo del metal', 'The Metal Bard'),
    blurb: 'Guitarrista esqueleto con su canción de metal: todo tiro fuera del beat sale pifia (cada 3 pifias, acople a la puerta). Acordes a tu puesto y notas que saltan a la puerta, al ritmo; 100 → 130 → 160.', // i18n-ok: el panel de pruebas
    start: (ctx) => startBardo(ctx, {
      song: 'bardo.metal',
      tempos: BARDO_TEMPOS,
      windows: [0.12, 0.105, 0.09],
      hp: 50,
      name: L('El Bardo del metal', 'The Metal Bard'),
      estilo: 'metal',
    }),
  },
  {
    id: 'bardo.tambor',
    name: L('El Ogro tamborilero', 'The Drummer Ogre'),
    blurb: 'La misma regla con tambores de guerra (el taiko y el ka en cada negra): más lento (90 → 115 → 140) y con la ventana más generosa. Pisotones a tu puesto y tamborcitos que saltan a la puerta.', // i18n-ok: el panel de pruebas
    start: (ctx) => startBardo(ctx, {
      song: 'bardo.tambor',
      tempos: TAMBOR_TEMPOS,
      windows: [0.14, 0.12, 0.105],
      hp: 50,
      name: L('El Ogro tamborilero', 'The Drummer Ogre'),
      estilo: 'tambor',
    }),
  },
];
