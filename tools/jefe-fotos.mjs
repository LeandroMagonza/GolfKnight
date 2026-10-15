// Fotos de un jefe en el juego (14/10): arranca en la última oleada con ese jefe y saca capturas a los
// segundos pedidos desde que empieza la pelea, con la placa de video (como tools/cine.mjs). Por defecto
// juega el bot y con vida y puerta infinitas, para que la pelea dure lo que haga falta.
//
//   node tools/lock.mjs navegador -- node tools/jefe-fotos.mjs <jefe> [segundos...] [opciones]
//
//   segundos     cuándo sacar cada foto, desde que arranca la pelea (por defecto 2 6 12 20 30)
//   --sinbot     no juega nadie (el golfista queda quieto): para mirar al jefe solo
//   --mortal     sin vida ni puerta infinitas: la pelea puede terminar
//   --tope=S     cortar a los S segundos de pelea aunque no haya terminado (60)
//   --cerca      cámara más baja y cerca de la mitad de la cancha (para ver de cerca)
//   --url=a&b    más cosas para la URL
//
// Las fotos van a logs/jefe-<jefe>-<segundo>.png. Al final escribe lo que diga el jefe (`log`), cómo
// terminó, y los errores de la página.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.log('uso: node tools/jefe-fotos.mjs <jefe> [segundos...] [--sinbot] [--mortal] [--tope=S] [--cerca] [--url=a&b]');
  process.exit(2);
}
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
let times = args.filter((a) => /^\d+(\.\d+)?$/.test(a)).map(Number);
if (!times.length) times = [2, 6, 12, 20, 30];
const cap = Number(opt('tope', 60));
const bot = !args.includes('--sinbot');
const god = !args.includes('--mortal');

mkdirSync('logs', { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5194, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  sessionStorage.setItem('gk.introSeen', '1');
  sessionStorage.setItem('gk.autostart', '1');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push((e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[gk]'))) errors.push(`[console] ${m.text()}`); });
const lastWave = 10;
const q = [`ola=${lastWave}`, `jefe=${id}`, 'sincine', ...(bot ? ['bot=humano'] : []), ...(opt('url', '') ? [opt('url', '')] : [])];
await page.goto(`http://localhost:5194/?${q.join('&')}`);
await page.waitForFunction(() => window.__gk?.started, null, { timeout: 120000 });
if (god) await page.evaluate(() => { window.__gk.godMode.godPlayer = true; window.__gk.godMode.godGate = true; });
// sin bot, las cartas de las oleadas salteadas se cierran solas eligiendo la primera
const t0 = Date.now();
while (Date.now() - t0 < 180000) {
  const s = await page.evaluate(() => ({ boss: !!window.__gk.boss, wave: window.__gk.director.index + 1 }));
  if (s.boss) break;
  if (!bot) await page.keyboard.press('Digit1').catch(() => {});
  await page.waitForTimeout(500);
}
const started = await page.evaluate(() => !!window.__gk.boss);
if (!started) {
  console.log('la pelea no arrancó (¿existe el jefe? ¿carga?)');
} else {
  if (args.includes('--cerca')) {
    // la cámara de la partida se encuadra sola; para mirar de cerca se la baja con las flechas
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
  }
  const startClock = await page.evaluate(() => window.__gk.boss.fight && window.__gk.clock);
  for (const t of times.filter((x) => x <= cap)) {
    while (true) {
      const now = await page.evaluate(() => window.__gk.clock);
      if (now - startClock >= t) break;
      const over = await page.evaluate(() => window.__gk.ended);
      if (over) break;
      await page.waitForTimeout(100);
    }
    await page.screenshot({ path: `logs/jefe-${id}-${t}.png` });
    console.log('foto', t);
    if (await page.evaluate(() => window.__gk.ended)) break;
  }
}
const end = await page.evaluate(() => ({ ended: window.__gk.ended, gate: window.__gk.gateHp, hp: window.__gk.player.hp, log: window.__gk.boss?.log?.() ?? null, done: window.__gk.boss?.fight?.done ?? null }));
console.log(JSON.stringify(end));
console.log(errors.length ? errors.join('\n') : 'sin errores');
await browser.close();
await server.close();
