// El futbolista (17/10, idea de Leandro; ver docs/jefes/futbolista.md): corre por el campo entre los
// enemigos, elige a uno, se le pone atrás y lo patea hacia la puerta. El pateado sale volando estilo
// superman (cuerpo horizontal, brazos adelante), cae de panza, se levanta y sigue caminando: la oleada te
// llega antes. Cuánto vuela depende de lo que pesa. Si lo patea a 20 m o menos de tu línea, va derecho a
// la puerta: gol (le saca a la puerta lo que le sacaría al llegar). Sin nadie a quien patear, patea su
// pelota a la puerta (un pelotazo que rueda: se le pega para pararlo).
//
// El contrajuego: pegarle fuerte (golpe 2 o 3) mientras corre o se prepara le corta la patada y lo deja
// aturdido («¡Falta!»); matar al marcado antes de que llegue, también. Y tiene vida: se le pega.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { BossBar, GATE_HALF_WIDTH, GATE_Z, GroundMark, LaneMark, SPAWN_Z, TEE_Z, fieldHalfAt, heightAt, partStats } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { GET_UP, addFutbolistaLook, ballLook, ballMesh, kickPose, limbs, supermanPose, tintFallback } from './look';

/** Qué hace cada versión (ver index.ts). */
export interface FutOpts {
  /**
   * A quién elige: `gol` el que más le conviene (los que ya están a tiro de gol, y si no el que más avanza);
   * `pesado` el que más le saca a la puerta (los grandes: vuelan menos, pero el gol duele más);
   * `chico` solo a los livianos, más seguido y más lejos.
   */
  pick: 'gol' | 'pesado' | 'chico';
  /** La vida, sin la dificultad. */
  hp: number;
  /** Multiplica el descanso entre patadas (menos = más seguido). */
  rest?: number;
  /** Multiplica lo que vuela cada uno. */
  reach?: number;
  /** La línea chica del cartel de arriba al empezar: cómo se le gana. */
  hint: string;
}

// ---- el cuerpo ----

/** El goblin del pack mide 1.25 m: el futbolista, grande, que se vea desde la cámara alta. */
const BODY = { height: 2.7, radius: 0.8 };
/** Vida de más por nivel de dificultad (además del talento de la vida del jefe). */
const HP_PER_LEVEL = 3;
/** Entra corriendo desde acá. */
const ENTRY_Z = SPAWN_Z - 4;
/** La fase sube con la vida que le sacaste o con el tiempo, lo que llegue antes. */
const PHASE_HP = [0.66, 0.33];
const PHASE_TIME = [50, 100];

// ---- la patada ----

/** A qué velocidad corre a buscar al que va a patear, por fase. */
const RUN = [6.2, 7.0, 7.8];
/** Lo que tarda en cargar la patada ya pegado al marcado (la ventana para cortarlo), por fase; el tiro al arco, `GOAL_EXTRA` más. */
const WINDUP = [1.0, 0.85, 0.72];
const GOAL_EXTRA = 0.6;
/** Del impacto hasta que baja la pierna. */
const FOLLOW = 0.5;
/** Lo que descansa entre patada y patada (trotando a su lugar), por fase: la ventana para pegarle tranquilo. */
const REST = [2.6, 2.0, 1.5];
/** Trota a su lugar a esto, y su lugar queda `behind` m detrás del medio de la horda, entre `zMin` y `zMax`. */
const HOME = { jog: 3.6, behind: 6, zMin: 30, zMax: 52 };
/**
 * Cuánto vuela cada uno: `base` m el goblin (radio `ref`), menos cuanto más grande (a la `exp`), y los
 * pesados (`heavy`) un 25 % menos; entre `min` y `max`. Goblin 18, orco 14, esqueleto 15, caballero 7.
 * A `goalZone` m o menos de tu línea, va derecho a la puerta (gol). Nunca cae a menos de `landMin` m de tu
 * línea: el que cae ahí todavía se puede bajar mientras se levanta.
 */
const KICK = { base: 18, ref: 0.45, exp: 0.8, heavy: 0.75, min: 6, max: 20, goalZone: 20, landMin: 3 };
/** A quién no va a buscar: muy cerca de tu línea (te queda encima) o recién salidos. */
const PICK = { nearLine: 4, farZ: SPAWN_Z - 3, goalValue: 1.5 };
/** El vuelo: velocidad, alto del arco, y el patinazo de panza al caer. */
const FLY = { speed: 15, goalSpeed: 17, minTime: 0.7, height: 1.2, perMeter: 0.08, slide: 0.45, slideDist: 1.6 };
/** Se levantan con «Getting Up» a esta velocidad (dura 2.7 s a 1). */
const GET_UP_SPEED = 1.5;
/**
 * Cortarle la patada: cada intento (desde que sale corriendo hasta que patea) tiene un aguante de `guard`
 * puntos por fase. Un golpe fuerte (golpe 2 o 3 de palo, o lo que saque 3 o más) le baja `strong`; uno flojo,
 * `weak`, y además lo demora `stumble` s. Sin aguante, la patada se corta: trastabilla `stun` s y vuelve a
 * su lugar. En la primera fase un golpe fuerte alcanza; en la última, dos. (Primera tanda del bot: sin
 * aguante y aturdido 1.8 s, le cortó 9 de 10 y lo mató en 55 s casi sin que pateara. Con 3, 4 y 5 casi
 * no lo cortaba y los goles le rompían la puerta en 43 s.)
 */
const CUT = { quality: 2, damage: 3, guard: [2, 3, 4], strong: 2, weak: 1, stun: 0.8, stumble: 0.3 };
/**
 * El pelotazo, sin nadie a quien patear: carga `windup` s (también se corta), la pelota rueda a `speed`
 * m/s hasta la puerta y le saca `damage`. Tiene `hp` (un golpe la para). Después de `wait` s sin a quién.
 */
const SHOT = { wait: 1.0, windup: 0.9, speed: 7.5, hp: 1, damage: 1, radius: 0.45, rest: [2.4, 2.0, 1.6] };

const COLORS = { mark: 0xffd24a, kick: 0xff8a2a, goal: 0xff3c3c, cut: 0xffffff, dust: 0xb8a07a };

type State = 'enter' | 'home' | 'run' | 'windup' | 'follow' | 'stun' | 'shot';

/** Uno que pateó: vuela, patina de panza, se levanta. */
interface Flier {
  e: Enemy;
  from: THREE.Vector3;
  to: THREE.Vector3;
  dir: THREE.Vector3;
  time: number;
  height: number;
  goal: boolean;
  phase: 'fly' | 'slide' | 'up';
  t: number;
  humanoid: boolean;
}

const smooth = (u: number) => u * u * (3 - 2 * u);

export function startFutbolista(ctx: BossCtx, o: FutOpts): BossFight {
  const { horde, scene, effects, audio } = ctx;
  const hpMax = Math.round(o.hp + HP_PER_LEVEL * ctx.level + ctx.bonusHp);
  const title = L('Futbolista', 'Footballer');
  if (!horde.hasLook('futbolista')) addFutbolistaLook(horde, 'futbolista', ctx.models, ctx.dungeon);
  const getUp = ctx.models.get('futbolista.glb')?.animations.find((c) => c.name === GET_UP) ?? null;
  if (!horde.hasLook('futbolista-pelota')) horde.addLook('futbolista-pelota', ballLook(SHOT.radius));

  let state: State = 'enter';
  let t = 0;
  let rest = 0;
  let phase = 0;
  let noTarget = 0;
  let target: Enemy | null = null;
  /** Lo que le queda de aguante a este intento (ver `CUT`). */
  let guard = CUT.guard[0];
  /** Adónde cae el marcado (o la puerta). */
  const landing = new THREE.Vector3();
  let goalShot = false;
  let windupFor = WINDUP[0];
  /** La calidad del último golpe que le entró (para saber si fue fuerte: ver `filter`). */
  let lastQuality = 0;
  let lastAbility = false;
  const home = new THREE.Vector3(0, 0, 40);
  let homeTimer = 0;
  /** Cuánto pesa la pose de la patada (entra y sale suave). */
  let kickW = 0;
  let kickU = 0;
  const fliers: Flier[] = [];
  const falling: Enemy[] = [];
  const shots: { e: Enemy; lane: LaneMark }[] = [];
  const told = { cut: false, goal: false, shot: false };

  const stats = { patadas: 0, goles: 0, puertaGol: 0, metros: 0, cortadas: 0, demoradas: 0, perdidas: 0, pelotazos: 0, puertaPelotazo: 0, pelotazosParados: 0, cazados: 0 };

  // lo que se ve en el piso: el marcado (anillo), por dónde corre, por dónde lo va a mandar y dónde cae
  const ring = new GroundMark(scene, COLORS.mark, false, 1).opacity(0);
  const runLane = new LaneMark(scene, COLORS.mark, 0.5).opacity(0);
  const kickLane = new LaneMark(scene, COLORS.kick, 1.2).opacity(0);
  const landMark = new GroundMark(scene, COLORS.kick, true, 1).opacity(0);
  const bar = new BossBar(title, '#5aa9e6');

  // la pelota a sus pies (la que patea en el pelotazo)
  const ball = ballMesh(0.42);
  scene.add(ball);
  let ballBack = 0;
  let ballSpin = 0;

  // ---- el cuerpo ----

  const bodyScript: EnemyScript = {
    update(e, dt) {
      think(e, dt);
      return true;
    },
    filter(_e, amount, shot) {
      lastQuality = shot?.quality ?? 0;
      lastAbility = !!shot?.ability;
      return amount;
    },
    onDamage(e, dealt, killed) {
      if (killed) return;
      const strong = (lastQuality >= CUT.quality && !lastAbility) || dealt >= CUT.damage;
      lastQuality = 0;
      if (state !== 'run' && state !== 'windup' && state !== 'shot') return;
      guard -= strong ? CUT.strong : CUT.weak;
      if (guard <= 0) cut(e);
      else if (!strong) {
        // un golpe flojo lo demora un toque
        stats.demoradas++;
        if (state === 'windup' || state === 'shot') t = Math.max(0, t - CUT.stumble);
        else rest = CUT.stumble;
      }
    },
    onDeath(e) {
      effects.explosion(e.position.clone().setY(1.2), 2.2, 0x5aa9e6);
      clearMarks();
      ctx.banner(L('¡Expulsado!', 'Sent off!'), L('El futbolista cayó', 'The footballer is down'), 2.5);
    },
  };
  const boss = horde.spawnCustom(
    partStats('goblin', { name: title, height: BODY.height, radius: BODY.radius, hp: hpMax, boss: true, heavy: true, runs: true }),
    'futbolista', 0, ENTRY_Z, {}, bodyScript,
  );
  tintFallback(boss.body, ctx.models);
  ctx.banner(title, o.hint, 4);
  audio.bossAppear();

  function setState(s: State): void {
    state = s;
    t = 0;
  }

  function cut(e: Enemy): void {
    stats.cortadas++;
    effects.explosion(e.position.clone().setY(1.4), 1.6, COLORS.cut);
    audio.thud();
    ctx.feedback(L('¡Falta! Le cortaste la patada', 'Foul! Kick stopped'));
    told.cut = true;
    target = null;
    clearMarks();
    setState('stun');
  }

  function clearMarks(): void {
    ring.opacity(0);
    runLane.opacity(0);
    kickLane.opacity(0);
    landMark.opacity(0);
  }

  // ---- a quién patea ----

  /** Cuánto vuela `v` de una patada (los grandes, menos). */
  function kickDistance(v: Enemy): number {
    const d = KICK.base * Math.pow(KICK.ref / Math.max(0.2, v.radius), KICK.exp) * (v.stats.heavy ? KICK.heavy : 1) * (o.reach ?? 1);
    return THREE.MathUtils.clamp(d, KICK.min, KICK.max);
  }

  /** Hacia dónde lo manda: a la puerta (al punto de la puerta más cercano a su columna). */
  function dirFrom(v: Enemy, out: THREE.Vector3): THREE.Vector3 {
    const gx = THREE.MathUtils.clamp(v.position.x, -GATE_HALF_WIDTH + 0.6, GATE_HALF_WIDTH - 0.6);
    return out.set(gx - v.position.x, 0, GATE_Z - v.position.z).normalize();
  }

  /** ¿Se lo puede patear? Los de la horda que caminan (no los que se plantan, ni otros jefes, ni los que ya vuelan). */
  function kickable(v: Enemy): boolean {
    if (v === boss || !v.alive || v.passed || v.stats.boss || v.script !== null || v.frozen || v.hold) return false;
    if (v.behavior !== 'melee' && v.behavior !== 'kamikaze') return false;
    if (o.pick === 'chico' && (v.stats.heavy || v.radius > 0.62)) return false;
    const fromLine = v.position.z - TEE_Z;
    return fromLine >= PICK.nearLine && v.position.z <= PICK.farZ;
  }

  /** Dónde se para para patear a `v`: detrás de él, en la línea de la patada. */
  function approachOf(v: Enemy, out: THREE.Vector3): THREE.Vector3 {
    dirFrom(v, out);
    const back = v.radius + boss.radius * 0.55 + 0.25;
    return out.multiplyScalar(-back).add(v.position).setY(0);
  }

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  /** Qué tan bueno es patear a `v` ahora (más es mejor), contando lo que tarda en llegar. */
  function scoreOf(v: Enemy): number {
    approachOf(v, tmp);
    const travel = Math.hypot(tmp.x - boss.position.x, tmp.z - boss.position.z) / RUN[phase];
    // si llega a tu línea antes de que lo alcance, no sirve
    if (v.lineEta() < travel + WINDUP[phase] + 0.4) return -1;
    const goal = v.position.z - TEE_Z - (v.walkSpeed * (travel + WINDUP[phase])) <= KICK.goalZone;
    let value: number;
    if (o.pick === 'pesado') value = v.gateDamage * (goal ? 2 : 1) + v.maxHp * 0.1;
    else value = goal ? PICK.goalValue * v.gateDamage : kickDistance(v) / Math.max(0.8, v.walkSpeed) / 4;
    return value / (1 + travel);
  }

  function pickTarget(): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = 0;
    for (const v of horde.enemies) {
      if (!kickable(v)) continue;
      const s = scoreOf(v);
      if (s > bestScore) {
        bestScore = s;
        best = v;
      }
    }
    return best;
  }

  /** Su lugar entre patadas: detrás del medio de la horda (o a media cancha, si no hay nadie). */
  function updateHome(dt: number): void {
    if ((homeTimer -= dt) > 0) return;
    homeTimer = 0.6;
    let n = 0;
    let sx = 0;
    let sz = 0;
    for (const v of horde.enemies) {
      if (!kickable(v)) continue;
      n++;
      sx += v.position.x;
      sz += v.position.z;
    }
    if (n) home.set((sx / n) * 0.7, 0, THREE.MathUtils.clamp(sz / n + HOME.behind, HOME.zMin, HOME.zMax));
    else home.z = THREE.MathUtils.clamp(home.z, 34, 42);
    const half = fieldHalfAt(home.z) - 2;
    home.x = THREE.MathUtils.clamp(home.x, -half, half);
  }

  // ---- lo que piensa cada cuadro ----

  function phaseNow(): number {
    let p = 0;
    for (let i = 0; i < PHASE_HP.length; i++) if (boss.hp / boss.maxHp <= PHASE_HP[i] || ctx.clock() >= PHASE_TIME[i]) p = i + 1;
    return p;
  }

  function think(e: Enemy, dt: number): void {
    t += dt;
    phase = Math.max(phase, phaseNow());
    if (ctx.over()) {
      e.animator.setLocomotion('Idle', 1);
      clearMarks();
      return;
    }
    switch (state) {
      case 'enter': {
        updateHome(dt);
        if (e.walkToward(home.x, home.z, RUN[0], dt, true, 0.8)) {
          setState('home');
          rest = 0.8;
        }
        break;
      }
      case 'home': {
        updateHome(dt);
        const there = Math.hypot(home.x - e.position.x, home.z - e.position.z) < 1.2;
        if (!there) e.walkToward(home.x, home.z, HOME.jog, dt, true, 1.0);
        else {
          e.animator.setLocomotion('Idle', 1);
          e.faceToward(e.position.x, GATE_Z, dt, 4);
        }
        // silenciado no patea; aturdido tampoco
        if (e.silenced || e.stunned) break;
        if ((rest -= dt) > 0) break;
        target = pickTarget();
        if (target) {
          noTarget = 0;
          guard = CUT.guard[phase];
          setState('run');
          break;
        }
        // nadie a quien patear: su pelota a la puerta
        if ((noTarget += dt) >= SHOT.wait && ballBack <= 0) {
          noTarget = 0;
          guard = CUT.guard[phase];
          setState('shot');
          windupFor = SHOT.windup;
        }
        break;
      }
      case 'run': {
        if (!target || !kickable(target)) {
          // se le murió (o se lo llevaron): se queda un toque mirando
          if (target && !target.alive) {
            stats.perdidas++;
            ctx.feedback(L('¡Le sacaste al marcado!', 'You took out his mark!'));
          }
          target = null;
          clearMarks();
          setState('home');
          rest = 0.7;
          break;
        }
        if (rest > 0) {
          // trastabilló con un golpe flojo
          rest -= dt;
          e.animator.setLocomotion('Idle', 1);
          break;
        }
        // adonde va a estar el marcado cuando llegue: un poco adelante en su camino
        approachOf(target, tmp);
        dirFrom(target, tmp2);
        const lead = Math.min(0.6, Math.hypot(tmp.x - e.position.x, tmp.z - e.position.z) / RUN[phase]) * target.walkSpeed;
        tmp.addScaledVector(tmp2, lead);
        if (e.walkToward(tmp.x, tmp.z, RUN[phase], dt, true, 0.5)) {
          goalShot = target.position.z - TEE_Z <= KICK.goalZone;
          windupFor = WINDUP[phase] + (goalShot ? GOAL_EXTRA : 0);
          setState('windup');
        }
        showMarks(e);
        break;
      }
      case 'windup': {
        if (!target || !kickable(target)) {
          if (target && !target.alive) {
            stats.perdidas++;
            ctx.feedback(L('¡Le sacaste al marcado!', 'You took out his mark!'));
          }
          target = null;
          clearMarks();
          setState('home');
          rest = 0.7;
          break;
        }
        // pegado atrás del marcado, que sigue caminando: lo acompaña
        approachOf(target, tmp);
        const dx = tmp.x - e.position.x;
        const dz = tmp.z - e.position.z;
        const d = Math.hypot(dx, dz);
        const step = Math.min(d, (target.walkSpeed + 1.5) * dt);
        if (d > 1e-3) {
          e.position.x += (dx / d) * step;
          e.position.z += (dz / d) * step;
          e.position.y = heightAt(e.position.x, e.position.z);
        }
        dirFrom(target, tmp2);
        e.faceToward(e.position.x + tmp2.x, e.position.z + tmp2.z, dt, 12);
        e.animator.setLocomotion(step > 0.02 ? 'Walking' : 'Idle', 0.8);
        goalShot = target.position.z - TEE_Z <= KICK.goalZone;
        showMarks(e);
        if (t >= windupFor) {
          kick(target);
          target = null;
          setState('follow');
        }
        break;
      }
      case 'shot': {
        // el pelotazo: se acomoda mirando a la puerta y le pega a su pelota
        e.animator.setLocomotion('Idle', 1);
        tmp2.set(-e.position.x * 0.6, 0, GATE_Z - e.position.z).normalize();
        e.faceToward(e.position.x + tmp2.x, e.position.z + tmp2.z, dt, 10);
        const bx = e.position.x + tmp2.x * 1.3;
        const bz = e.position.z + tmp2.z * 1.3;
        kickLane.color(COLORS.goal).between(bx, bz, THREE.MathUtils.clamp(bx * 0.4, -GATE_HALF_WIDTH, GATE_HALF_WIDTH), GATE_Z + 1).opacity(0.25 + 0.25 * Math.min(1, t / windupFor));
        if (t >= windupFor) {
          shoot(bx, bz);
          kickLane.opacity(0);
          setState('follow');
        }
        break;
      }
      case 'follow': {
        e.animator.setLocomotion('Idle', 1);
        if (t >= FOLLOW) {
          setState('home');
          rest = (fliers.length || horde.enemies.some(kickable) ? REST[phase] : SHOT.rest[phase]) * (o.rest ?? 1);
        }
        break;
      }
      case 'stun': {
        e.animator.setLocomotion('Idle', 0.6);
        if (t >= CUT.stun) {
          setState('home');
          rest = 1.0;
        }
        break;
      }
    }
    // la pose de la patada (se aplica después de la animación, en `update`)
    const kicking = state === 'windup' || state === 'shot';
    if (kicking) kickU = Math.min(1, t / windupFor);
    else if (state === 'follow') kickU = 1 + Math.min(2, (t / FOLLOW) * 2);
    kickW += ((kicking || state === 'follow' ? 1 : 0) - kickW) * (1 - Math.exp(-12 * dt));
    e.scriptGesture = 0;
  }

  /** El anillo del marcado, el carril de la corrida, y por dónde lo va a mandar. */
  function showMarks(e: Enemy): void {
    if (!target) return;
    const v = target;
    const wind = state === 'windup' ? Math.min(1, t / windupFor) : 0;
    const pulse = 0.5 + 0.5 * Math.sin(ctx.clock() * (8 + 10 * wind));
    ring.color(goalShot ? COLORS.goal : wind > 0 ? COLORS.kick : COLORS.mark).at(v.position.x, v.position.z).size(v.radius + 0.5 + 0.25 * pulse).opacity(0.55 + 0.35 * wind);
    if (state === 'run') runLane.between(e.position.x, e.position.z, v.position.x, v.position.z).opacity(0.3);
    else runLane.opacity(0);
    landingOf(v, landing);
    const goal = v.position.z - TEE_Z <= KICK.goalZone;
    kickLane.color(goal ? COLORS.goal : COLORS.kick).between(v.position.x, v.position.z, landing.x, landing.z).opacity(0.18 + 0.3 * wind);
    if (goal) landMark.opacity(0);
    else landMark.at(landing.x, landing.z).size(v.radius + 0.4).opacity(0.18 + 0.25 * wind);
  }

  /** Adónde cae `v` si lo patea ahora (o la puerta, si es gol). */
  function landingOf(v: Enemy, out: THREE.Vector3): THREE.Vector3 {
    const goal = v.position.z - TEE_Z <= KICK.goalZone;
    dirFrom(v, tmp2);
    if (goal) return out.set(THREE.MathUtils.clamp(v.position.x, -GATE_HALF_WIDTH + 0.6, GATE_HALF_WIDTH - 0.6), 0, GATE_Z + 0.6);
    let d = kickDistance(v);
    const minZ = TEE_Z + KICK.landMin;
    if (v.position.z + tmp2.z * d < minZ) d = (v.position.z - minZ) / Math.max(0.2, -tmp2.z);
    out.copy(v.position).addScaledVector(tmp2, d).setY(0);
    const half = fieldHalfAt(out.z) - 0.8;
    out.x = THREE.MathUtils.clamp(out.x, -half, half);
    return out;
  }

  // ---- la patada y los que vuelan ----

  function kick(v: Enemy): void {
    stats.patadas++;
    clearMarks();
    const from = v.position.clone();
    const goal = from.z - TEE_Z <= KICK.goalZone;
    const to = landingOf(v, new THREE.Vector3());
    const dir = to.clone().sub(from).setY(0);
    const dist = dir.length();
    dir.normalize();
    if (!goal) stats.metros += Math.max(0, from.z - to.z);
    const f: Flier = {
      e: v, from, to, dir, goal, t: 0, phase: 'fly',
      time: Math.max(FLY.minTime, dist / (goal ? FLY.goalSpeed : FLY.speed)),
      height: FLY.height + dist * FLY.perMeter,
      humanoid: !!limbs(v.body),
    };
    fliers.push(f);
    if (getUp && f.humanoid) v.animator.addClip(getUp);
    v.script = flierScript(f);
    v.knock.set(0, 0, 0);
    effects.spark(from.clone().setY(v.height * 0.5), COLORS.kick);
    audio.thud();
    audio.whoosh(0.7);
    if (goal && !told.goal) {
      told.goal = true;
      ctx.feedback(L('¡Patea al arco! Cortalo antes', 'He shoots at the gate! Stop him first'));
    }
  }

  function flierScript(f: Flier): EnemyScript {
    return {
      update(en, dt) {
        en.knock.set(0, 0, 0);
        const body = en.body;
        const mid = en.stats.height / 2;
        const yaw = Math.atan2(f.dir.x, f.dir.z);
        f.t += dt;
        if (f.phase === 'fly') {
          const u = Math.min(1, f.t / f.time);
          en.position.lerpVectors(f.from, f.to, u);
          const ground = heightAt(en.position.x, en.position.z);
          en.position.y = ground + Math.sin(Math.PI * u) * f.height;
          en.heading = yaw;
          // se acuesta de panza en el primer tramo, alrededor de la panza
          const a = (Math.PI / 2) * smooth(Math.min(1, u / 0.18));
          tilt(en, a, mid, f.humanoid ? mid : mid * 0.6);
          en.animator.setLocomotion('Idle', 0.3);
          if (u >= 1) {
            if (f.goal) {
              if (!ctx.over()) {
                const dmg = Math.max(1, en.gateDamage);
                ctx.hitGate(dmg, boss);
                stats.goles++;
                stats.puertaGol += dmg;
                ctx.feedback(L('¡Gol!', 'Goal!'));
              }
              effects.explosion(en.position.clone().setY(0.8), 1.5, COLORS.goal);
              untilt(en);
              en.remove();
              return true;
            }
            f.phase = 'slide';
            f.t = 0;
            // el panzazo: un anillo de polvo, sin fogonazo
            effects.swipe(en.position.clone().setY(0.2), 1.1);
            audio.thud();
          }
          return true;
        }
        if (f.phase === 'slide') {
          // de panza por el piso, frenando
          const u = Math.min(1, f.t / FLY.slide);
          const along = FLY.slideDist * (1 - (1 - u) * (1 - u));
          en.position.copy(f.to).addScaledVector(f.dir, along);
          en.position.y = heightAt(en.position.x, en.position.z);
          en.heading = yaw;
          tilt(en, Math.PI / 2, mid, f.humanoid ? 0.2 * en.stats.height : mid * 0.6);
          if (u >= 1) {
            untilt(en);
            f.phase = 'up';
            f.t = 0;
            if (f.humanoid && en.animator.has(GET_UP)) {
              // se da vuelta panza arriba (la cabeza hacia la puerta) y se levanta mirando para atrás:
              // después gira solo hacia la puerta, como cualquiera
              en.heading = yaw + Math.PI;
              en.animator.playOneShot(GET_UP, GET_UP_SPEED);
              f.time = en.animator.clipDuration(GET_UP) / GET_UP_SPEED;
            } else if (en.animator.has('Hard Landing')) {
              f.time = en.animator.playOneShot('Hard Landing', 1.4);
            } else {
              f.time = 0.6;
              en.animator.setLocomotion('Idle', 1);
            }
          }
          return true;
        }
        // levantándose
        en.position.y = heightAt(en.position.x, en.position.z);
        if (f.t >= f.time - 0.05) {
          release(f);
          return false;
        }
        return true;
      },
      onDeath(en) {
        // lo bajaron en el aire o en el piso: cae ahí
        stats.cazados++;
        untilt(en);
        const i = fliers.indexOf(f);
        if (i >= 0) fliers.splice(i, 1);
        if (en.position.y > heightAt(en.position.x, en.position.z) + 0.05) falling.push(en);
      },
    };
  }

  /** Acuesta al cuerpo `a` rad hacia adelante (alrededor de su panza, a `mid`), con la panza a `belly` del piso. */
  function tilt(en: Enemy, a: number, mid: number, belly: number): void {
    const body = en.body;
    body.rotation.order = 'YXZ';
    body.rotation.x = a;
    const yaw = en.heading;
    // la panza, girada, queda en (mid sen a sen yaw, mid cos a, mid sen a cos yaw): se corre el modelo para
    // que quede en (0, belly, 0)
    body.position.set(-mid * Math.sin(a) * Math.sin(yaw), belly - mid * Math.cos(a), -mid * Math.sin(a) * Math.cos(yaw));
  }

  function untilt(en: Enemy): void {
    en.body.rotation.x = 0;
    en.body.rotation.order = 'XYZ';
    en.body.position.set(0, 0, 0);
  }

  function release(f: Flier): void {
    const i = fliers.indexOf(f);
    if (i >= 0) fliers.splice(i, 1);
    untilt(f.e);
    if (f.e.alive) {
      f.e.script = null;
      f.e.animator.clearOneShot();
    }
  }

  function updateFliers(dt: number): void {
    for (let i = fliers.length - 1; i >= 0; i--) {
      const f = fliers[i];
      if (f.e.state === 'gone' || !f.e.alive) {
        fliers.splice(i, 1);
        continue;
      }
      // brazos adelante y piernas derechas mientras vuela y patina (encima de la animación)
      if (f.humanoid && f.phase !== 'up') supermanPose(f.e.body, f.phase === 'fly' ? Math.min(1, f.t / 0.12) : 1, ctx.clock());
    }
    for (let i = falling.length - 1; i >= 0; i--) {
      const e = falling[i];
      const ground = heightAt(e.position.x, e.position.z);
      e.position.y = Math.max(ground, e.position.y - dt * 12);
      if (e.position.y <= ground || e.state === 'gone') falling.splice(i, 1);
    }
  }

  // ---- el pelotazo ----

  function shoot(x: number, z: number): void {
    stats.pelotazos++;
    ballBack = 1.2;
    ball.visible = false;
    const gx = THREE.MathUtils.clamp(x * 0.4, -GATE_HALF_WIDTH + 0.5, GATE_HALF_WIDTH - 0.5);
    const lane = new LaneMark(scene, COLORS.goal, 1.3).between(x, z, gx, GATE_Z + 1).opacity(0.35);
    const dir = new THREE.Vector3(gx - x, 0, GATE_Z - z).normalize();
    const script: EnemyScript = {
      update(e, dt) {
        e.knock.set(0, 0, 0);
        e.position.addScaledVector(dir, SHOT.speed * dt);
        e.position.y = heightAt(e.position.x, e.position.z);
        const m = e.body.getObjectByName('pelota');
        if (m) m.rotation.x += (SHOT.speed / SHOT.radius) * dt * 0.9;
        e.heading = Math.atan2(dir.x, dir.z);
        if (e.position.z <= GATE_Z + 1) {
          if (!ctx.over()) {
            ctx.hitGate(SHOT.damage, boss);
            stats.puertaPelotazo += SHOT.damage;
            ctx.feedback(L('¡Gol!', 'Goal!'));
          }
          effects.explosion(e.position.clone().setY(0.6), 1.2, COLORS.goal);
          e.remove();
        }
        return true;
      },
      onDeath(e) {
        stats.pelotazosParados++;
        effects.explosion(e.position.clone().setY(0.5), 1.0, 0xffffff);
        e.remove();
      },
    };
    const e = horde.spawnCustom(partStats('spider', { name: L('Pelota', 'Ball'), height: SHOT.radius * 2, radius: SHOT.radius + 0.1, hp: SHOT.hp, heavy: true, runs: false }), 'futbolista-pelota', x, z, {}, script);
    shots.push({ e, lane });
    audio.thud();
    if (!told.shot) {
      told.shot = true;
      ctx.feedback(L('¡Pelotazo a la puerta! Pegale a la pelota', 'Shot at the gate! Hit the ball'));
    }
  }

  function updateShots(): void {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (s.e.state !== 'gone' && s.e.alive) continue;
      s.lane.dispose();
      shots.splice(i, 1);
    }
  }

  /** La pelota a sus pies: adelante mientras corre (gira), al costado quieto. */
  function updateBall(dt: number): void {
    if (ballBack > 0) {
      ballBack -= dt;
      if (ballBack <= 0) ball.visible = true;
    }
    if (!boss.alive) {
      ball.visible = false;
      return;
    }
    const f = boss.facing;
    const s = boss.height / 2.7;
    const running = state === 'run' || state === 'enter' || (state === 'home' && Math.hypot(home.x - boss.position.x, home.z - boss.position.z) >= 1.2);
    // corriendo, adelante; pateando a otro, a un costado (que no parezca que patea la pelota)
    const kicking = state === 'windup' || state === 'follow';
    const ahead = running ? 1.0 * s : kicking ? -0.1 * s : 0.75 * s;
    const side = running ? 0 : kicking ? 0.95 * s : -0.55 * s;
    const x = boss.position.x + f.x * ahead + f.z * side;
    const z = boss.position.z + f.z * ahead - f.x * side;
    const moved = Math.hypot(x - ball.position.x, z - ball.position.z);
    ball.position.set(x, heightAt(x, z), z);
    ball.position.y += 0.42;
    ballSpin += moved / 0.42;
    ball.rotation.set(ballSpin, Math.atan2(f.x, f.z), 0, 'YXZ');
  }

  // ---- la barra ----

  function updateBar(): void {
    let sub: string;
    if (!boss.alive) sub = '';
    else if (state === 'run' || state === 'windup' || state === 'shot') {
      // el aguante que le queda a este intento, en puntos: cuánto falta para cortarlo
      const pips = '●'.repeat(Math.max(0, guard)) + '○'.repeat(Math.max(0, CUT.guard[phase] - Math.max(0, guard))); // i18n-ok: símbolos
      const goal = state !== 'shot' && !!target && target.position.z - TEE_Z <= KICK.goalZone;
      const what = state === 'shot' ? L('¡Pelotazo a la puerta!', 'Shot at the gate!') : goal ? L('¡Va a patear al arco!', 'Shooting at the gate!') : L('Va a patear a uno', 'Going for a kick');
      sub = `${what} ${L('Cortalo', 'Stop him')} ${pips}`;
    } else if (state === 'stun') sub = L('¡Falta! Le cortaste la patada', 'Foul! Kick stopped');
    else sub = L(`Goles: ${stats.goles + stats.puertaPelotazo}`, `Goals: ${stats.goles + stats.puertaPelotazo}`);
    bar.set(boss.hp, boss.maxHp, sub);
    bar.show(boss.alive);
  }

  return {
    get done() {
      return !boss.alive;
    },
    update(dt) {
      updateFliers(dt);
      updateShots();
      updateBall(dt);
      updateBar();
      if (boss.alive) kickPose(boss.body, kickU, kickW);
      if (!boss.alive) clearMarks();
    },
    bot: {
      weight(e) {
        if (e === boss) return state === 'run' || state === 'windup' || state === 'shot' ? 3 : 1.2;
        if (e === target) return 2.5;
        if (shots.some((s) => s.e === e)) return 3;
        if (fliers.some((f) => f.e === e)) return 1.6;
        return 1;
      },
    },
    log: () => ({ ...stats, metros: Math.round(stats.metros), vida: boss.hp, fase: phase }),
    dispose() {
      clearMarks();
      ring.dispose();
      runLane.dispose();
      kickLane.dispose();
      landMark.dispose();
      for (const s of shots) s.lane.dispose();
      bar.dispose();
      scene.remove(ball);
      ball.geometry.dispose();
      (ball.material as THREE.Material).dispose();
    },
  };
}
