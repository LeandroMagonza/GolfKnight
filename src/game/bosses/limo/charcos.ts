// Las escupidas del limo y los charcos que dejan en los puestos. El limo se infla y la marca violeta te
// sigue de puesto en puesto; cuando se traba (deja de seguirte y se empieza a llenar), escupe un globo de
// baba que cae ahí. Si seguís parado ahí cuando cae, te saca 1. Y deja un charco: mientras dura, ese puesto
// no sirve (la baba se come la pelota y los guardias no tiran ahí). La línea se te achica, y lo que se
// juega es dónde lo dejás caer: en un puesto de la punta casi no molesta; en el del medio, sí.
import * as THREE from 'three';
import type { Enemy } from '../../enemies';
import { GroundMark, TEE_Z, arcPoint, facet, flatMat, heightAt } from '../kit';
import type { BossCtx } from '../types';

/** La marca te sigue tanto (el limo inflándose), después se traba tanto antes de que salga el globo. */
export const SPIT_TRACK = 1.0;
export const SPIT_LOCK = 0.6;
/** Cuánto tarda el globo en el aire: desde que la marca se traba hasta que cae, esto más SPIT_LOCK. */
const GLOB_FLIGHT = 1.3;
/** Lo que sube el globo en el medio del vuelo, más un poco por cada metro de distancia. */
const GLOB_ARC = 5;
const GLOB_ARC_PER_M = 0.06;
/** Radio de la salpicadura: el golfista a menos de esto del puesto cobra. */
const SPLASH_RADIUS = 1.5;
const SPLASH_DAMAGE = 1;
/** El charco: radio (menos de la mitad entre puestos, 4 m: no toca a los de al lado). */
const PUDDLE_RADIUS = 1.55;
/** Lo que tarda en desvanecerse al final (se ve que se está yendo). */
const PUDDLE_FADE = 1.8;
/** Como mucho tantos charcos a la vez, y siempre quedan tantos puestos de los guardias sin charco. */
const MAX_PUDDLES = 4;
const MIN_FREE_SPOTS = 2;
/** Colores: la marca del aviso (violeta encendido, distinta del rojo del hechicero), el charco y su borde. */
const WARN_COLOR = 0xc65bff;
const PUDDLE_COLOR = 0x5d2290;
const RIM_COLOR = 0xb36bff;
const GLOB_COLOR = 0x8a3fd0;
/** Burbujas que revientan en cada charco (para que se lea que es veneno, no una sombra). */
const BUBBLES = 3;

export interface Glob {
  /** El puesto: el del golfista mientras lo sigue; quieto desde que se traba. */
  spot: number;
  source: Enemy;
  t: number;
  locked: boolean;
  launched: boolean;
  /** Lo que dura el charco que deja. */
  lasts: number;
  /** Dónde está la marca (corre de puesto en puesto mientras te sigue). */
  markX: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  mesh: THREE.Mesh;
  ring: GroundMark;
  /** El disco que se llena hasta el borde: cuánto falta para que caiga. */
  clock: GroundMark;
}

interface Puddle {
  spot: number;
  left: number;
  lasts: number;
  disc: GroundMark;
  rim: GroundMark;
  bubbles: { mesh: THREE.Mesh; t: number; period: number; x: number; z: number }[];
}

const globGeo = facet(new THREE.IcosahedronGeometry(0.42, 1), 0.18, 7);
const bubbleGeo = new THREE.SphereGeometry(0.16, 8, 6);

export class Spit {
  readonly globs: Glob[] = [];
  readonly puddles: Puddle[] = [];
  /** Para el registro. */
  spat = 0;
  puddled = 0;
  hits = 0;
  eaten = 0;
  private readonly globMat = flatMat(GLOB_COLOR, { emissive: new THREE.Color(0x4a1080), emissiveIntensity: 0.8 });
  private readonly bubbleMat = new THREE.MeshBasicMaterial({ color: RIM_COLOR, transparent: true, opacity: 0.8, depthWrite: false });

  constructor(private readonly ctx: BossCtx) {}

  /** El puesto donde está (o hacia donde va) el golfista. */
  private playerSpot(): number {
    return this.ctx.tees.nearest(this.ctx.player().anchor.x);
  }

  /**
   * Arranca una escupida de `source`: la marca aparece ya en tu puesto y te sigue SPIT_TRACK s; después se
   * traba, y a los SPIT_LOCK s sale el globo. Si al limo lo matan antes de que salga, no sale.
   */
  prepare(source: Enemy, lasts: number): Glob {
    const spot = this.playerSpot();
    const x = this.ctx.spots()[spot];
    const ring = new GroundMark(this.ctx.scene, WARN_COLOR, false, SPLASH_RADIUS).at(x, TEE_Z).opacity(0.5);
    const clock = new GroundMark(this.ctx.scene, WARN_COLOR, true, SPLASH_RADIUS).at(x, TEE_Z).opacity(0);
    const mesh = new THREE.Mesh(globGeo, this.globMat);
    mesh.visible = false;
    mesh.castShadow = true;
    this.ctx.scene.add(mesh);
    const g: Glob = { spot, source, t: 0, locked: false, launched: false, lasts, markX: x, from: new THREE.Vector3(), to: new THREE.Vector3(x, 0, TEE_Z), mesh, ring, clock };
    this.globs.push(g);
    return g;
  }

  /** Cuánto falta para que caiga el globo. */
  private impactIn(g: Glob): number {
    return g.launched ? GLOB_FLIGHT - g.t : SPIT_TRACK + SPIT_LOCK - g.t + GLOB_FLIGHT;
  }

  update(dt: number): void {
    const { ctx } = this;
    const spots = ctx.spots();
    for (let i = this.globs.length - 1; i >= 0; i--) {
      const g = this.globs[i];
      g.t += dt;
      if (!g.launched) {
        // el que la iba a tirar se murió (o cruzó la línea) antes de escupir: no sale
        if (!g.source.alive || !g.source.script || ctx.over()) {
          this.drop(i);
          continue;
        }
        if (!g.locked) {
          // te sigue: la marca corre a tu puesto
          g.spot = this.playerSpot();
          g.markX += (spots[g.spot] - g.markX) * (1 - Math.exp(-14 * dt));
          g.ring.at(g.markX, TEE_Z).opacity(0.35 + 0.25 * Math.abs(Math.sin(ctx.clock() * 9)));
          if (g.t >= SPIT_TRACK) {
            // se traba: desde acá, a correrse
            g.locked = true;
            g.markX = spots[g.spot];
            g.ring.at(g.markX, TEE_Z);
            g.clock.at(g.markX, TEE_Z);
            g.to.set(g.markX, heightAt(g.markX, TEE_Z) + 0.2, TEE_Z);
          }
          continue;
        }
        this.tick(g);
        if (g.t < SPIT_TRACK + SPIT_LOCK) continue;
        g.launched = true;
        g.t = 0;
        const e = g.source;
        const f = e.facing;
        g.from.set(e.position.x + f.x * e.radius * 0.7, e.position.y + e.height * 0.65, e.position.z + f.z * e.radius * 0.7);
        g.mesh.visible = true;
        this.spat++;
        ctx.audio.casterCast();
      }
      this.tick(g);
      const u = Math.min(1, g.t / GLOB_FLIGHT);
      arcPoint(g.from, g.to, u, GLOB_ARC + GLOB_ARC_PER_M * g.from.distanceTo(g.to), g.mesh.position);
      g.mesh.rotation.x += dt * 6;
      g.mesh.rotation.z += dt * 4;
      // se estira en la caída, como una gota
      g.mesh.scale.set(1, 1 + 0.5 * u, 1);
      if (u < 1) continue;
      this.splash(g);
      this.drop(i);
    }

    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      p.left -= dt;
      const spot = ctx.tees.spots[p.spot];
      if (p.left <= 0 || ctx.over()) {
        spot.incoming = false;
        this.disposePuddle(p);
        this.puddles.splice(i, 1);
        continue;
      }
      // la baba se come la pelota que haya (la que tiraron antes, la del carcaj...) y los guardias no
      // tiran ahí: `incoming` es lo que les dice que ya va una en camino
      if (ctx.tees.hasBall(p.spot)) {
        ctx.tees.take(p.spot);
        ctx.effects.spark(new THREE.Vector3(spot.x, 0.3, TEE_Z), RIM_COLOR);
        this.eaten++;
      }
      spot.incoming = true;
      const fade = Math.min(1, p.left / PUDDLE_FADE);
      // aparece de golpe (salpica) y late despacio
      const grow = Math.min(1, (p.lasts - p.left) / 0.2);
      p.disc.size(PUDDLE_RADIUS * (0.6 + 0.4 * grow)).opacity((0.5 + 0.06 * Math.sin(ctx.clock() * 2.5 + p.spot)) * fade);
      p.rim.size(PUDDLE_RADIUS * (0.65 + 0.4 * grow)).opacity(0.7 * fade);
      for (const b of p.bubbles) {
        b.t += dt;
        const k = (b.t % b.period) / b.period;
        if (k < dt / b.period) {
          // una burbuja nueva, en otro lugar del charco
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * PUDDLE_RADIUS * 0.75;
          b.x = spot.x + Math.cos(a) * r;
          b.z = TEE_Z + Math.sin(a) * r;
        }
        b.mesh.position.set(b.x, heightAt(b.x, b.z) + 0.05 + 0.12 * k, b.z);
        b.mesh.scale.setScalar((0.4 + 1.1 * k) * fade);
        (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k * k) * fade;
      }
    }
  }

  /** La marca trabada: late, y el disco de adentro se llena hasta el borde justo cuando cae. */
  private tick(g: Glob): void {
    const total = SPIT_LOCK + GLOB_FLIGHT;
    const done = THREE.MathUtils.clamp(1 - this.impactIn(g) / total, 0, 1);
    g.clock.size(SPLASH_RADIUS * Math.max(0.05, done)).opacity(0.2 + 0.25 * done);
    g.ring.opacity(0.6 + 0.35 * Math.abs(Math.sin(this.ctx.clock() * 7)));
  }

  /** ¿Puede quedar un charco más en el puesto `i`? Si ya hay, se renueva; si no, hay un tope. */
  private roomFor(i: number): boolean {
    if (this.puddleAt(i)) return true;
    if (this.puddles.length >= MAX_PUDDLES) return false;
    const spots = this.ctx.tees.spots;
    if (!spots[i].spawns) return true;
    const free = spots.filter((s, k) => s.spawns && !this.puddleAt(k)).length;
    return free - 1 >= MIN_FREE_SPOTS;
  }

  /** El globo cayó: salpica, le pega al que esté ahí, y deja (o renueva) el charco. */
  private splash(g: Glob): void {
    const { ctx } = this;
    const x = g.to.x;
    ctx.effects.explosion(new THREE.Vector3(x, 0.4, TEE_Z), SPLASH_RADIUS, GLOB_COLOR);
    ctx.audio.casterHit();
    const pl = ctx.player();
    if (!ctx.over() && pl.alive && Math.abs(pl.position.x - x) < SPLASH_RADIUS && Math.abs(pl.position.z - TEE_Z) < SPLASH_RADIUS + 0.6) {
      if (!pl.invulnerable) this.hits++;
      ctx.hitPlayer(SPLASH_DAMAGE, new THREE.Vector3(x, 0.5, TEE_Z + 1), g.source);
    }
    if (!this.roomFor(g.spot)) return;
    const old = this.puddles.find((p) => p.spot === g.spot);
    if (old) {
      old.left = old.lasts = Math.max(old.left, g.lasts);
      return;
    }
    const disc = new GroundMark(ctx.scene, PUDDLE_COLOR, true, PUDDLE_RADIUS).at(x, TEE_Z);
    const rim = new GroundMark(ctx.scene, RIM_COLOR, false, PUDDLE_RADIUS).at(x, TEE_Z);
    const bubbles: Puddle['bubbles'] = [];
    for (let k = 0; k < BUBBLES; k++) {
      const mesh = new THREE.Mesh(bubbleGeo, this.bubbleMat.clone());
      mesh.renderOrder = 3;
      ctx.scene.add(mesh);
      bubbles.push({ mesh, t: k * 0.37, period: 0.9 + 0.35 * k, x, z: TEE_Z });
    }
    this.puddles.push({ spot: g.spot, left: g.lasts, lasts: g.lasts, disc, rim, bubbles });
    this.puddled++;
  }

  /** Se cortó la escupida (un golpe fuerte al limo mientras se infla): si el globo no salió, no sale. */
  cancel(g: Glob): boolean {
    const i = this.globs.indexOf(g);
    if (i < 0 || g.launched) return false;
    this.drop(i);
    return true;
  }

  private drop(i: number): void {
    const g = this.globs[i];
    g.ring.dispose();
    g.clock.dispose();
    this.ctx.scene.remove(g.mesh);
    this.globs.splice(i, 1);
  }

  private disposePuddle(p: Puddle): void {
    p.disc.dispose();
    p.rim.dispose();
    for (const b of p.bubbles) {
      this.ctx.scene.remove(b.mesh);
      (b.mesh.material as THREE.Material).dispose();
    }
  }

  /**
   * El bot: ¿le cae un globo al que esté en el puesto de `x` en los próximos `within` s? Solo desde que la
   * marca se traba: mientras te sigue, correrse no sirve de nada.
   */
  danger(x: number, within: number): boolean {
    const spots = this.ctx.spots();
    return this.globs.some((g) => g.locked && Math.abs(spots[g.spot] - x) < SPLASH_RADIUS + 0.8 && this.impactIn(g) < within + 0.4);
  }

  /** ¿Hay charco en el puesto `i`? */
  puddleAt(i: number): boolean {
    return this.puddles.some((p) => p.spot === i);
  }

  dispose(): void {
    for (let i = this.globs.length - 1; i >= 0; i--) this.drop(i);
    for (const p of this.puddles) {
      this.ctx.tees.spots[p.spot].incoming = false;
      this.disposePuddle(p);
    }
    this.puddles.length = 0;
    this.globMat.dispose();
    this.bubbleMat.dispose();
  }
}
