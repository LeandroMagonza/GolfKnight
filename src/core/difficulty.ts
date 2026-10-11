// La dificultad (3/10, pedido de Leandro): talentos que hacen la partida más difícil. Desde el 11/10 se
// ponen por una escalera (ver LADDER): cada partida ganada en el nivel más alto que se tiene desbloquea el
// escalón siguiente, y en cada escalón se elige una de sus opciones. Antes eran 18 puntos para poner como
// uno quisiera.
//
// En el nivel 0, la partida es la más simple: en el campo liso, un solo poder por oleada (el de su
// escenario), sin olas especiales ni apoyos, enemigos más lentos, menos con poder y más flojos, el élite
// con menos vida y el jefe con enemigos comunes. Con todos los talentos al máximo (ya no se puede: la
// escalera tiene diez de los veinte pasos) era más difícil que la de antes del 3/10.

import { L } from '../i18n';
import { FOURTH } from './clubs';
import { ELITE, INTERMISSION, type RunRules } from './waves';

export type TalentId = 'stack' | 'special' | 'support' | 'casters' | 'powers' | 'speed' | 'terrain' | 'powered' | 'elite' | 'escort' | 'rest' | 'cooldown' | 'fourth';

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
 *   más en curarse); shut, el rato que el intocable pasa invulnerable; ghostHp, la vida de más del fantasma
 *   (ghostEliteHp, la del élite).
 * - cooldown: por cuánto se multiplica la recarga de las habilidades del caballero («Recarga lenta»).
 * - eliteHpLess: cuánta vida de más le sacan al élite (sobre ELITE.hp; como toda su vida, va por
 *   ELITE.hpScale: el punto le suma 4).
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
  ghostEliteHp: [0, 2],
  cooldown: [1, 1.5, 2],
  eliteHpLess: [2, 0],
  rest: [INTERMISSION, 4],
  fourthHp: 1,
  fourthEliteHp: 2,
  fourthBossHp: 8,
  // los hechiceros (11/10): qué parte de cada oleada se suma de hechiceros, con 0, 1 y 2 pasos
  casters: [0, 0.1, 0.2],
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
    () => L('En el último escenario vienen curanderos, inmunes o abanderados', 'Healers, warders or standard-bearers join the last stage'),
    () => L('Los apoyos vienen desde el segundo escenario', 'Supports join from the second stage on'),
  ] },
  { id: 'casters', name: L('Hechiceros', 'Sorcerers'), levels: [
    () => L('Se suman hechiceros que te tiran desde lejos. No van a la puerta: no hace falta matarlos para pasar de oleada, pero se juntan',
      'Sorcerers join and cast at you from afar. They don\'t go for the gate: you don\'t need to kill them to clear a wave, but they pile up'),
    () => L('El doble de hechiceros', 'Twice as many sorcerers'),
  ] },
  { id: 'powers', name: L('Poderes más duros', 'Tougher Powers'), levels: [
    // (11/10, Leandro: decía cada poder, y era demasiado; el detalle está en el README y en DIFFICULTY)
    () => L('Los poderes de los enemigos son más fuertes', 'Enemy powers are stronger'),
  ] },
  { id: 'speed', name: L('Más rápidos', 'Faster Enemies'), levels: [
    () => L('Los enemigos caminan más rápido', 'Enemies walk faster'),
    () => L('Los enemigos caminan más rápido todavía', 'Enemies walk even faster'),
    () => L('Los enemigos caminan más rápido que nunca', 'Enemies walk faster than ever'),
  ] },
  { id: 'terrain', name: L('Terreno irregular', 'Rough Terrain'), levels: [() => L('Se juega en campos con lomas', 'Played on hilly courses')] },
  { id: 'powered', name: L('Más con poder', 'More Powered'), levels: [
    () => upper(L(
      `${part(DIFFICULTY.share[1])} de los enemigos trae poder, en vez de ${part(DIFFICULTY.share[0])}`,
      `${part(DIFFICULTY.share[1])} of the enemies have a power, instead of ${part(DIFFICULTY.share[0])}`,
    )),
    () => upper(L(`${part(DIFFICULTY.share[2])} de los enemigos trae poder`, `${part(DIFFICULTY.share[2])} of the enemies have a power`)),
  ] },
  { id: 'elite', name: L('Élites más duros', 'Tougher Elites'), levels: [
    () => L(
      `Los élites tienen ${(DIFFICULTY.eliteHpLess[0] - DIFFICULTY.eliteHpLess[1]) * ELITE.hpScale} de vida más`,
      `Elites have ${(DIFFICULTY.eliteHpLess[0] - DIFFICULTY.eliteHpLess[1]) * ELITE.hpScale} more HP`,
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
      ? L('Tus habilidades tardan el doble en recargar', 'Your abilities take twice as long to recharge')
      : L(`Tus habilidades tardan un ${Math.round((DIFFICULTY.cooldown[2] - 1) * 100)} % más en recargar`, `Your abilities take ${Math.round((DIFFICULTY.cooldown[2] - 1) * 100)}% longer to recharge`)),
  ] },
  { id: 'fourth', name: L('Golpe 4', 'Hit 4'), levels: [
    () => L('Tus tiros pueden llegar al golpe 4, pero los enemigos tienen más vida', 'Your shots can reach hit 4, but enemies have more HP'),
  ] },
];
const BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<TalentId, Talent>;

/** El talento por su id (el nombre y lo que hace cada nivel). */
export function talent(id: TalentId): Talent {
  return BY_ID[id];
}

/**
 * La escalera (11/10, pedido de Leandro): los niveles de dificultad, en orden. En cada escalón se elige una
 * de sus opciones (las del mismo escalón no van juntas), y algunos traen una sola. Jugar en el nivel N es
 * tener puestos los primeros N escalones. Antes eran 18 puntos para poner donde uno quisiera: abrumaba, y
 * se podía saltar de golpe a lo más duro.
 *
 * Una opción suma un nivel a su talento: «Más rápidos» está en tres escalones, y cada uno que se elige lo
 * sube un paso. Ningún talento aparece más veces que sus niveles (algunos, menos: no todos los pasos
 * entran).
 *
 * El orden es el que mide el bot (tools/bot-tanda.mjs): primero lo que menos pesa.
 */
export const LADDER: TalentId[][] = [
  // (11/10, Leandro: la escolta del jefe es de las livianas; más con poder, sola; el terreno en el 7 y el
  // golpe 4 al final, solo)
  ['rest', 'elite', 'escort'],
  ['speed'],
  ['special', 'cooldown'],
  ['powered'],
  ['powers'],
  ['support', 'casters'],
  ['terrain', 'speed'],
  ['special', 'support', 'casters'],
  ['stack', 'speed'],
  ['fourth'],
];

/** El nivel más alto: todos los escalones puestos. */
export const MAX_LEVEL = LADDER.length;

/** Los niveles de cada talento. */
export type Picks = Partial<Record<TalentId, number>>;

/** Lo que se guarda. */
export interface Progress {
  /** Los escalones desbloqueados: se gana uno al ganar jugando en el más alto que se tiene. */
  unlocked: number;
  /** El nivel con que se juega: los primeros `level` escalones (hasta `unlocked`). */
  level: number;
  /** La opción elegida en cada escalón, también en los que no están puestos (se recuerda). */
  choices: number[];
}

/** La opción elegida en el escalón `i` (la primera, si no se eligió). */
export function choiceAt(p: Progress, i: number): number {
  const c = Math.floor(p.choices[i] ?? 0);
  return c >= 0 && c < LADDER[i].length ? c : 0;
}

/** Los niveles de cada talento que dan los escalones puestos: cada opción elegida suma uno. */
export function picksOf(p: Progress): Picks {
  const picks: Picks = {};
  for (let i = 0; i < Math.min(p.level, MAX_LEVEL); i++) {
    const id = LADDER[i][choiceAt(p, i)];
    picks[id] = (picks[id] ?? 0) + 1;
  }
  return picks;
}

/**
 * Qué paso de su talento da la opción `o` del escalón `i`, si se la elige: el 1, o uno más por cada
 * escalón puesto de antes que tiene elegido el mismo talento. Es la línea que la describe.
 */
export function stepOf(p: Progress, i: number, o: number): number {
  const id = LADDER[i][o];
  let n = 1;
  for (let j = 0; j < Math.min(i, p.level); j++) if (LADDER[j][choiceAt(p, j)] === id) n++;
  return Math.min(n, BY_ID[id].levels.length);
}

/** El nombre de la opción (con el paso, desde el segundo: «Más rápidos II») y lo que hace. */
export function optionText(p: Progress, i: number, o: number): { name: string; line: string } {
  const t = BY_ID[LADDER[i][o]];
  const step = stepOf(p, i, o);
  return { name: step > 1 ? `${t.name} ${'I'.repeat(step)}` : t.name, line: t.levels[step - 1]() };
}

/** El nivel de un talento, sin pasar de su máximo. */
export function levelOf(picks: Picks, id: TalentId): number {
  return Math.max(0, Math.min(BY_ID[id].levels.length, Math.floor(picks[id] ?? 0)));
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
      ghostEliteHp: at(DIFFICULTY.ghostEliteHp, lv('powers')),
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
    casters: at(DIFFICULTY.casters, lv('casters')),
  };
}

/**
 * ¿Se juega en un campo con lomas? Es un talento más (3/10): sin él, el campo liso. Cambiarlo antes de
 * empezar cambia el campo en el acto (ver World.rebuildField).
 */
export function hillsOn(picks: Picks): boolean {
  return levelOf(picks, 'terrain') >= 1;
}

/**
 * Elige la opción `o` del escalón `i`, si está desbloqueado. Si el escalón no estaba puesto, se ponen él
 * y los de antes (con lo que tenían elegido): el nivel sube hasta ahí.
 */
export function choose(p: Progress, i: number, o: number): boolean {
  if (i < 0 || i >= Math.min(p.unlocked, MAX_LEVEL) || o < 0 || o >= LADDER[i].length) return false;
  if (choiceAt(p, i) === o && i < p.level) return false;
  const choices = LADDER.map((_, j) => choiceAt(p, j));
  choices[i] = o;
  p.choices = choices;
  p.level = Math.max(p.level, i + 1);
  return true;
}

/** Juega en el nivel `n` (sin pasar de lo desbloqueado): los escalones de más quedan elegidos, pero sin poner. */
export function setLevel(p: Progress, n: number): boolean {
  const to = Math.max(0, Math.min(p.unlocked, MAX_LEVEL, Math.round(n)));
  if (to === p.level) return false;
  p.level = to;
  return true;
}

/**
 * Se ganó una partida: si se jugó en el nivel más alto que se tiene, se desbloquea el siguiente. Ganar
 * más abajo no da: el escalón nuevo es por animarse a lo más difícil. Devuelve si se desbloqueó.
 */
export function earnLevel(p: Progress): boolean {
  if (p.level < p.unlocked || p.unlocked >= MAX_LEVEL) return false;
  p.unlocked++;
  return true;
}

const KEY = 'gk.dificultad';
/** Los puntos que había antes de la escalera (12 talentos, 18 puntos): para pasar lo guardado. */
const OLD_POINTS = 18;

/**
 * Lo guardado antes de la escalera (puntos ganados y dónde estaban puestos): lo desbloqueado, en la misma
 * proporción, y en cada escalón la opción de un talento que se tenía puesto, si hay.
 */
function fromPoints(points: number, picks: Picks): Progress {
  const share = (n: number) => Math.max(0, Math.min(MAX_LEVEL, Math.round((n * MAX_LEVEL) / OLD_POINTS)));
  const usedOld = (Object.keys(picks) as TalentId[]).reduce((n, id) => n + (BY_ID[id] ? levelOf(picks, id) : 0), 0);
  const left: Picks = { ...picks };
  const choices = LADDER.map((options) => {
    const o = options.findIndex((id) => (left[id] ?? 0) > 0);
    if (o < 0) return 0;
    left[options[o]] = (left[options[o]] ?? 0) - 1;
    return o;
  });
  const unlocked = share(points);
  return { unlocked, level: Math.min(unlocked, share(usedOld)), choices };
}

/** Lo guardado en este navegador, o empezar de cero. */
export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Progress> & { points?: number; picks?: Picks };
    if (!Array.isArray(raw.choices)) return fromPoints(Math.floor(Number(raw.points) || 0), raw.picks ?? {});
    const unlocked = Math.max(0, Math.min(MAX_LEVEL, Math.floor(Number(raw.unlocked) || 0)));
    const p: Progress = { unlocked, level: 0, choices: raw.choices.map((c) => Math.floor(Number(c) || 0)) };
    p.choices = LADDER.map((_, i) => choiceAt(p, i));
    p.level = Math.max(0, Math.min(unlocked, Math.floor(Number(raw.level) || 0)));
    return p;
  } catch {
    return { unlocked: 0, level: 0, choices: LADDER.map(() => 0) };
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* sin localStorage: vale para esta partida nomás */ }
}

/**
 * Para las pruebas (?escalera=0,1,0 en la URL): el nivel 3, con la primera opción en el primer escalón, la
 * segunda en el segundo y la primera en el tercero. Todo desbloqueado.
 */
export function ladderFrom(text: string): Progress {
  const choices = text.split(',').filter((s) => s.trim() !== '').map((s) => Math.floor(Number(s) || 0));
  const p: Progress = { unlocked: MAX_LEVEL, level: Math.min(MAX_LEVEL, choices.length), choices };
  p.choices = LADDER.map((_, i) => choiceAt(p, i));
  return p;
}
