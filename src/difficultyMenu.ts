// El menú de dificultad, entre partidas: la escalera de niveles (ver LADDER en core/difficulty.ts). Desde el
// 11/10 va a pantalla completa sobre la cancha (pedido de Leandro): arriba el nivel con − y +; abajo un
// escalón por columna, de izquierda a derecha, con sus opciones en tarjetas del mismo tamaño, y una línea
// dorada que une las elegidas de los escalones puestos (punteada, la de los que se recuerdan sin poner). En
// el celular parado, de arriba hacia abajo. Abajo, lo que hace la opción que se señala.
// Se abre desde la pantalla de inicio y desde el cartel del final. Lo que se cambia vale para la próxima
// partida, y queda guardado en el navegador. En la demo (ver src/edition.ts) se ve, pero con candado.

import { choiceAt, choose, LADDER, MAX_LEVEL, optionText, saveProgress, setLevel, type Progress } from './core/difficulty';
import { L } from './i18n';
import { flameHtml } from './threat';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class DifficultyMenu {
  private readonly el = document.getElementById('difficulty')!;
  private readonly list = this.el.querySelector('.list') as HTMLElement;
  private readonly track = this.el.querySelector('.track') as HTMLElement;
  private readonly path = this.el.querySelector('.track .path') as SVGSVGElement;
  private readonly summary = this.el.querySelector('.summary') as HTMLElement;
  private readonly bar = this.el.querySelector('.levelbar') as HTMLElement;
  private readonly detail = this.el.querySelector('.detail') as HTMLElement;
  /** La llama del nivel, en el título: crece con cada escalón que se pone. */
  private readonly heat = this.el.querySelector('.heatslot') as HTMLElement;
  /** Se cambió algo desde que se armó la partida. */
  dirty = false;
  /** Avisa cada cambio (para refrescar los botones que dicen el nivel). */
  onChange: (() => void) | null = null;
  /** Avisa al cerrar (si se prendió o se apagó el terreno irregular, se cambia el campo). */
  onClose: (() => void) | null = null;
  /** La tarjeta recién elegida («escalón:opción»): salta un poco al dibujarse. */
  private popped = '';

  /** @param locked la demo: la escalera se ve, para saber qué trae la completa, pero no se toca */
  constructor(readonly progress: Progress, private readonly locked = false) {
    this.el.querySelector('.done')?.addEventListener('click', () => this.hide());
    // un click en el fondo, fuera de todo, también cierra
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });
    this.bar.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button[data-step]') as HTMLButtonElement | null;
      if (button && !this.locked) this.changed(setLevel(this.progress, this.progress.level + Number(button.dataset.step)));
    });
    this.dragToScroll();
    this.list.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button[data-i]') as HTMLButtonElement | null;
      if (!button || this.locked) return;
      const p = this.progress;
      const i = Number(button.dataset.i);
      const o = Number(button.dataset.o);
      // la elegida del escalón de más arriba, otra vez: se saca ese escalón (baja un nivel)
      if (i === p.level - 1 && choiceAt(p, i) === o) this.changed(setLevel(p, i));
      else if (choose(p, i, o)) {
        this.popped = `${i}:${o}`;
        this.changed(true);
      }
      this.tell(i, o);
    });
    // lo que hace cada opción, abajo: la que tiene el mouse encima (o el foco, con el teclado)
    const point = (e: Event) => {
      const button = (e.target as HTMLElement).closest('button[data-i]') as HTMLButtonElement | null;
      if (button) this.tell(Number(button.dataset.i), Number(button.dataset.o));
    };
    this.list.addEventListener('pointerover', point);
    this.list.addEventListener('focusin', point);
    // la línea va por el medio de las tarjetas: si cambia el tamaño, se vuelve a trazar
    new ResizeObserver(() => { if (this.open) this.drawPath(); }).observe(this.track);
    this.track.addEventListener('scroll', () => this.drawPath());
  }

  private changed(did: boolean): void {
    if (!did) return;
    saveProgress(this.progress);
    this.dirty = true;
    this.render();
    this.onChange?.();
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  /** Lo cambiaron desde afuera (el panel de balance): se vuelve a dibujar. */
  refresh(): void {
    if (this.open) this.render();
    this.onChange?.();
  }

  /** Abajo, lo que hace la opción `o` del escalón `i`. */
  private tell(i: number, o: number): void {
    const { name, line } = optionText(i, o);
    this.detail.innerHTML = `<b>${i + 1} · ${name}</b>: ${line}`;
  }

  private render(): void {
    const p = this.progress;
    this.el.classList.toggle('locked', this.locked);
    this.heat.innerHTML = flameHtml(p.level, MAX_LEVEL, this.locked);
    this.summary.textContent = this.locked
      ? L('🔒 En la versión completa: cada partida ganada te desbloquea un nivel, y en cada nivel elegís qué se pone más difícil.',
        '🔒 In the full game: every win unlocks a level, and at each level you choose what gets harder.')
      : p.unlocked === 0
      ? L('Ganá una partida para desbloquear el nivel 1.', 'Win a run to unlock level 1.')
      : p.level < p.unlocked
      ? L(`Desbloqueaste ${p.unlocked} de ${MAX_LEVEL}: podés subir hasta el ${p.unlocked}.`, `You've unlocked ${p.unlocked} of ${MAX_LEVEL}: you can go up to level ${p.unlocked}.`)
      : p.unlocked >= MAX_LEVEL
      ? L('Desbloqueaste todos los niveles.', `You've unlocked every level.`)
      : L(`Desbloqueaste ${p.unlocked} de ${MAX_LEVEL}. Ganá en el ${p.unlocked} y desbloqueás el ${p.unlocked + 1}.`, `You've unlocked ${p.unlocked} of ${MAX_LEVEL}. Win at level ${p.unlocked} to unlock level ${p.unlocked + 1}.`);
    this.bar.hidden = !this.locked && p.unlocked === 0;
    this.bar.innerHTML = `<button type="button" data-step="-1" ${p.level > 0 ? '' : 'disabled'} aria-label="${L('Bajar un nivel', 'Level down')}">−</button>`
      + `<b>${L(`Nivel ${p.level}`, `Level ${p.level}`)}</b>`
      + `<button type="button" data-step="1" ${p.level < p.unlocked ? '' : 'disabled'} aria-label="${L('Subir un nivel', 'Level up')}">+</button>`;
    this.list.innerHTML = LADDER.map((options, i) => {
      const status = i < p.level ? 'on' : i < p.unlocked && !this.locked ? 'open' : 'shut';
      const opts = options.map((_, o) => {
        const { name, line } = optionText(i, o);
        const picked = choiceAt(p, i) === o;
        const pop = picked && this.popped === `${i}:${o}` ? ' pop' : '';
        // el número del escalón, chiquito arriba de cada tarjeta (con candado, si falta desbloquearlo)
        return `<button type="button" class="opt${picked ? ' picked' : ''}${pop}" data-i="${i}" data-o="${o}" title="${line}" ${status === 'shut' ? 'disabled' : ''}>`
          + `<i class="n">${status === 'shut' ? '🔒 ' : ''}${i + 1}</i><b>${name}</b><span>${line}</span></button>`;
      }).join('');
      return `<div class="rung ${status}"><div class="opts">${opts}</div></div>`;
    }).join('');
    this.popped = '';
    // abajo, de entrada, lo del escalón de más arriba que está puesto (o el primero)
    const top = Math.max(0, p.level - 1);
    this.tell(top, choiceAt(p, top));
    this.drawPath();
  }

  /**
   * Arrastrar con el mouse (el botón izquierdo) sube y baja la escalera (13/10, Leandro: sin barra de
   * scroll). Si se arrastró, el click de la tarjeta donde se soltó no cuenta.
   */
  private dragToScroll(): void {
    let drag: { y: number; top: number; moved: boolean } | null = null;
    let swallow = false;
    this.track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) drag = { y: e.clientY, top: this.track.scrollTop, moved: false };
    });
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) < 6) return;
      drag.moved = true;
      this.track.classList.add('dragging');
      this.track.scrollTop = drag.top - dy;
    });
    addEventListener('pointerup', () => {
      if (!drag) return;
      swallow = drag.moved;
      drag = null;
      this.track.classList.remove('dragging');
      setTimeout(() => { swallow = false; }, 0);
    });
    this.el.addEventListener('click', (e) => {
      if (!swallow) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
  }

  /**
   * La línea dorada: por el medio de las tarjetas elegidas, de un escalón al siguiente. Llena hasta el nivel
   * con que se juega; punteada y tenue por los desbloqueados que se recuerdan sin poner.
   */
  private drawPath(): void {
    const box = this.track.getBoundingClientRect();
    // del ancho de lo que se ve: con el de todo lo que se puede correr, al aparecer la barra de arriba abajo
    // la línea quedaba más ancha que la pantalla y aparecía otra de costado
    this.path.setAttribute('width', String(this.track.clientWidth));
    this.path.setAttribute('height', String(this.track.scrollHeight));
    this.path.replaceChildren();
    const center = (el: Element) => {
      const r = el.getBoundingClientRect();
      return [r.left - box.left + this.track.scrollLeft + r.width / 2, r.top - box.top + this.track.scrollTop + r.height / 2];
    };
    const points = (selector: string) => [...this.list.querySelectorAll(selector)].map(center);
    const on = points('.rung.on .opt.picked');
    const later = points('.rung.open .opt.picked');
    const line = (pts: number[][], cls: string) => {
      if (pts.length < 2) return;
      const el = document.createElementNS(SVG_NS, 'polyline');
      el.setAttribute('points', pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
      el.setAttribute('class', cls);
      this.path.append(el);
    };
    // la punteada sale de la última puesta
    line([...on.slice(-1), ...later], 'later');
    line(on, 'on');
    // y si hay uno solo puesto, un punto en el medio de su tarjeta
    if (on.length === 1) {
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', on[0][0].toFixed(1));
      dot.setAttribute('cy', on[0][1].toFixed(1));
      dot.setAttribute('r', '5');
      this.path.append(dot);
    }
  }
}
