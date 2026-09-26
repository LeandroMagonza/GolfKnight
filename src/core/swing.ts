// Medidor de potencia del swing. Mientras se mantiene apretado sube de 0 a 1, y al llegar al tope
// rebota por todo el rango: baja hasta 0 y vuelve a subir. Soltar cerca del tope es el crítico.
//
// La subida no es pareja: arranca lenta y termina rápida. Lenta al principio, para que tirar rápido
// tenga un costo (el nivel 2 no sale con un toque); rápida al final y en el rebote, para que clavar el
// swing perfecto pida timing de verdad.
//
// El alcance del tiro va aparte (reach): sube con la carga y, cuando llegó al máximo, se queda ahí.
// Lo que sigue oscilando es solo la potencia, que define el daño y el swing perfecto.
//
// Tiro en dos tiempos: mientras se carga se puede CLAVAR la potencia (lock). La barra deja de moverse y
// el tiro sale con ese nivel cuando se suelte, así se puede timear el daño primero y esperar a que los
// enemigos se alineen después. El alcance sigue creciendo aunque la potencia esté clavada.
//
// Apurar la carga (las mejoras «Muñeca rápida» y «Ritmo») acelera solo el tramo de abajo, hasta donde
// empieza el golpe perfecto. De ahí para arriba, y en el rebote, la barra corre como siempre: si se
// achicara toda la barra, la ventana del perfecto también duraría menos, y la mejora terminaba siendo
// un castigo.

export const PERFECT_FROM = 0.92;
/** Potencia mínima de un tiro, para que un click corto igual salga. */
export const MIN_POWER = 0.08;
/** Piso del rebote una vez que el medidor llegó al tope. En 0, rebota por todo el rango. */
export const REBOUND_FLOOR = 0;
/** Forma de la subida: potencia = (tiempo / chargeTime) ^ RISE_CURVE. Más de 1 = lenta al principio. */
export const RISE_CURVE = 2;
/** El rebote corre a esta cantidad de barras por chargeTime: bastante más rápido que la subida media. */
export const REBOUND_SPEED = 2.6;

export class SwingMeter {
  private elapsed = 0;
  private chargeTime = 1;
  /** El apuro: el tramo de abajo tarda esta fracción de lo normal. */
  private rush = 1;
  /** Hasta qué potencia vale el apuro. */
  private rushUntil = 1;
  charging = false;
  /** Potencia clavada a mano, o null si la barra sigue corriendo. */
  private lockedPower: number | null = null;

  /**
   * @param rush el tramo de abajo tarda esta fracción de lo normal (1 = sin apuro)
   * @param rushUntil hasta qué potencia vale el apuro: de ahí para arriba la barra va a su ritmo
   */
  start(chargeTime: number, rush = 1, rushUntil = 1): void {
    this.charging = true;
    this.lockedPower = null;
    this.elapsed = 0;
    this.chargeTime = chargeTime;
    this.rush = Math.max(0.05, rush);
    this.rushUntil = Math.min(1, Math.max(0, rushUntil));
  }

  update(dt: number): void {
    if (this.charging) this.elapsed += dt;
  }

  /** Segundos de la barra sin apuro a los que equivale lo que se lleva cargando. */
  private get virtual(): number {
    const until = Math.pow(this.rushUntil, 1 / RISE_CURVE) * this.chargeTime;
    const fast = until * this.rush;
    return this.elapsed <= fast ? this.elapsed / this.rush : until + (this.elapsed - fast);
  }

  /** Lo inverso: cuánto hay que cargar de verdad para llegar a `v` segundos de la barra sin apuro. */
  private real(v: number): number {
    const until = Math.pow(this.rushUntil, 1 / RISE_CURVE) * this.chargeTime;
    return v <= until ? v * this.rush : until * this.rush + (v - until);
  }

  /** Potencia actual 0..1: sube acelerando hasta 1 y después oscila rápido entre 1 y REBOUND_FLOOR. */
  get power(): number {
    if (!this.charging) return 0;
    if (this.lockedPower !== null) return this.lockedPower;
    const u = this.virtual / this.chargeTime;
    if (u <= 1) return Math.pow(u, RISE_CURVE);
    const span = 1 - REBOUND_FLOOR;
    const v = ((u - 1) * REBOUND_SPEED) % (2 * span);
    return v <= span ? 1 - v : REBOUND_FLOOR + (v - span);
  }

  /** Alcance 0..1: la carga máxima alcanzada en este swing. Llega a 1 y no vuelve a bajar. */
  get reach(): number {
    if (!this.charging) return 0;
    return Math.pow(Math.min(1, this.virtual / this.chargeTime), RISE_CURVE);
  }

  get locked(): boolean {
    return this.charging && this.lockedPower !== null;
  }

  /** Clava la potencia donde está. Devuelve false si no se estaba cargando o ya estaba clavada. */
  lock(): boolean {
    if (!this.charging || this.lockedPower !== null) return false;
    this.lockedPower = Math.max(MIN_POWER, this.power);
    return true;
  }

  /** Lleva el medidor a una potencia exacta (en la subida). Para pruebas automáticas. */
  setPower(power: number): void {
    this.lockedPower = null;
    this.elapsed = this.real(Math.pow(Math.min(1, Math.max(0, power)), 1 / RISE_CURVE) * this.chargeTime);
  }

  /** Termina la carga y devuelve la potencia del tiro. */
  release(): { power: number; perfect: boolean; reach: number } {
    const raw = this.power;
    const reach = this.reach;
    this.charging = false;
    this.lockedPower = null;
    return { power: Math.max(MIN_POWER, raw), perfect: raw >= PERFECT_FROM, reach: Math.max(MIN_POWER, reach) };
  }

  cancel(): void {
    this.charging = false;
    this.lockedPower = null;
  }
}
