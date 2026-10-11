// Las partidas se mandan solas al terminar (3/10, pedido de Leandro), para ver dónde pierde la gente y
// balancear con datos en vez de capturas. Van a Supabase, al mismo proyecto que el ManaMod, a la tabla
// golf_runs (ver docs/telemetria.sql). Sin datos personales: un id al azar por navegador.
//
// Como en el ManaMod, lo que no sale queda en una cola en el navegador y se manda la próxima vez: sin
// internet, o si la tabla todavía no existe. La partida que se deja por la mitad (se cierra la pestaña o
// se reinicia desde la pausa) se guarda como abandonada. No se manda nada desde las pruebas automáticas
// (navigator.webdriver), el bot ni el espectador: eso lo decide quien crea el registro.

import { lang } from './i18n';

const ENDPOINT = 'https://kdwiuiciobekuedpmfpj.supabase.co/rest/v1/golf_runs';
/** La clave pública del proyecto: con la regla de la tabla, solo deja agregar partidas, no leerlas. */
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkd2l1aWNpb2Jla3VlZHBtZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzQ1MDYsImV4cCI6MjA4OTIxMDUwNn0.Cm1fWVHTGQpfUDABRlLX4yFXayGyy_xD6ettzV2zJNQ';
const QUEUE_KEY = 'gk.partidas';
const PLAYER_KEY = 'gk.jugador';
/** Más que esto en la cola y se tiran las más viejas: sin red por mucho tiempo no se llena el navegador. */
const MAX_QUEUE = 30;
/**
 * Las últimas partidas de este navegador, resumidas, que quedan acá (11/10, Leandro: para que el bot juegue
 * como una persona, con los números de una). Se copian desde el panel de balance, pestaña Pruebas.
 */
const MINE_KEY = 'gk.misPartidas';
const MAX_MINE = 20;
/** Los tiros de una partida que anotan cuándo se soltó: de sobra (una partida entera son unos 300). */
const MAX_OFFS = 1500;

/** Una partida, resumida: tiros, cuántos pegaron, con qué golpe salió cada uno (1 a 4), y la vida perdida. */
export interface MyRun {
  at: string;
  level: number;
  result: string;
  wave: number;
  seconds: number;
  shots: number;
  hits: number;
  q: number[];
  abilities: number;
  hurt: number;
  gate: number;
  /** A cuántos ms del tope de la barra se soltó cada tiro: negativo, antes; positivo, se pasó. */
  off?: number[];
}

/** Las partidas de este navegador que se anotaron (las de la persona: el bot y las pruebas no). */
export function myRuns(): MyRun[] {
  return read<MyRun[]>(MINE_KEY, []);
}

/**
 * Lo que se le copia al bot de unas partidas: tiros por minuto, qué parte pega, qué parte sale con cada
 * golpe (del 1 al 4), habilidades por minuto y la vida (y la puerta) que se pierde por minuto. Sin las de
 * menos de medio minuto (se dejaron apenas empezadas).
 */
export function summarizeRuns(runs: MyRun[]): Record<string, number | number[]> {
  const list = runs.filter((r) => r.seconds >= 30);
  const total = (f: (r: MyRun) => number) => list.reduce((n, r) => n + f(r), 0);
  const minutes = total((r) => r.seconds) / 60;
  const shots = total((r) => r.shots);
  const q = [0, 1, 2, 3].map((i) => total((r) => r.q?.[i] ?? 0));
  const graded = q.reduce((a, b) => a + b, 0);
  const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  const per = (v: number) => (minutes > 0 ? round(v / minutes) : 0);
  return {
    partidas: list.length,
    ganadas: list.filter((r) => r.result === 'victory').length,
    minutos: round(minutes, 1),
    oleada: list.length ? round(total((r) => r.wave) / list.length, 1) : 0,
    tirosPorMinuto: per(shots),
    pegan: shots ? round(total((r) => r.hits) / shots) : 0,
    golpes: q.map((n) => (graded ? round(n / graded) : 0)),
    habilidadesPorMinuto: per(total((r) => r.abilities)),
    vidaPorMinuto: per(total((r) => r.hurt)),
    puertaPorMinuto: per(total((r) => r.gate)),
    ...releaseStats(list.flatMap((r) => r.off ?? [])),
  };
}

/**
 * Cuándo se suelta, sobre el tope de la barra (ms; ver SwingMeter.offPeak): qué parte sale antes del fuerte,
 * en el fuerte y pasado (sin las mejoras de la barra, el fuerte son ±30 ms alrededor del tope), el promedio y
 * el desvío de los que quedan cerca del tope (±250 ms: los que buscaban el 3), y cuántos caen en cada tramo
 * de 25 ms. Para que el bot humano le erre como una persona.
 */
export function releaseStats(offs: number[], half = 30): Record<string, number | number[]> {
  if (!offs.length) return { soltadas: 0 };
  const share = (f: (o: number) => boolean) => Math.round((100 * offs.filter(f).length) / offs.length) / 100;
  const near = offs.filter((o) => Math.abs(o) <= 250);
  const mean = near.length ? near.reduce((a, b) => a + b, 0) / near.length : 0;
  const sd = near.length > 1 ? Math.sqrt(near.reduce((a, b) => a + (b - mean) ** 2, 0) / (near.length - 1)) : 0;
  // de −250 a +250 en tramos de 25 ms (el primero junta todo lo de antes, y el último todo lo de después)
  const bins = Array.from({ length: 22 }, () => 0);
  for (const o of offs) bins[Math.max(0, Math.min(21, Math.floor((o + 250) / 25) + 1))]++;
  return {
    soltadas: offs.length,
    antesDelFuerte: share((o) => o < -half),
    enElFuerte: share((o) => Math.abs(o) <= half),
    pasado: share((o) => o > half),
    cercaPromedioMs: Math.round(mean),
    cercaDesvioMs: Math.round(sd),
    cadaVeinticincoMs: bins,
  };
}

/** Lo que pasó en una oleada. */
export interface WaveLog {
  n: number;
  title: string;
  mod?: string;
  seconds: number;
  /** Tiros de palo, cuántos le pegaron a alguien y cuántos fueron perfectos. */
  shots: number;
  hits: number;
  perfects: number;
  /** Cuántos tiros salieron con cada golpe: del 1 al 4 (11/10: para que el bot juegue como una persona). */
  q?: number[];
  kills: number;
  /** Bajas de más de un mismo tiro (un doblete suma 1, un triplete 2): lo que cuentan el albañil y el herrero. */
  extra: number;
  /** Daño hecho: todas las formas de pegar, y de eso, cuánto con los tiros de palo. */
  damage: number;
  shotDamage: number;
  /** Habilidades tiradas. */
  abilities: number;
  /** Vida del golfista y de la puerta que se perdió, y quién la sacó. */
  hurt: number;
  gate: number;
  by: Record<string, number>;
}

/** Una fila de la tabla: lo que se filtra va en columnas, el resto en `data`. */
interface Row {
  id: string;
  player_id: string;
  version: string;
  level: number;
  result: 'victory' | 'defeat' | 'abandoned';
  wave: number;
  seconds: number;
  data: Record<string, unknown>;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* sin localStorage: se pierde, no pasa nada */ }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

/** El id de este navegador: al azar, la primera vez. */
function playerId(): string {
  let id = read<string>(PLAYER_KEY, '');
  if (!id) {
    id = uuid();
    write(PLAYER_KEY, id);
  }
  return id;
}

let flushing = false;

/** Manda lo que haya en la cola. Lo que sale (o ya estaba) se saca; lo que no, queda para la próxima. */
export async function flushRuns(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (const row of read<Row[]>(QUEUE_KEY, [])) {
      let drop = false;
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          keepalive: true,
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(row),
        });
        // 409: ya estaba (se mandó y no llegó la respuesta). 400 o 422: la fila está mal y no va a
        // entrar nunca. La tabla que falta (404) o el servidor caído quedan para la próxima
        drop = res.ok || res.status === 409 || res.status === 400 || res.status === 422;
      } catch { /* sin red */ }
      if (drop) write(QUEUE_KEY, read<Row[]>(QUEUE_KEY, []).filter((r) => r.id !== row.id));
    }
  } finally {
    flushing = false;
  }
}

function enqueue(row: Row): void {
  const queue = read<Row[]>(QUEUE_KEY, []).filter((r) => r.id !== row.id);
  queue.push(row);
  write(QUEUE_KEY, queue.slice(-MAX_QUEUE));
}

/** Lo fijo de la partida, que se sabe al empezar. */
export interface RunInfo {
  version: string;
  level: number;
  picks: Record<string, number | undefined>;
  /** Los niveles desbloqueados. */
  points: number;
  /** Lo elegido en cada escalón puesto (desde el 11/10, la escalera). */
  ladder?: string[];
  powers: string[];
  supports: string[];
  specials: string[];
  mode: 'golf' | 'tenis';
  course: number;
}

/** Junta lo que pasa en la partida y al final la deja en la cola. */
export class RunRecorder {
  private readonly id = uuid();
  private readonly startedAt = new Date().toISOString();
  private readonly waves: WaveLog[] = [];
  private readonly cards: { wave: number; offered: string[]; picked: string | null }[] = [];
  private clock = 0;
  private waveStart = 0;
  private done = false;
  /** Lo más que mató un mismo tiro. */
  private best = 0;
  /** A cuántos ms del tope de la barra se soltó cada tiro (11/10): negativo, antes; positivo, se pasó. */
  private readonly offs: number[] = [];

  /**
   * @param send si se manda al terminar. Sin esto solo junta los números, para el cartel del final (el
   * bot y las pruebas automáticas no mandan nada, pero el cartel los muestra igual)
   */
  constructor(private readonly info: RunInfo, private readonly send = true) {}

  /** Corre el reloj de la partida (sin pausas ni cartas). */
  tick(dt: number): void {
    this.clock += dt;
  }

  private get now(): WaveLog | undefined {
    return this.waves[this.waves.length - 1];
  }

  /** Empezó la oleada `n` (desde 1). */
  wave(n: number, title: string, mod?: string): void {
    this.closeWave();
    this.waveStart = this.clock;
    this.waves.push({ n, title, ...(mod ? { mod } : {}), seconds: 0, shots: 0, hits: 0, perfects: 0, q: [0, 0, 0, 0], kills: 0, extra: 0, damage: 0, shotDamage: 0, abilities: 0, hurt: 0, gate: 0, by: {} });
  }

  private closeWave(): void {
    const w = this.now;
    if (w) w.seconds = Math.round(this.clock - this.waveStart);
  }

  /**
   * Salió un tiro de palo con el golpe `quality` (del 1 al 4); `perfect`, el más alto que hay. `off`: a
   * cuántos s del tope de la barra se soltó (ver SwingMeter.offPeak).
   */
  shot(perfect: boolean, quality = 0, off?: number): void {
    const w = this.now;
    if (!w) return;
    w.shots++;
    if (perfect) w.perfects++;
    if (w.q && quality >= 1 && quality <= 4) w.q[quality - 1]++;
    if (off !== undefined && Number.isFinite(off) && this.offs.length < MAX_OFFS) this.offs.push(Math.round(off * 1000));
  }

  /** Lo anotado hasta ahora: las oleadas, las cartas y cuándo se soltó cada tiro (para las pruebas y las tandas del bot). */
  get log(): { waves: WaveLog[]; cards: { wave: number; offered: string[]; picked: string | null }[]; offs: number[] } {
    return { waves: this.waves, cards: this.cards, offs: this.offs };
  }

  /** Un tiro de palo terminó y le pegó a alguien. */
  hit(): void {
    if (this.now) this.now.hits++;
  }

  /** Daño a un enemigo; `shot`: de un tiro de palo. */
  damage(amount: number, killed: boolean, shot: boolean): void {
    const w = this.now;
    if (!w) return;
    if (Number.isFinite(amount)) {
      w.damage += amount;
      if (shot) w.shotDamage += amount;
    }
    if (killed) w.kills++;
  }

  /** Una baja de más de un mismo tiro, que ya lleva `kills`. */
  extraKill(kills = 2): void {
    if (this.now) this.now.extra++;
    this.best = Math.max(this.best, kills);
  }

  ability(): void {
    if (this.now) this.now.abilities++;
  }

  /** Perdió vida el golfista (`gate` false) o la puerta, por `source`. */
  hurt(amount: number, source: string, gate: boolean): void {
    const w = this.now;
    if (!w) return;
    // el élite mata de una: se anota como 99
    const n = Number.isFinite(amount) ? amount : 99;
    if (gate) w.gate += n;
    else w.hurt += n;
    const key = `${gate ? 'puerta' : 'vos'}:${source}`;
    w.by[key] = (w.by[key] ?? 0) + n;
  }

  offered(cards: string[]): void {
    this.cards.push({ wave: this.now?.n ?? 0, offered: cards, picked: null });
  }

  picked(card: string): void {
    const last = this.cards[this.cards.length - 1];
    if (last && last.picked === null) last.picked = card;
  }

  private sum(k: 'shots' | 'hits' | 'perfects' | 'kills' | 'extra' | 'damage' | 'shotDamage' | 'abilities'): number {
    return this.waves.reduce((n, w) => n + w[k], 0);
  }

  /** Los números de toda la partida, para el cartel del final. */
  get totals(): { seconds: number; shots: number; hits: number; perfects: number; damage: number; abilities: number; best: number } {
    return {
      seconds: this.clock, shots: this.sum('shots'), hits: this.sum('hits'), perfects: this.sum('perfects'),
      damage: this.sum('damage'), abilities: this.sum('abilities'), best: this.best,
    };
  }

  /** Terminó (o se dejó): queda en la cola y se intenta mandar. */
  finish(result: Row['result'], extra: { cause?: string; score: number; hp: number; gate: number; build: unknown }): void {
    if (this.done) return;
    this.done = true;
    this.closeWave();
    if (!this.send) return;
    const sum = (k: 'shots' | 'hits' | 'perfects' | 'kills' | 'extra' | 'damage' | 'shotDamage') => this.sum(k);
    enqueue({
      id: this.id,
      player_id: playerId(),
      version: this.info.version,
      level: this.info.level,
      result,
      wave: this.now?.n ?? 0,
      seconds: Math.round(this.clock),
      data: {
        ...this.info,
        startedAt: this.startedAt,
        ...extra,
        shots: sum('shots'), hits: sum('hits'), perfects: sum('perfects'), kills: sum('kills'), extra: sum('extra'), damage: sum('damage'), shotDamage: sum('shotDamage'),
        waves: this.waves,
        cards: this.cards,
        releases: this.offs,
        host: location.hostname,
        // en qué idioma jugó (ver src/i18n.ts); el título de cada oleada sale en ese idioma
        lang,
        screen: [innerWidth, innerHeight],
        touch: matchMedia('(pointer: coarse)').matches,
      },
    });
    // también al cerrar la pestaña: el primer envío sale en el acto, con keepalive
    void flushRuns();
    const q = [0, 0, 0, 0];
    for (const w of this.waves) w.q?.forEach((n, i) => { q[i] += n; });
    const total = (k: 'hurt' | 'gate') => this.waves.reduce((n, w) => n + w[k], 0);
    write(MINE_KEY, [...myRuns(), {
      at: this.startedAt, level: this.info.level, result, wave: this.now?.n ?? 0, seconds: Math.round(this.clock),
      shots: sum('shots'), hits: sum('hits'), q, abilities: this.sum('abilities'), hurt: total('hurt'), gate: total('gate'), off: this.offs,
    }].slice(-MAX_MINE));
  }

  get finished(): boolean {
    return this.done;
  }
}
