// Las imágenes de la página de itch.io (8/10): capturas del juego y de la cinemática, y la portada, el
// banner y la imagen del botón de jugar armados encima. Usa la GPU de la máquina, como tools/cine.mjs.
//
//   node tools/promo.mjs crudas [cine|portada|juego|abe]...   cuadros sin nada encima, en logs/promo/
//   node tools/promo.mjs armar                                lo final, en promo/itch/<es|en>/
//
// Las ráfagas sacan varios cuadros seguidos: `armar` usa el que dice ELEGIDOS (se eligen mirándolos).
// Ver promo/itch/README.md: qué va en cada lugar de la página.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';

const step = process.argv[2] ?? 'crudas';
const which = process.argv.slice(3);
/** ¿Se pidió esta escena? Sin nada, todas. */
const want = (n) => !which.length || which.includes(n);
const RAW = 'logs/promo';
const OUT = 'promo/itch';
mkdirSync(RAW, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5199';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** La cámara de las capturas: más baja y más cerca que la del juego, con el caballero abajo. */
const SHOT_CAM = { pitch: 20, dist: 14, ahead: 5, rise: 0, auto: false };
/** La de la portada: detrás del caballero, a la altura de la cabeza. */
const COVER_CAM = { pitch: 8, dist: 6.5, rise: 1.3, ahead: 3, auto: false };

/** El cuadro de cada ráfaga que se usa (se eligen mirándolos). */
const ELEGIDOS = { portada: 2, embed: 2, rayo: 0, jefe: 0, abe: 0 };

/** La cinemática en el segundo `t`, sin barra de controles ni botón de saltar; `clean` saca también las franjas y los textos. */
async function cineFrame(name, t, { width = 1920, height = 1080, lang = 'es', clean = true } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${BASE}/cine.html?t=${t}&lang=${lang}`);
  await page.waitForFunction(() => window.__cine, null, { timeout: 120000 });
  await page.addStyleTag({ content: `#controls, #skipcine { display: none !important; }${clean ? ' .bar, .cue { display: none !important; }' : ''}` });
  await page.evaluate((t) => window.__cine.seek(t), t);
  await sleep(600);
  await page.screenshot({ path: `${RAW}/${name}.png` });
  await page.close();
  console.log('cuadro', name);
}

/** Una partida lista para escenificar: sin intro, sin tutorial, invencible. */
async function newGame(lang, { width = 1920, height = 1080, query = '', ctx = null } = {}) {
  const page = ctx ? await ctx.newPage() : await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const url = `${BASE}/?plano&sincine&lang=${lang}${query}`;
  await page.goto(url);
  await page.evaluate(() => {
    sessionStorage.setItem('gk.introSeen', '1');
    localStorage.setItem('gk.tutorialDone', '1');
  });
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('start').disabled, null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('start').click());
  await page.waitForFunction(() => window.__gk?.player && document.getElementById('overlay').hidden, null, { timeout: 60000 });
  await page.evaluate(() => Object.assign(window.__gk.godMode, { godPlayer: true, godGate: true }));
  return page;
}

/** Las habilidades de una mano avanzada, para que el HUD de abajo se vea lleno. */
async function hand(page, ids = [['driver-fire', 2], ['iron-lightning', 2], ['wedge-ice', 1], ['echo', 1]]) {
  await page.evaluate((ids) => {
    const g = window.__gk;
    for (const s of [...g.abilities.slots]) g.abilities.setLevel(s.id, 0);
    for (const [id, level] of ids) g.abilities.setLevel(id, level);
    g.abilities.cooldowns.fill(0);
  }, ids);
}

async function camera(page, c) {
  await page.evaluate((c) => Object.assign(window.__gk.debug.hooks.camera(), c), c);
  await sleep(1800);
}

/** Enemigos quietos donde se los pone: [tipo, metros al costado del caballero, z, poderes]. */
async function crowd(page, list, { keep = false } = {}) {
  await page.evaluate(([list, keep]) => {
    const g = window.__gk;
    if (!keep) for (const e of g.horde.enemies) e.state = 'gone';
    const x0 = g.player.anchor.x;
    window.__t = list.map(([k, dx, z, m]) => { const e = g.spawn(k, x0 + dx, z, m); e.hold = e.position.clone(); return e; });
  }, [list, keep]);
}

/** Ráfaga: `n` capturas cada `every` ms. */
async function burst(page, name, n, every) {
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: `${RAW}/${name}-${i}.png` });
    await sleep(every);
  }
}

/** Cargar el golpe apuntando a (x, z) y sacar la ráfaga en pleno swing. */
async function swingBurst(page, name, at, n, every) {
  const p = await page.evaluate(([x, z]) => window.__gk.screenOf(window.__gk.player.anchor.x + x, z), at);
  await page.mouse.move(p.x, p.y);
  await sleep(300);
  await page.mouse.down();
  await burst(page, name, n, every);
  await page.keyboard.press('KeyX');
  await page.mouse.up();
}

/** Sin carteles arriba de los enemigos (vida y poderes): para la portada. */
async function hideBadges(page) {
  await page.evaluate(() => {
    const hide = () => {
      for (const e of window.__gk.horde.enemies) e.group.traverse((o) => { if (o.isSprite) o.visible = false; });
      requestAnimationFrame(hide);
    };
    hide();
  });
}

const HORDE = [['orc', 2.5, 11, {}], ['goblina', -6.5, 16, {}], ['goblin', 5.5, 14, {}], ['skeleton', 0.5, 16, { shield: 2 }], ['knight', 3.5, 19, {}],
  ['warchief', -1.5, 21, {}], ['goblin', 7, 18, {}], ['orc', -5, 23, {}], ['shaman', 5, 25, {}], ['goblina', 1, 27, {}], ['goblin', 8.5, 24, {}],
  ['skeleton', -3, 29, {}], ['stoneling', 4, 32, {}], ['orc', 0, 34, {}], ['goblin', -6, 31, {}]];

/** La portada y la imagen del botón de jugar: el caballero de espaldas con el palo arriba, la horda enfrente. */
async function coverShots() {
  for (const [name, width, height] of [['portada', 1260, 1000], ['embed', 1280, 720]]) {
    const page = await newGame('en', { width, height });
    await page.addStyleTag({ content: '#hud { visibility: hidden !important; }' });
    await page.evaluate(() => { window.__gk.director.timer = 9999; });
    await crowd(page, HORDE);
    await hideBadges(page);
    await camera(page, COVER_CAM);
    await swingBurst(page, name, [0.5, 16], 8, 90);
    await page.close();
  }
}

/** Las capturas del juego, en un idioma. */
async function gameShots(lang) {
  let page;
  // 1) una oleada llegando, con la mano llena y el tiro cargando (el arco de carga se ve)
  if (want('oleada')) {
  page = await newGame(lang);
  await hand(page);
  await page.evaluate(() => { window.__gk.director.goTo(4); });
  await camera(page, SHOT_CAM);
  await sleep(4000);
  await crowd(page, [['skeleton', -3, 15, { shield: 2 }], ['orc', 2, 17, {}], ['goblina', 5, 20, { armor: 1 }], ['goblin', -6, 21, {}],
    ['knight', 0.5, 25, { divine: 5 }], ['warchief', -2.5, 29, { regen: 2 }], ['goblin', 7, 26, {}], ['orc', -8, 28, { ethereal: true }],
    ['goblina', -4.5, 35, {}], ['goblin', 1.5, 38, {}], ['skeleton', 6, 39, { dodge: true }]], { keep: true });
  await sleep(800);
  await swingBurst(page, `oleada-${lang}`, [0.5, 25], 3, 150);
  await page.close();
  }

  // 2) fuego y rayo: un grupo prendido, y el rayo del driver con clon que salta entre todos
  if (want('rayo')) {
  page = await newGame(lang);
  await hand(page, [['driver-lightning', 3], ['iron-fire', 2], ['wedge-ice', 2], ['clone', 1]]);
  await page.evaluate(() => { const g = window.__gk; g.director.timer = 9999; g.perk('masteryFire', 1); g.perk('mixFireLightning', 1); });
  await camera(page, SHOT_CAM);
  // el primero sin escudo: el escudo frena el toque, y el rayo no sale. Los chicos mueren y explotan
  await crowd(page, [['skeleton', 0, 15, {}], ['orc', -2.2, 16.5, {}], ['goblina', 2.3, 16, { armor: 1 }], ['goblin', -1, 18.5, {}],
    ['orc', 1.4, 19, {}], ['warchief', 0.3, 21.5, { divine: 5 }], ['goblin', -3.4, 19.5, {}], ['goblin', 3.6, 18.5, {}], ['skeleton', -5, 23, {}], ['orc', 4.5, 22, {}]]);
  await page.evaluate(() => { for (const e of window.__t) { if (e.kind !== 'goblin') e.maxHp = e.hp = 6; e.burn(20); } });
  await sleep(2200);
  const at = await page.evaluate(() => window.__gk.screenOf(window.__gk.player.anchor.x, 15));
  await page.mouse.move(at.x, at.y);
  await sleep(400);
  await page.evaluate(() => window.__gk.cast('driver-lightning'));
  await burst(page, `rayo-${lang}`, 12, 35);
  await page.close();
  }

  // 3) el jefe: el gólem de roca con su escolta
  if (want('jefe')) {
  page = await newGame(lang);
  await hand(page, [['driver-fire', 3], ['iron-lightning', 3], ['wedge-ice', 3], ['might', 2]]);
  await page.evaluate(() => { window.__gk.director.goTo(9); });
  await camera(page, SHOT_CAM);
  await sleep(3000);
  await crowd(page, [['golem', 2.5, 25, {}], ['skeleton', -4, 15, { armor: 2 }], ['orc', 3, 19, {}], ['knight', -1, 22, { shield: 3 }], ['goblin', 6, 20, {}], ['warchief', -7, 24, { divine: 3 }],
    ['goblina', 1, 24, {}], ['wraith', 8, 23, {}]], { keep: true });
  await sleep(1500);
  await burst(page, `jefe-${lang}`, 3, 1200);
  await page.close();
  }

  // 4) las cartas: tres para elegir, con una maestría
  if (want('cartas')) {
  page = await newGame(lang);
  await hand(page, [['driver-fire', 1], ['iron-fire', 1], ['wedge-ice', 1]]);
  for (let i = 0; i < 12; i++) {
    const tags = await page.evaluate(() => { window.__gk.offerChoice(); return [...document.querySelectorAll('#choice .tag')].map((e) => e.textContent); });
    if (tags.some((t) => /MAESTR|MASTERY/.test(t))) break;
    await page.keyboard.press('Digit2');
    await sleep(250);
  }
  await sleep(800);
  await page.screenshot({ path: `${RAW}/cartas-${lang}.png` });
  await page.close();
  }
}

/** Abe: el que juega y el que mira en dos pestañas (LocalLink); la captura es lo que ve Abe. */
async function abeShot(lang) {
  // las dos en el mismo contexto: LocalLink va por BroadcastChannel
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const host = await newGame(lang, { query: '&transmitir=PROMO&local', ctx });
  await hand(host);
  await host.evaluate(() => { window.__gk.director.goTo(5); });
  const abe = await ctx.newPage();
  abe.on('pageerror', (e) => console.log('[abe pageerror]', e.message));
  await abe.goto(`${BASE}/?mirar=PROMO&local&plano&lang=${lang}`);
  await abe.waitForFunction(() => window.__gk?.net?.spectator, null, { timeout: 120000 });
  // el aviso de «click para activar el sonido» no va en la foto
  await abe.addStyleTag({ content: '#netsound { display: none !important; }' });
  await sleep(5000);
  // elige sus cuatro hechizos (el primero que le ofrecen cada vez) y acerca la cámara
  for (let i = 0; i < 4; i++) {
    await abe.evaluate(() => window.__gk.net.spectator.pick(0));
    await sleep(700);
  }
  await abe.mouse.move(960, 540);
  for (let i = 0; i < 2; i++) {
    await abe.mouse.wheel(0, -200);
    await sleep(200);
  }
  await sleep(8000);
  for (let i = 0; i < 3; i++) {
    await host.mouse.move(980, 420);
    await host.mouse.down();
    await sleep(600);
    await host.mouse.up();
    await sleep(700);
  }
  // un hechizo de Abe sobre los enemigos
  await abe.mouse.move(960, 360);
  await sleep(300);
  await abe.evaluate(() => window.__gk.net.spectator.quickCast(0));
  await burst(abe, `abe-${lang}`, 3, 400);
  // y lo que ve el caballero en ese momento: la captura de a dos va con las dos pantallas
  await host.screenshot({ path: `${RAW}/abe-caballero-${lang}.png` });
  await ctx.close();
}

if (step === 'crudas') {
  if (want('cine')) {
    // el banner: el mago y el caballero mirando la horda bajo la luna, sin textos
    await cineFrame('banner', 41.45, { width: 1920, height: 600 });
    // la historia, con sus textos, en los dos idiomas
    for (const lang of ['es', 'en']) {
      await cineFrame(`cine-feria-${lang}`, 5.6, { lang, clean: false });
      await cineFrame(`cine-mago-${lang}`, 24.7, { lang, clean: false });
    }
  }
  if (want('portada')) await coverShots();
  if (want('icono')) await iconShot();
  for (const lang of ['es', 'en']) {
    if (['oleada', 'rayo', 'jefe', 'cartas'].some(want)) await gameShots(lang);
    if (want('abe')) await abeShot(lang);
  }
}

/**
 * El ícono de la app: el caballero de frente (la cámara de revisar el swing), solo, sin la cancha ni la
 * muralla: queda el cielo detrás. Al triple, para recortar la cabeza con detalle.
 */
async function iconShot() {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 3 });
  const page = await newGame('en', { ctx });
  await page.addStyleTag({ content: '#hud { visibility: hidden !important; }' });
  await page.evaluate(() => {
    const g = window.__gk;
    g.director.timer = 9999;
    for (const e of g.horde.enemies) e.state = 'gone';
    g.closeup = true;
    // todo lo de la escena menos el caballero y las luces
    let top = g.player.root;
    while (top.parent && top.parent.parent) top = top.parent;
    for (const c of top.parent.children) if (c !== top && !c.isLight) c.visible = false;
  });
  await sleep(2500);
  await page.screenshot({ path: `${RAW}/icono.png` });
  await ctx.close();
}

// ---- armar: lo final, con el título encima ----

/** El recorte del ícono en su captura (3000×3000): la esquina y el lado del cuadrado, con la cabeza y los hombros. */
const ICON = { x: 1300, y: 640, side: 820 };

const TEXTS = {
  es: { tagline: 'Golf contra la horda', coop: ['El caballero', 'Abe, desde un enlace'] },
  en: { tagline: 'Golf vs. the horde', coop: ['The knight', 'Abe, from a link'] },
};

/** El título como el de la cinemática: dorado, con el borde marrón abajo. */
const TITLE_CSS = `
  .title { font: 700 var(--size) Georgia, serif; letter-spacing: calc(var(--size) * 0.06); color: #ffd66b; white-space: nowrap;
    -webkit-text-stroke: calc(var(--size) * 0.018) #4a2a08;
    text-shadow: 0 calc(var(--size) * 0.06) 0 #7a4b12, 0 0 calc(var(--size) * 0.4) rgba(255, 200, 90, 0.45), 0 calc(var(--size) * 0.1) calc(var(--size) * 0.25) rgba(0, 0, 0, 0.55); }
  .tag { font: italic 600 var(--tag) Georgia, serif; color: #fff4d6; letter-spacing: 1px; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8); }`;

/** Arma una imagen con HTML (fondos de logs/promo/) y la guarda en `path`. */
async function compose(path, width, height, body, { scale = 1, type = 'png' } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(`<!doctype html><html><head><style>
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }
    .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    ${TITLE_CSS}
  </style></head><body>${body.replaceAll('RAW/', `${BASE}/${RAW}/`)}</body></html>`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type, ...(type === 'jpeg' ? { quality: 90 } : {}) });
  await page.close();
  console.log('armada', path);
}

if (step === 'armar') {
  for (const lang of ['es', 'en']) {
    const out = `${OUT}/${lang}`;
    mkdirSync(out, { recursive: true });
    const t = TEXTS[lang];
    // la portada: 630×500 (lo que pide itch), y al doble
    const cover = `
      <img class="bg" src="RAW/portada-${ELEGIDOS.portada}.png">
      <div style="position:absolute; inset:0; background: linear-gradient(180deg, rgba(10, 22, 44, 0.72) 0%, rgba(10, 22, 44, 0.25) 30%, transparent 46%)"></div>
      <div style="position:absolute; left:0; right:0; top:5.5%; text-align:center; --size: 104px; --tag: 34px">
        <div class="title">GOLF KNIGHT</div>
        <div class="tag" style="margin-top: 14px">${t.tagline}</div>
      </div>`;
    await compose(`${out}/portada-1260x1000.png`, 1260, 1000, cover);
    await compose(`${out}/portada-630x500.png`, 1260, 1000, cover, { scale: 0.5 });
    // el banner de arriba de la página: 960 de ancho (el de itch), al doble
    await compose(`${out}/banner-1920x600.png`, 1920, 600, `
      <img class="bg" src="RAW/banner.png">
      <div style="position:absolute; right:6%; top:58%; transform:translateY(-50%); text-align:center; --size: 116px; --tag: 38px">
        <div class="title">GOLF KNIGHT</div>
        <div class="tag" style="margin-top: 16px">${t.tagline}</div>
      </div>`);
    // detrás del botón de jugar, en la página de la demo: 640×360, al doble. El botón va en el medio
    await compose(`${out}/boton-jugar-1280x720.png`, 1280, 720, `
      <img class="bg" src="RAW/embed-${ELEGIDOS.embed}.png">
      <div style="position:absolute; inset:0; background: linear-gradient(180deg, rgba(10, 22, 44, 0.7) 0%, transparent 38%)"></div>
      <div style="position:absolute; left:0; right:0; top:6%; text-align:center; --size: 92px; --tag: 30px">
        <div class="title">GOLF KNIGHT</div>
      </div>`);
    // las capturas, 1920×1080
    const shot = (name, src) => compose(`${out}/${name}.jpg`, 1920, 1080, `<img class="bg" src="RAW/${src}.png">`, { type: 'jpeg' });
    await shot('1-oleada', `oleada-${lang}-1`);
    await shot('2-rayo-y-fuego', `rayo-${lang}-${ELEGIDOS.rayo}`);
    await shot('3-jefe', `jefe-${lang}-${ELEGIDOS.jefe}`);
    await shot('4-cartas', `cartas-${lang}`);
    // de a dos: las dos pantallas en el mismo momento, el caballero a la izquierda y Abe a la derecha
    await compose(`${out}/5-de-a-dos.jpg`, 1920, 1080, `
      <img src="RAW/abe-caballero-${lang}.png" style="position:absolute; left:0; top:0; width:960px; height:1080px; object-fit:cover; object-position:50% 50%">
      <img src="RAW/abe-${lang}-${ELEGIDOS.abe}.png" style="position:absolute; left:960px; top:0; width:960px; height:1080px; object-fit:cover; object-position:50% 50%">
      <div style="position:absolute; left:956px; top:0; width:8px; height:1080px; background:#ffd66b; box-shadow: 0 0 18px rgba(0,0,0,.6)"></div>
      ${t.coop.map((label, i) => `<div class="tag" style="position:absolute; top:70px; ${i ? 'right' : 'left'}:40px; --tag: 40px; padding:8px 18px; background:rgba(8,12,18,.72); border-radius:10px">${label}</div>`).join('')}`, { type: 'jpeg' });
    await shot('6-historia-feria', `cine-feria-${lang}`);
    await shot('7-historia-mago', `cine-mago-${lang}`);
  }
  // el ícono (la app de escritorio y la página): el caballero de frente, recortado. El .ico lo arma
  // tools/icono.py, con todos los tamaños de Windows
  await compose(`${OUT}/icono-512.png`, 512, 512, `
    <img src="RAW/icono.png" style="position:absolute; left:-${ICON.x * 512 / ICON.side}px; top:-${ICON.y * 512 / ICON.side}px; width:${3000 * 512 / ICON.side}px; height:${3000 * 512 / ICON.side}px">`);
}

await browser.close();
await server.close();
