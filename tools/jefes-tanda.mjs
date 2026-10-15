// El bot contra cada jefe (15/10): arranca en la última oleada con cada versión de los jefes nuevos (ver
// src/game/bosses y docs/jefes.md), la juega sin dibujar y a velocidad, y anota cómo terminó: si ganó, cuánto
// duró la pelea, cuánta puerta y vida perdió, los números del jefe y los errores de la página.
//
//   node tools/lock.mjs navegador -- node tools/jefes-tanda.mjs [jefes...] [opciones]
//
//   jefes          ids (golem.crece) o familias (golem); sin ninguno, todos
//   --juegos=N     partidas por versión (1)
//   --paralelo=K   cuántas a la vez (3; sin dibujar pesan poco)
//   --velocidad=V  (10)
//   --tope=S       segundos de pelea como mucho (360)
//   --nivel=x      nivel del bot (humano)
//   --lista        solo muestra las versiones que encuentra
//
// Anota una línea por partida en logs/tandas/jefes-<fecha>.jsonl y al final una tabla por versión.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const games = Number(opt('juegos', 1));
const parallel = Number(opt('paralelo', 3));
const speed = Number(opt('velocidad', 10));
const cap = Number(opt('tope', 360));
const skill = opt('nivel', 'humano');
const wanted = args.filter((a) => !a.startsWith('--'));

// las versiones, leídas del código (los ids de cada index.ts): sin abrir el juego para listarlas
function versions() {
  const out = [];
  for (const family of readdirSync('src/game/bosses', { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'ejemplo').map((d) => d.name)) {
    const src = readFileSync(`src/game/bosses/${family}/index.ts`, 'utf8');
    const ids = new Set();
    for (const m of src.matchAll(/id:\s*'([-a-z0-9]+\.[-a-z0-9]+)'/g)) ids.add(m[1]);
    for (const m of src.matchAll(/^\s*(?:version|[a-zA-Z]+Boss)\(\s*'([-a-z0-9.]+)'/gm)) ids.add(m[1].includes('.') ? m[1] : `${family}.${m[1]}`);
    for (const id of ids) out.push(id);
  }
  return out;
}
const all = versions();
const list = wanted.length ? all.filter((id) => wanted.some((w) => id === w || id.split('.')[0] === w)) : all;
if (args.includes('--lista')) {
  console.log(list.join(' '));
  process.exit(0);
}
if (!list.length) {
  console.log('no encontré esos jefes. Hay:', all.join(' '));
  process.exit(1);
}

mkdirSync('logs/tandas', { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
const out = `logs/tandas/jefes-${stamp}.jsonl`;
const port = 5208;
const server = await createServer({ root: process.cwd(), server: { port, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });

async function play(id, n) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => sessionStorage.setItem('gk.introSeen', '1'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push((e.stack || e.message).split('\n').slice(0, 2).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[gk]'))) errors.push(`[console] ${m.text().slice(0, 200)}`); });
  const t0 = Date.now();
  let r = null;
  try {
    await page.goto(`http://localhost:${port}/?bot=${skill}&liviano&velocidad=${speed}&sincine&ola=10&jefe=${id}`);
    await page.waitForFunction(() => window.__gk?.started && window.__bot, null, { timeout: 180000 });
    // hasta que arranque la pelea (antes, las cartas de las oleadas salteadas)
    await page.waitForFunction(() => window.__gk.boss || window.__gk.ended, null, { timeout: 180000 });
    const start = await page.evaluate(() => window.__gk.clock);
    while (Date.now() - t0 < 15 * 60000) {
      await page.waitForTimeout(2000);
      r = await page.evaluate((start) => {
        const g = window.__gk;
        return { ended: g.ended, fight: Math.round(g.clock - start), gate: g.gateHp, hp: g.player.hp, done: g.boss?.fight?.done ?? null, log: g.boss?.log?.() ?? null, started: !!g.boss };
      }, start);
      if (r.ended || r.fight > cap) break;
    }
  } catch (e) {
    errors.push(`tanda: ${e.message.split('\n')[0]}`);
  }
  await ctx.close().catch(() => {});
  const row = { id, n, result: r?.ended ?? (r ? 'tope' : 'error'), ...r, realSeconds: Math.round((Date.now() - t0) / 1000), errors: [...new Set(errors)] };
  delete row.ended;
  appendFileSync(out, `${JSON.stringify(row)}\n`);
  console.log(`${id.padEnd(26)} ${String(row.result).padEnd(8)} pelea ${String(row.fight ?? '?').padStart(4)} s · puerta ${row.gate ?? '?'} · vida ${row.hp ?? '?'}${row.started === false ? ' · NO ARRANCÓ' : ''}${row.errors.length ? ` · ERRORES (${row.errors.length}): ${row.errors[0].slice(0, 160)}` : ''}`);
  return row;
}

console.log(`${list.length} versiones × ${games}, de a ${parallel}, a velocidad ${speed} → ${out}`);
const jobs = [];
for (let n = 1; n <= games; n++) for (const id of list) jobs.push([id, n]);
const rows = [];
await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, async () => {
  while (jobs.length) rows.push(await play(...jobs.shift()));
}));

console.log('\nversión: ganó/jugó · pelea promedio · puerta perdida · vida perdida · errores');
for (const id of list) {
  const mine = rows.filter((r) => r.id === id);
  const avg = (f) => (mine.reduce((s, r) => s + (f(r) ?? 0), 0) / Math.max(1, mine.length)).toFixed(0);
  const won = mine.filter((r) => r.result === 'victory').length;
  console.log(`${id.padEnd(26)} ${won}/${mine.length} · ${avg((r) => r.fight)} s · −${avg((r) => 10 - (r.gate ?? 10))} · −${avg((r) => 3 - (r.hp ?? 3))} · ${mine.reduce((s, r) => s + r.errors.length, 0)}`);
}
await browser.close();
await server.close();
