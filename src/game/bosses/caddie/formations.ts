// Las formaciones del caddie (ver docs/jefes/caddie.md): cada una está pensada para un palo, con los poderes
// que ya existen y la forma en que vienen, no con reglas nuevas.
//
// - **Columna** (driver): goblinas en fila india sobre la fila de un puesto, al fondo. El driver atraviesa:
//   desde ese puesto, un tiro se lleva la fila entera (de lejos, el golpe 1 ya les saca 2).
// - **Pelotón** (hierro): orcos de 3 de vida apretados. El hierro le pega al primero y revienta encima de
//   los otros: un golpe 3 se lleva a los cinco; el driver agarra dos o tres.
// - **Tortuga** (wedge): goblinas con escudo 3, en bloque, mirando a la puerta. De frente rebota todo (y te
//   vuelve); el globo cae a plomo, y detrás de ellas el escudo no cubre.
// - **Emboscada** (putter): tres goblinas con blindaje 1 que salen del piso a 10–19 m, separadas. El putter
//   de cerca les saca 3 con el golpe 2 (2 pasan el blindaje); el driver de cerca necesita el golpe 3.
// - **Acorazados** (putter, en las mixtas): dos goblinas con blindaje 2 en fila. Hasta que llegan a tiro del
//   putter, solo un driver clavado de lejos les entra (la idea de Leandro: «si está adelante le ponga
//   blindaje 2, para que casi que sin el putter y un poco de carga no lo puedas matar»).
//
// Las mixtas juntan dos o tres de estas, una al lado de la otra, a la misma velocidad: llegan juntas y hay
// que ir cambiando de palo.
import type { ClubId } from '../../../core/clubs';
import { fieldHalfAt, laneX } from '../../../core/field';
import type { EnemyKind, EnemyMods } from '../../../core/waves';
import { TEE_Z } from '../kit';

export type PartId = 'columna' | 'peloton' | 'tortuga' | 'emboscada' | 'acorazados';

/** El palo de cada parte. */
export const PART_CLUB: Record<PartId, ClubId> = { columna: 'driver', peloton: 'iron', tortuga: 'wedge', emboscada: 'putter', acorazados: 'putter' };
/** La parte de cada palo cuando va sola, y cuando va en una mixta (el putter cambia: no sale del piso cerca). */
export const SOLO_PART: Record<ClubId, PartId> = { driver: 'columna', iron: 'peloton', wedge: 'tortuga', putter: 'emboscada' };
export const MIXED_PART: Record<ClubId, PartId> = { driver: 'columna', iron: 'peloton', wedge: 'tortuga', putter: 'acorazados' };

/** Un lugar de la formación: qué sale y dónde. */
export interface Slot {
  kind: EnemyKind;
  mods: EnemyMods;
  x: number;
  z: number;
  part: PartId;
}

/** Cuántos tiene cada parte y cómo van. */
export const FORM = {
  /** La columna: cuántas, a qué distancia una de otra, y dónde empieza (z del primero). */
  column: { count: 6, gap: 2.6, front: [47, 50] as [number, number] },
  /** El pelotón y la tortuga: dónde está el centro (z). */
  mid: [38, 44] as [number, number],
  /** La emboscada: a cuántos metros de la línea salen (z = TEE_Z + esto). */
  ambush: [10, 19] as [number, number],
  /** El frente de las mixtas (z del primero de cada parte). */
  mixedFront: [43, 47] as [number, number],
  /** El escudo de la tortuga. */
  shield: 3,
  /** Velocidad de marcha de todas (m/s): la misma para todos, así llegan juntos. La emboscada, un poco más. */
  speed: 2.0,
  ambushSpeed: 2.3,
};

const lerp = (r: [number, number], u: number) => r[0] + (r[1] - r[0]) * u;

/** x dentro de la cancha a esa altura, con margen. */
export function clampX(x: number, z: number, margin = 1.6): number {
  const h = fieldHalfAt(z) - margin;
  return Math.max(-h, Math.min(h, x));
}

/** El puesto cuya fila pasa más cerca de (x, z). */
function laneSpot(spots: readonly number[], x: number, z: number): number {
  let best = spots[0];
  for (const s of spots) if (Math.abs(laneX(s, TEE_Z, z) - x) < Math.abs(laneX(best, TEE_Z, z) - x)) best = s;
  return best;
}

/** Una parte, alrededor de `x` con el frente en `z` (la emboscada no usa ni `x` ni `z`: sale cerca de la línea). */
export function buildPart(part: PartId, x: number, z: number, spots: readonly number[], rng: () => number): Slot[] {
  const out: Slot[] = [];
  const at = (kind: EnemyKind, mods: EnemyMods, px: number, pz: number) => out.push({ kind, mods, x: clampX(px, pz), z: pz, part });
  switch (part) {
    case 'columna': {
      // sobre la fila de un puesto: desde ese puesto, el driver la atraviesa entera
      const spot = laneSpot(spots, x, z);
      for (let i = 0; i < FORM.column.count; i++) {
        const zi = z + i * FORM.column.gap;
        at('goblina', {}, laneX(spot, TEE_Z, zi), zi);
      }
      break;
    }
    case 'peloton': {
      // un rombo con uno en el medio: todos a menos de 2.4 m del centro
      const cz = z + 1.2;
      for (const [dx, dz] of [[0, -1.2], [-1.5, 0], [1.5, 0], [0, 1.2], [0, 0]]) at('orc', {}, x + dx, cz + dz);
      break;
    }
    case 'tortuga': {
      // tres de frente y tres detrás, pegadas, con escudo
      for (const dz of [0, 1.3]) for (const dx of [-1.3, 0, 1.3]) at('goblina', { shield: FORM.shield }, x + dx, z + dz);
      break;
    }
    case 'acorazados': {
      for (const dx of [-1.6, 1.6]) at('goblina', { armor: 2 }, x + dx, z);
      break;
    }
    case 'emboscada': {
      // tres, en filas de puestos distintos y separadas: ni el driver ni un área agarran a dos
      const pool = [...spots];
      const chosen: number[] = [];
      for (let tries = 0; chosen.length < 3 && tries < 40; tries++) {
        const s = pool[Math.floor(rng() * pool.length)];
        if (chosen.some((c) => Math.abs(c - s) < 6)) continue;
        chosen.push(s);
      }
      while (chosen.length < 3) chosen.push((chosen.length - 1) * 8);
      for (const s of chosen) {
        const zi = TEE_Z + lerp(FORM.ambush, rng());
        at('goblina', { armor: 1 }, laneX(s, TEE_Z, zi) + (rng() * 2 - 1) * 0.8, zi);
      }
      break;
    }
  }
  return out;
}

/**
 * Una formación: una parte sola (`parts` de uno) o varias una al lado de la otra, a la misma altura.
 * `bossX`: dónde está el caddie (la columna va lejos de él, para no salir encima).
 */
export function buildFormation(parts: PartId[], bossX: number, spots: readonly number[], rng: () => number): Slot[] {
  if (parts.length === 1) {
    const part = parts[0];
    const side = bossX > 0 ? -1 : 1;
    if (part === 'columna') {
      const z = lerp(FORM.column.front, rng());
      return buildPart(part, side * (3 + rng() * 9), z, spots, rng);
    }
    if (part === 'emboscada') return buildPart(part, 0, 0, spots, rng);
    const z = lerp(FORM.mid, rng());
    return buildPart(part, (rng() * 2 - 1) * 9, z, spots, rng);
  }
  // varias: repartidas a lo ancho (en orden al azar), con el mismo frente
  const z = lerp(FORM.mixedFront, rng());
  const xs = parts.length === 2 ? [-6.5, 6.5] : [-10, 0, 10];
  const order = [...parts].sort(() => rng() - 0.5);
  return order.flatMap((p, i) => buildPart(p, xs[i] + (rng() * 2 - 1) * 1.5, z, spots, rng));
}
