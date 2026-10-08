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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const step = process.argv[2] ?? 'crudas';
const which = process.argv.slice(3);
/** ¿Se pidió esta escena? Sin nada, todas. */
const want = (n) => !which.length || which.includes(n);
/** Los idiomas: los dos, o el que se pida (es, en). */
const LANGS = ['es', 'en'].filter((l) => !which.some((w) => w === 'es' || w === 'en') || which.includes(l));
const RAW = 'logs/promo';
const OUT = 'promo/itch';
mkdirSync(RAW, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5199';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** La de la portada: detrás del caballero, a la altura de la cabeza. */
const COVER_CAM = { pitch: 8, dist: 6.5, rise: 1.3, ahead: 3, auto: false };

/** El cuadro de cada ráfaga que se usa (se eligen mirándolos). */
const ELEGIDOS = { portada: 1, embed: 2, oleada: 1, rayo: { es: '2-1', en: '2-1' }, jefe: 0, abe: 0 };

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
async function crowd(page, list, { keep = false, walk = false } = {}) {
  await page.evaluate(([list, keep, walk]) => {
    const g = window.__gk;
    if (!keep) for (const e of g.horde.enemies) e.state = 'gone';
    const x0 = g.player.anchor.x;
    // (window.__keep: los que no se lleva la limpieza de la escena del rayo; se anotan en el acto)
    window.__t = list.map(([k, dx, z, m]) => { const e = g.spawn(k, x0 + dx, z, m); if (!walk) e.hold = e.position.clone(); window.__keep?.add(e); return e; });
  }, [list, keep, walk]);
}

/** Ráfaga: `n` capturas cada `every` ms. */
async function burst(page, name, n, every) {
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: `${RAW}/${name}-${i}.png` });
    await sleep(every);
  }
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

/**
 * Una horda que viene caminando desde el fondo: [tipo, metros al costado del caballero, z, poderes]. Nadie
 * quieto. Adelante, en la mira, el del escudo; los goblins, que corren, salen más atrás: si no, llegan
 * primero y quedan pegados al caballero.
 */
const HORDE = [['skeleton', 0.5, 33, { shield: 2 }], ['orc', 3.5, 38, {}], ['warchief', -2.5, 40, {}], ['knight', 5.5, 44, {}], ['orc', -5, 45, {}],
  ['shaman', 2, 48, {}], ['skeleton', -1, 50, {}], ['stoneling', 6, 55, {}], ['goblina', -4, 58, {}], ['goblin', 3, 62, {}], ['goblina', 8, 64, {}],
  ['goblin', -7, 66, {}], ['orc', 0, 68, {}], ['goblin', 5, 72, {}], ['goblina', -2, 74, {}]];

/** El enemigo vivo más cercano adelante (más de `min` metros), para apuntarle. */
async function nearestAhead(page, min = 10) {
  return page.evaluate((min) => {
    const g = window.__gk;
    const z0 = g.player.anchor.z;
    const live = g.horde.enemies.filter((e) => e.alive && e.position.z - z0 > min).sort((a, b) => a.position.z - b.position.z);
    const e = live[0];
    return e ? g.screenOf(e.position.x, e.position.z) : null;
  }, min);
}

/**
 * Cargar apuntando al más cercano y sacar la foto en pleno swing. Después se cancela (X): soltando, la
 * pelota se va y el puesto queda vacío, y sin pelota no se puede volver a cargar.
 */
async function swingShot(page, path, { hold = 500, min = 10 } = {}) {
  const at = await nearestAhead(page, min);
  if (at) await page.mouse.move(at.x, at.y);
  await sleep(150);
  await page.mouse.down();
  await sleep(hold);
  await page.screenshot({ path });
  await page.keyboard.press('KeyX');
  await page.mouse.up();
}

/** La portada y la imagen del botón de jugar: el caballero de espaldas con el palo arriba, la horda viniendo. */
async function coverShots() {
  for (const [name, width, height] of [['portada', 1260, 1000], ['embed', 1280, 720]]) {
    const page = await newGame('en', { width, height });
    await page.addStyleTag({ content: '#hud { visibility: hidden !important; }' });
    await page.evaluate(() => { window.__gk.director.timer = 9999; });
    await crowd(page, HORDE.map(([k, dx, z, m]) => [k, dx, z, m]), { walk: true });
    await hideBadges(page);
    await camera(page, COVER_CAM);
    // que se acerquen caminando, y cada tanto un swing: después se elige el cuadro en que la horda está
    // a la distancia de pegarle
    await sleep(2500);
    for (let i = 0; i < 10; i++) {
      await swingShot(page, `${RAW}/${name}-${i}.png`, { hold: 520, min: 12 });
      await sleep(700);
    }
    await page.close();
  }
}

/** Las capturas del juego, en un idioma, con la cámara de siempre y oleadas de verdad. */
async function gameShots(lang) {
  let page;
  // 1) una oleada llegando, con la mano llena y el tiro cargando (el arco de carga se ve)
  if (want('oleada')) {
    page = await newGame(lang);
    await hand(page);
    await page.evaluate(() => { window.__gk.director.goTo(4); });
    await sleep(12000);
    // la oleada de verdad y un grupo más que viene caminando detrás, con sus poderes: más horda a la vista
    await crowd(page, [['skeleton', -4, 42, { shield: 2 }], ['orc', 3, 46, {}], ['goblina', 7, 44, { armor: 1 }], ['knight', -1, 52, { divine: 5 }],
      ['warchief', 5, 56, { regen: 2 }], ['goblin', -7, 50, {}], ['orc', 1, 60, { ethereal: true }], ['goblin', 8, 58, {}]], { keep: true, walk: true });
    await sleep(9000);
    for (let i = 0; i < 4; i++) {
      await swingShot(page, `${RAW}/oleada-${lang}-${i}.png`, { hold: 450, min: 14 });
      await sleep(1600);
    }
    await page.close();
  }

  // 2) fuego y rayo, jugando: el hierro de fuego prende a un grupo, y el guante de rayo hace que el
  // golpe del caballero salte entre todos (con la maestría del fuego, los que mueren prendidos explotan)
  // 2) fuego y rayo, jugando: un grupo que viene caminando, el hierro de fuego lo prende, y el caballero
  // pega con el driver de rayo, que salta entre todos (con la maestría, los que mueren prendidos explotan)
  if (want('rayo')) {
    page = await newGame(lang);
    await hand(page, [['driver-lightning', 3], ['iron-fire', 3], ['wedge-ice', 2], ['clone', 1]]);
    await page.evaluate(() => { const g = window.__gk; g.perk('masteryFire', 1); g.perk('mixFireLightning', 1); g.director.goTo(3); });
    // la oleada es la de verdad (el título arriba), pero sus enemigos se van: los poderes del escenario
    // salen al azar, y el que esquiva o el del escudo se comían el rayo. Quedan los que se ponen acá
    await page.evaluate(() => {
      window.__keep = new Set();
      const clear = () => {
        for (const e of window.__gk.horde.enemies) if (!window.__keep.has(e) && e.state !== 'gone') e.state = 'gone';
        requestAnimationFrame(clear);
      };
      clear();
    });
    await sleep(2000);
    // varios intentos: no siempre agarra el rayo en el cuadro (se elige el que más rayo tiene, ver ELEGIDOS)
    for (let i = 0; i < 6; i++) {
      // el driver de rayo llega a unos 25 m: el grupo tiene que estar más cerca que eso cuando se tira
      await crowd(page, [['orc', 0, 30, {}], ['goblina', -2, 33, {}], ['skeleton', 2, 32, { armor: 1 }], ['orc', -1, 35, {}], ['orc', 1.5, 34, {}],
        ['skeleton', 3.5, 36, {}], ['goblina', -3.5, 38, {}], ['warchief', 0.5, 37, {}],
        // y otros más atrás, que vienen llegando
        ['goblin', -7, 52, {}], ['orc', 6, 55, {}], ['skeleton', -3, 60, { shield: 2 }], ['goblina', 8, 63, {}], ['knight', 2, 66, {}]], { keep: true, walk: true });
      await sleep(7500);
      // al medio del grupo de adelante (los primeros ocho)
      const at = await page.evaluate(() => {
        const live = window.__t.slice(0, 8).filter((e) => e.alive);
        if (!live.length) return null;
        const x = live.reduce((s, e) => s + e.position.x, 0) / live.length;
        const z = live.reduce((s, e) => s + e.position.z, 0) / live.length;
        return window.__gk.screenOf(x, z);
      });
      if (at) await page.mouse.move(at.x, at.y);
      await sleep(200);
      // cargando el golpe (en pleno swing no se puede tirar), el hierro de fuego y el driver de rayo: con la
      // Tormenta de fuego, el fuego también llama al rayo cuando toca. El caballero queda con el palo arriba
      await page.mouse.down();
      await sleep(250);
      await page.evaluate(() => { const g = window.__gk; g.abilities.cooldowns.fill(0); g.cast('iron-fire'); g.cast('driver-lightning'); });
      await burst(page, `rayo-${lang}-${i}`, 22, 0);
      await page.keyboard.press('KeyX');
      await page.mouse.up();
      // al puesto de al lado, que tiene pelota
      await page.keyboard.press('KeyD');
      await sleep(1500);
    }
    await page.close();
  }

  // 3) el jefe: la última oleada, con el gólem plantado y su escolta llegando
  if (want('jefe')) {
    page = await newGame(lang);
    await hand(page, [['driver-fire', 3], ['iron-lightning', 3], ['wedge-ice', 3], ['might', 2]]);
    await page.evaluate(() => { window.__gk.director.goTo(9); });
    await sleep(34000);
    for (let i = 0; i < 3; i++) {
      await swingShot(page, `${RAW}/jefe-${lang}-${i}.png`, { hold: 450, min: 12 });
      await sleep(1800);
    }
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
  for (const lang of LANGS) {
    if (['oleada', 'rayo', 'jefe', 'cartas'].some(want)) await gameShots(lang);
    if (want('abe')) await abeShot(lang);
  }
}

// ---- armar: lo final, con el título encima ----

/**
 * El ícono (8/10, Leandro: sin personaje, con el título y un palo de golf): un escudo rojo con borde
 * dorado, un palo de golf y una espada cruzados, la pelota, y el título en una cinta. Dibujado, no
 * capturado: se ve igual de chico (el .ico de Windows lo arma tools/promo.mjs con 7 tamaños).
 */
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22436a"/><stop offset="1" stop-color="#0b1626"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".55" stop-color="#ffc94d"/><stop offset="1" stop-color="#c98a1e"/></linearGradient>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3262c"/><stop offset="1" stop-color="#4e0b12"/></linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cfd8e2"/><stop offset="1" stop-color="#8794a3"/></linearGradient>
    <radialGradient id="ball" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e9edf2"/><stop offset="1" stop-color="#aeb8c4"/></radialGradient>
  </defs>
  <rect width="512" height="512" rx="92" fill="url(#bg)"/>
  <path d="M256 34 L430 88 V214 C430 320 356 392 256 436 C156 392 82 320 82 214 V88 Z" fill="url(#shield)" stroke="url(#gold)" stroke-width="16" stroke-linejoin="round"/>
  <g transform="rotate(-38 256 222)">
    <polygon points="256,50 271,80 271,300 241,300 241,80" fill="url(#steel)" stroke="#3a4552" stroke-width="3"/>
    <line x1="256" y1="74" x2="256" y2="296" stroke="#8794a3" stroke-width="3"/>
    <rect x="200" y="298" width="112" height="18" rx="9" fill="url(#gold)" stroke="#6b3f0c" stroke-width="3"/>
    <rect x="247" y="316" width="18" height="62" rx="5" fill="#5a2e12" stroke="#2a1406" stroke-width="3"/>
    <circle cx="256" cy="388" r="14" fill="url(#gold)" stroke="#6b3f0c" stroke-width="3"/>
  </g>
  <g transform="rotate(38 256 222)">
    <rect x="247" y="46" width="18" height="86" rx="6" fill="#26303b" stroke="#0e1319" stroke-width="3"/>
    <rect x="251" y="130" width="10" height="240" fill="url(#steel)" stroke="#3a4552" stroke-width="2"/>
    <path d="M262 362 C 266 392 246 412 210 410 C 186 408 180 388 196 376 C 214 364 238 368 262 362 Z" fill="#1d2733" stroke="#0a0e13" stroke-width="3"/>
    <path d="M250 372 C 236 374 214 376 202 384" stroke="#7d8da0" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>
  <circle cx="232" cy="338" r="30" fill="url(#ball)" stroke="#5d6b7a" stroke-width="3"/>
  <g fill="#9aa6b3" opacity=".55">
    <circle cx="221" cy="327" r="3.2"/><circle cx="234" cy="324" r="3.2"/><circle cx="244" cy="331" r="3.2"/>
    <circle cx="225" cy="340" r="3.2"/><circle cx="237" cy="338" r="3.2"/><circle cx="248" cy="343" r="3.2"/>
    <circle cx="228" cy="352" r="3.2"/><circle cx="241" cy="350" r="3.2"/><circle cx="218" cy="347" r="3.2"/>
  </g>
  <path d="M22 376 H490 L466 412 L490 448 H22 L46 412 Z" fill="url(#gold)" stroke="#6b3f0c" stroke-width="5" stroke-linejoin="round"/>
  <text x="256" y="429" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="50" letter-spacing="2" fill="#3b1f05">GOLF KNIGHT</text>
</svg>`;

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
async function compose(path, width, height, body, { scale = 1, type = 'png', transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(`<!doctype html><html><head><style>
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: ${transparent ? 'transparent' : '#000'}; }
    .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    ${TITLE_CSS}
  </style></head><body>${body.replaceAll('RAW/', `${BASE}/${RAW}/`)}</body></html>`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type, ...(type === 'jpeg' ? { quality: 90 } : {}), ...(transparent ? { omitBackground: true } : {}) });
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
    await shot('1-oleada', `oleada-${lang}-${ELEGIDOS.oleada}`);
    await shot('2-rayo-y-fuego', `rayo-${lang}-${ELEGIDOS.rayo[lang]}`);
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
}

/**
 * El ícono, en PNG de 512 (con las esquinas transparentes) y en el .ico de la app de Windows
 * (desktop/icon.ico): siete tamaños, cada uno un PNG adentro (Windows lo acepta desde Vista).
 */
async function makeIcon() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/icono.svg`, ICON_SVG);
  const svg = `<div style="position:absolute; inset:0">${ICON_SVG}</div>`;
  await compose(`${OUT}/icono-512.png`, 512, 512, svg, { transparent: true });
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const s of sizes) {
    const path = `${RAW}/icono-${s}.png`;
    await compose(path, 512, 512, svg, { transparent: true, scale: s / 512 });
    pngs.push(readFileSync(path));
  }
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(s === 256 ? 0 : s, at);
    header.writeUInt8(s === 256 ? 0 : s, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(pngs[i].length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += pngs[i].length;
  });
  writeFileSync('desktop/icon.ico', Buffer.concat([header, ...pngs]));
  console.log('ícono: promo/itch/icono-512.png y desktop/icon.ico');
}
if (step === 'armar' || step === 'icono') await makeIcon();

await browser.close();
await server.close();
