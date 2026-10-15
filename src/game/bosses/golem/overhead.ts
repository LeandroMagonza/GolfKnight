// La piedra grande sobre la cabeza (14/10): el tiro del gólem de siempre, pero con respuesta. La levanta
// mientras un anillo dorado se le cierra en los pies (LIFT); cuando el anillo se cierra, la piedra brilla:
// es la ventana (WINDOW). Si en la ventana le entra lo que pide (`need`), la suelta encima suyo: se pega y
// queda aturdido. Si no, la tira por el aire a la puerta.
import * as THREE from 'three';
import type { Enemy } from '../../enemies';
import { GATE_HALF_WIDTH, GATE_Z, GroundMark, arcPoint, disposeObject, heightAt } from '../kit';
import type { BossCtx } from '../types';
import { boulder } from './looks';

/** Lo que sube el arco del tiro a la puerta, en m. */
const ARC_HEIGHT = 7;
/** El brazo, en el golpe por código (ver Enemy.scriptSwing): arriba es 0.75, el impacto 1, abajo 1.25. */
const ARMS_UP = 0.75;
/** Lo que tarda en bajar los brazos al tirarla (o al soltarla). */
const THROW_SWING = 0.35;
/** Lo que tarda en caerle en la cabeza. */
const DROP_TIME = 0.28;
/** Dorado de la ventana, y el anillo que se cierra. */
const GOLD = new THREE.Color(0xffc93a);
const RING_FROM = 3.2;
const RED_MARK = 0xff4a2a;
/** El brillo de la piedra sin ventana (no se le puede cortar). */
const NO_CUT = new THREE.Color(0xff4a2a);

export interface OverheadOpts {
  /** Lo que tarda en levantarla, y lo que dura la ventana, en s. */
  lift: number;
  window: number;
  /** Lo que le tiene que entrar en la ventana para que la suelte. */
  need: number;
  /** El radio de la piedra. */
  radius: number;
  /** Lo que le saca a la puerta si llega, y lo que tarda en el aire. */
  gate: number;
  flight: number;
}

export type OverheadPhase = 'none' | 'lift' | 'window' | 'throw' | 'drop';

interface Flying {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  mark: GroundMark;
}

export class Overhead {
  phase: OverheadPhase = 'none';
  t = 0;
  /** Lo que le entró en esta ventana. */
  acc = 0;
  /** Para el registro: las que soltó encima suyo y las que llegaron a la puerta. */
  readonly count = { cut: 0, landed: 0, thrown: 0 };
  /**
   * Sin ventana (15/10: el último de los tres gólems «no puede stunearse»): la levanta con el anillo rojo
   * y la tira directo, sin el dorado ni la chance de soltársela encima.
   */
  uncuttable = false;
  private rock: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial } | null = null;
  private readonly ring: GroundMark;
  private readonly flying: Flying[] = [];

  constructor(private readonly ctx: BossCtx, private readonly golem: Enemy, private readonly opts: OverheadOpts) {
    this.ring = new GroundMark(ctx.scene, GOLD.getHex(), false, 1).opacity(0);
  }

  get busy(): boolean {
    return this.phase !== 'none';
  }

  /** Empieza a levantarla. */
  begin(): void {
    if (this.busy) return;
    this.phase = 'lift';
    this.t = 0;
    this.acc = 0;
    this.rock = boulder(this.opts.radius);
    this.rock.mesh.scale.setScalar(0.01);
    this.ctx.scene.add(this.rock.mesh);
  }

  /** Lo que le entró al gólem: en la ventana suma. */
  hit(dealt: number): void {
    if (this.phase === 'window' && !this.uncuttable) this.acc += dealt;
  }

  /** El brazo para el guion (scriptSwing), o null si no está con la piedra. */
  get swing(): number | null {
    switch (this.phase) {
      case 'lift':
        return ARMS_UP * smooth(Math.min(1, this.t / (this.opts.lift * 0.7)));
      case 'window':
        return ARMS_UP + 0.03 * Math.sin(this.t * 30);
      case 'throw':
        return ARMS_UP + 0.5 * Math.min(1, this.t / THROW_SWING);
      case 'drop':
        return 1.25;
      default:
        return null;
    }
  }

  /** El bot: dentro de cuánto abre y cierra la ventana (null si no hay una en camino). */
  windowIn(): { open: number; close: number } | null {
    if (this.uncuttable) return null;
    if (this.phase === 'lift') return { open: this.opts.lift - this.t, close: this.opts.lift - this.t + this.opts.window };
    if (this.phase === 'window') return { open: 0, close: this.opts.window - this.t };
    return null;
  }

  /** Dónde va la piedra: sobre la cabeza, un poco adelante. */
  private headAt(out: THREE.Vector3): THREE.Vector3 {
    const g = this.golem;
    const fwd = 0.35 * g.stats.radius;
    return out.set(g.position.x + Math.sin(g.heading) * fwd, g.position.y + g.height + this.opts.radius * 0.75, g.position.z + Math.cos(g.heading) * fwd);
  }

  /**
   * Un cuadro. Devuelve 'dropped' el cuadro en que se la soltó encima (ahí el guion le pega y lo aturde),
   * 'thrown' el cuadro en que la tiró, y si no, null. `stop`: el gólem no puede seguir (murió).
   */
  update(dt: number, stop = false): 'dropped' | 'thrown' | null {
    const { ctx, opts } = this;
    this.updateFlying(dt);
    if (this.phase === 'none') {
      this.ring.opacity(0);
      return null;
    }
    this.t += dt;
    const g = this.golem;
    const head = this.headAt(new THREE.Vector3());
    let out: 'dropped' | 'thrown' | null = null;
    if (stop && this.phase !== 'drop') {
      // se murió con la piedra arriba: se le cae
      this.phase = 'drop';
      this.t = 0;
    }
    const rock = this.rock!;
    const clock = ctx.clock();
    // el anillo: se cierra mientras la levanta, y en la ventana late dorado
    const close = g.stats.radius + 0.5;
    if (this.phase === 'lift') {
      const k = Math.min(1, this.t / opts.lift);
      rock.mesh.scale.setScalar(Math.max(0.01, smooth(Math.min(1, this.t / (opts.lift * 0.7)))));
      rock.mesh.position.copy(head);
      rock.mesh.rotation.y += dt * 1.5;
      rock.mat.emissive.copy(this.uncuttable ? NO_CUT : GOLD).multiplyScalar(0.15 * k);
      this.ring.color(this.uncuttable ? RED_MARK : GOLD.getHex());
      this.ring.at(g.position.x, g.position.z).size(close + RING_FROM * (1 - k)).opacity(0.25 + 0.35 * k);
      if (this.t >= opts.lift) {
        // sin ventana: la tira derecho
        this.phase = this.uncuttable ? 'throw' : 'window';
        this.t = 0;
      }
    } else if (this.phase === 'window') {
      rock.mesh.position.copy(head);
      rock.mesh.position.y += 0.06 * Math.sin(this.t * 40);
      rock.mat.emissive.copy(GOLD).multiplyScalar(0.55 + 0.3 * Math.sin(clock * 18));
      this.ring.at(g.position.x, g.position.z).size(close).opacity(0.65 + 0.25 * Math.sin(clock * 18));
      if (this.acc >= opts.need) {
        this.phase = 'drop';
        this.t = 0;
      } else if (this.t >= opts.window) {
        this.phase = 'throw';
        this.t = 0;
      }
    } else if (this.phase === 'throw') {
      this.ring.opacity(0);
      rock.mat.emissive.setRGB(0, 0, 0);
      rock.mesh.position.copy(head);
      if (this.t >= THROW_SWING * 0.6 && !ctx.over()) {
        // sale para la puerta, cerca del medio
        const to = new THREE.Vector3(THREE.MathUtils.clamp(g.position.x * 0.15, -GATE_HALF_WIDTH + 0.6, GATE_HALF_WIDTH - 0.6), 0, GATE_Z + 0.8);
        to.y = heightAt(to.x, to.z) + opts.radius;
        const mark = new GroundMark(ctx.scene, RED_MARK, true, opts.radius + 0.8).at(to.x, to.z).opacity(0.25);
        this.flying.push({ mesh: rock.mesh, from: head.clone(), to, t: 0, mark });
        this.rock = null;
        this.phase = 'none';
        this.count.thrown++;
        ctx.audio.bossThrow();
        out = 'thrown';
      } else if (this.t >= THROW_SWING * 0.6) {
        this.clearRock();
      }
    } else if (this.phase === 'drop') {
      this.ring.opacity(0);
      rock.mat.emissive.copy(GOLD).multiplyScalar(0.3 * (1 - this.t / DROP_TIME));
      const k = Math.min(1, this.t / DROP_TIME);
      rock.mesh.position.copy(head);
      rock.mesh.position.y -= k * k * (g.height * 0.45 + opts.radius * 0.75);
      rock.mesh.rotation.x += dt * 6;
      if (k >= 1) {
        ctx.effects.explosion(rock.mesh.position.clone(), opts.radius * 2.2, 0x9a8f80);
        ctx.audio.bossRock();
        this.clearRock();
        if (!stop) {
          this.count.cut++;
          out = 'dropped';
        }
      }
    }
    return out;
  }

  /** Las que van por el aire a la puerta: siguen aunque el gólem se muera. */
  private updateFlying(dt: number): void {
    const { ctx, opts } = this;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt / opts.flight;
      arcPoint(f.from, f.to, Math.min(1, f.t), ARC_HEIGHT, f.mesh.position);
      f.mesh.rotation.x += dt * 4;
      f.mesh.rotation.z += dt * 2.5;
      f.mark.opacity(0.25 + 0.4 * Math.min(1, f.t));
      if (f.t < 1) continue;
      ctx.effects.explosion(f.to.clone(), opts.radius * 2.4, 0x9a958a);
      ctx.audio.bossRock();
      if (!ctx.over()) {
        ctx.hitGate(opts.gate, this.golem);
        this.count.landed++;
      }
      disposeObject(ctx.scene, f.mesh);
      f.mark.dispose();
      this.flying.splice(i, 1);
    }
  }

  private clearRock(): void {
    if (this.rock) disposeObject(this.ctx.scene, this.rock.mesh);
    this.rock = null;
    this.phase = 'none';
  }

  dispose(): void {
    this.clearRock();
    this.ring.dispose();
    for (const f of this.flying) {
      disposeObject(this.ctx.scene, f.mesh);
      f.mark.dispose();
    }
    this.flying.length = 0;
  }
}

function smooth(x: number): number {
  return x * x * (3 - 2 * x);
}
