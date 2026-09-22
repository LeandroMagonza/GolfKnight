// Panel de balance y pruebas (tecla B). Toca los números del juego en vivo: el daño de cada palo en
// cada banda de distancia, las bandas, la recarga de los poderes y la vida y velocidad de cada enemigo.
// Abajo están los botones para probar: oleada infinita, vida infinita, puerta infinita y saltar a una
// oleada.
//
// Los cambios se aplican sobre los objetos del juego (CLUBS, ENCHANTS, ENEMIES), así que valen desde el
// siguiente tiro y desde el siguiente enemigo que aparece; a los que ya están en el campo se les
// empareja la vida y la velocidad. El botón de copiar saca el texto con todo lo cambiado, para pasarlo
// e incorporarlo al juego.
import { BAND_LIMITS, BAND_NAMES, CLUB_ORDER, CLUBS, ENCHANT_ORDER, ENCHANTS, hasArea, IRON_MODES, ironMode, QUALITY_FROM, QUALITY_LEVELS, RESERVE, setIronMode, type Club, type IronMode } from './core/clubs';
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
  clubs?: Record<string, Partial<Record<'minRange' | 'maxRange' | 'chargeTime' | 'fixedRange', number> & { spread: number[]; rollFriction: number[]; damage: number[][]; areaDamage: number[][] }>>;
  iron?: IronMode;
  /** Dónde empieza cada nivel de golpe, en potencia 0..1. */
  quality?: number[];
  reserve?: { cooldown: number; max: number };
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
    for (const k of ['minRange', 'maxRange', 'chargeTime', 'fixedRange'] as const) {
      if (typeof from[k] === 'number') club[k] = from[k];
    }
    if (from.spread?.length === club.spread.length) club.spread = from.spread;
    if (from.rollFriction?.length && club.rollFriction) club.rollFriction = from.rollFriction;
    if (from.damage) club.damage = from.damage;
    if (from.areaDamage && club.areaDamage) club.areaDamage = from.areaDamage;
  }
  if (saved.iron && IRON_MODES[saved.iron]) setIronMode(saved.iron);
  if (saved.quality?.length === QUALITY_FROM.length) QUALITY_FROM.splice(0, QUALITY_FROM.length, ...saved.quality);
  if (saved.reserve) {
    if (typeof saved.reserve.cooldown === 'number') RESERVE.cooldown = saved.reserve.cooldown;
    if (typeof saved.reserve.max === 'number') RESERVE.max = saved.reserve.max;
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
      fixedRange: c.fixedRange, damage: c.damage,
      ...(c.rollFriction ? { rollFriction: c.rollFriction } : {}),
      ...(c.areaDamage ? { areaDamage: c.areaDamage } : {}),
    };
    out.iron = ironMode();
  }
  out.quality = [...QUALITY_FROM];
  out.reserve = { cooldown: RESERVE.cooldown, max: RESERVE.max };
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

    // ---- pelota de reserva ----
    el.append(heading('Pelota de reserva (S)'));
    const res = document.createElement('table');
    const resRow = res.insertRow();
    cell(resRow, 'recarga', 'l');
    cell(resRow, this.field(() => RESERVE.cooldown, (v) => { RESERVE.cooldown = Math.max(0.5, v); }, 1)).title = 'segundos que tarda en reponerse una carga';
    cell(resRow, 'cargas', 'l');
    cell(resRow, this.field(() => RESERVE.max, (v) => { RESERVE.max = Math.max(1, Math.round(v)); }, 1)).title = 'cuántas pelotas se pueden tener guardadas a la vez';
    el.append(res, note('S apoya una pelota en el puesto donde estás parado, si no hay una ya. Se repone de a una.'));

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
      `carga: barra llena ${CLUB_ORDER.map((id) => `${id} ${CLUBS[id].chargeTime}`).join(', ')} s`,
      `  niveles desde ${QUALITY_FROM.map((p) => `${Math.round(p * 100)}%`).join(' / ')} de la barra`,
      `  con el driver eso es: ${levelDurations(CLUBS.driver).map((s, q) => `golpe ${q + 1} dura ${s.toFixed(2)} s`).join(', ')}`,
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
    lines.push('', `pelota de reserva (S): ${RESERVE.max} cargas, una cada ${RESERVE.cooldown} s`);
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
