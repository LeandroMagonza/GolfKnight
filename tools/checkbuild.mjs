// Prueba el sitio ya compilado (dist/) servido desde una subcarpeta, como en GitHub Pages: que cargue
// los modelos con rutas relativas, que arranque y que no pida nada que no exista.
// uso: npx vite build && node tools/checkbuild.mjs [--capturas]
//   --capturas deja jugar al bot un rato y guarda capturas en logs/ (sirven para la landing).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const BASE = '/GolfKnight/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json' };
if (!existsSync('dist/index.html')) throw new Error('falta dist/: correr antes "npx vite build"');
mkdirSync('logs', { recursive: true });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x').pathname;
  if (!url.startsWith(BASE)) { res.writeHead(404).end(); return; }
  const rel = normalize(decodeURIComponent(url.slice(BASE.length)) || 'index.html');
  try {
    const body = await readFile(join('dist', rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(5193, ok));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push('error: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
const shots = process.argv.includes('--capturas');
await page.goto(`http://localhost:5193${BASE}${shots ? '?bot' : ''}`);
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
await page.click('#skip');
await page.waitForFunction(() => document.getElementById('overlay').hidden);
await page.waitForFunction(() => window.__gk.director.index >= 0 && window.__gk.horde.aliveCount > 0, null, { timeout: 30000 });
console.log('arrancó desde', BASE, '· enemigos:', await page.evaluate(() => window.__gk.horde.aliveCount));
if (shots) {
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(12000);
    if (await page.evaluate(() => window.__gk.ended)) break;
    await page.screenshot({ path: `logs/captura-${String(i).padStart(2, '0')}.png` });
  }
}
await browser.close();
server.close();
console.log(problems.length ? `PROBLEMAS:\n${problems.join('\n')}` : 'OK: el sitio compilado anda desde una subcarpeta');
process.exit(problems.length ? 1 : 0);
