// Audio del juego con Tone.js: sintetizado (swing, impactos, encantamientos, monstruos, y una música de
// fondo simple que corre sobre el transporte) y, desde el 14/10, sonidos grabados (ver audio/samples y
// POLISH en core/polish): con su llave prendida y el archivo bajado suena el grabado; si no, el de siempre.
// La segunda tanda del 14/10 (docs/assets-sonidos.md): el golpe de cada palo, la pelota según de qué está
// hecho el enemigo, sus quejidos, un sonido por tipo de poder, y la mezcla sin saturar ni retraso.
import * as Tone from 'tone';
import { polished, type PolishKey } from '../core/polish';
import { MusicPlayer } from './music/player';
import { SampleBank } from './samples';
import { sampleVolume, SFX_NAMES, groupOf, VOLUME, type VolumeGroup } from './volumes';

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
/**
 * El swing grabado de cada palo (15/10, Leandro: «tendría que sonar más tipo a swing con viento, woosh»):
 * `peak`, dónde está su pico (el palo pasando) desde que arranca, y `lead`, lo que tarda el palo de soltar a
 * pegar (medido en el navegador: logs/check-mezcla.mjs). `whoosh` lo agenda para que el pico caiga en el
 * impacto; después de cada golpe se corrige con lo que tardó de verdad.
 */
const SWING: Record<string, { name: string; peak: number; volume: number; lead: number }> = {
  putter: { name: 'swing-short', peak: 0.07, volume: 0.35, lead: 0.145 },
  wedge: { name: 'swing-short', peak: 0.07, volume: 0.7, lead: 0.13 },
  iron: { name: 'swing', peak: 0.07, volume: 0.75, lead: 0.095 },
  driver: { name: 'swing-big', peak: 0.078, volume: 0.85, lead: 0.095 },
};
/**
 * Al perder, lo que pasa del ruido del final (la puerta que cae, el caballero que se queja) a la música de la
 * derrota, en segundos (Leandro, 15/10: «hoy solo arranca la música inmediatamente, debería haber un tiempo
 * en el medio»).
 */
const DEFEAT_PAUSE = 2.2;

const HIT_SOUND: Record<string, string> = {
  skeleton: 'hit-bone', knight: 'hit-armor', stoneling: 'hit-stone', golem: 'hit-stone', wraith: 'hit-soft',
};

/**
 * El recorte suave del final (POLISH.mixGuard): igual hasta 0,85, y de ahí se dobla hacia 0,99 sin pasarlo
 * nunca (una tangente hiperbólica). Así lo que se pasa se redondea en vez de cortarse en seco a 0 dB.
 */
function softClip(s: number): number {
  const knee = 0.85;
  const a = Math.abs(s);
  if (a <= knee) return s;
  return Math.sign(s) * (knee + (0.99 - knee) * Math.tanh((a - knee) / (0.99 - knee)));
}

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
  /** La entrada de todo: el volumen general (`VOLUME.todo`), antes del limitador. */
  private master!: Tone.Gain;
  private limiter!: Tone.ToneAudioNode;
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
  /** La música: qué canción suena en cada lugar de la partida (ver audio/music). */
  readonly music = new MusicPlayer(() => (this.ready ? this.musicBus : null));
  private chargeSynth!: Tone.Synth;
  private killBell!: Tone.PolySynth<Tone.FMSynth>;
  /** Los grabados (ver SampleBank). */
  private bank: SampleBank | null = null;
  /** Cuándo sonó la última baja: la siguiente no sale antes de `KILL_STRUM` después. */
  private killAt = 0;
  /** Cuándo sonaron las últimas bajas: muchas juntas suenan cada una más bajo (ver `kill`). */
  private killTimes: number[] = [];
  /** Cuándo se soltó el último swing (reloj de audio) y con qué palo: el golpe mide cuánto tardó (ver `whoosh`). */
  private released: { at: number; club: string } | null = null;
  /** Lo que tarda cada palo de soltar a pegar, medido en los swings anteriores. */
  private readonly swingLead = new Map<string, number>();
  /** Perdiste y la música se apagó para el silencio del final (ver `defeat`). */
  private musicDown = false;
  /** La música de la derrota, esperando que pase el silencio. */
  private defeatTimer: ReturnType<typeof setTimeout> | null = null;
  /** Lo último de la cadena, lo que va a los parlantes (ver `start`). */
  private out!: Tone.ToneAudioNode;
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
  /** A qué volumen pidió el juego cada grabado la última vez: el ▶ del panel lo suena igual. */
  private readonly asked = new Map<string, number>();

  private readonly lastTime = new Map<object, number>();

  constructor() {
    // Un error de audio nunca tiene que cortar el cuadro del juego: los efectos se llaman desde el
    // medio del update de pelotas y enemigos.
    const sfx = ['chargeTick', 'duff', 'whoosh', 'tock', 'thud', 'kill', 'bounce', 'explosion', 'zap', 'frost', 'growl', 'gateHit', 'hurt', 'waveHorn', 'victory', 'defeat', 'unlock',
      'death', 'eliteAlert', 'bossAppear', 'bossThrow', 'bossRock', 'bubblePop', 'bubbleUp', 'armorHit', 'ricochet', 'phaseBounce', 'heal', 'dodge', 'dodgeReady',
      'casterCast', 'casterHit', 'burnTick', 'burning', 'waveClear', 'cardAppear', 'cardPick', 'uiClick', 'playerDies', 'hole', 'cast', 'trample',
      'ballHit', 'groan', 'meleeHit', 'hush', 'preview', 'previewGroup'] as const;
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
    const guard = polished('mixGuard');
    // con el recorte suave de abajo (mixGuard), el compresor puede ser más blando: uno de rodilla dura y
    // 20:1 que se cierra en 2 ms le mueve la ganancia a los graves (una explosión) adentro de cada onda, y
    // eso también suena a saturado
    this.limiter = mix && guard
      ? new Tone.Compressor({ threshold: -8, ratio: 4, knee: 6, attack: 0.005, release: 0.25 })
      : mix
        ? new Tone.Compressor({ threshold: -3, ratio: 20, knee: 0, attack: 0.002, release: 0.15 })
        : new Tone.Limiter(-1);
    // y después (POLISH.mixGuard, 15/10, Leandro: «los ruidos me parece que clipean»): el compresor del
    // navegador sube solo lo que comprime (+1,7 dB con estos números) y deja pasar el arranque de los golpes,
    // así que con mucho junto la salida pasaba de 0 dB. Un recorte suave: hasta 0,85 no toca nada, de ahí
    // se dobla de a poco y nunca pasa de 0,99. Entra a la mitad para tener margen hasta +6 dB.
    if (guard) {
      const shaper = new Tone.WaveShaper((x) => softClip(2 * x), 4096);
      shaper.oversample = '2x';
      this.limiter.chain(new Tone.Gain(0.5), shaper, Tone.getDestination());
      this.out = shaper;
    } else {
      this.limiter.toDestination();
      this.out = this.limiter;
    }
    // el compresor blando sube solo lo que no comprime unos 3,6 dB (el de antes, 1,7): -1,9 dB a la entrada
    // para que todo suene igual de fuerte que antes
    this.master = new Tone.Gain(VOLUME.todo).connect(guard ? new Tone.Gain(0.8).connect(this.limiter) : this.limiter);
    const verb = new Tone.Freeverb({ roomSize: 0.7, dampening: 2500, wet: 0.25 }).connect(this.master);
    this.musicBus = new Tone.Gain(this.musicLevel()).connect(verb);

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
    // no más de 3 copias del mismo grabado a la vez (POLISH.mixGuard)
    if (polished('mixGuard')) this.bank.cap = 3;
    void this.bank.load();
    this.ready = true;
  }

  /** Suena el grabado `name` si su llave (`key`) está prendida y ya llegó. Devuelve si sonó. */
  private sample(key: PolishKey, name: string, volume = 1, jitter = 0.05, ms = 40, delay = 0): boolean {
    if (!this.ready || !this.bank || !polished(key)) return false;
    this.asked.set(name, volume);
    return this.bank.play(name, volume * sampleVolume(name), jitter, ms, delay);
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
    this.chargeSynth.triggerAttackRelease(midiToFreq(arpeggioNote(level - 1)), 0.09, this.at(this.chargeSynth), 0.75 * VOLUME.carga);
  }

  /**
   * Arranca la música: la canción del lugar de la partida (al empezar, el primer escenario). Desde el 15/10
   * las canciones viven en audio/music; la de siempre es songs/clasica.ts.
   */
  startMusic(): void {
    Tone.getTransport().start();
    this.music.refresh();
  }

  /** El volumen de la música: apagada con M, y su perilla (`VOLUME.musica`). */
  private musicLevel(): number {
    return this.muted || this.musicDown ? 0 : 0.8 * VOLUME.musica;
  }

  /** Pasa al sonido lo tocado en la pestaña Sonido (lo general y la música; lo demás se lee al sonar). */
  applyVolumes(): void {
    if (!this.ready) return;
    this.master.gain.rampTo(VOLUME.todo, 0.05);
    this.musicBus.gain.rampTo(this.musicLevel(), 0.05);
    this.music.applyVolume();
  }

  /** El ▶ del panel: suena `name` como lo pide el juego, sin el límite de ráfaga. */
  preview(name: string): void {
    if (!this.ready || !this.bank) return;
    if (name === 'burn-loop') {
      this.bank.loopAt(name, 0.2 * sampleVolume(name));
      setTimeout(() => this.bank?.loopAt(name, 0), 1500);
      return;
    }
    this.bank.play(name, (this.asked.get(name) ?? 0.6) * sampleVolume(name), 0, 0);
  }

  /** El ▶ de un grupo: la carga y las bajas, su arpegio; los demás, su primer grabado. */
  previewGroup(group: VolumeGroup): void {
    if (!this.ready) return;
    if (group === 'carga') {
      [1, 2, 3].forEach((l) => setTimeout(() => this.chargeTick(l), l * 220));
      return;
    }
    if (group === 'bajas') {
      [0, 1, 2, 3].forEach((s) => this.kill(s));
      return;
    }
    const first = SFX_NAMES.find((n) => group === 'todo' || groupOf(n) === group);
    if (first) this.preview(first);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.musicBus.gain.rampTo(this.musicLevel(), 0.2);
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

  /**
   * El palo cortando el aire; más agudo cuanto más potencia. Con el palo (`club`) y `POLISH.swing`, el swing
   * grabado de ese palo: se suelta acá y pega un rato después (la bajada del swing), así que se lo agenda
   * para que su pico caiga en el impacto. Cuánto tarda cada palo lo mide `tock` en los swings anteriores.
   */
  whoosh(power: number, club = ''): void {
    if (!this.ok('whoosh')) return;
    const s = SWING[club];
    if (s && this.hasSample('swing', s.name)) {
      this.released = { at: this.now(), club };
      const lead = this.swingLead.get(club) ?? s.lead;
      this.sample('swing', s.name, s.volume * (0.55 + 0.45 * power), 0.03, 40, Math.max(0, lead - s.peak));
      return;
    }
    this.whooshFilter.frequency.value = 600 + 1600 * power;
    this.whooshNoise.triggerAttackRelease(0.2, this.at(this.whooshNoise), VOLUME.palo);
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
    // cuánto tardó el palo de soltar a pegar: el próximo swing de este palo se agenda con eso
    if (this.released?.club === club) {
      const d = this.now() - this.released.at;
      if (d > 0.02 && d < 0.8) this.swingLead.set(club, 0.5 * (this.swingLead.get(club) ?? d) + 0.5 * d);
      this.released = null;
    }
    // los tics del cartel de la derrota (sin golpe) no rompen el silencio antes de su música (ver `defeat`)
    if (quality === 0 && this.defeatTimer) return;
    if (!this.ok('tock')) return;
    // grabado: el golpe del palo, y el golpe pleno del perfecto abajo (desde el 15/10; antes una estrellita)
    if (quality >= 1 && club && this.sample('samples', `club-${club}`, CLUB_VOLUME[Math.min(3, quality) - 1], 0.04)) {
      if (perfect) this.sample('samples', 'perfect', 0.7, 0.02, 40, 0.03);
      return;
    }
    const t = this.at(this.click);
    this.click.triggerAttackRelease(perfect ? 'G4' : 'D4', '32n', t, VOLUME.palo);
    if (perfect) this.bell.triggerAttackRelease([midiToFreq(86), midiToFreq(91)], 0.4, t + 0.02, VOLUME.palo);
  }

  /** Un golpe sordo: la pelota que cae, el hoyo, el empujón. */
  thud(): void {
    if (!this.ok('thud')) return;
    if (this.sample('samples', 'hit-soft', 0.6, 0.08)) return;
    this.thudSynth.triggerAttackRelease('A1', '16n', this.at(this.thudSynth), VOLUME.golpes);
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
    this.thudSynth.triggerAttackRelease('A1', '16n', this.at(this.thudSynth), VOLUME.golpes);
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
    // muchas juntas (un área, una explosión): cada una más bajo, para que el acorde entero no pase de lo
    // que suenan cuatro (POLISH.mixGuard). Se siguen oyendo todas
    this.killTimes = this.killTimes.filter((x) => x > t - 0.6);
    this.killTimes.push(t);
    const crowd = polished('mixGuard') ? Math.sqrt(4 / Math.max(4, this.killTimes.length)) : 1;
    this.killBell.triggerAttackRelease(midiToFreq(arpeggioNote(step)), 0.5, t, crowd * Math.min(1, 0.6 + 0.06 * step) * VOLUME.bajas);
  }

  bounce(): void {
    if (!this.ok('bounce')) return;
    this.click.triggerAttackRelease('A2', '64n', this.at(this.click), 0.35 * VOLUME.golpes);
  }

  explosion(big = false): void {
    if (this.quietWorld || !this.ok('explosion', 120)) return;
    if (this.sample('samples', big ? 'explosion-big' : 'explosion-small', big ? 0.7 : 0.55, 0.06)) return;
    this.boom.triggerAttackRelease('C1', '4n', this.at(this.boom), VOLUME.explosiones);
    this.noise.triggerAttackRelease(0.4, this.at(this.noise), VOLUME.explosiones);
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
    this.boom.triggerAttackRelease('E1', '8n', this.at(this.boom), 0.7 * VOLUME.golfista);
  }

  /** Golpe que recibe el golfista. */
  hurt(): void {
    if (this.quietWorld || !this.ok('hurt')) return;
    if (this.sample('samples', 'hurt', 0.85)) return;
    // sin ruido: comparte instante con la explosión de un bombín, y NoiseSynth no admite dos disparos juntos
    this.thudSynth.triggerAttackRelease('E2', '8n', this.at(this.thudSynth), VOLUME.golfista);
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

  /**
   * Perdiste: `how` dice cómo (la puerta cayó, o cayó el caballero). Con `POLISH.defeatPause` suena primero
   * el final, fuerte y claro (la puerta que se rompe y cae, o el caballero que se queja; el golpe de su caída
   * es `playerDies`), la música se apaga, y la de la derrota entra recién después de un silencio
   * (`DEFEAT_PAUSE`). Sin `how`, o con la llave apagada, la derrota en el acto, como antes.
   */
  defeat(how?: 'gate' | 'player'): void {
    if (how && this.ready && polished('defeatPause')) {
      this.musicDown = true;
      this.musicBus.gain.rampTo(0, 0.3);
      if (how === 'gate') this.sample('samples', 'gate-fall', 1, 0, 500);
      else this.sample('samples', 'knight-groan', 1, 0.02, 500);
      if (this.defeatTimer) clearTimeout(this.defeatTimer);
      this.defeatTimer = setTimeout(() => {
        this.defeatTimer = null;
        this.defeatTheme();
      }, DEFEAT_PAUSE * 1000);
      return;
    }
    this.defeatTheme();
  }

  /** La música de la derrota. */
  private defeatTheme(): void {
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
    this.bank.loopAt('burn-loop', on ? Math.min(0.32, 0.12 + 0.05 * count) * sampleVolume('burn-loop') : 0);
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

  /** Cae el golfista (desde el 15/10 más fuerte: es el final, y va con su quejido, ver `defeat`). */
  playerDies(): void {
    this.sample('samples', 'player-dies', polished('defeatPause') ? 1 : 0.8, 0, 500);
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
    // se vuelve a jugar: si la derrota estaba esperando su silencio, ya no suena, y vuelve la música
    if (!on && this.defeatTimer) {
      clearTimeout(this.defeatTimer);
      this.defeatTimer = null;
    }
    if (!on && this.musicDown) {
      this.musicDown = false;
      if (this.ready) this.musicBus.gain.rampTo(this.musicLevel(), 0.5);
    }
  }

  /** Para las pruebas (__gk): un analizador conectado a la salida, para medir picos. */
  tap(): AnalyserNode | null {
    if (!this.ready) return null;
    if (!this.probe) {
      this.probe = Tone.getContext().createAnalyser();
      this.probe.fftSize = 4096;
      Tone.connect(this.out, this.probe);
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

  // ---- un enemigo gana un poder (15/10; ver docs/poderes-visibles.md) ----

  /** La campana tibia de los poderes ganados (se arma la primera vez que hace falta). */
  private gainBell: Tone.PolySynth<Tone.FMSynth> | null = null;

  /**
   * Un enemigo ganó un poder en plena oleada (`up`), o le subió el nivel; o le bajó (`up` false, más bajito).
   * Un arpegio corto que sube, en la campana de FM (senoidal, poca modulación: tibia, nada de 8 bits), con
   * el registro y el color de cada poder, y debajo el grabado que ya es de ese poder cuando lo hay (el metal
   * del blindaje, la burbuja del bendito, la cura). Cada nivel más suena un tono más arriba. Si a varios les
   * llega a la vez (la bandera en alto), suena una sola vez.
   */
  powerGain(power: string, level = 1, up = true): void {
    try {
      if (this.quietWorld || !this.ok('powerGain', 140)) return;
      if (!this.gainBell) {
        this.gainBell = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 1, modulationIndex: 1.6,
          oscillator: { type: 'sine' }, modulation: { type: 'sine' },
          envelope: { attack: 0.006, decay: 0.55, sustain: 0, release: 0.5 },
          modulationEnvelope: { attack: 0.004, decay: 0.2, sustain: 0, release: 0.1 },
          volume: -13,
        });
        this.gainBell.chain(new Tone.Filter(2600, 'lowpass'), new Tone.Freeverb({ roomSize: 0.6, dampening: 2200, wet: 0.28 }), this.master);
      }
      // las notas de cada poder (midi), de abajo para arriba
      const NOTES: Record<string, number[]> = {
        armor: [43, 50, 55], shield: [48, 55, 60], divine: [72, 76, 79, 84], dodge: [69, 76, 81], regen: [65, 69, 72],
        heal: [65, 69, 72], ethereal: [62, 69, 74], phase: [62, 69, 74], skull: [40, 43, 47], banner: [58, 65, 70],
        warded: [64, 71, 76], ward: [64, 71, 76],
      };
      const base = NOTES[power] ?? [60, 67];
      const shift = Math.max(0, Math.min(3, (level >= 10 ? 3 : level) - 1)) * 2;
      const notes = up ? base.map((m) => m + shift) : [base[base.length - 1] + shift, base[0] + shift];
      const t = this.at(this.gainBell);
      const gap = power === 'ethereal' || power === 'phase' ? 0.11 : 0.07;
      notes.forEach((m, i) => this.gainBell!.triggerAttackRelease(midiToFreq(m), 0.22, t + i * gap, up ? 0.8 - i * 0.08 : 0.4));
      if (!up) return;
      // el grabado del poder, bajito, debajo del arpegio
      if (power === 'armor') this.sample('powerSounds', 'armor-hit', 0.32, 0.05, 120);
      else if (power === 'shield') this.thudSynth.triggerAttackRelease('C2', 0.1, this.at(this.thudSynth));
      else if (power === 'divine') this.sample('powerSounds', 'bubble-up', 0.35, 0.05, 120);
      else if (power === 'dodge') this.sample('powerSounds', 'dodge-ready', 0.4, 0.05, 120);
      else if (power === 'regen') this.sample('powerSounds', 'heal', 0.3, 0.05, 150);
    } catch (e) {
      console.warn('audio powerGain:', e);
    }
  }
}
