// La araña reina (14/10): el jefe del espacio en la línea. Ver docs/jefes/arana.md.
//
// Anda de costado a media cancha (nunca va a la puerta) y, cuando frena, hace una de dos cosas: le escupe
// una telaraña al puesto donde estás (la marca blanca en el piso avisa; si te agarra quedás pegado unos
// segundos), o pone huevos que, si no se rompen a tiempo, largan arañitas que corren a la puerta. La
// telaraña que cae en un puesto vacío se queda ahí: según la versión es una trampa (el que pasa queda
// pegado) o una pared (no se cruza). Se rompe de un pelotazo de costado, con fuego o con el palazo, y se
// deshace sola. Las versiones (index.ts) cambian dónde van los huevos y qué hace la telaraña.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript, Horde } from '../../enemies';
import { GroundMark, SPAWN_Z, TEE_Z, arcPoint, fieldHalfAt, heightAt, partStats } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { SILK, cocoonLook, disposeLook, eggLook, silkBall, threadMesh, trapLook, wallLook } from './looks';

export interface Variant {
  /** Los huevos: a los costados (se planta y los larga a los flancos), adelante (los tira hacia la línea) o los dos. */
  eggs: 'costados' | 'adelante' | 'ambos';
  /** La telaraña que queda en un puesto: trampa (el que pasa queda pegado) o pared (no se cruza). */
  webs: 'pega' | 'traba';
  /** Algunas arañitas frenan a media cancha y te tiran su telaraña. */
  weavers: boolean;
}

// ---- la reina ----
/** Vida, sin la de más que da la dificultad (el gólem de siempre tiene 80, pero no se mueve). */
const QUEEN_HP = 70;
/** Alto y radio: con las patas abiertas mide unos 4.6 m de punta a punta. */
const QUEEN_HEIGHT = 2.0;
const QUEEN_RADIUS = 1.8;
/** Teñida de violeta oscuro: que no se confunda con las arañitas. */
const QUEEN_TINT = 0x8d76b8;
/** Entra caminando hasta acá, desde el fondo. */
const ENTER_Z = 42;
const WALK_SPEED = 3;
/** Las corridas de costado: velocidad (m/s), cuánto se corre (m) y la pausa entre una y otra (s). */
const SKITTER_SPEED = 5.5;
const SKITTER: [number, number] = [5, 12];
const PAUSE: [number, number] = [0.9, 1.6];
/** La franja de la cancha donde anda, por fase: [lo más cerca de la línea, lo más lejos]. Se acerca a medida que se enoja. */
const BAND: [number, number][] = [[32, 44], [27, 41], [22, 38]];
/** Lo que se deja libre contra cada costado. */
const EDGE = 3;
/** Las fases: con menos de 2/3 de la vida pasa a la segunda, con menos de 1/3 a la tercera. */
const PHASE_AT = [2 / 3, 1 / 3];
/** Al cambiar de fase se va al fondo a poner una nidada más grande. */
const RETREAT_Z = 50;
/** La presión sube sola: cada RAGE_EVERY s de pelea, todo lo que espera se acorta un RAGE_STEP (hasta RAGE_MAX veces). */
const RAGE_EVERY = 40;
const RAGE_STEP = 0.9;
const RAGE_MAX = 4;
/** Cuánto se acorta por nivel de dificultad (0 a 10). */
const LEVEL_STEP = 0.015;
/** Cuánto se para de manos para tirar los huevos hacia adelante (rad). */
const REAR = 0.32;

// ---- la telaraña ----
/** Cada cuánto escupe (s), por fase. La primera, al rato de llegar. */
const WEB_EVERY = [6.5, 5.5, 4.5];
const FIRST_WEB = 2.5;
/** Cuántos puestos agarra cada escupida, por fase: el tuyo, y después también los de al lado. */
const WEB_COUNT: Record<Variant['webs'], number[]> = { pega: [1, 2, 3], traba: [1, 1, 2] };
/** Se prepara (la marca ya está en el piso) y vuela: casi 2 s de aviso, y moverse un puesto lleva 0.4. */
const WEB_WINDUP = 0.8;
const WEB_FLIGHT = 1.1;
const WEB_ARC = 6;
/** Te agarra si cuando cae tu puesto está a menos de esto (m) del suyo. */
const WEB_CATCH = 1.5;
/** Pegado (s): si te cae encima, o si pisás la trampa. */
const PIN_HIT = 2.5;
const PIN_TRAP = 1.5;
/** La trampa salta si pasás a menos de esto (m) del puesto. */
const TRAP_REACH = 1.3;
/** Cuánto dura la que quedó en un puesto (s), y la vida que tiene (el putter la rompe con cualquier golpe). */
const WEB_LIFE: Record<Variant['webs'], number> = { pega: 14, traba: 10 };
const WEB_HP = 2;
/** Trampas a la vez (con una más, se deshace la más vieja). */
const MAX_TRAPS = 4;
/** Paredes a la vez, y cuántos puestos con pelota te tienen que quedar del lado donde estás. */
const MAX_WALLS = 2;
const MIN_BALL_SPOTS = 2;
/** Un empujón así (el palazo, el viento) la rompe. */
const TEAR_KNOCK = 15;
/** La telaraña en el puesto va un poquito adelante de la pelota. */
const WEB_Z = 0.4;

// ---- los huevos ----
/** Cada cuánto pone (s) y cuántos, por fase. */
const EGG_EVERY = [9, 8, 7];
const FIRST_EGG = 5;
const EGG_COUNT = [2, 3, 3];
/** Cuánto tardan en nacer (s), por fase. Los tirados adelante, más: de ahí las arañitas llegan enseguida. */
const HATCH: Record<'costados' | 'adelante', number[]> = { costados: [8, 7, 6], adelante: [9.5, 8.5, 7.5] };
const EGG_HP = 2;
/** Arañitas por huevo, por fase. */
const BROOD = [2, 3, 3];
/** Plantada poniendo (s), y en qué momento salen. */
const LAY_TIME = 1.1;
const LAY_AT = 0.75;
/** A los costados: a qué distancia de ella caen (m) y cuánto tardan en deslizarse hasta ahí. */
const SIDE_REACH: [number, number] = [2.8, 6];
const SLIDE_TIME = 0.5;
/** Adelante: dónde caen (z) y cuánto vuelan. */
const LOB_Z: [number, number] = [15, 24];
const LOB_FLIGHT = 1.3;
const LOB_ARC = 7;
/** Huevos a la vez, como mucho (si no, la pelea se vuelve un tiro al blanco sin fin). */
const MAX_EGGS = 9;

// ---- las arañitas ----
/** Como un goblin: 1 de vida, rápidas. */
const BABY = { height: 0.55, radius: 0.45, hp: 1, speed: 4.6 };
/** La tejedora (en la versión que las trae): una de cada `every` frena en `atZ` y te tira su telaraña. */
const WEAVER = { height: 0.8, radius: 0.55, hp: 2, speed: 3.8, every: 3, atZ: 21, windup: 0.7, flight: 0.9, tint: 0xd9d0ff };

/** Las nubecitas: la cáscara que se rompe, y la que larga arañitas. */
const EGG_COLOR = 0xe9dcbc;
const HATCH_COLOR = 0xd4dc8a;
/** Corre al menos esto (s) antes de frenar a escupir o poner: que se vea que se mueve. */
const MIN_MOVE = 0.6;

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp = THREE.MathUtils.clamp;

/** Las plantillas de las partes hechas por código: una vez por partida (sobreviven a la pelea). */
function registerLooks(horde: Horde): void {
  for (let i = 0; i < 3; i++) if (!horde.hasLook(`arana-huevo-${i}`)) horde.addLook(`arana-huevo-${i}`, eggLook(i + 1));
  if (!horde.hasLook('arana-trampa')) horde.addLook('arana-trampa', trapLook());
  if (!horde.hasLook('arana-pared')) horde.addLook('arana-pared', wallLook());
}

/** Le prende un brillo por encima del que pone el enemigo (que lo pisa en cada cuadro, antes del guion). */
function glow(mats: THREE.MeshStandardMaterial[], r: number, g: number, b: number): void {
  for (const m of mats) m.emissive.setRGB(r, g, b);
}

function materialsOf(e: Enemy, name?: string): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  e.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (name && m.name !== name)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.emissive) out.push(mat);
  });
  return out;
}

/** Una escupida: se prepara (`t` < 0, la marca ya está) y vuela del dueño al puesto. */
interface Spit {
  spot: number;
  owner: Enemy;
  t: number;
  windup: number;
  flight: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  ball: THREE.Mesh | null;
  thread: THREE.Mesh | null;
  mark: GroundMark;
  ring: GroundMark;
}

/** La telaraña que quedó en un puesto: una trampa o una pared, y un enemigo de verdad (se le pega). */
interface Web {
  spot: number;
  kind: 'trap' | 'wall';
  e: Enemy;
  life: number;
  mark: GroundMark;
}

interface Egg {
  e: Enemy;
  age: number;
  hatch: number;
  at: THREE.Vector3;
  /** Saliendo de la reina hacia el costado. */
  slide: { from: THREE.Vector3; t: number } | null;
  mats: THREE.MeshStandardMaterial[];
}

/** Un huevo tirado hacia adelante, en el aire (todavía no es un enemigo). */
interface Lob {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  mark: GroundMark;
  launched: boolean;
}

type Act = 'enter' | 'move' | 'pause' | 'spit' | 'lay' | 'lob' | 'retreat';

export function startArana(ctx: BossCtx, v: Variant): BossFight {
  const { horde, scene, effects, audio, tees, rng } = ctx;
  registerLooks(horde);
  const spots = ctx.spots();
  const spits: Spit[] = [];
  const webs: Web[] = [];
  const eggs: Egg[] = [];
  const lobs: Lob[] = [];
  const babies: Enemy[] = [];
  const weavers = new Set<Enemy>();
  const stats = { escupidas: 0, agarrado: 0, trampas: 0, huevos: 0, rotos: 0, nacidos: 0, aranitas: 0, telaranas: 0, rotas: 0, paredesNo: 0, tragadas: 0, zafadas: 0 };
  /** La pared que lo tiene agarrado (traba): se arma cuando se va del puesto. -1 si no. */
  let held = -1;
  const cocoon = cocoonLook();
  cocoon.visible = false;
  scene.add(cocoon);
  const cocoonMats: THREE.MeshBasicMaterial[] = [];
  cocoon.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) cocoonMats.push(m.material as THREE.MeshBasicMaterial);
  });
  let babyCount = 0;
  /**
   * Una nube blanca que se esfuma (la seda que cae, la que se rompe, el huevo que se parte): la explosión
   * del pulido tiene humo y cráter, y en el puesto del golfista parecía una bomba.
   */
  const puff = (pos: THREE.Vector3, size: number, color = SILK) => {
    if (effects.fx) effects.fx.poof(pos, size, color);
    else effects.spark(pos, color);
    effects.swipe(pos, size);
  };
  let toldWeb = false;
  let toldEggs = false;

  // ---- la reina: su guion ----
  let act: Act = 'enter';
  let actT = 0;
  const goal = new THREE.Vector3(0, 0, ENTER_Z);
  let webTimer = FIRST_WEB;
  let eggTimer = FIRST_EGG;
  let phase = 0;
  let lobTurn = false;
  let rear = 0;
  let layCount = 0;
  let layLob = false;
  const pendingLobs: Lob[] = [];
  let queenMats: THREE.MeshStandardMaterial[] = [];

  /** Todo lo que espera se acorta con el tiempo de pelea y con la dificultad. */
  const pace = () => Math.pow(RAGE_STEP, Math.min(RAGE_MAX, Math.floor(ctx.clock() / RAGE_EVERY))) * (1 - LEVEL_STEP * ctx.level);
  const forward = (e: Enemy) => new THREE.Vector3(Math.sin(e.heading), 0, Math.cos(e.heading));
  /** De dónde sale lo que escupe: la boca, adelante y arriba. */
  const mouth = (e: Enemy) => e.position.clone().addScaledVector(forward(e), e.radius * 0.7).setY(e.position.y + e.height * 0.55);
  const halfAt = (z: number) => fieldHalfAt(z) - EDGE;

  function pause(seconds: number): void {
    act = 'pause';
    actT = seconds;
  }

  function pickMove(e: Enemy): void {
    const [near, far] = BAND[phase];
    const half = halfAt(e.position.z);
    let dx = (SKITTER[0] + rng() * (SKITTER[1] - SKITTER[0])) * (rng() < 0.5 ? -1 : 1);
    if (Math.abs(e.position.x + dx) > half) dx = -dx;
    goal.set(clamp(e.position.x + dx, -half, half), 0, clamp(e.position.z + (rng() * 2 - 1) * 5, near, far));
    act = 'move';
    actT = 0;
  }

  /** Si le toca escupir o poner, lo hace (y devuelve true). */
  function attack(e: Enemy): boolean {
    if (ctx.over() || e.silenced) return false;
    if (webTimer <= 0) startSpitAct(e);
    else if (eggTimer <= 0 && eggs.length + lobs.length < MAX_EGGS) startEggAct(e);
    else return false;
    return true;
  }

  /** Escupe al puesto donde estás (y en las fases altas también a los de al lado). */
  function startSpitAct(e: Enemy): void {
    const p = ctx.player();
    const k = p.spotIndex;
    const n = WEB_COUNT[v.webs][phase];
    const targets = [k];
    if (n === 2) {
      // el de al lado adonde irías: el que tiene pelota, o el que va hacia el medio
      const side = tees.hasBall(k + 1) && !tees.hasBall(k - 1) ? 1 : tees.hasBall(k - 1) && !tees.hasBall(k + 1) ? -1 : k < tees.centerIndex ? 1 : -1;
      targets.push(k + side);
    } else if (n >= 3) targets.push(k - 1, k + 1);
    for (const t of targets) if (t >= 0 && t < spots.length) spit(t, e, WEB_WINDUP, WEB_FLIGHT);
    act = 'spit';
    actT = 0;
    webTimer = WEB_EVERY[phase] * pace();
    if (e.animator.has('Attack')) e.animator.playOneShot('Attack', (0.45 * e.animator.clipDuration('Attack')) / WEB_WINDUP);
    if (!toldWeb) {
      toldWeb = true;
      ctx.feedback(L('¡Telaraña! Salí de la marca', 'Web! Get off the mark'));
    }
  }

  function startEggAct(e: Enemy, extra = 0): void {
    const room = MAX_EGGS - eggs.length - lobs.length;
    if (room <= 0) {
      eggTimer = 2;
      pickMove(e);
      return;
    }
    layLob = v.eggs === 'adelante' || (v.eggs === 'ambos' && phase >= 1 && (lobTurn = !lobTurn));
    act = layLob ? 'lob' : 'lay';
    actT = 0;
    layCount = Math.min(EGG_COUNT[phase] + extra, room);
    eggTimer = EGG_EVERY[phase] * pace();
    if (layLob) {
      // adónde van a caer: se marca ya, para que se vea venir
      const xs: number[] = [];
      for (let i = 0; i < layCount; i++) {
        const z = LOB_Z[0] + rng() * (LOB_Z[1] - LOB_Z[0]);
        const half = fieldHalfAt(z) - 2;
        let x = 0;
        for (let tries = 0; tries < 12; tries++) {
          x = (rng() * 2 - 1) * half;
          if (xs.every((o) => Math.abs(o - x) > 4)) break;
        }
        xs.push(x);
        const to = new THREE.Vector3(x, heightAt(x, z), z);
        const mark = new GroundMark(scene, 0xe6cf5a, false, 1.1).at(x, z).opacity(0.2);
        pendingLobs.push({ mesh: eggLook(i + 1), from: new THREE.Vector3(), to, t: 0, mark, launched: false });
      }
    }
  }

  /** Larga los huevos: a los costados (deslizándose desde la panza) o tirados adelante. */
  function releaseEggs(e: Enemy): void {
    const f = forward(e);
    const right = new THREE.Vector3(f.z, 0, -f.x);
    const belly = e.position.clone().addScaledVector(f, -e.radius * 0.5);
    if (layLob) {
      for (const l of pendingLobs.splice(0)) {
        l.from.copy(belly).setY(e.position.y + e.height * 0.7);
        l.launched = true;
        l.mesh.position.copy(l.from);
        scene.add(l.mesh);
        lobs.push(l);
      }
      audio.whoosh(0.6);
    } else {
      const rows = Math.max(1, Math.ceil(layCount / 2) - 1);
      for (let i = 0; i < layCount; i++) {
        const side = i % 2 ? 1 : -1;
        const reach = SIDE_REACH[0] + (SIDE_REACH[1] - SIDE_REACH[0]) * (Math.floor(i / 2) / rows);
        const to = belly.clone().addScaledVector(right, side * reach).addScaledVector(f, -rng() * 1.5);
        to.x = clamp(to.x, -fieldHalfAt(to.z) + 1.5, fieldHalfAt(to.z) - 1.5);
        to.z = clamp(to.z, TEE_Z + 6, SPAWN_Z - 4);
        layEgg(to, HATCH.costados[phase], belly);
      }
    }
    if (!toldEggs) {
      toldEggs = true;
      ctx.feedback(L('¡Huevos! Rompelos antes de que nazcan', 'Eggs! Break them before they hatch'));
    }
  }

  const queenScript: EnemyScript = {
    update(e, dt) {
      // (aturdida, la maneja el código de siempre: si no, el aturdido no se le pasa nunca)
      if (e.stunned) return false;
      if (!queenMats.length) {
        queenMats = materialsOf(e);
        e.body.rotation.order = 'YXZ';
      }
      const p = ctx.player();
      // los relojes corren siempre (también mientras escupe o pone): el ritmo es el de WEB_EVERY y EGG_EVERY
      webTimer -= dt;
      eggTimer -= dt;
      // la fase sube con lo que le sacaste: se enoja, se va al fondo y pone una nidada más grande
      const ratio = e.hp / e.maxHp;
      const want = ratio < PHASE_AT[1] ? 2 : ratio < PHASE_AT[0] ? 1 : 0;
      if (want > phase && act !== 'enter') {
        phase = want;
        audio.growl();
        ctx.feedback(phase === 1 ? L('¡La reina se enfurece!', 'The queen is enraged!') : L('¡La reina, desesperada!', 'The queen is desperate!'));
        for (const l of pendingLobs.splice(0)) disposeLob(l);
        goal.set(clamp(e.position.x, -halfAt(RETREAT_Z), halfAt(RETREAT_Z)), 0, RETREAT_Z);
        act = 'retreat';
      }
      let rearTo = 0;
      let lit: [number, number, number] | null = null;
      switch (act) {
        case 'enter':
          if (e.walkToward(goal.x, goal.z, WALK_SPEED, dt, false, 0.5)) pause(0.5);
          break;
        case 'move':
          // si le toca, frena donde esté a escupir o poner
          if ((actT += dt) > MIN_MOVE && attack(e)) break;
          if (e.walkToward(goal.x, goal.z, SKITTER_SPEED, dt, true, 0.4)) pause(PAUSE[0] + rng() * (PAUSE[1] - PAUSE[0]));
          break;
        case 'retreat':
          if (e.walkToward(goal.x, goal.z, SKITTER_SPEED, dt, true, 0.5)) {
            if (ctx.over() || e.silenced) pause(0.5);
            else startEggAct(e, 1);
          }
          break;
        case 'pause':
          e.animator.setLocomotion('Idle', 1);
          e.faceToward(p.position.x, TEE_Z, dt, 4);
          if ((actT -= dt) > 0) break;
          if (!attack(e)) pickMove(e);
          break;
        case 'spit': {
          actT += dt;
          e.animator.setLocomotion('Idle', 1);
          const mine = spits.find((s) => s.owner === e);
          if (mine) e.faceToward(spots[mine.spot], TEE_Z, dt, 10);
          // se prepara: brilla blanca, más cuanto más cerca de escupir
          if (actT < WEB_WINDUP) lit = [0.55, 0.5, 0.8].map((c) => c * smooth(actT / WEB_WINDUP)) as [number, number, number];
          if (actT > WEB_WINDUP + 0.35) pause(0.35);
          break;
        }
        case 'lay':
        case 'lob': {
          actT += dt;
          e.animator.setLocomotion('Idle', 1.6);
          e.faceToward(p.position.x, TEE_Z, dt, 4);
          // silenciada o aturdida no pone: lo que tenía marcado se cancela
          if (e.silenced) {
            for (const l of pendingLobs.splice(0)) disposeLob(l);
            pickMove(e);
            break;
          }
          const pump = 0.5 + 0.5 * Math.sin(actT * 18);
          lit = [0.35 * pump, 0.42 * pump, 0.08 * pump];
          if (act === 'lob') rearTo = actT < LAY_AT ? REAR * smooth(actT / LAY_AT) : 0;
          if (actT >= LAY_AT && actT - dt < LAY_AT) releaseEggs(e);
          if (actT >= LAY_TIME) pause(0.4);
          break;
        }
      }
      rear += (rearTo - rear) * (1 - Math.exp(-(rearTo > rear ? 6 : 14) * dt));
      e.body.rotation.x = -rear;
      if (lit) glow(queenMats, ...lit);
      return true;
    },
    onDeath(e) {
      effects.explosion(e.position.clone().setY(e.position.y + 1), 3.2, QUEEN_TINT);
      e.body.rotation.x = 0;
      // con ella se van los huevos, las telarañas y lo que tenía en el aire
      for (const s of spits.splice(0)) disposeSpit(s);
      for (const l of [...lobs.splice(0), ...pendingLobs.splice(0)]) disposeLob(l);
      for (const egg of eggs) {
        puff(egg.e.position.clone().setY(0.6), 1.2, EGG_COLOR);
        egg.e.remove();
      }
      for (const w of webs) tear(w);
      const p = ctx.player();
      p.pinnedFor = 0;
      held = -1;
    },
  };

  const startX = (rng() * 2 - 1) * 6;
  goal.set(startX * 0.5, 0, ENTER_Z);
  const queen = horde.spawnCustom(
    partStats('spider', { name: L('Araña reina', 'Spider Queen'), height: QUEEN_HEIGHT, radius: QUEEN_RADIUS, hp: QUEEN_HP + ctx.bonusHp, speed: WALK_SPEED, heavy: true, boss: true, behavior: 'golem', tint: QUEEN_TINT, damage: 2, gateDamage: 2, score: 500 }),
    'spider', startX, SPAWN_Z - 2, {}, queenScript,
  );

  // ---- las escupidas ----

  function spit(spot: number, owner: Enemy, windup: number, flight: number): void {
    const x = spots[spot];
    const mark = new GroundMark(scene, SILK, true, 1.7).at(x, TEE_Z).opacity(0.15);
    const ring = new GroundMark(scene, SILK, false, 1.7).at(x, TEE_Z).opacity(0.6);
    spits.push({ spot, owner, t: -windup, windup, flight, from: new THREE.Vector3(), to: new THREE.Vector3(x, heightAt(x, TEE_Z) + 0.3, TEE_Z), ball: null, thread: null, mark, ring });
    stats.escupidas++;
  }

  function disposeSpit(s: Spit): void {
    s.mark.dispose();
    s.ring.dispose();
    if (s.ball) {
      scene.remove(s.ball);
      disposeLook(s.ball);
    }
    if (s.thread) {
      scene.remove(s.thread);
      disposeLook(s.thread);
    }
  }

  function updateSpits(dt: number): void {
    for (let i = spits.length - 1; i >= 0; i--) {
      const s = spits[i];
      s.t += dt;
      if (s.t < 0) {
        // preparándose: si al dueño lo matan o lo silencian, no sale
        if (!s.owner.alive || s.owner.silenced || ctx.over()) {
          disposeSpit(s);
          spits.splice(i, 1);
          continue;
        }
        s.mark.opacity(0.12 + 0.25 * clamp(1 + s.t / s.windup, 0, 1));
        continue;
      }
      if (!s.ball) {
        s.from.copy(mouth(s.owner));
        s.ball = silkBall();
        s.thread = threadMesh();
        scene.add(s.ball, s.thread);
        audio.casterCast();
      }
      const u = Math.min(1, s.t / s.flight);
      arcPoint(s.from, s.to, u, WEB_ARC * (s.flight / WEB_FLIGHT), s.ball.position);
      s.ball.rotation.x += dt * 9;
      // el hilo, de la boca al ovillo (si el dueño ya no está, desde donde salió)
      const root = s.owner.alive ? mouth(s.owner) : s.from;
      s.thread!.position.copy(root);
      s.thread!.lookAt(s.ball.position);
      s.thread!.scale.set(1, 1, Math.max(0.01, root.distanceTo(s.ball.position)));
      const beat = 0.5 + 0.5 * Math.sin(s.t * 16);
      s.mark.opacity(0.35 + 0.25 * u + 0.1 * beat);
      s.ring.size(1.7 * (1.15 - 0.15 * u));
      if (u < 1) continue;
      land(s);
      disposeSpit(s);
      spits.splice(i, 1);
    }
  }

  /** Cae la telaraña en el puesto: te agarra si estás ahí, y si no queda en el puesto. */
  function land(s: Spit): void {
    const k = s.spot;
    const x = spots[k];
    audio.casterHit();
    puff(new THREE.Vector3(x, 0.5, TEE_Z), 1.5);
    const p = ctx.player();
    const near = Math.abs(p.anchor.x - x);
    if (p.alive && !ctx.over() && (near < WEB_CATCH || (p.spotIndex === k && near < 4.1))) {
      catchPlayer(k, PIN_HIT);
      ctx.feedback(L('¡Te agarró la telaraña!', 'Caught in the web!'));
      if (v.webs === 'traba') held = k;
      return;
    }
    placeWeb(k);
  }

  function catchPlayer(k: number, seconds: number): void {
    const p = ctx.player();
    p.pin(seconds);
    // si se estaba yendo, la telaraña lo trae de vuelta a su puesto
    p.spotIndex = k;
    stats.agarrado++;
  }

  // ---- las telarañas en los puestos ----

  /** ¿Se puede armar una pared en `k`? Del lado donde estás te tienen que quedar puestos con pelota. */
  function canWall(k: number): boolean {
    const walls = new Set(webs.filter((w) => w.kind === 'wall' && w.e.alive).map((w) => w.spot));
    if (walls.size >= MAX_WALLS) return false;
    walls.add(k);
    return ballSpots(walls) >= MIN_BALL_SPOTS;
  }

  /** Cuántos puestos adonde tiran pelotas le quedan al golfista de su lado, con estas paredes. */
  function ballSpots(walls: Set<number>): number {
    const at = ctx.player().spotIndex;
    let n = 0;
    for (let i = at; i >= 0 && (i === at || !walls.has(i)); i--) if (tees.spots[i].spawns && !walls.has(i)) n++;
    for (let i = at + 1; i < spots.length && !walls.has(i); i++) if (tees.spots[i].spawns) n++;
    return n;
  }

  function placeWeb(k: number): void {
    const old = webs.find((w) => w.spot === k && w.e.alive);
    if (old) {
      old.life = WEB_LIFE[v.webs];
      return;
    }
    const wall = v.webs === 'traba';
    if (wall && !canWall(k)) {
      // no te encierra: se deshace al caer
      stats.paredesNo++;
      return;
    }
    const traps = webs.filter((w) => w.kind === 'trap' && w.e.alive);
    if (!wall && traps.length >= MAX_TRAPS) tear(traps.reduce((a, b) => (a.life < b.life ? a : b)));
    const x = spots[k];
    const rec = {} as Web;
    const script: EnemyScript = {
      update(e) {
        if (e.stunned) return false;
        // el fuego la quema y un empujón fuerte (el palazo, el viento) la rompe
        if (e.burning || e.knock.lengthSq() > TEAR_KNOCK * TEAR_KNOCK) {
          tear(rec);
          return true;
        }
        e.knock.set(0, 0, 0);
        e.position.set(x, heightAt(x, TEE_Z + WEB_Z), TEE_Z + WEB_Z);
        // titila cuando se está por deshacer
        const fade = rec.life < 2 ? 0.5 + 0.5 * Math.sin(rec.life * 20) : 1;
        glow(mats, 0.5 * fade, 0.5 * fade, 0.6 * fade);
        return true;
      },
      onDeath(e) {
        puff(e.position.clone().setY(0.8), 1.4);
        stats.rotas++;
        e.remove();
      },
    };
    const e = horde.spawnCustom(
      partStats('spider', { name: L('Telaraña', 'Web'), height: wall ? 2.7 : 1.2, radius: wall ? 1.3 : 1.15, hp: WEB_HP, speed: 0, runs: false, heavy: true, behavior: 'golem', tint: 0, score: 5 }),
      wall ? 'arana-pared' : 'arana-trampa', x, TEE_Z + WEB_Z, {}, script,
    );
    const mats = materialsOf(e);
    Object.assign(rec, { spot: k, kind: wall ? 'wall' : 'trap', e, life: WEB_LIFE[v.webs], mark: new GroundMark(scene, 0xb9a6ff, false, 1.8).at(x, TEE_Z).opacity(0.55) });
    webs.push(rec);
    stats.telaranas++;
  }

  /** Se rompe (o se deshace) una telaraña del puesto. */
  function tear(w: Web): void {
    if (!w.e.alive) return;
    puff(w.e.position.clone().setY(0.8), 1.3);
    w.e.remove();
  }

  function updateWebs(dt: number): void {
    const p = ctx.player();
    // el palazo te zafa
    if (p.mode === 'melee' && (p.pinnedFor > 0 || held >= 0)) {
      p.pinnedFor = 0;
      held = -1;
      stats.zafadas++;
      puff(p.position.clone().setY(0.8), 1.4);
      ctx.feedback(L('¡Te zafaste!', 'Broke free!'));
    }
    // traba: la que te agarró queda como pared cuando te vas
    if (held >= 0 && p.spotIndex !== held && Math.abs(p.anchor.x - spots[held]) > 1.6) {
      const k = held;
      held = -1;
      placeWeb(k);
    }
    for (let i = webs.length - 1; i >= 0; i--) {
      const w = webs[i];
      if (w.e.alive && (w.life -= dt) <= 0) tear(w);
      if (w.e.alive && w.kind === 'trap' && p.alive && p.pinnedFor <= 0 && Math.abs(p.anchor.x - spots[w.spot]) < TRAP_REACH) {
        // pisó la trampa: queda pegado, y la trampa se gasta
        catchPlayer(w.spot, PIN_TRAP);
        stats.trampas++;
        ctx.feedback(L('¡Pisaste la telaraña!', 'Stepped in the web!'));
        tear(w);
      }
      // la pared se traga la pelota que le cae (si no, las pelotas quedan del otro lado y no vienen más)
      if (w.e.alive && w.kind === 'wall' && tees.hasBall(w.spot)) {
        tees.take(w.spot);
        stats.tragadas++;
        puff(new THREE.Vector3(spots[w.spot], 0.4, TEE_Z), 0.8);
      }
      if (w.e.alive) {
        w.mark.opacity(w.life < 2 ? 0.25 + 0.25 * Math.sin(w.life * 20) : 0.55);
        continue;
      }
      w.mark.dispose();
      webs.splice(i, 1);
    }
    // el capullo, mientras está pegado
    const stuck = p.pinnedFor > 0 || held >= 0;
    cocoon.visible = stuck && p.alive;
    if (cocoon.visible) {
      cocoon.position.set(p.position.x, heightAt(p.position.x, p.position.z), p.position.z);
      const a = p.pinnedFor > 0 ? clamp(p.pinnedFor / 0.6, 0.25, 1) * 0.9 : 0.35;
      for (const m of cocoonMats) m.opacity = a;
    }
  }

  // ---- los huevos ----

  function layEgg(to: THREE.Vector3, hatch: number, from?: THREE.Vector3): void {
    const rec: Egg = { e: null as unknown as Enemy, age: 0, hatch, at: to.clone(), slide: from ? { from: from.clone(), t: 0 } : null, mats: [] };
    const script: EnemyScript = {
      update(e, dt) {
        if (e.stunned) return false;
        e.knock.set(0, 0, 0);
        if (rec.slide) {
          rec.slide.t += dt / SLIDE_TIME;
          const u = Math.min(1, rec.slide.t);
          arcPoint(rec.slide.from, rec.at, smooth(u), 0.9, e.position);
          if (u >= 1) rec.slide = null;
        } else e.position.set(rec.at.x, heightAt(rec.at.x, rec.at.z), rec.at.z);
        // late cada vez más rápido y brilla más fuerte a medida que se acerca la hora; al final tiembla
        const u = clamp(rec.age / rec.hatch, 0, 1);
        const beat = 0.5 + 0.5 * Math.sin(rec.age * (3 + 16 * u * u));
        glow(rec.mats, (0.12 + 0.6 * u) * beat, (0.1 + 0.5 * u) * beat, 0.02);
        const shake = u > 0.75 ? Math.sin(rec.age * 40) * 0.12 * (u - 0.75) * 4 : 0;
        e.body.rotation.z = shake;
        return true;
      },
      onDeath(e) {
        puff(e.position.clone().setY(0.6), 1.2, EGG_COLOR);
        stats.rotos++;
        e.remove();
      },
    };
    const e = horde.spawnCustom(
      partStats('spider', { name: L('Huevo', 'Egg'), height: 1.1, radius: 0.6, hp: EGG_HP, speed: 0, runs: false, heavy: true, behavior: 'golem', tint: 0, score: 15 }),
      `arana-huevo-${stats.huevos % 3}`, (from ?? to).x, (from ?? to).z, {}, script,
    );
    rec.e = e;
    rec.mats = materialsOf(e, 'shell');
    eggs.push(rec);
    stats.huevos++;
  }

  function hatch(egg: Egg): void {
    const at = egg.e.position.clone();
    egg.e.remove();
    puff(at.clone().setY(0.6), 1.8, HATCH_COLOR);
    audio.bubblePop();
    stats.nacidos++;
    const n = BROOD[phase];
    const a0 = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const weaver = v.weavers && ++babyCount % WEAVER.every === 0;
      const b = weaver ? spawnWeaver(at.x + dir.x * 0.6, at.z + dir.z * 0.6) : horde.spawnCustom(
        partStats('spider', { name: L('Arañita', 'Spiderling'), height: BABY.height, radius: BABY.radius, hp: BABY.hp, speed: BABY.speed, damage: 1, gateDamage: 1, score: 8 }),
        'spider', at.x + dir.x * 0.6, at.z + dir.z * 0.6,
      );
      // salen disparadas del huevo, para los costados
      b.knock.set(dir.x * 6, 0, dir.z * 6);
      babies.push(b);
      stats.aranitas++;
    }
  }

  /** La tejedora: corre como las demás, pero frena una vez a media cancha y te escupe su telaraña. */
  function spawnWeaver(x: number, z: number): Enemy {
    let t = 0;
    let done = false;
    let target = -1;
    const script: EnemyScript = {
      update(e, dt) {
        if (done || e.stunned || e.position.z > WEAVER.atZ) return false;
        if (ctx.over()) {
          done = true;
          return false;
        }
        if (t === 0) {
          target = ctx.player().spotIndex;
          spit(target, e, WEAVER.windup, WEAVER.flight);
          if (e.animator.has('Attack')) e.animator.playOneShot('Attack', (0.45 * e.animator.clipDuration('Attack')) / WEAVER.windup);
        }
        t += dt;
        e.animator.setLocomotion('Idle', 1);
        e.faceToward(spots[target], TEE_Z, dt, 10);
        if (t > WEAVER.windup + 0.3) done = true;
        return true;
      },
    };
    const e = horde.spawnCustom(
      partStats('spider', { name: L('Tejedora', 'Weaver'), height: WEAVER.height, radius: WEAVER.radius, hp: WEAVER.hp, speed: WEAVER.speed, tint: WEAVER.tint, damage: 1, gateDamage: 1, score: 12 }),
      'spider', x, z, {}, script,
    );
    weavers.add(e);
    return e;
  }

  function disposeLob(l: Lob): void {
    l.mark.dispose();
    if (l.launched) scene.remove(l.mesh);
    disposeLook(l.mesh);
  }

  function updateEggs(dt: number): void {
    for (let i = eggs.length - 1; i >= 0; i--) {
      const egg = eggs[i];
      if (!egg.e.alive) {
        eggs.splice(i, 1);
        continue;
      }
      // congelado no avanza, y con frío va a la mitad
      if (!egg.slide) egg.age += egg.e.frozen ? 0 : egg.e.chilled ? dt * 0.5 : dt;
      if (egg.age >= egg.hatch && !ctx.over()) {
        hatch(egg);
        eggs.splice(i, 1);
      }
    }
    for (let i = lobs.length - 1; i >= 0; i--) {
      const l = lobs[i];
      l.t += dt / LOB_FLIGHT;
      const u = Math.min(1, l.t);
      arcPoint(l.from, l.to, u, LOB_ARC, l.mesh.position);
      l.mesh.rotation.x += dt * 5;
      l.mark.opacity(0.25 + 0.4 * u);
      if (u < 1) continue;
      puff(l.to.clone().setY(0.4), 1.0, EGG_COLOR);
      audio.bounce();
      layEgg(l.to, HATCH.adelante[phase]);
      disposeLob(l);
      lobs.splice(i, 1);
    }
    for (const l of pendingLobs) l.mark.opacity(0.2 + 0.15 * Math.sin(ctx.clock() * 12));
    for (let i = babies.length - 1; i >= 0; i--) if (!babies[i].alive) babies.splice(i, 1);
  }

  return {
    get done() {
      return !queen.alive;
    },
    update(dt) {
      updateSpits(dt);
      updateWebs(dt);
      updateEggs(dt);
    },
    blocks(from, to) {
      return v.webs === 'traba' && webs.some((w) => w.kind === 'wall' && w.spot === to && w.e.alive);
    },
    bot: {
      danger(x, within) {
        for (const s of spits) {
          // (preparándose, `t` es negativo: le falta la preparación y el vuelo)
          const left = s.flight - s.t;
          if (Math.abs(spots[s.spot] - x) < 1.6 && left <= within + 0.6) return true;
        }
        // la trampa no se pisa; la pared no se puede pisar
        return webs.some((w) => w.e.alive && Math.abs(spots[w.spot] - x) < 1.6);
      },
      weight(e) {
        if (e === queen) return 1;
        const egg = eggs.find((g) => g.e === e);
        // el huevo apura más cuanto más cerca está de nacer (quieto, para el bot «no llega nunca»: el
        // apuro lo pone esto, que es lo que valen las arañitas que larga)
        if (egg) return 2.5 + 5.5 * clamp(egg.age / egg.hatch, 0, 1);
        const web = webs.find((w) => w.e === e);
        if (web) {
          if (web.kind === 'trap') return 0.5;
          // la pared que te deja con pocos puestos con pelota apura; la que no, casi nada
          const walls = new Set(webs.filter((w) => w.kind === 'wall' && w.e.alive).map((w) => w.spot));
          return ballSpots(walls) < 3 ? 1.5 : 0.5;
        }
        if (weavers.has(e)) return 2;
        if (babies.includes(e)) return 1.3;
        return 1;
      },
    },
    log: () => ({ fase: phase + 1, vida: Math.max(0, queen.hp), ...stats }),
    dispose() {
      for (const s of spits.splice(0)) disposeSpit(s);
      for (const l of [...lobs.splice(0), ...pendingLobs.splice(0)]) disposeLob(l);
      for (const w of webs.splice(0)) w.mark.dispose();
      scene.remove(cocoon);
      disposeLook(cocoon);
    },
  };
}
