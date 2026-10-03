// El espectador (ver docs/multijugador.md): lo que viaja del que juega al que mira, y cómo se suaviza.
//
// El que juega manda unas `SNAP_HZ` fotos por segundo con todo lo que se ve (dónde está y cómo se ve cada
// cosa), y los eventos sueltos (efectos, sonidos, carteles) en el momento en que pasan. El que mira dibuja
// `DELAY_MS` atrasado: así casi siempre tiene la foto de antes y la de después, y mueve todo suave entre
// las dos. Los eventos esperan a su hora para salir junto con lo que se ve.
//
// Acá van solo los tipos y las cuentas, sin Three.js: se prueban sin navegador.
import type { StrikeSnap } from '../coop/abe';

/** Fotos por segundo. */
export const SNAP_HZ = 15;
/** Cuánto atrasado dibuja el que mira, en ms: un poco más que el tiempo entre dos fotos. */
export const DELAY_MS = 130;

/** Lo que está mostrando un animador: locomoción, piernas aparte y el clip de cuerpo entero si hay. */
export interface AnimState {
  /** Locomoción y su velocidad. */
  l: string;
  ls: number;
  /** Las piernas corriendo debajo de un clip posado (el tenista). */
  legs: [string, number] | null;
  /** Clip de cuerpo entero: nombre, instante, velocidad (0 = quieto en ese instante) y si va solo arriba. */
  s: [string, number, number, boolean] | null;
}

export interface PlayerSnap {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Visible (titila al recibir un golpe). */
  v: boolean;
  /** Palo en la mano. */
  c: string;
  /** El parpadeo rojo del golpe recibido, en este instante. */
  fl: boolean;
  /** El swing por código: cuánto pesa y en qué ángulo va. */
  rw: number;
  rp: number;
  a: AnimState;
}

/** Banderas de un enemigo, de a un bit. */
export const EF = {
  frozen: 1,
  burning: 2,
  powder: 4,
  warded: 8,
  divine: 16,
  dodgeCooling: 32,
  passed: 64,
  flash: 128,
  bannered: 256,
} as const;

export interface EnemySnap {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 0 camina, 1 ataca, 2 muere. */
  st: number;
  hp: number;
  mhp: number;
  /** Banderas `EF`. */
  f: number;
  /** Frío y silencio: lo que le queda y de cuánto, o 0. */
  ch: [number, number] | 0;
  si: [number, number] | 0;
  /** Escala del cuerpo (élite, gigante, lupa, hundiéndose en el hoyo). */
  sc: number;
  /** Altura del saltito de la esquiva. */
  hop: number;
  /** El gesto de brazos por código: cuánto, y en qué punto del ataque va. */
  g: number;
  u: number;
  a: AnimState;
  /** La primera vez que se lo ve: de qué tipo es y con qué poderes, para armarlo. */
  spawn?: { kind: string; mods: Record<string, unknown> };
}

/** Una pelota en el aire (de palo o de habilidad): solo cómo se ve. */
export interface BallSnap {
  id: number;
  x: number;
  y: number;
  z: number;
  /** Tamaño, en radios de pelota. */
  s: number;
  /** Color y brillo, transparencia, color y visibilidad de la estela, y si se ve. */
  c: number;
  i: number;
  o: number;
  tc: number;
  tv: boolean;
  v: boolean;
  /** La marca roja en el piso de la que vuelve de un escudo: x, y, z, transparencia y tamaño. */
  m?: [number, number, number, number, number];
}

/** Lo que tiran los enemigos: la piedra del gólem y el hechizo (con su marca en el piso). */
export interface ProjSnap {
  id: number;
  k: 'rock' | 'spell';
  x: number;
  y: number;
  z: number;
  m?: [number, number, number, number];
}

/** Zona de hielo, hoyo o bandera en el piso. */
export interface MarkSnap {
  id: number;
  k: 'ice' | 'hole' | 'flag';
  x: number;
  y: number;
  z: number;
  r: number;
  /** Segundos que le quedan: en el último medio se apaga. */
  l: number;
}

export interface CartSnap {
  id: number;
  x: number;
  z: number;
  dir: number;
}

/** Las lomas del geomante: x, z, altura, radios y altura a la que van. */
export type MoundSnap = [number, number, number, number, number, number];

/** Cómo va la partida: lo que muestra el HUD de arriba. */
export interface GameSnap {
  /** Empezó, pausa, eligiendo carta, terminó. */
  st: boolean;
  pa: boolean;
  cd: boolean;
  en: string | null;
  gate: number;
  gmax: number;
  hp: number;
  mhp: number;
  /** Oleada: número, cuántas, vivos, por salir, respiro. Null en el tutorial. */
  w: [number, number, number, number, number] | null;
  sc: number;
  score: number;
  kills: number;
  /** Bolsillo del tenis: cuántas y de cuántas. */
  pk?: [number, number];
  /** Los hechizos de Abe, en el orden de los botones: segundos que le faltan, de cuánto es la recarga, y el radio. */
  abe: [number, number, number][];
}

export interface Snap {
  k: 'snap';
  /** Hora del que juega, en ms. */
  t: number;
  g: GameSnap;
  p: PlayerSnap | null;
  e: EnemySnap[];
  b: BallSnap[];
  r: ProjSnap[];
  mk: MarkSnap[];
  ca: CartSnap[];
  mo: MoundSnap[];
  /** Los granizos de Abe en camino. */
  ab: StrikeSnap[];
}

/** El saludo: con qué partida se va a encontrar el que mira. */
export interface Hello {
  k: 'hello';
  /** Versión publicada del que juega: si no coincide, avisa. */
  v: string;
  /** Campo: 0 liso, 1..N el campo con relieve. */
  course: number;
  tenis: boolean;
  skin: string;
  /** Los poderes de los escenarios, para los íconos de arriba. */
  powers: string[];
  /** El momento del día (0 mañana, 1 atardecer). */
  day: number;
}

/** Un evento suelto: un método del que juega que el que mira repite (efecto, sonido o cartel). */
export interface NetEvent {
  k: 'ev';
  t: number;
  o: 'fx' | 'au' | 'hud' | 'vis';
  f: string;
  a: unknown[];
}

/** El que juega cierra o recarga la página. */
export interface Bye {
  k: 'bye';
}

/** Qué es el que mira: Abe (el primero que entró, que tira el granizo) o solo espectador. */
export interface Role {
  k: 'role';
  abe: boolean;
}

export type HostMsg = Snap | Hello | NetEvent | Bye | Role;

/** El que mira se presenta: el que juega le contesta con el saludo. */
export interface Watch {
  k: 'watch';
}

/** Abe tira el granizo en (x, z). */
export interface Cast {
  k: 'cast';
  /** Cuál de sus hechizos (ver SPELL_ORDER). */
  s: string;
  x: number;
  z: number;
}

// ---------- cuentas ----------

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Entre dos ángulos por el camino corto. */
export function lerpAngle(a: number, b: number, u: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}

/** Redondea para mandar menos: centímetros alcanzan. */
export const r2 = (v: number) => Math.round(v * 100) / 100;
export const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * La hora del que juega, vista desde el que mira. Cada foto trae la hora con que salió: la diferencia con
 * la hora local, suavizada, dice qué hora es allá. Si una llega más temprano de lo esperado, se cree en el
 * acto (es la mejor señal de cuánto tarda la red); si llega tarde, se acomoda de a poco.
 */
export class HostClock {
  private offset = Number.NaN;

  sync(hostT: number, localT: number): void {
    const o = hostT - localT;
    if (Number.isNaN(this.offset) || o > this.offset + 500 || o < this.offset - 2000) this.offset = o;
    else if (o > this.offset) this.offset += (o - this.offset) * 0.5;
    else this.offset += (o - this.offset) * 0.02;
  }

  get ready(): boolean {
    return !Number.isNaN(this.offset);
  }

  /** La hora de allá a la que se dibuja: `DELAY_MS` atrás. */
  renderTime(localT: number): number {
    return localT + this.offset - DELAY_MS;
  }
}

/** Las fotos que llegaron, en orden, para buscar las dos que rodean una hora. */
export class Timeline<T extends { t: number }> {
  readonly frames: T[] = [];

  push(f: T): void {
    // llegan en orden casi siempre; si no, se acomoda
    let i = this.frames.length;
    while (i > 0 && this.frames[i - 1].t > f.t) i--;
    this.frames.splice(i, 0, f);
    // con un segundo de historia alcanza
    const last = this.frames[this.frames.length - 1].t;
    while (this.frames.length > 2 && this.frames[0].t < last - 1000) this.frames.shift();
  }

  clear(): void {
    this.frames.length = 0;
  }

  get latest(): T | null {
    return this.frames[this.frames.length - 1] ?? null;
  }

  /**
   * Las dos fotos alrededor de `t` y cuánto de la segunda (0..1). Antes de la primera, la primera; después
   * de la última, la última (quieto ahí hasta que llegue otra).
   */
  sample(t: number): { a: T; b: T; u: number } | null {
    const f = this.frames;
    if (!f.length) return null;
    if (t <= f[0].t) return { a: f[0], b: f[0], u: 0 };
    for (let i = 1; i < f.length; i++) {
      if (f[i].t < t) continue;
      const a = f[i - 1];
      const b = f[i];
      return { a, b, u: b.t > a.t ? (t - a.t) / (b.t - a.t) : 1 };
    }
    const last = f[f.length - 1];
    return { a: last, b: last, u: 1 };
  }
}

/** Los eventos que esperan su hora. */
export class EventQueue<T extends { t: number }> {
  private readonly list: T[] = [];

  push(e: T): void {
    this.list.push(e);
  }

  /** Saca los que ya tocan (hasta `t`), en el orden en que pasaron. */
  due(t: number): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.list.length; ) {
      if (this.list[i].t <= t) out.push(...this.list.splice(i, 1));
      else i++;
    }
    return out.sort((a, b) => a.t - b.t);
  }

  clear(): void {
    this.list.length = 0;
  }

  get size(): number {
    return this.list.length;
  }
}

/** Por id: para encontrar la misma cosa en la foto de antes. */
export function byId<T extends { id: number }>(list: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const x of list) m.set(x.id, x);
  return m;
}

/** Los argumentos de un evento, listos para mandar: los vectores pasan a `{ v: [x, y, z] }`. */
export function encodeArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    const v = a as { isVector3?: boolean; x: number; y: number; z: number };
    return v && typeof v === 'object' && v.isVector3 ? { v: [r2(v.x), r2(v.y), r2(v.z)] } : a;
  });
}
