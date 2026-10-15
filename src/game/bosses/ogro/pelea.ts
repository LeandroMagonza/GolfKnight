// El ogro bateador (ver docs/jefes/ogro.md): se planta a media cancha de costado, como un bateador, con el
// garrote en alto. Lo que le llega de frente a la zona de bateo (el círculo naranja del piso) lo batea: la
// pelota vuelve en línea hasta donde estabas, con la marca roja en el piso. Después del batazo queda
// abierto un rato (el círculo se pone dorado): ahí le entra todo. El globo del wedge cae a plomo y no lo
// puede batear, como al escudo. Según la versión, además:
// - se aburre: sin pelotas que batear, tira una piedra al aire y la batea a la puerta (cebarlo la corta);
// - batea a los que bajan por su carril (una fila de goblins) y los manda volando a la puerta;
// - el peloteo: la que te devuelve queda en tu línea como pelota dorada, y vale uno más cada vez.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { EnemyKind } from '../../../core/waves';
import type { Ball } from '../../balls';
import type { Enemy, EnemyScript, Horde } from '../../enemies';
import { analyzeSwing, type SwingClip } from '../../golfClips';
import { GATE_HALF_WIDTH, GATE_Z, GroundMark, LaneMark, SPAWN_Z, TEE_Z, disposeObject, fieldHalfAt, heightAt, nearestSpot, partStats, rockLook } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { ArcMark, Batazo, HURT_COLOR, HandGlow } from './partes';

/** Qué hace cada versión (ver index.ts). */
export interface OgroOpts {
  /** Batea las pelotas que le llegan de frente y te las devuelve. */
  returns: boolean;
  /** La que te devuelve queda en tu línea como pelota dorada, y vale uno más cada vez que va y vuelve. */
  rally: boolean;
  /** Sin pelotas que batear se impacienta, y batea una piedra a la puerta. */
  fungo: boolean;
  /** Una fila de goblins baja por su carril, y los batea contra la puerta (y a cualquiera que se meta). */
  queue: boolean;
  /**
   * Más apurado (15/10, «estaba muy fácil»): la que devuelve vuelve más rápido, queda abierto menos, se
   * impacienta antes y las piedras van una a la puerta y otra a vos (ver `QUICK`).
   */
  quick?: boolean;
  /** Se corre de costado a buscar al que viene y lo batea apenas llega (ver `SHUFFLE`). */
  shuffle?: boolean;
  /** La vida, sin la dificultad. */
  hp: number;
  /** La línea chica del cartel de arriba al empezar: cómo se le gana. */
  hint: string;
}

// ---- el cuerpo y dónde se planta ----

/** El ogro de dungeon.glb agrandado (el común mide 2.8 m): que se vea el jefe desde la cámara alta. */
const BODY = { height: 4.6, radius: 1.5 };
/** Vida de más por cada nivel de dificultad (además del talento de la vida del jefe). */
const HP_PER_LEVEL = 3;
/** Dónde se planta en cada fase: cada vez más cerca (z), y de costado hasta `STANCE_X` del centro. */
const STANCE_Z = [37, 32, 27];
const STANCE_X = 9;
/** Al cambiar de fase se corre por lo menos esto de costado: que haya que volver a apuntar. */
const STANCE_SHIFT = 6;
/** Entra corriendo desde acá (más cerca que el fondo: que no regale diez segundos caminando). */
const ENTRY_Z = 54;
const RUN_SPEED = 5.5;
const MOVE_SPEED = 3.2;
/** La fase sube con la vida que le sacaste o con el tiempo, lo que llegue antes: no se puede esperar sin fin. */
const PHASE_HP = [0.66, 0.33];
const PHASE_TIME = [55, 110];

// ---- el bate ----

/** El punto de bateo: donde estaría la pelota de golf, metros delante de él (mira de costado a la cancha). */
const HIT_AHEAD = 1.8;
/**
 * La zona de bateo: un círculo entre él y el punto de bateo. Lo que entra de frente (yendo hacia el fondo)
 * y más abajo que su cabeza más `top`, lo batea; el globo que cae a más de 45° no.
 */
const ZONE = { radius: 2.7, top: 1.2 };
/**
 * El golpe: cuánto antes de que llegue la pelota baja el palo (del tope al impacto), cuánto después del
 * impacto todavía la agarra, y lo que dura el final del golpe.
 */
const SWING = { lead: 0.15, grace: 0.2, follow: 0.4 };
/** Abierto después de cada batazo, por fase; y cuánto tarda en volver a levantar el palo (mientras lo levanta, todavía le entra). */
const OPEN = [2.9, 2.5, 2.1];
const RAISE = 0.55;
/** Sin bate para pelotas (la versión que solo batea enemigos): lo que tarda en volver a armarse. */
const OPEN_QUEUE_ONLY = 1.2;
/** Las primeras tantas veces que queda abierto, se avisa con letras. */
const OPEN_TOLD = 2;

/**
 * La pelota que devuelve: a qué velocidad vuelve según el golpe que le pegaste (1, 2, 3) y la fase, entre
 * qué tiempos de vuelo, qué tan alto va (en línea: poco arco), qué tan grande es la marca y cuánto te
 * saca. La cargada vuelve más rápido y pega más.
 */
const RETURN = { speed: [20, 24, 29], phaseSpeed: [1, 1.08, 1.16], minFlight: 0.75, maxFlight: 1.3, height: 1.6, radius: 1.4, damage: [1, 1, 2] };
/** El peloteo: cada vez que va y vuelve, la pelota dorada pega `bonus` más (hasta `max` vueltas) y vuelve un `speedUp` más rápido. */
const RALLY = { bonus: 1, max: 4, speedUp: 0.1 };
/**
 * La paciencia: tantos segundos con el palo en alto sin nada que batear (por fase), y tira una piedra al
 * aire (`toss` s, el aviso: el carril rojo hasta la puerta) y la batea. Vuela `flight` s y le saca
 * `damage` a la puerta. Una pelota que le llega mientras tanto se la corta.
 */
const FUNGO = { idle: [7, 5.5, 4.3], toss: 1.5, flight: 1.0, height: 2.5, damage: 1 };
/**
 * La fila de goblins: uno cada `every` s (por fase), que bajan a `speed` m/s por el carril (de `laneHalf`
 * de cada lado del punto de bateo, `laneLength` m hacia el fondo). Los cuerpos, en orden, por fase.
 */
const QUEUE = {
  every: [4.6, 3.7, 3.0],
  speed: 2.4,
  laneHalf: 1.4,
  laneLength: 28,
  kinds: [['goblin', 'goblin', 'goblina'], ['goblina', 'goblin', 'orc'], ['orc', 'goblina', 'goblina']] as EnemyKind[][],
  /** El primero sale a los tantos segundos de plantarse. */
  first: 2.5,
};
/** El círculo donde batea enemigos, alrededor del punto de bateo (más el radio de cada uno). */
const HIT_RADIUS = 1.5;
/**
 * Con `shuffle` (15/10, Leandro: «que se mueva para los costados, hacia donde sabe que viene un enemigo, y
 * le pegue más rápido»): la fila no baja por su carril sino cada uno por su columna, hasta su línea (`stopAt`
 * m delante del punto de bateo), y él se corre de costado a `speed` m/s al que llega primero. A los de la
 * escolta que cruzan su línea (de `band[0]` a `band[1]` m del punto) también los va a buscar. Batea y vuelve
 * a armarse en `open` s. Sale uno cada `every` s por fase (más espaciados que la fila: ahora casi no se le
 * escapa ninguno, y la primera tanda del bot perdió 10 de puerta en 40 s con los de la fila). Y el que
 * batea le saca 1 a la puerta, sea lo que sea (sin esto, el orco y el huargo sacaban 2).
 */
const SHUFFLE = { speed: 3.6, stopAt: 1, band: [-1, 4], spread: 13, open: 0.6, keep: 0.6, every: [6.2, 5.2, 4.4] };
/**
 * Con `quick`: la que devuelve vuelve `returnMul` veces más rápido (y vuela por lo menos `minFlight` s), abierto
 * `open` s por fase, se impacienta en `idle` s y tira la piedra en `toss` s; la piedra va a la puerta y a vos,
 * en el orden de `aims` (a vos, con la marca roja como la de las pelotas, y te saca `damage`).
 */
const QUICK = { returnMul: 1.35, minFlight: 0.55, open: [2.4, 2.1, 1.8], idle: [3.4, 2.8, 2.2], toss: 1.1, aims: ['gate', 'player', 'gate', 'gate', 'player'] as Aim[], damage: 1 };
/** El que batea a la puerta: cuánto vuela y qué tan alto (por arriba de tu línea). */
const FLY = { time: 1.7, height: 7 };

const COLORS = { guard: 0xff8a2a, open: 0xffd24a, idle: 0x9a9a9a, lane: 0xff5a3c };

type BatState = 'enter' | 'move' | 'raise' | 'guard' | 'swing' | 'open';
type Aim = 'gate' | 'player';

interface Flier {
  e: Enemy;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  damage: number;
}

interface Rock {
  mesh: THREE.Object3D;
  t: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  lane: LaneMark;
  /** En el aire hacia la puerta (después del batazo); antes, subiendo y bajando sobre el punto de bateo. */
  flying: boolean;
  /** Adónde la va a batear: a la puerta, o a vos (con `quick`). */
  aim: Aim;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function startOgro(ctx: BossCtx, o: OgroOpts): BossFight {
  const { horde, scene, effects, audio } = ctx;
  const hpMax = Math.round(o.hp + HP_PER_LEVEL * ctx.level + ctx.bonusHp);
  const title = L('Ogro bateador', 'Batter Ogre');

  let bat: BatState = 'enter';
  let batTime = 0;
  let openFor = 0;
  let phase = 0;
  let idle = 0;
  /** Ya resolvió el impacto de este golpe. */
  let struck = false;
  /** Por qué bajó el palo la última vez (para el registro). */
  let why = '';
  /** Cuántas veces quedó abierto (las primeras se avisan con letras). */
  let opens = 0;
  let toss: Rock | null = null;
  const rocks: Rock[] = [];
  const batazos: Batazo[] = [];
  const fliers: Flier[] = [];
  const falling: Enemy[] = [];
  const queue = new Set<Enemy>();
  let queueTimer = QUEUE.first;
  let queueCount = 0;
  /** Con `shuffle`: el que va a buscar ahora, y la columna por la que baja cada uno de la fila. */
  let target: Enemy | null = null;
  const column = new Map<Enemy, number>();
  /** Con `quick`: cuántas piedras tiró (para el orden de `QUICK.aims`), y las que van hacia vos, con su piedra. */
  let tossCount = 0;
  const rockShots = new Map<Batazo, THREE.Object3D>();
  // los tiempos que cambian con `quick`
  const idleFor = () => (o.quick ? QUICK.idle : FUNGO.idle)[phase];
  const tossFor = () => (o.quick ? QUICK.toss : FUNGO.toss);
  /** Pelotas que ya miró y no hay que volver a batear (las bateadas). */
  const seen = new WeakSet<Ball>();
  /** Las pelotas que ya conoce, para reconocer la que sale de un puesto con pelota dorada. */
  const known = new WeakSet<Ball>();
  /** El peloteo: cuántas veces fue y vino cada pelota, y en qué puesto quedó cada dorada. */
  const rallyOf = new Map<Ball, number>();
  const cashed = new WeakSet<Ball>();
  const rallySpots = new Map<number, { r: number; mark: GroundMark }>();
  const rallyTaken: { x: number; r: number; until: number }[] = [];
  const stats = { bateadas: 0, teDio: 0, piedras: 0, piedrasCortadas: 0, puerta: 0, bateados: 0, cazados: 0, peloteoMax: 0, peloteoCobrado: 0, abierto: 0, guardia: 0, fases: 0 };

  // el lugar de cada fase: de costado, lejos del anterior
  const stanceAt = (prevX: number | null) => {
    for (let i = 0; i < 12; i++) {
      const x = (ctx.rng() * 2 - 1) * STANCE_X;
      if (prevX === null || Math.abs(x - prevX) >= STANCE_SHIFT) return x;
    }
    return prevX !== null && prevX > 0 ? -STANCE_X * 0.7 : STANCE_X * 0.7;
  };
  const stance = new THREE.Vector3(stanceAt(null), 0, STANCE_Z[0]);

  // ---- el cuerpo ----
  const script: EnemyScript = {
    update(e) {
      // pesado y plantado: el empujón de los pelotazos no lo saca de su lugar (la zona tiene que quedarse quieta)
      e.knock.set(0, 0, 0);
      return true;
    },
    filter: (e, amount, shot) => amount + rallyBonus(e, shot),
    onDamage(_e, dealt) {
      if (bat === 'open' || bat === 'raise') stats.abierto += dealt;
      else if (bat === 'guard' || bat === 'swing') stats.guardia += dealt;
    },
    onDeath: () => died(),
  };
  const boss = horde.spawnCustom(partStats('ogre', { name: title, height: BODY.height, radius: BODY.radius, hp: hpMax, boss: true, heavy: true, score: 500 }), 'ogre', stance.x, ENTRY_Z, {}, script);

  // el golpe del ogro es el drive de los golfistas (todos los personajes comparten esqueleto y clips):
  // parado de costado, con el palo arriba en el tope del backswing, y la pelota sale hacia su izquierda
  const clip = boss.animator.clipList.find((c) => c.name === 'Golf Drive');
  let drive: SwingClip | null = null;
  try {
    drive = clip ? analyzeSwing(boss.body, clip, 1) : null;
  } catch {
    drive = null;
  }
  // de costado, para que lo que batea salga hacia tu línea
  const stanceHeading = wrap(Math.PI - (drive?.flightYaw ?? 0));
  /** El punto de bateo y el centro de la zona, donde está plantado ahora. */
  const hitPoint = new THREE.Vector3();
  const zoneCenter = new THREE.Vector3();
  // dónde estaría la pelota en el drive (al costado del cuerpo), en metros desde sus pies; sin el clip, adelante
  const side = new THREE.Vector3(0, 0, HIT_AHEAD);
  if (drive) {
    const k = boss.body.scale.x * boss.group.scale.x;
    side.set(drive.tee.x * k, 0, drive.tee.z * k);
    // sin pasarse: que la zona siga pegada a él
    if (side.length() > HIT_AHEAD) side.setLength(HIT_AHEAD);
    if (side.length() < 0.8) side.setLength(0.8);
  }
  side.applyAxisAngle(new THREE.Vector3(0, 1, 0), stanceHeading);
  const place = () => {
    hitPoint.copy(boss.position).add(side).setY(0);
    zoneCenter.copy(boss.position).addScaledVector(side, 0.5).setY(0);
  };
  place();

  // ---- lo que se ve ----
  const zoneRing = new GroundMark(scene, COLORS.guard, false, ZONE.radius);
  const zoneFill = new GroundMark(scene, COLORS.guard, true, ZONE.radius * 0.82);
  // la paciencia (rojo) y lo que le queda abierto (dorado): un arco alrededor de la zona
  const arc = new ArcMark(scene, HURT_COLOR, ZONE.radius + 0.25, ZONE.radius + 0.75);
  const glow = new HandGlow(scene, boss.body, COLORS.guard, 0.55);
  // el carril de los que batea: una franja hacia el fondo desde el punto de bateo, y el punto donde les pega
  const lane = o.queue ? new LaneMark(scene, COLORS.lane, QUEUE.laneHalf * 2) : null;
  const hitMark = o.queue ? new GroundMark(scene, COLORS.lane, true, HIT_RADIUS) : null;

  ctx.banner(title, o.hint, 4);

  // ---- las poses ----
  const posed = (t: number) => boss.animator.poseOneShot('Golf Drive', t);
  function pose(): void {
    const d = drive;
    boss.scriptGesture = 0;
    if (bat === 'enter' || bat === 'move') {
      boss.animator.clearOneShot();
      return;
    }
    if (!d) {
      // sin el clip de golf: el golpe de brazo de los comunes
      boss.scriptGesture = bat === 'open' ? 0 : 1;
      boss.scriptSwing = bat === 'swing' ? Math.min(1.25, 0.75 + (0.5 * batTime) / (SWING.lead + SWING.follow)) : 0.6;
      return;
    }
    if (bat === 'raise') posed(d.address + (d.top - d.address) * smooth(Math.min(1, batTime / RAISE)));
    else if (bat === 'guard') {
      // silenciado no puede tener el palo en alto: lo baja
      if (boss.silenced) boss.animator.clearOneShot();
      // un meneo chico arriba, como el bateador que espera
      else posed(d.top - 0.05 * (0.5 + 0.5 * Math.sin(ctx.clock() * 3.2)));
    } else if (bat === 'swing') {
      if (batTime < SWING.lead) posed(d.top + (d.impact - d.top) * (batTime / SWING.lead));
      else posed(d.impact + (d.end - d.impact) * Math.min(1, (batTime - SWING.lead) / SWING.follow));
    } else if (bat === 'open') {
      // se queda un momento en el final del golpe, y después baja el palo (abierto, cansado)
      if (batTime < 0.35) posed(d.end);
      else boss.animator.clearOneShot();
    }
  }

  // ---- las pelotas que le llegan ----

  /**
   * En cuánto entra esta pelota a la zona de bateo (0 si ya está adentro), o -1 si no va a entrar en
   * `horizon` s, si no le viene de frente, si le pasa por arriba o si cae a plomo (el globo).
   */
  function eta(b: Ball, horizon: number): number {
    const s = b.state;
    if (b.done || b.ricochet || b.phase || s.resting || seen.has(b)) return -1;
    // el golpe fantasma no lo ve venir (como la esquiva), y el silenciador lo apaga al tocarlo
    if (b.element === 'ghost' || b.element === 'silence') return -1;
    const h = Math.hypot(s.vel.x, s.vel.z);
    if (h < 0.6 || s.vel.z <= 0) return -1;
    // el globo le cae por arriba del palo (la regla del escudo: más empinado que 45°). Se mira el palo y
    // no solo el ángulo de ahora: el del wedge, cuando todavía está alto, baja a unos 44° y recién se
    // empina al caer, así que el ogro se tiraba a batearlo y erraba (quedaba abierto gratis)
    if (b.club.loftDeg >= 45 || Math.abs(s.vel.y) > h) return -1;
    const dx = s.pos.x - zoneCenter.x;
    const dz = s.pos.z - zoneCenter.z;
    const r = ZONE.radius;
    const c = dx * dx + dz * dz - r * r;
    let t = 0;
    if (c > 0) {
      const a = h * h;
      const q = 2 * (dx * s.vel.x + dz * s.vel.z);
      const disc = q * q - 4 * a * c;
      if (disc < 0 || q >= 0) return -1;
      t = (-q - Math.sqrt(disc)) / (2 * a);
      if (t > horizon) return -1;
    }
    // la altura a la que llega (sin la gravedad, que solo la baja): por arriba de su cabeza, pasa
    if (s.pos.y + s.vel.y * t - boss.position.y > boss.height + ZONE.top) return -1;
    return t;
  }

  /** Le pega a la pelota: desaparece acá y sale el batazo hacia donde estás parado. */
  function batBall(b: Ball): void {
    seen.add(b);
    b.done = true;
    const p = ctx.player();
    const from = new THREE.Vector3(b.state.pos.x, Math.max(1, b.state.pos.y), b.state.pos.z);
    const to = new THREE.Vector3(p.anchor.x, heightAt(p.anchor.x, p.anchor.z) + 0.2, p.anchor.z);
    // la de habilidad es gratis: vuelve como un golpe 1
    const q = b.ability ? 1 : Math.min(3, Math.max(1, b.quality));
    const rally = o.rally ? Math.min(RALLY.max, (rallyOf.get(b) ?? 0) + 1) : 0;
    const speed = RETURN.speed[q - 1] * RETURN.phaseSpeed[phase] * (1 + RALLY.speedUp * Math.max(0, rally - 1)) * (o.quick ? QUICK.returnMul : 1);
    const time = THREE.MathUtils.clamp(from.distanceTo(to) / speed, o.quick ? QUICK.minFlight : RETURN.minFlight, RETURN.maxFlight);
    batazos.push(new Batazo(scene, from, to, time, RETURN.height, RETURN.radius, RETURN.damage[q - 1], rally, rally > 1 ? 0xff7a00 : HURT_COLOR));
    stats.bateadas++;
    stats.peloteoMax = Math.max(stats.peloteoMax, rally);
    effects.spark(from, COLORS.guard);
    audio.ricochet();
    if (rally > 1) ctx.feedback(L((n: number) => `¡Peloteo ×${n}!`, (n: number) => `Rally ×${n}!`)(rally));
    // si estaba por batear la piedra, la suelta: se cae y se rompe
    if (toss) dropRock();
  }

  /** El peloteo: lo que suma la pelota dorada que le está pegando ahora (ver Horde.damage y filter). */
  function rallyBonus(e: Enemy, shot: Horde['shot']): number {
    if (!o.rally || !shot || shot.ability || !rallyOf.size) return 0;
    for (const [b, r] of rallyOf) {
      if (cashed.has(b) || b.club.id !== shot.club) continue;
      // el que pega de impacto lo anota en hitIds antes de pegar; el área, ya reventada, está cerca
      const near = Math.hypot(b.state.pos.x - e.position.x, b.state.pos.z - e.position.z) < e.radius + 6;
      if (!b.hitIds.has(e.id) && !(b.burst && near)) continue;
      cashed.add(b);
      stats.peloteoCobrado += r * RALLY.bonus;
      ctx.feedback(L((n: number) => `¡Peloteo! +${n}`, (n: number) => `Rally! +${n}`)(r * RALLY.bonus));
      return r * RALLY.bonus;
    }
    return 0;
  }

  /** La pelota dorada que cayó en `spot`: la anota y le pone su anillo. */
  function rallyBall(x: number, r: number): void {
    const spot = nearestSpot(ctx, x);
    ctx.tees.place(spot, true, true);
    const prev = rallySpots.get(spot);
    prev?.mark.dispose();
    const sx = ctx.spots()[spot];
    const mark = new GroundMark(scene, 0xffc23a, false, 0.75 + 0.15 * r).at(sx, TEE_Z);
    rallySpots.set(spot, { r: Math.max(r, prev?.r ?? 0), mark });
  }

  /** Reconoce la pelota que salió de un puesto con pelota dorada, para que cobre su peloteo. */
  function trackRally(): void {
    if (!o.rally) return;
    const now = ctx.clock();
    for (const [spot, info] of rallySpots) {
      const s = ctx.tees.spots[spot];
      if (s?.ball && s.golden) {
        info.mark.opacity(0.45 + 0.25 * Math.sin(now * 6));
        continue;
      }
      // ya no está: o la tiraron (la pelota nueva sale de ahí), o se fue
      rallyTaken.push({ x: ctx.spots()[spot], r: info.r, until: now + 0.8 });
      info.mark.dispose();
      rallySpots.delete(spot);
    }
    for (const b of ctx.balls.list) {
      if (known.has(b)) continue;
      known.add(b);
      if (b.ability) continue;
      const i = rallyTaken.findIndex((t) => Math.abs(t.x - b.from.x) < 1.7);
      if (i < 0) continue;
      rallyOf.set(b, rallyTaken[i].r);
      rallyTaken.splice(i, 1);
    }
    for (let i = rallyTaken.length - 1; i >= 0; i--) if (rallyTaken[i].until < now) rallyTaken.splice(i, 1);
    for (const b of rallyOf.keys()) if (b.done && b.settled) rallyOf.delete(b);
  }

  // ---- la piedra (cuando se aburre) ----

  const gateTarget = (x: number) => new THREE.Vector3(THREE.MathUtils.clamp(x * 0.25, -GATE_HALF_WIDTH * 0.75, GATE_HALF_WIDTH * 0.75), 1.4, GATE_Z + 0.8);

  function startToss(): void {
    const mesh = rockLook(0.38, 0x8a8478, 7);
    scene.add(mesh);
    const aim: Aim = o.quick ? QUICK.aims[tossCount++ % QUICK.aims.length] : 'gate';
    const to = gateTarget(hitPoint.x);
    const laneMark = new LaneMark(scene, HURT_COLOR, 1.6).between(hitPoint.x, hitPoint.z - 1, to.x, to.z + 0.5);
    toss = { mesh, t: 0, from: hitPoint.clone().setY(1.6), to, lane: laneMark, flying: false, aim };
    stats.piedras++;
    // el aviso con letras, solo las primeras veces: después se lee en el carril
    if (stats.piedras <= 2 || !o.quick) {
      ctx.feedback(aim === 'gate' ? L('¡Va a batear una piedra a la puerta!', 'He’s about to hit a rock at the gate!') : L('¡Va a batearte una piedra!', 'He’s about to hit a rock at you!'));
    }
  }

  /** La piedra se le cae: le llegó una pelota mientras la tenía en el aire (`cut`), o se movió. */
  function dropRock(cut = true): void {
    if (!toss) return;
    effects.explosion(toss.mesh.position.clone().setY(heightAt(toss.mesh.position.x, toss.mesh.position.z) + 0.3), 0.9, 0x9a8f80);
    disposeObject(scene, toss.mesh);
    toss.lane.dispose();
    toss = null;
    if (cut) stats.piedrasCortadas++;
  }

  function updateRocks(dt: number): void {
    if (toss) {
      // sube y baja sobre el punto de bateo: al terminar el aviso queda a la altura del palo
      toss.t += dt;
      const u = Math.min(1, toss.t / tossFor());
      toss.mesh.position.set(hitPoint.x, 1.4 + Math.sin(Math.PI * u) * 5.2, hitPoint.z);
      // la que va hacia vos: el carril te sigue hasta que la batea (la marca queda donde estabas)
      if (toss.aim === 'player') {
        const p = ctx.player();
        toss.lane.between(hitPoint.x, hitPoint.z - 1, p.anchor.x, p.anchor.z + 0.6);
      }
      toss.mesh.rotation.x += dt * 4;
      toss.lane.opacity(0.3 + 0.3 * Math.abs(Math.sin(toss.t * (5 + 10 * u))));
    }
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i];
      r.t += dt / FUNGO.flight;
      const u = Math.min(1, r.t);
      r.mesh.position.lerpVectors(r.from, r.to, u);
      r.mesh.position.y += Math.sin(Math.PI * u) * FUNGO.height;
      r.mesh.rotation.x += dt * 9;
      if (u < 1) continue;
      if (!ctx.over()) {
        ctx.hitGate(FUNGO.damage, boss);
        stats.puerta += FUNGO.damage;
      }
      effects.explosion(r.to.clone(), 1.6, 0x9a8f80);
      audio.bossRock();
      disposeObject(scene, r.mesh);
      r.lane.dispose();
      rocks.splice(i, 1);
    }
  }

  // ---- los que batea a la puerta ----

  /** ¿Lo puede batear? Los vivos que caminan, sin contar a los de otros jefes ni a los que ya vuelan. */
  const batable = (e: Enemy) => e !== boss && e.alive && !e.passed && !e.stats.boss && !fliers.some((f) => f.e === e) && (e.script === null || queue.has(e));
  /** En el punto de bateo; `slack` de más en el impacto, para que no se le escape el que está justo en el borde. */
  const inHit = (e: Enemy, slack = 0) => Math.hypot(e.position.x - hitPoint.x, e.position.z - hitPoint.z) < HIT_RADIUS + e.radius + slack;

  function launch(e: Enemy): void {
    queue.delete(e);
    column.delete(e);
    if (target === e) target = null;
    const f: Flier = { e, from: e.position.clone(), to: gateTarget(e.position.x).setY(0), t: 0, damage: o.shuffle ? 1 : Math.max(1, e.gateDamage) };
    fliers.push(f);
    stats.bateados++;
    e.script = {
      update(en, dt) {
        en.knock.set(0, 0, 0);
        f.t = Math.min(1, f.t + dt / FLY.time);
        en.position.lerpVectors(f.from, f.to, f.t);
        en.position.y = heightAt(en.position.x, en.position.z) + Math.sin(Math.PI * f.t) * FLY.height;
        // da vueltas en el aire, alrededor de la panza (el modelo gira desde los pies: se lo corre)
        const spin = (en.body.rotation.x -= dt * 11);
        const mid = en.height / 2;
        en.body.position.set(0, mid - mid * Math.cos(spin), -mid * Math.sin(spin));
        en.animator.setLocomotion('Running', 1.6);
        if (f.t >= 1) {
          if (!ctx.over()) {
            ctx.hitGate(f.damage, boss);
            stats.puerta += f.damage;
          }
          effects.explosion(en.position.clone().setY(0.8), 1.4, 0xd9832f);
          en.remove();
        }
        return true;
      },
      onDeath(en) {
        // lo bajaron en el aire: cae
        stats.cazados++;
        en.body.rotation.x = 0;
        en.body.position.set(0, 0, 0);
        falling.push(en);
      },
    };
    effects.spark(e.position.clone().setY(1), COLORS.lane);
  }

  function updateFliers(dt: number): void {
    for (let i = fliers.length - 1; i >= 0; i--) if (!fliers[i].e.alive) fliers.splice(i, 1);
    for (let i = falling.length - 1; i >= 0; i--) {
      const e = falling[i];
      const ground = heightAt(e.position.x, e.position.z);
      e.position.y = Math.max(ground, e.position.y - dt * 14);
      if (e.position.y <= ground || e.state === 'gone') falling.splice(i, 1);
    }
  }

  // ---- la fila de goblins ----

  function spawnQueue(dt: number): void {
    if (!o.queue || !boss.alive || ctx.over() || bat === 'enter') return;
    if ((queueTimer -= dt) > 0) return;
    queueTimer = (o.shuffle ? SHUFFLE.every : QUEUE.every)[phase];
    const kinds = QUEUE.kinds[phase];
    const kind = kinds[queueCount++ % kinds.length];
    const z = SPAWN_Z - 4;
    const half = fieldHalfAt(z) - 1;
    // con `shuffle`, cada uno baja por su columna (él se corre a buscarlo); si no, por el carril del palo
    const x = THREE.MathUtils.clamp(o.shuffle ? (ctx.rng() * 2 - 1) * SHUFFLE.spread : hitPoint.x + (ctx.rng() - 0.5) * 1.2, -half, half);
    const walker: EnemyScript = {
      update(e, dt2) {
        // sin el ogro, la fila se desarma: cada uno va a la puerta como cualquiera
        if (!boss.alive || ctx.over()) {
          release(e);
          return false;
        }
        if (e.frozen) {
          e.animator.setLocomotion('Idle', 1);
          return true;
        }
        if (o.shuffle) {
          // baja por su columna hasta la línea del ogro y ahí espera, mirando el palo: él viene a buscarlo
          const col = column.get(e) ?? e.position.x;
          if (e.walkToward(col, hitPoint.z + SHUFFLE.stopAt, QUEUE.speed, dt2, false, 0.25)) e.faceToward(hitPoint.x, hitPoint.z, dt2);
          return true;
        }
        // bajan por el carril hasta el punto de bateo; si el palo no está listo, esperan en fila. El de
        // adelante sigue caminando mientras baja el palo: antes, al empezar el golpe dejaba de estar «listo»
        // y el goblin daba un paso atrás, salía del círculo justo en el impacto y no volaba (15/10, Leandro:
        // «el goblin se queda parado un poco atrás, el ogro batea, y el goblin no sale volando»)
        const ahead = [...queue].filter((q) => q !== e && q.alive && q.position.z < e.position.z).length;
        const ready = (bat === 'guard' || bat === 'swing') && !boss.silenced;
        const stop = hitPoint.z + (ready && ahead === 0 ? 0 : HIT_RADIUS + 1.2 + ahead * 1.3);
        if (e.walkToward(hitPoint.x, stop, QUEUE.speed, dt2, false, 0.25)) e.faceToward(hitPoint.x, hitPoint.z - 5, dt2);
        return true;
      },
    };
    const e = horde.spawnCustom(partStats(kind, {}), kind, x, z, {}, walker);
    queue.add(e);
    column.set(e, x);
  }

  function release(e: Enemy): void {
    queue.delete(e);
    column.delete(e);
    if (e.alive && !fliers.some((f) => f.e === e)) e.script = null;
  }

  // ---- de costado, a buscar al que viene (`shuffle`) ----

  /** Cuánto tardaría en batear a `e`: lo que le falta para llegar a su línea, o a él para correrse, lo que sea más. */
  function costOf(e: Enemy): number {
    const reach = Math.abs(e.position.x - hitPoint.x) / SHUFFLE.speed;
    const dz = e.position.z - hitPoint.z;
    if (queue.has(e)) return Math.max(reach, Math.max(0, dz - SHUFFLE.stopAt) / QUEUE.speed) + 0.3 * reach;
    // los de la escolta: solo los que están cruzando su línea
    if (dz < SHUFFLE.band[0] || dz > SHUFFLE.band[1]) return Infinity;
    return reach + 0.5;
  }

  function pickTarget(): void {
    if (target && (!batable(target) || costOf(target) === Infinity)) target = null;
    let best: Enemy | null = null;
    let bestCost = Infinity;
    for (const e of horde.enemies) {
      if (!batable(e) || e.frozen) continue;
      const c = costOf(e);
      if (c < bestCost) {
        best = e;
        bestCost = c;
      }
    }
    // no cambia de idea por poco: que se lea a quién va a buscar
    if (best && (!target || bestCost < costOf(target) - SHUFFLE.keep)) target = best;
  }

  /** Se corre de costado (con los pasos de lado) para que el punto de bateo quede en la columna del que va a buscar. */
  function shuffleStep(dt: number): void {
    pickTarget();
    const half = fieldHalfAt(boss.position.z) - BODY.radius - 0.5;
    const goal = THREE.MathUtils.clamp((target ? target.position.x : stance.x) - side.x, -half, half);
    const dx = goal - boss.position.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), SHUFFLE.speed * (target ? 1 : 0.5) * dt);
    if (Math.abs(dx) < 0.08) {
      boss.animator.setLocomotion('Idle', 1);
      return;
    }
    boss.position.x += step;
    boss.position.y = heightAt(boss.position.x, boss.position.z);
    // mira a la línea (heading ~π): su derecha es +x
    const right = Math.sin(boss.heading + Math.PI / 2) * -1;
    boss.animator.setLocomotion(step * right > 0 ? 'Strafe Right' : 'Strafe Left', 1.2);
  }

  // ---- el ritmo del bate ----

  function startSwing(): void {
    bat = 'swing';
    batTime = 0;
    struck = false;
    idle = 0;
    audio.whoosh(1);
  }

  /** El impacto: los que están en el punto de bateo salen volando, y la piedra, si la tenía en el aire. */
  function strike(): void {
    struck = true;
    if (o.queue) {
      for (const e of horde.enemies) if (batable(e) && inHit(e, 0.5)) launch(e);
    }
    if (toss && toss.aim === 'player') {
      // hacia vos: como la pelota devuelta (la marca roja donde estás ahora), con la piedra en vez de la pelota
      const r = toss;
      toss = null;
      r.lane.dispose();
      const p = ctx.player();
      const from = r.mesh.position.clone();
      const to = new THREE.Vector3(p.anchor.x, heightAt(p.anchor.x, p.anchor.z) + 0.2, p.anchor.z);
      const speed = RETURN.speed[1] * RETURN.phaseSpeed[phase] * QUICK.returnMul;
      const time = THREE.MathUtils.clamp(from.distanceTo(to) / speed, QUICK.minFlight, RETURN.maxFlight);
      const shot = new Batazo(scene, from, to, time, RETURN.height, RETURN.radius, QUICK.damage, 0);
      shot.mesh.visible = false;
      batazos.push(shot);
      rockShots.set(shot, r.mesh);
      audio.bossThrow();
    } else if (toss) {
      const r = toss;
      toss = null;
      r.flying = true;
      r.t = 0;
      r.from.copy(r.mesh.position);
      rocks.push(r);
      audio.bossThrow();
    }
  }

  /** La fase de ahora: por la vida que le queda o por el tiempo, lo que llegue antes. */
  function phaseNow(): number {
    const left = boss.hp / Math.max(1, boss.maxHp);
    const byHp = left <= PHASE_HP[1] ? 2 : left <= PHASE_HP[0] ? 1 : 0;
    const t = ctx.clock();
    const byTime = t >= PHASE_TIME[1] ? 2 : t >= PHASE_TIME[0] ? 1 : 0;
    return Math.max(byHp, byTime);
  }

  function relocate(next: number): void {
    phase = next;
    stats.fases = phase;
    bat = 'move';
    batTime = 0;
    idle = 0;
    if (toss) dropRock(false);
    stance.set(stanceAt(stance.x), 0, STANCE_Z[phase]);
    ctx.feedback(L('¡El ogro se acerca!', 'The ogre moves in!'));
  }

  function updateBat(dt: number): void {
    batTime += dt;
    if (bat === 'enter' || bat === 'move') {
      const run = bat === 'enter';
      if (boss.walkToward(stance.x, stance.z, run ? RUN_SPEED : MOVE_SPEED, dt, run, 0.15)) {
        bat = 'raise';
        batTime = 0;
      }
      place();
      return;
    }
    // plantado: de costado a la cancha, como el bateador
    boss.heading = boss.heading + wrap(stanceHeading - boss.heading) * (1 - Math.exp(-8 * dt));
    boss.animator.setLocomotion('Idle', 1);
    // con `shuffle` se corre de costado mientras no esté bajando el palo
    if (o.shuffle && bat !== 'swing' && !ctx.over()) shuffleStep(dt);
    place();
    if (ctx.over()) return;
    const want = phaseNow();
    if (want > phase && bat !== 'swing') {
      relocate(want);
      return;
    }
    if (bat === 'raise') {
      if (batTime >= RAISE) {
        bat = 'guard';
        batTime = 0;
        idle = 0;
      }
      return;
    }
    if (bat === 'open') {
      if (batTime >= openFor) {
        bat = 'raise';
        batTime = 0;
      }
      return;
    }
    const balls = o.returns ? ctx.balls.list : [];
    if (bat === 'guard') {
      // silenciado baja el palo: no batea nada, y la paciencia no corre
      if (boss.silenced) {
        if (toss) dropRock(false);
        return;
      }
      // baja el palo cuando una pelota está por llegar, cuando uno entra al punto de bateo o cuando la
      // piedra que tiró ya bajó a la altura del palo
      const ball = balls.find((b) => eta(b, SWING.lead) >= 0);
      const go = !!ball || (o.queue && horde.enemies.some((e) => batable(e) && inHit(e))) || (!!toss && toss.t >= tossFor());
      // para el registro: por qué bajó el palo la última vez
      if (go) why = ball ? `${ball.club.id} ${ball.quality} y${ball.state.pos.y.toFixed(1)} v${ball.state.vel.x.toFixed(1)},${ball.state.vel.y.toFixed(1)},${ball.state.vel.z.toFixed(1)}` : toss ? 'piedra' : 'enemigo'; // i18n-ok: el registro
      if (!go) {
        if (o.fungo && !toss) {
          idle += dt;
          if (idle >= idleFor()) startToss();
        }
        return;
      }
      startSwing();
    }
    // bajando el palo: le pega a lo que entra a la zona hasta un poquito después del impacto
    if (batTime <= SWING.lead + SWING.grace) {
      for (const b of balls) {
        const t = eta(b, dt * 2.5);
        if (t >= 0) batBall(b);
      }
    }
    if (!struck && batTime >= SWING.lead) strike();
    if (batTime >= SWING.lead + SWING.follow) {
      bat = 'open';
      batTime = 0;
      openFor = o.returns ? (o.quick ? QUICK.open : OPEN)[phase] : o.shuffle ? SHUFFLE.open : OPEN_QUEUE_ONLY;
      // las primeras veces se avisa con letras; después alcanza con el círculo dorado
      if (o.returns && ++opens <= OPEN_TOLD) ctx.feedback(L('¡Abierto: pegale!', 'Open: hit him!'));
    }
  }

  // ---- lo que se ve, cada cuadro ----

  function draw(dt: number): void {
    const alive = boss.alive;
    const planted = bat !== 'enter' && bat !== 'move';
    const armed = o.returns && alive && planted && !boss.silenced && (bat === 'guard' || bat === 'swing');
    const open = alive && planted && (bat === 'open' || bat === 'raise' || (bat === 'guard' && boss.silenced));
    const pulse = 0.5 + 0.5 * Math.sin(ctx.clock() * 5);
    const zoneColor = armed ? COLORS.guard : open ? COLORS.open : COLORS.idle;
    zoneRing.at(zoneCenter.x, zoneCenter.z).color(zoneColor).opacity(!alive || !o.returns ? 0 : armed ? 0.55 + 0.3 * pulse : planted ? 0.5 : 0.25);
    zoneFill.at(zoneCenter.x, zoneCenter.z).color(zoneColor).opacity(!alive || !o.returns ? 0 : armed ? 0.13 + 0.07 * pulse : open ? 0.12 : 0.05);
    // el arco: rojo con la paciencia (o la piedra en el aire), dorado con lo que le queda abierto
    arc.at(zoneCenter.x, zoneCenter.z);
    if (!alive || !planted) arc.hide();
    else if (bat === 'open' && o.returns) arc.color(COLORS.open).opacity(0.8).fill(1 - batTime / Math.max(0.01, openFor));
    else if (toss) arc.color(HURT_COLOR).opacity(0.6 + 0.35 * pulse).fill(1);
    else if (o.fungo && bat === 'guard' && !boss.silenced) arc.color(HURT_COLOR).opacity(0.75).fill(idle / idleFor());
    else arc.hide();
    glow.update(dt, armed || (alive && o.queue && planted && bat === 'guard') ? 1 : 0, armed ? COLORS.guard : COLORS.lane);
    if (lane && hitMark) {
      const on = alive && planted;
      if (o.shuffle) {
        // la franja va del palo al que va a buscar: se lee a quién le toca
        const t = target && target.alive ? target : null;
        if (t) lane.between(hitPoint.x, hitPoint.z, t.position.x, Math.max(t.position.z, hitPoint.z + 0.5));
        lane.opacity(on && t ? 0.3 + 0.15 * pulse : 0);
      } else {
        const far = Math.min(hitPoint.z + QUEUE.laneLength, SPAWN_Z - 2);
        lane.between(hitPoint.x, hitPoint.z, hitPoint.x, far).opacity(on ? 0.2 : 0);
      }
      hitMark.at(hitPoint.x, hitPoint.z).opacity(on ? (bat === 'guard' && !boss.silenced ? 0.35 + 0.2 * pulse : 0.15) : 0);
    }
  }

  function died(): void {
    if (toss) dropRock(false);
    for (const e of [...queue]) release(e);
    for (const { mark } of rallySpots.values()) mark.dispose();
    rallySpots.clear();
  }

  return {
    get done() {
      return !boss.alive;
    },
    update(dt) {
      // muerto, la animación de caerse es del juego: no tocarle la pose
      if (boss.alive) {
        updateBat(dt);
        pose();
      }
      updateRocks(dt);
      for (let i = batazos.length - 1; i >= 0; i--) {
        const b = batazos[i];
        const rock = rockShots.get(b);
        const landed = b.update(dt);
        if (rock) {
          rock.position.copy(b.mesh.position);
          rock.rotation.x += dt * 9;
        }
        if (!landed) continue;
        // cayó: si seguís adentro de la marca, te pega
        const p = ctx.player();
        if (!ctx.over() && p.alive && Math.hypot(p.anchor.x - b.to.x, p.anchor.z - b.to.z) <= b.radius) {
          if (!p.invulnerable) stats.teDio++;
          ctx.hitPlayer(b.damage, b.to, boss);
        }
        effects.explosion(b.to.clone(), b.radius, rock ? 0x9a8f80 : HURT_COLOR);
        if (rock) {
          disposeObject(scene, rock);
          rockShots.delete(b);
        } else if (o.rally && !ctx.over()) rallyBall(b.to.x, b.rally);
        b.dispose();
        batazos.splice(i, 1);
      }
      updateFliers(dt);
      spawnQueue(dt);
      trackRally();
      draw(dt);
    },
    bot: {
      // donde va a caer una pelota devuelta
      danger(x, within) {
        return batazos.some((b) => Math.abs(b.to.x - x) < b.radius + 0.7 && b.left < within + 0.3);
      },
      weight(e) {
        if (e === boss) {
          if (bat === 'enter' || bat === 'move') return 1.5;
          if (!o.returns || boss.silenced) return 1.2;
          // abierto: castigarlo, si llega a tiempo
          if (bat === 'open') return openFor - batTime > 1.1 ? 3 : 0.3;
          // con la piedra en el aire, cualquier pelota se la corta
          if (toss || (o.fungo && idle > idleFor() - 1.5)) return 2.5;
          return 0.25;
        }
        if (queue.has(e)) return e.position.z - hitPoint.z < 12 ? 3 : 1.6;
        if (fliers.some((f) => f.e === e)) return 0.3;
        return 1;
      },
    },
    log: () => ({ ...stats, vida: Math.max(0, boss.hp), fase: phase, fila: queue.size, estado: bat, porque: why, golpe: drive ? `drive ${Math.round(THREE.MathUtils.radToDeg(drive.flightYaw))} tee ${drive.tee.x.toFixed(2)},${drive.tee.z.toFixed(2)} lado ${side.x.toFixed(1)},${side.z.toFixed(1)}` : 'brazo' }), // i18n-ok: el registro
    dispose() {
      if (toss) {
        disposeObject(scene, toss.mesh);
        toss.lane.dispose();
        toss = null;
      }
      for (const r of rocks) {
        disposeObject(scene, r.mesh);
        r.lane.dispose();
      }
      rocks.length = 0;
      for (const b of batazos) b.dispose();
      batazos.length = 0;
      for (const rock of rockShots.values()) disposeObject(scene, rock);
      rockShots.clear();
      for (const { mark } of rallySpots.values()) mark.dispose();
      rallySpots.clear();
      zoneRing.dispose();
      zoneFill.dispose();
      arc.dispose();
      glow.dispose();
      lane?.dispose();
      hitMark?.dispose();
    },
  };
}
