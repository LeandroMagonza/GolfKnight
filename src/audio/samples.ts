// Los sonidos grabados (14/10, ver docs/assets-sonidos.md): mp3 cortos en public/sfx/, con la lista en
// public/sfx/sfx.json (qué archivos tiene cada evento: uno o dos, para variar). Se bajan al arrancar el audio,
// en segundo plano; hasta que llegan, o si falta alguno, suena lo sintetizado de siempre.
import * as Tone from 'tone';

interface Entry {
  files: string[];
}

export class SampleBank {
  private readonly buffers = new Map<string, AudioBuffer[]>();
  private readonly last = new Map<string, number>();
  private loop: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  /**
   * Cuántas copias de un mismo grabado pueden sonar a la vez (15/10, POLISH.mixGuard): con diez bajas en un
   * tiro, diez voces de muerte iguales encimadas no se oyen mejor que tres y suman hasta recortar. Sin tope,
   * Infinity.
   */
  cap = Infinity;
  /** Cuántas copias de cada uno están sonando. */
  private readonly sounding = new Map<string, number>();

  /** `now`: el instante de ahora en el reloj de audio (ver `GameAudio.now`). */
  constructor(private readonly out: Tone.ToneAudioNode, private readonly now: () => number = () => Tone.now()) {}

  /** Baja la lista y los archivos. No espera: cada uno queda listo cuando llega. */
  async load(): Promise<void> {
    const base = `${import.meta.env.BASE_URL}sfx/`;
    let list: Record<string, Entry>;
    try {
      list = await (await fetch(`${base}sfx.json`)).json();
    } catch {
      return;
    }
    const ctx = Tone.getContext();
    await Promise.all(Object.entries(list).map(async ([name, e]) => {
      const bufs: AudioBuffer[] = [];
      for (const file of e.files) {
        try {
          const data = await (await fetch(base + file)).arrayBuffer();
          bufs.push(await ctx.decodeAudioData(data));
        } catch { /* ese no: queda el sintetizado */ }
      }
      if (bufs.length) this.buffers.set(name, bufs);
    }));
  }

  has(name: string): boolean {
    return this.buffers.has(name);
  }

  /**
   * Suena `name` (una de sus variantes al azar), a `volume` (1 es como vino), con la velocidad movida hasta
   * `jitter` para que no suene siempre igual. No más de uno cada `ms`. Devuelve si sonó.
   */
  play(name: string, volume = 1, jitter = 0.05, ms = 40, delay = 0): boolean {
    const bufs = this.buffers.get(name);
    if (!bufs) return false;
    const now = performance.now();
    if (now - (this.last.get(name) ?? -1e9) < ms) return true;
    this.last.set(name, now);
    const n = this.sounding.get(name) ?? 0;
    if (n >= this.cap) return true;
    this.sounding.set(name, n + 1);
    const ctx = Tone.getContext();
    const src = ctx.createBufferSource();
    src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    Tone.connect(gain, this.out);
    src.start(this.now() + delay);
    src.onended = () => {
      gain.disconnect();
      this.sounding.set(name, Math.max(0, (this.sounding.get(name) ?? 1) - 1));
    };
    return true;
  }

  /** Un sonido en loop (el crepitar del fuego) a `volume`: 0 lo apaga de a poco. */
  loopAt(name: string, volume: number): void {
    const ctx = Tone.getContext();
    if (volume <= 0.001) {
      if (this.loop) this.loop.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      return;
    }
    if (!this.loop) {
      const bufs = this.buffers.get(name);
      if (!bufs) return;
      const src = ctx.createBufferSource();
      src.buffer = bufs[0];
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      Tone.connect(gain, this.out);
      src.start();
      this.loop = { src, gain };
    }
    this.loop.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.2);
  }
}
