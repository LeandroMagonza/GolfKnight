// El minotauro embestidor (14/10, idea de Leandro). Pone a prueba **cortar una carga a tiempo**: se planta,
// raspa el piso y junta una carga (los cuadraditos naranjas sobre la cabeza), con el carril marcado hasta la
// puerta. Cada golpe mientras junta le baja la carga; si se la vaciás antes de que salga, queda aturdido en
// el lugar (la ventana para pegarle a la vida). Si sale, corre mucho más rápido hacia la puerta, y hay que
// terminar de bajarle lo que le quedó antes de que pase la línea: el golpe que se la vacía lo desvía (la
// pelota rebota en ángulo y él, en el ángulo espejo, corre para atrás y queda en otro lado). Si llega, le
// pega a la puerta lo que le quedaba de carga. Cada carga nueva es más fuerte. Ver docs/jefes/minotauro.md.
import * as THREE from 'three';
import { chilledSpeed } from '../../../core/abilities';
import { L } from '../../../i18n';
import type { Ball } from '../../balls';
import type { Enemy, EnemyScript } from '../../enemies';
import { GATE_HALF_WIDTH, GATE_Z, GroundMark, LaneMark, SPAWN_Z, TEE_Z, fieldHalfAt, heightAt, partStats, touchesPlayer } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { ChargeMeter, Debris, DizzyStars, FloatNumbers, CHARGE_COLOR, RUN_COLOR } from './props';

/** Lo que cambia entre versiones (ver index.ts). */
export interface Variant {
  /** Vida de base (más la que da la dificultad). */
  hp: number;
  /** Los golpes mientras junta o embiste le bajan también la vida. Si no, solo la carga. */
  hpWhileCharging: boolean;
  /** Billar: cada golpe de la corrida lo rebota un poco para atrás, no solo el que le vacía la carga. */
  pinball: boolean;
  /** Si llega a la puerta con carga, la puerta cae entera (si no, le saca lo que le quedaba de carga). */
  gateFalls: boolean;
  /** Daño de más por golpe mientras está aturdido (la carga rota). */
  dazeBonus: number;
}

// ---- el cuerpo ----
/** Mide como el gólem de roca (el minotauro común, 2.8 m): de lejos tiene que leerse que es el jefe. */
const HEIGHT = 4.0;
/** Ancho para las pelotas: corriendo es un blanco que se mueve rápido, que no sea un alfiler. */
const RADIUS = 1.35;
const SCORE = 500;

// ---- dónde se para ----
/** Dónde se planta a juntar la carga: entre estas z (lejos: la corrida tiene que dar tiempo). */
const STANCE_NEAR = 36;
const STANCE_FAR = 46;
/** El rebote lo puede dejar más cerca, hasta acá (dejarlo salir es peligroso: vuelve a cargar de cerca). */
const BOUNCE_NEAR = 22;
/** Y nunca más lejos que esto. */
const BOUNCE_FAR = 52;
/** Lo más al costado que se planta (los puestos con pelota van de -8 a 8: el carril siempre los cruza). */
const STANCE_SIDE = 12;
/** Lo que deja libre contra los bordes del campo. */
const SIDE_MARGIN = 3;
/** Al carril lo apunta a un punto de la puerta, no tan al borde. */
const GATE_AIM = GATE_HALF_WIDTH - 0.8;

// ---- la carga ----
/** Puntos de la primera carga; cada carga nueva suma CHARGE_STEP, hasta CHARGE_MAX. */
const CHARGE_FIRST = 5;
const CHARGE_STEP = 1;
const CHARGE_MAX = 11;
/** Con la dificultad: un punto más cada tantos niveles. */
const CHARGE_PER_LEVELS = 4;
/** Segundos que junta la primera; cada una, WINDUP_STEP menos, hasta WINDUP_MIN. */
const WINDUP_FIRST = 5.2;
const WINDUP_STEP = 0.2;
const WINDUP_MIN = 4;
/** El aviso del final: se para de manos, levanta el hacha y el carril se pone rojo. */
const TELL = 0.8;
/** Cada cuánto raspa el piso (una nube de polvo) y cada cuánto resopla. */
const PAW_EVERY = 0.55;
const SNORT_EVERY = 1.6;

// ---- la corrida ----
/** m/s de la primera corrida; cada una suma RUN_STEP, hasta RUN_MAX. */
const RUN_FIRST = 9;
const RUN_STEP = 0.4;
const RUN_MAX = 12;
/**
 * Con la carga casi vacía corre a esta parte de su velocidad: lo que le bajaste antes de que salga lo
 * frena, y cada golpe de la corrida también.
 */
const RUN_FLOOR = 0.5;
/** El tropezón de cada golpe en la corrida (si no lo desvía): a qué parte de su paso y por cuánto. */
const FLINCH_SLOW = 0.35;
const FLINCH_TIME = 0.25;
/** Lo que le saca al golfista que se queda en el carril. */
const TRAMPLE = 1;
/** Hasta dónde le pega al que está al lado (como cualquiera que atropella). */
const TRAMPLE_REACH = 0.55;
/** Si llega con carga y la puerta cae entera (la versión brutal): más que toda la puerta. */
const GATE_ALL = 99;

// ---- el desvío ----
/**
 * Cuánto se tuerce el rebote: la pelota que le pega en el borde lo inclina hasta este ángulo (el rebote sale
 * al doble, en espejo de la pelota). En el medio, para atrás derecho.
 */
const MAX_TILT = 0.6;
/** Lo mínimo que vuelve hacia el fondo, aunque le peguen bien de costado (en z, de 0 a 1). */
const MIN_BACK = 0.35;
/** El sacudón del golpe que lo desvía: sale despedido así de rápido, este rato. */
const RECOIL_SPEED = 11;
const RECOIL_TIME = 0.3;
/** Después corre para atrás hasta quedar a tantos metros de donde lo desviaron. */
const BOUNCE_DIST = 13;
const RETREAT_SPEED = 7.5;
/** Se sacude la cabeza antes de volver a juntar. */
const RECOVER = 1.1;
/** Billar: cada punto que le baja un golpe de la corrida lo rebota estos metros, en este rato. */
const PUSH_PER_POINT = 2.2;
const PUSH_TIME = 0.3;

// ---- el resto ----
/** Aturdido después de que le rompen la carga: la ventana para pegarle a la vida. */
const DAZE = 3.5;
/** Después del aturdido se mueve de costado a otro lugar, al trote, para cambiar el carril. */
const MOVE_SIDE = [7, 12];
const TROT = 4.5;
/** Entra caminando desde el fondo. */
const WALK_IN = 3.2;
/** Contra la puerta: queda atontado y vuelve corriendo al fondo. */
const CRASH_STUN = 1.4;
const RETURN_SPEED = 7;
/** Detrás de la línea de los puestos está fuera de juego, como todos: no se le pega. */
const BEHIND = 1.6;
/** Brillo rojo del cuerpo mientras junta (sube) y mientras corre. */
const GLOW_WINDUP = 0.45;
const GLOW_RUN = 0.8;

type Phase = 'enter' | 'windup' | 'run' | 'push' | 'recoil' | 'retreat' | 'recover' | 'daze' | 'move' | 'crash' | 'return' | 'idle';

const clamp = THREE.MathUtils.clamp;

export function startMinotaur(ctx: BossCtx, v: Variant): BossFight {
  const { horde, scene, effects, audio } = ctx;
  const levelCharge = Math.floor(ctx.level / CHARGE_PER_LEVELS);
  const chargeFor = (n: number) => Math.min(CHARGE_MAX, CHARGE_FIRST + (n - 1) * CHARGE_STEP) + levelCharge;
  const windupFor = (n: number) => Math.max(WINDUP_MIN, WINDUP_FIRST - (n - 1) * WINDUP_STEP);
  const runFor = (n: number) => Math.min(RUN_MAX, RUN_FIRST + (n - 1) * RUN_STEP);

  let phase: Phase = 'enter';
  /** Segundos en la fase de ahora. */
  let t = 0;
  /** Cuántas cargas lleva (la de ahora incluida). */
  let n = 0;
  /** La carga de ahora: lo que le queda y de cuánto era; cuánto junta (segundos) y lo que ya juntó. */
  let charge = 0;
  let chargeMax = 0;
  let windup = 0;
  let fuse = 0;
  /** Adónde embiste (un punto de la puerta), y por dónde (unitario en el piso). */
  const target = new THREE.Vector3();
  const dir = new THREE.Vector3(0, 0, -1);
  /** Adónde va cuando camina (la entrada, el cambio de lugar, la vuelta, el rebote). */
  const goal = new THREE.Vector3();
  /** El sacudón del desvío o del billar: hacia dónde, y a qué velocidad. */
  const shove = new THREE.Vector3();
  let shoveSpeed = 0;
  let flinch = 0;
  let trampled = false;
  let pawClock = 0;
  let snortClock = 0;
  let dustClock = 0;
  /** El parpadeo de la barra cuando le bajan la carga. */
  let blink = 0;
  let speedNow = 0;
  const stats = { cargas: 0, rotas: 0, desvios: 0, choques: 0, puerta: 0, pisotones: 0, golpesCarga: 0, empujones: 0 };

  const meter = new ChargeMeter(scene);
  const debris = new Debris(scene);
  const stars = new DizzyStars(scene, 5, 1.2);
  const floats = new FloatNumbers(scene);
  const lane = new LaneMark(scene, 0xff9a2e, RADIUS * 2 + 0.4).opacity(0);
  /** Dónde cruza el carril la línea de los puestos: el puesto que atropella. */
  const cross = new GroundMark(scene, 0xff4030, false, RADIUS + TRAMPLE_REACH).opacity(0);
  /** La mecha en el piso: un anillo que se cierra hasta sus pies cuando sale. */
  const fuseRing = new GroundMark(scene, 0xff9a2e, false, 3).opacity(0);

  const charging = () => phase === 'windup' || phase === 'run' || phase === 'push';
  const running = () => phase === 'run' || phase === 'push';

  /** Un lugar para plantarse entre `near` y `far`; con `awayFrom`, del otro lado de esa x. */
  function stance(near: number, far: number, awayFrom?: number): THREE.Vector3 {
    const z = near + ctx.rng() * (far - near);
    const half = Math.min(STANCE_SIDE, fieldHalfAt(z) - SIDE_MARGIN);
    let x = (ctx.rng() * 2 - 1) * half;
    if (awayFrom !== undefined) {
      const side = awayFrom > 0 ? -1 : awayFrom < 0 ? 1 : ctx.rng() < 0.5 ? -1 : 1;
      x = clamp(awayFrom + side * (MOVE_SIDE[0] + ctx.rng() * (MOVE_SIDE[1] - MOVE_SIDE[0])), -half, half);
    }
    return new THREE.Vector3(x, 0, z);
  }

  /** La x donde el carril cruza la línea de los puestos (null si no va para ahí). */
  function crossingX(e: Enemy): number | null {
    const dz = e.position.z - target.z;
    if (dz <= 0.1 || e.position.z < TEE_Z) return null;
    return e.position.x + ((target.x - e.position.x) * (e.position.z - TEE_Z)) / dz;
  }

  /** A qué velocidad corre ahora: la de esta carga, menos lo que le bajaron, el frío y el tropezón. */
  function runSpeed(e: Enemy): number {
    let s = runFor(n) * (RUN_FLOOR + (1 - RUN_FLOOR) * clamp(charge / Math.max(1, chargeMax), 0, 1));
    if (e.chilled) s = chilledSpeed(s);
    if (flinch > 0) s *= FLINCH_SLOW;
    return s;
  }

  function startWindup(): void {
    n++;
    stats.cargas = n;
    chargeMax = charge = chargeFor(n);
    windup = windupFor(n);
    fuse = 0;
    phase = 'windup';
    t = 0;
    pawClock = 0;
    snortClock = SNORT_EVERY * 0.5;
    target.set((ctx.rng() * 2 - 1) * GATE_AIM, 0, GATE_Z);
    if (n === 1) ctx.banner(L('¡El minotauro va a embestir!', 'The minotaur is about to charge!'), L('Bajale la carga antes de que salga', 'Knock his charge down before he runs'), 3);
    audio.growl();
  }

  function launch(e: Enemy): void {
    phase = 'run';
    t = 0;
    trampled = false;
    dir.set(target.x - e.position.x, 0, target.z - e.position.z).normalize();
    debris.dust(e.position.x, e.position.z, 12, 1.6, 3.5);
    audio.bossThrow();
    ctx.feedback(L('¡Embiste!', 'He charges!'));
  }

  /** Le vaciaron la carga antes de salir: queda aturdido ahí mismo. */
  function breakCharge(e: Enemy): void {
    phase = 'daze';
    t = 0;
    stats.rotas++;
    effects.explosion(e.position.clone().setY(e.position.y + HEIGHT * 0.55), 2.2, 0xff9a2e);
    debris.dust(e.position.x, e.position.z, 8, 1.2, 2.5);
    audio.armorHit();
    ctx.feedback(L('¡Carga rota!', 'Charge broken!'));
  }

  /** La pelota que le pegó (la más cerca de las que lo tocaron y siguen en juego), para el ángulo del rebote. */
  function ballOn(e: Enemy): Ball | null {
    let best: Ball | null = null;
    let bd = Infinity;
    for (const b of ctx.balls.list) {
      if (b.done || !b.hitIds.has(e.id)) continue;
      const d = Math.hypot(b.state.pos.x - e.position.x, b.state.pos.z - e.position.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return bd < e.radius + 3 ? best : null;
  }

  /**
   * El rebote, como dos bolas de billar: la normal del choque sale de su frente, torcida hacia donde le
   * pegó la pelota (hasta MAX_TILT en el borde). Él sale en espejo de su corrida (para atrás, y para el lado
   * contrario al golpe) y la pelota en espejo de la suya. Devuelve hacia dónde sale él; la pelota la tira.
   */
  function bounce(e: Enemy, ball: Ball | null): THREE.Vector3 {
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    const contact = ball ? new THREE.Vector3(ball.state.pos.x, 0, ball.state.pos.z) : e.position.clone().addScaledVector(dir, e.radius);
    const off = clamp(((contact.x - e.position.x) * side.x + (contact.z - e.position.z) * side.z) / e.radius, -1, 1);
    const a = off * MAX_TILT;
    const normal = dir.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a)).normalize();
    const out = dir.clone().addScaledVector(normal, -2 * dir.dot(normal));
    // siempre algo hacia el fondo: si no, le pegaban de costado y seguía hacia la línea
    if (out.z < MIN_BACK) {
      out.z = MIN_BACK;
      out.x = Math.sign(out.x || 1) * Math.sqrt(1 - MIN_BACK * MIN_BACK);
    }
    out.normalize();
    // la pelota: en espejo de como venía (si venía de atrás, un área, sale para afuera)
    const d = ball ? new THREE.Vector3(ball.state.vel.x, 0, ball.state.vel.z) : dir.clone().negate();
    if (d.lengthSq() < 1e-4) d.copy(dir).negate();
    d.normalize();
    const ballOut = d.dot(normal) < 0 ? d.addScaledVector(normal, -2 * d.dot(normal)) : normal.clone();
    const from = ball ? new THREE.Vector3(ball.state.pos.x, Math.max(ball.state.pos.y, e.position.y + 0.8), ball.state.pos.z) : contact.setY(e.position.y + 1.2);
    debris.ricochet(from, ballOut, 13);
    // la pelota de verdad termina acá: la que rebota es la de mentira (el driver no sigue de largo)
    if (ball) ball.done = true;
    return out;
  }

  /** Le vaciaron la carga en la corrida: rebota en ángulo y corre para atrás, a otro lado del campo. */
  function deflect(e: Enemy, ball: Ball | null): void {
    const out = bounce(e, ball);
    stats.desvios++;
    phase = 'recoil';
    t = 0;
    shove.copy(out);
    shoveSpeed = RECOIL_SPEED;
    // adónde llega: BOUNCE_DIST para ese lado, adentro del campo y no más cerca que BOUNCE_NEAR
    const end = e.position.clone().addScaledVector(out, BOUNCE_DIST);
    end.z = clamp(end.z, BOUNCE_NEAR, BOUNCE_FAR);
    const half = Math.min(fieldHalfAt(end.z) - SIDE_MARGIN, STANCE_SIDE + 3);
    end.x = clamp(end.x, -half, half);
    goal.copy(end);
    effects.explosion(e.position.clone().setY(e.position.y + HEIGHT * 0.5), 2, 0xffd36b);
    audio.ricochet();
    audio.thud();
    ctx.feedback(L('¡Desviado!', 'Deflected!'));
  }

  /** Billar: un golpe de la corrida que no le vacía la carga lo rebota un poco igual, y sigue. */
  function push(e: Enemy, ball: Ball | null, amount: number): void {
    const out = bounce(e, ball);
    stats.empujones++;
    phase = 'push';
    t = 0;
    shove.copy(out);
    shoveSpeed = (PUSH_PER_POINT * amount) / PUSH_TIME;
    audio.thud();
  }

  function crash(e: Enemy): void {
    const amount = v.gateFalls ? GATE_ALL : Math.max(1, Math.ceil(charge));
    stats.choques++;
    stats.puerta += amount;
    ctx.hitGate(amount, e);
    effects.explosion(e.position.clone().setY(e.position.y + 1.5), 3, 0xff4030);
    debris.dust(e.position.x, e.position.z, 14, 1.8, 4);
    audio.explosion(true);
    ctx.feedback(L('¡Embistió la puerta!', 'He rammed the gate!'));
    phase = 'crash';
    t = 0;
    charge = 0;
    // rebota contra la puerta
    shove.set(0, 0, 1);
    shoveSpeed = 6;
  }

  /** Cuánto le entra de un golpe: mientras junta o corre, va a la carga (y a la vida, según la versión). */
  function filter(e: Enemy, amount: number): number {
    if (e.position.z < TEE_Z - BEHIND) return 0;
    if (!charging()) return amount + (phase === 'daze' && amount > 0 ? v.dazeBonus : 0);
    if (amount <= 0) return 0;
    const took = Math.min(charge, amount);
    charge = Math.max(0, charge - amount);
    stats.golpesCarga++;
    blink = 0.18;
    floats.add(`−${took}`, e.position.x, e.position.y + HEIGHT + 2.1, e.position.z, running() ? RUN_COLOR : CHARGE_COLOR);
    if (phase === 'windup') {
      if (charge <= 0) breakCharge(e);
    } else if (charge <= 0) {
      deflect(e, ballOn(e));
    } else if (v.pinball) {
      push(e, ballOn(e), took);
    } else {
      flinch = FLINCH_TIME;
    }
    return v.hpWhileCharging ? amount : 0;
  }

  /** El brillo rojo del cuerpo: se pinta sobre el de siempre solo si no hay otro (el golpe, el fuego...). */
  function glow(e: Enemy, k: number): void {
    if (k <= 0.01) return;
    e.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat.emissive) return;
      const em = mat.emissive;
      if (em.r + em.g + em.b > 0.02) return;
      em.setRGB(0.9 * k, 0.12 * k, 0.03 * k);
    });
  }

  /** Inclinado hacia adelante (positivo) o para atrás, suave. */
  function lean(e: Enemy, to: number, dt: number): void {
    e.body.rotation.x += (to - e.body.rotation.x) * (1 - Math.exp(-10 * dt));
  }

  /** Corre (o camina) en línea recta hacia `dir` a `speed`, con la animación al paso. */
  function stride(e: Enemy, d: THREE.Vector3, speed: number, dt: number, run: boolean): void {
    e.position.x += d.x * speed * dt;
    e.position.z += d.z * speed * dt;
    e.position.y = heightAt(e.position.x, e.position.z);
    const s = e.height / 1.8;
    e.animator.setLocomotion(run ? 'Running' : 'Walking', run ? speed / (4 * s) : speed / (1.5 * s));
  }

  const script: EnemyScript = {
    update(e, dt) {
      // el aura del chamán no lo cubre: su pelea es de tiempos, y quedar inmune justo en la corrida no se evita
      e.warded = false;
      e.scriptGesture = 0;
      e.scriptSwing = null;
      t += dt;
      if (blink > 0) blink -= dt;
      if (flinch > 0) flinch -= dt;
      speedNow = 0;
      if (ctx.over() && phase !== 'idle') phase = 'idle';
      switch (phase) {
        case 'idle':
          e.animator.setLocomotion('Idle', 1);
          lean(e, 0, dt);
          break;
        case 'enter':
          lean(e, 0, dt);
          if (e.walkToward(goal.x, goal.z, WALK_IN, dt)) startWindup();
          break;
        case 'move':
          lean(e, 0.05, dt);
          if (e.walkToward(goal.x, goal.z, TROT, dt, true)) startWindup();
          break;
        case 'return':
          lean(e, 0.1, dt);
          if (e.walkToward(goal.x, goal.z, RETURN_SPEED, dt, true)) startWindup();
          break;
        case 'windup': {
          e.faceToward(target.x, target.z, dt, 5);
          // silenciado no junta: la mecha se para mientras dura
          if (!e.silenced) fuse += dt;
          const left = windup - fuse;
          const tell = left < TELL;
          e.animator.setLocomotion('Idle', tell ? 0.4 : 1.6);
          if (tell) {
            // se para de manos con el hacha arriba: ya sale
            lean(e, -0.22, dt);
            e.scriptGesture = 1;
            e.scriptSwing = 0.8;
          } else {
            lean(e, 0.3 + 0.08 * Math.sin(t * 9), dt);
            if ((pawClock -= dt) <= 0) {
              pawClock = PAW_EVERY;
              // raspa con una pata y con la otra: el polvo sale atrás suyo
              const back = e.position.clone().addScaledVector(e.facing, -0.6);
              const sideways = (Math.round(t / PAW_EVERY) % 2 ? 1 : -1) * 0.5;
              debris.dust(back.x + e.facing.z * sideways, back.z - e.facing.x * sideways, 3, 0.7, 1.2);
            }
            if ((snortClock -= dt) <= 0) {
              snortClock = SNORT_EVERY;
              audio.growl();
            }
          }
          glow(e, GLOW_WINDUP * (fuse / windup) * (0.7 + 0.3 * Math.sin(t * 12)));
          if (left <= 0) launch(e);
          break;
        }
        case 'run': {
          // re-apunta al mismo punto de la puerta (el empujón de un golpe no lo saca del carril)
          dir.set(target.x - e.position.x, 0, target.z - e.position.z).normalize();
          speedNow = runSpeed(e);
          stride(e, dir, speedNow, dt, true);
          e.faceToward(e.position.x + dir.x, e.position.z + dir.z, dt, 14);
          lean(e, 0.38, dt);
          e.scriptGesture = 1;
          e.scriptSwing = 1.2;
          glow(e, GLOW_RUN * (0.8 + 0.2 * Math.sin(t * 20)));
          if ((dustClock -= dt) <= 0) {
            dustClock = 0.09;
            debris.dust(e.position.x, e.position.z, 1, 0.9, 0.8);
          }
          if (!trampled && touchesPlayer(ctx, e, e.radius + TRAMPLE_REACH) && !ctx.player().invulnerable) {
            trampled = true;
            stats.pisotones++;
            ctx.hitPlayer(TRAMPLE, e.position, e);
          }
          if (e.position.z <= GATE_Z + e.radius + 0.3) crash(e);
          break;
        }
        case 'push':
          // billar: el rebote de un golpe, y sigue corriendo con lo que le queda
          stride(e, shove, shoveSpeed, dt, false);
          e.animator.setLocomotion('Idle', 1);
          lean(e, -0.25, dt);
          glow(e, GLOW_RUN * 0.6);
          if (t >= PUSH_TIME) {
            phase = 'run';
            t = 0;
          }
          break;
        case 'recoil':
          // el sacudón del golpe que lo desvió: sale despedido, mirando todavía a la puerta
          stride(e, shove, shoveSpeed * (1 - t / RECOIL_TIME), dt, false);
          e.animator.setLocomotion('Idle', 1);
          lean(e, -0.35, dt);
          if (t >= RECOIL_TIME) {
            phase = 'retreat';
            t = 0;
          }
          break;
        case 'retreat':
          lean(e, 0.15, dt);
          if (e.walkToward(goal.x, goal.z, RETREAT_SPEED, dt, true, 0.5)) {
            phase = 'recover';
            t = 0;
          }
          break;
        case 'recover':
          e.animator.setLocomotion('Idle', 0.6);
          e.faceToward(0, GATE_Z, dt, 3);
          // sacude la cabeza
          lean(e, 0.1 * Math.sin(t * 14), dt);
          if (t >= RECOVER) startWindup();
          break;
        case 'daze':
          e.animator.setLocomotion('Idle', 0.35);
          // tambalea
          e.heading += Math.sin(t * 5) * 0.9 * dt;
          lean(e, 0.12 + 0.12 * Math.sin(t * 3.3), dt);
          if (t >= DAZE) {
            const to = stance(STANCE_NEAR - 4, STANCE_FAR, e.position.x);
            to.z = clamp(e.position.z + (ctx.rng() * 2 - 1) * 5, BOUNCE_NEAR + 4, STANCE_FAR);
            goal.copy(to);
            phase = 'move';
            t = 0;
          }
          break;
        case 'crash':
          stride(e, shove, shoveSpeed * Math.max(0, 1 - t / 0.4), dt, false);
          e.animator.setLocomotion('Idle', 0.4);
          lean(e, -0.3 + 0.2 * Math.sin(t * 6), dt);
          if (t >= CRASH_STUN) {
            goal.copy(stance(STANCE_NEAR + 2, STANCE_FAR));
            phase = 'return';
            t = 0;
          }
          break;
      }
      // adentro del campo (el sacudón y el viento lo pueden sacar)
      const half = fieldHalfAt(e.position.z) - 1;
      e.position.x = clamp(e.position.x, -half, half);
      return true;
    },
    filter: (e, amount) => filter(e, amount),
    onDeath() {
      phase = 'idle';
      audio.explosion(true);
    },
  };

  const start = new THREE.Vector3((ctx.rng() * 2 - 1) * 8, 0, SPAWN_Z - 2);
  const boss = horde.spawnCustom(
    partStats('minotaur', { name: L('Minotauro embestidor', 'Charging Minotaur'), height: HEIGHT, radius: RADIUS, hp: v.hp + ctx.bonusHp, boss: true, heavy: true, score: SCORE }),
    'minotaur', start.x, start.z, {}, script,
  );
  // la inclinación va después del giro (adelante es hacia donde mira)
  boss.body.rotation.order = 'YXZ';
  boss.heading = Math.PI;
  goal.copy(stance(STANCE_NEAR + 2, STANCE_FAR));

  return {
    get done() {
      return !boss.alive;
    },
    update(dt) {
      debris.update(dt);
      floats.update(dt);
      const alive = boss.alive;
      const p = boss.position;
      stars.update(dt, p.x, p.y + HEIGHT + 0.25, p.z, alive && (phase === 'daze' || phase === 'recover' || phase === 'crash'));
      // la barra de la carga, arriba de la vida
      const show = alive && charging();
      meter.show(show);
      if (show) {
        meter.draw(Math.ceil(charge), chargeMax, phase === 'windup' ? 1 - fuse / windup : null, running(), blink > 0);
        meter.place(p.x, p.y + HEIGHT + 1.35, p.z, blink > 0 ? 0.25 : 0);
      }
      // el carril hasta la puerta y el puesto que pisa
      const cx = alive && charging() ? crossingX(boss) : null;
      if (cx === null) {
        lane.opacity(0);
        cross.opacity(0);
        fuseRing.opacity(0);
        return;
      }
      lane.between(p.x, p.z, target.x, target.z);
      cross.at(cx, TEE_Z);
      if (phase === 'windup') {
        const u = clamp(fuse / windup, 0, 1);
        const left = windup - fuse;
        // late más rápido cuanto menos le falta, como la marca del hechizo
        const pulse = 0.5 + 0.5 * Math.sin(ctx.clock() * (5 + 18 * u));
        const tell = left < TELL;
        lane.color(tell ? 0xff4030 : 0xff9a2e).opacity(tell ? 0.55 + 0.25 * pulse : 0.16 + 0.16 * u + 0.12 * pulse);
        cross.color(0xff4030).opacity(0.25 + 0.35 * u * pulse);
        fuseRing.at(p.x, p.z).size(RADIUS * 1.05 + (1 - u) * 2.6).color(tell ? 0xff4030 : 0xff9a2e).opacity(0.55);
      } else {
        lane.color(0xff4030).opacity(0.6);
        cross.color(0xff4030).opacity(0.75);
        fuseRing.opacity(0);
      }
    },
    bot: {
      // el puesto que va a pisar la corrida: el que cruza el carril, mientras corre o un poco antes de salir
      danger(x, within) {
        if (!boss.alive || !charging()) return false;
        const cx = crossingX(boss);
        if (cx === null || Math.abs(x - cx) > RADIUS + TRAMPLE_REACH + 0.7) return false;
        const dist = Math.max(0, boss.position.z - TEE_Z);
        const eta = phase === 'windup' ? windup - fuse + dist / runFor(n) : dist / Math.max(1, speedNow || runSpeed(boss));
        return eta < within + 0.5;
      },
      // la carga apura: mientras junta (cortarla antes de que salga) y más mientras corre
      weight(e) {
        if (e !== boss) return 1;
        if (running()) return 4;
        if (phase === 'windup') return 2.5;
        if (phase === 'daze') return 2;
        return 1;
      },
    },
    log: () => ({ fase: phase, ...stats, vida: boss.hp }),
    dispose() {
      meter.dispose();
      debris.dispose();
      stars.dispose();
      floats.dispose();
      lane.dispose();
      cross.dispose();
      fuseRing.dispose();
    },
  };
}
