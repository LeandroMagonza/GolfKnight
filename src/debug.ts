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
    return this.track(numberField(get, set, step), get);
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
      for (let q = 1; q <= QUALITY_LEVELS; q++) {
        const row = table.insertRow();
        cell(row, `golpe ${q}`, 'l');
        for (let band = 0; band < BAND_NAMES.length; band++) {
          cell(row, this.field(() => club.damage[band][q - 1], (v) => { club.damage[band][q - 1] = v; }));
        }
      }
      const rangeRow = table.insertRow();
      cell(rangeRow, 'alcance m', 'l');
      cell(rangeRow, this.field(() => club.minRange, (v) => { club.minRange = v; }));
      cell(rangeRow, this.field(() => club.maxRange, (v) => { club.maxRange = v; }));
      cell(rangeRow, this.field(() => club.spread, (v) => { club.spread = v; }, 0.2)).title = 'radio del área donde cae';
      el.append(table);
    }
    el.append(note('La tercera casilla de la última fila es el radio del área. El putter llega hasta su alcance máximo: más lejos que eso no pega, así que su banda larga no se usa.'));

    // ---- bandas ----
    el.append(heading('Bandas de distancia'));
    const bands = document.createElement('table');
    const bandRow = bands.insertRow();
    cell(bandRow, 'corta hasta', 'l');
    cell(bandRow, this.field(() => BAND_LIMITS[0], (v) => { BAND_LIMITS[0] = v; }));
    cell(bandRow, 'media hasta', 'l');
    cell(bandRow, this.field(() => BAND_LIMITS[1], (v) => { BAND_LIMITS[1] = v; }));
    el.append(bands, note('Son metros desde la línea de los puestos, la que dice 0 en el campo.'));

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
    for (const h of ['', 'vida', 'vel.', 'daño']) {
      const th = document.createElement('th');
      th.textContent = h;
      if (!h) th.className = 'l';
      eHead.appendChild(th);
    }
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const s = ENEMIES[kind];
      const row = enemies.insertRow();
      cell(row, s.name, 'l');
      cell(row, this.field(() => s.hp, (v) => { s.hp = v; this.hooks.refreshEnemies(); }));
      cell(row, this.field(() => s.speed, (v) => { s.speed = v; this.hooks.refreshEnemies(); }, 0.1));
      cell(row, this.field(() => s.damage, (v) => { s.damage = v; this.hooks.refreshEnemies(); }));
    }
    el.append(enemies, note('La vida y la velocidad se le pasan también a los que ya están en el campo.'));

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
    copyRow.append(copy, said);
    el.append(copyRow, note('Pegámelo y lo incorporo al juego.'));
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
    const lines = ['// Golf Knight · balance', `bandas: corta <= ${BAND_LIMITS[0]} m, media <= ${BAND_LIMITS[1]} m`, '', 'palos (daño [corta, media, larga] x [golpe 1, 2, 3]):'];
    for (const id of CLUB_ORDER) {
      const c = CLUBS[id];
      lines.push(`  ${id}: alcance ${c.minRange}-${c.maxRange} m, area ${c.spread}, damage ${JSON.stringify(c.damage)}`);
    }
    lines.push('', 'poderes (recarga en segundos):');
    for (const id of ENCHANT_ORDER) lines.push(`  ${id}: ${ENCHANTS[id].cooldown}`);
    lines.push('', 'enemigos (vida, velocidad, daño):');
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const s = ENEMIES[kind];
      lines.push(`  ${kind}: hp ${s.hp}, speed ${s.speed}, damage ${s.damage}`);
    }
    return lines.join('\n');
  }
}
