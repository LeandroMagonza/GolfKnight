// Teclado y mouse.
// A y D mueven de puesto en puesto (un toque = un puesto; mantener apretado no repite) y el mouse
// apunta y decide a qué distancia cae. Click izquierdo mantiene para cargar el swing y suelta para
// pegar; click derecho (o X) cancela. Espacio clava la calidad del golpe, y el tiro sale cuando se
// suelta el click (en la intro, avanza). **1, 2, 3 y 4 eligen el palo** (y la rueda del mouse los
// recorre en círculo); **Q, W y E eligen el poder**. Shift (o V) es el palazo, B abre el panel de
// balance, Escape pausa, R reinicia, C cambia el skin, M silencia la música.

export interface InputEvents {
  swingStart(): void;
  swingRelease(): void;
  swingCancel(): void;
  /** Elige poder: 0 = golpe, 1 = escarcha, 2 = vendaval. */
  selectEnchant(index: number): void;
  /** Elige palo por posición: 0 = driver, 1 = hierro, 2 = wedge, 3 = putter. */
  selectClub(index: number): void;
  /** Pasa al palo anterior (-1) o al siguiente (+1), en círculo (la rueda del mouse). */
  cycleClub(delta: number): void;
  /** Abre o cierra el panel de balance. */
  debugPanel(): void;
  space(): void;
  restart(): void;
  pause(): void;
  muteToggle(): void;
  skin(): void;
  melee(): void;
  /** Un toque de movimiento lateral: +1 hacia la derecha de la pantalla, -1 hacia la izquierda. */
  step(right: number): void;
}

export class Input {
  readonly keys = new Set<string>();
  /** Posición del mouse en coordenadas normalizadas (-1..1), para el raycast de puntería. */
  readonly pointer = { x: 0, y: 0.3 };
  /** El botón de cargar sigue apretado: si llega a un puesto con pelota, la carga arranca sola. */
  swingHeld = false;

  constructor(private ev: InputEvents, target: HTMLElement) {
    addEventListener('keydown', (e) => this.keydown(e));
    addEventListener('keyup', (e) => this.keyup(e));
    addEventListener('blur', () => {
      this.keys.clear();
      this.swingHeld = false;
      this.ev.swingCancel();
    });
    addEventListener('mousemove', (e) => {
      this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    });
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.swingHeld = true;
        this.ev.swingStart();
      } else if (e.button === 2) {
        this.swingHeld = false;
        this.ev.swingCancel();
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.swingHeld = false;
        this.ev.swingRelease();
      }
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => this.ev.cycleClub(e.deltaY > 0 ? 1 : -1), { passive: true });
  }

  private keydown(e: KeyboardEvent): void {
    if (e.repeat) return;
    // escribiendo en el panel de balance el teclado es del panel, no del juego
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    this.keys.add(e.code);
    switch (e.code) {
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
        this.ev.selectClub(Number(e.code.slice(-1)) - 1);
        break;
      case 'KeyQ': this.ev.selectEnchant(0); break;
      case 'KeyW': this.ev.selectEnchant(1); break;
      case 'KeyE': this.ev.selectEnchant(2); break;
      case 'KeyB': this.ev.debugPanel(); break;
      case 'KeyX': this.swingHeld = false; this.ev.swingCancel(); break;
      case 'Space': this.ev.space(); e.preventDefault(); break;
      case 'KeyR': this.ev.restart(); break;
      case 'Escape': this.ev.pause(); break;
      case 'KeyM': this.ev.muteToggle(); break;
      case 'KeyC': this.ev.skin(); break;
      case 'KeyD': case 'ArrowRight': this.ev.step(1); break;
      case 'KeyA': case 'ArrowLeft': this.ev.step(-1); break;
      case 'ShiftLeft': case 'ShiftRight': case 'KeyV': this.ev.melee(); break;
    }
  }

  private keyup(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

}
