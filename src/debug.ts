// Panel de balance y pruebas (tecla B). Toca los números del juego en vivo, en pestañas: los palos y
// las bandas, la carga, el tiro (correrse y efecto), las habilidades, las mejoras, los enemigos, el campo
// y la cámara, y las pruebas (oleada infinita, vida infinita, saltar a una oleada).
//
// Las habilidades y las mejoras se dan y se sacan desde su lista, subiendo o bajando el nivel. Los
// números de cada habilidad están en una ventanita propia, que se abre con su botón.
//
// Los cambios se aplican sobre los objetos del juego (CLUBS, ABILITIES, ENEMIES), así que valen desde el
// siguiente tiro y desde el siguiente enemigo que aparece; a los que ya están en el campo se les
// empareja la vida y la velocidad. El botón de copiar saca el texto con todo lo cambiado, para pasarlo
// e incorporarlo al juego.
import { ABILITIES, ABILITY_CONFIG, ABILITY_KEYS, ABILITY_LIST, configOf, cooldownAt, ELEMENTS, LEVELS, MAX_LEVEL, SLOTS, VULNERABLE, type AbilityId } from './core/abilities';
import { HEALS, PERK_LIST, PERK_NUMBERS, PERKS, type Card, type PerkId } from './core/cards';
import { BAND_LIMITS, BAND_NAMES, CLUB_ORDER, CLUBS, hasArea, IRON_MODES, ironMode, QUALITY_FROM, QUALITY_LEVELS, setIronMode, SHIFT, SHIFT_MODES, CURVE, CURVE_VARIANTS, CURVE_RESETS, type Club, type IronMode, type ShiftMode } from './core/clubs';
import { RISE_CURVE } from './core/swing';
import { COURSES } from './core/terrain';
import { ENEMIES, type EnemyKind, type WaveDirector, WAVES } from './core/waves';

export interface DebugFlags {
  /** El golfista no recibe daño. */
  godPlayer: boolean;
  /** La puerta no recibe daño. */
  godGate: boolean;
}

/**
 * Todas las tablas de números que el panel muestra y guarda, fuera de los palos y los enemigos: las de
 * cada habilidad, y las de las mejoras, los niveles y la curación.
 */
const CONFIGS: Record<string, Record<string, number | number[]>> = {
  ...ABILITY_CONFIG, niveles: LEVELS, vulnerable: VULNERABLE, mejoras: PERK_NUMBERS, curarse: HEALS,
};

export interface DebugHooks {
  /** Saca tres cartas ya, como al terminar una oleada. */
  offerChoice(): void;
  /** Toma una carta directo, sin sortear (las de curarse). */
  take(card: Card): void;
  /** Las habilidades en Q, W, E y R, con su nivel. */
  slots(): readonly { id: AbilityId; level: number }[];
  /** Pone una habilidad en un nivel: 0 la saca. Devuelve false si no quedaba lugar. */
  setAbilityLevel(id: AbilityId, level: number): boolean;
  /** Las mejoras tomadas, y cuántas veces. */
  perks(): Partial<Record<PerkId, number>>;
  /** Pone una mejora en tantas veces tomada: 0 la saca. */
  setPerkLevel(id: PerkId, level: number): void;
  /** Vuelve a pasar las mejoras a los números del juego: después de tocar uno de sus números. */
  refreshPerks(): void;
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
  /** La cámara en vivo: el panel la muestra, la copia y le cambia el encuadre automático. */
  camera(): { pitch: number; rise: number; dist: number; auto: boolean; margin: number };
}

/**
 * El balance ajustado se guarda en el navegador y vuelve al recargar. Hace falta porque cambiar de
 * campo recarga la página: sin esto, tocar diez números y probarlos en otro campo era imposible. El
 * botón «Restaurar» lo borra y devuelve los valores del código.
 */
const STORE_KEY = 'gk.balance';
/**
 * Sube cuando el juego **redefine** un valor que el panel guarda. Un guardado viejo lo trae con el
 * número de antes y pisa la decisión nueva sin que nadie se entere: pasó con el mínimo de distancia,
 * que ahora es 0 en los cuatro palos, y con la carga del putter, que se emparejó con la de los demás.
 * Al subir la versión esos vuelven al valor del código y el resto de lo tocado se conserva.
 *
 * Cada versión dice qué redefinió, y solo eso se descarta de un guardado anterior a ella: así lo que
 * se ajustó *después* de una redefinición no se pierde en la siguiente.
 */
const VERSION = 3;
const RESET_ON_UPGRADE: Record<number, readonly string[]> = {
  // el mínimo de distancia pasó a 0 y la carga del putter se emparejó con la de los demás
  2: ['minRange', 'chargeTime'],
  // la granada creció y se quedó con el silencio; el vendaval lo perdió
  3: ['grenade', 'wind'],
};
/** ¿Un guardado de la versión `from` trae un valor viejo de `key`, que el código redefinió después? */
function outdated(from: number, key: string): boolean {
  return Object.entries(RESET_ON_UPGRADE).some(([v, keys]) => from < Number(v) && keys.includes(key));
}

/** Lo que no vive en CLUBS ni en ENEMIES pero igual se guarda. */
export interface SavedExtras {
  camera?: { pitch: number; rise: number; auto?: boolean; margin?: number };
  disabled?: string[];
}

type Saved = SavedExtras & {
  version?: number;
  bands?: number[];
  clubs?: Record<string, Partial<Record<'minRange' | 'maxRange' | 'chargeTime' | 'fixedRange', number> & { spread: number[]; rollFriction: number[]; damage: number[][]; areaDamage: number[][] }>>;
  iron?: IronMode;
  /** Dónde empieza cada nivel de golpe, en potencia 0..1. */
  quality?: number[];
  /** Correrse cargando: el modo y sus números. */
  shift?: Partial<typeof SHIFT>;
  /** El efecto: cómo crece, cuándo vuelve a cero y sus números. */
  curve?: Partial<typeof CURVE>;
  /** Recarga y alcance de cada habilidad, y los números propios de cada una. */
  abilities?: Record<string, { cooldown: number; range: number }>;
  /** Los números de las habilidades y las mejoras, tabla por tabla (ver CONFIGS). */
  configs?: Record<string, Record<string, number | number[]>>;
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
  const version = saved.version ?? 1;
  for (const id of CLUB_ORDER) {
    const from = saved.clubs?.[id];
    if (!from) continue;
    const club = CLUBS[id];
    for (const k of ['minRange', 'maxRange', 'chargeTime', 'fixedRange'] as const) {
      if (outdated(version, k)) continue;
      if (typeof from[k] === 'number') club[k] = from[k];
    }
    if (from.spread?.length === club.spread.length) club.spread = from.spread;
    if (from.rollFriction?.length && club.rollFriction) club.rollFriction = from.rollFriction;
    if (from.damage) club.damage = from.damage;
    if (from.areaDamage && club.areaDamage) club.areaDamage = from.areaDamage;
  }
  if (saved.iron && IRON_MODES[saved.iron]) setIronMode(saved.iron);
  if (saved.quality?.length === QUALITY_FROM.length) QUALITY_FROM.splice(0, QUALITY_FROM.length, ...saved.quality);
  if (saved.shift) {
    if (saved.shift.mode && SHIFT_MODES.includes(saved.shift.mode)) SHIFT.mode = saved.shift.mode;
    for (const k of ['reach', 'step', 'speed'] as const) if (typeof saved.shift[k] === 'number') SHIFT[k] = saved.shift[k];
  }
  if (saved.curve) {
    if (saved.curve.variant && CURVE_VARIANTS.includes(saved.curve.variant)) CURVE.variant = saved.curve.variant;
    if (saved.curve.reset && CURVE_RESETS.includes(saved.curve.reset)) CURVE.reset = saved.curve.reset;
    for (const k of ['max', 'step', 'rate'] as const) if (typeof saved.curve[k] === 'number') CURVE[k] = saved.curve[k];
  }
  for (const id of ABILITY_LIST) {
    const from = saved.abilities?.[id];
    if (typeof from?.cooldown === 'number') ABILITIES[id].cooldown = from.cooldown;
    if (typeof from?.range === 'number') ABILITIES[id].range = from.range;
  }
  // solo los números que el código todavía tiene, y con la misma forma: un guardado viejo no mete
  // claves que ya no existen, ni un número suelto donde ahora hay una tabla por nivel
  for (const [name, into] of Object.entries(CONFIGS)) {
    const from = saved.configs?.[name];
    if (!from || outdated(version, name)) continue;
    for (const k of Object.keys(into)) {
      const v = from[k];
      if (Array.isArray(into[k]) && Array.isArray(v) && v.length === (into[k] as number[]).length) into[k] = [...v];
      else if (typeof into[k] === 'number' && typeof v === 'number') into[k] = v;
    }
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
  const out: Saved = { version: VERSION, bands: [...BAND_LIMITS], clubs: {}, abilities: {}, enemies: {}, configs: {}, ...extras };
  for (const id of CLUB_ORDER) {
    const c = CLUBS[id];
    out.clubs![id] = {
      minRange: c.minRange, maxRange: c.maxRange, spread: c.spread, chargeTime: c.chargeTime,
      fixedRange: c.fixedRange, damage: c.damage,
      ...(c.rollFriction ? { rollFriction: c.rollFriction } : {}),
      ...(c.areaDamage ? { areaDamage: c.areaDamage } : {}),
    };
    out.iron = ironMode();
  }
  out.quality = [...QUALITY_FROM];
  out.shift = { ...SHIFT };
  out.curve = { ...CURVE };
  for (const id of ABILITY_LIST) out.abilities![id] = { cooldown: ABILITIES[id].cooldown, range: ABILITIES[id].range };
  for (const [name, table] of Object.entries(CONFIGS)) out.configs![name] = JSON.parse(JSON.stringify(table));
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

/**
 * En qué segundo de la carga empieza un nivel de golpe. La barra sube como `(t / lleno) ^ RISE_CURVE`,
 * así que el umbral, que está en potencia, se pasa a tiempo con la raíz: de ahí sale que los niveles de
 * arriba duren mucho menos, aunque los porcentajes estén repartidos parejo.
 */
function levelStart(chargeTime: number, level: number): number {
  return chargeTime * Math.pow(QUALITY_FROM[level], 1 / RISE_CURVE);
}

/** Cuánto dura cada nivel de golpe con este palo, en segundos. */
function levelDurations(club: Club): number[] {
  return Array.from({ length: QUALITY_LEVELS }, (_, q) => {
    const to = q + 1 < QUALITY_LEVELS ? levelStart(club.chargeTime, q + 1) : club.chargeTime;
    return to - levelStart(club.chargeTime, q);
  });
}

function note(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  return p;
}

/** Cómo se llama cada número de las tablas de habilidades, en el panel. Si falta, se muestra la clave. */
const LABELS: Record<string, string> = {
  radius: 'radio m', duration: 'dura s', linger: 'el frío sigue s', slow: 'velocidad adentro ×',
  halfWidth: 'ancho a cada lado m', push: 'los corre hasta m', core: 'centro quieto (fracción)', silence: 'silencio s',
  damage: 'daño', speed: 'velocidad m/s', width: 'ancho m', swallows: 'se traga', life: 'dura s',
  seconds: 'dura s', blast: 'radio de la explosión m', reach: 'alcance m', hitRadius: 'radio del golpe m',
  scale: 'crecen ×', shots: 'tiros repetidos',
  iceSeconds: 'frío s', freezeSeconds: 'congelado s (maestría)', burnSeconds: 'fuego s', burnTick: 'pierde cada s',
  burnDamage: 'daño por vez', spreadRadius: 'contagio m (maestría)', chainJumps: 'saltos',
  chainRange: 'salta hasta m', chainDamage: 'daño por salto',
  cooldownGrowth: 'recarga de más por nivel', bonus: 'daño de más al vulnerable',
  gate: 'la puerta +', player: 'vos +',
};

/** Los números de cada mejora: de qué tabla y con qué nombre. */
const PERK_FIELDS: Partial<Record<PerkId, [Record<string, number | number[]>, string, string][]>> = {
  quickWrist: [[PERK_NUMBERS, 'quickWrist', 'el tramo de abajo tarda ×']],
  sweetSpot: [[PERK_NUMBERS, 'sweetSpot', 'perfecto más ancho ×']],
  rhythm: [[PERK_NUMBERS, 'rhythmStep', 'más rápido por tiro'], [PERK_NUMBERS, 'rhythmMax', 'hasta tiros']],
  masonStreak: [[PERK_NUMBERS, 'masonStreak', 'tiros seguidos']],
  giftPerfect: [[PERK_NUMBERS, 'giftPerfect', 'cada bajas']],
  quiver: [[PERK_NUMBERS, 'quiverCooldown', 'una cada s']],
  secondWind: [[PERK_NUMBERS, 'secondWindCooldown', 'recarga s']],
  masteryIce: [[ELEMENTS, 'freezeSeconds', 'congelado s']],
  masteryFire: [[ELEMENTS, 'spreadRadius', 'contagio m']],
};

const TABS = ['Palos', 'Carga', 'Tiro', 'Habilidades', 'Mejoras', 'Enemigos', 'Campo', 'Pruebas'] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY = 'gk.balanceTab';

export class DebugPanel {
  private readonly el = $('balance');
  private readonly btn = $<HTMLButtonElement>('balancebtn');
  private readonly fields: HTMLInputElement[] = [];
  /** Lo que se repinta al abrir el panel, además de los campos: las teclas de cada habilidad. */
  private readonly onOpen: (() => void)[] = [];
  private camLine: HTMLElement | null = null;
  /** Las casillas que muestran cuánto dura cada nivel del golpe: no se escriben, se calculan. */
  private readonly chargeCells: { td: HTMLTableCellElement; club: Club; level: number }[] = [];
  private readonly pages = new Map<Tab, HTMLElement>();
  private readonly tabButtons = new Map<Tab, HTMLButtonElement>();
  private modal: HTMLElement | null = null;

  /**
   * Lo que el panel no lee de un campo sino que calcula: la cámara (se mueve con la rueda con el panel
   * abierto) y los segundos de cada nivel del golpe (salen de la barra llena y de los umbrales).
   */
  tick(): void {
    if (!this.open) return;
    if (this.camLine) {
      const c = this.hooks.camera();
      this.camLine.textContent = `inclinación ${c.pitch.toFixed(0)}° · altura ${c.rise >= 0 ? '+' : ''}${c.rise.toFixed(1)} m · distancia ${c.dist.toFixed(1)} m`;
    }
    for (const { td, club, level } of this.chargeCells) {
      const from = levelStart(club.chargeTime, level);
      const to = level + 1 < QUALITY_LEVELS ? levelStart(club.chargeTime, level + 1) : club.chargeTime;
      td.textContent = `${(to - from).toFixed(2)} s`;
      td.title = `de ${from.toFixed(2)} s a ${to.toFixed(2)} s desde que apretás`;
    }
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
    if (!this.open) this.closeModal();
    // los números se releen al abrir: pudieron cambiar desde la consola, desde una carta o desde otro botón
    if (this.open) this.refresh();
  }

  private refresh(): void {
    for (const f of this.fields) f.dispatchEvent(new Event('refresh'));
    for (const paint of this.onOpen) paint();
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

  /** Un campo que guarda pero no queda registrado: los de la ventanita, que se arma de nuevo cada vez. */
  private loose(get: () => number, set: (v: number) => void, step = 1): HTMLInputElement {
    return numberField(get, (v) => { set(v); this.save(); }, step);
  }

  /** Guarda el balance tocado, con lo que vive fuera de CLUBS y ENEMIES. */
  save(): void {
    const c = this.hooks.camera();
    saveBalance({ camera: { pitch: c.pitch, rise: c.rise, auto: c.auto, margin: c.margin }, disabled: [...this.hooks.disabled] });
  }

  private button(label: string, onClick: (b: HTMLButtonElement) => void, title = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('click', () => { b.blur(); onClick(b); });
    return b;
  }

  private row(...children: HTMLElement[]): HTMLElement {
    const r = document.createElement('div');
    r.className = 'row';
    r.append(...children);
    return r;
  }

  /** Una fila de botones de los que se prende uno solo. `after` corre después de cada cambio. */
  private choiceRow<T extends string>(label: string, options: readonly T[], get: () => T, set: (v: T) => void, titles: Record<T, string>, after?: () => void): HTMLElement {
    const r = this.row();
    if (label) {
      const tag = document.createElement('span');
      tag.className = 'note';
      tag.textContent = label;
      tag.style.alignSelf = 'center';
      tag.style.minWidth = '92px';
      r.append(tag);
    }
    const buttons = options.map((o) => this.button(o, () => {
      set(o);
      for (const other of buttons) other.classList.toggle('on', other.textContent === get());
      this.save();
      after?.();
    }, titles[o]));
    for (const b of buttons) b.classList.toggle('on', b.textContent === get());
    r.append(...buttons);
    return r;
  }

  /** Una tabla chica de números sueltos: etiqueta, casilla y unidad. */
  private numbers(rows: [string, () => number, (v: number) => void, number, string][]): { table: HTMLTableElement; rows: HTMLTableRowElement[] } {
    const table = document.createElement('table');
    const out: HTMLTableRowElement[] = [];
    for (const [label, get, set, step, unit] of rows) {
      const r = table.insertRow();
      cell(r, label, 'l');
      cell(r, this.field(get, set, step));
      cell(r, unit, 'l');
      out.push(r);
    }
    return { table, rows: out };
  }

  private build(): void {
    const el = this.el;
    el.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = 'Balance';
    const bar = document.createElement('div');
    bar.className = 'tabs';
    el.append(title, note('Los cambios entran en el próximo tiro. B cierra el panel.'), bar);
    for (const tab of TABS) {
      const page = document.createElement('div');
      page.className = 'page';
      this.pages.set(tab, page);
      const b = this.button(tab, () => this.show(tab));
      this.tabButtons.set(tab, b);
      bar.append(b);
      el.append(page);
    }
    this.buildClubs(this.pages.get('Palos')!);
    this.buildCharge(this.pages.get('Carga')!);
    this.buildShot(this.pages.get('Tiro')!);
    this.buildAbilities(this.pages.get('Habilidades')!);
    this.buildPerks(this.pages.get('Mejoras')!);
    this.buildEnemies(this.pages.get('Enemigos')!);
    this.buildCourse(this.pages.get('Campo')!);
    this.buildTests(this.pages.get('Pruebas')!);
    this.buildFooter(el);
    let first: Tab = 'Palos';
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.includes(saved)) first = saved;
    } catch { /* sin localStorage arranca en la primera */ }
    this.show(first);
  }

  private show(tab: Tab): void {
    for (const [t, page] of this.pages) page.hidden = t !== tab;
    for (const [t, b] of this.tabButtons) b.classList.toggle('on', t === tab);
    this.el.scrollTop = 0;
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch { /* no hace falta recordarla */ }
  }

  // ---- palos: daño por banda de distancia y nivel de golpe, y las bandas ----
  private buildClubs(el: HTMLElement): void {
    el.append(heading('Daño por distancia'));
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
      // la rapidez del rodado, una por nivel de golpe: cuanto mejor el golpe, más rápido va
      if (club.rollFriction) {
        const speedRow = table.insertRow();
        cell(speedRow, 'rapidez', 'l').title = 'cuánto sale de fuerte la pelota rodada, por nivel de golpe; más alto = llega antes';
        for (let q = 1; q <= QUALITY_LEVELS; q++) {
          cell(speedRow, this.field(() => club.rollFriction![q - 1], (v) => { club.rollFriction![q - 1] = Math.max(1, v); }, 5));
        }
      }
      // el radio del área, uno por nivel de golpe
      if (hasArea(club)) {
        const areaRow = table.insertRow();
        cell(areaRow, 'área (radio m)', 'l').title = 'radio del área que abre, por nivel de golpe';
        for (let q = 1; q <= QUALITY_LEVELS; q++) {
          cell(areaRow, this.field(() => club.spread[q - 1], (v) => { club.spread[q - 1] = Math.max(0, v); }, 0.2));
        }
      }
      // el tope de este palo: más cerca o más lejos que esto, el cursor no lo estira
      const rangeRow = table.insertRow();
      cell(rangeRow, 'no llega más...', 'l').title = 'los dos topes de este palo, en metros: apuntes donde apuntes, el tiro cae entre estos dos números';
      cell(rangeRow, this.field(() => club.minRange, (v) => { club.minRange = v; }));
      cell(rangeRow, this.field(() => club.maxRange, (v) => { club.maxRange = v; }));
      cell(rangeRow, '');
      const legend = table.insertRow();
      cell(legend, '', 'l');
      cell(legend, '...acá');
      cell(legend, '...allá');
      cell(legend, '');
      el.append(table);
      // distancia fija: el mouse decide solo la dirección
      const fixed = document.createElement('button');
      fixed.type = 'button';
      fixed.title = 'El mouse decide solo la dirección: el tiro siempre llega igual de lejos';
      const box = numberField(() => club.fixedRange || club.maxRange, (v) => { club.fixedRange = Math.max(1, v); paintFixed(); this.save(); }, 1);
      const paintFixed = () => {
        const on = club.fixedRange > 0;
        fixed.textContent = on ? `distancia fija: ${club.fixedRange} m` : 'distancia por el cursor';
        fixed.classList.toggle('on', on);
        box.style.display = on ? '' : 'none';
      };
      fixed.addEventListener('click', () => {
        fixed.blur();
        club.fixedRange = club.fixedRange > 0 ? 0 : Math.round(club.maxRange * 0.75);
        box.value = String(club.fixedRange || club.maxRange);
        paintFixed();
        this.save();
      });
      paintFixed();
      this.track(box, () => club.fixedRange || club.maxRange);
      box.style.width = '70px';
      el.append(this.row(fixed, box));
      // el hierro tiene dos formas de entregar: se prueban acá
      if (club.id === 'iron') {
        el.append(this.choiceRow('', Object.keys(IRON_MODES) as IronMode[], ironMode, setIronMode, {
          revienta: 'No atraviesa: explota en el piso, abajo del primero que toca. Si cae al piso sin tocar a nadie, no hace nada',
          atraviesa: 'Atraviesa hasta a tres y además abre su área donde cae, le pegue a alguien o no',
        } as Record<IronMode, string>));
      }
    }
    el.append(note(
      '«No llega más acá / más allá» son los dos topes de ese palo, en metros. Apuntes donde apuntes, el tiro cae entre esos dos números: '
      + 'con el driver, apuntando encima tuyo sale igual a 4 m, y apuntando a 80 m cae a 66. Es de ese palo solo, y no dice nada del daño. '
      + '(Con «distancia fija» prendida el cursor ni siquiera elige: el tiro va siempre a esos metros, recortados a estos dos topes.) '
      + 'Las bandas de acá abajo son otra cosa: dicen **cuánto pega** según a qué distancia pegó, y son iguales para los cuatro palos. '
      + 'Por eso el putter, que no llega más allá de 20 m, nunca cobra con su columna «larga»: no hay forma de que su pelota llegue hasta ahí. '
      + 'El hierro tiene dos bloques porque hace las dos cosas: «al pegar» es cuando la pelota le da a alguien y «en área» lo que reparte donde cae. '
      + 'El wedge y el putter solo hacen área, así que su tabla ya es la del área.',
    ));

    el.append(heading('Bandas de distancia (iguales para todos los palos)'));
    const bands = document.createElement('table');
    const bandRow = bands.insertRow();
    cell(bandRow, 'corta hasta', 'l');
    cell(bandRow, this.field(() => BAND_LIMITS[0], (v) => { BAND_LIMITS[0] = v; }));
    cell(bandRow, 'media hasta', 'l');
    cell(bandRow, this.field(() => BAND_LIMITS[1], (v) => { BAND_LIMITS[1] = v; }));
    el.append(bands, note('Los metros se cuentan desde la línea de los puestos, la que dice 0 en el campo.'));
  }

  // ---- carga: cuánto dura cada nivel del golpe ----
  private buildCharge(el: HTMLElement): void {
    el.append(heading('Cuánto dura cada nivel del golpe'));
    const charge = document.createElement('table');
    const chargeHead = charge.insertRow();
    for (const h of ['', 'barra llena', 'golpe 1', 'golpe 2', 'golpe 3']) {
      const th = document.createElement('th');
      th.textContent = h;
      if (!h) th.className = 'l';
      chargeHead.appendChild(th);
    }
    for (const id of CLUB_ORDER) {
      const club = CLUBS[id];
      const row = charge.insertRow();
      cell(row, club.name, 'l');
      cell(row, this.field(() => club.chargeTime, (v) => { club.chargeTime = Math.max(0.1, v); }, 0.05)).title = 'segundos que tarda la barra en llegar arriba del todo';
      // cuánto dura cada nivel, en segundos: sale de la barra llena y de los umbrales de abajo
      for (let q = 0; q < QUALITY_LEVELS; q++) this.chargeCells.push({ td: cell(row, '', 'l'), club, level: q });
    }
    el.append(charge);
    const thresholds = document.createElement('table');
    for (let q = 1; q < QUALITY_LEVELS; q++) {
      const row = thresholds.insertRow();
      cell(row, `el golpe ${q + 1} empieza a`, 'l');
      cell(row, this.field(() => Math.round(QUALITY_FROM[q] * 100), (v) => {
        QUALITY_FROM[q] = Math.min(1, Math.max(0.01, v / 100));
      }, 1));
      cell(row, '% de la barra', 'l');
    }
    el.append(thresholds, note(
      'La barra no sube pareja: arranca lenta y termina rápida, así que el golpe 1 dura mucho más que el 3 aunque los umbrales estén parejos. '
      + 'Los segundos de la tabla ya tienen eso adentro: son lo que dura cada nivel de verdad, sin mejoras. '
      + 'Y al llegar arriba la barra rebota y baja hasta abajo, así que el golpe 3 vuelve a pasar en cada rebote, igual de corto. '
      + 'Subir el «barra llena» de un palo estira los tres niveles a la vez; los porcentajes reparten la barra entre ellos y valen para los cuatro palos. '
      + 'La muñeca rápida y el ritmo apuran solo lo de abajo, hasta el golpe 3: la ventana del perfecto dura lo mismo.',
    ));
  }

  // ---- el tiro: correrse cargando o darle efecto ----
  private buildShot(el: HTMLElement): void {
    el.append(heading('A y D mientras cargás'));
    const shift = this.numbers([
      ['alcance', () => SHIFT.reach, (v) => { SHIFT.reach = Math.max(0, v); }, 0.1, 'm para cada lado'],
      ['paso', () => SHIFT.step, (v) => { SHIFT.step = Math.max(0.05, v); }, 0.1, 'm por toque'],
      ['velocidad', () => SHIFT.speed, (v) => { SHIFT.speed = Math.max(0.1, v); }, 0.5, 'm/s'],
    ]);
    const shiftBox = document.createElement('div');
    shiftBox.append(shift.table, note('Mientras cargás, A y D te corren con la pelota sin cambiar de puesto, para alinearte con una fila. Los puestos están a 4 m: un alcance de 1.2 es un 30 %.'));
    const curve = this.numbers([
      ['curva máx.', () => CURVE.max, (v) => { CURVE.max = Math.max(0, v); }, 0.5, 'm de desvío para cada lado'],
      ['escalón', () => CURVE.step, (v) => { CURVE.step = Math.max(0.1, v); }, 0.5, 'm por toque'],
      ['crece a', () => CURVE.rate, (v) => { CURVE.rate = Math.max(0.1, v); }, 1, 'm/s'],
    ]);
    const curveBox = document.createElement('div');
    const offNote = note('Como antes: cargando, A y D quedan anotadas para después del tiro.');
    // cada modo muestra solo lo suyo: los números de efecto no tienen nada que ver con correrse
    const paint = () => {
      const moving = SHIFT.mode === 'pasos' || SHIFT.mode === 'continuo';
      shiftBox.hidden = !moving;
      shift.rows[1].hidden = SHIFT.mode !== 'pasos';
      shift.rows[2].hidden = SHIFT.mode !== 'continuo';
      curveBox.hidden = SHIFT.mode !== 'efecto';
      curve.rows[1].hidden = CURVE.variant !== 'discreto';
      curve.rows[2].hidden = CURVE.variant !== 'continuo';
      offNote.hidden = SHIFT.mode !== 'apagado';
    };
    curveBox.append(
      this.choiceRow('la curva', CURVE_VARIANTS, () => CURVE.variant, (v) => { CURVE.variant = v; }, {
        continuo: 'Mientras mantenés A o D la curva va creciendo',
        discreto: 'Cada toque de A o D suma un escalón de curva',
      }, paint),
      this.choiceRow('vuelve a cero', CURVE_RESETS, () => CURVE.reset, (v) => { CURVE.reset = v; }, {
        disparar: 'La curva se mantiene hasta que sale el tiro',
        soltar: 'La curva vuelve a cero apenas soltás las dos teclas (con discreto: tocá y mantené)',
      }),
      curve.table,
      note('Solo driver y putter. El desvío se mide al final del tiro: con 6 m, el driver termina 6 m corrido de donde apuntaste. La línea de tiro muestra la curva mientras cargás.'),
    );
    el.append(
      this.choiceRow('', SHIFT_MODES, () => SHIFT.mode, (v) => { SHIFT.mode = v as ShiftMode; }, {
        apagado: 'Como antes: cargando, A y D quedan anotadas para después del tiro',
        pasos: 'Cada toque de A o D te corre un paso con la pelota',
        continuo: 'Mantener A o D te corre con la pelota, y podés tirar desde cualquier punto',
        efecto: 'No te corrés: A y D le dan efecto a la pelota y el tiro se curva. Solo driver y putter',
      } as Record<ShiftMode, string>, paint),
      offNote, shiftBox, curveBox,
    );
    paint();
  }

  // ---- habilidades: cuáles tiene, en qué nivel, y sus números en una ventanita ----
  private buildAbilities(el: HTMLElement): void {
    el.append(this.row(this.button('Sacar tres cartas ahora', () => { this.toggle(); this.hooks.offerChoice(); })));
    (el.lastElementChild!.firstElementChild as HTMLElement).className = 'wide';
    const status = note('');
    status.className = 'note warn';
    el.append(heading(`Las que tiene (hasta ${SLOTS}: ${ABILITY_KEYS.join(', ')})`), status);
    const paints: (() => void)[] = [];
    const paintAll = () => { for (const p of paints) p(); };
    const list = (ids: AbilityId[], label: string) => {
      const t = document.createElement('table');
      t.className = 'list';
      const head = t.insertRow();
      for (const h of [label, 'tecla', 'nivel', '']) {
        const th = document.createElement('th');
        th.textContent = h;
        if (h === label) th.className = 'l';
        head.appendChild(th);
      }
      for (const id of ids) {
        const a = ABILITIES[id];
        const r = t.insertRow();
        const name = cell(r, a.name, 'l');
        name.style.color = '#' + a.color.toString(16).padStart(6, '0');
        name.title = a.hint;
        const key = cell(r, '');
        const level = this.levelField(id, status, paintAll);
        cell(r, level).className = 'lv';
        cell(r, this.button('números', () => this.openAbility(id, paintAll), 'Recarga, alcance y sus números propios'));
        paints.push(() => {
          const i = this.hooks.slots().findIndex((s) => s.id === id);
          key.textContent = i >= 0 ? ABILITY_KEYS[i] : '';
          r.classList.toggle('have', i >= 0);
          level.value = String(this.levelOf(id));
        });
      }
      el.append(t);
    };
    list(ABILITY_LIST.filter((id) => !ABILITIES[id].club), 'propias');
    list(ABILITY_LIST.filter((id) => ABILITIES[id].club), 'palo y elemento');
    this.onOpen.push(() => { status.textContent = ''; paintAll(); });
    paintAll();

    el.append(heading('Para todas'));
    el.append(this.numbers([
      [LABELS.cooldownGrowth, () => LEVELS.cooldownGrowth, (v) => { LEVELS.cooldownGrowth = Math.max(0, v); }, 0.05, 'de la base (0.3 = +30 %)'],
      [LABELS.bonus, () => VULNERABLE.bonus, (v) => { VULNERABLE.bonus = Math.max(0, v); }, 1, 'a los silenciados y agrandados'],
    ]).table, note(
      'Subí el nivel para darle una habilidad y bajalo a 0 para sacársela. Cada habilidad tira su propia pelota: no gasta la del puesto. '
      + '«números» abre su recarga, su alcance y lo que hace en cada nivel.',
    ));
  }

  private levelOf(id: AbilityId): number {
    return this.hooks.slots().find((s) => s.id === id)?.level ?? 0;
  }

  /** La casilla del nivel de una habilidad: subirla la da, bajarla a 0 la saca. */
  private levelField(id: AbilityId, status: HTMLElement, after: () => void): HTMLInputElement {
    const f = numberField(() => this.levelOf(id), (v) => {
      const to = Math.max(0, Math.min(MAX_LEVEL, Math.round(v)));
      if (!this.hooks.setAbilityLevel(id, to)) {
        status.textContent = `No hay más lugares: ya tiene ${SLOTS}. Bajá otra a 0 para darle ${ABILITIES[id].name}.`;
      } else {
        status.textContent = '';
      }
      after();
    }, 1);
    f.min = '0';
    f.max = String(MAX_LEVEL);
    return f;
  }

  /** La ventanita con los números de una habilidad. */
  private openAbility(id: AbilityId, after: () => void): void {
    this.closeModal();
    const a = ABILITIES[id];
    const color = '#' + a.color.toString(16).padStart(6, '0');
    const back = document.createElement('div');
    back.className = 'balmodal';
    back.addEventListener('mousedown', (e) => { if (e.target === back) this.closeModal(); });
    const box = document.createElement('div');
    box.className = 'box';
    box.style.borderColor = color;
    back.append(box);
    const title = document.createElement('h3');
    title.textContent = a.name;
    title.style.color = color;
    box.append(title, note(a.hint));

    const status = note('');
    status.className = 'note warn';
    const top = document.createElement('table');
    const lvRow = top.insertRow();
    cell(lvRow, 'nivel que tiene', 'l');
    cell(lvRow, this.levelField(id, status, after));
    cell(lvRow, '0 = no la tiene', 'l');
    const perLevel = document.createElement('span');
    const paintCooldown = () => {
      perLevel.textContent = [1, 2, 3].map((l) => `${+cooldownAt(a, l).toFixed(1)}`).join(' / ') + ' s';
    };
    const cdRow = top.insertRow();
    cell(cdRow, 'recarga (nivel 1)', 'l');
    cell(cdRow, this.loose(() => a.cooldown, (v) => { a.cooldown = Math.max(0, v); paintCooldown(); }, 0.5));
    cell(cdRow, 's', 'l');
    const cdLevels = top.insertRow();
    cell(cdLevels, 'recarga por nivel', 'l');
    cell(cdLevels, perLevel, 'l').colSpan = 2;
    paintCooldown();
    if (a.range > 0) {
      const rRow = top.insertRow();
      cell(rRow, 'alcance', 'l');
      cell(rRow, this.loose(() => a.range, (v) => { a.range = Math.max(1, v); }, 1));
      cell(rRow, 'm', 'l');
    }
    box.append(status, top);

    const config = configOf(id);
    if (config) {
      const t = document.createElement('table');
      const head = t.insertRow();
      for (const h of ['', 'nv 1', 'nv 2', 'nv 3']) {
        const th = document.createElement('th');
        th.textContent = h;
        if (!h) th.className = 'l';
        head.appendChild(th);
      }
      const { table } = config;
      for (const key of config.keys) {
        const r = t.insertRow();
        cell(r, LABELS[key] ?? key, 'l').title = key;
        const value = table[key];
        if (Array.isArray(value)) {
          for (let q = 0; q < value.length; q++) cell(r, this.loose(() => (table[key] as number[])[q], (v) => { (table[key] as number[])[q] = v; }, 0.25));
        } else {
          const td = cell(r, this.loose(() => table[key] as number, (v) => { table[key] = v; }, 0.05));
          td.title = 'igual en los tres niveles';
          cell(r, '');
          cell(r, '');
        }
      }
      box.append(heading('Lo que hace'), t);
      if (config.shared) box.append(note(`Estos números son del ${a.element === 'ice' ? 'hielo' : a.element === 'fire' ? 'fuego' : 'rayo'}: valen para los cuatro palos con ese elemento.`));
    } else {
      box.append(note('No tiene números propios.'));
    }
    box.append(this.row(this.button('Cerrar', () => this.closeModal())));
    (box.lastElementChild!.firstElementChild as HTMLElement).className = 'wide';
    document.body.append(back);
    this.modal = back;
  }

  private closeModal(): void {
    this.modal?.remove();
    this.modal = null;
  }

  // ---- mejoras: cuáles tiene y sus números, y curarse ----
  private buildPerks(el: HTMLElement): void {
    el.append(heading('Las que tiene'));
    const t = document.createElement('table');
    t.className = 'list';
    const head = t.insertRow();
    for (const h of ['', 'veces', 'sus números']) {
      const th = document.createElement('th');
      th.textContent = h;
      if (h !== 'veces') th.className = 'l';
      head.appendChild(th);
    }
    for (const id of PERK_LIST) {
      const p = PERKS[id];
      const r = t.insertRow();
      const name = cell(r, p.name, 'l');
      name.style.color = '#' + p.color.toString(16).padStart(6, '0');
      name.title = p.hint + (p.needs ? ' (en las cartas, solo sale con dos habilidades de ese elemento)' : '');
      const n = this.field(() => this.hooks.perks()[id] ?? 0, (v) => {
        this.hooks.setPerkLevel(id, Math.max(0, Math.min(p.max, Math.round(v))));
        r.classList.toggle('have', (this.hooks.perks()[id] ?? 0) > 0);
      }, 1);
      n.min = '0';
      n.max = String(p.max);
      n.title = `hasta ${p.max}`;
      cell(r, n).className = 'lv';
      const kv = document.createElement('div');
      kv.className = 'kv';
      for (const [table, key, label] of PERK_FIELDS[id] ?? []) {
        const tag = document.createElement('span');
        tag.textContent = label;
        kv.append(tag, this.field(() => table[key] as number, (v) => { table[key] = v; this.hooks.refreshPerks(); }, 0.05));
      }
      cell(r, kv, 'l');
      this.onOpen.push(() => r.classList.toggle('have', (this.hooks.perks()[id] ?? 0) > 0));
    }
    el.append(t, note('Las maestrías acá se pueden dar aunque no tenga dos habilidades del elemento. Pasá el mouse por el nombre para ver qué hace.'));

    el.append(heading('Curarse'));
    const heals = this.numbers([
      ['Albañiles: la puerta +', () => HEALS.gate, (v) => { HEALS.gate = Math.max(0, Math.round(v)); }, 1, ''],
      ['Respiro: vos +', () => HEALS.player, (v) => { HEALS.player = Math.max(0, Math.round(v)); }, 1, ''],
    ]);
    cell(heals.rows[0], this.button('curar ya', () => this.hooks.take({ kind: 'heal', id: 'gate' })));
    cell(heals.rows[1], this.button('curar ya', () => this.hooks.take({ kind: 'heal', id: 'player' })));
    el.append(heals.table, note('Entre oleadas ya no se cura solo: curarse es una de las cartas. Sale sí o sí si la puerta está a la mitad o te queda una vida.'));
  }

  // ---- enemigos ----
  private buildEnemies(el: HTMLElement): void {
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
      const on = this.button('', () => {
        if (this.hooks.disabled.has(kind)) this.hooks.disabled.delete(kind);
        else this.hooks.disabled.add(kind);
        paint();
        this.save();
      });
      const paint = () => {
        const alive = !this.hooks.disabled.has(kind);
        on.textContent = alive ? 'sí' : 'no';
        on.classList.toggle('on', alive);
      };
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
  }

  // ---- campo y cámara ----
  private buildCourse(el: HTMLElement): void {
    el.append(heading('Campo'));
    const courses = this.row();
    for (let i = 0; i < COURSES.length; i++) {
      const b = this.button(COURSES[i].name, () => this.hooks.setCourse(i));
      b.classList.toggle('on', this.hooks.courseIndex() === i);
      courses.append(b);
    }
    courses.append(this.button('Sortear', () => this.hooks.setCourse(null)));
    el.append(courses, note('Cambiar de campo reinicia la partida: el terreno se arma una sola vez, al cargar.'));

    el.append(heading('Cámara'));
    const camLine = document.createElement('p');
    camLine.className = 'note';
    this.camLine = camLine;
    const c = this.hooks.camera();
    const margin = this.numbers([['puestos sobre las barras', () => c.margin, (v) => { c.margin = Math.max(0, v); }, 4, 'px']]);
    el.append(camLine, this.row(this.toggleButton('Encuadre automático', () => c.auto, (v) => { c.auto = v; this.save(); })), margin.table, note(
      'Rueda del mouse: inclinación. Flechas arriba y abajo: altura, sin girarla. '
      + 'Con el encuadre automático la cámara se aleja o se acerca sola para que la línea de los puestos quede siempre justo arriba de las barras de abajo: '
      + 'al levantarla o inclinarla se retrasa lo que haga falta. Los valores van en «copiar configuración».',
    ));
  }

  // ---- pruebas ----
  private buildTests(el: HTMLElement): void {
    el.append(heading('Pruebas'));
    const toggles = this.row(
      this.toggleButton('Oleada infinita', () => this.hooks.director.endless, (v) => { this.hooks.director.endless = v; }),
      this.toggleButton('Vida infinita', () => this.hooks.flags.godPlayer, (v) => { this.hooks.flags.godPlayer = v; }),
      this.toggleButton('Puerta infinita', () => this.hooks.flags.godGate, (v) => { this.hooks.flags.godGate = v; }),
    );
    const waves = this.row();
    for (let i = 0; i < WAVES.length; i++) waves.append(this.button(`Oleada ${i + 1}`, () => this.hooks.goToWave(i), WAVES[i].title));
    el.append(toggles, waves, note('La oleada infinita repite la composición de la oleada en curso: no se termina nunca.'));
  }

  // ---- copiar y restaurar: fuera de las pestañas, siempre a mano ----
  private buildFooter(el: HTMLElement): void {
    const said = document.createElement('span');
    const copy = this.button('Copiar configuración', async () => {
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
    copy.className = 'wide';
    const reset = this.button('Restaurar', () => {
      clearBalance();
      location.reload();
    }, 'Borra lo guardado y vuelve a los valores del código');
    const foot = document.createElement('div');
    foot.className = 'foot';
    foot.append(this.row(copy, reset, said), note('Pegámelo y lo incorporo al juego. Lo que toques se guarda en este navegador y vuelve al recargar; «Restaurar» lo borra.'));
    el.append(foot);
  }

  private toggleButton(label: string, get: () => boolean, set: (v: boolean) => void): HTMLButtonElement {
    const b = this.button(label, () => {
      set(!get());
      b.classList.toggle('on', get());
    });
    b.classList.toggle('on', get());
    return b;
  }

  /** Todo el balance como texto, para pegarlo en el chat y llevarlo al código. */
  config(): string {
    const c = this.hooks.camera();
    const lines = [
      '// Golf Knight · balance',
      `campo: ${COURSES[this.hooks.courseIndex()].name}`,
      `camara: pitch ${c.pitch.toFixed(0)}, rise ${c.rise.toFixed(1)}, dist ${c.dist.toFixed(1)}, encuadre ${c.auto ? `automatico a ${c.margin} px de las barras` : 'fijo'}`,
      `bandas: corta <= ${BAND_LIMITS[0]} m, media <= ${BAND_LIMITS[1]} m`,
      `hierro: modo ${ironMode()}`,
      `carga: barra llena ${CLUB_ORDER.map((id) => `${id} ${CLUBS[id].chargeTime}`).join(', ')} s`,
      `  niveles desde ${QUALITY_FROM.map((p) => `${Math.round(p * 100)}%`).join(' / ')} de la barra`,
      `  con el driver eso es: ${levelDurations(CLUBS.driver).map((s, q) => `golpe ${q + 1} dura ${s.toFixed(2)} s`).join(', ')}`,
      '',
      'palos (daño [corta, media, larga] x [golpe 1, 2, 3]):',
    ];
    for (const id of CLUB_ORDER) {
      const club = CLUBS[id];
      const area = club.areaDamage ? `, areaDamage ${JSON.stringify(club.areaDamage)}` : '';
      // la distancia fija y la rapidez del rodado faltaban en la copia, y son de las palancas que más
      // cambian cómo se juega: sin ellas la config pegada parecía igual a la del código
      const fixed = club.fixedRange > 0 ? `, distancia fija ${club.fixedRange} m` : ', distancia por el cursor';
      const roll = club.rollFriction ? `, rapidez ${club.rollFriction}` : '';
      lines.push(`  ${id}: llega ${club.minRange}-${club.maxRange} m${fixed}, radio ${club.spread}${roll}, damage ${JSON.stringify(club.damage)}${area}`);
    }
    lines.push('', 'habilidades (recarga en s, alcance en m):');
    for (const id of ABILITY_LIST) lines.push(`  ${id}: recarga ${ABILITIES[id].cooldown}, alcance ${ABILITIES[id].range}`);
    lines.push('', 'numeros de habilidades y mejoras ([nv1, nv2, nv3] donde van por nivel):');
    for (const [name, table] of Object.entries(CONFIGS)) lines.push(`  ${name}: ${JSON.stringify(table)}`);
    lines.push('', `correrse cargando: modo ${SHIFT.mode}, alcance ${SHIFT.reach} m, paso ${SHIFT.step} m, velocidad ${SHIFT.speed} m/s`);
    lines.push(`efecto: ${CURVE.variant}, vuelve a cero al ${CURVE.reset}, curva max ${CURVE.max} m, escalon ${CURVE.step} m, crece a ${CURVE.rate} m/s`);
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
