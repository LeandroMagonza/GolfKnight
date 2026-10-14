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

  constructor(private readonly out: Tone.ToneAudioNode) {}

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
    const ctx = Tone.getContext();
    const src = ctx.createBufferSource();
    src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    Tone.connect(gain, this.out);
    src.start(Tone.now() + delay);
    src.onended = () => gain.disconnect();
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
