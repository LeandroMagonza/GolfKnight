// Tres canciones de escenario en clave épica (15/10), una familia: una orquesta chica de fantasía (cuerdas
// en ostinato, cornos, trombones, timbales, redoblante y un coro) y un tema, «el del caballero», que pasa por
// las tres: entero en re mayor en el escenario 1, su cabeza en la menor en la marcha del 2 y en re menor,
// lento arriba de los tambores, en el asedio del 3. La tensión de la partida suma capas sin tocar el tempo:
// más percusión, una contramelodía, metales. Ver docs/musica/epica.md.
import * as Tone from 'tone';
import type { Song, SongDef } from '../types';

// ---------- tempo, tono y nivel de cada una ----------

/** Escenario 1, «El llamado»: re mayor con el do natural del mixolidio (el acorde de Do suena a aventura). */
const BPM_1 = 104;
/** Escenario 2, «La marcha»: la menor. */
const BPM_2 = 120;
/** Escenario 3, «El asedio»: re menor. */
const BPM_3 = 130;
/** Volumen de salida de cada una (dB): medido con tools/musica-render.mjs para andar como la de siempre. */
const MASTER_1 = -2;
const MASTER_2 = -1.5;
const MASTER_3 = -4;
/** Las escalas para armonizar una melodía en terceras. */
const LA_MENOR = [9, 11, 0, 2, 4, 5, 7];
const RE_MENOR = [2, 4, 5, 7, 9, 10, 0];

// ---------- notas, acordes y líneas ----------

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (s: string) => (PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? 11 : 0)) % 12;

/** «F#4» → 66. */
function noteNum(name: string): number {
  const m = /^([A-G][#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`epica: nota rara «${name}»`);
  const n = 12 * (Number(m[2]) + 1) + PC[m[1][0]] + (m[1][1] === '#' ? 1 : m[1][1] === 'b' ? -1 : 0);
  return n;
}

interface Chord {
  root: number;
  bass: number;
  /** Intervalos desde la fundamental: [0, tercera, quinta]. */
  iv: number[];
  pcs: number[];
}
const CHORDS = new Map<string, Chord>();
/** «Bm», «F#dim», «C/D» (Do con el bajo en re). */
function chord(sym: string): Chord {
  let c = CHORDS.get(sym);
  if (c) return c;
  const m = /^([A-G][#b]?)(m|dim|sus4)?(?:\/([A-G][#b]?))?$/.exec(sym);
  if (!m) throw new Error(`epica: acorde raro «${sym}»`);
  const root = pcOf(m[1]);
  const iv = m[2] === 'm' ? [0, 3, 7] : m[2] === 'dim' ? [0, 3, 6] : m[2] === 'sus4' ? [0, 5, 7] : [0, 4, 7];
  c = { root, bass: m[3] ? pcOf(m[3]) : root, iv, pcs: iv.map((i) => (root + i) % 12) };
  CHORDS.set(sym, c);
  return c;
}
/** La nota de clase `pc` desde `lo` hasta una octava arriba. */
const place = (pc: number, lo: number) => lo + ((((pc - lo) % 12) + 12) % 12);
/** El acorde apretado en la octava que empieza en `lo`: así pasa de uno a otro moviéndose poco. */
const voicing = (c: Chord, lo: number) => c.pcs.map((pc) => place(pc, lo)).sort((a, b) => a - b);
/** Quinta justa con octava (fundamental, quinta, octava) en el registro de los trombones. */
const power = (c: Chord) => [0, 7, 12].map((i) => place(c.root, 41) + i);

/**
 * Un ostinato: 16 casillas (semicorcheas) con qué nota del acorde va. R la fundamental, 3 y 5 arriba de
 * ella, O la octava, V la quinta de abajo; «!» la acentúa y «.» es silencio.
 */
type Pat = ({ tok: string; acc: boolean } | null)[];
function pat(src: string): Pat {
  const p = src.split(/\s+/).filter(Boolean).map((x) => (x === '.' ? null : { tok: x[0], acc: x.endsWith('!') }));
  if (p.length !== 16) throw new Error(`epica: el ostinato «${src}» no tiene 16 casillas`);
  return p;
}
function tone(tok: string, c: Chord, lo: number): number {
  const r = place(c.root, lo);
  return tok === '3' ? r + c.iv[1] : tok === '5' ? r + c.iv[2] : tok === 'O' ? r + 12 : tok === 'V' ? r + c.iv[2] - 12 : r;
}

/** Una nota (o varias juntas) de una melodía, con su largo en semicorcheas. */
interface Ev {
  len: number;
  notes: number[];
}
/** Una melodía: cada nota según la semicorchea de la sección en la que empieza. */
type Line = Map<number, Ev>;
/**
 * «D4:3 D4:1 A4:8 | ...»: nota y largo en semicorcheas, «-» silencio, «D4+A4» dos juntas. Cada tramo entre
 * barras tiene que llenar compases enteros (así un error de cuenta salta enseguida).
 */
function line(src: string, bars: number, where: string): Line {
  const out: Line = new Map();
  let at = 0;
  for (const chunk of src.split('|')) {
    const from = at;
    for (const tok of chunk.split(/\s+/).filter(Boolean)) {
      const [notes, len] = tok.split(':');
      const n = Number(len);
      if (!n) throw new Error(`epica: «${tok}» sin largo en ${where}`);
      if (notes !== '-') out.set(at, { len: n, notes: notes.split('+').map(noteNum) });
      at += n;
    }
    if ((at - from) % 16) throw new Error(`epica: un compás de ${where} suma ${(at - from) % 16} de más`);
  }
  if (at !== bars * 16) throw new Error(`epica: ${where} dura ${at} semicorcheas y la sección ${bars * 16}`);
  return out;
}
/** Baja una octava una melodía escrita. */
const octDown = (src: string) => src.replace(/([A-G][#b]?)(\d)/g, (_, n: string, o: string) => n + (Number(o) - 1));

/** Una sección: sus acordes (uno por compás, o dos: «G A») y sus melodías, cada una con el nombre de su parte. */
interface Sec {
  kind: string;
  bars: number;
  chords: string[];
  /** Por medio compás: qué acorde suena, si arranca ahí y cuántas semicorcheas dura. */
  halves: { sym: string; fresh: boolean; len: number }[];
  lines: Record<string, Line>;
}
function sec(kind: string, chords: string, lines: Record<string, string> = {}): Sec {
  const bars = chords.split('|').map((s) => s.trim());
  const syms = bars.flatMap((b) => {
    const p = b.split(/\s+/);
    return [p[0], p[p.length - 1]];
  });
  const halves = syms.map((sym, h) => ({ sym, fresh: h === 0 || syms[h - 1] !== sym, len: 8 }));
  for (let h = halves.length - 2; h >= 0; h--) if (!halves[h + 1].fresh) halves[h].len += halves[h + 1].len;
  for (const s of syms) chord(s);
  const out: Record<string, Line> = {};
  for (const [name, src] of Object.entries(lines)) out[name] = line(src, bars.length, `${kind}.${name}`);
  return { kind, bars: bars.length, chords: bars, halves, lines: out };
}
const chordAtPos = (s: Sec, pos: number) => chord(s.halves[Math.floor(pos / 8)].sym);

/**
 * Una segunda voz para la parte `from`, en `to`: los cornos que acompañan abajo. Si la melodía está en una
 * nota del acorde, la de abajo es la nota del acorde más cercana (a una tercera o más: así no cae una
 * sexta rara sobre la tónica); si está de paso, va una tercera abajo en la escala `scale` (con la
 * sensible si el acorde la trae, el sol# del Mi en la menor).
 */
function thirds(s: Sec, from: string, to: string, scale: number[]): Sec {
  const out: Line = new Map();
  for (const [pos, ev] of s.lines[from]) {
    const c = chordAtPos(s, pos);
    out.set(pos, {
      len: ev.len,
      notes: ev.notes.map((m) => {
        if (c.pcs.includes(m % 12)) {
          let n = m - 3;
          while (!c.pcs.includes(n % 12)) n--;
          return n;
        }
        let i = scale.indexOf(m % 12);
        if (i < 0) i = scale.indexOf((m + 11) % 12);
        let pc = scale[(i + scale.length - 2) % scale.length];
        if (!c.pcs.includes(pc) && c.pcs.includes((pc + 1) % 12)) pc = (pc + 1) % 12;
        let n = m - 1;
        while (n % 12 !== pc) n--;
        return n;
      }),
    });
  }
  s.lines[to] = out;
  return s;
}

// ---------- la orquesta ----------

/** El contexto de audio de verdad (el de Tone, o el de Tone.Offline al renderizar). */
type Ctx = BaseAudioContext;

const IMPULSES = new Map<number, Float32Array<ArrayBuffer>[]>();
/**
 * La respuesta de la sala, inventada: ruido que se apaga en unos 2,5 s y se oscurece (la cola más opaca que
 * el principio), distinto en cada oído. Con la Freeverb de Tone (pocos peines) las notas largas de los
 * cornos hacían silbar la reverb en 553 Hz, 17 dB arriba del resto.
 */
function hallBuffer(ctx: Ctx): AudioBuffer {
  const sr = ctx.sampleRate;
  let chans = IMPULSES.get(sr);
  if (!chans) {
    const n = Math.floor(sr * 2.6);
    const pre = Math.floor(sr * 0.02);
    chans = [0, 1].map(() => {
      const d = new Float32Array(n);
      let lp = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / sr;
        const a = Math.exp((-2 * Math.PI * (900 + 5000 * Math.exp(-t / 0.9))) / sr);
        lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
        d[i] = lp * Math.exp(-t / 0.42) * Math.min(1, t / 0.03);
      }
      return d;
    });
    IMPULSES.set(sr, chans);
  }
  const buffer = ctx.createBuffer(2, chans[0].length, sr);
  chans.forEach((ch, i) => buffer.copyToChannel(ch, i));
  return buffer;
}

interface Playable {
  triggerAttackRelease(notes: number[], duration: number, time: number, velocity: number): unknown;
}

const dbGain = (db: number) => Math.pow(10, db / 20);

/** Cómo suena cada nota de un instrumento de `voices`. */
interface Voice {
  /** Volumen en dB (como el `volume` de Tone). */
  db: number;
  /** La desafinación de cada sierra, en cents: dos o tres por nota hacen la «sección». */
  detune: number[];
  /** Ataque, caída, sostén (0..1) y relajación, en segundos. */
  env: [number, number, number, number];
  /** Pasabajos por nota: arranca en `lo`, abre a `hi` en `rise` s y se asienta en `mid`; `stages` 2, más empinado. */
  filter?: { lo: number; hi: number; mid: number; rise: number; fall: number; q: number; stages?: number };
  /** FM (la celesta): un seno modulado por otro `ratio` veces más agudo, con un brillo que se apaga en `fall` s. */
  fm?: { ratio: number; index: number; fall: number };
}

/**
 * Un instrumento polifónico liviano: cada nota arma sus osciladores nativos y se desarma sola al terminar.
 * Con las PolySynth de Tone cada voz queda armada (señales, envolventes y filtros andando aunque no suene)
 * y la orquesta entera costaba más de lo que el audio aguanta en vivo.
 */
function voices(ctx: Ctx, dest: AudioNode, v: Voice): Playable {
  const level = dbGain(v.db) * (v.fm ? 1 : dbGain(-6 - v.detune.length * 1.1));
  const [a, d, s, r] = v.env;
  const rise = v.filter?.rise ?? 0;
  return {
    triggerAttackRelease(freqs, dur, t, vel) {
      const end = Math.max(t + dur, t + Math.max(a, rise) + 0.005);
      const stop = end + r * 1.3 + 0.03;
      for (const f of freqs) {
        const amp = ctx.createGain();
        const peak = level * vel;
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(peak, t + a);
        amp.gain.setTargetAtTime(peak * s, t + a, d / 3);
        amp.gain.setTargetAtTime(0, end, r / 3);
        amp.connect(dest);
        const parts: AudioNode[] = [amp];
        let head: AudioNode = amp;
        if (v.filter) {
          // rampas que terminan: mientras la frecuencia de un filtro se mueve, el navegador recalcula el
          // filtro en cada muestra; quieta, no (con curvas que no terminan, cada nota costaba toda su vida)
          const { lo, hi, mid, fall, q, stages = 1 } = v.filter;
          const settle = t + rise + fall;
          const close = Math.max(end, settle);
          for (let i = 0; i < stages; i++) {
            const bq = ctx.createBiquadFilter();
            bq.type = 'lowpass';
            bq.Q.value = q;
            bq.frequency.setValueAtTime(lo, t);
            bq.frequency.linearRampToValueAtTime(hi, t + rise);
            bq.frequency.linearRampToValueAtTime(mid, settle);
            bq.frequency.setValueAtTime(mid, close);
            bq.frequency.linearRampToValueAtTime(lo, close + r);
            bq.connect(head);
            parts.push(bq);
            head = bq;
          }
        }
        const oscs: OscillatorNode[] = [];
        if (v.fm) {
          const car = ctx.createOscillator();
          const mod = ctx.createOscillator();
          const depth = ctx.createGain();
          car.frequency.value = f;
          mod.frequency.value = f * v.fm.ratio;
          depth.gain.setValueAtTime(f * v.fm.index, t);
          depth.gain.setTargetAtTime(0, t, v.fm.fall / 3);
          mod.connect(depth).connect(car.frequency);
          car.connect(head);
          parts.push(depth);
          oscs.push(car, mod);
        } else {
          for (const cents of v.detune) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = f;
            o.detune.value = cents;
            o.connect(head);
            oscs.push(o);
          }
        }
        for (const o of oscs) {
          o.start(t);
          o.stop(stop);
        }
        oscs[0].onended = () => {
          for (const n of [...oscs, ...parts]) n.disconnect();
        };
      }
    },
  };
}

/** La constante de tiempo que usa Tone para una caída «exponencial» de `x` segundos (así suenan igual). */
const tau = (x: number) => Math.log(x + 1) / Math.log(200);

/** Apaga en unos ms, desde `t`, el golpe anterior de un parche (como la mano que lo vuelve a golpear). */
function choke(prev: GainNode | null, t: number): void {
  if (!prev) return;
  prev.gain.cancelScheduledValues(t);
  prev.gain.setTargetAtTime(0, t, 0.006);
}

/**
 * Un parche (timbal, bombo, el cuerpo del redoblante), también descartable: un oscilador que cae de `ratio`
 * veces la nota a la nota en `drop` s y se apaga en `decay` s. `partials`: armónicos (si no, un seno).
 */
function membrane(ctx: Ctx, dest: AudioNode, o: { db: number; ratio: number; drop: number; decay: number; partials?: number[] }) {
  const wave = o.partials ? ctx.createPeriodicWave(new Float32Array(o.partials.length + 1), Float32Array.from([0, ...o.partials])) : null;
  const level = dbGain(o.db);
  const k = tau(o.decay);
  let prev: GainNode | null = null;
  return (note: number, t: number, vel: number) => {
    // cada golpe ahoga al anterior, como un parche de verdad: si no, los redobles se suman y retumban
    choke(prev, t);
    const f = midi(note);
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    if (wave) osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(f * o.ratio, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + o.drop);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(level * vel, t + 0.002);
    amp.gain.setTargetAtTime(0, t + 0.002, k);
    osc.connect(amp).connect(dest);
    osc.start(t);
    osc.stop(t + 0.01 + k * 7);
    prev = amp;
    osc.onended = () => {
      osc.disconnect();
      amp.disconnect();
    };
  };
}

type NoiseType = 'white' | 'pink' | 'brown';
const NOISE = new Map<NoiseType, Float32Array<ArrayBuffer>[]>();
/** Ruido de 2 s por canal, con las mismas recetas que Tone (blanco, rosa de Kellet, marrón). */
function noiseData(type: NoiseType): Float32Array<ArrayBuffer>[] {
  let data = NOISE.get(type);
  if (!data) {
    data = [0, 1].map(() => {
      const ch = new Float32Array(88200);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < ch.length; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') ch[i] = w;
        else if (type === 'brown') {
          last = (last + 0.02 * w) / 1.02;
          ch[i] = last * 3.5;
        } else {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          ch[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      }
      return ch;
    });
    NOISE.set(type, data);
  }
  return data;
}

/**
 * Un golpe de ruido descartable (redoblante, baqueta, platillos): entra en `attack` s y se apaga en `decay`
 * s. Con `swell`, la entrada es exponencial (el platillo que crece).
 */
function noise(ctx: Ctx, dest: AudioNode, o: { db: number; type: NoiseType; attack: number; decay: number; swell?: boolean; ring?: boolean }) {
  const data = noiseData(o.type);
  const buffer = ctx.createBuffer(2, data[0].length, ctx.sampleRate);
  data.forEach((ch, i) => buffer.copyToChannel(ch, i));
  const level = dbGain(o.db);
  const k = tau(o.decay);
  let prev: GainNode | null = null;
  return (t: number, vel: number) => {
    if (!o.ring) choke(prev, t);
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    src.buffer = buffer;
    src.loop = true;
    if (o.swell) {
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(level * vel, t + o.attack);
    } else {
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(level * vel, t + o.attack);
    }
    amp.gain.setTargetAtTime(0, t + o.attack, k);
    src.connect(amp).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.attack + k * 7);
    prev = amp;
    src.onended = () => {
      src.disconnect();
      amp.disconnect();
    };
  };
}

/** Dónde va la canción en este paso: la semicorchea, la sección, el acorde y cuánto pesa cada capa. */
interface At {
  t: number;
  /** Semicorchea del compás (0..15). */
  s: number;
  /** Compás dentro de la sección. */
  bar: number;
  /** Semicorchea dentro de la sección. */
  pos: number;
  sec: Sec;
  kind: string;
  /** Qué vuelta de la forma (la segunda cambia detalles). */
  round: number;
  /** El último compás de la sección. */
  last: boolean;
  ch: Chord;
  /** Arranca un acorde en esta semicorchea, y cuánto dura. */
  fresh: boolean;
  chLen: number;
  /** Las capas de la tensión, de 0 a 1: percusión, contramelodía, metales. */
  L1: number;
  L2: number;
  L3: number;
}

function orquesta(out: Tone.InputNode, STEP: number, master: number) {
  // todo el cableado es nativo: los filtros y paneos de Tone llevan señales enchufadas a sus parámetros y el
  // navegador los recalcula en cada muestra; quietos y nativos, una vez por bloque
  const ctx: Ctx = Tone.getContext().rawContext;
  const nodes: AudioNode[] = [];
  const lfos: OscillatorNode[] = [];
  const keep = <T extends AudioNode>(n: T): T => {
    nodes.push(n);
    return n;
  };
  const gain = (g: number, to?: AudioNode) => {
    const n = keep(ctx.createGain());
    n.gain.value = g;
    if (to) n.connect(to);
    return n;
  };
  /** Un filtro (o `stages` en fila, más empinado) que desemboca en `to`; devuelve la entrada. Q 1 como en Tone. */
  const filter = (type: BiquadFilterType, f: number, to: AudioNode, o: { q?: number; db?: number; stages?: number } = {}) => {
    let next = to;
    for (let i = 0; i < (o.stages ?? 1); i++) {
      const b = keep(ctx.createBiquadFilter());
      b.type = type;
      b.frequency.value = f;
      b.Q.value = o.q ?? 1;
      b.gain.value = o.db ?? 0;
      b.connect(next);
      next = b;
    }
    return next;
  };
  const lp = (f: number, to: AudioNode, stages = 1) => filter('lowpass', f, to, { stages });
  const hpf = (f: number, to: AudioNode) => filter('highpass', f, to);
  /** Un retardo que oscila (como Tone.Vibrato: 2,5 ms ± 2,5 ms × `depth`). */
  const vibrato = (freq: number, depth: number, to: AudioNode) => {
    const d = keep(ctx.createDelay(0.02));
    d.delayTime.value = 0.0025;
    d.connect(to);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = freq;
    const swing = gain(0.0025 * depth);
    swing.connect(d.delayTime);
    lfo.connect(swing);
    lfo.start();
    lfos.push(lfo);
    return d;
  };

  // la salida: un hueco suave alrededor de 2,5 kHz (ahí viven los golpes y las voces) y nada bajo 35 Hz
  // y un compresor suave al final: baja los golpes más fuertes (platillo, bombo y timbal juntos al entrar
  // una sección) sin tocar el resto
  const comp = keep(ctx.createDynamicsCompressor());
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.2;
  Tone.connect(comp, out);
  const vol = gain(dbGain(master), comp);
  const bus = gain(1, filter('peaking', 2500, filter('highpass', 35, vol), { q: 0.7, db: -3 }));
  // la sala: una reverb propia y más larga que la del juego, sin graves (graves en la reverb embarran)
  const conv = keep(ctx.createConvolver());
  conv.buffer = hallBuffer(ctx);
  conv.connect(bus);
  const hallIn = hpf(300, conv);
  /** Dónde se sienta cada instrumento: paneo y cuánto manda a la sala. */
  const seat = (pan: number, send: number) => {
    const p = keep(ctx.createStereoPanner());
    p.pan.value = pan;
    p.connect(bus);
    p.connect(gain(send, hallIn));
    return p;
  };
  // cada instrumento entra por un Gain (ahí se enchufan sus notas, que se arman y desarman solas)
  const inlet = (to: AudioNode) => gain(1, to);

  // cuerdas cortas (el ostinato): una sierra (en notas tan cortas la desafinación de una sección no se oye);
  // el filtro se abre con el golpe de arco y se cierra
  const spicLp = keep(ctx.createBiquadFilter());
  spicLp.frequency.value = 1500;
  spicLp.connect(seat(0.3, 0.12));
  let spicHz = 1500;
  const spic = voices(ctx, inlet(hpf(110, spicLp)), {
    db: -14, detune: [0], env: [0.005, 0.14, 0.1, 0.1],
    filter: { lo: 320, hi: 1850, mid: 620, rise: 0.004, fall: 0.12, q: 0.7 },
  });
  // pizzicato: lo mismo pellizcado, más oscuro y con cola
  const pizz = voices(ctx, inlet(seat(0.25, 0.25)), {
    db: -10, detune: [0], env: [0.002, 0.28, 0, 0.2],
    filter: { lo: 260, hi: 1200, mid: 360, rise: 0.002, fall: 0.09, q: 1, stages: 2 },
  });
  // el colchón de cuerdas: dos sierras desafinadas por nota, entrada lenta, pasabajos
  const pad = voices(ctx, inlet(lp(1100, seat(0.05, 0.3))), { db: -22.3, detune: [-10, 10], env: [0.7, 0.4, 0.85, 1.4] });
  // violines con melodía: entran más rápido y con un vibrato chico
  const vln = voices(ctx, inlet(vibrato(5.2, 0.08, lp(2000, seat(0.2, 0.35), 2))), {
    db: -18.3, detune: [-7, 7], env: [0.14, 0.3, 0.85, 0.6],
  });
  // cornos: sierra doble con un filtro que florece al entrar (el «buaa» del metal) y se asienta. A la
  // izquierda: los peines de la reverb del juego del lado derecho silban con el do#5 y el re5 del tema
  const horn = voices(ctx, inlet(seat(-0.3, 0.35)), {
    db: -13, detune: [-4.5, 4.5], env: [0.06, 0.3, 0.85, 0.4],
    filter: { lo: 380, hi: 1420, mid: 900, rise: 0.09, fall: 0.45, q: 1.3, stages: 2 },
  });
  // trombones y tuba: una sierra, más grave y con más mordida
  const low = voices(ctx, inlet(hpf(60, seat(0.12, 0.22))), {
    db: -13, detune: [0], env: [0.03, 0.3, 0.65, 0.35],
    filter: { lo: 140, hi: 1120, mid: 420, rise: 0.035, fall: 0.3, q: 1.6, stages: 2 },
  });
  // chelos y contrabajos
  const bass = voices(ctx, inlet(hpf(45, seat(-0.05, 0.08))), {
    db: -10, detune: [0], env: [0.02, 0.25, 0.7, 0.3],
    filter: { lo: 150, hi: 600, mid: 310, rise: 0.015, fall: 0.2, q: 0.7, stages: 2 },
  });
  // coro: dos sierras por nota pasadas por dos formantes de «o/a» (650 y 1080 Hz) más un poco de cuerpo grave
  const choirOut = seat(0, 0.45);
  const vowel = gain(1);
  vowel.connect(filter('bandpass', 650, choirOut, { q: 2.5 }));
  vowel.connect(filter('bandpass', 1080, gain(0.5, choirOut), { q: 3.5 }));
  vowel.connect(lp(400, gain(0.4, choirOut)));
  const choir = voices(ctx, inlet(vibrato(4.6, 0.07, vowel)), { db: -5.3, detune: [-12, 12], env: [1, 0.5, 0.9, 1.8] });
  // celesta: FM suave
  const bells = voices(ctx, inlet(lp(5000, seat(0.35, 0.5))), { db: -24, detune: [0], env: [0.002, 1.4, 0, 1.2], fm: { ratio: 3.01, index: 6, fall: 0.3 } });
  // timbales: membrana con dos armónicos (sola suena a bombo electrónico) y el golpe de la baqueta
  const timpOut = inlet(seat(-0.1, 0.22));
  const timp = membrane(ctx, timpOut, { db: -11, ratio: 1.5, drop: 0.045, decay: 1.3, partials: [1, 0.35, 0.12] });
  const stick = noise(ctx, inlet(lp(1200, timpOut)), { db: -26, type: 'pink', attack: 0.001, decay: 0.035 });
  // bombo y taikos
  const drumOut = inlet(seat(0, 0.15));
  const drum = membrane(ctx, drumOut, { db: -10, ratio: 2.6, drop: 0.08, decay: 0.5 });
  const skin = noise(ctx, inlet(lp(700, drumOut)), { db: -16, type: 'brown', attack: 0.001, decay: 0.06 });
  // redoblante: ruido rosa recortado arriba y abajo, más el cuerpo del parche
  const snareOut = inlet(seat(0.2, 0.18));
  const snare = noise(ctx, inlet(hpf(450, lp(4200, snareOut))), { db: -18, type: 'pink', attack: 0.001, decay: 0.1 });
  const snareBody = membrane(ctx, snareOut, { db: -22, ratio: 1.6, drop: 0.012, decay: 0.07 });
  // platillos: un golpe y un crescendo de un compás, ruido arriba de 4 kHz
  const crash = noise(ctx, inlet(hpf(3800, seat(-0.3, 0.4))), { db: -31, type: 'white', attack: 0.002, decay: 2.4, ring: true });
  const swell = noise(ctx, inlet(hpf(5000, seat(0.3, 0.4))), { db: -33, type: 'white', attack: STEP * 16, decay: 0.25, swell: true, ring: true });

  // un golpe por instante en cada parche y en el bajo: dos juntos (un redoble que pisa un golpe) sonarían
  // el doble de fuerte; el segundo se saltea
  const lastHit = new Map<object, number>();
  const free = (inst: object, t: number) => {
    if (t <= (lastHit.get(inst) ?? -1) + 1e-4) return false;
    lastHit.set(inst, t);
    return true;
  };
  /** Un poco de mano humana en la fuerza de cada nota. */
  const hum = () => 0.93 + Math.random() * 0.14;

  const o = {
    spic, pizz, pad, vln, horn, low, choir, bells,
    /** Notas MIDI que duran `len` semicorcheas (`gate`: qué parte de ese largo suenan). */
    play(inst: Playable, notes: number | number[], len: number, t: number, vel: number, gate = 0.95) {
      if (vel < 0.03) return;
      const list = Array.isArray(notes) ? notes : [notes];
      inst.triggerAttackRelease(list.map(midi), len * STEP * gate, t, Math.min(1, vel * hum()));
    },
    /** La nota de la parte `name` de la sección que empieza en esta semicorchea, si hay. */
    line(a: At, name: string, inst: Playable, vel: number, gate = 0.95) {
      const ev = a.sec.lines[name]?.get(a.pos);
      if (ev) o.play(inst, ev.notes, ev.len, a.t, vel, gate);
    },
    /** Una casilla de un ostinato sobre el acorde que suena, desde la nota `lo`. */
    ost(a: At, p: Pat, lo: number, vel: number, inst: Playable = spic, len = 1) {
      const c = p[a.s];
      if (c) o.play(inst, tone(c.tok, a.ch, lo), len, a.t, c.acc ? vel : vel * 0.62, 0.9);
    },
    bassNote(note: number, len: number, t: number, vel: number) {
      if (vel >= 0.03 && free(bass, t)) bass.triggerAttackRelease([midi(note)], len * STEP * 0.95, t, vel * hum());
    },
    timpani(note: number, t: number, vel: number) {
      if (vel < 0.03 || !free(timp, t)) return;
      timp(note, t, vel * hum());
      stick(t, vel * 0.8);
    },
    drum(note: number, t: number, vel: number) {
      if (vel < 0.03 || !free(drum, t)) return;
      drum(note, t, vel * hum());
      skin(t, vel * 0.7);
    },
    snare(t: number, vel: number) {
      if (vel < 0.03 || !free(snare, t)) return;
      snare(t, vel * hum());
      snareBody(55, t, vel * 0.8);
    },
    /** Un redoble (fusas: dos golpes por semicorchea) de la casilla `from` a la `to`, de fuerza `v0` a `v1`. */
    roll(what: 'timp' | 'snare', a: At, from: number, to: number, v0: number, v1: number, note = 0) {
      if (a.s < from || a.s >= to) return;
      for (const h of [0, 0.5]) {
        const v = v0 + ((v1 - v0) * (a.s + h - from)) / (to - from);
        if (what === 'timp') o.timpani(note, a.t + h * STEP, v);
        else o.snare(a.t + h * STEP, v);
      }
    },
    crash(t: number, vel: number) {
      if (vel >= 0.03 && free(crash, t)) crash(t, vel);
    },
    /** El platillo que crece durante un compás y se corta en el siguiente. */
    swell(t: number, vel: number) {
      if (vel >= 0.03 && free(swell, t)) swell(t, vel);
    },
    /** Con tensión, el ostinato se abre (más brillo, más urgencia). */
    open(level: number, t: number) {
      const hz = 1500 + 900 * level;
      if (Math.abs(hz - spicHz) < 20) return;
      spicLp.frequency.setValueAtTime(spicHz, t);
      spicLp.frequency.linearRampToValueAtTime(hz, t + 1);
      spicHz = hz;
    },
    dispose() {
      for (const l of lfos) l.stop();
      for (const n of nodes) n.disconnect();
    },
  };
  return o;
}
type Orq = ReturnType<typeof orquesta>;

const ramp = (x: number, a: number, b: number) => Math.max(0, Math.min(1, (x - a) / (b - a)));

/**
 * Arma una canción: la orquesta, la forma (las secciones en orden, que se repiten) y `play`, que en cada
 * semicorchea decide qué toca cada uno.
 */
function cancion(out: Tone.InputNode, transport: ReturnType<typeof Tone.getTransport>, bpm: number, master: number, form: Sec[], play: (o: Orq, a: At) => void): Song {
  const STEP = 60 / bpm / 4;
  const o = orquesta(out, STEP, master);
  const slots = form.flatMap((sec) => Array.from({ length: sec.bars }, (_, bar) => ({ sec, bar })));
  let id = -1;
  let i = 0;
  let stopAt = Infinity;
  let target = 0;
  let lvl = 0;
  return {
    start(time) {
      i = 0;
      stopAt = Infinity;
      id = transport.scheduleRepeat((t) => {
        if (transport.getSecondsAtTime(t) >= stopAt) return;
        // la tensión entra de a poco (unos 2 s), así una capa no aparece de golpe
        lvl += (target - lvl) * 0.06;
        o.open(lvl, t);
        const abs = Math.floor(i / 16);
        const { sec, bar } = slots[abs % slots.length];
        const s = i % 16;
        const half = sec.halves[bar * 2 + (s >= 8 ? 1 : 0)];
        play(o, {
          t, s, bar, sec,
          pos: bar * 16 + s,
          kind: sec.kind,
          round: Math.floor(abs / slots.length),
          last: bar === sec.bars - 1,
          ch: chord(half.sym),
          fresh: half.fresh && s % 8 === 0,
          chLen: half.len,
          L1: ramp(lvl, 0.2, 0.45),
          L2: ramp(lvl, 0.45, 0.7),
          L3: ramp(lvl, 0.7, 0.95),
        });
        i++;
      }, STEP, time);
    },
    stop(time) {
      // sigue sonando mientras se apaga el fundido; desde `time`, nada nuevo
      stopAt = time;
    },
    intensity(level) {
      target = Math.max(0, Math.min(1, level));
      if (i === 0) lvl = target;
    },
    dispose() {
      if (id >= 0) transport.clear(id);
      id = -1;
      o.dispose();
    },
  };
}

// ---------- escenario 1: «El llamado» (re mayor, 104) ----------
// Intro con redoble de timbal y la llamada del corno; A: el tema en los cornos sobre cuerdas al galope; B:
// violines que preguntan y cornos que contestan; A2: el tema abajo, en los trombones, con los cornos en
// contracanto; C: respiro, el coro y un corno solo que sube por Si bemol y Do (bVI–bVII, la cadencia épica)
// hasta el A3, con todos.

/** El tema del caballero: la quinta que sube (re… la) con el «ta-tán» corto-largo, y el do natural del 4. */
const THEME_1 = 'D4:3 D4:1 A4:8 G4:2 F#4:2 | G4:6 B4:2 A4:8 | D4:3 D4:1 A4:8 D5:4 | C5:6 B4:1 A4:1 G4:8 | ' +
  'B4:3 B4:1 F#4:8 A4:2 B4:2 | G4:4 A4:2 B4:2 D5:8 | D5:6 B4:2 A4:4 C#5:4 | D5:12 -:4';
/** Violines arriba, notas largas. */
const DESC_1 = 'F#5:16 | G5:8 E5:8 | F#5:8 A5:8 | G5:8 E5:8 | F#5:8 D5:8 | D5:8 G5:8 | G5:8 E5:8 | F#5:16';
/** Contracanto de los cornos cuando el tema va en los trombones. */
const COUNTER_1 = 'A4:16 | B4:8 C#5:8 | A4:8 F#4:8 | G4:8 E4:8 | F#4:16 | G4:8 B4:8 | B4:8 C#5:8 | D5:16';
const CHORDS_A1 = 'D | G A | D | C | Bm | G | G A | D';

const FORM_1 = [
  sec('I', 'D | C/D | D | A', { call: '-:16 | -:16 | D4:3 D4:1 A4:12 | -:16' }),
  sec('A', CHORDS_A1, { lead: THEME_1, desc: DESC_1 }),
  sec('B', 'Bm | G | D | A | Bm | Em | C | A', {
    strings: 'F#5:6 E5:2 D5:4 C#5:2 D5:2 | B4:12 -:4 | -:16 | -:16 | F#5:6 G5:2 A5:4 F#5:4 | G5:4 F#5:4 E5:8 | -:16 | -:16',
    answer: '-:16 | -:16 | D4:3 D4:1 A4:8 F#4:4 | E4:12 -:4 | -:16 | -:16 | C5:3 C5:1 G4:4 E4:4 G4:4 | A4:16',
  }),
  sec('A2', CHORDS_A1, { low: octDown(THEME_1), counter: COUNTER_1, desc: DESC_1 }),
  sec('C', 'Bb | F | C | G | Bb | F | Bb | C', {
    solo: 'Bb3:3 Bb3:1 F4:12 | A4:6 G4:2 F4:8 | C4:3 C4:1 G4:12 | B4:6 A4:2 G4:8 | Bb3:3 Bb3:1 F4:8 Bb4:4 | C5:8 A4:8 | Bb4:6 C5:2 D5:8 | E5:12 -:4',
    bells: '-:16 | -:8 A4:1 C5:1 F5:6 | -:16 | -:8 B4:1 D5:1 G5:6 | -:16 | -:8 A4:1 C5:1 F5:6 | -:16 | -:8 C5:1 E5:1 G5:2 C6:4',
  }),
  sec('A3', CHORDS_A1, { lead: THEME_1, low: octDown(THEME_1), desc: DESC_1 }),
];

const GALLOP_1 = pat('R! . R R 5! . 5 5 O! . O O 5! . 5 5');
const GALLOP_1B = pat('R! . R R 3! . R R 5! . R R 3! . R R');
const HARP_1 = pat('R! . . . 5 . . . O . . . 5 . . .');
const SNARE_LIGHT = [0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0, 0, 0.45, 0, 0.28, 0.34];
const SNARE_MARCH = [0.7, 0, 0, 0.25, 0.55, 0, 0.35, 0.35, 0.65, 0, 0, 0.25, 0.55, 0, 0.4, 0.45];

function llamado(o: Orq, a: At): void {
  const { t, s, bar, kind, last, L1, L2, L3 } = a;
  const calm = kind === 'C';
  const big = kind === 'A3';
  // cuerdas cortas; en el respiro, pizzicato (y el galope vuelve si la cosa se pone fea)
  if (kind === 'I') {
    if (bar > 0) o.ost(a, GALLOP_1, 45, 0.4 + 0.12 * bar);
  } else if (calm) {
    o.ost(a, HARP_1, 50, 0.5, o.pizz, 3);
    o.ost(a, GALLOP_1, 45, 0.4 * L2);
  } else o.ost(a, kind === 'B' ? GALLOP_1B : GALLOP_1, 45, big ? 0.85 : 0.75);
  // colchón y coro
  if (a.fresh && !(kind === 'I' && bar === 0)) o.play(o.pad, voicing(a.ch, 57), a.chLen, t, calm ? 0.35 : big ? 0.55 : 0.45);
  if (a.fresh && (calm || kind === 'B' || big)) o.play(o.choir, voicing(a.ch, 62), a.chLen, t, calm ? 0.55 : 0.45 * L2);
  // bajo
  const b = place(a.ch.bass, 38);
  if (kind === 'I' || calm) {
    if (s === 0) o.bassNote(b, 16, t, calm ? 0.5 : 0.45 + 0.1 * bar);
  } else if (kind === 'B') {
    if (s % 4 === 0) o.bassNote(b, 3, t, s === 0 ? 0.8 : 0.55);
  } else if (s === 0 || s === 8) o.bassNote(b, 7, t, s === 0 ? 0.85 : 0.65);
  // melodías
  o.line(a, 'call', o.horn, 0.75);
  o.line(a, 'lead', o.horn, big ? 0.95 : 0.85);
  o.line(a, 'low', o.low, 0.75);
  o.line(a, 'counter', o.horn, 0.7);
  o.line(a, 'answer', o.horn, 0.85);
  o.line(a, 'strings', o.vln, 0.75);
  o.line(a, 'solo', a.round % 2 ? o.vln : o.horn, 0.6);
  o.line(a, 'bells', o.bells, 0.45);
  o.line(a, 'desc', o.vln, big ? 0.65 : 0.6 * L2);
  // trombones: sostienen las respuestas de los cornos; con mucha tensión, un golpe por frase
  if (s === 0) {
    if (kind === 'B' && (bar === 2 || bar === 6)) o.play(o.low, power(a.ch), 12, t, 0.45);
    else if (kind === 'I' && bar === 3) o.play(o.low, power(a.ch), 16, t, 0.4);
    else if ((kind === 'A' || kind === 'B') && bar % 2 === 0) o.play(o.low, power(a.ch), 6, t, 0.55 * L3);
  }
  // timbales: el intro redobla (la segunda vuelta, al revés: se apaga después del final con todos)
  const tn = place(a.ch.root, 33);
  if (kind === 'I') {
    if (bar === 0) o.roll('timp', a, 0, 16, a.round ? 0.5 : 0.08, a.round ? 0.12 : 0.55, tn);
    else if (s === 0) o.timpani(tn, t, 0.6);
    else if (bar === 3 && s >= 12) o.timpani(tn, t, 0.3 + 0.08 * (s - 12));
  } else if (calm) {
    if (last) o.roll('timp', a, 0, 16, 0.08, 0.7, tn);
    else if (s === 0 && bar % 2 === 0) o.timpani(tn, t, 0.4);
  } else if (last && !big && (kind === 'B' || L1 > 0.1) && s >= 8) {
    o.roll('timp', a, 8, 16, 0.2, kind === 'B' ? 0.7 : 0.7 * L1, tn);
  } else if (s === 0 || s === 8) o.timpani(tn, t, (s === 0 ? 0.75 : 0.42) * (big ? 1.12 : 1));
  else if (s === 6 || s === 14) o.timpani(tn, t, 0.32 * L1);
  // redoblante: liviano de base, marcha con tensión
  let sn = 0;
  if (kind === 'A') sn = SNARE_LIGHT[s] * L1;
  else if (kind === 'B' || kind === 'A2') sn = Math.max(SNARE_LIGHT[s] * 0.8, SNARE_MARCH[s] * L1);
  else if (big) sn = SNARE_MARCH[s] * 0.85;
  if (kind === 'I' && bar === 3) o.roll('snare', a, 8, 16, 0.1, 0.5 * L1);
  else if (big && (bar === 3 || bar === 7) && s >= 12 && L1 > 0.1) o.roll('snare', a, 12, 16, 0.25, 0.6 * L1);
  else o.snare(t, sn);
  // bombo y platillos
  if (s === 0 || s === 8) {
    const w = big ? (s === 0 ? 0.6 : 0.45 * L2) : kind === 'A' || kind === 'A2' || kind === 'B' ? (s === 0 ? 0.65 : 0.4) * L3 : 0;
    o.drum(31, t, w);
  }
  if (s === 0) {
    if (bar === 0 && big) o.crash(t, 0.7);
    else if (bar === 0 && kind === 'A2') o.crash(t, 0.5);
    else if (bar === 0 && kind === 'A') o.crash(t, 0.5 * L3);
    else if (bar === 4 && big) o.crash(t, 0.45 * L2);
    if ((last && (kind === 'B' || calm)) || (kind === 'I' && bar === 3)) o.swell(t, 0.6);
  }
}

// ---------- escenario 2: «La marcha» (la menor, 120) ----------
// Intro con redoblante y bombo de marcha; A: la cabeza del tema en menor y una marcha nueva, cuerdas en
// semicorcheas; B: violines arriba en do mayor, cornos contestando; C: a escondidas, un pizzicato con
// cromatismos (los goblins en puntas de pie) y el coro grave; D: subida cromática con redoble; A2 y B2 con
// todos.

const THEME_2 = 'A3:3 A3:1 E4:8 D4:2 C4:2 | D4:6 F4:2 E4:8 | C4:3 C4:1 E4:4 A4:4 E4:4 | D4:3 D4:1 G4:4 B4:4 G4:4 | ' +
  'A4:6 G4:2 F4:4 C4:4 | D4:6 E4:2 F4:4 A4:4 | B4:6 A4:1 G#4:1 E4:4 G#4:4 | A4:12 -:4';
const DESC_2 = 'C5:8 E5:8 | F5:8 E5:8 | C5:16 | B4:8 D5:8 | C5:8 A4:8 | A4:8 D5:8 | E5:8 B4:8 | C5:16';
const MELODY_2B = 'G4:4 C5:8 B4:2 C5:2 | D5:12 B4:4 | C5:4 E5:8 D5:2 C5:2 | B4:16 | A4:4 C5:8 F5:4 | E5:8 D5:4 C5:4 | D5:8 F5:4 E5:2 D5:2 | E5:8 B4:4 G#4:4';
const CHORDS_A2 = 'Am | Dm E | Am | G | F | Dm | E | Am';
const CHORDS_B2 = 'C | G | Am | Em | F | C | Dm | E';

const FORM_2 = [
  sec('I', 'Am | Am | Am | E'),
  sec('A', CHORDS_A2, { lead: THEME_2, desc: DESC_2 }),
  sec('B', CHORDS_B2, {
    strings: MELODY_2B,
    answer: '-:16 | -:8 G3:3 G3:1 D4:4 | -:16 | -:8 E4:3 E4:1 B4:4 | -:16 | -:8 C4:3 C4:1 G4:4 | -:16 | -:8 E4:3 E4:1 B4:4',
  }),
  sec('C', 'Am | Am | Bb/A | Am | Dm | Dm | F | E', {
    pizz: 'A2:2 -:2 C3:2 -:2 E3:2 -:2 D#3:2 E3:2 | A3:2 -:2 G3:2 -:2 E3:2 -:2 C3:2 -:2 | ' +
      'Bb2:2 -:2 D3:2 -:2 F3:2 -:2 E3:2 F3:2 | A3:2 -:2 E3:2 -:2 C3:2 -:2 B2:2 -:2 | ' +
      'D3:2 -:2 F3:2 -:2 A3:2 -:2 G#3:2 A3:2 | D4:2 -:2 C4:2 -:2 A3:2 -:2 F3:2 -:2 | ' +
      'F3:2 -:2 A3:2 -:2 C4:2 -:2 B3:2 C4:2 | E3:2 -:2 G#3:2 -:2 B3:2 -:2 D4:2 -:2',
    call: '-:16 | -:16 | -:16 | -:16 | D4:3 D4:1 A4:12 | -:16 | C4:3 C4:1 F4:12 | E4:16',
  }),
  sec('D', 'F | F#dim | G | G#dim', { rise: 'A4:16 | A4:16 | B4:16 | B4:8 D5:8' }),
  sec('A2', CHORDS_A2, { lead: THEME_2, low: octDown(THEME_2), desc: DESC_2 }),
  thirds(sec('B2', CHORDS_B2, { strings: MELODY_2B }), 'strings', 'harm', LA_MENOR),
];

const RUN_2 = pat('R! R 5 R 3! R 5 R R! R 5 R O! 5 3 5');
const GALLOP_2 = pat('R! . R R 5! . R R O! . R R 5! . R R');
const SNARE_2 = [0, 0, 0, 0, 0.45, 0, 0, 0.2, 0, 0, 0, 0, 0.45, 0, 0, 0.25];
const MARCH_2 = [0.55, 0, 0, 0.2, 0.5, 0, 0.3, 0.3, 0.55, 0, 0.25, 0.2, 0.5, 0, 0.35, 0.4];

function marcha(o: Orq, a: At): void {
  const { t, s, bar, kind, last, L1, L2, L3 } = a;
  const sneak = kind === 'C';
  const big = kind === 'A2' || kind === 'B2';
  // cuerdas: semicorcheas seguidas en A, galope en B; a escondidas solo vuelven con tensión
  if (kind === 'I') {
    if (bar > 0) o.ost(a, RUN_2, 45, 0.35 + 0.12 * bar);
  } else if (sneak) o.ost(a, RUN_2, 45, 0.35 * L2);
  else if (kind === 'D') o.ost(a, RUN_2, 45, 0.45 + 0.1 * bar);
  else o.ost(a, kind === 'B' || kind === 'B2' ? GALLOP_2 : RUN_2, 45, big ? 0.8 : 0.7);
  // colchón y coro
  if (a.fresh && !sneak) o.play(o.pad, voicing(a.ch, 57), a.chLen, t, kind === 'I' ? 0.3 : 0.4);
  if (a.fresh) {
    if (sneak) o.play(o.choir, voicing(a.ch, 57), a.chLen, t, 0.5);
    else if (kind === 'B2' || kind === 'D') o.play(o.choir, voicing(a.ch, 62), a.chLen, t, kind === 'D' ? 0.35 + 0.1 * bar : 0.5);
    else if (kind === 'A2' || kind === 'B') o.play(o.choir, voicing(a.ch, 62), a.chLen, t, 0.45 * L2);
  }
  // bajo: «um-pa» de marcha (la fundamental y la quinta de abajo); en la subida, corcheas cromáticas
  const b = place(a.ch.bass, 40);
  if (kind === 'D') {
    if (s % 2 === 0) o.bassNote(b, 1.5, t, 0.5 + 0.1 * bar + (s % 4 === 0 ? 0.1 : 0));
  } else if (!sneak && (kind !== 'I' || bar >= 1) && s % 4 === 0) {
    const fifth = b - 5 < 36 ? b + 7 : b - 5;
    o.bassNote(s % 8 === 0 ? b : fifth, 2, t, s % 8 === 0 ? 0.8 : 0.6);
  }
  // melodías; en la segunda vuelta el A cambia de color: el tema en los violines y los cornos arriba
  const swap = kind === 'A' && a.round % 2 === 1;
  o.line(a, 'lead', swap ? o.vln : o.horn, big ? 0.92 : swap ? 0.75 : 0.85);
  o.line(a, 'low', o.low, 0.72);
  o.line(a, 'desc', swap ? o.horn : o.vln, swap ? 0.5 : big ? 0.62 : 0.58 * L2);
  o.line(a, 'strings', o.vln, 0.75);
  o.line(a, 'answer', o.horn, 0.8);
  o.line(a, 'harm', o.horn, 0.62);
  o.line(a, 'call', o.horn, 0.55);
  o.line(a, 'rise', o.horn, 0.6 + 0.08 * bar);
  o.line(a, 'pizz', o.pizz, 0.75, 0.6);
  // trombones
  if (kind === 'D') {
    if (s === 0) o.play(o.low, voicing(a.ch, 48), 16, t, 0.35 + 0.12 * bar);
  } else if (kind === 'B2') {
    if (s === 0 && bar % 2 === 0) o.play(o.low, power(a.ch), 4, t, 0.6);
  } else if ((kind === 'A' || kind === 'B') && (s === 0 || s === 10)) o.play(o.low, power(a.ch), s ? 2 : 4, t, (s ? 0.45 : 0.6) * L3);
  // timbales: fundamental y quinta; a escondidas, un latido
  const tn = place(a.ch.root, 33);
  if (kind === 'I') {
    if (bar === 3 && (s === 0 || s >= 12)) o.timpani(tn, t, s ? 0.3 + 0.08 * (s - 12) : 0.6);
  } else if (sneak) {
    if (s === 0) o.timpani(tn, t, 0.45);
    else if (s === 3) o.timpani(tn, t, 0.28);
  } else if (kind === 'D') {
    if (bar === 3) o.roll('timp', a, 0, 16, 0.15, 0.75, tn);
    else if (s === 0 || s === 8) o.timpani(tn, t, 0.5);
  } else if (last && (kind === 'A' || kind === 'A2') && s >= 8 && L1 > 0.1) o.roll('timp', a, 8, 16, 0.2, 0.65 * L1, tn);
  else if (s === 0) o.timpani(tn, t, big ? 0.75 : 0.65);
  else if (s === 8) o.timpani(place(a.ch.root + 7, 33), t, 0.4);
  else if (s === 14 || s === 15) o.timpani(tn, t, 0.3 * L1);
  // redoblante: es una marcha, está siempre (menos a escondidas)
  if (kind === 'D' && bar >= 2) o.roll('snare', a, 0, 16, bar === 2 ? 0.08 : 0.35, bar === 2 ? 0.35 : 0.7);
  else if (last && kind === 'A' && s >= 8 && L1 > 0.1) o.roll('snare', a, 8, 16, 0.15, 0.55 * L1);
  else if (kind === 'I') o.snare(t, bar < 2 ? MARCH_2[s] : SNARE_2[s]);
  else if (sneak) o.snare(t, s === 4 || s === 12 ? 0.18 * L1 : 0);
  else if (kind === 'D') o.snare(t, SNARE_2[s]);
  else o.snare(t, big ? MARCH_2[s] * 0.85 : Math.max(SNARE_2[s], MARCH_2[s] * L1));
  // bombo y platillos
  if (s === 0 || s === 8) o.drum(31, t, big ? (s === 0 ? 0.6 : 0.4) : kind === 'A' || kind === 'B' ? 0.55 * L2 : sneak ? 0.4 * L3 : kind === 'I' && bar < 3 ? 0.45 : 0);
  if (s === 0) {
    if (bar === 0 && kind === 'A2') o.crash(t, 0.65);
    else if (bar === 0 && kind === 'B2') o.crash(t, 0.5);
    else if (bar === 0 && kind === 'A') o.crash(t, 0.5 * L2);
    if (bar === 3 && (kind === 'I' || kind === 'D')) o.swell(t, 0.6);
  }
}

// ---------- escenario 3: «El asedio» (re menor, 130) ----------
// Todo en 3+3+2 (los acentos de corchea en 1, el «y» del 2 y el 4): taikos, bajo y golpes de trombón. A: el
// tema del caballero en menor y en notas largas arriba del ostinato; B: el coro grande y los cornos arriba;
// C: el respiro, un latido de taiko y la celesta tocando el tema como caja de música (el guiño); D: subida
// con redoble; A2 y B2 con todos.

const THEME_3 = 'D4:6 D4:2 A4:16 G4:4 F4:4 | F4:12 D4:4 | E4:12 G4:4 | D4:6 D4:2 A4:16 D5:8 | D5:6 C5:2 Bb4:8 | A4:8 C#5:8';
const DESC_3 = 'F5:16 | F5:8 E5:8 | D5:16 | E5:8 G5:8 | F5:16 | A5:8 F5:8 | G5:8 D5:8 | E5:16';
const MELODY_3B = 'D5:12 C5:2 Bb4:2 | C5:16 | G4:4 C5:8 E5:4 | D5:16 | D5:8 F5:8 | F5:6 E5:2 C5:8 | D5:8 Bb4:8 | C#5:12 -:4';
const CHORDS_A3 = 'Dm | Dm | Bb | C | Dm | Dm | Gm | A';
const CHORDS_B3 = 'Bb | F | C | Dm | Bb | F | Gm | A';

const FORM_3 = [
  sec('I', 'Dm | Dm | Dm | A'),
  sec('A', CHORDS_A3, { lead: THEME_3, low: octDown(THEME_3), desc: DESC_3 }),
  thirds(sec('B', CHORDS_B3, { lead: MELODY_3B }), 'lead', 'harm', RE_MENOR),
  sec('C', 'Dm | Gm | Dm | A | Dm | Gm | Bb | A', {
    bells: 'D5:3 D5:1 A5:8 G5:2 F5:2 | G5:6 Bb5:2 A5:8 | -:16 | -:16 | D5:3 D5:1 A5:8 G5:2 F5:2 | G5:6 Bb5:2 A5:8 | F5:6 D5:2 Bb4:8 | C#5:16',
  }),
  sec('D', 'Gm | Bb | C | A', { rise: 'D4:16 | F4:16 | G4:16 | A4:8 C#5:8' }),
  thirds(sec('A2', CHORDS_A3, { lead: THEME_3, desc: DESC_3 }), 'lead', 'harm', RE_MENOR),
  sec('B2', CHORDS_B3, {
    strings: MELODY_3B,
    answer: '-:8 Bb3:3 Bb3:1 F4:4 | -:16 | -:8 C4:3 C4:1 G4:4 | -:16 | -:8 Bb3:3 Bb3:1 F4:4 | -:16 | -:8 G3:3 G3:1 D4:4 | -:16',
  }),
];

const SIEGE_3 = pat('O! R R R R R 5! R R R R R 3! R 5 R');
const PEDAL_3 = pat('O! . . . . . R! . . . . . V! . . .');
const TAIKO_3 = [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0.85, 0, 0, 0];
const TAIKO_3B = [0, 0, 0, 0.35, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0.45, 0.5];
const BACKBEAT_3 = [0, 0, 0, 0, 0.45, 0, 0, 0.18, 0, 0, 0.18, 0, 0.5, 0, 0, 0.2];

function asedio(o: Orq, a: At): void {
  const { t, s, bar, kind, last, L1, L2, L3 } = a;
  const calm = kind === 'C';
  const big = kind === 'A2' || kind === 'B2';
  // cuerdas: semicorcheas con los acentos del 3+3+2; en el respiro, un pizzicato en los acentos
  if (kind === 'I') {
    if (bar >= 2) o.ost(a, SIEGE_3, 45, 0.45 + 0.12 * (bar - 2));
  } else if (calm) {
    o.ost(a, PEDAL_3, 45, 0.5, o.pizz, 3);
    o.ost(a, SIEGE_3, 45, 0.35 * L2);
  } else o.ost(a, SIEGE_3, 45, kind === 'D' ? 0.5 + 0.1 * bar : big ? 0.8 : 0.7);
  // colchón y coro (el coro grande en B; grave en el respiro)
  if (a.fresh) {
    o.play(o.pad, voicing(a.ch, kind === 'I' ? 50 : 57), a.chLen, t, kind === 'I' ? 0.5 : 0.35);
    if (calm) o.play(o.choir, voicing(a.ch, 57), a.chLen, t, 0.5);
    else if (kind === 'B' || big || kind === 'D') o.play(o.choir, voicing(a.ch, 62), a.chLen, t, kind === 'D' ? 0.35 + 0.1 * bar : 0.55);
    else if (kind === 'A') o.play(o.choir, voicing(a.ch, 62), a.chLen, t, 0.45 * L2);
  }
  // bajo en 3+3+2
  const b = place(a.ch.bass, 38);
  if (calm) {
    if (s === 0) o.bassNote(b, 16, t, 0.4);
  } else if ((kind !== 'I' || bar >= 1) && (s === 0 || s === 6 || s === 12)) o.bassNote(b, s === 12 ? 3 : 5, t, s === 0 ? 0.85 : 0.7);
  // melodías; en la segunda vuelta el tema del A baja a los trombones (más pesado) y los violines van arriba
  const heavy = kind === 'A' && a.round % 2 === 1;
  if (heavy) o.line(a, 'low', o.low, 0.8);
  else o.line(a, 'lead', o.horn, 0.88);
  o.line(a, 'desc', o.vln, big || heavy ? 0.62 : 0.58 * L2);
  o.line(a, 'harm', o.horn, 0.62 * L2);
  o.line(a, 'strings', o.vln, 0.75);
  o.line(a, 'answer', o.horn, 0.85);
  o.line(a, 'rise', o.horn, 0.6 + 0.08 * bar);
  o.line(a, 'bells', o.bells, 0.5);
  // trombones: golpes en los acentos
  const pow = power(a.ch);
  if (kind === 'D') {
    if (s === 0) o.play(o.low, voicing(a.ch, 48), 16, t, 0.35 + 0.12 * bar);
  } else if (kind === 'I') {
    if (bar === 3 && s === 0) o.play(o.low, pow, 16, t, 0.45);
  } else if (calm) {
    if (s === 6 || s === 12) o.play(o.low, pow, 2, t, 0.4 * L3);
  } else if (kind === 'B') {
    if (s === 0 && bar % 2 === 0) o.play(o.low, pow, 12, t, 0.45);
    else if (s === 6 || s === 12) o.play(o.low, pow, 2, t, 0.5 * L3);
  } else if (s === 6 || s === 12) o.play(o.low, pow, 2, t, big ? 0.65 : heavy ? 0.5 * L3 : 0.55);
  else if (s === 0 || s === 9) o.play(o.low, pow, 2, t, heavy ? 0 : 0.5 * L3);
  // taikos: grave en los acentos fuertes, agudo en el resto; en el respiro, un latido
  let dv = 0;
  if (kind === 'I') dv = TAIKO_3[s] * (0.55 + 0.12 * bar);
  else if (calm) dv = s === 0 ? 0.5 : s === 3 ? 0.32 : 0;
  else if (kind === 'D') dv = s % 2 === 0 ? 0.3 + 0.12 * bar + (s % 4 === 0 ? 0.1 : 0) : 0;
  else dv = Math.max(TAIKO_3[s], TAIKO_3B[s] * (big ? 1 : L1));
  if (!calm && kind !== 'I' && kind !== 'D' && (bar === 3 || bar === 7) && s >= 8) dv = Math.max(dv, (0.3 + 0.05 * (s - 8)) * L3);
  o.drum(calm || s === 0 || s === 12 ? 33 : 38, t, dv);
  // timbales
  const tn = place(a.ch.root, 33);
  if (kind === 'I') {
    if (bar === 3) o.roll('timp', a, 0, 16, 0.1, 0.7, tn);
  } else if (kind === 'D') {
    if (bar === 3) o.roll('timp', a, 0, 16, 0.2, 0.8, tn);
    else if (s === 0) o.timpani(tn, t, 0.55);
  } else if (calm) {
    if (s === 0) o.timpani(tn, t, 0.3 * L1);
  } else if (s === 0) o.timpani(tn, t, 0.6);
  else if (s === 6 || s === 12) o.timpani(tn, t, 0.45 * L2);
  // redoblante
  if (kind === 'D') {
    if (bar >= 2) o.roll('snare', a, 0, 16, bar === 2 ? 0.1 : 0.35, bar === 2 ? 0.35 : 0.75);
  } else if (!calm && kind !== 'I') {
    if (last && !big && s >= 8 && L1 > 0.1) o.roll('snare', a, 8, 16, 0.15, 0.5 * L1);
    else o.snare(t, BACKBEAT_3[s] * (big ? 0.9 : L1));
  }
  // platillos
  if (s === 0) {
    if (bar === 0 && (kind === 'A' || big)) o.crash(t, 0.6);
    else if (bar === 0 && kind === 'B') o.crash(t, 0.5 * L1);
    if (bar === 3 && (kind === 'I' || kind === 'D')) o.swell(t, 0.65);
  }
}

export const SONGS: SongDef[] = [
  {
    id: 'epica.llamado',
    name: 'Épica 1: el llamado', // i18n-ok: el panel de pruebas
    role: 'escenario1',
    blurb: 'Re mayor, 104. El tema del caballero en los cornos sobre cuerdas al galope, timbales y coro; la tensión suma redoblante, violines arriba y trombones.', // i18n-ok: el panel de pruebas
    build: (out, transport) => cancion(out, transport, BPM_1, MASTER_1, FORM_1, llamado),
  },
  {
    id: 'epica.marcha',
    name: 'Épica 2: la marcha', // i18n-ok: el panel de pruebas
    role: 'escenario2',
    blurb: 'La menor, 120. Marcha con redoblante y cuerdas en semicorcheas, la cabeza del tema en menor, un pizzicato a escondidas; la tensión suma bombo, violines y trombones.', // i18n-ok: el panel de pruebas
    build: (out, transport) => cancion(out, transport, BPM_2, MASTER_2, FORM_2, marcha),
  },
  {
    id: 'epica.asedio',
    name: 'Épica 3: el asedio', // i18n-ok: el panel de pruebas
    role: 'escenario3',
    blurb: 'Re menor, 130. Taikos y trombones en 3+3+2, el tema lento en los cornos, coro grande y una caja de música; la tensión suma redoblante, timbales y más metales.', // i18n-ok: el panel de pruebas
    build: (out, transport) => cancion(out, transport, BPM_3, MASTER_3, FORM_3, asedio),
  },
];
