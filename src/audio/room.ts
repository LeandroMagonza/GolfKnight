// La reverb de los efectos (16/10). Hasta acá eran dos Tone.Freeverb, uno para los sintetizados y otro para la
// campana de los poderes: en Tone el Freeverb son filtros peine hechos en JavaScript dentro del hilo de audio
// (AudioWorklet), y medido sin parlantes cada uno se comía un 30 % de un núcleo, prendido siempre aunque no
// sonara nada (Leandro: «hay algo raro con el audio... cuando haya varias cosas pasando a la vez se traba»).
// Si el hilo de audio no llega a tiempo, el navegador corta: suena trabado, no saturado. Una convolución es
// nativa del navegador y cuesta un 2 %. La sala se arma como las de las canciones (songs/bardo, songs/jefe):
// ruido que se oscurece y se apaga.
import * as Tone from 'tone';

/**
 * Los números de la sala, parecidos al Freeverb de antes (roomSize 0,7, dampening 2500, wet 0,25):
 * - `rt60`: lo que tarda la cola en bajar 60 dB.
 * - `bright`: la frecuencia del filtro que oscurece la cola (el «dampening» del Freeverb).
 * - `wet`: cuánto va a la sala; el resto sigue seco (mezcla de igual potencia, como el `wet` de Tone).
 * - `level`: lo que se sube la sala para que la cola suene tan fuerte como la del Freeverb (medido: la energía
 *   de la cola de un golpe de ruido, 90,6 contra 15,0 sin corregir).
 */
export const ROOM = { rt60: 1.6, bright: 2500, wet: 0.25, level: 2.45 };

/** La respuesta de la sala: ruido estéreo por un pasabajos de un polo, que se apaga en `rt60` s. */
export function roomIR(ctx: BaseAudioContext, rt60: number, bright: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const pre = Math.floor(0.01 * sr);
  const n = pre + Math.floor(sr * rt60);
  const buf = ctx.createBuffer(2, n, sr);
  const k = 1 - Math.exp((-2 * Math.PI * bright) / sr);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      lp += k * (rnd() - lp);
      d[i] = lp * Math.pow(10, (-3 * t) / rt60);
    }
  }
  return buf;
}

/**
 * Una sala que suena en `out`: devuelve su entrada. Lo seco y lo mojado van aparte, con la mezcla de igual
 * potencia del `wet` de Tone (el seco a cos, la sala a sen).
 */
export function makeRoom(out: Tone.InputNode, ctx: Tone.BaseContext = Tone.getContext()): Tone.Gain {
  const input = new Tone.Gain(1);
  const angle = (ROOM.wet * Math.PI) / 2;
  input.connect(new Tone.Gain(Math.cos(angle)).connect(out));
  const conv = new Tone.Convolver({ normalize: true });
  conv.buffer = new Tone.ToneAudioBuffer(roomIR(ctx.rawContext as BaseAudioContext, ROOM.rt60, ROOM.bright));
  input.chain(new Tone.Gain(Math.sin(angle) * ROOM.level), conv);
  conv.connect(out);
  return input;
}
