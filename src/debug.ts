// Panel de balance y pruebas (tecla B). Toca los números del juego en vivo: el daño de cada palo en
// cada banda de distancia, las bandas, la recarga de los poderes y la vida y velocidad de cada enemigo.
// Abajo están los botones para probar: oleada infinita, vida infinita, puerta infinita y saltar a una
// oleada.
//
// Los cambios se aplican sobre los objetos del juego (CLUBS, ENCHANTS, ENEMIES), así que valen desde el
// siguiente tiro y desde el siguiente enemigo que aparece; a los que ya están en el campo se les
// empareja la vida y la velocidad. El botón de copiar saca el texto con todo lo cambiado, para pasarlo
// e incorporarlo al juego.
import { BAND_LIMITS, BAND_NAMES, CLUB_ORDER, CLUBS, ENCHANT_ORDER, ENCHANTS, QUALITY_LEVELS } from './core/clubs';
import { COURSES } from './core/terrain';
import { ENEMIES, type EnemyKind, type WaveDirector, WAVES } from './core/waves';

export interface DebugFlags {
  /** El golfista no recibe daño. */
  godPlayer: boolean;
  /** La puerta no recibe daño. */
  godGate: boolean;
}

export interface DebugHooks {
  director: WaveDirector;
  flags: DebugFlags;
  /** Les pasa a los enemigos vivos la vida y la velocidad nuevas. */
  refreshEnemies(): void;
  /** Salta a una oleada (0 = la primera) y habilita lo que corresponda. */
  goToWave(index: number): void;
  /** Tipos de enemigo apagados: no aparecen más en las oleadas. */
  disabled: Set<EnemyKind>;
  /** Cambia de campo. Recarga la página: la malla del terreno se arma una sola vez. */
  setCourse(index: number | null): void;
  /** Qué campo está en juego, para marcarlo. */
  courseIndex(): number;
  /** Cómo está la cámara ahora, para mostrarla y copiarla. */
  camera(): { pitch: number; rise: number; dist: number };
}

/**
 * El balance ajustado se guarda en el navegador y vuelve al recargar. Hace falta porque cambiar de
 * campo recarga la página: sin esto, tocar diez números y probarlos en otro campo era imposible. El
 * botón «Restaurar» lo borra y devuelve los valores del código.
 */
const STORE_KEY = 'gk.balance';

/** Lo que no vive en CLUBS ni en ENEMIES pero igual se guarda. */
export interface SavedExtras {
  camera?: { pitch: number; rise: number };
  disabled?: string[];
}

type Saved = SavedExtras & {
  bands?: number[];
  clubs?: Record<string, Partial<Record<'minRange' | 'maxRange' | 'spread' | 'chargeTime' | 'rollFriction', number> & { damage: number[][]; areaDamage: number[][] }>>;
  enchants?: Record<string, number>;
  enemies?: Record<string, { hp: number; speed: number; damage: number; attackEvery?: number }>;
};

/** Aplica el balance guardado. Tiene que correr antes de armar el mundo: las bandas dibujan el campo. */
export function loadBalance(): SavedExtras {
  let saved: Saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
  if (saved.bands?.length === BAND_LIMITS.length) BAND_LIMITS.splice(0, BAND_LIMITS.length, ...saved.bands);
  for (const id of CLUB_ORDER) {
    const from = saved.clubs?.[id];
    if (!from) continue;
    const club = CLUBS[id];
    for (const k of ['minRange', 'maxRange', 'spread', 'chargeTime', 'rollFriction'] as const) {
      if (typeof from[k] === 'number') club[k] = from[k];
    }
    if (from.damage) club.damage = from.damage;
    if (from.areaDamage && club.areaDamage) club.areaDamage = from.areaDamage;
  }
  for (const id of ENCHANT_ORDER) {
    const cd = saved.enchants?.[id];
    if (typeof cd === 'number') ENCHANTS[id].cooldown = cd;
  }
  for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
    const from = saved.enemies?.[kind];
    if (!from) continue;
    const s = ENEMIES[kind];
    s.hp = from.hp;
    s.speed = from.speed;
    s.damage = from.damage;
    if (typeof from.attackEvery === 'number' && s.attackEvery !== undefined) s.attackEvery = from.attackEvery;
  }
  return { camera: saved.camera, disabled: saved.disabled };
}

/** Guarda todo lo tocado. Se llama en cada cambio: son pocos bytes. */
export function saveBalance(extras: SavedExtras): void {
  const out: Saved = { bands: [...BAND_LIMITS], clubs: {}, enchants: {}, enemies: {}, ...extras };
  for (const id of CLUB_ORDER) {
    const c = CLUBS[id];
    out.clubs![id] = {
      minRange: c.minRange, maxRange: c.maxRange, spread: c.spread, chargeTime: c.chargeTime,
      rollFriction: c.rollFriction, damage: c.damage,
      ...(c.areaDamage ? { areaDamage: c.areaDamage } : {}),
    };
  }
  for (const id of ENCHANT_ORDER) out.enchants![id] = ENCHANTS[id].cooldown;
  for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
    const s = ENEMIES[kind];
    out.enemies![kind] = { hp: s.hp, speed: s.speed, damage: s.damage, attackEvery: s.attackEvery };
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(out));
  } catch {
    // sin localStorage (modo privado) el panel sigue andando, solo que no recuerda
  }
}

/** Borra lo guardado: al recargar vuelven los valores del código. */
export function clearBalance(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch { /* nada que borrar */ }
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`falta #${id}`);
  return el as T;
};

/** Un campo numérico que escribe directo en el juego. */
function numberField(get: () => number, set: (v: number) => void, step = 1): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'number';
  el.step = String(step);
  el.value = String(get());
  el.addEventListener('change', () => {
    const v = Number(el.value);
    if (Number.isFinite(v)) set(v);
    el.value = String(get());
  });
  return el;
}

function cell(row: HTMLTableRowElement, child?: HTMLElement | string, cls = ''): HTMLTableCellElement {
  const td = row.insertCell();
  if (cls) td.className = cls;
  if (typeof child === 'string') td.textContent = child;
  else if (child) td.appendChild(child);
  return td;
}

function heading(text: string): HTMLElement {
  const h = document.createElement('h4');
  h.textContent = text;
  return h;
}

function note(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  return p;
}

export class DebugPanel {
  private readonly el = $('balance');
  private readonly btn = $<HTMLButtonElement>('balancebtn');
  private readonly fields: HTMLInputElement[] = [];
  private camLine: HTMLElement | null = null;

  /** La cámara se mueve con la rueda mientras el panel está abierto: se relee en cada cuadro. */
  showCamera(): void {
    if (!this.camLine || !this.open) return;
    const c = this.hooks.camera();
    this.camLine.textContent = `inclinación ${c.pitch.toFixed(0)}° · altura ${c.rise >= 0 ? '+' : ''}${c.rise.toFixed(1)} m · distancia ${c.dist.toFixed(1)} m`;
  }

  constructor(private readonly hooks: DebugHooks) {
    this.btn.addEventListener('click', () => {
      this.btn.blur();
      this.toggle();
    });
    this.build();
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
    // los números se releen al abrir: pudieron cambiar desde la consola o desde otro botón
    if (this.open) for (const f of this.fields) f.dispatchEvent(new Event('refresh'));
  }

  /** Registra un campo para que se reescriba solo cuando se vuelve a abrir el panel. */
  private track(el: HTMLInputElement, get: () => number): HTMLInputElement {
    el.addEventListener('refresh', () => { el.value = String(get()); });
    this.fields.push(el);
    return el;
  }

  private field(get: () => number, set: (v: number) => void, step = 1): HTMLInputElement {
    return this.track(numberField(get, (v) => { set(v); this.save(); }, step), get);
  }

  /** Guarda el balance tocado, con lo que vive fuera de CLUBS y ENEMIES. */
  save(): void {
    const c = this.hooks.camera();
    saveBalance({ camera: { pitch: c.pitch, rise: c.rise }, disabled: [...this.hooks.disabled] });
  }

  private build(): void {
    const el = this.el;
    el.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = 'Balance';
    el.append(title, note('Los cambios entran en el próximo tiro. B cierra el panel.'));

    // ---- palos: daño por banda de distancia y nivel de golpe ----
    el.append(heading('Palos: daño por distancia'));
    for (const id of CLUB_ORDER) {
      const club = CLUBS[id];
      const table = document.createElement('table');
      const head = table.insertRow();
      const name = document.createElement('th');
      name.className = 'l';
      name.textContent = club.name;
      name.style.color = '#' + club.color.toString(16).padStart(6, '0');
      name.style.fontSize = '13px';
      head.appendChild(name);
      for (const b of BAND_NAMES) {
        const th = document.createElement('th');
        th.textContent = b;
        head.appendChild(th);
      }
      // en el que atraviesa y además abre área, el impacto y el área son dos números distintos
      const rows: [string, () => number[][]][] = club.areaDamage
        ? [['al pegar', () => club.damage], ['en área', () => club.areaDamage!]]
        : [['golpe', () => club.damage]];
      for (const [label, get] of rows) {
        for (let q = 1; q <= QUALITY_LEVELS; q++) {
          const row = table.insertRow();
          cell(row, `${label} ${q}`, 'l');
          for (let band = 0; band < BAND_NAMES.length; band++) {
            cell(row, this.field(() => get()[band][q - 1], (v) => { get()[band][q - 1] = v; }));
          }
        }
      }
      const rangeRow = table.insertRow();
      cell(rangeRow, 'llega de / a', 'l').title = 'metros mínimo y máximo a los que puede caer este palo';
      cell(rangeRow, this.field(() => club.minRange, (v) => { club.minRange = v; }));
      cell(rangeRow, this.field(() => club.maxRange, (v) => { club.maxRange = v; }));
      cell(rangeRow, this.field(() => club.spread, (v) => { club.spread = v; }, 0.2)).title = 'radio del área que abre donde cae, en metros';
      el.append(table);
    }
    el.append(note(
      'Ojo, son dos cosas distintas. «llega de / a» es hasta dónde alcanza ese palo: el cursor más lejos que eso no lo estira. '
      + 'Las bandas de acá abajo son dónde cambia cuánto pega, y valen para todos los palos por igual. '
      + 'Por eso el putter, que llega a 22 m, nunca usa su banda larga. La tercera casilla de esa fila es el radio del área. '
      + 'El hierro tiene dos bloques porque hace las dos cosas: «al pegar» es cuando la pelota le da a alguien y «en área» lo que reparte donde cae. '
      + 'El wedge y el putter solo hacen área, así que su tabla ya es la del área.',
    ));

    // ---- bandas ----
    el.append(heading('Bandas de distancia (iguales para todos los palos)'));
    const bands = document.createElement('table');
    const bandRow = bands.insertRow();
    cell(bandRow, 'corta hasta', 'l');
    cell(bandRow, this.field(() => BAND_LIMITS[0], (v) => { BAND_LIMITS[0] = v; }));
    cell(bandRow, 'media hasta', 'l');
    cell(bandRow, this.field(() => BAND_LIMITS[1], (v) => { BAND_LIMITS[1] = v; }));
    const puttRow = bands.insertRow();
    cell(puttRow, 'putter: rapidez', 'l').title = 'cuánto sale de fuerte la pelota rodada; más alto = llega antes';
    cell(puttRow, this.field(() => CLUBS.putter.rollFriction ?? 0, (v) => { CLUBS.putter.rollFriction = Math.max(1, v); }, 1));
    cell(puttRow, 'más = más rápido', 'l');
    const chargeRow = bands.insertRow();
    cell(chargeRow, 'carga 0 a 100', 'l').title = 'segundos que tarda la barra en llegar arriba';
    cell(chargeRow, this.field(
      () => CLUBS.driver.chargeTime,
      (v) => { for (const id of CLUB_ORDER) CLUBS[id].chargeTime = Math.max(0.1, v); },
      0.05,
    ));
    cell(chargeRow, 'segundos', 'l');
    el.append(bands, note('Los metros se cuentan desde la línea de los puestos, la que dice 0 en el campo. La carga es una sola para los cuatro palos: la barra mide timing, no potencia.'));

    // ---- poderes ----
    el.append(heading('Poderes: recarga'));
    const ench = document.createElement('table');
    for (const id of ENCHANT_ORDER) {
      const e = ENCHANTS[id];
      const row = ench.insertRow();
      cell(row, e.name, 'l');
      cell(row, this.field(() => e.cooldown, (v) => { e.cooldown = v; }, 0.2));
      cell(row, 'segundos', 'l');
    }
    el.append(ench);

    // ---- enemigos ----
    el.append(heading('Enemigos'));
    const enemies = document.createElement('table');
    const eHead = enemies.insertRow();
    for (const h of ['', 'sale', 'vida', 'vel.', 'daño', 'ataca c/']) {
      const th = document.createElement('th');
      th.textContent = h;
      if (!h) th.className = 'l';
      eHead.appendChild(th);
    }
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const s = ENEMIES[kind];
      const row = enemies.insertRow();
      cell(row, s.name, 'l');
      // apagar un tipo lo saca de las oleadas, sin tocar su composición: sirve para aislar a uno
      const on = document.createElement('button');
      on.type = 'button';
      const paint = () => {
        const alive = !this.hooks.disabled.has(kind);
        on.textContent = alive ? 'sí' : 'no';
        on.classList.toggle('on', alive);
      };
      on.addEventListener('click', () => {
        on.blur();
        if (this.hooks.disabled.has(kind)) this.hooks.disabled.delete(kind);
        else this.hooks.disabled.add(kind);
        paint();
        this.save();
      });
      paint();
      cell(row, on);
      cell(row, this.field(() => s.hp, (v) => { s.hp = v; this.hooks.refreshEnemies(); }));
      cell(row, this.field(() => s.speed, (v) => { s.speed = v; this.hooks.refreshEnemies(); }, 0.1));
      cell(row, this.field(() => s.damage, (v) => { s.damage = v; this.hooks.refreshEnemies(); }));
      // solo los que atacan a distancia tienen ritmo propio; a los demás se lo marca la animación
      if (s.attackEvery === undefined) cell(row, '—', 'l');
      else cell(row, this.field(() => s.attackEvery ?? 0, (v) => { s.attackEvery = Math.max(0.2, v); }, 0.5)).title = 'segundos entre ataques';
    }
    el.append(enemies, note('«sale» lo saca de todas las oleadas sin cambiar el resto. La vida y la velocidad se les pasan también a los que ya están en el campo.'));

    // ---- campo ----
    el.append(heading('Campo'));
    const courses = document.createElement('div');
    courses.className = 'row';
    for (let i = 0; i < COURSES.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = COURSES[i].name;
      b.classList.toggle('on', this.hooks.courseIndex() === i);
      b.addEventListener('click', () => { b.blur(); this.hooks.setCourse(i); });
      courses.append(b);
    }
    const anyCourse = document.createElement('button');
    anyCourse.type = 'button';
    anyCourse.textContent = 'Sortear';
    anyCourse.addEventListener('click', () => { anyCourse.blur(); this.hooks.setCourse(null); });
    courses.append(anyCourse);
    el.append(courses, note('Cambiar de campo reinicia la partida: el terreno se arma una sola vez, al cargar.'));

    // ---- cámara ----
    el.append(heading('Cámara'));
    const camLine = document.createElement('p');
    camLine.className = 'note';
    this.camLine = camLine;
    this.showCamera();
    el.append(camLine, note('Rueda del mouse: inclinación. Flechas arriba y abajo: altura, sin girarla. Los valores van en «copiar configuración».'));

    // ---- pruebas ----
    el.append(heading('Pruebas'));
    const toggles = document.createElement('div');
    toggles.className = 'row';
    toggles.append(
      this.toggleButton('Oleada infinita', () => this.hooks.director.endless, (v) => { this.hooks.director.endless = v; }),
      this.toggleButton('Vida infinita', () => this.hooks.flags.godPlayer, (v) => { this.hooks.flags.godPlayer = v; }),
      this.toggleButton('Puerta infinita', () => this.hooks.flags.godGate, (v) => { this.hooks.flags.godGate = v; }),
    );
    const waves = document.createElement('div');
    waves.className = 'row';
    for (let i = 0; i < WAVES.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `Oleada ${i + 1}`;
      b.title = WAVES[i].title;
      b.addEventListener('click', () => { b.blur(); this.hooks.goToWave(i); });
      waves.append(b);
    }
    el.append(toggles, waves, note('La oleada infinita repite la composición de la oleada en curso: no se termina nunca.'));

    // ---- copiar ----
    const copyRow = document.createElement('div');
    copyRow.className = 'row';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'wide';
    copy.textContent = 'Copiar configuración';
    const said = document.createElement('span');
    copy.addEventListener('click', async () => {
      copy.blur();
      const text = this.config();
      try {
        await navigator.clipboard.writeText(text);
        said.textContent = 'copiado';
        said.className = 'done';
      } catch {
        // sin permiso de portapapeles: queda en la consola para copiarlo de ahí
        console.log(text);
        said.textContent = 'está en la consola';
        said.className = 'note';
      }
      setTimeout(() => { said.textContent = ''; }, 2500);
    });
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Restaurar';
    reset.title = 'Borra lo guardado y vuelve a los valores del código';
    reset.addEventListener('click', () => {
      reset.blur();
      clearBalance();
      location.reload();
    });
    copyRow.append(copy, reset, said);
    el.append(copyRow, note('Pegámelo y lo incorporo al juego. Lo que toques se guarda en este navegador y vuelve al recargar; «Restaurar» lo borra.'));
  }

  private toggleButton(label: string, get: () => boolean, set: (v: boolean) => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.classList.toggle('on', get());
    b.addEventListener('click', () => {
      b.blur();
      set(!get());
      b.classList.toggle('on', get());
    });
    return b;
  }

  /** Todo el balance como texto, para pegarlo en el chat y llevarlo al código. */
  config(): string {
    const c = this.hooks.camera();
    const lines = [
      '// Golf Knight · balance',
      `campo: ${COURSES[this.hooks.courseIndex()].name}`,
      `camara: pitch ${c.pitch.toFixed(0)}, rise ${c.rise.toFixed(1)}, dist ${c.dist.toFixed(1)}`,
      `bandas: corta <= ${BAND_LIMITS[0]} m, media <= ${BAND_LIMITS[1]} m`,
      `carga: ${CLUBS.driver.chargeTime} s para los cuatro palos`,
      '',
      'palos (daño [corta, media, larga] x [golpe 1, 2, 3]):',
    ];
    for (const id of CLUB_ORDER) {
      const club = CLUBS[id];
      const area = club.areaDamage ? `, areaDamage ${JSON.stringify(club.areaDamage)}` : '';
      lines.push(`  ${id}: llega ${club.minRange}-${club.maxRange} m, radio ${club.spread}, damage ${JSON.stringify(club.damage)}${area}`);
    }
    lines.push('', 'poderes (recarga en segundos):');
    for (const id of ENCHANT_ORDER) lines.push(`  ${id}: ${ENCHANTS[id].cooldown}`);
    lines.push('', 'enemigos (vida, velocidad, daño):');
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const s = ENEMIES[kind];
      const off = this.hooks.disabled.has(kind) ? ', APAGADO' : '';
      const rate = s.attackEvery === undefined ? '' : `, ataca cada ${s.attackEvery} s`;
      lines.push(`  ${kind}: hp ${s.hp}, speed ${s.speed}, damage ${s.damage}${rate}${off}`);
    }
    return lines.join('\n');
  }
}
