// Lo que crece en el campo (8/10, pedidos de Leandro): el pasto (el color, la textura de hojitas y las
// matas altas con viento), las flores, los árboles, los arbustos y las piedras. game/world arma el campo y
// le pide esto; el ancho del fairway a cada altura sale de core/field (rectángulo o trapecio).
//
// Todo es de formas simples con las caras planas, como los personajes de Synty, y cada pieza va en una
// sola malla repetida (InstancedMesh): un bosque entero son una docena de dibujos por cuadro. El azar
// tiene semilla fija, así el que mira ve los mismos árboles que el que juega.

import * as THREE from 'three';
import { fieldHalfAt } from '../core/field';
import { heightAt } from '../core/terrain';

/**
 * El pasto (8/10, pedido de Leandro: «hoy el pasto es verde sólido»). El color de cada vértice da lo
 * grande: el fairway con sus franjas de corte, un primer corte más oscuro en el borde, el rough, y
 * manchones más secos o más verdes. La textura (`grassDetail`) da lo chico: hojitas que se ven de
 * cerca. Fuera del fairway, matas de pasto alto que se mueven con el viento (`buildTufts`).
 */
const FAIRWAY_LIGHT = new THREE.Color(0x56ae59);
const FAIRWAY_DARK = new THREE.Color(0x3e8b46);
const FIRST_CUT = new THREE.Color(0x367c3d);
export const ROUGH = new THREE.Color(0x2e6a35);
/** Los manchones: pasto más seco (amarillento) y más tupido (más azul). */
const DRY = new THREE.Color(0x7d9a3c);
const LUSH = new THREE.Color(0x24683a);
const HIGH = new THREE.Color(0xa9d66b);
const LOW = new THREE.Color(0x1f4f3a);
/** La textura oscurece en promedio esto: los colores se levantan lo mismo para que el campo no se apague. */
export const DETAIL_MEAN = 0.86;
/** Cada cuántos metros se repite la textura de las hojitas. */
export const DETAIL_TILE = 3;
const tint = new THREE.Color();
const shade = new THREE.Color();

/** Un generador con semilla: el mismo campo en cada compu. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Ruido de valor, suave, de 0 a 1: los manchones del pasto. Siempre el mismo para cada lugar. */
function noise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const h = (a: number, b: number) => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const top = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * sx;
  const bottom = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * sx;
  return top + (bottom - top) * sz;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * El color del pasto en (x, z), sin el relieve: fairway con franjas de corte cada 5 m (con el borde
 * suave, no de golpe), un primer corte de un par de metros, el rough, y los manchones encima.
 */
export function grassColor(x: number, z: number, out: THREE.Color): THREE.Color {
  const ax = Math.abs(x);
  const stripe = smooth(-0.18, 0.18, Math.sin((z / 5) * Math.PI));
  out.copy(FAIRWAY_DARK).lerp(FAIRWAY_LIGHT, stripe);
  // el fairway termina a los costados y en las puntas: primero el corte, después el rough
  const off = Math.max(ax - fieldHalfAt(z), -4 - z, z - 116);
  out.lerp(FIRST_CUT, smooth(1, 2, off));
  out.lerp(ROUGH, smooth(3.5, 5, off));
  const rough = smooth(1, 5, off);
  // manchones grandes (más secos) y medianos (más tupidos); en el rough se notan más
  const big = noise(x / 11 + 3.1, z / 11 - 7.7);
  const mid = noise(x / 4.3 + 17, z / 4.3 + 5);
  out.lerp(DRY, Math.max(0, big - 0.5) * (0.4 + 0.6 * rough));
  out.lerp(LUSH, Math.max(0, mid - 0.55) * (0.35 + 0.45 * rough));
  return out.multiplyScalar((0.93 + 0.14 * noise(x / 2.1 - 9, z / 2.1 + 2)) / DETAIL_MEAN);
}

/** El color del piso con el relieve: más claro en las lomas (`h` > 0) y más oscuro en los valles. */
export function groundColor(x: number, z: number, h: number, out: THREE.Color): THREE.Color {
  grassColor(x, z, out);
  if (h > 0) out.lerp(tint.copy(HIGH).multiplyScalar(1 / DETAIL_MEAN), Math.min(1, h / 2.4) * 0.7);
  else out.lerp(tint.copy(LOW).multiplyScalar(1 / DETAIL_MEAN), Math.min(1, -h / 1) * 0.7);
  return out;
}

/**
 * Las hojitas del pasto, de cerca: una textura gris clara que multiplica al color (por eso es lineal y no
 * sRGB). Se repite sin costura: cada trazo que se sale de un borde vuelve a entrar por el otro.
 */
export function grassDetail(): THREE.CanvasTexture {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grey = (v: number, a = 1) => `rgba(${v}, ${v}, ${v}, ${a})`;
  g.fillStyle = grey(Math.round(255 * 0.9));
  g.fillRect(0, 0, N, N);
  const rand = seeded(11);
  // manchitas suaves, más claras y más oscuras
  for (let i = 0; i < 40; i++) {
    const x = rand() * N;
    const y = rand() * N;
    const r = 10 + rand() * 30;
    const v = Math.round(255 * (0.78 + rand() * 0.22));
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      grad.addColorStop(0, grey(v, 0.35));
      grad.addColorStop(1, grey(v, 0));
      g.fillStyle = grad;
      g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  // las hojitas: trazos cortos, casi todos parados, unos más claros y otros más oscuros
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = rand() * N;
    const y = rand() * N;
    const len = 3 + rand() * 6;
    const a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
    const v = Math.round(255 * (0.6 + rand() * 0.4));
    g.strokeStyle = grey(v, 0.55 + rand() * 0.4);
    g.lineWidth = 0.8 + rand() * 0.9;
    const ex = Math.cos(a) * len;
    const ey = Math.sin(a) * len;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      if (x + dx < -10 || x + dx > N + 10 || y + dy < -10 || y + dy > N + 10) continue;
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.lineTo(x + dx + ex, y + dy + ey);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  // mirada rasante: sin esto, a lo lejos el pasto titila
  tex.anisotropy = 8;
  return tex;
}

/**
 * El viento en lo que crece bajito (matas y flores): cada uno se mece según dónde está (así no se
 * mueven todos juntos), y más la punta que la base (`position.y` es la altura en la planta).
 */
const SWAY = /* i18n-ok: GLSL */ `#include <begin_vertex>
  #ifdef USE_INSTANCING
    vec2 at = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
    float sway = sin(uWind * 1.6 + at.x * 0.31 + at.y * 0.17) * 0.6 + sin(uWind * 2.7 + at.y * 0.53) * 0.3;
    transformed.x += sway * position.y * 0.35;
    transformed.z += sway * position.y * 0.15;
  #endif`;

/** Le pone el viento a un material de algo repetido. `wind.value` es el reloj (ver World.update). */
function windy(mat: THREE.Material, wind: { value: number }): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', SWAY);
  };
}

/**
 * Hojas finas paradas: cada una es un triángulo, y va dos veces, una para cada lado (con DoubleSide la
 * cara de atrás da vuelta la normal, mira al piso y sale negra). La luz les pega como al piso.
 */
function bladesGeometry(blades: { x0: number; z0: number; x1: number; z1: number; tipX: number; tipZ: number; h: number }[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  for (const b of blades) {
    pos.push(b.x0, 0, b.z0, b.x1, 0, b.z1, b.tipX, b.h, b.tipZ);
    pos.push(b.x1, 0, b.z1, b.x0, 0, b.z0, b.tipX, b.h, b.tipZ);
    for (let k = 0; k < 2; k++) col.push(0.72, 0.76, 0.72, 0.72, 0.76, 0.72, 1.08, 1.08, 0.95);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  return geo;
}

/** Junta las piezas repetidas de un tipo (posición, giro, tamaño y color) y arma su malla. */
class Batch {
  private readonly matrices: THREE.Matrix4[] = [];
  private readonly colors: THREE.Color[] = [];
  private static readonly q = new THREE.Quaternion();
  private static readonly e = new THREE.Euler();

  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation, yaw = 0, tiltX = 0, tiltZ = 0): void {
    Batch.q.setFromEuler(Batch.e.set(tiltX, yaw, tiltZ));
    this.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), Batch.q, new THREE.Vector3(sx, sy, sz)));
    this.colors.push(new THREE.Color(color));
  }

  build(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, this.matrices.length));
    this.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    this.colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.count = this.matrices.length;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

/** Un color de la lista, apenas más claro o más oscuro cada vez. */
function pick(rand: () => number, list: number[], spread = 0.12): THREE.Color {
  return new THREE.Color(list[Math.floor(rand() * list.length)]).multiplyScalar(1 - spread / 2 + rand() * spread);
}

/**
 * Matas de pasto alto en el primer corte y el rough (en el fairway no: es pasto corto, y ahí se juega).
 * No proyectan sombra (las sombras no se mecerían), pero reciben la de los demás.
 */
export function buildTufts(scene: THREE.Object3D, wind: { value: number }): void {
  // tres hojas en abanico, de unos 40 cm
  const geo = bladesGeometry([0, 1, 2].map((b) => {
    const a = (b / 3) * Math.PI + 0.3;
    const lean = 0.12 * (b - 1);
    return { x0: -Math.cos(a) * 0.07, z0: -Math.sin(a) * 0.07, x1: Math.cos(a) * 0.07, z1: Math.sin(a) * 0.07, tipX: lean, tipZ: lean * 0.5, h: 0.34 + b * 0.05 };
  }));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  windy(mat, wind);
  const COUNT = 7000;
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.userData.noCast = true;
  mesh.frustumCulled = false;
  const rand = seeded(99);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let n = 0;
  for (let tries = 0; n < COUNT && tries < COUNT * 4; tries++) {
    const side = rand() < 0.5 ? -1 : 1;
    // más tupido cerca del borde del fairway, más ralo hacia afuera
    const out = Math.pow(rand(), 1.6) * 42;
    const z = -3 + rand() * 128;
    const x = side * (fieldHalfAt(z) + 1.6 + out);
    // en el primer corte, pocas
    if (out < 2.5 && rand() < 0.7) continue;
    const k = 0.7 + rand() * 0.8 + Math.min(0.5, out / 30);
    p.set(x, heightAt(x, z), z);
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    sc.set(k, k * (0.8 + rand() * 0.5), k);
    mesh.setMatrixAt(n, m.compose(p, q, sc));
    grassColor(x, z, shade).multiplyScalar(DETAIL_MEAN * (0.9 + rand() * 0.35));
    mesh.setColorAt(n, shade);
    n++;
  }
  mesh.count = n;
  scene.add(mesh);
}

const FLOWER_COLORS = [0xf6f2e6, 0xf6f2e6, 0xf2d23c, 0xffb93a, 0xb07fe8, 0xe8604f, 0x8fc6ef];

/**
 * Flores en el rough, en manchones de un color: un tallo y una cabecita, que se mecen con las matas.
 * Ninguna en el fairway.
 */
export function buildFlowers(scene: THREE.Object3D, wind: { value: number }): void {
  const stems = new Batch();
  const heads = new Batch();
  const rand = seeded(313);
  for (let c = 0; c < 80; c++) {
    const side = rand() < 0.5 ? -1 : 1;
    const cz = rand() * 120;
    const cx = side * (fieldHalfAt(cz) + 2.5 + Math.pow(rand(), 1.3) * 30);
    const color = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)];
    const n = 5 + Math.floor(rand() * 9);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 1.5;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const k = 0.8 + rand() * 0.5;
      const y = heightAt(x, z);
      const yaw = rand() * Math.PI * 2;
      grassColor(x, z, shade).multiplyScalar(DETAIL_MEAN);
      stems.add(x, y, z, k, k, k, shade, yaw);
      heads.add(x, y, z, k, k, k, new THREE.Color(color).multiplyScalar(0.9 + rand() * 0.2), yaw);
    }
  }
  const stemGeo = bladesGeometry([{ x0: -0.012, z0: 0, x1: 0.012, z1: 0, tipX: 0.02, tipZ: 0, h: 0.3 }]);
  const stemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  windy(stemMat, wind);
  // la cabecita: un rombo chato en la punta del tallo (se mece igual porque está a la misma altura)
  const headGeo = new THREE.OctahedronGeometry(0.11, 0);
  headGeo.scale(1, 0.5, 1);
  headGeo.translate(0.02, 0.3, 0);
  const headMat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  windy(headMat, wind);
  for (const mesh of [stems.build(stemGeo, stemMat), heads.build(headGeo, headMat)]) {
    mesh.userData.noCast = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
}

// ---- árboles, arbustos y piedras ----

const PINE = [0x2b6b3a, 0x2f7a3f, 0x24603a, 0x3a7d45, 0x2e6e44];
const LEAF = [0x4f9a3e, 0x5aa646, 0x3f8a3a, 0x67a84a, 0x4a8f45];
const AUTUMN = [0xd98a2b, 0xe0b23a, 0xc4552f, 0xb8732f, 0xd6a03a];
const BIRCH_LEAF = [0x8fbf4f, 0xa6c75a, 0x9cc25e];
const BUSH = [0x3d7f3a, 0x467f35, 0x2f6b34, 0x4f8a3e];
const BARK = [0x5a3d25, 0x4f3520, 0x64442a];
const STONE = [0x8a8d90, 0x9a958c, 0x7d8085, 0xa39d92, 0x8f8a80];

/** Un tronco de 1 m de alto con la base en el piso, para estirar. */
function trunkGeometry(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.5, 0.65, 1, 6).translate(0, 0.5, 0);
}

/** Un cono de 1 m con la base en el piso: los pisos de los pinos. */
function coneGeometry(): THREE.BufferGeometry {
  return new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
}

/**
 * Una bola de follaje: icosaedro con los vértices un poco corridos, así no son todas esferas perfectas.
 * Los vértices repetidos (la malla no los comparte) se corren igual: el corrimiento sale de dónde están.
 */
function blobGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + 0.16 * (noise(x * 3.1 + 7, z * 3.1 + y * 5.3) - 0.5);
    pos.setXYZ(i, x * k, y * k * 0.92, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Una piedra: un icosaedro abollado y aplastado, con musgo en las caras de arriba. `seed` cambia la
 * forma: hay cuatro, repartidas entre todas las piedras.
 */
function rockGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 0.72 + 0.5 * noise(x * 1.7 + seed * 13.1, z * 1.7 + y * 2.3 + seed * 5.7);
    pos.setXYZ(i, x * k * (1 + seed * 0.08), y * k * 0.62, z * k);
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const col: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const moss = smooth(0.55, 0.85, nor.getY(i));
    col.push(1 - moss * 0.4, 1 - moss * 0.05, 1 - moss * 0.55);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // se entierra un poco: así se ve apoyada y no puesta encima
  geo.translate(0, 0.25, 0);
  return geo;
}

/**
 * Árboles, arbustos y piedras a los costados del campo. Cuatro árboles: el pino de pisos, el árbol
 * redondo (y alguno de otoño), y el abedul blanco; arbustos bajos cerca del borde del fairway; piedras
 * en grupos, con musgo, y piedritas sueltas.
 */
export function buildTrees(scene: THREE.Object3D): void {
  const rand = seeded(42);
  const trunks = new Batch();
  const cones = new Batch();
  const blobs = new Batch();
  const rocks = [new Batch(), new Batch(), new Batch(), new Batch()];
  const place = (near: number, far: number) => {
    const side = rand() < 0.5 ? -1 : 1;
    const z = 2 + rand() * 114;
    const x = side * (fieldHalfAt(z) + near + rand() * far);
    return { x, z, y: heightAt(x, z) };
  };

  for (let i = 0; i < 95; i++) {
    const { x, z, y } = place(5, 32);
    const kind = rand();
    const yaw = rand() * Math.PI * 2;
    if (kind < 0.45) {
      // pino: tronco corto y tres pisos de cono, cada uno más chico y más claro
      const h = 5 + rand() * 4.5;
      const w = 0.85 + rand() * 0.35;
      trunks.add(x, y, z, 0.32, h * 0.3, 0.32, pick(rand, BARK), yaw);
      const base = pick(rand, PINE);
      for (let t = 0; t < 3; t++) {
        const r = (1.9 - t * 0.5) * w;
        cones.add(x, y + h * (0.2 + t * 0.21), z, r, h * (0.42 - t * 0.06), r, base.clone().multiplyScalar(1 + t * 0.07), yaw + t);
      }
    } else if (kind < 0.88) {
      // redondo: un tronco y un puñado de bolas de follaje; alguno, de otoño
      const h = 4 + rand() * 3.5;
      const autumn = rand() < 0.2;
      trunks.add(x, y, z, 0.3, h * 0.5, 0.3, pick(rand, BARK), yaw);
      const leaf = pick(rand, autumn ? AUTUMN : LEAF);
      const r = h * 0.3;
      blobs.add(x, y + h * 0.66, z, r, r, r, leaf, yaw);
      const n = 2 + Math.floor(rand() * 3);
      for (let b = 0; b < n; b++) {
        const a = yaw + (b / n) * Math.PI * 2;
        const rr = r * (0.55 + rand() * 0.2);
        blobs.add(x + Math.cos(a) * r * 0.6, y + h * (0.55 + rand() * 0.2), z + Math.sin(a) * r * 0.6, rr, rr, rr, leaf.clone().multiplyScalar(0.9 + rand() * 0.2), a);
      }
    } else {
      // abedul: tronco blanco y finito, copa alargada y clara
      const h = 5 + rand() * 3;
      trunks.add(x, y, z, 0.17, h * 0.62, 0.17, new THREE.Color(0xe9e6dc).multiplyScalar(0.92 + rand() * 0.08), yaw);
      const leaf = pick(rand, BIRCH_LEAF);
      for (let b = 0; b < 3; b++) {
        const rr = h * (0.14 + rand() * 0.05);
        blobs.add(x + (rand() - 0.5) * 0.8, y + h * (0.6 + b * 0.13), z + (rand() - 0.5) * 0.8, rr, rr * 1.35, rr, leaf.clone().multiplyScalar(0.92 + rand() * 0.16), rand() * 6);
      }
    }
  }

  // arbustos: bajitos, cerca del borde, donde no tapan nada
  for (let i = 0; i < 60; i++) {
    const { x, z, y } = place(2.5, 11);
    const color = pick(rand, BUSH);
    const n = 2 + Math.floor(rand() * 2);
    for (let b = 0; b < n; b++) {
      const r = 0.45 + rand() * 0.45;
      blobs.add(x + (rand() - 0.5) * 1.1, y + r * 0.55, z + (rand() - 0.5) * 1.1, r * 1.15, r * 0.85, r * 1.15, color.clone().multiplyScalar(0.9 + rand() * 0.2), rand() * 6);
    }
  }

  // piedras: grupos de una grande y un par de chicas
  let r = 0;
  const rock = (x: number, z: number, size: number) => {
    const b = rocks[r++ % rocks.length];
    b.add(x, heightAt(x, z) - size * 0.25, z, size * (0.9 + rand() * 0.4), size * (0.8 + rand() * 0.5), size * (0.9 + rand() * 0.4), pick(rand, STONE, 0.2), rand() * Math.PI * 2, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3);
  };
  for (let i = 0; i < 26; i++) {
    const { x, z } = place(4, 30);
    rock(x, z, 0.8 + rand() * 1.1);
    const n = Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) rock(x + (rand() - 0.5) * 3, z + (rand() - 0.5) * 3, 0.25 + rand() * 0.4);
  }
  // y piedritas sueltas cerca del borde
  for (let i = 0; i < 45; i++) {
    const { x, z } = place(1.8, 7);
    rock(x, z, 0.14 + rand() * 0.22);
  }

  const flat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const stone = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, vertexColors: true });
  scene.add(trunks.build(trunkGeometry(), flat), cones.build(coneGeometry(), flat), blobs.build(blobGeometry(), flat));
  rocks.forEach((b, i) => scene.add(b.build(rockGeometry(i), stone)));
}
