// Cuadros sueltos de la cinemática, para revisarla sin mirarla entera: por defecto tres por plano
// (al principio, al medio y cerca del final), o los segundos que se pasen. Usa la GPU de la máquina.
// Salen en logs/cine-<segundo>.png.
// uso: node tools/cine.mjs [segundo ...]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('logs', { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto('http://localhost:5198/cine.html?t=0');
await page.waitForFunction(() => window.__cine, null, { timeout: 120000 });
// la barra de controles tapa los subtítulos: afuera en las capturas
await page.addStyleTag({ content: '#controls { display: none !important; }' });
const { duration, starts } = await page.evaluate(() => ({ duration: window.__cine.duration, starts: window.__cine.starts }));
let times = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
if (!times.length) {
  times = [];
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : duration;
    for (const u of [0.15, 0.5, 0.85]) times.push(+(s + (end - s) * u).toFixed(2));
  });
}
for (const t of times) {
  await page.evaluate((t) => window.__cine.seek(t), t);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `logs/cine-${t.toFixed(2)}.png` });
  console.log('cuadro', t.toFixed(2));
}
await browser.close();
await server.close();
