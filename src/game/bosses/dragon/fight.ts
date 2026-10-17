// La pelea del dragón (ver docs/jefes/dragon.md). Vuela todo el tiempo y hace dos cosas, una y otra vez:
//
// - **La pasada:** viene desde atrás tuyo (por arriba de la puerta) con enemigos agarrados en las patas, baja
//   en picada pasando la línea y va a soltarlos en la línea de 10 o de 20 (la marca en el piso dice dónde):
//   ahí frena y abre las garras. Si le pegás antes, los suelta donde le pegaste, y se golpean al caer.
// - **El fuego:** tira bolas de fuego para arriba que caen en tus puestos (3, después 5, 7 y 8): queman la
//   pelota que haya y te pegan si estás. Según la versión, todas juntas con aviso (`lluvia`), de a una a tu
//   puesto (`rafaga`), o cruzando de un lado al otro (`cruce`). Si le pegás mientras carga o escupe, se lo
//   cortás.
//
// Se le pega en el aire: las pelotas lo tocan en la franja de alturas que ocupa (`Enemy.hitBand`), así que el
// hierro y el globo del wedge le llegan, y el driver y el putter rasantes le pasan por abajo. Bajo (cuando trae
// enemigos, cuando se planta a tirar fuego, cuando cruza) le llega el hierro apuntado a su sombra; arriba, solo
// el wedge que le cae encima.
//
// El dragón es un enemigo de verdad (el cuerpo: su vida, la barra, los golpes) que este archivo mueve entero
// en `update`, que corre después de la horda. Los que trae en las patas también son enemigos de verdad: los
// lleva un guion hasta que tocan el piso, y de ahí caminan a la puerta como cualquiera.
import * as THREE from 'three';
import { ENEMIES, type EnemyKind } from '../../../core/waves';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { BossBar, GroundMark, LaneMark, TEE_Z, arcPoint, heightAt, nearestSpot, partStats } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { COLORS, DragonRig, LEGS, dragonLook, restPose, type LegId } from './look';

/** Cómo tira el fuego. */
export type FireMode = 'lluvia' | 'rafaga' | 'cruce';

export interface DragonCfg {
  fire: FireMode;
}

// ---- el cuerpo ----

/** La vida: la base, más una por nivel de dificultad, más la del talento del golpe 4. */
const HP = { base: 32, perLevel: 1 };
/**
 * El radio en el piso: lo que miden las áreas (el globo del wedge que cae al lado le pega si lo agarra), y
 * el cilindro que tocan las pelotas. Grande a propósito: así el hierro apuntado a la sombra le entra a más
 * de 1.2 m de alto (el arco de 27° sube medio metro por cada metro antes de caer).
 */
const RADIUS = 2.9;
/**
 * A qué altura vuela el centro del cuerpo: con enemigos en las patas (lo justo para que el más alto quede con
 * los pies a `MIN_BAND`: ver `carryAlt`; bajo, plantado tirando fuego o cruzando, es lo mismo con las garras:
 * `lowAlt`), a qué altura cuenta como «arriba» (planea en vez de aletear), y por arriba de todo (yendo a
 * buscar enemigos atrás tuyo: no se lo ve ni le llega nada).
 */
const ALT = { carry: 4.25, high: 9, over: 17 };
/**
 * Lo más bajo que lo tocan las pelotas. El driver sube como mucho 0.89 m (el centro de la pelota, en su tiro
 * fijo de 50 m a 3.5°) y el putter rueda: siempre le pasan por abajo. El hierro apuntado a la sombra le entra
 * a unos 1.1-1.2 m (ver `RADIUS`), y el wedge le cae de arriba.
 */
const MIN_BAND = 1.15;

/** Hasta qué altura lo tocan (sobre el centro del cuerpo: las alas). */
const BAND_TOP = 1.6;
/** Por debajo de esta altura (lo más bajo que tocan las pelotas) se marca su sombra: le llega el hierro. */
const IRON_REACH = 1.45;
/**
 * Hasta qué altura le llega lo que revienta en el piso (el globo del wedge que cae debajo: las áreas se miden en
 * el piso, sin altura). Más alto, solo le pega la pelota que lo toca en el aire.
 */
const AREA_REACH = 4;
/** Velocidades (m/s) y cuánto gira (rad/s). Por arriba de todo (yendo a buscar enemigos) va más rápido. */
const SPEED = { carry: 5, low: 8, high: 15, over: 20, turn: 1.8 };
/** Se apura solo: las velocidades suben hasta un `max` más en `ramp` s de pelea. */
const HURRY = { max: 0.25, ramp: 150 };
/**
 * La pasada viene **desde atrás tuyo** (de detrás de la cámara, por encima de la puerta) hacia el fondo: va a
 * buscar enemigos por arriba de todo (`ALT.over`: solo se ve su sombra cruzando la cancha), da la vuelta en
 * `BACK` (z, y de qué lado: x entre `side`) y vuelve con ellos hacia la línea. Así se lo ve todo el camino:
 * desde la cámara se ve la cancha hasta unos 37 m de los puestos (z 46), y lo que vuela se ve más arriba en la
 * pantalla (a 4 m de alto, como si estuviera 13 m más lejos): lo que venía del fondo quedaba debajo de la
 * barra de arriba.
 */
const BACK = { z: -18, side: [3, 11] };
/** Adónde se va cuando se termina la partida. */
const LEAVE_Z = 62;
/**
 * El respiro: después del fuego se va a dar vueltas al fondo (alrededor de z, fuera de la vista) `time` s antes
 * de la próxima pasada (menos con el apuro). Sin esto traía enemigos cada 10 s y la puerta caía antes del minuto.
 */
const REST = { z: 62, time: 6 };
/**
 * Dónde se planta a tirar el fuego (a unos 14 m de los puestos: parado de manos, más lejos queda debajo de la
 * barra de arriba), corrido hasta `span` del medio.
 */
const HOVER = { z: 23, span: 8 };
/** Por dónde cruza (`cruce`): a unos 12 m de los puestos, entrando y saliendo por `edge` (fuera de la vista). */
const CROSS = { z: 21, edge: 32 };

// ---- la pasada ----

/**
 * La pasada: por arriba tuyo pasa a `overAlt` (más bajo te tapa la cancha) hasta `diveZ`, y de ahí baja en
 * picada a la altura de llevarlos. Al llegar a la línea frena y se queda `hold` s abriendo las garras antes
 * de soltarlos (Leandro: «le pegás cuando va a dejar enemigos»).
 */
const PASS = { overAlt: 8, diveZ: 4, hold: 1.2 };
/** Las líneas donde suelta si no le pegás: a 10 o a 20 m de los puestos (los carteles del campo). */
const DROP_LINES = [10, 20];
/** De dónde a dónde (x) elige el lugar donde soltar. */
const DROP_SPAN = 10;
/**
 * Qué trae en cada pasada (la última se repite): dos, después tres, después cuatro, cada vez más duros. Con
 * una pasada cada 15-20 s, alcanza: la escolta ya viene más flaca (ver `escort` en index.ts).
 */
const CARRY: EnemyKind[][] = [
  ['goblin', 'goblina'],
  ['goblin', 'goblina'],
  ['goblin', 'orc'],
  ['goblina', 'orc', 'goblin'],
  ['orc', 'goblin', 'goblina'],
  ['skeleton', 'orc', 'goblin'],
  ['skeleton', 'orc', 'goblina', 'goblin'],
];
/** En qué patas los lleva, según cuántos: los dos primeros atrás. */
const LEG_ORDER: LegId[] = ['HL', 'HR', 'FL', 'FR'];
/** De dónde los agarra (qué parte de su altura queda arriba de la garra). */
const GRIP = 0.78;
/**
 * La caída: la gravedad, el empujoncito para arriba al soltarlos de un golpe, y lo que les saca el golpe contra
 * el piso (3: el goblin, la goblina y el orco se mueren; al esqueleto le queda 1). Como viene desde atrás tuyo,
 * los que suelta de un golpe caen más cerca que en la línea: tiene que valer la pena.
 */
const FALL = { gravity: 22, toss: 4.5, damage: 3 };

// ---- el fuego ----

/** Cuántas bolas tira cada vez (Leandro: «primero tira 3 spots, después 5, después 7 y al final 8»). */
const FIRE_COUNTS = [3, 5, 7, 8];
/** Todas juntas (`lluvia`): lo que carga (con las marcas ya en el piso), lo que vuelan, lo alto del arco. */
const RAIN = { charge: 1.7, flight: 1.3, arc: 13, after: 0.7 };
/** De a una a tu puesto (`rafaga`): lo que carga (sin marcas), cada cuánto escupe, lo que vuela cada una. */
const BURST = { charge: 1.0, every: 0.5, flight: 1.1, arc: 9 };
/** Cruzando (`cruce`): a cuántos metros antes del puesto la escupe, lo que vuela, lo alto. */
const SWEEP = { ahead: 2, flight: 1.0, arc: 6 };
/** Dónde quema: el radio en el piso (los puestos están a 4 m), y te pega 1. */
const BLAST = { radius: 1.7, damage: 1 };
/** El puesto quemado: cuánto arde (los guardias no tiran ahí) y cuánto tarda en volver la pelota quemada. */
const BURN = { time: 4 };
/** Cortarle el fuego mientras carga: el fuego le revienta en la boca, le saca esto de más y queda aturdido. */
const CHOKE = { damage: 3, stun: 1.2 };
/** El sacudón de cualquier golpe. */
const FLINCH = 0.35;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const approach = (v: number, to: number, rate: number, dt: number) => v + (to - v) * (1 - Math.exp(-rate * dt));
const wrap = (a: number) => {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

type Mode =
  | 'toBack' // va al fondo a buscar enemigos
  | 'run' // la pasada, con enemigos, hacia la línea
  | 'drop' // llegó a la línea: frena y los va a soltar
  | 'leave' // decide qué sigue
  | 'rest' // da vueltas al fondo, fuera de la vista: el respiro entre el fuego y la próxima pasada
  | 'approach' // viene a plantarse a tirar fuego
  | 'charge' // carga el fuego
  | 'spit' // ya lo tiró (todo junto)
  | 'burst' // la ráfaga, de a una
  | 'choke' // le cortaste el fuego: tose y se sacude
  | 'crossIn' // va a la punta para cruzar
  | 'cross'; // cruza tirando fuego

interface Prey {
  e: Enemy;
  leg: LegId;
  state: 'carried' | 'falling' | 'free';
  vy: number;
  knocked: boolean;
  spin: number;
}

/** Un aviso en un puesto: dónde va a caer una bola, y cuándo. */
interface Warn {
  spot: number;
  /** Cuándo cae (reloj de la pelea) y cuándo apareció (para el anillo que se cierra). */
  at: number;
  from: number;
  fill: GroundMark;
  ring: GroundMark;
  /** Ya salió la bola (no se corta más). */
  launched: boolean;
}

interface Fireball {
  core: THREE.Mesh;
  halo: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  flight: number;
  arc: number;
  warn: Warn;
}

interface Burn {
  spot: number;
  left: number;
  /** Se quemó una pelota acá (cuenta para el tope hasta que vuelve). */
  ball: boolean;
  char: THREE.Mesh;
  tick: number;
}

const coreGeo = new THREE.SphereGeometry(0.34, 10, 8);
const haloGeo = new THREE.SphereGeometry(0.7, 12, 8);
const charGeo = new THREE.IcosahedronGeometry(0.2, 0);
/** Lo que mide la plantilla del dragón (se arma una vez por partida). */
let lookHeight = 0;

export function startDragon(ctx: BossCtx, cfg: DragonCfg): BossFight {
  const { horde, scene, effects, audio, tees } = ctx;
  const spots = () => ctx.spots();
  const fx = () => effects.fx?.particles ?? null;

  // lo que mide el modelo quieto: con eso de alto, va a escala 1
  if (!horde.hasLook('dragon') || !lookHeight) lookHeight = horde.addLook('dragon', dragonLook());
  const tall = lookHeight;

  const stats = {
    pasadas: 0, traidos: 0, soltadosPorGolpe: 0, soltadosEnLinea: 0, fuegos: 0, bolas: 0, cortados: 0,
    quemadas: 0, aVos: 0, golpes: 0, alto: 0,
    // las pelotas que le pasaron por abajo (al entrar en su cilindro), por palo
    abajoDriver: 0, abajoPutter: 0, abajoHierro: 0, abajoWedge: 0,
  };

  // ---- el dragón ----

  let lastByShot = false;
  let pendingHit = false;
  let flinch = 0;
  let dead = false;
  /** Ya empezó a caer (muerto), y ya tocó el piso. */
  let fallen = false;
  let landed = false;
  const dragonScript: EnemyScript = {
    update(e) {
      // lo mueve todo `update` (después de la horda)
      e.knock.set(0, 0, 0);
      return true;
    },
    filter(e, amount, shot) {
      // los golpes de un tiro (o de una habilidad) cortan lo que esté haciendo; el fuego que muerde, no
      lastByShot = !!shot;
      // volando alto, lo que revienta en el piso no le llega: solo la pelota que lo toca en el aire
      const band = e.hitBand;
      if (band && band[0] > AREA_REACH && !ballInside(band)) return 0;
      return amount;
    },
    onDamage(_e, dealt) {
      if (dealt <= 0) return;
      flinch = FLINCH;
      if (lastByShot) {
        pendingHit = true;
        stats.golpes++;
      }
    },
    onDeath() {
      dead = true;
    },
  };
  const hp = HP.base + Math.round(ctx.level * HP.perLevel) + ctx.bonusHp;
  const startX = (ctx.rng() * 2 - 1) * 6;
  const dragon = horde.spawnCustom(partStats('golem', {
    name: L('Dragón', 'Dragon'), behavior: 'golem', height: tall, radius: RADIUS, hp, speed: 0, heavy: true, boss: true, tint: 0, damage: 2, gateDamage: 0, score: 600,
  }), 'dragon', startX, BACK.z - 10, {}, dragonScript);
  const rig = new DragonRig(dragon.body);
  const pose = restPose();
  // cuánto baja la garra desde el centro del cuerpo con las patas colgando (medido en el modelo)
  const clawHang = (() => {
    rig.apply({ ...pose, legs: 1, flapAmp: 0 }, 0);
    dragon.body.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    const base = new THREE.Vector3();
    dragon.body.getWorldPosition(base);
    return Math.max(...LEGS.map((id) => base.y - rig.claws[id].getWorldPosition(p).y));
  })();
  pose.flapAmp = 0.6;
  /** Bajo (plantado o cruzando), con las garras colgando a la altura de MIN_BAND. */
  const lowAlt = MIN_BAND + clawHang + 0.2;
  // la vida (el cartelito de arriba) va sobre el dragón, que vuela: es el sprite de la vida del enemigo
  const pips = dragon.group.children.find((c) => (c as THREE.Sprite).isSprite && c.renderOrder === 12) ?? null;

  /** Dónde está (en el piso), a qué altura vuela el centro del cuerpo, hacia dónde mira y a qué velocidad. */
  // arranca atrás tuyo, alto, yendo a dar la vuelta para la primera pasada
  const d = { x: startX, z: BACK.z - 10, alt: ALT.over, yaw: 0, speed: SPEED.over, turn: 0 };
  const hurry = () => 1 + HURRY.max * clamp01(ctx.clock() / HURRY.ramp);
  /** Va hacia (x, z) girando de a poco; devuelve cuánto le falta. */
  function steer(tx: number, tz: number, alt: number, speed: number, dt: number, altRate = 1.4): number {
    const want = Math.atan2(tx - d.x, tz - d.z);
    const turn = THREE.MathUtils.clamp(wrap(want - d.yaw), -SPEED.turn * dt, SPEED.turn * dt);
    d.yaw = wrap(d.yaw + turn);
    d.turn = approach(d.turn, turn / Math.max(1e-4, dt), 6, dt);
    d.speed = approach(d.speed, speed, 2.2, dt);
    d.x += Math.sin(d.yaw) * d.speed * dt;
    d.z += Math.cos(d.yaw) * d.speed * dt;
    d.alt = approach(d.alt, alt, altRate, dt);
    return Math.hypot(tx - d.x, tz - d.z);
  }
  /** Quieto en el aire en (x, z), mirando a los puestos. */
  function hover(tx: number, tz: number, alt: number, dt: number): void {
    d.x = approach(d.x, tx, 2.5, dt);
    d.z = approach(d.z, tz, 2.5, dt);
    d.alt = approach(d.alt, alt, 2, dt);
    d.speed = approach(d.speed, 0, 4, dt);
    d.turn = approach(d.turn, 0, 6, dt);
    d.yaw = wrap(d.yaw + wrap(Math.PI - d.yaw) * (1 - Math.exp(-4 * dt)));
  }

  // la sombra que dice «le llega el hierro»: un anillo naranja cuando vuela bajo
  const reachRing = new GroundMark(scene, COLORS.fire, false, RADIUS);

  // ---- lo que hace ----

  let mode: Mode = 'toBack';
  let timer = 0;
  /** Cuántas veces tiró fuego (para el 3, 5, 7, 8) y qué toca después de cada pasada. */
  let fires = 0;
  let crossSide = ctx.rng() < 0.5 ? 1 : -1;
  const hoverAt = { x: 0, z: HOVER.z };
  let burstLeft = 0;
  let pass: { x: number; z: number; mark: GroundMark; lane: LaneMark } | null = null;
  const prey: Prey[] = [];
  const warns: Warn[] = [];
  const balls: Fireball[] = [];
  const burns = new Map<number, Burn>();
  tees.closed = (i) => burns.has(i);
  /** Lo que tiene que cruzar (`cruce`): los puestos, en el orden en que pasa. */
  let sweep: number[] = [];
  let feedbackBurnt = 0;
  let carryAlt = ALT.carry;
  let backX = (ctx.rng() < 0.5 ? -1 : 1) * BACK.side[1];
  let chokeDamage = 0;

  const coreMat = new THREE.MeshBasicMaterial({ color: COLORS.fireCore });
  const haloMat = new THREE.MeshBasicMaterial({ color: COLORS.fire, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const charMat = new THREE.MeshStandardMaterial({ color: 0x1b1512, emissive: 0x5a1a08, emissiveIntensity: 0.6, roughness: 1, flatShading: true });

  const carrying = () => prey.some((p) => p.state === 'carried' && p.e.alive);
  const bandLow = () => dragon.hitBand?.[0] ?? 99;
  const reachable = () => bandLow() < IRON_REACH;

  // -- la pasada --

  function startPass(): void {
    mode = 'toBack';
    backX = (ctx.rng() < 0.5 ? -1 : 1) * (BACK.side[0] + ctx.rng() * (BACK.side[1] - BACK.side[0]));
  }

  /** Ya en el fondo: agarra a los que trae y sale a la pasada, hacia la línea de 10 o de 20. */
  function pickUp(): void {
    const kinds = CARRY[Math.min(stats.pasadas, CARRY.length - 1)];
    stats.pasadas++;
    // vuela lo justo para que al más alto le queden los pies a MIN_BAND
    carryAlt = MIN_BAND + clawHang + Math.max(...kinds.map((k) => ENEMIES[k].height * GRIP)) + 0.05;
    kinds.forEach((kind, i) => {
      const p: Prey = { e: null as unknown as Enemy, leg: LEG_ORDER[i], state: 'carried', vy: 0, knocked: false, spin: (ctx.rng() * 2 - 1) * 5 };
      const script: EnemyScript = {
        update(e) {
          // en las patas o cayendo lo mueve `update`; en el piso, camina a la puerta como cualquiera
          if (p.state === 'free') return false;
          e.knock.set(0, 0, 0);
          e.animator.setLocomotion('Idle', 1);
          return true;
        },
      };
      p.e = horde.spawnCustom({ ...ENEMIES[kind] }, kind, d.x, d.z, {}, script);
      p.e.hitBand = [-0.1, p.e.height + 0.1];
      prey.push(p);
      stats.traidos++;
    });
    const line = DROP_LINES[Math.floor(ctx.rng() * DROP_LINES.length)];
    // del otro lado del que viene: cruza la cancha un poco en diagonal
    const x = -Math.sign(d.x || 1) * ctx.rng() * DROP_SPAN;
    const z = TEE_Z + line;
    pass = { x, z, mark: new GroundMark(scene, COLORS.fire, true, 1.6).at(x, z).opacity(0.3), lane: new LaneMark(scene, COLORS.fire, 1.2) };
    pass.lane.opacity(0);
    mode = 'run';
    audio.growl();
  }

  /** Suelta a los que lleva: de un golpe (caen dando vueltas y se golpean) o en la línea (los deja). */
  function release(knocked: boolean): void {
    let n = 0;
    for (const p of prey) {
      if (p.state !== 'carried') continue;
      p.state = 'falling';
      p.knocked = knocked;
      p.vy = knocked ? -FALL.toss : 0;
      n++;
    }
    if (knocked) stats.soltadosPorGolpe += n;
    else stats.soltadosEnLinea += n;
    if (knocked && n) ctx.feedback(L('¡Los soltó!', 'It dropped them!'));
    pose.claws = 1;
    pass?.mark.dispose();
    pass?.lane.dispose();
    pass = null;
  }

  // -- el fuego --

  /** Qué puestos quema: primero el tuyo, después los que tienen pelota, después al azar. */
  function pickSpots(n: number): number[] {
    const all = spots().map((_, i) => i);
    const mine = nearestSpot(ctx, ctx.player().position.x);
    const withBall = all.filter((i) => i !== mine && tees.hasBall(i));
    const rest = all.filter((i) => i !== mine && !tees.hasBall(i));
    const shuffle = (l: number[]) => {
      for (let i = l.length - 1; i > 0; i--) {
        const j = Math.floor(ctx.rng() * (i + 1));
        [l[i], l[j]] = [l[j], l[i]];
      }
      return l;
    };
    return [mine, ...shuffle(withBall), ...shuffle(rest)].slice(0, Math.min(n, all.length - 1));
  }
  const fireCount = () => FIRE_COUNTS[Math.min(fires, FIRE_COUNTS.length - 1)];

  function warnAt(spot: number, at: number): Warn {
    const x = spots()[spot];
    const w: Warn = {
      spot, at, from: ctx.clock(), launched: false,
      fill: new GroundMark(scene, COLORS.fire, true, BLAST.radius).at(x, TEE_Z).opacity(0.15),
      ring: new GroundMark(scene, COLORS.fireCore, false, BLAST.radius * 1.6).at(x, TEE_Z).opacity(0.6),
    };
    warns.push(w);
    return w;
  }
  function dropWarn(w: Warn): void {
    w.fill.dispose();
    w.ring.dispose();
    const i = warns.indexOf(w);
    if (i >= 0) warns.splice(i, 1);
  }
  /** Saca los avisos de las bolas que todavía no salieron (le cortaste el fuego). */
  function cancelWarns(): void {
    for (const w of warns.slice()) if (!w.launched) dropWarn(w);
  }

  const muzzle = new THREE.Vector3();
  /** Escupe una bola al puesto del aviso `w`, que cae en `flight` s. */
  function spit(w: Warn, flight: number, arc: number): void {
    rig.muzzle.getWorldPosition(muzzle);
    const x = spots()[w.spot];
    const core = new THREE.Mesh(coreGeo, coreMat);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    core.position.copy(muzzle);
    halo.position.copy(muzzle);
    scene.add(core, halo);
    w.launched = true;
    w.at = ctx.clock() + flight;
    balls.push({ core, halo, from: muzzle.clone(), to: new THREE.Vector3(x, heightAt(x, TEE_Z) + 0.15, TEE_Z), t: 0, flight, arc, warn: w });
    stats.bolas++;
    audio.cast({ kind: 'shot', element: 'fire' });
    pose.jaw = 1;
  }

  function updateBalls(dt: number): void {
    const parts = fx();
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.t += dt / b.flight;
      const u = Math.min(1, b.t);
      // sube rápido y cae: el arco, con el tiempo estirado para que se lea la caída
      arcPoint(b.from, b.to, u, b.arc, b.core.position);
      b.halo.position.copy(b.core.position);
      b.halo.scale.setScalar(0.9 + 0.2 * Math.sin(ctx.clock() * 30 + i));
      if (parts) {
        const p = b.core.position;
        parts.spawn({ sprite: 'fireBlur', x: p.x, y: p.y, z: p.z, vx: (ctx.rng() - 0.5) * 1.5, vy: (ctx.rng() - 0.5) * 1.5, vz: (ctx.rng() - 0.5) * 1.5, life: 0.35, size: 1.1, sizeEnd: 0.25, color: 0xffd25a, colorEnd: 0xff3a12, intensity: 2, fadeOut: 0.4 });
        if (ctx.rng() < 0.3) parts.spawn({ sprite: 'smoke', frame: -1, layer: 'alpha', x: p.x, y: p.y, z: p.z, vy: 0.8, drag: 1.5, life: 0.7, size: 0.7, sizeEnd: 1.4, rot: ctx.rng() * 6, color: 0x4a403a, colorEnd: 0x2e2a28, alpha: 0.5, fadeOut: 0.5 });
      }
      if (u < 1) continue;
      scene.remove(b.core, b.halo);
      balls.splice(i, 1);
      impact(b.warn);
    }
  }

  /** Cae una bola en el puesto: quema la pelota que haya y te pega si estás. */
  function impact(w: Warn): void {
    dropWarn(w);
    const x = spots()[w.spot];
    const at = new THREE.Vector3(x, heightAt(x, TEE_Z) + 0.3, TEE_Z);
    effects.explosion(at, BLAST.radius + 0.3, COLORS.fire);
    audio.explosion(false);
    burnSpot(w.spot);
    const p = ctx.player();
    if (!ctx.over() && p.alive && !p.invulnerable && Math.abs(p.position.x - x) < BLAST.radius + 0.2) {
      ctx.hitPlayer(BLAST.damage, at, dragon);
      stats.aVos++;
    }
  }

  function burnSpot(spot: number): void {
    let b = burns.get(spot);
    if (!b) {
      const x = spots()[spot];
      const char = new THREE.Mesh(charGeo, charMat);
      char.position.set(x, heightAt(x, TEE_Z) + 0.18, TEE_Z);
      char.visible = false;
      scene.add(char);
      b = { spot, left: 0, ball: false, char, tick: 0 };
      burns.set(spot, b);
    }
    b.left = BURN.time;
    const p = ctx.player();
    // la tuya, mientras cargabas: el tiro se corta
    if (tees.hasBall(spot) && nearestSpot(ctx, p.position.x) === spot && p.mode === 'charging') p.cancelSwing();
    if (tees.take(spot)) {
      if (!b.ball) {
        b.ball = true;
        tees.held++;
      }
      b.char.visible = true;
      stats.quemadas++;
      audio.burnTick();
      if (feedbackBurnt++ < 2) ctx.feedback(L('¡Se quemó una pelota!', 'A ball got burned!'));
    }
  }

  function updateBurns(dt: number): void {
    const parts = fx();
    for (const [spot, b] of burns) {
      b.left -= dt;
      b.tick -= dt;
      const x = spots()[spot];
      if (parts && b.tick <= 0) {
        b.tick = 0.09;
        const k = clamp01(b.left / BURN.time);
        const y = heightAt(x, TEE_Z) + 0.1;
        parts.spawn({ sprite: 'flame', x: x + (ctx.rng() - 0.5) * 1.6, y, z: TEE_Z + (ctx.rng() - 0.5) * 1.2, vy: 1.5 + ctx.rng(), life: 0.45, size: 0.5 + 0.6 * k, sizeEnd: 0.1, color: 0xffd25a, colorEnd: 0xff3a12, intensity: 2, fadeOut: 0.5 });
        if (ctx.rng() < 0.25) parts.spawn({ sprite: 'smoke', frame: -1, layer: 'alpha', x, y: y + 0.4, z: TEE_Z, vy: 1.2, drag: 1, life: 1, size: 0.6, sizeEnd: 1.5, rot: ctx.rng() * 6, color: 0x3a3330, alpha: 0.45, fadeOut: 0.6 });
      }
      if (b.left > 0) continue;
      scene.remove(b.char);
      burns.delete(spot);
      if (b.ball) {
        tees.held = Math.max(0, tees.held - 1);
        // la pelota quemada vuelve a su puesto, si sigue libre (si no, la repone el guardia)
        if (!tees.hasBall(spot)) {
          tees.place(spot);
          effects.blink(new THREE.Vector3(x, 0.3, TEE_Z), 0xfff1b8);
        }
      }
    }
  }

  function startFire(): void {
    if (cfg.fire === 'cruce') {
      crossSide = -crossSide;
      mode = 'crossIn';
    } else {
      hoverAt.x = (ctx.rng() * 2 - 1) * HOVER.span;
      mode = 'approach';
    }
  }

  /** Le cortaste el fuego (o lo silenciaron) mientras cargaba: se le apaga, y con el golpe le revienta en la boca. */
  function choke(byHit: boolean): void {
    cancelWarns();
    stats.cortados++;
    fires++;
    if (byHit) {
      rig.muzzle.getWorldPosition(muzzle);
      effects.explosion(muzzle.clone(), 1.6, COLORS.fire);
      audio.explosion(true);
      chokeDamage += CHOKE.damage;
      ctx.feedback(L('¡Le cortaste el fuego!', 'You cut off its fire!'));
    }
    mode = 'choke';
    timer = byHit ? CHOKE.stun : 0.5;
  }

  /** Le pegaste: con enemigos, los suelta; cargando el fuego, se le corta; escupiendo, no sale el resto. */
  function interrupt(): void {
    if ((mode === 'run' || mode === 'drop') && carrying()) {
      release(true);
      d.alt += 1;
      mode = 'leave';
    } else if (mode === 'charge') choke(true);
    else if ((mode === 'burst' && burstLeft > 0) || (mode === 'cross' && warns.some((w) => !w.launched))) cut();
  }

  /** Le pegaste mientras escupía de a una: el resto no sale. */
  function cut(): void {
    cancelWarns();
    stats.cortados++;
    ctx.feedback(L('¡Le cortaste el fuego!', 'You cut off its fire!'));
    mode = 'leave';
  }

  // ---- los que trae ----

  const claw = new THREE.Vector3();
  function updatePrey(dt: number): void {
    for (let i = prey.length - 1; i >= 0; i--) {
      const p = prey[i];
      const e = p.e;
      if (p.state === 'free' || e.state === 'gone') {
        if (e.state === 'gone' || p.state === 'free') prey.splice(i, 1);
        continue;
      }
      // el que mataste en las patas se cae
      if (p.state === 'carried' && !e.alive) p.state = 'falling';
      if (p.state === 'carried') {
        rig.claws[p.leg].getWorldPosition(claw);
        e.position.set(claw.x, claw.y - e.height * GRIP, claw.z);
        e.heading = d.yaw;
        // cuelgan y patalean un poco
        e.body.rotation.z = 0.18 * Math.sin(ctx.clock() * 5 + i * 1.7);
        e.body.rotation.x = 0.1 * Math.sin(ctx.clock() * 3.3 + i);
        continue;
      }
      // cayendo
      p.vy += FALL.gravity * dt;
      e.position.y -= p.vy * dt;
      if (p.knocked) e.body.rotation.x += p.spin * dt;
      const ground = heightAt(e.position.x, e.position.z);
      if (e.position.y > ground) continue;
      e.position.y = ground;
      e.body.rotation.x = 0;
      e.body.rotation.z = 0;
      if (!e.alive) {
        // el que mataste en el aire queda donde cayó
        prey.splice(i, 1);
        continue;
      }
      p.state = 'free';
      e.hitBand = null;
      e.stunFor(p.knocked ? 0.8 : 0.4);
      effects.fx?.poof(e.position.clone(), 1.1, 0xb8a888);
      if (p.knocked) {
        audio.thud();
        horde.damage(e, FALL.damage, null, 0);
      }
      prey.splice(i, 1);
    }
  }

  // ---- el cuerpo, cuadro a cuadro ----

  const lowPoint = new THREE.Vector3();
  function place(dt: number): void {
    const ground = heightAt(d.x, d.z);
    dragon.position.set(d.x, ground, d.z);
    dragon.heading = d.yaw;
    // el sacudón del golpe
    const shake = flinch > 0 ? Math.sin((flinch / FLINCH) * Math.PI) : 0;
    pose.bank = THREE.MathUtils.clamp(-d.turn * 0.35, -0.6, 0.6) + 0.25 * shake;
    pose.flap += dt * Math.PI * 2 * (mode === 'charge' || mode === 'burst' || mode === 'choke' || mode === 'spit' || mode === 'drop' ? 1.7 : d.alt > ALT.carry + 2 ? 1.0 : 1.35);
    pose.tail += dt * 2.2;
    rig.apply(pose, d.alt - ground + shake * 0.5);
    dragon.group.updateMatrixWorld(true);
    // lo más bajo que tiene: los pies de los que trae, o las garras
    let low = Infinity;
    for (const id of LEGS) {
      rig.claws[id].getWorldPosition(lowPoint);
      low = Math.min(low, lowPoint.y - 0.15);
    }
    for (const p of prey) {
      if (p.state !== 'carried') continue;
      rig.claws[p.leg].getWorldPosition(lowPoint);
      low = Math.min(low, lowPoint.y - p.e.height * GRIP);
    }
    const top = d.alt + BAND_TOP;
    dragon.hitBand = [Math.max(MIN_BAND, low - ground), top - ground];
    if (pips) {
      pips.position.y = top - ground + 0.5;
      // pasando por arriba de la cámara, la vida se vería enorme
      pips.visible = d.z > 10 && dragon.alive;
    }
    const near = dragon.hitBand[0] < IRON_REACH && !dead;
    reachRing.at(d.x, d.z).opacity(near ? 0.45 + 0.2 * Math.sin(ctx.clock() * 6) : 0);
  }

  function animate(dt: number): void {
    const fireUp = mode === 'charge' || mode === 'spit' || mode === 'burst';
    const k = mode === 'charge' ? clamp01(1 - timer / (cfg.fire === 'rafaga' ? BURST.charge : RAIN.charge)) : fireUp ? 1 : 0;
    pose.neckUp = approach(pose.neckUp, mode === 'cross' ? 0.35 : fireUp ? 1 : 0, 5, dt);
    pose.pitch = approach(pose.pitch, fireUp ? 0.45 : mode === 'choke' ? 0.3 + 0.2 * Math.sin(ctx.clock() * 14) : mode === 'leave' || mode === 'toBack' ? 0.22 : mode === 'run' ? -0.05 : 0, 4, dt);
    pose.jaw = approach(pose.jaw, mode === 'charge' ? 0.4 + 0.4 * k : mode === 'choke' ? 0.6 + 0.4 * Math.sin(ctx.clock() * 18) : mode === 'cross' ? 0.5 : 0, 7, dt);
    pose.glow = approach(pose.glow, mode === 'charge' ? 0.3 + 0.7 * k : mode === 'burst' || mode === 'cross' ? 0.8 : 0, 8, dt);
    pose.legs = approach(pose.legs, carrying() || mode === 'charge' || mode === 'burst' || mode === 'spit' || mode === 'choke' || mode === 'cross' || mode === 'approach' ? 1 : 0, 3, dt);
    pose.claws = approach(pose.claws, mode === 'drop' ? 0.45 : carrying() ? 0 : mode === 'run' ? 1 : 0.3, 3, dt);
    pose.flapAmp = approach(pose.flapAmp, dragon.frozen ? 0 : d.alt > ALT.carry + 2 && mode !== 'leave' ? 0.55 : 1, 3, dt);
    // la boca que carga: llamitas que suben
    const parts = fx();
    if (parts && pose.glow > 0.25 && !dead) {
      rig.muzzle.getWorldPosition(muzzle);
      parts.spawn({ sprite: 'flame', x: muzzle.x + (ctx.rng() - 0.5) * 0.3, y: muzzle.y, z: muzzle.z + (ctx.rng() - 0.5) * 0.3, vy: 2.5, life: 0.3, size: 0.35 + 0.4 * pose.glow, sizeEnd: 0.05, color: 0xffd25a, colorEnd: 0xff3a12, intensity: 2.2, fadeOut: 0.5 });
    }
  }

  function think(dt: number): void {
    const sp = hurry();
    // un golpe corta lo que esté haciendo (también congelado: se le pega igual)
    if (pendingHit) {
      pendingHit = false;
      interrupt();
    }
    if (dragon.frozen || dragon.stunned) {
      // congelado o aturdido: se queda en el aire, sin hacer nada
      d.speed = approach(d.speed, 0, 6, dt);
      return;
    }
    // silenciado no tira fuego: si estaba por tirar, se le apaga
    if (dragon.silenced && (mode === 'charge' || mode === 'burst' || mode === 'cross')) {
      if (mode === 'charge') choke(false);
      else {
        cancelWarns();
        mode = 'leave';
      }
    }
    switch (mode) {
      case 'toBack': {
        // por arriba de todo hasta atrás tuyo; ahí da la vuelta (agarra a los enemigos) y baja
        const left = steer(backX, BACK.z, ALT.over, SPEED.over * sp, dt, 2);
        if (left < 6 || d.z < BACK.z + 2) pickUp();
        break;
      }
      case 'run': {
        if (!pass) {
          mode = 'leave';
          break;
        }
        // rápido mientras da la vuelta atrás de la cámara; por arriba tuyo pasa alto (para no taparte la
        // cancha) y baja en picada pasando la línea, a su paso
        const behind = d.z < PASS.diveZ;
        steer(pass.x, pass.z, behind ? PASS.overAlt : carryAlt, SPEED.carry * sp * (d.z < 0 ? 2.5 : 1), dt, behind ? 1.5 : 2.5);
        pass.lane.between(d.x, d.z, pass.x, pass.z).opacity(0.18);
        pass.mark.opacity(0.25 + 0.15 * Math.sin(ctx.clock() * 6));
        if (!carrying()) {
          // se los mataron a todos en el aire
          release(false);
          mode = 'leave';
        } else if (Math.hypot(pass.x - d.x, pass.z - d.z) < 1.6 || d.z > pass.z + 0.5) {
          // llegó: frena y se queda un momento abriendo las garras antes de soltarlos
          mode = 'drop';
          timer = PASS.hold;
        }
        break;
      }
      case 'drop': {
        if (!pass) {
          mode = 'leave';
          break;
        }
        hover(pass.x, pass.z, carryAlt, dt);
        pass.mark.opacity(0.35 + 0.25 * Math.sin(ctx.clock() * 12));
        pass.lane.opacity(0);
        if (!carrying() || (timer -= dt) <= 0) {
          release(false);
          mode = 'leave';
        }
        break;
      }
      case 'leave': {
        // pasada y fuego, uno y uno: de soltar a los enemigos da la vuelta y viene a plantarse (o a cruzar);
        // del fuego se va al fondo a dar vueltas un rato (el respiro para limpiar la cancha), y de ahí por
        // arriba tuyo a buscar más
        if (stats.pasadas > fires) startFire();
        else {
          mode = 'rest';
          timer = REST.time / sp;
        }
        break;
      }
      case 'rest': {
        // vueltas al fondo, alto, fuera de la vista
        const a = ctx.clock() * 0.9;
        steer(Math.sin(a) * 14, REST.z + Math.cos(a) * 8, ALT.high, SPEED.high * 0.8, dt, 1.2);
        if ((timer -= dt) <= 0) startPass();
        break;
      }
      case 'approach': {
        const left = Math.hypot(hoverAt.x - d.x, hoverAt.z - d.z);
        steer(hoverAt.x, hoverAt.z, lowAlt, Math.max(3, Math.min(SPEED.high * sp, left * 1.1)), dt, 1.8);
        if (left < 2.5) {
          mode = 'charge';
          timer = cfg.fire === 'rafaga' ? BURST.charge : RAIN.charge;
          stats.fuegos++;
          audio.growl();
          // todas juntas: las marcas desde que empieza a cargar
          if (cfg.fire === 'lluvia') for (const s of pickSpots(fireCount())) warnAt(s, ctx.clock() + timer + RAIN.flight);
        }
        break;
      }
      case 'charge': {
        hover(hoverAt.x, hoverAt.z, lowAlt, dt);
        if ((timer -= dt) > 0) break;
        if (cfg.fire === 'lluvia') {
          for (const w of warns) if (!w.launched) spit(w, RAIN.flight, RAIN.arc);
          fires++;
          mode = 'spit';
          timer = RAIN.after;
        } else {
          burstLeft = fireCount();
          fires++;
          mode = 'burst';
          timer = 0;
        }
        break;
      }
      case 'spit': {
        hover(hoverAt.x, hoverAt.z, lowAlt, dt);
        if ((timer -= dt) <= 0) mode = 'leave';
        break;
      }
      case 'burst': {
        hover(hoverAt.x, hoverAt.z, lowAlt, dt);
        if ((timer -= dt) > 0) break;
        if (burstLeft <= 0) {
          mode = 'leave';
          break;
        }
        // a tu puesto, el de ahora
        const spot = nearestSpot(ctx, ctx.player().position.x);
        spit(warnAt(spot, ctx.clock() + BURST.flight), BURST.flight, BURST.arc);
        burstLeft--;
        timer = burstLeft > 0 ? BURST.every / sp : 0.6;
        break;
      }
      case 'choke': {
        hover(hoverAt.x, hoverAt.z, lowAlt - 0.4, dt);
        if ((timer -= dt) <= 0) mode = 'leave';
        break;
      }
      case 'crossIn': {
        // a la punta de donde sale, por detrás de la línea por la que va a cruzar
        const left = steer(-crossSide * CROSS.edge, CROSS.z + 8, lowAlt, SPEED.high * sp, dt, 1.4);
        if (left < 4) {
          mode = 'cross';
          stats.fuegos++;
          audio.growl();
          const list = pickSpots(fireCount());
          sweep = list.sort((a, b) => (spots()[a] - spots()[b]) * crossSide);
          // los avisos, todos desde que arranca (cuándo cae cada una: cuando pasa por arriba, más el vuelo)
          for (const s of sweep) warnAt(s, ctx.clock() + Math.abs(spots()[s] - d.x) / (SPEED.low * sp) + SWEEP.flight);
          fires++;
        }
        break;
      }
      case 'cross': {
        steer(d.x + crossSide * 25, CROSS.z, lowAlt, SPEED.low * sp, dt, 1.8);
        // escupe la de cada puesto un poco antes de pasarle por arriba
        for (const w of warns) {
          if (w.launched) continue;
          if ((spots()[w.spot] - d.x) * crossSide <= SWEEP.ahead) spit(w, SWEEP.flight, SWEEP.arc);
        }
        if (d.x * crossSide > CROSS.edge) mode = 'leave';
        break;
      }
    }
  }

  /** ¿Hay una pelota adentro de lo que se le puede pegar (su cilindro, en la franja de alturas)? */
  function ballInside(band: [number, number]): boolean {
    const ground = dragon.position.y;
    return ctx.balls.list.some((b) => {
      const p = b.state.pos;
      const y = p.y - ground;
      return Math.hypot(p.x - dragon.position.x, p.z - dragon.position.z) < RADIUS + 0.6 && y > band[0] - 0.6 && y < band[1] + 0.6;
    });
  }

  /** Cuenta las pelotas que le pasan por abajo (las que entran en su cilindro más abajo de lo que tocan), por palo. */
  const seen = new WeakSet<object>();
  function watchBalls(): void {
    const band = dragon.hitBand;
    if (!band) return;
    const ground = dragon.position.y;
    for (const b of ctx.balls.list) {
      if (b.done || seen.has(b)) continue;
      const p = b.state.pos;
      if (Math.hypot(p.x - d.x, p.z - d.z) > RADIUS + 0.12) continue;
      seen.add(b);
      const y = p.y - ground;
      if (y < band[0] - 0.12 && !b.hitIds.has(dragon.id)) {
        if (b.club.id === 'driver') stats.abajoDriver++;
        else if (b.club.id === 'putter') stats.abajoPutter++;
        else if (b.club.id === 'iron') stats.abajoHierro++;
        else stats.abajoWedge++;
      }
    }
  }

  // ---- la caída ----

  let fall = { vy: 0, roll: 0, t: 0 };
  function crash(dt: number): void {
    if (landed) return;
    fall.t += dt;
    fall.vy += 14 * dt;
    d.alt -= fall.vy * dt;
    d.x += Math.sin(d.yaw) * d.speed * dt;
    d.z += Math.cos(d.yaw) * d.speed * dt;
    d.speed = approach(d.speed, 0, 1.5, dt);
    fall.roll += dt * 2.5;
    pose.flapAmp = approach(pose.flapAmp, 0.15, 3, dt);
    pose.pitch = approach(pose.pitch, -0.5, 3, dt);
    pose.neckUp = approach(pose.neckUp, 0, 3, dt);
    pose.legs = approach(pose.legs, 1, 3, dt);
    pose.glow = 0;
    const ground = heightAt(d.x, d.z);
    if (d.alt <= ground + 0.9) {
      d.alt = ground + 0.9;
      landed = true;
      effects.explosion(new THREE.Vector3(d.x, ground + 0.5, d.z), 4, 0x8a7a68);
      effects.fx?.poof(new THREE.Vector3(d.x, ground, d.z), 3, 0xb8a888);
      audio.explosion(true);
    }
    pose.flap += dt * 4;
    pose.bank = Math.min(0.9, fall.roll * 0.3);
    rig.apply(pose, d.alt - ground);
    dragon.position.set(d.x, ground, d.z);
    reachRing.opacity(0);
  }

  function die(): void {
    release(true);
    cancelWarns();
    fall = { vy: 0, roll: 0, t: 0 };
    bar.set(0, hp, '');
    ctx.banner(L('¡Cayó el Dragón!', 'The Dragon falls!'), '', 2.5);
  }

  // ---- la barra y el cartel ----

  const bar = new BossBar(L('El Dragón', 'The Dragon'));
  ctx.banner(
    L('¡El Dragón!', 'The Dragon!'),
    L('Pegale en el aire con el hierro o el wedge: el driver y el putter le pasan por abajo', 'Hit it in the air with the iron or the wedge: the driver and putter pass under it'),
    4,
  );
  const sub = () => {
    switch (mode) {
      case 'run':
        return L('Trae enemigos: pegale y los suelta ahí', 'Carrying enemies: hit it and it drops them there');
      case 'drop':
        return L('¡Los va a soltar! Pegale ya', 'About to drop them! Hit it now');
      case 'approach':
      case 'charge':
        return cfg.fire === 'rafaga'
          ? L('¡Va a escupir fuego a tu puesto! Pegale o no te quedes quieto', 'It will spit fire at your spot! Hit it or keep moving')
          : L('¡Va a tirar fuego! Pegale antes o salí de las marcas', 'Fire incoming! Hit it first or get off the marks');
      case 'burst':
        return L('¡Ráfaga! No te quedes quieto, o pegale', 'Barrage! Keep moving, or hit it');
      case 'crossIn':
      case 'cross':
        return L('¡Cruza tirando fuego! Pegale o esquivá', 'Crossing with fire! Hit it or dodge');
      case 'choke':
        return L('¡Le cortaste el fuego!', 'You cut off its fire!');
      default:
        return reachable() ? '' : L('Arriba: solo le llega el globo que le cae encima', 'Up high: only a lob that falls on it reaches it');
    }
  };

  return {
    get done() {
      return dead;
    },
    update(dt) {
      if (!dead && !dragon.alive) dead = true;
      if (dead && !fallen) {
        fallen = true;
        die();
      }
      if (dead) {
        crash(dt);
        updatePrey(dt);
        updateBalls(dt);
        updateBurns(dt);
        for (const w of warns.slice()) if (!w.launched) dropWarn(w);
        return;
      }
      if (chokeDamage > 0) {
        const n = chokeDamage;
        chokeDamage = 0;
        horde.damage(dragon, n, null, 0);
      }
      flinch = Math.max(0, flinch - dt);
      if (!ctx.over()) think(dt);
      else steer(d.x, LEAVE_Z + 20, ALT.high, SPEED.high, dt);
      animate(dt);
      place(dt);
      watchBalls();
      updatePrey(dt);
      updateBalls(dt);
      updateBurns(dt);
      for (const w of warns) {
        const u = clamp01((ctx.clock() - w.from) / Math.max(0.1, w.at - w.from));
        w.fill.opacity(0.15 + 0.4 * u);
        w.ring.size(BLAST.radius * (1.6 - 0.6 * u)).opacity(0.4 + 0.5 * u);
      }
      if (!reachable()) stats.alto += dt;
      bar.set(dragon.hp, dragon.maxHp, sub());
    },
    bot: {
      // donde va a caer una bola pronto; en la ráfaga, además, tu puesto (la próxima va ahí)
      danger(x, within) {
        const now = ctx.clock();
        for (const w of warns) if (Math.abs(spots()[w.spot] - x) < BLAST.radius + 0.6 && w.at - now < within + 0.35) return true;
        const burstSoon = (mode === 'burst' && burstLeft > 0) || (mode === 'charge' && cfg.fire === 'rafaga');
        return burstSoon && Math.abs(ctx.player().position.x - x) < BLAST.radius + 0.6;
      },
      // al dragón el driver y el putter no le llegan (le pasan por abajo)
      dealt(e, club, dmg) {
        return e === dragon && (club === 'driver' || club === 'putter') ? 0 : dmg;
      },
      // el dragón a tiro, sobre todo cuando carga o va a soltar (se le corta); arriba, casi nada. Poco: el bot
      // ya lo pesa como jefe (×3) y lo ve apurado (vuela cerca de la puerta), y con más se olvidaba de la
      // horda y perdía la puerta antes del minuto
      weight(e) {
        if (e === dragon) {
          if (!reachable()) return 0.2;
          if (mode === 'charge' || mode === 'burst' || mode === 'cross' || mode === 'drop') return 1.5;
          return carrying() ? 1.2 : 0.6;
        }
        return prey.some((p) => p.e === e && p.state === 'carried') ? 1.2 : 1;
      },
    },
    log: () => ({ ...stats, alto: Math.round(stats.alto), vida: Math.max(0, dragon.hp) }),
    dispose() {
      bar.dispose();
      reachRing.dispose();
      pass?.mark.dispose();
      pass?.lane.dispose();
      for (const w of warns.slice()) dropWarn(w);
      for (const b of balls) scene.remove(b.core, b.halo);
      for (const b of burns.values()) scene.remove(b.char);
      burns.clear();
      tees.closed = null;
      tees.held = 0;
      coreMat.dispose();
      haloMat.dispose();
      charMat.dispose();
    },
  };
}
