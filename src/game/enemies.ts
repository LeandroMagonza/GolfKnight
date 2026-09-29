// La horda: goblins, esqueletos y un gólem, todos sacados del mismo GLB de personajes de
// PolygonDungeon (un esqueleto compartido con clips de Mixamo retargeteados). Caminan hacia la puerta
// de la ciudad, persiguen al golfista si lo tienen cerca y atacan a lo que alcancen. Los clips solo
// cubren la locomoción: el ataque, el conjuro y el lanzamiento se arman por código sobre los brazos.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ELEMENTS, grenadeShift, ICE, LENS, POWDER, VULNERABLE } from '../core/abilities';
import { EXPLOSION_RADIUS, KNOCK_DECAY } from '../core/clubs';
import { behindShield, shieldFaces, SHIELD_FRONT } from '../core/shield';
import { heightAt, mounds } from '../core/terrain';
import { BANNER_HOLD_Z, behaviorOf, DODGE, type ScenarioPower, ENEMIES, GEOMANCER, GRAB, RANGED, SHIELD_WALL, type Behavior, GOLEM_HOLD_Z, GOLEM_THROW_EVERY, HEAL_AURA, SHAMAN_ALONE, SHAMAN_HOLD_Z, SHAMAN_WARD_RADIUS, SPEED_SPREAD, type Aura, type EnemyKind, type EnemyMods, type EnemyStats } from '../core/waves';
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
  /** `crit`: rompió un congelado y pegó el doble. */
  | { type: 'damage'; enemy: Enemy; amount: number; killed: boolean; crit?: boolean }
  /** El escudo divino se comió el golpe. */
  | { type: 'divine'; enemy: Enemy }
  /** La armadura se comió todo el golpe. */
  | { type: 'armored'; enemy: Enemy }
  /** La maestría del hielo lo congeló. */
  | { type: 'frozen'; enemy: Enemy }
  /** Un marcado con pólvora explotó al morir. */
  | { type: 'powder'; pos: THREE.Vector3; radius: number }
  /** Un rayo saltó de un enemigo a otro. */
  | { type: 'zap'; from: THREE.Vector3; to: THREE.Vector3 }
  | { type: 'attack'; enemy: Enemy }
  /** `enemy` es null cuando fue un hechizo que ya no tiene de quién venir. */
  | { type: 'playerHit'; enemy: Enemy | null; amount: number }
  | { type: 'gateHit'; enemy: Enemy; amount: number }
  | { type: 'breach'; enemy: Enemy }
  | { type: 'trample'; enemy: Enemy }
  | { type: 'explosion'; pos: THREE.Vector3; radius: number }
  | { type: 'immune'; enemy: Enemy }
  /** El escudo lo tapó de un daño en área: o lo lleva él, o está detrás del que lo lleva. */
  | { type: 'shielded'; enemy: Enemy }
  | { type: 'grab'; enemy: Enemy }
  /** El alma en pena lo soltó y se esfumó. */
  | { type: 'release'; enemy: Enemy }
  | { type: 'rockThrown'; enemy: Enemy }
  | { type: 'rockLanded'; pos: THREE.Vector3 }
  /** Un hechicero tiró un hechizo; y dónde cayó, y si le pegó al golfista. */
  | { type: 'spellCast'; enemy: Enemy }
  | { type: 'spellLanded'; pos: THREE.Vector3; hit: boolean }
  /** El aura de un curandero le devolvió vida. */
  | { type: 'healed'; enemy: Enemy; amount: number }
  /** Un geomante empezó a levantar una loma, o terminó y la loma quedó para siempre. */
  | { type: 'mound'; enemy: Enemy; settled: boolean }
  /** La bandera se levantó (todos +1 de vida) o cayó. */
  | { type: 'banner'; up: boolean }
  /** Uno que esquiva saltó al costado. */
  | { type: 'dodged'; enemy: Enemy };

interface Template {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  /** Factor de escala para que el modelo mida stats.height. */
  scale: number;
}

interface Spell {
  mesh: THREE.Mesh;
  marker: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
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
/** El círculo oscuro bajo cada enemigo: la sombra de mentira, que se apaga cuando hay sombras de verdad. */
export const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const shieldGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14);
const shieldMat = new THREE.MeshStandardMaterial({ color: 0x7a5a32, roughness: 0.8, metalness: 0.1 });
const shieldRimMat = new THREE.MeshStandardMaterial({ color: 0x3c3c3c, roughness: 0.5, metalness: 0.6 });
const auraGeo = new THREE.RingGeometry(0.96, 1, 64);
const rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 1, flatShading: true });

const bubbleGeo = new THREE.SphereGeometry(1, 18, 12);
const spellGeo = new THREE.SphereGeometry(0.28, 12, 10);
const spellMat = new THREE.MeshBasicMaterial({ color: 0xd24dff });
const markerGeo = new THREE.RingGeometry(0.7, 1, 32);
/** La bandera de la abanderada, en unidades del modelo sin escalar. */
const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6);
const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.9 });
const flagGeo = new THREE.PlaneGeometry(0.9, 0.6);
const flagMat = new THREE.MeshStandardMaterial({ color: 0xc8322b, roughness: 0.8, side: THREE.DoubleSide });
/** El blindaje que viene como modificador tiñe de acero (el acorazado ya trae su color). */
const STEEL_TINT = 0xa9b1bb;
/** El que explota va rojizo (y late en rojo): era el color del kamikaze. */
const BOMB_TINT = 0xffa08a;
/** El que cura: verde, como su aura. */
const HEAL_TINT = 0x9be58f;
/**
 * Los escudos del pack, por nivel (el 1 es el de madera hecho por código). Los carga el juego de
 * shields.glb y los deja acá, ya acomodados: centrados, del tamaño justo y mirando para adelante.
 */
export const SHIELD_PROPS = new Map<number, THREE.Object3D>();
/** Qué escudo del pack va en cada nivel. Los niveles sin modelo usan el del nivel de abajo más cercano. */
export const SHIELD_MODELS: Record<number, string> = { 2: 'Shield_Plank_01', 3: 'Shield_Bone_01', 4: 'Shield_Heater_02', 5: 'Shield_Round_01', 10: 'Shield_Skull_01' };
const AURA_COLORS: Record<Aura, number> = { ward: 0xb26bff, heal: 0x6be38a };

/** Lado de cada ícono en el lienzo de la vida: un 60 % más grande que un cuadradito (32). */
const BADGE_PX = 52;

export type BadgeIcon = 'shield' | 'wall' | 'armor' | 'ward' | 'heal' | 'banner' | 'ethereal' | 'divine' | 'bomb' | 'dig' | 'spell' | 'dodge' | 'skull';

/** El ícono de cada poder de escenario, para la fila del recorrido de la partida. */
export const SCENARIO_ICONS: Record<ScenarioPower, BadgeIcon> = { shield: 'shield', armor: 'armor', ethereal: 'ethereal', divine: 'divine', dodge: 'dodge' };

/** Un ícono suelto, como imagen (el HUD los usa para el recorrido de la partida). */
export function badgeImage(icon: BadgeIcon): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  drawBadge(ctx, 0, { icon }, false);
  return canvas.toDataURL();
}

/** Un poder del enemigo, dibujado como ícono antes de su vida. */
interface Badge {
  icon: BadgeIcon;
  /** El número que va encima (cuánto resta el escudo o el blindaje). */
  value?: number;
  /** La granada lo apaga: mientras dura el silencio va tachado. */
  mutes?: boolean;
  /** Gastado por ahora (el escudo divino recargándose): se ve apagado. */
  off?: boolean;
}

/** El escudo del pack para un nivel: el suyo, o el del nivel de abajo más cercano que tenga modelo. */
function shieldPropFor(level: number): THREE.Object3D | null {
  for (let l = level; l >= 2; l--) {
    const prop = SHIELD_PROPS.get(l);
    if (prop) return prop;
  }
  return null;
}

/** Dibuja un ícono de 32 × 32 en `x`. Formas simples, que se lean chiquitas y de lejos. */
function drawBadge(ctx: CanvasRenderingContext2D, x: number, b: Badge, muted: boolean): void {
  const cx = x + 16;
  ctx.save();
  ctx.globalAlpha = b.off ? 0.35 : 1;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0b0f14';
  ctx.beginPath();
  switch (b.icon) {
    case 'shield':
    case 'wall':
      // escudo: arriba recto, abajo en punta
      ctx.moveTo(cx - 12, 3);
      ctx.lineTo(cx + 12, 3);
      ctx.lineTo(cx + 12, 15);
      ctx.quadraticCurveTo(cx + 11, 25, cx, 30);
      ctx.quadraticCurveTo(cx - 11, 25, cx - 12, 15);
      ctx.closePath();
      // el escudo, naranja de madera; el que no deja pasar nada es el mismo escudo, con ∞
      ctx.fillStyle = '#ff8a1f';
      break;
    case 'armor':
      // blindaje: un yelmo azul, con las carrilleras
      ctx.moveTo(cx - 12, 16);
      ctx.arc(cx, 16, 12, Math.PI, 0);
      ctx.lineTo(cx + 12, 29);
      ctx.lineTo(cx + 5, 29);
      ctx.lineTo(cx + 5, 23);
      ctx.lineTo(cx - 5, 23);
      ctx.lineTo(cx - 5, 29);
      ctx.lineTo(cx - 12, 29);
      ctx.closePath();
      ctx.fillStyle = '#2f7dff';
      break;
    case 'ward': {
      // invencible: una estrella violeta de cinco puntas
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 6 : 15;
        if (i) ctx.lineTo(cx + r * Math.cos(a), 17 + r * Math.sin(a));
        else ctx.moveTo(cx + r * Math.cos(a), 17 + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle = '#b26bff';
      break;
    }
    case 'heal':
      // cura: una cruz verde, la de la enfermería
      ctx.moveTo(cx - 4.5, 3);
      ctx.lineTo(cx + 4.5, 3);
      ctx.lineTo(cx + 4.5, 11.5);
      ctx.lineTo(cx + 13, 11.5);
      ctx.lineTo(cx + 13, 20.5);
      ctx.lineTo(cx + 4.5, 20.5);
      ctx.lineTo(cx + 4.5, 29);
      ctx.lineTo(cx - 4.5, 29);
      ctx.lineTo(cx - 4.5, 20.5);
      ctx.lineTo(cx - 13, 20.5);
      ctx.lineTo(cx - 13, 11.5);
      ctx.lineTo(cx - 4.5, 11.5);
      ctx.closePath();
      ctx.fillStyle = '#2fd05a';
      break;
    case 'divine':
      // divino: una aureola dorada, un anillo acostado
      ctx.ellipse(cx, 16, 14, 7.5, 0, 0, Math.PI * 2);
      ctx.moveTo(cx + 8, 16);
      ctx.ellipse(cx, 16, 8, 3.5, 0, 0, Math.PI * 2, true);
      ctx.fillStyle = '#ffe600';
      break;
    case 'ethereal':
      // fantasmita: cabeza redonda y borde de abajo ondulado
      ctx.arc(cx, 13, 11, Math.PI, 0);
      ctx.lineTo(cx + 11, 28);
      ctx.lineTo(cx + 5.5, 24);
      ctx.lineTo(cx, 28);
      ctx.lineTo(cx - 5.5, 24);
      ctx.lineTo(cx - 11, 28);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
      // los ojos: es lo que lo hace fantasma y no una mancha blanca
      ctx.beginPath();
      ctx.ellipse(cx - 4, 13, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 4, 13, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0b0f14';
      break;
    case 'bomb':
      // bomba: bola negra con la mecha prendida
      ctx.arc(cx - 1, 18, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 6, 9);
      ctx.quadraticCurveTo(cx + 10, 3, cx + 13, 5);
      ctx.strokeStyle = '#c9a36b';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 13, 5, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff9a2e';
      ctx.strokeStyle = '#0b0f14';
      break;
    case 'dig':
      // loma: una montañita marrón con pasto arriba
      ctx.moveTo(cx - 14, 27);
      ctx.quadraticCurveTo(cx, -2, cx + 14, 27);
      ctx.closePath();
      ctx.fillStyle = '#6b4a2a';
      ctx.fill();
      ctx.stroke();
      // pasto arriba
      ctx.beginPath();
      ctx.moveTo(cx - 8, 13);
      ctx.quadraticCurveTo(cx, 3, cx + 8, 13);
      ctx.quadraticCurveTo(cx, 9, cx - 8, 13);
      ctx.fillStyle = '#5bd05b';
      break;
    case 'spell':
      // hechizo: una llama rosa, en punta para arriba
      ctx.moveTo(cx, 2);
      ctx.bezierCurveTo(cx + 5, 10, cx + 13, 14, cx + 11, 22);
      ctx.bezierCurveTo(cx + 9, 29, cx - 9, 29, cx - 11, 22);
      ctx.bezierCurveTo(cx - 12, 16, cx - 6, 14, cx - 4, 8);
      ctx.bezierCurveTo(cx - 2, 12, cx, 13, cx, 2);
      ctx.closePath();
      ctx.fillStyle = '#ff4fa3';
      break;
    case 'dodge':
      // esquiva: una flecha doble, de costado a costado
      ctx.moveTo(cx - 14, 16);
      ctx.lineTo(cx - 5, 7);
      ctx.lineTo(cx - 5, 12);
      ctx.lineTo(cx + 5, 12);
      ctx.lineTo(cx + 5, 7);
      ctx.lineTo(cx + 14, 16);
      ctx.lineTo(cx + 5, 25);
      ctx.lineTo(cx + 5, 20);
      ctx.lineTo(cx - 5, 20);
      ctx.lineTo(cx - 5, 25);
      ctx.closePath();
      ctx.fillStyle = '#10c9b4';
      break;
    case 'skull':
      // el jefe: una calavera, cráneo y mandíbula
      ctx.arc(cx, 13, 11, Math.PI * 0.85, Math.PI * 0.15);
      ctx.lineTo(cx + 7, 22);
      ctx.lineTo(cx + 7, 29);
      ctx.lineTo(cx - 7, 29);
      ctx.lineTo(cx - 7, 22);
      ctx.closePath();
      ctx.fillStyle = '#f2ecdc';
      ctx.fill();
      ctx.stroke();
      // las cuencas y la nariz
      ctx.beginPath();
      ctx.arc(cx - 4.5, 14, 3.2, 0, Math.PI * 2);
      ctx.arc(cx + 4.5, 14, 3.2, 0, Math.PI * 2);
      ctx.moveTo(cx, 18);
      ctx.lineTo(cx - 1.8, 21.5);
      ctx.lineTo(cx + 1.8, 21.5);
      ctx.closePath();
      ctx.fillStyle = '#1b1b1b';
      break;
    case 'banner':
      ctx.rect(cx - 10, 3, 3, 26);
      ctx.moveTo(cx - 7, 4);
      ctx.lineTo(cx + 12, 9);
      ctx.lineTo(cx - 7, 16);
      ctx.closePath();
      ctx.fillStyle = '#e0473d';
      break;
  }
  ctx.fill();
  ctx.stroke();
  // el dibujo de adentro: el número, o un símbolo para los que no llevan número
  const mark = b.value !== undefined ? String(b.value) : b.icon === 'wall' ? '∞' : '';
  if (mark) {
    ctx.font = `bold ${mark.length > 1 ? 14 : 18}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(mark, cx, 17);
    ctx.fillStyle = b.icon === 'ethereal' ? '#1b2c3d' : '#ffffff';
    if (b.icon === 'ethereal') ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(mark, cx, 17);
  }
  // silenciado: un prohibido rojo encima mientras dura la granada
  if (muted) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(cx, 16, 13, 0, Math.PI * 2);
    ctx.moveTo(cx - 9, 7);
    ctx.lineTo(cx + 9, 25);
    ctx.stroke();
  }
  ctx.restore();
}

const CHILL_TINT = new THREE.Color(0x8fd0ff);
const FROZEN_TINT = new THREE.Color(0xdff6ff);
const SILENCE_EMISSIVE = new THREE.Color(0x4a1a08);

/** Suaviza entre 0 y 1. */
const smooth = (u: number) => u * u * (3 - 2 * u);

export class Enemy {
  readonly id = nextId++;
  readonly group = new THREE.Group();
  readonly position: THREE.Vector3;
  readonly animator: LayeredAnimator;
  /** Vida con la que apareció. No es de solo lectura: el panel de balance la toca en vivo. */
  maxHp: number;
  hp: number;
  state: EnemyState = 'walk';
  /** A quién ataca en este momento. */
  target: 'gate' | 'player' = 'gate';
  /** Tope de velocidad de este cuadro: el que sostiene un aura camina al paso de los aliados que tiene cerca. */
  paceCap = Infinity;
  /** Segundos que lleva sin aliados vivos (solo el que cura o hace inmune). */
  aloneTime = 0;
  /** Se quedó solo: ya no se planta, va a la puerta. No vuelve atrás aunque lleguen otros. */
  forsaken = false;
  /** Frío de la zona de hielo: segundos que le quedan y de cuántos. Solo lo hace caminar lento. */
  chillTimer = 0;
  chillMax = 1;
  /** Silencio de la granada: sin escudo, sin aura, sin inmunidad, y vulnerable. Segundos que le quedan. */
  silenceTimer = 0;
  silenceMax = 1;
  /** Congelado (maestría del hielo): no se mueve ni ataca, y el golpe que lo rompe pega el doble. */
  frozenTimer = 0;
  /** Prendido fuego: segundos que le quedan, y cuánto falta para el próximo mordisco. */
  burnTimer = 0;
  burnTick = 0;
  /** La bandera: hacia dónde camina en vez de ir a la puerta, y por cuánto. */
  lureTimer = 0;
  readonly lure = new THREE.Vector3();
  /** La lupa: agrandado (más fácil de pegar) y vulnerable. */
  growTimer = 0;
  growScale = 1;
  /** La pólvora: marcado, explota al morir. */
  powderTimer = 0;
  /** Escudo divino: el próximo golpe no le entra. Se recarga solo (ver `stats.divine`). */
  divineReady: boolean;
  divineTimer = 0;
  /** Esquiva: segundos hasta que puede volver a saltar, y cuánto le queda al salto en el aire. */
  dodgeLeft = 0;
  private hopLeft = 0;
  /** Bajo el aura de un chamán: inmune a todo daño. Lo recalcula la horda en cada cuadro. */
  warded = false;
  /**
   * Cómo se mueve y ataca: el del cuerpo, o el que le da su poder (explota, cava, bandera, hechizo,
   * aura). Ver `behaviorOf`.
   */
  readonly behavior: Behavior;
  /** Tiene el punto de vida de más de la abanderada. Lo pone y lo saca la horda. */
  bannered = false;
  /** Reloj del aura de curación: cura cuando llega a HEAL_AURA.every. */
  healTimer = 0;
  /**
   * Geomante: camina, se planta y canaliza la loma (`raising`); si termina, la loma queda y él sigue a
   * la puerta (`done`).
   */
  digState: 'walk' | 'raising' | 'done' = 'walk';
  private digTimer = 0;
  /** Dónde se planta (la abanderada, el geomante): lo que diga el tipo, o donde apareció si ya estaba más cerca. */
  private holdAt = Number.NaN;
  /** El material del escudo muro, que late en violeta. */
  private wallMat: THREE.MeshStandardMaterial | null = null;
  /** Lo último que se dibujó en los cuadraditos: se redibujan solo si cambió. */
  private pipKey = '';
  /** Ya pasó la línea del golfista: está fuera de juego (nada lo toca) y corre hasta la puerta. */
  passed = false;
  /** Alma en pena: tiene agarrado al golfista. */
  grabbing = false;
  private grabTime = 0;
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
  /** Cuánto silencio le queda, debajo del hielo. */
  private readonly silenceBg: THREE.Sprite;
  private readonly silenceFill: THREE.Sprite;
  private pips: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; sprite: THREE.Sprite } | null = null;
  /** Aura del chamán, en el piso. */
  private readonly aura: THREE.Mesh | null = null;
  /** El escudo del guerrero. Se ve solo mientras sirve: silenciado desaparece. */
  private shieldMesh: THREE.Object3D | null = null;
  /** La burbuja dorada del escudo divino. */
  private readonly bubble: THREE.Mesh | null = null;
  private readonly arms: THREE.Object3D[] = [];
  private readonly spine: THREE.Object3D | null;

  // stats y maxHp no son de solo lectura: el panel de balance (tecla B) los toca en vivo. Los
  // modificadores (blindaje, escudo, aura...) van aparte, así el tipo sigue siendo el objeto compartido
  constructor(readonly stats: EnemyStats, template: Template, readonly mods: EnemyMods = {}) {
    this.behavior = behaviorOf(stats, mods);
    this.position = this.group.position;
    this.maxHp = this.hp = Math.max(1, stats.hp + (mods.hp ?? 0));
    this.divineReady = !!this.divineEvery;
    if (this.divineEvery) {
      this.bubble = new THREE.Mesh(bubbleGeo, new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.22, depthWrite: false }));
      this.bubble.scale.set(stats.radius * 1.6, stats.height * 0.62, stats.radius * 1.6);
      this.bubble.position.y = stats.height * 0.5;
      this.group.add(this.bubble);
    }
    this.model = cloneSkinned(template.scene);
    this.model.scale.setScalar(template.scale);
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.metalness = 0;
      mat.roughness = 0.85;
      const tint = mods.armor ? STEEL_TINT : mods.explode ? BOMB_TINT : mods.aura === 'heal' ? HEAL_TINT : stats.tint;
      if (tint) mat.color.setHex(tint);
      if (this.ethereal) {
        // bien traslúcido y apenas celeste: se ve a través de él
        mat.transparent = true;
        mat.opacity = 0.28;
        mat.depthWrite = false;
      }
      mesh.material = mat;
      this.materials.push({ mat, color: mat.color.clone() });
    });
    this.animator = new LayeredAnimator(this.model, template.clips);
    this.group.add(this.model);
    const right = this.model.getObjectByName('mixamorigRightArm');
    const left = this.model.getObjectByName('mixamorigLeftArm');
    if (right) this.arms.push(right);
    // el chamán conjura con los dos brazos, el alma en pena agarra con los dos, y el gólem levanta la
    // piedra con los dos por encima de la cabeza
    if (left && (this.behavior === 'shaman' || this.behavior === 'grabber' || this.behavior === 'golem' || this.behavior === 'geomancer' || this.behavior === 'ranged')) this.arms.push(left);
    this.spine = this.model.getObjectByName('mixamorigSpine1') ?? null;

    if (this.behavior === 'banner') {
      // la bandera va en la espalda, bien alta: tiene que verse desde lejos, que es donde se queda
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(-0.2, 1.6, -0.25);
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(-0.2 + 0.45, 2.6, -0.25);
      this.model.add(pole, flag);
    }

    if (this.hasShield) {
      const shield = new THREE.Group();
      const prop = this.shieldLevel >= 2 ? shieldPropFor(this.shieldLevel) : null;
      if (prop) {
        const model = prop.clone();
        // el muro late en violeta, como los inmunes del chamán: necesita su propio material
        if (this.shieldWall) {
          model.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            this.wallMat = (m.material as THREE.MeshStandardMaterial).clone();
            m.material = this.wallMat;
          });
        }
        shield.add(model);
      } else {
        const disc = new THREE.Mesh(shieldGeo, shieldMat);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 18), shieldRimMat);
        disc.rotation.x = Math.PI / 2;
        shield.add(disc, rim);
      }
      if (this.shieldWall) shield.scale.setScalar(1.3);
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
    if (this.maxHp <= 10) {
      const canvas = document.createElement('canvas');
      canvas.width = 32 * this.maxHp;
      canvas.height = 32;
      const tex = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      const pip = Math.min(0.3, 2.4 / this.maxHp);
      sprite.scale.set(pip * this.maxHp, pip, 1);
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

    this.silenceBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x26100a, transparent: true, opacity: 0.75, depthTest: false }));
    this.silenceFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff6b4a, depthTest: false }));
    for (const s of [this.silenceBg, this.silenceFill]) {
      s.center.set(0, 0.5);
      s.position.set(-barWidth / 2, stats.height + 0.08, 0);
      s.visible = false;
      s.renderOrder = 10;
      this.group.add(s);
    }
    this.silenceBg.scale.set(barWidth, 0.14, 1);
    this.silenceFill.scale.set(barWidth, 0.09, 1);
    this.silenceFill.renderOrder = 11;

    const aura = this.auraKind;
    if (aura) {
      const mat = new THREE.MeshBasicMaterial({ color: AURA_COLORS[aura], transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      this.aura = new THREE.Mesh(auraGeo, mat);
      this.aura.rotation.x = -Math.PI / 2;
      this.aura.position.y = 0.07;
      this.aura.scale.setScalar(this.auraRadius);
      this.group.add(this.aura);
    }
  }

  // ---- lo que sale del tipo y de los modificadores juntos ----

  /** Armadura de verdad: la del modificador o la del tipo. */
  get armorLevel(): number {
    return this.mods.armor ?? this.stats.armor ?? 0;
  }

  /** Lo que la armadura le resta a cada golpe ahora: el silencio de la granada se la saca mientras dura. */
  get armor(): number {
    return this.silenced ? 0 : this.armorLevel;
  }

  /** Cuánto le resta el escudo a lo que llega de frente. 0 = no tiene. */
  get shieldLevel(): number {
    return this.mods.shield ?? this.stats.shield;
  }

  get hasShield(): boolean {
    return this.shieldLevel > 0;
  }

  /** El escudo muro: de frente no pasa nada. */
  get shieldWall(): boolean {
    return this.shieldLevel >= SHIELD_WALL;
  }

  /** Cada cuánto se recarga el escudo divino, o 0 si no tiene. */
  get divineEvery(): number {
    return this.mods.divine ?? this.stats.divine ?? 0;
  }

  get auraKind(): Aura | undefined {
    return this.mods.aura ?? this.stats.aura;
  }

  get auraRadius(): number {
    return this.auraKind === 'heal' ? HEAL_AURA.radius : SHAMAN_WARD_RADIUS;
  }

  /** Etéreo: ningún golpe le saca más de 1. */
  get ethereal(): boolean {
    return this.mods.ethereal ?? this.stats.ethereal ?? false;
  }

  get alive(): boolean {
    return this.state === 'walk' || this.state === 'attack';
  }

  /** Con frío encima: camina lento. Nada más: el escudo y el aura ya no se los saca el hielo. */
  /** A qué velocidad camina ahora, con el frío encima. */
  get walkSpeed(): number {
    return this.frozen ? 0 : this.stats.speed * this.speedMul * (this.chilled ? ICE.slow : 1);
  }

  get chilled(): boolean {
    return this.chillTimer > 0;
  }

  /**
   * Silenciado por la granada: no se cubre con el escudo, si es chamán no conjura, ningún aura lo
   * protege, y cada pelotazo le saca uno más (ver `Horde.damage`).
   */
  get silenced(): boolean {
    return this.silenceTimer > 0;
  }

  /** Con el aura activa: la del chamán o la del curandero, venga del tipo o de un modificador. */
  get casting(): boolean {
    return !!this.auraKind && this.alive && !this.silenced && !this.passed;
  }

  /** Congelado por la maestría del hielo: quieto del todo. */
  get frozen(): boolean {
    return this.frozenTimer > 0;
  }

  /** Vulnerable: cada pelotazo le saca uno más (el silencio de la granada, la lupa). */
  get vulnerable(): boolean {
    return this.silenced || this.growTimer > 0;
  }

  get burning(): boolean {
    return this.burnTimer > 0;
  }

  /** Tamaño propio (el mini jefe viene más grande), aparte de lo que lo agranda la lupa. */
  get size(): number {
    return this.mods.size ?? 1;
  }

  // agrandado por la lupa (o por ser mini jefe), también es más grande para las pelotas: esa es la gracia
  get radius(): number {
    return this.stats.radius * this.growScale * this.size;
  }

  get height(): number {
    return this.stats.height * this.growScale * this.size;
  }

  /** Hacia dónde mira (unitario en el plano). */
  get facing(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  /**
   * ¿El escudo frena una pelota que viene con velocidad (vx, vy, vz)? Frena **la pelota que le llega de
   * frente**, venga rasante o en arco: solo lo pasa lo que cae casi a plomo. Silenciado o aturdido no
   * se cubre. Esto es el choque de la pelota contra el escudo; lo que estalla en el piso se pregunta
   * aparte, con `Horde.shadowed`.
   */
  blocks(vx: number, vy: number, vz: number): boolean {
    if (!this.shieldUp || this.stunTimer > 0) return false;
    // más empinado que 45 grados le entra por arriba del escudo: ese es el globo del wedge. El arco del
    // hierro (unos 27 grados) no llega a tanto, así que el escudo sí lo frena
    const h = Math.hypot(vx, vz);
    if (h < 0.5 || Math.abs(vy) > h) return false;
    const f = this.facing;
    return (vx * f.x + vz * f.z) / h < -SHIELD_FRONT;
  }

  /**
   * Los poderes que trae, en íconos, para ponerlos antes de la vida. Los que la granada silencia llevan
   * `mutes` y, mientras dura el silencio, una cruz encima.
   */
  private badges(): Badge[] {
    const out: Badge[] = [];
    // la calavera marca al élite, venga con el poder que venga
    if (this.size > 1) out.push({ icon: 'skull' });
    if (this.hasShield) out.push(this.shieldWall ? { icon: 'wall', mutes: true } : { icon: 'shield', value: this.shieldLevel, mutes: true });
    if (this.armorLevel > 0) out.push({ icon: 'armor', value: this.armorLevel, mutes: true });
    if (this.auraKind) out.push({ icon: this.auraKind, mutes: true });
    if (this.behavior === 'banner') out.push({ icon: 'banner', mutes: true });
    if (this.behavior === 'kamikaze') out.push({ icon: 'bomb' });
    if (this.behavior === 'geomancer') out.push({ icon: 'dig', mutes: true });
    if (this.behavior === 'ranged') out.push({ icon: 'spell', mutes: true });
    if (this.ethereal) out.push({ icon: 'ethereal' });
    if (this.divineEvery) out.push({ icon: 'divine', off: !this.divineReady });
    if (this.mods.dodge) out.push({ icon: 'dodge', off: this.dodgeLeft > 0, mutes: true });
    return out;
  }

  /**
   * Arriba de cada uno: primero sus poderes en íconos (el escudo y el blindaje con su número), después la
   * vida en cuadraditos, uno por punto, siempre a la vista para decidir cuánto cargar. El punto de más de
   * la abanderada va en dorado. Lo que la granada silencia se tacha mientras dura.
   */
  private drawPips(): void {
    const p = this.pips;
    if (!p) return;
    const badges = this.badges();
    // los íconos van más grandes que los cuadraditos: tienen un número o una forma que leer de lejos
    const width = BADGE_PX * badges.length + 32 * this.maxHp;
    if (p.canvas.width !== width || p.canvas.height !== BADGE_PX) {
      p.canvas.width = width;
      p.canvas.height = BADGE_PX;
      p.tex.dispose();
      p.tex = new THREE.CanvasTexture(p.canvas);
      p.sprite.material.map = p.tex;
      p.sprite.material.needsUpdate = true;
      const perPx = Math.min(0.3, 2.4 / (this.maxHp + badges.length)) / 32;
      p.sprite.scale.set(width * perPx, BADGE_PX * perPx, 1);
    }
    const ctx = p.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
    badges.forEach((b, i) => {
      ctx.save();
      ctx.translate(i * BADGE_PX, 0);
      ctx.scale(BADGE_PX / 32, BADGE_PX / 32);
      drawBadge(ctx, 0, b, !!b.mutes && this.silenced);
      ctx.restore();
    });
    const top = (BADGE_PX - 32) / 2;
    for (let i = 0; i < this.maxHp; i++) {
      if (i >= this.hp) ctx.fillStyle = 'rgba(10, 14, 20, 0.7)';
      else ctx.fillStyle = this.bannered && i === this.maxHp - 1 ? '#ffd34d' : '#5be07a';
      ctx.strokeStyle = '#0b0f14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(badges.length * BADGE_PX + i * 32 + 4, top + 5, 24, 22, 5);
      ctx.fill();
      ctx.stroke();
    }
    p.tex.needsUpdate = true;
    p.sprite.visible = this.alive && !this.passed;
  }

  /** Redibuja la vida si cambió algo de lo que muestra (la vida, la bandera, el silencio sobre la armadura). */
  refreshPipsIfChanged(): void {
    const key = `${this.hp}/${this.maxHp}/${this.armorLevel}/${this.shieldLevel}/${this.silenced}/${this.bannered}/${this.divineReady}/${this.dodgeLeft > 0}/${this.alive && !this.passed}`;
    if (key === this.pipKey) return;
    this.pipKey = key;
    this.refreshBar();
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
      // la pólvora y el fuego los lee la horda después de este golpe: por eso no se borran acá
      this.chillTimer = 0;
      this.silenceTimer = 0;
      this.frozenTimer = 0;
      this.lureTimer = 0;
      this.refreshBar();
      this.refreshChill();
      if (this.aura) this.aura.visible = false;
      if (this.bubble) this.bubble.visible = false;
      if (this.behavior === 'kamikaze') this.fuse = 0.12;
      else this.animator.playOneShot('Hard Landing', 1.3, true, 0.42);
      return true;
    }
    this.refreshBar();
    if (!this.stats.heavy && this.state !== 'attack') this.stunTimer = 0.35;
    return false;
  }

  /**
   * Frío: camina lento durante `seconds`. Nunca congela del todo: el enemigo sigue caminando y atacando,
   * solo que a paso de hombre. La zona de hielo se lo renueva en cada cuadro mientras esté adentro.
   */
  chill(seconds: number): void {
    if (!this.alive) return;
    // ningún frío acorta al anterior
    if (seconds >= this.chillTimer) {
      this.chillTimer = seconds;
      this.chillMax = seconds;
    }
  }

  /** Silencio de la granada durante `seconds`: sin escudo, sin aura, sin inmunidad y vulnerable. */
  silence(seconds: number): void {
    if (!this.alive || seconds <= 0) return;
    if (seconds >= this.silenceTimer) {
      this.silenceTimer = seconds;
      this.silenceMax = seconds;
    }
  }

  /** Congelado `seconds`: quieto del todo, sin atacar. El próximo golpe lo rompe y pega el doble. */
  freeze(seconds: number): void {
    if (!this.alive) return;
    this.frozenTimer = Math.max(this.frozenTimer, seconds);
  }

  /** Prendido fuego `seconds`. Si ya estaba prendido, le alarga el fuego sin mordisco extra. */
  burn(seconds: number): void {
    if (!this.alive) return;
    if (!this.burning) this.burnTick = 0;
    this.burnTimer = Math.max(this.burnTimer, seconds);
  }

  /** La bandera: camina hacia (x, z) durante `seconds` en vez de ir a la puerta. */
  lureTo(x: number, z: number, seconds: number): void {
    if (!this.alive || this.passed) return;
    this.lure.set(x, 0, z);
    this.lureTimer = Math.max(this.lureTimer, seconds);
  }

  /** La lupa: agrandado y vulnerable durante `seconds`. */
  grow(seconds: number): void {
    if (!this.alive) return;
    this.growTimer = Math.max(this.growTimer, seconds);
  }

  /** La pólvora: marcado durante `seconds`; si muere marcado, explota. */
  markPowder(seconds: number): void {
    if (!this.alive) return;
    this.powderTimer = Math.max(this.powderTimer, seconds);
  }

  /**
   * Escudo divino: si está en alto, se lo come este golpe (no entra nada) y empieza a recargarse.
   * Devuelve true si el golpe se lo comió el escudo.
   */
  spendDivine(): boolean {
    if (!this.divineReady) return false;
    this.divineReady = false;
    this.divineTimer = this.divineEvery || 5;
    return true;
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
    if (this.state === 'attack' && this.behavior !== 'kamikaze') this.state = 'walk';
    this.stunTimer = Math.max(this.stunTimer, seconds);
  }

  /** ¿Puede esquivar ahora? Tiene el poder, no está silenciado, ni aturdido, ni congelado, ni recargando. */
  get canDodge(): boolean {
    return !!this.mods.dodge && this.alive && !this.passed && !this.silenced && this.dodgeLeft <= 0
      && this.stunTimer <= 0 && this.frozenTimer <= 0 && !this.grabbing;
  }

  /** Salta DODGE.distance metros hacia `side` (unitario en el piso), con un saltito. */
  dodge(side: THREE.Vector3): void {
    this.knock.addScaledVector(side, DODGE.distance * KNOCK_DECAY);
    this.dodgeLeft = DODGE.cooldown;
    this.hopLeft = DODGE.hopTime;
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
    if (this.silenceTimer > 0) this.silenceTimer = Math.max(0, this.silenceTimer - dt);
    if (this.frozenTimer > 0) this.frozenTimer = Math.max(0, this.frozenTimer - dt);
    if (this.lureTimer > 0) this.lureTimer = Math.max(0, this.lureTimer - dt);
    if (this.growTimer > 0) this.growTimer = Math.max(0, this.growTimer - dt);
    if (this.powderTimer > 0) this.powderTimer = Math.max(0, this.powderTimer - dt);
    if (!this.divineReady && this.divineEvery) {
      this.divineTimer -= dt;
      if (this.divineTimer <= 0) this.divineReady = true;
    }
    if (this.dodgeLeft > 0) this.dodgeLeft = Math.max(0, this.dodgeLeft - dt);
    if (this.hopLeft > 0) {
      this.hopLeft = Math.max(0, this.hopLeft - dt);
      this.model.position.y = Math.sin(Math.PI * (1 - this.hopLeft / DODGE.hopTime)) * DODGE.hop;
    }
    // la lupa agranda de a poco, y achica de a poco: que se vea que crece
    const size = this.growTimer > 0 ? LENS.scale : 1;
    this.growScale += (size - this.growScale) * (1 - Math.exp(-8 * dt));
    this.group.scale.setScalar(this.growScale * this.size);
    this.refreshChill();
    const slow = this.chilled ? ICE.slow : 1;
    const behavior = this.behavior;
    const castGesture = this.casting || this.digState === 'raising' ? 1 : 0;
    this.refreshPipsIfChanged();
    if (this.aura) {
      this.aura.visible = this.casting;
      this.aura.scale.setScalar(this.auraRadius);
      this.aura.rotation.z += dt * 0.4;
      (this.aura.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.2 * Math.sin(this.age * 3);
    }

    if (this.grabbing) {
      this.updateGrab(dt, player, horde);
      return;
    }

    // congelado: ni camina ni ataca, y el ataque que tenía en curso queda en suspenso
    if (this.stunTimer > 0 || this.frozen) {
      if (this.stunTimer > 0) this.stunTimer -= dt;
      this.animator.setLocomotion('Idle', this.frozen ? 0.001 : 1);
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
      if ((behavior === 'melee' || behavior === 'banner' || behavior === 'geomancer') && !player.invulnerable) {
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
      this.silenceTimer = 0;
      this.frozenTimer = 0;
      this.burnTimer = 0;
      this.lureTimer = 0;
      this.growTimer = 0;
      this.powderTimer = 0;
      this.stunTimer = 0;
      this.knock.set(0, 0, 0);
      for (const { mat } of this.materials) {
        mat.transparent = true;
        // el que ya pasó se desvanece; el fantasma ya era más traslúcido que eso
        mat.opacity = Math.min(mat.opacity, 0.4);
        mat.needsUpdate = true;
      }
      this.refreshBar();
      this.refreshChill();
    }

    // dónde se para: los que pelean llegan hasta la puerta; el chamán y el gólem se plantan lejos, la
    // abanderada se queda al fondo, y el geomante se planta mientras cava
    if (Number.isNaN(this.holdAt)) {
      const want = behavior === 'banner' ? BANNER_HOLD_Z : behavior === 'geomancer' ? GEOMANCER.holdZ : behavior === 'ranged' ? RANGED.holdZ : Number.NaN;
      this.holdAt = Math.min(want, this.position.z);
    }
    const holdZ = behavior === 'shaman' && !this.forsaken ? SHAMAN_HOLD_Z
      : behavior === 'golem' ? GOLEM_HOLD_Z
        : behavior === 'banner' || behavior === 'ranged' ? this.holdAt
          : behavior === 'geomancer' && this.digState !== 'done' ? this.holdAt
            : null;
    const holding = holdZ !== null && this.target === 'gate';
    const gateX = holding ? this.position.x : THREE.MathUtils.clamp(this.position.x, -GATE_HALF_WIDTH + 0.3, GATE_HALF_WIDTH - 0.3);
    const gateZ = holding ? holdZ : GATE_Z + this.radius + 0.3;
    // la bandera le gana a la puerta mientras dura; al alma en pena no la engaña, que va por vos
    const lured = this.lureTimer > 0 && this.target === 'gate' && !this.passed;
    const tx = lured ? this.lure.x : this.target === 'player' ? player.position.x : gateX;
    const tz = lured ? this.lure.z : this.target === 'player' ? player.position.z : gateZ;
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
      // el que tira plantado sigue mirando a la puerta: mirar al punto donde se planta, que queda a
      // centímetros y a veces a su espalda, lo hacía darse vuelta para tirar la piedra de espaldas
      if (holding) {
        lookX = behavior === 'ranged' ? player.position.x - this.position.x : -this.position.x * 0.2;
        lookZ = behavior === 'ranged' ? player.position.z - this.position.z : GATE_Z - this.position.z;
      }
      this.animator.setLocomotion('Idle', 1);
    } else if (lured && dist <= 1.5) {
      // llegó a la bandera: se queda dando vueltas hasta que se le pasa
      this.animator.setLocomotion('Idle', 1);
    } else if (dist <= reach) {
      if (holding) {
        // plantado: mira a la puerta (el hechicero, al golfista). El gólem cada tanto tira piedras; el
        // hechicero, hechizos; el chamán solo sostiene el aura
        lookX = behavior === 'ranged' ? player.position.x - this.position.x : -this.position.x * 0.2;
        lookZ = behavior === 'ranged' ? player.position.z - this.position.z : GATE_Z - this.position.z;
        if (behavior === 'golem' && !horde.ceaseFire) {
          this.castTimer -= dt * slow;
          if (this.castTimer <= 0) this.startAttack(this.stats.attackEvery ?? GOLEM_THROW_EVERY);
        }
        // silenciado no tira
        if (behavior === 'ranged' && !this.silenced && player.alive && !horde.ceaseFire) {
          this.castTimer -= dt * slow;
          if (this.castTimer <= 0) this.startAttack(RANGED.every);
        }
        if (behavior === 'geomancer') this.updateDig(dt, horde);
        this.animator.setLocomotion('Idle', 1);
      } else if (behavior === 'grabber') {
        if (player.alive && !player.invulnerable && !player.grabbedBy) {
          this.grabbing = true;
          this.grabTime = 0;
          player.grab(this);
          // lo que saca, lo saca de una: después solo lo tiene congelado un momento
          player.drain(GRAB.damage);
          horde.emit({ type: 'grab', enemy: this });
          horde.emit({ type: 'playerHit', enemy: this, amount: GRAB.damage });
        }
        this.animator.setLocomotion('Idle', 1);
      } else if (this.target === 'gate' && (behavior === 'melee' || behavior === 'banner' || behavior === 'geomancer' || behavior === 'shaman')) {
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
      const speed = this.passed ? PASSED_SPEED : Math.min(this.walkSpeed, this.paceCap);
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

  /** El geomante plantado: canaliza la loma; si termina, la deja para siempre y sigue viaje. */
  private updateDig(dt: number, horde: Horde): void {
    if (this.digState === 'walk') {
      this.digState = 'raising';
      this.digTimer = GEOMANCER.channel;
      horde.raiseMound(this);
      return;
    }
    this.digTimer -= dt;
    if (this.digTimer > 0) return;
    this.digState = 'done';
    horde.settleMound(this);
  }

  private clampToField(): void {
    this.position.x = THREE.MathUtils.clamp(this.position.x, -FIELD_HALF_WIDTH - 2, FIELD_HALF_WIDTH + 2);
    this.position.z = Math.max(this.position.z, GATE_Z + this.radius * 0.5);
  }

  /** El alma en pena agarrada al golfista: lo tiene congelado GRAB.hold segundos y se esfuma. */
  private updateGrab(dt: number, player: Player, horde: Horde): void {
    if (player.grabbedBy !== this || !player.alive) {
      this.vanish(horde);
      return;
    }
    this.grabTime += dt;
    if (this.grabTime >= GRAB.hold) {
      player.release(this);
      this.vanish(horde);
      return;
    }
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    this.yaw = Math.atan2(dx, dz);
    this.animator.setLocomotion('Idle', 1);
    this.finishFrame(dt, 1);
  }

  /** Suelta al golfista y desaparece del campo, sin morir: no da puntos ni cuenta como baja. */
  private vanish(horde: Horde): void {
    this.grabbing = false;
    this.hp = 0;
    this.state = 'gone';
    horde.emit({ type: 'release', enemy: this });
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
    if (this.behavior === 'shaman' || this.behavior === 'geomancer') {
      // manos en alto mientras sostiene el aura (o mientras levanta la tierra)
      angle = -2.75 + 0.12 * Math.sin(this.age * 3);
      lean = -0.12;
    } else if (this.behavior === 'grabber') {
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
    this.attackHitAt = this.behavior === 'kamikaze' ? KAMIKAZE_FUSE : windup * slowSwing;
    this.attackEnd = this.attackHitAt + 0.45 * slowSwing;
  }

  /** Resuelve el impacto del ataque. Devuelve true si el enemigo dejó de existir (kamikaze). */
  private resolveAttack(player: Player, horde: Horde, toPlayer: number): boolean {
    const behavior = this.behavior;
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
      // el que ya tenía la piedra levantada cuando terminó la partida no la tira
      if (!horde.ceaseFire) horde.throwRock(this);
    } else if (behavior === 'ranged') {
      if (!horde.ceaseFire) horde.castSpell(this, player);
    } else {
      horde.emit({ type: 'gateHit', enemy: this, amount: this.stats.gateDamage });
    }
    return false;
  }

  /** ¿Tiene el escudo en alto? Silenciado por la granada lo baja hasta que se le pasa. */
  get shieldUp(): boolean {
    return this.hasShield && this.alive && !this.silenced && !this.passed;
  }

  private updateLook(dt: number): void {
    // lo que se ve coincide con lo que pasa: sin escudo a la vista, el driver entra
    // tampoco se ve mientras cae muerto
    if (this.shieldMesh) this.shieldMesh.visible = this.shieldUp;
    if (this.wallMat) this.wallMat.emissive.setRGB(0.45, 0.12, 0.8).multiplyScalar(0.22 + 0.14 * Math.sin(this.age * 6));
    if (this.flashTimer > 0) this.flashTimer -= dt;
    const flash = this.flashTimer > 0;
    // el kamikaze late en rojo, cada vez más rápido cuando ya encendió la mecha
    const fuseOn = this.behavior === 'kamikaze' && this.state === 'attack';
    const pulse = this.behavior === 'kamikaze' ? 0.5 + 0.5 * Math.sin(this.age * (fuseOn ? 40 : 9)) : 0;
    const ward = this.warded && this.alive ? 0.55 + 0.25 * Math.sin(this.age * 6) : 0;
    // el fuego parpadea, la pólvora late despacio
    const flame = this.burning ? 0.55 + 0.45 * Math.sin(this.age * 23) * Math.sin(this.age * 7) : 0;
    const powder = this.powderTimer > 0 ? 0.5 + 0.5 * Math.sin(this.age * 5) : 0;
    if (this.bubble) {
      this.bubble.visible = this.divineReady && this.alive && !this.passed;
      (this.bubble.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.08 * Math.sin(this.age * 4);
    }
    for (const { mat, color } of this.materials) {
      if (flash) mat.emissive.setHex(0xffffff);
      else if (this.frozen) mat.emissive.setHex(0x3a7fa8);
      else if (flame) mat.emissive.setRGB(0.75 * flame, 0.25 * flame, 0.02);
      else if (this.silenced) mat.emissive.copy(SILENCE_EMISSIVE);
      else if (powder) mat.emissive.setRGB(0.4 * powder, 0.02, 0.02);
      else if (this.chilled) mat.emissive.setHex(0x0c2a3c);
      else if (ward) mat.emissive.setRGB(0.45 * ward, 0.12 * ward, 0.8 * ward);
      // el fantasma brilla apenas celeste, así se lo ve aunque sea casi transparente
      else if (this.ethereal && !pulse) mat.emissive.setRGB(0.12, 0.2, 0.3);
      else mat.emissive.setRGB(pulse * 0.7, pulse * 0.08, 0);
      mat.emissiveIntensity = flash ? 0.6 : 1;
      if (this.frozen) mat.color.copy(color).lerp(FROZEN_TINT, 0.7);
      else if (this.chilled) mat.color.copy(color).lerp(CHILL_TINT, 0.45);
      else mat.color.copy(color);
    }
  }

  /** Las dos barritas de estado, debajo de la vida: el frío y el silencio. */
  private refreshChill(): void {
    const cold = this.chilled && this.alive;
    this.chillBg.visible = this.chillFill.visible = cold;
    if (cold) this.chillFill.scale.x = Math.max(0.001, this.chillBg.scale.x * (this.chillTimer / this.chillMax));
    const mute = this.silenced && this.alive;
    this.silenceBg.visible = this.silenceFill.visible = mute;
    if (mute) this.silenceFill.scale.x = Math.max(0.001, this.silenceBg.scale.x * (this.silenceTimer / this.silenceMax));
  }

  dispose(): void {
    for (const { mat } of this.materials) mat.dispose();
    this.barBg.material.dispose();
    this.barFill.material.dispose();
    this.chillBg.material.dispose();
    this.chillFill.material.dispose();
    this.silenceBg.material.dispose();
    this.silenceFill.material.dispose();
    if (this.pips) {
      this.pips.tex.dispose();
      this.pips.sprite.material.dispose();
    }
    if (this.aura) (this.aura.material as THREE.Material).dispose();
    if (this.bubble) (this.bubble.material as THREE.Material).dispose();
    this.wallMat?.dispose();
  }
}

export class Horde {
  readonly enemies: Enemy[] = [];
  /** La partida terminó: el gólem y los hechiceros dejan de tirar (a la puerta caída o al golfista tirado). */
  ceaseFire = false;
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

  private add(kind: EnemyKind, x: number, z: number, mods?: EnemyMods): Enemy {
    const template = this.templates.get(kind);
    if (!template) throw new Error(`falta el modelo de ${kind}`);
    const enemy = new Enemy(ENEMIES[kind], template, mods ?? {});
    enemy.position.set(x, 0, z);
    this.scene.add(enemy.group);
    this.enemies.push(enemy);
    return enemy;
  }

  /** Aparición de una oleada: suelto, en el fondo del campo. */
  spawn(kind: EnemyKind, at?: THREE.Vector3, mods?: EnemyMods): Enemy {
    if (at) return this.add(kind, at.x, at.z, mods);
    const stats = ENEMIES[kind];
    // reparte las apariciones a lo ancho con la razón áurea, para que no salgan encimados
    const u = (this.spawnCount++ * 0.618034) % 1;
    const half = stats.behavior === 'golem' ? 3 : FIELD_HALF_WIDTH - 3;
    return this.add(kind, (u * 2 - 1) * half, SPAWN_Z + Math.random() * 3, mods);
  }

  /** Las maestrías que tiene el golfista: cambian qué hacen el hielo, el fuego y el rayo. */
  readonly mastery = { ice: false, fire: false, lightning: false };

  /**
   * Daña a un enemigo y avisa. Devuelve true si lo mató. `dot` es el daño que no es un pelotazo (el
   * fuego que va mordiendo): a ese no le suma la vulnerabilidad ni rompe el hielo.
   */
  /** Lo que sacó de verdad el último golpe (después de blindaje, escudo y etéreo). */
  lastDealt = 0;

  /**
   * @param guard lo que resta un escudo por el que pasó el golpe (lo que le llegó de frente): 0 si no
   */
  damage(enemy: Enemy, amount: number, knockDir: THREE.Vector3 | null, knockback: number, dot = false, guard = 0): boolean {
    this.lastDealt = 0;
    if (!enemy.alive || enemy.passed) return false;
    if (enemy.warded) {
      this.emit({ type: 'immune', enemy });
      return false;
    }
    // el escudo divino se come el primer golpe entero, sea lo que sea
    if (enemy.spendDivine()) {
      this.emit({ type: 'divine', enemy });
      return false;
    }
    // El vulnerable (silenciado por la granada, o agrandado por la lupa) cobra uno más por pelotazo,
    // aunque el palo pegue cero. Es lo que hace que la granada sirva contra los jefes, no solo contra
    // los grupos. Y el congelado se rompe: ese golpe pega el doble.
    let raw = amount + (enemy.vulnerable && !dot ? VULNERABLE.bonus : 0);
    const crit = enemy.frozen && !dot;
    if (crit) {
      raw *= 2;
      enemy.frozenTimer = 0;
    }
    // La vida va en enteros: todo golpe que entra saca al menos 1. Después la armadura le resta lo suyo:
    // al acorazado un golpe de 1 no le hace nada
    let dealt = raw > 0 ? Math.max(1, Math.round(raw)) : 0;
    // la armadura (hasta 3): el silencio de la granada se la saca mientras dura
    const armor = enemy.armor;
    if (armor > 0 && dealt > 0) {
      dealt = Math.max(0, dealt - armor);
      if (dealt === 0) this.emit({ type: 'armored', enemy });
    }
    // el escudo es blindaje de frente: resta lo suyo a lo que le llegó por delante
    if (guard > 0 && dealt > 0) {
      dealt = Math.max(0, dealt - guard);
      if (dealt === 0) this.emit({ type: 'shielded', enemy });
    }
    // el etéreo es el revés: ningún golpe le saca más de 1, por fuerte que sea
    if (enemy.ethereal && dealt > 1) dealt = 1;
    this.lastDealt = dealt;
    const hadPowder = enemy.powderTimer > 0;
    const wasBurning = enemy.burning;
    const killed = enemy.damage(dealt, knockDir, knockback);
    // un golpe de cero sí empuja, pero no es daño: sin esto, un palo con la tabla en 0 llenaba la
    // pantalla de «0» flotando encima de cada enemigo
    if (dealt > 0 || killed) this.emit({ type: 'damage', enemy, amount: dealt, killed, crit });
    if (killed) {
      enemy.powderTimer = 0;
      enemy.burnTimer = 0;
      // la pólvora: el marcado explota al morir, y si los de al lado también están marcados, siguen
      if (hadPowder) {
        const pos = enemy.position.clone();
        this.emit({ type: 'powder', pos, radius: POWDER.blast });
        this.blast(pos, POWDER.blast, this.powderDamage, 6, enemy);
      }
      // la maestría del fuego: el que muere prendido contagia a los que tiene al lado
      if (wasBurning && this.mastery.fire) {
        for (const e of this.enemies) {
          if (e === enemy || !e.alive || e.passed) continue;
          if (Math.hypot(e.position.x - enemy.position.x, e.position.z - enemy.position.z) - e.radius <= ELEMENTS.spreadRadius) e.burn(this.spreadBurn);
        }
      }
    }
    return killed;
  }

  /**
   * El hoyo: se lo traga entero, tenga la vida que tenga. El aura del chamán lo salva igual, y el
   * escudo divino no (no es un golpe). Devuelve true si se lo tragó.
   */
  swallow(e: Enemy): boolean {
    if (!e.alive || e.passed || e.warded) return false;
    const hp = e.hp;
    const killed = e.damage(hp, null, 0);
    if (killed) this.emit({ type: 'damage', enemy: e, amount: hp, killed: true });
    return killed;
  }

  /** Cuánto pega la explosión de la pólvora: lo fija el nivel de la habilidad al marcar. */
  powderDamage = 2;
  /** Cuánto dura el fuego contagiado. */
  spreadBurn = 3;

  /**
   * Hielo de un golpe: enfría `seconds`. Con la maestría, al que **ya estaba frío** lo congela: la
   * segunda fuente de hielo es la que congela. La zona de hielo no pasa por acá cuadro a cuadro (eso no
   * es una segunda fuente), solo cuando cae.
   */
  applyIce(e: Enemy, seconds: number): void {
    if (!e.alive || e.passed) return;
    if (this.mastery.ice && e.chilled && !e.frozen) {
      e.freeze(ELEMENTS.freezeSeconds);
      this.emit({ type: 'frozen', enemy: e });
    }
    e.chill(seconds);
  }

  /**
   * Rayo: salta de `from` al más cercano que no haya tocado todavía este mismo tiro (`seen`), y de ahí
   * al siguiente, `jumps` veces. Nunca vuelve a uno que ya tocó: no puede dar vueltas matando a todo.
   */
  chain(from: Enemy, jumps: number, seen: Set<number>): void {
    const damage = ELEMENTS.chainDamage * (this.mastery.lightning ? 2 : 1);
    const total = jumps + (this.mastery.lightning ? 1 : 0);
    seen.add(from.id);
    let at = from.position.clone();
    for (let j = 0; j < total; j++) {
      let next: Enemy | null = null;
      let best = ELEMENTS.chainRange;
      for (const e of this.enemies) {
        if (!e.alive || e.passed || seen.has(e.id)) continue;
        const d = Math.hypot(e.position.x - at.x, e.position.z - at.z);
        if (d < best) { best = d; next = e; }
      }
      if (!next) return;
      seen.add(next.id);
      const to = next.position.clone();
      this.emit({ type: 'zap', from: at.clone().setY(at.y + 1), to: to.clone().setY(to.y + next.height * 0.6) });
      this.damage(next, damage, null, 0);
      at = to;
    }
  }

  /**
   * Daño en área. Devuelve a cuántos alcanzó. `skip` deja afuera a los que esa misma pelota ya golpeó
   * al atravesarlos: el hierro atraviesa y además abre un área donde cae, y nadie tiene que cobrar las
   * dos cosas por un solo tiro.
   *
   * **Toda área pega parejo**, la de los palos y la del kamikaze: el que está adentro del radio cobra el
   * daño entero, esté en el centro o en el borde. Antes caía hasta un 60 % hacia el borde, y el número
   * del panel no era el que se cobraba.
   */
  blast(pos: THREE.Vector3, radius: number, damage: number, knockback: number, except: Enemy | null = null, skip?: Set<number>, onHit?: (e: Enemy) => void): number {
    let count = 0;
    const dir = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.passed || e === except || skip?.has(e.id)) continue;
      dir.set(e.position.x - pos.x, 0, e.position.z - pos.z);
      const d = dir.length() - e.radius;
      if (d > radius) continue;
      // el escudo también para lo que estalla en el piso, si estalló adelante suyo
      // lo que estalla adelante de un escudo pasa descontado; el muro no deja pasar nada
      const guard = this.shadeOf(pos, e);
      if (guard >= SHIELD_WALL) {
        this.emit({ type: 'shielded', enemy: e });
        skip?.add(e.id);
        continue;
      }
      if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
      this.damage(e, damage, dir.normalize(), knockback, false, guard);
      skip?.add(e.id);
      // si el escudo se comió todo, no cuenta como alcanzado (para las rachas es como errar)
      if (guard > 0 && this.lastDealt === 0) continue;
      onHit?.(e);
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

  /**
   * ¿El escudo lo tapa de algo que estalla en `pos`? Vale para el **daño en área**, que se expande por
   * el piso; la pelota tiene su propio choque contra el escudo (ver `Enemy.blocks`).
   *
   * Protege al que lo lleva, si la explosión le queda de frente, y **a los que tiene detrás**: el
   * escudo hace sombra, así que una fila parapetada atrás de un guerrero se cubre con él. De ahí sale
   * la respuesta: al del escudo no lo resolvés tirándole un globo a los pies, lo resolvés
   * silenciándolo con la granada, o metiendo el globo **detrás** de él, que es de donde el escudo no
   * lo tapa.
   *
   * Las habilidades pasan igual: la granada es justamente la forma de sacarle el escudo, y si el
   * escudo lo parara no habría con qué empezar.
   */
  /**
   * Cuánto escudo tiene adelante `e` para algo que estalla en `pos`: el suyo, o el de alguien que lo
   * tapa. El más fuerte, si hay varios. 0 = nada lo cubre.
   */
  shadeOf(pos: THREE.Vector3, e: Enemy): number {
    let guard = 0;
    for (const s of this.enemies) {
      // el escudo tiene que estar en alto y mirando hacia donde estalló: por la espalda no cubre a nadie
      if (!s.shieldUp || !shieldFaces(pos, s.position, s.facing)) continue;
      if (s === e || behindShield(pos, s.position, s.radius, e.position, e.radius)) guard = Math.max(guard, s.shieldLevel);
    }
    return guard;
  }

  /**
   * Frío en área: a todos los que alcanza les deja `seconds` de frío. La zona de hielo lo llama en cada
   * cuadro con lo que le dura el frío al que sale, así que adentro nunca se le acaba. `seen` junta a
   * todos los que alguna vez pisaron la zona. Devuelve a cuántos alcanzó ahora.
   */
  chillAround(pos: THREE.Vector3, radius: number, seconds: number, seen?: Set<number>): number {
    let count = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.passed) continue;
      if (Math.hypot(e.position.x - pos.x, e.position.z - pos.z) - e.radius > radius) continue;
      e.chill(seconds);
      seen?.add(e.id);
      count++;
    }
    return count;
  }

  /**
   * Vendaval: barre un rectángulo centrado en `pos` y orientado según la línea del tiro (`along`,
   * unitario): halfDepth a lo largo de la línea y halfWidth a cada costado. Empuja a cada uno hacia la
   * línea, justo lo que lo separa de ella, así que terminan todos parados sobre la línea del tiro: una
   * fila servida para el driver. Devuelve a cuántos movió.
   */
  sweep(pos: THREE.Vector3, along: THREE.Vector3, halfWidth: number, halfDepth: number, skip?: Set<number>, oval = false): number {
    let count = 0;
    // el costado de la línea del tiro, en el piso
    const side = new THREE.Vector3(along.z, 0, -along.x);
    const dir = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.passed || skip?.has(e.id)) continue;
      const rx = e.position.x - pos.x;
      const rz = e.position.z - pos.z;
      const lateral = rx * side.x + rz * side.z;
      const forward = rx * along.x + rz * along.z;
      // donde cae barre un óvalo, que es lo que se dibuja; el pasillo del driver es un rectángulo, y
      // tiene que serlo: se barre de a tramitos a medida que la pelota avanza
      if (oval) {
        const u = lateral / halfWidth;
        const v = forward / (halfDepth + e.radius);
        if (u * u + v * v > 1) continue;
      } else if (Math.abs(lateral) > halfWidth || Math.abs(forward) > halfDepth + e.radius) continue;
      if (Math.abs(lateral) > 0.05) e.shove(dir.copy(side).multiplyScalar(-Math.sign(lateral)), Math.abs(lateral) * KNOCK_DECAY);
      skip?.add(e.id);
      count++;
    }
    return count;
  }

  /**
   * Granada: agarra a todos los que estén a `radius` de `pos`, los **silencia** `silence` segundos, y
   * a los que no están en el centro los tira **a los costados de la línea del tiro** (`along`,
   * unitario), hasta dejarlos a `push` metros de ella: dos filas paralelas al tiro, que apuntan hacia el
   * golfista. Los del centro (a menos de `core` metros) se quedan quietos. No hace daño. El que cae
   * justo sobre la línea sale para un lado al azar. Devuelve a cuántos agarró.
   */
  spread(pos: THREE.Vector3, along: THREE.Vector3, radius: number, core: number, push: number, silence: number): number {
    let count = 0;
    const side = new THREE.Vector3(along.z, 0, -along.x);
    const dir = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.passed) continue;
      const rx = e.position.x - pos.x;
      const rz = e.position.z - pos.z;
      const d = Math.hypot(rx, rz);
      if (d - e.radius > radius) continue;
      e.silence(silence);
      count++;
      // el centro no se mueve: tirándola encima de un grupo, los dejás silenciados donde están
      if (d <= core) continue;
      let lateral = rx * side.x + rz * side.z;
      if (Math.abs(lateral) < 0.05) lateral = Math.random() < 0.5 ? -0.05 : 0.05;
      const shift = grenadeShift(lateral, push);
      // la velocidad es lo que tiene que recorrer por KNOCK_DECAY: el empujón se apaga justo ahí
      if (shift !== 0) e.shove(dir.copy(side).multiplyScalar(Math.sign(shift)), Math.abs(shift) * KNOCK_DECAY);
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
   * juntos serían imposibles de matar. Y el silenciado por la granada tampoco: el silencio le saca
   * cualquier inmunidad.
   */
  private updateWards(): void {
    const casters = this.enemies.filter((e) => e.casting && e.auraKind === 'ward');
    for (const e of this.enemies) {
      e.warded = false;
      // ninguno que tenga aura queda protegido, sea cual sea la suya
      if (!e.alive || e.silenced || e.auraKind) continue;
      for (const c of casters) {
        if (Math.hypot(e.position.x - c.position.x, e.position.z - c.position.z) <= SHAMAN_WARD_RADIUS + e.radius) {
          e.warded = true;
          break;
        }
      }
    }
  }

  /**
   * Aura de curación: cada HEAL_AURA.every segundos, cada curandero le devuelve vida a los que tiene
   * cerca, sin pasarse de la de cada uno. Como con la inmunidad, ninguno que tenga aura se cura por
   * otra: dos curanderos juntos no se sostendrían entre ellos.
   */
  private updateHeals(dt: number): void {
    for (const c of this.enemies) {
      if (!c.casting || c.auraKind !== 'heal') {
        c.healTimer = 0;
        continue;
      }
      c.healTimer += dt;
      if (c.healTimer < HEAL_AURA.every) continue;
      c.healTimer -= HEAL_AURA.every;
      for (const e of this.enemies) {
        if (!e.alive || e.passed || e.auraKind || e.hp >= e.maxHp) continue;
        if (Math.hypot(e.position.x - c.position.x, e.position.z - c.position.z) > HEAL_AURA.radius + e.radius) continue;
        const amount = Math.min(HEAL_AURA.amount, e.maxHp - e.hp);
        e.hp += amount;
        this.emit({ type: 'healed', enemy: e, amount });
      }
    }
  }

  /** ¿Hay una abanderada viva, en juego y sin silenciar? */
  private bannerUp = false;

  /**
   * La abanderada: mientras haya una en pie (viva y sin silenciar), todos los demás tienen 1 de vida más,
   * de máximo y de actual. Cuando cae, cada uno pierde ese punto, pero nadie baja de 1: matarla no
   * liquida a nadie gratis. No se apilan: con dos, sigue siendo +1.
   */
  private updateBanner(): void {
    const up = this.enemies.some((e) => e.alive && !e.passed && !e.silenced && e.behavior === 'banner');
    if (up !== this.bannerUp) this.emit({ type: 'banner', up });
    this.bannerUp = up;
    for (const e of this.enemies) {
      if (!e.alive || e.behavior === 'banner') continue;
      if (up && !e.bannered && !e.passed) {
        e.bannered = true;
        e.maxHp += 1;
        e.hp += 1;
      } else if ((!up || e.passed) && e.bannered) {
        e.bannered = false;
        e.maxHp -= 1;
        e.hp = Math.max(1, Math.min(e.maxHp, e.hp - 1));
      }
    }
  }

  /** El geomante terminó de canalizar: la loma queda, ya sin dueño, hasta el final de la partida. */
  settleMound(owner: Enemy): void {
    for (const m of mounds) if (m.owner === owner.id) m.owner = 0;
    this.emit({ type: 'mound', enemy: owner, settled: true });
  }

  /** El geomante levanta una loma adelante suyo (hacia los puestos). Crece mientras canaliza. */
  raiseMound(owner: Enemy): void {
    mounds.push({
      x: owner.position.x, z: owner.position.z - GEOMANCER.ahead,
      height: 0, target: GEOMANCER.height, rx: GEOMANCER.rx, rz: GEOMANCER.rz, owner: owner.id,
    });
    this.emit({ type: 'mound', enemy: owner, settled: false });
  }

  /**
   * Las lomas crecen mientras su geomante canaliza. Si él muere antes de terminar, bajan (más rápido de
   * lo que subieron) hasta desaparecer. Las que ya quedaron (sin dueño) no se tocan más.
   */
  private updateMounds(dt: number): void {
    const rate = GEOMANCER.height / Math.max(0.1, GEOMANCER.channel);
    for (let i = mounds.length - 1; i >= 0; i--) {
      const m = mounds[i];
      if (m.owner) {
        const owner = this.enemies.find((e) => e.id === m.owner);
        if (!owner || !owner.alive || owner.passed) m.target = 0;
      }
      const speed = m.target === 0 ? rate * 3 : rate;
      m.height += THREE.MathUtils.clamp(m.target - m.height, -speed * dt, speed * dt);
      if (m.target === 0 && m.height <= 0.001) mounds.splice(i, 1);
    }
  }

  readonly spells: Spell[] = [];

  /**
   * Los que curan o vuelven inmunes bajan la velocidad para no dejar afuera del aura a los aliados que
   * tienen cerca: caminan al paso del más lento de los que tienen a menos de 3/4 del radio. Solo bajan:
   * al que va más rápido no lo persiguen. Y si se quedan sin nadie a quien cubrir, no esperan: van a la
   * puerta (`forsaken`).
   */
  private updatePace(dt: number): void {
    for (const c of this.enemies) {
      c.paceCap = Infinity;
      if (!c.alive || c.passed || !c.auraKind || c.behavior !== 'shaman') continue;
      if (!c.forsaken) {
        const allies = this.enemies.some((e) => e !== c && e.alive && !e.passed && !e.auraKind);
        c.aloneTime = allies ? 0 : c.aloneTime + dt;
        if (c.aloneTime >= SHAMAN_ALONE) c.forsaken = true;
      }
      const r = c.auraRadius * 0.75;
      for (const e of this.enemies) {
        if (e === c || !e.alive || e.passed || e.auraKind || e.target !== 'gate') continue;
        if (Math.hypot(e.position.x - c.position.x, e.position.z - c.position.z) > r) continue;
        c.paceCap = Math.min(c.paceCap, e.walkSpeed);
      }
    }
  }

  /**
   * Ráfaga (hierro de viento): los que están a `radius` de `pos` salen `distance` metros hacia `dir`
   * (unitario en el piso), sin daño. Devuelve cuántos.
   */
  gust(pos: THREE.Vector3, radius: number, dir: THREE.Vector3, distance: number): number {
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.passed || e.stats.boss) continue;
      if (Math.hypot(e.position.x - pos.x, e.position.z - pos.z) > radius + e.radius) continue;
      e.shove(dir, distance * KNOCK_DECAY);
      n++;
    }
    return n;
  }

  /**
   * Remolino (wedge de viento): los que están a `radius` de `pos` se van hacia el centro, hasta quedar
   * casi pegados, sin daño. Devuelve cuántos.
   */
  whirl(pos: THREE.Vector3, radius: number): number {
    let n = 0;
    const dir = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.passed || e.stats.boss) continue;
      dir.set(pos.x - e.position.x, 0, pos.z - e.position.z);
      const d = dir.length();
      if (d > radius + e.radius) continue;
      n++;
      // hasta un metro del centro: no los apila todos en el mismo punto
      const travel = d - 1;
      if (travel > 0.05) e.shove(dir.normalize(), travel * KNOCK_DECAY);
    }
    return n;
  }

  /**
   * La carga llegó a 2 apuntando desde `from` hacia `dir` (unitario en el piso): los que esquivan y están
   * «más o menos» en la línea del tiro saltan al costado. Para el lado en que ya estaban (así el salto
   * los saca de la línea), o al azar si estaban justo en el medio; y nunca para afuera del campo.
   */
  dodgeAim(from: THREE.Vector3, dir: THREE.Vector3): number {
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    let n = 0;
    for (const e of this.enemies) {
      if (!e.canDodge) continue;
      const rx = e.position.x - from.x;
      const rz = e.position.z - from.z;
      const along = rx * dir.x + rz * dir.z;
      const lateral = rx * side.x + rz * side.z;
      if (along < 1 || Math.abs(lateral) > DODGE.aimWidth + e.radius) continue;
      let sign = Math.abs(lateral) > 0.3 ? Math.sign(lateral) : Math.random() < 0.5 ? -1 : 1;
      const landX = e.position.x + side.x * sign * DODGE.distance;
      if (Math.abs(landX) > FIELD_HALF_WIDTH - 1) sign = -sign;
      e.dodge(side.clone().multiplyScalar(sign));
      this.emit({ type: 'dodged', enemy: e });
      n++;
    }
    return n;
  }

  /**
   * El hechicero le tira un hechizo al golfista: apunta al puesto donde está parado **ahora**, y el piso
   * lo marca en rojo desde que sale. Tarda RANGED.flight en caer: hay tiempo de correrse un puesto.
   */
  castSpell(source: Enemy, player: Player): void {
    const to = new THREE.Vector3(player.anchor.x, 0, player.anchor.z);
    to.y = heightAt(to.x, to.z);
    const from = new THREE.Vector3(source.position.x, source.position.y + source.height * 0.9, source.position.z);
    const mesh = new THREE.Mesh(spellGeo, spellMat);
    mesh.position.copy(from);
    const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(to.x, to.y + 0.06, to.z);
    marker.scale.setScalar(RANGED.radius);
    this.scene.add(mesh, marker);
    this.spells.push({ mesh, marker, from, to, t: 0 });
    this.emit({ type: 'spellCast', enemy: source });
  }

  private updateSpells(dt: number, player: Player): void {
    for (let i = this.spells.length - 1; i >= 0; i--) {
      const sp = this.spells[i];
      sp.t += dt / RANGED.flight;
      const u = Math.min(1, sp.t);
      sp.mesh.position.lerpVectors(sp.from, sp.to, u);
      sp.mesh.position.y += Math.sin(u * Math.PI) * 5;
      // la marca late más rápido cuanto más cerca está de caer
      (sp.marker.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * Math.abs(Math.sin(sp.t * (6 + 14 * u)));
      if (u < 1) continue;
      const hit = player.alive && !player.invulnerable && Math.hypot(player.anchor.x - sp.to.x, player.anchor.z - sp.to.z) <= RANGED.radius;
      if (hit) {
        player.hit(RANGED.damage, sp.to);
        this.emit({ type: 'playerHit', enemy: null, amount: RANGED.damage });
      }
      this.emit({ type: 'spellLanded', pos: sp.to.clone(), hit });
      this.scene.remove(sp.mesh, sp.marker);
      (sp.marker.material as THREE.Material).dispose();
      this.spells.splice(i, 1);
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
    this.updatePace(dt);
    this.updateWards();
    this.updateHeals(dt);
    this.updateBanner();
    this.updateMounds(dt);
    // el fuego va mordiendo: un poco cada tanto mientras dure
    for (const e of this.enemies) {
      if (!e.burning || !e.alive) continue;
      e.burnTimer = Math.max(0, e.burnTimer - dt);
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick += ELEMENTS.burnTick;
        this.damage(e, ELEMENTS.burnDamage, null, 0, true);
      }
    }
    for (const e of this.enemies) e.update(dt, player, this);
    this.updateRocks(dt);
    this.updateSpells(dt, player);

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
