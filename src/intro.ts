// La historia, contada en placas antes de empezar. El botón principal avanza; en la última placa
// arranca el juego. "Saltar intro" va directo a jugar.

interface Slide {
  art: string;
  html: string;
}

const SLIDES: Slide[] = [
  {
    art: '⛳',
    html: '<p>Domingo, hoyo 17. Ibas <em>tres bajo el par</em>: el mejor día de tu vida.</p><p>No viste venir el carrito del caddie.</p>',
  },
  {
    art: '🛺💥',
    html: '<p>Lo último que escuchaste fue un <em>«¡FOOORE!»</em> que llegó tarde.</p><p>Y después, nada.</p>',
  },
  {
    art: '🔮',
    html: '<p>Despertás en un círculo de runas. Un mago anciano llora de emoción:</p><p><em>«¡Funcionó! ¡El Gran Guerrero de la profecía! El de brazo certero y gran corazón, campeón de su mundo, el que blande su arma con precisión letal».</em></p>',
  },
  {
    art: '🏌️',
    html: '<p>El hechizo tenía un problema: en tu mundo ya casi no quedan guerreros.</p><p>Buscó lo más parecido a esa descripción… y te encontró a vos. <em>Un golfista.</em></p>',
  },
  {
    art: '🏰',
    html: '<p>Tu bolsa de palos cruzó con vos, y el hechizo <em>los encantó</em>. Las hordas ya marchan hacia la ciudad de <em>Valdehoyo</em>.</p><p>No sos lo que pidieron. Pero sos lo que hay.</p>',
  },
  {
    art: '',
    html: `<p class="controls">
      Apuntá con el <kbd>mouse</kbd> · mantené <kbd>click</kbd> para cargar el swing y soltá para pegar<br />
      La carga sube por niveles: 1, 2 y 3 de daño, y el <em>crítico</em> de 8 si soltás justo al tope. Los cuadraditos sobre cada enemigo son su vida<br />
      Solo se pega donde hay una <em>pelota</em>: movete de puesto en puesto con <kbd>A</kbd> y <kbd>D</kbd><br />
      Buscá el ángulo para atravesar a varios de un tiro · palazo <kbd>Shift</kbd> · cancelar <kbd>click der.</kbd> · pausa <kbd>Esc</kbd><br />
      Que no lleguen a la puerta.
    </p>`,
  },
];

const SEEN_KEY = 'gk.introSeen';

export class Intro {
  private index = 0;
  private readonly slide = document.getElementById('slide')!;
  private readonly dots = document.getElementById('dots')!;
  private readonly next = document.getElementById('start') as HTMLButtonElement;
  private readonly skip = document.getElementById('skip') as HTMLButtonElement;
  private ready = false;

  constructor(private readonly onStart: () => void) {
    // al reiniciar con R no hace falta releer la historia: va directo a la placa de controles
    if (sessionStorage.getItem(SEEN_KEY)) this.index = SLIDES.length - 1;
    this.dots.innerHTML = SLIDES.map(() => '<span></span>').join('');
    this.next.addEventListener('click', () => this.advance());
    this.skip.addEventListener('click', () => this.finish());
    this.render();
  }

  /** Los modelos terminaron de cargar: se puede empezar. */
  setReady(): void {
    this.ready = true;
    this.skip.disabled = false;
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
    if (this.last) this.finish();
    else {
      this.index++;
      this.render();
    }
  }

  private finish(): void {
    if (!this.ready) return;
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
