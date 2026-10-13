// Sorteo de oleadas (12/10, pedido de Leandro): arma la misma partida muchas veces (`--veces`) y mide cuánto
// varía cada oleada entre una y otra: cuántos enemigos, cuánta vida, y cuántos tiros te pide (la vida de
// cada uno, multiplicada por lo que le hace su poder, sobre lo que le saca un golpe que pega). Lee los
// números del juego (src/core), así que sirve de nuevo cuando cambien. Es la base para armar las oleadas
// con un presupuesto.
//
//   node tools/sorteo.mjs [--veces=1000] [--talentos=rest:1,speed:0.2,...] [--poderes=divine,ethereal,armor]
//                         [--especiales=giants,,] [--tiros=37.1] [--pegan=0.87] [--golpes=33,34,20,13]
//
// Los poderes, **jugados bien** (lo que pide el poder si se le tira como se debe):
// - escudo: por arriba o de costado, no resta (de frente resta su nivel a cada golpe);
// - blindaje: con el driver de lejos o el putter de cerca, que pegan 1 más (le resta su nivel igual);
// - fantasma: cada golpe le saca 1;
// - bendito y escurridizo: cada golpe que entra pide antes otro tiro (romper la burbuja, hacerlo saltar);
// - intocable: le entra uno por ciclo;
// - se cura: hay que matarlo adentro de un ciclo; los que no, se tiran de nuevo.
// Por defecto, el ritmo de Leandro en sus partidas del nivel 10 del 11 y 12/10, con su carga nueva (37.1
// tiros por minuto, 87 % que pegan, golpes 1 a 4: 33, 34, 20 y 13 %), y sus talentos del nivel 10.
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const W = await server.ssrLoadModule('/src/core/waves.ts');
const D = await server.ssrLoadModule('/src/core/difficulty.ts');

const B = await server.ssrLoadModule('/src/core/budget.ts');
await server.close();

const times = Number(opt('veces', 1000));
// el jugador de referencia: el del presupuesto (core/budget), o el que se pida
const { BUDGET } = B;
if (args.some((a) => a.startsWith('--tiros='))) BUDGET.perMin = Number(opt('tiros', BUDGET.perMin));
if (args.some((a) => a.startsWith('--pegan='))) BUDGET.connect = Number(opt('pegan', BUDGET.connect));
if (args.some((a) => a.startsWith('--golpes='))) BUDGET.mix = opt('golpes', '').split(',').map(Number);
// --sin-presupuesto: el reparto de antes (para comparar)
if (args.includes('--sin-presupuesto')) BUDGET.on = 0;
const { perMin, connect } = BUDGET;
const gap = 60 / perMin;
const picksText = opt('talentos', 'rest:1,speed:0.2,stack:1,fourth:1,powers:1,powered:1,special:1,support:2');
const picks = Object.fromEntries(picksText.split(',').filter(Boolean).map((p) => p.split(':')).map(([k, v]) => [k, Number(v)]));
const rules = { ...D.rulesFor(picks) };
const order = opt('poderes', '').split(',').filter(Boolean);
if (order.length >= 3) rules.order = order;
if (args.some((a) => a.startsWith('--especiales='))) rules.specialAt = opt('especiales', '').split(',').map((m) => (m === 'ninguna' ? null : m || undefined));

const { perHit, killChance } = B;
const plainHit = perHit();

/** La vida de uno: la de su cuerpo y lo que le sumaron (el jefe, la del golpe 4 también). */
const hpOf = (s) => W.ENEMIES[s.kind].hp + (s.mods?.hp ?? 0);

/**
 * Cuántos tiros te pide uno, con el modelo del presupuesto (core/budget: jugado bien, y los chicos menos).
 * `plain`, los que pediría el mismo con su vida y sin poder.
 */
function shotsOf(s) {
  const hp = hpOf(s);
  return { shots: B.shotsFor(s.kind, s.mods, hp), plain: B.shotsFor(s.kind, s.mods ? { hp: s.mods.hp, size: s.mods.size } : undefined, hp) };
}

const POWER_KEYS = ['shield', 'armor', 'ethereal', 'divine', 'dodge', 'regen', 'phase'];
const powerOf = (s) => POWER_KEYS.find((p) => s.mods?.[p]);
const quantile = (xs, q) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const f0 = (x) => String(Math.round(x));

// las oleadas, `times` veces
const stats = [];
for (let t = 0; t < times; t++) {
  const run = W.buildRun(Math.random, rules);
  run.waves.forEach((wave, i) => {
    const order = W.spawnOrder(wave, Math.random);
    const st = (stats[i] ??= { title: new Set(), count: [], hp: [], shots: [], powerShots: [], biggest: [], ghosts: [], powered: [], focus: new Set() });
    st.title.add(wave.title);
    if (wave.focus) st.focus.add(wave.focus);
    let hp = 0;
    let shots = 0;
    let extra = 0;
    let biggest = 0;
    let powered = 0;
    for (const s of order) {
      const h = hpOf(s);
      const { shots: n, plain } = shotsOf(s);
      hp += h;
      shots += n;
      extra += n - plain;
      const elite = !!s.mods?.size;
      if (!elite && !W.ENEMIES[s.kind].boss) {
        if (powerOf(s)) {
          powered++;
          biggest = Math.max(biggest, n);
        }
        if (s.mods?.ethereal) st.ghosts.push(h);
      }
    }
    st.count.push(order.length);
    st.hp.push(hp);
    st.shots.push(shots);
    st.powerShots.push(extra);
    st.biggest.push(biggest);
    st.powered.push(powered);
  });
}

const out = [];
const line = (s = '') => out.push(s);
line(`${BUDGET.on ? 'Con el presupuesto' : 'Sin el presupuesto (el reparto de antes)'} · talentos: ${picksText}${order.length >= 3 ? ` · poderes: ${order.join(', ')}` : ' · poderes al azar'}${rules.specialAt ? ` · especiales: ${opt('especiales', '')}` : ''} · ${times} sorteos.`);
line(`Ritmo: ${perMin} tiros por minuto, ${Math.round(connect * 100)} % que pegan, ${plainHit.toFixed(2)} de daño por golpe que pega.`);
line();
line('| Oleada | Enemigos | Vida total | Tiros que pide (de 5 % a 95 %) | De esos, por los poderes | Con poder | El común con poder más caro (tiros) |');
line('|---|---|---|---|---|---|---|');
stats.forEach((st, i) => {
  const range = (xs) => `${f0(quantile(xs, 0.05))} · **${f0(quantile(xs, 0.5))}** · ${f0(quantile(xs, 0.95))}`;
  const name = st.title.size === 1 ? [...st.title][0] : `${st.title.size} distintas`;
  line(`| ${i + 1} (${name}) | ${range(st.count)} | ${range(st.hp)} | ${range(st.shots)} | ${range(st.powerShots)} | ${range(st.powered)} | ${range(st.biggest)} |`);
});
line();

// los fantasmas comunes: qué vida traen, en las oleadas donde son el poder del escenario
const ghostWaves = stats.map((st, i) => ({ st, i })).filter(({ st }) => st.ghosts.length >= times / 2);
if (ghostWaves.length) {
  line('**Los fantasmas comunes: cuánta vida traen** (cuántos de cada 100, por oleada; cada golpe les saca 1)');
  line();
  const top = Math.max(...ghostWaves.flatMap(({ st }) => st.ghosts));
  const levels = Array.from({ length: top }, (_, k) => k + 1).filter((h) => ghostWaves.some(({ st }) => st.ghosts.includes(h)));
  line(`| Oleada | Por oleada | ${levels.map((h) => `${h}`).join(' | ')} |`);
  line(`|---|---|${levels.map(() => '---').join('|')}|`);
  for (const { st, i } of ghostWaves) {
    const n = st.ghosts.length;
    line(`| ${i + 1} | ${(n / times).toFixed(1)} | ${levels.map((h) => { const c = st.ghosts.filter((x) => x === h).length; return c ? `${Math.round((100 * c) / n)}` : '·'; }).join(' | ')} |`);
  }
  line();
}

// por cuánto multiplica cada poder lo que pide el mismo enemigo
line('**Cada poder: por cuánto multiplica los tiros que pide el mismo enemigo** (jugado bien; entre paréntesis, de frente o sin la vuelta)');
line();
const H = rules.hard;
const rows = [
  ['Escudo 1 / 2 / 3', '×1', `(de frente ×${(plainHit / perHit((d) => Math.max(0, d - 1))).toFixed(1)} / ×${(plainHit / perHit((d) => Math.max(0, d - 2))).toFixed(1)} / ×${(plainHit / perHit((d) => Math.max(0, d - 3))).toFixed(0)})`],
  ['Blindaje 1 / 2', `×${(plainHit / perHit((d) => Math.max(0, d))).toFixed(1)} / ×${(plainHit / perHit((d) => Math.max(0, d - 1))).toFixed(1)}`, `(con el hierro o el wedge ×${(plainHit / perHit((d) => Math.max(0, d - 1))).toFixed(1)} / ×${(plainHit / perHit((d) => Math.max(0, d - 2))).toFixed(1)}), y trae ${W.ARMOR_HP[1]} / ${(W.ARMOR_HP[2]).toFixed(2)} de la vida`],
  ['Fantasma', `×${(plainHit / perHit((d) => Math.min(d, 1))).toFixed(1)}`, `y con «Poderes más duros» +${H.ghostHp} de vida`],
  ['Bendito / escurridizo', '×2', ''],
  ['Intocable', `×${Math.max(1, W.PHASE.cycle / gap).toFixed(1)}`, '(en tiempo: le entra uno por ciclo)'],
];
for (const hp of [4, 6, 9]) {
  const k = killChance(hp, W.regenPeriod(hp, W.REGEN.margin * H.regen));
  const base = hp / (connect * plainHit);
  rows.push([`Se cura, con ${hp} de vida`, `×${((k.chance > 0 ? (1 / k.chance - 1) * k.shots + base : base * 10) / base).toFixed(1)}`, `(lo matás en el ${Math.round(k.chance * 100)} % de los ciclos de ${W.regenPeriod(hp, W.REGEN.margin * H.regen).toFixed(1)} s), y trae +${W.REGEN.hp} de vida`]);
}
line('| Poder | Multiplica | |');
line('|---|---|---|');
for (const [a, b, c] of rows) line(`| ${a} | ${b} | ${c} |`);
console.log(out.join('\n'));
