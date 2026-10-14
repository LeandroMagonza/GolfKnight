// Audio del juego con Tone.js: sintetizado (swing, impactos, encantamientos, monstruos, y una música de
// fondo simple que corre sobre el transporte) y, desde el 14/10, sonidos grabados (ver audio/samples y
// POLISH en core/polish): con su llave prendida y el archivo bajado suena el grabado; si no, el de siempre.
// La segunda tanda del 14/10 (docs/assets-sonidos.md): el golpe de cada palo, la pelota según de qué está
// hecho el enemigo, sus quejidos, un sonido por tipo de poder, y la mezcla sin saturar ni retraso.
import * as Tone from 'tone';
import { polished, type PolishKey } from '../core/polish';
import { SampleBank } from './samples';

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * **Un solo arpegio para el palo y las bajas** (do mayor desde do4: 1ra, 3ra, 5ta, 8va, 10ma...). La carga
 * suena en el escalón de su nivel (golpe 1 = 1ra, 2 = 3ra, 3 = 5ta) y cada baja del tiro sube uno más
 * desde ahí: con un golpe 2, la primera baja es la 5ta y la segunda la 8va. Así matar suena como seguir
 * el golpe hacia arriba.
 */
const BASE_NOTE = 60;
const ARPEGGIO = [0, 4, 7, 12, 16, 19, 24, 28, 31, 36];
const arpeggioNote = (step: number) => BASE_NOTE + ARPEGGIO[Math.min(ARPEGGIO.length - 1, Math.max(0, step))];
/**
 * Las bajas que caen en el mismo instante (un área) salen separadas por esto, como un rasgueo rápido: se
 * oye cada una y igual suenan juntas.
 */
const KILL_STRUM = 0.06;

/**
 * El golpe del palo: un grabado por palo, más fuerte cuanto mejor el golpe (niveles 1, 2 y 3). El nivel ya
 * se oye en la nota de la carga; esto es el contacto.
 */
const CLUB_VOLUME = [0.55, 0.75, 0.95];
/** De qué suena cada enemigo al recibir la pelota. El resto, golpe seco en el cuerpo (`ball-hit`, `hit-heavy`). */
const HIT_SOUND: Record<string, string> = {
  skeleton: 'hit-bone', knight: 'hit-armor', stoneling: 'hit-stone', golem: 'hit-stone', wraith: 'hit-soft',
};

const MUTE_KEY = 'gk-music-muted';
/** Todo el sonido apagado (N): música y efectos. */
const ALL_KEY = 'gk-all-muted';
function loadMuted(key = MUTE_KEY): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export class GameAudio {
  private master!: Tone.ToneAudioNode;
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
  /** Los grabados (ver SampleBank). */
  private bank: SampleBank | null = null;
  /** Cuándo sonó la última baja: la siguiente no sale antes de `KILL_STRUM` después. */
  private killAt = 0;
  ready = false;
  /** La música silenciada con M. Se guarda en el navegador: reiniciar recarga la página y no la tiene que volver a prender. */
  muted = loadMuted();
  /** Todo silenciado con N (música y efectos), en el que juega y en el que mira. También se guarda. */
  allMuted = loadMuted(ALL_KEY);
  private readonly lastPlayed = new Map<string, number>();
  /**
   * Perdiste: la horda sigue moviéndose detrás del cartel, pero ya no suena (la puerta, los golpes, los
   * gruñidos). Pedido de Leandro (14/10). Lo pone `hush`.
   */
  private quietWorld = false;
  /** Para las pruebas: lo que sale, para medir picos (ver `tap`). */
  private probe: AnalyserNode | null = null;

  private readonly lastTime = new Map<object, number>();

  constructor() {
    // Un error de audio nunca tiene que cortar el cuadro del juego: los efectos se llaman desde el
    // medio del update de pelotas y enemigos.
    const sfx = ['chargeTick', 'duff', 'whoosh', 'tock', 'thud', 'kill', 'bounce', 'explosion', 'zap', 'frost', 'growl', 'gateHit', 'hurt', 'waveHorn', 'victory', 'defeat', 'unlock',
      'death', 'eliteAlert', 'bossAppear', 'bossThrow', 'bossRock', 'bubblePop', 'bubbleUp', 'armorHit', 'ricochet', 'phaseBounce', 'heal', 'dodge', 'dodgeReady',
      'casterCast', 'casterHit', 'burnTick', 'burning', 'waveClear', 'cardAppear', 'cardPick', 'uiClick', 'playerDies', 'hole', 'cast', 'trample',
      'ballHit', 'groan', 'meleeHit', 'hush'] as const;
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
    const t = Math.max(this.now() + delay, (this.lastTime.get(synth) ?? 0) + 0.03);
    this.lastTime.set(synth, t);
    return t;
  }

  /**
   * El instante de ahora para los efectos. `Tone.now()` le suma el adelanto con que Tone agenda la música
   * (0,1 s): todo sonaba una décima tarde, y el golpe del palo se oía después del golpe (Leandro: «sale a
   * destiempo»). Con `POLISH.onTime` suenan en el acto; la música sigue con su adelanto.
   */
  private now(): number {
    return polished('onTime') ? Tone.immediate() : Tone.now();
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
    Tone.getDestination().mute = this.allMuted;
    // el final de todo (POLISH.mix): un limitador de verdad, de rodilla dura y que suelta en 150 ms. El
    // `Limiter` de Tone es un compresor con rodilla de 30 dB y suelta de 10 ms: con varios grabados juntos
    // casi no frenaba, la suma pasaba de 0 dB y recortaba a la salida (Leandro: «no sabés si está saturado»)
    const mix = polished('mix');
    this.master = mix
      ? new Tone.Compressor({ threshold: -3, ratio: 20, knee: 0, attack: 0.002, release: 0.15 }).toDestination()
      : new Tone.Limiter(-1).toDestination();
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
    // los grabados van directo al limitador, sin la reverb de los sintetizados; con la mezcla nueva, más
    // bajos: vienen normalizados a -1 dB de pico y varios juntos se suman
    const sampleBus = new Tone.Gain(mix ? 0.6 : 0.9).connect(this.master);
    this.bank = new SampleBank(sampleBus, () => this.now());
    void this.bank.load();
    this.ready = true;
  }

  /** Suena el grabado `name` si su llave (`key`) está prendida y ya llegó. Devuelve si sonó. */
  private sample(key: PolishKey, name: string, volume = 1, jitter = 0.05, ms = 40, delay = 0): boolean {
    if (!this.ready || !this.bank || !polished(key)) return false;
    return this.bank.play(name, volume, jitter, ms, delay);
  }

  /** ¿Hay grabado para `name` con su llave prendida? (para no sonar dos veces lo mismo) */
  private hasSample(key: PolishKey, name: string): boolean {
    return this.ready && !!this.bank && polished(key) && this.bank.has(name);
  }

  /**
   * Una nota por escalón de carga, para timear el tiro de oído: 1ra, 3ra y 5ta del arpegio para los tres
   * niveles del golpe (ver `ARPEGGIO`).
   */
  chargeTick(level: number): void {
    if (!this.ready) return;
    this.chargeSynth.triggerAttackRelease(midiToFreq(arpeggioNote(level - 1)), 0.09, this.at(this.chargeSynth), 0.75);
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

  /** Apaga o prende todo el sonido. Devuelve si quedó apagado. */
  toggleAll(): boolean {
    this.allMuted = !this.allMuted;
    if (this.ready) Tone.getDestination().mute = this.allMuted;
    try {
      localStorage.setItem(ALL_KEY, this.allMuted ? '1' : '0');
    } catch { /* sin localStorage: vale hasta recargar */ }
    return this.allMuted;
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
    if (this.sample('samples', 'duff', 0.8)) return;
    const t = this.at(this.growlSynth);
    this.growlSynth.triggerAttackRelease(220, 0.32, t);
    this.growlSynth.frequency.exponentialRampToValueAtTime(90, t + 0.32);
  }

  /** Impacto del palo con la pelota: el de ese palo (`club`), más fuerte cuanto mejor el golpe. */
  tock(perfect: boolean, quality = 0, club = ''): void {
    if (!this.ok('tock')) return;
    // grabado: el golpe del palo, y la estrellita del perfecto encima
    if (quality >= 1 && club && this.sample('samples', `club-${club}`, CLUB_VOLUME[Math.min(3, quality) - 1], 0.04)) {
      if (perfect) this.sample('samples', 'perfect', 0.7, 0.02, 40, 0.03);
      return;
    }
    const t = this.at(this.click);
    this.click.triggerAttackRelease(perfect ? 'G4' : 'D4', '32n', t);
    if (perfect) this.bell.triggerAttackRelease([midiToFreq(86), midiToFreq(91)], 0.4, t + 0.02);
  }

  /** Un golpe sordo: la pelota que cae, el hoyo, el empujón. */
  thud(): void {
    if (!this.ok('thud')) return;
    if (this.sample('samples', 'hit-soft', 0.6, 0.08)) return;
    this.thudSynth.triggerAttackRelease('A1', '16n', this.at(this.thudSynth));
  }

  /**
   * La pelota le pega a un enemigo (`kind`): según de qué está hecho, y más pesado con el golpe 3. El
   * blindado, a metal.
   */
  ballHit(kind: string, quality: number, armored: boolean): void {
    if (armored) {
      this.armorHit();
      return;
    }
    if (!this.ok('ballHit', 35)) return;
    const name = HIT_SOUND[kind] ?? (quality >= 3 ? 'hit-heavy' : 'ball-hit');
    if (this.sample('samples', name, quality >= 3 ? 0.85 : 0.7, 0.06, 35)) return;
    this.thudSynth.triggerAttackRelease('A1', '16n', this.at(this.thudSynth));
  }

  /**
   * Un enemigo se queja al recibir sin morir: cada tipo con su voz, un toque después del golpe para que se
   * oiga primero el impacto. El élite gruñe grave cada vez que le pegan (Leandro, 14/10), y el jefe con la
   * suya.
   */
  groan(kind: string, elite: boolean, boss: boolean): void {
    if (this.quietWorld) return;
    if (boss) {
      this.sample('groans', 'hurt-golem', 0.7, 0.04, 400, 0.05);
      return;
    }
    if (elite) {
      this.sample('groans', 'elite-hurt', 0.8, 0.04, 220, 0.05);
      return;
    }
    if (!this.ok('groan', 70)) return;
    this.sample('groans', `hurt-${kind}`, 0.42, 0.08, 110, 0.05);
  }

  /**
   * Una baja, en el escalón `step` del arpegio: el nivel del golpe menos uno, más cuántas lleva el tiro
   * (ver `ARPEGGIO`). Como cada nota sigue sonando, las bajas seguidas arman el acorde. Sin límite de
   * ráfaga: cada baja tiene que sonar.
   */
  kill(step: number): void {
    if (!this.ready) return;
    const t = Math.max(this.now(), this.killAt + KILL_STRUM);
    this.killAt = t;
    this.killBell.triggerAttackRelease(midiToFreq(arpeggioNote(step)), 0.5, t, Math.min(1, 0.6 + 0.06 * step));
  }

  bounce(): void {
    if (!this.ok('bounce')) return;
    this.click.triggerAttackRelease('A2', '64n', this.at(this.click), 0.35);
  }

  explosion(big = false): void {
    if (this.quietWorld || !this.ok('explosion', 120)) return;
    if (this.sample('samples', big ? 'explosion-big' : 'explosion-small', big ? 0.9 : 0.75, 0.06)) return;
    this.boom.triggerAttackRelease('C1', '4n', this.at(this.boom));
    this.noise.triggerAttackRelease(0.4, this.at(this.noise));
  }

  zap(): void {
    if (!this.ok('zap')) return;
    if (this.sample('samples', 'lightning-chain', 0.6, 0.06)) return;
    const t = this.at(this.zapSynth);
    this.zapSynth.triggerAttackRelease(1800, 0.12, t);
    this.zapSynth.frequency.exponentialRampToValueAtTime(300, t + 0.12);
  }

  frost(): void {
    if (!this.ok('frost')) return;
    if (this.sample('samples', 'ice', 0.7)) return;
    this.bell.triggerAttackRelease([midiToFreq(88), midiToFreq(95), midiToFreq(100)], 0.5, this.now(), 0.6);
  }

  growl(): void {
    if (this.quietWorld || !this.ok('growl', 120)) return;
    const t = this.at(this.growlSynth);
    this.growlSynth.triggerAttackRelease(80, 0.22, t);
    this.growlSynth.frequency.exponentialRampToValueAtTime(52, t + 0.22);
  }

  /** Golpe contra la puerta de la ciudad. */
  gateHit(): void {
    if (this.quietWorld || !this.ok('gateHit', 120)) return;
    if (this.sample('samples', 'gate-hit', 0.85)) return;
    this.boom.triggerAttackRelease('E1', '8n', this.at(this.boom), 0.7);
  }

  /** Golpe que recibe el golfista. */
  hurt(): void {
    if (this.quietWorld || !this.ok('hurt')) return;
    if (this.sample('samples', 'hurt', 0.85)) return;
    // sin ruido: comparte instante con la explosión de un bombín, y NoiseSynth no admite dos disparos juntos
    this.thudSynth.triggerAttackRelease('E2', '8n', this.at(this.thudSynth));
  }

  /** Cuerno que anuncia una oleada. */
  waveHorn(): void {
    if (!this.ok('waveHorn')) return;
    const t = this.now();
    this.horn.triggerAttackRelease([midiToFreq(50), midiToFreq(57)], 0.7, t);
    this.horn.triggerAttackRelease([midiToFreq(53), midiToFreq(60)], 1.0, t + 0.75);
  }

  victory(): void {
    if (this.sample('samples', 'victory', 0.8, 0)) return;
    const t = this.now();
    [62, 66, 69, 74].forEach((m, i) => this.bell.triggerAttackRelease(midiToFreq(m + 12), 0.6, t + i * 0.16));
  }

  /**
   * Se desbloqueó un nivel de dificultad: un golpe grave, un acorde menor de cuernos que queda sonando y
   * campanas que suben. Amenaza más que festeja. `max`: el último nivel, más grave y más largo.
   */
  unlock(max: boolean): void {
    if (!this.ready) return;
    const t = this.now();
    this.boom.triggerAttackRelease(max ? 'A0' : 'C1', '2n', this.at(this.boom));
    this.noise.triggerAttackRelease(0.7, this.at(this.noise));
    const low = max ? 36 : 38;
    this.horn.triggerAttackRelease([low, low + 7, low + 12, low + 15].map(midiToFreq), max ? 2.4 : 1.6, t + 0.04);
    [0, 3, 7, 12].forEach((m, i) => this.bell.triggerAttackRelease(midiToFreq(low + 36 + m), 0.5, t + 0.18 + i * 0.09, 0.7));
  }

  defeat(): void {
    if (this.sample('samples', 'defeat', 0.8, 0)) return;
    const t = this.now();
    [57, 53, 50].forEach((m, i) => this.horn.triggerAttackRelease(midiToFreq(m - 12), 0.8, t + i * 0.45));
  }

  // ---- los grabados nuevos (14/10): si no hay archivo o la llave está apagada, no suenan (o suena lo de siempre) ----

  /** La voz de muerte de un enemigo (`kind`: goblin, orc, knight...). */
  death(kind: string): void {
    // el gólem jefe tiene la suya, más larga
    if (kind === 'golem') this.sample('voices', 'boss-death', 0.9, 0, 500);
    else this.sample('voices', `death-${kind}`, 0.6, 0.07, 90);
  }

  /** Aparece un élite. */
  eliteAlert(): void {
    this.sample('voices', 'elite-alert', 0.8, 0, 500);
  }

  /** El jefe: aparece, tira la roca, la roca cae. */
  bossAppear(): void {
    this.sample('voices', 'boss-appear', 0.9, 0, 1000);
  }

  bossThrow(): void {
    if (this.quietWorld) return;
    if (!this.sample('voices', 'boss-throw', 0.7, 0.05, 300)) this.growl();
  }

  bossRock(): void {
    if (this.quietWorld) return;
    this.sample('voices', 'boss-rock', 0.8, 0.05, 150);
  }

  /** Se revienta la burbuja del bendito. Si no hay grabado, el rebote de siempre. */
  bubblePop(): void {
    if (!this.sample('powerSounds', 'bubble-pop', 0.75, 0.06, 60)) this.bounce();
  }

  /** La burbuja se vuelve a armar. */
  bubbleUp(): void {
    this.sample('powerSounds', 'bubble-up', 0.45, 0.05, 120);
  }

  /** La pelota pega en un blindado: metal. Si no, el golpe de siempre. */
  armorHit(): void {
    if (!this.sample('powerSounds', 'armor-hit', 0.7, 0.08, 50)) this.thud();
  }

  /** La pelota rebota en un escudo. */
  ricochet(): void {
    if (!this.sample('powerSounds', 'ricochet', 0.65, 0.08, 50)) this.bounce();
  }

  /** La pelota rebota contra un intocable o un protegido por el chamán. */
  phaseBounce(): void {
    if (!this.sample('powerSounds', 'phase-bounce', 0.65, 0.06, 50)) this.bounce();
  }

  /** Uno se cura. */
  heal(): void {
    this.sample('powerSounds', 'heal', 0.5, 0.05, 150);
  }

  /** Uno esquiva. Si no, el whoosh de siempre. */
  dodge(): void {
    if (!this.sample('powerSounds', 'dodge', 0.6, 0.08, 60)) this.whoosh(0.5);
  }

  /** A uno le volvió la esquiva: muy bajito. */
  dodgeReady(): void {
    this.sample('powerSounds', 'dodge-ready', 0.3, 0.05, 150);
  }

  /** Un hechicero enemigo tira y su hechizo cae. Si no, el zap y nada. */
  casterCast(): void {
    if (this.quietWorld) return;
    if (!this.sample('powerSounds', 'caster-cast', 0.5, 0.06, 120)) this.zap();
  }

  casterHit(): void {
    if (this.quietWorld) return;
    this.sample('powerSounds', 'caster-hit', 0.55, 0.06, 80);
  }

  /** El fuego le hace daño a uno. */
  burnTick(): void {
    this.sample('fireSounds', 'burn-tick', 0.35, 0.12, 90);
  }

  /** Cuántos se están quemando: el crepitar sube con ellos (0, se apaga). */
  burning(count: number): void {
    if (!this.ready || !this.bank) return;
    const on = polished('fireSounds') && count > 0;
    this.bank.loopAt('burn-loop', on ? Math.min(0.32, 0.12 + 0.05 * count) : 0);
  }

  /** Se terminó una oleada. */
  waveClear(): void {
    this.sample('uiSounds', 'wave-clear', 0.6, 0, 500);
  }

  /** Aparecen las cartas, y se elige una. */
  cardAppear(i = 0): void {
    this.sample('uiSounds', 'card-appear', 0.45, 0.04, 30, i * 0.09);
  }

  cardPick(): void {
    this.sample('uiSounds', 'card-pick', 0.7, 0, 200);
  }

  uiClick(): void {
    this.sample('uiSounds', 'ui-click', 0.5, 0, 60);
  }

  /** Cae el golfista. */
  playerDies(): void {
    this.sample('samples', 'player-dies', 0.8, 0, 500);
  }

  /** Uno cae al hoyo. */
  hole(): boolean {
    return this.sample('samples', 'hole', 0.7, 0, 120);
  }

  /**
   * Se tira una habilidad: cada tipo con lo suyo (`POLISH.abilitySounds`, Leandro: «que los poderes hagan
   * ruidos distintos según el tipo»). Los disparos ya suenan a palo (el hook llama a `tock`) y acá se les
   * suma su elemento; el guante, un brillo y su elemento bajito; el palazo suena al conectar (`meleeHit`).
   * Sin la llave, o sin grabado, el whoosh de siempre.
   */
  cast(a?: { kind: string; element?: string }): void {
    if (!this.ok('cast', 80)) return;
    if (a && polished('abilitySounds')) {
      if (a.kind === 'melee') return;
      if (a.kind === 'shot' && this.sample('abilitySounds', `cast-${a.element}`, 0.55, 0.05, 80, 0.02)) return;
      if (a.kind === 'split' && this.sample('abilitySounds', 'cast-wind', 0.5, 0.05, 80, 0.02)) return;
      if (a.kind === 'glove' && this.sample('abilitySounds', 'cast-glove', 0.6, 0, 200)) {
        this.sample('abilitySounds', `cast-${a.element}`, 0.3, 0.05, 80, 0.15);
        return;
      }
      if (this.sample('abilitySounds', `cast-${a.kind}`, 0.6, 0.04, 80)) return;
    }
    this.whoosh(0.7);
  }

  /** El palazo conecta. */
  meleeHit(): void {
    if (!this.sample('abilitySounds', 'cast-melee', 0.8, 0.05, 100)) this.thud();
  }

  /** Perdiste: la horda que sigue detrás del cartel deja de sonar (`false` al volver a jugar). */
  hush(on: boolean): void {
    this.quietWorld = on;
  }

  /** Para las pruebas (__gk): un analizador conectado a la salida, para medir picos. */
  tap(): AnalyserNode | null {
    if (!this.ready) return null;
    if (!this.probe) {
      this.probe = Tone.getContext().createAnalyser();
      this.probe.fftSize = 4096;
      Tone.connect(this.master, this.probe);
    }
    return this.probe;
  }

  /** El carrito atropella a uno. */
  trample(): boolean {
    return this.sample('samples', 'trample', 0.6, 0.06, 80);
  }

  /** ¿El grabado de `name` va a sonar? (para no sumarle el sintetizado) */
  willSample(key: PolishKey, name: string): boolean {
    return this.hasSample(key, name);
  }
}
