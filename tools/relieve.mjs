// Prueba del prototipo de campo con relieve (?relieve): los enemigos caminan sobre el terreno, una loma
// tapa al driver, el valle central es un carril limpio, y los globos caen donde se apunta aunque el
// punto esté más alto o más bajo. Capturas en logs/relieve-*.png.
// uso: node tools/relieve.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('logs', { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const failures = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
const log = (label, ...parts) => console.log(label.padEnd(24), '->', parts.map((p) => JSON.stringify(p)).join('  '));
const check = (label, ok) => { if (!ok) { failures.push(label); console.log(`  FALLA: ${label}`); } };

await page.goto('http://localhost:5196/?relieve&palos');
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
await page.click('#skip');
await page.waitForFunction(() => document.getElementById('overlay').hidden, null, { timeout: 10000 });
await page.evaluate(() => { window.__gk.director.timer = 9999; });
await page.waitForTimeout(1200);

const aimAt = async (x, z) => {
  for (let i = 0; i < 2; i++) {
    const p = await page.evaluate(([x, z]) => window.__gk.screenOf(x, z), [x, z]);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(500);
  }
};
const still = (kind, x, z) => page.evaluate(([kind, x, z]) => { const e = window.__gk.spawn(kind, x, z); e.stats = { ...e.stats, speed: 0, damage: 0 }; return e.id; }, [kind, x, z]);
const enemy = (id) => page.evaluate((id) => { const e = window.__gk.horde.enemies.find((x) => x.id === id); return e ? { hp: e.hp, alive: e.alive, chilled: e.chilled, y: +e.position.y.toFixed(2) } : null; }, id);
const clear = () => page.evaluate(() => { for (const e of window.__gk.horde.enemies) e.state = 'gone'; });
const free = () => page.waitForFunction(() => window.__gk.player.mode === 'free' && window.__gk.player.atSpot, null, { timeout: 8000 }).catch(() => {});
const done = () => page.waitForFunction(() => window.__gk.balls.list.length === 0, null, { timeout: 8000 }).catch(() => {});
const shoot = async (digit, power) => {
  await page.keyboard.press(`Digit${digit}`);
  await free();
  await page.waitForFunction(() => window.__gk.player.cooldowns[window.__gk.player.club.id] <= 0, null, { timeout: 5000 });
  await page.evaluate(() => { const g = window.__gk; g.tees.place(g.tees.nearest(g.player.position.x)); });
  await page.evaluate((p) => window.__gk.shootPower(p), power);
  await free();
  await done();
};

const heights = await page.evaluate(() => { const h = window.__gk.heightAt; return { puesto: h(0, 9), loma: +h(-11.5, 34).toFixed(2), valle: +h(0, 40).toFixed(2) }; });
log('alturas', heights);
check('los puestos están en piso plano, hay una loma y hay un valle', heights.puesto === 0 && heights.loma > 1.8 && heights.valle < -0.7);

// los enemigos caminan sobre el terreno
const onHill = await still('skeleton', -11.5, 34);
const inValley = await still('goblin', 0, 40);
await page.waitForTimeout(300);
log('pies', await enemy(onHill), await enemy(inValley));
check('los enemigos pisan el terreno', (await enemy(onHill)).y === heights.loma && (await enemy(inValley)).y === heights.valle);
await page.screenshot({ path: 'logs/relieve-1-campo.png' });

// el valle es un carril: desde el puesto del medio, el driver atraviesa a los que vienen por el fondo
await clear();
// la pelota sale del tee, a un costado del golfista: la fila se arma sobre la línea tee -> cursor
await page.keyboard.press('Digit1');
await aimAt(0.3, 44);
const [tx, tz] = await page.evaluate(() => window.__gk.tee);
const row = [];
for (const u of [0.6, 0.78, 0.96]) row.push(await still('goblin', tx + (0.3 - tx) * u, tz + (44 - tz) * u));
await page.screenshot({ path: 'logs/relieve-2-valle.png' });
await shoot(1, 0.5);
const rowAfter = [];
for (const id of row) rowAfter.push(await enemy(id));
log('fila en el valle', rowAfter.map((e) => (e && e.alive ? e.hp : 'muerto')));
check('el driver atraviesa la fila que viene por el fondo del valle', rowAfter.every((e) => !e || !e.alive));

// la loma tapa: al que está detrás, el driver no le llega; al que está en la cima, sí
await clear();
const behind = await still('skeleton', -16.7, 45);
const top = await still('skeleton', -11.5, 34);
await aimAt(-16.7, 45);
log('puntería detrás de la loma', await page.evaluate(() => window.__gk.aim));
await page.screenshot({ path: 'logs/relieve-3-tapado.png' });
await shoot(1, 0.8);
log('detrás de la loma', await enemy(behind));
check('la loma tapa al driver: al que está detrás no le pega', (await enemy(behind)).hp === 4);
await aimAt(-11.5, 34);
await shoot(1, 0.8);
log('en la cima', await enemy(top));
check('al que está en la cima sí: el tiro sube lo que sube el terreno', ((await enemy(top))?.hp ?? 0) < 4);

// el globo pasa por arriba y cae donde se apuntó
await aimAt(-16.7, 45);
await shoot(2, 0.5);
log('globo detrás de la loma', await enemy(behind));
check('el hierro le llega por arriba al que está tapado', (await enemy(behind)).chilled);
await page.screenshot({ path: 'logs/relieve-4-globo.png' });

// sin ?relieve todo sigue plano
await page.goto('http://localhost:5196/?palos');
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
const flat = await page.evaluate(() => window.__gk.heightAt(-11.5, 34));
check('sin ?relieve el campo es el plano de siempre', flat === 0);

console.log(errors.length ? `ERRORES DE PÁGINA (${errors.length})` : 'sin errores de página');
console.log(failures.length ? `FALLAS (${failures.length}): ${failures.join(' | ')}` : 'todas las comprobaciones pasaron');
await browser.close();
await server.close();
process.exit(errors.length || failures.length ? 1 : 0);
