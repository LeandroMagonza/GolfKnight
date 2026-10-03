// Las habilidades. **Todos sus números están acá**, y se tocan en vivo en el panel de balance (B).
//
// Las habilidades no vienen fijas: se ganan eligiendo cartas entre oleadas (ver core/cards) y van en
// cuatro lugares, Q, W, E y R. Cada una tira **su propia pelota**: no gasta la del puesto ni ninguna
// otra, y sale en el acto hacia el mouse. Una carta de una habilidad que ya tenés la sube de nivel (hasta
// 3): pega más o agarra más, pero **también tarda más en recargar**, así que subir no es gratis.
//
// Hay de dos familias:
// - **Palo y elemento**: cualquier palo con hielo, fuego, rayo, fantasma o silencio, y el driver, el
//   hierro y el wedge con viento. Es un tiro de ese palo, instantáneo, con pelota gratis y cargado al
//   nivel de la habilidad: el driver de hielo a nivel 1 es un driver nivel 1 que además enfría a cada
//   uno que atraviesa.
// - **Las demás**, cada una con su mecánica propia: hielo, carrito, hoyo, bandera, pólvora, lluvia de
//   pelotas, caddie dorado, lupa, clon, palazo, eco y potencia. (El 1/10 se fueron el boomerang, que
//   tiraba el palo de la mano, y la granada: el silencio en área es el wedge silenciador.)
import { CLUBS, QUALITY_LEVELS, spreadFor, type ClubId } from './clubs';

export type AbilityId = string;
export type Element = 'ice' | 'fire' | 'lightning' | 'wind' | 'ghost' | 'silence';
export type AbilityKind =
  | 'iceZone' | 'shot' | 'cart' | 'hole' | 'flag' | 'powder' | 'rain' | 'caddie' | 'lens' | 'clone' | 'melee'
  | 'echo' | 'boost';

export interface Ability {
  id: AbilityId;
  kind: AbilityKind;
  name: string;
  title: string;
  hint: string;
  /** Segundos de recarga a nivel 1. Subir de nivel no la cambia, salvo en el palazo (ver LEVELS). */
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
/**
 * Cuánto más tarda en recargar cada nivel de más (con 0.3, el nivel 3 recarga un 60 % más lento). Desde
 * el 3/10 subir de nivel es mejora pura: el costo es la carta que no elegiste. Solo el palazo recarga
 * más lento (`meleeGrowth`): empuja lejos, y con poca recarga dejaría frenar la oleada sin fin.
 */
export const LEVELS = { cooldownGrowth: 0, meleeGrowth: 0.3 };

export function cooldownAt(a: Ability, level: number): number {
  const growth = a.kind === 'melee' ? LEVELS.meleeGrowth : LEVELS.cooldownGrowth;
  return a.cooldown * (1 + growth * (Math.max(1, level) - 1));
}

/** El número de un nivel (1, 2 o 3) en una tabla por nivel. */
export function lv(table: number[], level: number): number {
  return table[Math.min(table.length, Math.max(1, level)) - 1];
}

/** Lo que vuelve **vulnerable** a un enemigo (la lupa): cada pelotazo le saca esto de más. */
export const VULNERABLE = { bonus: 1 };

/**
 * Hielo: la zona que deja al caer. Todo enemigo que esté adentro cuando cae, o que entre mientras dura,
 * camina más lento; al salir, el frío se le va a los `linger` segundos.
 *
 * **Cuánto frena el frío** (el de la zona y el de los tiros de hielo, ver `chilledSpeed`): lo lleva a
 * `slow` de su velocidad, pero sin bajarlo de `floor` m/s, y a todos los frena por lo menos hasta `least`
 * de la suya. Así frena mucho a los rápidos y poco a los lentos: el goblin pasa de 3.6 a 1.4 m/s, y el
 * caballero de 1.5 a 1 (hasta el 3/10 quedaba en 0.6, casi quieto).
 */
export const ICE = { radius: [4, 4.75, 5.5], duration: [5, 6.5, 8], linger: 0.5, slow: 0.4, floor: 1, least: 0.8 };

/** A qué velocidad camina con frío uno que sin frío va a `speed` m/s (ver ICE). */
export function chilledSpeed(speed: number): number {
  return Math.min(speed * ICE.least, Math.max(speed * ICE.slow, ICE.floor));
}

/** Vendaval: el pasillo de viento que va detrás de la pelota, `halfWidth` a cada lado de la línea. */

/**
 * Los elementos de los tiros de palo y elemento.
 *
 * **El palo pega, la habilidad pone el efecto (1/10).** Los tiros de elemento **no hacen daño ni
 * empujan**: la pelota toca y deja el efecto, que por eso es más grande que cuando además pegaban. La
 * excepción es el fantasma, que es justamente un golpe (ver `effectOnly`).
 *
 * **Y el efecto sale solo si la pelota toca.** Si el escudo la para, si el divino se come el toque o si
 * el aura de invencible lo protege, no hay fuego, ni hielo, ni rayo, ni silencio. El blindaje y el
 * etéreo no paran el toque.
 *
 * - **Hielo**: enfría `iceSeconds` a cada uno que toca, y desde el nivel `iceFreezeFrom` además lo
 *   **congela** `freezeSeconds`. Con la maestría, al que ya estaba frío lo congela cualquier hielo. El
 *   golpe que rompe el hielo pega el doble. Al jefe nunca lo congela.
 * - **Fuego**: lo prende y le saca `burnDamage` cada `burnTick` segundos, `burnTicks` veces según el nivel
 *   (2, 3 y 4 de daño en total, en 2, 4 y 6 s; hasta el 3/10 eran 4, 5 y 6 cada 1.5 s, y un tiro de
 *   fuego solo mataba a los élites antes de que llegaran). **El blindaje no le resta**, y cada mordisco es un golpe de 1: es la
 *   respuesta al blindado y al fantasma. Con la maestría, el que muere prendido contagia a los que tiene
 *   a `spreadRadius`.
 * - **Rayo**: a **cada uno que toca la pelota le cae un rayo** (`chainDamage`), y de ahí sale para los
 *   dos lados: en cada rama salta `chainJumps` veces, a `chainRange` como mucho, sacándole `chainDamage` a
 *   cada uno (ver core/chain). Un rayo nunca toca dos veces al mismo ni vuelve al que lo largó; el de otro
 *   sí puede. **El blindaje no le resta** (desde el 3/10; antes se lo comía). Con la maestría salta una
 *   vez más por rama y cada salto pega el doble.
 * - **Fantasma**: el golpe le entra entero a cualquiera: pasa escudos (también el muro), blindaje, el
 *   tope del enemigo fantasma, la inmunidad del aura de invencible y el divino (sin gastarle la
 *   burbuja). El del driver atraviesa además las lomas. Hasta el 3/10 al fantasma le pegaba 1 hasta el
 *   nivel 2, y el aura lo paraba.
 * - **Silenciador**: silencia `silenceSeconds` a cada uno que toca (al élite, `silenceElite` de eso): se
 *   le apagan todos los poderes. No hace daño: prepara a los que vienen. Por eso es distinto del
 *   fantasma, que pasa las defensas en ese golpe y no deja nada. El wedge silenciador es el silencio en
 *   área (antes era la granada).
 */
export const ELEMENTS = {
  iceSeconds: [5, 6.5, 8], iceFreezeFrom: 3, freezeSeconds: 2,
  burnTicks: [2, 3, 4], burnTick: 2, burnDamage: 1, spreadRadius: 2.5,
  chainJumps: [2, 3, 4], chainRange: 6, chainDamage: 1,
  // el viento hace algo distinto con cada palo (ver WIND_HINT): el driver junta sobre la línea a los de
  // `windLine` metros de cada lado; el hierro manda `windPush` metros para atrás a los que están a
  // `windPushRadius` del impacto; el wedge chupa hacia donde cae a los que están a `windPull`
  windLine: [3, 3.75, 4.5], windPush: [6, 8, 10], windPushRadius: 3.5, windPull: [4.5, 5.25, 6],
  silenceSeconds: [5, 6.5, 8], silenceElite: 0.5,
};

/** ¿Es un tiro de efecto, que no pega? Todos los elementos menos el fantasma, que es un golpe. */
export function effectOnly(element: Element | null | undefined): boolean {
  return !!element && element !== 'ghost';
}

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
  hielo: ICE, elementos: ELEMENTS, carrito: CART, hoyo: HOLE,
  bandera: FLAG, 'pólvora': POWDER, caddie: CADDIE, lupa: LENS, clon: CLONE, palazo: PALAZO,
  eco: ECHO, potencia: BOOST,
};

const BASE: Ability[] = [
  {
    id: 'ice', kind: 'iceZone', name: 'Hielo', title: 'zona fría', cooldown: 10, range: 55, color: 0x7fd4ff,
    hint: 'Hiela el piso donde apuntás: los que lo pisan caminan lento',
  },
  {
    id: 'cart', kind: 'cart', name: 'Carrito', title: 'atropella', cooldown: 14, range: 60, color: 0xe9e2cf,
    hint: 'Un carrito de golf cruza el campo a la altura que apuntás y atropella a todos',
  },
  {
    id: 'hole', kind: 'hole', name: 'Hoyo', title: 'se lo traga', cooldown: 20, range: 55, color: 0x9aa4b2,
    hint: 'Abre un hoyo: el primero que lo pisa cae y no vuelve. Menos el jefe y los élites',
  },
  {
    id: 'flag', kind: 'flag', name: 'Bandera', title: 'los desvía', cooldown: 15, range: 55, color: 0xd8413a,
    hint: 'Planta una bandera: los que están cerca van hacia ella un rato',
  },
  {
    id: 'powder', kind: 'powder', name: 'Pólvora', title: 'en cadena', cooldown: 10, range: 50, color: 0xb0413e,
    hint: 'Marca a los enemigos donde cae: el marcado que muere explota y le pega a los de al lado',
  },
  {
    id: 'rain', kind: 'rain', name: 'Lluvia de pelotas', title: 'todos los puestos', cooldown: 40, range: 0, color: 0xfff1b8,
    hint: 'Los guardias llenan de pelotas todos los puestos',
  },
  {
    id: 'caddie', kind: 'caddie', name: 'Caddie dorado', title: 'pelota infinita', cooldown: 35, range: 0, color: 0xffd66b,
    hint: 'Unos segundos de pelota infinita en tu puesto',
  },
  {
    id: 'lens', kind: 'lens', name: 'Lupa', title: 'los agranda', cooldown: 12, range: 50, color: 0xa8e063,
    hint: 'Agranda a los enemigos un rato: son más fáciles de pegar y reciben 1 de daño extra',
  },
  {
    id: 'clone', kind: 'clone', name: 'Clon', title: 'dos tiros', cooldown: 15, range: 0, color: 0xc9b8ff,
    hint: 'Deja una copia tuya donde estás: tu próximo tiro sale también desde ahí',
  },
  {
    id: 'shove', kind: 'melee', name: 'Palazo', title: 'empujón', cooldown: 12, range: 0, color: 0xfff1b8,
    hint: 'Manda lejos a los enemigos que tenés encima',
  },
  {
    id: 'echo', kind: 'echo', name: 'Eco', title: 'el tiro, otra vez', cooldown: 12, range: 0, color: 0x7ff0e0,
    hint: 'Tu próximo tiro se repite',
  },
  {
    id: 'boost', kind: 'boost', name: 'Potencia', title: 'el próximo pega más', cooldown: 8, range: 0, color: 0xff9a3c,
    hint: 'Tu próximo tiro pega 1 más',
  },
];

const CLUB_LABEL: Record<ClubId, string> = { driver: 'Driver', iron: 'Hierro', wedge: 'Wedge', putter: 'Putter' };
const CLUB_COOLDOWN: Record<ClubId, number> = { driver: 7, iron: 7, wedge: 8, putter: 6 };
const CLUB_RANGE: Record<ClubId, number> = { driver: 55, iron: 55, wedge: 55, putter: 20 };
export const ELEMENT_INFO: Record<Element, { name: string; adj: string; color: number; hint: string }> = {
  ice: { name: 'Hielo', adj: 'de hielo', color: 0x9fe0ff, hint: 'enfría a los enemigos' },
  fire: { name: 'Fuego', adj: 'de fuego', color: 0xff5a36, hint: 'prende fuego a los enemigos' },
  lightning: { name: 'Rayo', adj: 'de rayo', color: 0xb8c4ff, hint: 'electrocuta a los enemigos, y el rayo salta a los de al lado' },
  wind: { name: 'Viento', adj: 'de viento', color: 0x8fe3b0, hint: 'mueve a los enemigos' },
  ghost: {
    name: 'Fantasma', adj: 'fantasma', color: 0xd8e6ff,
    hint: 'atraviesa escudos, blindaje, fantasmas e inmunes',
  },
  silence: {
    name: 'Silencio', adj: 'silenciador', color: 0xff6b4a,
    hint: 'apaga los poderes de los enemigos un rato',
  },
};
export const ELEMENT_ORDER: Element[] = ['ice', 'fire', 'lightning', 'wind', 'ghost', 'silence'];

/** El viento hace algo distinto con cada palo. Con el putter no tiene sentido: no hay. */
const WIND_HINT: Partial<Record<ClubId, string>> = {
  driver: 'junta a los enemigos sobre la línea del tiro',
  iron: 'empuja a los enemigos para atrás',
  wedge: 'atrae a los enemigos',
};

/** Lo que cambia de un elemento según el palo. El fantasma del driver, además, atraviesa lomas. */
const CLUB_HINT: Partial<Record<Element, Partial<Record<ClubId, string>>>> = {
  wind: WIND_HINT,
  ghost: { driver: 'atraviesa escudos, blindaje, fantasmas, inmunes y lomas' },
};

/**
 * Las de palo y elemento: los cuatro palos con hielo, fuego, rayo, fantasma y silencio, y tres con
 * viento. Las de efecto no pegan (el efecto sale si la pelota toca); el fantasma es un golpe cargado al
 * nivel de la habilidad.
 *
 * Las descripciones son cortas a propósito (1/10): dicen qué hace, no cada cosa con la que choca. Que el
 * escudo para el efecto o que el fuego pasa el blindaje se aprende jugando.
 */
const SHOTS: Ability[] = (['driver', 'iron', 'wedge', 'putter'] as ClubId[]).flatMap((club) => ELEMENT_ORDER
  .filter((element) => element !== 'wind' || WIND_HINT[club])
  .map((element): Ability => ({
    id: `${club}-${element}`, kind: 'shot', club, element,
    name: `${CLUB_LABEL[club]} ${ELEMENT_INFO[element].adj}`, title: ELEMENT_INFO[element].name.toLowerCase(),
    hint: `Un disparo de ${CLUB_LABEL[club].toLowerCase()} instantáneo que ${CLUB_HINT[element]?.[club] ?? ELEMENT_INFO[element].hint}`,
    cooldown: CLUB_COOLDOWN[club], range: CLUB_RANGE[club], color: ELEMENT_INFO[element].color,
  })));

/**
 * Lo que dice la carta de una habilidad en un nivel. `hint` es el del nivel 1; las que cambian al subir
 * dicen lo de ese nivel, sin anunciar los de después: la potencia de nivel 2 pega 2 más, el hielo de
 * nivel 3 ya congela.
 */
export function hintAt(a: Ability, level: number): string {
  if (a.kind === 'boost') return `Tu próximo tiro pega ${lv(BOOST.bonus, level)} más`;
  if (a.kind === 'echo') {
    const n = lv(ECHO.shots, level);
    return n > 1 ? `Tu próximo tiro se repite ${n} veces` : a.hint;
  }
  if (a.element === 'ice' && a.club && level >= freezeFrom(a.club)) return a.hint.replace('enfría', 'enfría y congela');
  return a.hint;
}

/** Las que no tienen nada que mejorar al subir de nivel: la carta para subirlas no sale. */
const NO_LEVELS: AbilityKind[] = ['rain'];

/**
 * Los tiros de habilidad del wedge (3/10, pedido de Leandro): el golpe 1 del wedge es la pifia, así que
 * se saltea. Tienen dos niveles, que salen con el golpe 2 y el 3 (pegan 1 y 2).
 */
const SHOT_MAX_LEVEL: Partial<Record<ClubId, number>> = { wedge: 2 };

/** Hasta qué nivel suben los tiros de habilidad de este palo. */
export function shotMaxLevel(club: ClubId): number {
  return SHOT_MAX_LEVEL[club] ?? MAX_LEVEL;
}

/** Con qué golpe sale el tiro de una habilidad de este palo en este nivel: el wedge saltea la pifia. */
export function shotQuality(club: ClubId, level: number): number {
  return Math.min(QUALITY_LEVELS, level + (QUALITY_LEVELS - shotMaxLevel(club)));
}

/** Desde qué nivel congela el tiro de hielo de este palo: el de ELEMENTS, o el último que tenga. */
export function freezeFrom(club: ClubId): number {
  return Math.min(ELEMENTS.iceFreezeFrom, shotMaxLevel(club));
}

/** Hasta qué nivel sube una habilidad. La lluvia de pelotas es igual en todos: se queda en 1. */
export function maxLevelOf(id: AbilityId): number {
  const a = ABILITIES[id];
  if (!a) return MAX_LEVEL;
  if (NO_LEVELS.includes(a.kind)) return 1;
  return a.kind === 'shot' && a.club ? shotMaxLevel(a.club) : MAX_LEVEL;
}

/**
 * Qué mejora al pasar de `level - 1` a `level`, para la carta de subir de nivel: cada número que cambia,
 * de cuánto a cuánto («Saltos por lado: 2 → 3»), separados por « · ». Null en el nivel 1. Sale de las
 * tablas, así que sigue a lo que se toque en el panel de balance.
 */
export function upgradeNote(id: AbilityId, level: number): string | null {
  const a = ABILITIES[id];
  if (!a || level <= 1) return null;
  const num = (n: number) => `${+n.toFixed(2)}`;
  const parts: string[] = [];
  const stat = (label: string, at: (level: number) => number, unit = '') => {
    const from = at(level - 1);
    const to = at(level);
    if (from !== to) parts.push(`${label}: ${num(from)} → ${num(to)}${unit}`);
  };
  const table = (label: string, values: number[], unit = '') => stat(label, (l) => lv(values, l), unit);
  // lo que pasa de no tenerlo a tenerlo, sin números
  const gains = (label: string, from: number) => { if (level >= from && level - 1 < from) parts.push(label); };
  switch (a.kind) {
    case 'iceZone': table('Radio', ICE.radius, ' m'); table('Dura', ICE.duration, ' s'); break;
    case 'cart': table('Daño', CART.damage); break;
    case 'hole': table('Se traga a', HOLE.swallows); break;
    case 'flag': table('Radio', FLAG.radius, ' m'); table('Dura', FLAG.seconds, ' s'); break;
    case 'powder': table('Radio', POWDER.radius, ' m'); table('Daño de la explosión', POWDER.damage); break;
    case 'caddie': table('Dura', CADDIE.seconds, ' s'); break;
    case 'lens': table('Radio', LENS.radius, ' m'); table('Dura', LENS.seconds, ' s'); break;
    case 'clone': table('Tiros', CLONE.shots); break;
    case 'melee': table('Alcance', PALAZO.radius, ' m'); table('Les corta el ataque', PALAZO.stagger, ' s'); break;
    case 'echo': table('Repeticiones', ECHO.shots); break;
    case 'boost': table('Daño extra', BOOST.bonus); break;
    case 'shot': {
      const club = CLUBS[a.club!];
      switch (a.element) {
        case 'ice': table('Enfría', ELEMENTS.iceSeconds, ' s'); gains('Congela', freezeFrom(a.club!)); break;
        case 'fire': stat('Daño del fuego', (l) => lv(ELEMENTS.burnTicks, l) * ELEMENTS.burnDamage); break;
        case 'lightning': table('Saltos por lado', ELEMENTS.chainJumps); break;
        case 'wind':
          if (a.club === 'driver') table('Junta desde', ELEMENTS.windLine, ' m');
          else if (a.club === 'iron') table('Empuja', ELEMENTS.windPush, ' m');
          else table('Atrae desde', ELEMENTS.windPull, ' m');
          break;
        case 'ghost': stat('Golpe', (l) => l); break;
        case 'silence': table('Silencia', ELEMENTS.silenceSeconds, ' s'); break;
      }
      // el tiro sale con el golpe del nivel (el wedge, uno más): el área del hierro y del wedge crece con
      // él (el viento no: el remolino y la ráfaga tienen su propio radio, que ya dice arriba)
      if (a.element !== 'wind') stat('Área', (l) => spreadFor(club, shotQuality(a.club!, l)), ' m');
      break;
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

export const ABILITIES: Record<AbilityId, Ability> = Object.fromEntries([...BASE, ...SHOTS].map((a) => [a.id, a]));
export const ABILITY_LIST: AbilityId[] = [...BASE, ...SHOTS].map((a) => a.id);

/** Las claves de ELEMENTS que usa cada elemento. */
const ELEMENT_KEYS: Record<Element, string[]> = {
  ice: ['iceSeconds', 'iceFreezeFrom', 'freezeSeconds'],
  fire: ['burnTicks', 'burnTick', 'burnDamage', 'spreadRadius'],
  lightning: ['chainJumps', 'chainRange', 'chainDamage'],
  wind: ['windLine', 'windPush', 'windPushRadius', 'windPull'],
  // el fantasma no tiene números propios: pasa todo
  ghost: [],
  silence: ['silenceSeconds', 'silenceElite'],
};
const KIND_CONFIG: Partial<Record<AbilityKind, string>> = {
  iceZone: 'hielo', cart: 'carrito', hole: 'hoyo', flag: 'bandera',
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
