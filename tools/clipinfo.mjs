// Muestra el recorrido de la mano derecha y las fases detectadas de los clips de golf del jugador.
// uso: node tools/clipinfo.mjs ["Golf Drive" ...]
import { createServer } from 'vite';
import { chromium } from 'playwright';

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['Golf Drive', 'Golf Chip', 'Golf Putt'];
const server = await createServer({ root: process.cwd(), server: { port: 5195, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', async (m) => { if (m.type() === 'warning') console.log('[warn]', m.text(), JSON.stringify(await Promise.all(m.args().slice(1).map((a) => a.jsonValue().catch(() => null))))); });
await page.goto('http://localhost:5195/');
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
for (const name of names) {
  const samples = await page.evaluate((n) => window.__gk.sampleClip(n, 10), name);
  const info = await page.evaluate((n) => {
    const a = window.__gk.analyzeClip(n);
    return a && { address: +a.address.toFixed(2), top: +a.top.toFixed(2), impact: +a.impact.toFixed(2), end: +a.end.toFixed(2), flightYawDeg: Math.round(a.flightYaw * 57.3), tee: a.tee };
  }, name);
  console.log(`== ${name}`);
  if (process.env.SAMPLES) console.log(samples.map((s) => '  ' + s.map((v) => String(v).padStart(6)).join(' ')).join('\n'));
  console.log('  fases:', JSON.stringify(info));
}
await browser.close();
await server.close();
