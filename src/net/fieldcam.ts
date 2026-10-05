// La cámara del que mira (5/10, pedido de Leandro): antes era una órbita libre, y con tanta libertad uno
// se perdía. Ahora mira siempre la cancha de frente, desde atrás de la puerta, y solo se puede:
// - **ir para adelante y para atrás** por la cancha: arrastrar para arriba o abajo (un dedo, o el botón
//   izquierdo), o las flechas;
// - **cambiar el ángulo**, de casi de costado a desde arriba del todo: botón derecho arrastrando, o dos
//   dedos para arriba o abajo;
// - **acercar o alejar**: la rueda, o pellizcar con dos dedos.
// No gira ni se va para el costado. Un toque corto (sin arrastrar) es para Abe: `onTap`.
import * as THREE from 'three';

/** Hasta dónde se puede ir, qué ángulos y qué distancias. */
const LIMITS = { z: [-5, 80], pitch: [25, 89], dist: [14, 140] } as const;
/** Más que esto (px) y ya no es un toque: es arrastrar. */
const TAP_MOVE = 6;
const TAP_MS = 500;

export class FieldCamera {
  /** El punto de la cancha que mira, sobre la línea del medio. */
  z = 30;
  /** Ángulo sobre el horizonte, en grados: 90 es desde arriba del todo. */
  pitch = 50;
  dist = 80;
  /** Adónde va (se acerca suave). */
  private readonly goal = { z: 30, pitch: 50, dist: 80 };
  /** Un toque corto en (x, y), en coordenadas de -1 a 1 de la pantalla. */
  onTap: ((x: number, y: number) => void) | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** El gesto de ahora: dónde y cuándo empezó, con qué botón, si ya arrastró, y si hubo dos dedos. */
  private press: { x: number; y: number; t: number; button: number; moved: boolean; multi: boolean } | null = null;
  private pinch = 0;

  constructor(private readonly cam: THREE.PerspectiveCamera, private readonly dom: HTMLElement, dist: number) {
    this.dist = this.goal.dist = THREE.MathUtils.clamp(dist, LIMITS.dist[0], LIMITS.dist[1]);
    dom.style.touchAction = 'none';
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => this.down(e));
    dom.addEventListener('pointermove', (e) => this.move(e));
    dom.addEventListener('pointerup', (e) => this.up(e));
    dom.addEventListener('pointercancel', (e) => this.up(e, true));
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
    this.apply();
  }

  /** Va `meters` para adelante (hacia el fondo) o para atrás. */
  walk(meters: number): void {
    this.goal.z = THREE.MathUtils.clamp(this.goal.z + meters, LIMITS.z[0], LIMITS.z[1]);
  }

  /** Sube (más desde arriba) o baja el ángulo, en grados. */
  tilt(degrees: number): void {
    this.goal.pitch = THREE.MathUtils.clamp(this.goal.pitch + degrees, LIMITS.pitch[0], LIMITS.pitch[1]);
  }

  /** Multiplica la distancia: menos de 1 acerca. */
  zoom(factor: number): void {
    this.goal.dist = THREE.MathUtils.clamp(this.goal.dist * factor, LIMITS.dist[0], LIMITS.dist[1]);
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-12 * dt);
    this.z += (this.goal.z - this.z) * k;
    this.pitch += (this.goal.pitch - this.pitch) * k;
    this.dist += (this.goal.dist - this.dist) * k;
    this.apply();
  }

  private apply(): void {
    const p = THREE.MathUtils.degToRad(this.pitch);
    this.cam.position.set(0, Math.sin(p) * this.dist, this.z - Math.cos(p) * this.dist);
    this.cam.lookAt(0, 0, this.z);
  }

  /** Cuántos metros de cancha (a lo largo) son un píxel de pantalla, más o menos, a esta distancia. */
  private metersPerPixel(): number {
    const h = this.dom.clientHeight || innerHeight;
    const visible = 2 * this.dist * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    return visible / h / Math.max(0.35, Math.sin(THREE.MathUtils.degToRad(this.pitch)));
  }

  private down(e: PointerEvent): void {
    this.dom.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.press = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button, moved: false, multi: false };
    else if (this.press) {
      this.press.multi = true;
      this.pinch = this.spread();
    }
  }

  private move(e: PointerEvent): void {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const dy = e.clientY - prev.y;
    if (this.pointers.size >= 2) {
      // dos dedos: pellizcar acerca o aleja, y moverlos juntos para arriba o abajo cambia el ángulo
      prev.x = e.clientX;
      prev.y = e.clientY;
      const spread = this.spread();
      if (this.pinch > 0 && spread > 0) this.zoom(this.pinch / spread);
      this.pinch = spread;
      this.tilt(-dy * 0.25 / this.pointers.size);
      return;
    }
    prev.x = e.clientX;
    prev.y = e.clientY;
    const press = this.press;
    if (!press) return;
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < TAP_MOVE) return;
    press.moved = true;
    // el botón derecho cambia el ángulo; el izquierdo (o un dedo) va para adelante y para atrás
    if (press.button === 2) this.tilt(-dy * 0.3);
    else this.walk(dy * this.metersPerPixel());
  }

  private up(e: PointerEvent, cancel = false): void {
    if (!this.pointers.delete(e.pointerId)) return;
    const press = this.press;
    if (this.pointers.size > 0) return;
    this.press = null;
    this.pinch = 0;
    if (cancel || !press || press.moved || press.multi || press.button !== 0 || performance.now() - press.t > TAP_MS) return;
    const r = this.dom.getBoundingClientRect();
    this.onTap?.(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  /** La distancia entre los dos primeros dedos. */
  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
