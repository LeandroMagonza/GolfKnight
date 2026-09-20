// Prueba automática del juego: salta la intro y prueba cada mecánica contra enemigos puestos a mano:
// palos bloqueados por oleada, palo en cola, medidor con rebote, driver y su racha, hielo, empujón,
// chamán, portal del putter, alma en pena, puerta, pausa y final. Capturas en logs/.
// uso: node tools/playtest.mjs [--quick]   (quick: solo arranque y una captura)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('logs', { recursive: true });
const quick = process.argv.includes('--quick');
const server = await createServer({ root: process.cwd(), server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const failures = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.type(), m.text()); });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });

const state = () => page.evaluate(() => {
  const s = window.__gk;
  return {
    wave: s.director.index, alive: s.horde.aliveCount, gate: s.gateHp, hp: s.player.hp,
    mode: s.player.mode, club: s.player.club.id, pos: [s.player.position.x, s.player.position.z].map((n) => +n.toFixed(1)),
    kills: s.kills, shots: s.shots, streak: s.streak, fps: s.fps, ended: s.ended,
  };
});
const enemies = () => page.evaluate(() => window.__gk.horde.enemies.map((e) => {
  const flags = [e.frozen ? 'congelado' : e.chilled ? 'lento' : '', e.warded ? 'inmune' : '', e.grabbing ? 'agarrando' : ''].filter(Boolean).join(' ');
  return `${e.stats.kind}#${e.id} hp${Math.round(e.hp)} ${e.state}${flags ? ' ' + flags : ''} (${e.position.x.toFixed(1)},${e.position.z.toFixed(1)})`;
}));
const aimAt = async (x, z) => {
  const p = await page.evaluate(([x, z]) => window.__gk.screenOf(x, z), [x, z]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(80);
};
const ballsDone = (maxMs = 6000) => page.waitForFunction(() => window.__gk.balls.list.length === 0, null, { timeout: maxMs }).catch(() => {});
const playerFree = () => page.waitForFunction(() => window.__gk.player.mode === 'free', null, { timeout: 8000 }).catch(() => {});
/** Tiro de driver con alcance exacto hacia donde apunta el mouse; espera a que la pelota termine. */
const drive = async (meters, maxMs = 6000) => {
  await page.keyboard.press('Digit1');
  await playerFree();
  await page.evaluate((m) => window.__gk.shoot(m), meters);
  await playerFree();
  await ballsDone(maxMs);
};
/** Globo (hierro 2, wedge 3) con potencia exacta; cae donde apunta el mouse. Espera la recarga si hace falta. */
const lob = async (digit, power) => {
  await page.keyboard.press(`Digit${digit}`);
  await playerFree();
  await page.waitForFunction(() => window.__gk.player.cooldowns[window.__gk.player.club.id] <= 0, null, { timeout: 5000 });
  await page.evaluate((p) => window.__gk.shootPower(p), power);
  await playerFree();
  await ballsDone();
};
const log = (label, ...parts) => console.log(label.padEnd(20), '->', parts.map((p) => JSON.stringify(p)).join('  '));
const check = (label, ok) => { if (!ok) { failures.push(label); console.log(`  FALLA: ${label}`); } };
const clearEnemies = () => page.evaluate(() => { for (const e of window.__gk.horde.enemies) e.state = 'gone'; });
const still = (kind, x, z, extra = {}) => page.evaluate(([kind, x, z, extra]) => {
  const e = window.__gk.spawn(kind, x, z);
  e.stats = { ...e.stats, speed: 0, damage: 0, ...extra };
  return e.id;
}, [kind, x, z, extra]);
const enemy = (id) => page.evaluate((id) => {
  const e = window.__gk.horde.enemies.find((x) => x.id === id);
  return e ? { hp: e.hp, alive: e.alive, chilled: e.chilled, frozen: e.frozen, warded: e.warded, casting: e.casting, grabbing: e.grabbing, x: +e.position.x.toFixed(2), z: +e.position.z.toFixed(2) } : null;
}, id);
/** Vuelve al golfista a su lugar y espera a que la cámara termine de seguirlo: aimAt convierte un punto del
 * campo a un píxel con la cámara de ese momento, y si la cámara sigue viajando la puntería se corre. */
const resetPlayer = async () => {
  await page.evaluate(() => { const g = window.__gk; g.player.hp = 100; g.player.position.set(0, 0, 9); g.portal.clear(); g.player.cooldowns.putter = 0; });
  await page.waitForTimeout(1600);
};
/** Frena al director de oleadas para probar con enemigos puestos a mano. */
const holdWaves = () => page.evaluate(() => { window.__gk.director.timer = 9999; });

await page.goto('http://localhost:5198/');
await page.evaluate(() => localStorage.removeItem('gk.globos'));
await page.reload();
await page.screenshot({ path: 'logs/k0-intro.png' });
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
console.log('alturas medidas de los modelos:', await page.evaluate(() => window.__gk.measured));
for (let i = 0; i < 3; i++) await page.keyboard.press('Space');
await page.screenshot({ path: 'logs/k0-intro2.png' });
await page.click('#skip');
await page.waitForFunction(() => document.getElementById('overlay').hidden, null, { timeout: 10000 });
await holdWaves();
await page.waitForTimeout(600);
log('inicio', await state());
await page.screenshot({ path: 'logs/k1-inicio.png' });

if (!quick) {
  // --- palos bloqueados: al empezar solo está el driver; ni el 2 ni Espacio hacen nada ---
  await page.keyboard.press('Digit2');
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const locked = await page.evaluate(() => ({ club: window.__gk.player.club.id, palos: [...window.__gk.player.unlocked], pelota: window.__gk.portal.out }));
  log('bloqueados', locked);
  check('al empezar solo hay driver', locked.club === 'driver' && locked.palos.length === 1 && !locked.pelota);
  const shownSlots = await page.evaluate(() => ({
    slots: [...document.querySelectorAll('#clubs .club')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.dataset.club),
    globos: !document.getElementById('lobaim').hidden,
  }));
  log('barra al empezar', shownSlots);
  check('lo que no se desbloqueó no se muestra', shownSlots.slots.join() === 'driver,melee' && !shownSlots.globos);

  // --- cartel de palo nuevo: frena el juego hasta el click, pero el descanso entre oleadas sigue corriendo ---
  const walker = await page.evaluate(() => window.__gk.spawn('skeleton', 0, 40).id);
  await page.evaluate(() => { const g = window.__gk; g.director.index = 0; g.director.timer = 6; g.offerUnlock(); });
  const before = await page.evaluate((id) => { const g = window.__gk; return { clock: g.clock, z: g.horde.enemies.find((e) => e.id === id).position.z, rest: g.director.restLeft }; }, walker);
  await page.waitForTimeout(1200);
  await page.keyboard.press('Digit2');
  const during = await page.evaluate((id) => {
    const g = window.__gk;
    return { abierto: g.cardOpen, visible: !document.getElementById('card').hidden, clock: g.clock, z: g.horde.enemies.find((e) => e.id === id).position.z, rest: g.director.restLeft, palos: [...g.player.unlocked], palo: g.player.club.id };
  }, walker);
  await page.screenshot({ path: 'logs/k1a-cartel.png' });
  log('cartel', before, during);
  check('el cartel de palo nuevo frena el juego', during.abierto && during.visible && during.clock === before.clock && during.z === before.z && during.palo === 'driver');
  check('con el cartel abierto el descanso entre oleadas sigue corriendo', during.rest < before.rest - 0.5);
  check('el cartel ya habilita el palo', during.palos.includes('iron'));
  await page.mouse.click(640, 360);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ abierto: window.__gk.cardOpen, visible: !document.getElementById('card').hidden, hierro: getComputedStyle(document.querySelector('#clubs .club[data-club=iron]')).display !== 'none' }));
  log('cartel cerrado', after);
  check('un click cierra el cartel y el palo aparece en la barra', !after.abierto && !after.visible && after.hierro);
  await page.evaluate(() => { const g = window.__gk; g.director.index = -1; g.director.timer = 9999; });
  await clearEnemies();
  await page.evaluate(() => window.__gk.unlockAll());

  // --- palo en cola: elegido en medio de un tiro, entra cuando el tiro termina o se cancela ---
  const clubs = () => page.evaluate(() => ({ club: window.__gk.player.club.id, enCola: window.__gk.player.pendingClub?.id ?? null, mode: window.__gk.player.mode }));
  await aimAt(0, 40);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.keyboard.press('Digit3');
  log('cola: cargando', await clubs());
  await page.screenshot({ path: 'logs/k1b-palo-en-cola.png' });
  await page.mouse.up();
  await playerFree();
  await page.waitForTimeout(150);
  const afterShot = await clubs();
  log('cola: tras el tiro', afterShot);
  check('el palo en cola entra al terminar el tiro', afterShot.club === 'wedge');
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.keyboard.press('Digit2');
  await page.keyboard.press('KeyX');
  await page.mouse.up();
  await page.waitForTimeout(250);
  const afterCancel = await clubs();
  log('cola: tras cancelar', afterCancel);
  check('el palo en cola entra al cancelar', afterCancel.club === 'iron');
  await ballsDone(15000);

  // --- medidor: llega al tope y después rebota entre 100 y 70 %, sin volver al principio ---
  await page.keyboard.press('Digit1');
  await page.mouse.down();
  await page.waitForFunction(() => window.__gk.player.meter.power > 0.97, null, { timeout: 5000, polling: 'raf' }).catch(() => {});
  let minPower = 1;
  let minReach = 1;
  const ranges = new Set();
  for (let i = 0; i < 25; i++) {
    const m = await page.evaluate(() => ({ power: window.__gk.player.meter.power, reach: window.__gk.player.meter.reach, range: document.getElementById('range').textContent }));
    minPower = Math.min(minPower, m.power);
    minReach = Math.min(minReach, m.reach);
    ranges.add(m.range);
    await page.waitForTimeout(60);
  }
  await page.screenshot({ path: 'logs/k2-medidor.png' });
  await page.keyboard.press('KeyX');
  await page.mouse.up();
  log('medidor', { minimoTrasElTope: +minPower.toFixed(2), alcanceMinimo: minReach, alcances: [...ranges] });
  check('el alcance llega al máximo y se queda ahí mientras la barra rebota', minReach === 1 && ranges.size === 1 && [...ranges][0] === '60 m' && minPower < 0.95);
  check('el medidor no baja de 0.7 después del tope', minPower >= 0.69);

  // --- racha del driver: sube al matar, se mantiene al pegar sin matar, se corta si no daña a nadie ---
  // la pelota sale del tee, a un costado del golfista: la fila se arma sobre la línea tee -> cursor
  await aimAt(0, 40);
  await page.waitForTimeout(300);
  const onLine = async (d) => {
    const [tx, tz] = await page.evaluate(() => window.__gk.tee);
    const len = Math.hypot(0 - tx, 40 - tz);
    return [tx + ((0 - tx) / len) * d, tz + ((40 - tz) / len) * d];
  };
  for (const d of [10, 13, 16]) await still('goblin', ...(await onLine(d)));
  await drive(30);
  const afterRow = await state();
  log('racha: fila', await enemies(), afterRow);
  check('el driver atraviesa la fila y suma una baja por enemigo', afterRow.streak === 3);
  await page.screenshot({ path: 'logs/k3-racha.png' });
  const tank = await still('knight', ...(await onLine(12)));
  await drive(30);
  const afterHit = await state();
  log('racha: pega sin matar', afterHit, await enemy(tank));
  check('pegar sin matar mantiene la racha', afterHit.streak === 3 && (await enemy(tank)).hp < 300);
  await clearEnemies();
  await drive(30, 4000);
  const afterMiss = await state();
  log('racha: en blanco', afterMiss);
  check('un tiro de driver que no daña a nadie corta la racha', afterMiss.streak === 0);
  await page.screenshot({ path: 'logs/k3b-racha-perdida.png' });
  await still('goblin', ...(await onLine(8)));
  await drive(60);
  const afterPerfect = await state();
  log('racha: baja perfecta', afterPerfect);
  check('una baja con swing perfecto suma tres', afterPerfect.streak === 3);
  await aimAt(-14, 30);
  await drive(30, 4000);
  await aimAt(0, 40);

  // --- un toque de driver pega bastante menos que un tiro cargado ---
  await clearEnemies();
  const dummy = await still('knight', 0, 24);
  await aimAt(0, 24);
  await drive(18);
  const tapHp = (await enemy(dummy)).hp;
  await drive(60);
  const fullHp = (await enemy(dummy)).hp;
  log('driver: toque y a fondo', { toque: 300 - tapHp, aFondo: tapHp - fullHp });
  check('el tiro cargado pega más que el toque', tapHp - fullHp > (300 - tapHp) * 1.4);

  // --- hielo: congela en el centro y enfría alrededor; frío = sin escudo y más daño. El hierro recarga y devuelve el driver ---
  await clearEnemies();
  const shield = await still('warrior', 0, 24);
  await page.waitForTimeout(900);
  await aimAt(0, 24);
  await drive(30, 2500);
  log('escudo vs driver', await enemy(shield));
  check('el escudo frena al driver', (await enemy(shield)).hp === 90);
  check('un tiro que solo rebota en un escudo corta la racha', (await state()).streak === 0);
  await aimAt(2.4, 24);
  await lob(2, 0.5);
  const slowed = await enemy(shield);
  const afterIron = await page.evaluate(() => ({ recarga: +window.__gk.player.cooldowns.iron.toFixed(2), palo: window.__gk.player.club.id }));
  log('hielo: borde', slowed, afterIron);
  check('en el borde el hielo enfría pero no congela', slowed.chilled && !slowed.frozen);
  check('el hierro queda recargando', afterIron.recarga > 0);
  const cdShown = await page.evaluate(() => { const el = document.querySelector('#clubs .club[data-club=iron]'); return { numero: el.querySelector('.cdnum').textContent, etiqueta: el.querySelector('.cdlabel').textContent, recargando: el.classList.contains('cooling') }; });
  log('recarga en la barra', cdShown);
  check('la barra muestra la recarga del hierro y el número bajando', cdShown.recargando && cdShown.numero !== '' && cdShown.etiqueta.includes('2 s'));
  check('después del hierro vuelve solo el driver', afterIron.palo === 'driver');
  await aimAt(0, 24);
  await drive(18, 2500);
  const coldHit = 90 - (await enemy(shield)).hp;
  log('frío: daño de un toque', coldHit);
  check('con frío el escudo no frena, y recibe 25 % más', coldHit === Math.round(60 * (0.55 + 0.45 * 0.08) * 1.25));
  await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); e.hp = 90; });
  await lob(2, 0.5);
  const iced = await enemy(shield);
  log('hielo: centro', iced);
  check('en el centro el hielo congela, sin swing perfecto', iced.frozen);
  await page.screenshot({ path: 'logs/k4-hielo.png' });
  // el perfecto llega más lejos: un esqueleto a 4.3 m del centro queda afuera del normal y adentro del perfecto
  await clearEnemies();
  const edge = await still('skeleton', 4.3, 24);
  await aimAt(0, 24);
  await lob(2, 0.5);
  const missed = (await enemy(edge)).chilled;
  await lob(2, 0.96);
  log('hielo perfecto', { normal: missed, perfecto: (await enemy(edge)).chilled });
  check('el hielo perfecto tiene más área', !missed && (await enemy(edge)).chilled);

  // --- wedge: empuja hacia afuera sin dañar; perfecto, además deja expuestos (reciben más daño) ---
  await clearEnemies();
  const ring = [];
  for (const [x, z] of [[-1.2, 24], [1.2, 24], [0, 25.2], [0, 22.8]]) ring.push(await still('skeleton', x, z));
  await aimAt(0, 24);
  await lob(3, 0.8);
  await page.waitForTimeout(900);
  const pushed = [];
  for (const id of ring) pushed.push(await enemy(id));
  log('wedge', pushed.map((e) => [e.hp, e.x, e.z]));
  check('el wedge no daña', pushed.every((e) => e.hp === 90));
  check('el wedge aleja a todos del centro', pushed.every((e) => Math.hypot(e.x, e.z - 24) > 2.5));
  check('sin perfecto no quedan expuestos', !(await page.evaluate(() => window.__gk.horde.enemies.some((e) => e.exposedTimer > 0))));
  await page.screenshot({ path: 'logs/k5-wedge.png' });
  await clearEnemies();
  const opened = await still('knight', 0, 24);
  await aimAt(0, 24);
  await lob(3, 0.96);
  const exposed = await page.evaluate(() => window.__gk.horde.enemies.at(-1).exposedTimer);
  await drive(18, 2500);
  const openHit = 300 - (await enemy(opened)).hp;
  log('wedge perfecto', { expuesto: +exposed.toFixed(1), toque: openHit });
  check('el wedge perfecto deja expuestos', exposed > 0);
  check('un expuesto recibe 50 % más', openHit === Math.round(60 * (0.55 + 0.45 * 0.08) * 1.5));
  await page.screenshot({ path: 'logs/k5b-expuesto.png' });

  // --- chamán: los que tiene cerca son inmunes; con hielo encima se apaga el aura ---
  await clearEnemies();
  const shaman = await still('shaman', 0, 27);
  const guarded = await still('skeleton', 3, 23);
  await page.waitForTimeout(500);
  log('chamán: aura', await enemy(shaman), await enemy(guarded));
  check('el chamán vuelve inmune al vecino', (await enemy(guarded)).warded && !(await enemy(shaman)).warded);
  await page.screenshot({ path: 'logs/k6-chaman.png' });
  await aimAt(3, 23);
  await drive(30, 2500);
  check('el driver no daña al inmune', (await enemy(guarded)).hp === 90);
  await aimAt(0, 27);
  await lob(2, 0.5);
  const silenced = await enemy(shaman);
  log('chamán con hielo', silenced, await enemy(guarded));
  check('el hielo apaga el aura', !silenced.casting && !(await enemy(guarded)).warded);
  await aimAt(3, 23);
  await drive(30, 2500);
  check('sin aura el driver vuelve a dañar', (await enemy(guarded)).hp < 90);

  // --- jefe: el hielo nunca lo congela, pero frío tira piedras más despacio ---
  await clearEnemies();
  await page.evaluate(() => { const g = window.__gk; g.gateHp = 300; const e = g.spawn('golem', 0, 22.2); e.castTimer = 50; });
  await page.waitForTimeout(1200);
  await aimAt(0, 22.2);
  await lob(2, 0.5);
  const bossIced = await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); return { chilled: e.chilled, frozen: e.frozen, cast: e.castTimer, age: e.age }; });
  await page.waitForTimeout(1500);
  const bossLater = await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); return { cast: e.castTimer, age: e.age, chilled: e.chilled }; });
  const castRate = (bossIced.cast - bossLater.cast) / (bossLater.age - bossIced.age);
  log('gólem con hielo', bossIced, { ritmoDeAtaque: +castRate.toFixed(2) });
  check('al jefe el hielo lo enfría sin congelarlo, ni en el centro', bossIced.chilled && !bossIced.frozen);
  check('el jefe frío ataca más lento', bossLater.chilled && castRate < 0.5);

  // --- globos por carga: con G la distancia la vuelve a dar el medidor ---
  await clearEnemies();
  const far = await still('skeleton', 0, 29);
  await page.keyboard.press('KeyG');
  await aimAt(0, 29);
  const lobMeters = async (m) => {
    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => window.__gk.player.cooldowns.iron <= 0, null, { timeout: 5000 });
    await page.evaluate((m) => window.__gk.shoot(m), m);
    await playerFree();
    await ballsDone();
  };
  await lobMeters(10);
  const short = await enemy(far);
  await lobMeters(await page.evaluate(() => window.__gk.aimDistance));
  log('globo por carga', await page.evaluate(() => window.__gk.lobAim), { corto: short.chilled, justo: (await enemy(far)).chilled });
  check('por carga, la distancia del globo la da el medidor y no el cursor', !short.chilled && (await enemy(far)).chilled);
  await page.keyboard.press('KeyG');

  // --- putter: Espacio tira la pelota (rápida), Espacio de nuevo salta hasta ella; después hay recarga ---
  await clearEnemies();
  await resetPlayer();
  await aimAt(6, 20);
  const t0 = await page.evaluate(() => window.__gk.clock);
  await page.keyboard.press('Space');
  // el reloj de juego se lee adentro de la página, en el mismo cuadro en que la pelota frena
  const t1 = await page.evaluate(() => new Promise((done) => { const poll = () => (window.__gk.portal.moving ? requestAnimationFrame(poll) : done(window.__gk.clock)); poll(); }));
  const rollTime = t1 - t0;
  await page.screenshot({ path: 'logs/k7-portal.png' });
  const ballAt = await page.evaluate(() => ({ out: window.__gk.portal.out, x: +window.__gk.portal.position.x.toFixed(1), z: +window.__gk.portal.position.z.toFixed(1) }));
  const rollSpeed = Math.hypot(ballAt.x, ballAt.z - 9) / rollTime;
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const jumped = await state();
  log('portal', ballAt, { segundos: +rollTime.toFixed(2), velocidadMedia: +rollSpeed.toFixed(1) }, jumped.pos, { recarga: await page.evaluate(() => +window.__gk.player.cooldowns.putter.toFixed(1)) });
  check('la pelota del putter frena cerca del cursor', ballAt.out && Math.hypot(ballAt.x - 6, ballAt.z - 20) < 1.5);
  check('la pelota del putter va bastante más rápido que correr (5.2 m/s)', rollSpeed > 12);
  check('el salto lleva al golfista hasta la pelota', Math.hypot(jumped.pos[0] - ballAt.x, jumped.pos[1] - ballAt.z) < 0.3);
  await page.screenshot({ path: 'logs/k7b-salto.png' });
  await aimAt(-4, 14);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const held = await state();
  check('con el portal recargando no se salta', Math.hypot(held.pos[0] - jumped.pos[0], held.pos[1] - jumped.pos[1]) < 0.3);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = window.__gk; g.player.position.copy(g.portal.position); });
  await page.waitForTimeout(300);
  check('pasarle por arriba levanta la pelota', !(await page.evaluate(() => window.__gk.portal.out)));

  // --- alma en pena: atrapa, lastima de a poco, y el salto libera ---
  await clearEnemies();
  await resetPlayer();
  const wraith = await page.evaluate(() => window.__gk.spawn('wraith', 3, 15).id);
  await page.waitForFunction(() => window.__gk.player.grabbedBy, null, { timeout: 10000 }).catch(() => console.log('  (no lo atrapó)'));
  await page.waitForTimeout(1200);
  const grabbed = await state();
  log('atrapado', grabbed, await enemy(wraith));
  check('el alma en pena atrapa y lastima', grabbed.hp < 100 && (await enemy(wraith)).grabbing);
  await page.screenshot({ path: 'logs/k8-atrapado.png' });
  await aimAt(-8, 22);
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const freed = await page.evaluate(() => ({ libre: !window.__gk.player.grabbedBy, pos: [window.__gk.player.position.x, window.__gk.player.position.z].map((n) => +n.toFixed(1)) }));
  log('liberado', freed, await enemy(wraith));
  check('el salto libera del agarre', freed.libre && !(await enemy(wraith)).grabbing);

  const afterPerfectStreak = (await state()).streak;
  // --- kamikazes: uno muere y se lleva a los otros ---
  await clearEnemies();
  await resetPlayer();
  for (const x of [-1.5, 0, 1.5]) await still('kamikaze', x, 22, { damage: 28 });
  await aimAt(0, 22);
  const killsBefore = (await state()).kills;
  await drive(40);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'logs/k9-kamikazes.png' });
  log('kamikazes', await enemies(), await state());
  check('la explosión de un kamikaze se lleva a los vecinos', (await state()).kills - killsBefore === 3);

  // --- palazo: botón aparte (Shift), con recarga; el swing ya no pega de cerca por sí solo ---
  await clearEnemies();
  await resetPlayer();
  const close = await still('skeleton', 0.4, 10.6);
  await aimAt(0, 30);
  const streakBefore = (await state()).streak;
  await page.keyboard.press('ShiftLeft');
  await page.waitForFunction(() => window.__gk.player.mode === 'free', null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(100);
  const afterMelee = await enemy(close);
  const meleeCd = await page.evaluate(() => window.__gk.player.meleeCooldown);
  await page.screenshot({ path: 'logs/k9b-palazo.png' });
  await page.keyboard.press('ShiftLeft');
  await page.waitForTimeout(400);
  log('palazo', afterMelee, { recarga: +meleeCd.toFixed(1) });
  check('el palazo pega de cerca', afterMelee.hp === 60);
  check('el palazo tiene recarga', meleeCd > 0 && (await enemy(close)).hp === 60);
  check('el palazo no toca la racha', (await state()).streak === streakBefore);

  // --- la puerta recibe daño ---
  await clearEnemies();
  await page.evaluate(() => { window.__gk.player.position.set(12, 0, 30); window.__gk.spawn('skeleton', 0.5, 2.5); window.__gk.spawn('knight', -1, 2.5); });
  await page.waitForTimeout(3500);
  log('puerta', await state(), await enemies());
  check('el que llega a la puerta le pega una vez y desaparece', (await state()).gate === 300 - 20 - 50 && (await state()).alive === 0);
  await page.screenshot({ path: 'logs/k10-puerta.png' });

  // --- gólem: se planta y le tira una piedra a la puerta ---
  await clearEnemies();
  const gateBefore = await page.evaluate(() => { const g = window.__gk; g.gateHp = 300; g.player.position.set(14, 0, 45); const e = g.spawn('golem', 0, 22.2); e.castTimer = 0.3; return g.gateHp; });
  await page.waitForFunction((hp) => window.__gk.gateHp < hp, gateBefore, { timeout: 20000 }).catch(() => console.log('  (la piedra no llegó)'));
  await page.screenshot({ path: 'logs/k10b-piedra.png' });
  log('gólem', await enemies(), await state());

  // --- todos los tipos juntos, para ver modelos y escala ---
  await clearEnemies();
  await resetPlayer();
  await still('golem', 0, 21);
  await still('knight', 5, 17);
  await still('warrior', 2.5, 15);
  await still('skeleton', -2.5, 15);
  await still('kamikaze', -5, 17);
  await still('goblin', 7.5, 15);
  await still('wraith', -7.5, 15, { speed: 0 });
  await still('shaman', 10, 19);
  await page.evaluate(() => { for (const e of window.__gk.horde.enemies) if (e.stats.kind === 'wraith') e.target = 'gate'; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'logs/k11-todos.png' });

  // --- gesto de ataque por código: captura de cerca con el brazo arriba ---
  await clearEnemies();
  await page.evaluate(() => { const g = window.__gk; g.player.position.set(0, 0, 9); g.player.hp = 100; const e = g.spawn('skeleton', -1.4, 9.2); e.stats = { ...e.stats, damage: 0 }; g.closeup = true; });
  await page.waitForFunction(() => { const e = window.__gk.horde.enemies.at(-1); return e.state === 'attack' && e.attackTime > 0.3; }, null, { timeout: 8000, polling: 'raf' }).catch(() => {});
  await page.screenshot({ path: 'logs/k12-ataque.png' });

  // --- skins: el botón recorre los cuatro modelos sin tocar la partida (ni los palos habilitados) ---
  await clearEnemies();
  await page.evaluate(() => { window.__gk.player.position.set(0, 0, 9); window.__gk.player.hp = 100; window.__gk.closeup = true; });
  await playerFree();
  for (let i = 0; i < 4; i++) {
    const before = await page.textContent('#skin');
    await page.click('#skin');
    // la primera vez que se usa un skin hay que bajar su GLB: se espera al cambio, no un tiempo fijo
    await page.waitForFunction((l) => document.getElementById('skin').textContent !== l, before, { timeout: 30000 });
    await page.waitForTimeout(500);
    const label = await page.textContent('#skin');
    const info = await page.evaluate(() => ({ clips: [...window.__gk.player.swingClips.keys()], hp: window.__gk.player.hp, palos: window.__gk.player.unlocked.size }));
    console.log('skin ->', label, info);
    check('el cambio de skin conserva los palos', info.palos === 4);
    await page.screenshot({ path: `logs/k13-skin${i}.png` });
  }
  await page.evaluate(() => { window.__gk.closeup = false; });

  // --- pausa ---
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  console.log('pausa ->', await page.evaluate(() => window.__gk.paused));
  await page.keyboard.press('Escape');

  // --- oleada real: soltar al director y dejar correr ---
  await clearEnemies();
  await page.evaluate(() => { window.__gk.director.timer = 0.1; });
  await page.waitForTimeout(9000);
  log('oleada 1 en curso', await state());
  await page.screenshot({ path: 'logs/k14-oleada.png' });

  // --- derrota forzada ---
  await page.evaluate(() => { window.__gk.gateHp = 1; window.__gk.player.hp = 100; window.__gk.player.position.set(14, 0, 40); window.__gk.spawn('skeleton', 0, 1.2); });
  await page.waitForFunction(() => window.__gk.ended, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  log('final', await state());
  await page.screenshot({ path: 'logs/k15-final.png' });
}
console.log(errors.length ? `ERRORES DE PÁGINA: ${errors.length}` : 'sin errores de página');
console.log(failures.length ? `FALLAS (${failures.length}): ${failures.join(' | ')}` : 'todas las comprobaciones pasaron');
await browser.close();
await server.close();
process.exit(errors.length || failures.length ? 1 : 0);
