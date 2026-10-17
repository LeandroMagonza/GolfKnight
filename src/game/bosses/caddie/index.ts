// El Caddie (17/10, pedido de Leandro: «un jefe que te haga mucho cambiar de palos»; ver
// docs/jefes/caddie.md). Un goblin grandote con la bolsa de golf a la espalda que canta un palo tras otro:
// solo el que canta le pega de verdad. Las versiones son las dos ideas de Leandro y la mezcla:
// - formaciones: con cada grito salen del piso formaciones pensadas para ese palo (mixtas desde la mitad).
// - sellos: les pone a los de la horda el sello de un palo; solo ese les pega entero.
// - mixto: siempre formaciones mixtas, cada parte con el sello de su palo.
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { escort, startCaddie, type CaddieCfg } from './fight';

const NAME = L('El Caddie', 'The Caddie');

function version(id: string, blurb: string, cfg: CaddieCfg): BossDef {
  return { id: `caddie.${id}`, name: NAME, blurb, escort, start: (ctx) => startCaddie(ctx, cfg) };
}

export const BOSSES: BossDef[] = [
  version(
    'formaciones',
    'Canta un palo cada 10–7 s y salen del piso formaciones para ese palo: columna (driver), pelotón (hierro), tortuga con escudos (wedge), emboscada cerca (putter). Desde la mitad, mixtas a la misma velocidad. A él solo le pega entero el palo que canta.', // i18n-ok: el panel de pruebas
    { formations: 'solo', sealed: false, seals: false, hint: L('Le pega el palo que canta; lo que sale del piso pide ese palo', 'Only the club he calls hurts him; what rises calls for that club') },
  ),
  version(
    'sellos',
    'Les tira la funda de un palo a los de la horda cada 3–2 s (hasta 6): sellados, solo ese palo les pega entero (los otros, 1). Si la cancha se vacía, saca más del piso. A él, el palo que canta.', // i18n-ok: el panel de pruebas
    { formations: 'none', sealed: false, seals: true, hint: L('Sellados: solo les pega entero el palo del sello', 'Sealed foes: only the club on the seal hits them fully') },
  ),
  version(
    'mixto',
    'Formaciones siempre mixtas (dos partes, tres desde el 60 % de vida perdida), a la misma velocidad, y cada parte con el sello de su palo: hay que cambiar de palo dentro de la misma formación.', // i18n-ok: el panel de pruebas
    { formations: 'mixed', sealed: true, seals: false, hint: L('Cada parte de la formación pide su palo', 'Each part of the formation calls for its club') },
  ),
];
