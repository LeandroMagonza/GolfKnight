// Teclado y mouse.
// A y D mueven de puesto en puesto (un toque = un puesto; mantener apretado no repite) y el mouse
// apunta. Click izquierdo mantiene para cargar el swing y suelta para pegar; click derecho (o X)
// cancela. W y S suben y bajan la altura del tiro, un escalón por toque. Espacio clava el daño de la
// carga, y el tiro sale cuando se suelta el click (en la intro, avanza). 1-3 / rueda / Q-E cambian de
// palo y F saca el putter. Shift (o V) es el palazo, G cambia cómo se apuntan los globos, Escape
// pausa, R reinicia, C cambia el skin, M silencia la música.

export interface InputEvents {
  swingStart(): void;
  swingRelease(): void;
  swingCancel(): void;
  /** Saca el putter (F). */
  putter(): void;
  /** Sube (+1) o baja (-1) un escalón la altura del tiro (W y S). */
  aimHeight(delta: number): void;
  selectClub(index: number): void;
  cycleClub(delta: number): void;
  space(): void;
  restart(): void;
  pause(): void;
  muteToggle(): void;
  skin(): void;
  lobAim(): void;
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
    this.keys.add(e.code);
    switch (e.code) {
      case 'Digit1': case 'Digit2': case 'Digit3':
        this.ev.selectClub(Number(e.code.slice(-1)) - 1);
        break;
      case 'KeyQ': this.ev.cycleClub(-1); break;
      case 'KeyE': this.ev.cycleClub(1); break;
      case 'KeyF': this.ev.putter(); break;
      case 'KeyX': this.swingHeld = false; this.ev.swingCancel(); break;
      case 'KeyW': case 'ArrowUp': this.ev.aimHeight(1); break;
      case 'KeyS': case 'ArrowDown': this.ev.aimHeight(-1); break;
      case 'Space': this.ev.space(); e.preventDefault(); break;
      case 'KeyR': this.ev.restart(); break;
      case 'Escape': this.ev.pause(); break;
      case 'KeyM': this.ev.muteToggle(); break;
      case 'KeyC': this.ev.skin(); break;
      case 'KeyG': this.ev.lobAim(); break;
      case 'KeyD': case 'ArrowRight': this.ev.step(1); break;
      case 'KeyA': case 'ArrowLeft': this.ev.step(-1); break;
      case 'ShiftLeft': case 'ShiftRight': case 'KeyV': this.ev.melee(); break;
    }
  }

  private keyup(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  private down(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** Movimiento pedido: forward (+1 = W), right (+1 = D). */
  get move(): { forward: number; right: number } {
    return {
      forward: (this.down('KeyW', 'ArrowUp') ? 1 : 0) - (this.down('KeyS', 'ArrowDown') ? 1 : 0),
      right: (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0),
    };
  }
}
