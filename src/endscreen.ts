// El cartel del final (4/10, pedido de Leandro): al ganar, con más fiesta. El título entra de golpe, el
// puntaje cuenta hacia arriba, los números de la partida aparecen de a uno (cada uno con su nota), y al
// final el aviso del nivel de dificultad desbloqueado. Al ganar, además, papelitos.
//
// El nivel desbloqueado (7/10, pedido de Leandro: «tiene que hacerte más efecto»): la llama de la
// dificultad (src/threat.ts) cae con el número de antes y revienta con el nuevo: destello, temblor, un
// anillo, chispas que suben y el fuego que tiñe la pantalla desde abajo. Recién ahí aparece el botón.
//
// Lo que se muestra lo arma el juego (`EndInfo`): este módulo solo lo anima. Viaja tal cual al que mira
// (ver net/host.ts), así que es todo dato plano.

import { L } from './i18n';
import { flameHtml } from './threat';

/** Un número de la partida. `of`: «7 de 10». `kind`: cómo se escribe. */
export interface EndStat {
  label: string;
  value: number;
  of?: number;
  kind?: 'time' | 'pct';
  /** Lo que va después del número («de un tiro»). */
  unit?: string;
}

export interface EndInfo {
  result: 'victory' | 'defeat';
  title: string;
  detail: string;
  score: number;
  /** El mejor puntaje de este navegador (ya con esta partida), y si esta lo superó. */
  best: number;
  record: boolean;
  stats: EndStat[];
  /** Un aviso al final (en la demo, lo que trae la completa). */
  earned: string;
  /** Se desbloqueó un nivel de dificultad: el nuevo, y cuántos hay. */
  unlock?: { level: number; max: number };
  /** Con qué dificultad se jugó y cuántos niveles hay desbloqueados. */
  level: string;
}

/** Cuándo pasa cada cosa, en segundos desde que aparece el cartel. */
const T = { score: 0.45, scoreFor: 1.4, stats: 1.3, statEvery: 0.17, countFor: 0.55, after: 0.35, unlockPop: 0.6, unlockDone: 0.9 };
const CONFETTI_COLORS = ['#ffd66b', '#fff4c2', '#5be07a', '#ff6b4a', '#7fd8ff', '#ffffff', '#c9b8ff'];
const EMBER_COLORS = ['#ffd27a', '#ffb347', '#ff7a22', '#ff4d1f', '#ff2a3a'];

function format(s: EndStat, v: number): string {
  if (s.kind === 'time') {
    const t = Math.round(v);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }
  if (s.kind === 'pct') return `${Math.round(v)} %`;
  return `${Math.round(v)}${s.of !== undefined ? ` / ${s.of}` : ''}${s.unit ? ` ${s.unit}` : ''}`;
}

/** Sube rápido y frena al llegar. */
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

interface Paper {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  w: number;
  h: number;
  color: string;
  wobble: number;
}

/** Una chispa del fuego: sube, titila y se apaga. */
interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  span: number;
  size: number;
  color: string;
  wobble: number;
}

export class EndScreen {
  /** Cada vez que aparece algo (un número, el aviso): `i` sube de a uno, para que las notas suban. */
  onBeat: ((i: number, result: EndInfo['result']) => void) | null = null;
  /** Revienta la llama del nivel desbloqueado (lo pone el juego, para el sonido). `max`: era el último. */
  onUnlock: ((max: boolean) => void) | null = null;
  private timers: number[] = [];
  private raf = 0;
  /** Sube con cada cartel nuevo: lo que estaba contando para el anterior se corta. */
  private gen = 0;
  private papers: Paper[] = [];
  private embers: Ember[] = [];
  private readonly canvas: HTMLCanvasElement;

  /** Hasta cuándo siguen cayendo papelitos de arriba (reloj de `performance.now`, en ms). */
  private rainUntil = 0;
  /** Hasta cuándo suben chispas desde abajo (el nivel desbloqueado). */
  private fireUntil = 0;

  /** `el` es el #end de index.html, con su lienzo, el puntaje y la lista de números. */
  constructor(private readonly el: HTMLElement) {
    this.canvas = el.querySelector('.confetti') as HTMLCanvasElement;
  }

  /** Lo que se ve al mirar una partida que ya terminó, sin los números (no llegaron). */
  showPlain(title: string, result: EndInfo['result']): void {
    this.show({ result, title, detail: '', score: 0, best: 0, record: false, stats: [], earned: '', level: '' }, false);
  }

  show(info: EndInfo, animate = true): void {
    this.stop();
    const el = this.el;
    const calm = !animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.classList.toggle('victory', info.result === 'victory');
    el.classList.toggle('defeat', info.result === 'defeat');
    el.classList.toggle('calm', calm);
    el.classList.toggle('plain', info.stats.length === 0);
    // vuelve a arrancar las animaciones de CSS aunque ya se hubiera mostrado
    el.classList.remove('play');
    void el.offsetWidth;
    el.classList.add('play');
    const q = (sel: string) => el.querySelector(sel) as HTMLElement;
    q('h2').textContent = info.title;
    q('.detail').textContent = info.detail;
    q('.level').textContent = info.level;
    const best = q('.best');
    best.textContent = info.record ? L('¡Nuevo récord!', 'New record!') : info.best > 0 ? L(`Récord: ${info.best}`, `Best: ${info.best}`) : '';
    best.classList.toggle('record', info.record);
    const earned = q('.earned');
    earned.textContent = info.earned;
    earned.hidden = !info.earned;
    const unlock = q('.unlock');
    const u = info.unlock;
    unlock.hidden = !u;
    unlock.classList.remove('in', 'pop');
    el.classList.remove('unlocked', 'boom');
    if (u) {
      const last = u.level >= u.max;
      unlock.classList.toggle('max', last);
      el.classList.toggle('maxed', last);
      // cae con el número de antes y revienta con el nuevo
      q('.unlock .slot').innerHTML = flameHtml(calm ? u.level : u.level - 1, u.max);
      q('.unlock .what').textContent = last
        ? L('¡Dificultad máxima desbloqueada!', 'Maximum difficulty unlocked!')
        : L(`¡Nivel ${u.level} desbloqueado!`, `Level ${u.level} unlocked!`);
      q('.unlock .why').textContent = u.level === 1
        ? L('Elegí en Dificultad qué se pone más difícil', 'Pick what gets harder in Difficulty')
        : last
        ? L('Ponelo y que los dioses te amparen', 'Spend it, and may the gods have mercy')
        : L('Tenés un punto nuevo: ponelo donde más te duela', 'You have a new point: spend it where it hurts most');
      if (calm) {
        unlock.classList.add('in', 'pop');
        el.classList.add('unlocked');
      }
    }
    const num = q('.score .num');
    // lo que entra con su animación arranca afuera; quieto, ya está
    for (const x of [best, earned, num.parentElement!]) x.classList.toggle('in', calm);
    const stats = q('.stats');
    stats.innerHTML = '';
    const rows = info.stats.map((s) => {
      const row = document.createElement('div');
      row.className = 'stat';
      row.innerHTML = '<span class="label"></span><span class="value"></span>';
      (row.querySelector('.label') as HTMLElement).textContent = s.label;
      (row.querySelector('.value') as HTMLElement).textContent = format(s, calm ? s.value : 0);
      stats.appendChild(row);
      return row;
    });
    el.hidden = false;
    if (calm) {
      num.textContent = String(info.score);
      for (const r of rows) r.classList.add('in');
      el.classList.add('done');
      return;
    }
    el.classList.remove('done');
    num.textContent = '0';
    let beat = 0;
    const at = (seconds: number, fn: () => void) => this.timers.push(window.setTimeout(fn, seconds * 1000));
    // el puntaje cuenta hacia arriba
    at(T.score, () => this.count(T.scoreFor, (k) => { num.textContent = String(Math.round(info.score * k)); }, () => {
      num.parentElement!.classList.add('in');
      best.classList.add('in');
    }));
    // los números, de a uno
    info.stats.forEach((s, i) => at(T.stats + i * T.statEvery, () => {
      rows[i].classList.add('in');
      this.onBeat?.(beat++, info.result);
      const value = rows[i].querySelector('.value') as HTMLElement;
      this.count(T.countFor, (k) => { value.textContent = format(s, s.value * k); });
    }));
    const end = Math.max(T.score + T.scoreFor, T.stats + info.stats.length * T.statEvery) + T.after;
    at(end, () => {
      if (info.earned) {
        earned.classList.add('in');
        this.onBeat?.(beat++ + 2, info.result);
        if (info.result === 'victory') this.burst(0.5, 0.55, 90);
      }
      if (!u) {
        el.classList.add('done');
        return;
      }
      // la llama cae con el número de antes...
      unlock.classList.add('in');
      el.classList.add('unlocked');
      unlock.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // ...y revienta con el nuevo
      at(T.unlockPop, () => {
        const last = u.level >= u.max;
        q('.unlock .slot').innerHTML = flameHtml(u.level, u.max);
        unlock.classList.add('pop');
        el.classList.remove('boom');
        void el.offsetWidth;
        el.classList.add('boom');
        this.onUnlock?.(last);
        const flame = q('.unlock .flame').getBoundingClientRect();
        const box = this.canvas.getBoundingClientRect();
        const x = (flame.left + flame.width / 2 - box.left) / Math.max(1, box.width);
        const y = (flame.top + flame.height * 0.6 - box.top) / Math.max(1, box.height);
        this.sparks(x, y, last ? 140 : 90);
        this.fireUntil = performance.now() + (last ? 7000 : 4500);
        this.run();
        at(T.unlockDone, () => {
          el.classList.add('done');
          // el botón de la dificultad, que ahora late, tiene que quedar a la vista
          q('.foot').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      });
    });
    if (info.result === 'victory') this.confetti();
  }

  hide(): void {
    this.stop();
    this.el.hidden = true;
  }

  private stop(): void {
    // lo que estaba contando se corta: si no, pisaría los números del cartel nuevo
    this.gen++;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.papers = [];
    this.embers = [];
    this.rainUntil = 0;
    this.fireUntil = 0;
    const ctx = this.canvas.getContext('2d');
    ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Corre `fn(k)` con k de 0 a 1 durante `seconds`, frenando al final. */
  private count(seconds: number, fn: (k: number) => void, done?: () => void): void {
    const start = performance.now();
    const gen = this.gen;
    const step = () => {
      if (gen !== this.gen) return;
      const t = (performance.now() - start) / 1000 / seconds;
      fn(easeOut(t));
      if (t < 1) requestAnimationFrame(step);
      else done?.();
    };
    requestAnimationFrame(step);
  }

  /** Papelitos: dos cañonazos desde abajo y después una lluvia que va aflojando. */
  private confetti(): void {
    this.burst(0.06, 1.02, 70, 0.35);
    this.burst(0.94, 1.02, 70, -0.35);
    this.rainUntil = performance.now() + 5000;
  }

  /** Mueve y dibuja los papelitos mientras haya. Arranca solo con el primero. */
  private run(): void {
    if (this.raf) return;
    const c = this.canvas;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const left = (this.rainUntil - now) / 1000;
      const fire = (this.fireUntil - now) / 1000;
      if (c.width !== Math.round(c.clientWidth * devicePixelRatio) || c.height !== Math.round(c.clientHeight * devicePixelRatio)) {
        c.width = Math.round(c.clientWidth * devicePixelRatio);
        c.height = Math.round(c.clientHeight * devicePixelRatio);
      }
      // la lluvia sigue unos segundos, cada vez más floja
      if (left > 0 && Math.random() < 0.1 + left * 0.16) this.drop();
      // y el fuego: chispas que suben desde abajo, también cada vez menos
      if (fire > 0 && Math.random() < 0.25 + fire * 0.12) this.rise();
      const age = now / 1000;
      const W = c.width;
      const H = c.height;
      const s = devicePixelRatio;
      ctx.clearRect(0, 0, W, H);
      for (const p of this.papers) {
        p.vy += 0.9 * dt;
        p.vx *= 1 - 0.9 * dt;
        p.vy = Math.min(p.vy, 0.32);
        p.x += (p.vx + Math.sin(age * 3 + p.wobble) * 0.02) * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        ctx.save();
        ctx.translate(p.x * W, p.y * H);
        ctx.rotate(p.rot);
        // de canto se ve finito: así parece que da vueltas
        ctx.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
        ctx.fillStyle = p.color;
        ctx.fillRect((-p.w / 2) * s, (-p.h / 2) * s, p.w * s, p.h * s);
        ctx.restore();
      }
      this.papers = this.papers.filter((p) => p.y < 1.1);
      // las chispas suman luz: donde se juntan, quema
      ctx.globalCompositeOperation = 'lighter';
      for (const e of this.embers) {
        e.life -= dt;
        e.vy -= 0.12 * dt;
        e.vx *= 1 - 1.2 * dt;
        e.x += (e.vx + Math.sin(age * 5 + e.wobble) * 0.012) * dt;
        e.y += e.vy * dt;
        const k = Math.max(0, e.life / e.span);
        ctx.globalAlpha = Math.min(1, k * 1.6) * (0.75 + 0.25 * Math.sin(age * 23 + e.wobble));
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x * W, e.y * H, e.size * s * (0.4 + 0.6 * k), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      this.embers = this.embers.filter((e) => e.life > 0 && e.y > -0.1);
      if (this.papers.length || this.embers.length || left > 0 || fire > 0) this.raf = requestAnimationFrame(frame);
      else this.raf = 0;
    };
    this.raf = requestAnimationFrame(frame);
  }

  private paper(x: number, y: number, vx: number, vy: number): Paper {
    return {
      x, y, vx, vy, rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 14,
      w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], wobble: Math.random() * 6,
    };
  }

  /** Un cañonazo de papelitos desde (x, y), en fracciones de la pantalla, inclinado `lean` hacia el costado. */
  private burst(x: number, y: number, n: number, lean = 0): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + lean + (Math.random() - 0.5) * 1.1;
      const v = 0.5 + Math.random() * 0.7;
      this.papers.push(this.paper(x, y, Math.cos(a) * v * 0.6, Math.sin(a) * v));
    }
    this.run();
  }

  /** Uno que cae desde arriba. */
  private drop(): void {
    this.papers.push(this.paper(Math.random(), -0.03, (Math.random() - 0.5) * 0.1, 0.05 + Math.random() * 0.1));
  }

  private ember(x: number, y: number, vx: number, vy: number, life: number): Ember {
    return {
      x, y, vx, vy, life, span: life, size: 1.5 + Math.random() * 2.5,
      color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)], wobble: Math.random() * 6,
    };
  }

  /** Un reventón de chispas desde (x, y), en fracciones de la pantalla: para todos lados, más para arriba. */
  private sparks(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.15 + Math.random() * 0.55;
      this.embers.push(this.ember(x, y, Math.cos(a) * v * 0.7, Math.sin(a) * v - 0.25, 0.7 + Math.random() * 1.1));
    }
    this.run();
  }

  /** Una chispa que sube desde abajo de la pantalla. */
  private rise(): void {
    this.embers.push(this.ember(Math.random(), 1.02, (Math.random() - 0.5) * 0.08, -(0.12 + Math.random() * 0.22), 2 + Math.random() * 2.5));
  }
}
