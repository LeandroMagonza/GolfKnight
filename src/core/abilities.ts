// Las habilidades. **Todos sus números están acá**, y se tocan en vivo en el panel de balance (B).
//
// Las habilidades no vienen fijas: se ganan eligiendo cartas entre oleadas (ver core/cards) y van en
// cuatro lugares, Q, W, E y R. Cada una tira **su propia pelota**: no gasta la del puesto ni ninguna
// otra, y sale en el acto hacia el mouse. Una carta de una habilidad que ya tenés la sube de nivel (hasta
// 3): pega más o agarra más, pero **también tarda más en recargar**, así que subir no es gratis.
//
// Hay de dos familias:
// - **Palo y elemento**: cualquier palo con hielo, fuego o rayo. Es un tiro de ese palo, instantáneo,
//   con pelota gratis y cargado al nivel de la habilidad: el driver de hielo a nivel 1 es un driver nivel
//   1 que además enfría a cada uno que atraviesa.
// - **Las demás**, cada una con su mecánica propia: granada, hielo, vendaval, carrito, hoyo, bandera,
//   pólvora, boomerang, lluvia de pelotas, caddie dorado, lupa y clon.
import type { ClubId } from './clubs';

export type AbilityId = string;
export type Element = 'ice' | 'fire' | 'lightning';
export type AbilityKind =
  | 'grenade' | 'iceZone' | 'wind' | 'shot' | 'cart' | 'hole' | 'flag' | 'powder' | 'boomerang' | 'rain' | 'caddie' | 'lens' | 'clone';

export interface Ability {
  id: AbilityId;
  kind: AbilityKind;
  name: string;
  title: string;
  hint: string;
  /** Segundos de recarga a nivel 1. Cada nivel más le suma `LEVELS.cooldownGrowth`. */
  cooldown: number;
  /** Hasta dónde llega, en metros. Lo que cae donde apuntás cae ahí, recortado a esto. */
  range: number;
  color: number;
  /** Solo las de palo y elemento. */
  club?: ClubId;
  element?: Element;
}

/** Los cuatro lugares de habilidad y sus teclas. */
export const ABILITY_KEYS = ['Q', 'W', 'E', 'R'];
export const SLOTS = ABILITY_KEYS.length;
export const MAX_LEVEL = 3;
/** Cuánto más tarda en recargar cada nivel de más: con 0.3, el nivel 3 recarga un 60 % más lento. */
export const LEVELS = { cooldownGrowth: 0.3 };

export function cooldownAt(a: Ability, level: number): number {
  return a.cooldown * (1 + LEVELS.cooldownGrowth * (Math.max(1, level) - 1));
}

/** El número de un nivel (1, 2 o 3) en una tabla por nivel. */
export function lv(table: number[], level: number): number {
  return table[Math.min(table.length, Math.max(1, level)) - 1];
}

/** Lo que vuelve **vulnerable** a un enemigo (el silencio de la granada, la lupa): cada pelotazo le saca esto de más. */
export const VULNERABLE = { bonus: 1 };

/**
 * Hielo: la zona que deja al caer. Todo enemigo que esté adentro cuando cae, o que entre mientras dura,
 * camina a `slow` de su velocidad; al salir, el frío se le va a los `linger` segundos.
 */
export const ICE = { radius: [4, 4.75, 5.5], duration: [5, 6.5, 8], linger: 0.5, slow: 0.4 };

/** Vendaval: el pasillo de viento que va detrás de la pelota, `halfWidth` a cada lado de la línea. */
export const WIND = { halfWidth: [3, 3.75, 4.5] };

/**
 * Granada: agarra a todos los que estén a `radius` de donde cae y los **silencia** `silence` segundos
 * (sin escudo, sin aura, sin inmunidad, y vulnerables). Los del **centro** (hasta `core` del radio) se
 * quedan quietos; los de afuera salen hacia los costados de la línea del tiro, hasta quedar a `push`
 * metros de ella.
 */
export const GRENADE = { radius: [5, 5.75, 6.5], push: [6, 6.75, 7.5], core: 1 / 3, silence: [5, 6.5, 8] };

/**
 * Los elementos de los tiros de palo y elemento.
 * - **Hielo**: enfría `iceSeconds` a cada uno que alcanza. Con la maestría, al que ya estaba frío lo
 *   **congela** `freezeSeconds`, y el golpe que rompe el hielo pega el doble.
 * - **Fuego**: lo prende `burnSeconds`, y le saca `burnDamage` cada `burnTick` segundos. Con la maestría,
 *   el que muere prendido contagia a los que tiene a `spreadRadius`.
 * - **Rayo**: del que alcanza salta a `chainJumps` más, a `chainRange` como mucho, sacándole `chainDamage`
 *   a cada uno. **Nunca salta a uno que ya tocó**, así que no puede dar vueltas matando a todo. Con la
 *   maestría salta una vez más y cada salto pega el doble.
 */
export const ELEMENTS = {
  iceSeconds: [3, 4, 5], freezeSeconds: 2,
  burnSeconds: [3, 4, 5], burnTick: 1, burnDamage: 1, spreadRadius: 2.5,
  chainJumps: [1, 2, 3], chainRange: 6, chainDamage: 1,
};

/** Carrito de golf: cruza el campo de costado a costado, a la altura que apuntás, y atropella. */
export const CART = { damage: [2, 3, 4], speed: 20, width: 1.2 };
/** Hoyo: el primero que lo pisa cae y muere (los jefes no). Se traga a `swallows` y se cierra. */
export const HOLE = { swallows: [1, 2, 3], life: 15, radius: 0.9 };
/** Bandera: los que están a `radius` se desvían a caminar hacia ella durante `seconds`. */
export const FLAG = { radius: [10, 12, 14], seconds: [4, 5, 6] };
/** Pólvora: marca a los que están a `radius`; el marcado que muere explota y le saca `damage` a los de al lado. */
export const POWDER = { radius: [3, 3.5, 4], blast: 2.5, damage: [2, 2, 3], life: 8 };
/**
 * Boomerang: tirás **el palo que tenés en la mano**, que sale girando `reach` metros y vuelve por otro
 * lado, abierto `width` metros. Le pega a cada uno una vez de ida y una de vuelta. Mientras está en el
 * aire ese palo no se puede usar.
 */
export const BOOMERANG = { damage: [2, 3, 4], reach: 28, width: 4, seconds: 1.8, hitRadius: 1.1 };
/** Caddie dorado: durante `seconds`, tu puesto nunca se queda sin pelota, y las pelotas son doradas. */
export const CADDIE = { seconds: [4, 6, 8] };
/** Lupa: los que están a `radius` crecen `scale` veces durante `seconds`: más fáciles de pegar, y vulnerables. */
export const LENS = { radius: [3.5, 4, 4.5], seconds: [5, 6, 7], scale: 1.6 };
/** Clon: deja una copia tuya donde estás; tus próximos `shots` tiros salen también desde ahí, hacia el mismo lado. */
export const CLONE = { shots: [1, 2, 3], life: 20 };

/** Todas las tablas de números de las habilidades, por nombre: el panel de balance las recorre. */
export const ABILITY_CONFIG: Record<string, Record<string, number | number[]>> = {
  hielo: ICE, vendaval: WIND, granada: GRENADE, elementos: ELEMENTS, carrito: CART, hoyo: HOLE,
  bandera: FLAG, 'pólvora': POWDER, boomerang: BOOMERANG, caddie: CADDIE, lupa: LENS, clon: CLONE,
};

const BASE: Ability[] = [
  {
    id: 'grenade', kind: 'grenade', name: 'Granada', title: 'los silencia', cooldown: 6, range: 45, color: 0xffc94a,
    hint: 'Cae donde apuntás y silencia a todos los que agarra: sin escudo, sin aura del chamán, sin inmunidad, y vulnerables. A los del borde los tira a los costados; a los del centro los deja quietos. No hace daño',
  },
  {
    id: 'ice', kind: 'iceZone', name: 'Hielo', title: 'zona fría', cooldown: 10, range: 55, color: 0x7fd4ff,
    hint: 'Un globo que cae donde apuntás y deja el piso helado unos segundos: el que está adentro, o entra después, camina lento',
  },
  {
    id: 'wind', kind: 'wind', name: 'Vendaval', title: 'los junta', cooldown: 8, range: 55, color: 0x8fe3b0,
    hint: 'Rasante, como el driver: el viento va detrás de la pelota y los junta sobre la línea del tiro',
  },
  {
    id: 'cart', kind: 'cart', name: 'Carrito', title: 'atropella', cooldown: 14, range: 60, color: 0xe9e2cf,
    hint: 'Un carrito de golf cruza el campo de costado a costado, a la altura que apuntás, y atropella a todos los que encuentra',
  },
  {
    id: 'hole', kind: 'hole', name: 'Hoyo', title: 'se lo traga', cooldown: 12, range: 55, color: 0x9aa4b2,
    hint: 'Abre un hoyo donde apuntás: el primero que lo pisa cae y no vuelve. A los jefes no se los traga',
  },
  {
    id: 'flag', kind: 'flag', name: 'Bandera', title: 'los desvía', cooldown: 15, range: 55, color: 0xd8413a,
    hint: 'Planta una bandera donde apuntás: los que están cerca se olvidan de la puerta y van hacia ella un rato',
  },
  {
    id: 'powder', kind: 'powder', name: 'Pólvora', title: 'en cadena', cooldown: 10, range: 50, color: 0xb0413e,
    hint: 'Marca a los que agarra donde cae. El marcado que muere explota y le pega a los de al lado, y si esos también estaban marcados, siguen explotando',
  },
  {
    id: 'boomerang', kind: 'boomerang', name: 'Boomerang', title: 'tu palo', cooldown: 9, range: 28, color: 0xcfd6e0,
    hint: 'Tirás el palo que tenés en la mano: sale girando, vuelve por otro lado y le pega a cada uno de ida y de vuelta. Mientras vuela, ese palo no lo podés usar',
  },
  {
    id: 'rain', kind: 'rain', name: 'Lluvia de pelotas', title: 'todos los puestos', cooldown: 40, range: 0, color: 0xfff1b8,
    hint: 'Los guardias llenan todos los puestos de una. No tiran más hasta que gastes las de sobra',
  },
  {
    id: 'caddie', kind: 'caddie', name: 'Caddie dorado', title: 'pelota infinita', cooldown: 35, range: 0, color: 0xffd66b,
    hint: 'Durante unos segundos tu puesto nunca se queda sin pelota: apenas pegás, el caddie te deja otra, dorada',
  },
  {
    id: 'lens', kind: 'lens', name: 'Lupa', title: 'los agranda', cooldown: 12, range: 50, color: 0xa8e063,
    hint: 'Los que agarra crecen un rato: son más fáciles de pegar, y cada pelotazo les saca uno más',
  },
  {
    id: 'clone', kind: 'clone', name: 'Clon', title: 'dos tiros', cooldown: 15, range: 0, color: 0xc9b8ff,
    hint: 'Deja una copia tuya donde estás. Tu próximo tiro sale también desde ahí, hacia el mismo lado',
  },
];

const CLUB_LABEL: Record<ClubId, string> = { driver: 'Driver', iron: 'Hierro', wedge: 'Wedge', putter: 'Putter' };
const CLUB_COOLDOWN: Record<ClubId, number> = { driver: 7, iron: 7, wedge: 8, putter: 6 };
const CLUB_RANGE: Record<ClubId, number> = { driver: 55, iron: 55, wedge: 55, putter: 20 };
export const ELEMENT_INFO: Record<Element, { name: string; adj: string; color: number; hint: string }> = {
  ice: { name: 'Hielo', adj: 'de hielo', color: 0x9fe0ff, hint: 'enfría a cada uno que alcanza' },
  fire: { name: 'Fuego', adj: 'de fuego', color: 0xff5a36, hint: 'prende fuego a cada uno que alcanza, que va perdiendo vida' },
  lightning: { name: 'Rayo', adj: 'de rayo', color: 0xb8c4ff, hint: 'de cada uno que alcanza salta un rayo al que tenga más cerca' },
};
export const ELEMENT_ORDER: Element[] = ['ice', 'fire', 'lightning'];

/** Las doce de palo y elemento. */
const SHOTS: Ability[] = (['driver', 'iron', 'wedge', 'putter'] as ClubId[]).flatMap((club) => ELEMENT_ORDER.map((element): Ability => ({
  id: `${club}-${element}`, kind: 'shot', club, element,
  name: `${CLUB_LABEL[club]} ${ELEMENT_INFO[element].adj}`, title: ELEMENT_INFO[element].name.toLowerCase(),
  hint: `Un tiro de ${CLUB_LABEL[club].toLowerCase()} al instante, con pelota gratis y cargado al nivel de la habilidad, que además ${ELEMENT_INFO[element].hint}`,
  cooldown: CLUB_COOLDOWN[club], range: CLUB_RANGE[club], color: ELEMENT_INFO[element].color,
})));

export const ABILITIES: Record<AbilityId, Ability> = Object.fromEntries([...BASE, ...SHOTS].map((a) => [a.id, a]));
export const ABILITY_LIST: AbilityId[] = [...BASE, ...SHOTS].map((a) => a.id);

/** Qué elemento aporta una habilidad, para las maestrías: el hielo cuenta como hielo. */
export function elementOf(id: AbilityId): Element | null {
  const a = ABILITIES[id];
  if (!a) return null;
  if (a.kind === 'iceZone') return 'ice';
  return a.element ?? null;
}

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
