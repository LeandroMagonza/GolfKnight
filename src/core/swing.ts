// Medidor de potencia del swing. Mientras se mantiene apretado sube de 0 a 1, y al llegar al tope
// rebota por todo el rango: baja hasta 0 y vuelve a subir. Soltar cerca del tope es el crítico.
//
// La subida no es pareja: arranca lenta y termina rápida. Lenta al principio, para que tirar rápido
// tenga un costo (el nivel 2 no sale con un toque); rápida al final y en el rebote, para que clavar el
// swing perfecto pida timing de verdad.
//
// El alcance del tiro va aparte (reach): sube con la carga y, cuando llegó al máximo, se queda ahí.
// Lo que sigue oscilando es solo la potencia, que define el daño y el swing perfecto.

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
  charging = false;

  start(chargeTime: number): void {
    this.charging = true;
    this.elapsed = 0;
    this.chargeTime = chargeTime;
  }

  update(dt: number): void {
    if (this.charging) this.elapsed += dt;
  }

  /** Potencia actual 0..1: sube acelerando hasta 1 y después oscila rápido entre 1 y REBOUND_FLOOR. */
  get power(): number {
    if (!this.charging) return 0;
    const u = this.elapsed / this.chargeTime;
    if (u <= 1) return Math.pow(u, RISE_CURVE);
    const span = 1 - REBOUND_FLOOR;
    const v = ((u - 1) * REBOUND_SPEED) % (2 * span);
    return v <= span ? 1 - v : REBOUND_FLOOR + (v - span);
  }

  /** Alcance 0..1: la carga máxima alcanzada en este swing. Llega a 1 y no vuelve a bajar. */
  get reach(): number {
    if (!this.charging) return 0;
    return Math.pow(Math.min(1, this.elapsed / this.chargeTime), RISE_CURVE);
  }

  /** Lleva el medidor a una potencia exacta (en la subida). Para pruebas automáticas. */
  setPower(power: number): void {
    this.elapsed = Math.pow(Math.min(1, Math.max(0, power)), 1 / RISE_CURVE) * this.chargeTime;
  }

  /** Termina la carga y devuelve la potencia del tiro. */
  release(): { power: number; perfect: boolean; reach: number } {
    const raw = this.power;
    const reach = this.reach;
    this.charging = false;
    return { power: Math.max(MIN_POWER, raw), perfect: raw >= PERFECT_FROM, reach: Math.max(MIN_POWER, reach) };
  }

  cancel(): void {
    this.charging = false;
  }
}
