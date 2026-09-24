import * as THREE from 'three';
import { CLUB_ORDER, CLUBS, MELEE_COOLDOWN, qualityOf, SHIFT, type Club, type ClubId } from '../core/clubs';
import { SwingMeter } from '../core/swing';
import { LayeredAnimator } from './animator';
import type { Enemy } from './enemies';
import { analyzeSwing, downswingTimeFor, type SwingClip } from './golfClips';
import { CLUB_LENGTH, SwingRig, TEE_OFFSET } from './swingPose';
import { TEE_Z } from './tees';

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export type PlayerMode = 'free' | 'charging' | 'swinging' | 'melee';

export interface Shot {
  club: Club;
  /** Calidad del golpe: 1, 2 o 3. Puro timing; la distancia la decide el mouse. */
  quality: number;
  /** Potencia cruda al soltar, para los sonidos. */
  power: number;
  from: THREE.Vector3;
  dir: THREE.Vector3;
}

/** Tiempos del swing procedural (sin clips) una vez que se suelta, en segundos. */
const DOWNSWING = 0.11;
const FOLLOW = 0.24;
const HOLD = 0.14;
const FOLLOW_PHI = 3.3;

/** Qué clip de Mixamo usa cada palo. */
const SWING_CLIP: Record<ClubId, string> = { driver: 'Golf Drive', iron: 'Golf Drive', wedge: 'Golf Chip', putter: 'Golf Putt' };
/** Velocidad de reproducción de la bajada y del final del clip. */
const DOWNSWING_SPEED = 1.6;
const FOLLOW_SPEED = 1.35;
/** Aun con potencia mínima el palo se levanta un poco. */
const MIN_BACKSWING = 0.3;
/** Segundos después del impacto a partir de los cuales ya se puede cargar otro tiro. */
const RECOVER = 0.22;
/** Cuánto vale un toque de movimiento apretado durante un tiro. Es un buffer, no una cola. */
const STEP_BUFFER = 0.4;
/**
 * El golfista nunca queda delante de la pelota: la línea de los puestos es el borde del campo y no la
 * pisa. Es casi cero a propósito: en la postura de golf el cuerpo queda **al costado** de la pelota, no
 * atrás, así que pedirle más lo dejaba girado siempre para el mismo lado. De acá sale hasta dónde puede
 * girar la pose (ver `stanceYaw`).
 */
const STANCE_BEHIND = 0.05;
/** De puesto en puesto con easing: arranca y frena suave. Un puesto (4 m) lleva unos 0.4 s. */
const RUN_SMOOTH_TIME = 0.12;
const RUN_MAX_SPEED = 30;
/** Segundos de invulnerabilidad después de recibir un golpe. */
const HIT_GRACE = 1.2;
/** Palazo: el clip de swing, desde el tope, bien rápido; y cuánto dura el gesto después del golpe. */
const MELEE_SPEED = 3.2;
const MELEE_FOLLOW = 0.22;
/** Palazo sin clips de golf: segundos hasta el golpe. */
const MELEE_WINDUP = 0.09;

export class Player {
  readonly root: THREE.Object3D;
  /**
   * Dónde está parado el golfista. **Sale de la pelota, no al revés**: el ancla es el puesto (donde
   * está la pelota) y el cuerpo se acomoda alrededor según hacia dónde apunta. Antes era al revés y se
   * veía la pelota girando alrededor del personaje, que es lo que nadie hace en el golf.
   */
  readonly position: THREE.Vector3;
  /** El puesto: dónde está apoyada la pelota. Quieta mientras no te movés de puesto. */
  readonly anchor = new THREE.Vector3(0, 0, TEE_Z);
  readonly animator: LayeredAnimator;
  readonly rig: SwingRig;
  readonly meter = new SwingMeter();
  readonly maxHp = 3;
  hp = 3;
  /** Posición x de cada puesto de tiro, de menor a mayor. El golfista solo se mueve entre ellos. */
  spotXs: number[] = [0];
  /** Puesto al que va (o en el que está). */
  spotIndex = 0;
  /** Velocidad lateral actual, para el easing entre puestos. */
  private runVel = 0;
  /** ¿Hay pelota en este puesto? El tiro la consume. */
  canFire: (() => boolean) | null = null;
  /** ¿Se puede empezar a cargar? Sin pelota en el puesto, no: cargar para pegarle al aire solo frustraba. */
  canStart: (() => boolean) | null = null;
  /** El swing no encontró pelota. */
  onWhiff: (() => void) | null = null;
  club: Club = CLUBS.driver;
  mode: PlayerMode = 'free';
  /** Hacia dónde apunta (unitario en el plano). Lo fija el juego en cada cuadro desde el mouse. */
  readonly aimDir = new THREE.Vector3(0, 0, 1);
  /** Se llama en el instante del impacto del palo con la pelota. */
  onShot: ((shot: Shot) => void) | null = null;
  /** Clips de swing analizados, por nombre. Vacío si el modelo no trae clips de golf. */
  readonly swingClips = new Map<string, SwingClip>();
  /** Palo elegido durante un tiro, esperando a que el tiro termine o se cancele. */
  pendingClub: Club | null = null;
  /**
   * Los cuatro palos están desde el principio: elegir palo es una decisión táctica, no un premio.
   * Lo que las oleadas van dando son las **habilidades** (ver game/abilities).
   */
  readonly unlocked = new Set<ClubId>(CLUB_ORDER);
  /** Segundos de recarga que le quedan al palazo. */
  meleeCooldown = 0;
  /** Se llama en el instante en que el palazo conecta. */
  onMelee: (() => void) | null = null;
  private meleeHit = false;
  private meleeTime = 0;
  /** El alma en pena que lo tiene agarrado: no puede caminar ni tirar hasta sacársela a palazos. */
  grabbedBy: Enemy | null = null;
  private yaw = 0;
  /** Invulnerable un instante después de recibir un golpe. */
  private blinkTimer = 0;
  private knockTimer = 0;
  private readonly knockDir = new THREE.Vector3();
  private flashTimer = 0;
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private swingTime = 0;
  private swingFromPhi = 0;
  private swingShot: { power: number; perfect: boolean; reach: number } | null = null;
  /** Avance del backswing, 0..1, suavizado detrás del medidor. */
  private backswing = 0;
  private sinceImpact = 0;
  /** Toque de movimiento apretado durante un tiro: se guarda uno solo y vence solo. */
  private bufferedStep = 0;
  private bufferLeft = 0;

  constructor(model: THREE.Object3D, clips: THREE.AnimationClip[], scene: THREE.Scene, clubModel: THREE.Object3D | null = null) {
    this.root = model;
    this.position = model.position;
    this.animator = new LayeredAnimator(model, clips);
    this.rig = new SwingRig(model, scene, clubModel);
    for (const name of new Set(Object.values(SWING_CLIP))) {
      const clip = clips.find((c) => c.name === name);
      const info = clip && analyzeSwing(model, clip, CLUB_LENGTH);
      if (info) this.swingClips.set(name, info);
    }
    this.setClub(this.club);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) this.materials.push(m as THREE.MeshStandardMaterial);
    });
  }

  /** El clip de swing del palo en uso, o null si hay que usar el swing procedural. */
  private get swingClip(): SwingClip | null {
    return this.swingClips.get(SWING_CLIP[this.club.id]) ?? null;
  }

  /** Invulnerable un instante al llegar de un salto. */
  get invulnerable(): boolean {
    return this.blinkTimer > 0;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get stunned(): boolean {
    return this.knockTimer > 0;
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  /** Dónde está apoyada la pelota: en el puesto, quieta. Apuntar mueve al golfista, no a la pelota. */
  teePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.anchor.x, 0, this.anchor.z);
  }

  /**
   * Dónde tiene que pararse el cuerpo para que la pelota le quede en el lugar de la postura. Nunca
   * delante de la pelota: la línea de los puestos es el borde del campo y el golfista no lo pisa.
   */
  private stancePosition(out: THREE.Vector3): THREE.Vector3 {
    const yaw = this.stanceYaw();
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    const tee = this.swingClip?.tee ?? TEE_OFFSET;
    // el offset local (x, z) rotado al mundo, restado: es el inverso de "la pelota respecto del cuerpo"
    const z = this.anchor.z - (-tee.x * s + tee.z * c);
    return out.set(this.anchor.x - (tee.x * c + tee.z * s), 0, Math.min(z, this.anchor.z - STANCE_BEHIND));
  }

  /**
   * Yaw de la postura. **Se clampea para que el cuerpo nunca quede delante de la pelota**: la línea de
   * los puestos es el borde del campo y el golfista no lo pisa. Pasado ese ángulo la pose se queda
   * quieta aunque el tiro siga abriéndose; la pelota igual sale hacia `aimDir`, porque el tiro no
   * depende de la pose.
   *
   * El límite sale de la geometría, no de un número a ojo. El cuerpo queda detrás de la pelota cuando
   * `-tee.x·sin(y) + tee.z·cos(y) >= STANCE_BEHIND`, que es `R·sin(y + φ) >= d`: de ahí salen los dos
   * extremos del arco permitido.
   */
  private stanceYaw(): number {
    const aim = Math.atan2(this.aimDir.x, this.aimDir.z);
    const yaw = aim - (this.swingClip?.flightYaw ?? Math.PI / 2);
    const tee = this.swingClip?.tee ?? TEE_OFFSET;
    const r = Math.hypot(tee.x, tee.z);
    if (r < 0.01) return yaw;
    const phi = Math.atan2(tee.z, -tee.x);
    const asinArg = Math.min(1, STANCE_BEHIND / r);
    const lo = Math.asin(asinArg) - phi;
    const hi = Math.PI - Math.asin(asinArg) - phi;
    return THREE.MathUtils.clamp(yaw, lo, hi);
  }

  /**
   * Cambia de palo: cambia la distancia a la que pega y cómo llega la pelota. Mientras se carga cambia
   * en el acto y la carga arranca de nuevo. Con el swing ya bajando no se puede cambiar lo que está en
   * las manos: el pedido queda en cola y entra cuando el tiro termina.
   */
  setClub(club: Club): void {
    if (!this.unlocked.has(club.id)) return;
    if (this.mode === 'charging') {
      this.pendingClub = null;
      if (club.id === this.club.id) return;
      // si se había corrido con la pelota, sigue corrido: cambiar de palo no lo devuelve al puesto
      const kept = this.shift;
      this.cancelSwing();
      this.applyClub(club);
      this.anchor.x = this.spotXs[this.spotIndex];
      this.startSwing();
      this.shiftStance(kept);
      return;
    }
    if (this.mode !== 'free') {
      this.pendingClub = club.id === this.club.id ? null : club;
      return;
    }
    this.applyClub(club);
  }

  private applyClub(club: Club): void {
    this.pendingClub = null;
    this.club = club;
    this.rig.setClub(club);
    this.rig.grip = this.swingClip;
  }

  startSwing(): void {
    const recovered = this.mode === 'swinging' && !this.swingShot && this.sinceImpact >= RECOVER;
    if ((this.mode !== 'free' && !recovered) || this.grabbedBy || this.stunned || !this.alive || !this.atSpot) return;
    if (this.canStart && !this.canStart()) return;
    // encadenar otro tiro apenas pasó el impacto también cuenta como fin del tiro anterior
    if (this.pendingClub) this.applyClub(this.pendingClub);
    this.mode = 'charging';
    this.shift = 0;
    this.backswing = 0;
    this.meter.start(this.club.chargeTime);
  }

  releaseSwing(): void {
    if (this.mode !== 'charging') return;
    this.swingShot = this.meter.release();
    this.mode = 'swinging';
    this.swingTime = 0;
    this.sinceImpact = 0;
    this.swingFromPhi = this.rig.phi;
    const clip = this.swingClip;
    if (clip) this.animator.resumeOneShot(downswingTimeFor(clip, this.backswingTime(clip)), DOWNSWING_SPEED);
  }

  /** Clava el daño donde está la barra: el tiro sale con ese nivel cuando se suelte. */
  lockSwing(): boolean {
    return this.mode === 'charging' && this.meter.lock();
  }

  /**
   * Vuelve a empezar la carga desde cero, y la destraba si estaba clavada. Es la segunda apretada de la
   * barra espaciadora: clavaste un nivel que no era y querés otro, sin soltar el tiro ni cancelarlo.
   */
  restartCharge(): boolean {
    if (this.mode !== 'charging') return false;
    this.backswing = 0;
    this.meter.start(this.club.chargeTime);
    return true;
  }

  cancelSwing(): void {
    if (this.mode !== 'charging') return;
    this.meter.cancel();
    this.mode = 'free';
    if (this.swingClip) this.animator.clearOneShot();
  }

  /**
   * Palazo: golpe corto a lo que tenga encima, con recarga propia. Corta la carga de un tiro, pero no
   * un swing que ya está bajando. Es también la única forma de sacarse de encima a un alma en pena.
   */
  startMelee(): boolean {
    if (this.meleeCooldown > 0 || this.stunned || !this.alive) return false;
    if (this.mode === 'charging') this.cancelSwing();
    if (this.mode !== 'free') return false;
    this.mode = 'melee';
    this.meleeHit = false;
    this.meleeTime = 0;
    this.meleeCooldown = MELEE_COOLDOWN;
    const clip = this.swingClip;
    if (clip) {
      this.animator.poseOneShot(clip.name, clip.top);
      this.animator.resumeOneShot(clip.top, MELEE_SPEED);
    } else {
      this.rig.phi = -2.4;
    }
    return true;
  }

  private updateMelee(dt: number): void {
    this.meleeTime += dt;
    const clip = this.swingClip;
    const t = this.animator.oneShotTime;
    const reached = clip ? t < 0 || t >= clip.impact : this.meleeTime >= MELEE_WINDUP;
    if (!clip) this.rig.phi = this.meleeHit ? 2.2 : -2.4 * (1 - this.meleeTime / MELEE_WINDUP);
    if (!this.meleeHit && reached) {
      this.meleeHit = true;
      this.meleeTime = 0;
      this.onMelee?.();
    }
    if (this.meleeHit && this.meleeTime >= MELEE_FOLLOW) {
      if (clip) this.animator.clearOneShot();
      this.mode = 'free';
    }
  }

  /** Ya llegó al puesto al que iba. */
  get atSpot(): boolean {
    return Math.abs(this.anchor.x - this.spotXs[this.spotIndex]) < 0.05;
  }

  /** Cuánto se corrió del puesto cargando el tiro, en metros de x (ver `SHIFT`). */
  shift = 0;

  /**
   * Se corre `dx` metros con la pelota, sin cambiar de puesto. Solo mientras carga, y nunca más de
   * `SHIFT.reach` para cada lado: es para alinearse con una fila, no para caminar.
   */
  shiftStance(dx: number): void {
    if (this.mode !== 'charging' || SHIFT.mode === 'apagado') return;
    this.shift = THREE.MathUtils.clamp(this.shift + dx, -SHIFT.reach, SHIFT.reach);
    this.anchor.x = this.spotXs[this.spotIndex] + this.shift;
  }

  /**
   * El puesto cuya pelota tiene a los pies, o -1. Parado en el puesto, o corrido un poco cargando el
   * tiro, que se lleva la pelota con él.
   */
  stanceSpot(): number {
    const off = Math.abs(this.anchor.x - this.spotXs[this.spotIndex]);
    const inStance = this.mode === 'charging' || this.mode === 'swinging';
    return off < 0.1 || (inStance && off <= SHIFT.reach + 0.05) ? this.spotIndex : -1;
  }

  /**
   * Pide moverse `delta` puestos. Con el golfista libre se acumula: dos toques seguidos son dos puestos.
   * **Durante un tiro, no.** Ahí se guarda un solo toque, el último, y vale poco tiempo: apretar dos
   * veces mientras cargás no te tiene que mandar dos puestos cuando el tiro termina, tres segundos
   * después. Es un buffer para el toque que llega justo sobre el final, no una cola.
   */
  step(delta: number): void {
    if (!this.alive) return;
    // cargando, A y D corren con la pelota en vez de anotar un cambio de puesto (ver `SHIFT`). En el
    // modo continuo el toque no hace nada: lo que mueve es mantener apretado
    if (this.mode === 'charging' && SHIFT.mode !== 'apagado') {
      if (SHIFT.mode === 'pasos') this.shiftStance(delta * SHIFT.step);
      return;
    }
    if (this.busy) {
      this.bufferedStep = delta;
      this.bufferLeft = STEP_BUFFER;
      return;
    }
    this.spotIndex = Math.min(this.spotXs.length - 1, Math.max(0, this.spotIndex + delta));
  }

  /** Está en medio de un tiro o no se puede mover por otra razón. */
  private get busy(): boolean {
    return this.grabbedBy !== null || this.stunned || (this.mode !== 'free' && !this.shotDone);
  }

  /** El tiro ya salió y el gesto está terminando: desde acá ya se puede empezar a correr. */
  private get shotDone(): boolean {
    return this.mode === 'swinging' && !this.swingShot && this.sinceImpact >= RECOVER;
  }

  /** Lo planta en un puesto, sin correr (arranque, cambio de skin). */
  placeAt(index: number): void {
    this.spotIndex = Math.min(this.spotXs.length - 1, Math.max(0, index));
    this.anchor.set(this.spotXs[this.spotIndex], 0, TEE_Z);
    this.stancePosition(this.position);
  }

  /** Un alma en pena lo agarra: corta lo que estuviera haciendo. Se sale a palazos. */
  grab(by: Enemy): void {
    this.grabbedBy = by;
    this.meter.cancel();
    this.swingShot = null;
    if (this.mode !== 'free') this.animator.clearOneShot();
    this.mode = 'free';
  }

  release(by: Enemy): void {
    if (this.grabbedBy === by) this.grabbedBy = null;
  }

  /** Daño sostenido (agarre): saca vida sin empujar ni cortar nada. */
  drain(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.flashTimer = 0.2;
    if (this.hp <= 0) {
      this.grabbedBy = null;
      this.mode = 'free';
      this.animator.playOneShot('Hard Landing', 1, true, 0.42);
    }
  }

  /** Recibe un golpe desde `from`: pierde vida, retrocede, parpadea en rojo. */
  hit(amount: number, from: THREE.Vector3): void {
    if (!this.alive || this.invulnerable) return;
    this.hp = Math.max(0, this.hp - amount);
    this.flashTimer = 0.25;
    // con 3 de vida, un golpe da un respiro: invulnerable un momento, titilando
    this.blinkTimer = HIT_GRACE;
    this.meter.cancel();
    this.swingShot = null;
    if (this.mode !== 'free') this.animator.clearOneShot();
    this.mode = 'free';
    if (this.hp <= 0) {
      this.knockTimer = 0;
      this.animator.playOneShot('Hard Landing', 1, true, 0.42);
      return;
    }
    this.knockDir.subVectors(this.position, from).setY(0).normalize();
    this.knockTimer = 0.3;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.root, this.rig.club);
    for (const m of this.materials) m.dispose();
  }

  heal(amount: number): void {
    if (this.alive) this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt: number): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const on = this.flashTimer > 0 && Math.floor(this.flashTimer * 20) % 2 === 0;
      for (const m of this.materials) m.emissive.setHex(on ? 0x8a1a1a : 0x000000);
    }
    this.meter.update(dt);
    if (this.blinkTimer > 0) this.blinkTimer -= dt;
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    if (this.grabbedBy && (!this.grabbedBy.alive || !this.grabbedBy.grabbing)) this.grabbedBy = null;
    // el tiro terminó o se canceló (por el jugador o por un golpe recibido): entra el palo en cola
    if (this.mode === 'free' && this.pendingClub) this.applyClub(this.pendingClub);
    // el toque de movimiento guardado durante el tiro: entra apenas se puede, y si tardó mucho se pierde
    if (this.bufferLeft > 0) {
      this.bufferLeft -= dt;
      if (!this.busy) {
        this.spotIndex = Math.min(this.spotXs.length - 1, Math.max(0, this.spotIndex + this.bufferedStep));
        this.bufferLeft = 0;
      }
    }

    let stance = false;
    if (this.stunned) {
      this.knockTimer -= dt;
      this.animator.setLocomotion('Idle', 1);
    } else if (!this.alive) {
      // queda en el piso
    } else if (this.mode === 'melee') {
      stance = true;
      this.yaw = lerpAngle(this.yaw, this.stanceYaw(), 1 - Math.exp(-30 * dt));
      this.updateMelee(dt);
      this.animator.setLocomotion('Idle', 1);
    } else if (this.grabbedBy) {
      // agarrado: forcejea en el lugar, mirando a quien lo tiene
      const g = this.grabbedBy.position;
      this.yaw = lerpAngle(this.yaw, Math.atan2(g.x - this.position.x, g.z - this.position.z), 1 - Math.exp(-10 * dt));
      this.animator.setLocomotion('Idle', 1.6);
    } else if (this.mode === 'charging') {
      stance = true;
      this.yaw = lerpAngle(this.yaw, this.stanceYaw(), 1 - Math.exp(-16 * dt));
      this.backswing += (this.meter.power - this.backswing) * (1 - Math.exp(-18 * dt));
      const clip = this.swingClip;
      if (clip) this.animator.poseOneShot(clip.name, this.backswingTime(clip));
      else this.rig.phi = -(0.6 + 3.0 * this.backswing);
      this.animator.setLocomotion('Idle', 1);
    } else if (this.mode === 'swinging' && !this.swingShot && this.sinceImpact >= RECOVER && !this.atSpot) {
      // ya pegó y quiere irse: corta el final del gesto y sale corriendo
      if (this.swingClip) this.animator.clearOneShot();
      this.mode = 'free';
    } else if (this.mode === 'swinging') {
      stance = true;
      if (this.swingClip) this.updateClipSwing(dt, this.swingClip);
      else this.updateSwing(dt);
      this.animator.setLocomotion('Idle', 1);
    } else {
      // de puesto en puesto, con easing (resorte amortiguado crítico: arranca y frena suave). Cada toque
      // es un puesto: mantener apretado no repite
      const goal = this.spotXs[this.spotIndex];
      const dx = goal - this.anchor.x;
      if (Math.abs(dx) >= 0.05) {
        const omega = 2 / RUN_SMOOTH_TIME;
        const x = omega * dt;
        const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        const change = THREE.MathUtils.clamp(-dx, -RUN_MAX_SPEED * RUN_SMOOTH_TIME, RUN_MAX_SPEED * RUN_SMOOTH_TIME);
        const temp = (this.runVel + omega * change) * dt;
        this.runVel = (this.runVel - omega * temp) * decay;
        let next = this.anchor.x - change + (change + temp) * decay;
        // no se pasa de largo
        if ((goal - this.anchor.x > 0) === (next > goal)) { next = goal; this.runVel = 0; }
        this.anchor.x = next;
        if (Math.abs(goal - this.anchor.x) < 0.05) { this.anchor.x = goal; this.runVel = 0; }
        this.yaw = lerpAngle(this.yaw, Math.atan2(Math.sign(dx), 0), 1 - Math.exp(-30 * dt));
        this.animator.setLocomotion('Running', THREE.MathUtils.clamp(Math.abs(this.runVel) / 8, 0.9, 2.4));
      } else {
        this.runVel = 0;
        this.yaw = lerpAngle(this.yaw, Math.atan2(this.aimDir.x, this.aimDir.z), 1 - Math.exp(-8 * dt));
        this.animator.setLocomotion('Idle', 1);
      }
    }

    // la postura entra rápido y sale suave
    const k = 1 - Math.exp(-(stance ? 20 : 9) * dt);
    this.rig.weight += ((stance ? 1 : 0) - this.rig.weight) * k;
    if (!stance && this.rig.weight < 0.02) {
      this.rig.weight = 0;
      this.rig.phi = 0;
    }

    // el cuerpo se acomoda alrededor de la pelota, que se queda en el puesto
    this.stancePosition(this.position);
    // mientras es invulnerable, titila
    this.root.visible = !(this.alive && this.blinkTimer > 0 && Math.floor(this.blinkTimer * 14) % 2 === 1);
    this.root.rotation.y = this.yaw;
    this.animator.update(dt);
    this.rig.apply();
  }

  /** Solo para depurar: mientras carga, deja el clip de swing clavado en este instante. */
  debugPoseTime: number | null = null;

  /** Instante del clip que corresponde al backswing actual. */
  private backswingTime(clip: SwingClip): number {
    if (this.debugPoseTime !== null) return this.debugPoseTime;
    const u = MIN_BACKSWING + (1 - MIN_BACKSWING) * this.backswing;
    return clip.address + (clip.top - clip.address) * u;
  }

  private fireShot(): void {
    const shot = this.swingShot;
    if (!shot) return;
    this.swingShot = null;
    // sin pelota en el puesto, el palo pasa de largo: no hay tiro ni recarga
    if (this.canFire && !this.canFire()) {
      this.onWhiff?.();
      return;
    }
    this.onShot?.({ club: this.club, quality: qualityOf(shot.power), power: shot.power, from: this.teePosition(new THREE.Vector3()), dir: this.aimDir.clone() });
  }

  /** Swing con clip de Mixamo: baja hasta el impacto, pega, y sigue hasta el final del gesto. */
  private updateClipSwing(dt: number, clip: SwingClip): void {
    const t = this.animator.oneShotTime;
    if (this.swingShot && (t < 0 || t >= clip.impact)) {
      this.fireShot();
      this.animator.setOneShotSpeed(FOLLOW_SPEED);
    }
    if (!this.swingShot) this.sinceImpact += dt;
    if (t < 0 || t >= clip.end) {
      this.animator.clearOneShot();
      this.mode = 'free';
    }
  }

  /** Swing procedural, para modelos sin clips de golf. */
  private updateSwing(dt: number): void {
    this.swingTime += dt;
    const t = this.swingTime;
    if (t < DOWNSWING) {
      const u = t / DOWNSWING;
      this.rig.phi = this.swingFromPhi * (1 - u * u);
      return;
    }
    this.fireShot();
    this.sinceImpact += dt;
    const u = Math.min(1, (t - DOWNSWING) / FOLLOW);
    this.rig.phi = FOLLOW_PHI * (1 - (1 - u) * (1 - u));
    if (t >= DOWNSWING + FOLLOW + HOLD) this.mode = 'free';
  }
}
