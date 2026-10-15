// El gusano de las cavernas: anticipar (ver fight.ts y docs/jefes/gusano.md). Las versiones cambian contra
// qué tira al asomar, si las lomas que deja quedan o se van, y si la tierra que se mueve también recibe.
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startWorm, type Variant } from './fight';

const NAME = L('El Gusano de las cavernas', 'The Cave Worm');

/** La base: al asomar te escupe a tu puesto, y las lomas quedan (hasta 10). */
const PUESTO: Variant = { target: 'player', moundsFade: false, tunnel: false };

export const BOSSES: BossDef[] = [
  {
    id: 'gusano.puesto',
    name: NAME,
    blurb: 'Asoma, te escupe al puesto (corréte) y se mete dejando una loma que queda. Solo recibe asomado.', // i18n-ok: el panel de pruebas
    start: (ctx) => startWorm(ctx, PUESTO),
  },
  {
    id: 'gusano.puerta',
    name: NAME,
    blurb: 'Asoma (un poco más que «puesto») y le escupe a la puerta, salvo que le pegues mientras asoma (con lo que sea). Las lomas quedan.', // i18n-ok: el panel de pruebas
    // asoma un 25% más (2.1 s → 1.4 s): pegarle mientras asoma pide anticipar, no adivinar (Leandro, 15/10)
    start: (ctx) => startWorm(ctx, { ...PUESTO, target: 'gate', window: 1.25 }),
  },
  {
    id: 'gusano.efimero',
    name: NAME,
    // fuera del panel (15/10): la única diferencia (las lomas se van a los 20 s) no se nota jugando, porque
    // con el tope de 10 el campo se ve igual. Sigue andando por la dirección.
    hidden: true,
    blurb: 'Como «puesto», pero cada loma baja sola a los 20 s: el campo no se llena tanto.', // i18n-ok: el panel de pruebas
    start: (ctx) => startWorm(ctx, { ...PUESTO, moundsFade: true }),
  },
  {
    id: 'gusano.tunel',
    name: NAME,
    // fuera del panel (15/10): «no me parece que haga falta» (Leandro). Sigue andando por la dirección.
    hidden: true,
    blurb: 'Como «puesto», y además la tierra que se mueve recibe: hierro, putter o globo adelantados le pegan bajo tierra.', // i18n-ok: el panel de pruebas
    start: (ctx) => startWorm(ctx, { ...PUESTO, tunnel: true }),
  },
];
