// Las andas del nigromante: una tabla con su tela y un respaldo de huesos, cargada al hombro por cuatro
// esqueletos, y él parado arriba con el bastón. Para el juego es un solo enemigo (el jefe, con la vida de
// él): cualquier pelotazo a cualquier parte le baja la vida. En la versión de los porteadores, los
// esqueletos van aparte (son enemigos, ver fight.ts) y acá no se arman.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Enemy, Horde } from '../../enemies';
import { facet, flatMat } from '../kit';
import { GREEN } from './fx';

/** El modelo propio (tools/boss_nigromante.py): el mago de la cinemática de negro, con calavera. */
export const NECRO_GLB = 'nigromante.glb';
const NECRO_MESH = 'Character_Necromancer';
/** Si el GLB propio no cargó: un esqueleto del pack, teñido de violeta oscuro. */
const FALLBACK_MESH = 'Character_Skeleton_Soldier_02';
const FALLBACK_TINT = 0x6a5a8a;
/** Los porteadores: el esqueleto esclavo del pack (sin armadura). */
export const BEARER_MESH = 'Character_Skeleton_Slave_01';

/** Lo que mide él parado, y los porteadores, en metros. */
const NECRO_HEIGHT = 2.0;
export const BEARER_HEIGHT = 1.75;
/** A qué altura van las varas: sobre el hombro de los porteadores. */
const POLE_Y = 1.45;
const POLE_X = 0.62;
const POLE_LENGTH = 3.7;
const PLATFORM = { w: 1.5, l: 2.0, t: 0.14 };
/** Dónde va cada porteador, en el espacio de las andas (adelante es +z): la vara les apoya en el hombro de afuera. */
export const BEARER_SPOTS: readonly [number, number][] = [[-0.44, 1.45], [0.44, 1.45], [-0.44, -1.45], [0.44, -1.45]];
/** El radio de las andas para las pelotas: toda la tabla y los cuatro porteadores. */
export const LITTER_RADIUS = 1.75;
/** Sin los porteadores adentro (van aparte): solo la tabla. Así no se empujan con ellos. */
export const LITTER_RADIUS_BARE = 1.15;

const WOOD = 0x3b2a20;
const WOOD_LIGHT = 0x5c4331;
const BONE = 0xd9cfb0;
const CLOTH = 0x2c2042;
const CLOTH_TRIM = 0x3fae4a;
const RUG = 0x5a1f2c;

/** Un personaje solo de un GLB con varios (como hace `Horde.register`), con los pies en el piso. */
function single(gltf: GLTF, mesh: string): THREE.Object3D | null {
  const root = cloneSkinned(gltf.scene);
  let found = false;
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (o.name === mesh) found = true;
    else drop.push(o);
  });
  if (!found) return null;
  for (const o of drop) o.parent?.remove(o);
  return root;
}

/** Lo que mide un personaje en su pose de reposo. */
function measure(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) sm.skeleton.update();
  });
  const box = new THREE.Box3().setFromObject(root, true);
  return Math.max(0.05, box.max.y - Math.min(0, box.min.y));
}

const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flatMat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

/** La altura de arriba de la tabla, donde está parado él. */
const PLATFORM_TOP = POLE_Y + 0.065 + PLATFORM.t;

/** Dónde van las llamas verdes: arriba de las calaveras de los postes y de la grande del respaldo. */
function flameSpots(): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(new THREE.Vector3(sx * (PLATFORM.w / 2 - 0.08), PLATFORM_TOP + 0.8, sz * (PLATFORM.l / 2 - 0.1)));
  out.push(new THREE.Vector3(0, PLATFORM_TOP + 1.62, -0.86));
  return out;
}

/** La tabla, las varas, la tela que cuelga, los postes con calaveras y el respaldo de costillas. */
function litterMesh(): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, POLE_LENGTH, 6), flatMat(WOOD_LIGHT));
    pole.rotation.x = Math.PI / 2;
    pole.position.set(s * POLE_X, POLE_Y, 0);
    pole.castShadow = true;
    g.add(pole, box(PLATFORM.w - 0.05, 0.08, 0.1, WOOD, 0, POLE_Y, s * 0.92));
  }
  const py = POLE_Y + 0.065 + PLATFORM.t / 2;
  const top = PLATFORM_TOP;
  g.add(box(PLATFORM.w, PLATFORM.t, PLATFORM.l, WOOD, 0, py, 0));
  g.add(box(PLATFORM.w * 0.8, 0.02, PLATFORM.l * 0.8, RUG, 0, top + 0.01, 0.05));
  // la tela que cuelga alrededor, con su ribete verde abajo
  const drop = 0.42;
  const dy = py - PLATFORM.t / 2 - drop / 2;
  for (const s of [-1, 1]) {
    g.add(box(PLATFORM.w + 0.06, drop, 0.03, CLOTH, 0, dy, s * (PLATFORM.l / 2 + 0.015)));
    g.add(box(0.03, drop, PLATFORM.l + 0.06, CLOTH, s * (PLATFORM.w / 2 + 0.015), dy, 0));
    g.add(box(PLATFORM.w + 0.08, 0.06, 0.04, CLOTH_TRIM, 0, dy - drop / 2, s * (PLATFORM.l / 2 + 0.02)));
    g.add(box(0.04, 0.06, PLATFORM.l + 0.08, CLOTH_TRIM, s * (PLATFORM.w / 2 + 0.02), dy - drop / 2, 0));
  }
  // los cuatro postes con calavera (arriba de cada una va una llama verde, ver `flameSpots`)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (PLATFORM.w / 2 - 0.08);
      const z = sz * (PLATFORM.l / 2 - 0.1);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 5), flatMat(WOOD));
      post.position.set(x, top + 0.27, z);
      const skull = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.12, 0), 0.1, sx + sz * 3 + 5), flatMat(BONE));
      skull.position.set(x, top + 0.6, z);
      skull.scale.set(1, 0.9, 1.1);
      g.add(post, skull);
    }
  }
  // el respaldo: costillas que se abren en abanico atrás de él, y una calavera grande arriba
  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.ConeGeometry(0.055, 1.25, 5), flatMat(BONE));
    rib.position.set(i * 0.17, top + 0.6, -0.78);
    rib.rotation.z = -i * 0.22;
    rib.rotation.x = -0.12;
    rib.castShadow = true;
    g.add(rib);
  }
  const big = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.2, 0), 0.1, 11), flatMat(BONE));
  big.position.set(0, top + 1.3, -0.86);
  g.add(big);
  return g;
}

/** El bastón: vara oscura, calavera y una bola verde que brilla. Va aparte, al lado de la mano (ver `update`). */
function staffMesh(): { group: THREE.Group; orb: THREE.Mesh; orbMat: THREE.MeshBasicMaterial } {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 5), flatMat(WOOD));
  shaft.position.y = 0.95;
  const skull = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.11, 0), 0.1, 3), flatMat(BONE));
  skull.position.y = 1.95;
  const orbMat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), orbMat);
  orb.position.y = 2.16;
  g.add(shaft, skull, orb);
  return { group: g, orb, orbMat };
}

/** La plantilla de las andas (con él arriba) para `Horde.addLook`. Devuelve lo que mide todo. */
export function addLitterLook(horde: Horde, key: string, models: ReadonlyMap<string, GLTF>, dungeon: GLTF): { height: number; clips: THREE.AnimationClip[]; fallback: boolean } {
  const own = models.get(NECRO_GLB);
  let necro = own ? single(own, NECRO_MESH) : null;
  const fallback = !necro;
  if (!necro) necro = single(dungeon, FALLBACK_MESH)!;
  const clips = own && !fallback ? own.animations : dungeon.animations;
  necro.scale.setScalar(NECRO_HEIGHT / measure(necro));
  necro.position.y = PLATFORM_TOP;
  necro.name = 'nigro-cuerpo';
  const root = new THREE.Group();
  // él primero: los clips buscan los huesos por nombre, y el primero que encuentran tiene que ser el suyo
  root.add(necro, litterMesh());
  if (fallback) {
    // el material es el del pack, compartido con todos: se tiñe una copia (el enemigo toma el color de acá)
    necro.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = (m.material as THREE.MeshStandardMaterial).clone();
      (m.material as THREE.MeshStandardMaterial).color.setHex(FALLBACK_TINT);
    });
  }
  const height = horde.addLook(key, root, clips);
  return { height, clips, fallback };
}

/** Las andas ya en el campo: los porteadores (si van acá), el bastón, las llamas, y cómo se mueven. */
export class Litter {
  /** Él, adentro del modelo del enemigo. */
  readonly necro: THREE.Object3D;
  private readonly hand: THREE.Object3D | null;
  private readonly staff = staffMesh();
  private readonly glows: THREE.Mesh[] = [];
  private readonly glowMat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  private readonly glowGeo = new THREE.ConeGeometry(0.11, 0.34, 6);
  private readonly bearers: { root: THREE.Object3D; mixer: THREE.AnimationMixer; walk: THREE.AnimationAction; idle: THREE.AnimationAction; fall: THREE.AnimationAction | null }[] = [];
  private readonly tmp = new THREE.Vector3();
  private age = 0;
  /** Cuánto se ladea la tabla (los porteadores de un lado cayeron) y cuánto bajó (cayó al piso). */
  tilt = 0;
  drop = 0;

  constructor(readonly e: Enemy, dungeon: GLTF, withBearers: boolean) {
    this.necro = e.body.getObjectByName('nigro-cuerpo') ?? e.body;
    this.hand = this.necro.getObjectByName('mixamorigRightHand') ?? null;
    e.group.add(this.staff.group);
    // las llamas verdes arriba de las calaveras
    for (const p of flameSpots()) {
      const flame = new THREE.Mesh(this.glowGeo, this.glowMat);
      flame.position.copy(p);
      flame.renderOrder = 3;
      e.body.add(flame);
      this.glows.push(flame);
    }
    if (withBearers) {
      const proto = single(dungeon, BEARER_MESH);
      if (proto) {
        proto.scale.setScalar(BEARER_HEIGHT / measure(proto));
        const walkClip = dungeon.animations.find((c) => c.name === 'Walking');
        const idleClip = dungeon.animations.find((c) => c.name === 'Idle');
        const fallClip = dungeon.animations.find((c) => c.name === 'Hard Landing');
        for (const [x, z] of BEARER_SPOTS) {
          const root = cloneSkinned(proto);
          root.position.set(x, 0, z);
          root.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            m.frustumCulled = false;
            m.castShadow = true;
          });
          // al final del modelo: los huesos de él se encuentran antes (ver addLitterLook)
          e.body.add(root);
          const mixer = new THREE.AnimationMixer(root);
          const walk = mixer.clipAction(walkClip ?? new THREE.AnimationClip('Walking', 1, []));
          const idle = mixer.clipAction(idleClip ?? new THREE.AnimationClip('Idle', 1, []));
          walk.play();
          idle.play();
          // cada uno con su paso, que no vayan como soldaditos
          walk.time = Math.random() * walk.getClip().duration;
          this.bearers.push({ root, mixer, walk, idle, fall: fallClip ? mixer.clipAction(fallClip) : null });
        }
      }
    }
  }

  /**
   * Cada cuadro: el paso de los porteadores (`speed` en m/s), él mirando a (fx, fz), el bastón en la mano y
   * las llamas. La tabla se ladea y baja según `tilt` y `drop`.
   */
  update(dt: number, speed: number, fx: number, fz: number): void {
    this.age += dt;
    const e = this.e;
    // él gira sobre la tabla para mirar al golfista, aunque las andas vayan de costado
    const want = Math.atan2(fx - e.position.x, fz - e.position.z);
    let d = (want - e.heading - this.necro.rotation.y) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    this.necro.rotation.y += d * (1 - Math.exp(-5 * dt));
    for (const b of this.bearers) {
      const w = Math.min(1, speed / 0.6);
      b.walk.setEffectiveWeight(w);
      b.idle.setEffectiveWeight(1 - w);
      // los clips caminan ~1.5 m/s a velocidad 1 para uno de 1.8 m
      b.walk.timeScale = Math.max(0.3, speed / (1.5 * (BEARER_HEIGHT / 1.8)));
      b.mixer.update(dt);
    }
    // la tabla cae de costado si faltan porteadores, y al piso si se cae entera
    e.body.rotation.z = this.tilt;
    e.body.position.y = -this.drop;
    for (const [i, g] of this.glows.entries()) {
      g.scale.set(1, 0.8 + 0.35 * Math.sin(this.age * 9 + i * 1.7), 1);
    }
    this.glowMat.opacity = e.alive ? 0.7 + 0.2 * Math.sin(this.age * 6) : Math.max(0, this.glowMat.opacity - dt);
    // el bastón, parado al lado de la mano (pegado al hueso giraría con la muñeca)
    if (this.hand && e.alive) {
      this.hand.getWorldPosition(this.tmp);
      e.group.worldToLocal(this.tmp);
      this.staff.group.position.set(this.tmp.x, this.tmp.y - 0.85, this.tmp.z);
    } else if (!this.hand) {
      this.staff.group.position.set(0.5, 1.6 - this.drop, 0.3);
    }
    if (!e.alive) {
      // se cae con él
      this.staff.group.rotation.z = Math.min(1.4, this.staff.group.rotation.z + dt * 2);
      this.staff.orbMat.opacity = Math.max(0, this.staff.orbMat.opacity - dt);
    } else {
      this.staff.orbMat.opacity = 0.75 + 0.25 * Math.sin(this.age * 7);
      this.staff.orb.scale.setScalar(1 + 0.15 * Math.sin(this.age * 7));
    }
  }

  /** La punta del bastón, en el mundo: de ahí sale el rayo. */
  staffTip(out = new THREE.Vector3()): THREE.Vector3 {
    return this.staff.orb.getWorldPosition(out);
  }

  /** Señala con el bastón (marca a uno). */
  point(): void {
    if (this.e.animator.has('Pointing')) this.e.animator.playOneShot('Pointing', 1.6);
    else this.e.animator.playOneShot('Rallying', 2.5);
  }

  /** Levanta los brazos (alza a los muertos). */
  raise(): void {
    this.e.animator.playOneShot('Rallying', 1.8);
  }

  /** Murió: los porteadores se caen con él. */
  collapse(): void {
    for (const b of this.bearers) {
      if (!b.fall) continue;
      b.fall.setLoop(THREE.LoopOnce, 1);
      b.fall.clampWhenFinished = true;
      b.fall.play();
      b.fall.setEffectiveWeight(1);
      b.walk.setEffectiveWeight(0);
      b.idle.setEffectiveWeight(0);
    }
  }

  dispose(): void {
    this.glowMat.dispose();
    this.glowGeo.dispose();
    this.staff.orbMat.dispose();
    this.staff.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      if (m.material !== this.staff.orbMat) (m.material as THREE.Material).dispose();
    });
    for (const b of this.bearers) b.mixer.stopAllAction();
  }
}

/** La plantilla del porteador suelto (la versión de los porteadores: son enemigos). */
export function addBearerLook(horde: Horde, key: string, dungeon: GLTF): boolean {
  if (horde.hasLook(key)) return true;
  const proto = single(dungeon, BEARER_MESH);
  if (!proto) return false;
  horde.addLook(key, proto, dungeon.animations);
  return true;
}
