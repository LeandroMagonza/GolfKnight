// Las habilidades. **Todos sus números están acá**, y se tocan en vivo en el panel de balance (B).
//
// Las habilidades no vienen fijas: se ganan eligiendo cartas entre oleadas (ver core/cards) y van en
// cuatro lugares, Q, W, E y R. Cada una tira **su propia pelota**: no gasta la del puesto ni ninguna
// otra, y sale en el acto hacia el mouse. Una carta de una habilidad que ya tenés la sube de nivel (hasta
// 3): pega más o agarra más, pero **también tarda más en recargar**, así que subir no es gratis.
//
// Hay de dos familias:
// - **Palo y elemento**: cualquier palo con hielo, fuego o rayo, y el driver, el hierro y el wedge con
//   viento. Es un tiro de ese palo, instantáneo, con pelota gratis y cargado al nivel de la habilidad: el
//   driver de hielo a nivel 1 es un driver nivel 1 que además enfría a cada uno que atraviesa.
// - **Las demás**, cada una con su mecánica propia: granada, hielo, carrito, hoyo, bandera, pólvora,
//   lluvia de pelotas, caddie dorado, lupa, clon, palazo, eco y potencia. (El boomerang, que tiraba el
//   palo de la mano, se fue el 1/10: no tenía mucho sentido.)
import type { ClubId } from './clubs';

export type AbilityId = string;
export type Element = 'ice' | 'fire' | 'lightning' | 'wind' | 'ghost' | 'silence';
export type AbilityKind =
  | 'grenade' | 'iceZone' | 'shot' | 'cart' | 'hole' | 'flag' | 'powder' | 'rain' | 'caddie' | 'lens' | 'clone' | 'melee'
  | 'echo' | 'boost';

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

/** Lo que vuelve **vulnerable** a un enemigo (la lupa): cada pelotazo le saca esto de más. */
export const VULNERABLE = { bonus: 1 };

/**
 * Hielo: la zona que deja al caer. Todo enemigo que esté adentro cuando cae, o que entre mientras dura,
 * camina a `slow` de su velocidad; al salir, el frío se le va a los `linger` segundos.
 */
export const ICE = { radius: [4, 4.75, 5.5], duration: [5, 6.5, 8], linger: 0.5, slow: 0.4 };

/** Vendaval: el pasillo de viento que va detrás de la pelota, `halfWidth` a cada lado de la línea. */

/**
 * Granada: agarra a todos los que estén a `radius` de donde cae y los **silencia** `silence` segundos:
 * se les apagan todos los poderes (escudo, blindaje, fantasma, divino, esquiva, auras, bandera, hechizos,
 * bomba). **Solo eso**: no hace daño ni suma daño (para el daño en área está el wedge). Al élite le dura
 * `eliteSilence` de eso. Los del **centro** (hasta `core`
 * del radio) se quedan quietos; los de afuera salen hacia los costados de la línea del tiro, hasta
 * quedar a `push` metros de ella.
 */
export const GRENADE = { radius: [5, 5.75, 6.5], push: [6, 6.75, 7.5], core: 1 / 3, silence: [5, 6.5, 8], eliteSilence: 0.5 };

/**
 * Los elementos de los tiros de palo y elemento.
 * - **Hielo**: enfría `iceSeconds` a cada uno que alcanza. Con la maestría, al que ya estaba frío lo
 *   **congela** `freezeSeconds`, y el golpe que rompe el hielo pega el doble.
 * - **Fuego**: lo prende y le saca `burnDamage` cada `burnTick` segundos, `burnTicks` veces según el nivel
 *   (3, 4 y 5 de daño en total). **El blindaje no le resta**, y prende aunque el escudo pare la pelota:
 *   es la respuesta al blindado, y también al fantasma (muchos golpes de 1) y al divino (el primer
 *   mordisco se come el escudo). Con la maestría, el que muere prendido contagia a los que tiene a
 *   `spreadRadius`.
 * - **Rayo**: **cada uno que alcanza la pelota larga su propio rayo**, que sale para los dos lados y
 *   en cada rama salta `chainJumps` veces, a `chainRange` como mucho, sacándole `chainDamage` a cada uno
 *   (ver core/chain). Un rayo nunca toca dos veces al mismo ni vuelve al que lo largó; el de otro sí
 *   puede. El blindaje se lo come (es un golpe, no fuego). Con la maestría salta una vez más por rama y
 *   cada salto pega el doble.
 * - **Fantasma**: el golpe pasa escudos (también el muro) y blindaje: le entra entero a cualquiera. El
 *   del driver atraviesa además las lomas. Desde el nivel `ghostFullFrom`, al enemigo fantasma también
 *   le entra el golpe entero. No pasa el divino ni la inmunidad del aura.
 * - **Silenciador**: silencia `silenceSeconds` a cada uno que alcanza, como la granada (al élite, la
 *   mitad). Silencia **después** del golpe: ese golpe choca con las defensas, los que vienen no. Por
 *   eso es distinto del fantasma, que pasa las defensas en ese golpe y no deja nada. Silencia aunque
 *   el escudo pare la pelota, igual que el fuego prende.
 */
export const ELEMENTS = {
  iceSeconds: [3, 4, 5], freezeSeconds: 2,
  burnTicks: [3, 4, 5], burnTick: 1.5, burnDamage: 1, spreadRadius: 2.5,
  chainJumps: [1, 2, 3], chainRange: 6, chainDamage: 1,
  // el viento hace algo distinto con cada palo (ver WIND_HINT): el driver junta sobre la línea a los de
  // `windLine` metros de cada lado; el hierro manda `windPush` metros para atrás a los que están a
  // `windPushRadius` del impacto; el wedge chupa hacia donde cae a los que están a `windPull`
  windLine: [3, 3.75, 4.5], windPush: [6, 8, 10], windPushRadius: 3.5, windPull: [4.5, 5.25, 6],
  // el golpe fantasma pasa escudos y blindaje (el driver, además, lomas); desde este nivel, al fantasma
  // también le entra entero
  ghostFullFrom: 2,
  silenceSeconds: [4, 5, 6],
};

/**
 * Cuánto dura prendido para morder `ticks` veces: el primer mordisco es en el acto y los demás, cada
 * `burnTick`; el último medio tick es de margen para que no se pierda por redondeo.
 */
export function burnSeconds(ticks: number): number {
  return (Math.max(1, ticks) - 0.5) * ELEMENTS.burnTick;
}

/** Carrito de golf: cruza el campo de costado a costado, a la altura que apuntás, y atropella. */
export const CART = { damage: [2, 3, 4], speed: 20, width: 1.2 };
/** Hoyo: el primero que lo pisa cae y muere (el jefe y los élites no). Se traga a `swallows` y se cierra. */
export const HOLE = { swallows: [1, 2, 3], life: 15, radius: 0.9 };
/** Bandera: los que están a `radius` se desvían a caminar hacia ella durante `seconds`. */
export const FLAG = { radius: [10, 12, 14], seconds: [4, 5, 6] };
/** Pólvora: marca a los que están a `radius`; el marcado que muere explota y le saca `damage` a los de al lado. */
export const POWDER = { radius: [3, 3.5, 4], blast: 2.5, damage: [2, 2, 3], life: 8 };
/** Caddie dorado: durante `seconds`, tu puesto nunca se queda sin pelota, y las pelotas son doradas. */
export const CADDIE = { seconds: [4, 6, 8] };
/**
 * Lupa: los que están a `radius` crecen `scale` veces durante `seconds`: más fáciles de pegar, y
 * vulnerables. Al fantasma agrandado le entran hasta `ghostHit` por golpe, en vez de 1.
 */
export const LENS = { radius: [3.5, 4, 4.5], seconds: [5, 6, 7], scale: 1.6, ghostHit: 2 };
/** Clon: deja una copia tuya donde estás; tus próximos `shots` tiros salen también desde ahí, hacia el mismo lado. */
export const CLONE = { shots: [1, 2, 3], life: 20 };
/**
 * Eco: tu próximo tiro sale otra vez, igual (mismo palo, misma carga, mismo lado), `shots` veces más,
 * una cada `delay` segundos. Sirve contra lo que se defiende de a un golpe: el escudo divino (el primero
 * se lo come) y el fantasma (de a 1 por golpe). Se pierde si cancelás el tiro, cambiás de palo o pifiás.
 */
export const ECHO = { shots: [1, 2, 3], delay: 0.25 };
/** Potencia: tu próximo tiro le saca `bonus` de más a cada uno que alcanza. Se pierde igual que el eco. */
export const BOOST = { bonus: [1, 2, 3] };
/**
 * Palazo: no hace daño. Empuja hacia atrás a todo lo que haya a `radius` metros de un paso adelante tuyo
 * (hasta `targets`), y les corta el ataque por `stagger` segundos. El empujón es `knockback` m/s, que
 * se frena solo: con 84 los manda unos 14 m.
 */
export const PALAZO = { radius: [4, 4.75, 5.5], knockback: 84, stagger: [0.7, 1, 1.3], targets: 12 };

/** Todas las tablas de números de las habilidades, por nombre: el panel de balance las recorre. */
export const ABILITY_CONFIG: Record<string, Record<string, number | number[]>> = {
  hielo: ICE, granada: GRENADE, elementos: ELEMENTS, carrito: CART, hoyo: HOLE,
  bandera: FLAG, 'pólvora': POWDER, caddie: CADDIE, lupa: LENS, clon: CLONE, palazo: PALAZO,
  eco: ECHO, potencia: BOOST,
};

const BASE: Ability[] = [
  {
    id: 'grenade', kind: 'grenade', name: 'Granada', title: 'los silencia', cooldown: 6, range: 45, color: 0xffc94a,
    hint: 'Cae donde apuntás y silencia a todos los que agarra: se les apagan todos los poderes (escudo, blindaje, fantasma, divino, esquiva, auras, bomba). Al élite le dura la mitad. A los del borde los tira a los costados; a los del centro los deja quietos. No hace daño',
  },
  {
    id: 'ice', kind: 'iceZone', name: 'Hielo', title: 'zona fría', cooldown: 10, range: 55, color: 0x7fd4ff,
    hint: 'Un globo que cae donde apuntás y deja el piso helado unos segundos: el que está adentro, o entra después, camina lento',
  },
  {
    id: 'cart', kind: 'cart', name: 'Carrito', title: 'atropella', cooldown: 14, range: 60, color: 0xe9e2cf,
    hint: 'Un carrito de golf cruza el campo de costado a costado, a la altura que apuntás, y atropella a todos los que encuentra',
  },
  {
    id: 'hole', kind: 'hole', name: 'Hoyo', title: 'se lo traga', cooldown: 12, range: 55, color: 0x9aa4b2,
    hint: 'Abre un hoyo donde apuntás: el primero que lo pisa cae y no vuelve. Al jefe y a los élites no se los traga',
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
    id: 'rain', kind: 'rain', name: 'Lluvia de pelotas', title: 'todos los puestos', cooldown: 40, range: 0, color: 0xfff1b8,
    hint: 'Los guardias llenan todos los puestos de una. No tiran más hasta que gastes las de sobra',
  },
  {
    id: 'caddie', kind: 'caddie', name: 'Caddie dorado', title: 'pelota infinita', cooldown: 35, range: 0, color: 0xffd66b,
    hint: 'Durante unos segundos tu puesto nunca se queda sin pelota: apenas pegás, el caddie te deja otra, dorada',
  },
  {
    id: 'lens', kind: 'lens', name: 'Lupa', title: 'los agranda', cooldown: 12, range: 50, color: 0xa8e063,
    hint: 'Los que agarra crecen un rato: son más fáciles de pegar y reciben 1 de daño extra por golpe. Al fantasma agrandado le entran hasta 2 por golpe, en vez de 1',
  },
  {
    id: 'clone', kind: 'clone', name: 'Clon', title: 'dos tiros', cooldown: 15, range: 0, color: 0xc9b8ff,
    hint: 'Deja una copia tuya donde estás. Tu próximo tiro sale también desde ahí, hacia el mismo lado',
  },
  {
    id: 'shove', kind: 'melee', name: 'Palazo', title: 'empujón', cooldown: 12, range: 0, color: 0xfff1b8,
    hint: 'Un palazo a lo que tengas encima: no hace daño, pero los manda lejos hacia atrás y les corta el ataque',
  },
  {
    id: 'echo', kind: 'echo', name: 'Eco', title: 'el tiro, otra vez', cooldown: 12, range: 0, color: 0x7ff0e0,
    hint: 'Tu próximo tiro sale otra vez, con la misma carga, un instante después; con más nivel, más veces. Se pierde si cancelás el tiro o cambiás de palo',
  },
  {
    id: 'boost', kind: 'boost', name: 'Potencia', title: 'el próximo pega más', cooldown: 8, range: 0, color: 0xff9a3c,
    hint: 'Tu próximo tiro le pega más a cada uno que alcanza. Se pierde si cancelás el tiro o cambiás de palo',
  },
];

const CLUB_LABEL: Record<ClubId, string> = { driver: 'Driver', iron: 'Hierro', wedge: 'Wedge', putter: 'Putter' };
const CLUB_COOLDOWN: Record<ClubId, number> = { driver: 7, iron: 7, wedge: 8, putter: 6 };
const CLUB_RANGE: Record<ClubId, number> = { driver: 55, iron: 55, wedge: 55, putter: 20 };
export const ELEMENT_INFO: Record<Element, { name: string; adj: string; color: number; hint: string }> = {
  ice: { name: 'Hielo', adj: 'de hielo', color: 0x9fe0ff, hint: 'enfría a cada uno que alcanza' },
  fire: { name: 'Fuego', adj: 'de fuego', color: 0xff5a36, hint: 'prende fuego a cada uno que alcanza, que va perdiendo vida' },
  lightning: { name: 'Rayo', adj: 'de rayo', color: 0xb8c4ff, hint: 'de cada uno que alcanza sale un rayo para los dos lados, que salta de enemigo en enemigo sin repetir y le saca 1 a cada uno' },
  wind: { name: 'Viento', adj: 'de viento', color: 0x8fe3b0, hint: 'mueve a los que agarra' },
  ghost: {
    name: 'Fantasma', adj: 'fantasma', color: 0xd8e6ff,
    hint: `pasa escudos y blindaje: le entra entero a cualquiera. Desde el nivel ${ELEMENTS.ghostFullFrom}, también al enemigo fantasma`,
  },
  silence: {
    name: 'Silencio', adj: 'silenciador', color: 0xff6b4a,
    hint: 'silencia a cada uno que alcanza: se le apagan todos los poderes un rato (al élite, la mitad). Silencia después del golpe: ese choca con sus defensas, los siguientes no',
  },
};
export const ELEMENT_ORDER: Element[] = ['ice', 'fire', 'lightning', 'wind', 'ghost', 'silence'];

/** El viento hace algo distinto con cada palo. Con el putter no tiene sentido: no hay. */
const WIND_HINT: Partial<Record<ClubId, string>> = {
  driver: 'el viento va detrás de la pelota y junta sobre la línea del tiro a los que pasa, para el próximo',
  iron: 'donde revienta, una ráfaga manda para atrás a los que están alrededor',
  wedge: 'donde cae, un remolino chupa hacia el centro a los de alrededor: quedan amontonados',
};

/** Lo que cambia de un elemento según el palo. El fantasma del driver, además, atraviesa lomas. */
const CLUB_HINT: Partial<Record<Element, Partial<Record<ClubId, string>>>> = {
  wind: WIND_HINT,
  ghost: { driver: `atraviesa escudos, blindaje y lomas: le entra entero a cualquiera. Desde el nivel ${ELEMENTS.ghostFullFrom}, también al enemigo fantasma` },
};

/** Las de palo y elemento: los cuatro palos con hielo, fuego, rayo, fantasma y silencio, y tres con viento. */
const SHOTS: Ability[] = (['driver', 'iron', 'wedge', 'putter'] as ClubId[]).flatMap((club) => ELEMENT_ORDER
  .filter((element) => element !== 'wind' || WIND_HINT[club])
  .map((element): Ability => ({
    id: `${club}-${element}`, kind: 'shot', club, element,
    name: `${CLUB_LABEL[club]} ${ELEMENT_INFO[element].adj}`, title: ELEMENT_INFO[element].name.toLowerCase(),
    hint: `Un tiro de ${CLUB_LABEL[club].toLowerCase()} al instante, con pelota gratis y cargado al nivel de la habilidad, que además ${CLUB_HINT[element]?.[club] ?? ELEMENT_INFO[element].hint}`,
    cooldown: CLUB_COOLDOWN[club], range: CLUB_RANGE[club], color: ELEMENT_INFO[element].color,
  })));

export const ABILITIES: Record<AbilityId, Ability> = Object.fromEntries([...BASE, ...SHOTS].map((a) => [a.id, a]));
export const ABILITY_LIST: AbilityId[] = [...BASE, ...SHOTS].map((a) => a.id);

/** Las claves de ELEMENTS que usa cada elemento. */
const ELEMENT_KEYS: Record<Element, string[]> = {
  ice: ['iceSeconds', 'freezeSeconds'],
  fire: ['burnTicks', 'burnTick', 'burnDamage', 'spreadRadius'],
  lightning: ['chainJumps', 'chainRange', 'chainDamage'],
  wind: ['windLine', 'windPush', 'windPushRadius', 'windPull'],
  ghost: ['ghostFullFrom'],
  silence: ['silenceSeconds'],
};
const KIND_CONFIG: Partial<Record<AbilityKind, string>> = {
  grenade: 'granada', iceZone: 'hielo', cart: 'carrito', hole: 'hoyo', flag: 'bandera',
  powder: 'pólvora', caddie: 'caddie', lens: 'lupa', clone: 'clon', melee: 'palazo',
  echo: 'eco', boost: 'potencia',
};

/**
 * Los números propios de una habilidad: en qué tabla de ABILITY_CONFIG están y cuáles de sus claves son
 * suyos. Las de palo y elemento comparten la tabla del elemento: tocar el fuego del driver toca el de
 * los cuatro palos. La lluvia de pelotas no tiene números.
 */
export function configOf(id: AbilityId): { name: string; table: Record<string, number | number[]>; keys: string[]; shared: boolean } | null {
  const a = ABILITIES[id];
  if (!a) return null;
  if (a.kind === 'shot') return { name: 'elementos', table: ELEMENTS, keys: ELEMENT_KEYS[a.element!], shared: true };
  const name = KIND_CONFIG[a.kind];
  if (!name) return null;
  const table = ABILITY_CONFIG[name];
  return { name, table, keys: Object.keys(table), shared: false };
}

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
