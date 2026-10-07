// La dificultad (3/10, pedido de Leandro): un árbol de talentos al revés. Cada partida ganada da un punto,
// y cada punto puesto en un talento hace la partida más difícil. Se reparten como uno quiera y se pueden
// mover entre partidas; lo lógico es poner primero lo que a uno le resulta más fácil.
//
// Sin puntos, la partida es la más simple: en el campo liso, un solo poder por oleada (el de su
// escenario), sin olas especiales ni apoyos, enemigos más lentos, menos con poder y más flojos, el élite
// con menos vida y el jefe con enemigos comunes. Con todos los puntos puestos es más difícil que la de
// antes del 3/10.

import { L } from '../i18n';
import { FOURTH } from './clubs';
import { ELITE, INTERMISSION, type RunRules } from './waves';

export type TalentId = 'stack' | 'special' | 'support' | 'powers' | 'speed' | 'terrain' | 'powered' | 'elite' | 'escort' | 'rest' | 'cooldown' | 'fourth';

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
 * - Los poderes (un solo punto, «Poderes más duros», que desde el 7/10 toca a todos los de escenario; ver
 *   PowerHardness en core/waves): cap, hasta qué nivel llega el escudo; armorRolls, de cuántos sorteos
 *   sale el blindaje (el mayor: con 2, casi siempre de 2); recharge, por cuánto se multiplica la recarga
 *   del escurridizo y el bendito y la ventana del intocable; regen, el margen del que se cura (más, tarda
 *   más en curarse); shut, el rato que el intocable pasa invulnerable; ghostHp, la vida de más del fantasma.
 * - cooldown: por cuánto se multiplica la recarga de las habilidades del caballero («Recarga lenta»).
 * - eliteHpLess: cuánta vida de más le sacan al élite (sobre ELITE.hp).
 * - rest: segundos de descanso entre oleadas.
 * - fourthHp, fourthEliteHp, fourthBossHp: el golpe 4 (ver FOURTH en core/clubs), la vida de más que
 *   traen con el talento los comunes, los élites y el jefe. Es el único talento que también te da algo.
 */
export const DIFFICULTY = {
  // tres puntos de velocidad (3/10): sin puntos ×0.76, y el tercero llega a lo que antes era el segundo
  speed: [0.76, 0.88, 1, 1.12],
  share: [0.25, 1 / 3, 0.5],
  cap: [2, 3],
  armorRolls: [1, 2],
  recharge: [1.6, 1],
  // el que se cura (7/10): sin el punto, más fácil que antes (era ×1.6); con el punto, lo de siempre
  regen: [2.5, 1],
  shut: [1, 1.3],
  ghostHp: [0, 1],
  cooldown: [1, 1.5, 2],
  eliteHpLess: [2, 0],
  rest: [INTERMISSION, 4],
  fourthHp: 1,
  fourthEliteHp: 2,
  fourthBossHp: 8,
};

/** Una fracción como se dice: un cuarto, un tercio. */
const part = L(
  (x: number) => ({ 2: 'la mitad', 3: 'un tercio', 4: 'un cuarto', 5: 'un quinto' })[Math.round(1 / x)] ?? `un ${Math.round(x * 100)} %`,
  (x: number) => ({ 2: 'half', 3: 'a third', 4: 'a quarter', 5: 'a fifth' })[Math.round(1 / x)] ?? `${Math.round(x * 100)} %`,
);
/** La primera letra en mayúscula: la fracción puede abrir la frase. */
const upper = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

export const TALENTS: Talent[] = [
  { id: 'stack', name: L('Poderes acumulados', 'Stacked Powers'), levels: [() => L('Los poderes de los escenarios anteriores siguen viniendo', 'Powers from earlier stages keep coming')] },
  { id: 'special', name: L('Olas especiales', 'Special Waves'), levels: [
    () => L('La segunda oleada es especial y deja su marca en el resto de la partida', 'The second wave is special and leaves its mark on the rest of the run'),
    () => L('Otra ola especial, más adelante', 'Another special wave, later on'),
  ] },
  { id: 'support', name: L('Apoyos', 'Supports'), levels: [
    () => L('En el último escenario vienen curanderos, inmunes, abanderados o hechiceros', 'Healers, warders, standard-bearers or sorcerers join the last stage'),
    () => L('Desde el segundo escenario', 'From the second stage on'),
  ] },
  { id: 'powers', name: L('Poderes más duros', 'Tougher Powers'), levels: [
    () => L(
      `Escudos de hasta ${DIFFICULTY.cap[1]} y más blindajes de 2; los escurridizos y los benditos recargan antes, los que se curan se curan `
        + `más seguido, los intocables pasan más rato invulnerables y los fantasmas traen ${DIFFICULTY.ghostHp[1]} de vida más`,
      `Shields up to ${DIFFICULTY.cap[1]} and more level-2 armor; slippery and blessed enemies recharge sooner, regenerators heal `
        + `more often, untouchables stay invulnerable longer and ghosts get ${DIFFICULTY.ghostHp[1]} more HP`,
    ),
  ] },
  { id: 'speed', name: L('Más rápidos', 'Faster Enemies'), levels: [
    () => L('Los enemigos caminan más rápido', 'Enemies walk faster'), () => L('Más rápido', 'Faster'), () => L('Todavía más rápido', 'Even faster'),
  ] },
  { id: 'terrain', name: L('Terreno irregular', 'Rough Terrain'), levels: [() => L('Se juega en campos con lomas', 'Played on hilly courses')] },
  { id: 'powered', name: L('Más con poder', 'More Powered'), levels: [
    () => upper(L(
      `${part(DIFFICULTY.share[1])} de los enemigos trae poder, en vez de ${part(DIFFICULTY.share[0])}`,
      `${part(DIFFICULTY.share[1])} of the enemies have a power, instead of ${part(DIFFICULTY.share[0])}`,
    )),
    () => upper(L(`${part(DIFFICULTY.share[2])} trae poder`, `${part(DIFFICULTY.share[2])} of them have a power`)),
  ] },
  { id: 'elite', name: L('Élites más duros', 'Tougher Elites'), levels: [
    () => L(
      `Los élites tienen ${DIFFICULTY.eliteHpLess[0] - DIFFICULTY.eliteHpLess[1]} de vida más`,
      `Elites have ${DIFFICULTY.eliteHpLess[0] - DIFFICULTY.eliteHpLess[1]} more HP`,
    ),
  ] },
  { id: 'escort', name: L('Escolta del jefe', 'Boss Escort'), levels: [() => L('El jefe viene con enemigos con poderes', 'The boss brings powered-up enemies')] },
  { id: 'rest', name: L('Sin respiro', 'No Breather'), levels: [() => L('Menos descanso entre oleadas', 'Less rest between waves')] },
  { id: 'cooldown', name: L('Recarga lenta', 'Slow Recharge'), levels: [
    () => L(
      `Tus habilidades tardan un ${Math.round((DIFFICULTY.cooldown[1] - 1) * 100)} % más en recargar`,
      `Your abilities take ${Math.round((DIFFICULTY.cooldown[1] - 1) * 100)}% longer to recharge`,
    ),
    () => (DIFFICULTY.cooldown[2] === 2
      ? L('Tardan el doble', 'They take twice as long')
      : L(`Tardan un ${Math.round((DIFFICULTY.cooldown[2] - 1) * 100)} % más`, `They take ${Math.round((DIFFICULTY.cooldown[2] - 1) * 100)}% longer`)),
  ] },
  { id: 'fourth', name: L('Golpe 4', 'Hit 4'), levels: [
    () => L(
      `En el medio del rojo aparece el golpe 4: pega ${FOURTH.bonus} más que el 3, y entre los dos duran lo que el 3 de siempre. `
        + `A cambio, los enemigos traen ${DIFFICULTY.fourthHp} de vida más, los élites ${DIFFICULTY.fourthEliteHp} y el jefe ${DIFFICULTY.fourthBossHp}`,
      `Hit 4 appears in the middle of the red: it deals ${FOURTH.bonus} more than hit 3, and together they last as long as hit 3 used to. `
        + `In exchange, enemies get ${DIFFICULTY.fourthHp} more HP, elites ${DIFFICULTY.fourthEliteHp} and the boss ${DIFFICULTY.fourthBossHp}`,
    ),
  ] },
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
  const fourth = lv('fourth') >= 1;
  return {
    stack: lv('stack') >= 1,
    specials: lv('special'),
    supports: lv('support'),
    hard: {
      cap: at(DIFFICULTY.cap, lv('powers')),
      armorRolls: at(DIFFICULTY.armorRolls, lv('powers')),
      recharge: at(DIFFICULTY.recharge, lv('powers')),
      regen: at(DIFFICULTY.regen, lv('powers')),
      shut: at(DIFFICULTY.shut, lv('powers')),
      ghostHp: at(DIFFICULTY.ghostHp, lv('powers')),
    },
    speed: at(DIFFICULTY.speed, lv('speed')),
    share: at(DIFFICULTY.share, lv('powered')),
    eliteHp: ELITE.hp.map((hp) => Math.max(0, hp - at(DIFFICULTY.eliteHpLess, lv('elite'))) + (fourth ? DIFFICULTY.fourthEliteHp : 0)),
    escort: lv('escort') >= 1,
    rest: at(DIFFICULTY.rest, lv('rest')),
    fourth,
    extraHp: fourth ? DIFFICULTY.fourthHp : 0,
    bossHp: fourth ? DIFFICULTY.fourthBossHp : 0,
    cooldown: at(DIFFICULTY.cooldown, lv('cooldown')),
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
