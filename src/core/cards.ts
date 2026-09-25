// Las cartas que se eligen entre oleadas: al terminar cada una salen tres y te quedás con una. Hay de
// tres clases:
// - **Habilidad**: una nueva (si te queda lugar en Q, W, E o R) o subir de nivel una que ya tenés.
// - **Mejora**: cambios que valen para todo el juego. A propósito **no tocan la tabla de daño de ningún
//   palo**: un +1 al driver lo haría el mejor también de cerca y el putter dejaría de tener sentido. Van
//   por el lado del timing, las pelotas y las rachas, que no cambian qué palo conviene a cada distancia.
// - **Curarse**: la puerta o el golfista. Ya no se curan solos entre oleadas: curarse es elegir no mejorar.
//
// Todo acá es lógica pura, sin Three.js, para poder probar el sorteo.
import { ABILITIES, ABILITY_LIST, elementOf, ELEMENT_INFO, MAX_LEVEL, SLOTS, type AbilityId, type Element } from './abilities';

export type PerkId =
  | 'quickWrist' | 'sweetSpot' | 'rhythm' | 'masonStreak' | 'giftPerfect' | 'quiver' | 'extraBall' | 'secondWind'
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
  /** Muñeca rápida: la barra se llena en esta fracción del tiempo, por cada vez que la tomás. */
  quickWrist: 0.85,
  /** Punto dulce: la ventana del golpe 3 se agranda esta proporción, por cada vez. */
  sweetSpot: 1.35,
  /** Ritmo: cada tiro seguido que mata carga esta fracción más rápido, hasta `rhythmMax` tiros. */
  rhythmStep: 0.1,
  rhythmMax: 3,
  /** Racha del albañil: tantos tiros seguidos matando (sin contar habilidades) curan 1 de puerta. */
  masonStreak: 5,
  /** Perfecto de regalo: cada tantas bajas, el próximo tiro arranca clavado en el golpe perfecto. */
  giftPerfect: 8,
  /** Carcaj: si vas a pegar sin pelota, te aparece una. Una cada tantos segundos. */
  quiverCooldown: 12,
  /** Segundo aire: recarga propia. */
  secondWindCooldown: 30,
};

export const PERKS: Record<PerkId, Perk> = {
  quickWrist: { id: 'quickWrist', name: 'Muñeca rápida', title: 'carga más rápido', max: 2, color: 0xffd66b, hint: 'La barra llega arriba un 15 % antes, con todos los palos' },
  sweetSpot: { id: 'sweetSpot', name: 'Punto dulce', title: 'perfecto más ancho', max: 2, color: 0xff6b6b, hint: 'La ventana del golpe perfecto se agranda un 35 %' },
  rhythm: { id: 'rhythm', name: 'Ritmo', title: 'racha que acelera', max: 1, color: 0xffb347, hint: 'Cada tiro seguido que mata a alguien hace cargar el próximo un 10 % más rápido, hasta tres. Un tiro que no mata corta la racha' },
  masonStreak: { id: 'masonStreak', name: 'Racha del albañil', title: 'la puerta se arregla', max: 1, color: 0xc9b38a, hint: 'Cinco tiros seguidos matando a alguien (sin contar habilidades) le devuelven 1 a la puerta' },
  giftPerfect: { id: 'giftPerfect', name: 'Perfecto de regalo', title: 'cada 8 bajas', max: 1, color: 0xff2d3c, hint: 'Cada 8 bajas, el próximo tiro arranca ya clavado en el golpe perfecto: soltás cuando quieras' },
  quiver: { id: 'quiver', name: 'Carcaj', title: 'pelota a mano', max: 1, color: 0xfff1b8, hint: 'Si vas a pegar donde no hay pelota, te aparece una a los pies. Una cada 12 segundos' },
  extraBall: { id: 'extraBall', name: 'Pelota extra', title: 'una más en juego', max: 2, color: 0xfff1b8, hint: 'Los guardias mantienen una pelota más esperando en los puestos' },
  secondWind: { id: 'secondWind', name: 'Segundo aire', title: 'otra vez', max: 1, color: 0x8fe3b0, hint: 'Si apretás una habilidad que está recargando, sale igual: la que se gasta es esta, que recarga 30 segundos' },
  masteryIce: { id: 'masteryIce', name: 'Maestría del hielo', title: 'congela', max: 1, color: ELEMENT_INFO.ice.color, needs: 'ice', hint: 'Al que ya está frío, un segundo hielo lo congela en el lugar. Y el golpe que rompe el hielo pega el doble' },
  masteryFire: { id: 'masteryFire', name: 'Maestría del fuego', title: 'contagia', max: 1, color: ELEMENT_INFO.fire.color, needs: 'fire', hint: 'El que muere prendido fuego contagia a los que tiene al lado' },
  masteryLightning: { id: 'masteryLightning', name: 'Maestría del rayo', title: 'salta más', max: 1, color: ELEMENT_INFO.lightning.color, needs: 'lightning', hint: 'El rayo salta una vez más, y cada salto pega el doble' },
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
      if (level < MAX_LEVEL) out.push({ card: { kind: 'ability', id, level: level + 1 }, weight: 3 });
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
  if (build.gate < build.gateMax) out.push({ card: { kind: 'heal', id: 'gate' }, weight: 2 });
  if (build.hp < build.hpMax) out.push({ card: { kind: 'heal', id: 'player' }, weight: 2 });
  return out;
}

/** ¿Hace falta ofrecer sí o sí una curación? Con la puerta a la mitad o con una sola vida. */
export function needsHeal(build: Build): 'gate' | 'player' | null {
  if (build.gate <= build.gateMax / 2) return 'gate';
  if (build.hp <= 1 && build.hpMax > 1) return 'player';
  return null;
}

/** Saca `n` cartas distintas, por peso. Si la partida viene mal, una de ellas es para curarse. */
export function drawCards(build: Build, n = 3, rand: () => number = Math.random): Card[] {
  const pool = candidates(build);
  const out: Card[] = [];
  const must = needsHeal(build);
  if (must) {
    const i = pool.findIndex((c) => c.card.kind === 'heal' && c.card.id === must);
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

/** Nombre, título, texto y color de una carta, para mostrarla. */
export function describe(card: Card): { name: string; title: string; hint: string; color: number; tag: string } {
  if (card.kind === 'ability') {
    const a = ABILITIES[card.id];
    return { name: a.name, title: a.title, hint: a.hint, color: a.color, tag: card.level > 1 ? `HABILIDAD · NIVEL ${card.level}` : 'HABILIDAD NUEVA' };
  }
  if (card.kind === 'perk') {
    const p = PERKS[card.id];
    return { name: p.name, title: p.title, hint: p.hint, color: p.color, tag: p.needs ? 'MAESTRÍA' : p.max > 1 && card.level > 1 ? `MEJORA · ${card.level}` : 'MEJORA' };
  }
  return card.id === 'gate'
    ? { name: 'Albañiles', title: 'la puerta', hint: `Remiendan la puerta: +${HEALS.gate}`, color: 0xc9b38a, tag: 'CURARSE' }
    : { name: 'Respiro', title: 'vos', hint: `Recuperás ${HEALS.player} de vida`, color: 0x5be07a, tag: 'CURARSE' };
}
