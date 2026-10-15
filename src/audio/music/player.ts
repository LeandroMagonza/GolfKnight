// El que pasa la música: suena la canción elegida para el lugar de la partida (`MusicSlot`) y, cuando
// cambia (otro escenario, entra un élite, empieza el jefe), la nueva entra mientras la otra se apaga.
// Qué canción va en cada lugar se elige en el panel B (pestaña Sonido) o en musica.html, y se guarda en
// este navegador.
import * as Tone from 'tone';
import { DEFAULT_SONG, loadSong } from './registry';
import type { MusicSlot, Song } from './types';

const KEY = 'gk.musica';
/** Segundos del fundido entre una canción y la otra. */
const FADE = 2.5;
/** «La del escenario»: el élite y el jefe sin canción propia siguen con la que venía sonando. */
export const SAME = '';

function loadChoice(): Partial<Record<MusicSlot, string>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export class MusicPlayer {
  private current: { id: string; song: Song; gain: Tone.Gain } | null = null;
  private slot: MusicSlot = 'escenario1';
  /** El último escenario: lo que suena en el élite o el jefe sin canción propia. */
  private scenario: MusicSlot = 'escenario1';
  private readonly choice = loadChoice();
  /** La que se está cargando o sonando por pedido: si cambia en el medio, la carga vieja no entra. */
  private wanted = '';
  /** El ▶ del panel: suena esa, sin importar el lugar, hasta que se la saque. */
  private previewing: string | null = null;
  private level = 0;

  constructor(private readonly out: () => Tone.InputNode | null) {}

  /** La canción de cada lugar: lo elegido, o la de siempre en los escenarios y «la del escenario» en el resto. */
  songFor(slot: MusicSlot): string {
    return this.choice[slot] ?? (slot.startsWith('escenario') ? DEFAULT_SONG : SAME);
  }

  setSong(slot: MusicSlot, id: string): void {
    if (id === (slot.startsWith('escenario') ? DEFAULT_SONG : SAME)) delete this.choice[slot];
    else this.choice[slot] = id;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.choice));
    } catch { /* sin localStorage: vale hasta recargar */ }
    this.refresh();
  }

  get playing(): string | null {
    return this.current?.id ?? null;
  }

  /** Dónde está la partida. Si cambia la canción que corresponde, entra con su fundido. */
  setSlot(slot: MusicSlot): void {
    if (slot.startsWith('escenario')) this.scenario = slot;
    if (slot === this.slot && this.current) return;
    this.slot = slot;
    this.refresh();
  }

  /** El ▶ del panel: suena `id` ya (null vuelve a la del lugar). */
  preview(id: string | null): void {
    this.previewing = id;
    this.refresh();
  }

  /** Qué tan tensa está la partida, de 0 a 1: se la pasa a la canción que suena (si le importa). */
  intensity(level: number): void {
    if (Math.abs(level - this.level) < 0.02) return;
    this.level = level;
    this.current?.song.intensity?.(level);
  }

  refresh(): void {
    const id = this.previewing ?? (this.songFor(this.slot) || this.songFor(this.scenario) || DEFAULT_SONG);
    if (id === this.current?.id || id === this.wanted) return;
    this.wanted = id;
    void this.play(id);
  }

  private async play(id: string): Promise<void> {
    const def = (await loadSong(id)) ?? (id !== DEFAULT_SONG ? await loadSong(DEFAULT_SONG) : null);
    const out = this.out();
    if (!def || !out || this.wanted !== id) return;
    const transport = Tone.getTransport();
    const gain = new Tone.Gain(0).connect(out);
    let song: Song;
    try {
      song = def.build(gain, transport);
      song.start(transport.seconds + 0.1);
      song.intensity?.(this.level);
    } catch (e) {
      console.error(`[gk] la canción ${id} falló:`, e); // i18n-ok: consola
      gain.dispose();
      return;
    }
    gain.gain.rampTo(1, FADE);
    const old = this.current;
    this.current = { id, song, gain };
    this.wanted = '';
    if (old) {
      old.gain.gain.rampTo(0, FADE);
      old.song.stop(transport.seconds + FADE);
      setTimeout(() => {
        old.song.dispose();
        old.gain.dispose();
      }, (FADE + 2) * 1000);
    }
    if (transport.state !== 'started') transport.start();
  }
}
