// La pelea con el limo venenoso (ver docs/jefes/limo.md). Un limo grande que se arrastra hacia la línea en
// diagonal, despacio, y cambia de diagonal de a ratos. Cada tanto **se junta para saltar** (se aplasta y
// brilla, y el piso marca el carril y adónde cae): si no lo cortás con un golpe fuerte, salta varios metros
// hacia la línea de una. Cortado, retrocede un poco y queda mareado. Según la versión:
// - se divide al morir: el grande en dos medianos y cada mediano en dos chicos, cada vez más rápidos; los
//   hermanos van en diagonales espejadas y se cruzan (a veces el área agarra a los dos, a veces no);
// - se come a la escolta que toca: gana su vida, se los ve adentro, y salen vivos cuando revienta;
// - escupe a los puestos: el charco deja ese puesto sin pelota un rato (ver charcos.ts). La escupida
//   también se corta con un golpe fuerte mientras se infla.
// El que llega a la línea se queda ahí unos segundos (pega si lo tocás, y el piso late en rojo) y después
// la cruza: de ahí camina a la puerta como cualquiera, y **la rompe entera** (perdés), sea del tamaño que
// sea. Leandro, 15/10: «si llega cualquier parte del limo, perdés, y balanceémoslo para eso» (antes sacaba
// un poco, y con la puerta sana se lo podía ignorar).
//
// 15/10, Leandro: «el boss estuvo saltando por ahí en la suya y ni me di cuenta que estaba avanzando
// realmente», «vaya moviéndose lento en diagonal poco angulada, y cambiando de dirección de a ratos, en
// especial cuando son más de uno», «cortarle el ataque con un golpe fuerte», y los que llegaron a la puerta
// no le hicieron perder. Antes saltaba todo el tiempo, en zigzag, en manada.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { BossBar, GroundMark, LaneMark, SPAWN_Z, TEE_Z, facet, fieldHalfAt, flatMat, heightAt, partStats, touchesPlayer } from '../kit';
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
  /** Lo que avanza arrastrándose (m/s hacia la línea), y cuánto se abre de costado por metro (la diagonal). */
  glide: number;
  slant: number;
  /** Cada cuánto cambia de diagonal cuando va solo (con un hermano, cuando ya se cruzaron). */
  turn: [number, number];
  /**
   * El salto, su ataque: cada cuánto (0 = no salta), cuánto se junta antes (la ventana para cortarlo),
   * cuánto avanza, cuánto está en el aire y lo alto.
   */
  leapEvery: [number, number];
  gather: number;
  leap: number;
  air: number;
  lift: number;
  /** Lo que saca si te cae encima o lo tocás en la línea (a la puerta, si cruza, la rompe entera). */
  trample: number;
  /** Cuánto se queda en la línea antes de cruzarla: la última ventana para matarlo. */
  lineWait: number;
  /** A qué velocidad camina una vez que cruzó la línea (ahí lo lleva el juego, como a cualquiera). */
  speed: number;
  /** Escupe cada tantos segundos (0 = no escupe), y lo que dura su charco. */
  spitEvery: number;
  puddle: number;
  heavy: boolean;
  boss: boolean;
  score: number;
}

// Sin cortarle ningún salto, el grande llega a la línea en menos de un minuto (va a 0.45 m/s y salta 6.5 m
// cada 9 s más o menos); cortándole todos, en más de tres. Cualquiera que cruza rompe la puerta: por eso
// se queda en la línea unos segundos (el grande 4, el chico 3) y los chicos van despacio (1 m/s).
const TIERS: Tier[] = [
  { name: L('Limo venenoso', 'Poison Slime'), height: 2.4, radius: 1.7, glide: 0.45, slant: 0.42, turn: [4, 7], leapEvery: [7, 10], gather: 1.8, leap: 6.5, air: 1.0, lift: 2.6, trample: 2, lineWait: 4, speed: 1.1, spitEvery: 6.5, puddle: 14, heavy: true, boss: true, score: 150 },
  { name: L('Limo mediano', 'Slime'), height: 1.6, radius: 1.12, glide: 0.7, slant: 0.5, turn: [3, 5], leapEvery: [6, 9], gather: 1.4, leap: 5, air: 0.8, lift: 1.9, trample: 1, lineWait: 3.5, speed: 1.8, spitEvery: 9, puddle: 10, heavy: true, boss: true, score: 50 },
  { name: L('Limo chico', 'Small Slime'), height: 1.0, radius: 0.7, glide: 1.0, slant: 0.55, turn: [2, 3.5], leapEvery: [0, 0], gather: 0, leap: 0, air: 0.45, lift: 1.0, trample: 1, lineWait: 3, speed: 3.0, spitEvery: 0, puddle: 0, heavy: false, boss: false, score: 20 },
];

/** Entra desde un poco más allá de donde aparecen los demás. */
const ENTER_Z = SPAWN_Z + 3;
/** Se para a esta distancia de la línea (sobre su radio), espera ahí lo de su tamaño (`lineWait`), y la cruza. */
const LINE_GAP = 0.6;
/** La presión: se arrastra más rápido con la pelea, hasta un 50 % más a los 150 s. */
const SPEED_UP = { max: 0.5, time: 150 };
/** El arrastre: avanza a pulsos (como una oruga), tantos por segundo y de tanto. */
const CRAWL = { rate: [3.2, 4.2, 6], amp: 0.55 };
/** Con frío, los relojes corren a esto (al chico, además, el hielo lo congela). */
const CHILL_TIME = 0.55;
/** Lo que corta el salto (y la escupida) mientras se junta: un golpe 2 o 3, o una habilidad. */
const CUT_QUALITY = 2;
/** Cortado: retrocede tanto (m, en tanto s) y queda mareado tanto. */
const CUT_PUSH = 2.2;
const CUT_SLIDE = 0.35;
const CUT_STUN = 1.1;
/** El salto que cae en la línea apunta a tu puesto, pero se corre como mucho esto del suyo (sobre su largo). */
const LEAP_AIM = 0.6;
const LEAP_COLOR = 0xff8a3c;
/** El primero sale enseguida de entrar (que se vea pronto qué hace). */
const FIRST_LEAP = 3.5;
/** Al dividirse: los dos salen para los costados, y se cruzan; quedan tanto adelante/atrás uno del otro. */
const SPLIT_SIDE = 2.4;
const SPLIT_FORWARD = 1.5;
const SPLIT_AIR = 0.55;
const SPLIT_STAGGER = 0.5;
/** Después de cruzarse, los hermanos se separan esto (al azar) antes de volver a encararse. */
const CROSS_GAP: [number, number] = [2.5, 5.5];
/** Los de un tamaño van juntos (se cruzan de a dos) si están a menos de esto; si no, arman otra. Hasta 4. */
const PACK_JOIN = 12;
const PACK_MAX = 4;
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
/**
 * El que se planta: una franja de media cancha que se acerca un poco por segundo, **sin tope**: si no lo
 * matás, a los dos minutos y pico llega a la línea y la cruza como cualquiera (antes paraba a 28 m y solo
 * te escupía: se lo podía dejar para el final sin que la puerta corriera peligro).
 */
const BAND_FAR = 46;
const BAND_DEPTH = 12;
const BAND_CREEP = 0.25;
/** Y escupe cada vez más seguido: a los 5 minutos, al 60 %. */
const BAND_SPIT_RAMP = 300;
/** La baba se ve a través: lo que se comió, la calavera y la espada que ya tenía. */
const GOO_OPACITY = 0.72;
/** El resorte del aplastado (el mismo tipo que el de los golpes). */
const SPRING_K = 170;
const SPRING_C = 15;
/** Las marcas: dónde va a caer (violeta; en rojo si cae sobre la línea) y la baba que deja (y su rastro). */
const RING_COLOR = 0x7a3cc8;
const RING_DANGER = 0xff5a3c;
const DECAL_COLOR = 0x3d1660;
const DECAL_LIFE = 2.6;
const TRAIL_STEP = 1.3;
const TRAIL_LIFE = 6;
/** Con dificultad: más vida por nivel, y escupe más seguido. */
const HP_PER_LEVEL = 0.03;
const SPIT_PER_LEVEL = 0.02;
/** El que gotea: el chico sale despedido a tanto de costado, en un salto corto. */
const SHED_SIDE = 2.6;
/** Para el bot: el que se junta para saltar (cortalo), el chico, el que está en la línea, y lo que está por comerse. */
const GATHER_WEIGHT = 2.6;
const SMALL_WEIGHT = 2.5;
const AT_LINE_WEIGHT = 1.8;
/** El que está en la línea por cruzar: si cruza, se pierde. */
const LINE_WEIGHT = 5;
const FOOD_WEIGHT = 1.5;

interface Pack {
  tier: number;
  members: Piece[];
  /** Cuánto falta para que cambien de diagonal. */
  turnIn: number;
}

type Phase = 'glide' | 'gather' | 'air' | 'spit' | 'stunned' | 'line';

interface Piece {
  e: Enemy;
  tier: number;
  pack: Pack;
  phase: Phase;
  t: number;
  /** Para qué lado se abre la diagonal (-1 / 1). */
  sx: number;
  leapIn: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  airTime: number;
  liftMax: number;
  lift: number;
  /** El salto de cuando nace (al dividirse) no le pega a nadie. */
  harmless: boolean;
  /** Le entró un golpe fuerte mientras se juntaba (lo lee el guion en su vuelta). */
  cutPending: boolean;
  /** Ya le dijimos «más fuerte» en este salto. */
  weakTold: boolean;
  ring: GroundMark;
  lane: LaneMark | null;
  /** Hasta dónde chupa (el que come). */
  pullRing: GroundMark | null;
  /** El disco rojo de cuando está en la línea, por cruzar. */
  alarm: GroundMark | null;
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
  /** Brilla: violeta escupiendo, naranja juntándose para saltar. */
  glow: 'spit' | 'leap' | null;
  trail: number;
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
  const bar = new BossBar(L('Limo venenoso', 'Poison Slime'), '#8a3fd0');
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
  const decals: { mark: GroundMark; t: number; life: number; alpha: number }[] = [];
  const stats = { divisiones: 0, goteados: 0, tragados: 0, salieron: 0, golpes: 0, llegaron: 0, cruzaron: 0, saltos: 0, cortes: 0, cortesEscupida: 0 };
  let toldSplit = false;
  let toldEat = false;
  let toldLeap = false;
  let toldLine = false;
  /** La vida que le queda por delante a cada tamaño contando lo que va a nacer (para la barra y el registro). */
  const ahead = (t: number): number => (t < v.splits && t < 2 ? 2 * (tierHp(t + 1) + ahead(t + 1)) : 0);
  let lifeTotal = tierHp(0) + ahead(0);

  const speedUp = () => 1 + SPEED_UP.max * Math.min(1, ctx.clock() / SPEED_UP.time);
  /** Lo que se corre de costado por segundo un limo de ese tamaño. */
  const lateral = (tier: number) => TIERS[tier].glide * TIERS[tier].slant * speedUp();

  // ---- las manadas: los de un tamaño que van juntos se cruzan de a dos ----

  function joinPack(tier: number, x: number, z: number): Pack {
    for (const p of packs) {
      if (p.tier !== tier || p.members.length >= PACK_MAX) continue;
      const lead = p.members[0];
      if (lead && Math.hypot(lead.e.position.x - x, lead.e.position.z - z) < PACK_JOIN) return p;
    }
    const p: Pack = { tier, members: [], turnIn: rand(...TIERS[tier].turn) };
    packs.push(p);
    return p;
  }

  function leaveP(p: Piece): void {
    const pk = p.pack;
    const i = pk.members.indexOf(p);
    if (i >= 0) pk.members.splice(i, 1);
    if (!pk.members.length && packs.includes(pk)) packs.splice(packs.indexOf(pk), 1);
  }

  /**
   * Cambian de diagonal. De a dos: se encaran (cada uno hacia el otro) y siguen hasta pasarse y separarse
   * unos metros; ahí vuelven a encararse. El que va solo da vuelta (o va hacia la comida, o hacia el medio).
   */
  function turnPack(pk: Pack): void {
    const T = TIERS[pk.tier];
    const m = pk.members.filter((p) => p.phase !== 'line');
    let next = rand(...T.turn);
    for (let i = 0; i + 1 < m.length; i += 2) {
      const a = m[i];
      const b = m[i + 1];
      const dx = b.e.position.x - a.e.position.x;
      a.sx = dx >= 0 ? 1 : -1;
      b.sx = -a.sx;
      next = Math.max(i ? next : 0, (Math.abs(dx) + rand(...CROSS_GAP)) / (2 * lateral(pk.tier)));
    }
    if (m.length % 2) {
      const p = m[m.length - 1];
      const { x, z } = p.e.position;
      const f = p.belly && p.belly.list.length < BELLY_MAX ? food(x, z, p.tier) : null;
      if (f) {
        p.sx = f.x >= x ? 1 : -1;
        next = Math.min(next, rand(1.5, 3));
      } else if (Math.abs(x) > halfAt(z, p.e.radius) * 0.6) p.sx = x > 0 ? -1 : 1;
      else p.sx = -p.sx;
    }
    pk.turnIn = THREE.MathUtils.clamp(next, 1.5, 9);
  }

  /** Lo que está por delante del campo (en x) a esa altura, para no salirse. */
  const halfAt = (z: number, r: number) => Math.max(1, fieldHalfAt(z) - r - 0.4);
  const stopZ = (tier: number) => TEE_Z + TIERS[tier].radius + LINE_GAP;

  /** La franja del que se planta (escupe): se acerca con el tiempo. */
  function band(): [number, number] {
    const far = Math.max(TEE_Z, BAND_FAR - ctx.clock() * BAND_CREEP);
    return [far - BAND_DEPTH, far];
  }

  function edible(en: Enemy): boolean {
    if (!en.alive || en.passed || en.script || en.mods.apart || en.stats.boss || en.size > 1 || en.grabbing || en.hold || en.position.z <= EAT_MIN_Z) return false;
    const until = freed.get(en.id);
    return until === undefined || ctx.clock() > until;
  }

  /** Hacia dónde ir a comer: donde está el grupo más grande cerca, o null. */
  function food(x: number, z: number, tier: number): THREE.Vector2 | null {
    void tier;
    const near = horde.enemies.filter((en) => edible(en) && Math.hypot(en.position.x - x, en.position.z - z) < SEEK_RANGE);
    let best: THREE.Vector2 | null = null;
    let bestScore = 0;
    for (const en of near) {
      let score = 0;
      for (const o of near) if (Math.hypot(o.position.x - en.position.x, o.position.z - en.position.z) < 3) score += 1 + 0.15 * o.hp;
      score /= 1 + Math.hypot(en.position.x - x, en.position.z - z) / 8;
      if (score > bestScore) {
        bestScore = score;
        best = new THREE.Vector2(en.position.x, en.position.z);
      }
    }
    return best;
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
      filter(_e, amount, shot) {
        // juntándose para saltar (o inflándose para escupir), un golpe fuerte lo corta
        const cuttable = p.phase === 'gather' || (p.phase === 'spit' && !!p.glob && !p.glob.launched);
        if (cuttable && shot) {
          if (shot.ability || shot.quality >= CUT_QUALITY) p.cutPending = true;
          else if (!p.weakTold) {
            p.weakTold = true;
            ctx.feedback(L('¡Más fuerte, para cortarlo!', 'Harder, to cut it!'));
          }
        }
        return amount;
      },
      onDamage(_e, dealt, killed) {
        // lo que gotea sale en la vuelta del jefe (acá estamos en medio de un golpe de la horda)
        if (v.sheds && p.tier === 0 && !killed) p.shedAcc += dealt;
      },
    };
    const st = partStats('slime', { name: T.name, height: T.height, radius: T.radius, hp: tierHp(tier), speed: T.speed, runs: tier === 2, damage: T.trample, gateDamage: Infinity, heavy: T.heavy, boss: T.boss, score: T.score });
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
      e, tier, pack: pk, phase: 'glide', t: 0, sx: rng() < 0.5 ? -1 : 1, leapIn: T.leap ? rand(...T.leapEvery) : Infinity,
      from: new THREE.Vector3(), to: new THREE.Vector3(x, 0, z), airTime: T.air, liftMax: T.lift, lift: 0, harmless: false, cutPending: false, weakTold: false,
      ring: new GroundMark(ctx.scene, RING_COLOR, false, T.radius).opacity(0), lane: null,
      pullRing: v.absorbs && tier <= 1 ? new GroundMark(ctx.scene, PULL_COLOR, false, T.radius + PULL_REACH).opacity(0) : null, alarm: null, arm, rawH, sq: 0, sqv: 0, sqTarget: 0, pop: 1, mats,
      belly: v.absorbs && tier <= 1 && arm ? new Belly(arm, rawH) : null, gained: 0,
      spitIn: SPIT_FIRST + rand(0, 2), glob: null, shedAcc: 0, glow: null, trail: 0, handled: false, handed: false,
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
    p.cutPending = false;
    p.weakTold = false;
    p.spitIn = spitEvery(p);
    const e = p.e;
    // el clip de ataque se estira para atrás y se estrella para adelante: el golpe (al 45 %) es la escupida
    if (e.animator.has('Attack')) e.animator.playOneShot('Attack', (0.45 * e.animator.clipDuration('Attack')) / SPIT_WINDUP);
    return true;
  }

  /** Se junta para saltar: marca el carril y adónde cae, y da tiempo para cortarlo. */
  function startGather(p: Piece): void {
    const T = TIERS[p.tier];
    const { x, z } = p.e.position;
    const stop = stopZ(p.tier);
    const tz = Math.max(stop, z - T.leap);
    let tx = x + p.sx * T.leap * T.slant;
    const atLine = tz <= stop + 0.5;
    // el que cae en la línea te busca: apunta a tu puesto (hasta donde le da el salto)
    if (atLine) tx = x + THREE.MathUtils.clamp(ctx.player().position.x - x, -T.leap * LEAP_AIM, T.leap * LEAP_AIM);
    const half = halfAt(tz, T.radius);
    tx = THREE.MathUtils.clamp(tx, -half, half);
    p.to.set(tx, 0, tz);
    p.phase = 'gather';
    p.t = 0;
    p.cutPending = false;
    p.weakTold = false;
    p.glow = 'leap';
    p.ring.color(atLine ? RING_DANGER : RING_COLOR).size(p.e.radius).at(tx, tz).opacity(0.25);
    p.lane = new LaneMark(ctx.scene, LEAP_COLOR, p.e.radius * 1.3).between(x, z, tx, tz).opacity(0.12);
    ctx.audio.growl();
    if (!toldLeap) {
      toldLeap = true;
      ctx.feedback(L('Se junta para saltar: ¡cortalo con un golpe fuerte!', 'It gathers to leap: cut it with a strong hit!'));
    }
  }

  /** Lo cortaste: no salta (ni escupe), retrocede un poco y queda mareado. */
  function cut(p: Piece): void {
    const T = TIERS[p.tier];
    const e = p.e;
    if (p.phase === 'spit') {
      if (p.glob) spit?.cancel(p.glob);
      p.glob = null;
      stats.cortesEscupida++;
    } else stats.cortes++;
    p.cutPending = false;
    p.glow = null;
    for (const m of p.mats) m.emissive.setRGB(0, 0, 0);
    p.ring.opacity(0);
    p.lane?.dispose();
    p.lane = null;
    p.phase = 'stunned';
    p.t = 0;
    p.from.copy(e.position);
    const back = v.holds ? 0 : Math.min(CUT_PUSH, ENTER_Z - e.position.z);
    p.to.set(e.position.x, 0, e.position.z + Math.max(0, back));
    p.leapIn = T.leap ? rand(...T.leapEvery) : Infinity;
    p.sqv -= 7;
    ctx.feedback(L('¡Cortado!', 'Cut!'));
    ctx.audio.bubblePop();
    ctx.effects.explosion(new THREE.Vector3(e.position.x, e.position.y + e.height * 0.5, e.position.z), e.radius, 0xb36bff);
  }

  /** Llegó a la línea: se queda ahí un momento (pega si lo tocás) y después la cruza. */
  function toLine(p: Piece): void {
    p.phase = 'line';
    p.t = 0;
    p.lane?.dispose();
    p.lane = null;
    stats.llegaron++;
    ctx.audio.growl();
    if (!toldLine) {
      toldLine = true;
      ctx.banner(L('¡Llegó a la línea!', 'It reached the line!'), L('Matalo antes de que cruce: si llega a la puerta, cae', 'Kill it before it crosses: if it reaches the gate, the gate falls'), 2.5);
    }
  }

  /** Cae: se aplasta, deja baba, le pega al que esté abajo, come lo que tocó; en la línea, se queda ahí. */
  function land(p: Piece): void {
    const e = p.e;
    p.phase = 'glide';
    p.t = 0;
    p.lift = 0;
    p.sqv += 5;
    p.ring.opacity(0);
    decal(e.position.x, e.position.z, e.radius * 0.85, DECAL_LIFE, 0.4);
    ctx.audio.thud();
    if (!p.harmless && !ctx.over() && touchesPlayer(ctx, e, e.radius + 0.5)) hurt(p);
    if (p.belly) eat(p);
    if (e.position.z <= stopZ(p.tier) + 0.3) toLine(p);
  }

  function hurt(p: Piece): void {
    if (!ctx.player().invulnerable) stats.golpes++;
    ctx.hitPlayer(TIERS[p.tier].trample, p.e.position, p.e);
  }

  /** Cruzó la línea: de acá lo lleva el juego, a la puerta, con lo que tenga adentro. */
  function handOver(p: Piece): void {
    p.handed = true;
    p.pullRing?.opacity(0);
    p.alarm?.opacity(0);
    stats.cruzaron++;
    // lo de la panza ya no cuenta: con lo suyo alcanza para romper la puerta
    p.belly?.clear();
    resetPose(p);
    p.ring.opacity(0);
    p.lane?.dispose();
    p.lane = null;
    p.e.script = null;
    leaveP(p);
  }

  /** Se arrastra en su diagonal, a pulsos, dejando un rastro de baba. */
  function glide(p: Piece, dt: number, k: number): void {
    const T = TIERS[p.tier];
    const e = p.e;
    const clock = ctx.clock();
    const rate = CRAWL.rate[p.tier];
    const pulse = 1 + CRAWL.amp * Math.sin(clock * rate + e.id);
    const f = speedUp() * pulse * k;
    let vz = -T.glide * f;
    const vx = p.sx * T.glide * T.slant * f;
    if (v.holds) {
      // hasta la franja entra derecho; ahí adentro va de costado nomás
      const [near, far] = band();
      if (e.position.z <= far) vz = e.position.z < near ? T.glide * 0.5 * k : 0;
    }
    let x = e.position.x + vx * dt;
    let z = Math.min(ENTER_Z, e.position.z + vz * dt);
    const half = halfAt(z, e.radius);
    if (x > half) {
      x = half;
      p.sx = -1;
    } else if (x < -half) {
      x = -half;
      p.sx = 1;
    }
    const stop = stopZ(p.tier);
    const atLine = z <= stop;
    if (atLine) z = stop;
    e.knock.set(0, 0, 0);
    e.position.set(x, heightAt(x, z), z);
    e.faceToward(x + vx, z + vz, dt, 3);
    // se estira al avanzar y se junta entre pulsos
    p.sqTarget = 0.09 * Math.sin(clock * rate + e.id + 1.4);
    p.trail += Math.hypot(vx, vz) * dt;
    if (p.trail > TRAIL_STEP) {
      p.trail = 0;
      decal(x, z + e.radius * 0.4, e.radius * 0.5, TRAIL_LIFE, 0.28);
    }
    if (atLine) toLine(p);
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
    p.t += p.phase === 'air' ? dt : dt * k;
    p.pop = Math.min(1, p.pop + dt / 0.4);
    if (p.phase !== 'spit') p.spitIn -= dt * k;
    switch (p.phase) {
      case 'glide': {
        e.animator.setLocomotion(e.animator.has('Walk') ? 'Walk' : 'Idle', 0.5 + 0.5 * k);
        if (k > 0) glide(p, dt, k);
        if (p.phase !== 'glide') break;
        p.leapIn -= dt * k;
        if (spitter(p) && p.spitIn <= 0 && e.position.z > SPIT_MIN_Z && k > 0) {
          if (startSpit(p)) break;
          p.spitIn = 0.8;
        }
        if (!v.holds && p.leapIn <= 0 && k > 0) {
          if (e.position.z > stopZ(p.tier) + 1.5) {
            startGather(p);
            stats.saltos++;
          } else p.leapIn = 1;
        }
        break;
      }
      case 'gather': {
        e.animator.setLocomotion('Idle', 1);
        const u = Math.min(1, p.t / T.gather);
        // se aplasta juntando fuerza, y tiembla al final
        p.sqTarget = 0.32 * u + (u > 0.6 ? 0.04 * Math.sin(ctx.clock() * 34) : 0);
        e.faceToward(p.to.x, p.to.z, dt, 5);
        p.ring.opacity(0.25 + 0.45 * u);
        p.lane?.opacity((0.12 + 0.3 * u) * (0.75 + 0.25 * Math.sin(ctx.clock() * (6 + 10 * u))));
        if (p.cutPending || e.stunned || e.frozen) {
          cut(p);
          break;
        }
        if (p.t >= T.gather) {
          p.phase = 'air';
          p.t = 0;
          p.from.copy(e.position);
          p.airTime = T.air;
          p.liftMax = T.lift;
          p.harmless = false;
          p.glow = null;
          for (const m of p.mats) m.emissive.setRGB(0, 0, 0);
          p.lane?.dispose();
          p.lane = null;
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
        p.glow = p.t < SPIT_WINDUP ? 'spit' : null;
        if (p.glob && !p.glob.launched && (p.cutPending || e.stunned || e.frozen)) {
          cut(p);
          break;
        }
        if (p.t >= SPIT_WINDUP + SPIT_RECOVER) {
          p.phase = 'glide';
          p.t = 0;
          p.glow = null;
          for (const m of p.mats) m.emissive.setRGB(0, 0, 0);
          p.glob = null;
        }
        break;
      }
      case 'stunned': {
        e.animator.setLocomotion('Idle', 0.4);
        // retrocede de un empujón, y queda temblando
        const u = Math.min(1, p.t / CUT_SLIDE);
        const s = 1 - (1 - u) * (1 - u);
        const x = p.from.x;
        const z = p.from.z + (p.to.z - p.from.z) * s;
        e.knock.set(0, 0, 0);
        e.position.set(x, heightAt(x, z), z);
        p.sqTarget = 0.18 + 0.06 * Math.sin(ctx.clock() * 22);
        if (p.t >= CUT_STUN) {
          p.phase = 'glide';
          p.t = 0;
        }
        break;
      }
      case 'line': {
        e.animator.setLocomotion('Idle', 1);
        e.knock.set(0, 0, 0);
        e.faceToward(e.position.x, TEE_Z - 5, dt, 4);
        // está por cruzar: un disco rojo que se llena y un anillo grande que late cada vez más rápido
        const u = Math.min(1, p.t / T.lineWait);
        const beat = Math.abs(Math.sin(ctx.clock() * (5 + 14 * u)));
        p.ring.color(RING_DANGER).size(e.radius + 0.6 + 0.5 * beat).at(e.position.x, e.position.z).opacity(0.6 + 0.35 * beat);
        (p.alarm ??= new GroundMark(ctx.scene, RING_DANGER, true, e.radius)).size((e.radius + 0.5) * (0.3 + 0.7 * u)).at(e.position.x, e.position.z).opacity(0.25 + 0.35 * u);
        p.sqTarget = 0.12 * Math.sin(ctx.clock() * 9);
        for (const m of p.mats) m.emissive.setRGB(0.6 * beat * u, 0.05 * beat * u, 0.02 * beat * u);
        // tocarlo pega (como al que te pasa por encima)
        if (touchesPlayer(ctx, e, e.radius + 0.45)) hurt(p);
        if (p.t >= T.lineWait && k > 0) handOver(p);
        break;
      }
    }
    if (!p.handed) pose(p, dt);
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
    if (p.glow) {
      const g = 0.5 + 0.5 * Math.sin(ctx.clock() * 18);
      if (p.glow === 'spit') for (const m of p.mats) m.emissive.setRGB(0.35 * g, 0.05 * g, 0.65 * g);
      else for (const m of p.mats) m.emissive.setRGB(0.7 * g, 0.3 * g, 0.05 * g);
    }
  }

  function resetPose(p: Piece): void {
    p.lift = 0;
    p.sq = p.sqv = 0;
    p.glow = null;
    for (const m of p.mats) m.emissive.setRGB(0, 0, 0);
    if (p.arm) {
      p.arm.scale.setScalar(1);
      p.arm.position.y = 0;
    }
  }

  function decal(x: number, z: number, r: number, life: number, alpha: number): void {
    let d = decals.find((k) => k.t >= k.life);
    if (!d) {
      d = { mark: new GroundMark(ctx.scene, DECAL_COLOR, true, r), t: 0, life, alpha };
      decals.push(d);
    }
    d.t = 0;
    d.life = life;
    d.alpha = alpha;
    d.mark.size(r).at(x, z).opacity(alpha);
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

  /** Un recién nacido (al dividirse o al gotear): sale en un salto corto hasta (tx, tz), sin pegar. */
  function hatch(c: Piece, tx: number, tz: number, sx: number): void {
    c.phase = 'air';
    c.t = 0;
    c.from.copy(c.e.position);
    c.to.set(tx, 0, tz);
    c.airTime = SPLIT_AIR;
    c.liftMax = 1.3;
    c.harmless = true;
    c.pop = 0;
    c.sx = sx;
    c.ring.size(c.e.radius).at(tx, tz).opacity(0.5);
  }

  /** El que gotea: cada `sheds` de daño se le cae un chico, que sale de costado y corre a la línea. */
  function shed(p: Piece): void {
    while (v.sheds && p.shedAcc >= v.sheds) {
      p.shedAcc -= v.sheds;
      const { x, z } = p.e.position;
      const side = rng() < 0.5 ? -1 : 1;
      const fwd = z - SPLIT_FORWARD < stopZ(2) + 1 ? 0 : SPLIT_FORWARD;
      const c = spawnPiece(2, x + side * p.e.radius * 0.5, z, joinPack(2, x, z - fwd));
      const half = halfAt(z, TIERS[2].radius);
      hatch(c, THREE.MathUtils.clamp(x + side * (p.e.radius + SHED_SIDE), -half, half), Math.max(z - fwd, stopZ(2)), -side);
      stats.goteados++;
      lifeTotal += c.e.maxHp;
      ctx.audio.bubblePop();
    }
  }

  /** Murió: suelta a los de adentro y, si le toca, se parte en dos más chicos que se cruzan. */
  function died(p: Piece): void {
    p.handled = true;
    p.pullRing?.opacity(0);
    p.alarm?.opacity(0);
    resetPose(p);
    p.ring.opacity(0);
    p.lane?.dispose();
    p.lane = null;
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
      // uno un poco adelante del otro: al cruzarse pasan rozándose (el área agarra a los dos)
      const tz = Math.max(z - fwd + side * SPLIT_STAGGER, v.holds ? 0 : stopZ(tier));
      // salen para afuera y vuelven encarándose
      hatch(c, THREE.MathUtils.clamp(x + side * SPLIT_SIDE, -half, half), tz, -side);
      c.leapIn = T.leap ? rand(...T.leapEvery) + 1.5 : Infinity;
    }
    pk.turnIn = SPLIT_AIR + (2 * SPLIT_SIDE + rand(...CROSS_GAP)) / (2 * lateral(tier));
  }

  ctx.banner(L('Limo venenoso', 'Poison Slime'), L('Si un limo llega a la puerta, cae', 'If a slime reaches the gate, the gate falls'), 4);
  // el grande entra desde el fondo, y salta enseguida (que se vea qué hace)
  {
    const pk = joinPack(0, 0, ENTER_Z);
    const p = spawnPiece(0, rand(-8, 8), ENTER_Z, pk);
    p.sx = p.e.position.x > 0 ? -1 : 1;
    p.leapIn = FIRST_LEAP;
  }

  /** ¿Algo del limo le cae o lo toca al que esté parado en el puesto de `x`, en los próximos `within` s? */
  function danger(x: number, within: number): boolean {
    if (spit?.danger(x, within)) return true;
    for (const p of pieces) {
      if (p.handled || p.handed || !p.e.alive) continue;
      const reach = p.e.radius + 1.1;
      const T = TIERS[p.tier];
      if ((p.phase === 'gather' || p.phase === 'air') && !p.harmless && p.to.z < TEE_Z + reach + 0.5 && Math.abs(p.to.x - x) < reach) {
        const left = p.phase === 'gather' ? T.gather - p.t + T.air : p.airTime - p.t;
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

  /** La barra: la vida que le queda a todo el limo (contando lo que va a nacer), y lo cerca que está. */
  function updateBar(): void {
    let left = 0;
    let nearest = Infinity;
    let gathering = false;
    let atLine = false;
    let walking = false;
    for (const p of pieces) {
      if (p.handled) continue;
      if (p.handed) {
        if (p.e.alive) walking = true;
        continue;
      }
      if (!p.e.alive) continue;
      left += Math.max(0, p.e.hp) + ahead(p.tier);
      nearest = Math.min(nearest, p.e.position.z - p.e.radius - TEE_Z);
      if (p.phase === 'gather') gathering = true;
      if (p.phase === 'line') atLine = true;
    }
    const m = Math.max(0, Math.round(nearest));
    const sub = walking
      ? L('¡Va a romper la puerta!', 'It is going to break the gate!')
      : atLine
        ? L('¡En la línea! Si cruza, cae la puerta', 'At the line! If it crosses, the gate falls')
        : gathering
          ? L('Se junta para saltar: ¡golpe fuerte!', 'Gathering to leap: hit hard!')
          : Number.isFinite(nearest) ? L(`A ${m} m de la línea`, `${m} m from the line`) : '';
    bar.set(left, lifeTotal, sub);
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
          p.alarm?.dispose();
          p.lane?.dispose();
          p.belly?.clear();
          byId.delete(p.e.id);
          pieces.splice(i, 1);
        }
      }
      for (const pk of packs) {
        pk.turnIn -= dt;
        if (pk.turnIn <= 0) turnPack(pk);
      }
      spit?.update(dt);
      for (const d of decals) {
        if (d.t >= d.life) continue;
        d.t += dt;
        d.mark.opacity(d.alpha * Math.max(0, 1 - d.t / d.life));
      }
      updateBar();
    },
    bot: {
      danger,
      weight(e) {
        const p = byId.get(e.id);
        if (p) {
          if (p.phase === 'gather' || (p.phase === 'spit' && p.glob && !p.glob.launched)) return GATHER_WEIGHT;
          if (p.phase === 'line') return LINE_WEIGHT;
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
      saltos: stats.saltos,
      cortes: stats.cortes,
      cortesEscupida: stats.cortesEscupida,
      escupidas: spit?.spat ?? 0,
      charcos: spit?.puddled ?? 0,
      pelotasComidas: spit?.eaten ?? 0,
      golpesEscupida: spit?.hits ?? 0,
      golpesSalto: stats.golpes,
      llegaron: stats.llegaron,
      cruzaron: stats.cruzaron,
      vidaTotal: lifeTotal,
    }),
    dispose() {
      bar.dispose();
      for (const p of pieces) {
        p.ring.dispose();
        p.pullRing?.dispose();
        p.alarm?.dispose();
        p.lane?.dispose();
        p.belly?.clear();
      }
      for (const d of decals) d.mark.dispose();
      spit?.dispose();
    },
  };
}
