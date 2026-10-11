// El simulador de la carga (arco.html; 11/10, pedido de Leandro: la lupa del golpe 4 quedó fea). Se pone
// cuánto dura cada golpe y el arco se reparte en proporción, a velocidad pareja: cada tramo ocupa lo que
// dura. Se carga con espacio o el mouse, como en el juego, y dice qué golpe salió y a cuántos ms del tope.
// La barra (SwingMeter), los golpes (qualityOf) y el dibujo (meterArt) son los del juego.
//
// «Usar en el juego» deja los tiempos y el arco donde los guarda el panel B (ver src/balanceStore.ts y
// VISUAL en src/game/visuals.ts): valen al recargar el juego en el mismo navegador.

import { BALANCE_KEY, BALANCE_VERSION } from './balanceStore';
import { CHARGE, FOURTH, QUALITY_FROM, QUALITY_LEVELS, qualityOf } from './core/clubs';
import { arcAngle, FOURTH_ARC, SwingMeter, type ArcLayout, type ChargeTimes } from './core/swing';
import { meterArt } from './meterArt';

const el = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
const PREFS_KEY = 'gk.simCarga';

/** Lo que se ajusta: los ms de cada golpe (con el golpe 4, `t3` es cada lado del 4), el arco y el dibujo. */
interface Sim {
  fourth: boolean;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  tr: number;
  span: number;
  border: number;
  zoom: number;
}

/** Los del juego, en ms. */
function fromGame(fourth: boolean): Sim {
  const strong = CHARGE.strong * 1000;
  const t4 = fourth ? strong * FOURTH.share : 30;
  return {
    fourth, t1: CHARGE.weak * 1000, t2: CHARGE.mid * 1000, t3: fourth ? (strong - t4) / 2 : strong, t4, tr: CHARGE.rebound * 1000,
    span: fourth ? FOURTH_ARC.span : 90, border: 1.5, zoom: 2.4,
  };
}

let sim: Sim = fromGame(false);
try {
  const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Sim> | null;
  if (saved) sim = { ...sim, ...saved };
} catch { /* lo del juego */ }

const round = (v: number) => Math.round(v * 100) / 100;
/** La pasada por el rojo, en ms: el 3 solo, o 3 + 4 + 3. */
const strongMs = () => (sim.fourth ? 2 * sim.t3 + sim.t4 : sim.t3);
const times = (): ChargeTimes => ({ weak: sim.t1 / 1000, mid: sim.t2 / 1000, strong: strongMs() / 1000, rebound: sim.tr / 1000 });
/** Qué parte de la pasada por el rojo es el 4. */
const share = () => (sim.fourth ? sim.t4 / strongMs() : FOURTH.share);
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
  const art = meterArt(layout(), { fourth: sim.fourth ? share() : 0, widen: sim.span / 90, damage: [1, 2, 3, 4], border: sim.border });
  edge = art.edge;
  meterEl.innerHTML = art.svg;
  meterEl.style.setProperty('--zoom', String(sim.zoom));
  needle = meterEl.querySelector('.needle');
  needle?.setAttribute('transform', `rotate(${-edge})`);
  // lo que dura cada cosa, en palabras
  const top = sim.t1 + sim.t2 + strongMs() / 2;
  el<HTMLParagraphElement>('explain').textContent = sim.fourth
    ? `Hasta el tope son ${round(top)} ms. Cada pasada por el rojo dura ${round(strongMs())} ms: 3 (${round(sim.t3)}), 4 (${round(sim.t4)}) y 3 (${round(sim.t3)}). El 4 es el ${Math.round(share() * 100)} % del rojo.`
    : `Hasta el tope son ${round(top)} ms. Cada pasada por el rojo (el 3) dura ${round(strongMs())} ms.`;
}

// los campos
const fields: [keyof Sim, string][] = [['t1', 't1'], ['t2', 't2'], ['t3', 't3'], ['t4', 't4'], ['tr', 'tr'], ['span', 'span'], ['border', 'border'], ['zoom', 'zoom']];
function paintFields(): void {
  for (const [k, id] of fields) el(id).value = String(round(sim[k] as number));
  el('fourth').checked = sim.fourth;
  el<HTMLElement>('r4').classList.toggle('hidden', !sim.fourth);
  el<HTMLElement>('l3').textContent = sim.fourth ? 'Golpe 3, cada lado' : 'Golpe 3';
}
function save(): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(sim)); } catch { /* no recuerda */ }
}
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
  const on = el('fourth').checked;
  // se parte (o se junta) el rojo de ahora: el 4 en el medio, la mitad
  if (on && !sim.fourth) {
    const strong = sim.t3;
    sim.t4 = strong * FOURTH.share;
    sim.t3 = (strong - sim.t4) / 2;
  } else if (!on && sim.fourth) {
    sim.t3 = 2 * sim.t3 + sim.t4;
  }
  sim.fourth = on;
  paintFields();
  save();
  draw();
});
el('defaults').addEventListener('click', () => {
  sim = { ...fromGame(sim.fourth), border: sim.border, zoom: sim.zoom };
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
  meter.start(times(), marks);
  charging = true;
  pad.classList.add('charging');
}
function release(): void {
  if (!charging) return;
  charging = false;
  pad.classList.remove('charging');
  const off = meter.offPeak * 1000;
  const q = qualityOf(meter.release().power);
  shots.push({ q, off });
  const res = el<HTMLDivElement>('result');
  res.className = `q${q}`;
  void res.offsetWidth;
  res.classList.add('pop');
  const when = Math.abs(off) < 0.5 ? 'justo en el tope' : off < 0 ? `${Math.round(-off)} ms antes del tope` : `${Math.round(off)} ms después del tope`;
  res.innerHTML = `Golpe ${q}<small>${when}</small>`;
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
  for (let q = top; q >= 1; q--) {
    const n = shots.filter((s) => s.q === q).length;
    rows.push(`<tr><td>${q}</td><td>${n}</td><td>${shots.length ? Math.round((100 * n) / shots.length) : 0} %</td></tr>`);
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
    store.configs.carga = { ...store.configs.carga, weak: t.weak, mid: t.mid, strong: t.strong, rebound: t.rebound };
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
  const text = `golpe 1 ${round(sim.t1)} ms · golpe 2 ${round(sim.t2)} ms · ${sim.fourth ? `golpe 3 ${round(sim.t3)} ms de cada lado · golpe 4 ${round(sim.t4)} ms` : `golpe 3 ${round(sim.t3)} ms`} · rebote ${round(sim.tr)} ms · arco ${sim.span}° de cada lado · borde ${sim.border}`;
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
