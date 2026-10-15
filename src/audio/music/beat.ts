// La grilla de pulsos de una canción (15/10, para el jefe con música: ver src/game/bosses/bardo y
// docs/jefes/bardo.md). La canción marca cada pulso que agenda (`mark`, en la hora del audio) y el juego la
// lee para saber dónde cae el beat: si soltaste a tiempo, cuánto falta para el próximo, el anillo que late.
// El tempo lo pide el que maneja la pelea (`want`) y la canción lo toma al empezar el compás siguiente, así
// nunca cambia a mitad de compás. El mismo objeto sirve con el reloj del juego (sin audio, o con el bot a x8):
// ahí los pulsos los marca el jefe con su propio reloj.

/** Un pulso: cuándo cae (en la hora del reloj que lo marcó), cuál es desde el principio, y el tempo que sigue. */
export interface Beat {
  t: number;
  n: number;
  /** El tempo hasta el próximo pulso (golpes por minuto). */
  bpm: number;
}

export class BeatGrid {
  /** El tempo de ahora: el del último pulso marcado. */
  bpm: number;
  /** La fase de la canción (0, 1, 2...): la pide el jefe junto con el tempo y la canción arma según esto. */
  phase = 0;
  /** Lo que se pidió y entra en el próximo compás. */
  private wanted: { bpm: number; phase: number };
  /** Alguien maneja el tempo (el jefe). Si no, la canción sube sola (para escucharla en musica.html). */
  driven = false;
  private readonly list: Beat[] = [];
  private count = 0;

  constructor(bpm: number, readonly perBar = 4) {
    this.bpm = bpm;
    this.wanted = { bpm, phase: 0 };
  }

  /** Pide otro tempo (y fase): entra al empezar el compás siguiente. */
  want(bpm: number, phase = this.wanted.phase): void {
    this.wanted = { bpm, phase };
  }

  get wantedBpm(): number {
    return this.wanted.bpm;
  }

  /** Cae un pulso en `t`. Si empieza compás, toma el tempo pedido. Devuelve el pulso (con el tempo que sigue). */
  mark(t: number): Beat {
    if (this.count % this.perBar === 0) {
      this.bpm = this.wanted.bpm;
      this.phase = this.wanted.phase;
    }
    const b = { t, n: this.count++, bpm: this.bpm };
    this.list.push(b);
    if (this.list.length > 48) this.list.splice(0, this.list.length - 48);
    return b;
  }

  /** El último pulso marcado (puede estar un poco adelante de lo que se oye: la canción agenda antes). */
  get last(): Beat | null {
    return this.list[this.list.length - 1] ?? null;
  }

  /** El que sigue a `b`, estimado con el tempo pedido si empieza compás. */
  private after(b: Beat): Beat {
    const n = b.n + 1;
    return { t: b.t + 60 / b.bpm, n, bpm: n % this.perBar === 0 ? this.wanted.bpm : b.bpm };
  }

  /** El último pulso que cayó en `t` o antes (null si todavía no hubo ninguno). */
  prev(t: number): Beat | null {
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].t <= t) {
      // si `t` quedó más allá de lo marcado, lo estima
      let b = this.list[i];
      if (i === this.list.length - 1) for (let k = 0; k < 64; k++) {
        const nx = this.after(b);
        if (nx.t > t) break;
        b = nx;
      }
      return b;
    }
    return null;
  }

  /** El primer pulso después de `t` (los que no se marcaron todavía, estimados). */
  next(t: number): Beat | null {
    for (const b of this.list) if (b.t > t) return b;
    const p = this.prev(t);
    return p ? this.after(p) : null;
  }

  /**
   * Cuánto le erró `t` al pulso más cercano, en segundos: negativo si fue antes del pulso, positivo si
   * después. Null si no hay pulsos.
   */
  offset(t: number): number | null {
    const p = this.prev(t);
    const n = this.next(t);
    if (!p && !n) return null;
    if (!p) return t - n!.t;
    if (!n) return t - p.t;
    return t - p.t <= n.t - t ? t - p.t : t - n.t;
  }
}
