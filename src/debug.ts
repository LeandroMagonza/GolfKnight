// Panel de balance y pruebas (tecla B). Toca los números del juego en vivo: el daño de cada palo en
// cada banda de distancia, las bandas, las habilidades y la vida y velocidad de cada enemigo. Abajo
// están los botones para probar: oleada infinita, vida infinita, puerta infinita y saltar a una oleada.
//
// Los cambios se aplican sobre los objetos del juego (CLUBS, ABILITIES, ENEMIES), así que valen desde el
// siguiente tiro y desde el siguiente enemigo que aparece; a los que ya están en el campo se les
// empareja la vida y la velocidad. El botón de copiar saca el texto con todo lo cambiado, para pasarlo
// e incorporarlo al juego.
import { ABILITIES, ABILITY_ORDER, GRENADE, ICE, WIND } from './core/abilities';
import { BAND_LIMITS, BAND_NAMES, CLUB_ORDER, CLUBS, hasArea, IRON_MODES, ironMode, QUALITY_FROM, QUALITY_LEVELS, RESERVE, setIronMode, SHIFT, SHIFT_MODES, CURVE, CURVE_VARIANTS, CURVE_RESETS, type Club, type IronMode, type ShiftMode } from './core/clubs';
import { RISE_CURVE } from './core/swing';
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
  reserve?: { enabled?: boolean; cooldown: number; max: number };
  /** Correrse cargando: el modo y sus números. */
  shift?: Partial<typeof SHIFT>;
  /** El efecto: cómo crece, cuándo vuelve a cero y sus números. */
  curve?: Partial<typeof CURVE>;
  /** Recarga y alcance de cada habilidad, y los números propios de cada una. */
  abilities?: Record<string, { cooldown: number; range: number }>;
  ice?: Partial<typeof ICE>;
  wind?: Partial<typeof WIND>;
  grenade?: Partial<typeof GRENADE>;
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
  if (saved.reserve) {
    if (typeof saved.reserve.cooldown === 'number') RESERVE.cooldown = saved.reserve.cooldown;
    if (typeof saved.reserve.max === 'number') RESERVE.max = saved.reserve.max;
    if (typeof saved.reserve.enabled === 'boolean') RESERVE.enabled = saved.reserve.enabled;
  }
  for (const id of ABILITY_ORDER) {
    const from = saved.abilities?.[id];
    if (typeof from?.cooldown === 'number') ABILITIES[id].cooldown = from.cooldown;
    if (typeof from?.range === 'number') ABILITIES[id].range = from.range;
  }
  // solo los números que el código todavía tiene: un guardado viejo no mete claves que ya no existen
  for (const [name, into, from] of [['ice', ICE, saved.ice], ['wind', WIND, saved.wind], ['grenade', GRENADE, saved.grenade]] as [string, Record<string, number>, Record<string, number> | undefined][]) {
    if (outdated(version, name)) continue;
    for (const k of Object.keys(into)) if (typeof from?.[k] === 'number') into[k] = from[k];
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
  const out: Saved = { version: VERSION, bands: [...BAND_LIMITS], clubs: {}, abilities: {}, enemies: {}, ice: { ...ICE }, wind: { ...WIND }, grenade: { ...GRENADE }, ...extras };
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
  out.reserve = { enabled: RESERVE.enabled, cooldown: RESERVE.cooldown, max: RESERVE.max };
  out.shift = { ...SHIFT };
  out.curve = { ...CURVE };
  for (const id of ABILITY_ORDER) out.abilities![id] = { cooldown: ABILITIES[id].cooldown, range: ABILITIES[id].range };
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

export class DebugPanel {
  private readonly el = $('balance');
  private readonly btn = $<HTMLButtonElement>('balancebtn');
  private readonly fields: HTMLInputElement[] = [];
  private camLine: HTMLElement | null = null;
  /** Las casillas que muestran cuánto dura cada nivel del golpe: no se escriben, se calculan. */
  private readonly chargeCells: { td: HTMLTableCellElement; club: Club; level: number }[] = [];

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
    saveBalance({ camera: { pitch: c.pitch, rise: c.rise, auto: c.auto, margin: c.margin }, disabled: [...this.hooks.disabled] });
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
      const fixedRow = document.createElement('div');
      fixedRow.className = 'row';
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
      fixedRow.append(fixed, box);
      el.append(fixedRow);
      // el hierro tiene dos formas de entregar: se prueban acá
      if (club.id === 'iron') {
        const modes = document.createElement('div');
        modes.className = 'row';
        const buttons: HTMLButtonElement[] = [];
        for (const mode of Object.keys(IRON_MODES) as IronMode[]) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = mode;
          b.title = mode === 'revienta'
            ? 'No atraviesa: explota en el piso, abajo del primero que toca. Si cae al piso sin tocar a nadie, no hace nada'
            : 'Atraviesa hasta a tres y además abre su área donde cae, le pegue a alguien o no';
          b.addEventListener('click', () => {
            b.blur();
            setIronMode(mode);
            for (const other of buttons) other.classList.toggle('on', other.textContent === ironMode());
            this.save();
          });
          buttons.push(b);
          modes.append(b);
        }
        for (const b of buttons) b.classList.toggle('on', b.textContent === ironMode());
        el.append(modes);
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

    // ---- bandas ----
    el.append(heading('Bandas de distancia (iguales para todos los palos)'));
    const bands = document.createElement('table');
    const bandRow = bands.insertRow();
    cell(bandRow, 'corta hasta', 'l');
    cell(bandRow, this.field(() => BAND_LIMITS[0], (v) => { BAND_LIMITS[0] = v; }));
    cell(bandRow, 'media hasta', 'l');
    cell(bandRow, this.field(() => BAND_LIMITS[1], (v) => { BAND_LIMITS[1] = v; }));
    el.append(bands, note('Los metros se cuentan desde la línea de los puestos, la que dice 0 en el campo.'));

    // ---- carga: cuánto dura cada nivel del golpe ----
    el.append(heading('Carga: cuánto dura cada nivel del golpe'));
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
      + 'Los segundos de la tabla ya tienen eso adentro: son lo que dura cada nivel de verdad. '
      + 'Y al llegar arriba la barra rebota y baja hasta abajo, así que el golpe 3 vuelve a pasar en cada rebote, igual de corto. '
      + 'Subir el «barra llena» de un palo estira los tres niveles a la vez; los porcentajes reparten la barra entre ellos y valen para los cuatro palos.',
    ));

    // ---- habilidades ----
    el.append(heading('Habilidades (Q, W, E)'));
    const abil = document.createElement('table');
    const abilHead = abil.insertRow();
    for (const h of ['', 'recarga s', 'alcance m']) {
      const th = document.createElement('th');
      th.textContent = h;
      if (!h) th.className = 'l';
      abilHead.appendChild(th);
    }
    for (const id of ABILITY_ORDER) {
      const a = ABILITIES[id];
      const row = abil.insertRow();
      cell(row, a.name, 'l');
      cell(row, this.field(() => a.cooldown, (v) => { a.cooldown = Math.max(0, v); }, 0.5));
      cell(row, this.field(() => a.range, (v) => { a.range = Math.max(1, v); }, 1)).title = id === 'wind'
        ? 'el vendaval va siempre hasta acá, como el driver'
        : 'cae donde apuntás, pero nunca más lejos que esto';
    }
    el.append(abil);
    // los números propios de cada una: una fila por número, con lo que significa al lado
    const own: [string, [string, () => number, (v: number) => void, number, string][]][] = [
      ['Hielo', [
        ['radio', () => ICE.radius, (v) => { ICE.radius = Math.max(0.5, v); }, 0.5, 'm de la zona'],
        ['dura', () => ICE.duration, (v) => { ICE.duration = Math.max(0.5, v); }, 0.5, 's en el piso'],
        ['al salir', () => ICE.linger, (v) => { ICE.linger = Math.max(0, v); }, 0.1, 's hasta que se le va el frío'],
        ['camina al', () => Math.round(ICE.slow * 100), (v) => { ICE.slow = Math.min(1, Math.max(0, v / 100)); }, 5, '% de su velocidad'],
      ]],
      ['Vendaval', [
        ['ancho', () => WIND.halfWidth, (v) => { WIND.halfWidth = Math.max(0.5, v); }, 0.5, 'm a cada lado de la línea'],
      ]],
      ['Granada', [
        ['radio', () => GRENADE.radius, (v) => { GRENADE.radius = Math.max(0.5, v); }, 0.5, 'm de la explosión'],
        ['centro', () => Math.round(GRENADE.core * 100), (v) => { GRENADE.core = Math.min(1, Math.max(0, v / 100)); }, 5, '% del radio que no se mueve'],
        ['fuerza', () => GRENADE.push, (v) => { GRENADE.push = Math.max(0, v); }, 0.5, 'm de la línea a los que los deja'],
        ['silencio', () => GRENADE.silence, (v) => { GRENADE.silence = Math.max(0, v); }, 0.5, 's sin escudo, aura ni inmunidad'],
        ['vulnerable', () => GRENADE.vulnerable, (v) => { GRENADE.vulnerable = Math.max(0, v); }, 1, 'de daño de más por pelotazo'],
      ]],
    ];
    for (const [name, rows] of own) {
      const t = document.createElement('table');
      const head = t.insertRow();
      const th = document.createElement('th');
      th.className = 'l';
      th.textContent = name;
      head.appendChild(th);
      for (const [label, get, set, step, unit] of rows) {
        const row = t.insertRow();
        cell(row, label, 'l');
        cell(row, this.field(get, set, step));
        cell(row, unit, 'l');
      }
      el.append(t);
    }
    el.append(note(
      'Cada habilidad tira su propia pelota: no gasta la del puesto. El hielo deja una zona: el que está adentro, o entra mientras dura, camina lento, y al salir se le pasa. '
      + 'El vendaval los junta sobre la línea del tiro, nada más. '
      + 'La granada no lastima: silencia a todos los que agarra (sin escudo, sin aura del chamán, sin inmunidad, y cada pelotazo les saca «vulnerable» de más). '
      + 'Los del centro se quedan quietos; los de afuera salen a los costados de la línea del tiro y quedan en dos filas, a «fuerza» metros de ella.',
    ));

    // ---- correrse cargando ----
    el.append(heading('Correrse cargando (A / D, experimental)'));
    const shiftModes = document.createElement('div');
    shiftModes.className = 'row';
    const shiftButtons: HTMLButtonElement[] = [];
    for (const mode of SHIFT_MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = mode;
      b.title = mode === 'pasos'
        ? 'Cada toque de A o D te corre un paso con la pelota'
        : mode === 'continuo'
          ? 'Mantener A o D te corre con la pelota, y podés tirar desde cualquier punto'
          : mode === 'efecto'
            ? 'No te corrés: A y D le dan efecto a la pelota y el tiro se curva. Solo driver y putter'
            : 'Como antes: cargando, A y D quedan anotadas para después del tiro';
      b.addEventListener('click', () => {
        b.blur();
        SHIFT.mode = mode as ShiftMode;
        for (const other of shiftButtons) other.classList.toggle('on', other.textContent === SHIFT.mode);
        this.save();
      });
      shiftButtons.push(b);
      shiftModes.append(b);
    }
    for (const b of shiftButtons) b.classList.toggle('on', b.textContent === SHIFT.mode);
    const shiftTable = document.createElement('table');
    for (const [label, get, set, step, unit] of [
      ['alcance', () => SHIFT.reach, (v: number) => { SHIFT.reach = Math.max(0, v); }, 0.1, 'm para cada lado'],
      ['paso', () => SHIFT.step, (v: number) => { SHIFT.step = Math.max(0.05, v); }, 0.1, 'm por toque (pasos)'],
      ['velocidad', () => SHIFT.speed, (v: number) => { SHIFT.speed = Math.max(0.1, v); }, 0.5, 'm/s (continuo)'],
    ] as [string, () => number, (v: number) => void, number, string][]) {
      const row = shiftTable.insertRow();
      cell(row, label, 'l');
      cell(row, this.field(get, set, step));
      cell(row, unit, 'l');
    }
    el.append(shiftModes, shiftTable, note('Mientras cargás, A y D te corren con la pelota sin cambiar de puesto, para alinearte con una fila. Los puestos están a 4 m: un alcance de 1.2 es un 30 %.'));
    // el modo «efecto»: cómo crece la curva y cuándo vuelve a cero
    const choice = <T extends string>(label: string, options: T[], get: () => T, set: (v: T) => void, titles: Record<T, string>) => {
      const row = document.createElement('div');
      row.className = 'row';
      const tag = document.createElement('span');
      tag.className = 'note';
      tag.textContent = label;
      tag.style.alignSelf = 'center';
      tag.style.minWidth = '92px';
      row.append(tag);
      const buttons = options.map((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o;
        b.title = titles[o];
        b.addEventListener('click', () => {
          b.blur();
          set(o);
          for (const other of buttons) other.classList.toggle('on', other.textContent === get());
          this.save();
        });
        return b;
      });
      for (const b of buttons) b.classList.toggle('on', b.textContent === get());
      row.append(...buttons);
      return row;
    };
    const curveTable = document.createElement('table');
    for (const [label, get, set, step, unit] of [
      ['curva máx.', () => CURVE.max, (v: number) => { CURVE.max = Math.max(0, v); }, 0.5, 'm de desvío para cada lado'],
      ['escalón', () => CURVE.step, (v: number) => { CURVE.step = Math.max(0.1, v); }, 0.5, 'm por toque (discreto)'],
      ['crece a', () => CURVE.rate, (v: number) => { CURVE.rate = Math.max(0.1, v); }, 1, 'm/s (continuo)'],
    ] as [string, () => number, (v: number) => void, number, string][]) {
      const row = curveTable.insertRow();
      cell(row, label, 'l');
      cell(row, this.field(get, set, step));
      cell(row, unit, 'l');
    }
    el.append(
      heading('Efecto (modo «efecto»: driver y putter)'),
      choice('la curva', CURVE_VARIANTS, () => CURVE.variant, (v) => { CURVE.variant = v; }, {
        continuo: 'Mientras mantenés A o D la curva va creciendo',
        discreto: 'Cada toque de A o D suma un escalón de curva',
      }),
      choice('vuelve a cero', CURVE_RESETS, () => CURVE.reset, (v) => { CURVE.reset = v; }, {
        disparar: 'La curva se mantiene hasta que sale el tiro',
        soltar: 'La curva vuelve a cero apenas soltás las dos teclas (con discreto: tocá y mantené)',
      }),
      curveTable,
      note('El desvío se mide al final del tiro: con 6 m, el driver termina 6 m corrido de donde apuntaste. La línea de tiro muestra la curva mientras cargás.'),
    );

    // ---- pelota de reserva ----
    el.append(heading('Pelota de reserva (S)'));
    const res = document.createElement('table');
    const resRow = res.insertRow();
    cell(resRow, 'recarga', 'l');
    cell(resRow, this.field(() => RESERVE.cooldown, (v) => { RESERVE.cooldown = Math.max(0.5, v); }, 1)).title = 'segundos que tarda en reponerse una carga';
    cell(resRow, 'cargas', 'l');
    cell(resRow, this.field(() => RESERVE.max, (v) => { RESERVE.max = Math.max(1, Math.round(v)); }, 1)).title = 'cuántas pelotas se pueden tener guardadas a la vez';
    const resOn = document.createElement('div');
    resOn.className = 'row';
    resOn.append(this.toggleButton('Pelota de reserva prendida', () => RESERVE.enabled, (v) => { RESERVE.enabled = v; this.save(); }));
    el.append(resOn, res, note('Apagada de arranque: las habilidades traen su propia pelota. Prendida, S apoya una pelota en el puesto donde estás parado, si no hay una ya, y se repone de a una.'));

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
    const frame = document.createElement('div');
    frame.className = 'row';
    const c = this.hooks.camera();
    frame.append(this.toggleButton('Encuadre automático', () => c.auto, (v) => { c.auto = v; this.save(); }));
    const marginTable = document.createElement('table');
    const marginRow = marginTable.insertRow();
    cell(marginRow, 'puestos sobre las barras', 'l');
    cell(marginRow, this.field(() => c.margin, (v) => { c.margin = Math.max(0, v); }, 4));
    cell(marginRow, 'px', 'l');
    el.append(camLine, frame, marginTable, note(
      'Rueda del mouse: inclinación. Flechas arriba y abajo: altura, sin girarla. '
      + 'Con el encuadre automático la cámara se aleja o se acerca sola para que la línea de los puestos quede siempre justo arriba de las barras de abajo: '
      + 'al levantarla o inclinarla se retrasa lo que haga falta. Los valores van en «copiar configuración».',
    ));

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
    for (const id of ABILITY_ORDER) lines.push(`  ${id}: recarga ${ABILITIES[id].cooldown}, alcance ${ABILITIES[id].range}`);
    lines.push(`  hielo: radio ${ICE.radius} m, dura ${ICE.duration} s, al salir ${ICE.linger} s, camina al ${Math.round(ICE.slow * 100)}%`);
    lines.push(`  vendaval: ancho ${WIND.halfWidth} m a cada lado`);
    lines.push(`  granada: radio ${GRENADE.radius} m, centro quieto ${Math.round(GRENADE.core * 100)}% del radio, fuerza ${GRENADE.push} m, silencio ${GRENADE.silence} s, vulnerable +${GRENADE.vulnerable}`);
    lines.push('', `pelota de reserva (S): ${RESERVE.max} cargas, una cada ${RESERVE.cooldown} s`);
    lines.push(`correrse cargando: modo ${SHIFT.mode}, alcance ${SHIFT.reach} m, paso ${SHIFT.step} m, velocidad ${SHIFT.speed} m/s`);
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
