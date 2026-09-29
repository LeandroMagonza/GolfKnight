// La entrada al juego. La historia la cuenta la cinemática (cine.html), que se abre arriba de todo en
// un iframe apenas se entra, mientras el juego carga por debajo; al terminarla o saltarla queda la placa
// de controles, y de ahí se arranca. Las placas con la historia en texto se fueron: las reemplaza la
// cinemática.
//
// Sale una vez por sesión (al reiniciar con R no vuelve), se puede volver a ver con su botón, y
// ?sincine en la URL la saca. En las pruebas automáticas no sale (taparía los botones), salvo con ?cine.

interface Slide {
  art: string;
  html: string;
}

const SLIDES: Slide[] = [
  {
    art: '',
    html: `<p class="controls">
      Apuntá con el <kbd>mouse</kbd>: la <em>distancia</em> del cursor es dónde cae la pelota<br />
      Mantené <kbd>click</kbd> para cargar y soltá para pegar: el arco dice <em>qué tan bien</em>, del verde al rojo<br />
      <kbd>1</kbd> driver · <kbd>2</kbd> hierro 7 · <kbd>3</kbd> wedge · <kbd>4</kbd> putter: cada palo cobra mejor a su distancia<br />
      <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd>: las habilidades que elegís entre oleadas, al instante hacia el mouse<br />
      Se pega donde hay <em>pelota</em>: de puesto en puesto con <kbd>A</kbd> y <kbd>D</kbd> (cargando, te corren de costado)<br />
      <kbd>Espacio</kbd> clava el golpe · cancelar <kbd>click der.</kbd> · pausa <kbd>Esc</kbd><br />
      Que no lleguen a la puerta.
    </p>`,
  },
];

const SEEN_KEY = 'gk.introSeen';
const CINE_URL = './cine.html?embed';

export class Intro {
  private index = 0;
  private readonly slide = document.getElementById('slide')!;
  private readonly dots = document.getElementById('dots')!;
  private readonly next = document.getElementById('start') as HTMLButtonElement;
  private ready = false;
  private cine: HTMLIFrameElement | null = null;

  constructor(private readonly onStart: () => void) {
    const version = document.getElementById('version');
    if (version) version.textContent = `versión ${__BUILD__}`;
    this.dots.innerHTML = SLIDES.length > 1 ? SLIDES.map(() => '<span></span>').join('') : '';
    this.next.addEventListener('click', () => this.advance());
    document.getElementById('replaycine')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.playCine();
    });
    addEventListener('message', (e) => {
      if (e.origin === location.origin && e.data?.type === 'gk-cine-end') this.closeCine();
    });
    this.render();
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(SEEN_KEY);
    } catch { /* sin sessionStorage: se ve */ }
    const params = new URLSearchParams(location.search);
    if (params.has('cine') || (!seen && !params.has('sincine') && !navigator.webdriver)) this.playCine();
  }

  /** La cinemática, a pantalla completa arriba del juego. Cuando termina o se salta, avisa con un mensaje. */
  playCine(): void {
    if (this.cine) return;
    const frame = document.createElement('iframe');
    frame.id = 'cine';
    frame.src = CINE_URL;
    frame.allow = 'autoplay; fullscreen';
    frame.addEventListener('load', () => frame.focus());
    document.body.appendChild(frame);
    this.cine = frame;
  }

  private closeCine(): void {
    this.cine?.remove();
    this.cine = null;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch { /* la próxima vez sale de nuevo */ }
    this.next.focus();
  }

  /** Los modelos terminaron de cargar: se puede empezar. */
  setReady(): void {
    this.ready = true;
    this.render();
  }

  setError(text: string): void {
    this.next.disabled = true;
    this.next.textContent = text;
  }

  get last(): boolean {
    return this.index === SLIDES.length - 1;
  }

  advance(): void {
    // con la cinemática arriba, el Espacio es de ella
    if (this.cine) return;
    if (this.last) this.finish();
    else {
      this.index++;
      this.render();
    }
  }

  private finish(): void {
    if (!this.ready || this.cine) return;
    sessionStorage.setItem(SEEN_KEY, '1');
    this.onStart();
  }

  private render(): void {
    const s = SLIDES[this.index];
    this.slide.innerHTML = (s.art ? `<div class="art">${s.art}</div>` : '') + s.html;
    Array.from(this.dots.children).forEach((d, i) => d.classList.toggle('on', i === this.index));
    // la historia se puede leer mientras carga; solo el arranque espera a los modelos
    this.next.disabled = this.last && !this.ready;
    this.next.textContent = this.last ? (this.ready ? '¡A defender Valdehoyo! (Espacio)' : 'Cargando…') : 'Siguiente (Espacio)';
  }
}
