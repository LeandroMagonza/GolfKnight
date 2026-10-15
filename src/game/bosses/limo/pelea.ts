// La pelea con el limo venenoso (ver docs/jefes/limo.md). Un limo grande que no camina: salta en arcos, de
// costado y hacia la línea, y cada salto marca en el piso dónde va a caer. Según la versión:
// - se divide al morir: el grande en dos medianos y cada mediano en dos chicos, cada vez más rápidos, y los
//   de un mismo tamaño saltan juntos, en manada (para el área del wedge y del hierro);
// - se come a la escolta que toca: gana su vida, se los ve adentro, y salen vivos cuando revienta;
// - escupe a los puestos: el charco deja ese puesto sin pelota un rato (ver charcos.ts).
// El que llega a la línea se para justo antes, y en el salto siguiente la cruza: de ahí camina a la puerta
// como cualquiera (y le saca lo suyo, más lo que tenga adentro).
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { GroundMark, SPAWN_Z, TEE_Z, facet, fieldHalfAt, flatMat, heightAt, partStats, touchesPlayer } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { SPIT_LOCK, SPIT_TRACK, Spit, type Glob } from './charcos';
import { Belly } from './panza';

/** Lo que cambia entre versiones (ver index.ts). */
export interface LimoVersion {
  id: string;
  /** Hasta qué tamaño se divide: 0 no se divide, 1 el grande en dos medianos, 2 también los medianos en chicos. */
  splits: number;
  /** El grande y los medianos se comen a la escolta que tocan. */
  absorbs: boolean;
  /** El grande y los medianos escupen a los puestos. */
  spits: boolean;
  /** Cada tantos de daño que recibe el grande, se le cae un limo chico que corre a la línea (0: no). */
  sheds?: number;
  /** Se queda a media cancha (una franja que se va acercando) en vez de ir a la línea. */
  holds?: boolean;
  /** La vida de cada tamaño: grande, mediano, chico. */
  hp: [number, number, number];
}

interface Tier {
  name: string;
  height: number;
  radius: number;
  /** El salto: agacharse, en el aire, descanso (de a cuánto), largo máximo, cuánto avanza y cuánto se abre de costado en cada uno, y lo alto. */
  crouch: number;
  air: number;
  rest: [number, number];
  reach: number;
  advance: number;
  sway: number;
  lift: number;
  /** Lo que saca: si te cae encima o lo tocás en la línea, y a la puerta si cruza. */
  trample: number;
  gate: number;
  /** A qué velocidad camina una vez que cruzó la línea (ahí lo lleva el juego, como a cualquiera). */
  speed: number;
  /** Radio de la ronda en la manada (0: va solo). */
  spacing: number;
  /** Escupe cada tantos segundos (0 = no escupe), y lo que dura su charco. */
  spitEvery: number;
  puddle: number;
  heavy: boolean;
  boss: boolean;
  score: number;
}

// Avance medio de cada uno (avanza / (agacharse + aire + descanso)): el grande 0.7 m/s, el mediano 1.25 y
// el chico 2.1 (el goblin corre a 3.6). El grande tarda un minuto y medio en llegar a la línea.
const TIERS: Tier[] = [
  { name: L('Limo venenoso', 'Poison Slime'), height: 2.4, radius: 1.7, crouch: 0.55, air: 0.85, rest: [0.9, 1.4], reach: 5, advance: 1.8, sway: 3, lift: 2.2, trample: 2, gate: 4, speed: 1.1, spacing: 0, spitEvery: 6.5, puddle: 14, heavy: true, boss: true, score: 150 },
  { name: L('Limo mediano', 'Slime'), height: 1.6, radius: 1.12, crouch: 0.4, air: 0.65, rest: [0.55, 0.85], reach: 4.2, advance: 2.2, sway: 2.4, lift: 1.6, trample: 1, gate: 2, speed: 1.8, spacing: 1.7, spitEvery: 9, puddle: 10, heavy: true, boss: true, score: 50 },
  { name: L('Limo chico', 'Small Slime'), height: 1.0, radius: 0.7, crouch: 0.25, air: 0.45, rest: [0.3, 0.5], reach: 3.2, advance: 2.3, sway: 1.6, lift: 1.0, trample: 1, gate: 1, speed: 3.0, spacing: 1.6, spitEvery: 0, puddle: 0, heavy: false, boss: false, score: 20 },
];

/** Entra desde un poco más allá de donde aparecen los demás: llega saltando. */
const ENTER_Z = SPAWN_Z + 3;
/** Se para a esta distancia de la línea (sobre su radio) antes de cruzarla, y espera tanto de más ahí. */
const LINE_GAP = 0.6;
const LINE_WAIT = 0.9;
/** Del otro lado: adonde cae al cruzar (de ahí camina a la puerta). */
const CROSS_DEPTH = 3.2;
/** Con frío, los relojes del salto corren a esto (al chico, además, el hielo lo congela). */
const CHILL_TIME = 0.55;
/** El chico que recibe un golpe tarda un poco más en saltar (queda mareado). */
const FLINCH = 0.25;
/** Al dividirse: los dos salen para los costados y un poco hacia la línea, en un salto corto. */
const SPLIT_SIDE = 2.4;
const SPLIT_FORWARD = 1.5;
const SPLIT_AIR = 0.55;
/** Los de un tamaño se juntan en una manada si están a menos de esto; si no, arman otra. Hasta 4 por manada. */
const PACK_JOIN = 12;
const PACK_MAX = 4;
/** El que no manda espera que salte el que manda; si tarda (escupiendo), salta solo pasado esto. */
const FOLLOW_PATIENCE = 1.2;
/** Comer: busca a esta distancia, come a los que toca, gana su vida y crece (hasta un 35 % más). */
const SEEK_RANGE = 13;
const BELLY_MAX = 10;
const GROW_PER_HP = 0.012;
const GROW_MAX = 0.35;
/**
 * Y chupa: los de la escolta a menos de esto de su borde se van deslizando hacia él (un anillo en el piso
 * marca hasta dónde llega). Sin esto casi no comía: la escolta corre más que él y le pasaba de largo.
 */
const PULL_REACH = 3;
const PULL_SPEED = 2.4;
const PULL_COLOR = 0x9a4ae0;
/** Los que salen de la panza no se pueden volver a comer por un rato (los medianos nacen ahí mismo). */
const RELEASE_GRACE = 4;
/** No come a los que están por llegar a la línea (ya son del golfista). */
const EAT_MIN_Z = TEE_Z + 3;
/** Escupir: se infla mientras la marca te sigue y se traba (ver charcos.ts), y se queda tanto después. */
const SPIT_WINDUP = SPIT_TRACK + SPIT_LOCK;
const SPIT_RECOVER = 0.5;
/** No escupe cerca de la línea (ahí ya está por cruzar), ni enseguida de entrar. */
const SPIT_MIN_Z = TEE_Z + 8;
const SPIT_FIRST = 4;
/** Escupe más seguido con menos vida: con la vida entera, el ritmo de su tamaño; casi muerto, el 55 %. */
const SPIT_RAGE = 0.45;
/** El que se planta: una franja de media cancha, que se acerca un poco por segundo hasta un tope. */
const BAND_FAR = 46;
const BAND_FAR_MIN = 28;
const BAND_DEPTH = 12;
const BAND_CREEP = 0.1;
/** Y escupe cada vez más seguido: a los 5 minutos, al 60 %. */
const BAND_SPIT_RAMP = 300;
/** La baba se ve a través: lo que se comió, la calavera y la espada que ya tenía. */
const GOO_OPACITY = 0.72;
/** El resorte del aplastado (el mismo tipo que el de los golpes). */
const SPRING_K = 170;
const SPRING_C = 15;
/** Las marcas: dónde va a caer (violeta oscuro; en rojo si cae sobre la línea) y la baba que deja. */
const RING_COLOR = 0x7a3cc8;
const RING_DANGER = 0xff5a3c;
const DECAL_COLOR = 0x3d1660;
const DECAL_LIFE = 2.6;
/** Con dificultad: más vida por nivel, y escupe más seguido. */
const HP_PER_LEVEL = 0.03;
const SPIT_PER_LEVEL = 0.02;
/** El que gotea: el chico sale despedido a tanto de costado, en un salto corto. */
const SHED_SIDE = 2.6;
/** Para el bot: el chico apura (rápido y en manada), el que está en la línea también, y lo que está por comerse. */
const SMALL_WEIGHT = 2.5;
const AT_LINE_WEIGHT = 1.6;
const FOOD_WEIGHT = 1.5;

interface Pack {
  tier: number;
  members: Piece[];
  /** Adónde va la manada (el lugar del que manda, menos su lugar en la ronda). */
  anchor: THREE.Vector2;
  /** Cada salto nuevo del que manda: los demás saltan cuando cambia. */
  ver: number;
  crossing: boolean;
  side: number;
  goal: number;
  goalHops: number;
}

interface Piece {
  e: Enemy;
  tier: number;
  pack: Pack;
  slot: THREE.Vector2;
  phase: 'rest' | 'crouch' | 'air' | 'spit';
  t: number;
  wait: number;
  ver: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  airTime: number;
  liftMax: number;
  lift: number;
  crossing: boolean;
  /** El salto de cuando nace (al dividirse) no le pega a nadie. */
  harmless: boolean;
  ring: GroundMark;
  /** Hasta dónde chupa (el que come). */
  pullRing: GroundMark | null;
  arm: THREE.Object3D | null;
  rawH: number;
  sq: number;
  sqv: number;
  sqTarget: number;
  /** Al nacer crece de la mitad a su tamaño. */
  pop: number;
  mats: THREE.MeshStandardMaterial[];
  belly: Belly | null;
  gained: number;
  spitIn: number;
  glob: Glob | null;
  /** El daño que lleva sin gotear (el que gotea). */
  shedAcc: number;
  glowing: boolean;
  /** Se murió (y ya se dividió o largó lo de adentro), o cruzó la línea y lo lleva el juego. */
  handled: boolean;
  handed: boolean;
}

/** Arranca la pelea con el limo de la versión `v`. */
export function startLimo(ctx: BossCtx, v: LimoVersion): BossFight {
  const { horde } = ctx;
  const rng = ctx.rng;
  const rand = (a: number, b: number) => a + (b - a) * rng();
  const hpScale = 1 + HP_PER_LEVEL * ctx.level;
  const tierHp = (t: number) => Math.max(1, Math.round(v.hp[t] * hpScale + (t === 0 ? ctx.bonusHp : 0)));
  const spit = v.spits ? new Spit(ctx) : null;
  // si el limo no está (el modelo no cargó), una gota facetada
  let look = 'slime';
  if (!horde.hasLook('slime')) {
    look = 'limo-gota';
    if (!horde.hasLook(look)) {
      const m = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.6, 1), 0.14, 3), flatMat(0x8a3fd0));
      m.scale.set(1.3, 0.85, 1.2);
      m.position.y = 0.5;
      const g = new THREE.Group();
      g.add(m);
      horde.addLook(look, g);
    }
  }

  const pieces: Piece[] = [];
  const packs: Pack[] = [];
  const byId = new Map<number, Piece>();
  /** Los que salieron de una panza, y hasta cuándo no se los puede volver a comer. */
  const freed = new Map<number, number>();
  const decals: { mark: GroundMark; t: number }[] = [];
  const stats = { divisiones: 0, goteados: 0, tragados: 0, salieron: 0, golpes: 0, cruzaron: 0, puertaPotencial: 0 };
  let toldSplit = false;
  let toldEat = false;
  /** La vida que le queda por delante a cada tamaño contando lo que va a nacer (para el registro). */
  const ahead = (t: number): number => (t < v.splits ? 2 * (tierHp(t + 1) + ahead(t + 1)) : 0);
  let lifeTotal = tierHp(0) + ahead(0);

  // ---- las manadas ----

  function slotFor(tier: number, i: number): THREE.Vector2 {
    const s = TIERS[tier].spacing;
    // de a dos, uno a cada lado; los otros dos, adelante y atrás (un rombo: el wedge los agarra a todos)
    const ring: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const [x, z] = ring[i % ring.length];
    return new THREE.Vector2(x * s, z * s);
  }

  function joinPack(tier: number, x: number, z: number): Pack {
    for (const p of packs) {
      if (p.tier !== tier || p.members.length >= PACK_MAX) continue;
      const lead = p.members[0];
      if (lead && Math.hypot(lead.e.position.x - x, lead.e.position.z - z) < PACK_JOIN) return p;
    }
    const p: Pack = { tier, members: [], anchor: new THREE.Vector2(x, z), ver: 0, crossing: false, side: rng() < 0.5 ? -1 : 1, goal: x, goalHops: 0 };
    packs.push(p);
    return p;
  }

  function leaveP(p: Piece): void {
    const pk = p.pack;
    const i = pk.members.indexOf(p);
    if (i >= 0) pk.members.splice(i, 1);
    if (!pk.members.length) packs.splice(packs.indexOf(pk), 1);
  }

  /** Lo que está por delante del campo (en x) a esa altura, para no salirse. */
  const halfAt = (z: number, r: number) => Math.max(1, fieldHalfAt(z) - r - 0.4);
  const stopZ = (tier: number) => TEE_Z + TIERS[tier].radius + LINE_GAP;

  /** La franja del que se planta (escupe): se acerca con el tiempo. */
  function band(): [number, number] {
    const far = Math.max(BAND_FAR_MIN, BAND_FAR - ctx.clock() * BAND_CREEP);
    return [far - BAND_DEPTH, far];
  }

  function edible(en: Enemy): boolean {
    if (!en.alive || en.passed || en.script || en.mods.apart || en.stats.boss || en.size > 1 || en.grabbing || en.hold || en.position.z <= EAT_MIN_Z) return false;
    const until = freed.get(en.id);
    return until === undefined || ctx.clock() > until;
  }

  /** Adónde saltar para comer: donde va a estar el grupo más grande cerca (cuando caiga), o null. */
  function food(x: number, z: number, tier: number): THREE.Vector2 | null {
    const T = TIERS[tier];
    const soon = T.crouch + T.air;
    const near = horde.enemies.filter((en) => edible(en) && Math.hypot(en.position.x - x, en.position.z - z) < SEEK_RANGE);
    let best: THREE.Vector2 | null = null;
    let bestScore = 0;
    for (const en of near) {
      // caminan derecho a la puerta: adonde van a estar cuando caiga
      const px = en.position.x;
      const pz = en.position.z - en.walkSpeed * soon;
      let score = 0;
      for (const o of near) if (Math.hypot(o.position.x - px, o.position.z - o.walkSpeed * soon - pz) < 3) score += 1 + 0.15 * o.hp;
      score /= 1 + Math.hypot(px - x, pz - z) / 8;
      if (score > bestScore) {
        bestScore = score;
        best = new THREE.Vector2(px, pz);
      }
    }
    return best;
  }

  /** El que manda decide el próximo salto de la manada. */
  function planPack(pk: Pack, lead: Piece): void {
    const T = TIERS[pk.tier];
    const bx = lead.e.position.x - lead.slot.x;
    const bz = lead.e.position.z - lead.slot.y;
    let nz = bz - T.advance * rand(0.75, 1.25);
    // de costado: en zigzag, y derivando hacia una meta que cambia cada tantos saltos
    if (--pk.goalHops <= 0) {
      pk.goal = rand(-0.7, 0.7) * fieldHalfAt(bz);
      pk.goalHops = 3 + Math.floor(rng() * 3);
    }
    pk.side = -pk.side;
    let nx = bx + pk.side * T.sway * rand(0.5, 1) + THREE.MathUtils.clamp(pk.goal - bx, -T.sway, T.sway) * 0.5;
    if (lead.belly && lead.belly.list.length < BELLY_MAX) {
      const f = food(bx, bz, pk.tier);
      if (f) {
        nx = f.x;
        // los que vienen de atrás lo alcanzan solos: no vuelve más de 2 m
        nz = Math.min(f.y, bz + 2);
      }
    }
    if (v.holds) {
      const [near, far] = band();
      // hasta la franja entra a saltos largos; ahí adentro, va y viene
      if (bz > far + 1) nz = Math.max(far - 1, bz - T.reach * 0.9);
      else nz = THREE.MathUtils.clamp(bz + rand(-2, 1.5), near, far);
    }
    pk.crossing = false;
    const stop = stopZ(pk.tier);
    if (!v.holds && nz < stop) {
      if (lead.e.position.z <= stop + 0.8) {
        pk.crossing = true;
        nz = TEE_Z - CROSS_DEPTH;
        nx = bx;
      } else nz = stop;
    }
    // el largo máximo del salto
    const dx = nx - bx;
    const dz = nz - bz;
    const d = Math.hypot(dx, dz);
    if (d > T.reach && !pk.crossing) {
      nx = bx + (dx / d) * T.reach;
      nz = bz + (dz / d) * T.reach;
    }
    const half = halfAt(nz, T.radius + T.spacing);
    pk.anchor.set(THREE.MathUtils.clamp(nx, -half, half), Math.min(nz, ENTER_Z));
    pk.ver++;
  }

  // ---- los pedazos ----

  function spawnPiece(tier: number, x: number, z: number, pk: Pack): Piece {
    const T = TIERS[tier];
    let p!: Piece;
    const script: EnemyScript = {
      update(_e, dt) {
        step(p, dt);
        return true;
      },
      onDamage(_e, dealt, killed) {
        if (!killed && p.tier === 2 && p.phase === 'rest') p.wait += FLINCH;
        // lo que gotea sale en la vuelta del jefe (acá estamos en medio de un golpe de la horda)
        if (v.sheds && p.tier === 0 && !killed) p.shedAcc += dealt;
      },
    };
    const st = partStats('slime', { name: T.name, height: T.height, radius: T.radius, hp: tierHp(tier), speed: T.speed, runs: tier === 2, damage: T.trample, gateDamage: T.gate, heavy: T.heavy, boss: T.boss, score: T.score });
    const e = horde.spawnCustom(st, look, x, z, {}, script);
    e.heading = Math.PI;
    const arm = e.body.getObjectByName('Armature') ?? e.body.children[0] ?? null;
    const mats: THREE.MeshStandardMaterial[] = [];
    e.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = GOO_OPACITY;
      mats.push(mat);
    });
    const rawH = T.height / Math.max(1e-4, e.body.scale.y);
    p = {
      e, tier, pack: pk, slot: slotFor(tier, pk.members.length), phase: 'rest', t: 0, wait: rand(...T.rest), ver: pk.ver,
      from: new THREE.Vector3(), to: new THREE.Vector3(x, 0, z), airTime: T.air, liftMax: T.lift, lift: 0, crossing: false, harmless: false,
      ring: new GroundMark(ctx.scene, RING_COLOR, false, T.radius).opacity(0),
      pullRing: v.absorbs && tier <= 1 ? new GroundMark(ctx.scene, PULL_COLOR, false, T.radius + PULL_REACH).opacity(0) : null, arm, rawH, sq: 0, sqv: 0, sqTarget: 0, pop: 1, mats,
      belly: v.absorbs && tier <= 1 && arm ? new Belly(arm, rawH) : null, gained: 0,
      spitIn: SPIT_FIRST + rand(0, 2), glob: null, shedAcc: 0, glowing: false, handled: false, handed: false,
    };
    pk.members.push(p);
    pieces.push(p);
    byId.set(e.id, p);
    return p;
  }

  const spitter = (p: Piece) => !!spit && TIERS[p.tier].spitEvery > 0;

  function spitEvery(p: Piece): number {
    const frac = p.e.hp / Math.max(1, p.e.maxHp);
    let every = TIERS[p.tier].spitEvery * (1 - SPIT_RAGE * (1 - frac)) * Math.max(0.6, 1 - SPIT_PER_LEVEL * ctx.level);
    if (v.holds) every *= Math.max(0.6, 1 - ctx.clock() / BAND_SPIT_RAMP);
    return every;
  }

  function startSpit(p: Piece): boolean {
    // de a una marca por vez siguiéndote (con dos medianos, uno espera)
    if (!spit || spit.globs.some((g) => !g.launched)) return false;
    p.glob = spit.prepare(p.e, TIERS[p.tier].puddle);
    p.phase = 'spit';
    p.t = 0;
    p.spitIn = spitEvery(p);
    const e = p.e;
    // el clip de ataque se estira para atrás y se estrella para adelante: el golpe (al 45 %) es la escupida
    if (e.animator.has('Attack')) e.animator.playOneShot('Attack', (0.45 * e.animator.clipDuration('Attack')) / SPIT_WINDUP);
    return true;
  }

  /** Salta, si le toca: el que manda decide adónde va la manada; los demás, a su lugar en la ronda. */
  function tryHop(p: Piece): void {
    const pk = p.pack;
    const lead = pk.members[0];
    if (lead === p) planPack(pk, p);
    else if (pk.ver === p.ver && p.t < p.wait + FOLLOW_PATIENCE) return;
    p.ver = pk.ver;
    const T = TIERS[p.tier];
    const e = p.e;
    const stop = stopZ(p.tier);
    p.crossing = pk.crossing && e.position.z <= stop + 1.2;
    let tx = pk.anchor.x + p.slot.x;
    let tz = p.crossing ? TEE_Z - CROSS_DEPTH + p.slot.y * 0.5 : pk.anchor.y + p.slot.y;
    if (!p.crossing && !v.holds) tz = Math.max(tz, stop);
    const dx = tx - e.position.x;
    const dz = tz - e.position.z;
    const d = Math.hypot(dx, dz);
    if (d > T.reach && !p.crossing) {
      tx = e.position.x + (dx / d) * T.reach;
      tz = e.position.z + (dz / d) * T.reach;
    }
    const half = halfAt(tz, T.radius);
    tx = THREE.MathUtils.clamp(tx, -half, half);
    // un salto de nada no vale: se queda un rato más
    if (Math.hypot(tx - e.position.x, tz - e.position.z) < 0.3 && !p.crossing) {
      p.t = 0;
      p.wait = rand(...T.rest) * 0.5;
      return;
    }
    p.to.set(tx, 0, tz);
    p.phase = 'crouch';
    p.t = 0;
    p.harmless = false;
    const dist = Math.hypot(tx - e.position.x, tz - e.position.z);
    p.airTime = T.air * (0.7 + 0.3 * Math.min(1, dist / T.reach));
    p.liftMax = T.lift * (0.6 + 0.4 * Math.min(1, dist / T.reach));
    const danger = tz < TEE_Z + e.radius + 1.5;
    p.ring.color(danger ? RING_DANGER : RING_COLOR).size(e.radius).at(tx, tz).opacity(0.2);
  }

  /** Cae: se aplasta, deja baba, le pega al que esté abajo, come lo que tocó, y si cruzó, lo larga al juego. */
  function land(p: Piece): void {
    const T = TIERS[p.tier];
    const e = p.e;
    p.phase = 'rest';
    p.t = 0;
    p.lift = 0;
    p.wait = rand(...T.rest) + (e.position.z <= stopZ(p.tier) + 0.3 ? LINE_WAIT : 0);
    p.sqv += 5;
    p.ring.opacity(0);
    decal(e.position.x, e.position.z, e.radius);
    ctx.audio.thud();
    if (!p.harmless && !ctx.over() && touchesPlayer(ctx, e, e.radius + 0.5)) hurt(p);
    if (p.belly) eat(p);
    if (p.crossing) handOver(p);
  }

  function hurt(p: Piece): void {
    if (!ctx.player().invulnerable) stats.golpes++;
    ctx.hitPlayer(TIERS[p.tier].trample, p.e.position, p.e);
  }

  /** Cruzó la línea: de acá lo lleva el juego, a la puerta, con lo que tenga adentro. */
  function handOver(p: Piece): void {
    p.handed = true;
    p.pullRing?.opacity(0);
    stats.cruzaron++;
    if (p.belly) {
      p.e.stats.gateDamage += p.belly.gateDamage;
      p.belly.clear();
    }
    stats.puertaPotencial += p.e.stats.gateDamage;
    resetPose(p);
    p.ring.opacity(0);
    p.e.script = null;
    leaveP(p);
  }

  function step(p: Piece, dt: number): void {
    const e = p.e;
    const T = TIERS[p.tier];
    if (ctx.over()) {
      e.animator.setLocomotion('Idle', 1);
      p.sqTarget = 0;
      p.lift = 0;
      pose(p, dt);
      return;
    }
    // el frío lo hace más lento en el piso; congelado (solo el chico) se queda quieto. En el aire, sigue
    const k = e.frozen ? 0 : e.chilled ? CHILL_TIME : 1;
    p.t += p.phase === 'air' || p.phase === 'spit' ? dt : dt * k;
    p.pop = Math.min(1, p.pop + dt / 0.4);
    // el reloj de la escupida corre saltando o quieto; escupe en el próximo descanso
    if (p.phase !== 'spit') p.spitIn -= dt * k;
    switch (p.phase) {
      case 'rest': {
        e.animator.setLocomotion('Idle', 0.5 + 0.5 * k);
        p.sqTarget = 0.04 * Math.sin(ctx.clock() * 5 + e.id);
        // en la línea, tocarlo pega (como al que te pasa por encima)
        if (e.position.z < TEE_Z + e.radius + 1.2 && touchesPlayer(ctx, e, e.radius + 0.45)) hurt(p);
        if (spitter(p) && p.spitIn <= 0 && e.position.z > SPIT_MIN_Z && k > 0) {
          if (startSpit(p)) break;
          p.spitIn = 0.8;
        }
        if (p.t >= p.wait && k > 0) tryHop(p);
        break;
      }
      case 'crouch': {
        const u = Math.min(1, p.t / T.crouch);
        p.sqTarget = 0.3 * u;
        e.faceToward(p.to.x, p.to.z, dt, 5);
        p.ring.opacity(0.2 + 0.4 * u);
        if (p.t >= T.crouch) {
          p.phase = 'air';
          p.t = 0;
          p.from.copy(e.position);
        }
        break;
      }
      case 'air': {
        const u = Math.min(1, p.t / p.airTime);
        e.knock.set(0, 0, 0);
        e.position.x = p.from.x + (p.to.x - p.from.x) * u;
        e.position.z = p.from.z + (p.to.z - p.from.z) * u;
        e.position.y = heightAt(e.position.x, e.position.z);
        p.lift = p.liftMax * Math.sin(Math.PI * u);
        // estirado al subir, aplastado al caer
        p.sqTarget = -0.2 * Math.cos(Math.PI * u);
        e.faceToward(p.to.x, p.to.z, dt, 6);
        p.ring.opacity(0.6 + 0.3 * u);
        if (u >= 1) land(p);
        break;
      }
      case 'spit': {
        if (p.glob) e.faceToward(ctx.spots()[p.glob.spot], TEE_Z, dt, 7);
        const u = Math.min(1, p.t / SPIT_WINDUP);
        // se infla (más alto) mientras junta la baba, y se aplasta al escupir
        p.sqTarget = p.t < SPIT_WINDUP ? -0.22 * u : 0.15;
        p.glowing = p.t < SPIT_WINDUP;
        if (p.t >= SPIT_WINDUP + SPIT_RECOVER) {
          p.phase = 'rest';
          p.t = 0;
          p.wait = 0.25;
          p.glowing = false;
          p.glob = null;
        }
        break;
      }
    }
    pose(p, dt);
  }

  /** El aplastado y el salto se hacen en el esqueleto, así no se pisan con el aplastado de los golpes. */
  function pose(p: Piece, dt: number): void {
    p.sqv += (-SPRING_K * (p.sq - p.sqTarget) - SPRING_C * p.sqv) * dt;
    p.sq = THREE.MathUtils.clamp(p.sq + p.sqv * dt, -0.35, 0.4);
    const arm = p.arm;
    if (!arm) return;
    const pop = 0.45 + 0.55 * p.pop;
    arm.scale.set((1 + 0.5 * p.sq) * pop, (1 - p.sq) * pop, (1 + 0.5 * p.sq) * pop);
    arm.position.y = (p.lift * p.rawH) / Math.max(0.1, p.e.height);
    if (p.glowing) {
      const g = 0.5 + 0.5 * Math.sin(ctx.clock() * 18);
      for (const m of p.mats) m.emissive.setRGB(0.35 * g, 0.05 * g, 0.65 * g);
    }
  }

  function resetPose(p: Piece): void {
    p.lift = 0;
    p.sq = p.sqv = 0;
    p.glowing = false;
    if (p.arm) {
      p.arm.scale.setScalar(1);
      p.arm.position.y = 0;
    }
  }

  function decal(x: number, z: number, r: number): void {
    let d = decals.find((k) => k.t >= DECAL_LIFE);
    if (!d) {
      d = { mark: new GroundMark(ctx.scene, DECAL_COLOR, true, r), t: 0 };
      decals.push(d);
    }
    d.t = 0;
    d.mark.size(r * 0.85).at(x, z).opacity(0.4);
  }

  /** Chupa a los de la escolta que pasan cerca: se deslizan hacia él (en el piso, y con lugar en la panza). */
  function pull(p: Piece, dt: number): void {
    const ring = p.pullRing;
    if (!ring) return;
    const on = !!p.belly && p.phase !== 'air' && p.belly.list.length < BELLY_MAX && !ctx.over();
    const reach = p.e.radius + PULL_REACH;
    ring.size(reach).at(p.e.position.x, p.e.position.z).opacity(on ? 0.2 + 0.1 * Math.sin(ctx.clock() * 4) : 0);
    if (!on) return;
    for (const en of horde.enemies) {
      if (!edible(en)) continue;
      const dx = p.e.position.x - en.position.x;
      const dz = p.e.position.z - en.position.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + en.radius || d < 0.01) continue;
      const step = Math.min(PULL_SPEED * dt, d);
      en.position.x += (dx / d) * step;
      en.position.z += (dz / d) * step;
    }
  }

  /** Se come a los de la escolta que toca (en el piso). */
  function eat(p: Piece): void {
    if (!p.belly || p.phase === 'air') return;
    for (const en of horde.enemies) {
      if (p.belly.list.length >= BELLY_MAX) return;
      if (!edible(en)) continue;
      if (Math.hypot(en.position.x - p.e.position.x, en.position.z - p.e.position.z) > p.e.radius + en.radius * 0.5) continue;
      const gain = en.hp;
      ctx.effects.spark(en.position.clone().setY(en.position.y + en.height * 0.5), 0xb36bff);
      p.belly.swallow(en, rng);
      p.e.setHp(p.e.hp + gain, p.e.maxHp + gain);
      p.gained += gain;
      lifeTotal += gain;
      p.e.mods.giant = 1 + Math.min(GROW_MAX, p.gained * GROW_PER_HP);
      p.sqv -= 3;
      stats.tragados++;
      ctx.audio.bubbleUp();
      if (!toldEat) {
        toldEat = true;
        ctx.feedback(L('¡Se los come!', 'It eats them!'));
      }
    }
  }

  /** El que gotea: cada `sheds` de daño se le cae un chico, que sale de costado y se va con la manada. */
  function shed(p: Piece): void {
    while (v.sheds && p.shedAcc >= v.sheds) {
      p.shedAcc -= v.sheds;
      const { x, z } = p.e.position;
      const side = rng() < 0.5 ? -1 : 1;
      const fwd = z - SPLIT_FORWARD < stopZ(2) + 1 ? 0 : SPLIT_FORWARD;
      const c = spawnPiece(2, x + side * p.e.radius * 0.5, z, joinPack(2, x, z - fwd));
      const half = halfAt(z, TIERS[2].radius);
      c.phase = 'air';
      c.t = 0;
      c.from.copy(c.e.position);
      c.to.set(THREE.MathUtils.clamp(x + side * (p.e.radius + SHED_SIDE), -half, half), 0, Math.max(z - fwd, stopZ(2)));
      c.airTime = SPLIT_AIR;
      c.liftMax = 1.2;
      c.harmless = true;
      c.pop = 0;
      c.ring.size(c.e.radius).at(c.to.x, c.to.z).opacity(0.5);
      stats.goteados++;
      lifeTotal += c.e.maxHp;
      ctx.audio.bubblePop();
    }
  }

  /** Murió: suelta a los de adentro y, si le toca, se parte en dos más chicos. */
  function died(p: Piece): void {
    p.handled = true;
    p.pullRing?.opacity(0);
    resetPose(p);
    p.ring.opacity(0);
    leaveP(p);
    const { x, z } = p.e.position;
    if (p.belly?.list.length) {
      const out = p.belly.release(horde, x, z, p.e.radius, rng);
      for (const en of out) freed.set(en.id, ctx.clock() + RELEASE_GRACE);
      stats.salieron += out.length;
      ctx.audio.bubblePop();
      ctx.effects.explosion(new THREE.Vector3(x, 0.6, z), p.e.radius + 1.2, 0x8a3fd0);
    }
    if (p.tier >= v.splits || p.tier >= 2) return;
    stats.divisiones++;
    const tier = p.tier + 1;
    const T = TIERS[tier];
    ctx.effects.explosion(new THREE.Vector3(x, 0.6, z), p.e.radius, 0x9a4ae0);
    ctx.audio.bubblePop();
    if (!toldSplit) {
      toldSplit = true;
      ctx.feedback(L('¡Se divide!', 'It splits!'));
    }
    // cerca de la línea salen de costado nomás: que no caigan encima del golfista sin aviso
    const fwd = z - SPLIT_FORWARD < stopZ(tier) + 1 ? 0 : SPLIT_FORWARD;
    const pk = joinPack(tier, x, z - fwd);
    for (const side of [-1, 1]) {
      const c = spawnPiece(tier, x, z, pk);
      const half = halfAt(z, T.radius);
      c.phase = 'air';
      c.t = 0;
      c.from.set(x, 0, z);
      c.to.set(THREE.MathUtils.clamp(x + side * SPLIT_SIDE, -half, half), 0, Math.max(z - fwd, v.holds ? 0 : stopZ(tier)));
      c.airTime = SPLIT_AIR;
      c.liftMax = 1.3;
      c.harmless = true;
      c.pop = 0;
      c.ring.size(c.e.radius).at(c.to.x, c.to.z).opacity(0.5);
    }
  }

  // el grande entra saltando desde el fondo
  {
    const pk = joinPack(0, 0, ENTER_Z);
    const x0 = rand(-8, 8);
    const p = spawnPiece(0, x0, ENTER_Z, pk);
    p.wait = 0.4;
  }

  /** ¿Algo del limo le cae o lo toca al que esté parado en el puesto de `x`, en los próximos `within` s? */
  function danger(x: number, within: number): boolean {
    if (spit?.danger(x, within)) return true;
    for (const p of pieces) {
      if (p.handled || p.handed || !p.e.alive) continue;
      const reach = p.e.radius + 1.1;
      const T = TIERS[p.tier];
      if ((p.phase === 'crouch' || p.phase === 'air') && !p.harmless && p.to.z < TEE_Z + reach + 0.5 && Math.abs(p.to.x - x) < reach) {
        const left = p.phase === 'crouch' ? T.crouch - p.t + p.airTime : p.airTime - p.t;
        if (left < within + 0.5) return true;
      }
      // quieto en la línea: tocarlo pega
      if (p.phase !== 'air' && p.e.position.z < TEE_Z + reach + 0.6 && Math.abs(p.e.position.x - x) < reach) return true;
    }
    return false;
  }

  /** ¿Este de la escolta está por ser comido? */
  function aboutToBeEaten(en: Enemy): boolean {
    return pieces.some((p) => p.belly && !p.handled && !p.handed && p.e.alive && Math.hypot(en.position.x - p.e.position.x, en.position.z - p.e.position.z) < p.e.radius + 5);
  }

  return {
    get done() {
      return pieces.every((p) => p.handled || p.handed);
    },
    update(dt) {
      for (const p of pieces) {
        if (p.handled) continue;
        if (!p.handed && !p.e.alive) died(p);
        else if (!p.handed) {
          pull(p, dt);
          if (p.phase !== 'air') eat(p);
          shed(p);
        }
        p.belly?.update(dt);
      }
      // los que ya no están (muertos y fuera de la escena, o en la puerta), afuera de la lista
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        if ((p.handled || p.handed) && p.e.state === 'gone') {
          p.ring.dispose();
          p.pullRing?.dispose();
          p.belly?.clear();
          byId.delete(p.e.id);
          pieces.splice(i, 1);
        }
      }
      spit?.update(dt);
      for (const d of decals) {
        if (d.t >= DECAL_LIFE) continue;
        d.t += dt;
        d.mark.opacity(0.4 * Math.max(0, 1 - d.t / DECAL_LIFE));
      }
    },
    bot: {
      danger,
      weight(e) {
        const p = byId.get(e.id);
        if (p) {
          if (p.tier === 2) return SMALL_WEIGHT;
          return p.e.position.z < TEE_Z + 8 ? AT_LINE_WEIGHT : 1;
        }
        return v.absorbs && aboutToBeEaten(e) ? FOOD_WEIGHT : 1;
      },
    },
    log: () => ({
      version: v.id, // i18n-ok: el registro
      limos: pieces.filter((p) => !p.handled && !p.handed).length,
      divisiones: stats.divisiones,
      goteados: stats.goteados,
      tragados: stats.tragados,
      salieron: stats.salieron,
      escupidas: spit?.spat ?? 0,
      charcos: spit?.puddled ?? 0,
      pelotasComidas: spit?.eaten ?? 0,
      golpesEscupida: spit?.hits ?? 0,
      golpesSalto: stats.golpes,
      cruzaron: stats.cruzaron,
      puertaPotencial: stats.puertaPotencial,
      vidaTotal: lifeTotal,
    }),
    dispose() {
      for (const p of pieces) {
        p.ring.dispose();
        p.pullRing?.dispose();
        p.belly?.clear();
      }
      for (const d of decals) d.mark.dispose();
      spit?.dispose();
    },
  };
}
