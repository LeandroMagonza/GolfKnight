// El futbolista (17/10; ver docs/jefes/futbolista.md y pelea.ts): corre entre los enemigos y los patea hacia
// la puerta; a 20 m o menos de tu línea, derecho al arco. Pone a prueba cortar a tiempo: pegarle fuerte
// mientras corre o se prepara le corta la patada.
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { FUT_GLB } from './look';
import { startFutbolista, type FutOpts } from './pelea';

const NAME = L('Futbolista', 'Footballer');

const version = (id: string, blurb: string, opts: FutOpts): BossDef => ({
  id: `futbolista.${id}`,
  name: NAME,
  blurb,
  models: [FUT_GLB],
  start: (ctx) => startFutbolista(ctx, opts),
});

export const BOSSES: BossDef[] = [
  version('goleador', 'Patea al que más le conviene: los que están a 20 m o menos van al arco (gol), los demás vuelan según lo que pesan.', { // i18n-ok: el panel de pruebas
    pick: 'gol',
    hp: 90,
    hint: L('Patea a la horda hacia tu puerta. Pegale fuerte mientras corre para cortarlo.', 'He kicks the horde toward your gate. Hit him hard while he runs to stop him.'),
  }),
  version('pesado', 'Va a buscar a los grandes (caballeros, ogros, jefes goblin): vuelan menos, pero el gol pega 3. Patea menos seguido.', { // i18n-ok: el panel de pruebas
    pick: 'pesado',
    hp: 90,
    rest: 1.3,
    hint: L('Va a buscar a los grandes: bajalos antes de que lleguen a 20 m, o cortalo con un golpe fuerte.', 'He goes for the big ones: drop them before they reach 20 m, or stop him with a hard hit.'),
  }),
  version('chico', 'Solo patea a los livianos (goblins, lagartos, huargos), más seguido y más lejos.', { // i18n-ok: el panel de pruebas
    pick: 'chico',
    hp: 85,
    rest: 0.8,
    reach: 1.15,
    hint: L('Patea a los chicos, seguido y lejos. Limpiá a los goblins o cortalo con un golpe fuerte.', 'He kicks the small ones, often and far. Clear the goblins or stop him with a hard hit.'),
  }),
];
