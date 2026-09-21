// Prueba automática del juego: salta la intro y prueba cada mecánica contra enemigos puestos a mano:
// palos bloqueados, cartel de palo nuevo, palo en cola, medidor y niveles de carga, puestos y pelotas,
// driver, hielo, vendaval, chamán, tótems del putter, alma en pena, vida, puerta, pausa y final.
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
    kills: s.kills, shots: s.shots, fps: s.fps, ended: s.ended,
  };
});
const enemies = () => page.evaluate(() => window.__gk.horde.enemies.map((e) => {
  const flags = [e.chilled ? 'frío' : '', e.warded ? 'inmune' : '', e.grabbing ? 'agarrando' : ''].filter(Boolean).join(' ');
  return `${e.stats.kind}#${e.id} hp${e.hp} ${e.state}${flags ? ' ' + flags : ''} (${e.position.x.toFixed(1)},${e.position.z.toFixed(1)})`;
}));
const aimAt = async (x, z) => {
  const p = await page.evaluate(([x, z]) => window.__gk.screenOf(x, z), [x, z]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(80);
};
const ballsDone = (maxMs = 6000) => page.waitForFunction(() => window.__gk.balls.list.length === 0, null, { timeout: maxMs }).catch(() => {});
const playerFree = () => page.waitForFunction(() => window.__gk.player.mode === 'free' && window.__gk.player.atSpot, null, { timeout: 8000 }).catch(() => {});
/** Deja una pelota en el puesto donde está parado el golfista: sin pelota no se puede ni cargar. */
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
/** Tiro de driver cargado justo hasta un nivel (1 a 3), sin llegar al crítico. */
const driveLevel = async (level, maxMs = 6000) => {
  await page.keyboard.press('Digit1');
  await playerFree();
  await give();
  await page.evaluate((p) => window.__gk.shootPower(p), (level - 1) / 3 + 0.02);
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
  return e ? { hp: e.hp, alive: e.alive, chilled: e.chilled, warded: e.warded, casting: e.casting, grabbing: e.grabbing, x: +e.position.x.toFixed(2), z: +e.position.z.toFixed(2) } : null;
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
  // con easing: más lento que antes (0.17 s), pero sigue siendo ágil
  check('correr un puesto lleva entre un cuarto de segundo y uno', tArrive - t0 > 0.25 && tArrive - t0 < 1);
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyA');
  await playerFree();
  const twoSteps = await where();
  log('dos toques (A A)', twoSteps);
  check('dos toques seguidos son dos puestos', twoSteps.puesto === center + 1 && twoSteps.x === 4);
  const height = () => page.evaluate(() => window.__gk.aimHeight);
  const h0 = await height();
  await page.keyboard.press('KeyW');
  const hUp = await height();
  await page.keyboard.press('KeyS');
  await page.keyboard.press('KeyS');
  const hDown = await height();
  for (let i = 0; i < 6; i++) await page.keyboard.press('KeyS');
  const hFloor = await height();
  for (let i = 0; i < 9; i++) await page.keyboard.press('KeyW');
  const hTop = await height();
  log('altura del tiro', { normal: h0, arriba: hUp, abajo: hDown, piso: hFloor, techo: hTop });
  check('W sube y S baja la altura del tiro, de a un escalón', hUp === h0 + 1 && hDown === h0 - 1);
  check('la altura se planta en los extremos', hFloor === 0 && hTop === 3);
  for (let i = 0; i < 2; i++) await page.keyboard.press('KeyS');
  check('W y S no mueven al golfista', (await where()).z === 9 && (await where()).x === 4);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  await playerFree();
  const held = await where();
  log('D apretado', held);
  check('mantener apretado mueve un solo puesto', held.puesto === center);

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
  await page.mouse.down();
  await page.waitForTimeout(200);
  const noBall = await state();
  await page.mouse.up();
  await page.waitForTimeout(200);
  log('sin pelota', noBall);
  check('sin pelota en el puesto no se puede ni empezar a cargar', noBall.mode === 'free' && (await state()).shots === shotsBefore);
  // no se apunta para atrás: con el mouse abajo de todo, la puntería sigue mirando al campo
  await page.mouse.move(200, 710);
  await page.waitForTimeout(150);
  const backAim = await page.evaluate(() => { const g = window.__gk; return { z: +g.player.aimDir.z.toFixed(2), punto: g.aim }; });
  log('apuntar para atrás', backAim);
  check('no se puede apuntar para atrás, pero sí de costado: el arco es de 180 grados', Math.abs(backAim.z) < 0.06 && backAim.punto[1] >= 9);
  // si el botón sigue apretado, la carga arranca sola al llegar a un puesto con pelota
  await resetPlayer();
  await aimAt(0, 40);
  await page.evaluate(() => { const g = window.__gk; for (const s of g.tees.spots) s.ball = false; g.tees.place(g.tees.centerIndex - 1); });
  await page.mouse.down();
  await page.waitForTimeout(150);
  const heldNoBall = (await state()).mode;
  await page.keyboard.press('KeyD');
  await page.waitForFunction(() => window.__gk.player.mode === 'charging', null, { timeout: 3000 }).catch(() => {});
  const heldArrived = await page.evaluate(() => ({ mode: window.__gk.player.mode, puesto: window.__gk.player.spotIndex, llego: window.__gk.player.atSpot }));
  log('cargar apretado', { antes: heldNoBall }, heldArrived);
  check('con el botón apretado, la carga arranca sola al llegar a un puesto con pelota', heldNoBall === 'free' && heldArrived.mode === 'charging' && heldArrived.llego);
  // S clava el daño: la barra queda quieta y el tiro sale con ese nivel cuando se suelta
  await page.waitForFunction(() => window.__gk.player.meter.power > 0.4, null, { timeout: 3000, polling: 'raf' }).catch(() => {});
  await page.keyboard.press('Space');
  const lockedAt = await page.evaluate(() => window.__gk.player.meter.power);
  await page.waitForTimeout(700);
  const lockedLater = await page.evaluate(() => ({ power: window.__gk.player.meter.power, clavada: window.__gk.player.meter.locked, reach: window.__gk.player.meter.reach, barra: document.getElementById('meter').classList.contains('locked') }));
  log('carga clavada', { al: +lockedAt.toFixed(2) }, lockedLater);
  check('Espacio clava la carga: la barra no se mueve más', lockedLater.clavada && lockedLater.barra && Math.abs(lockedLater.power - lockedAt) < 1e-6 && lockedAt > 0.4 && lockedAt < 0.92);
  check('con la carga clavada el alcance sigue subiendo hasta el tope', lockedLater.reach === 1);
  await page.keyboard.press('KeyX');
  await page.mouse.up();
  await page.waitForTimeout(200);
  await resetPlayer();

  // --- cambiar de palo mientras se carga: cambia en el acto y la carga arranca de nuevo ---
  const clubs = () => page.evaluate(() => ({ club: window.__gk.player.club.id, enCola: window.__gk.player.pendingClub?.id ?? null, mode: window.__gk.player.mode, power: +window.__gk.player.meter.power.toFixed(2) }));
  await aimAt(0, 30);
  await give();
  await page.mouse.down();
  await page.waitForFunction(() => window.__gk.player.meter.power > 0.3, null, { timeout: 3000, polling: 'raf' }).catch(() => {});
  const beforeSwitch = await clubs();
  await page.keyboard.press('Digit3');
  const afterSwitch = await clubs();
  log('cambio cargando', beforeSwitch, afterSwitch);
  await page.screenshot({ path: 'logs/k1b-cambio-cargando.png' });
  check('cambiar de palo mientras se carga cambia en el acto y vuelve a cargar', afterSwitch.club === 'wedge' && afterSwitch.mode === 'charging' && afterSwitch.power < beforeSwitch.power);
  await page.mouse.up();
  await playerFree();
  await page.waitForTimeout(150);
  await give();
  const afterShot = await clubs();
  log('tras el tiro', afterShot);
  check('después del tiro con el wedge vuelve el driver', afterShot.club === 'driver');
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.keyboard.press('Digit2');
  await page.keyboard.press('KeyX');
  await page.mouse.up();
  await page.waitForTimeout(250);
  const afterCancel = await clubs();
  log('tras cancelar', afterCancel);
  check('el palo elegido mientras cargaba queda al cancelar', afterCancel.club === 'iron' && afterCancel.mode === 'free');
  await ballsDone(15000);

  // --- medidor: el alcance llega al tope y se queda; la carga rebota por todo el rango ---
  await page.keyboard.press('Digit1');
  await give();
  await page.mouse.down();
  await page.waitForFunction(() => window.__gk.player.meter.reach >= 1, null, { timeout: 5000, polling: 'raf' }).catch(() => {});
  let minPower = 1;
  let minReach = 1;
  const ranges = new Set();
  const levels = new Set();
  for (let i = 0; i < 30; i++) {
    const m = await page.evaluate(() => ({ power: window.__gk.player.meter.power, reach: window.__gk.player.meter.reach, range: document.getElementById('range').textContent, cursor: window.__gk.aimLine.color.toString(16) }));
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
  log('medidor', { minimoTrasElTope: +minPower.toFixed(2), alcanceMinimo: minReach, alcances: [...ranges], coloresDeLaLinea: [...levels].sort() });
  check('después del tope la carga rebota por todo el rango', minPower < 0.2);
  check('el alcance llega al máximo y se queda ahí mientras la barra rebota', minReach === 1 && ranges.size === 1 && [...ranges][0] === '60 m');
  // nivel 1 blanco, 2 amarillo, 3 naranja, y rojo en el crítico
  check('la línea de tiro cambia de color con cada nivel', [...levels].every((l) => ['ffffff', 'ffe066', 'ff9a3c', 'ff2d3c'].includes(l)) && ['ffffff', 'ffe066', 'ff9a3c'].every((c) => levels.has(c)));
  check('ya no hay anillo junto al cursor', await page.evaluate(() => !document.getElementById('chargecursor')));
  const tips = [];
  for (const d of [1, 2, 3]) { await page.keyboard.press(`Digit${d}`); await give(); await page.waitForTimeout(150); tips.push(await page.evaluate(() => window.__gk.aimLine)); }
  log('punta de la línea', tips.map((t) => t.tip));
  check('la punta lleva el ícono del palo, salvo con el driver', tips.map((t) => t.tip).join() === 'driver,iron,wedge' && tips.map((t) => t.tipVisible).join() === 'false,true,true');
  await page.keyboard.press('Digit1');
  // la carga arranca lenta: a un tercio del tiempo todavía va por el nivel 1
  await give();
  await page.mouse.down();
  const early = await page.evaluate(() => new Promise((done) => { const g = window.__gk; const t0 = g.clock; const poll = () => (g.clock - t0 >= 0.33 ? done(g.player.meter.power) : requestAnimationFrame(poll)); poll(); }));
  await page.keyboard.press('KeyX');
  await page.mouse.up();
  await page.waitForTimeout(150);
  log('carga a un tercio del tiempo', +early.toFixed(2));
  check('la carga sube lenta al principio', early < 0.2);

  // --- niveles de carga: el nivel es el daño; el swing perfecto es el crítico ---
  await clearEnemies();
  const dummy = await still('golem', 0, 24);
  await aimAt(0, 24);
  const hits = [];
  for (const level of [1, 2, 3]) {
    const hp = (await enemy(dummy)).hp;
    await driveLevel(level);
    hits.push(hp - (await enemy(dummy)).hp);
  }
  const hpBeforePerfect = (await enemy(dummy)).hp;
  await drive(60);
  const perfectHit = hpBeforePerfect - (await enemy(dummy)).hp;
  log('daño por nivel', hits, { perfecto: perfectHit });
  check('el daño del driver es el nivel de carga: 1, 2 o 3', hits.join() === '1,2,3');
  check('el crítico pega 8', perfectHit === 8);

  // --- el driver atraviesa la fila, y ya no hay racha: el daño es el nivel y nada más ---
  // la pelota sale del tee, a un costado del golfista: la fila se arma sobre la línea tee -> cursor
  await clearEnemies();
  await aimAt(0, 40);
  await page.waitForTimeout(300);
  const onLine = async (d) => {
    const [tx, tz] = await page.evaluate(() => window.__gk.tee);
    const len = Math.hypot(0 - tx, 40 - tz);
    return [tx + ((0 - tx) / len) * d, tz + ((40 - tz) / len) * d];
  };
  for (const d of [10, 13, 16]) await still('goblin', ...(await onLine(d)));
  const killsBeforeRow = (await state()).kills;
  await driveLevel(2);
  const rowKills = (await state()).kills - killsBeforeRow;
  log('fila de goblins', { bajas: rowKills });
  check('un tiro de nivel 2 atraviesa la fila y mata a los tres goblins', rowKills === 3);
  await page.screenshot({ path: 'logs/k3-fila.png' });
  // con tres bajas encima, un nivel 2 sigue pegando 2: no hay racha que lo suba
  const tank = await still('knight', ...(await onLine(12)));
  await driveLevel(2);
  log('sin racha', await enemy(tank));
  check('las bajas no suben el daño: después de tres, un nivel 2 sigue sacando 2', (await enemy(tank)).hp === 8);
  check('ya no hay indicador de racha', !(await page.evaluate(() => document.getElementById('streak'))));

  // --- hielo: enfría a los que alcanza; frío = lento y sin escudo (ni a la vista); el daño no cambia ---
  await clearEnemies();
  const shield = await still('warrior', 0, 24);
  await page.waitForTimeout(900);
  await aimAt(0, 24);
  await driveLevel(3, 2500);
  log('escudo vs driver', await enemy(shield));
  check('el escudo frena al driver', (await enemy(shield)).hp === 4);
  await aimAt(2.4, 24);
  await lob(2, 0.5);
  const slowed = await enemy(shield);
  const afterIron = await page.evaluate(() => ({ recarga: +window.__gk.player.cooldowns.iron.toFixed(2), palo: window.__gk.player.club.id }));
  log('hielo: borde', slowed, afterIron);
  check('el hielo enfría a los que alcanza', slowed.chilled);
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
  check('el hielo del centro también enfría, y sigue caminando', iced.chilled && iced.alive);
  await page.screenshot({ path: 'logs/k4-hielo.png' });
  await page.evaluate(() => { window.__gk.horde.enemies.at(-1).chillTimer = 0.01; });
  await page.waitForTimeout(400);
  const thawed = await shieldSeen();
  log('escudo al pasar el hielo', thawed);
  check('cuando se le pasa el hielo el escudo vuelve', thawed.visible && thawed.enAlto);
  // el frío no cambia el daño: un nivel 3 le saca 3 a un caballero, esté frío o no
  await clearEnemies();
  const warm = await still('knight', 0, 24);
  await aimAt(0, 24);
  await driveLevel(3, 2500);
  const warmHp = (await enemy(warm)).hp;
  await clearEnemies();
  const cold = await still('knight', 0, 24);
  await aimAt(2.6, 24);
  await lob(2, 0.5);
  const coldBefore = await enemy(cold);
  await aimAt(0, 24);
  await driveLevel(3, 2500);
  const coldAfter = await enemy(cold);
  log('frío: nivel 3 al caballero', { sinFrio: warmHp, conFrio: coldAfter.hp });
  check('un enemigo frío recibe el mismo daño que uno sin frío', coldBefore.chilled && warmHp === 7 && coldAfter.hp === 7);
  // el caballero es la excepción: aguanta un crítico
  await clearEnemies();
  const big = await still('knight', 0, 24);
  const small = await still('skeleton', 0, 30);
  await aimAt(0, 24);
  await drive(60, 2500);
  log('crítico', { caballero: await enemy(big), esqueleto: await enemy(small) });
  check('el crítico mata a un esqueleto de un golpe', !(await enemy(small))?.alive);
  check('el caballero aguanta un crítico: le quedan 2', (await enemy(big)).hp === 2);
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

  /** Con el wedge en la mano y apuntando a (x, z): la línea del tiro, y cómo pasar a sus coordenadas. */
  const shotLine = async (wantX, wantZ) => {
    await page.keyboard.press('Digit3');
    await playerFree();
    // la cámara acompaña a la puntería: se apunta, se la deja llegar, y se vuelve a apuntar. El centro es
    // adonde apunta el juego de verdad, no adonde se quiso apuntar
    await aimAt(wantX, wantZ);
    await page.waitForTimeout(900);
    await aimAt(wantX, wantZ);
    await page.waitForTimeout(400);
    const [x, z] = await page.evaluate(() => window.__gk.aim);
    const [tx, tz] = await page.evaluate(() => window.__gk.tee);
    const len = Math.hypot(x - tx, z - tz);
    const along = [(x - tx) / len, (z - tz) / len];
    const side = [along[1], -along[0]];
    return {
      along,
      /** punto del campo a `f` metros a lo largo de la línea y `l` hacia el costado, desde donde cae */
      at: (f, l) => [x + along[0] * f + side[0] * l, z + along[1] * f + side[1] * l],
      /** [a lo largo, hacia el costado] de un punto del campo */
      of: (e) => [(e.x - x) * along[0] + (e.z - z) * along[1], (e.x - x) * side[0] + (e.z - z) * side[1]].map((v) => +v.toFixed(2)),
    };
  };

  // --- wedge: llega rápido, empuja hacia afuera sin dañar; el daño que reciben después no cambia ---
  await clearEnemies();
  const ringLine = await shotLine(0, 24);
  const ringAt = [[0, -1.2], [0, 1.2], [1.2, 0.4], [-1.2, -0.4]];
  const ring = [];
  for (const [f, l] of ringAt) ring.push(await still('skeleton', ...ringLine.at(f, l)));
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
  // el empujón se frena solo: hay que darle tiempo a que termine de correr antes de medir
  await page.waitForTimeout(1800);
  const pushed = [];
  for (const id of ring) pushed.push(await enemy(id));
  log('wedge', { vuelo: flight }, pushed.map((e) => [e.hp, e.x, e.z]));
  check('el wedge llega en menos de un segundo', flight < 1);
  check('después del wedge también vuelve solo el driver', (await state()).club === 'driver');
  check('el wedge no daña', pushed.every((e) => e.hp === 4));
  log('wedge: en la línea', pushed.map((e) => ringLine.of(e)));
  // dos a la misma profundidad no pueden quedar en el mismo punto: se frenan hombro con hombro (los
  // enemigos no se enciman), así que quedan pegados a la línea, uno de cada lado
  check('el wedge los junta sobre la línea del tiro', pushed.every((e, i) => Math.abs(ringLine.of(e)[1]) < Math.max(0.55, Math.abs(ringAt[i][1]) * 0.45)));
  check('el wedge mueve solo de costado: nadie avanza ni retrocede', pushed.every((e, i) => Math.abs(ringLine.of(e)[0] - ringAt[i][0]) < 0.3));
  // tres desparramados del mismo lado terminan todos sobre la línea
  await clearEnemies();
  const trioLine = await shotLine(0, 24);
  const trio = [];
  for (const [f, l] of [[-1.5, 0.8], [0, 2.4], [1.5, 4.2]]) trio.push(await still('skeleton', ...trioLine.at(f, l)));
  await lob(3, 0.8);
  await page.waitForTimeout(900);
  const column = [];
  for (const id of trio) column.push(await enemy(id));
  log('wedge: columna', column.map((e) => trioLine.of(e)));
  check('el wedge los deja a los tres parados sobre la línea del tiro', column.every((e) => Math.abs(trioLine.of(e)[1]) < 0.5));
  // el rectángulo sale de la línea del tiro: en un tiro cruzado, empuja perpendicular a esa línea y
  // los deja en una fila paralela al tiro. Y un caballero se mueve lo mismo que un goblin.
  await clearEnemies();
  const crossLine = await shotLine(10, 21);
  const slanted = [];
  for (const [kind, f, l] of [['goblin', -2, 1], ['knight', 0, 2.5], ['skeleton', 2, 4]]) slanted.push(await still(kind, ...crossLine.at(f, l)));
  await lob(3, 0.8);
  await page.waitForTimeout(900);
  const lateral = [];
  for (const id of slanted) lateral.push(crossLine.of(await enemy(id))[1]);
  log('wedge cruzado', { linea: crossLine.along.map((v) => +v.toFixed(2)), lateral });
  check('en un tiro cruzado también los junta sobre la línea del tiro', lateral.every((l) => Math.abs(l) < 0.6));
  check('el caballero llega igual que los demás, pese a ser pesado', Math.abs(lateral[1] - lateral[0]) < 0.5);
  await page.screenshot({ path: 'logs/k5d-cruzado.png' });
  await page.screenshot({ path: 'logs/k5c-columna.png' });
  await page.screenshot({ path: 'logs/k5-wedge.png' });
  await clearEnemies();
  const opened = await still('knight', 0, 24);
  await aimAt(0, 24);
  await lob(3, 0.96);
  await page.waitForTimeout(900);
  const shovedTo = await enemy(opened);
  await aimAt(shovedTo.x, shovedTo.z);
  await driveLevel(2, 2500);
  const openHit = 10 - (await enemy(opened)).hp;
  log('wedge perfecto', { nivel2: openHit });
  check('el wedge perfecto tampoco cambia el daño: un nivel 2 saca 2', openHit === 2);

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

  // --- jefe: con frío encima tira piedras más despacio ---
  await clearEnemies();
  await page.evaluate(() => { const g = window.__gk; g.gateHp = 10; const e = g.spawn('golem', 0, 22.2); e.castTimer = 50; });
  await page.waitForTimeout(1200);
  await aimAt(0, 22.2);
  await lob(2, 0.5);
  const bossIced = await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); return { chilled: e.chilled, cast: e.castTimer, age: e.age }; });
  await page.waitForTimeout(1500);
  const bossLater = await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); return { cast: e.castTimer, age: e.age, chilled: e.chilled }; });
  const castRate = (bossIced.cast - bossLater.cast) / (bossLater.age - bossIced.age);
  log('gólem con hielo', bossIced, { ritmoDeAtaque: +castRate.toFixed(2) });
  check('al jefe el hielo también lo enfría', bossIced.chilled);
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

  // --- putter: rueda lento, deja un tótem, y el driver lo detona ---
  await clearEnemies();
  await resetPlayer();
  await page.evaluate(() => { window.__gk.traps.clear(); window.__gk.player.cooldowns.putter = 0; });
  await aimAt(0, 26);
  await page.keyboard.press('KeyF');
  await playerFree();
  await give();
  const putt = await page.evaluate(() => new Promise((done) => {
    const g = window.__gk;
    g.shootPower(0.8);
    const t0 = g.clock;
    let top = 0;
    const poll = () => {
      const b = g.balls.list[0];
      if (b) top = Math.max(top, Math.hypot(b.state.vel.x, b.state.vel.z));
      if (g.traps.list.length) done({ segundos: +(g.clock - t0).toFixed(1), rapidez: +top.toFixed(1), dano: g.traps.list[0].damage, z: +g.traps.list[0].pos.z.toFixed(1) });
      else requestAnimationFrame(poll);
    };
    poll();
  }));
  const putterCd = await page.evaluate(() => +window.__gk.player.cooldowns.putter.toFixed(1));
  log('putter', putt, { recarga: putterCd });
  await page.screenshot({ path: 'logs/k7-putter.png' });
  check('la pelota del putter rueda lento', putt.rapidez < 14);
  check('tarda en frenar: rueda un rato largo', putt.segundos > 1.5);
  check('donde para deja un tótem, con el daño de la carga', putt.dano === 4 && putt.z > 20);
  check('el putter queda recargando', putterCd > 2);
  check('después del putter vuelve solo el driver', (await state()).club === 'driver');
  // detonarlo con el driver: daño en área y a todos hacia afuera
  const near = [];
  for (const [x, z] of [[0, 26], [3, 27], [-3, 25]]) near.push(await still('goblin', x, z));
  const trapAt = await page.evaluate(() => [window.__gk.traps.list[0].pos.x, window.__gk.traps.list[0].pos.z]);
  await aimAt(...trapAt);
  await drive(40, 3000);
  await page.waitForTimeout(700);
  const hitByTrap = [];
  for (const id of near) hitByTrap.push(await enemy(id));
  log('tótem detonado', hitByTrap.map((e) => (e && e.alive ? e.hp : "muerto")), await page.evaluate(() => window.__gk.traps.list.length));
  check('el driver lo detona y no queda ningún tótem', (await page.evaluate(() => window.__gk.traps.list.length)) === 0);
  check('la explosión del tótem mata a los que tiene encima', hitByTrap.filter((e) => !e || !e.alive).length >= 2);
  await page.screenshot({ path: 'logs/k7b-totem.png' });
  // no puede haber más de tres a la vez
  await clearEnemies();
  await page.evaluate(() => { const g = window.__gk; g.traps.clear(); for (let i = 0; i < 5; i++) g.traps.place(g.player.position.clone().setZ(20 + i * 2), 0.5, false); });
  const many = await page.evaluate(() => window.__gk.traps.list.length);
  log('tope de tótems', many);
  check('nunca hay más de tres tótems', many <= 3);
  await page.evaluate(() => window.__gk.traps.clear());

  // --- alma en pena: atrapa, saca vida de a poco, y el palazo la saca de encima ---
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
  await page.evaluate(() => { window.__gk.player.meleeCooldown = 0; });
  await page.keyboard.press('ShiftLeft');
  await page.waitForTimeout(500);
  const freed = await page.evaluate(() => ({ libre: !window.__gk.player.grabbedBy }));
  log('liberado', freed, await enemy(wraith));
  check('el palazo la saca de encima', freed.libre && !(await enemy(wraith)).grabbing);

  // --- kamikazes  // --- kamikazes: uno muere y se lleva a los otros ---
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

  // --- palazo: botón aparte (Shift), con recarga; no hace daño, solo empuja, y llega a 4 m ---
  await clearEnemies();
  await resetPlayer();
  const close = await still('skeleton', 0.4, 10.6);
  const farther = await still('skeleton', -2.6, 12.4);
  await aimAt(0, 30);
  await page.keyboard.press('ShiftLeft');
  await page.waitForFunction(() => window.__gk.player.mode === 'free', null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(100);
  const afterMelee = await enemy(close);
  const meleeCd = await page.evaluate(() => window.__gk.player.meleeCooldown);
  await page.screenshot({ path: 'logs/k9b-palazo.png' });
  await page.keyboard.press('ShiftLeft');
  await page.waitForTimeout(400);
  log('palazo', afterMelee, { recarga: +meleeCd.toFixed(1) });
  await page.waitForTimeout(900);
  const flung = await enemy(close);
  log('palazo: empujón', flung);
  check('el palazo no hace daño', afterMelee.hp === 4 && (await enemy(farther)).hp === 4);
  check('el palazo alcanza a uno a más de 3 m', (await enemy(farther)).z - 12.4 > 8);
  check('el palazo manda al enemigo unos 15 m hacia atrás', flung.z - 10.6 > 12 && flung.z - 10.6 < 18);
  check('el palazo tiene recarga', meleeCd > 0);

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
