// Las habilidades: hielo, vendaval y granada.
//
// Después del segundo rediseño **los palos ya no llevan poder**: pegan su golpe y nada más. Lo que antes
// era combinar un palo con un elemento ahora son tres habilidades directas, cada una con su tecla, su
// recarga y **su propia pelota**: usarlas no toca la pelota que está en el puesto ni gasta ninguna otra.
// Salen al apretar la tecla, hacia donde está el mouse, y se pueden tirar hasta con un tiro cargando.
//
// Cada una nació de la combinación que más se usaba:
// - **Hielo** es el wedge con escarcha: un globo que cae donde apuntás y deja una zona fría.
// - **Vendaval** es el driver con vendaval: un tiro rasante que junta a todos sobre la línea. Nada más:
//   con el silencio encima quedaba demasiado fuerte.
// - **Granada** es nueva: un tiro rápido que no lastima. Se quedó con lo que antes hacía el hielo:
//   silencia (sin escudo, sin aura, sin inmunidad) y los deja vulnerables. Y los reacomoda: a los del
//   borde los tira a los costados, a los del centro los deja donde están.
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
    id: 'grenade', name: 'Granada', title: 'los silencia',
    hint: 'Un tiro rápido que cae donde apuntás y silencia a todos los que agarra: sin escudo, sin aura del chamán, sin inmunidad, y cada pelotazo les saca uno más. A los del borde los tira a los costados; a los del centro los deja quietos. No hace daño',
    cooldown: 6, range: 45, color: 0xffc94a,
  },
  ice: {
    id: 'ice', name: 'Hielo', title: 'zona fría',
    hint: 'Un globo que cae donde apuntás y deja el piso helado unos segundos: el que está adentro o entra después camina lento, y al salir se le pasa enseguida',
    cooldown: 10, range: 55, color: 0x7fd4ff,
  },
  wind: {
    id: 'wind', name: 'Vendaval', title: 'los junta',
    hint: 'Rasante, como el driver: el viento va detrás de la pelota y los junta sobre la línea del tiro, en fila para el próximo pelotazo',
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

/** Vendaval: el pasillo de viento que va detrás de la pelota, `halfWidth` a cada lado de la línea. */
export const WIND = { halfWidth: 3 };

/**
 * Granada: agarra a todos los que estén a `radius` de donde cae y los **silencia** `silence` segundos;
 * mientras dura, cada pelotazo les saca `vulnerable` de más. Los del **centro** (hasta `core` del
 * radio: un tercio) se quedan quietos; los de afuera salen hacia los costados de la línea del tiro,
 * hasta quedar a `push` metros de ella. Tirada al costado de un grupo los aparta; encima, los deja
 * donde están.
 */
export const GRENADE = { radius: 5, push: 6, core: 1 / 3, silence: 5, vulnerable: 1 };

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
