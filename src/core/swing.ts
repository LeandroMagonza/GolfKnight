// Medidor de potencia del swing: mientras se mantiene apretado sube de 0 a 1. Al llegar al tope no
// vuelve al principio: rebota entre el 100 % y el 70 %. Soltar cerca del tope es un swing perfecto.
// Así el costo de un tiro fuerte es el tiempo de carga; para un tiro corto que se pasó, se cancela.
//
// El alcance del tiro va aparte (reach): sube con la carga y, cuando llegó al máximo, se queda ahí.
// Lo que sigue oscilando es solo la potencia, que define el daño y el swing perfecto.

export const PERFECT_FROM = 0.92;
export const PERFECT_BONUS = 1.5;
/** Potencia mínima de un tiro, para que un click corto igual salga. */
export const MIN_POWER = 0.08;
/** Piso del rebote una vez que el medidor llegó al tope. */
export const REBOUND_FLOOR = 0.7;

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

  /** Potencia actual 0..1: sube hasta 1 y después oscila entre 1 y REBOUND_FLOOR. */
  get power(): number {
    if (!this.charging) return 0;
    const u = this.elapsed / this.chargeTime;
    if (u <= 1) return u;
    const span = 1 - REBOUND_FLOOR;
    const v = (u - 1) % (2 * span);
    return v <= span ? 1 - v : REBOUND_FLOOR + (v - span);
  }

  /** Alcance 0..1: la carga máxima alcanzada en este swing. Llega a 1 y no vuelve a bajar. */
  get reach(): number {
    if (!this.charging) return 0;
    return Math.min(1, this.elapsed / this.chargeTime);
  }

  /** Lleva el medidor a una potencia exacta (en la subida). Para pruebas automáticas. */
  setPower(power: number): void {
    this.elapsed = Math.min(1, Math.max(0, power)) * this.chargeTime;
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
