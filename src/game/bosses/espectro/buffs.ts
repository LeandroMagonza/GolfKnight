// Lo que el espectro le da a su huésped, escalón por escalón (ver index.ts). Cada versión tiene su
// escalera, y el último escalón es siempre el mismo: el élite (la calavera: el que entra tira la puerta y
// el que te pisa te mata, como el élite de cada escenario). Los poderes son los del juego, puestos en vivo
// (los lee en cada golpe: ver los getters de Enemy), y los íconos de arriba de la vida aparecen solos.
import { L } from '../../../i18n';
import { ARMOR_MAX, DIVINE, ELITE, REGEN, type EnemyMods } from '../../../core/waves';
import type { Enemy, Horde } from '../../enemies';

/**
 * Un escalón: `pulse`, +1 de vida y lo cura entero; `hp`, +2 y lo cura; `power`, un poder al azar que no
 * tenga (blindaje, bendito, esquiva, se cura); `elite`, el élite.
 */
export type Step = 'pulse' | 'hp' | 'power' | 'elite';

/** Lo que salió del escalón: para el cartelito, el brillo y el registro. */
export interface Given {
  what: 'hp' | 'armor' | 'divine' | 'dodge' | 'regen' | 'elite';
  label: string;
  color: string;
}

/** La vida de más que trae el élite que hace el espectro, además de curarse entero. */
const ELITE_HP = 2;
/** Los poderes que puede dar: los que se ven y se leen solos (el escudo sin su escudo a la vista, no). */
const POWERS = ['armor', 'divine', 'dodge', 'regen'] as const;

/**
 * Sus poderes, para tocarlos. Si los comparte con otro (el mismo objeto, como los de un grupo de la
 * oleada), le hace una copia propia: si no, al darle algo a uno se lo daba a todos.
 */
export function own(e: Enemy, horde: Horde): EnemyMods {
  if (horde.enemies.some((o) => o !== e && o.mods === e.mods)) (e as { mods: EnemyMods }).mods = { ...e.mods };
  return e.mods;
}

/** ¿Puede recibir este poder? (no lo tiene, y el blindaje no pasa del tope) */
function fits(e: Enemy, p: (typeof POWERS)[number]): boolean {
  switch (p) {
    case 'armor':
      return e.armorLevel < ARMOR_MAX;
    case 'divine':
      return !e.divineEvery;
    case 'dodge':
      return !e.mods.dodge;
    case 'regen':
      return !e.mods.regen;
  }
}

/** Le da a `e` lo del escalón `step`. `rng` elige el poder. */
export function give(e: Enemy, step: Step, horde: Horde, rng: () => number): Given {
  if (step === 'power') {
    const open = POWERS.filter((p) => fits(e, p));
    // si ya tiene todos, le da vida
    if (!open.length) return give(e, 'hp', horde, rng);
    const p = open[Math.floor(rng() * open.length)];
    const m = own(e, horde);
    switch (p) {
      case 'armor':
        m.armor = Math.min(ARMOR_MAX, e.armorLevel + 1);
        return { what: 'armor', label: L('+blindaje', '+armor'), color: '#a9c4e0' };
      case 'divine':
        m.divine = DIVINE.every;
        e.divineReady = true;
        return { what: 'divine', label: L('¡bendito!', 'blessed!'), color: '#ffd96a' };
      case 'dodge':
        m.dodge = true;
        return { what: 'dodge', label: L('¡escurridizo!', 'slippery!'), color: '#3fe0cc' };
      case 'regen':
        m.regen = REGEN.margin;
        return { what: 'regen', label: L('¡se cura!', 'regenerates!'), color: '#6be38a' };
    }
  }
  if (step === 'elite') {
    const m = own(e, horde);
    m.size = Math.max(ELITE.minScale, ELITE.height / e.stats.height);
    // lo que creció con los escalones ya lo cubre el tamaño de élite
    m.giant = 1;
    m.speed = (m.speed ?? 1) * ELITE.speed;
    e.setHp(e.maxHp + ELITE_HP, e.maxHp + ELITE_HP);
    return { what: 'elite', label: L('¡ÉLITE!', 'ELITE!'), color: '#ff5a5a' };
  }
  const n = step === 'hp' ? 2 : 1;
  e.setHp(e.maxHp + n, e.maxHp + n);
  return { what: 'hp', label: L(`+${n} vida`, `+${n} HP`), color: '#6be38a' };
}
