// El Caballero negro (14/10): los chamanes goblin hicieron su propio hechizo, pidieron «un gran golfista»
// y les salió un reflejo oscuro del golfista. Se planta a 28 m con su propia fila de puestos y le pega a
// la puerta (o a tu puesto) con la misma barra que vos, que se ve arriba de su cabeza: soltar en el rojo
// le saca 3, en el amarillo 2, en el verde 1. Si le llega un pelotazo mientras carga, le cortás el swing:
// pifia y pierde esa pelota. Las pelotas se las traen caddies goblin corriendo desde el fondo: matarlos
// lo deja sin tiros. Ver docs/jefes/caballero.md.
//
// La habilidad que pide: **el timing de la barra, leyéndole la carga al rival**. Cuándo arranca, por dónde
// va la aguja, si llega tu pelota antes de que suelte.
import * as THREE from 'three';
import { L } from '../../../i18n';
import { CLUBS } from '../../../core/clubs';
import { SwingMeter, type ChargeTimes } from '../../../core/swing';
import type { Enemy, EnemyScript } from '../../enemies';
import { analyzeSwing, downswingTimeFor, type SwingClip } from '../../golfClips';
import { CLUB_LENGTH, SwingRig } from '../../swingPose';
import { GATE_HALF_WIDTH, GATE_Z, GroundMark, LaneMark, SPAWN_Z, TEE_Z, arcPoint, fieldHalfAt, heightAt, partStats, touchesPlayer } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { RivalArc } from './arc';
import { BALL_LOOK, Eyes, KNIGHT_LOOK, PLAYER_HEIGHT, PURPLE, Row, addBallLook, addKnightLook, ballMesh, glowSprite, swingProbe } from './look';

/** Lo que cambia entre las versiones (ver index.ts). */
export interface KnightOpts {
  /** A quién le tira: a la puerta, o a tu puesto (marca el piso y te corrés). */
  target: 'gate' | 'player';
  /** El golpe más flojo que le corta el swing: 1 = cualquiera; 2 = el 2 o el 3. */
  minCut: number;
  /** Su pelota va rasante y lenta: se la puede bajar de un pelotazo antes de que llegue. */
  catchable: boolean;
  /** Si le pegás cuando no está cargando, te devuelve la pelota (salvo que no tenga pelotas). */
  parry: boolean;
}

// ---- el campo ----
/**
 * Su fila de puestos: a 28 m de la tuya, en la banda media (el driver le pega 1/2/3), de -8 a 8 m. Más
 * lejos (estaba a 35) quedaba pegado al borde de arriba de la pantalla y su arco no se veía.
 */
const ROW_Z = 37;
const ROW_XS = [-8, -4, 0, 4, 8];
/** Cuántas pelotas tiene a lo sumo (en sus puestos, más las que vienen en camino), como vos. */
const MAX_BALLS = 3;
/** Las que conjura con él al aparecer: el primer duelo llega enseguida. */
const START_BALLS = 2;
/**
 * Sin pelotas, a los `after` s conjura una él mismo: matar caddies lo frena, pero no lo deja de brazos
 * cruzados (sin esto, el bot los mataba a todos y le pegaba quieto).
 */
const CONJURE = { after: 4.5 };

// ---- él ----
/** Un poco más alto que el golfista (1.75), para que se lo vea de lejos; el palo crece igual. */
const KNIGHT_HEIGHT = 2.1;
const KNIGHT_RADIUS = 0.62;
/** Vida: la base, más esto por nivel de dificultad, más la del talento (bonusHp). */
const HP_BASE = 50;
const HP_PER_LEVEL = 2;
/**
 * Su barra: los mismos tres tramos que la tuya (débil, medio, fuerte), más lentos, para que se la pueda
 * leer y llegar a cortarla. La tuya es 0.63 / 0.185 / 0.06: el rojo abre a los 0.82 s. La de él, en la
 * primera fase, a los 1.57 s, y se apura (ver PHASES).
 */
const BAR: ChargeTimes = { weak: 1.15, mid: 0.42, strong: 0.24 };
/** Dónde empiezan el amarillo y el rojo (los mismos umbrales que la tuya sin talentos). */
const MARKS: [number, number] = [0.55, 0.92];
/** El aviso: se para frente a la pelota y aparece su arco, con la aguja quieta en el borde. */
const ADDRESS = 0.5;
/** De puesto a puesto, de costado, en m/s (vos, unos 10). */
const STRAFE_SPEED = 5;
/** Después de terminar el swing, antes de ir a la próxima pelota. */
const REST = 0.45;
/** Cortado: queda aturdido este rato antes de ir a otra pelota. */
const STAGGER = 1.1;
/** El golpe que le corta el swing pega esto de más (le pegaste en el medio del backswing). */
const CUT_BONUS = 1;
/** Con frío, su barra (y su paso) van a esta velocidad: el hielo le da tiempo al que lo quiere cortar. */
const CHILL_PACE = 0.6;
/** Los clips del swing: la bajada y el final, como los del golfista; la pifia baja más rápido. */
const DOWNSWING_SPEED = 1.6;
const FOLLOW_SPEED = 1.35;
const WHIFF_SPEED = 2.6;
/** Aun en el borde de la barra el palo ya está un poco levantado (como en el golfista). */
const MIN_BACKSWING = 0.3;
/** Encima de la cabeza: a qué altura va el centro del arco (por encima de su vida). */
const ARC_ABOVE = 1.0;

/**
 * Las fases, por la vida que le queda: `pace` multiplica los tiempos de su barra (menos = más rápida),
 * `caddie` cada cuántos s sale un caddie y `caddies` cuántos puede haber a la vez, y `plan` cuánto elige
 * cada forma de soltar (ver Plan).
 */
const PHASES = [
  { from: 1, pace: 1, caddie: 5.5, caddies: 2, plan: { rojo: 0.6, amarillo: 0.3, vuelta: 0.1, verde: 0 } },
  { from: 0.66, pace: 0.86, caddie: 4.6, caddies: 2, plan: { rojo: 0.45, amarillo: 0.3, vuelta: 0.1, verde: 0.15 } },
  { from: 0.33, pace: 0.74, caddie: 3.8, caddies: 3, plan: { rojo: 0.4, amarillo: 0.3, vuelta: 0.1, verde: 0.2 } },
];
/** Además se apura solo con el tiempo: la barra, un 0.15 % más rápida por segundo, hasta este tope. */
const TIME_PRESS = { perSecond: 0.0015, min: 0.82 };
/** Y con la dificultad: cada nivel, un poco más rápida. */
const PACE_PER_LEVEL = 0.012;
/**
 * Lo que se ve de la velocidad (15/10: Leandro «venía pegándole pero de repente empecé a no llegar a
 * pegarle antes de que dispare»): las flechas al costado de su arco y el color de los ojos y del brillo
 * del arco. Cuántas veces más rápida que al empezar tiene que ir su barra para cada flecha.
 */
const SPEED_TIERS = [1.12, 1.3, 1.5];
/** El color de los ojos con cada flecha: violeta, naranja, rojo anaranjado, rojo. */
const EYE_TIERS = [PURPLE, 0xffa040, 0xff6a30, 0xff2a2a];

/**
 * Cómo suelta: `rojo` en el rojo de la primera pasada (3); `amarillo` en el amarillo subiendo (2, el que
 * te agarra si esperabas al rojo); `vuelta` pasa el rojo, baja por la derecha y suelta en el rojo de la
 * segunda pasada (3, pero tarda); `verde` un toquecito apurado (1).
 */
type Plan = 'rojo' | 'amarillo' | 'vuelta' | 'verde';

// ---- sus tiros ----
/** Lo que tarda en llegar a la puerta, por calidad (el fuerte llega antes). */
const FLIGHT_GATE = [1.9, 1.6, 1.3];
/** A tu puesto: el flojo es un globo y el fuerte una línea, y no da tiempo a ver y moverse. */
const FLIGHT_PLAYER = [1.45, 1.1, 0.8];
const HEIGHT_PLAYER = [7, 4.5, 2.5];
/** El radio de lo que cae en tu puesto (entre puestos hay 4 m: correrse uno alcanza). */
const HIT_RADIUS = 1.7;
/** La pelota rasante (versión atajable), en m/s por calidad: llega a la puerta en 3 a 5 s. */
const ROLL_SPEED = [9, 11.5, 14];
/** La devuelta (versión que devuelve): cuánto tarda en llegar a tu puesto y cada cuánto puede devolver. */
const PARRY = { flight: 1.25, height: 5, every: 0.35 };
/** El radio de sus pelotas. Más grandes que las tuyas, para que se vean volando de lejos. */
const BALL_RADIUS = 0.2;

// ---- los caddies ----
/** Corren desde el fondo con una pelota hasta un puesto libre de su fila, la dejan y vuelven. */
const CADDIE = { speed: 4.3, firstAt: 2.5 };

// ---- la entrada ----
/** El círculo oscuro brilla `glow` s (mientras está el cartel de la oleada) y él sube del piso en `rise`. */
const SUMMON = { glow: 2.6, rise: 1.2, radius: 3 };

const PURPLE_DARK = 0x5a1fa0;
const DANGER = 0xff3b6b;

type Mode = 'summon' | 'idle' | 'walk' | 'address' | 'charge' | 'down' | 'follow' | 'rest' | 'whiff' | 'stagger' | 'parry' | 'dead';

interface Flying {
  kind: 'gate' | 'player' | 'parry' | 'dud';
  mesh: THREE.Mesh;
  halo: THREE.Sprite;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  time: number;
  height: number;
  q: number;
  ring: GroundMark | null;
  disc: GroundMark | null;
}

interface Caddie {
  e: Enemy;
  spot: number;
  carrying: boolean;
  homeX: number;
  ball: THREE.Mesh;
}

interface Roller {
  e: Enemy;
  lane: LaneMark;
  dir: THREE.Vector3;
  speed: number;
  q: number;
}

const qualityAt = (p: number) => (p >= MARKS[1] ? 3 : p >= MARKS[0] ? 2 : 1);

/** Cuándo suelta (s de carga) según el plan, con los tiempos de su barra. */
function releaseAt(plan: Plan, t: ChargeTimes, rng: () => number): number {
  const peak = t.weak + t.mid + t.strong / 2;
  const cycle = t.strong + 2 * (t.mid + t.weak);
  switch (plan) {
    case 'rojo': return peak + (rng() - 0.5) * t.strong * 0.6;
    case 'amarillo': return t.weak + t.mid * (0.3 + 0.6 * rng());
    case 'vuelta': return peak + cycle + (rng() - 0.5) * t.strong * 0.6;
    case 'verde': return t.weak * (0.45 + 0.4 * rng());
  }
}

function pick(weights: Record<Plan, number>, rng: () => number): Plan {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [k, w] of Object.entries(weights) as [Plan, number][]) {
    if ((r -= w) <= 0) return k;
  }
  return 'rojo';
}

export function startKnight(ctx: BossCtx, opts: KnightOpts): BossFight {
  const { horde, scene, effects, audio, rng } = ctx;
  addKnightLook(horde, ctx.dungeon);
  if (opts.catchable) addBallLook(horde);
  const scale = KNIGHT_HEIGHT / PLAYER_HEIGHT;
  // el swing se mide en un caballero del alto del golfista: las fases del clip y cómo va el palo en la mano
  const driveClip = ctx.dungeon.animations.find((c) => c.name === 'Golf Drive');
  const swing: SwingClip | null = driveClip ? analyzeSwing(swingProbe(ctx.dungeon), driveClip, CLUB_LENGTH) : null;
  if (!swing) console.warn('[gk] caballero: sin el clip Golf Drive, swing de brazos'); // i18n-ok: consola
  /** Dónde queda la pelota respecto de él en el address (en sus metros). */
  const teeLocal = swing ? { x: swing.tee.x * scale, z: swing.tee.z * scale } : { x: 0.75 * scale, z: 0.45 * scale };
  const flightYaw = swing?.flightYaw ?? Math.PI / 2;

  const row = new Row(scene, ROW_XS, ROW_Z, BALL_RADIUS);
  const arc = new RivalArc(scene, MARKS);
  const maxHp = HP_BASE + HP_PER_LEVEL * ctx.level + ctx.bonusHp;
  const meter = new SwingMeter();

  let mode: Mode = 'summon';
  let modeTime = 0;
  /** El puesto de su fila donde está trabajando (-1: ninguno). */
  let spot = -1;
  /** Adónde apunta: un punto de la puerta, o tu puesto. */
  const aim = new THREE.Vector3(0, 0, GATE_Z);
  let yawTarget = Math.PI;
  let plan: Plan = 'rojo';
  let planAt = 0;
  let chargeTime = 0;
  let backswing = 0;
  let poseTime = 0;
  let quality = 1;
  let phase = 0;
  let cutPending = false;
  let heldPending = false;
  let parryPending = false;
  let lastParry = -10;
  let caddieTimer = CADDIE.firstAt;
  /** Cuánto lleva sin pelotas (para conjurar una), y si ya se avisó cómo se le gana. */
  let starved = 0;
  let toldCharge = false;
  let toldStarved = false;
  let rigWeight = 0;
  let deadHandled = false;
  const flying: Flying[] = [];
  const caddies: Caddie[] = [];
  const rollers: Roller[] = [];
  const stats = { conjured: 0, shots: 0, cuts: 0, held: 0, gate: 0, player: 0, dodged: 0, caddiesKilled: 0, delivered: 0, parried: 0, caught: 0 };

  // la entrada: el círculo oscuro en el medio de su fila
  const circle = new GroundMark(scene, PURPLE_DARK, true, SUMMON.radius).at(0, ROW_Z).opacity(0);
  const circleRing = new GroundMark(scene, PURPLE, false, SUMMON.radius * 1.15).at(0, ROW_Z).opacity(0);
  /** La versión que te tira a vos: la mira en tu puesto mientras carga. */
  const aimMark = opts.target === 'player' ? new GroundMark(scene, DANGER, false, HIT_RADIUS).opacity(0) : null;
  /** La versión que devuelve: el anillo de guardia a sus pies (mientras está en guardia, devuelve). */
  const guardMark = opts.parry ? new GroundMark(scene, PURPLE, false, 1.3).opacity(0) : null;

  const pace = () => {
    const press = Math.max(TIME_PRESS.min, 1 - TIME_PRESS.perSecond * ctx.clock());
    return PHASES[phase].pace * press * Math.max(0.7, 1 - PACE_PER_LEVEL * ctx.level);
  };
  const barTimes = (): ChargeTimes => {
    const k = pace();
    return { weak: BAR.weak * k, mid: BAR.mid * k, strong: BAR.strong * k };
  };
  arc.setTimes(barTimes());
  /** Cuántas flechas de velocidad tiene su barra ahora (0 a 3): ver SPEED_TIERS. */
  const speedTier = (): number => {
    const fast = 1 / pace();
    return SPEED_TIERS.filter((x) => fast >= x - 1e-6).length;
  };
  let shownTier = 0;

  /** Dónde se para para pegarle a la pelota del puesto `i` hacia `aim`, y hacia dónde mira. */
  function stanceFor(i: number, out: THREE.Vector3): number {
    const tx = row.spots[i].x;
    const yaw = Math.atan2(aim.x - tx, aim.z - ROW_Z) - flightYaw;
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    out.set(tx - (teeLocal.x * c + teeLocal.z * s), 0, ROW_Z - (-teeLocal.x * s + teeLocal.z * c));
    return yaw;
  }

  /** Adónde va a apuntar el próximo tiro: un punto de la puerta, o tu puesto (al que vas). */
  function updateAim(fresh: boolean): void {
    if (opts.target === 'player') {
      const p = ctx.player();
      const spots = ctx.spots();
      const x = spots[Math.max(0, Math.min(spots.length - 1, p.spotIndex))] ?? p.position.x;
      aim.set(x, 0, TEE_Z);
    } else if (fresh) {
      aim.set((rng() * 2 - 1) * GATE_HALF_WIDTH * 0.6, 0, GATE_Z);
    }
  }

  const cuttable = () => mode === 'address' || mode === 'charge';
  /** En guardia (la versión que devuelve): tiene pelota a mano y no está cargando. Silenciado, no. */
  const guarding = () =>
    opts.parry && !knight.silenced && (mode === 'idle' || mode === 'walk' || mode === 'rest' || mode === 'follow' || mode === 'stagger' || mode === 'parry')
    && (row.loaded > 0 || spot >= 0);

  // ---- él: un enemigo de verdad, con su guion ----
  const knightScript: EnemyScript = {
    update(e, dt) {
      e.knock.set(0, 0, 0);
      // aturdido (es pesado: solo si una habilidad lo pide): se le corta la carga y el motor lo tiene quieto
      // y descuenta el aturdido
      if (e.stunned && mode !== 'summon' && mode !== 'dead') {
        if (cuttable()) cut(e, false);
        return false;
      }
      modeTime += dt;
      run(e, dt);
      if (mode !== 'summon') e.position.y = heightAt(e.position.x, e.position.z);
      return true;
    },
    filter(e, amount, shot) {
      if (mode === 'summon') return 0;
      if (!shot) return amount;
      if (opts.parry && guarding() && !e.silenced) {
        parryPending = true;
        return 0;
      }
      if (cuttable()) {
        if (shot.quality >= opts.minCut) {
          cutPending = true;
          return amount > 0 ? amount + CUT_BONUS : amount;
        }
        heldPending = true;
      }
      return amount;
    },
    onDeath() {
      die();
    },
  };
  const knight = horde.spawnCustom(
    partStats('knight', { name: L('Caballero negro', 'Black Knight'), height: KNIGHT_HEIGHT, radius: KNIGHT_RADIUS, hp: maxHp, boss: true, heavy: true, speed: 0, score: 500 }),
    KNIGHT_LOOK, 0, ROW_Z, {}, knightScript,
  );
  knight.heading = Math.PI;
  knight.position.y = heightAt(0, ROW_Z) - KNIGHT_HEIGHT * 1.2;

  // el palo en la mano derecha, como el del golfista, con el brillo violeta
  const clubGltf = ctx.models.get('club.glb');
  const rig = new SwingRig(knight.body, scene, clubGltf ? clubGltf.scene.clone() : null);
  rig.grip = swing;
  rig.setClub({ ...CLUBS.driver, color: PURPLE });
  rig.club.scale.setScalar(scale);
  rig.club.visible = false;
  const eyes = new Eyes(scene, knight.body, scale);

  /** Pone el clip del swing en el instante del backswing de ahora (como el golfista: sigue a la barra). */
  function pose(e: Enemy): void {
    if (!swing) {
      e.scriptGesture = 1;
      e.scriptSwing = 0.85 * backswing;
      return;
    }
    const u = MIN_BACKSWING + (1 - MIN_BACKSWING) * backswing;
    poseTime = swing.address + (swing.top - swing.address) * u;
    e.animator.poseOneShot(swing.name, poseTime);
  }

  /** Instante del clip en curso (o los segundos del modo, sin clip). */
  const clipAt = (e: Enemy) => (swing ? e.animator.oneShotTime : -1);
  /** Pasó el impacto: la pelota sale (o se pifia). */
  const pastImpact = (e: Enemy) => (swing ? clipAt(e) < 0 || clipAt(e) >= swing.impact : modeTime >= 0.2);
  const pastEnd = (e: Enemy) => (swing ? clipAt(e) < 0 || clipAt(e) >= swing.end : modeTime >= 0.6);

  function setMode(m: Mode): void {
    mode = m;
    modeTime = 0;
  }

  /** Elige la próxima pelota: casi siempre la más cercana; a veces otra, para que cambie de puesto. */
  function chooseSpot(e: Enemy): number {
    const loaded = row.spots.map((s, i) => (s.ball ? i : -1)).filter((i) => i >= 0);
    if (!loaded.length) return -1;
    if (loaded.length > 1 && rng() < 0.35) return loaded[Math.floor(rng() * loaded.length)];
    return loaded.reduce((best, i) => (Math.abs(row.spots[i].x - e.position.x) < Math.abs(row.spots[best].x - e.position.x) ? i : best), loaded[0]);
  }

  const stance = new THREE.Vector3();

  function run(e: Enemy, dt: number): void {
    if (mode === 'dead') return;
    // silenciado no puede cargar: el silencio le corta el swing
    if (e.silenced && cuttable()) cut(e, true);
    if (cutPending) {
      cutPending = false;
      if (cuttable()) cut(e, false);
    }
    if (heldPending) {
      heldPending = false;
      if (cuttable()) {
        stats.held++;
        ctx.feedback(L('¡Aguantó! Hace falta un golpe 2', 'He held! It takes a 2'));
      }
    }
    if (parryPending) {
      parryPending = false;
      if (ctx.clock() - lastParry > PARRY.every) parry(e);
    }
    if (ctx.over() && mode !== 'summon') {
      arc.show(false);
      e.animator.clearOneShot();
      e.animator.setLocomotion('Idle', 1);
      return;
    }
    const slow = e.chilled ? CHILL_PACE : 1;
    switch (mode) {
      case 'summon': {
        const t = modeTime;
        const glow = Math.min(1, t / 0.6);
        circle.opacity(0.55 * glow * (0.8 + 0.2 * Math.sin(t * 7)));
        circleRing.opacity(0.8 * glow).size(SUMMON.radius * (1.15 + 0.08 * Math.sin(t * 4)));
        const ground = heightAt(e.position.x, e.position.z);
        if (t < SUMMON.glow) {
          e.position.y = ground - KNIGHT_HEIGHT * 1.2;
        } else {
          if (t - dt < SUMMON.glow) appear(e);
          const u = Math.min(1, (t - SUMMON.glow) / SUMMON.rise);
          e.position.y = ground - KNIGHT_HEIGHT * 1.2 * (1 - u) * (1 - u);
          if (u >= 1) {
            circle.opacity(0);
            circleRing.opacity(0);
            setMode('idle');
          }
        }
        e.heading = Math.PI;
        e.animator.setLocomotion('Idle', 1);
        break;
      }
      case 'idle': {
        e.animator.clearOneShot();
        e.scriptGesture = 0;
        const next = chooseSpot(e);
        if (next >= 0) {
          spot = next;
          updateAim(true);
          setMode('walk');
          break;
        }
        // sin pelotas: mira al golfista, de brazos caídos; si no viene ningún caddie, conjura una
        e.animator.setLocomotion('Idle', 1);
        e.faceToward(ctx.player().position.x, TEE_Z, dt, 4);
        if (!toldStarved) {
          toldStarved = true;
          ctx.feedback(L('¡Sin pelotas! Los caddies le traen más', 'Out of balls! Caddies bring him more'));
        }
        starved += dt;
        if (starved >= CONJURE.after && row.spots.filter((s) => s.incoming).length < MAX_BALLS) conjure();
        break;
      }
      case 'walk': {
        if (spot < 0 || !row.spots[spot].ball) {
          spot = -1;
          setMode('idle');
          break;
        }
        updateAim(false);
        yawTarget = stanceFor(spot, stance);
        const dx = stance.x - e.position.x;
        const dz = stance.z - e.position.z;
        const dist = Math.hypot(dx, dz);
        const step = STRAFE_SPEED * slow * dt;
        // de costado, de frente a la cancha, como el golfista
        e.faceToward(e.position.x, TEE_Z, dt, 8);
        if (dist <= step + 0.02) {
          e.position.x = stance.x;
          e.position.z = stance.z;
          setMode('address');
          break;
        }
        e.position.x += (dx / dist) * step;
        e.position.z += (dz / dist) * step;
        // mirando a -z, su izquierda es -x
        const left = dx < 0;
        const clip = left ? 'Strafe Left' : 'Strafe Right';
        if (Math.abs(dx) > Math.abs(dz) && e.animator.has(clip)) e.animator.setLocomotion(clip, 1.3 * slow);
        else e.animator.setLocomotion('Walking', 1.2 * slow);
        break;
      }
      case 'address': {
        // se acomoda a la pelota y aparece el arco, con la aguja en el borde: el aviso
        updateAim(false);
        yawTarget = stanceFor(spot, stance);
        e.position.x += (stance.x - e.position.x) * (1 - Math.exp(-12 * dt));
        e.position.z += (stance.z - e.position.z) * (1 - Math.exp(-12 * dt));
        turnTo(e, yawTarget, dt, 12);
        backswing = 0;
        pose(e);
        e.animator.setLocomotion('Idle', 1);
        arc.setTimes(barTimes());
        arc.show(true);
        arc.set(0, -1, false);
        if (!toldCharge) {
          toldCharge = true;
          ctx.feedback(L('¡Pegale mientras carga y le cortás el swing!', 'Hit him while he charges to break his swing!'));
        }
        if (modeTime >= ADDRESS * pace()) {
          const times = barTimes();
          arc.setTimes(times);
          meter.start(times, MARKS);
          plan = pick(PHASES[phase].plan, rng);
          planAt = releaseAt(plan, times, rng);
          chargeTime = 0;
          setMode('charge');
        }
        break;
      }
      case 'charge': {
        updateAim(false);
        yawTarget = stanceFor(spot, stance);
        e.position.x += (stance.x - e.position.x) * (1 - Math.exp(-8 * dt));
        e.position.z += (stance.z - e.position.z) * (1 - Math.exp(-8 * dt));
        turnTo(e, yawTarget, dt, 6);
        chargeTime += dt * slow;
        meter.update(dt * slow);
        backswing += (meter.power - backswing) * (1 - Math.exp(-18 * dt));
        pose(e);
        e.animator.setLocomotion('Idle', 1);
        arc.set(meter.power, meter.side, meter.power >= MARKS[1]);
        if (chargeTime >= planAt) release(e);
        break;
      }
      case 'down': {
        if (!swing) e.scriptSwing = 0.85 + 0.15 * Math.min(1, modeTime / 0.2);
        if (pastImpact(e)) {
          fire();
          if (swing) e.animator.setOneShotSpeed(FOLLOW_SPEED);
          setMode('follow');
        }
        break;
      }
      case 'follow': {
        if (!swing) e.scriptSwing = Math.min(1.25, 1 + modeTime);
        if (pastEnd(e)) {
          e.animator.clearOneShot();
          e.scriptGesture = 0;
          e.scriptSwing = null;
          spot = -1;
          setMode('rest');
        }
        break;
      }
      case 'whiff': {
        if (!swing) e.scriptSwing = 0.85 + 0.4 * Math.min(1, modeTime / 0.15);
        if (pastImpact(e) && spot >= 0) {
          dud(spot);
          spot = -1;
        }
        if (pastEnd(e) || modeTime > 1.2) {
          e.animator.clearOneShot();
          e.scriptGesture = 0;
          e.scriptSwing = null;
          setMode('stagger');
        }
        break;
      }
      case 'stagger': {
        e.animator.setLocomotion('Idle', 0.6);
        // tambalea: un vaivén chico de costado
        e.heading += Math.sin(modeTime * 9) * dt * 0.8;
        if (modeTime >= STAGGER) setMode('idle');
        break;
      }
      case 'parry': {
        if (pastEnd(e) || modeTime > 0.55) {
          e.animator.clearOneShot();
          e.scriptGesture = 0;
          e.scriptSwing = null;
          setMode(spot >= 0 && row.spots[spot].ball ? 'walk' : 'idle');
        }
        break;
      }
      case 'rest': {
        // un respiro después del swing
        e.animator.setLocomotion('Idle', 1);
        if (modeTime >= REST * pace()) setMode('idle');
        break;
      }
    }
  }

  /** Gira suave hacia `yaw`. */
  function turnTo(e: Enemy, yaw: number, dt: number, rate: number): void {
    let d = (yaw - e.heading) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    e.heading += d * (1 - Math.exp(-rate * dt));
  }

  /** Aparece: el destello, el cartel, y las primeras pelotas en su fila. */
  function appear(e: Enemy): void {
    const at = new THREE.Vector3(e.position.x, 0, e.position.z);
    effects.blink(at, PURPLE);
    effects.explosion(at.clone().setY(1), 3.2, PURPLE);
    audio.casterCast();
    ctx.banner(L('¡Un reflejo oscuro!', 'A dark reflection!'), L('Los chamanes pidieron «un gran golfista»', 'The shamans asked for "a great golfer"'), 3);
    rig.club.visible = true;
    const free = row.spots.map((_, i) => i).sort(() => rng() - 0.5).slice(0, START_BALLS);
    for (const i of free) {
      row.set(i, true);
      effects.spark(new THREE.Vector3(row.spots[i].x, 0.4, ROW_Z), PURPLE);
    }
  }

  /** Sin pelotas: conjura una en un puesto libre (el destello violeta), y sigue. */
  function conjure(): void {
    starved = 0;
    const free = row.spots.map((s, i) => (!s.ball && !s.incoming ? i : -1)).filter((i) => i >= 0);
    if (!free.length) return;
    const i = free[Math.floor(rng() * free.length)];
    row.set(i, true);
    stats.conjured++;
    effects.blink(new THREE.Vector3(row.spots[i].x, 0, ROW_Z), PURPLE);
    audio.casterCast();
  }

  /** Suelta: el palo baja y la pelota sale en el impacto. Con la calidad de donde estaba la aguja. */
  function release(e: Enemy): void {
    quality = qualityAt(meter.power);
    const power = meter.power;
    meter.release();
    arc.show(false);
    // la versión que te tira a vos: apunta a donde estás ahora, y la mira queda quieta ahí
    updateAim(false);
    if (aimMark) aimMark.at(aim.x, aim.z).opacity(0.75);
    audio.whoosh(power);
    if (swing) e.animator.resumeOneShot(downswingTimeFor(swing, poseTime), DOWNSWING_SPEED);
    setMode('down');
  }

  /** Le cortaron el swing: el palo baja apurado, pifia, y esa pelota se pierde. */
  function cut(e: Enemy, silenced: boolean): void {
    meter.cancel();
    arc.show(false);
    aimMark?.opacity(0);
    stats.cuts++;
    audio.duff();
    ctx.feedback(silenced ? L('¡Silenciado: pifió!', 'Silenced: he duffed it!') : L('¡Le cortaste el swing!', 'Swing broken!'));
    effects.spark(new THREE.Vector3(e.position.x, KNIGHT_HEIGHT * 0.7, e.position.z), PURPLE);
    if (swing) e.animator.resumeOneShot(downswingTimeFor(swing, poseTime), WHIFF_SPEED);
    setMode('whiff');
  }

  /** La pelota pifiada: rueda un par de metros y se deshace en humo violeta. */
  function dud(i: number): void {
    const s = row.spots[i];
    row.set(i, false);
    const from = new THREE.Vector3(s.x, BALL_RADIUS, s.z);
    const dir = new THREE.Vector3(aim.x - s.x, 0, aim.z - s.z).normalize();
    const to = from.clone().addScaledVector(dir, 2.5);
    launch('dud', from, to, 0.6, 0.4, 0, null, null);
  }

  /** La devuelve (versión que devuelve): un golpe corto del palo, y la pelota sale a tu puesto. */
  function parry(e: Enemy): void {
    lastParry = ctx.clock();
    stats.parried++;
    if (swing) {
      e.animator.poseOneShot(swing.name, swing.top);
      e.animator.resumeOneShot(swing.top, 3.2);
    }
    audio.tock(false, 2, 'driver');
    ctx.feedback(L('¡Te la devolvió!', 'He hit it back!'));
    const p = ctx.player();
    const to = new THREE.Vector3(p.position.x, 0, TEE_Z);
    const from = new THREE.Vector3(e.position.x, 1.4, e.position.z);
    const ring = new GroundMark(scene, DANGER, false, HIT_RADIUS).at(to.x, to.z).opacity(0.7);
    const disc = new GroundMark(scene, DANGER, true, 0.1).at(to.x, to.z).opacity(0.3);
    launch('parry', from, to, PARRY.flight, PARRY.height, 1, ring, disc);
    setMode('parry');
  }

  /** El impacto: la pelota sale a la puerta, a tu puesto, o rasante (la que se ataja). */
  function fire(): void {
    if (spot < 0) return;
    const s = row.spots[spot];
    row.set(spot, false);
    const q = quality;
    stats.shots++;
    audio.tock(q === 3, q, 'driver');
    const from = new THREE.Vector3(s.x, BALL_RADIUS, s.z);
    if (opts.catchable && opts.target === 'gate') {
      roll(from, q);
      return;
    }
    if (opts.target === 'player') {
      aimMark?.opacity(0);
      const to = new THREE.Vector3(aim.x, 0, aim.z);
      const ring = new GroundMark(scene, DANGER, false, HIT_RADIUS).at(to.x, to.z).opacity(0.75);
      const disc = new GroundMark(scene, DANGER, true, 0.1).at(to.x, to.z).opacity(0.35);
      launch('player', from, to, FLIGHT_PLAYER[q - 1], HEIGHT_PLAYER[q - 1], q, ring, disc);
      return;
    }
    // a la puerta: cae justo adelante, y el piso lo marca
    const to = new THREE.Vector3(aim.x, 1.4, GATE_Z + 0.4);
    const ring = new GroundMark(scene, PURPLE, false, 1.3).at(to.x, GATE_Z + 1.4).opacity(0.7);
    launch('gate', from, to, FLIGHT_GATE[q - 1], 10, q, ring, null);
  }

  function launch(kind: Flying['kind'], from: THREE.Vector3, to: THREE.Vector3, time: number, height: number, q: number, ring: GroundMark | null, disc: GroundMark | null): void {
    const mesh = ballMesh(BALL_RADIUS);
    mesh.position.copy(from);
    const halo = glowSprite(kind === 'gate' || kind === 'dud' ? PURPLE : DANGER, 1.1);
    halo.renderOrder = 4;
    mesh.add(halo);
    halo.scale.setScalar(1.1 / BALL_RADIUS);
    scene.add(mesh);
    flying.push({ kind, mesh, halo, from, to, t: 0, time, height, q, ring, disc });
  }

  /** La versión atajable: la pelota sale rasante a la puerta, como un enemigo de 1 de vida. */
  function roll(from: THREE.Vector3, q: number): void {
    const to = new THREE.Vector3(aim.x, 0, GATE_Z + 0.8);
    const dir = to.clone().sub(from).setY(0).normalize();
    const lane = new LaneMark(scene, PURPLE, 1.2).between(from.x, from.z - 1, to.x, to.z).opacity(0.28);
    const script: EnemyScript = {
      update(b, dt) {
        b.knock.set(0, 0, 0);
        const r = rollers.find((x) => x.e === b);
        if (!r) return true;
        const v = r.speed * (b.chilled ? CHILL_PACE : 1);
        b.position.x += r.dir.x * v * dt;
        b.position.z += r.dir.z * v * dt;
        b.position.y = heightAt(b.position.x, b.position.z);
        b.faceToward(b.position.x + r.dir.x, b.position.z + r.dir.z, dt);
        if (touchesPlayer(ctx, b, b.radius + 0.5) && !ctx.player().invulnerable && !ctx.over()) {
          ctx.hitPlayer(1, b.position, knight);
          stats.player++;
          effects.explosion(b.position.clone().setY(0.6), 1.2, PURPLE);
          b.remove();
        } else if (b.position.z <= GATE_Z + 1) {
          if (!ctx.over()) {
            ctx.hitGate(r.q, knight);
            stats.gate += r.q;
          }
          effects.explosion(b.position.clone().setY(1), 1.6, PURPLE);
          b.remove();
        }
        return true;
      },
      onDeath(b) {
        stats.caught++;
        ctx.feedback(L('¡Atajada!', 'Intercepted!'));
        effects.explosion(b.position.clone().setY(0.5), 1.1, PURPLE);
        b.remove();
      },
    };
    const e = horde.spawnCustom(partStats('goblin', { name: L('Pelota oscura', 'Dark ball'), height: 0.6, radius: 0.36, hp: 1, speed: 0, heavy: true, score: 5 }), BALL_LOOK, from.x, from.z - 0.8, {}, script);
    rollers.push({ e, lane, dir, speed: ROLL_SPEED[q - 1], q });
  }

  // ---- los caddies ----
  function spawnCaddie(): void {
    const free = row.spots.map((s, i) => (!s.ball && !s.incoming ? i : -1)).filter((i) => i >= 0);
    if (!free.length) return;
    const i = free[Math.floor(rng() * free.length)];
    const s = row.spots[i];
    s.incoming = true;
    const half = fieldHalfAt(SPAWN_Z) - 1.5;
    const x = THREE.MathUtils.clamp(s.x + (rng() * 2 - 1) * 5, -half, half);
    const ball = ballMesh(BALL_RADIUS * 0.9);
    scene.add(ball);
    const script: EnemyScript = {
      update(e, dt) {
        const c = caddies.find((k) => k.e === e);
        if (!c) return true;
        // aturdido o congelado, lo maneja el motor (se queda quieto y descuenta)
        if (e.stunned || e.frozen) return false;
        if (c.carrying) {
          if (e.walkToward(row.spots[c.spot].x, ROW_Z + 1.3, CADDIE.speed, dt, true, 0.45)) {
            c.carrying = false;
            row.spots[c.spot].incoming = false;
            if (knight.alive && !ctx.over()) {
              row.set(c.spot, true);
              stats.delivered++;
              effects.spark(new THREE.Vector3(row.spots[c.spot].x, 0.4, ROW_Z), PURPLE);
            }
          }
        } else if (e.walkToward(c.homeX, SPAWN_Z + 3, CADDIE.speed, dt, true, 0.6)) {
          e.remove();
        }
        return true;
      },
      onDeath(e) {
        const c = caddies.find((k) => k.e === e);
        if (!c) return;
        stats.caddiesKilled++;
        if (c.carrying) {
          c.carrying = false;
          row.spots[c.spot].incoming = false;
          effects.spark(new THREE.Vector3(e.position.x, e.height, e.position.z), PURPLE);
        }
      },
    };
    const e = horde.spawnCustom(partStats('goblin', { name: L('Caddie goblin', 'Goblin caddie'), hp: 1 }), 'goblin', x, SPAWN_Z - 0.5, {}, script);
    caddies.push({ e, spot: i, carrying: true, homeX: x, ball });
  }

  // ---- la muerte ----
  function die(): void {
    if (deadHandled) return;
    deadHandled = true;
    mode = 'dead';
    arc.show(false);
    aimMark?.opacity(0);
    guardMark?.opacity(0);
    effects.explosion(new THREE.Vector3(knight.position.x, 1.2, knight.position.z), 4, PURPLE);
    ctx.banner(L('¡El reflejo se rompió!', 'The reflection shattered!'), '', 2.5);
    // lo que conjuró se va con él: sus pelotas, las que vuelan, los caddies
    for (let i = 0; i < row.spots.length; i++) row.set(i, false);
    for (const f of flying) f.t = f.time + 1;
    for (const c of caddies) {
      if (c.e.alive) {
        effects.blink(c.e.position, PURPLE);
        c.e.remove();
      }
    }
    for (const r of rollers) {
      if (r.e.alive) {
        effects.explosion(r.e.position.clone().setY(0.5), 1, PURPLE);
        r.e.remove();
      }
    }
  }

  const tmp = new THREE.Vector3();

  function updateFlying(dt: number): void {
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt;
      const u = Math.min(1, f.t / f.time);
      arcPoint(f.from, f.to, u, f.height, f.mesh.position);
      if (f.kind === 'dud') f.mesh.position.y = Math.max(BALL_RADIUS, f.mesh.position.y);
      f.ring?.opacity(0.45 + 0.4 * u);
      f.disc?.size(Math.max(0.1, HIT_RADIUS * u)).opacity(0.25 + 0.3 * u);
      if (f.t < f.time) continue;
      if (!deadHandled || f.t <= f.time + 0.5) land(f);
      dropFlying(f);
      flying.splice(i, 1);
    }
  }

  /** Saca una pelota que vuela (la malla y el material son compartidos: solo el halo es suyo). */
  function dropFlying(f: Flying): void {
    f.ring?.dispose();
    f.disc?.dispose();
    scene.remove(f.mesh);
    f.halo.material.dispose();
  }

  function land(f: Flying): void {
    const at = f.to.clone();
    if (f.kind === 'dud') {
      effects.explosion(at.setY(0.4), 0.9, PURPLE_DARK);
      return;
    }
    if (ctx.over() || deadHandled) return;
    if (f.kind === 'gate') {
      ctx.hitGate(f.q, knight);
      stats.gate += f.q;
      effects.explosion(at, 1.8, PURPLE);
      return;
    }
    // a tu puesto (o la devuelta): te saca 1 si seguís adentro de la marca
    effects.explosion(tmp.set(at.x, 0.5, at.z), HIT_RADIUS, DANGER);
    audio.casterHit();
    const p = ctx.player();
    if (p.alive && Math.hypot(p.position.x - at.x, p.position.z - at.z) < HIT_RADIUS) {
      const was = p.hp;
      ctx.hitPlayer(1, at, knight);
      if (p.hp < was) stats.player++;
    } else {
      stats.dodged++;
      ctx.feedback(L('¡Esquivada!', 'Dodged!'));
    }
  }

  function updateCaddies(dt: number): void {
    // salen cada tanto, si le faltan pelotas y no hay demasiados en el campo
    if (knight.alive && mode !== 'summon' && !ctx.over()) {
      caddieTimer -= dt;
      const live = caddies.filter((c) => c.e.alive).length;
      const coming = row.spots.filter((s) => s.incoming).length;
      if (caddieTimer <= 0 && live < PHASES[phase].caddies && row.loaded + coming < MAX_BALLS) {
        spawnCaddie();
        caddieTimer = PHASES[phase].caddie * (0.85 + 0.3 * rng());
      } else if (caddieTimer <= 0) caddieTimer = 0.5;
    }
    for (let i = caddies.length - 1; i >= 0; i--) {
      const c = caddies[i];
      const gone = !c.e.alive;
      c.ball.visible = !gone && c.carrying;
      if (c.ball.visible) c.ball.position.set(c.e.position.x, c.e.position.y + c.e.height + 0.3, c.e.position.z);
      if (gone && c.e.state === 'gone') {
        scene.remove(c.ball);
        caddies.splice(i, 1);
      } else if (gone && c.carrying) {
        c.carrying = false;
        row.spots[c.spot].incoming = false;
      }
    }
  }

  function updateRollers(): void {
    for (let i = rollers.length - 1; i >= 0; i--) {
      if (rollers[i].e.alive) continue;
      rollers[i].lane.dispose();
      rollers.splice(i, 1);
    }
  }

  return {
    get done() {
      return !knight.alive;
    },
    update(dt) {
      // la fase sale de la vida
      const frac = knight.hp / knight.maxHp;
      const next = frac > PHASES[1].from ? 0 : frac > PHASES[2].from ? 1 : 2;
      if (next > phase && knight.alive) {
        phase = next;
        // que se note (15/10): el cartel grande, un estallido y los ojos (ver abajo); su barra va más rápido
        ctx.banner(
          phase === 1 ? L('¡El reflejo se apura!', 'The reflection speeds up!') : L('¡Furia oscura!', 'Dark fury!'),
          phase === 1 ? L('Su barra va más rápido: cortalo antes', 'His meter is faster: cut him sooner') : L('Su barra, más rápida todavía', 'His meter, faster still'),
          2,
        );
        ctx.audio.bossAppear();
        ctx.effects.explosion(new THREE.Vector3(knight.position.x, knight.position.y + KNIGHT_HEIGHT * 0.6, knight.position.z), 2.6, phase === 1 ? 0xff9a40 : 0xff3a2a);
      }
      row.update(dt);
      updateFlying(dt);
      updateCaddies(dt);
      updateRollers();
      // el palo sigue a la mano: después de que la horda animó el cuerpo en este cuadro
      const visible = knight.state !== 'gone';
      rig.club.visible = visible && (mode !== 'summon' || modeTime > SUMMON.glow);
      if (visible) {
        const want = mode === 'address' || mode === 'charge' || mode === 'down' || mode === 'follow' || mode === 'whiff' || mode === 'parry' ? 1 : 0;
        rigWeight += (want - rigWeight) * (1 - Math.exp(-14 * dt));
        rig.weight = swing ? rigWeight : 0;
        knight.body.parent?.updateMatrixWorld(true);
        rig.apply();
      }
      // la velocidad de su barra: flechas al costado del arco (se actualizan cuando el arco está a la vista,
      // así el «¡más rápido!» sale cuando se acomoda) y el color de los ojos
      const tier = speedTier();
      if (tier !== shownTier && (mode === 'address' || mode === 'charge')) {
        arc.setSpeed(tier, tier > shownTier ? L('¡Más rápido!', 'Faster!') : '');
        shownTier = tier;
      }
      eyes.color(EYE_TIERS[tier]);
      eyes.update(knight.heading, mode === 'charge' && meter.power >= MARKS[0] ? 1 : 0, visible && knight.position.y > heightAt(knight.position.x, knight.position.z) - KNIGHT_HEIGHT * 0.5);
      arc.anchor.set(knight.position.x, knight.position.y + KNIGHT_HEIGHT + ARC_ABOVE, knight.position.z);
      if (aimMark && cuttable()) {
        // la mira en tu puesto, más fuerte a medida que carga
        aimMark.at(aim.x, aim.z).opacity(mode === 'charge' ? 0.2 + 0.45 * meter.power : 0.15);
      } else if (aimMark && mode !== 'down') aimMark.opacity(0);
      if (guardMark) {
        const on = knight.alive && guarding() && mode !== 'summon';
        guardMark.at(knight.position.x, knight.position.z).opacity(on ? 0.55 + 0.2 * Math.sin(ctx.clock() * 6) : 0);
      }
    },
    bot: {
      danger(x, within) {
        // lo que cae en los puestos: sus tiros (la versión que te tira a vos) y las devueltas
        for (const f of flying) {
          if ((f.kind === 'player' || f.kind === 'parry') && Math.abs(f.to.x - x) < HIT_RADIUS + 0.8 && f.time - f.t < within + 0.3) return true;
        }
        // está por soltar y te apunta: la aguja ya pasó al amarillo
        if (opts.target === 'player' && mode === 'charge' && meter.power >= MARKS[0] && Math.abs(aim.x - x) < 1) return true;
        if (opts.target === 'player' && mode === 'down' && Math.abs(aim.x - x) < HIT_RADIUS + 0.8) return true;
        // la rasante que cruza la línea por ahí
        for (const r of rollers) {
          if (!r.e.alive || r.e.position.z < TEE_Z) continue;
          const k = (r.e.position.z - TEE_Z) / Math.max(0.01, -r.dir.z);
          const cross = r.e.position.x + r.dir.x * k;
          if (Math.abs(cross - x) < 1.4 && k / r.speed < within + 0.5) return true;
        }
        return false;
      },
      weight(e) {
        if (e === knight) {
          if (mode === 'summon') return 0;
          if (cuttable()) return 4;
          if (opts.parry && guarding()) return 0;
          // va a una pelota: la del bot tarda en llegar (cargar, bajar el palo, volar), así que conviene
          // empezar ya, para que le llegue cargando
          return mode === 'walk' ? 3 : 0.6;
        }
        const c = caddies.find((k) => k.e === e);
        if (c) return c.carrying ? 1.5 : 0;
        if (rollers.some((r) => r.e === e)) return 5;
        return 1;
      },
    },
    log: () => ({
      vida: knight.hp, fase: phase + 1, velocidad: Math.round(100 / pace()) / 100, tiros: stats.shots, conjuradas: stats.conjured, cortes: stats.cuts, aguanto: stats.held, puerta: stats.gate,
      golfista: stats.player, esquivadas: stats.dodged, caddiesMuertos: stats.caddiesKilled, entregas: stats.delivered,
      devueltas: stats.parried, atajadas: stats.caught, modo: mode,
    }),
    dispose() {
      row.dispose();
      arc.dispose();
      eyes.dispose();
      circle.dispose();
      circleRing.dispose();
      aimMark?.dispose();
      guardMark?.dispose();
      scene.remove(rig.club);
      for (const f of flying) dropFlying(f);
      flying.length = 0;
      for (const c of caddies) scene.remove(c.ball);
      for (const r of rollers) r.lane.dispose();
    },
  };
}
