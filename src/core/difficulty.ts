// La dificultad (3/10, pedido de Leandro): un árbol de talentos al revés. Cada partida ganada da un punto,
// y cada punto puesto en un talento hace la partida más difícil. Se reparten como uno quiera y se pueden
// mover entre partidas; lo lógico es poner primero lo que a uno le resulta más fácil.
//
// Sin puntos, la partida es la más simple: en el campo liso, un solo poder por oleada (el de su
// escenario), sin olas especiales ni apoyos, enemigos más lentos, menos con poder y más flojos, el élite
// con menos vida y el jefe con enemigos comunes. Con todos los puntos puestos es más difícil que la de
// antes del 3/10.

import { ELITE, INTERMISSION, type RunRules } from './waves';

export type TalentId = 'stack' | 'special' | 'support' | 'powers' | 'speed' | 'terrain' | 'powered' | 'elite' | 'escort' | 'rest';

export interface Talent {
  id: TalentId;
  name: string;
  /** Lo que suma cada nivel, en una frase. */
  levels: (() => string)[];
}

/**
 * Los números de cada talento, por nivel (el primero es sin puntos). Se tocan en el panel B.
 * - speed: la velocidad de los enemigos, sobre la de su cuerpo.
 * - share: qué parte sale con poder.
 * - cap: hasta qué nivel llegan el escudo y el blindaje. recharge: por cuánto se multiplica la recarga
 *   del escurridizo y el bendito. Los dos van con el mismo punto.
 * - eliteHpLess: cuánta vida de más le sacan al élite (sobre ELITE.hp).
 * - rest: segundos de descanso entre oleadas.
 */
export const DIFFICULTY = {
  speed: [0.85, 1, 1.12],
  share: [0.25, 1 / 3],
  cap: [2, 3],
  recharge: [1.6, 1],
  eliteHpLess: [2, 0],
  rest: [INTERMISSION, 4],
};

/** Una fracción como se dice: un cuarto, un tercio. */
const part = (x: number) => ({ 2: 'la mitad', 3: 'un tercio', 4: 'un cuarto', 5: 'un quinto' })[Math.round(1 / x)] ?? `un ${Math.round(x * 100)} %`;

export const TALENTS: Talent[] = [
  { id: 'stack', name: 'Poderes acumulados', levels: [() => 'Los poderes de los escenarios anteriores siguen viniendo'] },
  { id: 'special', name: 'Olas especiales', levels: [() => 'La segunda oleada es especial y deja su marca en el resto de la partida', () => 'Otra ola especial, más adelante'] },
  { id: 'support', name: 'Apoyos', levels: [() => 'En el último escenario vienen curanderos, inmunes, abanderados o hechiceros', () => 'Desde el segundo escenario'] },
  { id: 'powers', name: 'Poderes más duros', levels: [() => `Escudos y blindajes de hasta ${DIFFICULTY.cap[1]}, y los escurridizos y los benditos recargan más rápido`] },
  { id: 'speed', name: 'Más rápidos', levels: [() => 'Los enemigos caminan más rápido', () => 'Todavía más rápido'] },
  { id: 'terrain', name: 'Terreno irregular', levels: [() => 'Se juega en campos con lomas'] },
  { id: 'powered', name: 'Más con poder', levels: [() => `${part(DIFFICULTY.share[1])} de los enemigos trae poder, en vez de ${part(DIFFICULTY.share[0])}`.replace(/^./, (c) => c.toUpperCase())] },
  { id: 'elite', name: 'Élites más duros', levels: [() => `Los élites tienen ${DIFFICULTY.eliteHpLess[0] - DIFFICULTY.eliteHpLess[1]} de vida más`] },
  { id: 'escort', name: 'Escolta del jefe', levels: [() => 'El jefe viene con enemigos con poderes'] },
  { id: 'rest', name: 'Sin respiro', levels: [() => 'Menos descanso entre oleadas'] },
];
const BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<TalentId, Talent>;

/** Los puntos puestos en cada talento. */
export type Picks = Partial<Record<TalentId, number>>;

/** Lo que se guarda: los puntos ganados y dónde están puestos. */
export interface Progress {
  points: number;
  picks: Picks;
}

/** Todos los puntos que se pueden poner: uno por nivel de cada talento. */
export const MAX_POINTS = TALENTS.reduce((n, t) => n + t.levels.length, 0);

/** El nivel de un talento, sin pasar de su máximo. */
export function levelOf(picks: Picks, id: TalentId): number {
  return Math.max(0, Math.min(BY_ID[id].levels.length, Math.floor(picks[id] ?? 0)));
}

/** Cuántos puntos hay puestos: es el nivel de dificultad de la partida. */
export function used(picks: Picks): number {
  return TALENTS.reduce((n, t) => n + levelOf(picks, t.id), 0);
}

/** El número de `table` para este nivel (el último, si se pasa). */
const at = (table: number[], level: number) => table[Math.min(level, table.length - 1)];

/** Lo que la dificultad elegida cambia en la partida. */
export function rulesFor(picks: Picks): RunRules {
  const lv = (id: TalentId) => levelOf(picks, id);
  return {
    stack: lv('stack') >= 1,
    specials: lv('special'),
    supports: lv('support'),
    hard: { cap: at(DIFFICULTY.cap, lv('powers')), recharge: at(DIFFICULTY.recharge, lv('powers')) },
    speed: at(DIFFICULTY.speed, lv('speed')),
    share: at(DIFFICULTY.share, lv('powered')),
    eliteHp: ELITE.hp.map((hp) => Math.max(0, hp - at(DIFFICULTY.eliteHpLess, lv('elite')))),
    escort: lv('escort') >= 1,
    rest: at(DIFFICULTY.rest, lv('rest')),
  };
}

/**
 * ¿Se juega en un campo con lomas? Es un talento más (3/10): sin él, el campo liso. Cambiarlo antes de
 * empezar cambia el campo en el acto (ver World.rebuildField).
 */
export function hillsOn(picks: Picks): boolean {
  return levelOf(picks, 'terrain') >= 1;
}

/** Sube o baja un talento, si se puede: sin pasar de su máximo ni de los puntos que hay. */
export function setLevel(p: Progress, id: TalentId, level: number): boolean {
  const now = levelOf(p.picks, id);
  const to = Math.max(0, Math.min(BY_ID[id].levels.length, level));
  if (to === now || used(p.picks) - now + to > p.points) return false;
  p.picks = { ...p.picks, [id]: to };
  return true;
}

/**
 * Se ganó una partida: si se jugó con todos los puntos puestos, se gana uno más. Ganar con puntos sin
 * poner no da: el punto nuevo es por animarse a lo más difícil que se tiene. Devuelve si se ganó.
 */
export function earnPoint(p: Progress): boolean {
  if (used(p.picks) < p.points || p.points >= MAX_POINTS) return false;
  p.points++;
  return true;
}

const KEY = 'gk.dificultad';

/** Lo guardado en este navegador, o empezar de cero. */
export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Progress>;
    const points = Math.max(0, Math.min(MAX_POINTS, Math.floor(Number(raw.points) || 0)));
    const p: Progress = { points, picks: {} };
    // lo puesto, talento por talento, mientras alcancen los puntos
    for (const t of TALENTS) setLevel(p, t.id, Number(raw.picks?.[t.id]) || 0);
    return p;
  } catch {
    return { points: 0, picks: {} };
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* sin localStorage: vale para esta partida nomás */ }
}
