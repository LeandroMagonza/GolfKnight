// El minotauro embestidor: cortar una carga a tiempo (ver fight.ts y docs/jefes/minotauro.md). Las
// versiones cambian qué le hace un golpe mientras carga, cómo lo desvía la corrida, y cuánto cuesta dejarlo
// llegar a la puerta.
import { L } from '../../../i18n';
import type { BossDef } from '../types';
import { startMinotaur, type Variant } from './fight';

const NAME = L('El Minotauro embestidor', 'The Charging Minotaur');

/** La base: el golpe mientras carga baja solo la carga; la vida, en las ventanas (aturdido, desviado). */
const CARGA: Variant = { hp: 50, hpWhileCharging: false, pinball: false, gateFalls: false, dazeBonus: 1 };
/** Cada golpe le baja la carga y la vida a la vez: más vida, pelea más pareja. */
const MIXTO: Variant = { hp: 90, hpWhileCharging: true, pinball: false, gateFalls: false, dazeBonus: 0 };

export const BOSSES: BossDef[] = [
  {
    id: 'minotauro.carga',
    name: NAME,
    blurb: 'Golpe mientras carga: solo baja la carga. La vida baja aturdido o desviado. Llega: puerta − lo que le quedó.', // i18n-ok: el panel de pruebas
    start: (ctx) => startMinotaur(ctx, CARGA),
  },
  {
    id: 'minotauro.mixto',
    name: NAME,
    blurb: 'Golpe mientras carga: baja la carga y la vida a la vez (más vida). Llega: puerta − lo que le quedó.', // i18n-ok: el panel de pruebas
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
];
