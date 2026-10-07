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
import { L } from '../i18n';
import { ABILITIES, ABILITY_LIST, cooldownAt, elementOf, ELEMENT_INFO, hintAt, maxLevelOf, SLOTS, upgradeNote, type AbilityId, type Element } from './abilities';

export type PerkId =
  | 'quickWrist' | 'sweetSpot' | 'rhythm' | 'hotStreak' | 'masonStreak' | 'smithStreak' | 'medkit' | 'giftPerfect' | 'quiver' | 'extraBall' | 'secondWind'
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
   * Muñeca rápida: el tramo débil de la barra tarda esta fracción, por cada vez que la tomás. El medio y
   * el fuerte llegan antes y duran lo mismo: la ventana del perfecto no cambia. (Hasta el 5/10 apuraba
   * el débil y el medio ×0.85; ×0.8 del débil solo abre el fuerte casi en el mismo momento, y el medio
   * un poco antes.)
   */
  quickWrist: 0.8,
  /**
   * Punto dulce: el tramo fuerte dura esta proporción más, por cada vez. Abre en el mismo momento: lo
   * que cambia es que el rebote llega más tarde.
   */
  sweetSpot: 1.35,
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
   * Al juntar tantos, la puerta +1 y el golfista +1. No se corta: se va juntando.
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
  /**
   * Perfecto de regalo: cuenta igual que el albañil, y al juntar tantos el próximo tiro arranca clavado
   * en el golpe perfecto. (Hasta el 3/10 eran 8 bajas cualquiera: premiaba lo que igual hay que hacer.)
   */
  giftPerfect: 5,
  /** Carcaj: si vas a pegar sin pelota, te aparece una. Una cada tantos segundos. */
  quiverCooldown: 10,
  /** Segundo aire: recarga propia. */
  secondWindCooldown: 30,
};

export const PERKS: Record<PerkId, Perk> = {
  quickWrist: { id: 'quickWrist', name: L('Muñeca rápida', 'Quick Wrists'), title: L('carga más rápido', 'faster charge'), max: 2, color: 0xffd66b, hint: L('El tramo débil dura un 20 % menos: el medio y el fuerte llegan antes', 'The weak part of the bar is 20 % shorter: mid and strong come sooner') },
  sweetSpot: { id: 'sweetSpot', name: L('Punto dulce', 'Sweet Spot'), title: L('perfecto más largo', 'longer perfect'), max: 2, color: 0xff6b6b, hint: L('El golpe perfecto dura un 35 % más', 'The perfect hit lasts 35 % longer') },
  rhythm: { id: 'rhythm', name: L('Ritmo', 'Rhythm'), title: L('racha que acelera', 'streaks speed up'), max: 1, color: 0xffb347, hint: L('Cada acierto seguido te hace cargar un 10 % más rápido, hasta 3 veces', 'Each hit in a row makes you charge 10 % faster, up to 3 times') },
  hotStreak: { id: 'hotStreak', name: L('En racha', 'Hot Streak'), title: L('sube el piso', 'raises the floor'), max: 1, color: 0xff8a3d, hint: L('Con 4 aciertos seguidos, los golpes que pegan 1 pasan a pegar 2', 'After 4 hits in a row, shots that deal 1 deal 2') },
  masonStreak: { id: 'masonStreak', name: L('El albañil', 'The Mason'), title: L('dobletes que arreglan', 'doubles that repair'), max: 1, color: 0xc9b38a, hint: L('Cada 3 disparos que maten a más de un enemigo, la puerta +1 y vos +1', 'Every 3 shots that kill more than one enemy: gate +1, you +1') },
  smithStreak: { id: 'smithStreak', name: L('El herrero', 'The Smith'), title: L('dobletes que forjan', 'doubles that forge'), max: 1, color: 0x9fb4c8, hint: L('Cada 2 disparos que maten a más de un enemigo, tu próxima pelota pega 1 más', 'Every 2 shots that kill more than one enemy, your next ball hits for 1 more') },
  medkit: { id: 'medkit', name: L('Botiquín', 'First-Aid Kit'), title: L('curarse entre oleadas', 'heal between waves'), max: 3, color: 0x8fe3b0, hint: L('Al empezar cada oleada, la puerta +1 y vos +1', 'At the start of each wave: gate +1, you +1') },
  giftPerfect: { id: 'giftPerfect', name: L('Perfecto de regalo', 'Free Perfect'), title: L('dobletes que clavan', 'doubles that lock'), max: 1, color: 0xff2d3c, hint: L('Cada 5 disparos que maten a más de un enemigo, el próximo tiro arranca en el golpe perfecto', 'Every 5 shots that kill more than one enemy, your next shot starts on a perfect hit') },
  quiver: { id: 'quiver', name: L('Carcaj', 'Quiver'), title: L('pelota a mano', 'ball at hand'), max: 1, color: 0xfff1b8, hint: L('Si vas a pegar sin pelota, te aparece una', 'Swing without a ball and one shows up') },
  extraBall: { id: 'extraBall', name: L('Pelota extra', 'Extra Ball'), title: L('una más en juego', 'one more in play'), max: 2, color: 0xfff1b8, hint: L('Una pelota más esperando en los puestos', 'One more ball waiting at the tees') },
  secondWind: { id: 'secondWind', name: L('Segundo aire', 'Second Wind'), title: L('otra vez', 'again'), max: 1, color: 0x8fe3b0, hint: L('Usás una habilidad aunque esté recargando', 'Use an ability even while on cooldown') },
  masteryIce: { id: 'masteryIce', name: L('Maestría del hielo', 'Ice Mastery'), title: L('congela', 'freezes'), max: 1, color: ELEMENT_INFO.ice.color, needs: 'ice', hint: L('El hielo congela a los que ya estaban fríos. Romper el hielo pega 1 más, también al fantasma', 'Ice freezes the already chilled. Breaking the ice hits for 1 more, ghosts too') },
  masteryFire: { id: 'masteryFire', name: L('Maestría del fuego', 'Fire Mastery'), title: L('contagia', 'spreads'), max: 1, color: ELEMENT_INFO.fire.color, needs: 'fire', hint: L('El que muere prendido fuego contagia a los de al lado', 'Enemies that die burning set their neighbors on fire') },
  masteryLightning: { id: 'masteryLightning', name: L('Maestría del rayo', 'Lightning Mastery'), title: L('salta más', 'jumps more'), max: 1, color: ELEMENT_INFO.lightning.color, needs: 'lightning', hint: L('El rayo salta una vez más y pega el doble', 'Lightning jumps once more and hits twice as hard') },
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
  /** Las habilidades y mejoras (por id) que no salen en las cartas (la demo: ver src/edition.ts). */
  locked?: ReadonlySet<string>;
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
    if (build.locked?.has(id)) continue;
    const level = owned.get(id);
    // subir una que ya tenés pesa más que una nueva cualquiera: son pocas y son tuyas
    if (level !== undefined) {
      if (level < maxLevelOf(id)) out.push({ card: { kind: 'ability', id, level: level + 1 }, weight: 3 });
    } else if (build.slots.length < SLOTS) {
      out.push({ card: { kind: 'ability', id, level: 1 }, weight: 1 });
    }
  }
  for (const id of PERK_LIST) {
    if (build.locked?.has(id)) continue;
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
export function cooldownNote(id: AbilityId, level: number): { text: string; slower: boolean } | null {
  const a = ABILITIES[id];
  const s = (n: number) => `${+n.toFixed(1)} s`;
  const to = cooldownAt(a, level);
  if (level <= 1) return { text: L(`Recarga: ${s(to)}`, `Cooldown: ${s(to)}`), slower: false };
  const from = cooldownAt(a, level - 1);
  // si subir no la cambia (todas menos el palazo), la carta no dice nada: ya dice qué mejora
  if (to === from) return null;
  const change = to > from ? L('más lenta', 'slower') : L('más rápida', 'faster');
  return { text: L(`Recarga: ${s(from)} → ${s(to)} · ${change}`, `Cooldown: ${s(from)} → ${s(to)} · ${change}`), slower: to > from };
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
      name: a.name, title: a.title, hint: hintAt(a, card.level), color: a.color,
      tag: card.level > 1 ? L(`HABILIDAD · NIVEL ${card.level}`, `ABILITY · LEVEL ${card.level}`) : L('HABILIDAD NUEVA', 'NEW ABILITY'),
      up: upgradeNote(card.id, card.level) ?? undefined, cool: cooldownNote(card.id, card.level) ?? undefined,
    };
  }
  if (card.kind === 'perk') {
    const p = PERKS[card.id];
    const cooldown = perkCooldown(card.id);
    return {
      name: p.name, title: p.title, hint: p.hint, color: p.color,
      tag: p.needs ? L('MAESTRÍA', 'MASTERY') : p.max > 1 && card.level > 1 ? L(`MEJORA · ${card.level}`, `PERK · ${card.level}`) : L('MEJORA', 'PERK'),
      cool: cooldown ? { text: L(`Recarga: ${+cooldown.toFixed(1)} s`, `Cooldown: ${+cooldown.toFixed(1)} s`), slower: false } : undefined,
    };
  }
  return card.id === 'gate'
    ? { name: L('Albañiles', 'Masons'), title: L('la puerta', 'the gate'), hint: L(`Remiendan la puerta: +${HEALS.gate}`, `They patch the gate: +${HEALS.gate}`), color: 0xc9b38a, tag: L('CURARSE', 'HEAL') }
    : { name: L('Respiro', 'Breather'), title: L('vos', 'you'), hint: L(`Recuperás ${HEALS.player} de vida`, `You recover ${HEALS.player} HP`), color: 0x5be07a, tag: L('CURARSE', 'HEAL') };
}
