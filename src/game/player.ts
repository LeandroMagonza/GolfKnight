import * as THREE from 'three';
import { CLUBS, MELEE_COOLDOWN, type Club, type ClubId } from '../core/clubs';
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
  /** Potencia al soltar: define el daño y la fuerza del efecto. */
  power: number;
  /** Alcance 0..1: la carga máxima a la que se llegó. */
  reach: number;
  perfect: boolean;
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
/** Corre entre puestos así de rápido (m/s): tiene que sentirse casi como un salto. */
const RUN_SPEED = 24;
/** Segundos de invulnerabilidad después de recibir un golpe. */
const HIT_GRACE = 1.2;
/** Palazo: el clip de swing, desde el tope, bien rápido; y cuánto dura el gesto después del golpe. */
const MELEE_SPEED = 3.2;
const MELEE_FOLLOW = 0.22;
/** Palazo sin clips de golf: segundos hasta el golpe. */
const MELEE_WINDUP = 0.09;

export class Player {
  readonly root: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly animator: LayeredAnimator;
  readonly rig: SwingRig;
  readonly meter = new SwingMeter();
  readonly maxHp = 3;
  hp = 3;
  /** Posición x de cada puesto de tiro, de menor a mayor. El golfista solo se mueve entre ellos. */
  spotXs: number[] = [0];
  /** Puesto al que va (o en el que está). */
  spotIndex = 0;
  /** ¿Hay pelota en este puesto? Si no, el swing sale al aire. */
  canFire: (() => boolean) | null = null;
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
  /** Palos que ya se pueden usar. Las oleadas los van habilitando. */
  readonly unlocked = new Set<ClubId>(['driver']);
  /** Segundos de recarga que le quedan a cada palo. El del putter es la recarga del salto. */
  readonly cooldowns: Record<ClubId, number> = { driver: 0, iron: 0, wedge: 0, putter: 0 };
  /** Segundos de recarga que le quedan al palazo. */
  meleeCooldown = 0;
  /** Se llama en el instante en que el palazo conecta. */
  onMelee: (() => void) | null = null;
  private meleeHit = false;
  private meleeTime = 0;
  /** Se quiso usar un palo que todavía está recargando. */
  onDenied: ((club: Club) => void) | null = null;
  /** El alma en pena que lo tiene agarrado: no puede caminar ni pegar hasta saltar por el portal. */
  grabbedBy: Enemy | null = null;
  private yaw = 0;
  /** Invulnerable un instante después de saltar por el portal. */
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

  /** Dónde está apoyada la pelota en la postura de golf. */
  teePosition(out: THREE.Vector3): THREE.Vector3 {
    const yaw = this.stanceYaw();
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    const tee = this.swingClip?.tee ?? TEE_OFFSET;
    // local (x, z) -> mundo, rotando por el yaw
    return out.set(this.position.x + tee.x * c + tee.z * s, 0, this.position.z - tee.x * s + tee.z * c);
  }

  /** Yaw de la postura: el que hace que la pelota salga hacia aimDir. */
  private stanceYaw(): number {
    const clip = this.swingClip;
    // con clip, el modelo mira a flightYaw de la línea de tiro; sin clip, el objetivo queda a su izquierda (+X local)
    if (clip) return Math.atan2(this.aimDir.x, this.aimDir.z) - clip.flightYaw;
    return Math.atan2(-this.aimDir.z, this.aimDir.x);
  }

  /**
   * Cambia de palo. En medio de un tiro (cargando o pegando) no se puede cambiar lo que ya está en
   * las manos: el pedido queda en cola y entra solo cuando el tiro termina o se cancela. Pedir el
   * palo que ya está en uso vacía la cola.
   */
  setClub(club: Club): void {
    if (!this.unlocked.has(club.id)) return;
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
    // encadenar otro tiro apenas pasó el impacto también cuenta como fin del tiro anterior
    const next = this.pendingClub ?? this.club;
    if (this.cooldowns[next.id] > 0) {
      this.onDenied?.(next);
      return;
    }
    if (this.pendingClub) this.applyClub(this.pendingClub);
    this.mode = 'charging';
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

  cancelSwing(): void {
    if (this.mode !== 'charging') return;
    this.meter.cancel();
    this.mode = 'free';
    if (this.swingClip) this.animator.clearOneShot();
  }

  /**
   * Palazo: golpe corto a lo que tenga encima, con recarga propia. Corta la carga de un tiro, pero no
   * un swing que ya está bajando.
   */
  startMelee(): boolean {
    if (this.meleeCooldown > 0 || this.grabbedBy || this.stunned || !this.alive) return false;
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
    return Math.abs(this.position.x - this.spotXs[this.spotIndex]) < 0.05;
  }

  /** Pide moverse `delta` puestos. Se acumula: dos toques seguidos son dos puestos. */
  step(delta: number): void {
    if (!this.alive) return;
    this.spotIndex = Math.min(this.spotXs.length - 1, Math.max(0, this.spotIndex + delta));
  }

  /** Lo planta en un puesto, sin correr (arranque, cambio de skin). */
  placeAt(index: number): void {
    this.spotIndex = Math.min(this.spotXs.length - 1, Math.max(0, index));
    this.position.set(this.spotXs[this.spotIndex], 0, TEE_Z);
  }

  /** El salto del putter está listo. */
  get portalReady(): boolean {
    return this.cooldowns.putter <= 0;
  }

  /**
   * Salta por el portal hasta un puesto. No interrumpe la carga ni el swing: solo cambia de lugar.
   * Suelta cualquier agarre, da un instante de invulnerabilidad y arranca la recarga.
   */
  teleport(index: number): boolean {
    if (!this.alive || !this.portalReady) return false;
    this.placeAt(index);
    this.grabbedBy = null;
    this.knockTimer = 0;
    this.blinkTimer = 0.45;
    this.cooldowns.putter = CLUBS.putter.cooldown;
    return true;
  }

  /** Un alma en pena lo agarra: corta lo que estuviera haciendo y deja el salto listo para escapar. */
  grab(by: Enemy): void {
    this.grabbedBy = by;
    this.meter.cancel();
    this.swingShot = null;
    if (this.mode !== 'free') this.animator.clearOneShot();
    this.mode = 'free';
    this.cooldowns.putter = 0;
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
    for (const id of Object.keys(this.cooldowns) as ClubId[]) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
    if (this.grabbedBy && (!this.grabbedBy.alive || !this.grabbedBy.grabbing)) this.grabbedBy = null;
    // el tiro terminó o se canceló (por el jugador o por un golpe recibido): entra el palo en cola
    if (this.mode === 'free' && this.pendingClub) this.applyClub(this.pendingClub);

    let stance = false;
    if (this.stunned) {
      this.knockTimer -= dt;
      this.animator.setLocomotion('Idle', 1);
    } else if (!this.alive) {
      // queda en el piso
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
    } else if (this.mode === 'melee') {
      stance = true;
      this.yaw = lerpAngle(this.yaw, this.stanceYaw(), 1 - Math.exp(-30 * dt));
      this.updateMelee(dt);
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
      // de puesto en puesto, corriendo muy rápido. Cada toque es un puesto: mantener apretado no repite
      const dx = this.spotXs[this.spotIndex] - this.position.x;
      if (Math.abs(dx) >= 0.05) {
        const stepX = Math.sign(dx) * Math.min(Math.abs(dx), RUN_SPEED * dt);
        this.position.x += stepX;
        if (Math.abs(this.spotXs[this.spotIndex] - this.position.x) < 0.05) this.position.x = this.spotXs[this.spotIndex];
        this.yaw = lerpAngle(this.yaw, Math.atan2(Math.sign(dx), 0), 1 - Math.exp(-30 * dt));
        this.animator.setLocomotion('Running', 2.4);
      } else {
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

    this.position.z = TEE_Z;
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
    this.cooldowns[this.club.id] = this.club.cooldown;
    // un palo con recarga no se puede volver a usar enseguida: si no se eligió otro, vuelve solo el driver
    if (this.club.cooldown > 0 && !this.pendingClub && this.club.id !== 'driver') this.pendingClub = CLUBS.driver;
    this.onShot?.({ club: this.club, power: shot.power, reach: shot.reach, perfect: shot.perfect, from: this.teePosition(new THREE.Vector3()), dir: this.aimDir.clone() });
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
