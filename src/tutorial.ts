// El tutorial: paso por paso, un palo por vez, con enemigos quietos puestos donde ese palo luce.
//
// Cada paso deja un solo palo en la mano, pone sus enemigos (que no caminan: esperan donde los pusieron,
// entre 15 y 20 m, más cerca que el recuadro de las instrucciones) y dice qué hacer. El golfista no se
// mueve de su puesto (salvo en el paso de ir a buscar la pelota) y apunta solo hacia los enemigos del
// paso. Si el tiro no es el que se está enseñando, el enemigo no muere: queda con 1 de vida (ver
// `Horde.mayKill`), y abajo de la instrucción queda una nota corta. Si la pelota se va sin pegar, aparece
// otra a los pies. El paso termina cuando caen todos sus enemigos.
//
// Los pasos:
// 1. apuntar y pegar (driver);
// 2. ir a buscar la pelota: el puesto queda vacío y los caddies tiran a los otros, nunca al tuyo;
// 3. dos en fila: el driver atraviesa a los dos (tienen que caer del mismo tiro);
// 4. correrse con la pelota (5/10, pedido de Leandro): dos casi en fila, pero desde el puesto no hay
//    recta que agarre a los dos. Mientras se carga, A y D corren al golfista con la pelota hasta que
//    quedan alineados. Tienen que caer del mismo tiro: si no, vuelven a aparecer;
// 5. cargar hasta el amarillo (uno blindado, al que el golpe flojo no le hace nada);
// 6. clavar la carga con Espacio: con el golpe clavado en el amarillo, los dos enemigos (blindados) se
//    ponen en fila frente al golfista, y ahí se suelta. Tienen que caer los dos del mismo tiro: si no,
//    vuelven a su lugar y hay que clavar de nuevo;
// 7. el hierro: un grupo detrás de una loma, pegándole a uno salpica a los demás;
// 8. el wedge: otro grupo detrás de la misma loma; con el golpe 1 pifia;
// 9. el putter: uno cerca.
// Al terminar arranca la partida de verdad, con los cuatro palos.
import * as THREE from 'three';
import { qualityOf, type ClubId } from './core/clubs';
import { heightAt, mounds, type Mound } from './core/terrain';
import type { EnemyKind, EnemyMods } from './core/waves';
import type { Enemy, Horde, HordeEvent } from './game/enemies';
import type { Player } from './game/player';
import type { Tees } from './game/tees';
import type { Hud } from './hud';
import { L } from './i18n';

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
  /** ¿Este tiro puede matar? null = sí; si no, una nota corta de por qué. */
  allow?(t: Tutorial, shot: NonNullable<Shot>): string | null;
  update?(t: Tutorial, dt: number): void;
  /** Terminó un tiro del golfista (la pelota ya se jugó). */
  shotDone?(t: Tutorial): void;
  /** Se puede mover de puesto (el paso de ir a buscar la pelota). */
  move?: boolean;
  /** Se puede correr con la pelota mientras carga (el paso de correrse). */
  shift?: boolean;
  /** Sin pelota de regalo a los pies: la tiene que ir a buscar. */
  noSupply?: boolean;
  /** Se queda con la loma y el lugar del paso anterior (el wedge, detrás de la loma del hierro). */
  sameSpot?: boolean;
  /** Lo que se dice al terminarlo. */
  praise: string;
}

const KEY = (k: string) => `<kbd>${k}</kbd>`;

/** Lo mínimo para que el golpe no sea el flojo. */
const needCharge = (_: Tutorial, shot: NonNullable<Shot>) => (shot.quality >= 2 ? null : L('Cargá hasta el amarillo', 'Charge to yellow'));

/** Tienen que caer todos del mismo tiro: si no, vuelven a su lugar. En el paso 6, antes hay que clavar. */
const allInOne = (t: Tutorial) => {
  if (t.allDown) return;
  const note = t.step?.update && !t.lockLearned
    ? L('Clavá la carga con Espacio', 'Lock the hit with Space')
    : L('Los dos del mismo tiro', 'Both with one shot');
  t.resetStep();
  t.note(note);
};

const STEPS: Step[] = [
  {
    title: L('Apuntar y pegar', 'Aim and hit'),
    club: 'driver',
    text: L(
      `Apuntá al goblin con el ${KEY('mouse')}. Mantené apretado el ${KEY('click')} y soltalo para pegar.`,
      `Aim at the goblin with the ${KEY('mouse')}. Hold ${KEY('click')} and let go to hit.`,
    ),
    setup: (t) => t.put('goblin', 3, 25),
    praise: L('¡Adentro!', 'Bullseye!'),
  },
  {
    title: L('Buscar la pelota', 'Fetch a ball'),
    club: 'driver',
    text: L(
      `Los caddies de la muralla tiran pelotas a los puestos, nunca al tuyo. Movete con ${KEY('A')} ${KEY('D')} hasta uno con pelota.`,
      `The caddies on the wall toss balls onto the tees, but never yours. Move with ${KEY('A')} ${KEY('D')} to one that has a ball.`,
    ),
    setup: (t) => {
      t.clearBalls();
      t.put('goblin', 0, 25);
    },
    move: true,
    noSupply: true,
    praise: L('Cuando te quedes sin pelota, andá a buscarla.', 'Out of balls? Go fetch one.'),
  },
  {
    title: L('En fila', 'In a row'),
    club: 'driver',
    text: L(
      'El driver atraviesa a todos los que están en su línea. Voltealos a los dos de un tiro.',
      'The driver goes straight through everyone in its path. Drop both with one shot.',
    ),
    setup: (t) => {
      t.putInLine('goblin', 0);
      t.putInLine('goblin', 1);
    },
    shotDone: allInOne,
    praise: L('¡Los dos!', 'Two for one!'),
  },
  {
    title: L('Correrse con la pelota', 'Shuffle with the ball'),
    club: 'driver',
    text: L(
      `Desde acá no quedan en fila. Mantené el ${KEY('click')} y, mientras cargás, ${KEY('A')} ${KEY('D')} te corren `
        + 'un poco para el costado con la pelota. Correte hasta que queden uno detrás del otro y voltealos a los dos de un tiro.',
      `They don't line up from here. Hold ${KEY('click')} and, while charging, ${KEY('A')} ${KEY('D')} shuffle you `
        + 'a little to the side with the ball. Shuffle until one is right behind the other and drop both with one shot.',
    ),
    setup: (t) => {
      // sobre una recta que sale de un punto corrido de la pelota: desde el puesto no hay tiro que
      // agarre a los dos (ver SHUFFLE)
      t.putOffLine('goblin', SHUFFLE.near, SHUFFLE.offset);
      t.putOffLine('goblin', SHUFFLE.far, SHUFFLE.offset);
    },
    shift: true,
    shotDone: (t) => {
      if (t.allDown) return;
      t.resetStep();
      t.note(L(
        `Mientras cargás, correte con ${KEY('A')} ${KEY('D')} hasta que queden en fila`,
        `While charging, shuffle with ${KEY('A')} ${KEY('D')} until they line up`,
      ));
    },
    praise: L(
      '¡Eso! Correrte con la pelota te alinea con una fila sin cambiar de puesto.',
      `That's it! Shuffling with the ball lines you up with a row without changing tees.`,
    ),
  },
  {
    title: L('Cargar el golpe', 'Charge the hit'),
    club: 'driver',
    text: L(
      `Este tiene <b>blindaje</b>: el golpe flojo no le hace nada. Mantené el ${KEY('click')}: la aguja sube del `
        + `<b class="green">verde</b> al <b class="yellow">amarillo</b>. Soltá en el amarillo.`,
      `This one has <b>armor</b>: a weak hit does nothing. Hold ${KEY('click')}: the needle climbs from `
        + `<b class="green">green</b> to <b class="yellow">yellow</b>. Let go on yellow.`,
    ),
    setup: (t) => t.put('goblin', -4, 26, { armor: 1 }),
    allow: needCharge,
    praise: L(
      'Y si soltás justo en el <b class="red">rojo del centro</b>, es el golpe perfecto: pega todavía más.',
      `And if you let go right on the <b class="red">red in the middle</b>, that's a perfect hit: it hits even harder.`,
    ),
  },
  {
    title: L('Clavar la carga', 'Lock the hit'),
    club: 'driver',
    text: L(
      `Tienen que caer <b>los dos del mismo tiro</b>. Cargá hasta el <b class="yellow">amarillo</b> y apretá `
        + `${KEY('Espacio')}: la aguja se queda quieta y el golpe queda guardado. No sueltes el ${KEY('click')}.`,
      `Both have to drop <b>with the same shot</b>. Charge to <b class="yellow">yellow</b> and press `
        + `${KEY('Space')}: the needle freezes and the hit is locked in. Don't let go of ${KEY('click')}.`,
    ),
    setup: (t) => {
      t.put('goblin', -7, 22, { armor: 1 });
      t.put('goblin', 8, 29, { armor: 1 });
      t.lineUp = true;
    },
    allow: (t, shot) => (!t.lockLearned ? L(`Clavá la carga con Espacio`, `Lock the hit with Space`) : needCharge(t, shot)),
    update: (t) => t.watchLock(),
    shotDone: allInOne,
    praise: L(
      '¡Los dos de un tiro! Clavar la carga te deja esperar a que se pongan en fila.',
      'Two in one shot! Locking the hit lets you wait for them to line up.',
    ),
  },
  {
    title: L('El hierro', 'The iron'),
    club: 'iron',
    text: L(
      `${KEY('2')} Hierro 7: va en arco, por arriba de las lomas, y revienta en el primero que toca, `
        + `salpicando a los de al lado. Pegale a uno del grupo.`,
      `${KEY('2')} 7 iron: flies in an arc over the mounds and bursts on the first one it hits, `
        + `splashing everyone next to it. Hit one of the group.`,
    ),
    setup: (t) => {
      t.mound(0, 17.5);
      t.put('goblin', -1.2, 23.5);
      t.put('goblin', 1.2, 23.5);
      t.put('goblin', 0, 25.1);
    },
    praise: L('¡Todos! Detrás de una loma, o con varios juntos, el hierro es el palo.', 'All of them! Behind a mound, or bunched up, the iron is your club.'),
  },
  {
    title: L('El wedge', 'The wedge'),
    club: 'wedge',
    text: L(
      `${KEY('3')} Wedge: un globo alto que cae donde apuntás y abre un área grande. Con el golpe flojo `
        + `se <b>pifia</b> (el gris ⚠ del arco): cargá al <b class="green">verde</b>.`,
      `${KEY('3')} Wedge: a high lob that lands where you aim and blasts a big area. A weak hit `
        + `is a <b>whiff</b> (the gray ⚠ on the arc): charge to <b class="green">green</b>.`,
    ),
    setup: (t) => {
      for (const [x, z] of [[-1, 24], [1, 24.5], [0, 26.2], [-1.8, 26], [1.6, 26.4]]) t.put('goblin', x, z);
    },
    sameSpot: true,
    praise: L(
      '¡Limpio! El wedge no necesita pegarle a nadie: el área sale igual donde cae.',
      `Clean! The wedge doesn't need to hit anyone: the blast goes off wherever it lands.`,
    ),
  },
  {
    title: L('El putter', 'The putter'),
    club: 'putter',
    text: L(
      `${KEY('4')} Putter: la pelota rueda hasta 20 m y le pega al primero que toca. De cerca pega como ninguno.`,
      `${KEY('4')} Putter: the ball rolls up to 20 m and hits the first one it touches. Up close, nothing hits harder.`,
    ),
    setup: (t) => t.put('orc', 1, 16),
    praise: L('¡Al hoyo! Para el que ya está encima, el putter.', `In the hole! When they're in your face, the putter.`),
  },
];

/** Las filas (pasos 3 y 5): a qué distancias se paran, y hacia dónde apunta la recta. */
const LINE_Z = [21, 27];
const LINE_FAR = 30;

/**
 * El paso de correrse con la pelota: los dos goblins están sobre una recta que pasa `offset` metros al
 * costado de la pelota (hacia la derecha de la pantalla, que es -x), a `near` y `far` de la línea de los
 * puestos. La pelota los agarra si pasa a menos de 0.57 m de su centro (el goblin más la pelota): para
 * que valga a los dos, el corrimiento no puede errarle a la recta por más de 0.57·(far+near)/(far−near),
 * 0.86 m con estos números. Arrancando a 1.15 m (el tope es 1.2), desde el puesto no hay tiro que
 * agarre a los dos, y hay que correrse por lo menos 0.3 m para el lado justo.
 */
export const SHUFFLE = { near: 4, far: 20, offset: -1.15 };

/** Segundos entre un paso y el siguiente, con el elogio en pantalla. */
const BETWEEN = 2.6;
/** Segundos sin pelota en el puesto antes de que aparezca otra. */
const BALL_DELAY = 0.5;
/** Cuánto más allá de los enemigos del paso se puede apuntar, a cada lado. */
const AIM_MARGIN = THREE.MathUtils.degToRad(10);

interface Placed {
  kind: EnemyKind;
  mods?: EnemyMods;
  at: THREE.Vector3;
}

export class Tutorial {
  private index = -1;
  private enemies: Enemy[] = [];
  private wait = 0;
  private ballTimer = 0;
  private wasLocked = false;
  private text = '';
  private noteText = '';
  private ownMounds: Mound[] = [];
  /** Ya clavó la carga en el amarillo (paso 5). */
  lockLearned = false;
  finished = false;
  /** El paso 5: la fila va sobre la recta de la pelota hacia `baseX`, que también tiene que ser plana. */
  lineUp = false;

  /** Lo que pone el paso, antes de ubicarlo en el campo (ver `place`). */
  private pending: { kind: EnemyKind; x: number; z: number; mods?: EnemyMods; line?: number; from?: number }[] = [];
  private pendingMounds: { x: number; z: number }[] = [];
  /** Dónde quedó cada enemigo del paso, para volver a ponerlos (ver `resetStep`). */
  private spots: Placed[] = [];
  /** Dónde quedó el paso: el puesto del golfista más el corrimiento que eligió `place`. */
  private baseX = 0;

  constructor(private readonly host: TutorialHost) {}

  get step(): Step | null {
    return STEPS[this.index] ?? null;
  }

  /** ¿Se puede mover de puesto ahora? */
  get canMove(): boolean {
    return !!this.step?.move && this.wait <= 0;
  }

  /** ¿Se puede correr con la pelota mientras carga? */
  get canShift(): boolean {
    return (!!this.step?.shift || !!this.step?.move) && this.wait <= 0;
  }

  start(): void {
    this.host.horde.mayKill = (e, shot) => this.mayKill(e, shot);
    this.next();
  }

  /** Un enemigo quieto en (x relativo al puesto, z). */
  put(kind: EnemyKind, x: number, z: number, mods?: EnemyMods): void {
    this.pending.push({ kind, x, z, mods });
  }

  /** Un enemigo en la fila frente al golfista: el `i`-ésimo, de más cerca a más lejos. */
  putInLine(kind: EnemyKind, i: number, mods?: EnemyMods): void {
    this.pending.push({ kind, x: 0, z: LINE_Z[i], mods, line: i });
  }

  /**
   * Un enemigo a `ahead` metros de la línea de los puestos, sobre la recta que sale de un punto corrido
   * `from` metros de la pelota (el paso de correrse con la pelota).
   */
  putOffLine(kind: EnemyKind, ahead: number, from: number, mods?: EnemyMods): void {
    this.pending.push({ kind, x: 0, z: this.host.player().anchor.z + ahead, mods, from });
  }

  /** Una loma, que crece desde el piso. */
  mound(x: number, z: number): void {
    this.pendingMounds.push({ x, z });
  }

  /** Vacía todos los puestos: las pelotas las van a tirar los caddies. */
  clearBalls(): void {
    const tees = this.host.tees;
    tees.spots.forEach((_, i) => tees.take(i));
  }

  /** ¿Cayeron todos los del paso? */
  get allDown(): boolean {
    return this.enemies.every((e) => !e.alive);
  }

  /** La nota corta abajo de la instrucción, hasta el próximo cambio. */
  note(text: string): void {
    this.noteText = text;
    this.render();
  }

  private say(text: string): void {
    this.text = text;
    this.noteText = '';
    this.render();
  }

  private render(): void {
    const s = this.step;
    const header = s ? L(`Tutorial · ${this.index + 1} de ${STEPS.length}`, `Tutorial · ${this.index + 1} of ${STEPS.length}`) : 'Tutorial';
    this.host.hud.setTutorial(header, s?.title ?? L('¡Listo!', 'Done!'), this.text, this.noteText);
  }

  /** La fila: dónde se para el `i`-ésimo, sobre la recta que sale de la pelota hacia `baseX`. */
  private linePoint(i: number, baseX: number): THREE.Vector3 {
    return this.rayPoint(LINE_Z[i], baseX, 0);
  }

  /** Sobre la recta que sale de `from` metros al costado de la pelota hacia `baseX`, a la altura `z`. */
  private rayPoint(z: number, baseX: number, from: number): THREE.Vector3 {
    const tee = this.host.player().anchor;
    const x0 = tee.x + from;
    return new THREE.Vector3(x0 + ((baseX - x0) * (z - tee.z)) / (LINE_FAR - tee.z), 0, z);
  }

  private spawnAt(s: Placed): Enemy {
    const e = this.host.horde.spawn(s.kind, s.at.clone(), s.mods);
    e.hold = s.at.clone();
    return e;
  }

  /**
   * Ubica lo que puso el paso: todo junto, corrido a lo ancho hasta la franja más plana cerca del
   * golfista. En un valle el enemigo queda un metro más abajo y el driver, que sale casi al ras, le pasa
   * por encima: en el tutorial eso confunde. El wedge se queda donde estaba el hierro, detrás de su loma.
   */
  private place(sameSpot: boolean): void {
    const ax = this.host.player().anchor.x;
    const at = (p: (typeof this.pending)[number], base: number) =>
      p.line !== undefined ? this.linePoint(p.line, base)
        : p.from !== undefined ? this.rayPoint(p.z, base, p.from)
          : new THREE.Vector3(base + p.x, 0, p.z);
    if (!sameSpot) {
      let best = 0;
      let bestScore = Infinity;
      for (let dx = -8; dx <= 8; dx += 0.5) {
        const points = this.pending.map((p) => at(p, ax + dx));
        if (this.lineUp) for (let i = 0; i < LINE_Z.length; i++) points.push(this.linePoint(i, ax + dx));
        let worst = 0;
        for (const p of points) worst = Math.abs(p.x) > 14 ? Infinity : Math.max(worst, Math.abs(heightAt(p.x, p.z)));
        const score = worst + 0.02 * Math.abs(dx);
        if (score < bestScore) {
          bestScore = score;
          best = dx;
        }
      }
      this.baseX = ax + best;
    }
    this.spots = this.pending.map((p) => ({ kind: p.kind, mods: p.mods, at: at(p, this.baseX) }));
    for (const s of this.spots) this.enemies.push(this.spawnAt(s));
    for (const p of this.pendingMounds) {
      const m: Mound = { x: this.baseX + p.x, z: p.z, height: 0, target: 2.4, rx: 4, rz: 2.2, owner: 0 };
      mounds.push(m);
      this.ownMounds.push(m);
    }
    this.pending = [];
    this.pendingMounds = [];
  }

  private next(): void {
    this.index++;
    this.enemies = [];
    this.lineUp = false;
    this.lockLearned = false;
    this.wasLocked = false;
    const s = this.step;
    // las lomas del paso anterior bajan solas (ver `Horde.updateMounds`), salvo que el paso siga ahí
    if (!s?.sameSpot) {
      for (const m of this.ownMounds) m.target = 0;
      this.ownMounds = [];
    }
    if (!s) {
      this.finished = true;
      this.say(L(
        'Ya sabés usar los cuatro palos. Ahora vienen de verdad: que no lleguen a la puerta.',
        `You know all four clubs. Now they're coming for real: don't let them reach the gate.`,
      ));
      this.wait = 3.5;
      return;
    }
    this.host.onlyClub(s.club);
    s.setup(this);
    this.place(!!s.sameSpot);
    this.say(s.text);
    this.host.hud.showBanner(s.title, L(`Paso ${this.index + 1} de ${STEPS.length}`, `Step ${this.index + 1} of ${STEPS.length}`), 2);
  }

  /** Vuelve a poner el paso como empezó: los vivos, sanos y en su lugar; los caídos, de nuevo. */
  resetStep(): void {
    this.enemies = this.enemies.map((e, i) => {
      const s = this.spots[i];
      if (!e.alive) return this.spawnAt(s);
      e.hp = e.maxHp;
      e.hold = s.at.clone();
      return e;
    });
    this.lockLearned = false;
    this.wasLocked = false;
    if (this.step) this.say(this.step.text);
  }

  /** El paso 5: cuando se clava la carga en el amarillo, los dos se ponen en fila frente al golfista. */
  watchLock(): void {
    const meter = this.host.player().meter;
    const locked = meter.locked;
    if (locked && !this.wasLocked && !this.lockLearned && qualityOf(meter.power) >= 2) {
      this.lockLearned = true;
      this.enemies.forEach((e, i) => { e.hold = this.linePoint(i, this.baseX); });
      this.say(L(`Esperá a que se pongan en fila, y soltá el ${KEY('click')}.`, `Wait for them to line up, then let go of ${KEY('click')}.`));
    }
    this.wasLocked = locked;
  }

  /**
   * Hacia dónde se puede apuntar desde `tee`: el ángulo (el de `Math.atan2(x, z)`) entre los enemigos
   * del paso, más un margen. Null = libre.
   */
  aimRange(tee: THREE.Vector3): [number, number] | null {
    if (this.wait > 0) return null;
    const alive = this.enemies.filter((e) => e.alive);
    if (!alive.length) return null;
    const angles = alive.map((e) => Math.atan2(e.position.x - tee.x, e.position.z - tee.z));
    return [Math.min(...angles) - AIM_MARGIN, Math.max(...angles) + AIM_MARGIN];
  }

  private mayKill(enemy: Enemy, shot: Shot): boolean {
    const s = this.step;
    if (!s || !this.enemies.includes(enemy)) return true;
    const why = !shot || shot.ability ? L('Con el palo', 'Use your club') : s.allow?.(this, shot) ?? null;
    if (why) this.note(why);
    return why === null;
  }

  onEvent(_: HordeEvent): void {
    // las notas salen de `mayKill`; al blindado le alcanza con el «blindado» que flota encima
  }

  onDuff(): void {
    // el «¡Pifia!» del juego y el gris del arco ya lo dicen
  }

  /** Terminó un tiro del golfista. */
  onShotDone(): void {
    if (this.wait > 0) return;
    this.step?.shotDone?.(this);
  }

  update(dt: number): void {
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
    const s = this.step;
    if (!s) return;
    if (!s.noSupply) this.supplyBall(dt);
    s.update?.(this, dt);
    if (this.allDown) {
      this.say(s.praise);
      this.host.hud.feedback(L('¡Bien!', 'Nice!'), 'good');
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
    this.end();
  }

  private end(): void {
    for (const m of this.ownMounds) m.target = 0;
    this.ownMounds = [];
    this.host.horde.mayKill = null;
    for (const e of this.enemies) e.hold = null;
    this.host.hud.setTutorial(null, '', '');
    this.host.finish();
  }
}
