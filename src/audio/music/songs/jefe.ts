// La música del jefe (15/10): la pelea final, lo más grande que suena en el juego. Tres versiones para
// elegir en musica.html:
// - requiem:  «Réquiem para un golfista». Coro, órgano, timbales y campanas en re menor, a 80. Los bajos
//             citan el Dies irae (es un réquiem, con guiño) y el clímax termina en re mayor.
// - batalla:  batalla en 7/8 (2+2+3), do menor: taikos, cuerdas en ostinato, metales y gritos del coro. El
//             clímax sube un tono, a re menor.
// - tambores: «Tambores de guerra»: un bombo en cada pulso que se apura de 90 a 150 en 3 minutos, con un
//             canto de guerra en sol dórico que crece hasta el tutti. Para un jefe de ritmo: pulsoTambores()
//             dice cuándo cae cada golpe.
// Las tres entran con el fundido de 2,5 s: el golpe fuerte va al final de un compás que crece, no en el cero
// (no se oiría). La forma corre sola (intro, A, B, clímax, y vuelve) y la tensión (`intensity`) suma capas
// cada dos compases, así nada entra a mitad de frase. Ver docs/musica/jefe.md.
import * as Tone from 'tone';
import type { Song, SongDef } from '../types';

// ---------- tempo y tonalidad ----------
/** Réquiem: semicorchea a 80 por minuto (el compás son 3 s). Re menor. */
const REQ_PASO = 60 / 80 / 4;
/** Batalla: semicorchea de 0.1 s; el compás de 7/8 son 14 (1.4 s), agrupadas 4+4+6. Do menor. */
const BAT_PASO = 0.1;
const BAT_COMPAS = 14;
/** Tambores: de 90 a 150 golpes por minuto en 3 minutos, y ahí se queda. Sol dórico. */
export const TAMBORES_BPM = { desde: 90, hasta: 150, rampa: 180 } as const;

type Transport = ReturnType<typeof Tone.getTransport>;
type Dest = Tone.InputNode;
/** Una nota de una melodía: altura MIDI (null = silencio) y largo (en la unidad de la melodía). */
type Nota = readonly [number | null, number];

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const hzs = (ms: readonly number[]) => ms.map(hz);

/**
 * Para revisar la mezcla sin escucharla (scripts en logs/, nunca el juego): los grupos nombrados en `callar`
 * suenan callados, y `compas` hace arrancar la canción en ese compás (para oír el clímax sin esperar 2 min).
 */
export const PRUEBA = { callar: [] as string[], compas: 0 };

/** Azar con semilla: la misma canción suena igual en cada render (se pueden comparar). */
function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- lo común: mezcla, reloj, forma ----------

/**
 * Una sala grande para convolución: ruido que se apaga en `rt60` s y se oscurece al apagarse (las paredes se
 * comen los agudos). Se calcula acá, en unos milisegundos, en vez de bajar un archivo.
 */
function salaIR(ctx: Tone.BaseContext, rt60: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const pre = Math.floor(0.025 * sr);
  const n = pre + Math.floor(sr * rt60 * 1.1);
  const buf = ctx.createBuffer(2, n, sr);
  const rnd = azar(3);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      // filtro de un polo que se va cerrando: brillante al principio, oscuro en la cola
      lp += (0.55 * Math.exp(-t / 0.9) + 0.06) * (rnd() * 2 - 1 - lp);
      d[i] = lp * Math.pow(10, (-3 * t) / rt60);
    }
  }
  return buf;
}

/** Junta todo lo que arma una canción (para soltarlo junto) y arma los grupos de la mezcla. */
class Kit {
  private readonly bolsa: { dispose(): unknown }[] = [];
  private sala: Tone.Convolver | null = null;
  private readonly out: Tone.Gain;

  /** `db`: el volumen de toda la canción; `rt60`: cuánto dura la cola de la sala. */
  constructor(out: Dest, private readonly ctx: Tone.BaseContext, db: number, private readonly rt60: number) {
    this.out = this.keep(new Tone.Gain(Tone.dbToGain(db))).connect(out);
  }

  keep<T extends { dispose(): unknown }>(node: T): T {
    this.bolsa.push(node);
    return node;
  }

  /**
   * Un grupo (coro, metales...) con su volumen y cuánto manda a la sala: una reverb larga aparte de la del
   * juego (que es corta), para que el coro y los metales suenen en una catedral y los tambores no se borroneen.
   * Es una convolución (nativa del navegador): un Freeverb más costaba más CPU que todo lo demás junto.
   */
  grupo(nombre: string, db: number, sala: number): Tone.Gain {
    const g = this.keep(new Tone.Gain(PRUEBA.callar.includes(nombre) ? 0 : Tone.dbToGain(db))).connect(this.out);
    if (sala > 0) {
      this.sala ??= this.keep(new Tone.Convolver(salaIR(this.ctx, this.rt60))).connect(this.out);
      g.connect(this.keep(new Tone.Gain(sala)).connect(this.sala));
    }
    return g;
  }

  /** El conjunto del coro: un vibrato y un chorus para todas sus voces (uno por canción, no uno por coro). */
  conjunto(dest: Dest): Tone.Gain {
    const chorus = this.keep(new Tone.Chorus({ frequency: 0.5, delayTime: 4, depth: 0.4, spread: 140, wet: 0.5 })).connect(dest);
    chorus.start();
    const vibrato = this.keep(new Tone.Vibrato({ frequency: 5.2, depth: 0.06 })).connect(chorus);
    return this.keep(new Tone.Gain(1)).connect(vibrato);
  }

  dispose(): void {
    this.bolsa.splice(0).reverse().forEach((n) => n.dispose());
  }
}

/** Cada cuánto mira el reloj (s de transporte) y cuánto adelante agenda. */
const TICK = 0.03;
const ANTES = 0.1;

/**
 * El reloj de cada canción. El transporte lo comparten dos canciones en el fundido y nadie le cambia el
 * tempo, así que cada una cuenta sus semicorcheas en segundos: `en(k)` dice en qué segundo (desde que
 * arrancó) cae la k, y `tocar` la recibe con su hora de audio y cuánto dura. Mira cada TICK y agenda lo
 * que cae en los próximos ANTES s: así el tempo puede cambiar sobre la marcha (los tambores se apuran).
 * Va en segundos del transporte: si el juego se pausa, la canción se pausa con él.
 */
class Reloj {
  private id = -1;
  private k = 0;
  inicio = 0;
  fin = Infinity;

  constructor(
    private readonly transport: Transport,
    private readonly en: (k: number) => number,
    private readonly tocar: (k: number, time: number, paso: number) => void,
  ) {}

  /** Arranca en `time` (segundos de transporte); con `desde`, como si ya llevara esas semicorcheas. */
  start(time: number, desde = 0): void {
    this.k = desde;
    this.inicio = time - this.en(desde);
    this.fin = Infinity;
    this.id = this.transport.scheduleRepeat((t) => this.mirar(t), TICK, time);
  }

  /** Deja de agendar desde `time` (segundos de transporte): lo que ya sonó sigue en el fundido. */
  stop(time: number): void {
    this.fin = time;
  }

  clear(): void {
    if (this.id >= 0) this.transport.clear(this.id);
    this.id = -1;
  }

  private mirar(time: number): void {
    const ahora = this.transport.getSecondsAtTime(time);
    if (ahora >= this.fin) return this.clear();
    const s = ahora - this.inicio;
    for (;;) {
      const at = this.en(this.k);
      if (at >= s + ANTES || this.inicio + at >= this.fin) return;
      // si el navegador se trabó, lo atrasado no suena todo junto: se saltea
      if (at >= s - 0.05) this.tocar(this.k, time + Math.max(0, at - s), this.en(this.k + 1) - at);
      this.k++;
    }
  }
}

/** La tensión de la partida, suavizada (unos 3 s), y las capas que prende: con histéresis, para que no titilen. */
class Tension {
  meta = 0;
  nivel = 0;
  seguir(paso: number): void {
    this.nivel += (this.meta - this.nivel) * Math.min(1, paso / 3);
  }
  /** La capa del umbral `u`: prende arriba de u + 0.06 y apaga abajo de u - 0.06. */
  capa(prendida: boolean, u: number): boolean {
    return prendida ? this.nivel > u - 0.06 : this.nivel > u + 0.06;
  }
}

interface Acorde {
  /** La nota del contrabajo (MIDI). */
  bajo: number;
  /** Cómo lo canta el coro (MIDI, de abajo arriba). */
  voces: readonly number[];
  /** Menor (3) o mayor (4): para el ostinato. */
  tercera: 3 | 4;
}

interface Seccion {
  nombre: string;
  /** Un acorde por compás. */
  acordes: string[];
  /** Semitonos que se transporta (el clímax de la batalla sube un tono). */
  tr: number;
}
const seccion = (nombre: string, acordes: string, tr = 0): Seccion => ({ nombre, acordes: acordes.split(' '), tr });

/** Dónde cae el compás `bar`: la sección, el compás adentro de ella y cuántas vueltas lleva la forma. */
function lugar(forma: readonly Seccion[], vuelta: number, bar: number): { sec: Seccion; i: number; vez: number } {
  let i = bar;
  let s = 0;
  let vez = 0;
  while (i >= forma[s].acordes.length) {
    i -= forma[s].acordes.length;
    if (++s >= forma.length) {
      s = vuelta;
      vez++;
    }
  }
  return { sec: forma[s], i, vez };
}

/** Cuántos compases dura el acorde que empieza en el compás `i`. */
function largo(sec: Seccion, i: number): number {
  let n = 1;
  while (i + n < sec.acordes.length && sec.acordes[i + n] === sec.acordes[i]) n++;
  return n;
}

/** Una melodía como mapa: semicorchea desde su principio → nota y largo (en semicorcheas). */
type Melodia = Map<number, { n: number; len: number }>;
function melodia(notas: readonly Nota[], unidad: number): Melodia {
  const m: Melodia = new Map();
  let at = 0;
  for (const [n, l] of notas) {
    const len = Math.round(l * unidad);
    if (n !== null) m.set(at, { n, len });
    at += len;
  }
  return m;
}

// ---------- los instrumentos ----------

/** Los sintes de una voz no aceptan dos golpes en el mismo instante: esto los deja pasar de a uno. */
function turno(): (t: number) => boolean {
  let ultimo = -1;
  return (t) => {
    if (t <= ultimo + 0.004) return false;
    ultimo = t;
    return true;
  };
}

/** Formantes (frecuencia, Q, ganancia): una «a» abierta para el coro entero y una «o» oscura para los bajos. */
const FORMANTES = {
  a: [[730, 3, 1], [1150, 4, 0.5], [2600, 6, 0.18]],
  o: [[450, 3, 1], [800, 4, 0.42], [2500, 7, 0.08]],
} as const;

type Env = Partial<{ attack: number; decay: number; sustain: number; release: number }>;

/**
 * Un coro: sierras desafinadas (varias voces) por filtros de formantes en paralelo, que es lo que hace que
 * una sierra suene a «aaa» o a «ooo» y no a sinte. `dest` es el conjunto (vibrato y chorus) de la canción.
 */
function coro(k: Kit, dest: Dest, vocal: 'a' | 'o', volume: number, env: Env = {}): Tone.PolySynth {
  const suma = k.keep(new Tone.Gain(1)).connect(dest);
  const entrada = k.keep(new Tone.Gain(1));
  for (const [f, q, g] of FORMANTES[vocal]) {
    entrada.chain(k.keep(new Tone.Filter({ frequency: f, type: 'bandpass', Q: q })), k.keep(new Tone.Gain(g)), suma);
  }
  // el cuerpo: lo grave pasa un poco, si no el coro queda finito
  entrada.chain(k.keep(new Tone.Filter({ frequency: vocal === 'a' ? 900 : 550, type: 'lowpass' })), k.keep(new Tone.Gain(0.3)), suma);
  const voces = k.keep(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
    envelope: { attack: 0.6, decay: 0.4, sustain: 0.85, release: 1.6, ...env },
    volume,
  })).connect(entrada);
  // un coro de 3 sierras por voz es lo más caro de la canción: con más de 16 notas a la vez algo anda mal
  voces.maxPolyphony = 16;
  return voces;
}

/** «¡HA!»: el coro corto y un golpe de aire. */
function grito(k: Kit, dest: Dest, volume: number) {
  const voces = coro(k, dest, 'a', volume, { attack: 0.012, decay: 0.3, sustain: 0, release: 0.2 });
  const filtro = k.keep(new Tone.Filter({ frequency: 1500, type: 'bandpass', Q: 0.7 })).connect(dest);
  const aire = k.keep(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.004, decay: 0.14, sustain: 0, release: 0.05 }, volume: volume - 6 })).connect(filtro);
  const ok = turno();
  return (notas: readonly number[], time: number, vel: number) => {
    voces.triggerAttackRelease(hzs(notas), 0.24, time, vel);
    if (ok(time)) aire.triggerAttackRelease(0.12, time, vel);
  };
}

/** Metales: sierras con un filtro que se abre al atacar (el «blat» del bronce) y se queda medio cerrado. */
function metales(k: Kit, dest: Dest, volume: number, brillo: number, ataque = 0.06): Tone.PolySynth<Tone.MonoSynth> {
  return k.keep(new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
    envelope: { attack: ataque, decay: 0.3, sustain: 0.8, release: 0.4 },
    filter: { type: 'lowpass', rolloff: -24, Q: 0.7 },
    filterEnvelope: { attack: ataque * 1.5, decay: 0.6, sustain: 0.6, release: 0.4, baseFrequency: brillo, octaves: 2.5, exponent: 2 },
    volume,
  })).connect(dest);
}

/**
 * Cuerdas por sección: `sierras` desafinadas por voz (el contrabajo, filtrado a 400 Hz, va con una: no se
 * oye la diferencia y cuesta un tercio), filtradas sin el zumbido de arriba ni el barro de abajo.
 */
function cuerdas(k: Kit, dest: Dest, volume: number, corte: number, env: Env, grave = 100, sierras = 2): Tone.PolySynth {
  const lp = k.keep(new Tone.Filter({ frequency: corte, type: 'lowpass', rolloff: -24 }));
  lp.chain(k.keep(new Tone.Filter({ frequency: grave, type: 'highpass' })), dest);
  const oscillator = sierras > 1 ? { type: 'fatsawtooth' as const, count: sierras, spread: 16 } : { type: 'sawtooth' as const };
  const voces = k.keep(new Tone.PolySynth(Tone.Synth, { oscillator, envelope: env, volume })).connect(lp);
  voces.maxPolyphony = 12;
  return voces;
}
/** Arco corto: el ostinato. */
const SPICCATO: Env = { attack: 0.005, decay: 0.13, sustain: 0.1, release: 0.09 };
/** El contrabajo: largo y redondo. */
const ARCO_GRAVE: Env = { attack: 0.06, decay: 0.3, sustain: 0.85, release: 0.6 };

/** Órgano: parciales de registros abiertos (8', 4', 2 2/3'...), entra lento y se queda. */
function organo(k: Kit, dest: Dest, volume: number): Tone.PolySynth {
  const lp = k.keep(new Tone.Filter({ frequency: 2000, type: 'lowpass' })).connect(dest);
  return k.keep(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.7, 0.45, 0.4, 0.12, 0.22, 0.05, 0.15] },
    envelope: { attack: 1.2, decay: 0.4, sustain: 0.9, release: 2.4 },
    volume,
  })).connect(lp);
}

/** Campanas FM: armonía 1.41 da la campana grande de iglesia (inarmónica); 3.5, las tubulares. */
function campanas(k: Kit, dest: Dest, volume: number, armonia: number, indice: number, decae: number): Tone.PolySynth<Tone.FMSynth> {
  return k.keep(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: armonia,
    modulationIndex: indice,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.002, decay: decae, sustain: 0, release: decae * 0.5 },
    modulationEnvelope: { attack: 0.002, decay: decae * 0.35, sustain: 0, release: 0.6 },
    volume,
  })).connect(dest);
}

/**
 * Timbal: la membrana afinada, su parcial de quinta (los de verdad la tienen) y el golpe del mazo. Cualquier
 * nota se lleva al registro de los timbales (re2 a re3): más abajo no hay timbal, y era puro barro.
 */
function timbal(k: Kit, dest: Dest, volume: number) {
  const cuerpo = k.keep(new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 1.4, envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 1 }, volume })).connect(dest);
  const quinta = k.keep(new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 1.2, envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.6 }, volume: volume - 10 })).connect(dest);
  const filtro = k.keep(new Tone.Filter({ frequency: 700, type: 'bandpass', Q: 0.8 })).connect(dest);
  const mazo = k.keep(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 }, volume: volume - 8 })).connect(filtro);
  const ok = turno();
  return (nota: number, time: number, vel: number) => {
    if (!ok(time)) return;
    while (nota < 38) nota += 12;
    while (nota > 50) nota -= 12;
    cuerpo.triggerAttackRelease(hz(nota), 1.1, time, vel);
    quinta.triggerAttackRelease(hz(nota) * 1.5, 0.6, time, vel * 0.8);
    mazo.triggerAttackRelease(0.03, time, vel);
  };
}

/**
 * Un tambor grande (taiko, bombo): la membrana que cae de tono, el cuero (ruido grave) y un golpe medio que
 * se oye también en los parlantes chicos, donde los 50 Hz no salen.
 */
function tamborGrande(k: Kit, dest: Dest, volume: number, nota: number, decae = 0.9, golpe = -8) {
  const cuerpo = k.keep(new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: decae, sustain: 0, release: 0.5 }, volume })).connect(dest);
  const medio = k.keep(new Tone.MembraneSynth({ pitchDecay: 0.025, octaves: 2, envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.1 }, volume: volume + golpe })).connect(dest);
  const filtro = k.keep(new Tone.Filter({ frequency: 320, type: 'bandpass', Q: 0.9 })).connect(dest);
  const cuero = k.keep(new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 }, volume: volume - 2 })).connect(filtro);
  const ok = turno();
  return (time: number, vel: number) => {
    if (!ok(time)) return;
    cuerpo.triggerAttackRelease(hz(nota), decae, time, vel);
    medio.triggerAttackRelease(hz(nota + 19), 0.15, time, vel);
    cuero.triggerAttackRelease(0.08, time, vel);
  };
}

/** Tambor medio (toms, taiko chico): afinable, para rellenos y redobles. */
function tom(k: Kit, dest: Dest, volume: number) {
  const cuerpo = k.keep(new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 2.2, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.2 }, volume })).connect(dest);
  const filtro = k.keep(new Tone.Filter({ frequency: 900, type: 'bandpass', Q: 0.8 })).connect(dest);
  const cuero = k.keep(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }, volume: volume - 6 })).connect(filtro);
  const ok = turno();
  return (nota: number, time: number, vel: number) => {
    if (!ok(time)) return;
    cuerpo.triggerAttackRelease(hz(nota), 0.3, time, vel);
    cuero.triggerAttackRelease(0.03, time, vel);
  };
}

/** «Ka»: el golpe en el borde del taiko (madera). */
function ka(k: Kit, dest: Dest, volume: number) {
  const cuerpo = k.keep(new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 1.6, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 }, volume })).connect(dest);
  const filtro = k.keep(new Tone.Filter({ frequency: 2800, type: 'bandpass', Q: 1.2 })).connect(dest);
  const chasquido = k.keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.01 }, volume: volume - 4 })).connect(filtro);
  const ok = turno();
  return (time: number, vel: number) => {
    if (!ok(time)) return;
    cuerpo.triggerAttackRelease(700, 0.05, time, vel);
    chasquido.triggerAttackRelease(0.02, time, vel);
  };
}

/** Platillos: el choque y el platillo al revés (sube y corta justo en el golpe). */
function platillos(k: Kit, dest: Dest, volume: number) {
  const hp = k.keep(new Tone.Filter({ frequency: 4500, type: 'highpass' })).connect(dest);
  const choque = k.keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 2.2, sustain: 0, release: 0.6 }, volume })).connect(hp);
  const subida = k.keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 2, decay: 0.01, sustain: 1, release: 0.04 }, volume: volume - 3 })).connect(hp);
  const ok1 = turno();
  const ok2 = turno();
  return {
    choque(time: number, vel: number) {
      if (ok1(time)) choque.triggerAttackRelease(1.8, time, vel);
    },
    subida(time: number, dur: number, vel = 0.8) {
      if (!ok2(time)) return;
      subida.envelope.attack = dur;
      subida.triggerAttackRelease(dur, time, vel);
    },
  };
}

// ---------- 1. Réquiem para un golfista ----------

const REQ_ACORDES: Record<string, Acorde> = {
  Dm: { bajo: 38, voces: [50, 53, 57, 62], tercera: 3 },
  Bb: { bajo: 34, voces: [50, 53, 58, 62], tercera: 4 },
  Gm: { bajo: 43, voces: [50, 55, 58, 62], tercera: 3 },
  A: { bajo: 33, voces: [49, 52, 57, 61], tercera: 4 },
  F: { bajo: 41, voces: [48, 53, 57, 60], tercera: 4 },
  C: { bajo: 36, voces: [48, 52, 55, 60], tercera: 4 },
  D: { bajo: 38, voces: [50, 54, 57, 62], tercera: 4 },
};

/** ~3 min la primera vez (62 compases de 3 s); después vuelve a «a» con más capas. */
const REQ_FORMA = [
  // un compás en la dominante que crece con el fundido: el golpe cae en el primero de la intro
  seccion('levanta', 'A'),
  seccion('intro', 'Dm Dm Dm C Bb A'),
  seccion('a', 'Dm Dm Bb Bb Gm Gm A A Dm Dm Bb Bb Gm Gm A A'),
  seccion('b', 'Bb Bb F F C C Dm Dm Bb Bb C C A A A A'),
  seccion('climax', 'Dm Dm Bb Bb Gm Gm A A Bb Bb C C D D D D'),
  seccion('respiro', 'Dm Dm Dm Dm Bb Bb A A'),
];
const REQ_VUELTA = 2;

// melodías en negras
/** Dies irae (canto gregoriano del siglo XIII, la secuencia de los réquiem): los bajos, lento. */
const DIES_IRAE = melodia([[53, 2], [52, 2], [53, 2], [50, 2], [52, 2], [48, 2], [50, 4]], 4);
/** El tema: sube a la, baja, sube al re agudo en el cuarto acorde y cae en la dominante. */
const REQ_TEMA = melodia([
  [62, 1.5], [57, 0.5], [62, 1], [65, 1], [69, 3], [67, 0.5], [65, 0.5],
  [65, 1.5], [62, 0.5], [58, 1], [62, 1], [67, 1], [65, 1], [62, 2],
  [67, 1.5], [70, 0.5], [69, 1], [67, 1], [74, 2], [72, 1], [70, 1],
  [69, 1.5], [67, 0.5], [65, 1], [64, 1], [61, 1], [62, 0.5], [64, 0.5], [57, 2],
], 4);
/** Contracanto de las trompas, abajo del tema: notas largas con una anacrusa de corcheas. */
const REQ_CONTRA = melodia([
  [57, 3], [57, 0.5], [60, 0.5], [62, 4], [58, 3], [58, 0.5], [60, 0.5], [62, 2], [65, 2],
  [58, 3], [58, 0.5], [62, 0.5], [67, 4], [61, 4], [64, 2], [61, 2],
], 4);
/** La B: más luminosa (si bemol, fa, do), sube hasta el la agudo sobre la dominante. */
const REQ_SUBIDA = melodia([
  [65, 1], [70, 1], [74, 2], [72, 1.5], [70, 0.5], [69, 1], [70, 1], [72, 3], [69, 1], [65, 4],
  [67, 1], [72, 1], [76, 2], [74, 1.5], [72, 0.5], [67, 2], [69, 3], [65, 1], [62, 4],
  [65, 1], [70, 1], [74, 2], [77, 2], [74, 2], [76, 2], [79, 1], [76, 1], [72, 4],
  [73, 4], [76, 4], [73, 2], [76, 2], [81, 4],
], 4);
/** El final del clímax: si bemol, do, ¡re mayor! (el caballero puede ganar). */
const REQ_TRIUNFO = melodia([[70, 2], [74, 2], [77, 3], [74, 1], [72, 2], [76, 2], [79, 3], [76, 1], [74, 1], [78, 1], [81, 2], [78, 12]], 4);
/** Fanfarria de las trompas debajo del triunfo. */
const REQ_FANFARRIA = melodia([
  [62, 1.5], [62, 0.5], [65, 2], [70, 4], [64, 1.5], [64, 0.5], [67, 2], [72, 4],
  [66, 1.5], [66, 0.5], [69, 2], [74, 4], [69, 1.5], [69, 0.5], [74, 1], [78, 1], [74, 4],
], 4);
/** Ostinato de las cuerdas: acentos de 3+3+2 en cada medio compás, la tercera arriba al final. */
const REQ_OST_ACENTOS = new Set([0, 3, 6, 8, 11, 14]);
const reqOst = (ac: Acorde) => [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 12 + ac.tercera, 7];

/** Volúmenes (dB) del réquiem. */
const REQ_DB = {
  todo: -7.5,
  bajos: -6, altos: -9, grito: -6, trompas: -15, trombones: -16, ostinato: -21, contrabajo: -14,
  organo: -19, timbal: -11, taiko: -12, tom: -14, platillos: -29, campana: -16, tubos: -21,
};

function requiem(out: Dest, transport: Transport): Song {
  const k = new Kit(out, transport.context, REQ_DB.todo, 2.8);
  const g = {
    coro: k.grupo('coro', 0, 0.45),
    metales: k.grupo('metales', 0, 0.3),
    cuerdas: k.grupo('cuerdas', 0, 0.2),
    perc: k.grupo('percusion', 0, 0.15),
    campanas: k.grupo('campanas', 0, 0.5),
    organo: k.grupo('organo', 0, 0.35),
  };
  const voces = k.conjunto(g.coro);
  const bajos = coro(k, voces, 'o', REQ_DB.bajos);
  const altos = coro(k, voces, 'a', REQ_DB.altos);
  const ha = grito(k, voces, REQ_DB.grito);
  const trompas = metales(k, g.metales, REQ_DB.trompas, 300);
  const trombones = metales(k, g.metales, REQ_DB.trombones, 220, 0.05);
  const ost = cuerdas(k, g.cuerdas, REQ_DB.ostinato, 2400, SPICCATO);
  const contrabajo = cuerdas(k, g.cuerdas, REQ_DB.contrabajo, 400, ARCO_GRAVE, 45, 1);
  const org = organo(k, g.organo, REQ_DB.organo);
  const timb = timbal(k, g.perc, REQ_DB.timbal);
  const taiko = tamborGrande(k, g.perc, REQ_DB.taiko, 38);
  const tm = tom(k, g.perc, REQ_DB.tom);
  const pl = platillos(k, g.perc, REQ_DB.platillos);
  const campana = campanas(k, g.campanas, REQ_DB.campana, 1.41, 5, 5);
  const tubos = campanas(k, g.campanas, REQ_DB.tubos, 3.5, 6, 2.6);
  const t = new Tension();
  const on = { taikos: false, contra: false, todo: false };
  const rnd = azar(80);

  const reloj = new Reloj(transport, (n) => n * REQ_PASO, (n, time, d) => {
    t.seguir(d);
    const bar = Math.floor(n / 16);
    const st = n % 16;
    const { sec, i, vez } = lugar(REQ_FORMA, REQ_VUELTA, bar);
    const ac = REQ_ACORDES[sec.acordes[i]];
    const nuevo = st === 0 && (i === 0 || sec.acordes[i - 1] !== sec.acordes[i]);
    const dura = largo(sec, i) * 16 * d;
    const pos = i * 16 + st;
    if (st === 0 && i % 2 === 0) {
      on.taikos = t.capa(on.taikos, 0.3);
      on.contra = t.capa(on.contra, 0.55);
      on.todo = t.capa(on.todo, 0.8);
    }
    const h = (v: number) => v * (0.93 + 0.07 * rnd());
    const quinta = ac.bajo - 5 >= 31 ? ac.bajo - 5 : ac.bajo + 7;
    const cantar = (synth: Tone.PolySynth<Tone.Synth> | Tone.PolySynth<Tone.MonoSynth>, mel: Melodia, p: number, tr: number, vel: number) => {
      const e = mel.get(p);
      if (e) synth.triggerAttackRelease(hz(e.n + tr), e.len * d * 0.95, time, h(vel));
    };
    /** Ostinato: semicorcheas (cada 1) o corcheas (cada 2), una octava arriba si `oct`. */
    const ostinato = (vel: number, cada = 1, oct = 0) => {
      if (st % cada) return;
      const raiz = ac.bajo + 12 >= 45 ? ac.bajo + 12 : ac.bajo + 24;
      ost.triggerAttackRelease(hz(raiz + oct + reqOst(ac)[st]), d * cada * 0.8, time, h(REQ_OST_ACENTOS.has(st) ? vel : vel * 0.6));
    };
    /** Taikos: graves en 1 y 3, medios en 3+3+2; con todo, redoble de semicorcheas al final de cada dos compases. */
    const taikos = () => {
      if (st === 0 || st === 8) taiko(time, h(st === 0 ? 0.95 : 0.75));
      if (st === 3 || st === 6 || st === 11 || st === 14) tm(st < 8 ? 45 : 40, time, h(0.5));
      if (on.todo && i % 2 === 1 && st >= 12) tm(43, time, h(0.35 + 0.1 * (st - 12)));
    };
    /** Redoble de timbal en fusas (dos por semicorchea) que crece de `v0` a `v1` a lo largo de `de` semicorcheas. */
    const redoble = (nota: number, paso: number, de: number, v0: number, v1: number) => {
      const v = v0 + (v1 - v0) * (paso / de);
      timb(nota, time, v);
      timb(nota, time + d / 2, v + 0.02);
    };

    switch (sec.nombre) {
      case 'levanta': {
        redoble(33, st, 16, 0.2, 0.7);
        if (st === 0) {
          pl.subida(time, 16 * d);
          bajos.triggerAttackRelease(hzs([45, 52, 57]), 16 * d, time, 0.5);
          trombones.triggerAttackRelease(hzs([45, 52]), 16 * d, time, 0.4);
        }
        break;
      }
      case 'intro': {
        if (pos === 0) {
          // ¡el golpe!: todos juntos en re menor, y el pedal de órgano que queda sonando
          ha([62, 65, 69, 74], time, 0.85);
          trombones.triggerAttackRelease(hzs([38, 45, 50]), 1.4, time, 0.85);
          timb(38, time, 0.8);
          taiko(time, 0.75);
          pl.choque(time, 0.9);
          campana.triggerAttackRelease(hz(50), 6, time, 0.8);
          contrabajo.triggerAttackRelease(hz(38), 5 * 16 * d - 0.3, time, 0.7);
          org.triggerAttackRelease(hzs([38, 45, 50, 57]), 5 * 16 * d - 0.2, time, 0.7);
        }
        if (i >= 1 && i <= 4) {
          cantar(bajos, DIES_IRAE, pos - 16, 0, 0.75);
          if (st === 0) campana.triggerAttackRelease(hz(50), 5, time, 0.45);
          if (st === 0) timb(38, time, 0.5);
          if (st === 8 && i < 4) timb(33, time, 0.35);
        }
        if (i === 4 && st >= 8) redoble(33, st - 8, 24, 0.25, 0.7);
        if (i === 5) {
          redoble(33, st + 8, 24, 0.25, 0.7);
          if (st === 0) {
            pl.subida(time, 16 * d);
            altos.triggerAttackRelease(hzs([57, 61, 64, 69]), 16 * d, time, 0.6);
            trombones.triggerAttackRelease(hzs([45, 52, 57]), 16 * d, time, 0.6);
            contrabajo.triggerAttackRelease(hz(33), 16 * d - 0.2, time, 0.7);
          }
        }
        break;
      }
      case 'a': {
        if (pos === 0) pl.choque(time, 0.8);
        ostinato(vez > 0 || i >= 8 ? 0.85 : 0.7);
        if (nuevo) contrabajo.triggerAttackRelease(hz(ac.bajo), dura - 0.15, time, 0.75);
        // timbales en 1 y 3, con dos semicorcheas de antesala antes de cada cambio de acorde
        if (st === 0) timb(ac.bajo, time, h(0.85));
        if (st === 8) timb(quinta, time, h(0.6));
        if (i % 2 === 1 && st >= 14) timb(ac.bajo, time, 0.4 + 0.15 * (st - 14));
        if (i < 8) {
          // primera vuelta: el coro grave sostiene, las trompas dicen el tema
          if (nuevo) bajos.triggerAttackRelease(hzs(ac.voces), dura - 0.2, time, 0.5);
          cantar(trompas, REQ_TEMA, pos, 0, 0.7);
        } else {
          // segunda: el tema pasa al coro (una octava abajo) y las trompas lo doblan o contracantan
          cantar(bajos, REQ_TEMA, pos - 128, -12, 0.85);
          cantar(trompas, on.contra || vez > 0 ? REQ_CONTRA : REQ_TEMA, pos - 128, 0, 0.6);
          if (on.todo || vez > 0) cantar(altos, REQ_TEMA, pos - 128, 0, 0.6);
        }
        if ((on.taikos || vez > 0) && nuevo) trombones.triggerAttackRelease(hzs([ac.bajo + 12, ac.bajo + 19]), dura - 0.2, time, 0.45);
        if (on.taikos || vez > 0) taikos();
        if (on.todo && st === 0 && i % 4 === 0 && i > 0) pl.choque(time, 0.5);
        if (i === 15 && st === 0) pl.subida(time, 16 * d, 0.6);
        break;
      }
      case 'b': {
        if (pos === 0) pl.choque(time, 0.85);
        const crece = i >= 12;
        ostinato(crece ? 0.8 : 0.6, crece ? 1 : 2, crece ? 0 : 12);
        if (nuevo) {
          contrabajo.triggerAttackRelease(hz(ac.bajo), dura - 0.15, time, 0.75);
          trombones.triggerAttackRelease(hzs([ac.bajo + 12, ac.bajo + 19]), dura - 0.2, time, 0.5);
          bajos.triggerAttackRelease(hzs(ac.voces), dura - 0.2, time, 0.5);
          tubos.triggerAttackRelease(hz(60 + ((ac.bajo - 60) % 12 + 12) % 12), 2.5, time, 0.6);
        }
        if (on.contra || vez > 0) cantar(altos, REQ_SUBIDA, pos, 0, 0.6);
        else if (nuevo) altos.triggerAttackRelease(hzs(ac.voces.map((v) => v + 12)), dura - 0.2, time, 0.35);
        cantar(trompas, REQ_SUBIDA, pos, 0, 0.72);
        if (i < 14) {
          if (st % 2 === 0) timb(st % 8 === 0 ? ac.bajo : quinta, time, h(st % 8 === 0 ? 0.75 : 0.45));
        } else {
          redoble(33, (i - 14) * 16 + st, 32, 0.3, 0.75);
        }
        if (on.taikos) taikos();
        if (i === 15 && st === 0) pl.subida(time, 16 * d);
        break;
      }
      case 'climax': {
        if (st === 0 && i % 2 === 0) pl.choque(time, i === 0 || i === 12 ? 1 : 0.55);
        ostinato(0.9);
        if (nuevo) {
          contrabajo.triggerAttackRelease(hz(ac.bajo), dura - 0.15, time, 0.8);
          org.triggerAttackRelease(hzs([ac.bajo + 12, ac.bajo + 19, ac.bajo + 24]), dura - 0.2, time, 0.6);
          tubos.triggerAttackRelease(hzs([ac.voces[3] + 12]), 2.5, time, 0.7);
        }
        const p = i < 8 ? pos : pos - 128;
        const mel = i < 8 ? REQ_TEMA : REQ_TRIUNFO;
        cantar(altos, mel, p, 0, 0.8);
        cantar(bajos, mel, p, -12, 0.8);
        cantar(trompas, i < 8 ? REQ_CONTRA : REQ_FANFARRIA, p, 0, 0.75);
        // trombones marcato: negra con puntillo, corchea, blanca
        if (st === 0 || st === 6 || st === 8) {
          trombones.triggerAttackRelease(hzs([ac.bajo + 12, ac.bajo + 19]), (st === 0 ? 5.5 : st === 6 ? 1.6 : 7) * d, time, h(st === 6 ? 0.55 : 0.7));
        }
        if (on.todo || st % 2 === 0) timb(st % 8 === 0 ? ac.bajo : quinta, time, h(st % 8 === 0 ? 0.85 : st % 2 ? 0.35 : 0.5));
        taikos();
        if (i === 12 && st === 0) campana.triggerAttackRelease(hz(50), 6, time, 0.8);
        if (i >= 12 && st % 4 === 0 && st < 12) tubos.triggerAttackRelease(hz([74, 78, 81][st / 4]), 2, time, 0.55);
        break;
      }
      case 'respiro': {
        if (pos === 0) {
          org.triggerAttackRelease(hzs([38, 45, 50]), 4 * 16 * d - 0.2, time, 0.45);
          contrabajo.triggerAttackRelease(hz(38), 4 * 16 * d - 0.3, time, 0.55);
        }
        if (i < 4) {
          cantar(bajos, DIES_IRAE, pos, 0, 0.6);
          if (st === 0) campana.triggerAttackRelease(hz(50), 5, time, 0.4);
          if (st === 0) timb(38, time, 0.45);
          if (st === 8) timb(33, time, 0.3);
        } else {
          if (nuevo) {
            contrabajo.triggerAttackRelease(hz(ac.bajo), dura - 0.15, time, 0.65);
            bajos.triggerAttackRelease(hzs(ac.voces), dura - 0.2, time, 0.5);
          }
          ostinato(0.3 + 0.1 * (i - 4), 2);
        }
        if (i >= 6) redoble(33, (i - 6) * 16 + st, 32, 0.2, 0.7);
        if (i === 6 && st === 0) {
          pl.subida(time, 32 * d);
          altos.triggerAttackRelease(hzs([57, 61, 64, 69]), 32 * d, time, 0.55);
          trombones.triggerAttackRelease(hzs([45, 52, 57]), 32 * d, time, 0.55);
        }
        break;
      }
    }
  });

  return {
    start: (time) => reloj.start(time, PRUEBA.compas * 16),
    stop: (time) => reloj.stop(time),
    intensity: (level) => {
      t.meta = level;
    },
    dispose: () => {
      reloj.clear();
      k.dispose();
    },
  };
}

// ---------- 2. Batalla en siete ----------

const BAT_ACORDES: Record<string, Acorde> = {
  Cm: { bajo: 36, voces: [48, 51, 55, 60], tercera: 3 },
  Ab: { bajo: 32, voces: [48, 51, 56, 60], tercera: 4 },
  Bb: { bajo: 34, voces: [46, 50, 53, 58], tercera: 4 },
  G: { bajo: 43, voces: [47, 50, 55, 59], tercera: 4 },
  Fm: { bajo: 41, voces: [48, 53, 56, 60], tercera: 3 },
  C: { bajo: 36, voces: [48, 52, 55, 60], tercera: 4 },
  F: { bajo: 41, voces: [48, 53, 57, 60], tercera: 4 },
};

const BAT_A = 'Cm Cm Ab Bb Cm Cm Ab G Cm Cm Ab Bb Cm Cm Ab G';
const BAT_B = 'Ab Ab Bb Bb Cm Cm Cm Cm Fm Fm Ab Ab Bb Bb G G';
/** ~2:20 la primera vez (102 compases de 1.4 s); después vuelve a «a2». */
const BAT_FORMA = [
  seccion('levanta', 'Cm Cm'),
  seccion('intro', 'Cm Cm Cm Cm Cm Cm Cm Cm'),
  seccion('a', BAT_A),
  seccion('b', BAT_B),
  seccion('quiebre', 'Cm Cm Cm Cm Cm Cm G G'),
  seccion('a2', BAT_A),
  seccion('b2', BAT_B),
  // el clímax sube un tono (re menor) y cierra si bemol, do, ¡re mayor!; la coda vuelve por sol
  seccion('climax', 'Cm Cm Ab Bb Cm Cm Ab G Cm Cm Ab Bb Ab Bb C C', 2),
  seccion('coda', 'C C F F', 2),
];
const BAT_VUELTA = 5;

// melodías en semicorcheas (el compás son 14: 4+4+6)
/** El tema: subida en 2+2+3 y respuesta; las trompas, después todos. */
const BAT_TEMA = melodia([
  [60, 4], [63, 4], [67, 6], [65, 2], [67, 2], [63, 4], [60, 6],
  [68, 4], [63, 4], [60, 6], [65, 4], [62, 4], [58, 6],
  [60, 4], [63, 4], [67, 6], [70, 2], [68, 2], [67, 4], [63, 6],
  [68, 4], [72, 4], [70, 2], [68, 2], [67, 2], [67, 4], [65, 4], [62, 6],
], 1);
/** La B: el coro en notas largas, hasta el re agudo sobre la dominante. */
const BAT_CORO = melodia([
  [60, 8], [63, 6], [68, 14], [70, 8], [68, 6], [65, 14], [67, 8], [63, 6], [60, 14], [62, 8], [63, 6], [67, 14],
  [68, 8], [67, 6], [65, 14], [63, 8], [68, 6], [72, 14], [70, 8], [68, 6], [70, 14], [71, 14], [74, 14],
], 1);
/** El final del clímax (se transporta con él): la bemol, si bemol, do mayor → si bemol, do, re mayor. */
const BAT_FIN = melodia([[60, 4], [63, 4], [68, 6], [62, 4], [65, 4], [70, 6], [64, 14], [67, 14]], 1);
/** Ostinato de cuerdas graves: raíz, octava y quinta, acentos en el 2+2+3. */
const BAT_OST = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 7, 0, 7, 12];
const BAT_ACENTOS = new Set([0, 4, 8]);
/** Taikos: el grande en los acentos (y un eco en el 3), el medio entre medio. */
const BAT_GRANDE: Record<number, number> = { 0: 1, 4: 0.75, 8: 0.9, 11: 0.5 };
const BAT_MEDIO: Record<number, number> = { 2: 0.45, 6: 0.45, 10: 0.5, 12: 0.6, 13: 0.45 };

const BAT_DB = {
  todo: -7,
  bajos: -7, altos: -9, grito: -5, trompas: -14, trombones: -15, ostinato: -19, contrabajo: -14, violines: -24,
  timbal: -12, taiko: -10, tom: -13, ka: -22, platillos: -29,
};

function batalla(out: Dest, transport: Transport): Song {
  const k = new Kit(out, transport.context, BAT_DB.todo, 2.0);
  const g = {
    coro: k.grupo('coro', 0, 0.4),
    metales: k.grupo('metales', 0, 0.28),
    cuerdas: k.grupo('cuerdas', 0, 0.18),
    perc: k.grupo('percusion', 0, 0.12),
  };
  const voces = k.conjunto(g.coro);
  const bajos = coro(k, voces, 'o', BAT_DB.bajos, { attack: 0.25 });
  const altos = coro(k, voces, 'a', BAT_DB.altos, { attack: 0.35 });
  const ha = grito(k, voces, BAT_DB.grito);
  const trompas = metales(k, g.metales, BAT_DB.trompas, 320, 0.04);
  const trombones = metales(k, g.metales, BAT_DB.trombones, 220, 0.03);
  const ost = cuerdas(k, g.cuerdas, BAT_DB.ostinato, 2200, SPICCATO);
  const contrabajo = cuerdas(k, g.cuerdas, BAT_DB.contrabajo, 420, ARCO_GRAVE, 45, 1);
  const violines = cuerdas(k, g.cuerdas, BAT_DB.violines, 3800, { attack: 0.3, decay: 0.3, sustain: 0.85, release: 0.9 }, 200, 3);
  const timb = timbal(k, g.perc, BAT_DB.timbal);
  const taiko = tamborGrande(k, g.perc, BAT_DB.taiko, 36, 0.7);
  const tm = tom(k, g.perc, BAT_DB.tom);
  const madera = ka(k, g.perc, BAT_DB.ka);
  const pl = platillos(k, g.perc, BAT_DB.platillos);
  const t = new Tension();
  const on = { fill: false, golpes: false, doble: false };
  const rnd = azar(7);

  const reloj = new Reloj(transport, (n) => n * BAT_PASO, (n, time, d) => {
    t.seguir(d);
    const bar = Math.floor(n / BAT_COMPAS);
    const st = n % BAT_COMPAS;
    const { sec, i, vez } = lugar(BAT_FORMA, BAT_VUELTA, bar);
    const ac = BAT_ACORDES[sec.acordes[i]];
    const tr = sec.tr;
    const bajo = ac.bajo + tr;
    const nuevo = st === 0 && (i === 0 || sec.acordes[i - 1] !== sec.acordes[i]);
    const dura = largo(sec, i) * BAT_COMPAS * d;
    const pos = i * BAT_COMPAS + st;
    if (st === 0 && i % 2 === 0) {
      on.fill = t.capa(on.fill, 0.35);
      on.golpes = t.capa(on.golpes, 0.6);
      on.doble = t.capa(on.doble, 0.8);
    }
    const h = (v: number) => v * (0.92 + 0.08 * rnd());
    const cantar = (synth: Tone.PolySynth<Tone.Synth> | Tone.PolySynth<Tone.MonoSynth>, mel: Melodia, p: number, dt: number, vel: number, legato = 0.92) => {
      const e = mel.get(p);
      if (e) synth.triggerAttackRelease(hz(e.n + tr + dt), e.len * d * legato, time, h(vel));
    };
    const ostinato = (vel: number) => {
      ost.triggerAttackRelease(hz(bajo + 12 + BAT_OST[st]), d * 0.8, time, h(BAT_ACENTOS.has(st) ? vel : st === 12 ? vel * 0.8 : vel * 0.55));
    };
    /** El grupo de taikos: lleno, o a medias (solo los grandes en 1 y 3 y algún medio). */
    const taikos = (lleno: boolean) => {
      const gr = BAT_GRANDE[st];
      if (gr !== undefined && (lleno || st === 0 || st === 8)) taiko(time, h(gr));
      const md = BAT_MEDIO[st];
      if (md !== undefined && (lleno || st === 12)) tm(st >= 10 ? 43 : 47, time, h(md));
      if (on.doble && st % 2 === 1) tm(50, time, h(0.28));
      // relleno al final de cada frase de 4: semicorcheas que crecen en el grupo de 3
      if ((on.fill || i % 8 === 7) && i % 4 === 3 && st >= 8) tm(st >= 11 ? 43 : 47, time, h(0.4 + 0.08 * (st - 8)));
    };
    const golpe = (vel: number) => trombones.triggerAttackRelease(hzs([bajo + 12, bajo + 19]), 0.22, time, h(vel));

    switch (sec.nombre) {
      case 'levanta': {
        // redoble de toms que crece con el fundido, y el coro grave que sube; el golpe cae en la intro
        const v = 0.2 + 0.7 * (pos / 28);
        tm(st % 2 ? 43 : 47, time, v);
        if (pos === 0) {
          pl.subida(time, 28 * d);
          bajos.triggerAttackRelease(hzs([43, 50, 55]), 28 * d, time, 0.5);
        }
        break;
      }
      case 'intro': {
        if (pos === 0) {
          ha([60, 63, 67], time, 1);
          trombones.triggerAttackRelease(hzs([36, 43, 48]), 0.9, time, 0.9);
          timb(36, time, 1);
          pl.choque(time, 0.9);
        }
        if (i < 4) {
          if (st === 0 || st === 4 || st === 8) taiko(time, h(st === 0 ? 1 : 0.7));
          if (st === 2 || st === 6 || st === 10 || st === 12) madera(time, h(0.6));
        } else {
          taikos(true);
          if (i === 4 && st === 0) contrabajo.triggerAttackRelease(hz(36), 4 * BAT_COMPAS * d - 0.2, time, 0.7);
        }
        if (i >= 2) ostinato(i < 4 ? 0.5 + 0.1 * (i - 2) : 0.85);
        if (i === 7 && st === 12) ha([60, 63, 67], time, 0.8);
        break;
      }
      case 'a':
      case 'a2': {
        const fuerte = sec.nombre === 'a2' || vez > 0;
        if (pos === 0) pl.choque(time, 0.85);
        ostinato(fuerte ? 0.85 : 0.75);
        // la primera A deja aire para el tema (taikos a medias): así la A2 y el clímax se sienten crecer
        taikos(fuerte || i >= 8 || on.fill);
        if (nuevo) contrabajo.triggerAttackRelease(hz(bajo), dura - 0.15, time, 0.75);
        if (fuerte && st === 0) timb(bajo, time, h(0.7));
        // el tema: trompas; la segunda mitad (o en a2) con trombones y coro grave una octava abajo
        const p = i < 8 ? pos : pos - 8 * BAT_COMPAS;
        cantar(trompas, BAT_TEMA, p, 0, 0.75);
        if (fuerte || i >= 8) cantar(trombones, BAT_TEMA, p, -12, 0.6);
        if (fuerte) cantar(bajos, BAT_TEMA, p, -12, 0.7);
        if (fuerte && on.doble && nuevo) altos.triggerAttackRelease(hzs(ac.voces.map((v) => v + 12 + tr)), dura - 0.2, time, 0.4);
        if (on.golpes && (st === 0 || st === 8)) golpe(0.6);
        if (i === 15 && st === 0) pl.subida(time, BAT_COMPAS * d, 0.6);
        break;
      }
      case 'b':
      case 'b2': {
        const fuerte = sec.nombre === 'b2' || vez > 0;
        if (pos === 0) pl.choque(time, 0.8);
        ostinato(fuerte ? 0.75 : 0.6);
        taikos(fuerte || on.fill);
        if (nuevo) {
          contrabajo.triggerAttackRelease(hz(bajo), dura - 0.15, time, 0.75);
          trombones.triggerAttackRelease(hzs([bajo + 12, bajo + 19]), dura - 0.2, time, 0.45);
          if (fuerte) violines.triggerAttackRelease(hzs(ac.voces.slice(1).map((v) => v + 24 + tr)), dura - 0.1, time, 0.5);
        }
        // el coro canta la B (con los bajos una octava abajo); las trompas, una fanfarria en 2+2+3
        cantar(altos, BAT_CORO, pos, 0, 0.75, 0.97);
        cantar(bajos, BAT_CORO, pos, -12, 0.65, 0.97);
        if (st === 0 || st === 4 || st === 8) {
          const nota = st === 8 ? ac.voces[3] : ac.voces[2];
          trompas.triggerAttackRelease(hz(nota + tr), (st === 8 ? 5.5 : 3.2) * d, time, h(fuerte ? 0.6 : 0.45));
        }
        if (fuerte && st === 0) timb(bajo, time, h(0.65));
        if (on.golpes && st === 0) golpe(0.55);
        if (i === 15 && st === 0) pl.subida(time, BAT_COMPAS * d);
        break;
      }
      case 'quiebre': {
        // solo de tambores con gritos; el coro y los metales vuelven a entrar en la dominante
        if (pos === 0) {
          pl.choque(time, 0.9);
          contrabajo.triggerAttackRelease(hz(36), 6 * BAT_COMPAS * d - 0.2, time, 0.6);
        }
        taikos(true);
        if (i >= 4 && st % 2 === 1) tm(50, time, h(0.25 + 0.04 * (i - 4)));
        if (st === 2 || st === 6 || st === 10) madera(time, h(0.5));
        if (st === 0 && i % 2 === 0 && i < 6) ha([60, 63, 67], time, 0.9);
        if (i === 6 && st === 0) {
          pl.subida(time, 2 * BAT_COMPAS * d);
          trombones.triggerAttackRelease(hzs([43, 50, 55]), 2 * BAT_COMPAS * d - 0.1, time, 0.55);
          bajos.triggerAttackRelease(hzs([47, 50, 55]), 2 * BAT_COMPAS * d - 0.1, time, 0.55);
          contrabajo.triggerAttackRelease(hz(43), 2 * BAT_COMPAS * d - 0.2, time, 0.7);
        }
        if (i === 7 && st === 8) ha([59, 62, 67], time, 0.85);
        break;
      }
      case 'climax': {
        if (st === 0 && (i % 4 === 0 || i === 12)) pl.choque(time, i === 0 || i === 12 ? 1 : 0.6);
        ostinato(0.9);
        taikos(true);
        if (st % 2 === 1 && !on.doble) tm(50, time, h(0.22));
        if (nuevo) {
          contrabajo.triggerAttackRelease(hz(bajo), dura - 0.15, time, 0.8);
          violines.triggerAttackRelease(hzs(ac.voces.slice(1).map((v) => v + 24 + tr)), dura - 0.1, time, 0.55);
        }
        if (st === 0) timb(bajo, time, h(0.8));
        if (st === 0 || st === 4 || st === 8) golpe(st === 0 ? 0.7 : 0.5);
        // el tema en todos (12 compases: entero y la mitad), y el final en mayor
        if (i < 12) {
          const p = i < 8 ? pos : pos - 8 * BAT_COMPAS;
          cantar(trompas, BAT_TEMA, p, 0, 0.8);
          cantar(altos, BAT_TEMA, p, 0, 0.75);
          cantar(bajos, BAT_TEMA, p, -12, 0.75);
        } else {
          const p = pos - 12 * BAT_COMPAS;
          cantar(trompas, BAT_FIN, p, 0, 0.85);
          cantar(altos, BAT_FIN, p, 12, 0.75, 0.98);
          cantar(bajos, BAT_FIN, p, 0, 0.75, 0.98);
        }
        break;
      }
      case 'coda': {
        taikos(true);
        if (pos === 0) {
          ha([62, 66, 69], time, 0.95);
          pl.choque(time, 0.7);
        }
        if (nuevo) {
          contrabajo.triggerAttackRelease(hz(bajo), dura - 0.15, time, 0.75);
          trombones.triggerAttackRelease(hzs([bajo + 12, bajo + 19, bajo + 24]), dura - 0.1, time, 0.6);
        }
        if (i === 2 && st === 0) pl.subida(time, 2 * BAT_COMPAS * d, 0.7);
        break;
      }
    }
  });

  return {
    start: (time) => reloj.start(time, PRUEBA.compas * BAT_COMPAS),
    stop: (time) => reloj.stop(time),
    intensity: (level) => {
      t.meta = level;
    },
    dispose: () => {
      reloj.clear();
      k.dispose();
    },
  };
}

// ---------- 3. Tambores de guerra (el pulso que se apura) ----------

/** Lo que acelera: bpm por segundo de canción. */
const TAM_ACEL = (TAMBORES_BPM.hasta - TAMBORES_BPM.desde) / TAMBORES_BPM.rampa;
/** Golpes que van al terminar la rampa (360). */
const TAM_GOLPES_RAMPA = (TAMBORES_BPM.desde * TAMBORES_BPM.rampa + (TAM_ACEL * TAMBORES_BPM.rampa ** 2) / 2) / 60;

/** Cuántos golpes (con decimales) van a los `s` segundos de la canción: la integral del tempo. */
export function tamboresGolpes(s: number): number {
  if (s <= 0) return (s * TAMBORES_BPM.desde) / 60;
  if (s < TAMBORES_BPM.rampa) return (TAMBORES_BPM.desde * s + (TAM_ACEL * s * s) / 2) / 60;
  return TAM_GOLPES_RAMPA + ((s - TAMBORES_BPM.rampa) * TAMBORES_BPM.hasta) / 60;
}

/** En qué segundo de la canción cae el golpe `b` (2.5 = la corchea entre el 2 y el 3). La inversa de la de arriba. */
export function tamboresSegundo(b: number): number {
  if (b <= 0) return (b * 60) / TAMBORES_BPM.desde;
  if (b < TAM_GOLPES_RAMPA) return (Math.sqrt(TAMBORES_BPM.desde ** 2 + 2 * TAM_ACEL * 60 * b) - TAMBORES_BPM.desde) / TAM_ACEL;
  return TAMBORES_BPM.rampa + ((b - TAM_GOLPES_RAMPA) * 60) / TAMBORES_BPM.hasta;
}

/** El tempo a los `s` segundos de la canción. */
export function tamboresBpm(s: number): number {
  return Math.min(TAMBORES_BPM.hasta, TAMBORES_BPM.desde + TAM_ACEL * Math.max(0, s));
}

export interface Pulso {
  /** El tempo de ahora, en golpes por minuto. */
  bpm: number;
  /** Golpes desde que arrancó la canción, con decimales (12.25: un cuarto de golpe después del 12). */
  golpe: number;
  /** Segundos desde el último golpe y hasta el próximo, de lo que se oye ahora. */
  desde: number;
  hasta: number;
  /** El último y el próximo golpe en la hora del audio (Tone.getContext().currentTime). */
  previo: number;
  proximo: number;
}

/** Los tambores que suenan ahora (los últimos que arrancaron, si en un fundido hay dos). */
let sonando: { reloj: Reloj; transport: Transport } | null = null;

/**
 * El pulso de «Tambores de guerra» mientras suena (null si no suena). Para un jefe de ritmo: al soltar el
 * tiro, `Math.min(p.desde, p.hasta) < 0.1` es «a tiempo». Cuenta lo que sale por el parlante (le descuenta
 * la latencia de salida del navegador) y se pausa con el juego. Ver docs/musica/jefe.md.
 */
export function pulsoTambores(): Pulso | null {
  if (!sonando) return null;
  const { reloj, transport } = sonando;
  const raw = transport.context.rawContext as unknown as { outputLatency?: number };
  const latencia = typeof raw.outputLatency === 'number' && raw.outputLatency < 0.5 ? raw.outputLatency : 0;
  const ahora = transport.context.currentTime - latencia;
  const tr = transport.getSecondsAtTime(Math.max(0, ahora));
  if (tr >= reloj.fin) return null;
  const s = tr - reloj.inicio;
  if (s < 0) return null;
  const golpe = tamboresGolpes(s);
  const n = Math.floor(golpe);
  const desde = s - tamboresSegundo(n);
  const hasta = tamboresSegundo(n + 1) - s;
  return { bpm: tamboresBpm(s), golpe, desde, hasta, previo: ahora - desde, proximo: ahora + hasta };
}

const TAM_ACORDES: Record<string, Acorde> = {
  Gm: { bajo: 43, voces: [55, 58, 62, 67], tercera: 3 },
  F: { bajo: 41, voces: [53, 57, 60, 65], tercera: 4 },
  Eb: { bajo: 39, voces: [55, 58, 63, 67], tercera: 4 },
  C: { bajo: 36, voces: [55, 60, 64, 67], tercera: 4 },
  D: { bajo: 38, voces: [54, 57, 62, 66], tercera: 4 },
};
const TAM_CANTO_AC = 'Gm Gm F Gm Eb C D Gm';
const TAM_GUERRA_AC = 'Eb F Gm Gm Eb F D D';
/** Fases de 16 compases que se van llenando; el tempo sube aparte, con el reloj (90 → 150 en 3 min). */
const TAM_FORMA = [
  seccion('cuenta', 'D'),
  seccion('f0', `${TAM_CANTO_AC} ${TAM_CANTO_AC}`),
  seccion('f1', `${TAM_CANTO_AC} ${TAM_GUERRA_AC}`),
  seccion('f2', `${TAM_CANTO_AC} ${TAM_GUERRA_AC}`),
  seccion('f3', `${TAM_CANTO_AC} ${TAM_GUERRA_AC}`),
  seccion('f4', `${TAM_GUERRA_AC} ${TAM_CANTO_AC}`),
  seccion('f5', `${TAM_CANTO_AC} ${TAM_CANTO_AC}`),
];
const TAM_VUELTA = 4;

// melodías en negras: el canto va en el pulso (se canta con el bombo) y deja el cuarto tiempo para el «¡HA!»
/** El canto de guerra, en sol dórico (el mi natural del do mayor lo aclara: épico, no fúnebre). */
const TAM_CANTO = melodia([
  [55, 1], [55, 1], [58, 1], [60, 1], [62, 2], [60, 1], [58, 1], [60, 1], [60, 1], [57, 1], [53, 1], [55, 3], [null, 1],
  [58, 1], [58, 1], [60, 1], [62, 1], [64, 2], [62, 1], [60, 1], [62, 2], [60, 1], [57, 1], [55, 3], [null, 1],
], 4);
/** La respuesta de los metales: más arriba y más larga, termina en la dominante. */
const TAM_GUERRA = melodia([
  [67, 2], [70, 2], [69, 2], [72, 2], [70, 3], [69, 1], [67, 4],
  [67, 2], [70, 1], [75, 1], [77, 2], [72, 2], [74, 2], [72, 1], [69, 1], [66, 4],
], 4);
/** Ostinato de cuerdas: raíz, octava, quinta. */
const TAM_OST = [0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 7, 0, 12, 7];

const TAM_DB = {
  todo: -9,
  bombo: -7, bajos: -6, altos: -9, grito: -5, trompas: -14, trombones: -15, ostinato: -21, contrabajo: -12,
  timbal: -12, tom: -17, ka: -20, platillos: -29, tubos: -21,
};

function tambores(out: Dest, transport: Transport): Song {
  const k = new Kit(out, transport.context, TAM_DB.todo, 2.2);
  const g = {
    perc: k.grupo('percusion', 0, 0.1),
    coro: k.grupo('coro', 0, 0.4),
    metales: k.grupo('metales', 0, 0.28),
    cuerdas: k.grupo('cuerdas', 0, 0.18),
    campanas: k.grupo('campanas', 0, 0.45),
  };
  // el bombo (en re, la quinta): el metrónomo. Siempre igual, para que se lea; el 1 apenas más fuerte
  const bombo = tamborGrande(k, g.perc, TAM_DB.bombo, 38, 0.5, -3);
  const voces = k.conjunto(g.coro);
  const bajos = coro(k, voces, 'o', TAM_DB.bajos, { attack: 0.05, decay: 0.3, sustain: 0.75, release: 0.5 });
  const altos = coro(k, voces, 'a', TAM_DB.altos, { attack: 0.08, release: 0.8 });
  const ha = grito(k, voces, TAM_DB.grito);
  const trompas = metales(k, g.metales, TAM_DB.trompas, 320, 0.04);
  const trombones = metales(k, g.metales, TAM_DB.trombones, 220, 0.03);
  const ost = cuerdas(k, g.cuerdas, TAM_DB.ostinato, 2300, SPICCATO);
  // el contrabajo sin su fundamental más grave (el oído la completa): lo de abajo de 70 Hz es del bombo
  const contrabajo = cuerdas(k, g.cuerdas, TAM_DB.contrabajo, 420, ARCO_GRAVE, 70, 1);
  const timb = timbal(k, g.perc, TAM_DB.timbal);
  const tm = tom(k, g.perc, TAM_DB.tom);
  const madera = ka(k, g.perc, TAM_DB.ka);
  const pl = platillos(k, g.perc, TAM_DB.platillos);
  const tubos = campanas(k, g.campanas, TAM_DB.tubos, 3.5, 6, 2.4);
  const t = new Tension();
  const on = { toms: false, golpes: false, todo: false };
  const rnd = azar(150);

  const reloj = new Reloj(transport, (n) => tamboresSegundo(n / 4), (n, time, d) => {
    t.seguir(d);
    const bar = Math.floor(n / 16);
    const st = n % 16;
    const { sec, i, vez } = lugar(TAM_FORMA, TAM_VUELTA, bar);
    const ac = TAM_ACORDES[sec.acordes[i]];
    const fase = sec.nombre === 'cuenta' ? -1 : Number(sec.nombre.slice(1)) + vez;
    const nuevo = st === 0 && (i === 0 || sec.acordes[i - 1] !== sec.acordes[i]);
    const dura = largo(sec, i) * 16 * d;
    const p = (i % 8) * 16 + st;
    const canto = sec.acordes.slice(i - (i % 8), i - (i % 8) + 8).join(' ') === TAM_CANTO_AC;
    if (st === 0 && i % 2 === 0) {
      on.toms = t.capa(on.toms, 0.4);
      on.golpes = t.capa(on.golpes, 0.65);
      on.todo = t.capa(on.todo, 0.85);
    }
    const h = (v: number) => v * (0.94 + 0.06 * rnd());
    const cantar = (synth: Tone.PolySynth<Tone.Synth> | Tone.PolySynth<Tone.MonoSynth>, mel: Melodia, dt: number, vel: number, legato = 0.9) => {
      const e = mel.get(p);
      if (e) synth.triggerAttackRelease(hz(e.n + dt), e.len * d * legato, time, h(vel));
    };

    // el pulso: un bombo en cada negra, siempre
    if (st % 4 === 0) bombo(time, sec.nombre === 'cuenta' ? 0.55 + 0.12 * (st / 4) : st === 0 ? 1 : 0.85);

    if (sec.nombre === 'cuenta') {
      if (st === 0) {
        pl.subida(time, 16 * d);
        bajos.triggerAttackRelease(hzs([50, 57]), 16 * d, time, 0.5);
        trombones.triggerAttackRelease(hzs([38, 45]), 16 * d, time, 0.45);
      }
      return;
    }
    if (bar === 1 && st === 0) {
      // ¡el golpe! en sol menor
      ha([55, 62, 67], time, 1);
      trombones.triggerAttackRelease(hzs([43, 50, 55]), 1, time, 0.9);
      timb(43, time, 1);
      pl.choque(time, 0.9);
    }

    // el canto: los bajos siempre; las trompas desde la fase 1, los trombones desde la 2, los altos al final
    const fuerte = fase >= 3;
    if (canto) {
      cantar(bajos, TAM_CANTO, -12, fase === 0 && i < 8 ? 0.7 : 0.85, 0.85);
      if (fase >= 1) cantar(trompas, TAM_CANTO, 0, 0.7, 0.85);
      if (fase >= 2) cantar(trombones, TAM_CANTO, -12, 0.6, 0.8);
      if (fase >= 4 || on.todo) cantar(altos, TAM_CANTO, 12, 0.6, 0.9);
      // «¡HA!» en el silencio del canto (cuarto tiempo de los compases 4 y 8)
      if (st === 12 && i % 4 === 3 && (fase >= 1 || i >= 8)) ha(i % 8 === 7 ? [55, 62, 67] : [55, 62], time, 0.85);
    } else {
      cantar(trompas, TAM_GUERRA, 0, 0.75, 0.92);
      if (fase >= 2) cantar(altos, TAM_GUERRA, 0, 0.65, 0.95);
      if (fase >= 3) cantar(trombones, TAM_GUERRA, -12, 0.55, 0.9);
      if (fase >= 4) cantar(bajos, TAM_GUERRA, -12, 0.6, 0.95);
      if (nuevo && fase < 4) bajos.triggerAttackRelease(hzs(ac.voces.map((v) => v - 12)), dura - 0.1, time, 0.4);
    }

    // el bajo y los colchones
    if (nuevo && (fase >= 1 || i >= 8)) contrabajo.triggerAttackRelease(hz(ac.bajo), dura - 0.1, time, 0.7);
    if (nuevo && (fase >= 1 || i >= 8) && !(canto && fase >= 2)) trombones.triggerAttackRelease(hzs([ac.bajo + 12, ac.bajo + 19]), dura - 0.1, time, fase === 0 ? 0.25 : 0.35);

    // cuerdas: corcheas desde la fase 2 (antes, si la cosa se pone tensa), semicorcheas desde la 4
    if ((fase >= 2 || on.golpes) && (fase >= 4 || st % 2 === 0)) {
      ost.triggerAttackRelease(hz(ac.bajo + 12 + TAM_OST[st]), d * (fase >= 4 ? 0.8 : 1.6), time, h(st % 4 === 0 ? 0.85 : 0.5));
    }

    // percusión de colores (nunca más fuerte que el bombo): ka en 2 y 4, toms a contratiempo, timbal en el 1
    if (fase >= 1 && (st === 4 || st === 12)) madera(time, h(0.6));
    if ((on.toms || fase >= 3) && st % 4 === 2) tm(st === 14 ? 50 : 55, time, h(0.4));
    if (fase >= 2 && st === 0) timb(ac.bajo < 38 ? ac.bajo + 7 : ac.bajo, time, h(0.7));
    // al final de cada frase de 8, redoble de timbal en el último tiempo
    if (fase >= 2 && i % 8 === 7 && st >= 12) timb(38, time, h(0.4 + 0.12 * (st - 12)));
    if (on.todo && i % 2 === 1 && st >= 12) tm(50 - (st - 12) * 2, time, h(0.35 + 0.1 * (st - 12)));
    if (on.golpes && st === 0) trombones.triggerAttackRelease(hzs([ac.bajo + 12, ac.bajo + 19]), 0.2, time, h(0.55));

    // platillos y campanas: cada 4 compases desde la fase 3, cada 2 en la 5 (o con todo)
    const cada = fase >= 5 || on.todo ? 2 : fase >= 3 ? 4 : 0;
    if (cada && st === 0 && i % cada === 0) pl.choque(time, i % 8 === 0 ? 0.8 : 0.5);
    if (fase >= 3 && i % 8 === 7 && st === 0) pl.subida(time, 16 * d, 0.6);
    if (fase >= 5 && st === 0 && i % 2 === 0) tubos.triggerAttackRelease(hzs([ac.voces[3] + 12]), 2, time, 0.6);
  });

  const song = {
    start: (time: number) => {
      reloj.start(time, PRUEBA.compas * 16);
      sonando = { reloj, transport };
    },
    stop: (time: number) => reloj.stop(time),
    intensity: (level: number) => {
      t.meta = level;
    },
    dispose: () => {
      reloj.clear();
      if (sonando?.reloj === reloj) sonando = null;
      k.dispose();
    },
    /** El pulso de esta canción (lo mismo que pulsoTambores() mientras sea la que suena). */
    pulso: () => (sonando?.reloj === reloj ? pulsoTambores() : null),
  };
  return song;
}

export const SONGS: SongDef[] = [
  {
    id: 'jefe.requiem',
    name: 'Jefe: réquiem para un golfista', // i18n-ok: el panel de pruebas
    role: 'jefe',
    blurb: 'Re menor, 80 por minuto: coro, órgano, timbales y campanas; los bajos citan el Dies irae y el clímax cierra en re mayor. Con tensión, taikos, contracanto de trompas y el coro entero.', // i18n-ok: el panel de pruebas
    build: requiem,
  },
  {
    id: 'jefe.batalla',
    name: 'Jefe: batalla en siete', // i18n-ok: el panel de pruebas
    role: 'jefe',
    blurb: 'Do menor en 7/8 (2+2+3), 0.1 s la semicorchea: taikos, cuerdas en ostinato, metales y gritos del coro; un solo de tambores y el clímax un tono arriba. Con tensión, rellenos, golpes de metales y taikos al doble.', // i18n-ok: el panel de pruebas
    build: batalla,
  },
  {
    id: 'jefe.tambores',
    name: 'Jefe: tambores de guerra', // i18n-ok: el panel de pruebas
    role: 'jefe',
    blurb: 'Un bombo en cada pulso que se apura de 90 a 150 en 3 minutos (para un jefe de ritmo: pulsoTambores()). Canto de guerra en sol dórico que crece hasta el tutti. Con tensión, toms, golpes de metales y platillos.', // i18n-ok: el panel de pruebas
    build: tambores,
  },
];
