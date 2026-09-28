// Música de la cinemática, sintetizada con Tone.js como el resto del audio del juego. Tres temas:
// - feria: nuestro mundo. Laúd, flauta dulce, tambor y pandereta, alegre y medieval de feria.
// - magia: el otro mundo. Coro, campanas y un zumbido grave, en menor.
// - horda: tambores y metales, que se suman encima de la magia cuando aparece la horda.
//
// Todo corre sobre el transporte de Tone en el tiempo del guion: cada nota sale de en qué segundo
// estamos, así que al saltar a otro punto la música sigue donde corresponde. Cuánto suena cada tema lo
// dice el guion (`music` en cada plano).
import * as Tone from 'tone';
import type { MusicTrack, Script } from './types';

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Un cambio de volumen de un tema, en segundos del guion. */
interface Change {
  at: number;
  level: number;
  fade: number;
  filter?: number;
}

const TRACKS: MusicTrack[] = ['feria', 'magia', 'horda'];

// ---------- la feria: corcheas de 0.25 s, compases de 2 s ----------
const FERIA_STEP = 0.25;
/** Re menor, Do, Re menor, La: dórico, suena a feria medieval. */
const FERIA_CHORDS = [[62, 65, 69], [60, 64, 67], [62, 65, 69], [57, 61, 64]];
const FERIA_BASS = [50, 48, 50, 45];
/** La melodía de la flauta, una corchea por casilla (null = sigue la nota anterior). */
const FERIA_TUNE: (number | null)[] = [
  69, null, 74, null, 76, 77, 76, 74,
  76, null, 72, null, 74, 76, 74, 72,
  69, null, 74, null, 77, null, 76, 74,
  73, null, 69, null, 76, null, 69, null,
];

// ---------- la magia y la horda: negras de 0.857 s (70 por minuto), corcheas de 0.43 ----------
const MAGIC_STEP = 60 / 70 / 2;
/** Re menor, Si bemol, Sol menor, La: un compás de cuatro negras cada uno. */
const MAGIC_CHORDS = [[50, 53, 57, 62], [46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 57]];

export class CineMusic {
  private readonly changes = new Map<MusicTrack, Change[]>();
  private readonly starts = new Map<MusicTrack, number>();
  private readonly gains = new Map<MusicTrack, Tone.Gain>();
  private readonly filters = new Map<MusicTrack, Tone.Filter>();
  private readonly shown = new Map<MusicTrack, number>();
  private readonly shownFilter = new Map<MusicTrack, number>();
  private readonly out = new Tone.Volume(-8).toDestination();
  private readonly meter = new Tone.Meter();
  private built = false;
  private horn: Tone.PolySynth | null = null;

  constructor(script: Script, shotStarts: readonly number[]) {
    for (const t of TRACKS) this.changes.set(t, []);
    script.shots.forEach((shot, i) => {
      for (const m of shot.music ?? []) {
        this.changes.get(m.track)!.push({ at: shotStarts[i] + m.at, level: m.level, fade: m.fade ?? 0.5, filter: m.filter });
      }
    });
    for (const [t, list] of this.changes) {
      list.sort((a, b) => a.at - b.at);
      // cada tema arranca su compás 1 cuando empieza a sonar, no en el segundo 0 del guion
      this.starts.set(t, list.find((c) => c.level > 0)?.at ?? 0);
    }
  }

  /** Arma los instrumentos y agenda los temas. Después de Tone.start (hace falta un click). */
  build(): void {
    if (this.built) return;
    this.built = true;
    this.out.connect(this.meter);
    // cada tema: instrumentos → reverb → filtro → volumen. El volumen va último para que un corte en
    // seco corte también la cola de la reverb (con una reverb compartida el golpe dejaba eco).
    const buses = new Map<MusicTrack, Tone.Gain>();
    for (const t of TRACKS) {
      const gain = new Tone.Gain(0).connect(this.out);
      const filter = new Tone.Filter(18000, 'lowpass').connect(gain);
      const reverb = new Tone.Freeverb({ roomSize: 0.82, dampening: 2600, wet: 0.3 }).connect(filter);
      buses.set(t, new Tone.Gain(1).connect(reverb));
      this.gains.set(t, gain);
      this.filters.set(t, filter);
      this.shown.set(t, 0);
    }
    this.buildFeria(buses.get('feria')!);
    this.buildMagia(buses.get('magia')!);
    this.buildHorda(buses.get('horda')!);
    this.horn = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.05, sustain: 0.8, release: 0.08 }, volume: -16 }).connect(this.out);
  }

  /** Cuántos pasos del tema van en el instante de audio `time` (así sale igual después de saltar). */
  private stepAt(track: MusicTrack, time: number, step: number): number {
    const seconds = Tone.getTransport().getSecondsAtTime(time);
    return Math.round((seconds - this.starts.get(track)!) / step);
  }

  private repeat(track: MusicTrack, step: number, play: (i: number, time: number) => void): void {
    Tone.getTransport().scheduleRepeat((time) => {
      if ((this.shown.get(track) ?? 0) <= 0.001) return;
      play(this.stepAt(track, time, step), time);
    }, step, this.starts.get(track)!);
  }

  private buildFeria(out: Tone.Gain): void {
    const lute = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.35, sustain: 0.05, release: 0.3 }, volume: -10 }).connect(out);
    const vibrato = new Tone.Vibrato(5.5, 0.12).connect(out);
    const flute = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.04, decay: 0.1, sustain: 0.8, release: 0.12 }, volume: -9 }).connect(vibrato);
    const drum = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -8 }).connect(out);
    const bell = new Tone.Filter(7000, 'highpass').connect(out);
    const tambourine = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: -20 }).connect(bell);
    this.repeat('feria', FERIA_STEP, (i, time) => {
      if (i < 0) return;
      const bar = Math.floor(i / 8) % 4;
      const beat = i % 8;
      const chord = FERIA_CHORDS[bar];
      lute.triggerAttackRelease(midi(chord[[0, 1, 2, 1, 0, 1, 2, 1][beat]] - 12), 0.3, time, beat % 2 ? 0.5 : 0.8);
      if (beat === 0 || beat === 4) lute.triggerAttackRelease(midi(FERIA_BASS[bar] - 12), 0.6, time, 0.7);
      // la flauta entra en la segunda vuelta
      if (i >= 32) {
        const k = i % 32;
        const note = FERIA_TUNE[k];
        if (note !== null) {
          let len = 1;
          while (k + len < 32 && FERIA_TUNE[k + len] === null) len++;
          flute.triggerAttackRelease(midi(note), len * FERIA_STEP * 0.92, time);
        }
      }
      if (beat === 0 || beat === 4) drum.triggerAttackRelease(beat === 0 ? 'D2' : 'A1', 0.2, time, beat === 0 ? 0.9 : 0.6);
      if (beat === 2 || beat === 6 || beat === 7) tambourine.triggerAttackRelease(0.05, time, beat === 7 ? 0.35 : 0.6);
    });
  }

  private buildMagia(out: Tone.Gain): void {
    const choirFilter = new Tone.Filter(1300, 'lowpass').connect(out);
    const chorus = new Tone.Chorus(0.6, 3.5, 0.5).connect(choirFilter).start();
    const choir = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 22 }, envelope: { attack: 1.1, decay: 0.5, sustain: 0.8, release: 2.2 }, volume: -20 }).connect(chorus);
    const bells = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 }, modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.5 }, volume: -22 }).connect(out);
    const drone = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 1.5, decay: 0.2, sustain: 1, release: 2 }, volume: -14 }).connect(out);
    this.repeat('magia', MAGIC_STEP, (i, time) => {
      if (i < 0) return;
      const bar = Math.floor(i / 8) % 4;
      const step = i % 8;
      const chord = MAGIC_CHORDS[bar];
      if (step === 0) {
        choir.triggerAttackRelease(chord.map((m) => midi(m + 12)), MAGIC_STEP * 7.5, time);
        drone.triggerAttackRelease(midi(chord[0] - 12), MAGIC_STEP * 7.8, time);
      }
      // campanas: un arpegio que sube, salteado, arriba de todo
      if (step === 1 || step === 3 || step === 4 || step === 6) {
        const note = chord[[1, 2, 3, 2][[1, 3, 4, 6].indexOf(step)]] + 24;
        bells.triggerAttackRelease(midi(note), 1.2, time, 0.6);
      }
    });
  }

  private buildHorda(out: Tone.Gain): void {
    const taiko = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 5, envelope: { attack: 0.001, decay: 0.6, sustain: 0 }, volume: -2 }).connect(out);
    const brassFilter = new Tone.Filter(900, 'lowpass').connect(out);
    const brass = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.08, decay: 0.3, sustain: 0.6, release: 0.5 }, volume: -16 }).connect(brassFilter);
    this.repeat('horda', MAGIC_STEP, (i, time) => {
      if (i < 0) return;
      const bar = Math.floor(i / 8) % 4;
      const step = i % 8;
      if ([0, 3, 4, 6, 7].includes(step)) taiko.triggerAttackRelease(step === 0 ? 'C1' : 'G1', 0.4, time, step === 0 ? 1 : step === 4 ? 0.8 : 0.5);
      if (step === 0 || step === 5) {
        const root = MAGIC_CHORDS[bar][0];
        brass.triggerAttackRelease([midi(root), midi(root + 7)], MAGIC_STEP * (step === 0 ? 2.5 : 1.2), time, 0.8);
      }
    });
  }

  /** Nivel de un tema en el segundo `t`: cada cambio va del nivel anterior al nuevo en `fade` segundos. */
  private levelAt(track: MusicTrack, t: number): { level: number; filter: number } {
    let level = 0;
    let filter = 18000;
    for (const c of this.changes.get(track)!) {
      if (t < c.at) break;
      const u = c.fade > 0 ? Math.min(1, (t - c.at) / c.fade) : 1;
      level = level + (c.level - level) * u;
      if (c.filter !== undefined) filter = c.filter;
    }
    return { level, filter };
  }

  /** Cada cuadro: el transporte en el segundo del guion, y cada tema con su volumen. */
  sync(t: number, playing: boolean): void {
    if (!this.built) return;
    const transport = Tone.getTransport();
    if (!playing) {
      if (transport.state === 'started') transport.pause();
      return;
    }
    if (transport.state !== 'started') {
      transport.seconds = t;
      transport.start();
    } else if (Math.abs(transport.seconds - t) > 0.2) {
      transport.seconds = t;
    }
    for (const track of TRACKS) {
      const { level, filter } = this.levelAt(track, t);
      if (Math.abs(level - (this.shown.get(track) ?? 0)) > 0.005) {
        this.gains.get(track)!.gain.rampTo(level, 0.05);
        this.shown.set(track, level);
      }
      if (this.shownFilter.get(track) !== filter) {
        this.filters.get(track)!.frequency.rampTo(filter, 0.3);
        this.shownFilter.set(track, filter);
      }
    }
  }

  /** Nivel de salida en dB (-Infinity = silencio). */
  level(): number {
    return this.built ? (this.meter.getValue() as number) : -Infinity;
  }

  /** La bocina del auto: dos notas desafinadas, cortas. */
  honk(): void {
    if (!this.horn) return;
    const now = Tone.now();
    this.horn.triggerAttackRelease([midi(69), midi(72.6)], 0.22, now);
    this.horn.triggerAttackRelease([midi(69), midi(72.6)], 0.55, now + 0.3);
  }
}
