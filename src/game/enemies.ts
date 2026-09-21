// La horda: goblins, esqueletos y un gólem, todos sacados del mismo GLB de personajes de
// PolygonDungeon (un esqueleto compartido con clips de Mixamo retargeteados). Caminan hacia la puerta
// de la ciudad, persiguen al golfista si lo tienen cerca y atacan a lo que alcancen. Los clips solo
// cubren la locomoción: el ataque, el conjuro y el lanzamiento se arman por código sobre los brazos.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { EXPLOSION_RADIUS, ICE_SLOW, KNOCK_DECAY } from '../core/clubs';
import { heightAt } from '../core/terrain';
import { ENEMIES, GOLEM_HOLD_Z, GOLEM_THROW_EVERY, GRAB_MAX, GRAB_TICK, SHAMAN_HOLD_Z, SHAMAN_WARD_RADIUS, SPEED_SPREAD, type EnemyKind, type EnemyStats } from '../core/waves';
import { LayeredAnimator } from './animator';
import type { Player } from './player';
import { rotateWorld } from './swingPose';
import { TEE_Z } from './tees';
import { FIELD_HALF_WIDTH, GATE_HALF_WIDTH, GATE_Z, SPAWN_Z } from './world';

/** A esta distancia (más su radio) un enemigo que pasa le pega al golfista. */
const TRAMPLE_REACH = 0.55;
/** Metros detrás de la línea de puestos a partir de los cuales un enemigo ya pasó: no se le pega más. */
const PASSED_BEHIND = 1.6;
/** El que pasó corre hasta la puerta a esta velocidad, para no quedarse a la vista sin poder tocarlo. */
const PASSED_SPEED = 9;
const BOMB_ENEMY_DAMAGE = 4;
const KAMIKAZE_FUSE = 0.6;
/** Segundos que tarda en caer un golpe dirigido al golfista, desde que levanta el brazo. */
const PLAYER_WINDUP = 0.75;
const ROCK_FLIGHT = 1.6;

export type EnemyState = 'walk' | 'attack' | 'dying' | 'gone';

export type HordeEvent =
  | { type: 'damage'; enemy: Enemy; amount: number; killed: boolean }
  | { type: 'attack'; enemy: Enemy }
  | { type: 'playerHit'; enemy: Enemy; amount: number }
  | { type: 'gateHit'; enemy: Enemy; amount: number }
  | { type: 'breach'; enemy: Enemy }
  | { type: 'trample'; enemy: Enemy }
  | { type: 'explosion'; pos: THREE.Vector3; radius: number }
  | { type: 'immune'; enemy: Enemy }
  | { type: 'grab'; enemy: Enemy }
  | { type: 'release'; enemy: Enemy }
  | { type: 'rockThrown'; enemy: Enemy }
  | { type: 'rockLanded'; pos: THREE.Vector3 };

interface Template {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  /** Factor de escala para que el modelo mida stats.height. */
  scale: number;
}

interface Rock {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  source: Enemy;
}

let nextId = 1;
const shadowGeo = new THREE.CircleGeometry(1, 20);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const shieldGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14);
const shieldMat = new THREE.MeshStandardMaterial({ color: 0x7a5a32, roughness: 0.8, metalness: 0.1 });
const shieldRimMat = new THREE.MeshStandardMaterial({ color: 0x3c3c3c, roughness: 0.5, metalness: 0.6 });
const auraGeo = new THREE.RingGeometry(0.96, 1, 64);
const rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 1, flatShading: true });

const CHILL_TINT = new THREE.Color(0x8fd0ff);

/** Suaviza entre 0 y 1. */
const smooth = (u: number) => u * u * (3 - 2 * u);

export class Enemy {
  readonly id = nextId++;
  readonly group = new THREE.Group();
  readonly position: THREE.Vector3;
  readonly animator: LayeredAnimator;
  readonly maxHp: number;
  hp: number;
  state: EnemyState = 'walk';
  /** A quién ataca en este momento. */
  target: 'gate' | 'player' = 'gate';
  /** Hielo del hierro: segundos que le quedan, de cuántos, y si está congelado del todo o solo lento. */
  chillTimer = 0;
  chillMax = 1;
  /** Bajo el aura de un chamán: inmune a todo daño. Lo recalcula la horda en cada cuadro. */
  warded = false;
  /** Ya pasó la línea del golfista: está fuera de juego (nada lo toca) y corre hasta la puerta. */
  passed = false;
  /** Alma en pena: tiene agarrado al golfista. */
  grabbing = false;
  private grabTime = 0;
  private grabTick = 0;
  /** Cada uno camina a su ritmo, en línea recta hacia la puerta: con eso las filas se arman y se desarman solas. */
  readonly speedMul = 1 + (Math.random() * 2 - 1) * SPEED_SPREAD;
  readonly knock = new THREE.Vector3();
  private yaw = Math.PI;
  private stunTimer = 0;
  private flashTimer = 0;
  private attackTime = 0;
  private attackHitAt = 0;
  private attackEnd = 0;
  private attackHitDone = false;
  private dyingTime = 0;
  /** Cuenta regresiva de la explosión de un kamikaze. */
  private fuse = -1;
  /** Reloj del chamán (cura) y del gólem (piedras). */
  private castTimer = 1.5;
  /** Cuánto del gesto de brazos por código se está aplicando (0..1) y en qué punto va. */
  private gesture = 0;
  private age = 0;
  private readonly model: THREE.Object3D;
  private readonly materials: { mat: THREE.MeshStandardMaterial; color: THREE.Color }[] = [];
  private readonly barBg: THREE.Sprite;
  private readonly barFill: THREE.Sprite;
  /** Cuánto hielo le queda, debajo de la barra de vida. */
  private readonly chillBg: THREE.Sprite;
  private readonly chillFill: THREE.Sprite;
  private pips: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; sprite: THREE.Sprite } | null = null;
  /** Aura del chamán, en el piso. */
  private readonly aura: THREE.Mesh | null = null;
  /** El escudo del guerrero. Se ve solo mientras sirve: con hielo encima desaparece. */
  private shieldMesh: THREE.Object3D | null = null;
  private readonly arms: THREE.Object3D[] = [];
  private readonly spine: THREE.Object3D | null;

  constructor(readonly stats: EnemyStats, template: Template) {
    this.position = this.group.position;
    this.maxHp = this.hp = stats.hp;
    this.model = cloneSkinned(template.scene);
    this.model.scale.setScalar(template.scale);
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.metalness = 0;
      mat.roughness = 0.85;
      if (stats.tint) mat.color.setHex(stats.tint);
      mesh.material = mat;
      this.materials.push({ mat, color: mat.color.clone() });
    });
    this.animator = new LayeredAnimator(this.model, template.clips);
    this.group.add(this.model);
    const right = this.model.getObjectByName('mixamorigRightArm');
    const left = this.model.getObjectByName('mixamorigLeftArm');
    if (right) this.arms.push(right);
    // el chamán conjura con los dos brazos, y el alma en pena agarra con los dos
    if (left && (stats.behavior === 'shaman' || stats.behavior === 'grabber')) this.arms.push(left);
    this.spine = this.model.getObjectByName('mixamorigSpine1') ?? null;

    if (stats.shield) {
      const shield = new THREE.Group();
      const disc = new THREE.Mesh(shieldGeo, shieldMat);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 18), shieldRimMat);
      disc.rotation.x = Math.PI / 2;
      shield.add(disc, rim);
      // adelante y un poco a la izquierda, en unidades del modelo sin escalar
      shield.position.set(0.22, 1.05, 0.42);
      this.model.add(shield);
      this.shieldMesh = shield;
    }

    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    shadow.scale.setScalar(stats.radius * 1.15);
    this.group.add(shadow);

    const barWidth = Math.max(1, stats.radius * 2.2);
    this.barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthTest: false }));
    this.barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x5be07a, depthTest: false }));
    for (const s of [this.barBg, this.barFill]) {
      s.center.set(0, 0.5);
      s.position.set(-barWidth / 2, stats.height + 0.45, 0);
      s.visible = false;
      s.renderOrder = 10;
      this.group.add(s);
    }
    this.barBg.scale.set(barWidth, 0.16, 1);
    this.barFill.scale.set(barWidth, 0.1, 1);
    this.barFill.renderOrder = 11;
    if (stats.hp <= 10) {
      const canvas = document.createElement('canvas');
      canvas.width = 32 * stats.hp;
      canvas.height = 32;
      const tex = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      const pip = Math.min(0.3, 2.4 / stats.hp);
      sprite.scale.set(pip * stats.hp, pip, 1);
      sprite.position.set(0, stats.height + 0.45, 0);
      sprite.renderOrder = 12;
      this.group.add(sprite);
      this.pips = { canvas, tex, sprite };
      this.drawPips();
    }

    this.chillBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x0a1a26, transparent: true, opacity: 0.75, depthTest: false }));
    this.chillFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x58c8ff, depthTest: false }));
    for (const s of [this.chillBg, this.chillFill]) {
      s.center.set(0, 0.5);
      s.position.set(-barWidth / 2, stats.height + 0.24, 0);
      s.visible = false;
      s.renderOrder = 10;
      this.group.add(s);
    }
    this.chillBg.scale.set(barWidth, 0.14, 1);
    this.chillFill.scale.set(barWidth, 0.09, 1);
    this.chillFill.renderOrder = 11;

    if (stats.behavior === 'shaman') {
      const mat = new THREE.MeshBasicMaterial({ color: 0xb26bff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      this.aura = new THREE.Mesh(auraGeo, mat);
      this.aura.rotation.x = -Math.PI / 2;
      this.aura.position.y = 0.07;
      this.aura.scale.setScalar(SHAMAN_WARD_RADIUS);
      this.group.add(this.aura);
    }
  }

  get alive(): boolean {
    return this.state === 'walk' || this.state === 'attack';
  }

  /** Con hielo encima: camina lento, no se cubre con el escudo y, si es chamán, no conjura. */
  get chilled(): boolean {
    return this.chillTimer > 0;
  }

  /** Chamán con el aura activa. */
  get casting(): boolean {
    return this.stats.behavior === 'shaman' && this.alive && !this.chilled;
  }

  get radius(): number {
    return this.stats.radius;
  }

  get height(): number {
    return this.stats.height;
  }

  /** Hacia dónde mira (unitario en el plano). */
  get facing(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  /**
   * ¿El escudo frena una pelota que viene con velocidad (vx, vy, vz)? Solo los tiros rasantes que
   * llegan de frente; congelado o aturdido no se cubre.
   */
  blocks(vx: number, vy: number, vz: number): boolean {
    if (!this.shieldUp || this.stunTimer > 0) return false;
    const h = Math.hypot(vx, vz);
    if (h < 0.5 || Math.abs(vy) > h * 0.5) return false;
    const f = this.facing;
    return (vx * f.x + vz * f.z) / h < -0.55;
  }

  /** Vida en cuadraditos, uno por punto: siempre a la vista, para decidir cuánto cargar el tiro. */
  private drawPips(): void {
    const p = this.pips;
    if (!p) return;
    const ctx = p.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
    for (let i = 0; i < this.maxHp; i++) {
      ctx.fillStyle = i < this.hp ? '#5be07a' : 'rgba(10, 14, 20, 0.7)';
      ctx.strokeStyle = '#0b0f14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(i * 32 + 4, 5, 24, 22, 5);
      ctx.fill();
      ctx.stroke();
    }
    p.tex.needsUpdate = true;
    p.sprite.visible = this.alive && !this.passed;
  }

  private refreshBar(): void {
    if (this.pips) {
      this.drawPips();
      return;
    }
    const barWidth = this.barBg.scale.x;
    const f = Math.max(0, this.hp / this.maxHp);
    this.barBg.visible = this.barFill.visible = f < 1 && this.alive && !this.passed;
    this.barFill.scale.x = Math.max(0.001, barWidth * f);
    this.barFill.material.color.setHSL(0.33 * f, 0.75, 0.55);
  }

  /** Aplica daño. Devuelve true si murió con este golpe. */
  damage(amount: number, knockDir: THREE.Vector3 | null, knockback: number): boolean {
    if (!this.alive || this.warded) return false;
    this.hp -= amount;
    this.flashTimer = 0.12;
    if (knockDir) this.knock.addScaledVector(knockDir, knockback * (this.stats.heavy ? 0.12 : 1));
    if (this.hp <= 0) {
      this.state = 'dying';
      this.dyingTime = 0;
      this.grabbing = false;
      this.chillTimer = 0;
      this.refreshBar();
      this.refreshChill();
      if (this.aura) this.aura.visible = false;
      if (this.stats.behavior === 'kamikaze') this.fuse = 0.12;
      else this.animator.playOneShot('Hard Landing', 1.3, true, 0.42);
      return true;
    }
    this.refreshBar();
    if (!this.stats.heavy && this.state !== 'attack') this.stunTimer = 0.35;
    return false;
  }

  /**
   * Hielo: lento y silenciado durante `seconds`. Nunca congela del todo: el enemigo sigue caminando y
   * atacando, solo que a paso de hombre y sin sus defensas. A los pesados les dura menos.
   */
  chill(seconds: number): void {
    if (!this.alive) return;
    const s = this.stats.heavy ? seconds * 0.6 : seconds;
    // ningún hielo acorta al anterior
    if (s >= this.chillTimer) {
      this.chillTimer = s;
      this.chillMax = s;
    }
  }

  /**
   * Empujón sin daño (wedge, palazo): sale despedido y trastabilla. Mueve a todos lo mismo, pesen lo que
   * pesen: si no, era muy difícil calcular a cuáles alineaba el wedge y a cuáles no.
   */
  shove(dir: THREE.Vector3, speed: number): void {
    if (!this.alive) return;
    this.knock.addScaledVector(dir, speed);
    if (!this.stats.heavy) this.stunTimer = Math.max(this.stunTimer, 0.55);
  }

  /** Palazo: le corta el ataque que estuviera haciendo y lo deja trastabillando. Los pesados ni se enteran. */
  stagger(seconds: number): void {
    if (!this.alive || this.stats.heavy) return;
    if (this.state === 'attack' && this.stats.behavior !== 'kamikaze') this.state = 'walk';
    this.stunTimer = Math.max(this.stunTimer, seconds);
  }

  /** Suelta al golfista (si lo tenía) y queda aturdida un rato. */
  letGo(stun: number): void {
    if (!this.grabbing) return;
    this.grabbing = false;
    this.stunTimer = Math.max(this.stunTimer, stun);
  }

  update(dt: number, player: Player, horde: Horde): void {
    if (this.state === 'gone') return;
    this.age += dt;
    this.updateLook(dt);

    if (this.state === 'dying') {
      this.dyingTime += dt;
      if (this.fuse >= 0) {
        this.fuse -= dt;
        if (this.fuse < 0) {
          horde.explode(this, player);
          this.state = 'gone';
          return;
        }
      }
      if (this.dyingTime > 1.7) this.position.y -= dt * 1.4;
      if (this.dyingTime > 2.5) this.state = 'gone';
      this.position.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.exp(-5 * dt));
      this.animator.update(dt);
      return;
    }

    // El empujón se apaga con exp(-KNOCK_DECAY t). Se integra exacto, no con velocidad por dt: así recorre
    // velocidad / KNOCK_DECAY a cualquier cantidad de cuadros por segundo, y el wedge alinea igual en
    // una máquina lenta que en una rápida.
    // los pies siguen al terreno (con el relieve apagado, la altura es 0)
    this.position.y = heightAt(this.position.x, this.position.z);
    const fade = Math.exp(-KNOCK_DECAY * dt);
    this.position.addScaledVector(this.knock, (1 - fade) / KNOCK_DECAY);
    this.knock.multiplyScalar(fade);
    if (this.chillTimer > 0) this.chillTimer = Math.max(0, this.chillTimer - dt);
    this.refreshChill();
    const slow = this.chilled ? ICE_SLOW : 1;
    const behavior = this.stats.behavior;
    const castGesture = this.casting ? 1 : 0;
    if (this.aura) {
      this.aura.visible = this.casting;
      this.aura.rotation.z += dt * 0.4;
      (this.aura.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.2 * Math.sin(this.age * 3);
    }

    if (this.grabbing) {
      this.updateGrab(dt, player, horde);
      return;
    }

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.animator.setLocomotion('Idle', 1);
      this.clampToField();
      this.finishFrame(dt, 0);
      return;
    }

    const toPlayer = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
    // Nadie persigue al golfista: todos van derecho a la puerta. La única excepción es el alma en pena,
    // que existe justamente para ir por él.
    this.target = behavior === 'grabber' && player.alive ? 'player' : 'gate';

    // Pero si en el camino le pasan por encima, lo atropellan: le sacan vida y mueren ahí mismo, así que
    // ese enemigo ya no llega a la puerta. Durante el respiro de invulnerabilidad pasan de largo.
    if (player.alive && this.state === 'walk' && toPlayer < this.radius + TRAMPLE_REACH) {
      if (behavior === 'kamikaze') {
        this.hp = 0;
        this.state = 'gone';
        horde.explode(this, player);
        return;
      }
      if (behavior === 'melee' && !player.invulnerable) {
        player.hit(this.stats.damage, this.position);
        horde.emit({ type: 'playerHit', enemy: this, amount: this.stats.damage });
        horde.emit({ type: 'trample', enemy: this });
        this.state = 'gone';
        return;
      }
    }

    // El que ya pasó la línea del golfista no se puede tocar más (tampoco se tira para atrás): se
    // desvanece y corre hasta la puerta, en lugar de quedarse un rato a la vista sin que se le pueda pegar.
    if (!this.passed && this.target === 'gate' && this.position.z < TEE_Z - PASSED_BEHIND) {
      this.passed = true;
      this.chillTimer = 0;
      this.stunTimer = 0;
      this.knock.set(0, 0, 0);
      for (const { mat } of this.materials) {
        mat.transparent = true;
        mat.opacity = 0.4;
        mat.needsUpdate = true;
      }
      this.refreshBar();
      this.refreshChill();
    }

    // dónde se para: los que pelean llegan hasta la puerta; el chamán y el gólem se plantan lejos
    const holdZ = behavior === 'shaman' ? SHAMAN_HOLD_Z : behavior === 'golem' ? GOLEM_HOLD_Z : null;
    const holding = holdZ !== null && this.target === 'gate';
    const gateX = holding ? this.position.x : THREE.MathUtils.clamp(this.position.x, -GATE_HALF_WIDTH + 0.3, GATE_HALF_WIDTH - 0.3);
    const gateZ = holding ? holdZ : GATE_Z + this.radius + 0.3;
    const tx = this.target === 'player' ? player.position.x : gateX;
    const tz = this.target === 'player' ? player.position.z : gateZ;
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    const reach = this.target === 'player' ? this.radius + 1.1 : 0.5;
    let lookX = dx;
    let lookZ = dz;

    if (this.state === 'attack') {
      this.attackTime += dt * slow;
      if (!this.attackHitDone && this.attackTime >= this.attackHitAt) {
        this.attackHitDone = true;
        if (this.resolveAttack(player, horde, toPlayer)) return;
      }
      if (this.attackTime >= this.attackEnd) this.state = 'walk';
      this.animator.setLocomotion('Idle', 1);
    } else if (dist <= reach) {
      if (holding) {
        // plantado: mira a la puerta. El gólem cada tanto tira; el chamán solo sostiene el aura
        lookX = -this.position.x * 0.2;
        lookZ = GATE_Z - this.position.z;
        if (behavior === 'golem') {
          this.castTimer -= dt * slow;
          if (this.castTimer <= 0) this.startAttack(GOLEM_THROW_EVERY);
        }
        this.animator.setLocomotion('Idle', 1);
      } else if (behavior === 'grabber') {
        if (player.alive && !player.invulnerable && !player.grabbedBy) {
          this.grabbing = true;
          this.grabTime = 0;
          this.grabTick = GRAB_TICK;
          player.grab(this);
          horde.emit({ type: 'grab', enemy: this });
        }
        this.animator.setLocomotion('Idle', 1);
      } else if (this.target === 'gate' && behavior === 'melee') {
        // Llegó a la puerta: le hace su daño de una sola vez y se pierde adentro. Pegarle a un enemigo
        // pegado a la muralla era incómodo (la cámara mira para el otro lado), y no sumaba nada.
        horde.emit({ type: 'gateHit', enemy: this, amount: this.stats.gateDamage });
        horde.emit({ type: 'breach', enemy: this });
        this.state = 'gone';
        return;
      } else {
        this.startAttack(0);
        horde.emit({ type: 'attack', enemy: this });
      }
    } else {
      const speed = this.passed ? PASSED_SPEED : this.stats.speed * this.speedMul * slow;
      const step = Math.min(speed * dt, dist);
      this.position.x += (dx / dist) * step;
      this.position.z += (dz / dist) * step;
      // los clips de Mixamo avanzan ~1.5 m/s caminando y ~4 m/s corriendo a velocidad 1, para un modelo de 1.8 m
      const stride = this.stats.height / 1.8;
      if (this.stats.runs || this.passed) this.animator.setLocomotion('Running', speed / (4 * stride));
      else this.animator.setLocomotion('Walking', speed / (1.5 * stride));
    }

    if (Math.hypot(lookX, lookZ) > 0.05) {
      let d = (Math.atan2(lookX, lookZ) - this.yaw) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * (1 - Math.exp(-8 * dt));
    }
    this.clampToField();
    this.finishFrame(dt, this.state === 'attack' ? 1 : castGesture);
  }

  private clampToField(): void {
    this.position.x = THREE.MathUtils.clamp(this.position.x, -FIELD_HALF_WIDTH - 2, FIELD_HALF_WIDTH + 2);
    this.position.z = Math.max(this.position.z, GATE_Z + this.radius * 0.5);
  }

  /** El alma en pena agarrada al golfista: lo lastima de a poco hasta que él salta, o ella se cansa. */
  private updateGrab(dt: number, player: Player, horde: Horde): void {
    if (player.grabbedBy !== this || !player.alive) {
      // se le escapó por el portal (o cayó): queda desorientada el tiempo justo para un driver cargado
      this.letGo(3);
      horde.emit({ type: 'release', enemy: this });
      this.finishFrame(dt, 0);
      return;
    }
    this.grabTime += dt;
    this.grabTick -= dt;
    if (this.grabTick <= 0) {
      this.grabTick += GRAB_TICK;
      player.drain(this.stats.damage);
      horde.emit({ type: 'playerHit', enemy: this, amount: this.stats.damage });
    }
    if (this.grabTime >= GRAB_MAX) {
      this.letGo(2.5);
      player.release(this);
      horde.emit({ type: 'release', enemy: this });
    }
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    this.yaw = Math.atan2(dx, dz);
    this.animator.setLocomotion('Idle', 1);
    this.finishFrame(dt, 1);
  }

  /** Cierra el cuadro: orientación, animación y, encima, el gesto de brazos por código. */
  private finishFrame(dt: number, gestureTarget: number): void {
    this.model.rotation.y = this.yaw;
    this.animator.update(dt);
    this.gesture += (gestureTarget - this.gesture) * (1 - Math.exp(-14 * dt));
    if (this.gesture > 0.01) this.applyGesture();
  }

  /**
   * Golpe de arriba hacia abajo: el brazo se levanta durante la preparación y cae en el impacto.
   * Girar alrededor del eje izquierda-derecha del modelo con ángulo negativo lleva el brazo hacia
   * adelante y arriba.
   */
  private applyGesture(): void {
    const u = this.attackHitAt > 0 ? this.attackTime / this.attackHitAt : 1;
    let angle: number;
    let lean: number;
    if (this.stats.behavior === 'shaman') {
      // manos en alto mientras sostiene el aura
      angle = -2.75 + 0.12 * Math.sin(this.age * 3);
      lean = -0.12;
    } else if (this.stats.behavior === 'grabber') {
      // brazos al frente, agarrando
      angle = -1.45 + 0.1 * Math.sin(this.age * 14);
      lean = 0.25;
    } else {
      if (u < 1) angle = -2.9 * smooth(Math.min(1, u / 0.75));
      else angle = -2.9 + 2.2 * smooth(Math.min(1, (u - 1) / 0.25));
      lean = u < 1 ? -0.18 * smooth(u) : 0.3 * smooth(Math.min(1, (u - 1) / 0.25));
    }
    this.model.updateMatrixWorld(true);
    const axis = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const q = new THREE.Quaternion();
    for (const arm of this.arms) rotateWorld(arm, q.setFromAxisAngle(axis, angle * this.gesture));
    if (this.spine) rotateWorld(this.spine, q.setFromAxisAngle(axis, lean * this.gesture));
  }

  /** @param castEvery si es mayor que 0, es un conjuro o lanzamiento y reinicia ese reloj */
  private startAttack(castEvery: number): void {
    this.state = 'attack';
    this.attackTime = 0;
    this.attackHitDone = false;
    if (castEvery > 0) this.castTimer = castEvery;
    const slowSwing = this.stats.heavy ? 1.5 : 1;
    // Contra el golfista el golpe se anuncia más: con 3 de vida, tiene que dar tiempo a correrse de puesto
    const windup = this.target === 'player' ? PLAYER_WINDUP : 0.45;
    this.attackHitAt = this.stats.behavior === 'kamikaze' ? KAMIKAZE_FUSE : windup * slowSwing;
    this.attackEnd = this.attackHitAt + 0.45 * slowSwing;
  }

  /** Resuelve el impacto del ataque. Devuelve true si el enemigo dejó de existir (kamikaze). */
  private resolveAttack(player: Player, horde: Horde, toPlayer: number): boolean {
    const behavior = this.stats.behavior;
    if (behavior === 'kamikaze') {
      this.hp = 0;
      this.state = 'gone';
      horde.explode(this, player);
      return true;
    }
    if (this.target === 'player') {
      if (toPlayer <= this.radius + 1.7 && player.alive && !player.invulnerable) {
        player.hit(this.stats.damage, this.position);
        horde.emit({ type: 'playerHit', enemy: this, amount: this.stats.damage });
      }
    } else if (behavior === 'golem') {
      horde.throwRock(this);
    } else {
      horde.emit({ type: 'gateHit', enemy: this, amount: this.stats.gateDamage });
    }
    return false;
  }

  /** ¿Tiene el escudo en alto? Con hielo encima (frío o congelado) lo pierde hasta que se le pasa. */
  get shieldUp(): boolean {
    return this.stats.shield && this.alive && !this.chilled && !this.passed;
  }

  private updateLook(dt: number): void {
    // lo que se ve coincide con lo que pasa: sin escudo a la vista, el driver entra
    // tampoco se ve mientras cae muerto
    if (this.shieldMesh) this.shieldMesh.visible = this.shieldUp;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    const flash = this.flashTimer > 0;
    // el kamikaze late en rojo, cada vez más rápido cuando ya encendió la mecha
    const fuseOn = this.stats.behavior === 'kamikaze' && this.state === 'attack';
    const pulse = this.stats.behavior === 'kamikaze' ? 0.5 + 0.5 * Math.sin(this.age * (fuseOn ? 40 : 9)) : 0;
    const ward = this.warded && this.alive ? 0.55 + 0.25 * Math.sin(this.age * 6) : 0;
    for (const { mat, color } of this.materials) {
      if (flash) mat.emissive.setHex(0xffffff);
      else if (this.chilled) mat.emissive.setHex(0x0c2a3c);
      else if (ward) mat.emissive.setRGB(0.45 * ward, 0.12 * ward, 0.8 * ward);
      else mat.emissive.setRGB(pulse * 0.7, pulse * 0.08, 0);
      mat.emissiveIntensity = flash ? 0.6 : 1;
      if (this.chilled) mat.color.copy(color).lerp(CHILL_TINT, 0.45);
      else mat.color.copy(color);
    }
  }

  private refreshChill(): void {
    const on = this.chilled && this.alive;
    this.chillBg.visible = this.chillFill.visible = on;
    if (!on) return;
    this.chillFill.scale.x = Math.max(0.001, this.chillBg.scale.x * (this.chillTimer / this.chillMax));
  }

  dispose(): void {
    for (const { mat } of this.materials) mat.dispose();
    this.barBg.material.dispose();
    this.barFill.material.dispose();
    this.chillBg.material.dispose();
    this.chillFill.material.dispose();
    if (this.pips) {
      this.pips.tex.dispose();
      this.pips.sprite.material.dispose();
    }
    if (this.aura) (this.aura.material as THREE.Material).dispose();
  }
}

export class Horde {
  readonly enemies: Enemy[] = [];
  onEvent: ((e: HordeEvent) => void) | null = null;
  private readonly templates = new Map<EnemyKind, Template>();
  private readonly rocks: Rock[] = [];
  private spawnCount = 0;

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * Arma la plantilla de un tipo de enemigo: del GLB con todos los personajes deja solo su malla, y
   * mide la altura para normalizarla. Devuelve la altura original.
   */
  register(kind: EnemyKind, gltf: GLTF): number {
    const stats = ENEMIES[kind];
    const scene = cloneSkinned(gltf.scene);
    const drop: THREE.Object3D[] = [];
    let found = false;
    scene.traverse((o) => {
      if (!(o as THREE.SkinnedMesh).isSkinnedMesh) return;
      if (o.name === stats.mesh) found = true;
      else drop.push(o);
    });
    if (!found) throw new Error(`el modelo no trae la malla ${stats.mesh}`);
    for (const o of drop) o.parent?.remove(o);
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) sm.skeleton.update();
    });
    const box = new THREE.Box3().setFromObject(scene, true);
    const height = box.max.y - Math.min(0, box.min.y);
    this.templates.set(kind, { scene, clips: gltf.animations, scale: stats.height / height });
    return height;
  }

  emit(e: HordeEvent): void {
    this.onEvent?.(e);
  }

  get aliveCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  private add(kind: EnemyKind, x: number, z: number): Enemy {
    const template = this.templates.get(kind);
    if (!template) throw new Error(`falta el modelo de ${kind}`);
    const enemy = new Enemy(ENEMIES[kind], template);
    enemy.position.set(x, 0, z);
    this.scene.add(enemy.group);
    this.enemies.push(enemy);
    return enemy;
  }

  /** Aparición de una oleada: suelto, en el fondo del campo. */
  spawn(kind: EnemyKind, at?: THREE.Vector3): Enemy {
    if (at) return this.add(kind, at.x, at.z);
    const stats = ENEMIES[kind];
    // reparte las apariciones a lo ancho con la razón áurea, para que no salgan encimados
    const u = (this.spawnCount++ * 0.618034) % 1;
    const half = stats.behavior === 'golem' ? 3 : FIELD_HALF_WIDTH - 3;
    return this.add(kind, (u * 2 - 1) * half, SPAWN_Z + Math.random() * 3);
  }

  /** Daña a un enemigo y avisa. Devuelve true si lo mató. */
  damage(enemy: Enemy, amount: number, knockDir: THREE.Vector3 | null, knockback: number): boolean {
    if (!enemy.alive || enemy.passed) return false;
    if (enemy.warded) {
      this.emit({ type: 'immune', enemy });
      return false;
    }
    // ningún estado cambia el daño. La vida va en enteros: todo golpe que entra saca al menos 1
    // (el redondeo es por la explosión del kamikaze, que pierde fuerza hacia el borde)
    const dealt = amount > 0 ? Math.max(1, Math.round(amount)) : 0;
    const killed = enemy.damage(dealt, knockDir, knockback);
    this.emit({ type: 'damage', enemy, amount: dealt, killed });
    return killed;
  }

  /** Daño en área con caída lineal hasta el borde. Devuelve a cuántos alcanzó. */
  blast(pos: THREE.Vector3, radius: number, damage: number, knockback: number, except: Enemy | null = null): number {
    let count = 0;
    const dir = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.passed || e === except) continue;
      dir.set(e.position.x - pos.x, 0, e.position.z - pos.z);
      const d = dir.length() - e.radius;
      if (d > radius) continue;
      const f = 1 - 0.6 * Math.max(0, d / radius);
      if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
      this.damage(e, damage * f, dir.normalize(), knockback * f);
      count++;
    }
    return count;
  }

  /** Explosión de un kamikaze: lastima a los otros enemigos, al golfista y a la puerta si está cerca. */
  explode(source: Enemy, player: Player): void {
    const pos = source.position.clone();
    this.emit({ type: 'explosion', pos, radius: EXPLOSION_RADIUS });
    this.blast(pos, EXPLOSION_RADIUS, BOMB_ENEMY_DAMAGE, 8, source);
    const toPlayer = Math.hypot(player.position.x - pos.x, player.position.z - pos.z);
    if (toPlayer < EXPLOSION_RADIUS && player.alive && !player.invulnerable) {
      player.hit(source.stats.damage, pos);
      this.emit({ type: 'playerHit', enemy: source, amount: source.stats.damage });
    }
    if (pos.z < GATE_Z + EXPLOSION_RADIUS && Math.abs(pos.x) < GATE_HALF_WIDTH + EXPLOSION_RADIUS) {
      this.emit({ type: 'gateHit', enemy: source, amount: source.stats.gateDamage });
    }
  }

  /** Hielo en área (hierro): enfría a todos los que alcanza. Devuelve a cuántos. */
  chillAround(pos: THREE.Vector3, radius: number, seconds: number): number {
    let count = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.passed) continue;
      if (Math.hypot(e.position.x - pos.x, e.position.z - pos.z) - e.radius > radius) continue;
      e.chill(seconds);
      count++;
    }
    return count;
  }

  /**
   * Vendaval del wedge: barre un rectángulo centrado en `pos` y orientado según la línea del tiro
   * (`along`, unitario): halfDepth a lo largo de la línea y halfWidth a cada costado. Empuja a cada uno
   * hacia la línea, justo lo que lo separa de ella, así que terminan todos parados sobre la línea del
   * tiro: una fila servida para el driver. Devuelve a cuántos movió.
   */
  sweep(pos: THREE.Vector3, along: THREE.Vector3, halfWidth: number, halfDepth: number): number {
    let count = 0;
    // el costado de la línea del tiro, en el piso
    const side = new THREE.Vector3(along.z, 0, -along.x);
    const dir = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.passed) continue;
      const rx = e.position.x - pos.x;
      const rz = e.position.z - pos.z;
      const lateral = rx * side.x + rz * side.z;
      const forward = rx * along.x + rz * along.z;
      if (Math.abs(lateral) > halfWidth || Math.abs(forward) > halfDepth + e.radius) continue;
      if (Math.abs(lateral) > 0.05) e.shove(dir.copy(side).multiplyScalar(-Math.sign(lateral)), Math.abs(lateral) * KNOCK_DECAY);
      count++;
    }
    return count;
  }

  /**
   * Empujón radial sin daño, más fuerte cerca del centro. Devuelve a cuántos movió.
   */
  push(pos: THREE.Vector3, radius: number, speed: number): number {
    let count = 0;
    const dir = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.passed) continue;
      dir.set(e.position.x - pos.x, 0, e.position.z - pos.z);
      const d = dir.length() - e.radius;
      if (d > radius) continue;
      if (dir.lengthSq() < 0.001) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      e.shove(dir.normalize(), speed * (1 - 0.55 * Math.max(0, d / radius)));
      count++;
    }
    return count;
  }

  /**
   * Aura de los chamanes: todo enemigo dentro del radio de un chamán que está conjurando es inmune.
   * Un chamán nunca queda protegido, ni por su propia aura ni por la de otro: si no, dos chamanes
   * juntos serían imposibles de matar.
   */
  private updateWards(): void {
    const casters = this.enemies.filter((e) => e.casting);
    for (const e of this.enemies) {
      e.warded = false;
      if (!e.alive || e.stats.behavior === 'shaman') continue;
      for (const c of casters) {
        if (Math.hypot(e.position.x - c.position.x, e.position.z - c.position.z) <= SHAMAN_WARD_RADIUS + e.radius) {
          e.warded = true;
          break;
        }
      }
    }
  }

  /** El gólem le tira una piedra a la puerta. */
  throwRock(source: Enemy): void {
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    const from = new THREE.Vector3(source.position.x, source.height * 0.95, source.position.z).addScaledVector(source.facing, 1.2);
    const to = new THREE.Vector3(THREE.MathUtils.clamp(source.position.x * 0.2, -GATE_HALF_WIDTH, GATE_HALF_WIDTH), 1.5, GATE_Z - 0.6);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.rocks.push({ mesh, from, to, t: 0, source });
    this.emit({ type: 'rockThrown', enemy: source });
  }

  /** Enemigos vivos más cercanos a `pos`, sin contar `except`, dentro de `radius`. */
  nearest(pos: THREE.Vector3, radius: number, except: Set<number>, count: number): Enemy[] {
    return this.enemies
      .filter((e) => e.alive && !e.passed && !except.has(e.id))
      .map((e) => ({ e, d: Math.hypot(e.position.x - pos.x, e.position.z - pos.z) }))
      .filter((x) => x.d <= radius)
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((x) => x.e);
  }

  /** Saca a `pos` de adentro de los enemigos vivos (el golfista no los atraviesa). */
  pushOut(pos: THREE.Vector3, radius: number): void {
    for (const e of this.enemies) {
      if (!e.alive || e.passed) continue;
      const dx = pos.x - e.position.x;
      const dz = pos.z - e.position.z;
      const d = Math.hypot(dx, dz);
      const min = e.radius + radius;
      if (d >= min || d < 0.001) continue;
      pos.x = e.position.x + (dx / d) * min;
      pos.z = e.position.z + (dz / d) * min;
    }
  }

  private updateRocks(dt: number): void {
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.t += dt / ROCK_FLIGHT;
      const u = Math.min(1, r.t);
      r.mesh.position.lerpVectors(r.from, r.to, u);
      r.mesh.position.y += Math.sin(u * Math.PI) * 6;
      r.mesh.rotation.x += dt * 5;
      r.mesh.rotation.z += dt * 3;
      if (u < 1) continue;
      this.emit({ type: 'rockLanded', pos: r.to.clone() });
      this.emit({ type: 'gateHit', enemy: r.source, amount: r.source.stats.gateDamage });
      this.scene.remove(r.mesh);
      this.rocks.splice(i, 1);
    }
  }

  update(dt: number, player: Player): void {
    this.updateWards();
    for (const e of this.enemies) e.update(dt, player, this);
    this.updateRocks(dt);

    // los enemigos no se enciman: se empujan entre sí, los pesados casi no se mueven
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const min = (a.radius + b.radius) * 0.9;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.5;
        const wa = a.stats.heavy === b.stats.heavy ? 0.5 : a.stats.heavy ? 0.1 : 0.9;
        a.position.x -= (dx / d) * push * wa * 2;
        a.position.z -= (dz / d) * push * wa * 2;
        b.position.x += (dx / d) * push * (1 - wa) * 2;
        b.position.z += (dz / d) * push * (1 - wa) * 2;
      }
    }

    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].state !== 'gone') continue;
      this.scene.remove(list[i].group);
      list[i].dispose();
      list.splice(i, 1);
    }
  }
}
