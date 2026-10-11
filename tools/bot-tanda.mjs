// Tandas del bot (11/10, pedido de Leandro): muchas partidas seguidas, en distintas dificultades, para medir
// cuánto pesa cada cosa y si hay combinaciones que se disparan. Juegan sin dibujar (?liviano en la URL: lo
// que más cuesta de una partida es dibujarla) y con la prioridad baja, así la compu se sigue usando.
//
//   node tools/bot-tanda.mjs [opciones] [dificultad ...]
//
// Cada dificultad es lo que va en ?talentos= (ver `talentos` en src/main.ts): «base» es sin nada, y si no,
// los talentos (en los que se suman, la suma; en los demás, cuántas opciones), como `speed:0.25,powers:1`. Con `escalera:` adelante, las opciones elegidas en
// cada escalón (`escalera:0,1,0` es el nivel 3). Sin ninguna, juega en «base».
//   --juegos=N       partidas por dificultad y nivel del bot (3)
//   --paralelo=K     cuántas a la vez (2)
//   --velocidad=V    a qué velocidad juegan (4; 1 es tiempo real). Lo medido el 11/10, en la compu de
//                    Leandro: una partida usa un 20 % de un núcleo a 1×, un 30 % a 4× y un 60 % a 12× (a 12×
//                    una partida entera son menos de 2 minutos). Con la compu en uso, las de por defecto;
//                    para dejarla corriendo, algo como --paralelo=6 --velocidad=12
//   --nivel=a,b      con qué niveles del bot (ver BOT_SKILLS en src/bot.ts; «humano» por defecto)
//   --prioridad=normal   sin esto va con prioridad baja: Windows le da el procesador a lo demás primero
//   --url=a&b        más cosas para la URL (por ejemplo sinhabilidades, o campo=2)
//   --salida=x.jsonl dónde anota cada partida (logs/tandas/<fecha>.jsonl)
//   --vivo           sobre el código de ahora (sin esto compila una copia y juega sobre ella: se puede seguir
//                    cambiando el código mientras corre)
//
// Anota cada partida apenas termina (una línea de JSON), y al final un resumen por dificultad: cuántas
// ganó, hasta qué oleada llegó, cuánta puerta y vida perdió.
import { build, createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { appendFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';

const args = process.argv.slice(2);
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const games = Number(opt('juegos', 3));
const parallel = Math.max(1, Number(opt('paralelo', 2)));
const speed = Number(opt('velocidad', 4));
const skills = opt('nivel', 'humano').split(',');
const extra = opt('url', '');
const configs = args.filter((a) => !a.startsWith('--'));
if (!configs.length) configs.push('base');
mkdirSync('logs/tandas', { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
const out = opt('salida', `logs/tandas/${stamp}.jsonl`);

// Prioridad baja: el navegador que se abre después la hereda (en Windows, los procesos hijos de uno con
// prioridad baja nacen con la misma)
if (opt('prioridad', 'baja') !== 'normal') {
  try {
    os.setPriority(0, os.constants.priority.PRIORITY_LOW);
  } catch (e) {
    console.log('no pude bajar la prioridad:', e.message);
  }
}

// Juegan sobre una copia compilada del juego, no sobre el código vivo: así se puede seguir trabajando
// mientras corre (con el servidor de desarrollo, cada archivo que se guardaba les cambiaba el juego en el
// medio de la tanda). Con --vivo, el código de ahora mismo, sin compilar
let server;
if (args.includes('--vivo')) {
  server = await createServer({ root: process.cwd(), server: { port: 5207, strictPort: true }, logLevel: 'error' });
  await server.listen();
} else {
  const outDir = `logs/tanda-build/${stamp}`;
  process.env.GK_OUT = outDir;
  process.env.GK_EDITION = 'full';
  await build({ root: process.cwd(), logLevel: 'error', build: { outDir, emptyOutDir: true } });
  server = await preview({ root: process.cwd(), logLevel: 'error', build: { outDir }, preview: { port: 5207, strictPort: true } });
  console.log(`compilado en ${outDir}`);
}
// render por software (sin la placa de video): no dibuja, y así no le compite a la pantalla de quien usa la compu
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });

/** Las partidas por jugar: cada dificultad con cada nivel, `games` veces, intercaladas. */
const jobs = [];
for (let i = 0; i < games; i++) for (const config of configs) for (const skill of skills) jobs.push({ config, skill, n: i + 1 });
const total = jobs.length;
const results = [];
const t0 = Date.now();
/** Cuánto puede durar una partida de verdad (una partida entera son unos 20 minutos de juego). */
const maxMs = (35 * 60000) / speed;

function urlFor({ config, skill }) {
  const q = [`bot=${skill}`, 'liviano', `velocidad=${speed}`, 'sincine'];
  if (config.startsWith('escalera:')) q.push(`escalera=${config.slice('escalera:'.length)}`);
  else q.push(`talentos=${config === 'base' ? '' : config}`);
  if (extra) q.push(extra);
  return `http://localhost:5207/?${q.join('&')}`;
}

async function play(job) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => sessionStorage.setItem('gk.introSeen', '1'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push((e.stack || e.message).split('\n').slice(0, 2).join(' | ')));
  const started = Date.now();
  let r = null;
  try {
    await page.goto(urlFor(job));
    await page.waitForFunction(() => document.getElementById('overlay').hidden && window.__bot && window.__gk.started, null, { timeout: 180000 });
    while (Date.now() - started < maxMs) {
      await page.waitForTimeout(3000);
      r = await page.evaluate(() => {
        const g = window.__gk;
        const b = window.__bot;
        const log = g.runLog;
        return {
          ended: g.ended, wave: g.director.index + 1, waves: g.director.waveCount, gate: g.gateHp, hp: g.player.hp, maxHp: g.player.maxHp,
          kills: g.kills, shots: g.shots, clock: Math.round(g.clock), level: g.difficultyLevel, hit: b.hit, miss: b.miss, casts: Object.values(b.casts).reduce((a, n) => a + n, 0),
          hurt: log ? log.waves.reduce((n, w) => n + w.hurt, 0) : null, gateLost: log ? log.waves.reduce((n, w) => n + w.gate, 0) : null,
          by: log ? log.waves.reduce((all, w) => { for (const [k, v] of Object.entries(w.by)) all[k] = (all[k] ?? 0) + v; return all; }, {}) : null,
          cause: g.endCause ?? null,
          // como «Copiar mis números»: con qué golpe salió cada tiro (del 1 al 4)
          q: log ? log.waves.reduce((all, w) => all.map((n, i) => n + (w.q?.[i] ?? 0)), [0, 0, 0, 0]) : null,
          abilities: log ? log.waves.reduce((n, w) => n + w.abilities, 0) : null,
          // a cuántos ms del tope de la barra soltó cada tiro (como en «Copiar mis números»)
          offs: log?.offs ?? null,
          // bajas de más de un mismo tiro, y de los que pegaron, a cuántos tocó (1, 2, 3, 4 o más)
          extra: log ? log.waves.reduce((n, w) => n + w.extra, 0) : null,
          multi: log ? log.waves.reduce((all, w) => all.map((n, i) => n + (w.multi?.[i] ?? 0)), [0, 0, 0, 0]) : null,
        };
      });
      if (r.ended) break;
    }
  } catch (e) {
    errors.push(`tanda: ${e.message.split('\n')[0]}`);
  }
  await ctx.close().catch(() => {});
  const row = { ...job, url: urlFor(job), result: r?.ended ?? (r ? 'tiempo' : 'error'), realSeconds: Math.round((Date.now() - started) / 1000), ...r, errors };
  delete row.ended;
  appendFileSync(out, `${JSON.stringify(row)}\n`);
  results.push(row);
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`${String(results.length).padStart(3)}/${total} ${mins} min · ${job.config} · ${job.skill} #${job.n}: ${row.result} en la oleada ${row.wave ?? '?'}/${row.waves ?? '?'} · puerta ${row.gate ?? '?'} · vida ${row.hp ?? '?'} · ${row.realSeconds} s${errors.length ? ` · ERRORES: ${errors[0]}` : ''}`);
}

console.log(`${total} partidas, de a ${parallel}, a velocidad ${speed} → ${out}`);
const queue = [...jobs];
await Promise.all(Array.from({ length: Math.min(parallel, total) }, async () => {
  while (queue.length) await play(queue.shift());
}));

// el resumen: por dificultad y nivel del bot
const groups = new Map();
for (const r of results) {
  const k = `${r.config} · ${r.skill}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const avg = (list, f) => (list.length ? list.reduce((n, r) => n + (f(r) ?? 0), 0) / list.length : 0);
console.log('\ndificultad · nivel: ganó / jugó · oleada promedio · puerta perdida · vida perdida · tiros que pegan · tiros por minuto · golpes 1-2-3-4 · soltando: antes del fuerte, en el fuerte, pasado (y el desvío cerca del tope) · bajas por tiro · bajas de más cada 100 tiros · de los que pegan, a varios');
for (const [k, list] of groups) {
  const won = list.filter((r) => r.result === 'victory').length;
  const q = [0, 1, 2, 3].map((i) => list.reduce((n, r) => n + (r.q?.[i] ?? 0), 0));
  const graded = q.reduce((a, b) => a + b, 0) || 1;
  const minutes = list.reduce((n, r) => n + (r.clock ?? 0), 0) / 60 || 1;
  const shots = list.reduce((n, r) => n + (r.shots ?? 0), 0);
  const offs = list.flatMap((r) => r.offs ?? []);
  const kills = list.reduce((n, r) => n + (r.kills ?? 0), 0);
  const extra = list.reduce((n, r) => n + (r.extra ?? 0), 0);
  const multi = [0, 1, 2, 3].map((i) => list.reduce((n, r) => n + (r.multi?.[i] ?? 0), 0));
  const hitMulti = multi.reduce((a, b) => a + b, 0);
  const share = (f) => Math.round((100 * offs.filter(f).length) / Math.max(1, offs.length));
  const near = offs.filter((o) => Math.abs(o) <= 250);
  const mean = near.reduce((a, b) => a + b, 0) / Math.max(1, near.length);
  const sd = Math.sqrt(near.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, near.length - 1));
  console.log(`${k}: ${won}/${list.length} · oleada ${avg(list, (r) => r.wave).toFixed(1)} · puerta −${avg(list, (r) => r.gateLost).toFixed(1)} · vida −${avg(list, (r) => r.hurt).toFixed(1)} · ${Math.round(100 * avg(list, (r) => r.hit / Math.max(1, r.hit + r.miss)))} % · ${(shots / minutes).toFixed(1)}/min · ${q.map((n) => Math.round((100 * n) / graded)).join('-')} % · soltando ${share((o) => o < -30)}-${share((o) => Math.abs(o) <= 30)}-${share((o) => o > 30)} % (±${Math.round(sd)} ms) · ${(kills / Math.max(1, shots)).toFixed(2)} · ${((100 * extra) / Math.max(1, shots)).toFixed(1)} · ${Math.round((100 * (hitMulti - multi[0])) / Math.max(1, hitMulti))} %`);
}
console.log(`\n${((Date.now() - t0) / 60000).toFixed(1)} minutos · ${out}`);
await browser.close();
await (server.close ? server.close() : server.httpServer?.close());
