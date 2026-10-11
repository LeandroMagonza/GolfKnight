// El menú de dificultad, entre partidas: la escalera de niveles (ver LADDER en core/difficulty.ts). Arriba el
// nivel con que se juega, con − y +; abajo un escalón por fila, con sus opciones, y se elige una en cada uno.
// Se abre desde la pantalla de inicio y desde el cartel del final. Lo que se cambia vale para la próxima
// partida, y queda guardado en el navegador. En la demo (ver src/edition.ts) se ve, pero con candado.

import { choiceAt, choose, LADDER, MAX_LEVEL, optionText, saveProgress, setLevel, type Progress } from './core/difficulty';
import { L } from './i18n';
import { flameHtml } from './threat';

export class DifficultyMenu {
  private readonly el = document.getElementById('difficulty')!;
  private readonly list = this.el.querySelector('.list') as HTMLElement;
  private readonly summary = this.el.querySelector('.summary') as HTMLElement;
  private readonly bar = this.el.querySelector('.levelbar') as HTMLElement;
  /** La llama del nivel, en el título: crece con cada escalón que se pone. */
  private readonly heat = this.el.querySelector('.heatslot') as HTMLElement;
  /** Se cambió algo desde que se armó la partida. */
  dirty = false;
  /** Avisa cada cambio (para refrescar los botones que dicen el nivel). */
  onChange: (() => void) | null = null;
  /** Avisa al cerrar (si se prendió o se apagó el terreno irregular, se cambia el campo). */
  onClose: (() => void) | null = null;

  /** @param locked la demo: la escalera se ve, para saber qué trae la completa, pero no se toca */
  constructor(readonly progress: Progress, private readonly locked = false) {
    this.el.querySelector('.done')?.addEventListener('click', () => this.hide());
    // un click afuera de la caja también cierra
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });
    this.bar.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button[data-step]') as HTMLButtonElement | null;
      if (button && !this.locked) this.changed(setLevel(this.progress, this.progress.level + Number(button.dataset.step)));
    });
    this.list.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button[data-i]') as HTMLButtonElement | null;
      if (!button || this.locked) return;
      const p = this.progress;
      const i = Number(button.dataset.i);
      const o = Number(button.dataset.o);
      // la elegida del escalón de más arriba, otra vez: se saca ese escalón (baja un nivel)
      if (i === p.level - 1 && choiceAt(p, i) === o) this.changed(setLevel(p, i));
      else this.changed(choose(p, i, o));
    });
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
    this.render();
    this.el.hidden = false;
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
        const { name, line } = optionText(p, i, o);
        const picked = options.length > 1 && choiceAt(p, i) === o;
        return `<button type="button" class="opt${picked || options.length === 1 ? ' picked' : ''}" data-i="${i}" data-o="${o}" ${status === 'shut' ? 'disabled' : ''}><b>${name}</b><span>${line}</span></button>`;
      }).join('');
      return `<div class="rung ${status}"><span class="num">${status === 'shut' ? '🔒' : i + 1}</span><div class="opts">${opts}</div></div>`;
    }).join('');
  }
}
