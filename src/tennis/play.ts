// Modo tenis: el golpe. Se decide por **timing**, no con la barra del golf:
//
// - **Devolver**: apretás para prepararte y soltás cuando la pelota llega a tu línea. Un círculo que se
//   cierra sobre la pelota marca el momento. Justo es el golpe 3; cerca, el 2. Si estás ahí y no soltás,
//   la devolvés igual con el 1 (y si soltás un toque tarde, todavía mejora). Si no llegaste, la pelota cae
//   en la línea y la levantás después. Ubicarte mantiene viva la pelota; el timing da el daño.
// - **Sacar**: apretás y la pelota sube; soltás cuando llega arriba. Si no soltás, sale igual al caer, con
//   el golpe 1. Así todo el tenis se juega igual.
//
// El golpe sale cuando el swing llega al impacto, un instante después de decidirlo: ese instante (`lead`)
// se mide en cada golpe, y el golpe se decide esa fracción antes de que llegue la pelota, para que el
// impacto caiga justo cuando llega.
import * as THREE from 'three';
import { BALL_RADIUS } from '../core/ballistics';
import type { Ball, Balls } from '../game/balls';
import type { Player } from '../game/player';
import { TEE_LINE_Z } from '../game/world';
import { TENNIS, timingQuality } from './bounce';
import type { Court } from './court';
import type { Pocket } from './pocket';

export interface TennisHost {
  scene: THREE.Scene;
  camera: THREE.Camera;
  balls: Balls;
  pocket: Pocket;
  court: Court;
  player(): Player;
  /** Reloj de juego (no corre en pausa). */
  clock(): number;
  /** La partida está en juego. */
  active(): boolean;
  whoosh(power: number): void;
  bounce(): void;
  feedback(text: string, tone: 'good' | 'bad' | 'neutral'): void;
}

/** Una pelota que viene de vuelta: dónde cae en tu línea y en cuántos segundos. */
export interface Incoming {
  ball: Ball;
  x: number;
  eta: number;
}

/** Los colores de la pelota que viene: le llegás, estás cerca, no llegás. */
const REACH_COLORS = { ok: 0x5be07a, near: 0xffd21f, far: 0xff3b3b };
/** Los del círculo del timing: si soltaras ahora, golpe 3, golpe 2, o todavía no. */
const TIMING_COLORS = [0xffffff, 0xffd21f, 0x5be07a];
/** Cuánto sube la pelota del saque, en m, desde la mano. */
const TOSS_HEIGHT = 2.2;

type Prep =
  /** Preparado para devolver: `ball` es la que viene (null mientras no venga ninguna). */
  | { kind: 'return'; ball: Ball | null; releasedAt: number | null }
  /** Sacando: la pelota está en el aire desde `startAt`. */
  | { kind: 'serve'; startAt: number };

export class TennisPlay {
  private prep: Prep | null = null;
  /** La que se devuelve en este golpe (ya va a la raqueta), y si el golpe es un saque. */
  private rehit: Ball | null = null;
  private serving = false;
  /** El nivel del golpe que está saliendo. */
  private quality = 1;
  /** El momento justo del último golpe que salió sin soltar: soltando un toque tarde, todavía mejora. */
  private late: { perfectAt: number; ball: Ball | null } | null = null;
  private commitAt = 0;
  /** Segundos entre decidir el golpe y el impacto del swing: se mide en cada golpe. */
  private lead = 0.15;
  private readonly tossMesh: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly marks: THREE.Mesh[] = [];
  private readonly markGeo = new THREE.RingGeometry(0.35, 0.55, 24);

  constructor(private readonly host: TennisHost) {
    this.tossMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS * 1.35, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8ff6a, emissive: 0xc8e04a, emissiveIntensity: 0.7 }));
    this.tossMesh.visible = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
    this.ring.renderOrder = 10;
    this.ring.visible = false;
    host.scene.add(this.tossMesh, this.ring);
  }

  private get player(): Player {
    return this.host.player();
  }

  /** Las que vienen de vuelta por el aire, de la que llega primero a la última. */
  incoming(): Incoming[] {
    const out: Incoming[] = [];
    for (const b of this.host.balls.returning) {
      if (b.arc) out.push({ ball: b, x: b.arc.to.x, eta: (1 - b.arc.t) * b.arc.time });
    }
    return out.sort((a, b) => a.eta - b.eta);
  }

  /** ¿Se puede apretar? Con una pelota que viene, o con una en el bolsillo para sacar. */
  canStart(): boolean {
    // con el golpe ya preparado, sí: la del saque ya salió del bolsillo (con una sola, quedaba vacío)
    return !!this.prep || this.host.pocket.count > 0 || this.incoming().length > 0;
  }

  /**
   * Apretó: si viene una pelota, se prepara para devolverla; si no, tira una del bolsillo para arriba y
   * saca. Devuelve false si no hay con qué.
   */
  press(): boolean {
    if (this.prep) return false;
    if (this.incoming().some((c) => c.eta <= TENNIS.returnTime + 0.3)) {
      this.prep = { kind: 'return', ball: null, releasedAt: null };
      return true;
    }
    if (!this.host.pocket.take()) return false;
    this.prep = { kind: 'serve', startAt: this.host.clock() };
    this.tossMesh.visible = true;
    return true;
  }

  /** Soltó. Devuelve true si el tenis se encarga (el swing no sale todavía, o no hay swing que soltar). */
  release(): boolean {
    const now = this.host.clock();
    const prep = this.prep;
    if (!prep) {
      // soltó un toque tarde, con el golpe ya saliendo: todavía mejora
      const late = this.late;
      if (late?.ball && now - late.perfectAt <= TENNIS.good) this.upgrade(late.ball, timingQuality(now - late.perfectAt));
      this.late = null;
      return true;
    }
    if (prep.kind === 'serve') {
      this.commit(timingQuality(now - (prep.startAt + TENNIS.tossTime)), null);
      return true;
    }
    if (prep.releasedAt === null) {
      prep.releasedAt = now;
      this.player.meter.lock();
    }
    return true;
  }

  /** Canceló (click derecho): la pelota del saque vuelve al bolsillo. */
  cancel(): void {
    if (this.prep?.kind === 'serve') this.host.pocket.add(1);
    this.prep = null;
    this.tossMesh.visible = false;
  }

  /** El impacto del swing: ¿hay pelota? La que se devuelve, o la del saque (ya salió del bolsillo). */
  fire(): boolean {
    const now = this.host.clock();
    this.lead = THREE.MathUtils.clamp(this.lead * 0.7 + (now - this.commitAt) * 0.3, 0.05, 0.5);
    this.tossMesh.visible = false;
    return !!this.rehit || this.serving;
  }

  /** Lo que el tiro necesita en el impacto: su nivel, y la pelota que se devolvió (si fue eso). */
  shot(): { quality: number; back: Ball | null } {
    const back = this.rehit;
    this.rehit = null;
    this.serving = false;
    return { quality: this.quality, back };
  }

  /** Salió la pelota: si el golpe salió sin soltar, soltando un toque tarde todavía mejora. */
  fired(ball: Ball): void {
    if (this.late) this.late.ball = ball;
  }

  /** Decide el golpe: el nivel ya está, y el swing baja para que el impacto caiga cuando llega la pelota. */
  private commit(quality: number, ball: Ball | null, perfectAt = 0, lateOk = false): void {
    const p = this.player;
    this.quality = quality;
    this.rehit = ball;
    this.serving = !ball;
    this.late = lateOk ? { perfectAt, ball: null } : null;
    this.prep = null;
    if (ball) {
      // sigue derecho hasta la raqueta, y sale de ahí: por donde marca la línea de tiro
      const racket = new THREE.Vector3(p.anchor.x, 0.9, TEE_LINE_Z);
      const arc = ball.arc;
      const speed = arc ? Math.hypot(arc.to.x - arc.from.x, arc.to.z - arc.from.z) / arc.time : 20;
      this.host.balls.hold(ball, racket, Math.max(speed, ball.mesh.position.distanceTo(racket) / Math.max(0.05, this.lead)));
    }
    this.commitAt = this.host.clock();
    this.host.whoosh(quality / 3);
    p.releaseSwing();
  }

  /** Sube el nivel de una pelota que ya salió: más rápida y más daño. */
  private upgrade(ball: Ball, quality: number): void {
    if (quality <= ball.quality || ball.done) return;
    ball.quality = quality;
    const v = ball.state.vel;
    const speed = Math.hypot(v.x, v.z);
    const want = TENNIS.outSpeed[quality - 1] ?? speed;
    if (speed > 0.01 && ball.phase === 'out') {
      v.x *= want / speed;
      v.z *= want / speed;
    }
  }

  update(dt: number): void {
    const host = this.host;
    const p = this.player;
    const now = host.clock();
    const pocket = host.pocket;
    const at = new THREE.Vector3(p.anchor.x, 1.1, TEE_LINE_Z);
    pocket.update(dt, at);
    host.court.update(dt);
    p.ghost = !TENNIS.hurtPlayer;
    if (this.late && now - this.late.perfectAt > TENNIS.good) this.late = null;

    // el golpe que se estaba preparando se cortó (le pegaron, lo agarraron)
    if (this.prep && p.mode !== 'charging') this.cancel();
    const incoming = this.incoming();
    const prep = this.prep;
    let ringAt: THREE.Vector3 | null = null;
    let ringEta = 0;
    let ringErr: number | null = null;
    if (prep?.kind === 'serve') {
      // la pelota del saque sube y baja; arriba es el momento justo. Si no soltás, sale al caer
      const t = now - prep.startAt;
      const u = (t - TENNIS.tossTime) / TENNIS.tossTime;
      this.tossMesh.position.set(p.anchor.x + 0.25, 1.1 + TOSS_HEIGHT * Math.max(0, 1 - u * u), TEE_LINE_Z + 0.2);
      ringAt = this.tossMesh.position;
      ringEta = TENNIS.tossTime - t;
      if (t >= TENNIS.tossTime * 1.6) this.commit(1, null);
    } else if (prep?.kind === 'return') {
      if (prep.ball && (prep.ball.done || prep.ball.phase !== 'back')) prep.ball = null;
      const target = prep.ball ? incoming.find((c) => c.ball === prep.ball) : incoming.find((c) => c.eta <= TENNIS.returnTime + 0.3);
      if (!target) {
        // soltó y no viene nada: no hay golpe
        if (prep.releasedAt !== null) {
          p.cancelSwing();
          this.prep = null;
        }
      } else {
        prep.ball = target.ball;
        ringAt = target.ball.mesh.position;
        ringEta = target.eta;
        if (prep.releasedAt !== null) ringErr = prep.releasedAt - (now + target.eta);
        if (target.eta <= this.lead) {
          const arriveAt = now + target.eta;
          if (Math.abs(target.x - p.anchor.x) <= TENNIS.reach) {
            const released = prep.releasedAt;
            this.commit(released !== null ? timingQuality(released - arriveAt) : 1, target.ball, arriveAt, released === null);
          } else {
            // no llegó: la pelota cae en la línea. Si ya había soltado, no hay golpe
            prep.ball = null;
            if (prep.releasedAt !== null) {
              p.cancelSwing();
              this.prep = null;
            }
          }
        }
      }
    }
    // sin preparar, el círculo igual avisa de la próxima que viene a tu alcance
    if (!ringAt) {
      const next = incoming.find((c) => c.eta < 1.2 && Math.abs(c.x - p.anchor.x) <= TENNIS.reach + 3);
      if (next) {
        ringAt = next.ball.mesh.position;
        ringEta = next.eta;
      }
    }
    this.drawRing(ringAt, ringEta, ringErr);

    // levantar: pasarle por encima a una que quedó en el piso
    for (const b of host.balls.onFloor) {
      if (Math.abs(b.state.pos.x - p.anchor.x) > TENNIS.pickReach || pocket.count >= pocket.max) continue;
      host.balls.retire(b);
      pocket.add(1);
      host.bounce();
      host.feedback('+1 pelota', 'neutral');
    }
    // sin pelota en ningún lado (ni en el bolsillo, ni en el piso, ni en juego): el alcanzapelotas te tira una
    const inPlay = host.balls.list.some((b) => !b.done && b.phase !== null) || this.prep?.kind === 'serve' || this.serving;
    if (host.active() && pocket.count === 0 && pocket.incoming === 0 && !inPlay) pocket.toss(at);

    // Cada pelota que viene: verde si le llegás, amarilla si estás cerca, roja si no. La marca en la línea
    // dice dónde cae (y se achica a medida que te acercás); la pelota y su estela toman el color
    let n = 0;
    for (const c of incoming) {
      const dx = Math.abs(c.x - p.anchor.x);
      const color = dx <= TENNIS.reach ? REACH_COLORS.ok : dx <= TENNIS.reach + 3 ? REACH_COLORS.near : REACH_COLORS.far;
      const m = this.mark(n++);
      m.visible = true;
      m.position.set(c.x, 0.04, TEE_LINE_Z);
      m.scale.setScalar(dx <= TENNIS.reach ? 1 : Math.min(3.2, 1 + (dx - TENNIS.reach) * 0.3));
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      (c.ball.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(color);
      (c.ball.trail.material as THREE.LineBasicMaterial).color.setHex(color);
    }
    for (let i = n; i < this.marks.length; i++) this.marks[i].visible = false;
  }

  /**
   * El círculo del timing, alrededor de la pelota y de frente a la cámara: se cierra a medida que se
   * acerca el momento justo. Su color dice qué golpe saldría si soltaras ahora (o, si ya soltaste, cuál
   * va a salir).
   */
  private drawRing(at: THREE.Vector3 | null, eta: number, released: number | null): void {
    this.ring.visible = !!at && eta > -TENNIS.good;
    if (!at) return;
    this.ring.position.copy(at);
    this.ring.quaternion.copy(this.host.camera.quaternion);
    this.ring.scale.setScalar(0.25 + Math.max(0, eta) * 1.6);
    const q = timingQuality(released ?? -eta);
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(TIMING_COLORS[q - 1]);
  }

  private mark(i: number): THREE.Mesh {
    let m = this.marks[i];
    if (!m) {
      m = new THREE.Mesh(this.markGeo, new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      this.host.scene.add(m);
      this.marks.push(m);
    }
    return m;
  }
}
