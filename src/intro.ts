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

import { L, lang } from './i18n';
import { setupLangPicker } from './langPicker';
import { setupPatchNotes } from './patchnotes';

interface Slide {
  art: string;
  html: string;
}

const SLIDES: Slide[] = [
  {
    art: '',
    html: L(`<p class="controls">
      Apuntá con el <kbd>mouse</kbd>: la <em>distancia</em> del cursor es dónde cae la pelota<br />
      Mantené <kbd>click</kbd> para cargar y soltá para pegar: el arco dice <em>qué tan bien</em>, del verde al rojo (con el wedge, el gris pifia)<br />
      <kbd>1</kbd> driver · <kbd>2</kbd> hierro 7 · <kbd>3</kbd> wedge · <kbd>4</kbd> putter: cada palo cobra mejor a su distancia<br />
      <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd>: las habilidades que elegís entre oleadas, al instante hacia el mouse<br />
      Se pega donde hay <em>pelota</em>: de puesto en puesto con <kbd>A</kbd> y <kbd>D</kbd> (cargando, te corren de costado)<br />
      <kbd>Espacio</kbd> clava el golpe · cancelar <kbd>click der.</kbd> · pausa <kbd>Esc</kbd> · sin sonido <kbd>N</kbd><br />
      Que no lleguen a la puerta.
    </p>`, `<p class="controls">
      Aim with the <kbd>mouse</kbd>: the ball lands right at the cursor, <em>distance</em> and all<br />
      Hold <kbd>click</kbd> to charge, let go to hit: the arc shows <em>how well</em>, from green to red (with the wedge, gray is a whiff)<br />
      <kbd>1</kbd> driver · <kbd>2</kbd> 7 iron · <kbd>3</kbd> wedge · <kbd>4</kbd> putter: each club shines at its own range<br />
      <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd>: the abilities you pick between waves, cast instantly toward the mouse<br />
      You can only hit where there's a <em>ball</em>: hop from tee to tee with <kbd>A</kbd> and <kbd>D</kbd> (while charging, they shift you sideways)<br />
      <kbd>Space</kbd> locks the hit · cancel <kbd>right click</kbd> · pause <kbd>Esc</kbd> · mute <kbd>N</kbd><br />
      Don't let them reach the gate.
    </p>`),
  },
];

/** La placa del modo tenis: los mismos botones, otro juego. */
const TENNIS_SLIDE: Slide = {
  art: '',
  html: L(`<p class="controls">
      <em>Modo tenis</em> (prototipo): la pelota rebota en el enemigo y vuelve en espejo. Al que matás, lo atraviesa<br />
      Caminá de costado con <kbd>A</kbd> y <kbd>D</kbd> · la marca en tu línea dice dónde va a caer cada pelota<br />
      <kbd>Click</kbd> para prepararte y soltá cuando la pelota llega: el arco marca el momento justo (y si estás a tiro)<br />
      Sin pelota que venga, sacás: tirás la pelota para arriba y soltás cuando llega arriba<br />
      Cuantas más veces devolvés la misma pelota, más pega. La que no devolvés vuelve sola al bolsillo<br />
      <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> habilidades · pausa <kbd>Esc</kbd>
    </p>`, `<p class="controls">
      <em>Tennis mode</em> (prototype): the ball bounces off the enemy and comes back mirrored. If it kills one, it goes right through<br />
      Sidestep with <kbd>A</kbd> and <kbd>D</kbd> · the mark on your line shows where each ball will land<br />
      <kbd>Click</kbd> to get ready and let go when the ball arrives: the arc shows the right moment (and whether you can reach it)<br />
      No ball coming? Serve: toss the ball up and let go when it peaks<br />
      The more times you return the same ball, the harder it hits. Any ball you don't return goes back to your pocket<br />
      <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> abilities · pause <kbd>Esc</kbd>
    </p>`),
};

const SEEN_KEY = 'gk.introSeen';
// con el idioma de la página: si vino en la dirección (?lang=), la cinemática no se enteraría
const CINE_URL = `./cine.html?embed&lang=${lang}`;

export class Intro {
  private index = 0;
  private readonly slide = document.getElementById('slide')!;
  private readonly dots = document.getElementById('dots')!;
  private readonly next = document.getElementById('start') as HTMLButtonElement;
  private ready = false;
  private cine: HTMLIFrameElement | null = null;
  private readonly alt = document.getElementById('alt') as HTMLButtonElement;
  private readonly mode = document.getElementById('mode') as HTMLButtonElement;
  private readonly inviteBtn = document.getElementById('invite') as HTMLButtonElement;
  private readonly inviteBox = document.getElementById('invitebox')!;
  /** Invitar a alguien a mirar: abre la sala y devuelve el enlace (ver src/net). */
  onInvite: (() => Promise<string>) | null = null;

  /**
   * @param tutorialFirst el botón grande empieza el tutorial (la primera vez)
   * @param tennis se está en el modo tenis; `onMode` pasa al otro modo
   * @param watching es el espectador: no hay cinemática ni nada que empezar
   */
  constructor(private readonly onStart: (tutorial: boolean) => void, private readonly tutorialFirst: boolean, private readonly tennis = false, onMode?: () => void, private readonly watching = false) {
    if (tennis) SLIDES.splice(0, SLIDES.length, TENNIS_SLIDE);
    this.mode.addEventListener('click', () => onMode?.());
    this.inviteBtn.addEventListener('click', () => {
      this.inviteBtn.disabled = true;
      this.onInvite?.().then((link) => this.showInvite(link)).catch((e) => {
        console.error(e);
        this.inviteBtn.disabled = false;
        this.inviteBtn.textContent = L('No se pudo abrir la sala. Probar de nuevo', `Couldn't open the room. Try again`);
      });
    });
    this.inviteBox.querySelector('.copy')?.addEventListener('click', (e) => {
      const input = this.inviteBox.querySelector('input') as HTMLInputElement;
      input.select();
      void navigator.clipboard?.writeText(input.value).catch(() => document.execCommand('copy'));
      (e.currentTarget as HTMLButtonElement).textContent = L('¡Copiado!', 'Copied!');
    });
    const version = document.getElementById('version');
    if (version) version.textContent = L(`versión ${__BUILD__}`, `version ${__BUILD__}`);
    setupPatchNotes();
    setupLangPicker();
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
    if (!watching && (params.has('cine') || (!seen && !params.has('sincine') && !navigator.webdriver))) this.playCine();
  }

  /** La sala está abierta: el enlace para pasarle al que va a mirar. */
  showInvite(link: string): void {
    this.inviteBtn.hidden = true;
    this.inviteBox.hidden = false;
    (this.inviteBox.querySelector('input') as HTMLInputElement).value = link;
  }

  /** Cuántos están mirando, abajo del enlace. */
  setWatchers(n: number): void {
    const el = this.inviteBox.querySelector('.who') as HTMLElement;
    el.textContent = n === 0
      ? L('Todavía no entró nadie. Puede entrar ahora o con la partida empezada.', `Nobody's in yet. They can join now or mid-game.`)
      : n === 1 ? L('🧙 Abe ya está en la partida', '🧙 Abe is in the game') : L(`🧙 Abe y ${n - 1} mirando`, `🧙 Abe and ${n - 1} watching`);
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
    const go = this.tennis
      ? L('¡A jugar! (Espacio)', 'Play! (Space)')
      : this.tutorialFirst ? L('Aprender a jugar (Espacio)', 'Learn to play (Space)') : L('¡A defender Valdehoyo! (Espacio)', 'Defend Valdehoyo! (Space)');
    this.next.textContent = this.last ? (this.ready ? go : L('Cargando…', 'Loading…')) : L('Siguiente (Espacio)', 'Next (Space)');
    // en el tenis no hay tutorial
    this.alt.hidden = !this.last || !this.ready || this.tennis;
    this.mode.hidden = !this.ready;
    this.inviteBtn.hidden = !this.ready || !this.inviteBox.hidden || this.watching;
    this.mode.textContent = this.tennis ? L('Volver al golf', 'Back to golf') : L('Probar el modo tenis (nuevo)', 'Try tennis mode (new)');
    this.alt.textContent = this.tutorialFirst ? L('Saltar el tutorial', 'Skip the tutorial') : L('Hacer el tutorial', 'Play the tutorial');
  }
}
