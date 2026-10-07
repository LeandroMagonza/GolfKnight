// El campo de batalla: un fairway que termina en la muralla de Valdehoyo. Las hordas vienen desde
// +Z hacia la puerta, que está en z = 0. Todo con primitivas, sin assets.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BAND_LIMITS } from '../core/clubs';
import { heightAt, relief } from '../core/terrain';
import { L } from '../i18n';

/**
 * La línea de los puestos: desde acá se pega, así que es el 0 de las marcas de distancia. Vive acá y
 * no en game/tees para que las marcas del campo no puedan quedar desfasadas de los puestos.
 */
export const TEE_LINE_Z = 9;
export const FIELD_HALF_WIDTH = 18;
export const GATE_Z = 0;
export const GATE_HALF_WIDTH = 2.6;
export const SPAWN_Z = 68;

/** La malla del campo: un vértice por metro (con relieve y sin él: en el liso es plana). */
const TERRAIN = { width: 240, depth: 180, centerZ: 60 };
/**
 * El pasto (8/10, pedido de Leandro: «hoy el pasto es verde sólido»). El color de cada vértice da lo
 * grande: el fairway con sus franjas de corte, un primer corte más oscuro en el borde, el rough, y
 * manchones más secos o más verdes. La textura (`grassDetail`) da lo chico: hojitas que se ven de
 * cerca. Fuera del fairway, matas de pasto alto que se mueven con el viento (`buildTufts`).
 */
const FAIRWAY_LIGHT = new THREE.Color(0x56ae59);
const FAIRWAY_DARK = new THREE.Color(0x3e8b46);
const FIRST_CUT = new THREE.Color(0x367c3d);
const ROUGH = new THREE.Color(0x2e6a35);
/** Los manchones: pasto más seco (amarillento) y más tupido (más azul). */
const DRY = new THREE.Color(0x7d9a3c);
const LUSH = new THREE.Color(0x24683a);
const HIGH = new THREE.Color(0xa9d66b);
const LOW = new THREE.Color(0x1f4f3a);
/** La textura oscurece en promedio esto: los colores se levantan lo mismo para que el campo no se apague. */
const DETAIL_MEAN = 0.86;
/** Cada cuántos metros se repite la textura de las hojitas. */
const DETAIL_TILE = 3;
const shade = new THREE.Color();
const tint = new THREE.Color();

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
function grassColor(x: number, z: number, out: THREE.Color): THREE.Color {
  const ax = Math.abs(x);
  const stripe = smooth(-0.18, 0.18, Math.sin((z / 5) * Math.PI));
  out.copy(FAIRWAY_DARK).lerp(FAIRWAY_LIGHT, stripe);
  // el fairway termina a los costados y en las puntas: primero el corte, después el rough
  const off = Math.max(ax - FIELD_HALF_WIDTH, -4 - z, z - 116);
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

/**
 * Las hojitas del pasto, de cerca: una textura gris clara que multiplica al color (por eso es lineal y no
 * sRGB). Se repite sin costura: cada trazo que se sale de un borde vuelve a entrar por el otro.
 */
function grassDetail(): THREE.CanvasTexture {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grey = (v: number, a = 1) => `rgba(${v}, ${v}, ${v}, ${a})`;
  g.fillStyle = grey(Math.round(255 * 0.9));
  g.fillRect(0, 0, N, N);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
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
/** Dónde se paran los guardias: detrás de la línea de puestos, desde donde le tiran pelotas al golfista. */
export const GUARD_POSTS: readonly (readonly [number, number, number])[] = [[-14, 4.6, 0.12], [-5, 4.4, 0.05], [5, 4.4, -0.05], [14, 4.6, -0.12]];
export const PLAYER_MIN_Z = 1.5;
export const PLAYER_MAX_Z = 48;
const WALL_HEIGHT = 5;
/** Plano de la muralla, y las torres que la flanquean, medio metro más adelante. */
const WALL_Z = GATE_Z - 1.6;
const TOWER_Z = WALL_Z + 0.4;
const TOWER_RADIUS = 2.1;
const TOWER_CAP_RADIUS = 2.4;
/**
 * Lo más adelantado que asoma de la muralla: el techo de las torres. **La cámara no pasa de acá.** Las
 * torres están a x = ±4.2 y son anchas, así que desde un puesto del costado, con la cámara baja, la
 * cámara quedaba adentro de una y le tapaba media pantalla al jugador.
 */
export const WALL_FRONT_Z = TOWER_Z + TOWER_CAP_RADIUS;
/**
 * Lo más alto de la muralla: la punta del techo de las torres (torre de WALL_HEIGHT + 1.2 y techo de
 * 1.6). Una cámara más alta que esto ya no puede quedar adentro de una torre.
 */
export const WALL_TOP = WALL_HEIGHT + 1.2 + 1.6;

/**
 * El viento en las matas de pasto: cada una se mece según dónde está (así no se mueven todas juntas), y
 * más la punta que la base (`position.y` es la altura en la mata).
 */
const TUFT_SWAY = /* i18n-ok: GLSL */ `#include <begin_vertex>
  #ifdef USE_INSTANCING
    vec2 at = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
    float sway = sin(uWind * 1.6 + at.x * 0.31 + at.y * 0.17) * 0.6 + sin(uWind * 2.7 + at.y * 0.53) * 0.3;
    transformed.x += sway * position.y * 0.35;
    transformed.z += sway * position.y * 0.15;
  #endif`;

/** Altura y color de un vértice del campo, con lo que diga `heightAt` ahora. */
function shadeVertex(geo: THREE.BufferGeometry, i: number): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const h = heightAt(x, z);
  pos.setY(i, h);
  grassColor(x, z, shade);
  if (h > 0) shade.lerp(tint.copy(HIGH).multiplyScalar(1 / DETAIL_MEAN), Math.min(1, h / 2.4) * 0.7);
  else shade.lerp(tint.copy(LOW).multiplyScalar(1 / DETAIL_MEAN), Math.min(1, -h / 1) * 0.7);
  col.setXYZ(i, shade.r, shade.g, shade.b);
}

function labelSprite(text: string, color = 'rgba(255,255,255,0.9)'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 64, 34);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sprite.scale.set(2.4, 1.2, 1);
  return sprite;
}

export class World {
  private readonly doorMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
  private doorFlash = 0;
  private readonly guardMixers: THREE.AnimationMixer[] = [];
  /** La luz del cielo y el sol: los números finales (hora del día, sombras) los pone game/visuals. */
  readonly hemi = new THREE.HemisphereLight(0xdff1ff, 0x4a6b3a, 1.5);
  readonly sun = new THREE.DirectionalLight(0xfff2d6, 2.4);

  /**
   * Lo que depende del campo: el piso, las rayas de distancia, los árboles, las piedras y las matas de
   * pasto (que se apoyan en el piso). Va en un grupo aparte para poder rearmarlo cuando cambia el campo
   * (`rebuildField`); la muralla, la puerta y los guardias están en el llano y no se enteran.
   */
  private readonly field = new THREE.Group();
  /** El reloj del viento de las matas de pasto. */
  private readonly wind = { value: 0 };

  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(0x9fd3f0);
    scene.fog = new THREE.Fog(0x9fd3f0, 70, 140);
    scene.add(this.hemi);
    this.sun.position.set(-10, 18, -6);
    scene.add(this.sun);
    scene.add(this.field);
    this.buildField();
    this.buildWall(scene);
  }

  /**
   * Arma el campo que diga core/terrain: la misma malla con relieve o sin él (en el liso queda plana y no
   * se toca: las lomas del geomante llevan malla propia). Más allá, hasta el horizonte, un rough plano.
   */
  private buildField(): void {
    const g = this.field;
    const detail = grassDetail();
    // el rough de afuera tiene un agujero donde va la malla: si no, asomaba por los valles del relieve.
    // Se arma en el plano XY y se acuesta (y pasa a ser -z); sus coordenadas de textura son los metros
    const z0 = TERRAIN.centerZ - TERRAIN.depth / 2;
    const z1 = TERRAIN.centerZ + TERRAIN.depth / 2;
    const ring = new THREE.Shape([new THREE.Vector2(-200, 160), new THREE.Vector2(200, 160), new THREE.Vector2(200, -260), new THREE.Vector2(-200, -260)]);
    ring.holes.push(new THREE.Path([
      new THREE.Vector2(-TERRAIN.width / 2, -z0), new THREE.Vector2(-TERRAIN.width / 2, -z1),
      new THREE.Vector2(TERRAIN.width / 2, -z1), new THREE.Vector2(TERRAIN.width / 2, -z0),
    ]));
    const far = detail.clone();
    far.repeat.set(1 / DETAIL_TILE, 1 / DETAIL_TILE);
    far.needsUpdate = true;
    const rough = new THREE.Mesh(
      new THREE.ShapeGeometry(ring),
      new THREE.MeshStandardMaterial({ color: ROUGH.clone().multiplyScalar(1 / DETAIL_MEAN), map: far, roughness: 1 }),
    );
    rough.rotation.x = -Math.PI / 2;
    g.add(rough);
    this.buildTerrain(g, detail);
    this.buildDistanceMarks(g);
    this.buildScenery(g);
    this.buildTufts(g);
  }

  /**
   * Cambió el campo (se prendió o se apagó el terreno irregular antes de empezar): tira el de antes y
   * arma el nuevo, sin recargar la página.
   */
  rebuildField(): void {
    this.field.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.material) return;
      // los carteles son sprites, que comparten una sola geometría: de esos se tira solo el material
      if (mesh.isMesh) mesh.geometry.dispose();
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        m.dispose();
      }
    });
    this.field.clear();
    this.terrainGeo = null;
    this.marks.length = 0;
    this.labels.length = 0;
    this.buildField();
  }

  /**
   * El campo: una sola malla, de un metro por cuadro, con la altura de core/terrain. El color hace de
   * mapa (ver `grassColor`), y con relieve además es más claro en las lomas y más oscuro en el valle, para
   * que se lea desde la cámara fija. En el liso no queda como `terrainGeo`: es plana y nadie la toca.
   */
  private buildTerrain(scene: THREE.Object3D, detail: THREE.Texture): void {
    const geo = new THREE.PlaneGeometry(TERRAIN.width, TERRAIN.depth, TERRAIN.width, TERRAIN.depth);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, TERRAIN.centerZ);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    for (let i = 0; i < pos.count; i++) shadeVertex(geo, i);
    geo.computeVertexNormals();
    if (relief.on) this.terrainGeo = geo;
    detail.repeat.set(TERRAIN.width / DETAIL_TILE, TERRAIN.depth / DETAIL_TILE);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1 }));
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  /**
   * Matas de pasto alto en el primer corte y el rough (en el fairway no: es pasto corto, y ahí se juega).
   * Una sola malla repetida miles de veces; el viento las mece en el shader, más arriba que abajo. No
   * proyectan sombra (las sombras no se mecerían), pero reciben la de los demás.
   */
  private buildTufts(scene: THREE.Object3D): void {
    // tres hojas finas en abanico, de 40 cm, más oscuras abajo. Cada hoja va dos veces, una para cada
    // lado: con DoubleSide la cara de atrás da vuelta la normal, mira al piso y sale negra
    const blades: number[] = [];
    const colors: number[] = [];
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI + 0.3;
      const lean = 0.12 * (b - 1);
      const cx = Math.cos(a) * 0.07;
      const cz = Math.sin(a) * 0.07;
      const h = 0.34 + b * 0.05;
      blades.push(-cx, 0, -cz, cx, 0, cz, lean, h, lean * 0.5);
      blades.push(cx, 0, cz, -cx, 0, -cz, lean, h, lean * 0.5);
      for (let k = 0; k < 2; k++) colors.push(0.72, 0.76, 0.72, 0.72, 0.76, 0.72, 1.08, 1.08, 0.95);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // la luz les pega como al piso: si no, cada hoja se ve de un tono según para dónde mira
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(blades.length / 3).fill([0, 1, 0]).flat(), 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const wind = this.wind;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = wind;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace('#include <begin_vertex>', TUFT_SWAY);
    };
    const COUNT = 7000;
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    mesh.userData.noCast = true;
    mesh.frustumCulled = false;
    let seed = 99;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
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
      const x = side * (FIELD_HALF_WIDTH + 1.6 + out);
      const z = -3 + rand() * 128;
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

  /** La malla del campo con relieve (null en el campo liso). */
  private terrainGeo: THREE.BufferGeometry | null = null;

  /** ¿El campo es una malla con relieve? En el liso las lomas de la partida llevan malla propia. */
  get hasTerrain(): boolean {
    return this.terrainGeo !== null;
  }


  /**
   * El piso cambió en este rectángulo (una loma del geomante que sube o baja): rehace la altura y el
   * color del campo ahí, y apoya de nuevo las rayas de distancia y sus carteles.
   */
  refreshGround(x0: number, x1: number, z0: number, z1: number): void {
    const geo = this.terrainGeo;
    if (geo) {
      // la malla tiene un vértice por metro: el índice sale directo de las coordenadas
      const cols = TERRAIN.width + 1;
      const ix0 = Math.max(0, Math.floor(x0 + TERRAIN.width / 2));
      const ix1 = Math.min(TERRAIN.width, Math.ceil(x1 + TERRAIN.width / 2));
      const iz0 = Math.max(0, Math.floor(z0 - TERRAIN.centerZ + TERRAIN.depth / 2));
      const iz1 = Math.min(TERRAIN.depth, Math.ceil(z1 - TERRAIN.centerZ + TERRAIN.depth / 2));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) shadeVertex(geo, iz * cols + ix);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.computeVertexNormals();
    }
    for (const line of this.marks) {
      if (line.z < z0 || line.z > z1) continue;
      const pos = line.mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        if (x >= x0 && x <= x1) pos.setY(i, heightAt(x, pos.getZ(i)) + 0.02);
      }
      pos.needsUpdate = true;
    }
    for (const l of this.labels) {
      if (l.position.x >= x0 && l.position.x <= x1 && l.position.z >= z0 && l.position.z <= z1) {
        l.position.y = heightAt(l.position.x, l.position.z) + (l.userData.lift as number);
      }
    }
  }

  /** Las rayas de distancia: una tira por raya, que sigue el piso vértice por vértice. */
  private readonly marks: { mesh: THREE.Mesh; z: number }[] = [];
  private readonly labels: THREE.Sprite[] = [];

  /**
   * Las marcas de distancia se miden **desde la línea de los puestos**, que es desde donde se pega: la
   * raya donde está parado el golfista dice 0, no importa que la puerta quede unos metros más atrás.
   * Las rayas de 20 y 40 m son los bordes de las bandas de daño: ahí cambia cuánto pega cada palo, así
   * que se ven más marcadas y llevan el nombre de la banda.
   */
  private buildDistanceMarks(scene: THREE.Object3D): void {
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.55 });
    for (let d = 0; d <= 60; d += 10) {
      const z = TEE_LINE_Z + d;
      const band = BAND_LIMITS.includes(d);
      // una tira con un vértice cada medio metro, apoyada en el piso: sigue las pendientes y las lomas
      // que se levantan en la partida, en vez de enterrarse
      const width = FIELD_HALF_WIDTH * 2;
      const geo = new THREE.PlaneGeometry(width, band ? 0.3 : 0.12, width * 2, 1);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0, z);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) + 0.02);
      const line = new THREE.Mesh(geo, band ? bandMat : lineMat);
      scene.add(line);
      this.marks.push({ mesh: line, z });
      for (const side of [-1, 1]) {
        const x = side * (FIELD_HALF_WIDTH + 1.6);
        const label = labelSprite(`${d}m`, band ? '#ffd66b' : 'rgba(255,255,255,0.9)');
        label.position.set(x, heightAt(x, z) + 1.2, z);
        label.userData.lift = 1.2;
        this.labels.push(label);
        scene.add(label);
      }
    }
    // el nombre de cada banda, en el medio de su tramo, del lado izquierdo
    for (const [name, from, to] of [[L('corta', 'short'), 0, BAND_LIMITS[0]], [L('media', 'mid'), BAND_LIMITS[0], BAND_LIMITS[1]], [L('larga', 'long'), BAND_LIMITS[1], 60]] as const) {
      const z = TEE_LINE_Z + (from + to) / 2;
      const x = -(FIELD_HALF_WIDTH + 5.2);
      const label = labelSprite(name, '#ffd66b');
      label.scale.set(3.6, 1.8, 1);
      label.position.set(x, heightAt(x, z) + 1.4, z);
      scene.add(label);
    }
  }

  private buildWall(scene: THREE.Scene): void {
    const stone = new THREE.MeshStandardMaterial({ color: 0xa9a294, roughness: 0.95 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x7d776b, roughness: 0.95 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x9c3b2e, roughness: 0.8 });
    const wallZ = WALL_Z;
    const span = 60;
    for (const side of [-1, 1]) {
      const len = span - GATE_HALF_WIDTH - 1.2;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, WALL_HEIGHT, 2), stone);
      wall.position.set(side * (GATE_HALF_WIDTH + 1.2 + len / 2), WALL_HEIGHT / 2, wallZ);
      scene.add(wall);
      for (let x = GATE_HALF_WIDTH + 2; x < span; x += 2.4) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 2), dark);
        merlon.position.set(side * x, WALL_HEIGHT + 0.45, wallZ);
        scene.add(merlon);
      }
      // torres a los lados de la puerta
      // (bajas, para que no tapen la cámara cuando el golfista está cerca de la muralla)
      const towerH = WALL_HEIGHT + 1.2;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(TOWER_RADIUS - 0.2, TOWER_RADIUS, towerH, 12), stone);
      tower.position.set(side * (GATE_HALF_WIDTH + 1.6), towerH / 2, TOWER_Z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(TOWER_CAP_RADIUS, 1.6, 12), roof);
      cap.position.set(tower.position.x, towerH + 0.8, tower.position.z);
      scene.add(tower, cap);
      // banderín de golf sobre la muralla, lejos de la puerta
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      pole.position.set(side * 14, WALL_HEIGHT + 1.1, wallZ);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: 0xe63946, side: THREE.DoubleSide }));
      flag.position.set(pole.position.x + 0.47, pole.position.y + 0.75, pole.position.z);
      scene.add(pole, flag);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(GATE_HALF_WIDTH * 2 + 2.4, 1.4, 2), stone);
    lintel.position.set(0, WALL_HEIGHT - 0.7, wallZ);
    scene.add(lintel);
    const door = new THREE.Mesh(new THREE.BoxGeometry(GATE_HALF_WIDTH * 2, WALL_HEIGHT - 1.4, 0.5), this.doorMat);
    door.position.set(0, (WALL_HEIGHT - 1.4) / 2, wallZ + 0.6);
    scene.add(door);
    const band = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.6, roughness: 0.5 });
    for (const y of [0.9, 2.6]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(GATE_HALF_WIDTH * 2, 0.22, 0.56), band);
      strap.position.set(0, y, wallZ + 0.6);
      scene.add(strap);
    }

    // techos de la ciudad asomando detrás de la muralla
    const houseMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.9 });
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      const w = 3 + rand() * 3;
      const h = 4 + rand() * 4;
      const x = -40 + i * 5.2 + rand() * 2;
      const z = wallZ - 5 - rand() * 12;
      const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), houseMat);
      house.position.set(x, h / 2, z);
      const top = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, 2.4, 4), roof);
      top.position.set(x, h + 1.2, z);
      top.rotation.y = Math.PI / 4;
      scene.add(house, top);
    }
  }

  private buildScenery(scene: THREE.Object3D): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d25, roughness: 1 });
    const leafMats = [0x2e7d3a, 0x3c8c46, 0x27693a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 1, flatShading: true });
    let seed = 42;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (FIELD_HALF_WIDTH + 5 + rand() * 30);
      const z = 4 + rand() * 110;
      if (rand() < 0.78) {
        const h = 4 + rand() * 4;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, h * 0.4, 6), trunkMat);
        const base = heightAt(x, z);
        trunk.position.set(x, base + h * 0.2, z);
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.6 + rand(), h * 0.8, 7), leafMats[i % leafMats.length]);
        leaves.position.set(x, base + h * 0.4 + h * 0.4, z);
        scene.add(trunk, leaves);
      } else {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + rand() * 1.2, 0), rockMat);
        rock.position.set(x, heightAt(x, z) + 0.4, z);
        rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        scene.add(rock);
      }
    }
    // los bunkers de arena se fueron (8/10, Leandro): no hacían nada y confundían
  }

  /** Guardias de Valdehoyo apostados a los lados de la puerta. Por ahora solo miran. */
  addGuards(scene: THREE.Scene, gltf: GLTF): void {
    const idle = gltf.animations.find((c) => c.name === 'Idle');
    // el modelo viene en su tamaño original (unos 2.1 m con el casco): se lleva a la altura del golfista
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) sm.skeleton.update();
    });
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    const scale = 1.75 / Math.max(0.5, box.max.y - box.min.y);
    for (const [x, z, yaw] of GUARD_POSTS) {
      const guard = cloneSkinned(gltf.scene);
      guard.position.set(x, 0, z);
      guard.rotation.y = yaw;
      guard.scale.setScalar(scale);
      guard.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
      });
      scene.add(guard);
      if (idle) {
        const mixer = new THREE.AnimationMixer(guard);
        const action = mixer.clipAction(idle);
        action.time = Math.random() * idle.duration;
        action.play();
        this.guardMixers.push(mixer);
      }
    }
  }

  /** La puerta recibió un golpe. */
  flashDoor(): void {
    this.doorFlash = 0.25;
  }

  update(dt: number): void {
    this.wind.value += dt;
    for (const m of this.guardMixers) m.update(dt);
    if (this.doorFlash > 0) {
      this.doorFlash -= dt;
      this.doorMat.emissive.setHex(this.doorFlash > 0 ? 0x992222 : 0x000000);
    }
  }
}
