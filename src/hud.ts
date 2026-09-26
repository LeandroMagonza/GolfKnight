// HUD en DOM: vida de la puerta y del golfista, oleada, palos, medidor de potencia, carteles y
// números de daño flotantes.
import { ABILITIES, ABILITY_KEYS, SLOTS, type AbilityId } from './core/abilities';
import { CLUB_KEYS, CLUB_ORDER, CLUBS, MELEE_COOLDOWN, type Club, type ClubId } from './core/clubs';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`falta #${id}`);
  return el as T;
};

export type Tone = 'good' | 'bad' | 'neutral';

/** Una mejora tomada, como se ve en la columna de la izquierda. */
export interface PerkChip {
  id: string;
  name: string;
  color: number;
  hint: string;
  /** Lo que cuenta: «bajas 5/8», «⟳ 7 s», «¡listo!». Vacío si la mejora no cuenta nada. */
  status: string;
  /** Qué parte de la recarga falta, 0..1: una cortina como la de las habilidades. */
  cooling: number;
  /** Lista para saltar: se enciende. */
  ready: boolean;
}

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
  private enchantsEl = $('enchants');
  onSkinClick: (() => void) | null = null;
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
    // los palos: la distancia y la trayectoria. Uno por tecla, 1 a 4
    // los cuatro comparten color: lo que los distingue es el ícono del palo y la tecla
    this.clubsEl.innerHTML = CLUB_ORDER.map((id, i) => {
      const c = CLUBS[id];
      const color = '#' + c.color.toString(16).padStart(6, '0');
      return `<div class="club locked" data-club="${id}" style="--c:${color}"><img class="clubicon" src="${import.meta.env.BASE_URL}clubs/${id}.png" alt="" /><span class="key">${CLUB_KEYS[i]}</span><div class="name">${c.name}</div><div class="title">${c.title}</div><div class="band">hasta ${c.maxRange} m</div></div>`;
    }).join('');
    // los cuatro lugares de habilidad, que se llenan eligiendo cartas. Y el palazo, que va aparte
    this.enchantsEl.innerHTML = Array.from({ length: SLOTS }, (_, i) =>
      `<div class="club locked" data-ench="slot${i}" style="--c:#ffffff"><div class="cd"></div><span class="key">${ABILITY_KEYS[i]}</span><div class="name"></div><div class="title"></div><span class="cdlabel"></span><div class="cdnum"></div></div>`,
    ).join('')
      + `<div class="club extra" data-ench="melee" style="--c:#fff1b8"><div class="cd"></div><span class="key">Shift</span><div class="name">Palazo</div><div class="title">empujón</div><span class="cdlabel">⟳ ${MELEE_COOLDOWN} s</span><div class="cdnum"></div></div>`;
    this.choiceEl.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.choice') as HTMLElement | null;
      if (card) this.onPick?.(Number(card.dataset.i));
    });
  }

  private choiceEl = $('choice');
  /** Se eligió la carta número `i` (0, 1 o 2). */
  onPick: ((i: number) => void) | null = null;

  /** Las tres cartas entre oleadas. Se elige con click o con 1, 2 y 3. */
  showChoice(cards: { tag: string; name: string; title: string; hint: string; color: number }[], next: string): void {
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    (this.choiceEl.querySelector('.cards') as HTMLElement).innerHTML = cards.map((c, i) => {
      const color = '#' + c.color.toString(16).padStart(6, '0');
      return `<div class="choice" data-i="${i}" style="--c:${color}"><kbd>${i + 1}</kbd><div class="tag">${esc(c.tag)}</div><div class="name">${esc(c.name)}</div><div class="title">${esc(c.title)}</div><div class="hint">${esc(c.hint)}</div></div>`;
    }).join('');
    (this.choiceEl.querySelector('.next') as HTMLElement).textContent = next ? `Próxima oleada: ${next}` : '';
    this.choiceEl.hidden = false;
  }

  hideChoice(): void {
    this.choiceEl.hidden = true;
  }

  /** Lo ancho que se ve el golpe perfecto en la barra: lo agranda la mejora «Punto dulce». */
  setPerfectWidth(fraction: number): void {
    (this.meter.querySelector('.perfect') as HTMLElement).style.width = `${(fraction * 100).toFixed(1)}%`;
  }

  private perksEl = $('perks');
  private shownPerks = '';

  /**
   * Las mejoras tomadas, en una columna a la izquierda. Casi todas no se aprietan: saltan solas (el
   * carcaj, el segundo aire, el perfecto de regalo) o van contando algo (las rachas). Sin esto eran
   * invisibles: no había forma de saber cuánto faltaba para el próximo perfecto.
   */
  setPerks(chips: readonly PerkChip[]): void {
    const key = chips.map((c) => `${c.id}|${c.name}|${c.status}|${c.ready}|${c.cooling > 0}`).join('§');
    if (key !== this.shownPerks) {
      const was = new Set(this.shownPerks.split('§').filter((k) => k.endsWith('|true|false')).map((k) => k.split('|')[0]));
      this.shownPerks = key;
      const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
      this.perksEl.innerHTML = chips.map((c) => {
        const color = '#' + c.color.toString(16).padStart(6, '0');
        // la que recién quedó lista da un saltito, como las habilidades al terminar de recargar
        const pop = c.ready && !was.has(c.id) ? ' ready' : '';
        return `<div class="perk${c.ready ? ' on' : ''}${c.cooling > 0 ? ' cooling' : ''}${pop}" data-perk="${c.id}" style="--c:${color}" title="${esc(c.hint)}"><div class="cd"></div><span class="name">${esc(c.name)}</span><span class="status">${esc(c.status)}</span></div>`;
      }).join('');
    }
    // la cortina sí se mueve en cada cuadro
    for (const c of chips) {
      const bar = this.perksEl.querySelector(`[data-perk="${c.id}"] .cd`) as HTMLElement | null;
      if (bar) bar.style.width = `${Math.max(0, Math.min(1, c.cooling)) * 100}%`;
    }
  }

  private shownState = '';
  private readonly shownCd = new Map<string, string>();

  /** Qué palos están habilitados, y cuál está volando como boomerang. */
  setClubState(unlocked: ReadonlySet<ClubId>, meleeLeft: number, thrown: ClubId | null = null): void {
    this.cooldownOn('melee', meleeLeft, MELEE_COOLDOWN);
    const key = [...unlocked].join() + `|${thrown ?? ''}`;
    if (key === this.shownState) return;
    const first = this.shownState === '';
    this.shownState = key;
    for (const el of Array.from(this.clubsEl.children) as HTMLElement[]) {
      const id = el.dataset.club as ClubId | undefined;
      if (!id) continue;
      // un palo recién habilitado entra a la barra con un saltito
      if (el.classList.contains('locked') && unlocked.has(id) && !first) {
        el.classList.add('appear');
        setTimeout(() => el.classList.remove('appear'), 600);
      }
      el.classList.toggle('locked', !unlocked.has(id));
      // el palo que está volando se ve apagado: no se puede elegir hasta que vuelva
      el.classList.toggle('cooling', id === thrown);
    }
  }

  /** Mientras recarga, el número grande bajando; al terminar, un saltito. */
  private cooldownOn(slot: string, left: number, total: number): void {
    const el = this.enchantsEl.querySelector(`[data-ench="${slot}"]`) as HTMLElement | null;
    if (!el) return;
    const bar = el.querySelector('.cd') as HTMLElement | null;
    if (bar) bar.style.height = total > 0 ? `${(100 * left) / total}%` : '0%';
    const shown = left > 0 ? (left >= 1 ? String(Math.ceil(left)) : left.toFixed(1)) : '';
    if (shown === this.shownCd.get(slot)) return;
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

  private shownAbilities = '';

  /**
   * Las habilidades de Q, W, E y R: cuál hay en cada lugar, de qué nivel, y cuánto le falta a cada
   * recarga.
   */
  setAbilities(slots: readonly { id: AbilityId; level: number }[], cooldowns: readonly number[], totals: readonly number[]): void {
    for (let i = 0; i < SLOTS; i++) this.cooldownOn(`slot${i}`, cooldowns[i] ?? 0, totals[i] ?? 0);
    const key = slots.map((s, i) => `${s.id}:${s.level}:${totals[i]}`).join();
    if (key === this.shownAbilities) return;
    const first = this.shownAbilities === '';
    this.shownAbilities = key;
    for (let i = 0; i < SLOTS; i++) {
      const el = this.enchantsEl.querySelector(`[data-ench="slot${i}"]`) as HTMLElement;
      const s = slots[i];
      if (!s) {
        el.classList.add('locked');
        continue;
      }
      const a = ABILITIES[s.id];
      // una habilidad recién ganada entra a la barra con un saltito
      if (el.classList.contains('locked') && !first) {
        el.classList.add('appear');
        setTimeout(() => el.classList.remove('appear'), 600);
      }
      el.classList.remove('locked');
      el.style.setProperty('--c', '#' + a.color.toString(16).padStart(6, '0'));
      (el.querySelector('.name') as HTMLElement).textContent = a.name;
      (el.querySelector('.title') as HTMLElement).textContent = s.level > 1 ? `${a.title} · nv ${s.level}` : a.title;
      (el.querySelector('.cdlabel') as HTMLElement).textContent = `⟳ ${Math.round(totals[i])} s`;
    }
  }

  /** Cartel de habilidad nueva. Se queda hasta que se lo cierre con un click. */
  showCard(c: { name: string; title: string; key: string; hint: string; cooldown?: number; color: number; next: string }): void {
    const el = this.cardEl;
    el.style.setProperty('--c', '#' + c.color.toString(16).padStart(6, '0'));
    (el.querySelector('.name') as HTMLElement).textContent = c.name;
    (el.querySelector('.title') as HTMLElement).textContent = c.title;
    (el.querySelector('.key') as HTMLElement).textContent = c.key;
    (el.querySelector('.hint') as HTMLElement).textContent = c.hint;
    (el.querySelector('.cool') as HTMLElement).textContent = c.cooldown ? `Recarga: ${c.cooldown} s` : 'Sin recarga';
    (el.querySelector('.next') as HTMLElement).textContent = c.next ? `Próxima oleada: ${c.next}` : '';
    el.hidden = false;
  }

  hideCard(): void {
    this.cardEl.hidden = true;
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
  setClub(club: Club, queued: Club | null = null, hint = ''): void {
    // se llama en cada cuadro: solo toca el DOM cuando cambia algo
    const key = `${club.id}|${queued?.id ?? ''}`;
    if (key === this.shownClubs) return;
    this.shownClubs = key;
    for (const el of Array.from(this.clubsEl.children)) {
      const id = (el as HTMLElement).dataset.club;
      el.classList.toggle('active', id === club.id);
      el.classList.toggle('queued', id === queued?.id);
    }
    this.hint.textContent = queued ? `Próximo: ${queued.name} · ${queued.hint}` : hint || club.hint;
  }

  setMeter(charging: boolean, power: number, locked: boolean, label: string): void {
    this.meter.classList.toggle('on', charging);
    this.meter.classList.toggle('locked', charging && locked);
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
