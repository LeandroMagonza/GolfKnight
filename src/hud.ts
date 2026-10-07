// HUD en DOM: vida de la puerta y del golfista, oleada, palos, medidor de potencia, carteles y
// números de daño flotantes.
import { ABILITIES, ABILITY_KEYS, SLOTS, type AbilityId } from './core/abilities';
import { CLUB_KEYS, CLUB_ORDER, CLUBS, type Club, type ClubId } from './core/clubs';
import { arcAngle, type ArcLayout } from './core/swing';
import { EndScreen, type EndInfo } from './endscreen';
import { L } from './i18n';
import { flameHtml } from './threat';

/** Hasta dónde se abre el arco de carga, de arriba a cada borde: con las mejoras puede pasar de 90°. */
const ARC_MAX = 105;

/** Un corazón de las vidas del caballero (24 × 24), con su brillo. */
const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path class="body" d="M12 21C12 21 2.5 15.2 2.5 8.9 2.5 6 4.7 3.8 7.4 3.8 9.4 3.8 11 5 12 6.6 13 5 14.6 3.8 16.6 3.8 19.3 3.8 21.5 6 21.5 8.9 21.5 15.2 12 21 12 21Z" />'
  + '<ellipse class="shine" cx="7.6" cy="8.4" rx="2.1" ry="1.3" transform="rotate(-35 7.6 8.4)" />'
  + '</svg>';

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
  /** Las vidas, arriba a la izquierda: un corazón por punto del caballero, y la puerta con su número. */
  private hearts = $('hearts');
  private gateBox = $('gatebox');
  private gateNum = this.gateBox.querySelector('.num') as HTMLElement;
  /** Lo último que se dibujó: solo se toca el DOM cuando cambia. */
  private shownHp = -1;
  private shownHpMax = -1;
  private shownGate = -1;
  private waveN = $('wave').querySelector('.n') as HTMLElement;
  private waveSub = $('wave').querySelector('.sub') as HTMLElement;
  private score = $('score');
  private banner = $('banner');
  private feedbackEl = $('feedback');
  private floats = $('floats');
  private meter = $('meter');
  private needle: SVGGElement | null = null;
  /** Cómo está repartido el arco (ver `setMarks`), y los umbrales de potencia de cada tramo. */
  private layout: ArcLayout = { weak: 60, mid: 20, strong: 10, span: 90 };
  private marks: readonly [number, number] = [0.55, 0.92];
  private marksKey = '';
  private range = $('range');
  private hint = $('hint');
  private clubsEl = $('clubs');
  private pauseEl = $('pause');
  /** El cartel del final. `onBeat` suena con cada cosa que aparece (lo pone el juego). */
  readonly end = new EndScreen($('end'));
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
      return `<div class="club locked" data-club="${id}" style="--c:${color}"><img class="clubicon" src="${import.meta.env.BASE_URL}clubs/${id}.png" alt="" /><span class="key">${CLUB_KEYS[i]}</span><div class="name">${c.name}</div><div class="title">${c.title}</div><div class="band">${L(`hasta ${c.maxRange} m`, `up to ${c.maxRange} m`)}</div></div>`;
    }).join('');
    // los cuatro lugares de habilidad, que se llenan eligiendo cartas
    this.enchantsEl.innerHTML = Array.from({ length: SLOTS }, (_, i) =>
      `<div class="club locked" data-ench="slot${i}" style="--c:#ffffff"><div class="cd"></div><span class="key">${ABILITY_KEYS[i]}</span><div class="name"></div><div class="title"></div><span class="cdlabel"></span><div class="cdnum"></div></div>`,
    ).join('');
    this.choiceEl.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.choice') as HTMLElement | null;
      if (card) this.onPick?.(Number(card.dataset.i));
    });
  }

  private choiceEl = $('choice');
  /** Se eligió la carta número `i` (0, 1 o 2). */
  onPick: ((i: number) => void) | null = null;

  /** Las tres cartas entre oleadas. Se elige con click o con 1, 2 y 3. */
  showChoice(cards: { tag: string; name: string; title: string; hint: string; color: number; up?: string; cool?: { text: string; slower: boolean } }[], next: string): void {
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    (this.choiceEl.querySelector('.cards') as HTMLElement).innerHTML = cards.map((c, i) => {
      const color = '#' + c.color.toString(16).padStart(6, '0');
      // las de habilidad dicen su recarga; si subir de nivel la alarga, en otro color
      const cool = c.cool ? `<div class="cool${c.cool.slower ? ' slower' : ''}">⟳ ${esc(c.cool.text)}</div>` : '';
      // las que suben de nivel dicen qué mejora, en verde, arriba de la recarga
      const up = c.up ? `<div class="cool up" style="color:#8fe3b0">▲ ${esc(c.up)}</div>` : '';
      return `<div class="choice" data-i="${i}" style="--c:${color}"><kbd>${i + 1}</kbd><div class="tag">${esc(c.tag)}</div><div class="name">${esc(c.name)}</div><div class="title">${esc(c.title)}</div><div class="hint">${esc(c.hint)}</div>${up}${cool}</div>`;
    }).join('');
    (this.choiceEl.querySelector('.next') as HTMLElement).textContent = next ? L(`Próxima oleada: ${next}`, `Next wave: ${next}`) : '';
    this.choiceEl.hidden = false;
  }

  hideChoice(): void {
    this.choiceEl.hidden = true;
  }

  /**
   * Arma el arco del medidor con los umbrales de la barra (`midFrom` y `strongFrom`, en fracción de la
   * potencia). El arco va de borde a borde pasando por arriba: la potencia 0 está en los dos bordes y la
   * 1 arriba en el medio, así que las zonas quedan en espejo: verde (débil) en las puntas, amarillo
   * (medio) y rojo (fuerte) en el centro.
   */
  /**
   * Los tramos del arco: el golpe 1 en los bordes (verde), el 2 entre medio (amarillo) y el 3 en el
   * centro (rojo). `duff`: con este palo el golpe 1 es pifia (el wedge), y el arco cambia: el golpe 1 en
   * gris con un triángulo de peligro, el 2 en verde y el 3 en amarillo. `damage`: lo que pega cada nivel
   * con el palo y la distancia de ahora; va escrito en su tramo.
   *
   * `fourth`: con el golpe 4 (ver FOURTH en core/clubs), qué parte del fuerte es el 4. El rojo se parte:
   * el 4 en el medio, en rojo, y el 3 a los costados, en naranja (con la pifia, todo un color más abajo).
   * El número de arriba es el del 4; el del 3 va solo si su tramo es ancho como para que se lea.
   */
  setMarks(layout: ArcLayout, marks: readonly [number, number], duff = false, damage: readonly number[] = [], fourth = 0): void {
    this.layout = layout;
    this.marks = marks;
    // se llama en cada cuadro (las mejoras, el palo y la distancia cambian): solo se rearma si cambió algo
    const key = `${layout.weak.toFixed(2)}/${layout.mid.toFixed(2)}/${layout.strong.toFixed(2)}/${duff}/${damage.join()}/${fourth}`;
    if (key === this.marksKey) return;
    this.marksKey = key;
    const R = 66;
    const r = 44;
    const at = (rad: number, a: number) => `${(rad * Math.sin((a * Math.PI) / 180)).toFixed(2)} ${(-rad * Math.cos((a * Math.PI) / 180)).toFixed(2)}`;
    const sector = (a1: number, a2: number, color: string) =>
      `<path class="zone" fill="${color}" d="M ${at(R, a1)} A ${R} ${R} 0 0 1 ${at(R, a2)} L ${at(r, a2)} A ${r} ${r} 0 0 0 ${at(r, a1)} Z" />`;
    // de dónde a dónde va cada tramo, en grados desde arriba: cada uno ocupa lo que dura (ver `arcLayout`)
    const edge = Math.min(ARC_MAX, layout.span);
    const g = Math.min(edge, layout.mid + layout.strong);
    const y = Math.min(g, layout.strong);
    // con el golpe 4, dónde termina el 3 y empieza el 4 (desde arriba)
    const f = fourth > 0 ? Math.min(y, layout.strong * fourth) : 0;
    const low = duff ? '#4d535c' : '#5be07a';
    const mid = duff ? '#5be07a' : '#ffd66b';
    const top = duff ? (f ? '#ff9a2e' : '#ffd21f') : '#ff2d3c';
    const third = duff ? '#ffd21f' : '#ff9a2e';
    // el triángulo de peligro, en el medio de cada tramo de la pifia
    const warn = (a: number) => {
      const [x, y] = at((R + r) / 2, a).split(' ').map(Number);
      return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><path d="M 0 -8 L 8.5 6.5 L -8.5 6.5 Z" fill="#ffb020" stroke="#1a1204" stroke-width="1.6" stroke-linejoin="round" />`
        + `<rect x="-1.1" y="-3.6" width="2.2" height="5.6" rx="1" fill="#1a1204" /><circle cy="4.1" r="1.2" fill="#1a1204" /></g>`;
    };
    // el daño de cada nivel, en el medio de su tramo (en los dos lados); en el rojo va en blanco
    const label = (a: number, n: number | undefined, fill: string) => {
      if (n === undefined) return '';
      const [x, y] = at((R + r) / 2, a).split(' ').map(Number);
      return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="800" fill="${fill}">${n}</text>`;
    };
    const dark = '#10151c';
    // el fuerte suele ser angosto: su número va encima del tramo aunque sobresalga a los costados, con
    // borde oscuro para que se lea sobre los tramos de al lado
    const topN = f ? damage[3] : damage[2];
    const topLabel = () => {
      if (topN === undefined) return '';
      if (duff && !f) return label(0, topN, dark);
      return `<text x="0" y="${-(R + r) / 2}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="800" fill="#ffffff" stroke="#0b0f14" stroke-width="3" paint-order="stroke">${topN}</text>`;
    };
    // el 3 con el golpe 4: solo si su tramo da para un número sin pisar los de al lado
    const thirdLabel = f && y - f >= 9 ? label(-(y + f) / 2, damage[2], dark) + label((y + f) / 2, damage[2], dark) : '';
    const numbers = (duff ? '' : label(-(edge + g) / 2, damage[0], dark) + label((edge + g) / 2, damage[0], dark))
      + label(-(g + y) / 2, damage[1], dark) + label((g + y) / 2, damage[1], dark)
      + thirdLabel + topLabel();
    // un fondo oscuro un poco más grande, como tenía la barra: sobre el pasto el verde se perdía
    const b = edge + 2;
    const back = `<path fill="rgba(0,0,0,0.6)" d="M ${at(R + 4, -b)} A ${R + 4} ${R + 4} 0 0 1 ${at(R + 4, b)} L ${at(r - 4, b)} A ${r - 4} ${r - 4} 0 0 0 ${at(r - 4, -b)} Z" />`;
    this.meter.innerHTML = `<svg viewBox="-72 -86 144 100">` + back
      + sector(-edge, -g, low) + sector(-g, -y, mid)
      + (f ? sector(-y, -f, third) + sector(-f, f, top) + sector(f, y, third) : sector(-y, y, top))
      + sector(y, g, mid) + sector(g, edge, low)
      + (duff ? warn(-(edge + g) / 2) + warn((edge + g) / 2) : '') + numbers
      + `<g class="needle"><line x1="0" y1="-30" x2="0" y2="-72" stroke="#0b0f14" stroke-width="6" stroke-linecap="round" />`
      + `<line x1="0" y1="-30" x2="0" y2="-72" stroke="#ffffff" stroke-width="3" stroke-linecap="round" /></g>`
      + `<circle r="5" fill="#ffffff" stroke="#0b0f14" stroke-width="2" /></svg>`;
    this.needle = this.meter.querySelector('.needle');
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

  /** Qué palos están habilitados. */
  setClubState(unlocked: ReadonlySet<ClubId>): void {
    const key = [...unlocked].join();
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
      (el.querySelector('.title') as HTMLElement).textContent = s.level > 1 ? L(`${a.title} · nv ${s.level}`, `${a.title} · lv ${s.level}`) : a.title;
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
    (el.querySelector('.cool') as HTMLElement).textContent = c.cooldown ? L(`Recarga: ${c.cooldown} s`, `Cooldown: ${c.cooldown} s`) : L('Sin recarga', 'No cooldown');
    (el.querySelector('.next') as HTMLElement).textContent = c.next ? L(`Próxima oleada: ${c.next}`, `Next wave: ${c.next}`) : '';
    el.hidden = false;
  }

  hideCard(): void {
    this.cardEl.hidden = true;
  }

  /**
   * Las vidas (se llama en cada cuadro). Los corazones que se pierden saltan y se vacían, los que se
   * recuperan aparecen de golpe, y con el último late. La puerta dice cuánto le queda y se agrieta: a
   * partir de la mitad, y más con menos de un tercio.
   */
  setBars(gate: number, gateMax: number, hp: number, hpMax: number): void {
    hp = Math.max(0, Math.round(hp));
    if (hpMax !== this.shownHpMax) {
      this.shownHpMax = hpMax;
      this.hearts.innerHTML = `<i>${HEART_SVG}</i>`.repeat(hpMax);
      this.shownHp = -1;
    }
    if (hp !== this.shownHp) {
      const before = this.shownHp;
      Array.from(this.hearts.children).forEach((el, i) => {
        el.classList.toggle('empty', i >= hp);
        // el que cambia, con su animación (al dibujarlos por primera vez, ninguno)
        const changed = before >= 0 && (i < before) !== (i < hp);
        el.classList.remove('lost', 'gain');
        if (changed) {
          void (el as HTMLElement).offsetWidth;
          el.classList.add(i >= hp ? 'lost' : 'gain');
        }
      });
      this.hearts.classList.toggle('last', hp === 1 && hpMax > 1);
      this.shownHp = hp;
    }
    gate = Math.max(0, Math.round(gate));
    if (gate !== this.shownGate) {
      this.shownGate = gate;
      this.gateNum.innerHTML = `${gate}<small>/${gateMax}</small>`;
      this.gateBox.classList.toggle('hurt', gate <= gateMax * 0.6);
      this.gateBox.classList.toggle('broken', gate <= gateMax * 0.3);
    }
    if (this.gateBox.classList.contains('alert') && performance.now() > this.gateAlertUntil) this.gateBox.classList.remove('alert');
  }

  /** Le pegaron a la puerta: tiembla y se pone roja un momento. */
  gateAlert(): void {
    this.gateAlertUntil = performance.now() + 900;
    this.gateBox.classList.remove('alert');
    void this.gateBox.offsetWidth;
    this.gateBox.classList.add('alert');
  }

  private runEl = $('run');
  private tutorialEl = $('tutorial');

  /**
   * El recuadro del tutorial: qué hacer en este paso. `header` va arriba, donde va la oleada. Con null se
   * esconde y vuelve la tira de la partida.
   */
  setTutorial(header: string | null, title: string, html: string, note = ''): void {
    this.tutorialEl.hidden = header === null;
    this.runEl.hidden = header !== null;
    if (header === null) return;
    this.waveN.textContent = header;
    this.waveSub.textContent = '';
    (this.tutorialEl.querySelector('.title') as HTMLElement).textContent = title;
    // el texto es del juego (tutorial.ts), no del jugador: lleva negritas y teclas
    (this.tutorialEl.querySelector('.text') as HTMLElement).innerHTML = html;
    const noteEl = this.tutorialEl.querySelector('.note') as HTMLElement;
    noteEl.textContent = note;
    noteEl.hidden = !note;
  }
  private shownScenario = -2;

  /** El recorrido de la partida: un ícono por escenario (su poder) y el del jefe al final. */
  setRun(steps: { src: string; title: string }[]): void {
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    this.runEl.innerHTML = steps.map((s) => `<img src="${s.src}" alt="" title="${esc(s.title)}" />`).join('');
    this.shownScenario = -2;
  }

  /** Enciende el escenario en curso (0, 1, 2, o 3 el jefe); los de antes quedan hechos. -1 = antes de empezar. */
  setScenario(scenario: number): void {
    if (scenario === this.shownScenario) return;
    this.shownScenario = scenario;
    Array.from(this.runEl.children).forEach((el, i) => {
      el.classList.toggle('done', i < scenario);
      el.classList.toggle('now', i === scenario);
    });
  }

  private heatEl = $('heat');
  private heatKey = '';

  /** La llama de la dificultad al lado del título de la oleada (ver src/threat.ts). Sin puntos puestos, no va. */
  setHeat(level: number, max: number): void {
    const key = `${level}/${max}`;
    if (key === this.heatKey) return;
    this.heatKey = key;
    this.heatEl.hidden = level <= 0;
    this.heatEl.innerHTML = level > 0 ? flameHtml(level, max) : '';
    this.heatEl.title = L(`Dificultad ${level} de ${max}`, `Difficulty ${level} of ${max}`);
  }

  setWave(index: number, total: number, alive: number, pending: number, restLeft: number): void {
    this.waveN.textContent = index < 0 ? L('Preparate…', 'Get ready…') : L(`Oleada ${index + 1} / ${total}`, `Wave ${index + 1} / ${total}`);
    this.waveSub.textContent = restLeft > 0 && index >= 0
      ? L(`próxima oleada en ${Math.ceil(restLeft)}`, `next wave in ${Math.ceil(restLeft)}`)
      : index < 0 ? '' : L(`quedan ${alive + pending}`, `${alive + pending} left`);
  }

  private pocketEl = $('pocket');
  private pocketKey = '';

  /** Modo tenis: las pelotas del bolsillo, llenas y vacías. */
  setPocket(count: number, max: number): void {
    const key = `${count}/${max}`;
    if (key === this.pocketKey) return;
    this.pocketKey = key;
    this.pocketEl.hidden = false;
    this.pocketEl.innerHTML = `<small>${L('bolsillo', 'pocket')}</small>${'<span>●</span>'.repeat(Math.min(count, max))}${'<span class="off">●</span>'.repeat(Math.max(0, max - count))}`;
  }

  setScore(score: number, kills: number): void {
    this.score.textContent = L(`${score} pts · ${kills} bajas`, `${score} pts · ${kills} kills`);
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
    this.hint.textContent = queued ? L(`Próximo: ${queued.name} · ${queued.hint}`, `Next: ${queued.name} · ${queued.hint}`) : hint || club.hint;
  }

  /** Pone el arco en un punto de la pantalla (el centro del arco). */
  placeMeter(x: number, y: number): void {
    const w = 60;
    this.meter.style.left = `${Math.min(innerWidth - w, Math.max(w, x)).toFixed(0)}px`;
    this.meter.style.top = `${Math.min(innerHeight - 40, Math.max(40, y)).toFixed(0)}px`;
  }

  /** La aguja del arco: `side` dice por qué lado va (-1 izquierda, 1 derecha; ver SwingMeter.side). */
  setMeter(charging: boolean, power: number, locked: boolean, label: string, side = -1): void {
    this.meter.classList.toggle('on', charging);
    this.meter.classList.toggle('locked', charging && locked);
    // velocidad pareja: la aguja va a la par del tiempo, y cada tramo ocupa lo que dura
    const edge = Math.min(ARC_MAX, this.layout.span);
    const angle = charging ? side * Math.max(0, edge - arcAngle(power, this.marks, this.layout)) : -edge;
    this.needle?.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
    this.range.textContent = charging ? label : '';
  }

  /** Tenis: si la pelota del arco te llega o no (sin llegar, el arco se ve apagado). */
  setMeterReach(inReach: boolean): void {
    this.meter.classList.toggle('far', !inReach);
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

  /** El botón del skin, en la barra de arriba: corto; el nombre va en el globito. */
  setSkin(name: string): void {
    this.skinBtn.textContent = 'Skin (C)';
    this.skinBtn.title = `Skin: ${name}`;
  }

  setPause(on: boolean): void {
    this.pauseEl.hidden = !on;
  }

  /** El cartel del final, animado (ver EndScreen). */
  showEnd(info: EndInfo): void {
    this.end.show(info);
  }

  /** El cartel del final sin animación ni números: el que mira y llegó cuando ya había terminado. */
  showEndPlain(title: string, result: EndInfo['result']): void {
    this.end.showPlain(title, result);
  }

  hideEnd(): void {
    this.end.hide();
  }
}
