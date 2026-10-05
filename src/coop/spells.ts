// Los hechizos de Abe, el segundo jugador (ver docs/multijugador.md y coop/abe.ts): qué hay, sus números
// por nivel, cómo se explican, y cómo los va ganando. Sin Three.js: se prueba sin navegador.
//
// Abe juega desde arriba, como un dios que mira la cancha: sus hechizos llegan a toda la cancha, agarran
// poco, duran poco y **ninguno pega**. Abe prepara la jugada y el caballero la cobra. Nunca se habla de
// palos: cada hechizo es una **zona** (un círculo donde tocás), una **línea** (del caballero hasta donde
// tocás) o una **trampa** (queda en el piso hasta que alguien la pisa).
//
// **Cómo los gana**: arranca eligiendo el primero, y al terminar cada oleada elige otro, hasta tener
// `ABE_SLOTS`. Con los lugares llenos le salen hechizos de un nivel más que el más bajo que tiene
// (cualquiera, no solo los que ya tiene), y elige si reemplaza uno o se queda como está. Cuando todos son
// de nivel 2, salen de nivel 3. Puede tener el mismo hechizo dos veces, de distinto nivel: cada lugar
// recarga por su lado.

import { L } from '../i18n';

export type SpellId = 'hail' | 'whirl' | 'current' | 'push' | 'curse' | 'hush' | 'trap';
export const SPELL_ORDER: SpellId[] = ['hail', 'whirl', 'current', 'push', 'curse', 'hush', 'trap'];
/** Cuántos hechizos tiene Abe a la vez (los botones). */
export const ABE_SLOTS = 4;
export const SPELL_MAX_LEVEL = 3;
/** Cuántos le ofrecen cada vez. */
export const OFFER_SIZE = 3;

/** La forma de un hechizo. Es una etiqueta interna: lo que se lee lo arma `spellSize`. */
export type SpellShape = 'zona' | 'línea' | 'trampa'; // i18n-ok: etiqueta interna

/**
 * Los números de cada hechizo. Los que van en lista son por nivel (1, 2, 3). `cooldown` es la recarga y
 * `delay` lo que tarda en salir desde que se marca. Se tocan en el panel de balance (B): cuentan los del
 * que juega.
 */
export const ABE_SPELLS = {
  /** Granizo: al rato cae hielo y los frena `seconds`; desde el nivel `freezeFrom`, además los congela. */
  hail: { cooldown: 8, delay: 1.5, radius: [3, 3.5, 4], seconds: [3, 4, 5], freezeFrom: 3 },
  /** Remolino: los del círculo se van al centro (hasta un metro de él). Al jefe no. */
  whirl: { cooldown: 8, delay: 0.5, radius: [2.5, 3, 3.5] },
  /** Corriente: del caballero hasta donde tocás, los que están a `width` de la línea quedan sobre ella. */
  current: { cooldown: 10, delay: 0.5, width: [2, 2.5, 3] },
  /** Empujón: los del círculo salen `distance` m para atrás (hacia el fondo). Al jefe no. */
  push: { cooldown: 10, delay: 0.5, radius: [2.5, 3, 3.5], distance: [6, 8, 10] },
  /** Maldición: crecen y reciben 1 más por golpe durante `seconds`. */
  curse: { cooldown: 10, delay: 0.5, radius: [2.5, 3, 3.5], seconds: [3, 4, 5] },
  /** Silencio: se les apagan los poderes `seconds` (al élite, la mitad). */
  hush: { cooldown: 10, delay: 0.5, radius: [2.5, 3, 3.5], seconds: [2, 2.5, 3] },
  /**
   * Trampa: queda en el piso hasta `life` s. El primero que pasa a `trigger` m la dispara, y todos los que
   * están a `radius` quedan atrapados `seconds` (sin moverse ni atacar). A los pesados no los agarra.
   */
  trap: { cooldown: 10, delay: 0.4, life: 15, trigger: 1.2, radius: [2, 2.5, 3], seconds: [1.5, 2, 2.5] },
};

/**
 * El ataque básico de Abe (5/10, pedido de Leandro): la **chispa**. Es lo que sale al tocar el piso sin
 * hechizo elegido, así Abe siempre tiene algo para hacer. Recarga `cooldown` s, cae a los `delay` s en un
 * círculo de `radius` m (unos dos enemigos de ancho), y los que agarra quedan **clavados** `seconds` s:
 * no caminan, pero sí atacan, y el escudo sigue arriba. Al jefe no. No pega.
 */
export const ABE_BOLT = { cooldown: 1.2, delay: 0.25, radius: 1.1, seconds: 0.5 };
export const BOLT_INFO = { name: L('Chispa', 'Spark'), icon: '✨', color: 0xe6b3ff };

/** Qué hace la chispa, para el panel. */
export function boltHint(): string {
  return L(`Los que agarra quedan clavados ${n(ABE_BOLT.seconds)} s`, `Pins down whoever it catches for ${n(ABE_BOLT.seconds)} s`);
}

/** El número de un nivel en una tabla por nivel (o el número, si es igual en todos). */
export function at(v: number | number[], level: number): number {
  return Array.isArray(v) ? v[Math.min(v.length, Math.max(1, level)) - 1] : v;
}

/** El tamaño del hechizo en ese nivel: el radio de la zona, o el ancho a cada lado de la línea. */
export function sizeOf(id: SpellId, level: number): number {
  const t = ABE_SPELLS[id] as { radius?: number[]; width?: number[] };
  return at(t.radius ?? t.width ?? 3, level);
}

export const SPELL_INFO: Record<SpellId, { name: string; icon: string; color: number; shape: SpellShape }> = {
  hail: { name: L('Granizo', 'Hail'), icon: '❄', color: 0x9fe3ff, shape: 'zona' },
  whirl: { name: L('Remolino', 'Whirlwind'), icon: '🌀', color: 0x8fe3b0, shape: 'zona' },
  current: { name: L('Corriente', 'Current'), icon: '💨', color: 0x7fd8ff, shape: 'línea' }, // i18n-ok: la forma es una etiqueta interna
  push: { name: L('Empujón', 'Shove'), icon: '✋', color: 0xffe08a, shape: 'zona' },
  curse: { name: L('Maldición', 'Curse'), icon: '🎯', color: 0xc6f06a, shape: 'zona' },
  hush: { name: L('Silencio', 'Silence'), icon: '🔇', color: 0xff8a6b, shape: 'zona' },
  trap: { name: L('Trampa', 'Trap'), icon: '🪤', color: 0xd9a35a, shape: 'trampa' },
};

const n = (v: number) => `${+v.toFixed(1)}`;

/** Qué hace el hechizo en ese nivel, corto, con sus números. */
export function spellHint(id: SpellId, level: number): string {
  const s = ABE_SPELLS;
  switch (id) {
    case 'hail': {
      const t = n(at(s.hail.seconds, level));
      const freezes = level >= s.hail.freezeFrom;
      return L(`Al rato cae hielo: los frena ${t} s${freezes ? ' y los congela' : ''}`, `Ice falls after a beat: slows them for ${t} s${freezes ? ' and freezes them' : ''}`);
    }
    case 'whirl': return L('Los junta en el centro', 'Pulls them to the center');
    case 'current': return L('Del caballero hasta donde tocás: los pone en fila, uno detrás del otro', 'From the knight to where you tap: lines them up, one behind the other');
    case 'push': return L(`Los manda ${n(at(s.push.distance, level))} m para atrás`, `Sends them ${n(at(s.push.distance, level))} m back`);
    case 'curse': return L(`Crecen y reciben 1 más por golpe, ${n(at(s.curse.seconds, level))} s`, `They grow and take 1 more per hit, ${n(at(s.curse.seconds, level))} s`);
    case 'hush': return L(`Se les apagan los poderes ${n(at(s.hush.seconds, level))} s`, `Their powers shut off for ${n(at(s.hush.seconds, level))} s`);
    case 'trap': return L(`Queda en el piso: el primero que la pisa los deja atrapados ${n(at(s.trap.seconds, level))} s`, `Stays on the ground: the first to step on it traps them for ${n(at(s.trap.seconds, level))} s`);
  }
}

/** Cómo se lee cada forma. */
const SHAPE_LABEL: Record<SpellShape, string> = {
  zona: L('zona', 'zone'),
  'línea': L('línea', 'line'), // i18n-ok: la clave es la etiqueta interna
  trampa: L('trampa', 'trap'),
};

/** El tamaño, para la carta: «zona de 3 m», «línea de 2 m de ancho», «trampa de 2.5 m». */
export function spellSize(id: SpellId, level: number): string {
  const shape = SPELL_INFO[id].shape;
  const line = shape === 'línea'; // i18n-ok: compara la etiqueta interna
  const size = n(sizeOf(id, level) * (line ? 2 : 1));
  if (line) return L(`línea de ${size} m de ancho`, `${size} m wide line`);
  return L(`${SHAPE_LABEL[shape]} de ${size} m`, `${size} m ${SHAPE_LABEL[shape]}`);
}

// ---------- cómo los gana ----------

export interface AbeSlot {
  id: SpellId;
  level: number;
}

/** Lo que le ofrecen: `OFFER_SIZE` hechizos, todos del mismo nivel. */
export interface Offer {
  level: number;
  spells: SpellId[];
}

/**
 * Qué le ofrecen ahora. Con lugares libres, de nivel 1 y que no tenga. Con todo lleno, de un nivel más que
 * el más bajo que tiene: cualquiera, menos uno que ya tenga en ese mismo nivel. Null si ya no hay nada que
 * darle (todos en el máximo).
 */
export function nextOffer(slots: AbeSlot[], rand: () => number = Math.random): Offer | null {
  let level = 1;
  let pool: SpellId[];
  if (slots.length < ABE_SLOTS) {
    pool = SPELL_ORDER.filter((id) => !slots.some((s) => s.id === id));
  } else {
    level = Math.min(...slots.map((s) => s.level)) + 1;
    if (level > SPELL_MAX_LEVEL) return null;
    pool = SPELL_ORDER.filter((id) => !slots.some((s) => s.id === id && s.level === level));
  }
  if (!pool.length) return null;
  const spells: SpellId[] = [];
  const left = [...pool];
  while (spells.length < OFFER_SIZE && left.length) spells.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return { level, spells };
}

/**
 * Elige de la oferta: la carta `card` (o -1 para quedarse como está, solo con todo lleno) y, con todo
 * lleno, en qué lugar va (`slot`). Devuelve los lugares nuevos, o null si la elección no vale.
 */
export function applyPick(slots: AbeSlot[], offer: Offer, card: number, slot: number): AbeSlot[] | null {
  if (card === -1) return slots.length >= ABE_SLOTS ? slots : null;
  const id = offer.spells[card];
  if (!id) return null;
  const next = slots.map((s) => ({ ...s }));
  if (next.length < ABE_SLOTS) {
    next.push({ id, level: offer.level });
    return next;
  }
  if (!Number.isInteger(slot) || slot < 0 || slot >= next.length) return null;
  next[slot] = { id, level: offer.level };
  return next;
}
