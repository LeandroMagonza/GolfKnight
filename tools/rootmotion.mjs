// Chequeo de regresión del root motion: mide cuánto se desplaza la cadera en horizontal en cada
// clip, tal como queda cargado en el juego, para los enemigos y para cada skin del jugador. Todo
// tiene que dar ~0: si no, el personaje avanza dentro de la animación y pega un salto para atrás
// cuando el clip termina o reinicia el ciclo. Sale con error si algún clip se mueve más de 5 cm.
//
// Arranca con el skin por defecto (un guardia) y mide primero a los enemigos, a propósito: los
// caballeros comparten GLB con la horda, y una limpieza hecha solo al cargar el skin taparía el bug.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const LIMIT = 0.05;
const server = await createServer({ root: process.cwd(), server: { port: 5194, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5194/');
await page.evaluate(() => localStorage.removeItem('gk.skin'));
await page.reload();
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
await page.click('#skip');
await page.waitForFunction(() => document.getElementById('overlay').hidden);
await page.evaluate(() => { window.__gk.director.timer = 9999; });

let bad = 0;
const show = (label, drift) => {
  const entries = Object.entries(drift ?? {});
  const moving = entries.filter(([, d]) => d.max > LIMIT);
  bad += moving.length;
  const worst = entries.reduce((m, [, d]) => Math.max(m, d.max), 0);
  console.log(`${label.padEnd(34)} ${entries.length} clips, desvío máximo ${worst.toFixed(3)} m${moving.length ? '   SE MUEVEN: ' + moving.map(([n, d]) => `${n} (${d.max} m)`).join(', ') : ''}`);
};

await page.evaluate(() => window.__gk.spawn('goblin', 0, 40));
await page.waitForTimeout(300);
show('enemigos (dungeon.glb)', await page.evaluate(() => window.__gk.hipsDrift('enemy')));
for (let i = 0; i < 4; i++) {
  const label = await page.textContent('#skin');
  show(label, await page.evaluate(() => window.__gk.hipsDrift('player')));
  await page.click('#skin');
  // la primera vez que se usa un skin hay que bajar su GLB: se espera al cambio, no un tiempo fijo
  await page.waitForFunction((l) => document.getElementById('skin').textContent !== l, label, { timeout: 30000 });
}
await browser.close();
await server.close();
console.log(bad ? `FALLA: ${bad} clips con root motion` : 'OK: ningún clip desplaza la cadera');
process.exit(bad ? 1 : 0);
