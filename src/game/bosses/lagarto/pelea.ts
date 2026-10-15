// La pelea del lagarto lancero (ver index.ts y docs/jefes/lagarto.md). Se planta a media cancha, se mueve de
// costado y tira lanzas derechas por carriles sin enemigos: a la puerta, o a tu puesto (y si te corrés, sigue
// hasta la puerta). El carril se marca en el piso desde que apunta hasta la muralla. Las versiones cambian
// cómo se para una lanza (bajarla a pelotazos, devolverla pegándole cuando llega, o las dos), a quién le
// tira, y cómo esquiva (al apuntarle, como la esquiva, o con pasos y rolls al azar).
import * as THREE from 'three';
import { ELEMENTS } from '../../../core/abilities';
import { L } from '../../../i18n';
import type { Ball } from '../../balls';
import { shadowMat, type Enemy, type EnemyScript } from '../../enemies';
import { FIELD_HALF_WIDTH, GATE_HALF_WIDTH, GATE_Z, GroundMark, LaneMark, SPAWN_Z, TEE_Z, disposeObject, heightAt, partStats } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { colliderLook, spearView, type SpearView } from './lanza';

/** Lo que cambia entre versiones. */
export interface LagartoCfg {
  /** La lanza es una parte del jefe: se la baja a pelotazos en el vuelo. */
  shoot: boolean;
  /** Se la devuelve pegándole a la pelota cuando llega, parado en su carril: vuelve y le pega a él. */
  parry: boolean;
  /** También tira a tu puesto (si no, solo a la puerta). */
  atPlayer: boolean;
  /** Cómo esquiva: al apuntarle (la esquiva de siempre, con un roll) o con pasos y rolls al azar. */
  evade: 'aim' | 'random';
}

// ---- el cuerpo ----

/** El cuerpo: alto como un élite grande, y la vida (más la del talento del golpe 4 y la dificultad). */
const BODY = { height: 3.4, radius: 1.0, hp: 80, hpPerLevel: 2 };
/**
 * Dónde se planta: entre estas z (a 21-31 m de la línea; más allá de los 46 queda debajo de la barra de
 * arriba) y hasta `edge` de cada lado.
 */
const BAND = { near: 30, far: 40, edge: 12.5 };
/** Corre al entrar; de costado, al cambiar de lugar (m/s). */
const RUN = 4.5;
const STRAFE = 3.4;
/** Lo que avanza el clip de ir de costado en un segundo, a escala 1 (el desplazamiento que le saca el juego). */
const STRAFE_CLIP = { left: 1.84, right: 2.47 };
/** Lo que mide el lagarto del pack, para pasar las medidas de los clips a su tamaño. */
const MODEL_HEIGHT = 1.81;

// ---- el tiro ----

/**
 * Las fases, por la vida que le queda (más de `above`): cuánto apunta (s), cuánto descansa entre tiros (s),
 * qué tan rápido vuela la lanza (m/s; el goblin camina a 3.6), la chance de un segundo tiro seguido y la de
 * tirarte a vos en vez de a la puerta.
 */
const PHASES = [
  { above: 0.66, windup: 1.15, rest: 3.0, speed: 10, double: 0, atPlayer: 0.35 },
  { above: 0.33, windup: 1.0, rest: 2.6, speed: 11.5, double: 0.3, atPlayer: 0.45 },
  { above: 0, windup: 0.85, rest: 2.2, speed: 13, double: 0.5, atPlayer: 0.5 },
];
/** El segundo tiro seguido apunta menos. */
const QUICK_WINDUP = 0.6;
/** El brazo que baja después de soltar (tampoco esquiva). */
const FOLLOW = 0.35;
/** Se apura solo con el tiempo, para que esperar no sirva: cada `every` s, un `step` más, hasta `max`. */
const HURRY = { every: 40, step: 0.08, max: 0.4 };
/** La dificultad (0 a 10): cuánto más rápido vuela por nivel, y cuánto menos apunta. */
const PER_LEVEL = { speed: 0.15, windup: 0.015 };
/** Adónde de la puerta apunta: hasta acá del medio (la abertura es GATE_HALF_WIDTH). */
const GATE_AIM = GATE_HALF_WIDTH - 0.5;

// ---- la lanza ----

const SPEAR = {
  /** Altura del vuelo (m), a la del pecho; sale de la mano y baja hasta acá en `drop` m. */
  y: 1.3,
  drop: 5,
  /** Radio para las pelotas (cubre más o menos la mitad del largo). */
  radius: 0.9,
  /** Alto de la parte que le pegan: lo que pasa por debajo de la lanza también la toca. */
  height: 1.75,
  /** A cuánto del cuerpo del golfista le pega al cruzar la línea. */
  reachPlayer: 0.8,
  /** Lo que saca: al golfista, a la puerta, y al de la horda que se le cruza (se clava en él). */
  player: 1,
  gate: 1,
  ally: 2,
  /** Lo libre de enemigos que tiene que estar el carril (m, más el radio de cada uno). */
  clear: 1.0,
  /** Dónde pega la muralla. */
  wallZ: GATE_Z + 0.5,
  /** Cuánto queda clavada en la muralla (s). */
  stuck: 1.6,
};
/** Los colores del carril: a la puerta, a vos, y la que vuelve devuelta. */
const COLORS = { gate: 0xffa13d, player: 0xff3b30, back: 0xffe066 };

// ---- cómo esquiva ----

/** La esquiva al apuntarle (la de siempre, pero recibir daño no se la recarga): cada cuánto. */
const DODGE_EVERY = 4.5;
/** El roll: cuánto dura y cuánto se corre. El clip es el del pack, sin desplazamiento: lo corre el código. */
const ROLL = { time: 0.8, dist: 4.2, clip: 'Falling To Roll' };
/** Los pasos al azar (la versión sin esquiva): cada cuánto (s), cuánto (m), y qué parte son rolls. */
const STEPS = { every: [1.3, 2.8], dist: [2.5, 5.5], roll: 0.4 };
/** Después de cada tiro, la chance de irse a otro lado (así cambia el ángulo). */
const RELOCATE = 0.5;

// ---- la atajada ----

/**
 * Devolverla: le pegás a la pelota parado en su carril (a `width` de donde cruza la línea) cuando la lanza
 * está a menos de `reach` m de la línea, o te llega en los `after` s que siguen al golpe. Vuelve a `speed`
 * y le saca `damage` según el golpe (1, 2, 3).
 */
const PARRY = { reach: 3, after: 0.3, width: 2, speed: 22, damage: [3, 4, 5] };

const BODY_LOOK = 'lizardman';
const SPEAR_LOOK = 'lagarto-lanza';

type Kind = 'gate' | 'player';
type Mode = 'enter' | 'idle' | 'move' | 'windup' | 'follow' | 'roll';

/** Un carril: de dónde sale (o), dónde pega la muralla (e) y dónde cruza la línea de los puestos (cx). */
interface Plan {
  kind: Kind;
  ox: number;
  oz: number;
  ex: number;
  ez: number;
  cx: number;
}

interface Spear {
  kind: Kind;
  x: number;
  z: number;
  dx: number;
  dz: number;
  speed: number;
  plan: Plan;
  /** Altura de la mano al soltar, y lo que lleva volado (para bajar a la altura del vuelo). */
  y0: number;
  traveled: number;
  state: 'fly' | 'past' | 'back' | 'stuck' | 'gone';
  part: Enemy | null;
  view: SpearView;
  lane: LaneMark | null;
  ring: GroundMark | null;
  timer: number;
  /** La devolvió una pelota que la tocó cerca de la línea (lo marca el filtro de la parte): el golpe. */
  parryQ: number;
  /** Lo que le saca al volver. */
  damage: number;
}

const rand = (rng: () => number, [a, b]: readonly number[]) => a + (b - a) * rng();
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Distancia de (px, pz) al segmento de (ax, az) a (bx, bz). */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const len2 = vx * vx + vz * vz || 1;
  const u = clamp(((px - ax) * vx + (pz - az) * vz) / len2, 0, 1);
  return Math.hypot(px - (ax + vx * u), pz - (az + vz * u));
}

/** Lo que el lagarto lancero hace en una partida. */
export function startLagarto(ctx: BossCtx, cfg: LagartoCfg, hint: string): BossFight {
  const { horde, rng } = ctx;
  if (!horde.hasLook(SPEAR_LOOK)) horde.addLook(SPEAR_LOOK, colliderLook(SPEAR.height));
  const spears: Spear[] = [];
  const parts = new Set<Enemy>();
  const stats = { lanzas: 0, derribadas: 0, devueltas: 0, aPuerta: 0, aVos: 0, aliados: 0, esquivas: 0, rolls: 0 };
  const level = clamp(ctx.level, 0, 10);

  let mode: Mode = 'enter';
  let rest = 2.5;
  let goal = { x: 0, z: 0, thenThrow: null as Kind | null, tx: 0 };
  let aim: { plan: Plan; t: number; time: number; lane: LaneMark; ring: GroundMark } | null = null;
  let followT = 0;
  let pendingDouble = false;
  let lastKind: Kind = 'gate';
  let roll = { t: 0, done: 0, dist: 0, dx: 0, dz: 0 };
  let stepTimer = rand(rng, STEPS.every);
  /** La esquiva (versión `aim`): la recarga de verdad, y lo que se le dejó puesto al motor. */
  let cd = 0;
  let dodgeSet = 0;
  let phase = 0;
  let hinted = false;
  /** El último golpe a la pelota desde la línea (para la atajada). */
  let swing: { at: number; x: number; q: number } | null = null;
  const seen = new WeakSet<Ball>();
  for (const b of ctx.balls.list) seen.add(b);

  const startX = (rng() * 2 - 1) * 6;
  const bodyScript: EnemyScript = {
    update: (e, dt) => updateBody(e, dt),
    // recibir daño no le recarga la esquiva (a la de siempre sí): con tanta vida, sería cebarla antes de cada golpe
    onDamage: (e) => {
      if (cfg.evade === 'aim') e.dodgeLeft = dodgeSet;
    },
    onDeath: () => {
      ctx.audio.death('golem');
      for (const s of spears) if (s.state === 'fly' || s.state === 'back') shatter(s);
      clearAim();
    },
  };
  const body = horde.spawnCustom(
    partStats('lizardman', { name: L('Lagarto lancero', 'Lizard Lancer'), hp: BODY.hp + level * BODY.hpPerLevel + ctx.bonusHp, height: BODY.height, radius: BODY.radius, speed: RUN, runs: true, boss: true, heavy: true, score: 500 }),
    BODY_LOOK, startX, SPAWN_Z - 2,
    cfg.evade === 'aim' ? { dodge: true, dodgeEvery: DODGE_EVERY } : {},
    bodyScript,
  );
  goal = { x: startX + (rng() * 2 - 1) * 3, z: rand(rng, [BAND.near + 2, BAND.far]), thenThrow: null, tx: 0 };
  const scale = BODY.height / MODEL_HEIGHT;

  // ---- los números de ahora ----

  /** Se apura con el tiempo (1 al empezar, hasta 1 + HURRY.max). */
  const hurry = () => 1 + Math.min(HURRY.max, Math.floor(ctx.clock() / HURRY.every) * HURRY.step);
  const spearSpeed = () => (PHASES[phase].speed + level * PER_LEVEL.speed) * (1 + (hurry() - 1) / 2);
  const windupTime = (quick: boolean) => (quick ? QUICK_WINDUP : PHASES[phase].windup * (1 - level * PER_LEVEL.windup)) / (1 + (hurry() - 1) / 2);

  /** Apuntando o soltando: no esquiva (es la ventana para pegarle). */
  const committed = () => mode === 'windup' || mode === 'follow';

  /**
   * Dónde va a estar parado el golfista: en el puesto adonde va (o en el que está), al costado de la pelota
   * como está ahora (el cuerpo queda casi un metro al costado de la pelota, y la lanza le apunta al cuerpo).
   */
  function playerX(): number {
    const p = ctx.player();
    const spot = p.spotXs[p.spotIndex] ?? p.anchor.x;
    return spot + clamp(p.position.x - p.anchor.x, -1.2, 1.2);
  }

  /** El carril desde (bx, bz) a la puerta (en `tx`) o a la línea de los puestos (en `tx`, y sigue a la muralla). */
  function lane(bx: number, bz: number, kind: Kind, tx: number): Plan | null {
    const oz = bz - 1;
    const ez = SPEAR.wallZ;
    if (kind === 'gate') return { kind, ox: bx, oz, ex: tx, ez, cx: bx + ((tx - bx) * (oz - TEE_Z)) / (oz - ez) };
    const ex = bx + ((tx - bx) * (oz - ez)) / (oz - TEE_Z);
    // que pegue en la muralla, no afuera del campo
    if (Math.abs(ex) > FIELD_HALF_WIDTH - 1) return null;
    return { kind, ox: bx, oz, ex, ez, cx: tx };
  }

  /** ¿Va limpio? Nadie de la horda a menos de SPEAR.clear del carril (hasta la línea), ahora ni en un segundo. */
  function laneClear(p: Plan): boolean {
    for (const e of horde.enemies) {
      if (!e.alive || e.passed || e === body || parts.has(e)) continue;
      const reach = e.radius + SPEAR.clear;
      if (segDist(e.position.x, e.position.z, p.ox, p.oz, p.cx, TEE_Z) < reach) return false;
      if (segDist(e.position.x, e.position.z - e.walkSpeed, p.ox, p.oz, p.cx, TEE_Z) < reach) return false;
    }
    return true;
  }

  /** Un tiro que se pueda hacer: a quién, y desde qué x (la más cerca con el carril limpio). */
  function choose(bx: number, bz: number): { kind: Kind; tx: number; x: number } | null {
    const p = ctx.player();
    const wantPlayer = cfg.atPlayer && p.alive && rng() < PHASES[phase].atPlayer;
    const kinds: Kind[] = !cfg.atPlayer || !p.alive ? ['gate'] : wantPlayer ? ['player', 'gate'] : ['gate', 'player'];
    const sign = rng() < 0.5 ? 1 : -1;
    for (const kind of kinds) {
      const tx = kind === 'gate' ? (rng() * 2 - 1) * GATE_AIM : playerX();
      for (let k = 0; k <= 12; k++) {
        const off = (k % 2 ? sign : -sign) * Math.ceil(k / 2) * 1.5;
        const x = clamp(bx + off, -BAND.edge, BAND.edge);
        const plan = lane(x, bz, kind, tx);
        if (plan && laneClear(plan)) return { kind, tx, x };
      }
    }
    return null;
  }

  // ---- el cuerpo ----

  function moveTo(x: number, z: number, thenThrow: Kind | null, tx = 0): void {
    goal = { x: clamp(x, -BAND.edge, BAND.edge), z: clamp(z, BAND.near, BAND.far), thenThrow, tx };
    mode = 'move';
  }

  function startRoll(e: Enemy, dx: number, dz: number, dist: number): void {
    const n = Math.hypot(dx, dz) || 1;
    roll = { t: 0, done: 0, dist, dx: dx / n, dz: dz / n };
    mode = 'roll';
    stats.rolls++;
    e.scriptGesture = 0;
    e.scriptSwing = null;
    const clip = e.animator.clipDuration(ROLL.clip);
    if (clip > 0) e.animator.playOneShot(ROLL.clip, clip / (ROLL.time + 0.35));
  }

  /**
   * Empieza a apuntar desde donde está: el carril queda fijo desde acá. A la puerta, a `gateX` (o a un lugar
   * al azar de la abertura); a vos, adonde estés parado ahora.
   */
  function startWindup(e: Enemy, kind: Kind, quick: boolean, gateX = (rng() * 2 - 1) * GATE_AIM): boolean {
    const tx = kind === 'gate' ? gateX : playerX();
    const plan = lane(e.position.x, e.position.z, kind, tx);
    if (!plan || !laneClear(plan)) return false;
    const color = COLORS[kind];
    const laneMark = new LaneMark(ctx.scene, color, 1.3).between(plan.ox, plan.oz, plan.ex, plan.ez).opacity(0.15);
    const ring = new GroundMark(ctx.scene, color, false, 1.1).at(plan.cx, TEE_Z).opacity(0.3);
    aim = { plan, t: 0, time: windupTime(quick), lane: laneMark, ring };
    lastKind = kind;
    mode = 'windup';
    return true;
  }

  function clearAim(): void {
    aim?.lane.dispose();
    aim?.ring.dispose();
    aim = null;
  }

  /** Busca un tiro: si el carril está limpio desde acá, apunta; si no, se corre adonde esté limpio. */
  function tryThrow(e: Enemy): void {
    const pick = choose(e.position.x, e.position.z);
    if (!pick) {
      // todo tapado por la horda: espera un poco, corriéndose un paso
      rest = 0.5;
      if (rng() < 0.5) moveTo(e.position.x + (rng() * 2 - 1) * 2.5, e.position.z, null);
      return;
    }
    if (Math.abs(pick.x - e.position.x) < 0.4) {
      if (!startWindup(e, pick.kind, false, pick.tx)) rest = 0.3;
    } else moveTo(pick.x, e.position.z, pick.kind, pick.tx);
  }

  function updateBody(e: Enemy, dt: number): boolean {
    const p = ctx.player();
    // la esquiva: el motor la hace saltar al soltar un tiro que le apunta (le pone la recarga entera y lo
    // empuja al costado); acá se ve en el empujón y se convierte en un roll
    if (cfg.evade === 'aim') {
      if (!e.silenced && e.dodgeLeft > dodgeSet + 0.5) {
        const kx = e.knock.x;
        const kz = e.knock.z;
        e.knock.set(0, 0, 0);
        cd = DODGE_EVERY;
        stats.esquivas++;
        if (Math.hypot(kx, kz) > 0.01) startRoll(e, kx, kz, ROLL.dist);
        else startRoll(e, rng() < 0.5 ? 1 : -1, 0, ROLL.dist);
      }
      if (e.silenced) cd = Math.max(cd, DODGE_EVERY);
      else cd = Math.max(0, cd - dt);
    }
    const ph = PHASES.findIndex((f) => e.hp / e.maxHp > f.above);
    if (ph > phase) {
      phase = ph;
      ctx.feedback(L('¡El lagarto se apura!', 'The lizard speeds up!'));
    }
    e.scriptGesture = 0;
    e.scriptSwing = null;
    if (ctx.over()) {
      clearAim();
      e.animator.setLocomotion('Idle', 1);
    } else if (!e.frozen) runMode(e, p, dt);
    // a lo sumo un poco afuera de su franja (los empujones)
    e.position.x = clamp(e.position.x, -BAND.edge - 1.5, BAND.edge + 1.5);
    if (mode !== 'enter') e.position.z = clamp(e.position.z, BAND.near - 1.5, BAND.far + 1.5);
    e.position.y = heightAt(e.position.x, e.position.z);
    if (cfg.evade === 'aim') {
      dodgeSet = committed() ? Math.max(cd, 0.3) : cd;
      e.dodgeLeft = dodgeSet;
    }
    return true;
  }

  function runMode(e: Enemy, p: ReturnType<BossCtx['player']>, dt: number): void {
    const busy = mode === 'windup' || mode === 'follow' || mode === 'roll' || mode === 'enter';
    if (!busy) rest -= dt;
    // los pasos al azar (versión sin esquiva): ni apuntando ni rodando
    if (cfg.evade === 'random' && (mode === 'idle' || (mode === 'move' && !goal.thenThrow))) {
      stepTimer -= dt;
      if (stepTimer <= 0) {
        stepTimer = rand(rng, STEPS.every);
        // para el lado del medio si está cerca de un borde
        const side = Math.abs(e.position.x) > 7 ? -Math.sign(e.position.x) : rng() < 0.5 ? 1 : -1;
        const dist = rand(rng, STEPS.dist);
        if (rng() < STEPS.roll) startRoll(e, side, (rng() * 2 - 1) * 0.3, dist);
        else moveTo(e.position.x + side * dist, e.position.z + (rng() * 2 - 1), null);
      }
    }
    switch (mode) {
      case 'enter': {
        if (e.walkToward(goal.x, goal.z, RUN, dt, true, 0.4)) {
          mode = 'idle';
          rest = 1;
        }
        break;
      }
      case 'idle': {
        e.animator.setLocomotion('Idle', 1);
        e.faceToward(p.position.x, TEE_Z, dt, 5);
        if (rest <= 0) tryThrow(e);
        break;
      }
      case 'move': {
        const dx = goal.x - e.position.x;
        const dz = goal.z - e.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.2) {
          mode = 'idle';
          if (goal.thenThrow && rest <= 0.5 && !startWindup(e, goal.thenThrow, false, goal.tx)) rest = 0.3;
          break;
        }
        const v = STRAFE * (e.chilled ? ELEMENTS.chillSlow : 1);
        const step = Math.min(v * dt, dist);
        e.position.x += (dx / dist) * step;
        e.position.z += (dz / dist) * step;
        // de costado, mirando al golfista: el clip según para qué lado de él va
        e.faceToward(p.position.x, TEE_Z, dt, 5);
        const left = (dx * Math.cos(e.heading) - dz * Math.sin(e.heading)) > 0;
        e.animator.setLocomotion(left ? 'Strafe Left' : 'Strafe Right', v / ((left ? STRAFE_CLIP.left : STRAFE_CLIP.right) * scale));
        break;
      }
      case 'windup': {
        if (!aim) {
          mode = 'idle';
          break;
        }
        aim.t += dt;
        const u = Math.min(1, aim.t / aim.time);
        e.animator.setLocomotion('Idle', 1);
        e.faceToward(aim.plan.ex, aim.plan.ez, dt, 10);
        e.scriptGesture = 1;
        e.scriptSwing = u * 0.999;
        // el carril late cada vez más rápido y más fuerte hasta que suelta
        const beat = 0.5 + 0.5 * Math.sin(aim.t * (8 + 14 * u));
        aim.lane.opacity(0.18 + 0.3 * u + 0.12 * beat);
        aim.ring.opacity(0.3 + 0.35 * beat).size(1.1 + 0.25 * beat);
        if (u >= 1) {
          throwSpear(aim.plan, aim.lane, aim.ring);
          aim = null;
          mode = 'follow';
          followT = 0;
          pendingDouble = rng() < PHASES[phase].double;
        }
        break;
      }
      case 'follow': {
        followT += dt;
        e.scriptGesture = 1;
        e.scriptSwing = 1 + 0.25 * Math.min(1, followT / FOLLOW);
        if (followT < FOLLOW) break;
        mode = 'idle';
        rest = PHASES[phase].rest / hurry();
        if (pendingDouble) {
          pendingDouble = false;
          // el segundo, al otro (si tira a los dos); si no está limpio, no hay segundo
          const other: Kind = cfg.atPlayer && lastKind === 'gate' ? 'player' : 'gate';
          if (startWindup(e, other, true)) break;
        }
        if (cfg.evade === 'aim' && rng() < RELOCATE) moveTo(e.position.x + (rng() * 2 - 1) * 5, rand(rng, [BAND.near, BAND.far]), null);
        break;
      }
      case 'roll': {
        roll.t += dt;
        const u = Math.min(1, roll.t / ROLL.time);
        // sale rápido y frena: a la pelota que viene la tiene que esquivar enseguida
        const d = roll.dist * (1 - (1 - u) ** 3);
        e.position.x += roll.dx * (d - roll.done);
        e.position.z += roll.dz * (d - roll.done);
        roll.done = d;
        e.faceToward(e.position.x + roll.dx, e.position.z + roll.dz, dt, 30);
        if (u >= 1) mode = e.position.z > BAND.far + 2 ? 'enter' : 'idle';
        break;
      }
    }
  }

  // ---- las lanzas ----

  function throwSpear(plan: Plan, laneMark: LaneMark, ring: GroundMark): void {
    if (ctx.over()) {
      laneMark.dispose();
      ring.dispose();
      return;
    }
    const len = Math.hypot(plan.ex - plan.ox, plan.ez - plan.oz) || 1;
    const view = spearView(COLORS[plan.kind]);
    ctx.scene.add(view.root);
    const s: Spear = {
      kind: plan.kind, x: plan.ox, z: plan.oz, dx: (plan.ex - plan.ox) / len, dz: (plan.ez - plan.oz) / len, speed: spearSpeed(),
      plan, y0: BODY.height * 0.8, traveled: 0, state: 'fly', part: null, view, lane: laneMark.opacity(0.42), ring, timer: 0, parryQ: 0, damage: 0,
    };
    spears.push(s);
    stats.lanzas++;
    ctx.audio.bossThrow();
    if (!hinted) {
      hinted = true;
      ctx.feedback(hint);
    }
    drawSpear(s);
  }

  /** La parte que le pegan las pelotas: aparece cuando la lanza ya se separó del cuerpo (si no, se empujan). */
  function addPart(s: Spear): void {
    const script: EnemyScript = {
      update(e) {
        e.knock.set(0, 0, 0);
        e.position.set(s.x, heightAt(s.x, s.z), s.z);
        e.heading = Math.atan2(s.dx, s.dz);
        // ni vida, ni barritas, ni la sombra redonda: lo que se ve es la lanza
        for (const c of e.group.children) {
          if ((c as THREE.Sprite).isSprite || (c as THREE.Mesh).material === shadowMat) c.visible = false;
        }
        return true;
      },
      filter(e, amount, shot) {
        // con la atajada, la pelota que la toca cerca de la línea la devuelve en vez de romperla
        if (cfg.parry && shot && !shot.ability && s.z - TEE_Z < PARRY.reach + 1) {
          s.parryQ = Math.max(1, shot.quality);
          return 0;
        }
        return amount > 0 ? Math.max(amount, e.hp) : 0;
      },
      onDeath(e) {
        stats.derribadas++;
        shatter(s);
        e.remove();
      },
    };
    const part = horde.spawnCustom(
      partStats('lizardman', { name: L('Lanza', 'Spear'), hp: 1, height: SPEAR.height, radius: SPEAR.radius, speed: s.speed, runs: true, boss: true, heavy: false, score: 5 }),
      SPEAR_LOOK, s.x, s.z, {}, script,
    );
    s.part = part;
    parts.add(part);
  }

  function dropPart(s: Spear): void {
    if (s.part) {
      if (s.part.alive) s.part.remove();
      parts.delete(s.part);
      s.part = null;
    }
  }

  function dropMarks(s: Spear): void {
    s.lane?.dispose();
    s.ring?.dispose();
    s.lane = null;
    s.ring = null;
  }

  /** Se rompe en el aire (la bajaron, se clavó en el golfista o en uno de la horda, o cayó el lagarto). */
  function shatter(s: Spear): void {
    if (s.state === 'gone') return;
    ctx.effects.explosion(new THREE.Vector3(s.x, heightAt(s.x, s.z) + SPEAR.y, s.z), 1, 0x9a7a52);
    finish(s);
  }

  function finish(s: Spear): void {
    s.state = 'gone';
    dropPart(s);
    dropMarks(s);
    disposeObject(ctx.scene, s.view.root);
  }

  /** La devolvió: vuelve dorada hacia él. */
  function parry(s: Spear, q: number): void {
    dropPart(s);
    dropMarks(s);
    s.state = 'back';
    s.speed = PARRY.speed;
    s.damage = PARRY.damage[clamp(q, 1, PARRY.damage.length) - 1];
    s.view.trailMat.color.setHex(COLORS.back);
    stats.devueltas++;
    ctx.feedback(L('¡Devuelta!', 'Batted back!'));
    ctx.audio.ricochet();
    ctx.effects.spark(new THREE.Vector3(s.x, heightAt(s.x, s.z) + SPEAR.y, s.z), COLORS.back);
  }

  function drawSpear(s: Spear): void {
    const v = s.view;
    v.root.position.set(s.x, heightAt(s.x, s.z), s.z);
    v.root.rotation.y = Math.atan2(s.dx, s.dz);
    const u = Math.min(1, s.traveled / SPEAR.drop);
    v.inner.position.y = s.state === 'back' ? SPEAR.y + 0.8 * u : s.y0 + (SPEAR.y - s.y0) * u;
  }

  /** La x del carril de `s` a la altura `z`. */
  const xAt = (s: Spear, z: number) => s.plan.ox + ((s.plan.ex - s.plan.ox) * (s.plan.oz - z)) / (s.plan.oz - s.plan.ez);

  function updateSpear(s: Spear, dt: number): void {
    const p = ctx.player();
    if (s.state === 'stuck') {
      s.timer -= dt;
      s.view.trailMat.opacity = Math.max(0, s.timer / SPEAR.stuck) * 0.8;
      if (s.timer <= 0) finish(s);
      return;
    }
    if (s.state === 'back') {
      // derecho a él, aunque se mueva
      const tx = body.position.x;
      const tz = body.position.z;
      const dx = tx - s.x;
      const dz = tz - s.z;
      const dist = Math.hypot(dx, dz);
      if (!body.alive) {
        shatter(s);
        return;
      }
      if (dist < body.radius + 0.6) {
        horde.damage(body, s.damage, new THREE.Vector3(dx / dist, 0, dz / dist), 2);
        ctx.effects.explosion(new THREE.Vector3(tx, body.position.y + BODY.height * 0.55, tz), 1.4, COLORS.back);
        finish(s);
        return;
      }
      s.dx = dx / dist;
      s.dz = dz / dist;
      const step = Math.min(dist, s.speed * dt);
      s.x += s.dx * step;
      s.z += s.dz * step;
      s.traveled += step;
      drawSpear(s);
      return;
    }
    // la devolvió una pelota (ver el filtro de la parte)
    if (s.parryQ > 0) {
      parry(s, s.parryQ);
      return;
    }
    const prevZ = s.z;
    const step = s.speed * dt;
    s.x += s.dx * step;
    s.z += s.dz * step;
    s.traveled += step;
    const over = ctx.over();

    if (s.state === 'fly') {
      if (!s.part && cfg.shoot && Math.hypot(s.x - body.position.x, s.z - body.position.z) > body.radius + SPEAR.radius + 0.3) addPart(s);
      // uno de la horda que se le cruza: se clava en él
      for (const e of horde.enemies) {
        if (!e.alive || e.passed || e.script) continue;
        if (Math.hypot(e.position.x - s.x, e.position.z - s.z) > e.radius + SPEAR.radius * 0.6) continue;
        horde.damage(e, SPEAR.ally, new THREE.Vector3(s.dx, 0, s.dz), 4);
        stats.aliados++;
        shatter(s);
        return;
      }
      // la atajada: el golpe a la pelota desde su carril, justo cuando llega
      const ahead = s.z - TEE_Z;
      if (cfg.parry && swing && ctx.clock() - swing.at <= PARRY.after && ahead <= PARRY.reach && ahead >= -0.8 && Math.abs(s.plan.cx - swing.x) < PARRY.width) {
        parry(s, swing.q);
        return;
      }
      // el golfista en el carril: le pega (en el respiro de invulnerable pasa de largo)
      const pz = p.position.z;
      if (prevZ > pz && s.z <= pz && Math.abs(xAt(s, pz) - p.position.x) < SPEAR.reachPlayer && p.alive && !p.invulnerable && !over) {
        ctx.hitPlayer(SPEAR.player, new THREE.Vector3(s.x, SPEAR.y, s.z), body);
        stats.aVos++;
        shatter(s);
        return;
      }
      // pasó la línea: ya nadie la toca, sigue a la muralla
      if (s.z < TEE_Z - 1.2) {
        s.state = 'past';
        dropPart(s);
        s.ring?.dispose();
        s.ring = null;
      }
    }
    if (s.z <= SPEAR.wallZ) {
      s.z = SPEAR.wallZ;
      if (!over) {
        ctx.hitGate(SPEAR.gate, body);
        stats.aPuerta++;
      }
      ctx.effects.explosion(new THREE.Vector3(s.x, heightAt(s.x, s.z) + SPEAR.y, s.z), 0.9, 0x9a7a52);
      dropMarks(s);
      s.state = 'stuck';
      s.timer = SPEAR.stuck;
    }
    drawSpear(s);
    // el carril, de la lanza a la muralla; el anillo de la línea late mientras viene
    s.lane?.between(s.x, s.z, s.plan.ex, s.plan.ez);
    if (s.ring) {
      const near = clamp(1 - (s.z - TEE_Z) / 25, 0, 1);
      s.ring.opacity(0.35 + 0.35 * near * (0.5 + 0.5 * Math.sin(ctx.clock() * 18)));
    }
  }

  /** El golpe a la pelota (no las habilidades): una pelota nueva que sale de la línea de los puestos. */
  function watchSwings(): void {
    for (const b of ctx.balls.list) {
      if (seen.has(b)) continue;
      seen.add(b);
      if (b.ability || Math.abs(b.from.z - TEE_Z) > 0.6) continue;
      swing = { at: ctx.clock(), x: b.from.x, q: b.quality };
    }
  }

  return {
    get done() {
      return !body.alive;
    },
    update(dt) {
      if (cfg.parry) watchSwings();
      for (const s of spears) {
        if (s.state === 'gone') continue;
        if (ctx.over() && (s.state === 'fly' || s.state === 'back')) {
          shatter(s);
          continue;
        }
        updateSpear(s, dt);
      }
      for (let i = spears.length - 1; i >= 0; i--) if (spears[i].state === 'gone') spears.splice(i, 1);
    },
    bot: {
      // por dónde va a cruzar la línea una lanza (o la que está apuntando), y cuándo
      danger(x, within) {
        const reach = SPEAR.reachPlayer + 1;
        for (const s of spears) {
          if (s.state !== 'fly' || s.dz >= 0) continue;
          const t = (s.z - TEE_Z) / (s.speed * -s.dz);
          if (t < within + 0.3 && Math.abs(s.plan.cx - x) < reach) return true;
        }
        if (aim && mode === 'windup') {
          const p = aim.plan;
          const dz = Math.abs(p.oz - p.ez) / Math.hypot(p.ex - p.ox, p.ez - p.oz);
          const t = aim.time - aim.t + (p.oz - TEE_Z) / (spearSpeed() * dz);
          if (t < within + 0.3 && Math.abs(p.cx - x) < reach) return true;
        }
        return false;
      },
      // las lanzas apuran más que él (ya pesan como jefe): si no se las baja, es vida perdida
      weight(e) {
        return parts.has(e) ? 2 : 1;
      },
    },
    log: () => ({ vida: Math.max(0, body.hp), fase: phase + 1, ...stats }),
    dispose() {
      clearAim();
      for (const s of spears) {
        dropMarks(s);
        disposeObject(ctx.scene, s.view.root);
      }
      spears.length = 0;
    },
  };
}
