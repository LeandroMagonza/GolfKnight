// El palo y el swing. Con clips de Mixamo el cuerpo lo anima el clip; este archivo además trae el
// swing procedural de respaldo (para modelos sin clips de golf): después de que el AnimationMixer pone
// la pose del cuadro, inclina y gira la columna, lleva las dos manos al grip con IK de dos huesos y
// orienta el palo según el ángulo del swing. El palo es un objeto de la escena (no cuelga de un
// hueso), así siempre apunta donde dice la matemática del swing aunque la mano quede torcida.
//
// Todo se calcula en el espacio del personaje: +Z es su frente, +X su izquierda, +Y arriba. En la
// postura de golf el objetivo queda a su izquierda (+X) y la pelota adelante.
import * as THREE from 'three';
import type { Club } from '../core/clubs';

/** Dirección del palo en el address: de las manos a la pelota, hacia abajo y adelante. */
const D0 = new THREE.Vector3(0, -0.8, 0.6).normalize();
const TARGET_AXIS = new THREE.Vector3(1, 0, 0);
/** Centro del arco de las manos (pecho) y radio. */
const PIVOT = new THREE.Vector3(0, 1.3, 0.12);
const HANDS_RADIUS = 0.38;
/** Las manos recorren menos ángulo que la cabeza del palo. */
const HANDS_RATIO = 0.6;
export const CLUB_LENGTH = 1.18;
/** Dónde queda la pelota respecto del personaje en el address. */
export const TEE_OFFSET = PIVOT.clone().addScaledVector(D0, HANDS_RADIUS + CLUB_LENGTH).setY(0);
const CARRY_DIR = new THREE.Vector3(-0.1, -0.55, 0.8).normalize();
const SPINE_BEND = THREE.MathUtils.degToRad(24);
const SPINE_TWIST = 0.22;
const POLE_RIGHT = new THREE.Vector3(-0.5, -0.8, -0.3);
const POLE_LEFT = new THREE.Vector3(0.5, -0.8, -0.3);

/** Dirección en el plano del swing para un ángulo phi (0 = address, negativo = backswing). */
function swingDir(phi: number, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(D0).multiplyScalar(Math.cos(phi)).addScaledVector(TARGET_AXIS, Math.sin(phi));
}

interface Arm {
  upper: THREE.Object3D;
  fore: THREE.Object3D;
  hand: THREE.Object3D;
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const qc = new THREE.Quaternion();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const vd = new THREE.Vector3();
const ve = new THREE.Vector3();

/** Aplica una rotación dada en espacio mundo a un hueso, alrededor de su propio origen. */
export function rotateWorld(bone: THREE.Object3D, qWorld: THREE.Quaternion): void {
  bone.getWorldQuaternion(qa);
  bone.parent!.getWorldQuaternion(qb);
  bone.quaternion.copy(qb.invert()).multiply(qc.copy(qWorld).multiply(qa));
}

/** Gira `bone` para que el segmento hacia `child` apunte en `dir` (mundo, unitario). */
function aimBone(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3): void {
  bone.getWorldPosition(va);
  child.getWorldPosition(vb);
  vb.sub(va).normalize();
  rotateWorld(bone, new THREE.Quaternion().setFromUnitVectors(vb, dir));
}

/** IK analítico de dos huesos: lleva la mano a `target` (mundo), con el codo hacia `pole`. */
function solveArm(arm: Arm, target: THREE.Vector3, pole: THREE.Vector3): void {
  const s = arm.upper.getWorldPosition(new THREE.Vector3());
  const l1 = arm.fore.getWorldPosition(vc).distanceTo(s);
  const l2 = arm.hand.getWorldPosition(vd).distanceTo(vc);
  const toTarget = ve.subVectors(target, s);
  const d = THREE.MathUtils.clamp(toTarget.length(), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.005);
  const dir = toTarget.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const perp = new THREE.Vector3().copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  const elbow = new THREE.Vector3().copy(s).addScaledVector(dir, a).addScaledVector(perp, h);
  aimBone(arm.upper, arm.fore, new THREE.Vector3().subVectors(elbow, s).normalize());
  const reach = new THREE.Vector3().copy(s).addScaledVector(dir, d);
  aimBone(arm.fore, arm.hand, reach.sub(elbow).normalize());
}


/** Cómo va el palo respecto del hueso de la mano (sale del análisis del clip de swing). */
export interface HandGrip {
  clubDirInHand: THREE.Vector3;
  toeDirInHand: THREE.Vector3;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Orientación del palo (modelado con el mango en el origen, a lo largo de +Z, punta de la cabeza hacia +Y). */
function clubQuaternion(dir: THREE.Vector3, toe: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  const z = dir.clone().normalize();
  const x = new THREE.Vector3().crossVectors(toe, z);
  if (x.lengthSq() < 1e-6) return out.setFromUnitVectors(Z_AXIS, z);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * El palo y la postura de golf. Con clips de Mixamo (`grip`), el cuerpo lo anima el clip y el palo
 * sigue a la mano derecha con la orientación calibrada en el impacto. Sin clips, arma la postura
 * con IK a partir del ángulo `phi`.
 */
export class SwingRig {
  readonly club = new THREE.Group();
  /** Cuánto de la postura de golf se aplica (0 = animación normal, 1 = postura completa). */
  weight = 0;
  /** Ángulo del palo en el plano del swing, en radianes (solo en el modo procedural). */
  phi = 0;
  /** Si está puesto, el palo sigue a la mano en vez de a la matemática del swing procedural. */
  grip: HandGrip | null = null;
  private readonly spine: THREE.Object3D[] = [];
  private readonly right: Arm | null;
  private readonly left: Arm | null;
  private readonly glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  private readonly head: THREE.Object3D;
  /** Cómo va el palo en la mano fuera del swing, en el espacio de la mano. Se calibra en el primer cuadro. */
  private carry: { dir: THREE.Vector3; toe: THREE.Vector3 } | null = null;

  /** @param model modelo del palo normalizado (tools/club_to_glb.py); sin modelo se arma uno con primitivas */
  constructor(private readonly root: THREE.Object3D, scene: THREE.Scene, model: THREE.Object3D | null = null) {
    const bone = (name: string) => root.getObjectByName('mixamorig' + name) ?? null;
    for (const n of ['Spine', 'Spine1', 'Spine2']) {
      const b = bone(n);
      if (b) this.spine.push(b);
    }
    const arm = (side: string): Arm | null => {
      const upper = bone(side + 'Arm');
      const fore = bone(side + 'ForeArm');
      const hand = bone(side + 'Hand');
      return upper && fore && hand ? { upper, fore, hand } : null;
    };
    this.right = arm('Right');
    this.left = arm('Left');

    if (model) {
      model.scale.setScalar(CLUB_LENGTH);
      this.club.add(model);
    } else {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.011, CLUB_LENGTH, 8),
        new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.8, roughness: 0.35 }),
      );
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = CLUB_LENGTH / 2;
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.09), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.7, roughness: 0.3 }));
      block.position.set(0, 0.05, CLUB_LENGTH - 0.04);
      this.club.add(shaft, block);
    }
    // el encantamiento: un brillo del color del palo en la cabeza
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), this.glowMat);
    this.head.position.set(0, 0.04, CLUB_LENGTH - 0.05);
    this.club.add(this.head);
    scene.add(this.club);
  }

  setClub(club: Club): void {
    this.glowMat.color.setHex(club.color);
  }

  /** Posición en mundo de la cabeza del palo. */
  headWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.head.getWorldPosition(out);
  }

  /** Llamar después de animator.update(), con la rotación del personaje ya aplicada. */
  apply(): void {
    this.root.updateMatrixWorld(true);
    const w = this.weight;
    const rootQ = this.root.quaternion;
    const hand = this.right?.hand ?? this.root;
    const swingDirWorld = new THREE.Vector3();
    const swingToe = new THREE.Vector3();

    if (w > 0.001 && this.grip) {
      const handQ = hand.getWorldQuaternion(new THREE.Quaternion());
      swingDirWorld.copy(this.grip.clubDirInHand).applyQuaternion(handQ);
      swingToe.copy(this.grip.toeDirInHand).applyQuaternion(handQ);
    } else if (w > 0.001 && this.right) {
      // columna: inclinación hacia adelante y giro acompañando el swing
      const bend = new THREE.Quaternion().setFromAxisAngle(va.set(1, 0, 0).applyQuaternion(rootQ).clone(), SPINE_BEND * w);
      const twistAngle = THREE.MathUtils.clamp(this.phi * SPINE_TWIST, -0.9, 0.9) * w;
      const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), twistAngle / Math.max(1, this.spine.length));
      if (this.spine[0]) rotateWorld(this.spine[0], bend);
      for (const s of this.spine) rotateWorld(s, twist);

      // manos al grip
      const handsDir = swingDir(this.phi * HANDS_RATIO, new THREE.Vector3());
      const grip = new THREE.Vector3().copy(PIVOT).addScaledVector(handsDir, HANDS_RADIUS);
      this.root.localToWorld(grip);
      swingDir(this.phi, swingDirWorld).applyQuaternion(rootQ);
      // la punta de la cabeza queda fija en la normal del plano del swing
      swingToe.crossVectors(D0, TARGET_AXIS).applyQuaternion(rootQ);
      const animated = this.right.hand.getWorldPosition(new THREE.Vector3());
      const target = animated.lerp(grip, w);
      solveArm(this.right, target, POLE_RIGHT.clone().applyQuaternion(rootQ));
      if (this.left) {
        const leftAnimated = this.left.hand.getWorldPosition(new THREE.Vector3());
        const leftTarget = leftAnimated.lerp(new THREE.Vector3().copy(target).addScaledVector(swingDirWorld, -0.09), w);
        solveArm(this.left, leftTarget, POLE_LEFT.clone().applyQuaternion(rootQ));
      }
    }

    // Fuera del swing el palo va en la mano derecha, apuntando adelante y abajo. Esa orientación se
    // calibra una sola vez contra la mano y después la sigue: el palo rota con el personaje y con su
    // animación (correr, girar), en lugar de ser una aguja rígida apuntando hacia donde se apunta.
    hand.getWorldPosition(this.club.position);
    const carryHandQ = hand.getWorldQuaternion(new THREE.Quaternion());
    if (!this.carry && w <= 0.001 && this.right) {
      const inv = carryHandQ.clone().invert();
      this.carry = {
        dir: new THREE.Vector3().copy(CARRY_DIR).applyQuaternion(rootQ).applyQuaternion(inv),
        toe: new THREE.Vector3(0, 1, 0).applyQuaternion(inv),
      };
    }
    const carryDir = this.carry ? this.carry.dir.clone().applyQuaternion(carryHandQ) : new THREE.Vector3().copy(CARRY_DIR).applyQuaternion(rootQ);
    const carryToe = this.carry ? this.carry.toe.clone().applyQuaternion(carryHandQ) : new THREE.Vector3(0, 1, 0);
    const carryQ = clubQuaternion(carryDir, carryToe, new THREE.Quaternion());
    if (w > 0.001) {
      const swingQ = clubQuaternion(swingDirWorld, swingToe, new THREE.Quaternion());
      this.club.quaternion.copy(carryQ).slerp(swingQ, w);
    } else {
      this.club.quaternion.copy(carryQ);
    }
    // el mango sobresale un poco por detrás de la mano
    this.club.position.addScaledVector(Z_AXIS.clone().applyQuaternion(this.club.quaternion), -0.08);
  }
}
