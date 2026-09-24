// El campo de batalla: un fairway que termina en la muralla de Valdehoyo. Las hordas vienen desde
// +Z hacia la puerta, que está en z = 0. Todo con primitivas, sin assets.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BAND_LIMITS } from '../core/clubs';
import { heightAt, relief } from '../core/terrain';

/**
 * La línea de los puestos: desde acá se pega, así que es el 0 de las marcas de distancia. Vive acá y
 * no en game/tees para que las marcas del campo no puedan quedar desfasadas de los puestos.
 */
export const TEE_LINE_Z = 9;
export const FIELD_HALF_WIDTH = 18;
export const GATE_Z = 0;
export const GATE_HALF_WIDTH = 2.6;
export const SPAWN_Z = 68;
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

function fairwayTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  // franjas de césped cortado, como en una cancha
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#3f8f45' : '#4a9d4f';
    g.fillRect(0, i * 32, 64, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(0x9fd3f0);
    scene.fog = new THREE.Fog(0x9fd3f0, 70, 140);
    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x4a6b3a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
    sun.position.set(-10, 18, -6);
    scene.add(sun);

    if (relief.on) {
      this.buildTerrain(scene);
      this.buildWall(scene);
      this.buildScenery(scene);
      return;
    }
    const rough = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x2f6b38, roughness: 1 }));
    rough.rotation.x = -Math.PI / 2;
    rough.position.y = -0.02;
    scene.add(rough);
    const fairway = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_HALF_WIDTH * 2 + 4, 120),
      new THREE.MeshStandardMaterial({ map: fairwayTexture(), roughness: 1 }),
    );
    fairway.rotation.x = -Math.PI / 2;
    fairway.position.z = 56;
    scene.add(fairway);

    this.buildDistanceMarks(scene);
    this.buildWall(scene);
    this.buildScenery(scene);
  }

  /**
   * Campo con relieve (prototipo): una sola malla, de un metro por cuadro, con la altura de
   * core/terrain. El color hace de mapa: franjas de fairway, rough a los costados, y más claro en las
   * lomas y más oscuro en el valle, para que el relieve se lea desde la cámara fija.
   */
  private buildTerrain(scene: THREE.Scene): void {
    const width = 240;
    const depth = 180;
    const centerZ = 60;
    const geo = new THREE.PlaneGeometry(width, depth, width, depth);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, centerZ);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const light = new THREE.Color(0x4a9d4f);
    const dark = new THREE.Color(0x3f8f45);
    const rough = new THREE.Color(0x2f6b38);
    const high = new THREE.Color(0xa9d66b);
    const low = new THREE.Color(0x1f4f3a);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      const onFairway = Math.abs(x) <= FIELD_HALF_WIDTH + 2 && z >= -4 && z <= 116;
      c.copy(onFairway ? (Math.floor(z / 5) % 2 ? dark : light) : rough);
      if (h > 0) c.lerp(high, Math.min(1, h / 2.4) * 0.7);
      else c.lerp(low, Math.min(1, -h / 1) * 0.7);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
    this.buildDistanceMarks(scene);
  }

  /**
   * Las marcas de distancia se miden **desde la línea de los puestos**, que es desde donde se pega: la
   * raya donde está parado el golfista dice 0, no importa que la puerta quede unos metros más atrás.
   * Las rayas de 20 y 40 m son los bordes de las bandas de daño: ahí cambia cuánto pega cada palo, así
   * que se ven más marcadas y llevan el nombre de la banda.
   */
  private buildDistanceMarks(scene: THREE.Scene): void {
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.55 });
    const onSlope = relief.on;
    for (let d = 0; d <= 60; d += 10) {
      const z = TEE_LINE_Z + d;
      const band = BAND_LIMITS.includes(d);
      // sobre relieve la raya se dibuja en tramos, para que siga la pendiente en vez de enterrarse
      const steps = onSlope ? 24 : 1;
      for (let i = 0; i < steps; i++) {
        const w = (FIELD_HALF_WIDTH * 2) / steps;
        const x = -FIELD_HALF_WIDTH + w * (i + 0.5);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(w, band ? 0.3 : 0.12), band ? bandMat : lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, heightAt(x, z) + 0.02, z);
        scene.add(line);
      }
      for (const side of [-1, 1]) {
        const x = side * (FIELD_HALF_WIDTH + 1.6);
        const label = labelSprite(`${d}m`, band ? '#ffd66b' : 'rgba(255,255,255,0.9)');
        label.position.set(x, heightAt(x, z) + 1.2, z);
        scene.add(label);
      }
    }
    // el nombre de cada banda, en el medio de su tramo, del lado izquierdo
    for (const [name, from, to] of [['corta', 0, BAND_LIMITS[0]], ['media', BAND_LIMITS[0], BAND_LIMITS[1]], ['larga', BAND_LIMITS[1], 60]] as const) {
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

  private buildScenery(scene: THREE.Scene): void {
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
    // bunkers de arena a los costados, por puro golf (con relieve no: son discos planos)
    if (relief.on) return;
    const sand = new THREE.MeshStandardMaterial({ color: 0xe6d3a0, roughness: 1 });
    for (const [x, z, r] of [[-13, 22, 3.2], [12, 36, 2.6], [-10, 52, 3.6]] as const) {
      const bunker = new THREE.Mesh(new THREE.CircleGeometry(r, 24), sand);
      bunker.rotation.x = -Math.PI / 2;
      bunker.scale.y = 0.65;
      bunker.position.set(x, 0.012, z);
      scene.add(bunker);
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
    for (const m of this.guardMixers) m.update(dt);
    if (this.doorFlash > 0) {
      this.doorFlash -= dt;
      this.doorMat.emissive.setHex(this.doorFlash > 0 ? 0x992222 : 0x000000);
    }
  }
}
