// El gólem de las piedras (14/10, idea de Leandro): se planta a media cancha y, cada tanto, levanta los
// brazos y golpea el piso; en su línea nacen piedras (ver rocks.ts) que crecen y salen rodando a la
// puerta. Cada vez las hace nacer más seguido y crecer más rápido. Pide repartir la atención: pegarle a él
// mientras se desarman las piedras antes de que salgan, cada una con su reloj.
//
// Con `big` (la versión de la ventana): además levanta cada tanto una piedra grande sobre la cabeza; si en
// la ventana le entra un golpe fuerte, se la suelta encima (se pega y queda aturdido, y las piedras dejan
// de crecer mientras dura); si no, la tira a la puerta. Y tiene fases: a 2/3 y a 1/3 de la vida se
// enfurece (ruge y todo va más rápido).
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { GATE_Z, partStats } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { Overhead } from './overhead';
import { RockLine, SLOT_GAP } from './rocks';
import { stunStars } from './looks';

/** Dónde se planta (z) y dónde aparece. La línea de las piedras va apenas adelante suyo. */
const HOLD_Z = 37;
const LINE_Z = HOLD_Z - 1.4;
const ENTER_Z = 58;
const WALK_SPEED = 2.4;
/** El cuerpo: el gólem de roca de dungeon.glb, un poco más grande que el de siempre. */
const HEIGHT = 4.6;
const RADIUS = 1.8;
/** Vida (más la del talento del golpe 4). */
const HP = 140;
/** Golpe al piso: lo que tarda en levantar los brazos (con el ritmo en 1, y lo mínimo) y en bajarlos: las piedras nacen al pegar. */
const SLAM_WINDUP = 1.1;
const SLAM_MIN = 0.7;
const SLAM_END = 0.3;
/** Lo que se queda agachado después del golpe, antes de volver a pararse. */
const SLAM_REST = 0.45;
/** Segundos entre golpes al piso con el ritmo en 1, y el primero (después de llegar). */
const SLAM_EVERY = 6.5;
const FIRST_SLAM = 1.5;
/** Segundos por punto de vida que crece una piedra, con el ritmo en 1 (de 1 a 5: 4 pasos). */
const GROW_STEP = 3.2;
/** Cuántas piedras por golpe: dos, y tres desde este ritmo. */
const THREE_AT = 1.35;
/** Sin fases, el ritmo sube solo con el tiempo: 1 al llegar, +1 cada TEMPO_RAMP s, hasta TEMPO_MAX. */
const TEMPO_RAMP = 110;
const TEMPO_MAX = 2.1;
/** Con fases (la ventana): el ritmo de cada una, y a qué parte de la vida cambia. */
const PHASE_TEMPO = [1, 1.35, 1.75];
const PHASE_AT = [2 / 3, 1 / 3];
/** El rugido al cambiar de fase, en s. */
const ROAR_TIME = 2.4;
/** La piedra grande: cada cuánto en cada fase, la primera, y sus números (ver Overhead). */
const BIG_EVERY = [16, 13, 10];
const BIG_FIRST = 9;
const BIG = { lift: 1.5, window: 1.7, need: 3, radius: 1.3, gate: 3, flight: 1.5 };
/** Soltársela encima: lo que se pega, lo que queda aturdido, y lo que pega de más cada golpe mientras. */
const BIG_SELF = 6;
const STUN_TIME = 3.5;
const STUN_BONUS = 1;
/** La pose del aturdido: el instante de la caída (Hard Landing) en que queda agachado. */
const STUN_POSE = 0.72;

type Act = 'enter' | 'idle' | 'slam' | 'big' | 'stun' | 'roar';

export interface GolemOpts {
  /** Qué le sacan las piedras a la puerta: la vida que les queda ('hp') o siempre ese número. */
  gate: 'hp' | number;
  /** La piedra grande con su ventana, y las fases. */
  big: boolean;
}

export function startGolem(ctx: BossCtx, opts: GolemOpts): BossFight {
  const { horde } = ctx;
  const line = new RockLine(ctx, LINE_Z, { gate: opts.gate, growStep: GROW_STEP });
  // se planta en uno de los lugares de la línea, cerca del medio: cada pelea, otros carriles
  const homeX = SLOT_GAP * (Math.floor(ctx.rng() * 5) - 2);
  // sin la barra grande de arriba (BossBar): tapa justo la parte de la cancha donde se planta; la vida va
  // sobre la cabeza, como la de cualquier jefe
  const title = L('Gólem de las piedras', 'Stone Golem');
  const stars = stunStars();
  stars.visible = false;
  ctx.scene.add(stars);
  let act: Act = 'enter';
  let t = 0;
  let slamIn = FIRST_SLAM;
  let bigIn = BIG_FIRST;
  let phase = 0;
  let roarQueued = false;
  let planned: number[] = [];
  let slamFor = SLAM_WINDUP;
  let arrivedAt = -1;
  let overhead: Overhead | null = null;
  let windowSaid = false;

  const tempo = (): number => {
    if (opts.big) return PHASE_TEMPO[phase];
    if (arrivedAt < 0) return 1;
    return Math.min(TEMPO_MAX, 1 + (ctx.clock() - arrivedAt) / TEMPO_RAMP);
  };

  const script: EnemyScript = {
    update(e, dt) {
      t += dt;
      e.scriptGesture = 0;
      e.scriptSwing = null;
      if (act === 'enter') {
        if (e.walkToward(homeX, HOLD_Z, WALK_SPEED, dt)) {
          act = 'idle';
          arrivedAt = ctx.clock();
        }
        return true;
      }
      // plantado: no lo corren los golpes ni el viento (es una montaña)
      e.knock.set(0, 0, 0);
      e.position.x = homeX;
      e.position.z = HOLD_Z;
      e.faceToward(e.position.x, GATE_Z, dt);
      line.tempo = tempo();
      line.paused = act === 'stun';
      const big = overhead?.update(dt) ?? null;
      if (ctx.over()) {
        line.clearPlan();
        e.animator.setLocomotion('Idle', 1);
        return true;
      }
      if (act === 'idle') {
        e.animator.setLocomotion('Idle', 1);
        slamIn -= dt;
        bigIn -= dt;
        if (roarQueued) {
          roarQueued = false;
          roar(e);
        } else if (opts.big && bigIn <= 0) {
          act = 'big';
          bigIn = BIG_EVERY[phase];
          overhead!.begin();
        } else if (slamIn <= 0) {
          planned = line.plan(line.tempo >= THREE_AT ? 3 : 2, homeX, RADIUS);
          if (planned.length) {
            act = 'slam';
            t = 0;
            slamFor = Math.max(SLAM_MIN, SLAM_WINDUP / Math.sqrt(line.tempo));
          }
          slamIn = SLAM_EVERY / line.tempo;
        }
      } else if (act === 'slam') {
        // levanta los brazos (las marcas en el piso dicen dónde van a nacer) y golpea
        e.scriptGesture = 1;
        e.scriptSwing = t < slamFor ? t / slamFor : 1 + 0.25 * Math.min(1, (t - slamFor) / SLAM_END);
        if (t < slamFor + SLAM_END) line.showPlan(planned, Math.min(1, t / slamFor));
        else if (planned.length) {
          line.spawn(planned);
          planned = [];
          ctx.audio.bossRock();
          ctx.effects.explosion(new THREE.Vector3(e.position.x, e.position.y + 0.3, e.position.z - RADIUS * 0.6), 2.4, 0xb9a27c);
        }
        if (t >= slamFor + SLAM_END + SLAM_REST) act = 'idle';
      } else if (act === 'big') {
        e.scriptGesture = 1;
        e.scriptSwing = overhead!.swing;
        if (big === 'dropped') {
          // se la soltó encima: se pega y queda aturdido
          horde.damage(e, BIG_SELF, null, 0);
          ctx.feedback(L('¡Se la soltó encima!', 'He dropped it on himself!'));
          act = 'stun';
          t = 0;
          e.animator.poseOneShot('Hard Landing', STUN_POSE);
        } else if (!overhead!.busy) act = 'idle';
      } else if (act === 'stun') {
        stars.visible = true;
        stars.position.set(e.position.x, e.position.y + e.height + 0.5, e.position.z);
        stars.rotation.y += dt * 4;
        if (t >= STUN_TIME) {
          act = 'idle';
          stars.visible = false;
          e.animator.clearOneShot();
          // el golpe al piso que tocaba, apenas se levanta
          slamIn = Math.min(slamIn, 0.8);
        }
      } else if (act === 'roar' && t >= ROAR_TIME) {
        act = 'idle';
        slamIn = Math.min(slamIn, 0.6);
      }
      return true;
    },
    filter(_e, amount) {
      // aturdido, cada golpe le entra uno más
      return act === 'stun' && amount > 0 ? amount + STUN_BONUS : amount;
    },
    onDamage(e, dealt, killed) {
      overhead?.hit(dealt);
      if (killed || !opts.big || phase >= PHASE_AT.length) return;
      if (e.hp / e.maxHp <= PHASE_AT[phase]) {
        phase++;
        roarQueued = true;
      }
    },
    onDeath() {
      line.crumble();
      stars.visible = false;
    },
  };

  /** Cambio de fase: se para, ruge, y desde ahí todo más rápido. */
  function roar(e: Enemy): void {
    act = 'roar';
    t = 0;
    e.animator.playOneShot('Rallying', e.animator.clipDuration('Rallying') / ROAR_TIME || 1);
    ctx.audio.bossAppear();
    ctx.effects.explosion(new THREE.Vector3(e.position.x, e.position.y + 0.3, e.position.z), 5, 0xb9a27c);
    ctx.banner(L('¡El gólem se enfurece!', 'The golem is enraged!'), L('Las piedras nacen y crecen más rápido', 'Rocks spawn and grow faster'), 2.2);
  }

  const stats = partStats('golem', { name: title, height: HEIGHT, radius: RADIUS, hp: HP + ctx.bonusHp, speed: WALK_SPEED, boss: true, heavy: true, score: 600 });
  const body = horde.spawnCustom(stats, 'golem', homeX, ENTER_Z, {}, script);
  if (opts.big) overhead = new Overhead(ctx, body, BIG);

  return {
    get done() {
      return !body.alive;
    },
    update(dt) {
      line.update();
      if (!body.alive) {
        // murió con la piedra arriba: que se le caiga, y que terminen de volar las que tiró
        overhead?.update(dt, true);
        return;
      }
      // la ventana: el cartelito, una vez cuando abre
      const open = overhead?.phase === 'window';
      if (open && !windowSaid) ctx.feedback(L('¡Ahora! ¡Pegale fuerte!', 'Now! Hit him hard!'));
      windowSaid = open;
    },
    bot: {
      danger: (x, within) => line.danger(x, within),
      weight(e) {
        const w = line.weight(e);
        if (w !== null) return w;
        if (e !== body) return 1;
        // la ventana de la piedra grande: que le llegue la pelota justo ahí
        const win = overhead?.windowIn();
        if (win && win.open < 2.1 && win.close > 0.9) return 3;
        return act === 'stun' ? 2 : 1;
      },
    },
    log: () => ({
      vida: body.hp,
      fase: phase + 1,
      accion: overhead?.busy ? overhead.phase : act,
      piedras: line.count.born,
      rotas: line.count.broken,
      lanzadas: line.count.launched,
      enLaPuerta: line.count.gate,
      danoPuerta: line.count.gateDamage,
      atropellos: line.count.crushed,
      ...(overhead ? { cortadas: overhead.count.cut, tiradas: overhead.count.thrown, grandesEnLaPuerta: overhead.count.landed } : {}),
    }),
    dispose() {
      line.dispose();
      overhead?.dispose();
      ctx.scene.remove(stars);
    },
  };
}
