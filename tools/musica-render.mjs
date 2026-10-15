// Renderiza una canción sin escucharla (15/10): la arma en Tone.Offline adentro de musica.html y deja el
// WAV, el espectrograma y sus niveles, para revisarla (los agentes no pueden escuchar) y para comparar con
// otra. Ver docs/musica.md.
//
//   node tools/lock.mjs navegador -- node tools/musica-render.mjs <cancion> [segundos] [opciones]
//
//   cancion        su id (clasica.dorica); con «todas», cada una
//   segundos       cuánto renderizar (40)
//   --tension=x    la tensión de la partida, de 0 a 1 (0); «sube» la lleva de 0 a 1 a lo largo del render
//
// Deja logs/musica/<id>.wav y <id>.png (el espectrograma: frecuencia contra tiempo, el nivel abajo) y
// escribe el pico, el nivel promedio (RMS) y por segundo, y si recorta. Para comparar: la de siempre
// (clasica.dorica) anda por un pico de unos -13 dB y un RMS de unos -25 dB.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const seconds = Number(args.find((a) => /^\d+$/.test(a)) ?? 40);
const tension = args.find((a) => a.startsWith('--tension='))?.slice(10) ?? '0';
if (!id) {
  console.log('uso: node tools/musica-render.mjs <cancion|todas> [segundos] [--tension=x|sube]');
  process.exit(2);
}
mkdirSync('logs/musica', { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5195, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5195/musica.html');
await page.waitForFunction(() => window.renderSong, null, { timeout: 60000 });
const ids = id === 'todas'
  ? await page.evaluate(async () => (await import('/src/audio/music/registry.ts')).listSongs().then((f) => f.flatMap((x) => x.songs.map((s) => s.id))))
  : [id];
for (const one of ids) {
  const t0 = Date.now();
  try {
    const r = await page.evaluate(async ([one, seconds, tension]) => {
      const out = await window.renderSong(one, seconds, tension === 'sube' ? 0 : Number(tension), tension === 'sube');
      return out;
    }, [one, seconds, tension]);
    writeFileSync(`logs/musica/${one}.wav`, Buffer.from(r.wav, 'base64'));
    writeFileSync(`logs/musica/${one}.png`, Buffer.from(r.spectrogram.split(',')[1], 'base64'));
    console.log(`${one}: pico ${r.peakDb} dB · RMS ${r.rmsDb} dB · recorta ${r.clipped} muestras · ${r.silentSeconds} s en silencio · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    console.log(`  RMS por segundo: ${r.rmsPerSecond.join(' ')}`);
    console.log(`  logs/musica/${one}.wav · logs/musica/${one}.png`);
  } catch (e) {
    console.log(`${one}: ERROR ${e.message.split('\n')[0]}`);
  }
}
if (errors.length) console.log('errores de la página:', [...new Set(errors)].join(' | '));
await browser.close();
await server.close();
