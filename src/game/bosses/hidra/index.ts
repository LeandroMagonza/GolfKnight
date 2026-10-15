// La hidra: tempo, un tiro flojo ya o uno fuerte después (ver fight.ts y docs/jefes/hidra.md). Las
// versiones cambian cuánto dura el muñón abierto, qué crece si no llegás, y cuándo se le puede pegar al cuerpo.
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startHydra, type Variant } from './fight';

const NAME = L('La Hidra', 'The Hydra');

/** La base: 2 s para quemar el muñón, le salen dos, y el cuerpo tapado mientras tenga cabezas. */
const CLASICA: Variant = { window: 2, regrow: 'two', body: 'covered' };

export const BOSSES: BossDef[] = [
  {
    id: 'hidra.clasica',
    name: NAME,
    blurb: 'Muñón 2 s o le salen dos. El cuerpo solo recibe sin cabezas (10 s), después le salen 3, 4, 5...', // i18n-ok: el panel de pruebas
    start: (ctx) => startHydra(ctx, CLASICA),
  },
  {
    id: 'hidra.fuerte',
    name: NAME,
    blurb: 'Como «clásica», pero si no quemás el muñón vuelve UNA cabeza roja, con casi el doble de vida y que ataca el doble.', // i18n-ok: el panel de pruebas
    start: (ctx) => startHydra(ctx, { ...CLASICA, regrow: 'strong' }),
  },
  {
    id: 'hidra.siempre',
    name: NAME,
    blurb: 'Al cuerpo se le pega siempre (el doble de vida); las cabezas solo atacan, y las quemadas vuelven a los 15 s.', // i18n-ok: el panel de pruebas
    start: (ctx) => startHydra(ctx, { ...CLASICA, body: 'always' }),
  },
  {
    id: 'hidra.apurada',
    name: NAME,
    blurb: 'Como «clásica», con 1,4 s para quemar el muñón: solo llega un golpe 1 desde una pelota al lado.', // i18n-ok: el panel de pruebas
    start: (ctx) => startHydra(ctx, { ...CLASICA, window: 1.4 }),
  },
];
