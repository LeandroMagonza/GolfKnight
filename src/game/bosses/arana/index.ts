// La araña reina (14/10): el jefe del espacio en la línea (puestos trabados, huevos que nacen). Las
// versiones cambian dónde pone los huevos y qué hace la telaraña que queda en un puesto, para que Leandro
// pruebe y elija. La pelea está en fight.ts; lo que se arma por código, en looks.ts. Ver docs/jefes/arana.md.
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startArana, type Variant } from './fight';

const NAME = L('Araña reina', 'Spider Queen');

const version = (id: string, blurb: string, v: Variant): BossDef => ({ id: `arana.${id}`, name: NAME, blurb, start: (ctx) => startArana(ctx, v) });

export const BOSSES: BossDef[] = [
  version('costados', 'Pone huevos a los costados. La telaraña te pega al puesto; la que cae en uno vacío queda de trampa.', { eggs: 'costados', webs: 'pega', weavers: false }), // i18n-ok: el panel de pruebas
  version('adelante', 'Tira los huevos hacia la línea (caen cerca y nacen más tarde). Telaraña de trampa.', { eggs: 'adelante', webs: 'pega', weavers: false }), // i18n-ok: el panel de pruebas
  version('traba', 'Huevos a los costados. La telaraña que cae en un puesto vacío es una pared: no se cruza.', { eggs: 'costados', webs: 'traba', weavers: false }), // i18n-ok: el panel de pruebas
  version('reina', 'Todo junto: huevos a los costados y tirados, paredes de telaraña y tejedoras que frenan a escupirte.', { eggs: 'ambos', webs: 'traba', weavers: true }), // i18n-ok: el panel de pruebas
];
