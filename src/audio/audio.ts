// Audio del juego con Tone.js: todo sintetizado. Swing, impactos, encantamientos, monstruos, y
// una música de fondo simple que corre sobre el transporte.
import * as Tone from 'tone';

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Las notas de las bajas de un mismo tiro, una más aguda por baja: el arpegio de sol mayor, que entra en
 * el re dórico de la música y no se confunde con el do mayor de la carga.
 */
const KILL_NOTES = [67, 71, 74, 79, 83, 86, 91];
/**
 * Las bajas que caen en el mismo instante (un área) salen separadas por esto, como un rasgueo rápido: se
 * oye cada una y igual suenan juntas.
 */
const KILL_STRUM = 0.06;

const MUTE_KEY = 'gk-music-muted';
function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export class GameAudio {
  private master!: Tone.Limiter;
  private musicBus!: Tone.Gain;
  private click!: Tone.MembraneSynth;
  private thudSynth!: Tone.MembraneSynth;
  private boom!: Tone.MembraneSynth;
  private noise!: Tone.NoiseSynth;
  private whooshNoise!: Tone.NoiseSynth;
  private whooshFilter!: Tone.Filter;
  private zapSynth!: Tone.Synth;
  private bell!: Tone.PolySynth;
  private growlSynth!: Tone.Synth;
  private horn!: Tone.PolySynth;
  private pluck!: Tone.PolySynth;
  private pad!: Tone.PolySynth;
  private chargeSynth!: Tone.Synth;
  private killBell!: Tone.PolySynth<Tone.FMSynth>;
  /** Cuándo sonó la última baja: la siguiente no sale antes de `KILL_STRUM` después. */
  private killAt = 0;
  ready = false;
  /** La música silenciada con M. Se guarda en el navegador: reiniciar recarga la página y no la tiene que volver a prender. */
  muted = loadMuted();
  private readonly lastPlayed = new Map<string, number>();

  private readonly lastTime = new Map<object, number>();

  constructor() {
    // Un error de audio nunca tiene que cortar el cuadro del juego: los efectos se llaman desde el
    // medio del update de pelotas y enemigos.
    const sfx = ['chargeTick', 'duff', 'whoosh', 'tock', 'thud', 'kill', 'bounce', 'explosion', 'zap', 'frost', 'growl', 'gateHit', 'hurt', 'waveHorn', 'victory', 'defeat'] as const;
    for (const name of sfx) {
      const fn = (this[name] as (...args: unknown[]) => void).bind(this);
      (this as Record<string, unknown>)[name] = (...args: unknown[]) => {
        try {
          fn(...args);
        } catch (e) {
          console.warn(`audio ${name}:`, e);
        }
      };
    }
  }

  /**
   * Instante de disparo para un sinte, estrictamente creciente: el reloj de audio avanza de a saltos y
   * dos sonidos en cuadros seguidos pueden caer en el mismo instante, cosa que Tone rechaza con una excepcion.
   */
  private at(synth: object, delay = 0): number {
    const t = Math.max(Tone.now() + delay, (this.lastTime.get(synth) ?? 0) + 0.03);
    this.lastTime.set(synth, t);
    return t;
  }

  /** Limita cada efecto a un disparo cada `ms`, para que una ráfaga de impactos no sature. */
  private ok(name: string, ms = 50): boolean {
    if (!this.ready) return false;
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? -1e9) < ms) return false;
    this.lastPlayed.set(name, now);
    return true;
  }

  async start(): Promise<void> {
    await Tone.start();
    this.master = new Tone.Limiter(-1).toDestination();
    const verb = new Tone.Freeverb({ roomSize: 0.7, dampening: 2500, wet: 0.25 }).connect(this.master);
    this.musicBus = new Tone.Gain(this.muted ? 0 : 0.8).connect(verb);

    this.click = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 }, volume: -4 }).connect(this.master);
    this.thudSynth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }, volume: -8 }).connect(this.master);
    this.boom = new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 7, envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.3 }, volume: -3 }).connect(this.master);
    this.noise = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.005, decay: 0.35, sustain: 0, release: 0.1 }, volume: -8 });
    this.noise.chain(new Tone.Filter(1200, 'lowpass'), this.master);
    this.whooshFilter = new Tone.Filter(900, 'bandpass');
    this.whooshNoise = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.04, decay: 0.14, sustain: 0, release: 0.08 }, volume: -10 });
    this.whooshNoise.chain(this.whooshFilter, this.master);
    this.zapSynth = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }, volume: -14 });
    this.zapSynth.chain(new Tone.Filter(3000, 'highpass'), verb);
    this.bell = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.4 }, volume: -12 }).connect(verb);
    const growlChain = new Tone.Distortion(0.6);
    growlChain.chain(new Tone.Filter(420, 'lowpass'), this.master);
    this.growlSynth = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.12 }, volume: -16 }).connect(growlChain);
    this.horn = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.08, decay: 0.2, sustain: 0.8, release: 0.5 }, volume: -16 });
    this.horn.chain(new Tone.Filter(900, 'lowpass'), verb);

    this.pluck = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.003, decay: 0.3, sustain: 0.05, release: 0.3 }, volume: -20 }).connect(this.musicBus);
    this.pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.6 }, volume: -24 }).connect(this.musicBus);
    this.chargeSynth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.08 }, volume: -11 }).connect(verb);
    // campana de FM: el «tin» lo da la modulación, que se apaga enseguida, y la nota queda sonando
    this.killBell = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2, modulationIndex: 5,
      envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.6 },
      modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.1 },
      volume: -9,
    }).connect(verb);
    this.ready = true;
  }

  /**
   * Una nota por escalón de carga, para timear el tiro de oído: el acorde mayor (do, mi, sol) para los
   * tres niveles de daño, y la octava para el crítico.
   */
  chargeTick(level: number): void {
    if (!this.ready) return;
    const notes = ['C5', 'E5', 'G5', 'C6'];
    const note = notes[Math.min(notes.length, Math.max(1, level)) - 1];
    this.chargeSynth.triggerAttackRelease(note, level >= notes.length ? 0.22 : 0.09, this.at(this.chargeSynth), level >= notes.length ? 1 : 0.75);
  }

  /** Música de fondo: progresión modal en re dórico, arpegio de laúd y colchón. */
  startMusic(): void {
    const transport = Tone.getTransport();
    transport.bpm.value = 112;
    const chords = [[50, 57, 62, 65], [48, 55, 60, 64], [53, 57, 60, 65], [55, 59, 62, 67]];
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    let step = 0;
    transport.scheduleRepeat((time) => {
      const bar = Math.floor(step / 8) % chords.length;
      const chord = chords[bar];
      if (step % 8 === 0) this.pad.triggerAttackRelease(chord.slice(0, 3).map((m) => midiToFreq(m - 12)), '1m', time);
      this.pluck.triggerAttackRelease(midiToFreq(chord[pattern[step % 8]] + 12), '8n', time, step % 4 === 0 ? 0.9 : 0.55);
      step++;
    }, '8n', 0);
    transport.start();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.musicBus.gain.rampTo(this.muted ? 0 : 0.8, 0.2);
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch { /* sin localStorage: vale hasta recargar */ }
    return this.muted;
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  resume(): void {
    Tone.getTransport().start();
  }

  /** El palo cortando el aire; más agudo cuanto más potencia. */
  whoosh(power: number): void {
    if (!this.ok('whoosh')) return;
    this.whooshFilter.frequency.value = 600 + 1600 * power;
    this.whooshNoise.triggerAttackRelease(0.2, this.at(this.whooshNoise));
  }

  /** La pifia: el palo pasa y la pelota no sale. Dos notas que caen, tipo «bwomp». */
  duff(): void {
    if (!this.ok('duff', 150)) return;
    const t = this.at(this.growlSynth);
    this.growlSynth.triggerAttackRelease(220, 0.32, t);
    this.growlSynth.frequency.exponentialRampToValueAtTime(90, t + 0.32);
  }

  /** Impacto del palo con la pelota. */
  tock(perfect: boolean): void {
    if (!this.ok('tock')) return;
    const t = this.at(this.click);
    this.click.triggerAttackRelease(perfect ? 'G4' : 'D4', '32n', t);
    if (perfect) this.bell.triggerAttackRelease([midiToFreq(86), midiToFreq(91)], 0.4, t + 0.02);
  }

  /** La pelota le pega a un enemigo. */
  thud(): void {
    if (!this.ok('thud')) return;
    this.thudSynth.triggerAttackRelease('A1', '16n', this.at(this.thudSynth));
  }

  /**
   * Una baja. `nth` es cuántas lleva el mismo tiro: la segunda suena más aguda, la tercera más, y como
   * cada nota sigue sonando, se arma el acorde. Sin límite de ráfaga: cada baja tiene que sonar.
   */
  kill(nth: number): void {
    if (!this.ready) return;
    const i = Math.min(KILL_NOTES.length, Math.max(1, nth)) - 1;
    const t = Math.max(Tone.now(), this.killAt + KILL_STRUM);
    this.killAt = t;
    this.killBell.triggerAttackRelease(midiToFreq(KILL_NOTES[i]), 0.5, t, Math.min(1, 0.65 + 0.06 * i));
  }

  bounce(): void {
    if (!this.ok('bounce')) return;
    this.click.triggerAttackRelease('A2', '64n', this.at(this.click), 0.35);
  }

  explosion(): void {
    if (!this.ok('explosion', 120)) return;
    this.boom.triggerAttackRelease('C1', '4n', this.at(this.boom));
    this.noise.triggerAttackRelease(0.4, this.at(this.noise));
  }

  zap(): void {
    if (!this.ok('zap')) return;
    const t = this.at(this.zapSynth);
    this.zapSynth.triggerAttackRelease(1800, 0.12, t);
    this.zapSynth.frequency.exponentialRampToValueAtTime(300, t + 0.12);
  }

  frost(): void {
    if (!this.ok('frost')) return;
    this.bell.triggerAttackRelease([midiToFreq(88), midiToFreq(95), midiToFreq(100)], 0.5, Tone.now(), 0.6);
  }

  growl(): void {
    if (!this.ok('growl', 120)) return;
    const t = this.at(this.growlSynth);
    this.growlSynth.triggerAttackRelease(80, 0.22, t);
    this.growlSynth.frequency.exponentialRampToValueAtTime(52, t + 0.22);
  }

  /** Golpe contra la puerta de la ciudad. */
  gateHit(): void {
    if (!this.ok('gateHit', 120)) return;
    this.boom.triggerAttackRelease('E1', '8n', this.at(this.boom), 0.7);
  }

  /** Golpe que recibe el golfista. */
  hurt(): void {
    if (!this.ok('hurt')) return;
    // sin ruido: comparte instante con la explosión de un bombín, y NoiseSynth no admite dos disparos juntos
    this.thudSynth.triggerAttackRelease('E2', '8n', this.at(this.thudSynth));
  }

  /** Cuerno que anuncia una oleada. */
  waveHorn(): void {
    if (!this.ok('waveHorn')) return;
    const t = Tone.now();
    this.horn.triggerAttackRelease([midiToFreq(50), midiToFreq(57)], 0.7, t);
    this.horn.triggerAttackRelease([midiToFreq(53), midiToFreq(60)], 1.0, t + 0.75);
  }

  victory(): void {
    const t = Tone.now();
    [62, 66, 69, 74].forEach((m, i) => this.bell.triggerAttackRelease(midiToFreq(m + 12), 0.6, t + i * 0.16));
  }

  defeat(): void {
    const t = Tone.now();
    [57, 53, 50].forEach((m, i) => this.horn.triggerAttackRelease(midiToFreq(m - 12), 0.8, t + i * 0.45));
  }
}
