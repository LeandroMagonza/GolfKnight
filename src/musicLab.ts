// La página de la música (musica.html, con las herramientas de prueba): escuchar cada canción, compararlas
// con el mismo fundido del juego, y elegir cuál va en cada momento de la partida (lo mismo que el panel B).
// También `window.renderSong`, que la renderiza sin sonar (Tone.Offline) y devuelve el WAV, sus niveles y un
// espectrograma: lo usa tools/musica-render.mjs, para revisar una canción sin escucharla.
import * as Tone from 'tone';
import { MusicPlayer, SAME } from './audio/music/player';
import { DEFAULT_SONG, listSongs, loadSong } from './audio/music/registry';
import { MUSIC_SLOTS, type MusicSlot, type SongDef } from './audio/music/types';

const $ = (id: string) => document.getElementById(id)!;
const SLOT_NAMES: Record<MusicSlot, string> = {
  escenario1: 'Escenario 1', escenario2: 'Escenario 2', escenario3: 'Escenario 3', elite: 'Con un élite en la cancha', jefe: 'El jefe',
};

/** La misma cadena que la música del juego (ver GameAudio.start): reverb y un limitador al final. */
function chain(): Tone.Gain {
  const limiter = new Tone.Compressor({ threshold: -3, ratio: 20, knee: 0, attack: 0.002, release: 0.15 }).toDestination();
  const verb = new Tone.Freeverb({ roomSize: 0.7, dampening: 2500, wet: 0.25 }).connect(limiter);
  return new Tone.Gain(0.8).connect(verb);
}

let bus: Tone.Gain | null = null;
const player = new MusicPlayer(() => bus);
let playingId: string | null = null;

async function ensureAudio(): Promise<void> {
  if (bus) return;
  await Tone.start();
  bus = chain();
  Tone.getTransport().start();
}

async function play(id: string | null): Promise<void> {
  await ensureAudio();
  playingId = id;
  player.preview(id);
  if (!id) player.preview(null);
  paint();
}

let rows: { id: string; el: HTMLElement }[] = [];
function paint(): void {
  for (const r of rows) r.el.classList.toggle('on', r.id === playingId);
}

async function build(): Promise<void> {
  const files = await listSongs();
  const songs = files.flatMap((f) => f.songs);
  const list = $('list');
  list.textContent = '';
  rows = [];
  for (const f of files) {
    if (f.error) {
      const bad = document.createElement('div');
      bad.className = 'bad';
      bad.textContent = `${f.file}: no carga (${f.error})`;
      list.append(bad);
    }
    for (const s of f.songs) {
      const row = document.createElement('div');
      row.className = 'song';
      const btn = document.createElement('button');
      btn.className = 'play';
      btn.textContent = '▶';
      btn.onclick = () => void play(playingId === s.id ? null : s.id);
      const info = document.createElement('div');
      info.innerHTML = `<b>${s.name}<span class="tag">${s.role}</span></b><small>${s.blurb}</small><code>${s.id}</code>`;
      const dl = document.createElement('button');
      dl.textContent = 'WAV 40 s';
      dl.title = 'Renderizarla y bajarla';
      dl.onclick = async () => {
        dl.textContent = '…';
        const r = await renderSong(s.id, 40, 0.5, false);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([Uint8Array.from(atob(r.wav), (c) => c.charCodeAt(0))], { type: 'audio/wav' }));
        a.download = `${s.id}.wav`;
        a.click();
        dl.textContent = 'WAV 40 s';
      };
      row.append(btn, info, dl);
      list.append(row);
      rows.push({ id: s.id, el: row });
    }
  }
  const slots = $('slots');
  slots.textContent = '';
  for (const slot of MUSIC_SLOTS) {
    const label = document.createElement('label');
    label.textContent = SLOT_NAMES[slot];
    const sel = document.createElement('select');
    const options: [string, string][] = slot.startsWith('escenario') ? [] : [[SAME, 'la del escenario']];
    for (const s of songs) options.push([s.id, `${s.name} (${s.id})`]);
    for (const [v, t] of options) sel.append(new Option(t, v));
    sel.value = player.songFor(slot) || SAME;
    sel.onchange = () => player.setSong(slot, sel.value);
    label.append(sel);
    slots.append(label);
  }
}

$('stop').onclick = () => void play(null).then(() => {
  // sin canción elegida, el reproductor vuelve a la del lugar: acá «parar» es callar todo
  bus?.gain.rampTo(0, 0.4);
  setTimeout(() => bus?.gain.rampTo(0.8, 0.1), 3000);
});
const tension = $('tension') as HTMLInputElement;
tension.oninput = () => {
  $('tval').textContent = tension.value;
  player.intensity(Number(tension.value));
};
void build();

// ---------- renderizar sin sonar (para tools/musica-render.mjs) ----------

const SR = 32000;

/**
 * Renderiza `seconds` s de la canción `id` con la tensión `intensity` (o subiendo de 0 a 1 con `rising`).
 * Devuelve el WAV (base64), los niveles y un espectrograma (PNG, data URL).
 */
async function renderSong(id: string, seconds = 40, intensity = 0, rising = false) {
  const def: SongDef | null = await loadSong(id);
  if (!def) throw new Error(`no existe la canción ${id}`);
  const buffer = await Tone.Offline(async (ctx) => {
    const out = chain();
    const song = def.build(out, ctx.transport);
    song.intensity?.(rising ? 0 : intensity);
    if (rising) for (let s = 1; s < seconds; s++) ctx.transport.scheduleOnce(() => song.intensity?.(s / seconds), s);
    song.start(0.05);
    ctx.transport.start(0);
  }, seconds, 2, SR);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  return { wav: wavBase64(left, right), ...levels(left, right), spectrogram: spectrogram(left, right) };
}
(window as unknown as { renderSong: typeof renderSong; DEFAULT_SONG: string }).renderSong = renderSong;
(window as unknown as { DEFAULT_SONG: string }).DEFAULT_SONG = DEFAULT_SONG;

function levels(l: Float32Array, r: Float32Array) {
  let peak = 0;
  let clipped = 0;
  const perSecond: number[] = [];
  let acc = 0;
  for (let i = 0; i < l.length; i++) {
    const a = Math.max(Math.abs(l[i]), Math.abs(r[i]));
    if (a > peak) peak = a;
    if (a > 0.999) clipped++;
    acc += (l[i] * l[i] + r[i] * r[i]) / 2;
    if ((i + 1) % SR === 0) {
      perSecond.push(+(10 * Math.log10(acc / SR + 1e-12)).toFixed(1));
      acc = 0;
    }
  }
  const db = (x: number) => +(20 * Math.log10(x + 1e-12)).toFixed(1);
  const mean = perSecond.length ? perSecond.reduce((a, b) => a + b, 0) / perSecond.length : -120;
  return { peakDb: db(peak), rmsDb: +mean.toFixed(1), rmsPerSecond: perSecond, clipped, silentSeconds: perSecond.filter((x) => x < -50).length };
}

function wavBase64(l: Float32Array, r: Float32Array): string {
  const n = l.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true);
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true);
  }
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Espectrograma: frecuencia en escala logarítmica (40 Hz a 12 kHz) contra el tiempo, más el nivel abajo. */
function spectrogram(l: Float32Array, r: Float32Array): string {
  const N = 2048;
  const hop = 1024;
  const frames = Math.floor((l.length - N) / hop);
  const W = Math.min(1200, frames);
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H + 40;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(W, H);
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const lo = Math.log(40);
  const hi = Math.log(12000);
  const levelsCol: number[] = [];
  for (let x = 0; x < W; x++) {
    const start = Math.floor((x * frames) / W) * hop;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const s = (l[start + i] + r[start + i]) / 2;
      re[i] = s * win[i];
      im[i] = 0;
      e += s * s;
    }
    levelsCol.push(10 * Math.log10(e / N + 1e-12));
    fft(re, im);
    for (let y = 0; y < H; y++) {
      const f0 = Math.exp(lo + ((hi - lo) * (H - 1 - y)) / H);
      const f1 = Math.exp(lo + ((hi - lo) * (H - y)) / H);
      const b0 = Math.max(1, Math.floor((f0 * N) / SR));
      const b1 = Math.max(b0 + 1, Math.ceil((f1 * N) / SR));
      let m = 0;
      for (let b = b0; b < b1 && b < N / 2; b++) m = Math.max(m, Math.hypot(re[b], im[b]));
      const db = 20 * Math.log10(m / N + 1e-9);
      const t = Math.max(0, Math.min(1, (db + 90) / 70));
      const o = (y * W + x) * 4;
      img.data[o] = Math.round(255 * Math.min(1, t * 1.6));
      img.data[o + 1] = Math.round(255 * Math.max(0, t * 1.6 - 0.6));
      img.data[o + 2] = Math.round(255 * (t < 0.3 ? t * 2 : Math.max(0, 1 - t)));
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#111';
  g.fillRect(0, H, W, 40);
  g.fillStyle = '#5be07a';
  levelsCol.forEach((db, x) => {
    const h = Math.max(0, Math.min(40, ((db + 60) / 60) * 40));
    g.fillRect(x, H + 40 - h, 1, h);
  });
  g.fillStyle = '#fff';
  g.font = '10px sans-serif';
  for (const f of [100, 1000, 10000]) g.fillText(`${f >= 1000 ? f / 1000 + 'k' : f}`, 2, H - ((Math.log(f) - lo) / (hi - lo)) * H);
  return canvas.toDataURL('image/png');
}

/** FFT radix-2 en el lugar. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}
