// Las cartas que se eligen entre oleadas: al terminar cada una salen tres y te quedás con una. Hay de
// tres clases:
// - **Habilidad**: una nueva (si te queda lugar en Q, W, E o R) o subir de nivel una que ya tenés.
// - **Mejora**: cambios que valen para todo el juego. A propósito **no tocan la tabla de daño de ningún
//   palo**: un +1 al driver lo haría el mejor también de cerca y el putter dejaría de tener sentido. Van
//   por el lado del timing, las pelotas y las rachas, que no cambian qué palo conviene a cada distancia.
// Las cartas de curarse (la puerta +3, vos +1) se fueron: eran mucho peores que el Botiquín, que cura un
// poco al terminar cada oleada. Si la partida viene mal, el que sale sí o sí es el Botiquín.
//
// Todo acá es lógica pura, sin Three.js, para poder probar el sorteo.
import { ABILITIES, ABILITY_LIST, cooldownAt, elementOf, ELEMENT_INFO, hintAt, maxLevelOf, SLOTS, upgradeNote, type AbilityId, type Element } from './abilities';

export type PerkId =
  | 'quickWrist' | 'sweetSpot' | 'evenSwing' | 'rhythm' | 'hotStreak' | 'masonStreak' | 'smithStreak' | 'medkit' | 'giftPerfect' | 'quiver' | 'extraBall' | 'secondWind'
  | 'masteryIce' | 'masteryFire' | 'masteryLightning';

export interface Perk {
  id: PerkId;
  name: string;
  title: string;
  hint: string;
  /** Cuántas veces se puede tomar. */
  max: number;
  color: number;
  /** Las maestrías: solo salen si tenés al menos dos habilidades de ese elemento. */
  needs?: Element;
}

/** Los números de las mejoras. Se tocan en el panel de balance. */
export const PERK_NUMBERS = {
  /**
   * Muñeca rápida: los tramos débil y medio de la barra tardan esta fracción, por cada vez que la
   * tomás. El fuerte y el rebote van a su ritmo: la ventana del perfecto dura lo mismo.
   */
  quickWrist: 0.85,
  /**
   * Punto dulce: el tramo fuerte dura esta proporción más, por cada vez. Abre en el mismo momento: lo
   * que cambia es que el rebote llega más tarde.
   */
  sweetSpot: 1.35,
  /**
   * Swing parejo: cuánto se acercan los tres tramos a durar lo mismo, por cada vez (1 = del todo). Con
   * un tercio por nivel, al tercero el débil, el medio y el fuerte duran lo mismo.
   */
  evenSwingStep: 1 / 3,
  /**
   * Ritmo: cada tiro seguido **sin errar** (le pegó a alguien, mate o no) carga esta fracción más
   * rápido, hasta `rhythmMax` tiros. Ahí se queda hasta que errás.
   */
  rhythmStep: 0.1,
  rhythmMax: 3,
  /**
   * En racha: después de tantos tiros seguidos sin errar, los tiros de palo (no las habilidades) suman
   * `hotStreakAdd` al daño, **sin pasar de `hotStreakCap`**, y sin bajar nunca. Con +1 hasta 2 sube solo
   * los golpes que pegan 1: el piso de cada palo, sin tocar el techo (al putter, que no baja de 2, no le
   * hace nada). Un golpe que pega 0 sigue siendo pifia. Dura hasta que errás.
   */
  hotStreakShots: 4,
  hotStreakAdd: 1,
  hotStreakCap: 2,
  /**
   * El albañil: cada tiro de palo que mata a dos suma 1, a tres suma 2, y así (las bajas menos una).
   * Al juntar tantos, la puerta +1. No se corta: se va juntando.
   */
  masonStreak: 3,
  /**
   * El herrero: cuenta igual que el albañil, y al juntar `smithStreak` la próxima pelota de palo pega
   * `smithBonus` más. No se pierde al cancelar, cambiar de palo ni pifiar: espera a que salga una pelota.
   * Si se juntan dos antes de pegar, se suman.
   */
  smithStreak: 2,
  smithBonus: 1,
  /** Botiquín: al terminar cada oleada, la puerta y vos se curan esto, por cada vez que lo tomás. */
  medkitGate: 1,
  medkitPlayer: 1,
  /** Perfecto de regalo: cada tantas bajas, el próximo tiro arranca clavado en el golpe perfecto. */
  giftPerfect: 8,
  /** Carcaj: si vas a pegar sin pelota, te aparece una. Una cada tantos segundos. */
  quiverCooldown: 12,
  /** Segundo aire: recarga propia. */
  secondWindCooldown: 30,
};

export const PERKS: Record<PerkId, Perk> = {
  quickWrist: { id: 'quickWrist', name: 'Muñeca rápida', title: 'carga más rápido', max: 2, color: 0xffd66b, hint: 'Cargás un 15 % más rápido' },
  sweetSpot: { id: 'sweetSpot', name: 'Punto dulce', title: 'perfecto más largo', max: 2, color: 0xff6b6b, hint: 'El golpe perfecto dura un 35 % más' },
  evenSwing: { id: 'evenSwing', name: 'Swing parejo', title: 'tramos iguales', max: 3, color: 0xffa3d1, hint: 'Los tramos de la barra se emparejan' },
  rhythm: { id: 'rhythm', name: 'Ritmo', title: 'racha que acelera', max: 1, color: 0xffb347, hint: 'Cada acierto seguido te hace cargar un 10 % más rápido, hasta 3 veces' },
  hotStreak: { id: 'hotStreak', name: 'En racha', title: 'sube el piso', max: 1, color: 0xff8a3d, hint: 'Con 4 aciertos seguidos, los golpes que pegan 1 pasan a pegar 2' },
  masonStreak: { id: 'masonStreak', name: 'El albañil', title: 'dobletes que arreglan', max: 1, color: 0xc9b38a, hint: 'La puerta se regenera cada 3 disparos que maten a más de un enemigo' },
  smithStreak: { id: 'smithStreak', name: 'El herrero', title: 'dobletes que forjan', max: 1, color: 0x9fb4c8, hint: 'Cada 2 disparos que maten a más de un enemigo, tu próxima pelota pega 1 más' },
  medkit: { id: 'medkit', name: 'Botiquín', title: 'curarse entre oleadas', max: 3, color: 0x8fe3b0, hint: 'Al empezar cada oleada, la puerta +1 y vos +1' },
  giftPerfect: { id: 'giftPerfect', name: 'Perfecto de regalo', title: 'cada 8 bajas', max: 1, color: 0xff2d3c, hint: 'Cada 8 bajas, el próximo tiro arranca en el golpe perfecto' },
  quiver: { id: 'quiver', name: 'Carcaj', title: 'pelota a mano', max: 1, color: 0xfff1b8, hint: 'Si vas a pegar sin pelota, te aparece una' },
  extraBall: { id: 'extraBall', name: 'Pelota extra', title: 'una más en juego', max: 2, color: 0xfff1b8, hint: 'Una pelota más esperando en los puestos' },
  secondWind: { id: 'secondWind', name: 'Segundo aire', title: 'otra vez', max: 1, color: 0x8fe3b0, hint: 'Usás una habilidad aunque esté recargando' },
  masteryIce: { id: 'masteryIce', name: 'Maestría del hielo', title: 'congela', max: 1, color: ELEMENT_INFO.ice.color, needs: 'ice', hint: 'El hielo congela a los que ya estaban fríos. Romper el hielo pega el doble' },
  masteryFire: { id: 'masteryFire', name: 'Maestría del fuego', title: 'contagia', max: 1, color: ELEMENT_INFO.fire.color, needs: 'fire', hint: 'El que muere prendido fuego contagia a los de al lado' },
  masteryLightning: { id: 'masteryLightning', name: 'Maestría del rayo', title: 'salta más', max: 1, color: ELEMENT_INFO.lightning.color, needs: 'lightning', hint: 'El rayo salta una vez más y pega el doble' },
};
export const PERK_LIST = Object.keys(PERKS) as PerkId[];

/** Cuánto cura cada carta de curarse. */
export const HEALS = { gate: 3, player: 1 };

export type Card =
  | { kind: 'ability'; id: AbilityId; level: number }
  | { kind: 'perk'; id: PerkId; level: number }
  | { kind: 'heal'; id: 'gate' | 'player' };

/** Lo que el sorteo necesita saber de la partida. */
export interface Build {
  /** Las habilidades en Q, W, E y R, con su nivel. */
  slots: { id: AbilityId; level: number }[];
  perks: Partial<Record<PerkId, number>>;
  hp: number;
  hpMax: number;
  gate: number;
  gateMax: number;
}

/** Cuántas habilidades de cada elemento hay en la mano: es lo que abre las maestrías. */
export function elementCount(build: Build, element: Element): number {
  return build.slots.filter((s) => elementOf(s.id) === element).length;
}

/** Todas las cartas que podrían salir ahora, con su peso en el sorteo. */
export function candidates(build: Build): { card: Card; weight: number }[] {
  const out: { card: Card; weight: number }[] = [];
  const owned = new Map(build.slots.map((s) => [s.id, s.level]));
  for (const id of ABILITY_LIST) {
    const level = owned.get(id);
    // subir una que ya tenés pesa más que una nueva cualquiera: son pocas y son tuyas
    if (level !== undefined) {
      if (level < maxLevelOf(id)) out.push({ card: { kind: 'ability', id, level: level + 1 }, weight: 3 });
    } else if (build.slots.length < SLOTS) {
      out.push({ card: { kind: 'ability', id, level: 1 }, weight: 1 });
    }
  }
  for (const id of PERK_LIST) {
    const p = PERKS[id];
    const have = build.perks[id] ?? 0;
    if (have >= p.max) continue;
    if (p.needs && elementCount(build, p.needs) < 2) continue;
    // la maestría aparece poco y cuando aparece se nota: pesa más que una mejora común
    out.push({ card: { kind: 'perk', id, level: have + 1 }, weight: p.needs ? 4 : 2 });
  }
  return out;
}

/** ¿Hace falta ofrecer sí o sí una curación? Con la puerta a la mitad o con una sola vida. */
export function needsHeal(build: Build): 'gate' | 'player' | null {
  if (build.gate <= build.gateMax / 2) return 'gate';
  if (build.hp <= 1 && build.hpMax > 1) return 'player';
  return null;
}

/**
 * Saca `n` cartas distintas, por peso. Si la partida viene mal (puerta a la mitad o una sola vida), una
 * de ellas es el Botiquín, mientras no esté al tope.
 */
export function drawCards(build: Build, n = 3, rand: () => number = Math.random): Card[] {
  const pool = candidates(build);
  const out: Card[] = [];
  if (needsHeal(build)) {
    const i = pool.findIndex((c) => c.card.kind === 'perk' && c.card.id === 'medkit');
    if (i >= 0) out.push(pool.splice(i, 1)[0].card);
  }
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let r = rand() * total;
    let i = 0;
    while (i < pool.length - 1 && r >= pool[i].weight) r -= pool[i++].weight;
    out.push(pool.splice(i, 1)[0].card);
  }
  return out;
}

/**
 * La recarga de una carta de habilidad: la de base si es nueva, y si sube de nivel, de cuánto a cuánto y
 * si se alarga o se acorta (`slower`).
 */
export function cooldownNote(id: AbilityId, level: number): { text: string; slower: boolean } {
  const a = ABILITIES[id];
  const s = (n: number) => `${+n.toFixed(1)} s`;
  const to = cooldownAt(a, level);
  if (level <= 1) return { text: `Recarga: ${s(to)}`, slower: false };
  const from = cooldownAt(a, level - 1);
  if (to === from) return { text: `Recarga: ${s(to)}, igual que ahora`, slower: false };
  return { text: `Recarga: ${s(from)} → ${s(to)} · ${to > from ? 'más lenta' : 'más rápida'}`, slower: to > from };
}

/** La recarga de las mejoras que tienen: la dicen abajo en la carta, como las habilidades. */
export function perkCooldown(id: PerkId): number | null {
  if (id === 'secondWind') return PERK_NUMBERS.secondWindCooldown;
  if (id === 'quiver') return PERK_NUMBERS.quiverCooldown;
  return null;
}

/**
 * Nombre, título, texto y color de una carta, para mostrarla. Las de habilidad, y las mejoras que
 * recargan, dicen también su recarga.
 */
export function describe(card: Card): { name: string; title: string; hint: string; color: number; tag: string; up?: string; cool?: { text: string; slower: boolean } } {
  if (card.kind === 'ability') {
    const a = ABILITIES[card.id];
    return {
      name: a.name, title: a.title, hint: hintAt(a, card.level), color: a.color, tag: card.level > 1 ? `HABILIDAD · NIVEL ${card.level}` : 'HABILIDAD NUEVA',
      up: upgradeNote(card.id, card.level) ?? undefined, cool: cooldownNote(card.id, card.level),
    };
  }
  if (card.kind === 'perk') {
    const p = PERKS[card.id];
    const cooldown = perkCooldown(card.id);
    return {
      name: p.name, title: p.title, hint: p.hint, color: p.color, tag: p.needs ? 'MAESTRÍA' : p.max > 1 && card.level > 1 ? `MEJORA · ${card.level}` : 'MEJORA',
      cool: cooldown ? { text: `Recarga: ${+cooldown.toFixed(1)} s`, slower: false } : undefined,
    };
  }
  return card.id === 'gate'
    ? { name: 'Albañiles', title: 'la puerta', hint: `Remiendan la puerta: +${HEALS.gate}`, color: 0xc9b38a, tag: 'CURARSE' }
    : { name: 'Respiro', title: 'vos', hint: `Recuperás ${HEALS.player} de vida`, color: 0x5be07a, tag: 'CURARSE' };
}
