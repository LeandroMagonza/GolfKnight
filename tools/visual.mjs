// Capturas de la capa visual (sombras, color, luz, contorno y brillo) con la misma escena en cada
// configuración, para compararlas lado a lado. Usa la GPU de la máquina, no el render por software: es
// una sola ventana y unos segundos por captura. Salen en logs/visual-*.png.
// uso: node tools/visual.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('logs', { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5197, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

const SHOTS = {
  antes: { shadows: false, tone: 'ninguno', exposure: 1, light: 'mediodía', elevation: 57, azimuth: -121, sunIntensity: 2.4, rim: false, bloom: false },
  tarde: {},
  atardecer: { light: 'atardecer', elevation: 15, azimuth: -110, sunIntensity: 3.2 },
  agx: { tone: 'AgX' },
};

for (const [name, visual] of Object.entries(SHOTS)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.addInitScript((v) => {
    localStorage.setItem('gk.visual', JSON.stringify(v));
    sessionStorage.setItem('gk.introSeen', '1');
  }, visual);
  await page.goto('http://localhost:5197/?campo=1&palos&visual');
  await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
  await page.click('#skip');
  await page.waitForFunction(() => document.getElementById('overlay').hidden, null, { timeout: 10000 });
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?';
  });
  // con ?palos arranca ofreciendo cartas: se elige la primera para que el cartel no tape la escena
  await page.waitForTimeout(400);
  if (await page.locator('#choice:not([hidden])').count()) await page.keyboard.press('Digit1');
  await page.evaluate(() => {
    const g = window.__gk;
    g.director.timer = 9999;
    const put = [['goblin', -4, 18], ['goblin', -2.5, 19], ['skeleton', 3, 22], ['warrior', 6, 26], ['knight', -7, 30], ['shaman', 1, 34], ['golem', 0, 48]];
    for (const [kind, x, z] of put) {
      const e = g.spawn(kind, x, z);
      e.stats = { ...e.stats, speed: 0, damage: 0 };
    }
  });
  await page.waitForTimeout(2500);
  const fps = await page.evaluate(() => window.__gk.fps);
  await page.screenshot({ path: `logs/visual-${name}.png` });
  console.log(name.padEnd(10), 'fps', fps, '·', gpu);
  await page.close();
}
await browser.close();
await server.close();
