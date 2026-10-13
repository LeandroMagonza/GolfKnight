// El simulador de la carga (arco.html; 11/10, pedido de Leandro: la lupa del golpe 4 quedó fea). Se pone
// cuánto dura cada golpe y el arco se reparte en proporción, a velocidad pareja: cada tramo ocupa lo que
// dura. El 3 es lo que dura toda la pasada por el rojo; con el golpe 4 se parte en tres, y el tercio del
// medio es el 4 (FOURTH.share). Se carga con espacio o el mouse, como en el juego, y dice qué golpe salió y
// a cuántos ms del tope.
// La barra (SwingMeter), los golpes (qualityOf) y el dibujo (meterArt) son los del juego.
//
// «Usar en el juego» deja los tiempos y el arco donde los guarda el panel B (ver src/balanceStore.ts y
// VISUAL en src/game/visuals.ts): valen al recargar el juego en el mismo navegador.

import { BALANCE_KEY, BALANCE_VERSION } from './balanceStore';
import { CHARGE, FOURTH, isTap, QUALITY_FROM, QUALITY_LEVELS, qualityOf, TAP } from './core/clubs';
import { arcAngle, FOURTH_ARC, SwingMeter, type ArcLayout, type ChargeTimes } from './core/swing';
import { meterArt } from './meterArt';

const el = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
// (con el 3 en tiempo total y sin el rebote: lo guardado antes no sirve)
const PREFS_KEY = 'gk.simCarga2';
/** Con el golpe 4, qué parte del 3 es el 4: el tercio del medio (Leandro). */
const SPLIT = 1 / 3;

/**
 * Lo que se ajusta: los ms de cada golpe (el 3, toda la pasada por el rojo), el arco y el dibujo. Para el
 * daño por segundo (13/10, Leandro): `move`, los ms entre un tiro y el siguiente sin contar la carga, y `hit`,
 * el % de tiros que pegan.
 */
interface Sim {
  fourth: boolean;
  t1: number;
  t2: number;
  t3: number;
  span: number;
  border: number;
  zoom: number;
  move: number;
  hit: number;
  /** El click (ver TAP en core/clubs): 0 lo de siempre, 1 pifia, 2 pega 1; y qué % del golpe 1 es. */
  click: number;
  clickPart: number;
}

/**
 * Lo que tarda la mecánica entre un tiro y el siguiente, sin la carga ni apuntar (Leandro: «algo más teórico
 * pero realista»), en ms: del soltar al impacto (~110) y hasta poder cargar otra vez (220, ver RECOVER en
 * game/player.ts), y el paso al puesto de al lado, donde está la pelota siguiente (medido: 400; a dos
 * puestos, 530). En sus partidas, apuntando, le da unos 1000 (de las oleadas de 25 tiros o más del 11 al
 * 13/10, a lo que tarda cada tiro se le resta lo que carga). Y pega el 90 %.
 */
const MEASURED = { move: 750, played: 1000, hit: 90 };

/** Los del juego, en ms. */
function fromGame(fourth: boolean): Sim {
  return { fourth, t1: CHARGE.weak * 1000, t2: CHARGE.mid * 1000, t3: CHARGE.strong * 1000, span: fourth ? FOURTH_ARC.span : 90, border: 1.5, zoom: 2.4, click: TAP.mode, clickPart: TAP.part * 100, ...MEASURED };
}

let sim: Sim = fromGame(false);
try {
  const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Sim> | null;
  if (saved) sim = { ...sim, ...saved };
} catch { /* lo del juego */ }

const round = (v: number) => Math.round(v * 100) / 100;
/** La pasada por el rojo, en ms: el 3 (con el golpe 4, 3 + 4 + 3). */
const strongMs = () => sim.t3;
const times = (): ChargeTimes => ({ weak: sim.t1 / 1000, mid: sim.t2 / 1000, strong: strongMs() / 1000 });
/** Qué parte de la pasada por el rojo es el 4. */
const share = () => SPLIT;
const marks: [number, number] = [QUALITY_FROM[1], QUALITY_FROM[QUALITY_LEVELS - 1]];

/** El arco a velocidad pareja: hasta el tope (débil + medio + medio fuerte) son `span` grados de cada lado. */
function layout(): ArcLayout {
  const t = times();
  const perSec = sim.span / (t.weak + t.mid + t.strong / 2);
  return { weak: t.weak * perSec, mid: t.mid * perSec, strong: (t.strong / 2) * perSec, span: sim.span };
}

const meter = new SwingMeter();
const meterEl = el<HTMLDivElement>('meter');
const pad = el<HTMLDivElement>('pad');
let needle: SVGGElement | null = null;
let edge = 90;
let charging = false;
let last = performance.now();

function draw(): void {
  const tap = sim.click ? { part: sim.clickPart / 100, damage: sim.click === 1 ? 0 : 1 } : null;
  const art = meterArt(layout(), { fourth: sim.fourth ? share() : 0, widen: sim.span / 90, damage: [1, 2, 3, 4], border: sim.border, tap });
  edge = art.edge;
  meterEl.innerHTML = art.svg;
  meterEl.style.setProperty('--zoom', String(sim.zoom));
  needle = meterEl.querySelector('.needle');
  needle?.setAttribute('transform', `rotate(${-edge})`);
  // lo que dura cada cosa, en palabras
  const top = sim.t1 + sim.t2 + strongMs() / 2;
  const third = strongMs() * SPLIT;
  const back = 2 * (sim.t1 + sim.t2) + strongMs();
  el<HTMLParagraphElement>('explain').textContent = (sim.fourth
    ? `Hasta el tope son ${round(top)} ms. Cada pasada por el rojo dura ${round(strongMs())} ms, partida en tres: 3 (${round(third)}), 4 (${round(third)}) y 3 (${round(third)}).`
    : `Hasta el tope son ${round(top)} ms. Cada pasada por el rojo (el 3) dura ${round(strongMs())} ms.`)
    + ` Si te pasás, el rojo vuelve a los ${round(back)} ms (baja hasta el borde y vuelve a subir).`
    + (sim.click ? ` El click: hasta los ${round((sim.t1 * sim.clickPart) / 100)} ms${sim.click === 1 ? ', pifia' : ', pega 1 (el tramo pálido)'}.` : '');
  drawDps();
}

/**
 * El daño por segundo de cada golpe, con lo que se carga cada uno **de lo justo a lo más** (Leandro: el 1 es
 * un click sin cargar; el 2, de pasar el 1 hasta el final de su tramo): cada tiro tarda lo de entre tiros
 * más esa carga. Con el golpe 4, el rojo se parte en tres: 3, 4 (el del medio) y 3. Cada palo pega distinto:
 * el hierro y el driver, su número; el driver de lejos (más de 40 m) y el putter de cerca (hasta 20 m), uno
 * más; el wedge, uno menos (es de área). En los que pegan.
 */
function drawDps(): void {
  const red = sim.t3;
  const edge = (1 - FOURTH.share) / 2;
  const base = sim.t1 + sim.t2;
  // con el click, el golpe 1 en dos: el click y el resto
  const tapEnd = (sim.t1 * sim.clickPart) / 100;
  const rows: { q: number; from: number; to: number; tap?: boolean }[] = [
    ...(sim.click ? [{ q: 1, from: 0, to: tapEnd, tap: true }, { q: 1, from: tapEnd, to: sim.t1 }] : [{ q: 1, from: 0, to: sim.t1 }]),
    { q: 2, from: sim.t1, to: base },
    { q: 3, from: base, to: sim.fourth ? base + red * edge : base + red },
    ...(sim.fourth ? [{ q: 4, from: base + red * edge, to: base + red * (1 - edge) }] : []),
  ];
  const hits = (q: number) => (q === 4 ? 3 + FOURTH.bonus : q);
  const secs = (charge: number) => (sim.move + charge) / 1000;
  const dps = (dmg: number, charge: number) => (Math.max(0, dmg) * (sim.hit / 100)) / secs(charge);
  // de lo justo a lo más: el primero es el más alto
  const range = (dmg: number, r: { from: number; to: number }) => (dmg <= 0 ? '—' : `${dps(dmg, r.from).toFixed(2)} – ${dps(dmg, r.to).toFixed(2)}`);
  // en el click: con la pifia no sale; pegando 1, 1 (sin el +1 de distancia)
  const tapped = (n: number, r: { tap?: boolean }) => (!r.tap ? n : sim.click === 1 ? 0 : Math.min(n, 1));
  el<HTMLElement>('dps').innerHTML = rows.map((r) => {
    const q = hits(r.q);
    return `<tr><td>${r.q}${r.tap ? ' (click)' : ''}</td><td>${Math.round(r.from)}–${Math.round(r.to)} ms</td><td>${secs(r.from).toFixed(2)}–${secs(r.to).toFixed(2)} s</td>`
      + `<td>${range(tapped(q, r), r)}</td><td>${range(tapped(q + 1, r), r)}</td><td>${range(tapped(q - 1, r), r)}</td></tr>`;
  }).join('');
  // las que importan para el que se cura: llegar a la misma vida con un golpe o con varios (cargando lo justo,
  // y con la pifia del click, pasándola)
  const t = (q: number) => secs(rows.find((r) => r.q === q && !(r.tap && sim.click === 1))!.from);
  const vs = (a: string, ta: number, b: string, tb: number) => `${a}: ${ta.toFixed(2)} s, contra ${b}: ${tb.toFixed(2)} s`;
  el<HTMLParagraphElement>('dpsnote').textContent = 'Cargando lo justo: ' + [
    vs('un 2', t(2), 'dos 1', 2 * t(1)),
    vs('un 3', t(3), 'un 2 y un 1', t(2) + t(1)),
    vs('un 3 y un 2', t(3) + t(2), 'dos 2 y un 1', 2 * t(2) + t(1)),
  ].join(' · ') + '. Sin contar los que no pegan.';
  el<HTMLParagraphElement>('movenote').textContent = `Entre tiros: lo de la mecánica, sin apuntar (${MEASURED.move} ms: el swing hasta poder cargar otra vez, ~330, y el paso al puesto de al lado, 400). En tus partidas, apuntando, te da unos ${MEASURED.played} ms. El daño por segundo va de cargar lo justo a cargar todo el tramo.`;
}

// los campos
const fields: [keyof Sim, string][] = [['t1', 't1'], ['t2', 't2'], ['t3', 't3'], ['span', 'span'], ['border', 'border'], ['zoom', 'zoom'], ['move', 'move'], ['hit', 'hit']];
function paintFields(): void {
  for (const [k, id] of fields) el(id).value = String(round(sim[k] as number));
  el('fourth').checked = sim.fourth;
  el<HTMLSelectElement>('click').value = String(sim.click);
  el('clickpart').value = String(round(sim.clickPart));
  // con el golpe 4 el 3 es naranja (el rojo es el 4)
  el<HTMLElement>('c3').style.background = sim.fourth ? '#ff9a2e' : '#ff2d3c';
}
function save(): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(sim)); } catch { /* no recuerda */ }
}
el<HTMLSelectElement>('click').addEventListener('change', () => {
  sim.click = Number(el<HTMLSelectElement>('click').value);
  save();
  draw();
  paintStats();
});
el('clickpart').addEventListener('input', () => {
  const v = Number(el('clickpart').value);
  if (!Number.isFinite(v) || v <= 0 || v > 100) return;
  sim.clickPart = v;
  save();
  draw();
});
for (const [k, id] of fields) {
  el(id).addEventListener('input', () => {
    const v = Number(el(id).value);
    if (!Number.isFinite(v) || v <= 0) return;
    (sim as unknown as Record<string, number>)[k] = v;
    save();
    draw();
  });
}
el('fourth').addEventListener('change', () => {
  // el rojo se parte en tres (o se vuelve a juntar): lo que dura no cambia
  sim.fourth = el('fourth').checked;
  paintFields();
  save();
  draw();
});
el('defaults').addEventListener('click', () => {
  sim = { ...fromGame(sim.fourth), border: sim.border, zoom: sim.zoom, move: sim.move, hit: sim.hit, click: sim.click, clickPart: sim.clickPart };
  paintFields();
  save();
  draw();
});

// cargar y soltar, como en el juego
const shots: { q: number; off: number }[] = [];
function start(): void {
  if (charging) return;
  FOURTH.on = sim.fourth;
  FOURTH.share = share();
  TAP.mode = sim.click;
  TAP.part = sim.clickPart / 100;
  meter.start(times(), marks);
  charging = true;
  pad.classList.add('charging');
}
function release(): void {
  if (!charging) return;
  charging = false;
  pad.classList.remove('charging');
  const off = meter.offPeak * 1000;
  const power = meter.release().power;
  // el click (ver TAP) cuenta aparte, como golpe 0
  const q = isTap(power) ? 0 : qualityOf(power);
  shots.push({ q, off });
  const res = el<HTMLDivElement>('result');
  res.className = `q${q}`;
  void res.offsetWidth;
  res.classList.add('pop');
  const when = Math.abs(off) < 0.5 ? 'justo en el tope' : off < 0 ? `${Math.round(-off)} ms antes del tope` : `${Math.round(off)} ms después del tope`;
  res.innerHTML = `${q ? `Golpe ${q}` : sim.click === 1 ? 'Pifia' : 'Click: pega 1'}<small>${when}</small>`;
  paintStats();
}
function cancel(): void {
  if (!charging) return;
  charging = false;
  pad.classList.remove('charging');
  meter.cancel();
}
pad.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
addEventListener('pointerup', release);
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); start(); }
  if (e.code === 'KeyX' || e.code === 'Escape') cancel();
});
addEventListener('keyup', (e) => { if (e.code === 'Space') release(); });

function paintStats(): void {
  const top = sim.fourth ? 4 : 3;
  const rows = [];
  for (let q = top; q >= (sim.click ? 0 : 1); q--) {
    const n = shots.filter((s) => s.q === q).length;
    rows.push(`<tr><td>${q || 'click'}</td><td>${n}</td><td>${shots.length ? Math.round((100 * n) / shots.length) : 0} %</td></tr>`);
  }
  el<HTMLElement>('stats').innerHTML = rows.join('');
  // los que buscaban el tope: a menos de 250 ms
  const near = shots.map((s) => s.off).filter((o) => Math.abs(o) <= 250);
  const mean = near.length ? near.reduce((a, b) => a + b, 0) / near.length : 0;
  const sd = near.length > 1 ? Math.sqrt(near.reduce((a, b) => a + (b - mean) ** 2, 0) / (near.length - 1)) : 0;
  el<HTMLParagraphElement>('offs').textContent = near.length
    ? `${shots.length} tiros. Cerca del tope (${near.length}): en promedio ${Math.round(Math.abs(mean))} ms ${mean < 0 ? 'antes' : 'después'}, con un desvío de ±${Math.round(sd)} ms.`
    : shots.length ? `${shots.length} tiros.` : '';
}
el('reset').addEventListener('click', () => {
  shots.length = 0;
  el<HTMLDivElement>('result').className = '';
  el<HTMLDivElement>('result').textContent = 'Mantené apretado (espacio o el mouse) y soltá';
  paintStats();
});

// dejarlo para el juego, donde lo guarda el panel B
el('use').addEventListener('click', () => {
  const said = el<HTMLSpanElement>('said');
  try {
    const store = JSON.parse(localStorage.getItem(BALANCE_KEY) ?? '{}') as { version?: number; configs?: Record<string, Record<string, number>> };
    store.version ??= BALANCE_VERSION;
    store.configs ??= {};
    const t = times();
    store.configs.carga = { ...store.configs.carga, weak: t.weak, mid: t.mid, strong: t.strong };
    store.configs.click = { ...store.configs.click, mode: sim.click, part: sim.clickPart / 100 };
    if (sim.fourth) {
      store.configs['golpe 4'] = { ...store.configs['golpe 4'], share: share() };
      store.configs['arco golpe 4'] = { ...store.configs['arco golpe 4'], span: sim.span };
    }
    localStorage.setItem(BALANCE_KEY, JSON.stringify(store));
    // el arco del golpe 4, a velocidad pareja (medio círculo, o abierto a `span`), y el borde de los tramos
    const visual = JSON.parse(localStorage.getItem('gk.visual') ?? '{}') as Record<string, unknown>;
    if (sim.fourth) visual.fourthArc = sim.span === 90 ? 'medio' : 'extendido';
    visual.zoneBorder = sim.border;
    localStorage.setItem('gk.visual', JSON.stringify(visual));
    said.textContent = sim.fourth || sim.span === 90
      ? 'Listo: recargá el juego en este navegador.'
      : 'Listo: recargá el juego. (Sin el golpe 4 el arco del juego es siempre medio círculo.)';
  } catch {
    said.textContent = 'No se pudo guardar (¿modo privado?).';
  }
  setTimeout(() => { said.textContent = ''; }, 5000);
});
el('copy').addEventListener('click', async () => {
  const text = `golpe 1 ${round(sim.t1)} ms · golpe 2 ${round(sim.t2)} ms · golpe 3 ${round(sim.t3)} ms${sim.fourth ? ` (con el 4 en el tercio del medio: ${round(sim.t3 * SPLIT)} ms)` : ''}${sim.click ? ` · click ${sim.click === 1 ? 'pifia' : 'pega 1'} en el ${round(sim.clickPart)} % del golpe 1` : ''} · arco ${sim.span}° de cada lado · borde ${sim.border}`;
  try {
    await navigator.clipboard.writeText(text);
    el<HTMLSpanElement>('said').textContent = 'Copiado.';
  } catch {
    el<HTMLSpanElement>('said').textContent = text;
  }
});

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (charging) {
    meter.update(dt);
    const angle = meter.side * Math.max(0, edge - arcAngle(meter.power, marks, layout()));
    needle?.setAttribute('transform', `rotate(${angle.toFixed(2)})`);
  }
  requestAnimationFrame(frame);
}

paintFields();
draw();
paintStats();
requestAnimationFrame(frame);
