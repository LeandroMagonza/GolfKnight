// El minotauro embestidor: cortar una carga a tiempo (ver fight.ts y docs/jefes/minotauro.md). Las
// versiones cambian qué le hace un golpe mientras carga, cómo lo desvía la corrida, y cuánto cuesta dejarlo
// llegar a la puerta.
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startMinotaur, type Variant } from './fight';

const NAME = L('El Minotauro embestidor', 'The Charging Minotaur');

// La vida bajó el 15/10 (era 50 y 90): Leandro le ganó a «carga» a los 188 s, con 18 cargas («tiene mucha
// vida»). Y desde ese día, si te pasa rompe la puerta (media puerta: ver GATE_SMASH en fight.ts).

/** La base: el golpe mientras carga baja solo la carga; la vida, en las ventanas (aturdido, desviado). */
const CARGA: Variant = { hp: 30, hpWhileCharging: false, pinball: false, gateFalls: false, dazeBonus: 1 };
/** Cada golpe le baja la carga y la vida a la vez: más vida, pelea más pareja. */
const MIXTO: Variant = { hp: 55, hpWhileCharging: true, pinball: false, gateFalls: false, dazeBonus: 0 };
/**
 * Coraza (15/10, Leandro: «quizás le podría [poner] carga más chica y blindaje mientras carga»): la carga
 * es más chica (3, +1 cada una, hasta 7) pero blindada: cada golpe le baja uno menos (el flojo rebota) y a
 * la vida, nada. Pide golpes fuertes; la vida, en las ventanas como «carga».
 */
const CORAZA: Variant = { ...CARGA, armor: 1, charge: { first: 3, step: 1, max: 7 } };

export const BOSSES: BossDef[] = [
  {
    id: 'minotauro.carga',
    name: NAME,
    blurb: 'Golpe mientras carga: solo baja la carga. La vida baja aturdido o desviado. Si te pasa, media puerta.', // i18n-ok: el panel de pruebas
    start: (ctx) => startMinotaur(ctx, CARGA),
  },
  {
    id: 'minotauro.mixto',
    name: NAME,
    blurb: 'Golpe mientras carga: baja la carga y la vida a la vez (más vida). Si te pasa, media puerta.', // i18n-ok: el panel de pruebas
    start: (ctx) => startMinotaur(ctx, MIXTO),
  },
  {
    id: 'minotauro.billar',
    name: NAME,
    blurb: 'Como «carga», pero cada golpe de la corrida lo rebota en ángulo un poco (gana tiempo), no solo el último.', // i18n-ok: el panel de pruebas
    start: (ctx) => startMinotaur(ctx, { ...CARGA, pinball: true }),
  },
  {
    id: 'minotauro.brutal',
    name: NAME,
    blurb: 'Como «mixto», pero si llega a la puerta con carga, la puerta cae: se pierde.', // i18n-ok: el panel de pruebas
    start: (ctx) => startMinotaur(ctx, { ...MIXTO, gateFalls: true }),
  },
  {
    id: 'minotauro.coraza',
    name: NAME,
    blurb: 'Carga más chica (3 a 7) pero blindada: cada golpe le baja 1 menos (el flojo rebota), a la vida nada. Si te pasa, media puerta.', // i18n-ok: el panel de pruebas
    start: (ctx) => startMinotaur(ctx, CORAZA),
  },
];
