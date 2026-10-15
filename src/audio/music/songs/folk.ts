// Las tres canciones de escenario en estilo folk medieval (15/10): la banda de una feria (laúd, flauta
// dulce, una viola de arco, un bordón, pandero y pandereta) tocando tres temas de la misma familia que se
// van oscureciendo: la feria (sol mayor, en 6/8), la marcha (la menor con toques frigios) y el asedio
// (re menor, al galope). Cada una tiene su forma (intro, A, B, A, puente, B, A) de un minuto y medio largo
// antes de repetirse, y la tensión de la partida le suma capas sin tocar el tempo. Ver docs/musica/folk.md.
import * as Tone from 'tone';
import type { Song, SongDef } from '../types';

// ---------- tempos y tonalidades ----------
/** La feria: sol mayor en 6/8, 116 negras con puntillo por minuto (el paso es la corchea). */
const FERIA_BPM = 116;
const FERIA_STEP = 60 / FERIA_BPM / 3;
const G_MAJOR = [7, 9, 11, 0, 2, 4, 6];
/** La marcha: la menor en 4/4, 126 por minuto (el paso es la semicorchea). */
const MARCHA_BPM = 126;
const MARCHA_STEP = 60 / MARCHA_BPM / 4;
const A_MINOR = [9, 11, 0, 2, 4, 5, 7];
/** El asedio: re menor en 4/4, 136 por minuto. */
const ASEDIO_BPM = 136;
const ASEDIO_STEP = 60 / ASEDIO_BPM / 4;
const D_MINOR = [2, 4, 5, 7, 9, 10, 0];

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const pcOf = (m: number) => ((m % 12) + 12) % 12;
/** De 0 a 1 mientras la tensión pasa de `from` a `from + w`: las capas entran de a poco, no de golpe. */
const ramp = (x: number, from: number, w = 0.15) => Math.max(0, Math.min(1, (x - from) / w));

// ---------- la notación ----------
// Una melodía es un texto: 'G4:2 B4 D5:2 B4 | ...'. Cada nota con su duración en pasos (si no la dice, la
// de la canción), '-' es silencio, '~' la adorna con un golpecito de la nota de arriba (el «cut» de las
// flautas folk) y '|' separa compases, que se cuentan: si uno no suma, la canción no carga y lo dice.

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function note(s: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(s);
  if (!m) throw new Error(`nota rara: ${s}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

interface Ev {
  at: number;
  note: number;
  len: number;
  cut: boolean;
}

function line(src: string, bar: number, dflt: number): { ev: Ev[]; steps: number } {
  const ev: Ev[] = [];
  let at = 0;
  src.split('|').forEach((chunk, i) => {
    const start = at;
    for (const tok of chunk.trim().split(/\s+/).filter(Boolean)) {
      const m = /^(~?)([^:]+)(?::(\d+))?$/.exec(tok);
      if (!m) throw new Error(`nota rara: ${tok}`);
      const len = m[3] ? Number(m[3]) : dflt;
      if (m[2] !== '-') ev.push({ at, note: note(m[2]), len, cut: m[1] === '~' });
      at += len;
    }
    if (at - start !== bar) throw new Error(`compás ${i + 1} de «${src.slice(0, 24)}…»: ${at - start} pasos, no ${bar}`);
  });
  return { ev, steps: at };
}

interface Chord {
  root: number;
  /** 3 (menor) o 4 (mayor). */
  third: number;
  pcs: number[];
}

function chord(name: string): Chord {
  const m = /^([A-G])([#b]?)(m?)$/.exec(name);
  if (!m) throw new Error(`acorde raro: ${name}`);
  const root = pcOf(PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
  const third = m[3] ? 3 : 4;
  return { root, third, pcs: [root, pcOf(root + third), pcOf(root + 7)] };
}

/** La nota `pc` más grave desde `lo`. */
const lowest = (pc: number, lo: number) => lo + pcOf(pc - lo);
/** El bajo del acorde, entre `lo` y una octava arriba. */
const bassOf = (ch: Chord, lo: number) => lowest(ch.root, lo);
/** Las tres notas del acorde desde `lo`, de abajo hacia arriba (así cambian poco de un acorde al otro). */
const upper = (ch: Chord, lo: number) => ch.pcs.map((pc) => lowest(pc, lo)).sort((a, b) => a - b);

/** La escala del modo con la alteración que pide el acorde (el si bemol frigio, la sensible del V). */
function scaleFor(scale: number[], ch: Chord): number[] {
  return scale.map((p) => ch.pcs.find((c) => !scale.includes(c) && (pcOf(c - p) === 1 || pcOf(p - c) === 1)) ?? p);
}

/** `n` grados de la escala arriba (o abajo) de `m`. */
function degree(m: number, scale: number[], n: number): number {
  let x = m;
  for (let left = Math.abs(n); left > 0;) {
    x += Math.sign(n);
    if (scale.includes(pcOf(x))) left--;
  }
  return x;
}

/** La segunda voz: la nota del acorde más cercana arriba o abajo (una tercera, a veces una cuarta); si la
 *  melodía va de paso, una tercera de la escala. Así armonizan las bandas de feria, en terceras. */
function harmonize(m: number, ch: Chord, scale: number[], dir: 1 | -1): number {
  let h = degree(m, scale, 2 * dir);
  if (ch.pcs.includes(pcOf(m))) {
    for (let d = 3; d <= 9; d++) {
      if (ch.pcs.includes(pcOf(m + dir * d))) {
        h = m + dir * d;
        break;
      }
    }
  }
  // arriba del la5 la segunda voz baja una octava (la tercera arriba se vuelve sexta abajo): deja libre
  // la franja de 1 a 4 kHz, que es la de los golpes y las voces
  return h > 81 ? h - 12 : h;
}

// ---------- la banda ----------

type Inst = 'flute' | 'flute2' | 'fiddle';

interface Kit {
  /** dB de toda la canción: así anda por el nivel de la de siempre. */
  trim: number;
  /** El pandero (la nota grave del parche) y el bombo grande. */
  drum: number;
  big: number;
  /** El bordón: tónica y quinta. */
  drone: [number, number];
  /** Qué tan brillante es el ataque del laúd (Hz del filtro en reposo). */
  luteTone: number;
}

const jit = () => (Math.random() - 0.5) * 0.006;
const vj = (v: number) => Math.min(1, v * (0.92 + Math.random() * 0.14));
/** La constante de tiempo con la que Tone hace sus curvas exponenciales de `time` s (así suena igual que antes). */
const tc = (time: number) => Math.log(time + 1) / Math.log(200);
const gainOf = (db: number) => Math.pow(10, db / 20);

/** El nivel de cada instrumento, en dB (los mismos con los que se calibró la mezcla). */
const LEVEL = { lute: -11, flute: -13, chiff: -34, fiddle: -9, drone: -26, drum: -15, tek: -18, slap: -33, tamb: -14, shake: -19, big: -15 };
/** Las sierras dobles o triples (como la FatOscillator de Tone): cada una más baja según cuántas son. */
const fat = (count: number) => gainOf(-6 - count * 1.1);

type Drum = 'doum' | 'tek' | 'tamb' | 'shake' | 'big';

/**
 * Los instrumentos, todos sintetizados y sin ondas cuadradas peladas: el laúd es una sierra doble con un
 * filtro que se cierra enseguida (la cuerda pulsada que pierde brillo), la flauta casi un seno con un
 * soplido al ataque, la viola una sierra doble con arco lento y vibrato, el bordón dos sierras gordas
 * detrás de un filtro que la tensión abre, y la percusión parches (un seno que cae de tono) y ruido filtrado.
 *
 * Están hechos con nodos de Web Audio pelados, no con los sintes de Tone: cada nota arma su oscilador, su
 * filtro y su volumen, y se apaga sola. Con los de Tone la canción gastaba ~40 % de un núcleo en vivo (cada
 * voz de Tone tiene media docena de señales andando todo el tiempo, toque o no); así no hay nada ocioso.
 */
class Band {
  private readonly ctx: BaseAudioContext;
  /** El reloj de Tone: en el render sin sonido es el que avanza (el del contexto crudo sigue en 0). */
  private readonly clock: { currentTime: number };
  private readonly tone: { dispose(): unknown }[] = [];
  private readonly wired: AudioNode[] = [];
  /** Lo que suena todo el tiempo (los vibratos, el bordón): se para al final. */
  private readonly running: AudioScheduledSourceNode[] = [];
  private readonly noise: AudioBuffer;
  private readonly fluteWave: PeriodicWave;
  private readonly lutePan: AudioNode;
  private readonly flutePan: AudioNode;
  private readonly chiffBand: AudioNode;
  private readonly fiddlePan: AudioNode;
  private readonly fluteVib: AudioNode;
  private readonly fiddleVib: AudioNode;
  private readonly drumOut: AudioNode;
  private readonly tekPan: AudioNode;
  private readonly slapBand: AudioNode;
  private readonly jingles: AudioNode;
  private readonly droneFilter: BiquadFilterNode;
  private readonly droneBus: GainNode;
  private drones: { oscs: OscillatorNode[]; env: GainNode; gain: GainNode; note: number }[] = [];
  /** Los golpes de este paso: cada tambor suena una vez (el más fuerte), aunque el ritmo y el redoble
   *  caigan juntos. */
  private readonly hits = new Map<Drum, { v: number; up: number }>();

  constructor(dest: Tone.InputNode, private readonly kit: Kit) {
    // el contexto de Tone (en el render sin sonido, el suyo): los nodos se crean con ese mismo
    const context = dest instanceof Tone.ToneAudioNode ? dest.context : Tone.getContext();
    const ctx = (this.ctx = context.rawContext as unknown as BaseAudioContext);
    this.clock = context;
    // la salida: un pozo suave en 2,5 kHz (ahí viven los golpes y las voces: la música les deja lugar) y un
    // pasa altos (lo de abajo de 40 Hz no se oye y le come lugar al limitador)
    const out = new Tone.Volume({ context, volume: kit.trim });
    const dip = new Tone.Filter({ context, type: 'peaking', frequency: 2500, Q: 0.7, gain: -6 });
    const hp = new Tone.Filter({ context, type: 'highpass', frequency: 40 });
    out.chain(dip, hp, dest);
    this.tone.push(out, dip, hp);
    const entry = this.wire(ctx.createGain());
    Tone.connect(entry as unknown as Tone.ToneAudioNode, out);
    const pan = (x: number) => {
      const p = this.wire(ctx.createStereoPanner());
      p.pan.value = x;
      p.connect(entry);
      return p;
    };
    const filter = (type: BiquadFilterType, frequency: number, Q: number, to: AudioNode) => {
      const f = this.wire(ctx.createBiquadFilter());
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = Q;
      f.connect(to);
      return f;
    };
    // un vibrato compartido: un seno lento que mueve la afinación (en cents) de cada nota que se le conecta
    const vibrato = (hz: number, cents: number) => {
      const lfo = this.wire(ctx.createOscillator());
      lfo.frequency.value = hz;
      const depth = this.wire(ctx.createGain());
      depth.gain.value = cents;
      lfo.connect(depth);
      lfo.start();
      this.running.push(lfo);
      return depth;
    };

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // la flauta: fundamental fuerte y armónicos impares flojos (eso la separa de un silbido)
    const partials = [1, 0.08, 0.13, 0.02, 0.03];
    this.fluteWave = ctx.createPeriodicWave(new Float32Array(partials.length + 1), Float32Array.from([0, ...partials]));

    this.lutePan = pan(-0.22);
    this.flutePan = pan(0.12);
    this.chiffBand = filter('bandpass', 2400, 0.9, this.flutePan);
    this.fluteVib = vibrato(5.2, 8.5);
    this.fiddlePan = pan(0.3);
    this.fiddleVib = vibrato(5.6, 12);
    this.drumOut = entry;
    this.tekPan = pan(-0.12);
    this.slapBand = filter('bandpass', 1500, 1.2, this.tekPan);
    // la pandereta: solo los cascabeles, arriba de 6,5 kHz (lejos de los golpes y las voces)
    this.jingles = filter('highpass', 6500, 0.7, pan(0.35));
    this.droneBus = this.wire(ctx.createGain());
    this.droneBus.connect(entry);
    this.droneFilter = filter('lowpass', 360, 0.6, this.droneBus);
  }

  private wire<T extends AudioNode>(n: T): T {
    this.wired.push(n);
    return n;
  }

  /** Un oscilador para una nota: arranca en `at`, se apaga en `end` y al terminar se desenchufa. */
  private osc(type: OscillatorType, hz: number, cents: number, at: number, end: number, to: AudioNode, vib?: AudioNode): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (type === 'custom') o.setPeriodicWave(this.fluteWave);
    else o.type = type;
    o.frequency.value = hz;
    o.detune.value = cents;
    if (vib) vib.connect(o.detune);
    o.connect(to);
    o.start(at);
    o.stop(end);
    o.onended = () => {
      o.disconnect();
      try {
        vib?.disconnect(o.detune);
      } catch { /* la banda ya se desarmó y el vibrato está desenchufado */ }
    };
    return o;
  }

  /** Un volumen con envolvente: sube en `attack`, cae hacia `sustain` y desde `off` se va a cero. */
  private amp(at: number, peak: number, attack: number, decay: number, sustain: number, off: number, release: number, to: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.setTargetAtTime(peak * sustain, at + attack, tc(decay));
    g.gain.setTargetAtTime(0, Math.max(off, at + attack), tc(release));
    g.connect(to);
    return g;
  }

  /** Dos pasa bajos en fila (24 dB por octava, como los filtros de -24 de Tone). */
  private lowpass24(Q: number, to: AudioNode): BiquadFilterNode[] {
    const second = this.ctx.createBiquadFilter();
    second.type = 'lowpass';
    second.Q.value = Q;
    second.connect(to);
    const first = this.ctx.createBiquadFilter();
    first.type = 'lowpass';
    first.Q.value = Q;
    first.connect(second);
    return [first, second];
  }

  pluck(m: number, t: number, v: number, len = 0.6): void {
    const at = t + jit();
    const g = this.amp(at, vj(v) * gainOf(LEVEL.lute) * fat(2), 0.002, 0.9, 0, at + len, 0.3, this.lutePan);
    // el filtro arranca abierto y se cierra en unas centésimas: la cuerda pulsada
    const filters = this.lowpass24(1.1, g);
    for (const f of filters) {
      f.frequency.setValueAtTime(this.kit.luteTone * 4.9, at);
      f.frequency.setTargetAtTime(this.kit.luteTone, at, 0.016);
    }
    // las cuerdas de a pares del laúd: dos sierras apenas desafinadas
    const end = at + Math.min(len + 0.5, 1.6);
    for (const c of [-3.5, 3.5]) this.osc('sawtooth', midi(m), c, at, end, filters[0]);
  }

  /** Un rasgueo: las cuerdas de abajo hacia arriba, cada una un poco después y más suave. */
  strum(ms: number[], t: number, v: number, len = 0.6, gap = 0.016): void {
    ms.forEach((m, j) => this.pluck(m, t + j * gap, v * (1 - j * 0.1), len));
  }

  play(inst: Inst, m: number, dur: number, t: number, v: number, cut: boolean, scale: number[]): void {
    if (inst === 'fiddle') {
      const g = this.amp(t, vj(v) * gainOf(LEVEL.fiddle) * fat(2), 0.07, 0.25, 0.8, t + dur, 0.3, this.fiddlePan);
      // el arco: el filtro se abre al apoyar y se asienta un poco más cerrado (deja pasar la fundamental
      // de las agudas, el la5 de 880 Hz)
      const filters = this.lowpass24(0.9, g);
      for (const f of filters) {
        f.frequency.setValueAtTime(650, t);
        f.frequency.linearRampToValueAtTime(1840, t + 0.09);
        f.frequency.setTargetAtTime(950, t + 0.09, 0.03);
      }
      for (const c of [-5, 5]) this.osc('sawtooth', midi(m), c, t, t + dur + 0.5, filters[0], this.fiddleVib);
      return;
    }
    // la flauta articula: corta un poco cada nota (lengüeteo); las largas casi enteras
    const len = dur > 0.5 ? dur - 0.06 : dur * 0.86;
    this.burst(t, v * 0.8 * gainOf(LEVEL.chiff), 0.004, 0.05, this.chiffBand);
    if (cut && len > 0.12) {
      this.flute(degree(m, scale, 1), t, 0.04, v * 0.8);
      this.flute(m, t + 0.045, len - 0.045, v);
    } else {
      this.flute(m, t, len, v);
    }
  }

  private flute(m: number, at: number, len: number, v: number): void {
    const g = this.amp(at, v * gainOf(LEVEL.flute), 0.03, 0.15, 0.82, at + len, 0.08, this.flutePan);
    this.osc('custom', midi(m), 0, at, at + len + 0.25, g, this.fluteVib);
  }

  /** Un golpe de ruido (el soplido, los cascabeles, el chasquido del dedo) por el filtro `to`. */
  private burst(at: number, peak: number, attack: number, decay: number, to: AudioNode): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const end = at + attack + decay * 2;
    const g = this.amp(at, peak, attack, decay, 0, end, 0.05, to);
    src.connect(g);
    src.start(at, Math.random() * 1.5);
    src.stop(end + 0.2);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }

  /** Un parche: un seno que arranca `octaves` veces más agudo y cae enseguida a su nota (como MembraneSynth). */
  private membrane(at: number, hz: number, peak: number, octaves: number, pitchDecay: number, decay: number, to: AudioNode): void {
    const g = this.amp(at, peak, 0.001, decay, 0, at + decay * 3, 0.1, to);
    const o = this.osc('sine', hz * octaves, 0, at, at + decay * 3 + 0.3, g);
    o.frequency.setValueAtTime(hz * octaves, at);
    o.frequency.exponentialRampToValueAtTime(hz, at + pitchDecay);
    o.addEventListener('ended', () => g.disconnect());
  }

  private hit(what: Drum, v: number, up = 0): void {
    const had = this.hits.get(what);
    if (!had || v > had.v) this.hits.set(what, { v, up });
  }

  /** El parche grave del pandero (`up`: semitonos más agudo). */
  doum(_t: number, v: number, up = 0): void {
    this.hit('doum', v, up);
  }

  /** Los dedos en el borde del pandero. */
  tek(_t: number, v: number): void {
    this.hit('tek', v);
  }

  tamb(_t: number, v: number): void {
    this.hit('tamb', v);
  }

  /** La pandereta sacudida: marca dónde empieza cada parte. */
  shake(_t: number, v: number): void {
    this.hit('shake', v);
  }

  big(_t: number, v: number, up = 0): void {
    this.hit('big', v, up);
  }

  /** Toca los golpes juntados en el paso. */
  flush(t: number): void {
    for (const [what, { v, up }] of this.hits) {
      const at = t + jit();
      const vel = vj(v);
      if (what === 'doum') this.membrane(at, midi(this.kit.drum + up), vel * gainOf(LEVEL.drum), 2.4, 0.035, 0.38, this.drumOut);
      if (what === 'big') this.membrane(at, midi(this.kit.big + up), vel * gainOf(LEVEL.big), 3.2, 0.07, 0.6, this.drumOut);
      if (what === 'tek') {
        this.membrane(at, midi(this.kit.drum + 26), vel * gainOf(LEVEL.tek), 1.6, 0.012, 0.09, this.tekPan);
        this.burst(at, vel * gainOf(LEVEL.slap), 0.001, 0.03, this.slapBand);
      }
      if (what === 'tamb') this.burst(at, vel * gainOf(LEVEL.tamb), 0.002, 0.085, this.jingles);
      if (what === 'shake') this.burst(t, vel * gainOf(LEVEL.shake), 0.06, 0.28, this.jingles);
    }
    this.hits.clear();
  }

  /** El bordón suena desde el primer paso hasta que la canción para: tres sierras por nota. */
  droneStart(t: number): void {
    if (this.drones.length) return;
    this.drones = this.kit.drone.map((note) => {
      const gain = this.wire(this.ctx.createGain());
      gain.connect(this.droneFilter);
      const env = this.wire(this.ctx.createGain());
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.9 * gainOf(LEVEL.drone) * fat(3), t + 1.5);
      env.connect(gain);
      const oscs = [-8, 0, 8].map((c) => {
        const o = this.wire(this.ctx.createOscillator());
        o.type = 'sawtooth';
        o.frequency.value = midi(note);
        o.detune.value = c;
        o.connect(env);
        o.start(t);
        this.running.push(o);
        return o;
      });
      return { oscs, env, gain, note };
    });
  }

  droneStop(t: number): void {
    for (const d of this.drones) {
      d.env.gain.setTargetAtTime(0, t, tc(2));
      for (const o of d.oscs) o.stop(t + 3);
    }
  }

  /** Cada acorde: la nota del bordón que queda a un semitono de alguna del acorde baja (como el gaitero
   *  que cierra un roncón), para que el bordón acompañe sin raspar. */
  droneFit(ch: Chord, t: number): void {
    for (const d of this.drones) {
      const clash = ch.pcs.some((c) => pcOf(c - d.note) === 1 || pcOf(d.note - c) === 1);
      d.gain.gain.setTargetAtTime(clash ? 0.18 : 1, t, 0.1);
    }
  }

  /** La tensión abre el filtro del bordón y lo sube un poco: se vuelve más gaita. */
  open(x: number): void {
    const now = this.clock.currentTime;
    this.droneFilter.frequency.setTargetAtTime(360 * Math.pow(2, x * 1.6), now, 0.4);
    this.droneBus.gain.setTargetAtTime(1 + x * 0.5, now, 0.4);
  }

  dispose(): void {
    for (const s of this.running) {
      try {
        s.stop();
      } catch { /* ya estaba parada */ }
    }
    for (const n of this.wired) n.disconnect();
    for (const n of this.tone) n.dispose();
  }
}

// ---------- el motor: secciones, melodías, bordón y tensión ----------

interface Part {
  inst: Inst;
  line: string;
  /** Semitonos (la viola una octava abajo: -12). */
  shift?: number;
  /** En vez de la melodía, su segunda voz: arriba (1) o abajo (-1). */
  harm?: 1 | -1;
  vel?: number;
  /** Entra recién con esta tensión (y se suma de a poco). */
  from?: number;
  /** Solo en las vueltas pares (0) o impares (1) de la forma. */
  cycle?: 0 | 1;
}

interface Section {
  /** Un acorde por compás; 'C.D' parte el compás en dos. */
  chords: string;
  parts: Part[];
  /** Cómo acompaña el laúd (cada canción tiene los suyos). */
  lute: string;
  /** La percusión de base: -1 nada, 0 apenas, 1 normal, 2 llena, 3 la de guerra. */
  drums: number;
  /** Los primeros compases sin percusión (la intro). */
  drumsFrom?: number;
}

interface Compiled extends Section {
  bars: number;
  harmony: [Chord, Chord][];
  events: { part: Part; at: Map<number, Ev> }[];
}

/** Lo que le llega a cada canción en cada paso, para tocar el laúd y la percusión. */
interface Ctx {
  t: number;
  /** El paso adentro del compás y el compás adentro de la sección. */
  s: number;
  bar: number;
  sec: Compiled;
  ch: Chord;
  /** La tensión, de 0 a 1. */
  x: number;
  /** El último compás de cada frase de 8: va un redoble. */
  fill: boolean;
  /** La percusión de este compás (-1 mientras la intro no la deja entrar). */
  drums: number;
}

interface Spec {
  step: number;
  bar: number;
  /** La duración de una nota que no dice la suya, en pasos. */
  dflt: number;
  scale: number[];
  kit: Kit;
  form: Section[];
  /** A qué sección vuelve al terminar (la intro no se repite). */
  loopFrom: number;
  play(b: Band, c: Ctx): void;
}

function compile(spec: Spec): Compiled[] {
  return spec.form.map((sec) => {
    const tokens = sec.chords.trim().split(/\s+/);
    const harmony = tokens.map((tk) => {
      const [a, b] = tk.split('.');
      const first = chord(a);
      return [first, b ? chord(b) : first] as [Chord, Chord];
    });
    const events = sec.parts.map((part) => {
      const { ev, steps } = line(part.line, spec.bar, spec.dflt);
      if (steps !== tokens.length * spec.bar) throw new Error(`«${part.line.slice(0, 24)}…» dura ${steps / spec.bar} compases y la sección ${tokens.length}`);
      return { part, at: new Map(ev.map((e) => [e.at, e])) };
    });
    return { ...sec, bars: tokens.length, harmony, events };
  });
}

function build(spec: Spec, out: Tone.InputNode, transport: ReturnType<typeof Tone.getTransport>): Song {
  const form = compile(spec);
  const band = new Band(out, spec.kit);
  let id = -1;
  const once: number[] = [];
  let x = 0;
  let sec = 0;
  let k = 0;
  let cycle = 0;

  const tick = (t: number) => {
    const S = form[sec];
    const bar = Math.floor(k / spec.bar);
    const s = k % spec.bar;
    const half = s < spec.bar / 2 ? 0 : 1;
    const ch = S.harmony[bar][half];
    band.droneStart(t);
    if (s === 0 || (s === spec.bar / 2 && S.harmony[bar][0] !== S.harmony[bar][1])) band.droneFit(ch, t);
    const scale = scaleFor(spec.scale, ch);
    for (const { part, at } of S.events) {
      if (part.cycle !== undefined && part.cycle !== cycle % 2) continue;
      const amt = part.from === undefined ? 1 : ramp(x, part.from);
      const e = at.get(k);
      if (!e || amt <= 0.02) continue;
      let m = e.note + (part.shift ?? 0);
      if (part.harm) m = harmonize(m, ch, scale, part.harm);
      band.play(part.inst, m, e.len * spec.step, t, (part.vel ?? 0.8) * amt, e.cut && !part.harm, scale);
    }
    const drums = bar < (S.drumsFrom ?? 0) ? -1 : S.drums;
    spec.play(band, { t, s, bar, sec: S, ch, x, fill: bar % 8 === 7, drums });
    band.flush(t);
    if (++k >= S.bars * spec.bar) {
      k = 0;
      if (++sec >= form.length) {
        sec = spec.loopFrom;
        cycle++;
      }
    }
  };

  return {
    start(time) {
      id = transport.scheduleRepeat(tick, spec.step, time);
    },
    stop(time) {
      // sigue tocando hasta `time` (el fundido), después calla y suelta el bordón
      once.push(transport.scheduleOnce((t) => {
        transport.clear(id);
        id = -1;
        band.droneStop(t);
      }, time));
    },
    intensity(level) {
      x = Math.max(0, Math.min(1, level));
      band.open(x);
    },
    dispose() {
      transport.clear(id);
      for (const o of once) transport.clear(o);
      band.dispose();
    },
  };
}

// ---------- 1: la feria (sol mayor, 6/8) ----------
// Una giga de feria: la flauta canta el tema A, la viola el B (más largo, para respirar), y en el puente
// queda el laúd solo con el bordón. El acompañamiento es el «bum-chic» de las gigas.

const FERIA_A = `
  G4:2 B4 D5:2 B4 | B4 A4 G4 D5:2 B4 | C5:2 E5 G5:2 E5 | F#5 E5 D5 A4:3 |
  G4:2 B4 D5:2 B4 | E5 F#5 G5 B4:2 E5 | E5:2 C5 D5 C5 A4 | B4:2 A4 G4:3 |
  ~G4:2 B4 D5:2 B4 | B4 A4 G4 D5:2 G5 | G5:2 E5 C5:2 E5 | D5 E5 F#5 ~A5:3 |
  G5 F#5 E5 B4:2 E5 | G5 F#5 E5 C5:2 E5 | ~F#5:2 E5 D5:2 C5 | B4:2 A4 G4:3`;
const FERIA_A_CHORDS = 'G G C D G Em C.D G G G C D Em C D G';

const FERIA_B = `
  E5:3 B4:2 E5 | G5:2 F#5 E5:2 D5 | C5:2 D5 E5:2 G5 | D5:5 B4 |
  C5:3 A4:2 C5 | E5:2 D5 C5:2 B4 | A4:2 D5 F#5:2 E5 | D5:4 -:1 B4 |
  E5:3 B4:2 E5 | G5:2 F#5 E5:2 D5 | C5:2 D5 E5:2 G5 | D5:2 B4 G4:3 |
  F5:3 C5:2 F5 | E5:2 D5 C5:2 E5 | D5:2 E5 F#5:2 A5 | A5 F#5 D5 A4 B4 C5`;
/** El fa natural del compás 13 es el toque mixolidio: suena a gaita vieja. */
const FERIA_B_CHORDS = 'Em Em C G Am Am D D Em Em C G F C D D';
/** La flauta le contesta a la viola cuando ella sostiene. */
const FERIA_B_ANSWER = `
  -:6 | -:6 | -:6 | -:3 B4 C5 D5 |
  -:6 | -:6 | -:6 | -:2 A5 F#5 D5 - |
  -:6 | -:6 | -:6 | -:3 B4 D5 G5 |
  A5:3 F5:3 | G5:3 E5:3 | F#5:3 A5:3 | -:6`;

const FERIA_BRIDGE = '-:6 | -:6 | D5:3 B4:3 | A4:6 | B4:3 E5:3 | G5:3 E5:3 | F#5:6 | A5:3 -:3';
const FERIA_BRIDGE_LOW = 'B3:6 | C4:6 | D4:6 | D4:6 | E4:6 | E4:6 | D4:6 | D4:6';
const FERIA_BRIDGE_CHORDS = 'Em C G D Em C D D';

const FERIA: Spec = {
  step: FERIA_STEP,
  bar: 6,
  dflt: 1,
  scale: G_MAJOR,
  kit: { trim: -6.5, drum: 43, big: 31, drone: [43, 50], luteTone: 340 },
  loopFrom: 1,
  form: [
    { chords: 'G G C D', parts: [], lute: 'arp', drums: 0 },
    {
      chords: FERIA_A_CHORDS, lute: 'vamp', drums: 1, parts: [
        // la primera vuelta canta la flauta; la segunda, la viola (y la flauta le hace la segunda voz)
        { inst: 'flute', line: FERIA_A, cycle: 0 },
        { inst: 'fiddle', line: FERIA_A, harm: -1, vel: 0.16, from: 0.35, cycle: 0 },
        { inst: 'fiddle', line: FERIA_A, vel: 0.95, cycle: 1 },
        { inst: 'flute2', line: FERIA_A, harm: 1, vel: 0.45, from: 0.35, cycle: 1 },
      ],
    },
    {
      chords: FERIA_B_CHORDS, lute: 'strum', drums: 1, parts: [
        { inst: 'fiddle', line: FERIA_B, vel: 1 },
        { inst: 'flute', line: FERIA_B_ANSWER, vel: 0.65 },
      ],
    },
    {
      chords: FERIA_A_CHORDS, lute: 'vamp', drums: 2, parts: [
        { inst: 'flute', line: FERIA_A },
        { inst: 'fiddle', line: FERIA_A, harm: -1, vel: 0.16 },
      ],
    },
    {
      chords: FERIA_BRIDGE_CHORDS, lute: 'arp', drums: 0, parts: [
        { inst: 'flute', line: FERIA_BRIDGE, vel: 0.7 },
        { inst: 'fiddle', line: FERIA_BRIDGE_LOW, vel: 0.14 },
      ],
    },
    {
      chords: FERIA_B_CHORDS, lute: 'strum', drums: 2, parts: [
        { inst: 'fiddle', line: FERIA_B, vel: 1 },
        { inst: 'flute2', line: FERIA_B, harm: 1, vel: 0.5 },
      ],
    },
    {
      chords: FERIA_A_CHORDS, lute: 'vamp', drums: 2, parts: [
        // todos juntos: la flauta arriba y la viola el mismo tema una octava abajo
        { inst: 'flute', line: FERIA_A },
        { inst: 'fiddle', line: FERIA_A, shift: -12, vel: 0.2 },
      ],
    },
  ],
  play(b, { t, s, bar, sec, ch, x, fill, drums }) {
    const r = bassOf(ch, 40);
    const mid = upper(ch, 55);
    if (sec.lute === 'arp') {
      // arpegio de punta a punta: raíz, quinta, octava, décima
      const arp = [r, r + 7, r + 12, r + 12 + ch.third, r + 12, r + 7];
      b.pluck(arp[s], t, s === 0 ? 0.75 : 0.5, 0.7);
    } else if (sec.lute === 'vamp') {
      if (s === 0) b.pluck(r, t, 0.8, 0.5);
      if (s === 3) b.pluck(r + 7 > 52 ? r - 5 : r + 7, t, 0.6, 0.4);
      if (s === 2 || s === 5) b.strum(mid.slice(1), t, 0.4, 0.25, 0.01);
      const more = ramp(x, 0.55);
      if (more > 0 && (s === 1 || s === 4)) b.strum(mid.slice(1), t, 0.25 * more, 0.18, 0.01);
    } else {
      // rasgueos en las dos negras con puntillo: el B respira
      if (s === 0) b.pluck(r, t, 0.8, 0.9);
      if (s === 3) b.pluck(r + 7 > 52 ? r - 5 : r + 7, t, 0.55, 0.6);
      if (s === 0 || s === 3) b.strum(mid, t, s === 0 ? 0.55 : 0.45, 0.9);
      if (s === 5 && ramp(x, 0.55) > 0) b.pluck(mid[2], t, 0.3 * ramp(x, 0.55), 0.2);
    }
    if (drums < 0) return;
    // el pandero: bum en el 1 y en el 4 de la giga; los dedos rellenan las corcheas
    if (s === 0) b.doum(t, drums === 0 ? 0.55 : 0.9);
    if (drums >= 1 && s === 3) b.doum(t, 0.55, 5);
    if (drums >= 1 && s === 5) b.tek(t, 0.4);
    if (drums >= 2 && s === 2) b.tek(t, 0.3);
    const roll = ramp(x, 0.3);
    if (drums >= 1 && roll > 0 && (s === 1 || s === 4)) b.tek(t, 0.22 * roll);
    if (drums >= 1 && s === 3) b.tamb(t, 0.5);
    if (drums >= 2 && (s === 0 || s === 5)) b.tamb(t, 0.3);
    const jingle = ramp(x, 0.5);
    if (drums >= 1 && jingle > 0 && (s === 1 || s === 2 || s === 4)) b.tamb(t, 0.2 * jingle);
    if (drums >= 1 && bar === 0 && s === 0) b.shake(t, 0.6);
    const boom = ramp(x, 0.7);
    if (drums >= 1 && boom > 0 && s === 0 && bar % 2 === 0) b.big(t, 0.5 * boom);
    // el redoble al final de cada frase de 8: los dedos en crescendo y la pandereta sacudida
    if (fill && drums >= 1 && s >= 3) {
      b.tek(t, 0.25 + (s - 3) * 0.15);
      if (s === 5) b.shake(t, 0.5);
    }
  },
};

// ---------- 2: la marcha (la menor, frigio, 4/4) ----------
// Más seria y con empuje: el laúd marca 3+3+2 (el tresillo de las danzas viejas) sobre una pedal, la viola
// canta el A, la flauta el B, y el puente se queda en el la con el si bemol frigio al lado.

const MARCHA_A = `
  A4:4 C5 E5:6 D5 C5 | C5:4 B4 A4 E4:8 | D5:4 B4 G4 B4:4 D5:4 | E5:4 D5 C5 A4:8 |
  F5:4 E5 C5 A4:4 C5:4 | D5:4 B4 D5 G5:4 F5 D5 | E5:6 C5 A4:4 B4 C5 | A4:12 -:4 |
  ~A4:4 C5 E5:6 D5 C5 | C5:4 B4 A4 E4:8 | D5:4 B4 G4 B4:4 D5:4 | E5:4 G5:4 A5:8 |
  F5:4 E5 D5 A4:4 D5:4 | D5:4 F5 D5 Bb4:8 | C5:6 Bb4 A4:8 | A4:12 -:4`;
const MARCHA_A_CHORDS = 'Am Am G Am F G Am Am Am Am G Am Dm Bb Am Am';

const MARCHA_B = `
  G5:6 E5 C5:4 E5:4 | D5:6 B4 G4:4 D5:4 | E5:4 F5 E5 C5:4 A4:4 | ~E5:12 -:4 |
  F5:6 A5 F5:4 D5:4 | E5:6 C5 A4:4 C5:4 | B4:6 G#4 E4:4 G#4:4 | ~B4:12 -:4 |
  G5:6 E5 C5:4 E5:4 | D5:6 B4 G4:4 D5:4 | E5:4 F5 E5 C5:4 A4:4 | A5:6 G5 F5:4 C5:4 |
  D5:6 F5 A5:4 F5:4 | F5:6 D5 Bb4:8 | G#4:4 B4:4 E5:4 D5:4 | B4:4 C5 D5 E5:4 G#4:4`;
const MARCHA_B_CHORDS = 'C G Am Am Dm Am E E C G Am F Dm Bb E E';
/** La viola sostiene debajo de la flauta: notas largas del acorde. */
const MARCHA_B_LOW = `
  E4:16 | D4:16 | C4:16 | E4:8 C4:8 | D4:16 | C4:16 | B3:16 | G#3:8 B3:8 |
  E4:16 | D4:16 | C4:16 | C4:16 | D4:16 | D4:16 | B3:16 | E4:8 D4:8`;

const MARCHA_BRIDGE = 'E5:12 D5 C5 | D5:16 | C5:8 E5:8 | F5:12 D5:4 | E5:16 | D5:8 F5:8 | E5:8 C5:4 A4:4 | B4:8 G#4:8';
const MARCHA_BRIDGE_CHORDS = 'Am Bb Am Bb Am Bb Am E';

const MARCHA: Spec = {
  step: MARCHA_STEP,
  bar: 16,
  dflt: 2,
  scale: A_MINOR,
  kit: { trim: -6.5, drum: 45, big: 33, drone: [45, 52], luteTone: 300 },
  loopFrom: 1,
  form: [
    { chords: 'Am Am G Am', parts: [], lute: 'drive', drums: 1, drumsFrom: 1 },
    {
      chords: MARCHA_A_CHORDS, lute: 'drive', drums: 1, parts: [
        { inst: 'fiddle', line: MARCHA_A, vel: 1 },
        { inst: 'flute2', line: MARCHA_A, harm: -1, vel: 0.5, from: 0.4 },
      ],
    },
    {
      chords: MARCHA_B_CHORDS, lute: 'strum', drums: 1, parts: [
        { inst: 'flute', line: MARCHA_B },
        { inst: 'fiddle', line: MARCHA_B_LOW, vel: 0.16 },
      ],
    },
    {
      chords: MARCHA_A_CHORDS, lute: 'drive', drums: 2, parts: [
        // la flauta toma el tema y la viola lo dobla una octava abajo
        { inst: 'flute', line: MARCHA_A },
        { inst: 'fiddle', line: MARCHA_A, shift: -12, vel: 0.2 },
      ],
    },
    {
      chords: MARCHA_BRIDGE_CHORDS, lute: 'arp', drums: 0, parts: [
        { inst: 'fiddle', line: MARCHA_BRIDGE, vel: 0.95 },
        { inst: 'flute2', line: MARCHA_BRIDGE, harm: -1, vel: 0.45, from: 0.5 },
      ],
    },
    {
      chords: MARCHA_B_CHORDS, lute: 'drive', drums: 2, parts: [
        { inst: 'flute', line: MARCHA_B },
        { inst: 'fiddle', line: MARCHA_B, harm: -1, vel: 0.16 },
      ],
    },
    {
      chords: MARCHA_A_CHORDS, lute: 'drive', drums: 2, parts: [
        { inst: 'fiddle', line: MARCHA_A, vel: 1 },
        { inst: 'flute2', line: MARCHA_A, harm: -1, vel: 0.5 },
      ],
    },
  ],
  play(b, { t, s, bar, sec, ch, x, fill, drums }) {
    const r = bassOf(ch, 40);
    const up = upper(ch, 57);
    if (sec.lute === 'drive') {
      // bajo en 3+3+2 y las cuerdas de arriba en corcheas
      if (s === 0) b.pluck(r, t, 0.85, 0.5);
      if (s === 6) b.pluck(r, t, 0.65, 0.4);
      if (s === 12) b.pluck(r + 12, t, 0.65, 0.35);
      const which: Record<number, number> = { 2: 0, 4: 1, 8: 2, 10: 1, 14: 0 };
      if (s in which) b.pluck(up[which[s]], t, 0.38, 0.3);
      const push = ramp(x, 0.55);
      if (push > 0 && (s === 7 || s === 15)) b.pluck(up[2], t, 0.25 * push, 0.15);
    } else if (sec.lute === 'strum') {
      if (s === 0) b.pluck(r, t, 0.8, 0.8);
      if (s === 0 || s === 6 || s === 12) b.strum(up, t, s === 0 ? 0.5 : 0.36, 0.5);
    } else {
      // el puente: arpegio que sube y baja dos octavas, en corcheas
      const arp = [r, r + 7, r + 12, r + 12 + ch.third, r + 19, r + 12 + ch.third, r + 12, r + 7];
      if (s % 2 === 0) b.pluck(arp[s / 2], t, s === 0 ? 0.7 : 0.45, 0.6);
    }
    if (drums < 0) return;
    if (drums === 0) {
      // el puente: el pandero apenas, para que se oiga la viola
      if (s === 0) b.doum(t, 0.7);
      if (s === 10) b.doum(t, 0.4);
      if (s === 12) b.tek(t, 0.3);
      return;
    }
    if (s === 0) b.doum(t, 0.9);
    if (s === 6) b.doum(t, 0.6);
    if (drums >= 2 && s === 10) b.doum(t, 0.45, 5);
    if (s === 4 || s === 12) b.tek(t, s === 4 ? 0.5 : 0.55);
    if (drums >= 2 && s === 14) b.tek(t, 0.25);
    const ghost = ramp(x, 0.3);
    if (ghost > 0 && (s === 2 || s === 10)) b.tek(t, 0.2 * ghost);
    if (s === 4 || s === 12) b.tamb(t, 0.45);
    if (drums >= 2 && s % 2 === 0 && s !== 4 && s !== 12) b.tamb(t, 0.22);
    const sixteenths = ramp(x, 0.5);
    if (sixteenths > 0 && s % 2 === 1) b.tamb(t, 0.14 * sixteenths);
    if (drums >= 2 && s === 0) b.big(t, 0.5);
    const boom = ramp(x, 0.65);
    if (boom > 0 && s === 8) b.big(t, 0.5 * boom);
    if (bar === 0 && s === 0) b.shake(t, 0.6);
    if (fill && s >= 8) {
      b.tek(t, 0.2 + (s - 8) * 0.05);
      if (s === 12 || s === 14) b.doum(t, 0.6, 3);
      if (s === 14) b.shake(t, 0.45);
    }
  },
};

// ---------- 3: el asedio (re menor, 4/4, al galope) ----------
// Lo mismo pero urgente: el laúd galopa (corchea y dos semicorcheas), entra el bombo grande, y el puente
// es de tambores de guerra con el bordón grave y la viola en notas largas.

const ASEDIO_A = `
  D5:4 A4:4 D5 E5 F5:4 | F5:4 E5 D5 A4:8 | G5:4 E5 C5 E5:4 G5:4 | F5:6 E5 D5:8 |
  D5:4 F5 D5 Bb4:8 | C5:4 E5 G5 E5:4 C5:4 | D5:4 F5 E5 D5:4 A4:4 | E5:8 A4:4 C#5:4 |
  D5:4 A4:4 D5 E5 F5:4 | F5:4 E5 D5 A4:8 | G5:4 E5 C5 E5:4 G5:4 | F5:4 G5:4 ~A5:8 |
  F5:4 D5 Bb4 D5:8 | G5:4 F5 D5 Bb4:4 G4:4 | A4:4 C#5:4 E5:4 G5:4 | F5:4 E5 C#5 D5:8`;
const ASEDIO_A_CHORDS = 'Dm Dm C Dm Bb C Dm A Dm Dm C Dm Bb Gm A Dm';

/** El B va en 3+3+2, a contrapié del galope: eso lo apura. Pocos do# largos: la reverb del juego (el
 *  Freeverb) resuena justo en el do#5 (554 Hz) y una nota larga ahí suena 10 dB más fuerte a la derecha. */
const ASEDIO_B = `
  Bb4:6 D5:6 G5:4 | F5:6 D5:6 Bb4:4 | A4:6 D5:6 F5:4 | E5:6 F5 D5:8 |
  D5:6 F5:6 D5:4 | E5:6 G5:6 E5:4 | A4:6 E5:6 A5:4 | G5:4 F5:4 E5:4 C#5:4 |
  Bb4:6 D5:6 G5:4 | F5:6 D5:6 Bb4:4 | A4:6 D5:6 F5:4 | E5:6 F5 D5:8 |
  F5:6 D5:6 Bb4:4 | G5:6 E5:6 C5:4 | E5:6 G5:6 E5:4 | A4:4 C#5:4 E5:4 G5:4`;
const ASEDIO_B_CHORDS = 'Gm Gm Dm Dm Bb C A A Gm Gm Dm Dm Bb C A A';

const ASEDIO_BRIDGE = 'D5:16 | F5:8 E5:8 | D5:16 | Bb4:16 | G4:8 Bb4:8 | D5:16 | A4:16 | E5:8 A4:8';
const ASEDIO_BRIDGE_CHORDS = 'Dm Dm Bb Bb Gm Gm A A';

const ASEDIO: Spec = {
  step: ASEDIO_STEP,
  bar: 16,
  dflt: 2,
  scale: D_MINOR,
  kit: { trim: -6.5, drum: 41, big: 31, drone: [38, 45], luteTone: 280 },
  loopFrom: 1,
  form: [
    { chords: 'Dm Dm Dm A', parts: [], lute: 'gallop', drums: 0 },
    {
      chords: ASEDIO_A_CHORDS, lute: 'gallop', drums: 1, parts: [
        { inst: 'fiddle', line: ASEDIO_A, vel: 1 },
        { inst: 'flute2', line: ASEDIO_A, harm: -1, vel: 0.5, from: 0.4 },
      ],
    },
    {
      chords: ASEDIO_B_CHORDS, lute: 'gallop', drums: 2, parts: [
        { inst: 'flute', line: ASEDIO_B },
        { inst: 'fiddle', line: ASEDIO_B, harm: -1, vel: 0.16 },
      ],
    },
    {
      chords: ASEDIO_A_CHORDS, lute: 'gallop', drums: 2, parts: [
        { inst: 'flute', line: ASEDIO_A },
        { inst: 'fiddle', line: ASEDIO_A, shift: -12, vel: 0.2 },
      ],
    },
    {
      chords: ASEDIO_BRIDGE_CHORDS, lute: 'stab', drums: 3, parts: [
        { inst: 'fiddle', line: ASEDIO_BRIDGE, vel: 0.95 },
        { inst: 'flute2', line: ASEDIO_BRIDGE, harm: -1, vel: 0.45, from: 0.5 },
      ],
    },
    {
      chords: ASEDIO_B_CHORDS, lute: 'gallop', drums: 2, parts: [
        { inst: 'flute', line: ASEDIO_B },
        { inst: 'fiddle', line: ASEDIO_B, shift: -12, vel: 0.2 },
        { inst: 'flute2', line: ASEDIO_B, harm: -1, vel: 0.45, from: 0.4 },
      ],
    },
    {
      chords: ASEDIO_A_CHORDS, lute: 'gallop', drums: 2, parts: [
        { inst: 'fiddle', line: ASEDIO_A, vel: 1 },
        { inst: 'flute2', line: ASEDIO_A, harm: -1, vel: 0.5 },
      ],
    },
  ],
  play(b, { t, s, bar, sec, ch, x, fill, drums }) {
    const r = bassOf(ch, 38);
    const g = bassOf(ch, 50);
    // los rasgueos abajo de la melodía (si suben a re4 doblan las notas largas de la flauta)
    const up = upper(ch, 55);
    const beat = s % 4;
    if (sec.lute === 'gallop') {
      // el galope: corchea y dos semicorcheas en cada negra, y el bajo en el 1 y el 3
      if (beat === 0) b.pluck(g, t, 0.6, 0.25);
      if (beat === 2 || beat === 3) b.pluck(g, t, 0.36, 0.15);
      if (s === 0) b.pluck(r, t, 0.8, 0.7);
      if (s === 8) b.pluck(r, t, 0.6, 0.5);
      if (s === 4 || s === 12) b.strum(up, t, 0.32, 0.14, 0.008);
    } else if (s === 0 || s === 8) {
      if (s === 0) b.pluck(r, t, 0.85, 1.2);
      b.strum([g, ...up], t, s === 0 ? 0.55 : 0.4, 1);
    }
    if (drums === 0) {
      // la intro: el bombo como un corazón, y el pandero recién al final
      if (s === 0 || s === 3) b.big(t, s === 0 ? 0.8 : 0.45);
      if (bar >= 2 && (s === 4 || s === 12)) b.tek(t, 0.45);
      if (bar === 3 && s >= 8) b.tek(t, 0.2 + (s - 8) * 0.05);
      return;
    }
    if (drums === 3) {
      // los tambores de guerra: el bombo grande en 3+3+2 dos veces, sin pandereta
      const war: Record<number, number> = { 0: 1, 3: 0.5, 6: 0.7, 8: 0.85, 11: 0.5, 14: 0.6 };
      if (s in war) b.big(t, war[s]);
      if (s === 4 || s === 12) b.doum(t, 0.6, 5);
      if (bar === 0 && s === 0) b.shake(t, 0.7);
      if (fill && s >= 12) b.tek(t, 0.3 + (s - 12) * 0.1);
      return;
    }
    if (s === 0) b.big(t, 0.9);
    if (s === 8) b.big(t, 0.6);
    if (drums >= 2 && s === 6) b.big(t, 0.4);
    if (s === 10) b.doum(t, 0.5);
    if (drums >= 2 && s === 14) b.doum(t, 0.4, 5);
    if (s === 4 || s === 12) b.tek(t, s === 4 ? 0.55 : 0.6);
    if (drums >= 2 && (s === 7 || s === 15)) b.tek(t, 0.25);
    const gallop = ramp(x, 0.3);
    if ((drums >= 2 || gallop > 0) && (s === 2 || s === 3 || s === 10 || s === 11)) b.tek(t, 0.18 * (drums >= 2 ? 1 : gallop));
    if (s % 2 === 0) b.tamb(t, s === 4 || s === 12 ? 0.4 : 0.24);
    const sixteenths = ramp(x, 0.4);
    if (sixteenths > 0 && s % 2 === 1) b.tamb(t, 0.15 * sixteenths);
    const boom = ramp(x, 0.6);
    if (boom > 0 && (s === 10 || s === 14)) b.big(t, 0.5 * boom);
    const pound = ramp(x, 0.8);
    if (pound > 0 && s % 2 === 0 && s !== 0 && s !== 8) b.doum(t, 0.3 * pound);
    if (bar === 0 && s === 0) b.shake(t, 0.6);
    if (fill && s >= 8) {
      b.tek(t, 0.2 + (s - 8) * 0.05);
      if (s === 12 || s === 14) b.big(t, 0.7);
    }
  },
};

// se arman acá también, al cargar el archivo: si un compás no suma, el panel lo muestra en vez de sonar mal
for (const spec of [FERIA, MARCHA, ASEDIO]) compile(spec);

export const SONGS: SongDef[] = [
  {
    id: 'folk.feria',
    name: 'Folk: la feria', // i18n-ok: el panel de pruebas
    role: 'escenario1',
    blurb: 'Giga en sol mayor (6/8, 116): laúd, flauta dulce, viola, bordón, pandero y pandereta. Con tensión se suman los dedos en el pandero, la segunda voz y el bombo.', // i18n-ok: el panel de pruebas
    build: (out, transport) => build(FERIA, out, transport),
  },
  {
    id: 'folk.marcha',
    name: 'Folk: la marcha', // i18n-ok: el panel de pruebas
    role: 'escenario2',
    blurb: 'La menor con toques frigios (4/4, 126): el laúd en 3+3+2 sobre la pedal, la viola y la flauta se pasan el tema. Con tensión, semicorcheas y bombo.', // i18n-ok: el panel de pruebas
    build: (out, transport) => build(MARCHA, out, transport),
  },
  {
    id: 'folk.asedio',
    name: 'Folk: el asedio', // i18n-ok: el panel de pruebas
    role: 'escenario3',
    blurb: 'Re menor al galope (4/4, 136): bombo grande, laúd galopando, bordón grave y un puente de tambores de guerra. Con tensión, más bombo y pandereta.', // i18n-ok: el panel de pruebas
    build: (out, transport) => build(ASEDIO, out, transport),
  },
];
