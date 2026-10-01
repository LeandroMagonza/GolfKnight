// La entrada al juego. La historia la cuenta la cinemática (cine.html), que se abre arriba de todo en
// un iframe apenas se entra, mientras el juego carga por debajo; al terminarla o saltarla queda la placa
// de controles, y de ahí se arranca. Las placas con la historia en texto se fueron: las reemplaza la
// cinemática.
//
// Sale una vez por sesión (al reiniciar con R no vuelve), se puede volver a ver con su botón, y
// ?sincine en la URL la saca. En las pruebas automáticas no sale (taparía los botones), salvo con ?cine.
//
// El tutorial: la primera vez, el botón grande lo empieza y abajo se lo puede saltear. Cuando ya se hizo
// (o se salteó), el botón grande va directo a la partida y abajo se lo puede repetir.

interface Slide {
  art: string;
  html: string;
}

const SLIDES: Slide[] = [
  {
    art: '',
    html: `<p class="controls">
      Apuntá con el <kbd>mouse</kbd>: la <em>distancia</em> del cursor es dónde cae la pelota<br />
      Mantené <kbd>click</kbd> para cargar y soltá para pegar: el arco dice <em>qué tan bien</em>, del verde al rojo (con el wedge, el gris pifia)<br />
      <kbd>1</kbd> driver · <kbd>2</kbd> hierro 7 · <kbd>3</kbd> wedge · <kbd>4</kbd> putter: cada palo cobra mejor a su distancia<br />
      <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd>: las habilidades que elegís entre oleadas, al instante hacia el mouse<br />
      Se pega donde hay <em>pelota</em>: de puesto en puesto con <kbd>A</kbd> y <kbd>D</kbd> (cargando, te corren de costado)<br />
      <kbd>Espacio</kbd> clava el golpe · cancelar <kbd>click der.</kbd> · pausa <kbd>Esc</kbd><br />
      Que no lleguen a la puerta.
    </p>`,
  },
];

/** La placa del modo tenis: los mismos botones, otro juego. */
const TENNIS_SLIDE: Slide = {
  art: '',
  html: `<p class="controls">
      <em>Modo tenis</em> (prototipo): la pelota rebota en el enemigo y vuelve en espejo. Al que matás, lo atraviesa<br />
      Caminá de costado con <kbd>A</kbd> y <kbd>D</kbd> · la marca en tu línea dice dónde va a caer cada pelota<br />
      <kbd>Click</kbd> para prepararte y soltá cuando la pelota llega: el arco marca el momento justo (y si estás a tiro)<br />
      Sin pelota que venga, sacás: tirás la pelota para arriba y soltás cuando llega arriba<br />
      Cuantas más veces devolvés la misma pelota, más pega. La que no devolvés vuelve sola al bolsillo<br />
      <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> habilidades · pausa <kbd>Esc</kbd>
    </p>`,
};

const SEEN_KEY = 'gk.introSeen';
const CINE_URL = './cine.html?embed';

export class Intro {
  private index = 0;
  private readonly slide = document.getElementById('slide')!;
  private readonly dots = document.getElementById('dots')!;
  private readonly next = document.getElementById('start') as HTMLButtonElement;
  private ready = false;
  private cine: HTMLIFrameElement | null = null;
  private readonly alt = document.getElementById('alt') as HTMLButtonElement;
  private readonly mode = document.getElementById('mode') as HTMLButtonElement;

  /**
   * @param tutorialFirst el botón grande empieza el tutorial (la primera vez)
   * @param tennis se está en el modo tenis; `onMode` pasa al otro modo
   */
  constructor(private readonly onStart: (tutorial: boolean) => void, private readonly tutorialFirst: boolean, private readonly tennis = false, onMode?: () => void) {
    if (tennis) SLIDES.splice(0, SLIDES.length, TENNIS_SLIDE);
    this.mode.addEventListener('click', () => onMode?.());
    const version = document.getElementById('version');
    if (version) version.textContent = `versión ${__BUILD__}`;
    this.dots.innerHTML = SLIDES.length > 1 ? SLIDES.map(() => '<span></span>').join('') : '';
    this.next.addEventListener('click', () => this.advance());
    this.alt.addEventListener('click', () => this.finish(!this.tutorialFirst));
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
    if (this.last) this.finish(this.tutorialFirst);
    else {
      this.index++;
      this.render();
    }
  }

  private finish(tutorial: boolean): void {
    if (!this.ready || this.cine) return;
    sessionStorage.setItem(SEEN_KEY, '1');
    this.onStart(tutorial);
  }

  private render(): void {
    const s = SLIDES[this.index];
    this.slide.innerHTML = (s.art ? `<div class="art">${s.art}</div>` : '') + s.html;
    Array.from(this.dots.children).forEach((d, i) => d.classList.toggle('on', i === this.index));
    // la historia se puede leer mientras carga; solo el arranque espera a los modelos
    this.next.disabled = this.last && !this.ready;
    const go = this.tennis ? '¡A jugar! (Espacio)' : this.tutorialFirst ? 'Aprender a jugar (Espacio)' : '¡A defender Valdehoyo! (Espacio)';
    this.next.textContent = this.last ? (this.ready ? go : 'Cargando…') : 'Siguiente (Espacio)';
    // en el tenis no hay tutorial
    this.alt.hidden = !this.last || !this.ready || this.tennis;
    this.mode.hidden = !this.ready;
    this.mode.textContent = this.tennis ? 'Volver al golf' : 'Probar el modo tenis (nuevo)';
    this.alt.textContent = this.tutorialFirst ? 'Saltar el tutorial' : 'Hacer el tutorial';
  }
}
