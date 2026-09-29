// El tutorial: paso por paso, un palo por vez, con enemigos quietos puestos donde ese palo luce.
//
// Cada paso deja un solo palo en la mano, pone sus enemigos (que no caminan: esperan donde los pusieron,
// entre 15 y 20 m, más cerca que el recuadro de las instrucciones)
// y dice qué hacer. Si el tiro no es el que se está enseñando, el enemigo no muere: queda con 1 de vida
// y se explica por qué (ver `Horde.mayKill`). Si la pelota se va sin pegar, aparece otra a los pies. El
// paso termina cuando caen todos sus enemigos.
//
// Los pasos:
// 1. apuntar y pegar (driver);
// 2. cargar hasta el verde (uno blindado, al que el golpe flojo no le hace nada);
// 3. clavar la carga con Espacio: con el golpe clavado en el verde, los dos enemigos se ponen en fila
//    frente al golfista, y ahí se suelta (para eso sirve cargar antes);
// 4. el hierro: un grupo detrás de una loma, pegándole a uno salpica a los demás;
// 5. el wedge: un globo que abre un área grande, y que con el golpe 1 pifia;
// 6. el putter: uno cerca.
// Al terminar arranca la partida de verdad, con los cuatro palos.
import * as THREE from 'three';
import { qualityOf, type ClubId } from './core/clubs';
import { heightAt, mounds, type Mound } from './core/terrain';
import type { EnemyKind, EnemyMods } from './core/waves';
import type { Enemy, Horde, HordeEvent } from './game/enemies';
import type { Player } from './game/player';
import type { Tees } from './game/tees';
import type { Hud } from './hud';

/** Lo que el tutorial necesita del juego. */
export interface TutorialHost {
  horde: Horde;
  player: () => Player;
  tees: Tees;
  hud: Hud;
  /** Deja solo este palo en la mano. */
  onlyClub(id: ClubId): void;
  /** Terminó: arranca la partida. */
  finish(): void;
}

type Shot = Horde['shot'];

interface Step {
  title: string;
  club: ClubId;
  /** Lo que se le pide, en HTML corto. */
  text: string;
  /** Pone los enemigos (y lo que haga falta), con `x` relativo al puesto del golfista. */
  setup(t: Tutorial): void;
  /** ¿Este tiro puede matar? null = sí; si no, por qué (se le muestra al jugador). */
  allow?(t: Tutorial, shot: NonNullable<Shot>): string | null;
  update?(t: Tutorial, dt: number): void;
  /** Lo que se dice al terminarlo. */
  praise: string;
}

const KEY = (k: string) => `<kbd>${k}</kbd>`;

/** Lo mínimo para que el golpe no sea el flojo. */
const needGreen = (_: Tutorial, shot: NonNullable<Shot>) =>
  shot.quality >= 2 ? null : 'Golpe flojo (blanco): mantené el click hasta que la aguja llegue al verde';

const STEPS: Step[] = [
  {
    title: 'Apuntar y pegar',
    club: 'driver',
    text: `Apuntá al goblin con el ${KEY('mouse')}. Mantené apretado el ${KEY('click')} y soltalo para pegar.`,
    setup: (t) => t.put('goblin', 3, 25),
    praise: '¡Adentro! El driver sale casi al ras y atraviesa a todos los que encuentra en la línea.',
  },
  {
    title: 'Cargar el golpe',
    club: 'driver',
    text: `Este tiene <b>blindaje</b>: el golpe flojo no le hace nada. Mantené el ${KEY('click')}: la aguja sube del `
      + `<b class="t1">blanco</b> al <b class="t2">verde</b>. Soltá en el verde.`,
    setup: (t) => t.put('goblin', -4, 26, { armor: 1 }),
    allow: needGreen,
    praise: '¡Eso! Y si soltás justo en el <b class="t3">amarillo del centro</b>, es el golpe perfecto: pega todavía más.',
  },
  {
    title: 'Clavar la carga',
    club: 'driver',
    text: `Cargá hasta el <b class="t2">verde</b> y apretá ${KEY('Espacio')}: la aguja se queda quieta y el golpe queda guardado. `
      + `No sueltes el ${KEY('click')}.`,
    setup: (t) => {
      t.put('goblina', -7, 22);
      t.put('goblina', 8, 29);
      t.lineUp = true;
    },
    allow: (t, shot) => (!t.lockLearned ? `Primero clavá la carga en el verde con ${'Espacio'}, y después soltá` : needGreen(t, shot)),
    update: (t) => t.watchLock(),
    praise: '¡Los dos de un tiro! Clavar la carga te deja esperar a que se pongan en fila.',
  },
  {
    title: 'El hierro',
    club: 'iron',
    text: `${KEY('2')} Hierro 7: va en arco, por arriba de las lomas, y revienta en el primero que toca, `
      + `salpicando a los de al lado. Pegale a uno del grupo.`,
    setup: (t) => {
      t.mound(0, 17.5);
      t.put('goblin', -1.2, 23.5);
      t.put('goblin', 1.2, 23.5);
      t.put('goblin', 0, 25.1);
    },
    allow: (_, shot) => (shot.club === 'iron' ? null : 'Con el hierro'),
    praise: '¡Todos! Detrás de una loma, o con varios juntos, el hierro es el palo.',
  },
  {
    title: 'El wedge',
    club: 'wedge',
    text: `${KEY('3')} Wedge: un globo alto que cae donde apuntás y abre un área grande. Ojo: con el golpe `
      + `flojo se <b>pifia</b> y la pelota no sale (el arco lo marca en gris ⚠). Cargá al <b class="t2">verde</b>.`,
    setup: (t) => {
      for (const [x, z] of [[1, 24], [3, 24.5], [2, 26.2], [0.2, 26], [3.6, 26.4]]) t.put('goblin', x, z);
    },
    allow: (_, shot) => (shot.club === 'wedge' ? null : 'Con el wedge'),
    praise: '¡Limpio! El wedge no necesita pegarle a nadie: el área sale igual donde cae.',
  },
  {
    title: 'El putter',
    club: 'putter',
    text: `${KEY('4')} Putter: la pelota rueda hasta 20 m y le pega al primero que toca. De cerca pega como ninguno.`,
    setup: (t) => t.put('orc', 1, 16),
    allow: (_, shot) => (shot.club === 'putter' ? null : 'Con el putter'),
    praise: '¡Al hoyo! Para el que ya está encima, el putter.',
  },
];

/** La fila del paso 3: a qué distancias se paran, y hacia dónde apunta la recta. */
const LINE_Z = [21, 27];
const LINE_FAR = 30;

/** Segundos entre un paso y el siguiente, con el elogio en pantalla. */
const BETWEEN = 2.6;
/** Segundos sin pelota en el puesto antes de que aparezca otra. */
const BALL_DELAY = 0.5;

export class Tutorial {
  private index = -1;
  private enemies: Enemy[] = [];
  private wait = 0;
  private ballTimer = 0;
  private wasLocked = false;
  private reason = '';
  private toldAt = -Infinity;
  private clock = 0;
  private ownMounds: Mound[] = [];
  /** Ya clavó la carga en el verde (paso 3). */
  lockLearned = false;
  finished = false;

  constructor(private readonly host: TutorialHost) {}

  get step(): Step | null {
    return STEPS[this.index] ?? null;
  }

  start(): void {
    this.host.horde.mayKill = (e, shot) => this.mayKill(e, shot);
    this.next();
  }

  /** Lo que pone el paso, antes de ubicarlo en el campo (ver `place`). */
  private pending: { kind: EnemyKind; x: number; z: number; mods?: EnemyMods }[] = [];
  private pendingMounds: { x: number; z: number }[] = [];
  /** Dónde quedó el paso: el puesto del golfista más el corrimiento que eligió `place`. */
  private baseX = 0;
  /**
   * Este paso los pone en fila (el 3): la fila va sobre la recta que sale de la pelota hacia `baseX`,
   * así que esa recta también tiene que quedar en lo plano.
   */
  lineUp = false;

  /** La fila del paso 3: dónde se para el `i`-ésimo. */
  private linePoint(i: number, baseX: number): THREE.Vector3 {
    const tee = this.host.player().anchor;
    const z = LINE_Z[i];
    return new THREE.Vector3(tee.x + ((baseX - tee.x) * (z - tee.z)) / (LINE_FAR - tee.z), 0, z);
  }

  /** Un enemigo quieto en (x relativo al puesto, z). */
  put(kind: EnemyKind, x: number, z: number, mods?: EnemyMods): void {
    this.pending.push({ kind, x, z, mods });
  }

  /** Una loma, que crece desde el piso. */
  mound(x: number, z: number): void {
    this.pendingMounds.push({ x, z });
  }

  /**
   * Ubica lo que puso el paso: todo junto, corrido a lo ancho hasta la franja más plana cerca del
   * golfista. En un valle el enemigo queda un metro más abajo y el driver, que sale casi al ras, le pasa
   * por encima: en el tutorial eso confunde.
   */
  private place(): void {
    const ax = this.host.player().anchor.x;
    let best = 0;
    let bestScore = Infinity;
    for (let dx = -8; dx <= 8; dx += 0.5) {
      let worst = 0;
      const points = this.pending.map((p) => ({ x: ax + p.x + dx, z: p.z }));
      if (this.lineUp) for (let i = 0; i < LINE_Z.length; i++) points.push(this.linePoint(i, ax + dx));
      for (const p of points) {
        if (Math.abs(p.x) > 14) worst = Infinity;
        else worst = Math.max(worst, Math.abs(heightAt(p.x, p.z)));
      }
      const score = worst + 0.02 * Math.abs(dx);
      if (score < bestScore) {
        bestScore = score;
        best = dx;
      }
    }
    this.baseX = ax + best;
    for (const p of this.pending) {
      const at = new THREE.Vector3(this.baseX + p.x, 0, p.z);
      const e = this.host.horde.spawn(p.kind, at, p.mods);
      e.hold = at.clone();
      this.enemies.push(e);
    }
    for (const p of this.pendingMounds) {
      const m: Mound = { x: this.baseX + p.x, z: p.z, height: 0, target: 2.4, rx: 4, rz: 2.2, owner: 0 };
      mounds.push(m);
      this.ownMounds.push(m);
    }
    this.pending = [];
    this.pendingMounds = [];
  }

  private say(text: string): void {
    const s = this.step;
    this.host.hud.setTutorial(s ? `Tutorial · ${this.index + 1} de ${STEPS.length}` : 'Tutorial', s?.title ?? '', text);
  }

  private next(): void {
    this.index++;
    this.enemies = [];
    this.lineUp = false;
    this.reason = '';
    // las lomas del paso anterior bajan solas (ver `Horde.updateMounds`)
    for (const m of this.ownMounds) m.target = 0;
    this.ownMounds = [];
    const s = this.step;
    if (!s) {
      this.finished = true;
      this.host.hud.setTutorial('Tutorial', '¡Listo!', 'Ya sabés usar los cuatro palos. Ahora vienen de verdad: que no lleguen a la puerta.');
      this.wait = 3.5;
      return;
    }
    this.host.onlyClub(s.club);
    s.setup(this);
    this.place();
    this.say(s.text);
    this.host.hud.showBanner(s.title, `Paso ${this.index + 1} de ${STEPS.length}`, 2);
  }

  /** El paso 3: mira cuándo se clava la carga, y en qué nivel. */
  watchLock(): void {
    const meter = this.host.player().meter;
    const locked = meter.locked;
    if (locked && !this.wasLocked) {
      const q = qualityOf(meter.power);
      if (q < 2) {
        this.host.hud.feedback('Clavaste en el blanco: apretá Espacio otra vez para volver a cargar, y clavalo en el verde', 'bad');
      } else if (!this.lockLearned) {
        this.lockLearned = true;
        // con el golpe guardado, los dos se ponen en fila frente al golfista: sobre la recta que sale
        // de su pelota hacia la franja plana del paso
        this.enemies.forEach((e, i) => { e.hold = this.linePoint(i, this.baseX); });
        this.say(`¡Clavado! Ahora esperá a que se pongan en fila… apuntales y soltá el ${KEY('click')}: el driver atraviesa a los dos.`);
      }
    }
    this.wasLocked = locked;
  }

  private mayKill(enemy: Enemy, shot: Shot): boolean {
    const s = this.step;
    if (!s || !this.enemies.includes(enemy)) return true;
    if (!shot || shot.ability) {
      this.reason = 'Con el palo';
      return false;
    }
    const why = s.allow?.(this, shot) ?? null;
    this.reason = why ?? '';
    return why === null;
  }

  onEvent(e: HordeEvent): void {
    // al blindado el golpe flojo no le hace nada: ni llega a perdonarlo
    if (e.type === 'armored' && this.enemies.includes(e.enemy)) this.reason = 'El golpe flojo no le entra al blindaje: cargá hasta el verde';
    else if (e.type !== 'spared' || !this.reason) return;
    // un tiro de área puede perdonar a varios a la vez: se dice una sola vez
    if (this.clock - this.toldAt < 0.5) return;
    this.toldAt = this.clock;
    this.host.hud.feedback(`Así no muere: ${this.reason.charAt(0).toLowerCase()}${this.reason.slice(1)}`, 'bad');
  }

  /** El golpe 1 del wedge no sale. */
  onDuff(): void {
    if (this.step?.club === 'wedge') this.host.hud.feedback('Con el wedge, el golpe flojo no sale: cargá hasta el verde', 'bad');
  }

  update(dt: number): void {
    this.clock += dt;
    // la loma del paso sube en un par de segundos (la del geomante tarda ocho: acá no hay que esperarla)
    for (const m of this.ownMounds) if (m.target > 0) m.height = Math.min(m.target, m.height + 1.4 * dt);
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.finished) this.end();
        else this.next();
      }
      return;
    }
    this.supplyBall(dt);
    const s = this.step;
    if (!s) return;
    s.update?.(this, dt);
    if (this.enemies.every((e) => !e.alive)) {
      this.say(s.praise);
      this.host.hud.feedback('¡Bien!', 'good');
      this.wait = BETWEEN;
    }
  }

  /** Si le erró, aparece otra pelota a los pies. */
  private supplyBall(dt: number): void {
    const player = this.host.player();
    const i = player.spotIndex;
    if (player.atSpot && player.mode === 'free' && !this.host.tees.hasBall(i)) {
      this.ballTimer += dt;
      if (this.ballTimer >= BALL_DELAY) {
        this.host.tees.place(i);
        this.ballTimer = 0;
      }
    } else {
      this.ballTimer = 0;
    }
  }

  /** Corta el tutorial donde esté (el panel de balance saltó a una oleada). */
  stop(): void {
    for (const m of this.ownMounds) m.target = 0;
    this.end();
  }

  private end(): void {
    this.host.horde.mayKill = null;
    for (const e of this.enemies) e.hold = null;
    this.host.hud.setTutorial(null, '', '');
    this.host.finish();
  }
}
