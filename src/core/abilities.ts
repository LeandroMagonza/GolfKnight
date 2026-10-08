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
//   tiraba el palo de la mano, y la granada: el silencio en área es el wedge silenciador.) Desde el 4/10,
//   también las que duran unos segundos y cambian todos tus tiros: la fuerza y los guantes.
import { L } from '../i18n';
import { CLUBS, QUALITY_LEVELS, spreadFor, type ClubId } from './clubs';

export type AbilityId = string;
export type Element = 'ice' | 'fire' | 'lightning' | 'wind' | 'ghost' | 'silence';
export type AbilityKind =
  | 'shot' | 'cart' | 'hole' | 'flag' | 'powder' | 'rain' | 'caddie' | 'lens' | 'clone' | 'melee'
  | 'echo' | 'boost' | 'might' | 'glove';

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
  /** Las de palo y elemento, y los guantes. */
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
 * **Cuánto frena el frío** (el de los tiros de hielo y el granizo de Abe): lo lleva a `chillSlow` de su
 * velocidad, pero sin bajarlo de `chillFloor` m/s, y a todos los frena por lo menos hasta `chillLeast` de
 * la suya. Así frena mucho a los rápidos y poco a los lentos: el goblin pasa de 3.6 a 1.4 m/s, y el
 * caballero de 1.5 a 1 (hasta el 3/10 quedaba en 0.6, casi quieto). Los números están en ELEMENTS.
 */
export function chilledSpeed(speed: number): number {
  return Math.min(speed * ELEMENTS.chillLeast, Math.max(speed * ELEMENTS.chillSlow, ELEMENTS.chillFloor));
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
 *   golpe que rompe el hielo pega `breakBonus` más, como la lupa: también al fantasma (hasta el 4/10
 *   pegaba el doble). Al jefe y al élite nunca los congela: solo los frena.
 * - **Fuego**: lo prende y le saca `burnDamage` cada `burnTick` segundos, `burnTicks` veces según el nivel
 *   (2, 3 y 4 de daño en total, en 4, 6 y 8 s: **el primero a los 2 s**, desde el 5/10, para que no sea
 *   un golpe en el acto; hasta el 3/10 eran 4, 5 y 6 cada 1.5 s, y un tiro de fuego solo mataba a los
 *   élites antes de que llegaran). **El blindaje no le resta**, y cada mordisco es un golpe de 1: es la
 *   respuesta al blindado y al fantasma. Con la maestría, el que muere prendido (de lo que sea) **explota**
 *   y les saca `blastDamage` a los que tiene a `blastRadius` (7/10; antes los contagiaba, y casi no se
 *   veía). Si alguno de esos muere prendido, explota también.
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
// **El elemento compartido** (7/10, idea de Leandro): las tablas de cada elemento no van por el nivel de
// la carta sino por el **total del elemento**, la suma de los niveles de todo lo que tenés de ese
// elemento (tiros y guante, ver `elementTotal`). Cada carta que sumás o subís le sube el efecto a todas.
// La columna 3 es lo que daba una carta sola en nivel 3, así que nada quedó peor; el último número es el
// tope. El rayo no sube más que antes: ya estaba fuerte. El fantasma no tiene tabla: es un golpe, y va
// por la carta.
export const ELEMENTS = {
  iceSeconds: [5, 6.5, 8, 9, 10], iceFreezeFrom: 3, freezeSeconds: 2, breakBonus: 1,
  // cuánto frena el frío (ver chilledSpeed)
  chillSlow: 0.4, chillFloor: 1, chillLeast: 0.8,
  burnTicks: [2, 3, 4, 5, 6], burnTick: 2, burnDamage: 1, blastRadius: 3, blastDamage: 2,
  chainJumps: [2, 3, 4, 4, 4], chainRange: 6, chainDamage: 1,
  // el viento hace algo distinto con cada palo (ver WIND_HINT): el driver junta sobre la línea a los de
  // `windLine` metros de cada lado; el hierro manda `windPush` metros para atrás a los que están a
  // `windPushRadius` del impacto; el wedge chupa hacia donde cae a los que están a `windPull`, hasta que se
  // tocan. Todo al doble desde el 7/10 (Leandro: casi no servía; «para probar aunque sea»)
  windLine: [6, 7.5, 9, 9.9, 10.8], windPush: [12, 16, 20, 22, 24], windPushRadius: 7, windPull: [9, 10.5, 12, 13.2, 14.4],
  // el silencio, desde el 8/10 (Leandro: más corto, 2 s de base): lo mismo que el de Abe, y al élite la
  // mitad. Era 5, 6.5, 8, 9 y 10
  silenceSeconds: [2, 2.5, 3, 3.5, 4], silenceElite: 0.5,
};

/**
 * El total de un elemento: la suma de los niveles de las habilidades de ese elemento que tenés (tiros y
 * guante). Es lo que decide su efecto (ver ELEMENTS).
 */
export function elementTotal(slots: readonly { id: AbilityId; level: number }[], element: Element): number {
  return slots.reduce((n, s) => n + (ABILITIES[s.id]?.element === element ? s.level : 0), 0);
}

/**
 * Qué le pasa a todo el elemento cuando su total va de `from` a `to` (una carta nueva o una subida):
 * «Todo tu fuego: 3 → 4 de daño». Null si todavía no tenías nada de ese elemento (lo dice la carta), si no
 * cambia (llegó al tope), o para el fantasma, que va por la carta. `club`: el palo de la carta, para el
 * viento, que hace algo distinto con cada uno.
 */
export function elementNote(element: Element, from: number, to: number, club?: ClubId | null): string | null {
  if (from < 1 || element === 'ghost') return null;
  const num = (n: number) => `${+n.toFixed(2)}`;
  const change = (label: string, table: number[], unit: string) => {
    const a = lv(table, from);
    const b = lv(table, to);
    return a === b ? null : `${label}: ${num(a)} → ${num(b)}${unit}`;
  };
  switch (element) {
    case 'fire': {
      const a = lv(ELEMENTS.burnTicks, from) * ELEMENTS.burnDamage;
      const b = lv(ELEMENTS.burnTicks, to) * ELEMENTS.burnDamage;
      return a === b ? null : L(`Todo tu fuego: ${num(a)} → ${num(b)} de daño`, `All your fire: ${num(a)} → ${num(b)} damage`);
    }
    case 'ice': {
      const seconds = change(L('Todo tu hielo', 'All your ice'), ELEMENTS.iceSeconds, ' s');
      const freezes = from < ELEMENTS.iceFreezeFrom && to >= ELEMENTS.iceFreezeFrom;
      if (!freezes) return seconds;
      return `${seconds ?? L('Todo tu hielo', 'All your ice')}${L(', y congela', ', and freezes')}`;
    }
    case 'lightning': return change(L('Todo tu rayo, saltos por lado', 'All your lightning, jumps per side'), ELEMENTS.chainJumps, '');
    case 'silence': return change(L('Todo tu silencio', 'All your silence'), ELEMENTS.silenceSeconds, ' s');
    case 'wind': {
      const table = club === 'iron' ? ELEMENTS.windPush : club === 'wedge' ? ELEMENTS.windPull : ELEMENTS.windLine;
      return change(L('Todo tu viento', 'All your wind'), table, ' m');
    }
  }
  return null;
}

/** ¿Es un tiro de efecto, que no pega? Todos los elementos menos el fantasma, que es un golpe. */
export function effectOnly(element: Element | null | undefined): boolean {
  return !!element && element !== 'ghost';
}

/**
 * Cuánto dura prendido para morder `ticks` veces: un mordisco cada `burnTick`, **el primero también**
 * (desde el 5/10; antes el primero era en el acto). El medio tick de más es de margen para que el último
 * no se pierda por redondeo.
 */
export function burnSeconds(ticks: number): number {
  return (Math.max(1, ticks) + 0.5) * ELEMENTS.burnTick;
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
 * Fuerza (4/10, pedido de Leandro): durante `seconds`, todos tus tiros pegan por lo menos `floor` (el
 * putter, que ya pega 2 de cerca, `putter`). También los de habilidad, y los de efecto, que solos no
 * pegan: pegan `floor` y dejan su efecto. Es para que el golpe fantasma de nivel 1 (que pega 1) mate de
 * verdad, y para que todos los tiros de habilidad tengan con qué combinar.
 */
export const MIGHT = { seconds: [5, 6, 7], floor: 2, putter: 3 };
/**
 * Guantes (4/10): durante `seconds`, todos tus tiros de palo son de ese elemento, al nivel del guante.
 * Pegan como siempre y además dejan el efecto (el de hielo, desde el nivel `iceFreezeFrom`, congela). El
 * fantasma pasa las defensas. Hay de fantasma, hielo, fuego y rayo; uno nuevo reemplaza al que estaba.
 */
export const GLOVE = { seconds: [5, 6, 7] };
/** Los elementos que tienen guante. */
export const GLOVE_ELEMENTS: Element[] = ['ghost', 'ice', 'fire', 'lightning'];
/**
 * Palazo: no hace daño. Empuja hacia atrás a todo lo que haya a `radius` metros de un paso adelante tuyo
 * (hasta `targets`), y les corta el ataque por `stagger` segundos. El empujón es `knockback` m/s, que
 * se frena solo: con 84 los manda unos 14 m.
 */
export const PALAZO = { radius: [4, 4.75, 5.5], knockback: 84, stagger: [0.7, 1, 1.3], targets: 12 };

/** Todas las tablas de números de las habilidades, por nombre: el panel de balance las recorre. */
export const ABILITY_CONFIG: Record<string, Record<string, number | number[]>> = {
  elementos: ELEMENTS, carrito: CART, hoyo: HOLE,
  bandera: FLAG, 'pólvora': POWDER, caddie: CADDIE, lupa: LENS, clon: CLONE, palazo: PALAZO, // i18n-ok: claves del panel B
  eco: ECHO, potencia: BOOST, fuerza: MIGHT, guante: GLOVE,
};

const BASE: Ability[] = [
  {
    id: 'cart', kind: 'cart', name: L('Carrito', 'Golf Cart'), title: L('atropella', 'runs them over'), cooldown: 14, range: 60, color: 0xe9e2cf,
    hint: L('Un carrito de golf cruza el campo a la altura que apuntás y atropella a todos', 'A golf cart crosses the field where you aim and runs everyone over'),
  },
  {
    id: 'hole', kind: 'hole', name: L('Hoyo', 'Hole'), title: L('se lo traga', 'swallows them'), cooldown: 20, range: 55, color: 0x9aa4b2,
    hint: L('Abre un hoyo: el primero que lo pisa cae y no vuelve. Menos el jefe y los élites', 'Opens a hole: the first one to step in is gone for good. Not the boss or elites'),
  },
  {
    id: 'flag', kind: 'flag', name: L('Bandera', 'Flag'), title: L('los desvía', 'lures them'), cooldown: 15, range: 55, color: 0xd8413a,
    hint: L('Planta una bandera: los que están cerca van hacia ella un rato. Menos los élites', 'Plants a flag: nearby enemies walk to it for a while. Not elites'),
  },
  {
    id: 'powder', kind: 'powder', name: L('Pólvora', 'Gunpowder'), title: L('en cadena', 'chain blast'), cooldown: 10, range: 50, color: 0xb0413e,
    hint: L('Marca a los enemigos donde cae: el marcado que muere explota y le pega a los de al lado', 'Marks enemies where it lands: a marked one that dies blows up and hits its neighbors'),
  },
  {
    id: 'rain', kind: 'rain', name: L('Lluvia de pelotas', 'Ball Shower'), title: L('todos los puestos', 'every tee'), cooldown: 40, range: 0, color: 0xfff1b8,
    hint: L('Los guardias llenan de pelotas todos los puestos', 'The guards fill every tee with balls'),
  },
  {
    id: 'caddie', kind: 'caddie', name: L('Caddie dorado', 'Golden Caddie'), title: L('pelota infinita', 'endless balls'), cooldown: 35, range: 0, color: 0xffd66b,
    hint: L('Unos segundos de pelota infinita en tu puesto', 'A few seconds of endless balls at your tee'),
  },
  {
    id: 'lens', kind: 'lens', name: L('Lupa', 'Magnifier'), title: L('los agranda', 'makes them big'), cooldown: 12, range: 50, color: 0xa8e063,
    hint: L('Agranda a los enemigos un rato: son más fáciles de pegar y reciben 1 de daño extra', 'Enlarges enemies for a while: easier to hit, and they take 1 extra damage'),
  },
  {
    id: 'clone', kind: 'clone', name: L('Clon', 'Clone'), title: L('dos tiros', 'two shots'), cooldown: 15, range: 0, color: 0xc9b8ff,
    hint: L('Deja una copia tuya donde estás: tu próximo tiro sale también desde ahí', 'Leaves a copy of you where you stand: your next shot also fires from there'),
  },
  {
    id: 'shove', kind: 'melee', name: L('Palazo', 'Whack'), title: L('empujón', 'shove'), cooldown: 12, range: 0, color: 0xfff1b8,
    hint: L('Manda lejos a los enemigos que tenés encima', 'Knocks away the enemies right on top of you'),
  },
  {
    id: 'echo', kind: 'echo', name: L('Eco', 'Echo'), title: L('el tiro, otra vez', 'that shot, again'), cooldown: 12, range: 0, color: 0x7ff0e0,
    hint: L('Tu próximo tiro se repite', 'Your next shot repeats'),
  },
  {
    id: 'boost', kind: 'boost', name: L('Potencia', 'Boost'), title: L('el próximo pega más', 'next one hits harder'), cooldown: 8, range: 0, color: 0xff9a3c,
    hint: L('Tu próximo tiro pega 1 más', 'Your next shot hits for 1 more'),
  },
  {
    id: 'might', kind: 'might', name: L('Fuerza', 'Might'), title: L('todos pegan 2', 'everything hits 2'), cooldown: 20, range: 0, color: 0xf5b041,
    hint: L('Unos segundos en que todos tus tiros pegan por lo menos 2 (el putter, 3), también los de habilidad', 'For a few seconds, all your shots hit for at least 2 (putter: 3), ability shots too'),
  },
];

const CLUB_LABEL: Record<ClubId, string> = L(
  { driver: 'Driver', iron: 'Hierro', wedge: 'Wedge', putter: 'Putter' },
  { driver: 'Driver', iron: 'Iron', wedge: 'Wedge', putter: 'Putter' },
);
const CLUB_COOLDOWN: Record<ClubId, number> = { driver: 7, iron: 7, wedge: 8, putter: 6 };
const CLUB_RANGE: Record<ClubId, number> = { driver: 55, iron: 55, wedge: 55, putter: 20 };
/**
 * Cada elemento: su nombre, cómo se le pega a un nombre (`adj`: «Driver de hielo», «Guante de fuego»; en
 * inglés va adelante y es el mismo sustantivo: «Ice Driver», ver `shotName`) y qué hace, para las cartas.
 */
export const ELEMENT_INFO: Record<Element, { name: string; adj: string; color: number; hint: string }> = {
  ice: { name: L('Hielo', 'Ice'), adj: L('de hielo', 'Ice'), color: 0x9fe0ff, hint: L('enfría a los enemigos', 'chills enemies') },
  fire: { name: L('Fuego', 'Fire'), adj: L('de fuego', 'Fire'), color: 0xff5a36, hint: L('prende fuego a los enemigos', 'sets enemies on fire') },
  lightning: {
    name: L('Rayo', 'Lightning'), adj: L('de rayo', 'Lightning'), color: 0xb8c4ff,
    hint: L('electrocuta a los enemigos, y el rayo salta a los de al lado', 'shocks enemies, and the lightning jumps to nearby ones'),
  },
  wind: { name: L('Viento', 'Wind'), adj: L('de viento', 'Wind'), color: 0x8fe3b0, hint: L('mueve a los enemigos', 'moves enemies') },
  ghost: {
    name: L('Fantasma', 'Ghost'), adj: L('fantasma', 'Ghost'), color: 0xd8e6ff,
    hint: L('atraviesa escudos, blindaje, fantasmas e inmunes', 'ignores shields, armor, ghosts and immunity'),
  },
  silence: {
    name: L('Silencio', 'Silence'), adj: L('silenciador', 'Silencing'), color: 0xff6b4a,
    hint: L('apaga los poderes de los enemigos un rato', 'shuts off enemy powers for a while'),
  },
};
export const ELEMENT_ORDER: Element[] = ['ice', 'fire', 'lightning', 'wind', 'ghost', 'silence'];

/** El viento hace algo distinto con cada palo. Con el putter no tiene sentido: no hay. */
const WIND_HINT: Partial<Record<ClubId, string>> = {
  driver: L('junta a los enemigos sobre la línea del tiro', 'pulls enemies onto the shot line'),
  iron: L('empuja a los enemigos para atrás', 'pushes enemies back'),
  wedge: L('atrae a los enemigos', 'draws enemies in'),
};

/** Lo que cambia de un elemento según el palo. El fantasma del driver, además, atraviesa lomas. */
const CLUB_HINT: Partial<Record<Element, Partial<Record<ClubId, string>>>> = {
  wind: WIND_HINT,
  ghost: { driver: L('atraviesa escudos, blindaje, fantasmas, inmunes y lomas', 'ignores shields, armor, ghosts, immunity and hills') },
};

/**
 * El nombre de un tiro de palo y elemento: «Driver de hielo»; en inglés el elemento va adelante, «Ice
 * Driver». `club` es cómo se llama el palo (el tenis le cambia el nombre, ver tennis/mode).
 */
export const shotName: (club: string, element: Element) => string = L(
  (club: string, element: Element) => `${club} ${ELEMENT_INFO[element].adj}`,
  (club: string, element: Element) => `${ELEMENT_INFO[element].adj} ${club}`,
);

/**
 * Lo que dice la carta de un tiro de palo y elemento. `shot` es cómo se llama el tiro: «disparo de driver»
 * / «driver shot» (en el tenis, «plano» / «drive»).
 */
export const shotHint: (shot: string, club: ClubId, element: Element) => string = L(
  (shot: string, club: ClubId, element: Element) => `Un ${shot} instantáneo que ${CLUB_HINT[element]?.[club] ?? ELEMENT_INFO[element].hint}`,
  (shot: string, club: ClubId, element: Element) => `An instant ${shot} that ${CLUB_HINT[element]?.[club] ?? ELEMENT_INFO[element].hint}`,
);

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
    name: shotName(CLUB_LABEL[club], element), title: ELEMENT_INFO[element].name.toLowerCase(),
    hint: shotHint(L(`disparo de ${CLUB_LABEL[club].toLowerCase()}`, `${CLUB_LABEL[club].toLowerCase()} shot`), club, element),
    cooldown: CLUB_COOLDOWN[club], range: CLUB_RANGE[club], color: ELEMENT_INFO[element].color,
  })));

/** Lo que hacen de más los tiros con guante (en inglés, la frase sigue a «all your club shots»). */
const GLOVE_HINT: Partial<Record<Element, string>> = {
  ghost: L('pasan escudos, blindaje, fantasmas e inmunes', 'ignore shields, armor, ghosts and immunity'),
  ice: L('además enfrían', 'also chill'),
  fire: L('además prenden fuego', 'also set enemies on fire'),
  lightning: L('además les cae un rayo que salta a los de al lado', 'also call down lightning that jumps to nearby enemies'),
};

/** Los guantes (ver GLOVE): unos segundos en que todos tus tiros de palo son de un elemento. */
const GLOVES: Ability[] = GLOVE_ELEMENTS.map((element): Ability => ({
  id: `glove-${element}`, kind: 'glove', element,
  name: L(`Guante ${ELEMENT_INFO[element].adj}`, `${ELEMENT_INFO[element].adj} Glove`),
  title: L(`tus tiros, ${ELEMENT_INFO[element].adj}`, `${ELEMENT_INFO[element].adj.toLowerCase()} shots`),
  hint: L(
    `Unos segundos en que todos tus tiros de palo son ${ELEMENT_INFO[element].adj}: ${GLOVE_HINT[element]}`,
    `For a few seconds, all your club shots ${GLOVE_HINT[element]}`,
  ),
  cooldown: 20, range: 0, color: ELEMENT_INFO[element].color,
}));

/**
 * Lo que dice la carta de una habilidad en un nivel. `hint` es el del nivel 1; las que cambian al subir
 * dicen lo de ese nivel, sin anunciar los de después: la potencia de nivel 2 pega 2 más, el hielo de
 * nivel 3 ya congela. (El hielo agrega el «congela» al texto de la carta, que puede ser el del tenis.)
 */
export function hintAt(a: Ability, level: number): string {
  if (a.kind === 'boost') {
    const n = lv(BOOST.bonus, level);
    return L(`Tu próximo tiro pega ${n} más`, `Your next shot hits for ${n} more`);
  }
  if (a.kind === 'echo') {
    const n = lv(ECHO.shots, level);
    return n > 1 ? L(`Tu próximo tiro se repite ${n} veces`, `Your next shot repeats ${n} times`) : a.hint;
  }
  if (a.element === 'ice' && a.club && level >= freezeFrom(a.club)) return a.hint.replace(L('enfría', 'chills'), L('enfría y congela', 'chills and freezes'));
  if (a.kind === 'glove' && a.element === 'ice' && level >= ELEMENTS.iceFreezeFrom) return a.hint.replace(L('enfrían', 'chill'), L('enfrían y congelan', 'chill and freeze'));
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
  const lasts = L('Dura', 'Lasts');
  const radius = L('Radio', 'Radius');
  const freezes = L('Congela', 'Freezes');
  switch (a.kind) {
    case 'cart': table(L('Daño', 'Damage'), CART.damage); break;
    case 'hole': table(L('Se traga a', 'Swallows'), HOLE.swallows); break;
    case 'flag': table(radius, FLAG.radius, ' m'); table(lasts, FLAG.seconds, ' s'); break;
    case 'powder': table(radius, POWDER.radius, ' m'); table(L('Daño de la explosión', 'Blast damage'), POWDER.damage); break;
    case 'caddie': table(lasts, CADDIE.seconds, ' s'); break;
    case 'lens': table(radius, LENS.radius, ' m'); table(lasts, LENS.seconds, ' s'); break;
    case 'clone': table(L('Tiros', 'Shots'), CLONE.shots); break;
    case 'melee': table(L('Alcance', 'Reach'), PALAZO.radius, ' m'); table(L('Les corta el ataque', 'Stagger'), PALAZO.stagger, ' s'); break;
    case 'echo': table(L('Repeticiones', 'Repeats'), ECHO.shots); break;
    case 'boost': table(L('Daño extra', 'Extra damage'), BOOST.bonus); break;
    case 'might': table(lasts, MIGHT.seconds, ' s'); break;
    // el efecto del elemento ya no va por el nivel de la carta sino por el total (7/10): eso lo dice
    // `elementNote`. Acá queda lo de la carta: el congelar en su nivel, el golpe del fantasma y el área
    case 'glove':
      table(lasts, GLOVE.seconds, ' s');
      if (a.element === 'ice') gains(freezes, ELEMENTS.iceFreezeFrom);
      break;
    case 'shot': {
      const club = CLUBS[a.club!];
      if (a.element === 'ice') gains(freezes, freezeFrom(a.club!));
      else if (a.element === 'ghost') stat(L('Golpe', 'Hit'), (l) => l);
      // el tiro sale con el golpe del nivel (el wedge, uno más): el área del hierro y del wedge crece con
      // él (el viento no: el remolino y la ráfaga tienen su propio radio, que ya dice arriba)
      if (a.element !== 'wind') stat(L('Área', 'Area'), (l) => spreadFor(club, shotQuality(a.club!, l)), ' m');
      break;
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

export const ABILITIES: Record<AbilityId, Ability> = Object.fromEntries([...BASE, ...SHOTS, ...GLOVES].map((a) => [a.id, a]));
export const ABILITY_LIST: AbilityId[] = [...BASE, ...SHOTS, ...GLOVES].map((a) => a.id);

/** Las claves de ELEMENTS que usa cada elemento. */
const ELEMENT_KEYS: Record<Element, string[]> = {
  ice: ['iceSeconds', 'iceFreezeFrom', 'freezeSeconds', 'breakBonus', 'chillSlow', 'chillFloor', 'chillLeast'],
  fire: ['burnTicks', 'burnTick', 'burnDamage', 'blastRadius', 'blastDamage'],
  lightning: ['chainJumps', 'chainRange', 'chainDamage'],
  wind: ['windLine', 'windPush', 'windPushRadius', 'windPull'],
  // el fantasma no tiene números propios: pasa todo
  ghost: [],
  silence: ['silenceSeconds', 'silenceElite'],
};
const KIND_CONFIG: Partial<Record<AbilityKind, string>> = {
  cart: 'carrito', hole: 'hoyo', flag: 'bandera',
  powder: 'pólvora', caddie: 'caddie', lens: 'lupa', clone: 'clon', melee: 'palazo', // i18n-ok: claves del panel B
  echo: 'eco', boost: 'potencia', might: 'fuerza', glove: 'guante',
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

/** Qué elemento aporta una habilidad, para las maestrías. */
export function elementOf(id: AbilityId): Element | null {
  return ABILITIES[id]?.element ?? null;
}
