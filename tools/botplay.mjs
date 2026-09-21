// Un bot juega la partida entera, para chequear el balance sin jugar a mano. El bot vive en
// src/bot.ts y se activa con ?bot en la URL, así que también se lo puede mirar jugar en el navegador:
//   npm run dev   y abrir   http://localhost:5173/?bot
// uso: node tools/botplay.mjs [minutosMax] [--ver]
//   --ver abre una ventana de Chromium de verdad (con la placa de video) para mirarlo; sin eso corre
//   sin ventana, con render por software.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('logs', { recursive: true });
const watch = process.argv.includes('--ver');
const maxMinutes = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 14);
const server = await createServer({ root: process.cwd(), server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch(watch
  ? { headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1320,820'] }
  : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
// sin ventana, una vista chica: con render por software, menos píxeles es más cuadros por segundo
const page = await browser.newPage({ viewport: watch ? { width: 1280, height: 720 } : { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5196/?bot');
await page.evaluate(() => localStorage.removeItem('gk.globos'));
await page.reload();
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
await page.click('#skip');
await page.waitForFunction(() => document.getElementById('overlay').hidden);
await page.waitForFunction(() => window.__bot, null, { timeout: 10000 });

const t0 = Date.now();
let lastWave = -2;
while (Date.now() - t0 < maxMinutes * 60000) {
  await page.waitForTimeout(watch ? 2000 : 5000);
  const s = await page.evaluate(() => {
    const g = window.__gk;
    return { wave: g.director.index + 1, alive: g.horde.aliveCount, pending: g.director.pending, gate: g.gateHp, hp: g.player.hp, kills: g.kills, shots: g.shots, ended: g.ended, fps: g.fps, bot: window.__bot };
  }).catch(() => null);
  // cerraron la ventana a mano
  if (!s) break;
  if (s.wave !== lastWave || s.ended) {
    lastWave = s.wave;
    console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s`, JSON.stringify(s));
    if (!watch) await page.screenshot({ path: `logs/bot-oleada${s.wave}.png` });
  }
  if (s.ended) break;
}
if (watch) await page.waitForTimeout(6000).catch(() => {});
else await page.screenshot({ path: 'logs/bot-final.png' });
console.log(errors.length ? `ERRORES: ${errors.length}` : 'sin errores de página');
await browser.close().catch(() => {});
await server.close();
