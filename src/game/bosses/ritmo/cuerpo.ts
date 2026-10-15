// El cuerpo de un jefe de ritmo: un enemigo de dungeon.glb manejado por guion, que se planta a media
// cancha y cada tanto se cambia de lugar (no camina a la puerta), con los avisos de cada golpe que le llega
// para que los ritmos (coraza.ts, pulso.ts) hagan lo suyo.
import * as THREE from 'three';
import type { Behavior, EnemyKind } from '../../../core/waves';
import type { Enemy, EnemyScript } from '../../enemies';
import { fieldHalfAt, nearestSpot, partStats, TEE_Z } from '../kit';
import type { BossCtx } from '../types';
import { glow } from './piezas';

/** Un golpe que le entró (después del blindaje). */
export interface Golpe {
  dealt: number;
  /** Lo que traía antes del blindaje. */
  raw: number;
  /** Fue una pelota (de palo o de habilidad, o su área): no el fuego que muerde ni el carrito. */
  shot: boolean;
  /** Pasó el blindaje sin que le restara (el fuego, el rayo, el golpe fantasma). */
  bypass: boolean;
  killed: boolean;
}

export interface CuerpoOpts {
  /** El tipo del que salen los números de base y el modelo. */
  kind: EnemyKind;
  /** Otro modelo: una malla de dungeon.glb que no es de ningún tipo (se arma con `addLook` la primera vez). */
  mesh?: string;
  name: string;
  hp: number;
  height: number;
  radius: number;
  /** A qué velocidad se cambia de lugar. */
  speed: number;
  /** Cómo mueve los brazos: 'melee' el golpe de arriba con el derecho, 'shaman' las dos manos arriba. */
  behavior?: Behavior;
  tint?: number;
}

/**
 * Dónde se planta: a media cancha, y más cerca a medida que pasa la pelea (la presión sube sola). Las z
 * son de la banda del principio (`far`, de 22 a 29 m de la línea) y la del final (`near`, de 14 a 21 m), a
 * la que llega a los `closeIn` s. Más lejos se ve chiquito desde la cámara de la partida.
 */
export const STATIONS = {
  far: [31, 38] as const,
  near: [23, 30] as const,
  closeIn: 150,
  /** Hasta dónde en x, contando desde el medio (sin pegarse al borde). */
  halfX: 11,
  /** Cuánto se corre como mínimo y como mucho al cambiar de lugar. */
  minMove: 6,
  maxMove: 13,
};

/** Desde dónde entra: el fondo, sin llegar a donde aparecen los demás. */
export const ENTRY_Z = 62;

export class Cuerpo {
  readonly e: Enemy;
  /** Adónde va (null: plantado). */
  private goal: { x: number; z: number } | null = null;
  /** El golpe de brazo por código: null quieto; si no, en qué punto va (0 a 1.25, como `scriptSwing`). */
  swing: number | null = null;
  /** Las manos arriba (conjurando). */
  cast = false;
  /** El brillo del cuerpo, que se pinta en cada cuadro (ver `glow`). */
  readonly shine = { color: 0, k: 0 };
  /** Llegó a su primer lugar: desde ahí corren sus relojes. */
  arrived = false;
  private readonly touchFns: ((raw: number, shot: boolean) => void)[] = [];
  private readonly landFns: ((g: Golpe) => void)[] = [];
  private readonly arriveFns: (() => void)[] = [];
  private pending = { raw: 0, shot: false, armor: 0 };
  private readonly speed: number;

  constructor(private readonly ctx: BossCtx, o: CuerpoOpts, x: number, z: number, goal: { x: number; z: number }) {
    this.speed = o.speed;
    const script: EnemyScript = {
      update: (e, dt) => this.step(e, dt),
      // antes de las defensas: lo que traía, si era una pelota y el blindaje que tenía en ese momento
      filter: (e, amount, shot) => {
        this.pending = { raw: amount, shot: !!shot, armor: e.armor };
        for (const f of this.touchFns) f(amount, !!shot);
        return amount;
      },
      onDamage: (_e, dealt, killed) => {
        const p = this.pending;
        // lo que pasa el blindaje (fuego, rayo, fantasma) entra entero aunque tenga blindaje
        const g: Golpe = { dealt, raw: p.raw, shot: p.shot, bypass: p.armor > 0 && dealt !== Math.max(0, p.raw - p.armor), killed };
        for (const f of this.landFns) f(g);
      },
    };
    const stats = partStats(o.kind, {
      name: o.name, hp: o.hp, height: o.height, radius: o.radius, boss: true, heavy: true,
      ...(o.behavior ? { behavior: o.behavior } : {}), ...(o.tint !== undefined ? { tint: o.tint } : {}),
    });
    let look: string = o.kind;
    if (o.mesh) {
      look = `ritmo-${o.mesh}`;
      if (!ctx.horde.hasLook(look)) ctx.horde.addLook(look, ctx.dungeon.scene, ctx.dungeon.animations, o.mesh);
    }
    this.e = ctx.horde.spawnCustom(stats, look, x, z, {}, script);
    this.e.heading = Math.PI;
    this.goal = goal;
  }

  /** Cada pelota que le llega, le entre o no (antes del blindaje). */
  onTouch(f: (raw: number, shot: boolean) => void): void {
    this.touchFns.push(f);
  }
  /** Cada golpe que le entra. */
  onLand(f: (g: Golpe) => void): void {
    this.landFns.push(f);
  }
  /** Cuando llega por primera vez a su lugar. */
  onArrive(f: () => void): void {
    this.arriveFns.push(f);
  }

  get alive(): boolean {
    return this.e.alive;
  }
  get walking(): boolean {
    return this.goal !== null;
  }
  get silenced(): boolean {
    return this.e.silenced;
  }

  /** Que vaya a (x, z). */
  goTo(x: number, z: number): void {
    this.goal = { x, z };
  }
  /** Que se plante donde está. */
  stop(): void {
    this.goal = null;
  }

  /** Un clip de cuerpo entero, una vez (el pisotón, el grito). */
  play(clip: string, speed = 1): void {
    if (this.e.animator.has(clip)) this.e.animator.playOneShot(clip, speed);
  }

  private step(e: Enemy, dt: number): boolean {
    e.scriptGesture = this.cast || this.swing !== null ? 1 : 0;
    e.scriptSwing = this.swing;
    if (this.goal && !e.stunned) {
      if (e.walkToward(this.goal.x, this.goal.z, this.speed, dt, false, 0.4)) {
        this.goal = null;
        if (!this.arrived) {
          this.arrived = true;
          for (const f of this.arriveFns) f();
        }
      }
    } else {
      e.animator.setLocomotion('Idle', 1);
      // plantado, mira a la línea de los puestos, a la altura del golfista
      e.faceToward(this.ctx.player().position.x, TEE_Z, dt, 3);
    }
    glow(e, this.shine.color, this.shine.k);
    return true;
  }

  /** Lo que avanzó la pelea, de 0 a 1 (para que la presión suba sola). */
  static heat(ctx: BossCtx, over = STATIONS.closeIn): number {
    return Math.min(1, ctx.clock() / over);
  }

  /**
   * Un lugar nuevo para plantarse: en la banda de z de ahora, a una distancia razonable del de ahora, y del
   * lado `side` si se pide (-1 izquierda, 1 derecha: para que dos jefes no se encimen).
   */
  pickStation(side = 0): { x: number; z: number } {
    return pickStation(this.ctx, this.e.position.x, this.e.position.z, side);
  }
}

/** Un lugar para plantarse desde (x, z): ver `Cuerpo.pickStation`. */
export function pickStation(ctx: BossCtx, x: number, z: number, side = 0): { x: number; z: number } {
  const h = Cuerpo.heat(ctx);
  const z0 = THREE.MathUtils.lerp(STATIONS.far[0], STATIONS.near[0], h);
  const z1 = THREE.MathUtils.lerp(STATIONS.far[1], STATIONS.near[1], h);
  let best = { x, z: (z0 + z1) / 2 };
  let bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const nz = z0 + ctx.rng() * (z1 - z0);
    const half = Math.min(STATIONS.halfX, fieldHalfAt(nz) - 4);
    let nx = (ctx.rng() * 2 - 1) * half;
    if (side) nx = side * (2 + ctx.rng() * (half - 2));
    const d = Math.hypot(nx - x, nz - z);
    // que se mueva lo suficiente para obligar a apuntar de nuevo, pero no que cruce toda la cancha
    const score = -Math.abs(d - (STATIONS.minMove + STATIONS.maxMove) / 2) - (d < STATIONS.minMove ? 20 : 0) - (d > STATIONS.maxMove ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { x: nx, z: nz };
    }
  }
  return best;
}

/**
 * Los puestos a los que tirarle algo: el del golfista y `n - 1` más, primero los que tienen pelota (adonde
 * va a querer ir) y si no al azar. Devuelve sus índices.
 */
export function targetSpots(ctx: BossCtx, n: number): number[] {
  const spots = ctx.spots();
  const here = nearestSpot(ctx, ctx.player().position.x);
  const out = [here];
  const rest = spots.map((_, i) => i).filter((i) => i !== here);
  // mezclados, con los que tienen pelota adelante
  rest.sort(() => ctx.rng() - 0.5);
  rest.sort((a, b) => Number(ctx.tees.hasBall(b)) - Number(ctx.tees.hasBall(a)));
  for (const i of rest) {
    if (out.length >= n) break;
    out.push(i);
  }
  return out;
}

/** ¿El golfista está en la marca de radio `r` en (x, z)? */
export function playerInside(ctx: BossCtx, x: number, z: number, r: number): boolean {
  const p = ctx.player();
  return p.alive && Math.hypot(p.position.x - x, p.position.z - z) < r;
}
