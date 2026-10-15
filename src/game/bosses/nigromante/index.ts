// El nigromante (14/10; ver docs/jefes/nigromante.md): pone a prueba dónde y cuándo matar. Va al fondo en
// andas cargadas por esqueletos y les pone su poder a los de la horda. Las versiones cambian qué les pone
// y qué pasa con los porteadores; el resto (el cuerpo, la tumba, alzar muertos, la escolta) es común.
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { escort, startNecro, type Version } from './fight';
import { NECRO_GLB } from './litter';

const NAME = L('El Nigromante', 'The Necromancer');

function version(id: string, blurb: string, cfg: Version): BossDef {
  return { id: `nigromante.${id}`, name: NAME, blurb, models: [NECRO_GLB], escort, start: (ctx) => startNecro(ctx, cfg) };
}

export const BOSSES: BossDef[] = [
  version(
    'marcas',
    'Cada 3 s marca a uno (primero al que le estás pegando; hasta 5, suelta al más viejo). El marcado que matás vuelve entero a los 3 s donde cayó.', // i18n-ok: el panel de pruebas
    { mode: 'marks', revive: 'same', bearers: false, hint: L('Si matás a un marcado, vuelve donde cayó', 'Kill a marked foe and it rises where it fell') },
  ),
  version(
    'huesos',
    'Como marcas, pero el marcado que matás vuelve como esqueleto (4 de vida): matar marcados chicos sale caro, grandes conviene.', // i18n-ok: el panel de pruebas
    { mode: 'marks', revive: 'bones', bearers: false, hint: L('Si matás a un marcado, vuelve como esqueleto', 'Kill a marked foe and it rises as a skeleton') },
  ),
  version(
    'cadenas',
    'Encadena de a 2 o 3 que van juntos: el que cae vuelve a los 2.5 s mientras quede otro del grupo en pie (y vuelve a la cadena). Hay que tenerlos a todos caídos a la vez: eso rompe la cadena y le saca 4 o 6.', // i18n-ok: el panel de pruebas
    { mode: 'chains', revive: 'same', bearers: false, hint: L('Encadenados: mientras quede uno en pie, el resto vuelve', 'Chained foes rise again while one still stands') },
  ),
  version(
    'porteadores',
    'Como marcas, pero los cuatro porteadores son enemigos (4 de vida): con dos caídos se le caen las andas y 5 s en el piso, sin marcar y con +1 a cada golpe.', // i18n-ok: el panel de pruebas
    { mode: 'marks', revive: 'same', bearers: true, hint: L('Voltealo: tirale abajo a los porteadores', 'Topple him: knock down his bearers') },
  ),
];
