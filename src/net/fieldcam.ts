// La cámara del que mira (Abe). Desde el 9/10 (pedido de Leandro) ya no se mueve con el mouse ni con el
// dedo: con el mouse, hacer click para tirar arrastraba la cámara sin querer, e ir para adelante y para
// atrás no servía. Ahora **encuadra sola toda la cancha**, del caballero al fondo donde aparecen, en la
// parte de la pantalla que deja libre el HUD (`free`), con el caballero en una punta. Solo se elige desde
// dónde se mira:
// - `turn`: de qué lado. 0, desde atrás del caballero (queda abajo y los enemigos vienen de arriba: el
//   celular parado); 90, de costado (el caballero a la izquierda y vienen de la derecha: la compu o el
//   celular acostado); 180 y 270, los otros dos;
// - `height`: qué tan desde arriba (alta, media o baja).
// Un toque en el piso es para Abe (`onTap`): con el mouse sale al apretar; con el dedo, al soltar (mientras
// está apoyado se ve dónde caería).
import * as THREE from 'three';
import { fieldHalfAt, SPAWN_Z, TEE_LINE_Z } from '../core/field';

/** Los lados desde donde se puede mirar, en grados alrededor de la cancha. */
export const TURNS = [0, 90, 180, 270] as const;
export type Turn = (typeof TURNS)[number];
/** Qué tan desde arriba: los grados sobre el horizonte. */
export const HEIGHTS = { alta: 72, media: 55, baja: 40 } as const;
export type Height = keyof typeof HEIGHTS;
export const HEIGHT_ORDER: Height[] = ['alta', 'media', 'baja'];

/**
 * Lo que entra en cuadro: de un poco detrás de los puestos (el caballero) hasta pasando donde aparecen, a
 * lo ancho de la cancha más `side` (los carteles de distancia del costado), y hasta `top` metros de alto
 * (las cabezas de los del fondo).
 */
const FRAME = { near: TEE_LINE_Z - 3, far: SPAWN_Z + 2, side: 2.5, top: 2.5 };
/** Píxeles libres alrededor de la cancha, dentro de lo que deja el HUD. */
const PAD = 6;

export class FieldCamera {
  /** Desde dónde se mira (adónde va: se gira suave). */
  turn: Turn = 0;
  height: Height = 'alta';
  /** La parte de la pantalla donde va la cancha, en píxeles: lo que no tapan la barra de arriba y el HUD. */
  readonly free = { left: 0, top: 0, right: 0, bottom: 0 };
  /** Un toque en (x, y), en coordenadas de -1 a 1 de la pantalla. */
  onTap: ((x: number, y: number) => void) | null = null;
  /** A cuántos metros del medio de la cancha está la cámara (para la niebla). */
  get distance(): number {
    return this.dist;
  }
  /** El ángulo y la altura de ahora, que van llegando a los elegidos. */
  private az = 0;
  private pitch: number = HEIGHTS.alta;
  private dist = 100;
  /** Cuánto se corre la imagen (ver `fit`), y si ya se encuadró alguna vez (la primera, sin suavizar). */
  private shift = { x: 0, y: 0, k: 1 };
  /** El dedo apoyado (sale al soltarlo). */
  private finger: number | null = null;
  private readonly points: THREE.Vector3[] = [];
  private readonly v = new THREE.Vector3();
  private readonly target = new THREE.Vector3();

  constructor(private readonly cam: THREE.PerspectiveCamera, private readonly dom: HTMLElement) {
    dom.style.touchAction = 'none';
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.tap(e);
      } else if (this.finger === null) this.finger = e.pointerId;
    });
    dom.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this.finger) return;
      this.finger = null;
      this.tap(e);
    });
    dom.addEventListener('pointercancel', (e) => {
      if (e.pointerId === this.finger) this.finger = null;
    });
    this.free.right = innerWidth;
    this.free.bottom = innerHeight;
  }

  /** Mira desde `turn` y `height`. `now`: sin girar de a poco (al entrar). */
  view(turn: Turn, height: Height, now = false): void {
    this.turn = turn;
    this.height = height;
    if (now) {
      this.az = turn;
      this.pitch = HEIGHTS[height];
    }
  }

  /** El lado que sigue, 90° más (`dir` 1) o menos (-1). */
  rotate(dir = 1): void {
    this.turn = TURNS[(TURNS.indexOf(this.turn) + (dir > 0 ? 1 : 3)) % 4];
  }

  /** Más desde arriba (`dir` -1) o más baja (1), sin dar la vuelta. */
  raise(dir: number): void {
    const i = HEIGHT_ORDER.indexOf(this.height) + (dir > 0 ? 1 : -1);
    this.height = HEIGHT_ORDER[Math.min(HEIGHT_ORDER.length - 1, Math.max(0, i))];
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-8 * dt);
    // el giro, por el camino corto (de 270 a 0 pasa por 315)
    const d = ((((this.turn - this.az) % 360) + 540) % 360) - 180;
    this.az = Math.abs(d) < 0.05 ? this.turn : this.az + d * k;
    this.pitch += (HEIGHTS[this.height] - this.pitch) * k;
    this.fit(this.shift.k || k);
    this.shift.k = 0;
  }

  private tap(e: PointerEvent): void {
    const r = this.dom.getBoundingClientRect();
    this.onTap?.(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  /** Las esquinas de lo que tiene que entrar en cuadro (con el trapecio, el fondo más ancho). */
  private corners(): THREE.Vector3[] {
    const p = this.points;
    p.length = 0;
    for (const z of [FRAME.near, (FRAME.near + FRAME.far) / 2, FRAME.far]) {
      const half = fieldHalfAt(z) + FRAME.side;
      for (const x of [-half, half]) for (const y of [0, FRAME.top]) p.push(new THREE.Vector3(x, y, z));
    }
    return p;
  }

  /** Pone la cámara a `dist` del medio de la cancha, mirando desde el ángulo y la altura de ahora. */
  private place(dist: number): void {
    const a = THREE.MathUtils.degToRad(this.az);
    const p = THREE.MathUtils.degToRad(this.pitch);
    this.target.set(0, 0, (FRAME.near + FRAME.far) / 2);
    const back = Math.cos(p) * dist;
    this.cam.position.set(this.target.x - Math.sin(a) * back, Math.sin(p) * dist, this.target.z - Math.cos(a) * back);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.target);
    this.cam.updateMatrixWorld(true);
  }

  /** Lo que ocupa la cancha en la pantalla, en píxeles. */
  private box(w: number, h: number): { x0: number; x1: number; y0: number; y1: number } {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const c of this.points) {
      this.v.copy(c).project(this.cam);
      const x = ((this.v.x + 1) / 2) * w;
      const y = ((1 - this.v.y) / 2) * h;
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.y0 = Math.min(b.y0, y);
      b.y1 = Math.max(b.y1, y);
    }
    return b;
  }

  /**
   * Encuadra: aleja o acerca la cámara hasta que la cancha llena lo libre (sin pasarse), y después corre la
   * imagen (`setViewOffset`, que la desplaza sin girar nada) para que la punta del caballero quede contra
   * el borde de lo libre de su lado (abajo, a la izquierda, arriba o a la derecha) y lo otro, centrado. Con
   * la perspectiva el tamaño no baja justo como la distancia: se ajusta unas veces. `k`: cuánto se acerca
   * el corrimiento al que corresponde (1, de una).
   */
  private fit(k: number): void {
    const w = this.dom.clientWidth || innerWidth;
    const h = this.dom.clientHeight || innerHeight;
    const f = this.free;
    const fw = Math.max(40, f.right - f.left - 2 * PAD);
    const fh = Math.max(40, f.bottom - f.top - 2 * PAD);
    this.cam.aspect = w / h;
    this.cam.clearViewOffset();
    this.cam.updateProjectionMatrix();
    this.corners();
    let dist = this.dist;
    for (let i = 0; i < 6; i++) {
      this.place(dist);
      const b = this.box(w, h);
      const s = Math.max((b.x1 - b.x0) / fw, (b.y1 - b.y0) / fh);
      if (!Number.isFinite(s) || s <= 0) break;
      dist = THREE.MathUtils.clamp(dist * s, 20, 400);
      if (Math.abs(s - 1) < 0.004) break;
    }
    this.dist = dist;
    this.place(dist);
    const b = this.box(w, h);
    let dx = (b.x0 + b.x1) / 2 - (f.left + f.right) / 2;
    let dy = (b.y0 + b.y1) / 2 - (f.top + f.bottom) / 2;
    if (this.turn === 0) dy = b.y1 - (f.bottom - PAD);
    else if (this.turn === 180) dy = b.y0 - (f.top + PAD);
    else if (this.turn === 90) dx = b.x0 - (f.left + PAD);
    else dx = b.x1 - (f.right - PAD);
    this.shift.x += (dx - this.shift.x) * k;
    this.shift.y += (dy - this.shift.y) * k;
    this.cam.setViewOffset(w, h, this.shift.x, this.shift.y, w, h);
    this.cam.updateProjectionMatrix();
  }
}
