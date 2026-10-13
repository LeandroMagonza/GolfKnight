/**
 * El presupuesto de las oleadas (13/10, pedido de Leandro: «armar más como un budget, donde no te salgan 3
 * caballeros con poder»). La medida es **cuántos tiros te pide** cada enemigo: su vida, multiplicada por lo
 * que le hace su poder, sobre lo que le saca un golpe que pega (ver docs/presupuesto.md). La usan el
 * reparto de poderes de las oleadas (core/waves, `spawnOrder`) y el sorteo (tools/sorteo.mjs).
 *
 * Los poderes, **jugados bien** (lo que pide el poder si se le tira como se debe):
 * - escudo: por arriba o de costado, no resta;
 * - blindaje: con el driver de lejos o el putter de cerca, que pegan 1 más (le resta su nivel igual);
 * - fantasma: cada golpe le saca 1;
 * - bendito y escurridizo: cada golpe que entra pide antes otro tiro (romper la burbuja, hacerlo saltar);
 * - intocable: le entra uno por ciclo (cuenta lo que se espera);
 * - se cura: hay que matarlo adentro de un ciclo; los ciclos que no alcanzan se tiran enteros.
 */
import { ENEMIES, PHASE, regenPeriod, type EnemyKind, type EnemyMods } from './waves';

/**
 * Los números del presupuesto. El jugador de referencia es Leandro en el nivel 10 (11 y 12/10, con su carga
 * nueva): `perMin` tiros por minuto, `connect` los que pegan, y `mix` los golpes 1 a 4 de los que pegan.
 * - `small`: lo que pide uno de 1 y de 2 de vida, sobre la cuenta (los chicos caen de paso, con el driver
 *   que atraviesa a varios; a medir con el registro de cada cuerpo, ver KindLog).
 * - `cap`: los tiros que puede pedir un común con poder. El poder no cae en uno que se pase (el chamán
 *   fantasma de 8, el orco gigante que se cura de 9), ni la marca de los gigantes agranda a uno con poder
 *   si se pasa.
 * - `powers`: lo que pueden sumar los poderes de una oleada (el del élite también), sobre lo que piden sus
 *   cuerpos sin poder, por la parte que sale con poder (`share`): con 1 y un tercio con poder, un tercio
 *   más. El que presenta el poder sale siempre.
 * - `marks`: lo que puede sumar cada marca de las olas especiales (los chicos de la estampida, los
 *   gigantes, los de los poderes que no salieron), sobre lo que piden los cuerpos de la oleada.
 * - `regen`: el que se cura pide a lo sumo esto por lo que pediría sin curarse. La cuenta de los ciclos
 *   sale con los golpes de siempre, pero contra él se carga más: Leandro mató al élite que se cura (18 de
 *   vida) en 5 a 10 golpes, y la cuenta le daba 39 tiros.
 * - `on`: 0 lo apaga (el reparto de antes, para comparar con ?ajuste=presupuesto.on:0).
 */
export const BUDGET = { on: 1, perMin: 37.1, connect: 0.87, mix: [0.33, 0.34, 0.2, 0.13], small: [0.6, 0.8], cap: 7, powers: 1, marks: 0.1, regen: 2 };

/**
 * Lo que cuenta de más cada poder, sobre lo que dice la cuenta (13/10, Leandro: «tendrían que dar todos los
 * poderes alrededor de lo mismo»): con menos de 1 sale más barato y vienen más (o más grandes); con más,
 * menos. Solo los comunes: el élite paga lo que pide de verdad. Las tandas del bot que juega como Leandro,
 * en el nivel 10 (20 partidas por poder):
 * - bendito: con 1, 30 %; con 1.4, 45 % (los comunes eran los que más puerta sacaban);
 * - fantasma: con 0.6, 20 %; con 1, 30 %; con 1.4, 28 %. Lo que más pierde es el élite fantasma, que el
 *   peso no toca, y en las partidas de Leandro los comunes fantasma son los que más se le pasan;
 * - blindaje y escurridizo: con 1, 70 y 65 %; con 0.7, 78 y 67 % (el blindaje bien jugado casi no suma, así
 *   que el peso casi no lo mueve).
 */
export const POWER_WEIGHT: Record<string, number> = { shield: 1, armor: 1, ethereal: 1, divine: 1.4, dodge: 1, regen: 1, phase: 1 };

/** Lo que le entra de un golpe que pega, en promedio, con lo que le resta su defensa (`cut`). */
export function perHit(cut: (d: number) => number = (d) => d): number {
  const total = BUDGET.mix.reduce((a, b) => a + b, 0);
  return BUDGET.mix.reduce((sum, p, i) => sum + (p / total) * cut(i + 1), 0);
}

/** La chance de matar en un ciclo de `heal` s a uno de `hp`, con los tiros que entran (uno cada tanto). */
export function killChance(hp: number, heal: number): { shots: number; chance: number } {
  const gap = 60 / BUDGET.perMin;
  const shots = Math.floor(heal / gap) + 1;
  const total = BUDGET.mix.reduce((a, b) => a + b, 0);
  let dist = new Map<number, number>([[0, 1]]);
  for (let n = 0; n < shots; n++) {
    const next = new Map<number, number>();
    for (const [sum, p] of dist) {
      next.set(sum, (next.get(sum) ?? 0) + p * (1 - BUDGET.connect));
      BUDGET.mix.forEach((q, i) => {
        const v = Math.min(hp, sum + i + 1);
        next.set(v, (next.get(v) ?? 0) + (p * BUDGET.connect * q) / total);
      });
    }
    dist = next;
  }
  return { shots, chance: dist.get(hp) ?? 0 };
}

/**
 * Cuántos tiros te pide uno de `kind` con `mods` y `hp` de vida (toda: la del cuerpo y la que le sumaron),
 * jugado bien (ver arriba). Los chicos, menos (`BUDGET.small`).
 */
export function shotsFor(kind: EnemyKind, mods: EnemyMods | undefined, hp: number): number {
  const m = mods ?? {};
  // lo que el poder suma, por su peso (ver POWER_WEIGHT). Al élite no: paga lo que pide de verdad
  const power = m.size ? undefined : Object.keys(POWER_WEIGHT).find((p) => m[p as keyof EnemyMods]);
  const weight = power ? POWER_WEIGHT[power] : 1;
  const raw = rawShots(kind, m, hp);
  if (weight === 1) return raw;
  const plain = rawShots(kind, { hp: m.hp, size: m.size }, hp);
  return plain + (raw - plain) * weight;
}

/** Lo de `shotsFor`, sin el peso de cada poder. */
function rawShots(kind: EnemyKind, m: EnemyMods, hp: number): number {
  let hit = perHit();
  let slow = 1;
  if (m.armor) hit = perHit((d) => Math.max(0, d + 1 - m.armor!));
  if (m.ethereal) hit = Math.min(hit, perHit((d) => Math.min(d, 1)));
  if (m.divine || m.dodge) hit /= 2;
  if (m.phase) slow = Math.max(1, PHASE.cycle / (60 / BUDGET.perMin));
  let shots = (hp / (BUDGET.connect * Math.max(hit, 0.05))) * slow;
  if (m.regen) {
    const k = killChance(hp, regenPeriod(hp, m.regen));
    // los ciclos que no alcanzan se tiran enteros; el que alcanza, lo de siempre (y a lo sumo `BUDGET.regen`)
    const plain = shots;
    shots = Math.min(plain * BUDGET.regen, k.chance > 0 ? (1 / k.chance - 1) * k.shots + plain : Infinity);
  }
  const small = hp >= 1 && hp <= BUDGET.small.length ? BUDGET.small[hp - 1] : 1;
  return shots * (ENEMIES[kind].boss ? 1 : small);
}
