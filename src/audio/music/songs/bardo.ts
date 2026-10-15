// La canción del jefe con música (15/10, ver src/game/bosses/bardo y docs/jefes/bardo.md): metal, para el
// guitarrista esqueleto. El jefe la pone mientras dura la pelea y la lee: cada pulso que agenda queda en su
// grilla (`beat`, ver beat.ts), y solo los tiros soltados en el beat salen. El tempo lo pide el jefe por
// fases (100, 130 y 160 por minuto) y entra al empezar el compás siguiente; sola (en musica.html, en el
// render) sube de fase cada 8 compases.
//
// Nada de 8 bits: dos guitarras distorsionadas (sierras por un pasabajos, la distorsión y un «gabinete»
// de filtros), una a cada lado, con acordes de quinta abiertos y el chugg de la mano apagada en la sexta;
// bajo, bombo con parche y mazo, caja con cuerpo y bordonero, la campana del ride en cada negra (el
// metrónomo: tiene que quedar clarísimo dónde está el beat) y una sala corta.
//   fase 0 (100): groove pesado, acordes en 1 y 3, la caja en 2 y 4
//   fase 1 (130): galope (corchea y dos semis), entra la guitarra solista
//   fase 2 (160): thrash, doble bombo en semicorcheas (las negras siguen marcadas) y la solista a dos voces
//
// Y la del ogro tamborilero (`bardo.tambor`): tambores de guerra en re menor a 90, 115 y 140. El taiko
// grande y el ka (el palo contra el borde) en cada negra marcan el beat; los toms y el shime se van
// llenando por fase, con un colchón grave y el cuerno de guerra cada 4 compases.
import * as Tone from 'tone';
import { BeatGrid } from '../beat';
import type { Song, SongDef } from '../types';

/** El tempo de cada fase (golpes por minuto). */
export const BARDO_TEMPOS = [100, 130, 160] as const;
/** Sola (sin jefe que la maneje): compases por fase. */
const AUTO_BARS = 8;
/** Cada cuánto mira el reloj (s) y cuánto adelante agenda. */
const TICK = 0.03;
const ANTES = 0.12;

type Transport = ReturnType<typeof Tone.getTransport>;
type Dest = Tone.InputNode;
type Keep = <T extends { dispose(): unknown }>(n: T) => T;

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Las notas de la sexta cuerda y las otras raíces de los acordes de quinta (MIDI). Mi menor, con el fa frigio. */
const ROOT: Record<string, number> = { E: 40, F: 41, G: 43, A: 45, B: 47, C: 48, D: 50 };

/**
 * El riff de cada fase: un compás de 16 semicorcheas. `O` acorde abierto (se sostiene en los `.`), `m` el
 * chugg en mi (la nota pedal), `n` el chugg en la raíz del acorde, `-` silencio. Y los acordes, de a medio
 * compás (8 compases).
 */
const RIFFS = [
  { ritmo: 'O..mm.m.O..mO.m-', acordes: 'E E|E G|E E|A G|E E|E G|C C|D B' },
  { ritmo: 'O.mmm.mmO.mmm.mm', acordes: 'E E|C C|D D|B B|E E|C D|E F|E E' },
  { ritmo: 'OnnnOnnnOnnnOnnn', acordes: 'E F|E G|E F|A G|E F|E G|B C|B B' },
].map((r) => ({ ritmo: r.ritmo, acordes: r.acordes.split('|').map((b) => b.split(' ')) }));

/** El bombo de cada fase (1 = golpe; las negras siempre van fuertes). */
const BOMBO = ['1.......1.11....', '1.11....1.11....', '1111111111111111'];

/** La solista: melodía de 4 compases en mi menor armónico, [nota MIDI, semicorcheas]. */
const SOLO: readonly [number, number][] = [
  [71, 2], [76, 2], [79, 2], [78, 2], [76, 6], [74, 2],
  [72, 4], [71, 2], [69, 2], [71, 8],
  [71, 2], [76, 2], [79, 2], [81, 2], [83, 4], [81, 2], [79, 2],
  [78, 4], [75, 4], [76, 8],
];
/** En qué semicorchea (de las 64) arranca cada nota de la solista. */
const SOLO_EN = new Map<number, [number, number]>();
{
  let at = 0;
  for (const n of SOLO) {
    SOLO_EN.set(at, n);
    at += n[1];
  }
}

const DB = {
  todo: -9,
  guitarras: -10.5, bajo: -9, bombo: -7, mazo: -20, caja: -9.5, bordonero: -12, ride: -26, hat: -30, crash: -24, solista: -19, palillos: -14,
};

/** Una sala corta (convolución, calculada acá): para que la caja y las guitarras no suenen pegadas al oído. */
function salaIR(ctx: Tone.BaseContext, rt60: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * rt60);
  const buf = ctx.createBuffer(2, n, sr);
  let s = 77;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = Math.floor(0.012 * sr); i < n; i++) {
      const t = i / sr;
      lp += (0.5 * Math.exp(-t / 0.5) + 0.08) * (rnd() - lp);
      d[i] = lp * Math.pow(10, (-3 * t) / rt60);
    }
  }
  return buf;
}

/**
 * Una guitarra rítmica: dos sintes de sierras (el acorde abierto y el chugg apagado, con su pasabajos antes
 * de distorsionar: el chugg más cerrado) por la distorsión y el gabinete (corta graves y el chillido de
 * arriba, y ahueca los medios), paneada.
 */
function guitarra(keep: Keep, out: Dest, pan: number, detune: number) {
  const panner = keep(new Tone.Panner(pan)).connect(out);
  const cabLp = keep(new Tone.Filter({ type: 'lowpass', frequency: 4600, Q: 0.8, rolloff: -24 })).connect(panner);
  const cabMid = keep(new Tone.Filter({ type: 'peaking', frequency: 500, Q: 1.1, gain: -5 })).connect(cabLp);
  const cabHp = keep(new Tone.Filter({ type: 'highpass', frequency: 95, Q: 0.7 })).connect(cabMid);
  const level = keep(new Tone.Gain(0.35)).connect(cabHp);
  const dist = keep(new Tone.Distortion({ distortion: 0.92, oversample: '2x' })).connect(level);
  const preOpen = keep(new Tone.Filter({ type: 'lowpass', frequency: 2400, Q: 0.6 })).connect(dist);
  const preMute = keep(new Tone.Filter({ type: 'lowpass', frequency: 620, Q: 0.9 })).connect(dist);
  const abierto = keep(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.003, decay: 0.4, sustain: 0.75, release: 0.1 },
  })).connect(preOpen);
  const apagado = keep(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.002, decay: 0.1, sustain: 0.05, release: 0.05 },
  })).connect(preMute);
  abierto.set({ detune });
  apagado.set({ detune });
  return {
    /** Acorde de quinta (raíz, quinta y octava). */
    acorde(root: number, dur: number, time: number, vel: number) {
      abierto.triggerAttackRelease([hz(root), hz(root + 7), hz(root + 12)], dur, time, vel);
    },
    /** El chugg: raíz y quinta, cortito y apagado. */
    chugg(root: number, time: number, vel: number) {
      apagado.triggerAttackRelease([hz(root), hz(root + 7)], 0.07, time, vel);
    },
  };
}

/** La solista: una sierra con algo de vibrato, distorsión más suave, y un eco. */
function solista(keep: Keep, out: Dest, sala: Dest) {
  const eco = keep(new Tone.FeedbackDelay({ delayTime: 0.34, feedback: 0.22, wet: 0.22 })).connect(out);
  eco.connect(sala);
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 3600, Q: 0.7, rolloff: -24 })).connect(eco);
  const hp = keep(new Tone.Filter({ type: 'highpass', frequency: 220 })).connect(lp);
  const level = keep(new Tone.Gain(0.3)).connect(hp);
  const dist = keep(new Tone.Distortion({ distortion: 0.7, oversample: '2x' })).connect(level);
  const pre = keep(new Tone.Filter({ type: 'lowpass', frequency: 2000 })).connect(dist);
  const vib = keep(new Tone.Vibrato({ frequency: 5.5, depth: 0.08 })).connect(pre);
  const synth = keep(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.25 },
    volume: DB.solista,
  })).connect(vib);
  return synth;
}

/** Bajo: sierra por un pasabajos que se abre en cada nota, apenas saturada. */
function bajo(keep: Keep, out: Dest) {
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 1400 })).connect(out);
  const drive = keep(new Tone.Chebyshev(3)).connect(lp);
  drive.wet.value = 0.25;
  const synth = keep(new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', Q: 1.2, rolloff: -24 },
    filterEnvelope: { attack: 0.004, decay: 0.16, sustain: 0.25, release: 0.1, baseFrequency: 110, octaves: 2.6 },
    envelope: { attack: 0.004, decay: 0.2, sustain: 0.7, release: 0.08 },
    volume: DB.bajo,
  })).connect(drive);
  let last = -1;
  return (note: number, dur: number, t: number, vel: number) => {
    if (t <= last) return;
    last = t;
    synth.triggerAttackRelease(note, dur, t, vel);
  };
}

/** Bombo: el parche que cae de tono más el mazo (un clic corto, para que se oiga en parlantes chicos). */
function bombo(keep: Keep, out: Dest) {
  const body = keep(new Tone.MembraneSynth({ pitchDecay: 0.035, octaves: 5, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 }, volume: DB.bombo })).connect(out);
  const hp = keep(new Tone.Filter({ type: 'highpass', frequency: 2500 })).connect(out);
  const mazo = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.012, sustain: 0 }, volume: DB.mazo })).connect(hp);
  let last = -1;
  return (t: number, vel: number) => {
    if (t <= last) return;
    last = t;
    body.triggerAttackRelease(46, 0.3, t, vel);
    mazo.triggerAttackRelease(0.01, t, vel);
  };
}

/** Caja: el parche (cuerpo, a 190 Hz) y el bordonero (ruido por un pasabanda), con algo de sala. */
function caja(keep: Keep, out: Dest, sala: Dest) {
  const bus = keep(new Tone.Gain(1)).connect(out);
  bus.connect(keep(new Tone.Gain(0.35)).connect(sala));
  const head = keep(new Tone.MembraneSynth({ pitchDecay: 0.012, octaves: 1.6, envelope: { attack: 0.001, decay: 0.13, sustain: 0 }, volume: DB.caja })).connect(bus);
  const bp = keep(new Tone.Filter({ type: 'bandpass', frequency: 2600, Q: 0.55 })).connect(bus);
  const wires = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.17, sustain: 0 }, volume: DB.bordonero })).connect(bp);
  let last = -1;
  return (t: number, vel: number) => {
    if (t <= last) return;
    last = t;
    head.triggerAttackRelease(190, 0.1, t, vel);
    wires.triggerAttackRelease(0.15, t, vel);
  };
}

/** Platillos: la campana del ride (el metrónomo), el hi-hat cerrado y el crash. */
function platillos(keep: Keep, out: Dest) {
  const ride = keep(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.5, release: 0.2 }, harmonicity: 5.1, modulationIndex: 16, resonance: 5200, octaves: 1.2, volume: DB.ride })).connect(out);
  ride.frequency.value = 520;
  const hpHat = keep(new Tone.Filter({ type: 'highpass', frequency: 8000 })).connect(out);
  const hat = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 }, volume: DB.hat })).connect(hpHat);
  const hpCrash = keep(new Tone.Filter({ type: 'highpass', frequency: 4200 })).connect(out);
  const crash = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.6, sustain: 0, release: 0.3 }, volume: DB.crash })).connect(hpCrash);
  const bpSticks = keep(new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 2.5 })).connect(out);
  const sticks = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 }, volume: DB.palillos })).connect(bpSticks);
  // cada uno es de a una nota: dos en el mismo instante (el crash del cambio de fase y el de la frase) no van
  const once = (f: (t: number, vel: number) => void) => {
    let last = -1;
    return (t: number, vel: number) => {
      if (t <= last) return;
      last = t;
      f(t, vel);
    };
  };
  return {
    ride: once((t, vel) => ride.triggerAttackRelease(0.3, t, vel)),
    hat: once((t, vel) => hat.triggerAttackRelease(0.03, t, vel)),
    crash: once((t, vel) => crash.triggerAttackRelease(1.5, t, vel)),
    palillos: once((t, vel) => sticks.triggerAttackRelease(0.03, t, vel)),
  };
}

/**
 * El reloj de las canciones del jefe: semicorcheas en segundos del transporte (lo comparten dos canciones en
 * el fundido: nadie le cambia el tempo), al tempo de la grilla. Mira cada TICK y agenda lo que cae en los
 * próximos ANTES s; en cada negra marca el pulso en la grilla (en la hora del audio, la de lo que suena) y al
 * empezar compás toma el tempo y la fase pedidos. Sola (sin jefe), sube de fase cada AUTO_BARS compases.
 * `tocar` recibe la semicorchea (desde el principio; el primer compás es la cuenta), su hora de audio, lo
 * que dura y la fase.
 */
class Reloj {
  readonly grid: BeatGrid;
  private id = -1;
  private next = 0;
  private step = 0;
  private fin = Infinity;
  private paso: number;

  constructor(
    private readonly transport: Transport,
    private readonly tempos: readonly number[],
    private readonly tocar: (s: number, time: number, paso: number, fase: number) => void,
  ) {
    this.grid = new BeatGrid(tempos[0]);
    this.paso = 60 / tempos[0] / 4;
  }

  start(time: number): void {
    this.next = time;
    this.step = 0;
    this.fin = Infinity;
    this.id = this.transport.scheduleRepeat((t) => this.look(t), TICK, time);
  }

  stop(time: number): void {
    this.fin = time;
  }

  clear(): void {
    if (this.id >= 0) this.transport.clear(this.id);
    this.id = -1;
  }

  private look(time: number): void {
    const now = this.transport.getSecondsAtTime(time);
    if (now >= this.fin) return this.clear();
    const g = this.grid;
    while (this.next < now + ANTES && this.next < this.fin) {
      const at = time + Math.max(0, this.next - now);
      if (this.step % 4 === 0) {
        if (this.step % 16 === 0 && !g.driven) {
          const f = Math.min(this.tempos.length - 1, Math.max(0, Math.floor((this.step / 16 - 1) / AUTO_BARS)));
          g.want(this.tempos[f], f);
        }
        this.paso = 60 / g.mark(at).bpm / 4;
      }
      // si el navegador se trabó, lo atrasado no suena todo junto: se saltea
      if (this.next >= now - 0.05) this.tocar(this.step, at, this.paso, Math.max(0, g.phase));
      this.step++;
      this.next += this.paso;
    }
  }
}

function metal(out: Dest, transport: Transport): Song {
  const bolsa: { dispose(): unknown }[] = [];
  const keep: Keep = (n) => {
    bolsa.push(n);
    return n;
  };
  const master = keep(new Tone.Gain(Tone.dbToGain(DB.todo))).connect(out);
  const sala = keep(new Tone.Convolver(salaIR(transport.context, 1.3))).connect(master);
  const salaIn = keep(new Tone.Gain(0.5)).connect(sala);
  const gtrBus = keep(new Tone.Gain(Tone.dbToGain(DB.guitarras))).connect(master);
  gtrBus.connect(keep(new Tone.Gain(0.25)).connect(salaIn));
  const izq = guitarra(keep, gtrBus, -0.65, -7);
  const der = guitarra(keep, gtrBus, 0.65, 6);
  const lead = solista(keep, master, salaIn);
  const bass = bajo(keep, master);
  const kick = bombo(keep, master);
  const snare = caja(keep, master, salaIn);
  const cym = platillos(keep, master);

  let tension = 0;
  let fase = 0;
  let d = 60 / BARDO_TEMPOS[0] / 4;

  /** Una semicorchea: `s` desde el principio (el compás -1 es la cuenta), en la hora del audio `time`. */
  function play(s: number, time: number): void {
    const bar = Math.floor(s / 16) - 1;
    const st = s % 16;
    const h = (v: number) => v * (0.92 + 0.08 * Math.random());
    // la cuenta: los palillos en cada negra y la guitarra que acopla, creciendo
    if (bar < 0) {
      if (st % 4 === 0) cym.palillos(time, 0.6 + 0.1 * (st / 4));
      if (st === 0) lead.triggerAttackRelease(hz(76), 16 * d * 0.95, time, 0.35);
      if (st === 14) snare(time, 0.7);
      return;
    }
    const riff = RIFFS[fase];
    const halves = riff.acordes[bar % riff.acordes.length];
    const root = ROOT[halves[st < 8 ? 0 : 1]];
    const ch = riff.ritmo[st];
    // guitarras: la derecha apenas atrasada (dos tomas, no una copia)
    if (ch === 'O') {
      let len = 1;
      while (st + len < 16 && riff.ritmo[st + len] === '.') len++;
      const vel = st % 4 === 0 ? 0.95 : 0.8;
      izq.acorde(root, len * d * 0.92, time, vel);
      der.acorde(root, len * d * 0.92, time + 0.006, vel);
      bass(hz(root - 12), len * d * 0.9, time, 0.9);
    } else if (ch === 'm' || ch === 'n') {
      const r = ch === 'm' ? ROOT.E : root;
      const vel = st % 4 === 0 ? 0.95 : 0.72;
      izq.chugg(r, time, h(vel));
      der.chugg(r, time + 0.005, h(vel));
      if (fase < 2 || st % 2 === 0) bass(hz(r - 12), d * 0.85, time, 0.8);
    }
    // batería: el bombo de la fase (las negras siempre fuertes), la caja en 2 y 4, la campana del ride en
    // cada negra y el hi-hat en corcheas (semis con tensión)
    if (BOMBO[fase][st] === '1') kick(time, st % 4 === 0 ? 1 : fase === 2 ? 0.55 : 0.8);
    if (st === 4 || st === 12) snare(time, 1);
    if (st % 4 === 0) cym.ride(time, st === 0 ? 0.9 : 0.7);
    else if (st % 2 === 0 || tension > 0.55) cym.hat(time, h(st % 2 === 0 ? 0.6 : 0.35));
    if (st === 0 && (bar % (fase === 2 ? 2 : 4) === 0)) cym.crash(time, 0.8);
    // relleno de caja al final de cada frase de 8
    if (bar % 8 === 7 && st >= 12) snare(time, 0.55 + 0.12 * (st - 12));
    // la solista: desde la fase 1; en la 2, con otra voz una cuarta abajo
    if (fase >= 1 && bar % 8 >= 4) {
      const n = SOLO_EN.get((bar % 4) * 16 + st);
      if (n) lead.triggerAttackRelease(fase === 2 ? [hz(n[0]), hz(n[0] - 5)] : hz(n[0]), n[1] * d * 0.95, time, 0.7);
    }
  }

  const reloj = new Reloj(transport, BARDO_TEMPOS, (s, time, paso, f) => {
    // cambió de fase: un crash y el compás arranca con todo
    if (f !== fase && s % 16 === 0 && s > 0) cym.crash(time, 1);
    fase = Math.min(RIFFS.length - 1, f);
    d = paso;
    play(s, time);
  });

  return {
    beat: reloj.grid,
    start: (time: number) => reloj.start(time),
    stop: (time: number) => reloj.stop(time),
    intensity(level: number) {
      tension = level;
    },
    dispose() {
      reloj.clear();
      bolsa.splice(0).reverse().forEach((n) => n.dispose());
    },
  };
}

// ---------- el ogro tamborilero ----------

/** El tempo de cada fase del tamborilero. */
export const TAMBOR_TEMPOS = [90, 115, 140] as const;

const TDB = { todo: -11, taiko: -6, cuero: -16, toms: -12, shime: -13, ka: -5, colchon: -22, cuerno: -17, bajo: -12 };

/**
 * Los toms de cada fase (16 semicorcheas: 1 tom grave, 2 tom agudo, 3 los dos): pocos en la primera, el
 * galope en la segunda, redobles en la tercera. El taiko grande va siempre en las negras.
 */
const TOMS = ['..1...2...1.2...', '.12.1.2..12.1.21', '1212121212121212'];
/** El shime (el tamborcito agudo): desde la fase 1, en corcheas; en la 2, semis. */
const SHIME = ['', '..x...x...x...x.', 'xxx.xxx.xxx.xxx.'];
/** Las notas del colchón y del cuerno, de a dos compases (re menor: re, si bemol, do, la). */
const TAMBOR_AC = [38, 38, 34, 34, 36, 36, 33, 33];

/** Taiko: un parche grande y grave (cae despacio) y el cuero (ruido marrón corto), con sala. */
function taiko(keep: Keep, out: Dest, sala: Dest) {
  const bus = keep(new Tone.Gain(1)).connect(out);
  bus.connect(keep(new Tone.Gain(0.4)).connect(sala));
  const body = keep(new Tone.MembraneSynth({ pitchDecay: 0.06, octaves: 3, envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.4 }, volume: TDB.taiko })).connect(bus);
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 900 })).connect(bus);
  const cuero = keep(new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: TDB.cuero })).connect(lp);
  let last = -1;
  return (t: number, vel: number) => {
    if (t <= last) return;
    last = t;
    body.triggerAttackRelease(52, 0.8, t, vel);
    cuero.triggerAttackRelease(0.06, t, vel);
  };
}

/** Un tambor medio (tom o shime): parche que cae de tono, más corto. */
function parche(keep: Keep, out: Dest, freq: number, decay: number, octaves: number, volume: number) {
  const body = keep(new Tone.MembraneSynth({ pitchDecay: 0.025, octaves, envelope: { attack: 0.001, decay, sustain: 0, release: 0.1 }, volume })).connect(out);
  let last = -1;
  return (t: number, vel: number, f = freq) => {
    if (t <= last) return;
    last = t;
    body.triggerAttackRelease(f, decay, t, vel);
  };
}

/** El «ka»: el palo contra el borde del tambor, en cada negra (el metrónomo de esta canción). */
function ka(keep: Keep, out: Dest) {
  const bp = keep(new Tone.Filter({ type: 'bandpass', frequency: 2300, Q: 3 })).connect(out);
  const n = keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 }, volume: TDB.ka })).connect(bp);
  let last = -1;
  return (t: number, vel: number) => {
    if (t <= last) return;
    last = t;
    n.triggerAttackRelease(0.03, t, vel);
  };
}

/** Colchón grave (cuerdas oscuras: sierras gordas por un pasabajos) y el cuerno de guerra (metal que se abre). */
function vientos(keep: Keep, out: Dest, sala: Dest) {
  const lp = keep(new Tone.Filter({ type: 'lowpass', frequency: 700, Q: 0.5 })).connect(out);
  lp.connect(keep(new Tone.Gain(0.5)).connect(sala));
  const colchon = keep(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
    envelope: { attack: 0.6, decay: 0.4, sustain: 0.8, release: 1.2 },
    volume: TDB.colchon,
  })).connect(lp);
  const cuernoOut = keep(new Tone.Gain(1)).connect(out);
  cuernoOut.connect(keep(new Tone.Gain(0.6)).connect(sala));
  const cuerno = keep(new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', Q: 1.5, rolloff: -24 },
    filterEnvelope: { attack: 0.12, decay: 0.5, sustain: 0.45, release: 0.4, baseFrequency: 180, octaves: 3 },
    envelope: { attack: 0.07, decay: 0.3, sustain: 0.75, release: 0.45 },
    volume: TDB.cuerno,
  })).connect(cuernoOut);
  return { colchon, cuerno };
}

function tambor(out: Dest, transport: Transport): Song {
  const bolsa: { dispose(): unknown }[] = [];
  const keep: Keep = (n) => {
    bolsa.push(n);
    return n;
  };
  const master = keep(new Tone.Gain(Tone.dbToGain(TDB.todo))).connect(out);
  const sala = keep(new Tone.Convolver(salaIR(transport.context, 1.8))).connect(master);
  const salaIn = keep(new Tone.Gain(0.5)).connect(sala);
  const grande = taiko(keep, master, salaIn);
  const tomGrave = parche(keep, master, 98, 0.28, 2, TDB.toms);
  const tomAgudo = parche(keep, master, 131, 0.22, 2, TDB.toms - 1);
  const shime = parche(keep, master, 330, 0.07, 1.5, TDB.shime);
  const palo = ka(keep, master);
  const { colchon, cuerno } = vientos(keep, master, salaIn);
  const bass = bajo(keep, master);
  let fase = 0;
  let tension = 0;

  const reloj = new Reloj(transport, TAMBOR_TEMPOS, (s, time, d, f) => {
    const bar = Math.floor(s / 16) - 1;
    const st = s % 16;
    const h = (v: number) => v * (0.9 + 0.1 * Math.random());
    // la cuenta: el ka en cada negra
    if (bar < 0) {
      if (st % 4 === 0) palo(time, 0.7 + 0.1 * (st / 4));
      return;
    }
    // cambió de fase: el cuerno de guerra entero
    const nueva = Math.min(TOMS.length - 1, f);
    if (st === 0 && nueva !== fase) cuerno.triggerAttackRelease([hz(50), hz(57), hz(62)], 16 * d * 0.9, time, 0.85);
    fase = nueva;
    // el pulso: el taiko en cada negra (el uno más fuerte) y el ka encima
    if (st % 4 === 0) {
      grande(time, st === 0 ? 1 : 0.8);
      palo(time, st === 0 ? 0.9 : 0.65);
    }
    const t = TOMS[fase][st];
    if (t === '1' || t === '3') tomGrave(time, h(0.7));
    if (t === '2' || t === '3') tomAgudo(time + (t === '3' ? 0.01 : 0), h(0.65));
    const sh = SHIME[fase];
    if ((sh && sh[st] === 'x') || (tension > 0.6 && st % 2 === 1)) shime(time, h(st % 4 === 2 ? 0.7 : 0.45));
    // de a dos compases: el colchón y el bajo en la nota del acorde; el cuerno en el uno de cada 4 (de cada 2 en la fase 2)
    const nota = TAMBOR_AC[Math.floor(bar / 2) % TAMBOR_AC.length];
    if (st === 0 && bar % 2 === 0) colchon.triggerAttackRelease([hz(nota + 12), hz(nota + 19)], 32 * d * 0.95, time, 0.6);
    if (st % 8 === 0) bass(hz(nota), d * 6, time, 0.8);
    if (st === 0 && bar % (fase >= 2 ? 2 : 4) === 0 && bar > 0) cuerno.triggerAttackRelease([hz(nota + 12), hz(nota + 19)], 6 * d, time, 0.7);
    // redoble al final de cada frase de 8
    if (bar % 8 === 7 && st >= 8) (st % 2 === 0 ? tomGrave : tomAgudo)(time, 0.5 + 0.05 * (st - 8));
  });

  return {
    beat: reloj.grid,
    start: (time: number) => reloj.start(time),
    stop: (time: number) => reloj.stop(time),
    intensity(level: number) {
      tension = level;
    },
    dispose() {
      reloj.clear();
      bolsa.splice(0).reverse().forEach((n) => n.dispose());
    },
  };
}

export const SONGS: SongDef[] = [
  {
    id: 'bardo.metal',
    name: 'Jefe: el bardo del metal', // i18n-ok: el panel de pruebas
    role: 'jefe',
    blurb: 'Metal en mi menor para el guitarrista esqueleto: dos guitarras distorsionadas, bajo, doble bombo y la campana del ride en cada negra. Acelera por fases (100, 130, 160); el jefe lee sus pulsos (solo entran los tiros en el beat).', // i18n-ok: el panel de pruebas
    build: metal,
  },
  {
    id: 'bardo.tambor',
    name: 'Jefe: el ogro tamborilero', // i18n-ok: el panel de pruebas
    role: 'jefe',
    blurb: 'Tambores de guerra en re menor: el taiko y el ka en cada negra (el beat bien claro), toms que se van llenando, colchón grave y cuerno. Acelera por fases (90, 115, 140) y el jefe lee sus pulsos.', // i18n-ok: el panel de pruebas
    build: tambor,
  },
];
