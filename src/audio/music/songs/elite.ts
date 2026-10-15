// El élite (15/10): lo que suena mientras hay un élite en la cancha. Tiene que decir «llegó algo peligroso»
// enseguida: entra con un fundido de 2,5 s, así que el golpe fuerte no va en el cero (no se oiría) sino al
// final de un compás de arranque que crece. Después, vueltas cortas, apuradas y pesadas para los 20 a 90 s
// que dura la pelea. Tres versiones para elegir en musica.html:
// - tambores: tambores de guerra en mi frigio, metales graves que llaman y un coro que crece.
// - galope:   cuerdas al galope en re menor, de thriller: el élite viene cargando.
// - marcha:   marcha macabra en la menor, tuba y fagot de puntillas, que se apura con la tensión y cierra
//             cada vuelta con el coro riéndose (como la risa del élite).
// La tensión (`intensity`) suma capas al empezar cada compás, así nada entra a mitad de frase.
// Ver docs/musica/elite.md.
import * as Tone from 'tone';
import type { Song, SongDef } from '../types';

// ---------- tempo y tonalidad de cada versión ----------
/** Tambores: semicorchea a 144 por minuto. Mi frigio: el fa a medio tono del mi es la amenaza. */
const TAMBORES_STEP = 60 / 144 / 4;
const MI2 = 40;
/** Galope: semicorchea a 152 por minuto, en re menor. */
const GALOPE_STEP = 60 / 152 / 4;
/** Marcha: de 126 a 152 por minuto según la tensión, en la menor armónica. */
const MARCHA_BPM = [126, 152] as const;
/**
 * El volumen de cada canción (la tensión lo sube un poco más): con la reverb y el limitador del juego, un pico
 * de unos -10 dB y un RMS de unos -25 dB sin tensión y -22 con toda, un poco arriba de la de siempre porque el
 * élite tiene que pesar. Medido con tools/musica-render.mjs.
 */
const LEVEL = { tambores: 0.8, galope: 0.8, marcha: 0.95 };
/** Semicorcheas del compás de arranque (el golpe cae en la 17). */
const INTRO = 16;

type Transport = ReturnType<typeof Tone.getTransport>;
type Out = Tone.InputNode;
type Keep = <T extends { dispose(): unknown }>(node: T) => T;
/** Una frase: por compás, [semicorchea, nota, largo en semicorcheas]. */
type Phrase = Record<number, [number, number, number][]>;

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Junta todo lo que arma una canción, para soltarlo junto en dispose. */
function keeper() {
  const bag: { dispose(): unknown }[] = [];
  const keep: Keep = (node) => {
    bag.push(node);
    return node;
  };
  return { keep, free: () => bag.splice(0).reverse().forEach((n) => n.dispose()) };
}

/** Cada cuánto el reloj de la canción mira qué tiene que tocar (s). */
const TICK = 0.025;

/**
 * El reloj de una canción: llama `play(i, t, paso)` en cada semicorchea, con `t` el instante exacto en el
 * audio. Mira cada TICK y agenda lo que cae antes de la próxima mirada: así el paso puede cambiar sobre la
 * marcha (la marcha se apura) sin tocar el tempo del transporte, que lo comparten dos canciones en el fundido.
 */
function clock(transport: Transport, step: () => number, play: (i: number, t: number, step: number) => void) {
  let id = -1;
  let next = 0;
  let i = 0;
  let end = Infinity;
  return {
    start(time: number) {
      next = time;
      i = 0;
      end = Infinity;
      id = transport.scheduleRepeat((t) => {
        const now = transport.getSecondsAtTime(t);
        while (next < now + 2 * TICK && next < end) {
          const s = step();
          try {
            play(i, t + Math.max(0, next - now), s);
          } catch (e) {
            // un instrumento que no acepta la nota no frena la canción
            console.warn('[gk] elite:', e);
          }
          i++;
          next += s;
        }
      }, TICK, time);
    },
    stop(time: number) {
      end = time;
    },
    dispose() {
      if (id >= 0) transport.clear(id);
      id = -1;
    },
  };
}

/** Cuántos compases dura el acorde que empieza en `bar` (0 si no cambia ahí): para no repicar el coro. */
function chordLength(roots: readonly number[], bar: number): number {
  if (bar > 0 && roots[bar - 1] === roots[bar]) return 0;
  let n = 1;
  while (bar + n < roots.length && roots[bar + n] === roots[bar]) n++;
  return n;
}

// ---------- instrumentos ----------
// Sobre el costo (medido renderizando fuera de línea): un PolySynth arma nodos nuevos en cada nota y con
// semicorcheas ahoga al hilo de audio (6 a 12 veces lo que pesa la de siempre). Acá cada sección es un puñado
// de voces sueltas, una nota por voz: una voz que vuelve a tocar antes de apagarse reusa su oscilador. Los
// filtros son uno por sección, y se evita lo caro: un MonoSynth pesa tres Synth (su envolvente de filtro),
// cada NoiseSynth uno y medio, un Chorus cuatro.

type Voice = Tone.Synth | Tone.FMSynth;

/** Una sección: la nota k del acorde va a la voz `from + k`. */
interface Section {
  play(notes: number[], dur: number, t: number, vel: number, from?: number): void;
}

function section(voices: Voice[]): Section {
  // una voz no puede arrancar dos veces en el mismo instante (Tone tira error): la segunda se saltea
  const last = voices.map(() => -1);
  return {
    play(notes, dur, t, vel, from = 0) {
      notes.forEach((m, k) => {
        const v = from + k;
        if (v >= voices.length || t <= last[v]) return;
        last[v] = t;
        voices[v].triggerAttackRelease(hz(m), dur, t, vel);
      });
    },
  };
}

/** Cuerdas: dos sierras desafinadas con ataque marcado (el arco que muerde), por un pasabajos que abre la tensión. */
function strings(keep: Keep, out: Out, volume: number, cutoff: number, pan: number, n: number) {
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: cutoff, Q: 0.9, rolloff: -24 }));
  lp.chain(keep(new Tone.Panner(pan)), out);
  const voices = Array.from({ length: n }, () => keep(new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 16 },
    envelope: { attack: 0.005, decay: 0.14, sustain: 0.4, release: 0.09 },
    volume,
  })).connect(lp));
  return { ...section(voices), lp };
}

/** Violines agudos en trémolo: notas largas que tiemblan, el suspenso de arriba. */
function tremolo(keep: Keep, out: Out, volume: number, pan: number) {
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.5 }));
  lp.chain(keep(new Tone.Panner(pan)), out);
  // el temblor: un LFO sobre una ganancia (el efecto Tremolo, estéreo, pesa el doble)
  const trem = keep(new Tone.Gain(1)).connect(lp);
  keep(new Tone.LFO({ frequency: 11, min: 0.45, max: 1 })).connect(trem.gain).start();
  return section([0, 1].map(() => keep(new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
    envelope: { attack: 0.25, decay: 0.1, sustain: 0.9, release: 0.4 },
    volume,
  })).connect(trem)));
}

/**
 * Metales graves: sierras que abren el filtro al soplar (el «bwaa» del trombón). El filtro es uno para la
 * sección y florece con cada entrada (los metales atacan juntos): un filtro por voz pesaba el triple.
 */
function brass(keep: Keep, out: Out, volume: number, pan: number, n: number): Section {
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 2400, Q: 0.5 }));
  lp.chain(keep(new Tone.Panner(pan)), out);
  const bloom = keep(new Tone.Filter({ type: 'lowpass', frequency: 700, Q: 1.6, rolloff: -12 })).connect(lp);
  const voices = section(Array.from({ length: n }, () => keep(new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
    envelope: { attack: 0.04, decay: 0.25, sustain: 0.75, release: 0.22 },
    volume,
  })).connect(bloom)));
  let last = -1;
  return {
    play(notes, dur, t, vel, from = 0) {
      if (t > last) {
        // de casi cerrado a abierto en 70 ms y se asienta: más fuerte, más brillante
        last = t;
        const f = bloom.frequency;
        f.cancelScheduledValues(t);
        f.setValueAtTime(220, t);
        f.exponentialRampToValueAtTime(400 + 1800 * vel, t + 0.07);
        f.exponentialRampToValueAtTime(300 + 700 * vel, t + 0.4);
      }
      voices.play(notes, dur, t, vel, from);
    },
  };
}

/** Formantes de las vocales (Hz): «oh» para el coro oscuro, «ah» para el que se ríe. */
const VOWELS = { oh: [450, 800], ah: [720, 1150] } as const;

/**
 * Las vocales de un coro de hombres: el cuerpo grave más los dos formantes de la vocal, cada uno por su
 * filtro y sumados. Devuelve la entrada (lo que canta) y la suma (para subirle el volumen con la tensión).
 */
function vowel(keep: Keep, out: Out, which: keyof typeof VOWELS) {
  const [f1, f2] = VOWELS[which];
  const sum = keep(new Tone.Gain(1)).connect(out);
  const band = (type: 'lowpass' | 'bandpass', frequency: number, Q: number, gain: number) => {
    const g = keep(new Tone.Gain(gain)).connect(sum);
    return keep(new Tone.Filter({ type, frequency, Q })).connect(g);
  };
  const input = keep(new Tone.Gain(1));
  input.fan(band('lowpass', 330, 0.5, 0.35), band('bandpass', f1, 2.5, 1.4), band('bandpass', f2, 3.5, 0.8));
  return { input, sum };
}

/** Coro sostenido de cuatro voces: sierras con chorus por las vocales; entra despacio, como un coro que crece. */
function choir(keep: Keep, out: Out, volume: number, which: keyof typeof VOWELS) {
  const { input, sum } = vowel(keep, out, which);
  // el chorus le da el movimiento de muchas gargantas (un vibrato aparte pesaba y no se notaba)
  const chorus = keep(new Tone.Chorus({ frequency: 0.5, delayTime: 4, depth: 0.6, spread: 160, wet: 0.6 })).connect(input).start();
  const voices = [0, 1, 2, 3].map(() => keep(new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 28 },
    envelope: { attack: 0.8, decay: 0.3, sustain: 0.85, release: 1.3 },
    volume,
  })).connect(chorus));
  return { ...section(voices), level: sum };
}

/**
 * Un compresor suave para los tambores (y la tuba): les baja la punta del golpe, que es lo que marca el pico,
 * y deja subir el resto de la canción sin que el total pase de -10 dB.
 */
function glue(keep: Keep, out: Out) {
  // el compresor del navegador sube solo el volumen ((18 - 18/3) · 0,6 = 7,2 dB): la ganancia de atrás lo devuelve
  const makeup = keep(new Tone.Gain(Math.pow(10, -7.2 / 20))).connect(out);
  return keep(new Tone.Compressor({ threshold: -18, ratio: 3, knee: 6, attack: 0.004, release: 0.2 })).connect(makeup);
}

/** El golpe del palo (ruido corto): uno para todos los tambores de la canción, para que se oigan también en parlantes chicos. */
function sticks(keep: Keep, out: Out, volume: number) {
  const bp = keep(new Tone.Filter({ type: 'bandpass', frequency: 1200, Q: 0.7 })).connect(out);
  const n = keep(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume })).connect(bp);
  let last = -1;
  return (t: number, vel: number) => {
    if (t <= last) return;
    last = t;
    n.triggerAttackRelease(0.04, t, Math.min(1, vel));
  };
}

/** Un tambor: el parche que cae de tono, más el palo compartido (`stickGain`: qué tan fuerte, respecto del parche). */
function drum(keep: Keep, out: Out, stick: (t: number, vel: number) => void, freq: number, volume: number, decay: number, octaves: number, stickGain = 1) {
  const body = keep(new Tone.MembraneSynth({ pitchDecay: 0.05, octaves, envelope: { attack: 0.002, decay, sustain: 0, release: 0.1 }, volume })).connect(out);
  let last = -1;
  return (t: number, vel: number) => {
    if (t <= last) return;
    last = t;
    body.triggerAttackRelease(freq, decay, t, vel);
    stick(t, vel * stickGain);
  };
}

/** Caja: el bordonero (ruido) más el parche. */
function snare(keep: Keep, out: Out, volume: number) {
  const bp = keep(new Tone.Filter({ type: 'bandpass', frequency: 2400, Q: 0.6 })).connect(out);
  const wires = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.11, sustain: 0 }, volume })).connect(bp);
  const head = keep(new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 1.5, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: volume - 4 })).connect(out);
  let last = -1;
  return (t: number, vel: number) => {
    if (t <= last) return;
    last = t;
    wires.triggerAttackRelease(0.1, t, vel);
    head.triggerAttackRelease(190, 0.06, t, vel);
  };
}

/** Un chasquido seco (el «ka» del taiko, el tic del reloj): ruido corto por un pasabanda. */
function tick(keep: Keep, out: Out, volume: number, freq: number) {
  const bp = keep(new Tone.Filter({ type: 'bandpass', frequency: freq, Q: 2 })).connect(out);
  const n = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0 }, volume })).connect(bp);
  return (t: number, vel: number) => n.triggerAttackRelease(0.02, t, vel);
}

/** Platillo: ruido agudo que se apaga en `decay` segundos (largo, el crash; corto, los platillos de banda). */
function cymbal(keep: Keep, out: Out, volume: number) {
  const hp = keep(new Tone.Filter({ type: 'highpass', frequency: 5000 })).connect(out);
  const n = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.6, sustain: 0, release: 0.2 }, volume })).connect(hp);
  return (t: number, vel: number, decay = 1.6) => {
    n.envelope.decay = decay;
    n.triggerAttackRelease(decay, t, vel);
  };
}

/** Un soplido que sube (ruido por un pasabanda que se abre): lleva hacia el golpe o la vuelta. */
function riser(keep: Keep, out: Out, volume: number) {
  const bp = keep(new Tone.Filter({ type: 'bandpass', frequency: 400, Q: 1.2 })).connect(out);
  const n = keep(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 1, decay: 0.01, sustain: 1, release: 0.08 }, volume })).connect(bp);
  return (t: number, dur: number, vel: number) => {
    n.envelope.attack = dur * 0.9;
    n.triggerAttackRelease(dur, t, vel);
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(5000, t + dur);
  };
}

/** Tuba: una sierra gorda por un pasabajos cerrado (el «pom»). */
function tuba(keep: Keep, out: Out, volume: number) {
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 340, Q: 1, rolloff: -24 })).connect(out);
  return section([keep(new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 8 },
    envelope: { attack: 0.025, decay: 0.2, sustain: 0.6, release: 0.12 },
    volume,
  })).connect(lp)]);
}

/**
 * Las voces de staccato (fagot, pizzicato, xilofón) se cortan por la envolvente (caen a cero solas) y tienen un
 * release largo que ya no suena: así el oscilador sigue vivo hasta la nota siguiente y no se rearma en cada una.
 */
const STACCATO_RELEASE = 0.35;

/** Fagot: una sierra con la nasal del caño (un pico en 520 Hz), cortita. */
function bassoon(keep: Keep, out: Out, volume: number, pan: number) {
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 950, Q: 0.6, rolloff: -24 }));
  lp.chain(keep(new Tone.Panner(pan)), out);
  const nasal = keep(new Tone.Filter({ type: 'peaking', frequency: 520, Q: 2, gain: 9 })).connect(lp);
  return section([keep(new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 8 },
    envelope: { attack: 0.018, decay: 0.16, sustain: 0, release: STACCATO_RELEASE },
    volume,
  })).connect(nasal)]);
}

/** Pizzicato: la cuerda pellizcada, una sierra que se apaga enseguida por un pasabajos. */
function pizzicato(keep: Keep, out: Out, volume: number, pan: number) {
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 1400, Q: 0.6 }));
  lp.chain(keep(new Tone.Panner(pan)), out);
  return section([keep(new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
    envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: STACCATO_RELEASE },
    volume,
  })).connect(lp)]);
}

/** Xilofón de huesos (el de la danza macabra): FM con el golpe de madera que se apaga primero. */
function xylophone(keep: Keep, out: Out, volume: number, pan: number) {
  const p = keep(new Tone.Panner(pan)).connect(out);
  return section([keep(new Tone.FMSynth({
    harmonicity: 3,
    modulationIndex: 3,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: STACCATO_RELEASE },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.05 },
    volume,
  })).connect(p)]);
}

/**
 * El coro que se ríe: tres voces sueltas en «ah» más la «h» (un soplo de ruido) en cada sílaba. Cada «ja»
 * cae un poquito de tono, como una risa de verdad; la última cae más y dura.
 */
function laugh(keep: Keep, out: Out, volume: number) {
  const { input } = vowel(keep, out, 'ah');
  const voices = [0, 1, 2].map(() => keep(new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 24 },
    envelope: { attack: 0.025, decay: 0.12, sustain: 0.55, release: 0.14 },
    volume,
  })).connect(input));
  const bp = keep(new Tone.Filter({ type: 'bandpass', frequency: 1600, Q: 0.8 })).connect(out);
  const breath = keep(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.07, sustain: 0 }, volume: volume - 4 })).connect(bp);
  return (t: number, chord: number[], dur: number, fall: number) => {
    breath.triggerAttackRelease(0.06, t, 0.8);
    chord.forEach((m, k) => {
      const v = voices[k];
      v.triggerAttackRelease(hz(m), dur, t, 0.9);
      v.frequency.exponentialRampToValueAtTime(hz(m - fall), t + dur + 0.1);
    });
  };
}

// ---------- tambores: tambores de guerra en mi frigio ----------

/** Las raíces de la vuelta (8 compases), en semitonos sobre mi: mi mi fa mi | mi mi sol fa. El fa vuelve al mi. */
const TAMBORES_ROOTS = [0, 0, 1, 0, 0, 0, 3, 1];
/** El odaiko: semicorchea → fuerza. El último compás de cada cuatro remata. */
const BIG_HITS: Record<number, number> = { 0: 1, 6: 0.7, 10: 0.85 };
const BIG_FILL: Record<number, number> = { 0: 1, 6: 0.7, 10: 0.8, 12: 0.85, 14: 0.95 };
/** Los taikos medianos, [¿el agudo?, fuerza] por semicorchea: el «ka-don» entre los golpes grandes. */
const MID_HITS: Record<number, [boolean, number]> = { 2: [false, 0.45], 4: [true, 0.7], 7: [false, 0.4], 8: [true, 0.55], 12: [true, 0.7], 14: [false, 0.5] };
/** Las cuerdas sobre mi: corcheas en la raíz y el sol-fa que cae al mi al final del compás. */
const TAMBORES_FIGURE = [0, 0, 0, 0, 0, 0, 3, 1];
/** El llamado de los metales. En la vuelta siguiente la segunda mitad contesta más arriba. */
const CALL: Phrase = {
  0: [[0, 52, 6], [6, 53, 2], [8, 52, 4]],
  1: [[0, 50, 2], [2, 52, 2], [4, 47, 10]],
  4: [[0, 52, 6], [6, 53, 2], [8, 55, 4], [12, 53, 4]],
  5: [[0, 52, 12]],
};
const CALL_ANSWER: Phrase = { ...CALL, 4: [[0, 59, 6], [6, 60, 2], [8, 59, 4], [12, 55, 4]], 5: [[0, 53, 4], [4, 52, 12]] };
/** La voz de abajo del llamado: una cuarta abajo, como el organum medieval (el si va a la quinta: si-fa sería tritono). */
const organum = (m: number) => m - (m % 12 === 11 ? 7 : 5);

function tambores(out: Out, transport: Transport): Song {
  const { keep, free } = keeper();
  const bus = keep(new Tone.Gain(LEVEL.tambores)).connect(out);
  // los tambores también tienen nota: el grande en si (la quinta de mi), los medianos en la y re
  const skins = glue(keep, bus);
  const stick = sticks(keep, skins, -21);
  const odaiko = drum(keep, skins, stick, hz(35), -13, 0.8, 2.6, 1.3);
  const hiTaiko = drum(keep, skins, stick, hz(50), -15, 0.22, 1.6, 0.7);
  const loTaiko = drum(keep, skins, stick, hz(45), -14, 0.3, 1.8, 0.75);
  const timpani = drum(keep, skins, stick, hz(MI2), -14, 1, 1.1, 0.45);
  const ka = tick(keep, bus, -28, 2800);
  const crash = cymbal(keep, bus, -28);
  const whoosh = riser(keep, bus, -26);
  const low = strings(keep, bus, -20, 900, -0.25, 2);
  // metales: 0-2 el llamado (melodía, cuarta abajo, octava abajo), 3-4 el golpe del arranque
  const horns = brass(keep, bus, -17, 0.25, 5);
  const coro = choir(keep, bus, -20, 'oh');
  let target = 0;
  let lvl = 0;

  /** El arranque: el timbal redobla cada vez más rápido, los taikos se suman y los metales suben de un tirón al golpe. */
  const intro = (s: number, t: number, S: number) => {
    const u = s / (INTRO - 1);
    if (s === 0) {
      whoosh(t, INTRO * S, 0.9);
      coro.play([52, 59, 65], INTRO * S, t, 0.8);
    }
    if (s >= 8 || s % 2 === 0) timpani(t, 0.3 + 0.6 * u);
    if (s >= 12) timpani(t + S / 2, 0.35 + 0.6 * u);
    if (s >= 8 && s % 2 === 0) (s % 4 ? loTaiko : hiTaiko)(t, 0.4 + 0.5 * u);
    if (s >= 12) {
      const m = [45, 47, 48, 50][s - 12];
      horns.play([m, m - 12], S * 0.9, t, 0.55 + 0.12 * (s - 12));
    }
  };

  const p = clock(transport, () => TAMBORES_STEP, (i, t, S) => {
    if (i < INTRO) return intro(i, t, S);
    const j = i - INTRO;
    const s = j % 16;
    const bar = Math.floor(j / 16) % 8;
    const lap = Math.floor(j / 128);
    if (s === 0) lvl = target;
    const root = MI2 + TAMBORES_ROOTS[bar];
    const last = bar % 4 === 3;
    const fill = last && s >= 12 && lvl > 0.35;

    // tambores
    const big = (last ? BIG_FILL : BIG_HITS)[s];
    if (big) odaiko(t, big);
    else if (lvl > 0.85 && (s === 3 || s === 8)) odaiko(t, 0.6);
    const mid = MID_HITS[s];
    if (fill) (s % 2 ? loTaiko : hiTaiko)(t, 0.55 + 0.1 * (s - 12));
    else if (mid) (mid[0] ? hiTaiko : loTaiko)(t, mid[1]);
    if (lvl > 0.35 && s % 4 === 2) ka(t, 0.6);
    else if (lvl > 0.85 && s % 2 === 1) ka(t, 0.3);
    if (bar === 0 && s === 0) crash(t, j === 0 ? 1 : 0.5);
    if (bar === 7 && s === 0 && lvl > 0.5) whoosh(t, 16 * S, 0.7);

    // cuerdas graves: corcheas; con mucha tensión, semicorcheas
    const m = root + (TAMBORES_ROOTS[bar] === 0 ? TAMBORES_FIGURE[s >> 1] : 0);
    const accent = s === 0 ? 1 : s === 6 || s === 10 ? 0.85 : 0.55;
    // la octava de abajo más suave: abajo de 200 Hz ya están los tambores
    const v = lvl > 0.6 && s % 2 ? 0.45 : accent;
    if (lvl > 0.6 || s % 2 === 0) {
      const d = lvl > 0.6 ? S * 0.9 : S * 1.6;
      low.play([m], d, t, v * 0.4, 0);
      low.play([m + 12], d, t, v, 1);
    }

    // metales: el llamado; el golpe del arranque (mi con fa encima); con mucha tensión, golpes en los compases sin llamado
    const call = (lap % 2 ? CALL_ANSWER : CALL)[bar];
    for (const [at, n, len] of call ?? []) {
      if (at !== s) continue;
      horns.play(lvl > 0.6 && n - 12 >= MI2 ? [n, organum(n), n - 12] : [n, organum(n)], len * S * 0.92, t, at === 0 ? 0.95 : 0.8);
    }
    if (j === 0) horns.play([MI2, 53], 8 * S, t, 1, 3);
    if (lvl > 0.85 && !call && (s === 0 || s === 6 || s === 10)) horns.play([root + 12, root + 19], 2 * S, t, 0.75);

    // coro: quinta y octava; con tensión, la novena menor encima (el racimo)
    const hold = s === 0 ? chordLength(TAMBORES_ROOTS, bar) : 0;
    if (hold) {
      const r = 52 + TAMBORES_ROOTS[bar];
      coro.play(lvl > 0.6 ? [r, r + 7, r + 12, r + 13] : [r, r + 7, r + 12], hold * 16 * S - 0.15, t, 0.9);
    }
  });

  return {
    start: (time) => p.start(time),
    stop: (time) => p.stop(time),
    intensity(level) {
      target = clamp01(level);
      low.lp.frequency.rampTo(900 + 1600 * target, 1.5);
      coro.level.gain.rampTo(0.55 + 0.45 * target, 2);
      bus.gain.rampTo(LEVEL.tambores * (1 + 0.1 * target), 2);
    },
    dispose() {
      p.dispose();
      free();
    },
  };
}

// ---------- galope: cuerdas de thriller en re menor ----------

/** Las raíces de la vuelta: re re mib re | sib do la la (el mib frigio, y el la mayor que empuja de vuelta al re). */
const GALOPE_ROOTS = [38, 38, 39, 38, 34, 36, 33, 33];
/** El acorde de cada compás, abierto en el medio: para los golpes de metales y el coro. */
const GALOPE_CHORDS = [[50, 57, 65], [50, 57, 65], [51, 58, 67], [50, 57, 65], [46, 53, 62], [48, 55, 64], [45, 52, 61], [45, 52, 61]];
/** Las violas: una nota pedal alternada con una línea que se mueve, [pedal, línea x4] por compás (dos veces por compás). */
const GALOPE_VIOLAS = [
  [57, 62, 64, 65, 64], [57, 65, 64, 62, 61], [58, 63, 65, 67, 65], [57, 65, 64, 62, 64],
  [53, 58, 60, 62, 60], [55, 60, 62, 64, 62], [57, 61, 62, 64, 65], [57, 64, 65, 64, 61],
];
/** Los violines en trémolo (desde media tensión): una nota por compás. */
const GALOPE_HIGH = [74, 74, 75, 74, 74, 76, 73, 76];
/** El corno (desde media tensión). */
const GALOPE_HORN: Phrase = {
  0: [[0, 62, 6], [6, 61, 2], [8, 62, 4], [12, 65, 4]],
  1: [[0, 64, 6], [6, 62, 2], [8, 57, 8]],
  2: [[0, 58, 6], [6, 57, 2], [8, 55, 4], [12, 58, 4]],
  3: [[0, 57, 14]],
  4: [[0, 62, 6], [6, 60, 2], [8, 58, 4], [12, 62, 4]],
  5: [[0, 64, 6], [6, 62, 2], [8, 60, 4], [12, 64, 4]],
  6: [[0, 61, 8], [8, 62, 4], [12, 64, 4]],
  7: [[0, 57, 12]],
};
/** La escalera del arranque: re menor armónica de re2 a mi4, una semicorchea por nota. */
const GALOPE_RUN = [38, 40, 41, 43, 45, 46, 49, 50, 52, 53, 55, 57, 58, 61, 62, 64];

function galope(out: Out, transport: Transport): Song {
  const { keep, free } = keeper();
  const bus = keep(new Tone.Gain(LEVEL.galope)).connect(out);
  // el galope en octavas: la voz 0 abajo (más suave: el peso lo da el bombo), la 1 arriba
  const low = strings(keep, bus, -12, 1000, -0.2, 2);
  const violas = strings(keep, bus, -17, 1300, 0.3, 1);
  const high = tremolo(keep, bus, -27, -0.1);
  // metales: 0-3 los golpes de acorde, 4-5 el corno
  const horns = brass(keep, bus, -14, 0.15, 6);
  const coro = choir(keep, bus, -19, 'ah');
  const skins = glue(keep, bus);
  const stick = sticks(keep, skins, -22);
  const kick = drum(keep, skins, stick, hz(33), -13, 0.45, 2.2, 1.25);
  const tomHi = drum(keep, skins, stick, hz(52), -15, 0.22, 1.6, 0.65);
  const tomLo = drum(keep, skins, stick, hz(45), -14, 0.3, 1.8, 0.7);
  const tic = tick(keep, bus, -29, 3500);
  const caja = snare(keep, skins, -22);
  const crash = cymbal(keep, bus, -28);
  const whoosh = riser(keep, bus, -27);
  let target = 0;
  let lvl = 0;

  /** Las dos octavas del galope, la de abajo más suave (abajo de 100 Hz no se apila todo). */
  const gallop = (m: number, dur: number, t: number, vel: number) => {
    low.play([m], dur, t, vel * 0.55, 0);
    low.play([m + 12], dur, t, vel, 1);
  };

  /** El arranque: las cuerdas suben una escalera de dos octavas, con la caja redoblando debajo. */
  const intro = (s: number, t: number, S: number) => {
    const u = s / (INTRO - 1);
    if (s === 0) whoosh(t, INTRO * S, 0.8);
    gallop(GALOPE_RUN[s], S * 1.2, t, 0.45 + 0.55 * u);
    if (s >= 8) {
      caja(t, 0.25 + 0.6 * u);
      caja(t + S / 2, 0.2 + 0.6 * u);
    }
  };

  const p = clock(transport, () => GALOPE_STEP, (i, t, S) => {
    if (i < INTRO) return intro(i, t, S);
    const j = i - INTRO;
    const s = j % 16;
    const bar = Math.floor(j / 16) % 8;
    const lap = Math.floor(j / 128);
    if (s === 0) lvl = target;
    const root = GALOPE_ROOTS[bar];

    // el galope: corchea y dos semicorcheas por tiempo
    const g = s % 4;
    if (g !== 1) gallop(root, g === 0 ? S * 1.5 : S * 0.8, t, g === 0 ? 1 : g === 2 ? 0.6 : 0.72);
    // las violas: pedal y línea, semicorcheas; una vuelta sí y otra no la línea salta una octava (más nerviosa)
    const [pedal, ...line] = GALOPE_VIOLAS[bar];
    const k = s % 8;
    violas.play([k % 2 ? line[k >> 1] + (lap % 2 ? 12 : 0) : pedal], S * 0.85, t, k % 2 ? 0.75 : 0.5);
    // violines en trémolo
    if (s === 0 && lvl > 0.45) {
      const n = GALOPE_HIGH[bar];
      high.play(lvl > 0.8 ? [n, n - 12] : [n], 16 * S - 0.05, t, 0.7);
    }

    // metales: golpe en cada cambio de acorde; el del arranque, re con mib encima; el la del final, con sib
    if (j === 0) horns.play([38, 50, 57, 63], 10 * S, t, 1);
    else if (s === 0 && chordLength(GALOPE_ROOTS, bar)) horns.play(GALOPE_CHORDS[bar], 3 * S, t, 0.7);
    if (bar === 7 && (s === 0 || s === 6 || s === 12)) horns.play([45, 52, 58], 2 * S, t, 0.7 + s / 60);
    if (lvl > 0.5) {
      for (const [at, n, len] of GALOPE_HORN[bar] ?? []) {
        if (at === s) horns.play(lvl > 0.8 ? [n, n - 12] : [n], len * S * 0.92, t, lvl > 0.8 ? 0.6 : 0.75, 4);
      }
    }

    // tambores: el latido en el 1 y el 3 (con tensión, en todos), el reloj, el remate de toms y el redoble hacia la vuelta
    if (s === 0 || s === 8) kick(t, s === 0 ? 1 : 0.8);
    else if (lvl > 0.5 && (s === 4 || s === 12)) kick(t, 0.35);
    if (s % 2 === 0) tic(t, s % 4 === 0 ? 0.55 : 0.4);
    else if (lvl > 0.7) tic(t, 0.25);
    if (bar % 4 === 3 && s >= 12) (s % 2 ? tomLo : tomHi)(t, 0.5 + 0.12 * (s - 12));
    if (bar === 7 && lvl > 0.4) {
      caja(t, 0.2 + 0.045 * s);
      if (s >= 8) caja(t + S / 2, 0.2 + 0.045 * s);
    }
    if (bar === 0 && s === 0) crash(t, j === 0 ? 1 : 0.5);
    if (bar === 7 && s === 0 && lvl > 0.6) whoosh(t, 16 * S, 0.7);

    // coro (con mucha tensión): el acorde mientras dure
    const hold = s === 0 && lvl > 0.7 ? chordLength(GALOPE_ROOTS, bar) : 0;
    if (hold) coro.play(GALOPE_CHORDS[bar], hold * 16 * S - 0.15, t, 0.85);
  });

  return {
    start: (time) => p.start(time),
    stop: (time) => p.stop(time),
    intensity(level) {
      target = clamp01(level);
      low.lp.frequency.rampTo(1000 + 1000 * target, 1.5);
      violas.lp.frequency.rampTo(1300 + 1700 * target, 1.5);
      coro.level.gain.rampTo(0.7 + 0.3 * target, 2);
      bus.gain.rampTo(LEVEL.galope * (1 + 0.2 * target), 2);
    },
    dispose() {
      p.dispose();
      free();
    },
  };
}

// ---------- marcha: marcha macabra en la menor ----------

/** El acorde de cada compás: lam mi lam mi | lam rem mi lam (el último es la risa). 0 = la, 1 = mi, 2 = re. */
const MARCHA_CHORD = [0, 1, 0, 1, 0, 2, 1, 0];
/** La tuba en el 1 y el 3 (fundamental y quinta) y el «pa» de los cornos en el 2 y el 4, por acorde. */
const MARCHA_TUBA = [[33, 40], [40, 35], [38, 33]];
const MARCHA_PAH = [[57, 60, 64], [56, 59, 64], [57, 62, 65]];
/** La melodía del fagot en corcheas (null = silencio): de puntillas, con el re sostenido que se arrastra. */
const MARCHA_TUNE: (number | null)[][] = [
  [45, null, 52, null, 51, null, 52, null],
  [53, 52, 51, 52, 47, null, 44, null],
  [45, null, 52, null, 51, null, 52, null],
  [53, 52, 50, 48, 47, null, 44, null],
  [57, null, 56, null, 57, null, 52, null],
  [53, null, 52, null, 50, null, 45, null],
  [47, 48, 50, 51, 52, null, 40, null],
  [45, null, null, null, null, null, null, null],
];
/** La risa del último compás: [semicorchea, acorde, largo en semicorcheas, cuánto cae en semitonos]. */
const MARCHA_LAUGH: [number, number[], number, number][] = [
  [0, [45, 52, 60], 1.6, 0.6], [3, [45, 52, 59], 1.6, 0.6], [6, [45, 51, 58], 1.6, 0.6], [8, [45, 52, 57], 7, 2],
];
/** La caja de marcha, semicorchea → fuerza. Con poca tensión, solo el contratiempo. */
const MARCHA_SNARE: Record<number, number> = { 0: 0.8, 3: 0.3, 4: 0.6, 6: 0.3, 7: 0.35, 8: 0.8, 11: 0.3, 12: 0.6, 14: 0.45, 15: 0.55 };

function marcha(out: Out, transport: Transport): Song {
  const { keep, free } = keeper();
  const bus = keep(new Tone.Gain(LEVEL.marcha)).connect(out);
  // la tuba y el bombo caen juntos en el 1: van por el compresor para que ese golpe no sea todo el pico
  const skins = glue(keep, bus);
  const oom = tuba(keep, skins, -11);
  // cornos: 0-2 el «pa» (y el anuncio y el golpe), 3 la melodía doblada
  const horns = brass(keep, bus, -14, 0.2, 4);
  const fagot = bassoon(keep, bus, -9, -0.15);
  const pizz = pizzicato(keep, bus, -14, 0.25);
  const huesos = xylophone(keep, bus, -19, -0.3);
  const bombo = drum(keep, skins, sticks(keep, skins, -21), hz(33), -12, 0.45, 2);
  const caja = snare(keep, skins, -18);
  const crash = cymbal(keep, bus, -28);
  const risa = laugh(keep, bus, -11);
  let target = 0;
  let lvl = 0;
  /** La tensión que lleva el tempo, suavizada: la marcha se apura de a poco (unos 4 s). */
  let pace = 0;
  const step = () => {
    pace += (target - pace) * 0.03;
    return 60 / (MARCHA_BPM[0] + (MARCHA_BPM[1] - MARCHA_BPM[0]) * pace) / 4;
  };

  /** El arranque: la caja redobla y los cornos anuncian «ta, ta, ta, TAA» hasta el golpe. */
  const intro = (s: number, t: number, S: number) => {
    const u = s / (INTRO - 1);
    caja(t, 0.15 + 0.6 * u);
    if (s >= 8) caja(t + S / 2, 0.15 + 0.6 * u);
    if (s >= 8 && s % 2 === 0) horns.play(s === 14 ? [53, 41] : [52, 40], S * 1.2, t, 0.6 + 0.05 * (s - 8));
  };

  const p = clock(transport, step, (i, t, S) => {
    if (i < INTRO) return intro(i, t, S);
    const j = i - INTRO;
    const s = j % 16;
    const bar = Math.floor(j / 16) % 8;
    if (s === 0) lvl = target;
    const c = MARCHA_CHORD[bar];
    const laughing = bar === 7;

    // el golpe del arranque: la menor con el si bemol encima
    if (j === 0) horns.play([45, 52, 57, 58], 3.8 * S, t, 1);
    // um-pa: la tuba en el 1 y el 3, los cornos cortos en el 2 y el 4
    if (s === 0 || (s === 8 && !laughing)) oom.play([MARCHA_TUBA[c][s ? 1 : 0]], S * 2.2, t, s ? 0.8 : 1);
    if ((s === 4 || s === 12) && !laughing) horns.play(MARCHA_PAH[c], S * 1.3, t, 0.55);

    // percusión: bombo en el 1 y el 3; caja de marcha (completa con tensión); platillos de banda en el «pa»
    if (s === 0 || s === 8) bombo(t, s ? 0.75 : 1);
    const sn = MARCHA_SNARE[s];
    if (laughing) {
      if (s >= 12) caja(t, 0.3 + 0.12 * (s - 12));
    } else if (sn && (lvl > 0.35 || s === 4 || s === 12)) caja(t, sn);
    if (lvl > 0.6 && (s === 4 || s === 12) && !laughing) crash(t, 0.38, 0.18);
    if (s === 0 && (bar === 0 || (bar === 4 && lvl > 0.85))) crash(t, j === 0 ? 1 : 0.5);

    // la melodía: fagot y pizzicato una octava arriba; con tensión, el xilofón de huesos y los cornos
    if (s % 2 === 0) {
      const n = MARCHA_TUNE[bar][s >> 1];
      if (n !== null) {
        fagot.play([n], S * 1.6, t, 0.85);
        pizz.play([n + 12], S * 1.6, t, 0.7);
        if (lvl > 0.4) huesos.play([n + 24], S * 1.8, t, 0.55);
        if (lvl > 0.6 && !laughing) horns.play([n + 12], S * 1.3, t, 0.6, 3);
      } else if (lvl > 0.75) {
        // los huesos castañetean en los silencios
        const prev = MARCHA_TUNE[bar][(s >> 1) - 1];
        if (prev != null) {
          huesos.play([prev + 24], S * 0.45, t, 0.3);
          huesos.play([prev + 24], S * 1.8, t + S / 2, 0.25);
        }
      }
    }

    // la risa
    if (laughing) for (const [at, chord, len, fall] of MARCHA_LAUGH) if (at === s) risa(t, chord, len * S, fall);
  });

  return {
    start: (time) => p.start(time),
    stop: (time) => p.stop(time),
    intensity(level) {
      target = clamp01(level);
      bus.gain.rampTo(LEVEL.marcha * (1 + 0.2 * target), 2);
    },
    dispose() {
      p.dispose();
      free();
    },
  };
}

export const SONGS: SongDef[] = [
  {
    id: 'elite.tambores',
    name: 'Élite: tambores de guerra', // i18n-ok: el panel de pruebas
    role: 'elite',
    blurb: 'Mi frigio, 144 por minuto: taikos, cuerdas graves, metales que llaman en cuartas y un coro que crece. Con tensión, semicorcheas y golpes de metales.', // i18n-ok: el panel de pruebas
    build: tambores,
  },
  {
    id: 'elite.galope',
    name: 'Élite: al galope', // i18n-ok: el panel de pruebas
    role: 'elite',
    blurb: 'Re menor, 152 por minuto: cuerdas al galope y violas en semicorcheas, de thriller, con un reloj. Con tensión, trémolo agudo, corno y coro.', // i18n-ok: el panel de pruebas
    build: galope,
  },
  {
    id: 'elite.marcha',
    name: 'Élite: marcha macabra', // i18n-ok: el panel de pruebas
    role: 'elite',
    blurb: 'La menor, de 126 a 152 por minuto según la tensión: tuba, fagot de puntillas y caja; cada vuelta cierra con el coro riéndose. Con tensión, xilofón de huesos y cornos.', // i18n-ok: el panel de pruebas
    build: marcha,
  },
];
