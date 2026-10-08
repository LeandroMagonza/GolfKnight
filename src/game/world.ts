// El campo de batalla: un fairway que termina en la muralla de Valdehoyo. Las hordas vienen desde
// +Z hacia la puerta, que está en z = 0. Todo con primitivas, sin assets.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BAND_LIMITS } from '../core/clubs';
import { fieldHalfAt, TEE_LINE_Z } from '../core/field';
import { heightAt, relief } from '../core/terrain';
import { L } from '../i18n';
import { buildFlowers, buildTrees, buildTufts, DETAIL_MEAN, DETAIL_TILE, grassDetail, groundColor, ROUGH } from './scenery';

// la línea de los puestos, el ancho y el fondo del campo viven en core/field (también su forma)
export { FIELD_HALF_WIDTH, SPAWN_Z, TEE_LINE_Z } from '../core/field';
export const GATE_Z = 0;
export const GATE_HALF_WIDTH = 2.6;

/** La malla del campo: un vértice por metro (con relieve y sin él: en el liso es plana). */
const TERRAIN = { width: 240, depth: 180, centerZ: 60 };
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

const shade = new THREE.Color();

/** Altura y color de un vértice del campo, con lo que diga `heightAt` ahora. */
function shadeVertex(geo: THREE.BufferGeometry, i: number): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const h = heightAt(x, z);
  pos.setY(i, h);
  groundColor(x, z, h, shade);
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
    buildTrees(g);
    buildTufts(g, this.wind);
    buildFlowers(g, this.wind);
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
      const width = Math.round(fieldHalfAt(z) * 2);
      const geo = new THREE.PlaneGeometry(width, band ? 0.3 : 0.12, width * 2, 1);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0, z);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) + 0.02);
      const line = new THREE.Mesh(geo, band ? bandMat : lineMat);
      scene.add(line);
      this.marks.push({ mesh: line, z });
      for (const side of [-1, 1]) {
        const x = side * (fieldHalfAt(z) + 1.6);
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
      const x = -(fieldHalfAt(z) + 5.2);
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
