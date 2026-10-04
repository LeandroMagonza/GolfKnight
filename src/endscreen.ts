// El cartel del final (4/10, pedido de Leandro): al ganar, con más fiesta. El título entra de golpe, el
// puntaje cuenta hacia arriba, los números de la partida aparecen de a uno (cada uno con su nota), y al
// final el aviso del nivel de dificultad desbloqueado. Al ganar, además, papelitos.
//
// Lo que se muestra lo arma el juego (`EndInfo`): este módulo solo lo anima. Viaja tal cual al que mira
// (ver net/host.ts), así que es todo dato plano.

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
  /** El aviso del nivel de dificultad desbloqueado, si se desbloqueó uno. */
  earned: string;
  /** Con qué dificultad se jugó y cuántos niveles hay desbloqueados. */
  level: string;
}

/** Cuándo pasa cada cosa, en segundos desde que aparece el cartel. */
const T = { score: 0.45, scoreFor: 1.4, stats: 1.3, statEvery: 0.17, countFor: 0.55, after: 0.35 };
const CONFETTI_COLORS = ['#ffd66b', '#fff4c2', '#5be07a', '#ff6b4a', '#7fd8ff', '#ffffff', '#c9b8ff'];

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

export class EndScreen {
  /** Cada vez que aparece algo (un número, el aviso): `i` sube de a uno, para que las notas suban. */
  onBeat: ((i: number, result: EndInfo['result']) => void) | null = null;
  private timers: number[] = [];
  private raf = 0;
  /** Sube con cada cartel nuevo: lo que estaba contando para el anterior se corta. */
  private gen = 0;
  private papers: Paper[] = [];
  private readonly canvas: HTMLCanvasElement;

  /** Hasta cuándo siguen cayendo papelitos de arriba (reloj de `performance.now`, en ms). */
  private rainUntil = 0;

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
    best.textContent = info.record ? '¡Nuevo récord!' : info.best > 0 ? `Récord: ${info.best}` : '';
    best.classList.toggle('record', info.record);
    const earned = q('.earned');
    earned.textContent = info.earned;
    earned.hidden = !info.earned;
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
      el.classList.add('done');
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
    this.rainUntil = 0;
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
      if (c.width !== Math.round(c.clientWidth * devicePixelRatio) || c.height !== Math.round(c.clientHeight * devicePixelRatio)) {
        c.width = Math.round(c.clientWidth * devicePixelRatio);
        c.height = Math.round(c.clientHeight * devicePixelRatio);
      }
      // la lluvia sigue unos segundos, cada vez más floja
      if (left > 0 && Math.random() < 0.1 + left * 0.16) this.drop();
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
      if (this.papers.length || left > 0) this.raf = requestAnimationFrame(frame);
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
}
