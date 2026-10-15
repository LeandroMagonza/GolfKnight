// La hidra (ver docs/jefes/hidra.md): la prueba del tempo, un tiro flojo ya o uno fuerte después.
//
// Se mete hasta media cancha, se planta y cada tanto se corre de costado. Tiene tres cabezas, cada una
// con su vida, que escupen: a tu puesto (corréte) o a la puerta (pegale a esa cabeza mientras carga: con
// cualquier golpe se corta). Al cortarle una cabeza, el cuello cae y el muñón queda brillando: hay que
// pegarle **con lo que sea** antes de que se cierre el anillo (unos 2 s), o le salen dos. El golpe 1 ya
// alcanza, así que gana el que tira rápido; el wedge, que pifia el golpe 1 y tarda en caer, no llega.
//
// Las partes son enemigos de verdad (las cabezas, los muñones, el cuerpo); los cuellos, los escupitajos y
// las marcas son adornos que maneja este archivo. Todo se acomoda en `update`, que corre después de la
// horda (y de que los enemigos se empujen entre sí): lo que se ve es lo que acá se decide.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { BossBar, GATE_Z, GroundMark, LaneMark, TEE_Z, arcPoint, heightAt, nearestSpot, partStats } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { COLORS, HEAD_Y, NECK_JOINT, bodyLook, cutGeo, flameGeo, globGeo, headLook, neckGeo, spikeGeo } from './look';

export interface Variant {
  /** Segundos para quemar el muñón antes de que le crezcan las cabezas. */
  window: number;
  /** Si no se quema a tiempo: le salen dos cabezas comunes, o una sola, más fuerte. */
  regrow: 'two' | 'strong';
  /**
   * El cuerpo: tapado mientras le quede alguna cabeza (y al descubierto un rato cuando no le queda
   * ninguna), o siempre se le puede pegar.
   */
  body: 'covered' | 'always';
  /** Con cuántas cabezas empieza (3 si no se dice). */
  heads?: number;
  /** Cuánto tarda en volver a salir una cabeza de un muñón quemado, en la versión «siempre» (`RESPROUT`). */
  resprout?: number;
  /** Por cuánto se multiplica el tiempo entre ataques (1 si no se dice; menos, más seguido). */
  pace?: number;
}

/** Dónde aparece, adónde va a plantarse (a unos 24 m de los puestos) y a qué paso. */
const ENTER_Z = 58;
const HOLD_Z = 33;
const ENTER_SPEED = 3;
/** Cada cuánto se corre de costado, a qué paso, y entre qué x (para no quedarse en un lugar). */
const WADE = { every: 16, speed: 1.4, span: 6, minStep: 4 };
/**
 * Cabezas al empezar, y cuántos cuellos le entran como mucho (eran 7; Leandro, 15/10: «quizás 7 cabezas es
 * mucho»).
 */
const HEADS_START = 3;
const SLOTS = 5;
/**
 * Dónde van las cabezas (15/10, Leandro: «algunas cabezas cerca del piso, que se les pueda pegar con el
 * driver, y que estén más separadas entre sí para que el wedge no les pegue a todas»). Los cuellos pares
 * (el del medio y los de las puntas) van **bajos**, adelante, con la cabeza casi en el piso: el driver
 * rasante las ve. Los impares, **altos**, más atrás. Entre una y la de al lado hay unos 4.5 m: un wedge
 * agarra una, o dos si cae justo entre las dos, pero no todas.
 */
const SPREAD = { gap: 3.9, lowZ: 5.8, highZ: 3.8 };
/** Altura de la cabeza de un cuello bajo (la de los altos es HEAD_Y). */
const HEAD_LOW = 1.25;
const isLow = (i: number) => i % 2 === 0;
/** Cuántas piedras lleva el cuello de cada lugar (del medio para afuera): los de las puntas son largos. */
const NECK_LINKS = [11, 12, 16];
/** Vida de cada cabeza (más con la dificultad: +1 cada 4 niveles) y del cuerpo, según la versión. */
const HEAD_HP = 5;
const BODY_HP = { covered: 30, always: 75 };
/** La cabeza que vuelve sola y más fuerte: cuánta más vida, cuánto más grande y cuántas veces más ataca. */
const STRONG = { hp: 1.8, scale: 1.2, weight: 2 };
/** El cuerpo tapado: cuánto queda al descubierto cuando se queda sin cabezas, antes de que le vuelvan a salir. */
const BODY_WINDOW = 10;
/** El cuerpo siempre al descubierto: cuánto tarda en volver a salir una cabeza de un muñón quemado. */
const RESPROUT = 15;
/** Lo que tarda en crecer una cabeza nueva, desde que sale el cuello. */
const BUD_TIME = 1.3;
/**
 * El muñón recién abierto no recibe por un instante: si no, la misma pelota que cortó la cabeza (el driver
 * que atraviesa, el área del hierro) lo quemaba en el acto, y no habría segundo tiro.
 */
const STUMP_ARM = 0.3;
/** El escupitajo a tu puesto: cuánto avisa, cuánto vuela, el radio donde te moja y lo alto del arco. */
const SPIT = { windup: 1.2, flight: 0.85, radius: 1.6, arc: 4 };
/** El de la puerta: avisa más (hay que llegar a pegarle a la cabeza), vuela más y saca 1. */
const GATE_SPIT = { windup: 2.4, flight: 1.3, arc: 7, damage: 1 };
/**
 * Entre un ataque y el siguiente (de cualquier cabeza): de `start` a `end` segundos en los primeros `ramp`
 * de pelea, con tres cabezas; con más cabezas, más seguido (por la raíz de cuántas más). Uno de cada
 * `gateEvery` va a la puerta (primero uno de cada tres; desde `gateLate` s, uno de cada dos).
 */
const GAP = { start: 3.2, end: 1.8, ramp: 150, gateEvery: 3, gateLate: 70 };
/** Lo que dura el latigazo de la cabeza al escupir, y la sacudida al recibir un golpe. */
const SNAP = 0.35;
const RECOIL = 0.35;

/** Los cuellos en el cuerpo (que mira a +z): de dónde salen, de izquierda a derecha. */
function shoulderOf(i: number): THREE.Vector3 {
  const k = i - (SLOTS - 1) / 2;
  return new THREE.Vector3(k * 0.55, (isLow(i) ? 2.15 : 2.45) - Math.abs(k) * 0.1, 1.7 - Math.abs(k) * 0.15);
}
/** Dónde está, quieta, la cabeza de cada cuello (en el piso, en el modelo del cuerpo). */
function restOf(i: number): THREE.Vector3 {
  const k = i - (SLOTS - 1) / 2;
  return new THREE.Vector3(k * SPREAD.gap, 0, isLow(i) ? SPREAD.lowZ - Math.abs(k) * 0.3 : SPREAD.highZ);
}
/** En qué orden se ocupan los cuellos libres: del medio para afuera. */
const FILL_ORDER = [2, 1, 3, 0, 4];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (u: number) => {
  const v = clamp01(u);
  return v * v * (3 - 2 * v);
};
const approach = (v: number, to: number, rate: number, dt: number) => v + (to - v) * (1 - Math.exp(-rate * dt));

type SlotState = 'empty' | 'head' | 'stump' | 'sealed' | 'bud';

interface Attack {
  kind: 'player' | 'gate';
  t: number;
  windup: number;
  /** Adónde va: el puesto (a la altura de los puestos) o la puerta. */
  to: THREE.Vector3;
  mark: GroundMark | null;
  lane: LaneMark | null;
}

interface Glob {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  flight: number;
  arc: number;
  kind: 'player' | 'gate';
  source: Enemy;
  /** La marca del puesto, que queda hasta que cae. */
  mark: GroundMark | null;
}

/** Un cuello (adorno): piedras sobre una curva, púas, y el corte del muñón con su llamita. */
class Neck {
  readonly group = new THREE.Group();
  private readonly segs: THREE.Mesh[] = [];
  private readonly spikes: THREE.Mesh[] = [];
  readonly cut: THREE.Mesh;
  readonly flame: THREE.Mesh;
  readonly cutMat = new THREE.MeshBasicMaterial({ color: COLORS.ember });
  readonly flameMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.85, depthWrite: false });
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.7);
  private readonly up = new THREE.Vector3(0, 1, 0);
  constructor(scene: THREE.Scene, scaleMat: THREE.Material, darkMat: THREE.Material, boneMat: THREE.Material, count = 10) {
    for (let k = 0; k < count; k++) {
      const m = new THREE.Mesh(neckGeo, k % 3 === 1 ? darkMat : scaleMat);
      m.castShadow = true;
      this.segs.push(m);
      this.group.add(m);
      if (k % 2 === 0 && k < count - 1) {
        const s = new THREE.Mesh(spikeGeo, boneMat);
        this.spikes.push(s);
        this.group.add(s);
      }
    }
    this.cut = new THREE.Mesh(cutGeo, this.cutMat);
    this.flame = new THREE.Mesh(flameGeo, this.flameMat);
    this.group.add(this.cut, this.flame);
    scene.add(this.group);
  }

  /** Punto de la curva (bezier cúbica) en u. */
  private point(p: THREE.Vector3[], u: number, out: THREE.Vector3): THREE.Vector3 {
    const v = 1 - u;
    return out.set(0, 0, 0)
      .addScaledVector(p[0], v * v * v)
      .addScaledVector(p[1], 3 * v * v * u)
      .addScaledVector(p[2], 3 * v * u * u)
      .addScaledVector(p[3], u * u * u);
  }

  /**
   * Lo dibuja sobre la curva `p` (cuatro puntos: el hombro, dos de control y la punta), de grosor `thick`.
   * `cut`: cómo se ve la punta (nada, el muñón abierto que late, el quemado, o el brote que crece).
   */
  draw(p: THREE.Vector3[], thick: number, cut: 'none' | 'open' | 'char' | 'bud', pulse = 0): void {
    const n = this.segs.length;
    let spike = 0;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      this.point(p, u, this.a);
      this.point(p, Math.min(1, u + 0.05), this.b);
      const m = this.segs[k];
      m.position.copy(this.a);
      m.lookAt(this.b);
      const r = (0.6 - 0.24 * u) * thick;
      m.scale.set(r, r, r * 1.45);
      if (k % 2 === 0 && k < n - 1) {
        const s = this.spikes[spike++];
        s.quaternion.copy(m.quaternion).multiply(this.tilt);
        s.position.copy(this.a).addScaledVector(this.up.set(0, 1, 0).applyQuaternion(m.quaternion), r * 0.85);
        s.scale.setScalar(thick);
      }
    }
    const showCut = cut !== 'none';
    this.cut.visible = showCut;
    this.flame.visible = cut === 'open';
    if (!showCut) return;
    // la punta: el corte mira hacia afuera del cuello
    this.point(p, 1, this.a);
    this.point(p, 0.94, this.b);
    const dir = this.a.clone().sub(this.b).normalize();
    this.cut.position.copy(this.a);
    this.cut.quaternion.setFromUnitVectors(this.up.set(0, 1, 0), dir);
    const r = 0.95 * thick;
    this.cut.scale.set(r, 1, r);
    if (cut === 'open') {
      this.cutMat.color.setHex(COLORS.ember).lerp(new THREE.Color(0xfff0a0), 0.5 + 0.5 * pulse);
      this.flame.position.copy(this.a).addScaledVector(dir, 0.35);
      this.flame.quaternion.copy(this.cut.quaternion);
      this.flame.scale.set(1, 0.7 + 0.6 * pulse, 1);
      this.flameMat.opacity = 0.55 + 0.35 * pulse;
    } else if (cut === 'bud') {
      this.cutMat.color.setHex(COLORS.acid).lerp(new THREE.Color(0xffffff), 0.3 * pulse);
    } else {
      this.cutMat.color.setHex(COLORS.char);
    }
  }

  show(on: boolean): void {
    this.group.visible = on;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.cutMat.dispose();
    this.flameMat.dispose();
  }
}

interface Slot {
  i: number;
  state: SlotState;
  head: Enemy | null;
  stump: Enemy | null;
  /** Lo que le queda al muñón, al brote o al quemado para volver a salir. */
  timer: number;
  /** El muñón: cuánto lleva abierto (para la marca y el seguro del principio). */
  age: number;
  strong: boolean;
  /** El brote que viene: si va a ser una cabeza fuerte. */
  budStrong: boolean;
  attack: Attack | null;
  snap: number;
  recoil: number;
  phase: number;
  /** Lo que baja la cabeza de este cuello desde HEAD_Y (los bajos, ver `isLow`): la base de `rise`. */
  base: number;
  /** La animación de la cabeza (ver `animateHead`); `rise` ya trae `base`. */
  rise: number;
  back: number;
  tilt: number;
  jaw: number;
  /** Cuánto cuelga el cuello (0 arriba, con su cabeza; 1 caído, el muñón) y dónde está su punta. */
  droop: number;
  readonly end: THREE.Vector3;
  /** Dónde cayó el muñón (en el piso). */
  readonly stumpAt: THREE.Vector3;
  neck: Neck;
  ring: GroundMark | null;
}

/** Lo que sale del cuello de la cabeza (en el modelo de la cabeza): para que la cabeza y el cuello se toquen. */
function jointOf(e: Enemy, s: Slot, out: THREE.Vector3): THREE.Vector3 {
  const k = s.strong ? STRONG.scale : 1;
  const h = e.heading;
  const lx = NECK_JOINT.x * k;
  const ly = (NECK_JOINT.y + s.rise) * k;
  const lz = (NECK_JOINT.z - s.back) * k;
  return out.set(e.position.x + lx * Math.cos(h) + lz * Math.sin(h), e.position.y + ly, e.position.z - lx * Math.sin(h) + lz * Math.cos(h));
}

/** Lo que miden los modelos (los mide `addLook`): la vida del enemigo va a esa altura, sin escalar. */
const measured = { body: 3.2, head: HEAD_Y + 0.9, low: HEAD_LOW + 0.9 };

/** Las partes de una cabeza que se animan, buscadas una sola vez. */
interface HeadParts {
  head: THREE.Object3D | null;
  jaw: THREE.Object3D | null;
  eyes: THREE.MeshStandardMaterial[];
  mouth: THREE.MeshStandardMaterial | null;
}

export function startHydra(ctx: BossCtx, v: Variant): BossFight {
  const { horde, scene } = ctx;
  const level = ctx.level;
  const headHp = HEAD_HP + Math.floor(level / 4);
  const bodyHp = BODY_HP[v.body] + ctx.bonusHp + level;

  if (!horde.hasLook('hidra-cuerpo')) measured.body = horde.addLook('hidra-cuerpo', bodyLook());
  if (!horde.hasLook('hidra-cabeza')) measured.head = horde.addLook('hidra-cabeza', headLook());
  if (!horde.hasLook('hidra-cabeza-fuerte')) horde.addLook('hidra-cabeza-fuerte', headLook(COLORS.strong));
  // las de los cuellos bajos: el mismo modelo con la cabeza abajo, así la vida va encima de la cabeza
  if (!horde.hasLook('hidra-cabeza-baja')) measured.low = horde.addLook('hidra-cabeza-baja', headLook(COLORS.scale, HEAD_LOW));
  if (!horde.hasLook('hidra-cabeza-fuerte-baja')) horde.addLook('hidra-cabeza-fuerte-baja', headLook(COLORS.strong, HEAD_LOW));
  if (!horde.hasLook('hidra-munon')) {
    // el muñón es solo la columna donde le pegan: lo que se ve es la punta del cuello (ver Neck)
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.4), new THREE.MeshStandardMaterial({ color: 0, transparent: true, opacity: 0 }));
    m.position.y = 0.65;
    m.visible = false;
    g.add(m);
    horde.addLook('hidra-munon', g);
  }
  const HEAD_H = measured.head;
  const parts = new WeakMap<Enemy, HeadParts>();
  const partsOf = (e: Enemy): HeadParts => {
    let p = parts.get(e);
    if (!p) {
      p = { head: e.body.getObjectByName('head') ?? null, jaw: e.body.getObjectByName('jaw') ?? null, eyes: [], mouth: null };
      e.body.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (o.name === 'eye') p!.eyes.push(m.material as THREE.MeshStandardMaterial);
        if (o.name === 'mouth') p!.mouth = m.material as THREE.MeshStandardMaterial;
      });
      parts.set(e, p);
    }
    return p;
  };

  const scaleMat = new THREE.MeshStandardMaterial({ color: COLORS.scale, roughness: 0.85, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: COLORS.dark, roughness: 0.85, flatShading: true });
  const boneMat = new THREE.MeshStandardMaterial({ color: COLORS.bone, roughness: 0.85, flatShading: true });
  const globMat = new THREE.MeshBasicMaterial({ color: COLORS.acid });
  const gateGlobMat = new THREE.MeshBasicMaterial({ color: COLORS.gate });
  const bar = new BossBar(L('La Hidra', 'The Hydra'), '#d94a3a');
  const bodyRing = new GroundMark(scene, 0xffd64a, false, 3.4).opacity(0);

  // ---- el cuerpo ----
  const startX = (ctx.rng() * 2 - 1) * 4;
  let wadeTo = startX;
  let wadeIn = WADE.every;
  let planted = false;
  let bodyTime = 0;
  const bodyScript: EnemyScript = {
    update(e) {
      e.knock.set(0, 0, 0);
      return true;
    },
  };
  const body = horde.spawnCustom(partStats('golem', {
    name: L('Hidra', 'Hydra'), behavior: 'golem', height: measured.body, radius: 2.1, hp: bodyHp, speed: 0, heavy: true, boss: true, score: 500,
  }), 'hidra-cuerpo', startX, ENTER_Z, {}, bodyScript);
  body.heading = Math.PI;
  const bodyMats: THREE.MeshStandardMaterial[] = [];
  let heartMat: THREE.MeshStandardMaterial | null = null;
  body.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (o.name === 'heart') heartMat = m.material as THREE.MeshStandardMaterial;
    else bodyMats.push(m.material as THREE.MeshStandardMaterial);
  });

  /** Del modelo del cuerpo al mundo. */
  const toWorld = (local: THREE.Vector3, out: THREE.Vector3) => {
    const h = body.heading;
    const c = Math.cos(h);
    const s = Math.sin(h);
    return out.set(body.position.x + local.x * c + local.z * s, body.position.y + local.y, body.position.z - local.x * s + local.z * c);
  };

  // ---- los cuellos ----
  const slots: Slot[] = [];
  for (let i = 0; i < SLOTS; i++) {
    slots.push({
      i, state: 'empty', head: null, stump: null, timer: 0, age: 0, strong: false, budStrong: false, attack: null,
      snap: 0, recoil: 0, phase: ctx.rng() * Math.PI * 2, base: isLow(i) ? HEAD_LOW - HEAD_Y : 0, rise: isLow(i) ? HEAD_LOW - HEAD_Y : 0, back: 0, tilt: 0, jaw: 0, droop: 0,
      end: new THREE.Vector3(), stumpAt: new THREE.Vector3(), neck: new Neck(scene, scaleMat, darkMat, boneMat, NECK_LINKS[Math.abs(i - (SLOTS - 1) / 2)]), ring: null,
    });
  }
  const globs: Glob[] = [];
  const stats = { cortadas: 0, quemadas: 0, crecieron: 0, aPuerta: 0, aVos: 0, cortes: 0, ciclos: 0, maxCabezas: HEADS_START, ataques: 0 };
  let attackIn = 2.5;
  let attackCount = 0;
  let exposedLeft = 0;
  let cycle = 0;
  let dead = false;
  let deadTime = 0;

  const living = () => slots.filter((s) => s.state === 'head' && s.head?.alive);
  const headWeight = () => living().reduce((n, s) => n + (s.strong ? STRONG.weight : 1), 0);
  const covered = () => v.body === 'covered' && slots.some((s) => s.state === 'head' || s.state === 'stump' || s.state === 'bud');

  // ---- las cabezas ----
  const headScript = (slot: Slot): EnemyScript => ({
    update(e) {
      e.knock.set(0, 0, 0);
      return true;
    },
    onDamage(e, dealt, killed) {
      if (killed || dealt <= 0) return;
      slot.recoil = RECOIL;
      // cualquier golpe la corta mientras carga: es la gracia (un golpe 1 ya alcanza)
      if (slot.attack) {
        if (slot.attack.kind === 'gate') ctx.feedback(L('¡Cortada!', 'Interrupted!'));
        cancelAttack(slot);
        stats.cortes++;
      }
    },
    onDeath(e) {
      headDied(slot, e);
    },
  });

  function spawnHead(slot: Slot, strong: boolean): void {
    const at = toWorld(restOf(slot.i), new THREE.Vector3());
    const k = strong ? STRONG.scale : 1;
    const hp = strong ? Math.round(headHp * STRONG.hp) : headHp;
    const low = isLow(slot.i);
    const e = horde.spawnCustom(partStats('wraith', {
      name: strong ? L('Cabeza furiosa', 'Raging head') : L('Cabeza de hidra', 'Hydra head'),
      behavior: 'golem', height: (low ? measured.low : HEAD_H) * k, radius: 0.85 * k, hp, speed: 0, heavy: true, runs: false, score: 40, damage: 1, gateDamage: 1,
    }), `hidra-cabeza${strong ? '-fuerte' : ''}${low ? '-baja' : ''}`, at.x, at.z, {}, headScript(slot)); // i18n-ok: clave del modelo
    slot.rise = slot.base;
    e.heading = body.heading;
    slot.head = e;
    slot.state = 'head';
    slot.strong = strong;
    slot.attack = null;
    slot.snap = 0;
    slot.recoil = 0;
    slot.droop = 0;
    stats.maxCabezas = Math.max(stats.maxCabezas, living().length);
  }

  /** Empieza a crecer una cabeza en el cuello `slot` (el cuello sale primero, la cabeza al final). */
  function bud(slot: Slot, strong: boolean): void {
    slot.state = 'bud';
    slot.timer = BUD_TIME;
    slot.budStrong = strong;
    slot.droop = 0;
    toWorld(shoulderOf(slot.i), slot.end);
  }

  /** El cuello libre más cerca de `i` (o -1). */
  function freeNear(i: number): number {
    let best = -1;
    for (const s of slots) if (s.state === 'empty' && (best < 0 || Math.abs(s.i - i) < Math.abs(best - i))) best = s.i;
    return best;
  }

  function headDied(slot: Slot, e: Enemy): void {
    if (slot.state !== 'head' || slot.head !== e) return;
    cancelAttack(slot);
    stats.cortadas++;
    const fallFrom = jointOf(e, slot, new THREE.Vector3());
    // la cabeza cae (un adorno que rueda y se hunde) y el cuello queda en el piso, con el muñón brillando
    dropHead(e, slot);
    e.remove();
    slot.head = null;
    if (dead) return;
    slot.state = 'stump';
    slot.timer = v.window;
    slot.age = 0;
    slot.end.copy(fallFrom);
    slot.stumpAt.set(e.position.x, 0, e.position.z);
    slot.stumpAt.y = heightAt(slot.stumpAt.x, slot.stumpAt.z);
    const stump = horde.spawnCustom(partStats('wraith', {
      name: L('Muñón', 'Stump'), behavior: 'golem', height: 1.3, radius: 1.0, hp: 1, speed: 0, heavy: true, score: 10,
    }), 'hidra-munon', slot.stumpAt.x, slot.stumpAt.z, {}, {
      update(x) {
        x.knock.set(0, 0, 0);
        return true;
      },
      // recién abierto no recibe (ver STUMP_ARM)
      filter: (_x, amount) => (slot.age < STUMP_ARM ? 0 : amount),
      onDeath(x) {
        seal(slot, x);
      },
    });
    slot.stump = stump;
    slot.ring?.dispose();
    slot.ring = new GroundMark(scene, 0xffd64a, false, 2.4).at(slot.stumpAt.x, slot.stumpAt.z);
  }

  /** Lo quemaron a tiempo: el cuello se encoge, negro, y por ahí no sale nada (por ahora). */
  function seal(slot: Slot, x: Enemy): void {
    if (slot.state !== 'stump' || slot.stump !== x) return;
    x.remove();
    slot.stump = null;
    slot.state = 'sealed';
    slot.timer = v.resprout ?? RESPROUT;
    slot.ring?.dispose();
    slot.ring = null;
    stats.quemadas++;
    ctx.effects.explosion(slot.stumpAt.clone().setY(slot.stumpAt.y + 0.6), 1.3, 0x3a3330);
    ctx.audio.burnTick();
    ctx.feedback(L('¡Muñón quemado!', 'Stump seared!'));
  }

  /** No llegaron: el muñón revienta y salen dos cabezas (o una, más fuerte). */
  function regrow(slot: Slot): void {
    slot.stump?.remove();
    slot.stump = null;
    slot.ring?.dispose();
    slot.ring = null;
    stats.crecieron++;
    ctx.effects.explosion(slot.stumpAt.clone().setY(slot.stumpAt.y + 0.6), 2.2, COLORS.acid);
    ctx.audio.growl();
    if (v.regrow === 'strong') {
      bud(slot, true);
      ctx.feedback(L('¡Volvió más fuerte!', 'It grew back stronger!'));
      return;
    }
    bud(slot, false);
    const other = freeNear(slot.i);
    if (other >= 0) bud(slots[other], false);
    ctx.feedback(other >= 0 ? L('¡Le salieron dos!', 'Two grew back!') : L('¡Le volvió a salir!', 'It grew back!'));
  }

  // ---- las cabezas que caen (adornos) ----
  const falling: { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; t: number }[] = [];
  function dropHead(e: Enemy, slot: Slot): void {
    const obj = headLook(slot.strong ? COLORS.strong : COLORS.scale);
    obj.scale.setScalar(slot.strong ? STRONG.scale : 1);
    obj.position.copy(e.position);
    // el modelo tiene la cabeza a HEAD_Y: la de un cuello bajo (o la que estaba alzada) cae desde donde estaba
    obj.position.y += slot.rise * (slot.strong ? STRONG.scale : 1);
    obj.rotation.y = e.heading;
    scene.add(obj);
    const away = new THREE.Vector3(Math.sin(e.heading), 0, Math.cos(e.heading));
    falling.push({ obj, vel: away.multiplyScalar(2.5).setY(1.5), spin: new THREE.Vector3(2.5, 0, (ctx.rng() - 0.5) * 3), t: 0 });
  }
  function updateFalling(dt: number): void {
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.t += dt;
      // el modelo tiene la cabeza a HEAD_Y: cae bajando el grupo hasta que la cabeza toca el piso
      f.vel.y -= 14 * dt;
      f.obj.position.addScaledVector(f.vel, dt);
      const floor = heightAt(f.obj.position.x, f.obj.position.z) - HEAD_Y + 0.35;
      if (f.obj.position.y < floor) {
        f.obj.position.y = floor;
        f.vel.multiplyScalar(0.4);
        f.vel.y = Math.abs(f.vel.y) * 0.25;
        f.spin.multiplyScalar(0.5);
      }
      const head = f.obj.getObjectByName('head');
      if (head) {
        head.rotation.x += f.spin.x * dt;
        head.rotation.z += f.spin.z * dt;
      }
      // se hunde y se va
      if (f.t > 1.6) f.obj.position.y -= (f.t - 1.6) * 1.2 * dt * 10;
      if (f.t > 2.6) {
        scene.remove(f.obj);
        falling.splice(i, 1);
      }
    }
  }

  // ---- los ataques ----
  function cancelAttack(slot: Slot): void {
    const a = slot.attack;
    if (!a) return;
    a.mark?.dispose();
    a.lane?.dispose();
    slot.attack = null;
  }

  function startAttack(slot: Slot, kind: 'player' | 'gate'): void {
    const e = slot.head!;
    let to: THREE.Vector3;
    let mark: GroundMark | null = null;
    let lane: LaneMark | null = null;
    if (kind === 'player') {
      const p = ctx.player();
      const x = ctx.spots()[nearestSpot(ctx, p.position.x)];
      to = new THREE.Vector3(x, 0, TEE_Z);
      mark = new GroundMark(scene, COLORS.acid, true, SPIT.radius).at(x, TEE_Z).opacity(0.15);
    } else {
      to = new THREE.Vector3(0, 1.2, GATE_Z + 1);
      lane = new LaneMark(scene, COLORS.gate, 1.1).between(e.position.x, e.position.z - 1, 0, GATE_Z + 1).opacity(0.15);
    }
    slot.attack = { kind, t: 0, windup: kind === 'player' ? SPIT.windup : GATE_SPIT.windup, to, mark, lane };
    stats.ataques++;
    ctx.audio.growl();
  }

  function release(slot: Slot): void {
    const a = slot.attack!;
    const e = slot.head!;
    const k = slot.strong ? STRONG.scale : 1;
    const h = e.heading;
    const from = new THREE.Vector3(e.position.x + Math.sin(h) * 1.0 * k, e.position.y + (HEAD_Y + slot.rise) * k, e.position.z + Math.cos(h) * 1.0 * k);
    const mesh = new THREE.Mesh(globGeo, a.kind === 'gate' ? gateGlobMat : globMat);
    mesh.scale.setScalar(a.kind === 'gate' ? 0.5 : 0.38);
    mesh.position.copy(from);
    scene.add(mesh);
    globs.push({
      mesh, from, to: a.to.clone().setY(a.kind === 'gate' ? a.to.y : heightAt(a.to.x, a.to.z) + 0.2), t: 0,
      flight: a.kind === 'gate' ? GATE_SPIT.flight : SPIT.flight, arc: a.kind === 'gate' ? GATE_SPIT.arc : SPIT.arc, kind: a.kind, source: e,
      // la marca del puesto queda hasta que cae; la franja de la puerta ya no sirve (no se puede cortar más)
      mark: a.mark,
    });
    a.lane?.dispose();
    slot.attack = null;
    slot.snap = SNAP;
    ctx.audio.casterCast();
  }

  function updateGlobs(dt: number): void {
    for (let i = globs.length - 1; i >= 0; i--) {
      const g = globs[i];
      g.t += dt / g.flight;
      const u = Math.min(1, g.t);
      arcPoint(g.from, g.to, u, g.arc, g.mesh.position);
      g.mesh.rotation.x += dt * 7;
      g.mesh.rotation.y += dt * 5;
      g.mark?.opacity(0.35 + 0.25 * u).size(SPIT.radius * (0.7 + 0.3 * u));
      if (u < 1) continue;
      scene.remove(g.mesh);
      g.mark?.dispose();
      globs.splice(i, 1);
      if (g.kind === 'gate') {
        ctx.effects.explosion(g.to.clone(), 2.2, COLORS.gate);
        if (!ctx.over()) {
          ctx.hitGate(GATE_SPIT.damage, g.source);
          stats.aPuerta++;
        }
        continue;
      }
      ctx.effects.explosion(g.to.clone().setY(g.to.y + 0.2), SPIT.radius, COLORS.acid);
      ctx.audio.casterHit();
      const p = ctx.player();
      if (!ctx.over() && p.alive && !p.invulnerable && Math.hypot(p.position.x - g.to.x, p.position.z - g.to.z) < SPIT.radius + 0.25) {
        ctx.hitPlayer(1, g.to, g.source);
        stats.aVos++;
      }
    }
  }

  /** ¿Quién ataca ahora, y a qué? Una cabeza quieta al azar (la fuerte, más seguido). */
  function schedule(dt: number): void {
    if (!planted || ctx.over()) return;
    const ready = living().filter((s) => !s.attack && s.snap <= 0 && s.recoil <= 0 && !s.head!.frozen && !s.head!.silenced && !s.head!.stunned);
    if ((attackIn -= dt) > 0 || !ready.length) return;
    const total = ready.reduce((n, s) => n + (s.strong ? STRONG.weight : 1), 0);
    let pick = ctx.rng() * total;
    let slot = ready[0];
    for (const s of ready) {
      pick -= s.strong ? STRONG.weight : 1;
      if (pick <= 0) {
        slot = s;
        break;
      }
    }
    const gateEvery = ctx.clock() < GAP.gateLate ? GAP.gateEvery : GAP.gateEvery - 1;
    attackCount++;
    startAttack(slot, attackCount % gateEvery === 0 ? 'gate' : 'player');
    const ramp = clamp01(ctx.clock() / GAP.ramp);
    attackIn = (GAP.start + (GAP.end - GAP.start) * ramp) * Math.sqrt(HEADS_START / Math.max(1, headWeight())) * (v.pace ?? 1);
  }

  // ---- el cuerpo: entrar, plantarse, correrse de costado ----
  function moveBody(dt: number): void {
    bodyTime += dt;
    const p = ctx.player();
    if (!planted) {
      body.position.z = Math.max(HOLD_Z, body.position.z - ENTER_SPEED * dt);
      if (body.position.z <= HOLD_Z + 0.01) {
        planted = true;
        attackIn = 1.5;
      }
    } else if ((wadeIn -= dt) <= 0) {
      wadeIn = WADE.every;
      let x = body.position.x;
      for (let k = 0; k < 6 && Math.abs(x - body.position.x) < WADE.minStep; k++) x = (ctx.rng() * 2 - 1) * WADE.span;
      wadeTo = x;
    }
    const dx = wadeTo - body.position.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), WADE.speed * dt);
    body.position.x += step;
    body.position.y = heightAt(body.position.x, body.position.z);
    const walking = !planted || Math.abs(dx) > 0.05;
    // camina meciéndose; plantado, respira
    body.body.position.y = walking ? 0.08 * Math.abs(Math.sin(bodyTime * 4)) : 0.04 * Math.sin(bodyTime * 1.6);
    body.body.rotation.z = walking ? 0.03 * Math.sin(bodyTime * 4) : 0;
    // mira hacia el golfista, sin girar mucho
    const want = Math.atan2(p.position.x - body.position.x, p.position.z - body.position.z);
    let d = (want - body.heading) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    body.heading += d * (1 - Math.exp(-1.5 * dt));
    body.body.rotation.y = body.heading;
  }

  // ---- cada cuello y su cabeza ----
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const curve = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const red = new THREE.Color(0xff3b30);
  const amber = new THREE.Color(0xffd64a);

  function animateHead(slot: Slot, dt: number, t: number): void {
    const e = slot.head!;
    const a = slot.attack;
    let rise = 0.12 * Math.sin(t * 1.7 + slot.phase);
    let back = 0;
    let tilt = 0.05 * Math.sin(t * 1.3 + slot.phase);
    let jaw = 0.1 + 0.08 * Math.sin(t * 2.1 + slot.phase);
    if (a) {
      const u = ease(a.t / a.windup);
      rise = (a.kind === 'gate' ? 1.4 : 0.85) * u;
      back = 0.8 * u;
      tilt = -0.5 * u;
      jaw = 0.75 * u;
    } else if (slot.snap > 0) {
      rise = 0.25;
      back = -0.55;
      tilt = 0.3;
      jaw = 0.9;
    }
    if (slot.recoil > 0) {
      back += 0.6 * (slot.recoil / RECOIL);
      tilt -= 0.25 * (slot.recoil / RECOIL);
    }
    slot.rise = approach(slot.rise, slot.base + rise, a ? 8 : 14, dt);
    slot.back = approach(slot.back, back, 14, dt);
    slot.tilt = approach(slot.tilt, tilt, 14, dt);
    slot.jaw = approach(slot.jaw, jaw, 16, dt);
    const p = partsOf(e);
    if (p.head) {
      p.head.position.set(0, HEAD_Y + slot.rise, -slot.back);
      p.head.rotation.x = slot.tilt;
    }
    if (p.jaw) p.jaw.rotation.x = slot.jaw;
    // los ojos siempre encendidos (el juego les apaga el brillo en cada cuadro); la boca brilla mientras
    // carga, del color de adónde va
    for (const m of p.eyes) m.emissive.setHex(COLORS.eye).multiplyScalar(a ? 1.4 : 0.8);
    if (p.mouth) {
      if (a) p.mouth.emissive.setHex(a.kind === 'gate' ? COLORS.gate : COLORS.acid).multiplyScalar(0.6 + 0.6 * (a.t / a.windup) * (0.75 + 0.25 * Math.sin(t * 30)));
      else p.mouth.emissive.setRGB(0, 0, 0);
    }
  }

  function updateSlot(slot: Slot, dt: number, t: number): void {
    const shoulder = toWorld(shoulderOf(slot.i), curve[0]);
    if (slot.snap > 0) slot.snap -= dt;
    if (slot.recoil > 0) slot.recoil -= dt;
    switch (slot.state) {
      case 'empty':
        slot.neck.show(false);
        return;
      case 'head': {
        const e = slot.head!;
        // la cabeza flota delante del cuerpo, meciéndose
        const rest = restOf(slot.i);
        rest.x += 0.35 * Math.sin(t * 0.9 + slot.phase);
        rest.z += 0.25 * Math.sin(t * 1.3 + slot.phase * 1.7);
        toWorld(rest, tmpA);
        e.position.set(tmpA.x, heightAt(tmpA.x, tmpA.z), tmpA.z);
        // mira a lo que le va a tirar (o al golfista)
        const target = slot.attack?.to ?? ctx.player().position;
        let d = (Math.atan2(target.x - e.position.x, target.z - e.position.z) - e.heading) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        e.heading += d * (1 - Math.exp(-6 * dt));
        e.body.rotation.y = e.heading;
        const a = slot.attack;
        if (a) {
          // congelada, silenciada o aturdida, se le corta el ataque
          if (e.frozen || e.silenced || e.stunned || ctx.over()) cancelAttack(slot);
          else {
            a.t += dt;
            const u = a.t / a.windup;
            a.mark?.opacity(0.15 + 0.3 * u).size(SPIT.radius * (0.5 + 0.5 * u));
            a.lane?.between(e.position.x, e.position.z - 1, a.to.x, a.to.z).opacity(0.12 + 0.35 * u * (0.7 + 0.3 * Math.sin(t * 18)));
            if (a.t >= a.windup) release(slot);
          }
        }
        animateHead(slot, dt, t);
        slot.droop = approach(slot.droop, 0, 10, dt);
        jointOf(e, slot, tmpB);
        slot.end.copy(tmpB);
        break;
      }
      case 'stump': {
        slot.age += dt;
        slot.timer -= dt;
        // el cuello cae hasta el piso, y el anillo se cierra
        slot.droop = approach(slot.droop, 1, 9, dt);
        tmpB.copy(slot.stumpAt).setY(slot.stumpAt.y + 0.45);
        slot.end.lerp(tmpB, 1 - Math.exp(-10 * dt));
        const u = clamp01(1 - slot.timer / v.window);
        slot.ring?.size(2.4 - 1.5 * u).color(amber.clone().lerp(red, u).getHex()).opacity(0.55 + 0.35 * Math.abs(Math.sin(t * (6 + 14 * u))));
        if (slot.timer <= 0) regrow(slot);
        break;
      }
      case 'sealed': {
        // un cabito quemado colgando del pecho
        slot.droop = approach(slot.droop, 0.6, 5, dt);
        const dir = tmpA.set(Math.sin(body.heading), 0, Math.cos(body.heading));
        tmpB.copy(shoulder).addScaledVector(dir, 1.1).setY(shoulder.y - 0.7);
        slot.end.lerp(tmpB, 1 - Math.exp(-6 * dt));
        if (v.body === 'always' && !dead && (slot.timer -= dt) <= 0) bud(slot, false);
        break;
      }
      case 'bud': {
        slot.timer -= dt;
        const g = ease(1 - slot.timer / BUD_TIME);
        const restW = toWorld(restOf(slot.i), tmpA);
        const k = slot.budStrong ? STRONG.scale : 1;
        tmpB.set(restW.x, heightAt(restW.x, restW.z) + (HEAD_Y + slot.base - 0.12) * k, restW.z);
        slot.end.lerpVectors(shoulder, tmpB, g);
        slot.droop = 0;
        if (slot.timer <= 0) {
          spawnHead(slot, slot.budStrong);
          ctx.effects.explosion(tmpB.clone(), 1.2, COLORS.acid);
        }
        break;
      }
    }
    const thick = (slot.state === 'head' ? (slot.strong ? STRONG.scale : 1) : slot.state === 'bud' ? 0.35 + 0.65 * ease(1 - slot.timer / BUD_TIME) : 0.9);
    const pulse = 0.5 + 0.5 * Math.sin(t * (slot.state === 'stump' ? 10 + 16 * clamp01(1 - slot.timer / v.window) : 6));
    drawNeck(slot, thick, slot.state === 'stump' ? 'open' : slot.state === 'sealed' ? 'char' : slot.state === 'bud' ? 'bud' : 'none', pulse);
  }

  /** El cuello, del hombro (ya en `curve[0]`) a su punta (`slot.end`), más caído cuanto más `droop`. */
  function drawNeck(slot: Slot, thick: number, cut: 'none' | 'open' | 'char' | 'bud', pulse: number): void {
    const p0 = curve[0];
    const p3 = curve[3].copy(slot.end);
    const dir = tmpA.set(p3.x - p0.x, 0, p3.z - p0.z);
    const len = dir.length() || 1;
    dir.divideScalar(len);
    const dd = slot.droop;
    curve[1].copy(p0).addScaledVector(dir, 0.6 + 0.5 * dd).setY(p0.y + 1.7 - 0.9 * dd);
    curve[2].copy(p3).addScaledVector(dir, -(1.3 - 0.4 * dd)).setY(p3.y + 0.25 + 0.75 * dd);
    slot.neck.show(true);
    slot.neck.draw(curve, thick, cut, pulse);
  }

  /** Muerta: los cuellos caen con el cuerpo, se achican y se van. */
  function collapse(dt: number): void {
    deadTime += dt;
    for (const s of slots) {
      if (s.state === 'empty') continue;
      if (deadTime > 2.4) {
        s.state = 'empty';
        s.neck.show(false);
        continue;
      }
      toWorld(shoulderOf(s.i), curve[0]);
      s.droop = approach(s.droop, 1, 4, dt);
      const floor = heightAt(s.end.x, s.end.z) + 0.3;
      s.end.y = Math.max(floor - deadTime * 0.4, s.end.y - dt * 6);
      drawNeck(s, 0.9 * (1 - clamp01((deadTime - 1.4) / 1.0)) + 0.01, 'char', 0);
    }
  }

  /** El cuerpo tapado brilla violeta (como los inmunes del chamán); al descubierto, le late el corazón. */
  function updateCover(dt: number, t: number): void {
    const cov = covered();
    body.warded = cov && !dead;
    const w = cov ? 0.55 + 0.25 * Math.sin(t * 6) : 0;
    for (const m of bodyMats) if (cov) m.emissive.setRGB(0.45 * w, 0.12 * w, 0.8 * w);
    const hm = heartMat as THREE.MeshStandardMaterial | null;
    if (hm) {
      const open = !cov && !dead;
      hm.emissive.setRGB(open ? 1 : 0.15, open ? 0.25 : 0.03, open ? 0.15 : 0.03).multiplyScalar(open ? 0.6 + 0.4 * Math.sin(t * 8) : 1);
    }
    if (v.body !== 'covered' || dead) {
      bodyRing.opacity(0);
      return;
    }
    if (!cov && planted) {
      if (exposedLeft <= 0) {
        exposedLeft = BODY_WINDOW;
        ctx.banner(L('¡Sin cabezas!', 'No heads!'), L('Pegale al cuerpo antes de que le vuelvan a salir', 'Hit the body before they grow back'), 2);
      }
      exposedLeft -= dt;
      bodyRing.at(body.position.x, body.position.z).size(3.4).opacity(0.35 + 0.25 * Math.sin(t * 8));
      if (exposedLeft <= 0) {
        // le vuelven a salir todas, una más cada vez
        cycle++;
        stats.ciclos = cycle;
        const n = Math.min(SLOTS, HEADS_START + cycle);
        let made = 0;
        for (const i of FILL_ORDER) {
          const s = slots[i];
          if (made >= n) break;
          if (s.state === 'sealed' || s.state === 'empty') {
            bud(s, false);
            made++;
          }
        }
        ctx.audio.growl();
        ctx.feedback(L('¡Le volvieron a salir!', 'They grew back!'));
      }
    } else {
      exposedLeft = 0;
      bodyRing.opacity(0);
    }
  }

  function die(): void {
    dead = true;
    for (const s of slots) {
      cancelAttack(s);
      if (s.head?.alive) {
        ctx.effects.explosion(s.head.position.clone().setY(s.head.position.y + HEAD_Y + s.rise), 1.4, COLORS.scale);
        dropHead(s.head, s);
        s.head.remove();
      }
      s.head = null;
      s.stump?.remove();
      s.stump = null;
      s.ring?.dispose();
      s.ring = null;
      if (s.state !== 'empty') s.state = 'sealed';
    }
    bar.set(0, bodyHp, '');
    ctx.banner(L('¡Cayó la Hidra!', 'The Hydra falls!'), '', 2.5);
  }

  // las del principio (tres: la baja del medio y las dos altas), del medio para afuera
  for (const i of FILL_ORDER.slice(0, v.heads ?? HEADS_START)) spawnHead(slots[i], false);
  const secs = String(v.window);
  ctx.banner(L('La Hidra', 'The Hydra'), L(`Cortale una cabeza y quemale el muñón: pegale en ${secs.replace('.', ',')} s o le salen dos`, `Cut off a head, then sear the stump: hit it within ${secs} s or two grow back`), 4);

  return {
    get done() {
      return dead;
    },
    update(dt) {
      const t = ctx.clock();
      if (!dead && !body.alive) die();
      if (dead) {
        collapse(dt);
        bodyRing.opacity(0);
        updateGlobs(dt);
        updateFalling(dt);
        return;
      }
      moveBody(dt);
      // por si alguna cabeza murió sin pasar por onDeath (el hoyo se la traga sin avisar)
      for (const s of slots) if (s.state === 'head' && s.head && !s.head.alive) headDied(s, s.head);
      for (const s of slots) if (s.state === 'stump' && s.stump && !s.stump.alive) seal(s, s.stump);
      for (const s of slots) updateSlot(s, dt, t);
      schedule(dt);
      updateCover(dt, t);
      updateGlobs(dt);
      updateFalling(dt);
      const heads = living().length;
      const sub = exposedLeft > 0
        ? L(`¡Cuerpo al descubierto! ${Math.ceil(exposedLeft)} s`, `Body exposed! ${Math.ceil(exposedLeft)} s`)
        : v.body === 'covered'
          ? L(`${heads} cabezas · el cuerpo está cubierto`, `${heads} heads · the body is covered`)
          : L(`${heads} cabezas`, `${heads} heads`);
      bar.set(body.hp, body.maxHp, sub);
    },
    bot: {
      // los escupitajos a tu puesto: el que carga y el que vuela
      danger(x, within) {
        for (const s of slots) {
          const a = s.attack;
          if (!a || a.kind !== 'player') continue;
          if (Math.abs(a.to.x - x) < SPIT.radius + 1 && a.windup - a.t + SPIT.flight < within + 0.3) return true;
        }
        for (const g of globs) {
          if (g.kind !== 'player') continue;
          if (Math.abs(g.to.x - x) < SPIT.radius + 1 && (1 - g.t) * g.flight < within + 0.3) return true;
        }
        return false;
      },
      // el muñón, urgente (cualquier golpe); la cabeza que carga contra la puerta, también; el cuerpo
      // tapado, nada
      weight(e) {
        if (e === body) return v.body === 'always' ? 1 : covered() ? 0 : 2.5;
        for (const s of slots) {
          if (s.stump === e) return 8;
          if (s.head === e) return s.attack?.kind === 'gate' ? 5 : s.attack ? 1.5 : 1;
        }
        return 1;
      },
    },
    log: () => ({ ...stats, cabezas: living().length, vidaCuerpo: Math.max(0, body.hp) }),
    dispose() {
      bar.dispose();
      bodyRing.dispose();
      for (const s of slots) {
        cancelAttack(s);
        s.ring?.dispose();
        s.neck.dispose(scene);
      }
      for (const g of globs) {
        scene.remove(g.mesh);
        g.mark?.dispose();
      }
      for (const f of falling) scene.remove(f.obj);
      scaleMat.dispose();
      darkMat.dispose();
      boneMat.dispose();
      globMat.dispose();
      gateGlobMat.dispose();
    },
  };
}
