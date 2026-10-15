// Las piedras que el gólem hace nacer en su línea (14/10, idea de Leandro). Nacen con 1 de vida, giran en
// su lugar y crecen de a un punto hasta ROCK_MAX; el tamaño es el reloj: la que se agranda está por
// salir. Al llegar al tope brilla en rojo, marca su carril hasta la puerta y sale rodando derecho; en el
// camino pisa al golfista que esté en el carril (y sigue), y a la puerta le pega lo que le quede de vida
// (o un número fijo, según la versión). Pegarle no la frena: la achica para cuando llegue.
//
// Nacen en tiras de lugares seguidos, a SLOT_GAP: el área del wedge agarra tres de una, el hierro a la de
// al lado. Son enemigos de verdad (las pelotas, las habilidades y el bot las ven), con un guion que las
// planta, las hace girar y las hace rodar.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { GATE_Z, GroundMark, LaneMark, TEE_Z, heightAt, partStats, touchesPlayer } from '../kit';
import type { BossCtx } from '../types';
import { addGlow, ensureRockLook, fitBody, materialsOf, ROCK_LOOK } from './looks';

/** La vida (y el tamaño) a la que llega y sale rodando. Nace con 1. */
export const ROCK_MAX = 5;
/** Radio con 1 de vida y con ROCK_MAX: de una pelota de playa a un peñasco de 2.5 m. */
const R_MIN = 0.5;
export const R_MAX = 1.25;
/** Metros entre lugar y lugar de la línea: el área del wedge (4.2-5 m) agarra tres; la del hierro, la de al lado. */
export const SLOT_GAP = 3.2;
/** Lugares a cada lado del medio: de -16 a 16 (el campo llega a 18). */
const SLOTS_PER_SIDE = 5;
/** Lo que tarda en salir del piso al nacer. */
const RISE_TIME = 0.35;
/** El saltito al subir de vida, en s. */
const POP_TIME = 0.28;
/** Segundos que avisa antes de salir rodando (brilla en rojo y marca el carril), y lo mínimo apurado. */
const READY_TIME = 1.8;
const READY_MIN = 1.2;
/** A qué velocidad rueda (m/s), y cuánto más rápido con el ritmo al doble. */
const ROLL_SPEED = 5;
const ROLL_TEMPO = 0.25;
/** Lo que le saca al golfista que está en el carril: lo pisa y sigue. */
const CRUSH_DAMAGE = 1;
/** Con frío crece y rueda a esta parte (congelada, nada). */
const CHILL_SLOW = 0.5;
/** Brillos: ámbar mientras se pone grande, rojo cuando está por salir y rodando. */
const AMBER = new THREE.Color(0xff9a3c);
const RED = new THREE.Color(0xff3a1a);
const LANE_COLOR = 0xff5a2a;
const PLAN_COLOR = 0xe0b070;
const DUST = 0xb9a27c;

export interface RockLineOpts {
  /** Qué le saca a la puerta: la vida que le queda ('hp') o siempre ese número. */
  gate: 'hp' | number;
  /** Segundos por punto de vida que crece, con el ritmo en 1. */
  growStep: number;
}

type RockState = 'grow' | 'ready' | 'roll';

interface Rock {
  e: Enemy;
  /** Su lugar (x) y por dónde va (z). */
  x: number;
  z: number;
  /** Cuánto creció, de 1 a ROCK_MAX (continuo: el tamaño); `level` es la vida tope de ahora. */
  grow: number;
  level: number;
  state: RockState;
  /** Segundos en el estado. */
  t: number;
  /** Lo que avisa antes de salir (se fija al llegar al tope). */
  readyFor: number;
  lane: LaneMark | null;
  pivot: THREE.Object3D;
  mats: THREE.MeshStandardMaterial[];
  /** La altura que se le puso la última vez (ver fitBody). */
  h: number;
  rise: number;
  pop: number;
  spin: number;
  roll: number;
  crushed: boolean;
}

export class RockLine {
  readonly rocks: Rock[] = [];
  /** El ritmo (1 al arrancar): nacen, crecen y ruedan más rápido. Lo pone el gólem. */
  tempo = 1;
  /** Quietas: no crecen ni salen (el gólem aturdido). */
  paused = false;
  /** Para el registro de la partida. */
  readonly count = { born: 0, broken: 0, launched: 0, gate: 0, gateDamage: 0, crushed: 0 };
  private readonly rockH: number;
  private marks: { x: number; mark: GroundMark }[] = [];
  /** De qué lado del gólem fue la última tira: la próxima, del otro. */
  private lastSide = 1;

  constructor(private readonly ctx: BossCtx, readonly z: number, private readonly opts: RockLineOpts) {
    this.rockH = ensureRockLook(ctx.horde);
  }

  /** Las x de los lugares de la línea. */
  static slots(): number[] {
    const out: number[] = [];
    for (let k = -SLOTS_PER_SIDE; k <= SLOTS_PER_SIDE; k++) out.push(k * SLOT_GAP);
    return out;
  }

  get alive(): number {
    return this.rocks.filter((r) => r.e.alive).length;
  }

  get rolling(): number {
    return this.rocks.filter((r) => r.e.alive && r.state === 'roll').length;
  }

  /**
   * Dónde nacen las próximas `n`: una tira de lugares seguidos libres (sin piedra que crezca ahí y lejos
   * del gólem en `bodyX`), del otro lado que la anterior si se puede. Si no hay tira tan larga, la más
   * larga que haya.
   */
  plan(n: number, bodyX: number, bodyR: number): number[] {
    const slots = RockLine.slots();
    const free = slots.map((x) => Math.abs(x - bodyX) >= bodyR + R_MAX - 0.15
      && !this.rocks.some((r) => r.e.alive && r.state !== 'roll' && Math.abs(r.x - x) < 0.5));
    const runs: number[][] = [];
    for (let len = Math.min(n, slots.length); len >= 1 && !runs.length; len--) {
      for (let i = 0; i + len <= slots.length; i++) {
        if (free.slice(i, i + len).every(Boolean)) runs.push(slots.slice(i, i + len));
      }
    }
    if (!runs.length) return [];
    const side = (run: number[]) => Math.sign(run[0] + run[run.length - 1] - 2 * bodyX) || 1;
    const other = runs.filter((r) => side(r) !== this.lastSide);
    const pool = other.length ? other : runs;
    const pick = pool[Math.floor(this.ctx.rng() * pool.length)];
    this.lastSide = side(pick);
    return pick;
  }

  /** Marca en el piso dónde van a nacer, mientras el gólem levanta los brazos (`k` de 0 a 1). */
  showPlan(xs: readonly number[], k: number): void {
    if (this.marks.length !== xs.length || this.marks.some((m, i) => m.x !== xs[i])) {
      this.clearPlan();
      this.marks = xs.map((x) => ({ x, mark: new GroundMark(this.ctx.scene, PLAN_COLOR, true, 1).at(x, this.z) }));
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.ctx.clock() * 14);
    for (const m of this.marks) m.mark.size(0.5 + 0.9 * k).opacity(0.18 + 0.32 * k + 0.1 * pulse * k);
  }

  clearPlan(): void {
    for (const m of this.marks) m.mark.dispose();
    this.marks = [];
  }

  /** Nacen en `xs`, saliendo del piso con una nube de polvo. */
  spawn(xs: readonly number[]): void {
    this.clearPlan();
    for (const x of xs) {
      const rock = this.make(x);
      this.rocks.push(rock);
      this.count.born++;
      this.ctx.effects.explosion(new THREE.Vector3(x, heightAt(x, this.z) + 0.3, this.z), 1.5, DUST);
    }
  }

  private make(x: number): Rock {
    const { ctx } = this;
    let rock: Rock | null = null;
    const script: EnemyScript = {
      update: (_e, dt) => {
        if (rock) this.step(rock, dt);
        return true;
      },
      onDeath: (e) => {
        this.count.broken++;
        const r = e.stats.radius;
        ctx.effects.explosion(new THREE.Vector3(e.position.x, e.position.y + r, e.position.z), 1 + r, 0x9a8f80);
        e.remove();
      },
    };
    // nace a la altura de la plantilla (así queda escalada 1 a 1) y el guion la achica a su tamaño
    const stats = partStats('stoneling', {
      name: L('Piedra', 'Rock'), hp: 1, height: this.rockH, radius: 1, speed: 0, heavy: true, damage: CRUSH_DAMAGE, gateDamage: 1, score: 5,
    });
    const e = ctx.horde.spawnCustom(stats, ROCK_LOOK, x, this.z, {}, script);
    e.heading = Math.PI;
    const pivot = e.body.getObjectByName('pivot') ?? e.body;
    rock = {
      e, x, z: this.z, grow: 1, level: 1, state: 'grow', t: 0, readyFor: READY_TIME, lane: null, pivot, mats: materialsOf(e),
      h: this.rockH, rise: 0, pop: 0, spin: ctx.rng() * Math.PI * 2, roll: 0, crushed: false,
    };
    this.step(rock, 0);
    return rock;
  }

  private get rollSpeed(): number {
    return ROLL_SPEED * (1 + ROLL_TEMPO * (this.tempo - 1));
  }

  /** Segundos que le faltan para salir rodando (0 si ya rueda). */
  private launchIn(r: Rock): number {
    if (r.state === 'roll') return 0;
    if (r.state === 'ready') return Math.max(0, r.readyFor - r.t);
    return ((ROCK_MAX - r.grow) * this.opts.growStep) / this.tempo + Math.max(READY_MIN, READY_TIME / Math.sqrt(this.tempo));
  }

  /** Un cuadro de una piedra (lo llama su guion, con la horda). */
  private step(r: Rock, dt: number): void {
    const { ctx } = this;
    const e = r.e;
    const still = e.frozen || ctx.over();
    const slow = e.chilled ? CHILL_SLOW : 1;
    r.t += dt;
    r.rise = Math.min(1, r.rise + dt / RISE_TIME);
    r.pop = Math.max(0, r.pop - dt);
    if (r.state !== 'roll') {
      // plantada en su lugar: ni los golpes ni los demás la corren
      e.knock.set(0, 0, 0);
      e.position.set(r.x, heightAt(r.x, r.z), r.z);
    }
    if (r.state === 'grow') {
      if (!this.paused && !still) r.grow = Math.min(ROCK_MAX, r.grow + (dt * slow * this.tempo) / this.opts.growStep);
      // sube de vida de a un punto: el tope y la vida (lo que le sacaste queda sacado)
      while (Math.floor(r.grow + 1e-6) > r.level) {
        r.level++;
        e.setHp(e.hp + 1, r.level);
        r.pop = POP_TIME;
      }
      r.spin += dt * (still ? 0 : 0.6 + 0.45 * r.grow);
      if (r.grow >= ROCK_MAX) {
        r.state = 'ready';
        r.t = 0;
        r.readyFor = Math.max(READY_MIN, READY_TIME / Math.sqrt(this.tempo));
        r.lane = new LaneMark(ctx.scene, LANE_COLOR, 2 * R_MAX + 0.3).between(r.x, r.z - R_MAX, r.x, GATE_Z).opacity(0);
      }
    } else if (r.state === 'ready') {
      // aquieta el reloj mientras el gólem está aturdido o ella congelada
      if (this.paused || still) r.t -= dt;
      r.spin += dt * (still ? 0 : 7);
      const k = Math.min(1, r.t / r.readyFor);
      r.lane?.opacity(0.12 + 0.33 * k);
      if (r.t >= r.readyFor) {
        r.state = 'roll';
        r.t = 0;
        e.stats.speed = this.rollSpeed;
        this.count.launched++;
        ctx.audio.bossRock();
      }
    } else {
      // rueda derecho a la puerta: el viento la puede tirar para atrás (el empujón en z), pero no la saca del carril
      e.knock.x = 0;
      r.z = e.position.z;
      const v = still ? 0 : this.rollSpeed * slow;
      r.z -= v * dt;
      e.position.set(r.x, heightAt(r.x, r.z), r.z);
      const rad = e.stats.radius;
      r.roll += (v * dt) / rad;
      r.lane?.between(r.x, r.z - rad, r.x, GATE_Z).opacity(0.42 + 0.12 * Math.sin(ctx.clock() * 12));
      // pisa al golfista que está en el carril, y sigue
      if (!r.crushed && touchesPlayer(ctx, e, rad + 0.55) && !ctx.player().invulnerable) {
        r.crushed = true;
        this.count.crushed++;
        ctx.hitPlayer(CRUSH_DAMAGE, e.position, e);
        ctx.audio.trample();
      }
      if (r.z - rad <= GATE_Z + 0.4) {
        const dmg = this.opts.gate === 'hp' ? Math.max(1, e.hp) : this.opts.gate;
        this.count.gate++;
        this.count.gateDamage += dmg;
        if (!ctx.over()) ctx.hitGate(dmg, e);
        ctx.effects.explosion(new THREE.Vector3(r.x, rad, GATE_Z + 0.6), 1.2 + rad, 0x9a8f80);
        e.remove();
      }
    }
    this.pose(r);
  }

  /** El tamaño y el giro de la piedra, y su brillo. */
  private pose(r: Rock): void {
    const e = r.e;
    const rad = R_MIN + ((R_MAX - R_MIN) * (r.grow - 1)) / (ROCK_MAX - 1);
    const pop = r.pop > 0 ? 1 + 0.18 * Math.sin(Math.PI * (1 - r.pop / POP_TIME)) : 1;
    const hop = r.state === 'ready' ? Math.abs(Math.sin(r.t * 9)) * 0.12 * Math.min(1, r.t / r.readyFor) : 0;
    r.pivot.scale.setScalar(rad * pop);
    r.pivot.position.y = rad * (2 * r.rise - 1) + hop;
    r.pivot.rotation.set(r.roll, r.spin, r.state === 'ready' ? Math.sin(r.t * 23) * 0.07 : 0);
    r.h = fitBody(e, rad, rad * this.rockH, r.h);
    // el brillo: ámbar desde la mitad del tamaño, rojo latiendo cuando está por salir
    const clock = this.ctx.clock();
    if (r.state === 'grow') addGlow(r.mats, AMBER, Math.max(0, (r.grow - 3) / 2) * (0.22 + 0.08 * Math.sin(clock * 6)));
    else if (r.state === 'ready') addGlow(r.mats, RED, 0.3 + 0.25 * Math.sin(clock * 16));
    else addGlow(r.mats, RED, 0.3);
  }

  /** Cada cuadro de la pelea: saca las que ya no están. */
  update(): void {
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      if (r.e.alive) continue;
      r.lane?.dispose();
      this.rocks.splice(i, 1);
    }
  }

  /** El bot: ¿una piedra va a pasar por el puesto de `x` en los próximos `within` s? */
  danger(x: number, within: number): boolean {
    for (const r of this.rocks) {
      if (!r.e.alive) continue;
      const rad = r.state === 'grow' ? R_MAX : r.e.stats.radius;
      if (Math.abs(r.x - x) > rad + 0.55 + 0.7) continue;
      if (r.state === 'roll' && r.z + rad < TEE_Z - 0.3) continue;
      const travel = Math.max(0, r.z - rad - TEE_Z - 0.6) / this.rollSpeed;
      if (this.launchIn(r) + travel < within + 0.6) return true;
    }
    return false;
  }

  /**
   * El bot: cuánto le importa esta piedra (null si no es una de estas). Las que ruedan apuran; las que
   * crecen, más cuanto más grandes; la que ya pasó la línea no se puede tocar.
   */
  weight(e: Enemy): number | null {
    const r = this.rocks.find((x) => x.e === e);
    if (!r) return null;
    if (r.state === 'roll') return r.z < TEE_Z - 0.5 ? 0 : 3;
    if (r.state === 'ready') return 2.6;
    return 1.4 + (1.2 * (r.grow - 1)) / (ROCK_MAX - 1);
  }

  /** Se deshacen todas (murió el gólem): sin baja ni puntos. */
  crumble(): void {
    for (const r of this.rocks) {
      if (!r.e.alive) continue;
      const rad = r.e.stats.radius;
      this.ctx.effects.explosion(new THREE.Vector3(r.e.position.x, r.e.position.y + rad, r.e.position.z), 1 + rad, 0x9a8f80);
      r.e.remove();
    }
    this.clearPlan();
    this.update();
  }

  dispose(): void {
    this.clearPlan();
    for (const r of this.rocks) r.lane?.dispose();
    this.rocks.length = 0;
  }
}
