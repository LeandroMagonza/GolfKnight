// Análisis de daño por segundo (11/10, pedido de Leandro): cuánto te ocupa cada enemigo, con su vida y su
// velocidad, y lo mismo con cada poder. Lee los números del juego (src/core), así que sirve de nuevo
// cuando cambien.
//
//   node tools/dps.mjs [--tiros=37.9] [--pegan=0.82] [--golpes=35,42,16,7] [--alcance=55] [--velocidad=0.912]
//
// **La medida es la ocupación**: el tiempo que te lleva matarlo tirándole solo a él, sobre el tiempo que
// tarda en cruzar lo que alcanzan tus palos hasta la línea. 100 % es que no llegás aunque no le tires a
// nadie más; una oleada suma los de todos (ver la tabla de oleadas). Por defecto, el ritmo de Leandro en
// sus partidas del 11/10 en el nivel 10 (37.9 tiros por minuto, 82 % que pegan, y de los que pegan 35 %
// de golpe 1, 42 % de 2, 16 % de 3 y 7 % de 4) y la velocidad del nivel 10 por la escalera del medio
// (×0.76 × 1.20). Cada golpe pega su número (el hierro y el driver de cerca; el driver de lejos, uno más).
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const W = await server.ssrLoadModule('/src/core/waves.ts');
const F = await server.ssrLoadModule('/src/core/field.ts');
const D = await server.ssrLoadModule('/src/core/difficulty.ts');
await server.close();

const perMin = Number(opt('tiros', 37.9));
const connect = Number(opt('pegan', 0.82));
const mixRaw = opt('golpes', '35,42,16,7').split(',').map(Number);
const mix = mixRaw.map((p) => p / mixRaw.reduce((a, b) => a + b, 0));
const reach = Number(opt('alcance', 55));
const speedRule = Number(opt('velocidad', D.DIFFICULTY.speedBase * 1.2));
const gap = 60 / perMin;
const distance = Math.min(F.SPAWN_Z, F.TEE_LINE_Z + reach) - F.TEE_LINE_Z;

/** Lo que le entra de un golpe de cada nivel (1 a 4), con lo que le resta su defensa, en promedio. */
const perHit = (cut = (d) => d) => mix.reduce((sum, p, i) => sum + p * cut(i + 1), 0);
const plainHit = perHit();
const pct = (x) => (x >= 10 ? '**no llega**' : `${Math.round(x * 100)} %`);
const f1 = (x) => (Math.round(x * 10) / 10).toString();

/**
 * Lo que te ocupa uno: `hp` de vida, `speed` su velocidad (sin la de la dificultad), `hit` lo que le entra
 * por golpe que pega, `every` cada cuánto puede entrarle uno (el intocable, uno por ciclo), `heal` el ciclo
 * del que se cura (hay que matarlo adentro de uno).
 */
/**
 * El que se cura: la chance de matarlo adentro de un ciclo de `heal` s, tirándole todo lo que entra (uno
 * cada `gap`, el primero apenas se cura): cada tiro pega 0 si no le da, o lo de su golpe (`cut`).
 */
function killChance(hp, heal, cut = (d) => d) {
  const shots = Math.floor(heal / gap) + 1;
  let dist = new Map([[0, 1]]);
  for (let n = 0; n < shots; n++) {
    const next = new Map();
    for (const [sum, p] of dist) {
      next.set(sum, (next.get(sum) ?? 0) + p * (1 - connect));
      mix.forEach((q, i) => {
        const v = Math.min(hp, sum + cut(i + 1));
        next.set(v, (next.get(v) ?? 0) + p * connect * q);
      });
    }
    dist = next;
  }
  return { shots, chance: dist.get(hp) ?? 0 };
}

function load({ hp, speed, hit = plainHit, every = gap, heal = 0 }) {
  const time = distance / (speed * speedRule);
  const shots = hp / (connect * hit);
  const needed = shots * Math.max(gap, every);
  // el que se cura: los tiros tienen que entrar adentro de un ciclo (del primero al último, (n - 1) huecos)
  const burst = heal ? (Math.ceil(shots) - 1) * gap : 0;
  return { time, shots, needed, share: needed / time, fits: !heal || burst <= heal, burst };
}

const kinds = ['goblin', 'goblina', 'orc', 'skeleton', 'warchief', 'knight', 'stoneling'];
/**
 * Lo propuesto el 11/10 para los gigantes: la vida al doble pero sin pasar de +3 (en vez de +3 a todos: al
 * goblin de 1 lo quintuplicaba) y más lentos.
 */
const ALT = { hp: (hp) => hp + Math.min(hp, W.GIANTS.hp), speed: 0.7, name: 'vida al doble hasta +3' };
const E = W.ENEMIES;
const fourthHp = D.DIFFICULTY.fourthHp;
const out = [];
const line = (s = '') => out.push(s);

line(`Ritmo: ${perMin} tiros por minuto (uno cada ${f1(gap)} s), ${Math.round(connect * 100)} % que pegan, ${f1(plainHit)} de daño promedio por golpe que pega. Velocidad de la dificultad ×${speedRule.toFixed(2)}; se les tira desde ${distance} m de la línea.`);
line();
line('### Sin poderes: vida, metros por segundo y ocupación');
line();
line(`| Enemigo | Normal | Con golpe 4 | Gigante | Gigante con golpe 4 | Propuesta: gigante con ${ALT.name} y ${Math.round(ALT.speed * 100)} % de velocidad, con golpe 4 |`);
line('|---|---|---|---|---|---|');
for (const k of kinds) {
  const s = E[k];
  const cell = (hp, speed) => {
    const l = load({ hp, speed });
    return `${hp} · ${f1(speed * speedRule)} m/s · ${pct(l.share)}`;
  };
  const gs = s.speed * W.GIANTS.speed;
  line(`| ${s.name} | ${cell(s.hp, s.speed)} | ${cell(s.hp + fourthHp, s.speed)} | ${cell(s.hp + W.GIANTS.hp, gs)} | ${cell(s.hp + W.GIANTS.hp + fourthHp, gs)} | ${cell(ALT.hp(s.hp) + fourthHp, s.speed * ALT.speed)} |`);
}
line();

// las oleadas: la segunda de cada escenario, normal o de gigantes (los mismos cuerpos, el 60 %, más espaciados)
line('### La segunda oleada de cada escenario: normal o de gigantes');
line();
line('Lo que te ocupa toda la oleada (la suma de lo que te lleva cada uno) sobre lo que dura (desde que sale el primero hasta que el último llega a la línea).');
line();
line('| Escenario | Normal | De gigantes | Normal con golpe 4 | Gigantes con golpe 4 | Propuesta, con golpe 4 |');
line('|---|---|---|---|---|---|');
const usual = [
  { interval: 2.05, counts: [6, 5, 3, 2], more: [], heavy: 'warchief' },
  { interval: 1.9, counts: [6, 5, 3, 2], more: [['warchief', 2]], heavy: 'knight' },
  { interval: 1.9, counts: [5, 4, 3, 2], more: [['warchief', 1], ['knight', 1]], heavy: 'stoneling' },
];
usual.forEach((u, i) => {
  const wave = (giants, fourth, alt = false) => {
    const few = (n) => (giants ? (n > 0 ? Math.max(1, Math.round(n * W.GIANTS.count)) : 0) : n);
    const list = [];
    ['goblin', 'goblina', 'orc', 'skeleton'].forEach((k, j) => { for (let n = few(u.counts[j]); n > 0; n--) list.push(k); });
    for (const [k, n] of u.more) for (let m = few(n); m > 0; m--) list.push(k);
    for (let n = 0; n < 3; n++) list.push(u.heavy);
    const interval = u.interval * (giants ? W.GIANTS.interval : 1);
    let needed = 0;
    let longest = 0;
    for (const k of list) {
      const hp = (alt ? ALT.hp(E[k].hp) : E[k].hp + (giants ? W.GIANTS.hp : 0)) + (fourth ? fourthHp : 0);
      const l = load({ hp, speed: E[k].speed * (alt ? ALT.speed : giants ? W.GIANTS.speed : 1) });
      needed += l.needed;
      longest = Math.max(longest, l.time);
    }
    const lasts = (list.length - 1) * interval + longest;
    return `${list.length} enemigos · ${pct(needed / lasts)}`;
  };
  line(`| ${i + 1} | ${wave(false, false)} | ${wave(true, false)} | ${wave(false, true)} | ${wave(true, true)} | ${wave(true, true, true)} |`);
});
line();

// los poderes, en tres cuerpos
line('### Los poderes: cuánto más te ocupa el mismo enemigo');
line();
line('Con el golpe 4 (+1 de vida). El escudo, tirándole de frente (de costado o por arriba, con el globo, no resta). El bendito y el escurridizo: cada golpe que entra pide antes un tiro que le rompa la burbuja o lo haga saltar. El intocable: le entra uno por ciclo. El que se cura: hay que meterle todo adentro de un ciclo.');
line();
const bodies = ['goblina', 'orc', 'skeleton', 'knight'];
line(`| Poder | ${bodies.map((k) => E[k].name).join(' | ')} |`);
line(`|---|${bodies.map(() => '---').join('|')}|`);
const H = W.HARDEST_POWERS;
const powers = [
  ['Sin poder', () => ({})],
  ['Escudo 1 (de frente)', () => ({ hit: perHit((d) => Math.max(0, d - 1)) })],
  ['Escudo 2 (de frente)', () => ({ hit: perHit((d) => Math.max(0, d - 2)) })],
  ['Escudo 3 (de frente)', () => ({ hit: perHit((d) => Math.max(0, d - 3)) })],
  ['Blindaje 1', () => ({ hit: perHit((d) => Math.max(0, d - 1)) })],
  ['Blindaje 2', () => ({ hit: perHit((d) => Math.max(0, d - 2)) })],
  ['Blindaje 2, con el driver de lejos o el putter de cerca (pegan 1 más)', () => ({ hit: perHit((d) => Math.max(0, d + 1 - 2)) })],
  ['Fantasma', () => ({ hp: H.ghostHp, hit: perHit((d) => Math.min(d, 1)) })],
  ['Bendito', () => ({ hit: plainHit / 2 })],
  ['Escurridizo', () => ({ hit: plainHit / 2 })],
  ['Intocable (3 tiempos)', () => ({ every: W.PHASE.cycle })],
  ['Intocable (2 tiempos, sin el punto)', () => ({ every: W.PHASE.cycle })],
  ['Se cura', (k) => ({ hp: W.REGEN.hp, heal: W.regenPeriod(E[k].hp + fourthHp + W.REGEN.hp, W.REGEN.margin) })],
];
for (const [name, make] of powers) {
  const cells = bodies.map((k) => {
    const extra = make(k);
    const hp = E[k].hp + fourthHp + (extra.hp ?? 0);
    const base = load({ hp: E[k].hp + fourthHp, speed: E[k].speed });
    const l = load({ ...extra, hp, speed: E[k].speed });
    const times = l.needed / base.needed;
    if (extra.heal) {
      const k = killChance(hp, extra.heal);
      return `${hp} de vida, ciclo de ${f1(extra.heal)} s (${k.shots} tiros): lo matás en el **${Math.round(k.chance * 100)} %** de los ciclos`;
    }
    return `${pct(l.share)} · ×${f1(times)}`;
  });
  line(`| ${name} | ${cells.join(' | ')} |`);
}
console.log(out.join('\n'));
