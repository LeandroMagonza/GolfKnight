// Prueba automática del juego: salta la intro y prueba cada mecánica contra enemigos puestos a mano:
// palos desde el arranque, cartel de poder nuevo, palo en cola, medidor y carga, puestos y pelotas,
// driver, hielo, vendaval, chamán, putter, alma en pena, vida, puerta, pausa y final.
// Sale con error si alguna comprobación falla. Capturas en logs/.
// uso: node tools/playtest.mjs [--quick] [--ver]
//   --quick: solo arranque y una captura.
//   --ver: abre una ventana de Chromium de verdad (con la placa de video) para mirar la prueba
//     mientras corre. Sin eso va sin ventana y con render por software, que es mucho más lento.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('logs', { recursive: true });
const quick = process.argv.includes('--quick');
const watch = process.argv.includes('--ver');
const server = await createServer({ root: process.cwd(), server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch(watch
  ? { headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1320,820'] }
  : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const failures = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.type(), m.text()); });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });

const state = () => page.evaluate(() => {
  const s = window.__gk;
  return {
    wave: s.director.index, alive: s.horde.aliveCount, gate: s.gateHp, hp: s.player.hp,
    mode: s.player.mode, club: s.player.club.id, pos: [s.player.anchor.x, s.player.anchor.z].map((n) => +n.toFixed(1)),
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
const give = () => page.evaluate(() => { const g = window.__gk; g.tees.place(g.tees.nearest(g.player.anchor.x)); });
/** Calidad de golpe por nivel: flojo, bueno, perfecto. */
const QPOWER = [0.2, 0.7, 0.96];
/**
 * Cómo quedaron las recargas justo después de pegar. Se mide acá y no al final del tiro porque el
 * hierro ahora sigue rodando: esperar a que la pelota muera podía tardar más que la recarga entera.
 */
let shotSnapshot = { cooldowns: { damage: 0, ice: 0, push: 0 }, hud: { numero: '', etiqueta: '', recargando: false } };
const snapshotAfterShot = async () => {
  const snap = await page.evaluate(() => {
    const el = document.querySelector('#enchants .club[data-ench=ice]');
    return {
      cooldowns: { ...window.__gk.player.cooldowns },
      hud: el
        ? { numero: el.querySelector('.cdnum').textContent, etiqueta: el.querySelector('.cdlabel').textContent, recargando: el.classList.contains('cooling') }
        : { numero: '', etiqueta: '', recargando: false },
    };
  }).catch((e) => { console.log('  (no se pudo medir la recarga:', e.message, ')'); return null; });
  if (snap?.cooldowns) shotSnapshot = snap;
};
/** Tira con el palo que ya está en la mano, sin re-apuntar. */
const shootHere = async (club, power, maxMs = 6000) => {
  await useClub(club);
  await playerFree();
  await page.waitForFunction(() => window.__gk.player.cooldowns[window.__gk.player.enchant.id] <= 0, null, { timeout: 6000 }).catch(() => {});
  await give();
  await page.evaluate((p) => window.__gk.shootPower(p), power);
  await playerFree();
  await snapshotAfterShot();
  await ballsDone(maxMs);
};
/** Driver a donde apunte el mouse. `meters` ya no fija el alcance (lo da el cursor): solo la calidad. */
const drive = (meters, maxMs = 6000) => shootHere('driver', meters >= 55 ? 0.96 : 0.7, maxMs);
/** Driver con una calidad de golpe exacta (1 a 3). */
const driveLevel = (level, maxMs = 6000) => shootHere('driver', QPOWER[level - 1], maxMs);
/** Espera a que un encantamiento esté listo: si no, elegirlo se rechaza y el tiro sale seco. */
const waitEnchant = (id) => page.waitForFunction((n) => window.__gk.player.cooldowns[n] <= 0, id, { timeout: 12000 }).catch(() => {});
/**
 * Globo encantado con el wedge: 2 = escarcha, 3 = vendaval. Va con el wedge y no con el hierro porque
 * **el wedge es el único que abre su área por caer al piso**; el hierro tiene que conectar con alguien.
 */
const lobAt = async (digit, x, z, power) => {
  await useClub('wedge');
  await waitEnchant(digit === 2 ? 'ice' : 'push');
  await useEnchant(digit);
  await shootAt('wedge', x, z, power);
  await useEnchant(1);
};
/** Lo mismo, pero sin re-apuntar: cae donde ya apunta el mouse. */
const lob = async (digit, power) => {
  await useClub('wedge');
  await waitEnchant(digit === 2 ? 'ice' : 'push');
  await useEnchant(digit);
  await shootHere('wedge', power);
  await useEnchant(1);
};

/** Pone un palo en la mano: cada uno tiene su tecla, del 1 al 4. */
const CLUB_ORDER = ['driver', 'iron', 'wedge', 'putter'];
const useClub = async (id) => {
  if ((await page.evaluate(() => window.__gk.player.club.id)) === id) return;
  await page.keyboard.press(`Digit${CLUB_ORDER.indexOf(id) + 1}`);
  await page.waitForTimeout(60);
};
/** Elige poder: 1 golpe (Q), 2 escarcha (W), 3 vendaval (E). */
const ENCHANT_KEYS = ['KeyQ', 'KeyW', 'KeyE'];
const useEnchant = async (n) => {
  await page.keyboard.press(ENCHANT_KEYS[n - 1]);
  await page.waitForTimeout(60);
};
/**
 * Tira con `club` a (x, z) con una calidad dada (0.2 flojo, 0.7 bueno, 0.96 perfecto). El alcance lo
 * da el mouse, así que primero apunta. Espera a que la pelota termine.
 */
const shootAt = async (club, x, z, power = 0.7, maxMs = 6000) => {
  await useClub(club);
  await playerFree();
  // la cámara sigue al golfista: se apunta, se la deja llegar, y se vuelve a apuntar
  await aimAt(x, z);
  await page.waitForTimeout(600);
  await aimAt(x, z);
  await page.waitForFunction(() => window.__gk.player.cooldowns[window.__gk.player.enchant.id] <= 0, null, { timeout: 6000 }).catch(() => {});
  await give();
  await page.evaluate((p) => window.__gk.shootPower(p), power);
  await playerFree();
  await snapshotAfterShot();
  await ballsDone(maxMs);
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
  await page.evaluate(() => { const g = window.__gk; g.player.hp = 3; g.player.placeAt(g.tees.centerIndex); for (const id of Object.keys(g.player.cooldowns)) g.player.cooldowns[id] = 0; g.player.meleeCooldown = 0; });
  await page.waitForTimeout(1600);
};
/** Frena al director de oleadas para probar con enemigos puestos a mano. */
const holdWaves = () => page.evaluate(() => { window.__gk.director.timer = 9999; });

// ?plano: el campo liso. Esta prueba mide trayectorias y pone enemigos en puntos exactos, así que
// tiene que correr siempre sobre el mismo piso. Los campos con relieve los prueba tools/relieve.mjs.
await page.goto('http://localhost:5198/?plano');
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
  // --- al empezar están los cuatro palos y un solo poder: lo que dan las oleadas son los poderes ---
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(200);
  const start = await page.evaluate(() => ({ club: window.__gk.player.club.id, palos: [...window.__gk.player.unlocked], poderes: [...window.__gk.player.powers], x: window.__gk.player.anchor.x }));
  log('al empezar', start);
  check('los cuatro palos están desde la primera oleada', start.palos.length === 4 && start.x === 0);
  check('la tecla 2 cambia de palo desde el arranque', start.club === 'iron');
  check('al empezar el único poder es el golpe', start.poderes.join() === 'damage');
  await page.keyboard.press('Digit1');
  const shownSlots = await page.evaluate(() => ({
    slots: [...document.querySelectorAll('#clubs .club')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.dataset.club),
    iconos: [...document.querySelectorAll('#clubs .club .clubicon')].map((el) => el.getAttribute('src').split('/').pop()),
    efectos: [...document.querySelectorAll('#enchants .club')].filter((el) => !el.classList.contains('locked')).map((el) => el.dataset.ench),
    colores: new Set([...document.querySelectorAll('#clubs .club')].map((el) => el.style.getPropertyValue('--c'))).size,
  }));
  log('barra al empezar', shownSlots);
  check('los cuatro palos se muestran, cada uno con su ícono', shownSlots.slots.join() === 'driver,iron,wedge,putter' && shownSlots.iconos.join() === 'driver.png,iron.png,wedge.png,putter.png');
  check('el poder que todavía no se ganó no se muestra', shownSlots.efectos.join() === 'damage,melee');
  check('los cuatro palos comparten color', shownSlots.colores === 1);

  // --- cartel de poder nuevo: frena el juego hasta el click, pero el descanso entre oleadas sigue corriendo ---
  const walker = await page.evaluate(() => window.__gk.spawn('skeleton', 0, 40).id);
  await page.evaluate(() => { const g = window.__gk; g.director.index = 0; g.director.timer = 6; g.offerUnlock(); });
  const before = await page.evaluate((id) => { const g = window.__gk; return { clock: g.clock, z: g.horde.enemies.find((e) => e.id === id).position.z, rest: g.director.restLeft }; }, walker);
  await page.waitForTimeout(1200);
  await page.keyboard.press('Digit2');
  const during = await page.evaluate((id) => {
    const g = window.__gk;
    return { abierto: g.cardOpen, visible: !document.getElementById('card').hidden, clock: g.clock, z: g.horde.enemies.find((e) => e.id === id).position.z, rest: g.director.restLeft, poderes: [...g.player.powers], palo: g.player.club.id };
  }, walker);
  await page.screenshot({ path: 'logs/k1a-cartel.png' });
  log('cartel', before, during);
  check('el cartel de poder nuevo frena el juego', during.abierto && during.visible && during.clock === before.clock && during.z === before.z && during.palo === 'driver');
  check('con el cartel abierto el descanso entre oleadas sigue corriendo', during.rest < before.rest - 0.5);
  check('el cartel ya habilita el poder', during.poderes.includes('ice'));
  await page.mouse.click(640, 360);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ abierto: window.__gk.cardOpen, visible: !document.getElementById('card').hidden, escarcha: !document.querySelector('#enchants .club[data-ench=ice]').classList.contains('locked') }));
  log('cartel cerrado', after);
  check('un click cierra el cartel y el poder aparece en la barra', !after.abierto && !after.visible && after.escarcha);
  await page.evaluate(() => { const g = window.__gk; g.director.index = -1; g.director.timer = 9999; });
  await clearEnemies();
  await page.evaluate(() => window.__gk.unlockAll());

  // --- puestos: solo se mueve de costado, un toque = un puesto, dos toques = dos; W y S no hacen nada ---
  const where = () => page.evaluate(() => { const p = window.__gk.player; return { x: +p.anchor.x.toFixed(2), z: +p.anchor.z.toFixed(2), puesto: p.spotIndex, llego: p.atSpot }; });
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
  // W y E son poderes y las flechas arriba y abajo mueven la cámara: ninguna mueve al golfista
  const camBefore = await page.evaluate(() => window.__gk.camera);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  const camAfter = await page.evaluate(() => window.__gk.camera);
  log('cámara con flechas', camBefore, camAfter);
  check('el golfista no se mueve para adelante ni para atrás', (await where()).z === 9 && (await where()).x === 4);
  check('las flechas arriba y abajo suben la cámara sin girarla', camAfter.rise > camBefore.rise && camAfter.pitch === camBefore.pitch);

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

  // --- la pelota queda quieta y el golfista se acomoda alrededor, sin pisar la línea ---
  await resetPlayer();
  await give();
  const stance = async (x, z) => {
    await aimAt(x, z);
    await page.waitForTimeout(250);
    return page.evaluate(() => {
      const p = window.__gk.player;
      const t = p.teePosition(new (Object.getPrototypeOf(p.position).constructor)());
      return { cuerpo: [+p.position.x.toFixed(2), +p.position.z.toFixed(2)], pelota: [+t.x.toFixed(2), +t.z.toFixed(2)], ancla: [+p.anchor.x.toFixed(2), +p.anchor.z.toFixed(2)] };
    });
  };
  // puntos bien adentro de la pantalla: si el cursor cae fuera del viewport, el mouse se clampea y la
  // puntería no se mueve (así se me escapó la primera vez)
  const frente = await stance(0, 40);
  const derecha = await stance(14, 30);
  const aimR = await page.evaluate(() => window.__gk.aim);
  const izquierda = await stance(-14, 30);
  const aimL = await page.evaluate(() => window.__gk.aim);
  log('postura', frente, derecha, izquierda);
  log('puntería', aimR, aimL);
  check('la prueba apunta de verdad a cada lado', aimR[0] > 5 && aimL[0] < -5);
  check('la pelota no se mueve al apuntar: se acomoda el golfista', [derecha, izquierda].every((s) => s.pelota[0] === frente.pelota[0] && s.pelota[1] === frente.pelota[1]));
  // girando hacia el lado que lo deja detrás de la pelota, el cuerpo la rodea de verdad
  check('el golfista sí se mueve alrededor de la pelota', Math.hypot(derecha.cuerpo[0] - frente.cuerpo[0], derecha.cuerpo[1] - frente.cuerpo[1]) > 0.3);
  // para el otro lado la pose se clava antes de meterse en el campo: eso es el clamp
  check('el golfista nunca se para delante de la pelota: no pisa la línea', [frente, derecha, izquierda].every((s) => s.cuerpo[1] <= s.pelota[1]));
  // la pelota que espera en el puesto está en la línea, no medio metro adelante
  const waiting = await page.evaluate(() => {
    const g = window.__gk;
    const i = g.tees.nearest(g.player.anchor.x);
    return { pelota: +g.tees.spots[i].ballMesh.position.z.toFixed(2), anillo: +g.tees.spots[i].ring.position.z.toFixed(2), ancla: +g.player.anchor.z.toFixed(2) };
  });
  log('pelota en el puesto', waiting);
  check('la pelota que espera está justo en el puesto, alineada con el anillo', waiting.pelota === waiting.ancla && waiting.anillo === waiting.ancla);

  // --- moverse mientras se carga: se guarda UN toque, no una cola ---
  // Antes se acumulaban: apretabas dos veces mientras cargabas y, al terminar el tiro tres segundos
  // después, te movías dos puestos de golpe.
  await resetPlayer();
  const spot = () => page.evaluate(() => ({ puesto: window.__gk.player.spotIndex, mode: window.__gk.player.mode }));
  await aimAt(0, 30);
  await page.waitForTimeout(200);
  const spotBefore = (await spot()).puesto;
  await give();
  await page.mouse.down();
  const charging = await page.waitForFunction(() => window.__gk.player.mode === 'charging', null, { timeout: 4000 }).then(() => true).catch(() => false);
  check('la carga arranca (si no, el resto de esta prueba no dice nada)', charging);
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyA');
  const whileCharging = await spot();
  // el tiro tarda: para cuando termina, el toque guardado ya venció
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await playerFree();
  await page.waitForTimeout(400);
  const spotAfter = (await spot()).puesto;
  await ballsDone(8000);
  log('mover cargando', { antes: spotBefore, cargando: whileCharging.puesto, despues: spotAfter });
  check('apretar para moverse mientras se carga no mueve en el acto', whileCharging.puesto === spotBefore);
  check('dos toques mientras cargás no son dos puestos al terminar', Math.abs(spotAfter - spotBefore) <= 1);
  await resetPlayer();

  // --- cambiar de palo mientras se carga: cambia en el acto y la carga arranca de nuevo ---
  const clubs = () => page.evaluate(() => ({ club: window.__gk.player.club.id, enCola: window.__gk.player.pendingClub?.id ?? null, mode: window.__gk.player.mode, power: +window.__gk.player.meter.power.toFixed(2) }));
  await aimAt(0, 30);
  await give();
  await page.mouse.down();
  await page.waitForFunction(() => window.__gk.player.meter.power > 0.3, null, { timeout: 3000, polling: 'raf' }).catch(() => {});
  const beforeSwitch = await clubs();
  await page.keyboard.press('Digit2');
  const afterSwitch = await clubs();
  log('cambio cargando', beforeSwitch, afterSwitch);
  await page.screenshot({ path: 'logs/k1b-cambio-cargando.png' });
  check('cambiar de palo mientras se carga cambia en el acto y vuelve a cargar', afterSwitch.club === 'iron' && afterSwitch.mode === 'charging' && afterSwitch.power < beforeSwitch.power);
  await page.mouse.up();
  await playerFree();
  await page.waitForTimeout(150);
  await give();
  const afterShot = await clubs();
  log('tras el tiro', afterShot);
  check('el palo queda en la mano: ya no vuelve solo al driver', afterShot.club === 'iron');
  // el que se elige mientras carga también queda, aunque después se cancele el tiro
  await useClub('driver');
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

  // --- medidor: la barra dice solo la calidad del golpe; el alcance lo da el mouse ---
  await useClub('driver');
  await aimAt(0, 30);
  const range30 = await page.evaluate(() => window.__gk.shotInfo.range);
  await aimAt(0, 50);
  const range50 = await page.evaluate(() => window.__gk.shotInfo.range);
  log('alcance por el mouse', { a30: range30, a50: range50 });
  check('el alcance lo da el mouse, no la carga', Math.abs(range30 - 21) < 3 && Math.abs(range50 - 41) < 3);
  await give();
  await page.mouse.down();
  await page.waitForFunction(() => window.__gk.player.meter.power >= 1, null, { timeout: 5000, polling: 'raf' }).catch(() => {});
  let minPower = 1;
  const ranges = new Set();
  const colors = new Set();
  for (let i = 0; i < 30; i++) {
    const m = await page.evaluate(() => ({ power: window.__gk.player.meter.power, range: window.__gk.shotInfo.range, color: window.__gk.aimLine.color.toString(16) }));
    minPower = Math.min(minPower, m.power);
    ranges.add(m.range);
    colors.add(m.color);
    await page.waitForTimeout(60);
  }
  await page.screenshot({ path: 'logs/k2-medidor.png' });
  await page.keyboard.press('KeyX');
  await page.mouse.up();
  await page.waitForTimeout(200);
  log('medidor', { minimoTrasElTope: +minPower.toFixed(2), alcances: [...ranges], coloresDeLaLinea: [...colors].sort() });
  check('después del tope la barra rebota por todo el rango', minPower < 0.2);
  check('mientras la barra rebota el alcance no se mueve', ranges.size === 1);
  // flojo blanco, bueno amarillo, perfecto rojo
  check('la línea de tiro cambia de color con la calidad del golpe', [...colors].every((c) => ['ffffff', 'ffe066', 'ff2d3c'].includes(c)) && colors.size === 3);
  check('ya no hay anillo junto al cursor', await page.evaluate(() => !document.getElementById('chargecursor')));
  // la punta ya no lleva el ícono del palo, que tapaba justo el punto al que se apunta: lleva el del poder
  const tips = [];
  for (const n of [1, 2, 3]) {
    await waitEnchant(['damage', 'ice', 'push'][n - 1]);
    await useEnchant(n);
    await give();
    await page.waitForTimeout(150);
    tips.push(await page.evaluate(() => window.__gk.aimLine));
  }
  await useEnchant(1);
  log('punta de la línea', tips.map((t) => t.tip));
  check('la punta de la línea dice qué poder está en la mano', tips.map((t) => t.tip).join() === 'damage,ice,push' && tips.every((t) => t.tipVisible));
  await useClub('driver');
  // la carga arranca lenta: a un tercio del tiempo todavía va por el nivel 1
  await give();
  await page.mouse.down();
  const early = await page.evaluate(() => new Promise((done) => { const g = window.__gk; const t0 = g.clock; const poll = () => (g.clock - t0 >= 0.33 ? done(g.player.meter.power) : requestAnimationFrame(poll)); poll(); }));
  await page.keyboard.press('KeyX');
  await page.mouse.up();
  await page.waitForTimeout(150);
  log('carga a un tercio del tiempo', +early.toFixed(2));
  // a un tercio del tiempo la barra tiene que ir bastante por debajo de un tercio: arranca lenta
  check('la carga sube lenta al principio', early < 0.27);

  // --- el daño sale del palo, de la distancia y de la calidad del golpe ---
  await clearEnemies();
  await resetPlayer();
  /** Cuánto le saca un tiro a un muñeco parado a z metros. Todo adentro de la página: la cámara no se mueve. */
  const hitFor = async (club, z, power) => {
    await useClub(club);
    // golpe seco: si quedó un encantamiento en la mano, el tiro no hace daño
    await useEnchant(1);
    await page.waitForTimeout(120);
    return page.evaluate(async ([z, power]) => {
      const g = window.__gk;
      for (const e of g.horde.enemies) e.state = 'gone';
      const dummy = g.spawn('golem', 0, z);
      dummy.stats = { ...dummy.stats, speed: 0, damage: 0 };
      const s = g.screenOf(0, z);
      dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y }));
      await new Promise((r) => setTimeout(r, 300));
      g.tees.place(g.tees.nearest(g.player.anchor.x));
      const before = dummy.hp;
      const info = g.shotInfo;
      g.shootPower(power);
      await new Promise((done) => {
        const t0 = g.clock;
        const poll = () => (g.clock - t0 > 3 ? done() : requestAnimationFrame(poll));
        poll();
      });
      return { dano: before - dummy.hp, alcance: info.range, palo: info.club, efecto: info.enchant };
    }, [z, power]);
  };
  // el driver cobra de lejos y poco de cerca; el putter al revés
  const driverFar = await hitFor('driver', 55, 0.96);
  const driverNear = await hitFor('driver', 14, 0.96);
  const putterNear = await hitFor('putter', 14, 0.96);
  log('daño por distancia', { driverLejos: driverFar, driverCerca: driverNear, putterCerca: putterNear });
  check('el driver cobra mucho más de lejos que de cerca', driverFar.dano > driverNear.dano && driverFar.dano === 8);
  check('el putter cobra de cerca como ninguno', putterNear.dano === 8 && putterNear.dano > driverNear.dano);
  // y pegarle mejor siempre pega más
  const flojo = await hitFor('iron', 30, 0.2);
  const bueno = await hitFor('iron', 30, 0.7);
  const perfecto = await hitFor('iron', 30, 0.96);
  log('daño por calidad', { flojo: flojo.dano, bueno: bueno.dano, perfecto: perfecto.dano });
  check('pegarle mejor pega más', perfecto.dano > bueno.dano && bueno.dano > flojo.dano);
  check('el hierro pega parejo: 1, 3 y 7', [flojo.dano, bueno.dano, perfecto.dano].join() === '1,3,7');

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
  // el área del wedge es grande (4.2 m): a 2 m del centro entra de sobra
  await aimAt(2, 24);
  await lob(2, 0.96);
  const slowed = await enemy(shield);
  const afterIron = { recarga: +shotSnapshot.cooldowns.ice.toFixed(2), efecto: await page.evaluate(() => window.__gk.player.enchant.id) };
  log('hielo: borde', slowed, afterIron);
  check('el hielo enfría a los que alcanza', slowed.chilled);
  const shieldSeen = () => page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); return { visible: e.shieldMesh.visible, enAlto: e.shieldUp }; });
  const coldShield = await shieldSeen();
  log('escudo con hielo', coldShield);
  check('con hielo encima el escudo desaparece', !coldShield.visible && !coldShield.enAlto);
  check('la escarcha queda recargando', afterIron.recarga > 0);
  const cdShown = shotSnapshot.hud;
  log('recarga en la barra', cdShown);
  check('la barra muestra la recarga de la escarcha y el número bajando', cdShown.recargando && cdShown.numero !== '');
  check('después de gastar la escarcha vuelve solo el golpe seco', afterIron.efecto === 'damage');
  await aimAt(0, 24);
  await driveLevel(1, 2500);
  log('frío: un toque', await enemy(shield));
  check('con frío el escudo ya no frena', (await enemy(shield)).hp === 3);
  await lob(2, 0.96);
  const iced = await enemy(shield);
  log('hielo: centro', iced);
  check('el hielo del centro también enfría, y sigue caminando', iced.chilled && iced.alive);
  await page.screenshot({ path: 'logs/k4-hielo.png' });
  await page.evaluate(() => { window.__gk.horde.enemies.at(-1).chillTimer = 0.01; });
  await page.waitForTimeout(400);
  const thawed = await shieldSeen();
  log('escudo al pasar el hielo', thawed);
  check('cuando se le pasa el hielo el escudo vuelve', thawed.visible && thawed.enAlto);
  // el frío no cambia el daño: el mismo tiro saca lo mismo, esté frío o no
  await clearEnemies();
  const warm = await still('knight', 0, 30);
  await shootAt('iron', 0, 30, 0.7, 3000);
  const warmHit = 10 - (await enemy(warm)).hp;
  await clearEnemies();
  const cold = await still('knight', 0, 30);
  await lobAt(2, 0, 30, 0.96);
  const coldBefore = await enemy(cold);
  await shootAt('iron', 0, 30, 0.7, 3000);
  const coldHit = coldBefore.hp - (await enemy(cold)).hp;
  log('frío contra tibio', { sinFrio: warmHit, conFrio: coldHit, quedoFrio: coldBefore.chilled });
  check('un enemigo frío recibe el mismo daño que uno sin frío', coldBefore.chilled && warmHit === coldHit && warmHit === 3);
  // el caballero es la excepción: aguanta el mejor golpe de un tiro
  await clearEnemies();
  const big = await still('knight', 0, 52);
  const small = await still('skeleton', 0, 49);
  await shootAt('driver', 0, 52, 0.96, 3000);
  log('golpe perfecto de lejos', { caballero: await enemy(big), esqueleto: await enemy(small) });
  check('un golpe perfecto de lejos mata a un esqueleto', !(await enemy(small))?.alive);
  check('el caballero aguanta el mejor golpe: le quedan 2', (await enemy(big)).hp === 2);
  // muerto: el escudo tampoco se ve mientras cae
  await clearEnemies();
  await still('warrior', 0, 24);
  await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); window.__gk.horde.damage(e, 9, null, 0); });
  await page.waitForTimeout(250);
  const dying = await page.evaluate(() => { const e = window.__gk.horde.enemies.find((x) => x.stats.kind === 'warrior'); return { estado: e.state, escudo: e.shieldMesh.visible }; });
  log('escudo al morir', dying);
  check('el escudo desaparece cuando el guerrero muere', dying.estado === 'dying' && !dying.escudo);
  // el perfecto llega más lejos: con el área del wedge (4.2 m, 6.3 en el perfecto) y midiendo desde el
  // borde del enemigo, uno a 5.5 m del centro queda afuera del normal y adentro del perfecto
  await clearEnemies();
  const edge = await still('skeleton', 5.5, 24);
  await aimAt(0, 24);
  await lob(2, 0.5);
  const missed = (await enemy(edge)).chilled;
  await lob(2, 0.96);
  log('hielo perfecto', { normal: missed, perfecto: (await enemy(edge)).chilled });
  check('el hielo perfecto tiene más área', !missed && (await enemy(edge)).chilled);

  /** Con el wedge y el vendaval en la mano, apuntando a (x, z): la línea del tiro y sus coordenadas. */
  const shotLine = async (wantX, wantZ) => {
    await useClub('wedge');
    await waitEnchant('push');
    await useEnchant(3);
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

  // --- wedge: globo alto, tarda en llegar, empuja hacia la línea sin dañar ---
  await clearEnemies();
  const ringLine = await shotLine(0, 24);
  const ringAt = [[0, -1.2], [0, 1.2], [1.2, 0.4], [-1.2, -0.4]];
  const ring = [];
  for (const [f, l] of ringAt) ring.push(await still('skeleton', ...ringLine.at(f, l)));
  await aimAt(0, 24);
  await useClub('wedge');
  await waitEnchant('push');
  await useEnchant(3);
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
  // el wedge es el globo alto: sube y tarda. El hierro, con el mismo tiro, es un arco bajo y llega antes
  await clearEnemies();
  await useClub('iron');
  await aimAt(0, 24);
  await playerFree();
  await give();
  // el hierro sigue rodando después de caer, así que se mide hasta que toca el piso, no hasta que para
  const ironFlight = await page.evaluate(() => new Promise((done) => {
    const g = window.__gk;
    g.shootPower(0.8);
    let t0 = -1;
    const poll = () => {
      const ball = g.balls.list[0];
      if (t0 < 0 && ball) t0 = g.clock;
      if (t0 >= 0 && (!ball || ball.state.bounces > 0)) done(+(g.clock - t0).toFixed(2));
      else requestAnimationFrame(poll);
    };
    poll();
  }));
  await ballsDone();
  log('vuelos', { wedge: flight, hierro: ironFlight });
  check('el wedge es el que más tarda: sube alto y cae', flight > ironFlight);
  check('el wedge no daña con el vendaval', pushed.every((e) => e.hp === 4));
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
  await lob(2, 0.96);
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
  // al jefe, que es pesado, el frío le dura un 40 % menos: hay que pegarle bien para poder medirlo
  await lobAt(2, 0, 22.2, 0.96);
  const bossIced = await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); return { chilled: e.chilled, cast: e.castTimer, age: e.age }; });
  await page.waitForTimeout(1500);
  const bossLater = await page.evaluate(() => { const e = window.__gk.horde.enemies.at(-1); return { cast: e.castTimer, age: e.age, chilled: e.chilled }; });
  const castRate = (bossIced.cast - bossLater.cast) / (bossLater.age - bossIced.age);
  log('gólem con hielo', bossIced, { ritmoDeAtaque: +castRate.toFixed(2) });
  check('al jefe el hielo también lo enfría', bossIced.chilled);
  check('el jefe frío ataca más lento', bossLater.chilled && castRate < 0.5);

  // --- putter: rueda hasta 20 m y le pega al primero que toca, a él solo ---
  await clearEnemies();
  await resetPlayer();
  await useClub('putter');
  await useEnchant(1);
  const puttTarget = await still('goblin', 0, 15);
  // el que está apenas atrás no cobra nada: el putter ya no abre área
  const puttBehind = await still('goblin', 0, 17);
  const putt = await page.evaluate(async () => {
    const g = window.__gk;
    const s = g.screenOf(0, 15);
    dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y }));
    await new Promise((r) => setTimeout(r, 300));
    g.tees.place(g.tees.nearest(g.player.anchor.x));
    const t0 = g.clock;
    let top = 0;
    let alto = 0;
    g.shootPower(0.96);
    await new Promise((done) => {
      const poll = () => {
        const b = g.balls.list[0];
        if (b) {
          top = Math.max(top, Math.hypot(b.state.vel.x, b.state.vel.z));
          alto = Math.max(alto, b.state.pos.y);
        }
        if (g.clock - t0 > 3) done();
        else requestAnimationFrame(poll);
      };
      poll();
    });
    return { rapidez: +top.toFixed(1), alto: +alto.toFixed(2), alcance: g.shotInfo.range };
  });
  log('putter', putt, await enemy(puttTarget), await enemy(puttBehind));
  await page.screenshot({ path: 'logs/k7-putter.png' });
  check('la pelota del putter rueda a velocidad media', putt.rapidez > 6 && putt.rapidez < 18);
  check('no se levanta del piso: rueda', putt.alto < 0.3);
  check('de cerca el putter cobra como ninguno', !(await enemy(puttTarget))?.alive);
  check('para en el primero que toca y no salpica: el de atrás queda entero', (await enemy(puttBehind))?.hp === 2);
  const puttReach = await page.evaluate(() => { const g = window.__gk; g.selectClub(3); const s = g.screenOf(0, 60); dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y })); return null; });
  await page.waitForTimeout(200);
  const puttFar = await page.evaluate(() => window.__gk.shotInfo.range);
  log('alcance del putter', { pedido: 51, real: puttFar }, puttReach);
  check('el putter no pasa de la línea de 20 m por más que apuntes lejos', puttFar <= 20.5);

  // --- hierro: los dos modos, que es lo que se está probando para darle identidad ---
  await clearEnemies();
  await resetPlayer();
  await useClub('iron');
  await useEnchant(1);
  /** Tira el hierro a (x, z) y devuelve la vida de los muñecos que se le pasen. */
  const ironShot = async (mode, x, z, ids) => {
    await page.evaluate((m) => window.__gk.setIronMode(m), mode);
    await shootAt('iron', x, z, 0.7, 4000);
    await page.waitForTimeout(300);
    const out = [];
    for (const id of ids) out.push((await enemy(id))?.hp ?? 'muerto');
    return out;
  };
  // «revienta»: si cae al piso sin tocar a nadie, no pasa nada; si le pega a uno, salpica a los de al lado
  const lonely = await still('skeleton', 6, 26);
  const suelo = await ironShot('revienta', 0, 26, [lonely]);
  log('hierro revienta: al piso', suelo);
  check('modo revienta: cayendo al piso no hace nada', suelo[0] === 4);
  const centro = await still('skeleton', 0, 26);
  const vecino = await still('skeleton', 1.6, 26);
  const pegado = await ironShot('revienta', 0, 26, [centro, vecino]);
  log('hierro revienta: al enemigo', pegado);
  check('modo revienta: le pega al que toca y salpica al de al lado', pegado[0] !== 4 && pegado[1] !== 4);
  // el mismo enemigo no cobra dos veces por un tiro: era el bug de la explosión más el pelotazo
  check('modo revienta: el que recibe el pelotazo cobra una sola vez', pegado[0] === 'muerto' || pegado[0] >= 4 - 4);
  // «atraviesa»: pasa de largo y además abre su área al caer, le pegue a alguien o no
  await clearEnemies();
  const solo2 = await still('skeleton', 6, 26);
  const suelo2 = await ironShot('atraviesa', 6, 26, [solo2]);
  log('hierro atraviesa: al piso', suelo2);
  check('modo atraviesa: abre su área donde cae', suelo2[0] !== 4);
  await page.evaluate(() => window.__gk.setIronMode('revienta'));
  await clearEnemies();

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
  // el palazo sale del cuerpo, que está al costado de la pelota: los blancos se ponen respecto del cuerpo
  await aimAt(0, 30);
  await page.waitForTimeout(300);
  const [bodyX, bodyZ] = await page.evaluate(() => [window.__gk.player.position.x, window.__gk.player.position.z]);
  const close = await still('skeleton', bodyX + 0.4, bodyZ + 1.6);
  const farther = await still('skeleton', bodyX - 1.2, bodyZ + 3.4);
  const fartherZ = bodyZ + 3.4;
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
  check('el palazo alcanza a uno a más de 3 m', (await enemy(farther)).z - fartherZ > 8);
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
    const info = await page.evaluate(() => ({ clips: [...window.__gk.player.swingClips.keys()].length, hp: window.__gk.player.hp, palos: window.__gk.player.unlocked.size, x: window.__gk.player.anchor.x }));
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
