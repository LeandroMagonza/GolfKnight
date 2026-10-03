// El menú de dificultad, entre partidas: los puntos ganados y dónde ponerlos (ver core/difficulty.ts).
// Se abre desde la pantalla de inicio y desde el cartel del final. Lo que se cambia vale para la próxima
// partida, y queda guardado en el navegador.

import { levelOf, MAX_POINTS, saveProgress, setLevel, TALENTS, used, type Progress } from './core/difficulty';

export class DifficultyMenu {
  private readonly el = document.getElementById('difficulty')!;
  private readonly list = this.el.querySelector('.list') as HTMLElement;
  private readonly summary = this.el.querySelector('.summary') as HTMLElement;
  /** Se cambió algo desde que se armó la partida. */
  dirty = false;
  /** Avisa cada cambio (para refrescar los botones que dicen el nivel). */
  onChange: (() => void) | null = null;
  /** Avisa al cerrar (si cambió el campo, hay que volver a cargar la página). */
  onClose: (() => void) | null = null;

  constructor(readonly progress: Progress) {
    this.el.querySelector('.done')?.addEventListener('click', () => this.hide());
    // un click afuera de la caja también cierra
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });
    this.list.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button[data-id]') as HTMLButtonElement | null;
      if (!button) return;
      const id = button.dataset.id as (typeof TALENTS)[number]['id'];
      if (setLevel(this.progress, id, levelOf(this.progress.picks, id) + Number(button.dataset.step))) {
        saveProgress(this.progress);
        this.dirty = true;
        this.render();
        this.onChange?.();
      }
    });
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
    const n = used(p.picks);
    const free = p.points - n;
    this.summary.textContent = p.points === 0
      ? 'Ganá una partida para tu primer punto.'
      : `Nivel ${n} · ${free ? `te ${free === 1 ? 'queda 1 punto' : `quedan ${free} puntos`} para poner` : 'todos tus puntos puestos'} · ${p.points} de ${MAX_POINTS} ganados`;
    this.list.innerHTML = TALENTS.map((t) => {
      const lv = levelOf(p.picks, t.id);
      const pips = t.levels.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      const lines = t.levels.map((text, i) => `<div class="${i < lv ? 'got' : ''}">${text()}</div>`).join('');
      const canAdd = lv < t.levels.length && free > 0;
      return `<div class="talent${lv ? ' taken' : ''}">
        <div class="head"><span class="pips">${pips}</span><b>${t.name}</b>
          <button type="button" data-id="${t.id}" data-step="-1" ${lv ? '' : 'disabled'} aria-label="Sacar un punto">−</button>
          <button type="button" data-id="${t.id}" data-step="1" ${canAdd ? '' : 'disabled'} aria-label="Poner un punto">+</button>
        </div>
        <div class="lines">${lines}</div>
      </div>`;
    }).join('');
  }
}
