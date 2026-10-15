// El ogro bateador (ver docs/jefes/ogro.md y pelea.ts): pone a prueba elegir el palo según la trayectoria
// (el globo no lo puede batear) y cebarlo (un tiro flojo le gasta el batazo, y queda abierto).
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startOgro, type OgroOpts } from './pelea';

const NAME = L('Ogro bateador', 'Batter Ogre');

const version = (id: string, blurb: string, opts: OgroOpts): BossDef => ({
  id: `ogro.${id}`,
  name: NAME,
  blurb,
  start: (ctx) => startOgro(ctx, opts),
});

export const BOSSES: BossDef[] = [
  version('devuelve', 'Te devuelve las pelotas (el globo no); si no le mandás nada, batea piedras a la puerta.', { // i18n-ok: el panel de pruebas
    returns: true,
    rally: false,
    fungo: true,
    queue: false,
    hp: 75,
    hint: L('Cebalo con un tiro flojo, correte y castigalo abierto. El globo no lo batea.', 'Bait him with a weak shot, step aside and punish him while open. He can’t bat lobs.'),
  }),
  version('batea', 'No batea pelotas: batea a la puerta a los goblins que bajan en fila por su carril.', { // i18n-ok: el panel de pruebas
    returns: false,
    rally: false,
    fungo: false,
    queue: true,
    hp: 70,
    hint: L('Limpiá su carril: el que llega a su palo sale volando a la puerta.', 'Clear his lane: whoever reaches his bat flies into the gate.'),
  }),
  version('peloteo', 'Como «devuelve», pero la pelota devuelta queda en tu línea, dorada, y pega +1 por cada ida y vuelta.', { // i18n-ok: el panel de pruebas
    returns: true,
    rally: true,
    fungo: true,
    queue: false,
    hp: 80,
    hint: L('La que te devuelve queda en tu línea: pegale con esa, que pega más cada vez.', 'The ball he sends back stays on your line: hit him with it, it hits harder every time.'),
  }),
  version('completo', 'Devuelve las pelotas y batea a la puerta la fila de goblins de su carril (sin piedras).', { // i18n-ok: el panel de pruebas
    returns: true,
    rally: false,
    fungo: false,
    queue: true,
    hp: 75,
    hint: L('Te devuelve las pelotas y batea a la puerta a los de su carril. El globo no lo batea.', 'He sends balls back and bats his lane into the gate. He can’t bat lobs.'),
  }),
];
