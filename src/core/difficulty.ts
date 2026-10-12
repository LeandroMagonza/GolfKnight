// La dificultad (3/10, pedido de Leandro): talentos que hacen la partida más difícil. Desde el 11/10 se
// ponen por una escalera (ver LADDER): cada partida ganada en el nivel más alto que se tiene desbloquea el
// escalón siguiente, y en cada escalón se elige una de sus opciones. Antes eran 18 puntos para poner como
// uno quisiera.
//
// Cada opción es independiente (11/10, Leandro): dice lo que hace, y eso hace, haya lo que haya elegido en
// los otros escalones. Las que se repiten (más rápidos, recarga lenta, hechiceros) traen cada una su número,
// y se suman.
//
// En el nivel 0, la partida es la más simple: en el campo liso, un solo poder por oleada (el de su
// escenario), sin olas especiales ni apoyos, enemigos más lentos, menos con poder y más flojos, el élite
// con menos vida y el jefe con enemigos comunes.

import { L } from '../i18n';
import { ELITE, INTERMISSION, type RunRules } from './waves';

export type TalentId = 'stack' | 'special' | 'support' | 'casters' | 'powers' | 'speed' | 'terrain' | 'powered' | 'escort' | 'rest' | 'cooldown' | 'fourth';

export interface Talent {
  id: TalentId;
  name: string;
  /** Lo que hace una opción de este talento, en una frase; `add`, su número (en los que se suman). */
  text: (add: number) => string;
  /**
   * Se suma: cada opción trae su número (`add` en LADDER), y la partida usa la suma (la velocidad, la
   * recarga, los hechiceros). Si no, cada opción cuenta uno, hasta `max`.
   */
  adds?: boolean;
  /** Cuántas opciones de este talento cuentan, como mucho (en los que no se suman). */
  max: number;
}

/**
 * Los números de la dificultad. Se tocan en el panel B (lo que suma cada opción, en LADDER).
 * - speedBase: la velocidad de los enemigos en el nivel 0, sobre la de su cuerpo. Cada «Más rápidos» le
 *   suma su parte de esa (con +10 % y +15 %, ×1.25).
 * - share: qué parte sale con poder, sin y con «Más con poder» (y con dos, si alguna vez hay dos).
 * - Los poderes («Poderes más duros», que desde el 7/10 toca a todos los de escenario; ver PowerHardness en
 *   core/waves), sin y con: cap, hasta qué nivel llega el escudo; armorRolls, de cuántos sorteos sale el
 *   blindaje (el mayor: con 2, casi siempre de 2); recharge, por cuánto se multiplica la recarga del
 *   escurridizo y el bendito; regen, el margen del que se cura (más, tarda más en curarse); timings, en
 *   cuántos tiempos va el ritmo del intocable, y phaseOpen, cuánto del ciclo está abierto; full, el escudo y
 *   el blindaje al máximo; ghostHp, la vida de más del fantasma (ghostEliteHp, la del élite).
 * - eliteHpLess: cuánta vida de más le sacan al élite (sobre ELITE.hp; como toda su vida, va por
 *   ELITE.hpScale: «Élites más duros» le suma 4).
 * - rest: segundos de descanso entre oleadas, sin y con «Sin respiro».
 * - fourthHp, fourthEliteHp, fourthBossHp: el golpe 4 (ver FOURTH en core/clubs), la vida de más que
 *   traen con el talento los comunes, los élites y el jefe. Es el único talento que también te da algo.
 *   Desde el 11/10, los élites y el jefe sin vida de más (eran +2, al doble, y +8): en la tanda de la
 *   noche, con el golpe 4 encima de todo lo demás el bot perdía 30 de 30 en el primer jefe, y con +25 %
 *   de velocidad, 0 de 30 (Leandro: «saquémosle la vida extra a estos para probar»).
 */
export const DIFFICULTY = {
  speedBase: 0.76,
  share: [0.25, 1 / 3, 0.5],
  cap: [2, 3],
  armorRolls: [1, 2],
  recharge: [1.6, 1],
  // el que se cura (7/10): sin el punto, más fácil que antes (era ×1.6); con el punto, lo de siempre
  regen: [2.5, 1],
  // el intocable (11/10): sin el punto, dos tiempos (abierto la mitad del ciclo); con el punto, tres
  timings: [2, 3],
  // cuánto del ciclo está abierto (12/10): dos tercios sin el punto, la mitad con el punto
  phaseOpen: [2 / 3, 0.5],
  // el escudo y el blindaje, siempre al máximo con el punto (12/10)
  full: [0, 1],
  // el fantasma, sin vida de más también con el punto (12/10: era +1, y el élite +2 al doble)
  ghostHp: [0, 0],
  rest: [INTERMISSION, 4],
  fourthHp: 1,
  fourthBossHp: 0,
};

/** Una fracción como se dice: un cuarto, un tercio. */
const part = L(
  (x: number) => ({ 2: 'la mitad', 3: 'un tercio', 4: 'un cuarto', 5: 'un quinto' })[Math.round(1 / x)] ?? `un ${Math.round(x * 100)} %`,
  (x: number) => ({ 2: 'half', 3: 'a third', 4: 'a quarter', 5: 'a fifth' })[Math.round(1 / x)] ?? `${Math.round(x * 100)} %`,
);
/** La primera letra en mayúscula: la fracción puede abrir la frase. */
const upper = (text: string) => text.replace(/^./, (c) => c.toUpperCase());
/** Un número de las que se suman, como porcentaje: 0.15 → «15 %». */
// (con espacio duro: en la tarjeta angosta, el «%» quedaba solo en el renglón de abajo)
const pct = L((x: number) => `${Math.round(x * 100)} %`, (x: number) => `${Math.round(x * 100)}%`);

export const TALENTS: Talent[] = [
  { id: 'stack', name: L('Poderes acumulados', 'Stacked Powers'), max: 1, text: () => L('Los poderes de los escenarios anteriores siguen viniendo', 'Powers from earlier stages keep coming') },
  { id: 'special', name: L('Ola especial', 'Special Wave'), max: 2,
    text: () => L('Una oleada es especial, y deja su marca en el resto de la partida', 'One wave is special, and leaves its mark on the rest of the run') },
  { id: 'support', name: L('Apoyos', 'Supports'), max: 2,
    text: () => L('En un escenario más vienen curanderos, inmunes o abanderados', 'Healers, warders or standard-bearers join one more stage') },
  { id: 'casters', name: L('Hechiceros', 'Sorcerers'), max: 2, adds: true,
    text: (add) => L(`Se suma un ${pct(add)} de hechiceros, que te tiran desde lejos. No van a la puerta: no hace falta matarlos para pasar de oleada`,
      `${upper(pct(add))} more sorcerers join, casting at you from afar. They don't go for the gate: you don't need to kill them to clear a wave`) },
  // (11/10, Leandro: decía cada poder, y era demasiado; el detalle está en el README y en DIFFICULTY)
  { id: 'powers', name: L('Poderes más duros', 'Tougher Powers'), max: 1, text: () => L('Los poderes de los enemigos son más fuertes', 'Enemy powers are stronger') },
  { id: 'speed', name: L('Más rápidos', 'Faster Enemies'), max: 3, adds: true,
    text: (add) => L(`Los enemigos caminan un ${pct(add)} más rápido`, `Enemies walk ${pct(add)} faster`) },
  { id: 'terrain', name: L('Terreno irregular', 'Rough Terrain'), max: 1, text: () => L('Se juega en campos con lomas', 'Played on hilly courses') },
  { id: 'powered', name: L('Más con poder', 'More Powered'), max: 1,
    text: () => upper(L(
      `${part(DIFFICULTY.share[1])} de los enemigos trae poder, en vez de ${part(DIFFICULTY.share[0])}`,
      `${part(DIFFICULTY.share[1])} of the enemies have a power, instead of ${part(DIFFICULTY.share[0])}`,
    )) },
  { id: 'escort', name: L('Escolta del jefe', 'Boss Escort'), max: 1, text: () => L('El jefe viene con enemigos con poderes', 'The boss brings powered-up enemies') },
  { id: 'rest', name: L('Sin respiro', 'No Breather'), max: 1, text: () => L('Menos descanso entre oleadas', 'Less rest between waves') },
  { id: 'cooldown', name: L('Recarga lenta', 'Slow Recharge'), max: 3, adds: true,
    text: (add) => L(`Tus habilidades tardan un ${pct(add)} más en recargar`, `Your abilities take ${pct(add)} longer to recharge`) },
  { id: 'fourth', name: L('Golpe 4', 'Hit 4'), max: 1,
    text: () => L('Tus tiros pueden llegar al golpe 4, pero los enemigos tienen más vida', 'Your shots can reach hit 4, but enemies have more HP') },
];
const BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<TalentId, Talent>;

/** El talento por su id. */
export function talent(id: TalentId): Talent {
  return BY_ID[id];
}

/** Una opción de un escalón: el talento y, en los que se suman, su número. */
export interface Option {
  id: TalentId;
  add?: number;
}
const opt = (id: TalentId, add?: number): Option => (add === undefined ? { id } : { id, add });

/**
 * La escalera (11/10, pedido de Leandro): los niveles de dificultad, en orden. En cada escalón se elige una
 * de sus opciones (las del mismo escalón no van juntas), y algunos traen una sola; de entrada está elegida
 * la del medio. Jugar en el nivel N es tener puestos los primeros N escalones. Antes eran 18 puntos para
 * poner donde uno quisiera: abrumaba, y se podía saltar de golpe a lo más duro.
 *
 * Las que se repiten traen su número, más alto cuanto más arriba en la escalera (Leandro: el segundo «Más
 * rápidos» no tiene por qué ser igual que el primero). Los números son para empezar: los ordenan las tandas
 * del bot (tools/bot-tanda.mjs) y se tocan en el panel B.
 */
export const LADDER: Option[][] = [
  // «Élites más duros» se fue el 12/10: la vida del élite ya no depende de la dificultad (ver ELITE.hp)
  [opt('rest'), opt('escort')],
  [opt('speed', 0.08)],
  [opt('special'), opt('cooldown', 0.35)],
  [opt('powered')],
  [opt('powers')],
  [opt('support'), opt('casters', 0.1)],
  [opt('terrain'), opt('speed', 0.12), opt('cooldown', 0.65)],
  [opt('special'), opt('support'), opt('casters', 0.15)],
  [opt('stack'), opt('speed', 0.15)],
  [opt('fourth')],
];

/** El nivel más alto: todos los escalones puestos. */
export const MAX_LEVEL = LADDER.length;

/** Lo de cada talento con que se juega: en los que se suman, la suma; en los demás, cuántas opciones. */
export type Picks = Partial<Record<TalentId, number>>;

/** Lo que se guarda. */
export interface Progress {
  /** Los escalones desbloqueados: se gana uno al ganar jugando en el más alto que se tiene. */
  unlocked: number;
  /** El nivel con que se juega: los primeros `level` escalones (hasta `unlocked`). */
  level: number;
  /** La opción elegida en cada escalón, también en los que no están puestos (se recuerda); -1, la de entrada. */
  choices: number[];
}

/** La opción de entrada de un escalón: la del medio (con dos, la de arriba). */
export function defaultChoice(i: number): number {
  return Math.floor((LADDER[i].length - 1) / 2);
}

/** La opción elegida en el escalón `i` (la de entrada, si no se eligió). */
export function choiceAt(p: Progress, i: number): number {
  const c = Math.floor(p.choices[i] ?? -1);
  return c >= 0 && c < LADDER[i].length ? c : defaultChoice(i);
}

/** Lo de cada talento que dan los escalones puestos: cada opción suma su número, o cuenta uno. */
export function picksOf(p: Progress): Picks {
  const picks: Picks = {};
  for (let i = 0; i < Math.min(p.level, MAX_LEVEL); i++) {
    const o = LADDER[i][choiceAt(p, i)];
    picks[o.id] = (picks[o.id] ?? 0) + (BY_ID[o.id].adds ? o.add ?? 0 : 1);
  }
  return picks;
}

/** El nombre de la opción `o` del escalón `i` y lo que hace: siempre lo mismo, se haya elegido lo que se haya elegido. */
export function optionText(i: number, o: number): { name: string; line: string } {
  const option = LADDER[i][o];
  const t = BY_ID[option.id];
  return { name: t.name, line: t.text(option.add ?? 0) };
}

/** Cuántas opciones de un talento cuentan (en los que no se suman), sin pasar de su máximo. */
export function levelOf(picks: Picks, id: TalentId): number {
  return Math.max(0, Math.min(BY_ID[id].max, Math.floor(picks[id] ?? 0)));
}

/** El número de `table` para este nivel (el último, si se pasa). */
const at = (table: number[], level: number) => table[Math.min(level, table.length - 1)];

/** Lo que la dificultad elegida cambia en la partida. */
export function rulesFor(picks: Picks): RunRules {
  const lv = (id: TalentId) => levelOf(picks, id);
  const sum = (id: TalentId) => Math.max(0, picks[id] ?? 0);
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
      timings: at(DIFFICULTY.timings, lv('powers')),
      phaseOpen: at(DIFFICULTY.phaseOpen, lv('powers')),
      full: at(DIFFICULTY.full, lv('powers')) > 0,
      ghostHp: at(DIFFICULTY.ghostHp, lv('powers')),
    },
    speed: DIFFICULTY.speedBase * (1 + sum('speed')),
    share: at(DIFFICULTY.share, lv('powered')),
    // la vida del élite es fija (12/10): ni «Élites más duros» ni el golpe 4 le suman
    eliteHp: [...ELITE.hp],
    escort: lv('escort') >= 1,
    rest: at(DIFFICULTY.rest, lv('rest')),
    fourth,
    extraHp: fourth ? DIFFICULTY.fourthHp : 0,
    bossHp: fourth ? DIFFICULTY.fourthBossHp : 0,
    cooldown: 1 + sum('cooldown'),
    casters: sum('casters'),
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
  const choices = LADDER.map((_, j) => Math.floor(p.choices[j] ?? -1));
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
/**
 * Cómo se guarda: 2 desde que las opciones son independientes (11/10). Lo elegido antes de eso (la primera
 * escalera, del mismo día) vuelve a las opciones de entrada: los escalones cambiaron.
 */
/**
 * El formato de lo guardado: 2, la escalera (11/10); 3, sin «Élites más duros» en el primer escalón
 * (12/10): la escolta pasó del 2 al 1, y el que tenía élites vuelve a la de entrada.
 */
const VERSION = 3;
/** Los puntos que había antes de la escalera (12 talentos, 18 puntos): para pasar lo guardado. */
const OLD_POINTS = 18;
/** Lo de entrada: nada desbloqueado, y en cada escalón la opción del medio. */
const fresh = (): Progress => ({ unlocked: 0, level: 0, choices: LADDER.map(() => -1) });

/**
 * Lo guardado antes de la escalera (puntos ganados y dónde estaban puestos): lo desbloqueado, en la misma
 * proporción, y en cada escalón la opción de un talento que se tenía puesto, si hay.
 */
function fromPoints(points: number, picks: Picks): Progress {
  const share = (n: number) => Math.max(0, Math.min(MAX_LEVEL, Math.round((n * MAX_LEVEL) / OLD_POINTS)));
  const usedOld = (Object.keys(picks) as TalentId[]).reduce((n, id) => n + (BY_ID[id] ? Math.max(0, Math.floor(picks[id] ?? 0)) : 0), 0);
  const left: Picks = { ...picks };
  const choices = LADDER.map((options) => {
    const o = options.findIndex((x) => (left[x.id] ?? 0) > 0);
    if (o < 0) return -1;
    left[options[o].id] = (left[options[o].id] ?? 0) - 1;
    return o;
  });
  const unlocked = share(points);
  return { unlocked, level: Math.min(unlocked, share(usedOld)), choices };
}

/** Lo guardado en este navegador, o empezar de cero. */
export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Progress> & { points?: number; picks?: Picks; v?: number };
    if (!Array.isArray(raw.choices)) return raw.points ? fromPoints(Math.floor(Number(raw.points) || 0), raw.picks ?? {}) : fresh();
    const unlocked = Math.max(0, Math.min(MAX_LEVEL, Math.floor(Number(raw.unlocked) || 0)));
    const p: Progress = { unlocked, level: Math.max(0, Math.min(unlocked, Math.floor(Number(raw.level) || 0))), choices: fresh().choices };
    const saved = raw.choices.map((c) => Math.floor(Number(c ?? -1)));
    // de la 2: en el primer escalón eran sin respiro (0), élites (1) y escolta (2)
    if (raw.v === 2) saved[0] = saved[0] === 0 ? 0 : saved[0] === 2 ? 1 : -1;
    if (raw.v === VERSION || raw.v === 2) p.choices = LADDER.map((options, i) => { const c = saved[i] ?? -1; return c >= 0 && c < options.length ? c : -1; });
    return p;
  } catch {
    return fresh();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...p }));
  } catch { /* sin localStorage: vale para esta partida nomás */ }
}

/**
 * Para las pruebas (?escalera=0,1,0 en la URL): el nivel 3, con la primera opción en el primer escalón, la
 * segunda en el segundo y la primera en el tercero (`-` o nada: la de entrada). Todo desbloqueado.
 */
export function ladderFrom(text: string): Progress {
  const parts = text.split(',').filter((s) => s.trim() !== '');
  const choices = LADDER.map((options, i) => {
    const c = Math.floor(Number(parts[i]));
    return Number.isFinite(c) && c >= 0 && c < options.length ? c : -1;
  });
  return { unlocked: MAX_LEVEL, level: Math.min(MAX_LEVEL, parts.length), choices };
}
