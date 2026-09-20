// HUD en DOM: vida de la puerta y del golfista, oleada, palos, medidor de potencia, carteles y
// números de daño flotantes.
import { CLUB_ORDER, CLUBS, MELEE_COOLDOWN, STREAK_MAX, type Club, type ClubId } from './core/clubs';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`falta #${id}`);
  return el as T;
};

export type Tone = 'good' | 'bad' | 'neutral';

export class Hud {
  private gate = $('gate');
  private gateBar = $('gatebar');
  private hp = $('hp');
  private waveN = $('wave').querySelector('.n') as HTMLElement;
  private waveSub = $('wave').querySelector('.sub') as HTMLElement;
  private score = $('score');
  private banner = $('banner');
  private feedbackEl = $('feedback');
  private floats = $('floats');
  private meter = $('meter');
  private power = this.meter.querySelector('.power') as HTMLElement;
  private range = $('range');
  private hint = $('hint');
  private clubsEl = $('clubs');
  private pauseEl = $('pause');
  private endEl = $('end');
  private skinBtn = $<HTMLButtonElement>('skin');
  private lobBtn = $<HTMLButtonElement>('lobaim');
  private streakEl = $('streak');
  onSkinClick: (() => void) | null = null;
  onLobAimClick: (() => void) | null = null;
  onCardDismiss: (() => void) | null = null;
  private cardEl = $('card');
  private bannerTimer = 0;
  private gateAlertUntil = 0;

  constructor() {
    this.skinBtn.addEventListener('click', () => {
      this.skinBtn.blur();
      this.onSkinClick?.();
    });
    this.cardEl.addEventListener('click', () => this.onCardDismiss?.());
    this.lobBtn.addEventListener('click', () => {
      this.lobBtn.blur();
      this.onLobAimClick?.();
    });
    // los palos de la rueda y, aparte, el putter (barra espaciadora) y el palazo (Shift)
    const slots: ClubId[] = [...CLUB_ORDER, 'putter'];
    this.clubsEl.innerHTML = slots.map((id, i) => {
      const c = CLUBS[id];
      const color = '#' + c.color.toString(16).padStart(6, '0');
      const key = id === 'putter' ? 'Espacio' : String(i + 1);
      const cd = c.cooldown > 0 ? `<span class="cdlabel">⟳ ${c.cooldown} s</span>` : '';
      return `<div class="club locked${id === 'putter' ? ' space' : ''}" data-club="${id}" style="--c:${color}"><div class="cd"></div><span class="key">${key}</span><div class="name">${c.name}</div><div class="title">${c.title}</div>${cd}<div class="cdnum"></div></div>`;
    }).join('') + `<div class="club extra" data-club="melee" style="--c:#fff1b8"><div class="cd"></div><span class="key">Shift</span><div class="name">Palazo</div><div class="title">golpe corto</div><span class="cdlabel">⟳ ${MELEE_COOLDOWN} s</span><div class="cdnum"></div></div>`;
    this.streakEl.innerHTML = '<div class="lbl">RACHA DRIVER</div><div class="mult">×1.0</div><div class="pips">' + '<i></i>'.repeat(STREAK_MAX) + '</div>';
  }

  private shownState = '';
  private readonly shownCd = new Map<string, string>();

  /** Qué palos están habilitados, cuánto le falta a cada recarga y si la pelota del putter está en el campo. */
  setClubState(unlocked: ReadonlySet<ClubId>, cooldowns: Record<ClubId, number>, portalOut: boolean, meleeLeft: number): void {
    for (const el of Array.from(this.clubsEl.children) as HTMLElement[]) {
      const slot = el.dataset.club as ClubId | 'melee';
      const left = slot === 'melee' ? meleeLeft : cooldowns[slot];
      const total = slot === 'melee' ? MELEE_COOLDOWN : CLUBS[slot].cooldown;
      (el.firstElementChild as HTMLElement).style.height = total > 0 ? `${(100 * left) / total}%` : '0%';
      // mientras recarga, el número grande bajando; al terminar, un saltito
      const shown = left > 0 ? (left >= 1 ? String(Math.ceil(left)) : left.toFixed(1)) : '';
      if (shown === this.shownCd.get(slot)) continue;
      const was = this.shownCd.get(slot) ?? '';
      this.shownCd.set(slot, shown);
      (el.querySelector('.cdnum') as HTMLElement).textContent = shown;
      el.classList.toggle('cooling', left > 0);
      if (was && !shown) {
        el.classList.remove('ready');
        void el.offsetWidth;
        el.classList.add('ready');
      }
    }
    this.lobBtn.hidden = !unlocked.has('iron') && !unlocked.has('wedge');
    // lo demás solo toca el DOM cuando cambia
    const key = `${[...unlocked].join()}|${portalOut}|${cooldowns.putter > 0}`;
    if (key === this.shownState) return;
    const first = this.shownState === '';
    this.shownState = key;
    for (const el of Array.from(this.clubsEl.children) as HTMLElement[]) {
      if (el.dataset.club === 'melee') continue;
      const id = el.dataset.club as ClubId;
      // un palo recién habilitado entra a la barra con un saltito
      if (el.classList.contains('locked') && unlocked.has(id) && !first) {
        el.classList.add('appear');
        setTimeout(() => el.classList.remove('appear'), 600);
      }
      el.classList.toggle('locked', !unlocked.has(id));
      if (id !== 'putter') continue;
      el.classList.toggle('armed', portalOut && cooldowns.putter <= 0);
      (el.querySelector('.title') as HTMLElement).textContent = !portalOut ? 'tirar pelota' : cooldowns.putter > 0 ? 'recargando' : '¡saltar!';
    }
  }

  private shownStreak = -1;

  setStreak(streak: number, bonus: number): void {
    if (streak === this.shownStreak) return;
    const before = this.shownStreak;
    this.shownStreak = streak;
    const el = this.streakEl;
    (el.querySelector('.mult') as HTMLElement).textContent = `×${bonus.toFixed(1)}`;
    Array.from(el.querySelectorAll('.pips i')).forEach((pip, i) => pip.classList.toggle('on', i < streak));
    el.classList.toggle('on', streak > 0);
    el.classList.toggle('max', streak >= STREAK_MAX);
    // salto al subir, sacudón rojo al perderla
    el.classList.remove('gain', 'lost');
    if (before < 0) return;
    void el.offsetWidth;
    el.classList.add(streak > before ? 'gain' : 'lost');
  }

  /** Cartel de palo nuevo. Se queda hasta que se lo cierre con un click. */
  showCard(c: { name: string; title: string; key: string; hint: string; cooldown: number; color: number; next: string }): void {
    const el = this.cardEl;
    el.style.setProperty('--c', '#' + c.color.toString(16).padStart(6, '0'));
    (el.querySelector('.name') as HTMLElement).textContent = c.name;
    (el.querySelector('.title') as HTMLElement).textContent = c.title;
    (el.querySelector('.key') as HTMLElement).textContent = c.key;
    (el.querySelector('.hint') as HTMLElement).textContent = c.hint;
    (el.querySelector('.cool') as HTMLElement).textContent = c.cooldown > 0 ? `Recarga: ${c.cooldown} s` : 'Sin recarga';
    (el.querySelector('.next') as HTMLElement).textContent = c.next ? `Próxima oleada: ${c.next}` : '';
    el.hidden = false;
  }

  hideCard(): void {
    this.cardEl.hidden = true;
  }

  setLobAim(mode: 'cursor' | 'carga'): void {
    this.lobBtn.textContent = mode === 'cursor' ? 'Globos: al cursor (G)' : 'Globos: por carga (G)';
  }

  setBars(gate: number, gateMax: number, hp: number, hpMax: number): void {
    this.gate.style.width = `${(100 * gate) / gateMax}%`;
    this.hp.style.width = `${(100 * hp) / hpMax}%`;
    this.gateBar.classList.toggle('alert', performance.now() < this.gateAlertUntil);
  }

  gateAlert(): void {
    this.gateAlertUntil = performance.now() + 1500;
  }

  setWave(index: number, total: number, alive: number, pending: number, restLeft: number): void {
    this.waveN.textContent = index < 0 ? 'Preparate…' : `Oleada ${index + 1} / ${total}`;
    this.waveSub.textContent = restLeft > 0 && index >= 0 ? `próxima oleada en ${Math.ceil(restLeft)}` : index < 0 ? '' : `quedan ${alive + pending}`;
  }

  setScore(score: number, kills: number): void {
    this.score.textContent = `${score} pts · ${kills} bajas`;
  }

  private shownClubs = '';

  /** @param queued palo elegido durante un tiro, que entra cuando el tiro termina */
  setClub(club: Club, queued: Club | null = null): void {
    // se llama en cada cuadro: solo toca el DOM cuando cambia algo
    const key = `${club.id}|${queued?.id ?? ''}`;
    if (key === this.shownClubs) return;
    this.shownClubs = key;
    for (const el of Array.from(this.clubsEl.children)) {
      const id = (el as HTMLElement).dataset.club;
      el.classList.toggle('active', id === club.id);
      el.classList.toggle('queued', id === queued?.id);
    }
    this.hint.textContent = queued ? `Próximo: ${queued.name} · ${queued.hint}` : club.hint;
  }

  setMeter(charging: boolean, power: number, label: string): void {
    this.meter.classList.toggle('on', charging);
    this.power.style.width = `${charging ? power * 100 : 0}%`;
    this.range.textContent = charging ? label : '';
  }

  showBanner(big: string, small: string, seconds = 3): void {
    (this.banner.querySelector('.big') as HTMLElement).textContent = big;
    (this.banner.querySelector('.small') as HTMLElement).textContent = small;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), seconds * 1000);
  }

  feedback(text: string, tone: Tone): void {
    const el = this.feedbackEl;
    el.textContent = text;
    el.className = tone;
    // reinicia la animación
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  /** Texto que sube y se desvanece en una posición de pantalla (píxeles). */
  float(x: number, y: number, text: string, cls = ''): void {
    if (this.floats.childElementCount > 40) this.floats.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.floats.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  setSkin(name: string): void {
    this.skinBtn.textContent = `Skin: ${name} (C)`;
  }

  setPause(on: boolean): void {
    this.pauseEl.hidden = !on;
  }

  showEnd(title: string, detail: string): void {
    (this.endEl.querySelector('h2') as HTMLElement).textContent = title;
    (this.endEl.querySelector('.detail') as HTMLElement).textContent = detail;
    this.endEl.hidden = false;
  }
}
