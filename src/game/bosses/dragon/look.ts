// El modelo del dragón, hecho por código (piedras facetadas y cajas, como la hidra y los de PolygonDungeon):
// un dragón de cuatro patas y dos alas, rojo con la panza amarilla, que vuela. Todo mira a +z. Las piezas que
// se mueven tienen nombre (las alas, el antebrazo de cada ala, el cuello, la cabeza, la mandíbula, la cola,
// las patas y las garras) y las mueve `DragonRig` por código: el aleteo, el cuello que se levanta para tirar
// el fuego para arriba, las patas que cuelgan agarrando y las garras que se abren al soltar.
//
// El cuerpo cuelga de `rig`, que es lo que sube y baja: el enemigo está en el piso (su sombra), y el dragón
// vuela encima a la altura que diga la pelea.
import * as THREE from 'three';
import { facet, flatMat } from '../kit';

export const COLORS = {
  scale: 0xb8392b,
  dark: 0x6b1d18,
  belly: 0xe9b65e,
  membrane: 0x8f2a20,
  bone: 0xeadcb8,
  claw: 0x2b2420,
  eye: 0xffd64a,
  mouth: 0x4a0f0c,
  /** El fuego: la boca que carga, las bolas y las marcas. */
  fire: 0xff6a1a,
  fireCore: 0xffd27a,
};

/** Las cuatro patas, por nombre: adelante y atrás, izquierda y derecha (la izquierda del dragón es +x). */
export const LEGS = ['FL', 'FR', 'HL', 'HR'] as const;
export type LegId = (typeof LEGS)[number];
/**
 * El tamaño: las medidas de abajo son de un dragón de unos 8 m de punta a punta; se lo agranda para que se
 * lea desde la cámara alta.
 */
export const SCALE = 1.25;

const ico = new THREE.IcosahedronGeometry(1, 1);
const lowIco = new THREE.IcosahedronGeometry(1, 0);

function blob(parent: THREE.Object3D, mat: THREE.Material, seed: number, pos: [number, number, number], size: [number, number, number], detail = 1): THREE.Mesh {
  const m = new THREE.Mesh(facet((detail ? ico : lowIco).clone(), 0.1, seed), mat);
  m.position.set(...pos);
  m.scale.set(...size);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function cone(parent: THREE.Object3D, mat: THREE.Material, r: number, h: number, pos: [number, number, number], rotX = 0, rotZ = 0, sides = 5): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, sides), mat);
  m.position.set(...pos);
  m.rotation.set(rotX, 0, rotZ);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function box(parent: THREE.Object3D, mat: THREE.Material, size: [number, number, number], pos: [number, number, number], seed = 1): THREE.Mesh {
  const m = new THREE.Mesh(facet(new THREE.BoxGeometry(...size, 2, 1, 2), 0.06, seed), mat);
  m.position.set(...pos);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Un hueso (un cilindro que se afina) de `a` a `b`. */
function limb(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, sides = 6): THREE.Mesh {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r2, r1, len, sides);
  geo.translate(0, len / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Una tela plana (la membrana del ala): un abanico de triángulos desde el primer punto. */
function membrane(parent: THREE.Object3D, mat: THREE.Material, pts: THREE.Vector3[]): THREE.Mesh {
  const pos: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0].toArray(), ...pts[i].toArray(), ...pts[i + 1].toArray());
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Un ala, del lado `s` (1 la izquierda, +x; -1 la derecha): el brazo, el antebrazo con los dedos y la tela. */
function wing(rig: THREE.Group, s: number, mats: Record<'scale' | 'dark' | 'membrane' | 'bone', THREE.Material>): void {
  const side = s > 0 ? 'L' : 'R';
  const root = new THREE.Group();
  root.name = `wing${side}`;
  root.position.set(0.62 * s, 0.42, 0.72);
  rig.add(root);
  const elbow = v(1.75 * s, 0.25, -0.05);
  limb(root, mats.scale, v(0, 0, 0), elbow, 0.17, 0.12);
  blob(root, mats.scale, 61 + s, [elbow.x, elbow.y, elbow.z], [0.16, 0.16, 0.16], 0);
  // la tela de adentro: del hombro al codo, y de ahí para atrás hasta el costado del lomo
  membrane(root, mats.membrane, [v(0, 0, 0.15), elbow, v(1.75 * s, 0.05, -1.45), v(0.15 * s, -0.05, -1.95)]);
  // el antebrazo gira en el codo (se pliega al bajar el ala)
  const fore = new THREE.Group();
  fore.name = `fore${side}`;
  fore.position.copy(elbow);
  root.add(fore);
  const wrist = v(1.55 * s, 0.08, 0.2);
  limb(fore, mats.scale, v(0, 0, 0), wrist, 0.12, 0.08);
  // el pulgar con su uña, adelante de la muñeca
  cone(fore, mats.bone, 0.07, 0.32, [wrist.x + 0.1 * s, wrist.y, wrist.z + 0.22], Math.PI / 2, 0, 4);
  const tips = [v(3.35 * s, -0.05, -0.35), v(2.65 * s, -0.1, -1.5), v(1.4 * s, -0.1, -1.95)];
  for (const t of tips) limb(fore, mats.dark, wrist, t, 0.065, 0.03, 5);
  // la tela de afuera, con el borde de atrás en festones entre los dedos
  const scallop = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().lerp(b, 0.5).lerp(wrist, 0.28);
  membrane(fore, mats.membrane, [wrist, tips[0], scallop(tips[0], tips[1]), tips[1], scallop(tips[1], tips[2]), tips[2], v(0, -0.2, -1.4), v(0, 0, 0)]);
}

/** Una pata: el muslo, la canilla y la garra con tres uñas adelante y una atrás (cada una gira para cerrar). */
function leg(rig: THREE.Group, id: LegId, mats: Record<'scale' | 'dark' | 'belly' | 'claw', THREE.Material>): void {
  const s = id.endsWith('L') ? 1 : -1;
  const hind = id.startsWith('H');
  const root = new THREE.Group();
  root.name = `leg${id}`;
  root.position.set((hind ? 0.58 : 0.5) * s, -0.32, hind ? -1.15 : 1.15);
  rig.add(root);
  const k = hind ? 1.2 : 1;
  blob(root, mats.scale, hind ? 71 : 73, [0, -0.18, 0], [0.3 * k, 0.42 * k, 0.34 * k]);
  const shin = new THREE.Group();
  shin.name = `shin${id}`;
  shin.position.set(0, -0.55, 0.05);
  root.add(shin);
  limb(shin, mats.dark, v(0, 0, 0), v(0, -0.5, -0.04), 0.13 * k, 0.09 * k);
  const claw = new THREE.Group();
  claw.name = `claw${id}`;
  claw.position.set(0, -0.55, -0.04);
  shin.add(claw);
  box(claw, mats.dark, [0.26 * k, 0.1, 0.3 * k], [0, -0.02, 0.06], hind ? 75 : 77);
  const talons: [number, number, number][] = [[-0.09, 0.22, 0], [0, 0.24, 1], [0.09, 0.22, 2], [0, -0.12, 3]];
  for (const [x, z, i] of talons) {
    const t = new THREE.Group();
    t.name = `talon${id}${i}`;
    t.position.set(x * k, -0.04, z * k);
    // la de atrás mira para atrás
    if (i === 3) t.rotation.y = Math.PI;
    claw.add(t);
    cone(t, mats.claw, 0.04, 0.26, [0, -0.09, 0.05], 0.5, 0, 4);
  }
}

/** El dragón entero. Lo que se mueve tiene nombre (ver `DragonRig`). */
export function dragonLook(): THREE.Group {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  rig.name = 'rig';
  rig.scale.setScalar(SCALE);
  g.add(rig);
  const mats = {
    scale: flatMat(COLORS.scale),
    dark: flatMat(COLORS.dark),
    belly: flatMat(COLORS.belly),
    membrane: flatMat(COLORS.membrane, { side: THREE.DoubleSide }),
    bone: flatMat(COLORS.bone),
    claw: flatMat(COLORS.claw),
  };
  // el cuerpo: el lomo, la panza amarilla, el pecho y la cadera
  blob(rig, mats.scale, 3, [0, 0, 0], [0.95, 0.8, 1.6]);
  blob(rig, mats.belly, 5, [0, -0.32, 0.08], [0.78, 0.55, 1.45]);
  blob(rig, mats.scale, 7, [0, 0.12, 1.25], [0.85, 0.78, 0.85]);
  blob(rig, mats.belly, 8, [0, -0.2, 1.42], [0.62, 0.55, 0.62]);
  blob(rig, mats.scale, 9, [0, -0.02, -1.25], [0.75, 0.66, 0.78]);
  // las placas del lomo, de adelante hacia atrás
  for (let k = 0; k < 6; k++) cone(rig, mats.dark, 0.2 - k * 0.015, 0.62 - k * 0.05, [0, 0.82 - k * 0.04, 1.35 - k * 0.55], -0.6, 0, 4);

  // el cuello, que sale del pecho para adelante y arriba, y la cabeza en la punta
  const neck = new THREE.Group();
  neck.name = 'neck';
  neck.position.set(0, 0.32, 1.85);
  rig.add(neck);
  [[0.35, 0.5], [0.85, 0.44], [1.3, 0.38]].forEach(([z, r], i) => {
    blob(neck, i % 2 ? mats.dark : mats.scale, 21 + i, [0, 0, z], [r, r * 0.9, r * 0.75]);
    blob(neck, mats.belly, 25 + i, [0, -r * 0.45, z + 0.05], [r * 0.7, r * 0.5, r * 0.6], 0);
    cone(neck, mats.dark, 0.11, 0.38, [0, r * 0.85, z], -0.7, 0, 4);
  });
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.02, 1.72);
  neck.add(head);
  blob(head, mats.scale, 31, [0, 0.05, 0.1], [0.5, 0.42, 0.55]);
  box(head, mats.scale, [0.56, 0.3, 0.85], [0, -0.02, 0.68], 32);
  box(head, mats.dark, [0.64, 0.12, 0.32], [0, 0.29, 0.34], 33);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), flatMat(COLORS.eye, { emissive: COLORS.eye, emissiveIntensity: 0.7 }));
    eye.name = 'eye';
    eye.position.set(0.27 * s, 0.17, 0.42);
    head.add(eye);
    // los cuernos, para atrás y un poco abiertos
    cone(head, mats.bone, 0.1, 0.85, [0.22 * s, 0.32, -0.25], -2.05, -0.35 * s);
    cone(head, mats.bone, 0.06, 0.45, [0.36 * s, 0.12, -0.15], -1.9, -0.9 * s);
    // las narinas
    box(head, mats.dark, [0.1, 0.06, 0.1], [0.14 * s, 0.13, 1.05], 34);
    // colmillos de arriba
    cone(head, mats.bone, 0.045, 0.18, [0.18 * s, -0.22, 1.0], Math.PI, 0, 4);
  }
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  jaw.position.set(0, -0.17, 0.22);
  head.add(jaw);
  box(jaw, mats.scale, [0.48, 0.13, 0.85], [0, -0.05, 0.42], 35);
  const mouth = box(jaw, flatMat(COLORS.mouth, { emissive: 0x000000 }), [0.38, 0.05, 0.68], [0, 0.03, 0.42], 36);
  mouth.name = 'mouth';
  for (const s of [-1, 1]) cone(jaw, mats.bone, 0.04, 0.14, [0.17 * s, 0.07, 0.78], 0, 0, 4);
  // de dónde sale el fuego (en la punta de la boca)
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, -0.08, 1.15);
  head.add(muzzle);

  // la cola, en pedazos que se afinan (cada uno cuelga del anterior, así se ondula) y la punta de pala
  let parent: THREE.Object3D = rig;
  const radii = [0.5, 0.42, 0.35, 0.28, 0.22, 0.17];
  radii.forEach((r, i) => {
    const seg = new THREE.Group();
    seg.name = `tail${i}`;
    seg.position.set(0, i ? 0 : -0.05, i ? -0.72 : -1.85);
    parent.add(seg);
    blob(seg, i % 2 ? mats.dark : mats.scale, 41 + i, [0, 0, -0.35], [r, r * 0.85, r * 1.2]);
    if (i < 4) cone(seg, mats.dark, 0.09, 0.3, [0, r * 0.85, -0.3], -0.8, 0, 4);
    parent = seg;
  });
  const spade = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.85, 4), mats.dark);
  spade.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  spade.scale.set(1, 1, 0.3);
  spade.position.set(0, 0, -0.95);
  spade.castShadow = true;
  parent.add(spade);

  wing(rig, 1, mats);
  wing(rig, -1, mats);
  for (const id of LEGS) leg(rig, id, mats);
  return g;
}

/** Lo que se le pide al dragón en cada cuadro. */
export interface DragonPose {
  /** Fase del aleteo (radianes; corre sola) y cuánto aletea (0 planea con las alas abiertas, 1 a full). */
  flap: number;
  flapAmp: number;
  /** Cabeceo del cuerpo (positivo: la nariz arriba) y alabeo (positivo: el ala izquierda arriba). */
  pitch: number;
  bank: number;
  /** El cuello: 0 adelante, 1 para arriba (para tirar el fuego al cielo). */
  neckUp: number;
  /** La mandíbula (0 cerrada, 1 abierta) y el brillo de la boca (0 a 1). */
  jaw: number;
  glow: number;
  /** Las patas: 0 recogidas para atrás, 1 colgando (agarrando o por soltar). */
  legs: number;
  /** Las garras: 0 cerradas, 1 abiertas. */
  claws: number;
  /** Fase de la cola. */
  tail: number;
}

export const restPose = (): DragonPose => ({ flap: 0, flapAmp: 1, pitch: 0, bank: 0, neckUp: 0, jaw: 0, glow: 0, legs: 0, claws: 0, tail: 0 });

/** Las piezas del dragón que se mueven, buscadas por nombre en el modelo (el del enemigo es una copia). */
export class DragonRig {
  readonly rig: THREE.Object3D;
  private readonly wings: { root: THREE.Object3D; fore: THREE.Object3D; s: number }[] = [];
  private readonly neck: THREE.Object3D;
  private readonly head: THREE.Object3D;
  private readonly jaw: THREE.Object3D;
  private readonly tail: THREE.Object3D[] = [];
  private readonly legs: { root: THREE.Object3D; shin: THREE.Object3D; claw: THREE.Object3D; talons: THREE.Object3D[]; hind: boolean }[] = [];
  readonly claws: Record<LegId, THREE.Object3D>;
  readonly muzzle: THREE.Object3D;
  /** El material de la boca (brilla al cargar el fuego). */
  readonly mouthMat: THREE.MeshStandardMaterial;
  /** Todos los materiales que usa. */
  readonly mats: THREE.MeshStandardMaterial[] = [];
  private readonly glowColor = new THREE.Color(COLORS.fire);

  constructor(model: THREE.Object3D) {
    const find = (name: string) => {
      const o = model.getObjectByName(name);
      if (!o) throw new Error(`al dragón le falta ${name}`); // i18n-ok: error de programación
      return o;
    };
    this.rig = find('rig');
    for (const [side, s] of [['L', 1], ['R', -1]] as const) this.wings.push({ root: find(`wing${side}`), fore: find(`fore${side}`), s });
    this.neck = find('neck');
    this.head = find('head');
    this.jaw = find('jaw');
    for (let i = 0; i < 6; i++) this.tail.push(find(`tail${i}`));
    const claws = {} as Record<LegId, THREE.Object3D>;
    for (const id of LEGS) {
      const claw = find(`claw${id}`);
      claws[id] = claw;
      this.legs.push({ root: find(`leg${id}`), shin: find(`shin${id}`), claw, talons: [0, 1, 2, 3].map((i) => find(`talon${id}${i}`)), hind: id.startsWith('H') });
    }
    this.claws = claws;
    this.muzzle = find('muzzle');
    // los materiales que usa (los del enemigo: no se cambian, así el destello del golpe sigue andando)
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !this.mats.includes(m.material as THREE.MeshStandardMaterial)) this.mats.push(m.material as THREE.MeshStandardMaterial);
    });
    this.mouthMat = (find('mouth') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  }

  /** Acomoda las piezas. `y` es la altura del centro del cuerpo sobre los pies del enemigo. */
  apply(p: DragonPose, y: number): void {
    const up = Math.sin(p.flap);
    const amp = p.flapAmp;
    // el cuerpo sube con el golpe de ala para abajo (y baja un poco al levantarlas)
    this.rig.position.y = y - 0.18 * amp * Math.cos(p.flap);
    this.rig.rotation.set(-p.pitch, 0, p.bank);
    for (const w of this.wings) {
      // de -0.55 (abajo) a 0.75 (arriba); planeando, apenas arriba
      const lift = amp * (0.1 + 0.65 * up) + (1 - amp) * 0.12;
      w.root.rotation.set(0, 0.12 * amp * Math.cos(p.flap) * w.s, lift * w.s);
      // la punta llega tarde: se pliega al subir y se abre al bajar
      w.fore.rotation.set(0, 0, amp * 0.4 * Math.sin(p.flap - 0.9) * w.s);
    }
    this.neck.rotation.x = -0.32 - 0.95 * p.neckUp + 0.04 * amp * Math.cos(p.flap);
    this.head.rotation.x = 0.32 - 0.5 * p.neckUp;
    this.jaw.rotation.x = 0.65 * p.jaw;
    this.tail.forEach((t, i) => {
      t.rotation.y = 0.14 * Math.sin(p.tail - i * 0.7);
      t.rotation.x = (i === 0 ? 0.12 : 0.05) + 0.05 * Math.sin(p.tail * 0.7 - i * 0.5);
    });
    for (const l of this.legs) {
      // recogidas para atrás (volando) o colgando un poco para adelante (agarrando)
      l.root.rotation.x = THREE.MathUtils.lerp(l.hind ? 1.15 : 0.95, l.hind ? 0.15 : -0.05, p.legs);
      l.shin.rotation.x = THREE.MathUtils.lerp(0.45, 0.12, p.legs);
      l.claw.rotation.x = THREE.MathUtils.lerp(0.5, -0.1, p.legs);
      l.talons.forEach((t, i) => {
        const curl = THREE.MathUtils.lerp(1.0, -0.35, p.claws);
        t.rotation.x = i === 3 ? curl * 0.8 : curl;
      });
    }
    this.mouthMat.emissive.copy(this.glowColor).multiplyScalar(p.glow * 2.2);
  }
}
