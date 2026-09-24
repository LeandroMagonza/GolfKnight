// Las habilidades: hielo, vendaval y granada.
//
// Después del segundo rediseño **los palos ya no llevan poder**: pegan su golpe y nada más. Lo que antes
// era combinar un palo con un elemento ahora son tres habilidades directas, cada una con su tecla, su
// recarga y **su propia pelota**: usarlas no toca la pelota que está en el puesto ni gasta ninguna otra.
// Salen al apretar la tecla, hacia donde está el mouse, y se pueden tirar hasta con un tiro cargando.
//
// Cada una nació de la combinación que más se usaba:
// - **Hielo** es el wedge con escarcha: un globo que cae donde apuntás y deja una zona fría.
// - **Vendaval** es el driver con vendaval: un tiro rasante que junta a todos sobre la línea. Y se quedó
//   con lo que antes hacía el hielo: silencia (sin escudo, sin aura, sin inmunidad) y los deja vulnerables.
// - **Granada** es nueva: un tiro rápido que no lastima, solo los reacomoda para el driver.
//
// **Todos los números de las habilidades están acá**, y se tocan en vivo en el panel de balance (B).

export type AbilityId = 'grenade' | 'ice' | 'wind';

export interface Ability {
  id: AbilityId;
  name: string;
  title: string;
  hint: string;
  /** Segundos de recarga. */
  cooldown: number;
  /** Hasta dónde llega, en metros. El globo y la granada caen donde apuntás, recortado a esto. */
  range: number;
  color: number;
}

export const ABILITIES: Record<AbilityId, Ability> = {
  grenade: {
    id: 'grenade', name: 'Granada', title: 'los alinea',
    hint: 'Un tiro rápido que cae donde apuntás y los tira a los costados: quedan en dos filas mirando hacia vos, servidas para el driver. No hace daño',
    cooldown: 6, range: 45, color: 0xffc94a,
  },
  ice: {
    id: 'ice', name: 'Hielo', title: 'zona fría',
    hint: 'Un globo que cae donde apuntás y deja el piso helado unos segundos: el que está adentro o entra después camina lento, y al salir se le pasa enseguida',
    cooldown: 10, range: 55, color: 0x7fd4ff,
  },
  wind: {
    id: 'wind', name: 'Vendaval', title: 'los silencia',
    hint: 'Rasante, como el driver: los junta sobre la línea del tiro y los silencia. Sin escudo, sin aura del chamán, sin inmunidad, y cada pelotazo les saca uno más',
    cooldown: 8, range: 55, color: 0xff6b4a,
  },
};

/** El orden de las teclas Q, W y E. */
export const ABILITY_ORDER: AbilityId[] = ['grenade', 'ice', 'wind'];
export const ABILITY_KEYS = ['Q', 'W', 'E'];

/**
 * Hielo: la zona que deja al caer. Todo enemigo que esté adentro cuando cae, o que entre mientras
 * dura, camina a `slow` de su velocidad; al salir, el frío se le va a los `linger` segundos.
 */
export const ICE = { radius: 4, duration: 5, linger: 0.5, slow: 0.4 };

/**
 * Vendaval: el pasillo de viento que va detrás de la pelota, `halfWidth` a cada lado de la línea.
 * Silencia `silence` segundos, y mientras dura cada pelotazo le saca `vulnerable` de más.
 */
export const WIND = { halfWidth: 3, silence: 5, vulnerable: 1 };

/**
 * Granada: agarra a todos los que estén a `radius` de donde cae y los tira a los costados de la línea
 * del tiro, hasta dejarlos a `push` metros de ella: dos filas paralelas al tiro.
 */
export const GRENADE = { radius: 4, push: 5 };

/**
 * Cuánto hay que correr hacia el costado a uno que está a `lateral` metros de la línea de la granada
 * (con signo) para que quede a `push` metros de ella, del mismo lado. Los que ya están más allá no se
 * mueven: la granada ordena, no aleja.
 */
export function grenadeShift(lateral: number, push: number): number {
  const gap = push - Math.abs(lateral);
  if (gap <= 0) return 0;
  return lateral >= 0 ? gap : -gap;
}
