// Lo que se ve del futbolista (ver docs/jefes/futbolista.md): el modelo (el goblin de PolygonDungeon vestido
// de celeste y blanco, tools/boss_futbolista.py), la pelota (facetada por código), y las poses que se arman
// con huesos por código encima de la animación: la patada (no hay clip de patada en assets/mixamo) y el
// «superman» de los que salen volando (cuerpo horizontal, brazos estirados hacia adelante).
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Horde } from '../../enemies';
import { flatMat } from '../kit';

/** El modelo propio (tools/boss_futbolista.py): el goblin con la camiseta, y el clip «Getting Up». */
export const FUT_GLB = 'futbolista.glb';
const FUT_MESH = 'Character_Futbolista';
/** Sin el GLB: el goblin de dungeon.glb, teñido de celeste (se ve raro, pero se juega igual). */
const FALLBACK_MESH = 'Character_Goblin_Male';
const FALLBACK_TINT = 0x8fc3ea;

/** El clip con el que se levantan del piso los que patea (viene en futbolista.glb). */
export const GET_UP = 'Getting Up';

/**
 * Registra la plantilla del futbolista en la horda (`key`) con los clips de dungeon.glb (correr, quieto: los
 * huesos se llaman igual) más los del GLB propio. Devuelve el clip para levantarse, si está.
 */
export function addFutbolistaLook(horde: Horde, key: string, models: ReadonlyMap<string, GLTF>, dungeon: GLTF): THREE.AnimationClip | null {
  const own = models.get(FUT_GLB);
  const getUp = own?.animations.find((c) => c.name === GET_UP) ?? null;
  const clips = [...dungeon.animations, ...(own?.animations ?? []).filter((c) => !dungeon.animations.some((d) => d.name === c.name))];
  if (own && own.scene.getObjectByName(FUT_MESH)) {
    horde.addLook(key, own.scene, clips, FUT_MESH);
  } else {
    horde.addLook(key, dungeon.scene, clips, FALLBACK_MESH);
    // el material es el del pack, compartido: el enemigo clona el material al nacer, pero la plantilla se
    // comparte, así que se tiñe el clon de la horda recién al crear al jefe (ver `tintFallback`)
  }
  return getUp;
}

/** Sin el GLB propio, el goblin teñido: que no se confunda con los de la horda. */
export function tintFallback(body: THREE.Object3D, models: ReadonlyMap<string, GLTF>): void {
  if (models.get(FUT_GLB)) return;
  body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) (m.material as THREE.MeshStandardMaterial).color.setHex(FALLBACK_TINT);
  });
}

// ---- la pelota ----

/**
 * Una pelota de fútbol low poly: un icosaedro partido en tercios, con las caras que tocan los doce vértices
 * del original en negro (los pentágonos) y el resto blanco. Apoyada en el piso (y de 0 a 2r).
 */
export function ballMesh(r: number): THREE.Mesh {
  const base = new THREE.IcosahedronGeometry(1, 0);
  const corners: THREE.Vector3[] = [];
  const bp = base.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(bp, i).normalize();
    if (!corners.some((c) => c.distanceTo(v) < 1e-3)) corners.push(v);
  }
  base.dispose();
  const geo = new THREE.IcosahedronGeometry(r, 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const black: number[] = [];
  const white: number[] = [];
  const v = new THREE.Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    let dark = false;
    for (let k = 0; k < 3 && !dark; k++) {
      v.fromBufferAttribute(pos, f + k).normalize();
      dark = corners.some((c) => c.distanceTo(v) < 1e-3);
    }
    const out = dark ? black : white;
    for (let k = 0; k < 3; k++) out.push(pos.getX(f + k), pos.getY(f + k), pos.getZ(f + k));
  }
  geo.dispose();
  // un solo material con el color por vértice: los enemigos clonan su material (uno solo, no una lista)
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute([...black, ...white], 3));
  const dark = new THREE.Color(0x26262b);
  const light = new THREE.Color(0xf4f1ea);
  const colors: number[] = [];
  for (let i = 0; i < black.length / 3; i++) colors.push(dark.r, dark.g, dark.b);
  for (let i = 0; i < white.length / 3; i++) colors.push(light.r, light.g, light.b);
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.computeVertexNormals();
  const mesh = new THREE.Mesh(out, flatMat(0xffffff, { vertexColors: true }));
  mesh.castShadow = true;
  return mesh;
}

/** La pelota como plantilla de enemigo (el pelotazo): apoyada en el piso, con la malla en `userData.ball`. */
export function ballLook(r: number): THREE.Object3D {
  const g = new THREE.Group();
  const m = ballMesh(r);
  m.position.y = r;
  m.name = 'pelota';
  g.add(m);
  return g;
}

// ---- poses por código (encima de la animación: se llaman después de que la horda movió los clips) ----

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const qc = new THREE.Quaternion();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vd = new THREE.Vector3();
const ident = new THREE.Quaternion();

/** Gira `bone` (en mundo) para que el tramo hasta `child` apunte en `dir` (mundo, unitario), en la medida `w`. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3, w: number): void {
  bone.getWorldPosition(va);
  child.getWorldPosition(vb);
  vb.sub(va);
  if (vb.lengthSq() < 1e-8) return;
  vb.normalize();
  const turn = qc.setFromUnitVectors(vb, dir);
  if (w < 1) turn.slerpQuaternions(ident, turn.clone(), w);
  bone.getWorldQuaternion(qa);
  bone.parent!.getWorldQuaternion(qb);
  bone.quaternion.copy(qb.invert()).multiply(turn.multiply(qa));
  bone.updateMatrixWorld(true);
}

/** Los huesos de una cadena (brazo o pierna), buscados una vez por modelo. */
interface Limbs {
  lArm: THREE.Object3D; lFore: THREE.Object3D; lHand: THREE.Object3D;
  rArm: THREE.Object3D; rFore: THREE.Object3D; rHand: THREE.Object3D;
  lUp: THREE.Object3D; lLeg: THREE.Object3D; lFoot: THREE.Object3D;
  rUp: THREE.Object3D; rLeg: THREE.Object3D; rFoot: THREE.Object3D;
  spine: THREE.Object3D | null; neck: THREE.Object3D | null;
}
const limbsOf = new WeakMap<THREE.Object3D, Limbs | null>();

/** Los huesos de brazos y piernas de un modelo de Mixamo (null si no es un humanoide: el huargo, la araña). */
export function limbs(model: THREE.Object3D): Limbs | null {
  if (limbsOf.has(model)) return limbsOf.get(model)!;
  const g = (n: string) => model.getObjectByName(`mixamorig${n}`) ?? null;
  const names = ['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
  const bones = names.map(g);
  const out = bones.every(Boolean)
    ? {
      lArm: bones[0]!, lFore: bones[1]!, lHand: bones[2]!, rArm: bones[3]!, rFore: bones[4]!, rHand: bones[5]!,
      lUp: bones[6]!, lLeg: bones[7]!, lFoot: bones[8]!, rUp: bones[9]!, rLeg: bones[10]!, rFoot: bones[11]!,
      spine: g('Spine1'), neck: g('Neck'),
    }
    : null;
  limbsOf.set(model, out);
  return out;
}

/** Una dirección del cuerpo (x a su izquierda, y arriba, z adelante) pasada a mundo. */
function bodyDir(model: THREE.Object3D, x: number, y: number, z: number, out = vd): THREE.Vector3 {
  model.getWorldQuaternion(qa);
  return out.set(x, y, z).normalize().applyQuaternion(qa);
}

type V3 = [number, number, number];
const mix = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const smooth = (u: number) => u * u * (3 - 2 * u);

/** Las poses clave de la patada (direcciones del cuerpo de cada tramo: muslo, canilla, brazos). */
const KICK_KEYS: Record<'rest' | 'back' | 'hit' | 'follow', { thigh: V3; shin: V3; lArm: V3; rArm: V3; lean: number }> = {
  rest: { thigh: [0, -1, 0.05], shin: [0, -1, -0.05], lArm: [0.35, -1, 0], rArm: [-0.35, -1, 0], lean: 0 },
  // la pierna atrás y doblada, los brazos abiertos: se carga
  back: { thigh: [0, -0.8, -0.6], shin: [0, 0.2, -1], lArm: [0.8, -0.25, 0.55], rArm: [-0.85, -0.2, -0.45], lean: -0.12 },
  // el empeine contra el enemigo
  hit: { thigh: [0, -0.55, 0.85], shin: [0, -0.4, 0.92], lArm: [0.85, -0.15, -0.4], rArm: [-0.75, -0.25, 0.6], lean: 0.05 },
  // la pierna sigue arriba
  follow: { thigh: [0, 0.05, 1], shin: [0, 0.3, 1], lArm: [0.75, 0.0, -0.6], rArm: [-0.7, -0.35, 0.6], lean: 0.22 },
};

/**
 * La patada, por código: `u` va de 0 (parado) a 1 (la pierna atrás, cargada), de 1 a 2 el golpe (1.4 es el
 * impacto) y de 2 a 3 vuelve. `w` es cuánto pesa encima de la animación (para entrar y salir suave).
 */
export function kickPose(model: THREE.Object3D, u: number, w: number): void {
  const L = limbs(model);
  if (!L || w <= 0.001) return;
  model.updateMatrixWorld(true);
  let k;
  if (u <= 1) k = blend(KICK_KEYS.rest, KICK_KEYS.back, smooth(u));
  else if (u <= 1.4) k = blend(KICK_KEYS.back, KICK_KEYS.hit, smooth((u - 1) / 0.4));
  else if (u <= 2) k = blend(KICK_KEYS.hit, KICK_KEYS.follow, smooth((u - 1.4) / 0.6));
  else k = blend(KICK_KEYS.follow, KICK_KEYS.rest, smooth(Math.min(1, u - 2)));
  if (L.spine) {
    model.getWorldQuaternion(qa);
    const axis = va.set(1, 0, 0).applyQuaternion(qa);
    L.spine.getWorldQuaternion(qb);
    const turn = qc.setFromAxisAngle(axis, -k.lean * w);
    L.spine.parent!.getWorldQuaternion(qa);
    L.spine.quaternion.copy(qa.invert()).multiply(turn.multiply(qb));
    L.spine.updateMatrixWorld(true);
  }
  aim(L.rUp, L.rLeg, bodyDir(model, ...k.thigh), w);
  aim(L.rLeg, L.rFoot, bodyDir(model, ...k.shin), w);
  aim(L.lArm, L.lFore, bodyDir(model, ...k.lArm), w * 0.8);
  aim(L.lFore, L.lHand, bodyDir(model, ...k.lArm), w * 0.6);
  aim(L.rArm, L.rFore, bodyDir(model, ...k.rArm), w * 0.8);
  aim(L.rFore, L.rHand, bodyDir(model, ...k.rArm), w * 0.6);
}

function blend(a: typeof KICK_KEYS.rest, b: typeof KICK_KEYS.rest, u: number): typeof KICK_KEYS.rest {
  return { thigh: mix(a.thigh, b.thigh, u), shin: mix(a.shin, b.shin, u), lArm: mix(a.lArm, b.lArm, u), rArm: mix(a.rArm, b.rArm, u), lean: a.lean + (b.lean - a.lean) * u };
}

/**
 * El que sale volando, estilo superman: los brazos estirados por encima de la cabeza (con el cuerpo
 * acostado, quedan hacia adelante) y las piernas derechas y juntas. `w` para entrar suave.
 */
export function supermanPose(model: THREE.Object3D, w: number, t: number): void {
  const L = limbs(model);
  if (!L || w <= 0.001) return;
  model.updateMatrixWorld(true);
  // un aleteo chiquito de las piernas, que se note que vuela
  const kick = 0.12 * Math.sin(t * 16);
  aim(L.lArm, L.lFore, bodyDir(model, 0.22, 1, 0.12), w);
  aim(L.lFore, L.lHand, bodyDir(model, 0.12, 1, 0.1), w);
  aim(L.rArm, L.rFore, bodyDir(model, -0.22, 1, 0.12), w);
  aim(L.rFore, L.rHand, bodyDir(model, -0.12, 1, 0.1), w);
  aim(L.lUp, L.lLeg, bodyDir(model, 0.06, -1, kick), w);
  aim(L.lLeg, L.lFoot, bodyDir(model, 0.04, -1, kick - 0.1), w);
  aim(L.rUp, L.rLeg, bodyDir(model, -0.06, -1, -kick), w);
  aim(L.rLeg, L.rFoot, bodyDir(model, -0.04, -1, -kick - 0.1), w);
  if (L.neck) {
    // la cabeza levantada, mirando adonde va
    model.getWorldQuaternion(qa);
    const axis = va.set(1, 0, 0).applyQuaternion(qa);
    L.neck.getWorldQuaternion(qb);
    const turn = qc.setFromAxisAngle(axis, -0.7 * w);
    L.neck.parent!.getWorldQuaternion(qa);
    L.neck.quaternion.copy(qa.invert()).multiply(turn.multiply(qb));
  }
}
