// Medidor del swing. Mientras se mantiene apretado sube de 0 a 1, y al llegar al tope rebota por todo el
// rango: baja hasta 0 y vuelve a subir. Soltar arriba, en el golpe fuerte, es el crítico.
//
// **Se define por tiempos, no por forma.** La barra está repartida en tres tramos (débil, medio y
// fuerte, con los umbrales de QUALITY_FROM) y cada uno dura sus segundos: el débil tarda `weak` en
// cruzarse, el medio `mid`, y el fuerte dura `strong` en cada pasada (sube hasta el tope y vuelve a
// bajar al umbral). Después viene el rebote: baja hasta 0 en `rebound` segundos, sube en otros tantos
// y vuelve a pasar por el fuerte, que dura otra vez `strong`.
//
// Así cada cosa que le importa al jugador es un número suelto:
// - **cuándo abre el golpe fuerte** es `weak + mid`: el momento que uno se aprende;
// - **cuánto dura** es `strong`: qué tan difícil es clavarlo.
// Las mejoras tocan uno u otro sin arrastrar al otro (ver `timingWith`). Antes había un tiempo total y
// una curva, y apurar la barra entera achicaba también la ventana del fuerte: la mejora castigaba.
//
// El alcance del tiro va aparte (reach): sube con la carga y, cuando llegó al tope, se queda ahí.
//
// Tiro en dos tiempos: mientras se carga se puede CLAVAR la potencia (lock). La barra deja de moverse y
// el tiro sale con ese nivel cuando se suelte, así se puede timear el daño primero y esperar a que los
// enemigos se alineen después. El alcance sigue creciendo aunque la potencia esté clavada.

/** Potencia mínima de un tiro, para que un click corto igual salga. */
export const MIN_POWER = 0.08;
/** Dónde empieza el golpe fuerte si nadie dice otra cosa (el juego pasa los de QUALITY_FROM). */
export const PERFECT_FROM = 0.92;

/** Los segundos de cada tramo de la barra. */
export interface ChargeTimes {
  /** Lo que tarda en cruzar el tramo débil, desde que apretás. */
  weak: number;
  /** Lo que tarda en cruzar el medio. Con esto, el fuerte abre a los `weak + mid`. */
  mid: number;
  /** Lo que dura el fuerte **en cada pasada**: sube hasta el tope y vuelve al umbral. */
  strong: number;
  /** El rebote: lo que tarda en bajar desde el fuerte hasta 0, y otro tanto en volver a subir. */
  rebound: number;
}

/** Cómo cambian los tiempos las mejoras. Se pueden combinar. */
export interface TimingMods {
  /** El débil tarda esto (muñeca rápida): el medio y el fuerte llegan antes, y duran lo mismo. */
  weakMul: number;
  /** El débil y el medio tardan esto (ritmo): el fuerte abre antes y dura lo mismo. */
  lowMul: number;
  /** El fuerte dura esto (punto dulce): abre en el mismo momento y el rebote llega más tarde. */
  strongMul: number;
}

export const NO_MODS: TimingMods = { weakMul: 1, lowMul: 1, strongMul: 1 };

/**
 * Los tiempos de la barra con las mejoras encima. Cada mejora mueve un solo número: la muñeca acorta el
 * débil y el punto dulce alarga el fuerte. Con las dos la barra queda más pareja (el débil era el más
 * largo y el fuerte el más corto), pero el fuerte sigue siendo el tramo más difícil de clavar. Hasta el
 * 5/10 había un «swing parejo» que llevaba los tres tramos a durar lo mismo: adelantaba y alargaba el
 * fuerte a la vez, y con un nivel ya daba más ventana que el punto dulce al máximo.
 */
export function timingWith(base: ChargeTimes, mods: TimingMods): ChargeTimes {
  return {
    weak: base.weak * mods.weakMul * mods.lowMul,
    mid: base.mid * mods.lowMul,
    strong: base.strong * mods.strongMul,
    rebound: base.rebound,
  };
}

const MIN_SEGMENT = 1e-4;

/**
 * **El arco a velocidad pareja.** La aguja sube siempre a la misma velocidad angular, y cada tramo ocupa
 * en el arco lo que dura: así el tamaño del tramo es la ventana de tiempo, que es lo que importa. La
 * velocidad sale de la barra sin mejoras (`base`): de borde a tope, 90°. Con las mejoras el arco cambia
 * de tamaño en vez de cambiar la velocidad: el punto dulce agranda el rojo (y el arco entero, un poco);
 * la muñeca rápida achica el verde y el ritmo el verde y el amarillo (el arco se achica: el rojo llega
 * antes).
 *
 * Todo en grados. `weak` y `mid` son lo que ocupan esos tramos de cada lado; `strong` es **media**
 * ventana del fuerte (de cada lado del tope, porque la aguja pasa por el tope y vuelve); `span` es de
 * borde a tope. El rebote no entra acá: tiene su propio tiempo y la aguja lo recorre como pueda.
 */
export interface ArcLayout {
  weak: number;
  mid: number;
  strong: number;
  span: number;
}

export function arcLayout(times: ChargeTimes, base: ChargeTimes): ArcLayout {
  const perSec = 90 / (base.weak + base.mid + base.strong / 2);
  const weak = times.weak * perSec;
  const mid = times.mid * perSec;
  const strong = (times.strong / 2) * perSec;
  return { weak, mid, strong, span: weak + mid + strong };
}

/**
 * **El arco con el golpe 4** (10/10, Leandro: con el talento el 3 no se veía). El fuerte se parte en tres
 * (3, 4, 3) y cada 3 dura 15 ms, menos que un cuadro: a velocidad pareja ocupa 1.6°, y el borde de los
 * tramos lo tapa. Tres formas, a elegir en el panel B (Visual):
 * - `medio`: medio círculo a velocidad pareja, como sin el talento;
 * - `extendido`: tres cuartos de vuelta (`span` de cada lado, en vez de 90°), a velocidad pareja: todo una
 *   vez y media más grande, pero el 3 sigue sin verse (2.4°);
 * - `lupa`: tres cuartos de vuelta, y el fuerte agrandado a `strong` de cada lado; el verde y el amarillo
 *   se reparten lo que queda, en proporción. La aguja cruza el rojo más rápido: el tramo es más grande,
 *   no dura más.
 */
export const FOURTH_ARCS = ['medio', 'extendido', 'lupa'] as const;
export type FourthArc = (typeof FOURTH_ARCS)[number];
export const FOURTH_ARC = { span: 135, strong: 20 };

/** El arco de `layout` en la forma `mode` (ver FOURTH_ARCS), y cuánto se agranda su tope (90° → `span`). */
export function fourthArc(layout: ArcLayout, mode: FourthArc): { layout: ArcLayout; widen: number } {
  if (mode === 'medio') return { layout, widen: 1 };
  const widen = FOURTH_ARC.span / 90;
  const wide = { weak: layout.weak * widen, mid: layout.mid * widen, strong: layout.strong * widen, span: layout.span * widen };
  if (mode === 'extendido' || wide.strong >= FOURTH_ARC.strong) return { layout: wide, widen };
  const rest = wide.span - FOURTH_ARC.strong;
  const low = wide.weak + wide.mid;
  return { layout: { weak: (wide.weak * rest) / low, mid: (wide.mid * rest) / low, strong: FOURTH_ARC.strong, span: wide.span }, widen };
}

/**
 * Dónde va la aguja para una potencia, en grados desde el borde del arco: la potencia de cada tramo se
 * reparte en lo que ocupa ese tramo. `marks` son los umbrales de potencia del medio y del fuerte.
 */
export function arcAngle(power: number, marks: readonly [number, number], layout: ArcLayout): number {
  const [a, b] = marks;
  const p = Math.min(1, Math.max(0, power));
  if (p < a) return (p / a) * layout.weak;
  if (p < b) return layout.weak + ((p - a) / (b - a)) * layout.mid;
  return layout.weak + layout.mid + ((p - b) / (1 - b)) * layout.strong;
}

export class SwingMeter {
  private elapsed = 0;
  private times: ChargeTimes = { weak: 0.63, mid: 0.185, strong: 0.06, rebound: 0.3 };
  /** Dónde empiezan el medio y el fuerte, en fracción de la barra. */
  private midFrom = 0.55;
  private strongFrom = PERFECT_FROM;
  charging = false;
  /** Potencia clavada a mano, o null si la barra sigue corriendo. */
  private lockedPower: number | null = null;
  /** De qué lado quedó la aguja al clavar. */
  private lockedSide = -1;

  /**
   * @param times los segundos de cada tramo, ya con las mejoras
   * @param marks dónde empiezan el tramo medio y el fuerte, en fracción de la barra
   */
  start(times: ChargeTimes, marks: [number, number] = [0.55, PERFECT_FROM]): void {
    this.charging = true;
    this.lockedPower = null;
    this.elapsed = 0;
    this.times = {
      weak: Math.max(MIN_SEGMENT, times.weak),
      mid: Math.max(MIN_SEGMENT, times.mid),
      strong: Math.max(MIN_SEGMENT, times.strong),
      rebound: Math.max(MIN_SEGMENT, times.rebound),
    };
    this.midFrom = marks[0];
    this.strongFrom = Math.max(marks[0], Math.min(0.999, marks[1]));
  }

  update(dt: number): void {
    if (this.charging) this.elapsed += dt;
  }

  /** Segundos que tiene la barra con estos tiempos. Para las pruebas y el panel. */
  get timing(): ChargeTimes {
    return { ...this.times };
  }

  /** Potencia actual 0..1. */
  get power(): number {
    if (!this.charging) return 0;
    if (this.lockedPower !== null) return this.lockedPower;
    const { weak, mid, strong, rebound } = this.times;
    const a = this.midFrom;
    const b = this.strongFrom;
    let e = this.elapsed;
    if (e < weak) return (a * e) / weak;
    e -= weak;
    if (e < mid) return a + ((b - a) * e) / mid;
    e -= mid;
    // de acá en adelante se repite: pasada por el fuerte, bajada, subida
    e %= strong + 2 * rebound;
    if (e < strong) return b + (1 - b) * (1 - Math.abs((2 * e) / strong - 1));
    e -= strong;
    if (e < rebound) return b * (1 - e / rebound);
    return (b * (e - rebound)) / rebound;
  }

  /**
   * De qué lado del arco va la aguja: -1 a la izquierda, 1 a la derecha. En el arco el tope (el fuerte)
   * está arriba en el medio y el 0 en los dos bordes: la aguja sube por la izquierda, pasa por arriba y
   * el rebote la baja por la derecha; al volver a subir cruza otra vez, y así. Cambia de lado cada vez
   * que pasa por el tope.
   */
  get side(): number {
    if (!this.charging) return -1;
    if (this.lockedPower !== null) return this.lockedSide;
    const { weak, mid, strong, rebound } = this.times;
    const e = this.elapsed - weak - mid;
    if (e < 0) return -1;
    const cycle = strong + 2 * rebound;
    const peaks = Math.floor(e / cycle) + ((e % cycle) >= strong / 2 ? 1 : 0);
    return peaks % 2 === 0 ? -1 : 1;
  }

  /** Alcance 0..1: llega a 1 cuando la barra llega al tope por primera vez, y no vuelve a bajar. */
  get reach(): number {
    if (!this.charging) return 0;
    const { weak, mid, strong } = this.times;
    return Math.min(1, this.elapsed / (weak + mid + strong / 2));
  }

  get locked(): boolean {
    return this.charging && this.lockedPower !== null;
  }

  /** Clava la potencia donde está. Devuelve false si no se estaba cargando o ya estaba clavada. */
  lock(): boolean {
    if (!this.charging || this.lockedPower !== null) return false;
    this.lockedSide = this.side;
    this.lockedPower = Math.max(MIN_POWER, this.power);
    return true;
  }

  /** Lleva el medidor a una potencia exacta (en la subida). Para pruebas automáticas. */
  setPower(power: number): void {
    this.lockedPower = null;
    const p = Math.min(1, Math.max(0, power));
    const { weak, mid, strong } = this.times;
    const a = this.midFrom;
    const b = this.strongFrom;
    if (p <= a) this.elapsed = (p / a) * weak;
    else if (p <= b) this.elapsed = weak + ((p - a) / (b - a)) * mid;
    else this.elapsed = weak + mid + ((p - b) / (1 - b)) * (strong / 2);
  }

  /** Termina la carga y devuelve la potencia del tiro. */
  release(): { power: number; perfect: boolean; reach: number } {
    const raw = this.power;
    const reach = this.reach;
    this.charging = false;
    this.lockedPower = null;
    return { power: Math.max(MIN_POWER, raw), perfect: raw >= this.strongFrom, reach: Math.max(MIN_POWER, reach) };
  }

  cancel(): void {
    this.charging = false;
    this.lockedPower = null;
  }
}
