// Prueba automática del juego: salta la intro y prueba cada mecánica contra enemigos puestos a mano:
// palos bloqueados, cartel de palo nuevo, palo en cola, medidor y niveles de carga, puestos y pelotas,
// driver y racha, hielo, empujón, chamán, putter, alma en pena, vida, puerta, pausa y final.
// Sale con error si alguna comprobación falla. Capturas en logs/.
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
  const flags = [e.frozen ? 'congelado' : e.chilled ? 'frío' : '', e.warded ? 'inmune' : '', e.grabbing ? 'agarrando' : ''].filter(Boolean).join(' ');
  return `${e.stats.kind}#${e.id} hp${e.hp} ${e.state}${flags ? ' ' + flags : ''} (${e.position.x.toFixed(1)},${e.position.z.toFixed(1)})`;
}));
const aimAt = async (x, z) => {
  const p = await page.evaluate(([x, z]) => window.__gk.screenOf(x, z), [x, z]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(80);
};
const ballsDone = (maxMs = 6000) => page.waitForFunction(() => window.__gk.balls.list.length === 0, null, { timeout: maxMs }).catch(() => {});
const playerFree = () => page.waitForFunction(() => window.__gk.player.mode === 'free' && window.__gk.player.atSpot, null, { timeout: 8000 }).catch(() => {});
/** Deja una pelota en el puesto donde está parado el golfista: sin pelota el swing sale al aire. */
const give = () => page.evaluate(() => { const g = window.__gk; g.tees.place(g.tees.nearest(g.player.position.x)); });
/** Tiro de driver con alcance exacto en metros (18 = sin carga, 60 = a fondo y perfecto). Espera a que la pelota termine. */
const drive = async (meters, maxMs = 6000) => {
  await page.keyboard.press('Digit1');
  await playerFree();
  await give();
  await page.evaluate((m) => window.__gk.shoot(m), meters);
  await playerFree();
  await ballsDone(maxMs);
};
/** Tiro de driver cargado justo hasta un nivel (1 a 5), sin llegar al swing perfecto. */
const driveLevel = async (level, maxMs = 6000) => {
  await page.keyboard.press('Digit1');
  await playerFree();
  await give();
  await page.evaluate((p) => window.__gk.shootPower(p), (level - 1) / 5 + 0.02);
  await playerFree();
  await ballsDone(maxMs);
};
/** Globo (hierro 2, wedge 3) con potencia exacta; cae donde apunta el mouse. Espera la recarga si hace falta. */
const lob = async (digit, power) => {
  await page.keyboard.press(`Digit${digit}`);
  await playerFree();
  await page.waitForFunction(() => window.__gk.player.cooldowns[window.__gk.player.club.id] <= 0, null, { timeout: 5000 });
  await give();
  await page.evaluate((p) => window.__gk.shootPower(p), power);
  await playerFree();
  await ballsDone();
};
const log = (label, ...parts) => console.log(label.padEnd(22), '->', parts.map((p) => JSON.stringify(p)).join('  '));
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
/** Vuelve al golfista al puesto del medio y espera a que la cámara termine de seguirlo: aimAt convierte un
 * punto del campo a un píxel con la cámara de ese momento, y si la cámara sigue viajando la puntería se corre. */
const resetPlayer = async () => {
  await page.evaluate(() => { const g = window.__gk; g.player.hp = 3; g.player.placeAt(g.tees.centerIndex); g.player.cooldowns.putter = 0; g.player.meleeCooldown = 0; });
  await page.waitForTimeout(1600);
};
/** Frena al director de oleadas para probar con enemigos puestos a mano. */
const holdWaves = () => page.evaluate(() => { window.__gk.director.timer = 9999; });

await page.goto('http://localhost:5198/');
await page.evaluate(() => localStorage.removeItem('gk.globos'));
await page.reload();
await page.screenshot({ path: 'logs/k0-intro.png' });
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
console.log('alturas medidas de los modelos:', JSON.stringify(await page.evaluate(() => window.__gk.measured)));
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
  const locked = await page.evaluate(() => ({ club: window.__gk.player.club.id, palos: [...window.__gk.player.unlocked], x: window.__gk.player.position.x }));
  log('bloqueados', locked);
  check('al empezar solo hay driver', locked.club === 'driver' && locked.palos.length === 1 && locked.x === 0);
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

  // --- puestos: solo se mueve de costado, un toque = un puesto, dos toques = dos; W y S no hacen nada ---
  const where = () => page.evaluate(() => { const p = window.__gk.player; return { x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2), puesto: p.spotIndex, llego: p.atSpot }; });
  const center = await page.evaluate(() => window.__gk.tees.centerIndex);
  const t0 = await page.evaluate(() => window.__gk.clock);
  await page.keyboard.press('KeyD');
  const tArrive = await page.evaluate(() => new Promise((done) => { const poll = () => (window.__gk.player.atSpot ? done(window.__gk.clock) : requestAnimationFrame(poll)); poll(); }));
  const oneStep = await where();
  log('un paso (D)', oneStep, { segundos: +(tArrive - t0).toFixed(2) });
  check('D lo lleva un puesto a la derecha de la pantalla (-X)', oneStep.puesto === center - 1 && oneStep.x === -4 && oneStep.z === 9);
  check('correr un puesto lleva menos de un tercio de segundo', tArrive - t0 < 0.34);
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyA');
  await playerFree();
  const twoSteps = await where();
  log('dos toques (A A)', twoSteps);
  check('dos toques seguidos son dos puestos', twoSteps.puesto === center + 1 && twoSteps.x === 4);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyS');
  check('no avanza ni retrocede', (await where()).z === 9 && (await where()).x === 4);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  await playerFree();
  const held = await where();
  log('D apretado', held);
  check('mantener apretado sigue de largo varios puestos', held.puesto <= center - 1);

  // --- pelotas: nunca más de tres, nunca en el puesto del golfista, y llegan más rápido cuando faltan ---
  await resetPlayer();
  await page.evaluate(() => { for (const s of window.__gk.tees.spots) s.ball = false; });
  const refill = await page.evaluate(() => new Promise((done) => {
    const g = window.__gk;
    const start = g.clock;
    const at = [];
    let worst = 0;
    let underFoot = false;
    const poll = () => {
      const n = g.tees.loaded;
      worst = Math.max(worst, n + g.tees.spots.filter((s) => s.incoming).length);
      if (g.tees.hasBall(g.player.spotIndex)) underFoot = true;
      while (at.length < n) at.push(+(g.clock - start).toFixed(2));
      if (g.clock - start > 5.5) done({ llegadas: at, maximo: worst, enSuPuesto: underFoot });
      else requestAnimationFrame(poll);
    };
    poll();
  }));
  log('pelotas', refill);
  await page.screenshot({ path: 'logs/k2a-pelotas.png' });
  check('siempre vuelve a haber pelotas, y nunca más de tres', refill.llegadas.length === 3 && refill.maximo === 3);
  check('con menos pelotas, la siguiente llega más rápido', refill.llegadas[0] < refill.llegadas[2] - refill.llegadas[1]);
  check('las pelotas nunca caen en el puesto del golfista', !refill.enSuPuesto);
  const shotsBefore = (await state()).shots;
  await page.evaluate(() => window.__gk.shootPower(0.3));
  await playerFree();
  log('sin pelota', await state());
  check('sin pelota en el puesto, el swing sale al aire', (await state()).shots === shotsBefore);

  // --- palo en cola: elegido en medio de un tiro, entra cuando el tiro termina o se cancela ---
  const clubs = () => page.evaluate(() => ({ club: window.__gk.player.club.id, enCola: window.__gk.player.pendingClub?.id ?? null, mode: window.__gk.player.mode }));
  await aimAt(0, 40);
  await give();
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

  // --- medidor: el alcance llega al tope y se queda; la carga rebota entre los niveles 5 y 3 ---
  await page.keyboard.press('Digit1');
  await give();
  await page.mouse.down();
  await page.waitForFunction(() => window.__gk.player.meter.reach >= 1, null, { timeout: 5000, polling: 'raf' }).catch(() => {});
  let minPower = 1;
  let minReach = 1;
  const ranges = new Set();
  const levels = new Set();
  for (let i = 0; i < 30; i++) {
    const m = await page.evaluate(() => ({ power: window.__gk.player.meter.power, reach: window.__gk.player.meter.reach, range: document.getElementById('range').textContent, cursor: document.getElementById('chargecursor').hidden ? null : document.getElementById('chargecursor').dataset.level }));
    minPower = Math.min(minPower, m.power);
    minReach = Math.min(minReach, m.reach);
    ranges.add(m.range);
    levels.add(m.cursor);
    await page.waitForTimeout(60);
  }
  await page.screenshot({ path: 'logs/k2-medidor.png' });
  await page.keyboard.press('KeyX');
  await page.mouse.up();
  await page.waitForTimeout(200);
  log('medidor', { minimoTrasElTope: +minPower.toFixed(2), alcanceMinimo: minReach, alcances: [...ranges], nivelesEnElCursor: [...levels].sort() });
  check('la carga no baja del nivel 3 después del tope', minPower >= 0.39);
  check('el alcance llega al máximo y se queda ahí mientras la barra rebota', minReach === 1 && ranges.size === 1 && [...ranges][0] === '60 m' && minPower < 0.95);
  check('el anillo junto al cursor muestra el nivel, entre 3 y 5', [...levels].every((l) => ['3', '4', '5'].includes(l)) && levels.has('5') && levels.has('3'));
  check('al cancelar, el anillo del cursor desaparece', await page.evaluate(() => document.getElementById('chargecursor').hidden));

  // --- niveles de carga: el nivel es el daño; el swing perfecto lo duplica ---
  await clearEnemies();
  const dummy = await still('golem', 0, 24);
  await aimAt(0, 24);
  const hits = [];
  for (const level of [1, 2, 3, 4, 5]) {
    const hp = (await enemy(dummy)).hp;
    await driveLevel(level);
    hits.push(hp - (await enemy(dummy)).hp);
  }
  const hpBeforePerfect = (await enemy(dummy)).hp;
  await drive(60);
  const perfectHit = hpBeforePerfect - (await enemy(dummy)).hp;
  log('daño por nivel', hits, { perfecto: perfectHit });
  check('el daño del driver es el nivel de carga, de 1 a 5', hits.join() === '1,2,3,4,5');
  check('el swing perfecto pega el doble', perfectHit === 10);

  // --- racha del driver: sube al matar, se mantiene al pegar sin matar, se corta si no daña a nadie ---
  // la pelota sale del tee, a un costado del golfista: la fila se arma sobre la línea tee -> cursor
  await clearEnemies();
  await aimAt(-14, 30);
  await drive(18, 4000);
  await aimAt(0, 40);
  await page.waitForTimeout(300);
  const onLine = async (d) => {
    const [tx, tz] = await page.evaluate(() => window.__gk.tee);
    const len = Math.hypot(0 - tx, 40 - tz);
    return [tx + ((0 - tx) / len) * d, tz + ((40 - tz) / len) * d];
  };
  for (const d of [10, 13, 16]) await still('goblin', ...(await onLine(d)));
  await driveLevel(2);
  const afterRow = await state();
  log('racha: fila', await enemies(), afterRow);
  check('un tiro de nivel 2 atraviesa la fila de goblins y suma una baja por cada uno', afterRow.streak === 3);
  await page.screenshot({ path: 'logs/k3-racha.png' });
  const tank = await still('knight', ...(await onLine(12)));
  await driveLevel(2);
  const afterHit = await state();
  log('racha: pega sin matar', afterHit, await enemy(tank));
  check('pegar sin matar mantiene la racha', afterHit.streak === 3 && (await enemy(tank)).hp < 5);
  await clearEnemies();
  await driveLevel(2, 4000);
  const afterMiss = await state();
  log('racha: en blanco', afterMiss);
  check('un tiro de driver que no daña a nadie corta la racha', afterMiss.streak === 0);
  await still('goblin', ...(await onLine(8)));
  await drive(60);
  const afterPerfect = await state();
  log('racha: baja perfecta', afterPerfect);
  check('una baja con swing perfecto suma tres', afterPerfect.streak === 3);
  await aimAt(-14, 30);
  await drive(18, 4000);

  // --- hielo: congela en el centro y enfría alrededor; frío = sin escudo (ni a la vista) y más daño ---
  await clearEnemies();
  const shield = await still('warrior', 0, 24);
  await page.waitForTimeout(900);
  await aimAt(0, 24);
  await driveLevel(3, 2500);
  log('escudo vs driver', await enemy(shield));
  check('el escudo frena al driver', (await enemy(shield)).hp === 4);
  check('un tiro que solo rebota en un escudo corta la racha', (await state()).streak === 0);
  await aimAt(2.4, 24);
  await lob(2, 0.5);
  const slowed = await enemy(shield);
  const afterIron = await page.evaluate(() => ({ recarga: +window.__gk.player.cooldowns.iron.toFixed(2), palo: window.__gk.player.club.id }));
  log('hielo: borde', slowed, afterIron);
  check('en el borde el hielo enfría pero no congela', slowed.chilled && !slowed.frozen);
  const shieldSeen = () => page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); return { visible: e.shieldMesh.visible, enAlto: e.shieldUp }; });
  const coldShield = await shieldSeen();
  log('escudo con hielo', coldShield);
  check('con hielo encima el escudo desaparece', !coldShield.visible && !coldShield.enAlto);
  check('el hierro queda recargando', afterIron.recarga > 0);
  const cdShown = await page.evaluate(() => { const el = document.querySelector('#clubs .club[data-club=iron]'); return { numero: el.querySelector('.cdnum').textContent, etiqueta: el.querySelector('.cdlabel').textContent, recargando: el.classList.contains('cooling') }; });
  log('recarga en la barra', cdShown);
  check('la barra muestra la recarga del hierro y el número bajando', cdShown.recargando && cdShown.numero !== '' && cdShown.etiqueta.includes('2 s'));
  check('después del hierro vuelve solo el driver', afterIron.palo === 'driver');
  await aimAt(0, 24);
  await driveLevel(1, 2500);
  log('frío: un toque', await enemy(shield));
  check('con frío el escudo ya no frena', (await enemy(shield)).hp === 3);
  await lob(2, 0.5);
  const iced = await enemy(shield);
  log('hielo: centro', iced);
  check('en el centro el hielo congela, sin swing perfecto', iced.frozen);
  check('congelado tampoco tiene escudo', !(await shieldSeen()).visible);
  await page.screenshot({ path: 'logs/k4-hielo.png' });
  await page.evaluate(() => { window.__gk.horde.enemies.at(-1).chillTimer = 0.01; });
  await page.waitForTimeout(400);
  const thawed = await shieldSeen();
  log('escudo al pasar el hielo', thawed);
  check('cuando se le pasa el hielo el escudo vuelve', thawed.visible && thawed.enAlto);
  // frío recibe 25 % más: un nivel 4 (4 de daño) no mata a un caballero de 5, salvo que esté frío
  await clearEnemies();
  const warm = await still('knight', 0, 24);
  await aimAt(0, 24);
  await driveLevel(4, 2500);
  const warmHp = (await enemy(warm)).hp;
  await clearEnemies();
  const cold = await still('knight', 0, 24);
  await aimAt(2.6, 24);
  await lob(2, 0.5);
  await aimAt(0, 24);
  await driveLevel(4, 2500);
  const coldAfter = await enemy(cold);
  log('frío: nivel 4 al caballero', { sinFrio: warmHp, conFrio: coldAfter ? coldAfter.hp : 'muerto' });
  check('un enemigo frío recibe 25 % más de daño', warmHp === 1 && (!coldAfter || !coldAfter.alive));
  // muerto: el escudo tampoco se ve mientras cae
  await clearEnemies();
  await still('warrior', 0, 24);
  await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); window.__gk.horde.damage(e, 9, null, 0); });
  await page.waitForTimeout(250);
  const dying = await page.evaluate(() => { const e = window.__gk.horde.enemies.find((x) => x.stats.kind === 'warrior'); return { estado: e.state, escudo: e.shieldMesh.visible }; });
  log('escudo al morir', dying);
  check('el escudo desaparece cuando el guerrero muere', dying.estado === 'dying' && !dying.escudo);
  // el perfecto llega más lejos: un esqueleto a 4.3 m del centro queda afuera del normal y adentro del perfecto
  await clearEnemies();
  const edge = await still('skeleton', 4.3, 24);
  await aimAt(0, 24);
  await lob(2, 0.5);
  const missed = (await enemy(edge)).chilled;
  await lob(2, 0.96);
  log('hielo perfecto', { normal: missed, perfecto: (await enemy(edge)).chilled });
  check('el hielo perfecto tiene más área', !missed && (await enemy(edge)).chilled);

  // --- wedge: llega rápido, empuja hacia afuera sin dañar; perfecto, además deja expuestos ---
  await clearEnemies();
  const ring = [];
  for (const [x, z] of [[-1.2, 24], [1.2, 24], [0, 25.2], [0, 22.8]]) ring.push(await still('skeleton', x, z));
  await aimAt(0, 24);
  await page.keyboard.press('Digit3');
  await playerFree();
  await give();
  const flight = await page.evaluate(() => new Promise((done) => {
    const g = window.__gk;
    g.shootPower(0.8);
    let t0 = -1;
    const poll = () => {
      if (t0 < 0 && g.balls.list.length) t0 = g.clock;
      if (t0 >= 0 && !g.balls.list.length) done(+(g.clock - t0).toFixed(2));
      else requestAnimationFrame(poll);
    };
    poll();
  }));
  await playerFree();
  await page.waitForTimeout(900);
  const pushed = [];
  for (const id of ring) pushed.push(await enemy(id));
  log('wedge', { vuelo: flight }, pushed.map((e) => [e.hp, e.x, e.z]));
  check('el wedge llega en menos de un segundo', flight < 1);
  check('el wedge no daña', pushed.every((e) => e.hp === 4));
  check('el wedge aleja a todos del centro', pushed.every((e) => Math.hypot(e.x, e.z - 24) > 2.5));
  check('sin perfecto no quedan expuestos', !(await page.evaluate(() => window.__gk.horde.enemies.some((e) => e.exposedTimer > 0))));
  await page.screenshot({ path: 'logs/k5-wedge.png' });
  await clearEnemies();
  const opened = await still('knight', 0, 24);
  await aimAt(0, 24);
  await lob(3, 0.96);
  const exposed = await page.evaluate(() => window.__gk.horde.enemies.at(-1).exposedTimer);
  await driveLevel(2, 2500);
  const openHit = 5 - (await enemy(opened)).hp;
  log('wedge perfecto', { expuesto: +exposed.toFixed(1), nivel2: openHit });
  check('el wedge perfecto deja expuestos', exposed > 0);
  check('un expuesto recibe 50 % más', openHit === 3);
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
  await driveLevel(3, 2500);
  check('el driver no daña al inmune', (await enemy(guarded)).hp === 4);
  await aimAt(0, 27);
  await lob(2, 0.5);
  const silenced = await enemy(shaman);
  log('chamán con hielo', silenced, await enemy(guarded));
  check('el hielo apaga el aura', !silenced.casting && !(await enemy(guarded)).warded);
  await aimAt(3, 23);
  await driveLevel(3, 2500);
  check('sin aura el driver vuelve a dañar', (await enemy(guarded)).hp < 4);

  // --- jefe: el hielo nunca lo congela, pero frío tira piedras más despacio ---
  await clearEnemies();
  await page.evaluate(() => { const g = window.__gk; g.gateHp = 10; const e = g.spawn('golem', 0, 22.2); e.castTimer = 50; });
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
    await playerFree();
    await give();
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

  // --- putter: Espacio teletransporta al puesto más cercano al cursor; después hay recarga ---
  await clearEnemies();
  await resetPlayer();
  await aimAt(11, 22);
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const jumped = await where();
  const putterCd = await page.evaluate(() => +window.__gk.player.cooldowns.putter.toFixed(1));
  log('putter', jumped, { recarga: putterCd });
  await page.screenshot({ path: 'logs/k7-putter.png' });
  check('el putter lleva al puesto más cercano al cursor', jumped.x === 12 && jumped.llego);
  check('el putter queda recargando', putterCd > 7);
  await page.waitForTimeout(1500);
  await aimAt(-12, 22);
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  check('con el putter recargando no se salta', (await where()).x === 12);

  // --- alma en pena: atrapa, saca vida de a poco, y el salto libera ---
  await clearEnemies();
  await resetPlayer();
  const wraith = await page.evaluate(() => window.__gk.spawn('wraith', 3, 15).id);
  await page.waitForFunction(() => window.__gk.player.grabbedBy, null, { timeout: 10000 }).catch(() => console.log('  (no lo atrapó)'));
  await page.keyboard.press('KeyD');
  await page.waitForFunction(() => window.__gk.player.hp < 3, null, { timeout: 8000 }).catch(() => {});
  const grabbed = await state();
  log('atrapado', grabbed, await enemy(wraith));
  check('el alma en pena atrapa, no lo deja moverse y le saca vida', grabbed.hp === 2 && grabbed.pos[0] === 0 && (await enemy(wraith)).grabbing);
  await page.screenshot({ path: 'logs/k8-atrapado.png' });
  await aimAt(-12, 22);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const freed = await page.evaluate(() => ({ libre: !window.__gk.player.grabbedBy, x: window.__gk.player.position.x }));
  log('liberado', freed, await enemy(wraith));
  check('el salto libera del agarre', freed.libre && freed.x === -12 && !(await enemy(wraith)).grabbing);

  // --- vida del golfista: 3 puntos, cada golpe saca 1, y después de un golpe hay un respiro ---
  await clearEnemies();
  await resetPlayer();
  await page.evaluate(() => { window.__gk.spawn('goblin', 1.2, 10.5); window.__gk.spawn('goblin', -1.2, 10.5); });
  await page.waitForFunction(() => window.__gk.player.hp < 3, null, { timeout: 10000 }).catch(() => {});
  const firstHit = await page.evaluate(() => ({ hp: window.__gk.player.hp, invulnerable: window.__gk.player.invulnerable }));
  await page.waitForTimeout(500);
  const stillSafe = await page.evaluate(() => window.__gk.player.hp);
  log('golpe recibido', firstHit, { medioSegundoDespues: stillSafe });
  check('cada golpe saca un punto de los tres', firstHit.hp === 2);
  check('después de un golpe hay un respiro de invulnerabilidad', firstHit.invulnerable && stillSafe === 2);

  // --- kamikazes: uno muere y se lleva a los otros ---
  await clearEnemies();
  await resetPlayer();
  for (const x of [-1.5, 0, 1.5]) await still('kamikaze', x, 22, { damage: 1 });
  await aimAt(0, 22);
  const killsBefore = (await state()).kills;
  await driveLevel(2);
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
  check('el palazo pega 2 de cerca', afterMelee.hp === 2);
  check('el palazo tiene recarga', meleeCd > 0 && (await enemy(close)).hp === 2);
  check('el palazo no toca la racha', (await state()).streak === streakBefore);

  // --- la puerta tiene 10: el que llega le pega una vez y desaparece ---
  await clearEnemies();
  await page.evaluate(() => { const g = window.__gk; g.gateHp = 10; g.spawn('skeleton', 0.5, 2.5); g.spawn('knight', -1, 2.5); });
  await page.waitForTimeout(3500);
  log('puerta', await state(), await enemies());
  check('el que llega a la puerta le pega una vez y desaparece', (await state()).gate === 10 - 1 - 2 && (await state()).alive === 0);
  await page.screenshot({ path: 'logs/k10-puerta.png' });

  // --- gólem: se planta y le tira una piedra a la puerta ---
  await clearEnemies();
  const gateBefore = await page.evaluate(() => { const g = window.__gk; g.gateHp = 10; const e = g.spawn('golem', 0, 22.2); e.castTimer = 0.3; return g.gateHp; });
  await page.waitForFunction((hp) => window.__gk.gateHp < hp, gateBefore, { timeout: 20000 }).catch(() => console.log('  (la piedra no llegó)'));
  await page.screenshot({ path: 'logs/k10b-piedra.png' });
  log('gólem', await enemies(), await state());
  check('la piedra del gólem le saca 1 a la puerta', (await state()).gate === 9);

  // --- todos los tipos juntos, para ver modelos, escala y los cuadraditos de vida ---
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
  await page.evaluate(() => { const g = window.__gk; g.player.hp = 3; const e = g.spawn('skeleton', -1.4, 9.2); e.stats = { ...e.stats, damage: 0 }; g.closeup = true; });
  await page.waitForFunction(() => { const e = window.__gk.horde.enemies.at(-1); return e.state === 'attack' && e.attackTime > 0.3; }, null, { timeout: 8000, polling: 'raf' }).catch(() => {});
  await page.screenshot({ path: 'logs/k12-ataque.png' });

  // --- skins: el botón recorre los cuatro modelos sin tocar la partida (ni los palos ni el puesto) ---
  await clearEnemies();
  await page.evaluate(() => { const g = window.__gk; g.player.hp = 3; g.closeup = true; });
  await playerFree();
  for (let i = 0; i < 4; i++) {
    const beforeLabel = await page.textContent('#skin');
    await page.click('#skin');
    // la primera vez que se usa un skin hay que bajar su GLB: se espera al cambio, no un tiempo fijo
    await page.waitForFunction((l) => document.getElementById('skin').textContent !== l, beforeLabel, { timeout: 30000 });
    await page.waitForTimeout(500);
    const label = await page.textContent('#skin');
    const info = await page.evaluate(() => ({ clips: [...window.__gk.player.swingClips.keys()].length, hp: window.__gk.player.hp, palos: window.__gk.player.unlocked.size, x: window.__gk.player.position.x }));
    console.log('skin ->', label, JSON.stringify(info));
    check('el cambio de skin conserva palos, vida y puesto', info.palos === 4 && info.hp === 3 && info.x === 0);
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
  await page.evaluate(() => { window.__gk.gateHp = 1; window.__gk.player.hp = 3; window.__gk.spawn('skeleton', 0, 1.2); });
  await page.waitForFunction(() => window.__gk.ended, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  log('final', await state());
  check('la partida termina cuando cae la puerta', (await state()).ended === 'defeat');
  await page.screenshot({ path: 'logs/k15-final.png' });
}
console.log(errors.length ? `ERRORES DE PÁGINA: ${errors.length}` : 'sin errores de página');
console.log(failures.length ? `FALLAS (${failures.length}): ${failures.join(' | ')}` : 'todas las comprobaciones pasaron');
await browser.close();
await server.close();
process.exit(errors.length || failures.length ? 1 : 0);
