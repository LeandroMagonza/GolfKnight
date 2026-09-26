// Escenarios y utilería de la cinemática, armados con figuras simples. Cada escenario es un grupo con
// sus propias luces y su cielo; el motor muestra uno por vez. Lo que se mueve solo (banderines,
// antorchas, runas) se calcula con el tiempo, así que un cuadro sale igual cada vez que se lo pide.
import * as THREE from 'three';
import { CLUB_LENGTH } from '../game/swingPose';
import type { PropKind, SetId } from './types';

/** Los números de cada plano que leen escenarios y utilería (ver Ramp en types). */
export type Params = Record<string, number>;

export interface CineSet {
  group: THREE.Group;
  background: THREE.Color | THREE.Texture;
  fog: THREE.Fog | null;
  update(t: number, p: Params): void;
}

export interface Prop {
  object: THREE.Object3D;
  update(t: number, p: Params): void;
}

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Un número pseudoazaroso fijo por semilla: la utilería sale igual en cada carga. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function skyGradient(top: number, horizon: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, hex(top));
  g.addColorStop(0.35, hex(top));
  g.addColorStop(0.8, hex(horizon));
  g.addColorStop(1, hex(horizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sun(group: THREE.Group, color: number, intensity: number, dir: THREE.Vector3, sky: number, ground: number, hemi: number, extent = 22): void {
  group.add(new THREE.HemisphereLight(sky, ground, hemi));
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.copy(dir.normalize().multiplyScalar(60));
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const cam = light.shadow.camera;
  cam.left = -extent;
  cam.right = extent;
  cam.top = extent;
  cam.bottom = -extent;
  cam.near = 1;
  cam.far = 160;
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.03;
  group.add(light, light.target);
}

function ground(group: THREE.Group, color: number, size = 160): void {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), std(color, { roughness: 1 }));
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  group.add(g);
}

function shadows(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial || mat.transparent) return;
    m.castShadow = true;
    m.receiveShadow = true;
  });
}

/** Una carpa de feria: lona a rayas, techo cónico y un banderín arriba. */
function tent(radius: number, height: number, a: number, b: number, rand: () => number): { group: THREE.Group; pennant: THREE.Mesh } {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = hex(i % 2 ? a : b);
    ctx.fillRect(i * 16, 0, 16, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16, 1, true), std(0xffffff, { map: tex, side: THREE.DoubleSide }));
  wall.position.y = height / 2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.18, height * 0.75, 16), std(a));
  roof.position.y = height + height * 0.375;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(radius * 0.7, height * 0.85), std(0x2a1a14));
  door.position.set(0, height * 0.425, radius + 0.02);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), std(0x5a3d25));
  pole.position.y = height * 1.75 + 0.4;
  const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), std(b, { side: THREE.DoubleSide }));
  pennant.geometry.translate(0.35, 0, 0);
  pennant.position.set(0, height * 1.75 + 0.7, 0);
  pennant.rotation.y = rand() * Math.PI;
  group.add(wall, roof, door, pole, pennant);
  return { group, pennant };
}

/** Un cartel de madera con texto. */
function sign(text: string, width: number): THREE.Group {
  const g = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#3a2412';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = '#ffe2a8';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, width / 4, 0.08), [std(0x6b4423), std(0x6b4423), std(0x6b4423), std(0x6b4423), std(0xffffff, { map: tex }), std(0x6b4423)]);
  board.position.y = 2.2;
  g.add(board);
  for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.4, 6), std(0x5a3d25));
    post.position.set(x, 1.2, -0.06);
    g.add(post);
  }
  return g;
}

function tree(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const h = 4 + rand() * 3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, h * 0.35, 6), std(0x5a3d25));
  trunk.position.y = h * 0.175;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.4 + rand(), h * 0.8, 7), std([0x2e7d3a, 0x3c8c46, 0x27693a][Math.floor(rand() * 3)]));
  leaves.position.y = h * 0.35 + h * 0.4;
  g.add(trunk, leaves);
  return g;
}

/** Guirnalda de banderines entre dos puntos, colgando en curva. */
function bunting(from: THREE.Vector3, to: THREE.Vector3, colors: number[]): THREE.Mesh[] {
  const flags: THREE.Mesh[] = [];
  const n = Math.max(4, Math.round(from.distanceTo(to) / 0.6));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.38, 0], 3));
  geo.computeVertexNormals();
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const p = from.clone().lerp(to, u);
    p.y -= Math.sin(u * Math.PI) * 0.6;
    const f = new THREE.Mesh(geo, std(colors[i % colors.length], { side: THREE.DoubleSide }));
    f.position.copy(p);
    f.lookAt(p.x + (to.z - from.z), p.y, p.z - (to.x - from.x));
    flags.push(f);
  }
  return flags;
}

// ---------- escenarios ----------

function feria(): CineSet {
  const group = new THREE.Group();
  const rand = seeded(7);
  ground(group, 0x5d8f3e);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(90, 4.5), std(0xb89a6a, { roughness: 1 }));
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.01;
  path.receiveShadow = true;
  group.add(path);
  const pennants: THREE.Mesh[] = [];
  const palettes: [number, number][] = [[0xc0392b, 0xf3e3c3], [0x2e5fa8, 0xf2c14e], [0x2f7d4a, 0xf3e3c3], [0x7b3fa0, 0xf2c14e], [0xc0392b, 0x2e5fa8]];
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    const [a, b] = palettes[i % palettes.length];
    const t = tent(1.8 + rand() * 0.8, 2.2 + rand() * 0.6, a, b, rand);
    t.group.position.set(-20 + i * 5 + rand() * 1.5, 0, side * (6 + rand() * 2));
    t.group.rotation.y = side > 0 ? Math.PI : 0;
    group.add(t.group);
    pennants.push(t.pennant);
  }
  // guirnaldas cruzando el camino
  const flags: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const x = -16 + i * 8;
    for (const z of [-3.2, 3.2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4, 6), std(0x5a3d25));
      pole.position.set(x, 2, z);
      group.add(pole);
    }
    const line = bunting(new THREE.Vector3(x, 3.9, -3.2), new THREE.Vector3(x, 3.9, 3.2), [0xc0392b, 0xf2c14e, 0x2e5fa8, 0xf3e3c3]);
    flags.push(...line);
    group.add(...line);
  }
  for (let i = 0; i < 8; i++) {
    const bale = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.6), std(0xd9b654));
    bale.position.set(-18 + rand() * 36, 0.3, (rand() > 0.5 ? 1 : -1) * (3 + rand() * 1.2));
    bale.rotation.y = rand() * Math.PI;
    group.add(bale);
  }
  const s = sign('FERIA MEDIEVAL', 4.2);
  s.position.set(-9, 0, -3.6);
  group.add(s);
  for (let i = 0; i < 30; i++) {
    const tr = tree(rand);
    const ang = rand() * Math.PI * 2;
    const r = 22 + rand() * 25;
    tr.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    group.add(tr);
  }
  sun(group, 0xfff0d0, 3.0, new THREE.Vector3(-0.6, 0.9, 0.5), 0xcfe4ff, 0x55683a, 1.1, 26);
  shadows(group);
  return {
    group,
    background: skyGradient(0x5f9fdc, 0xdcebf5),
    fog: new THREE.Fog(0xdcebf5, 35, 110),
    update(t) {
      pennants.forEach((p, i) => { p.rotation.y = Math.sin(t * 2 + i) * 0.4 + i; });
      flags.forEach((f, i) => { f.rotation.x = Math.sin(t * 3 + i * 0.7) * 0.25; });
    },
  };
}

function estacionamiento(): CineSet {
  const group = new THREE.Group();
  const rand = seeded(11);
  ground(group, 0x4a5a3a);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), std(0x3a3d42, { roughness: 1 }));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(0, 0.01, -2);
  lot.receiveShadow = true;
  group.add(lot);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(160, 5), std(0x2c2e33, { roughness: 1 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.015, 4.4);
  road.receiveShadow = true;
  group.add(road);
  const white = new THREE.MeshBasicMaterial({ color: 0xd8d8d0 });
  for (let i = -4; i <= 4; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5), white);
    line.rotation.x = -Math.PI / 2;
    line.position.set(i * 2.8 + 1.4, 0.02, -0.5);
    group.add(line);
  }
  for (let i = -20; i <= 20; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.12), new THREE.MeshBasicMaterial({ color: 0xe0c060 }));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(i * 4, 0.025, 4.4);
    group.add(dash);
  }
  // otros autos estacionados
  const parked = [0x3b4a5a, 0x8a8f94, 0x2f4f3a, 0x6a5a48];
  parked.forEach((c, i) => {
    const car = makeCar(c);
    car.object.position.set((i < 2 ? -1 : 1) * (5.6 + (i % 2) * 2.8) + 1.4, 0, -0.6);
    car.object.rotation.y = Math.PI;
    group.add(car.object);
  });
  // faroles
  const lamps: THREE.PointLight[] = [];
  for (const x of [-9, 9]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), std(0x33363a));
    post.position.set(x, 2.5, 1.4);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc070).multiplyScalar(3) }));
    head.position.set(x, 5, 1.4);
    const light = new THREE.PointLight(0xffb060, 25, 16, 1.6);
    light.position.set(x, 4.8, 1.4);
    lamps.push(light);
    group.add(post, head, light);
  }
  // la feria, atrás, con guirnaldas de luces
  const bulbs: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const t = tent(2, 2.4, i % 2 ? 0xc0392b : 0x2e5fa8, 0xf3e3c3, rand);
    t.group.position.set(-18 + i * 6, 0, -16 - rand() * 3);
    group.add(t.group);
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd890).multiplyScalar(4) });
  for (let i = 0; i < 40; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), bulbMat);
    const u = i / 40;
    b.position.set(-20 + u * 40, 3.6 - Math.abs(Math.sin(u * Math.PI * 4)) * 0.7, -13.5);
    bulbs.push(b);
    group.add(b);
  }
  for (let i = 0; i < 24; i++) {
    const tr = tree(rand);
    tr.position.set(-40 + rand() * 80, 0, -24 - rand() * 14);
    group.add(tr);
  }
  sun(group, 0xff9c5c, 2.2, new THREE.Vector3(0.9, 0.22, -0.6), 0x8d8fc0, 0x3a3a30, 0.7, 24);
  shadows(group);
  return {
    group,
    background: skyGradient(0x2e3f6e, 0xf0a070),
    fog: new THREE.Fog(0xe0906a, 30, 95),
    update(t) {
      bulbs.forEach((b, i) => b.scale.setScalar(0.85 + 0.25 * Math.sin(t * 3 + i * 1.7)));
    },
  };
}

function circulo(): CineSet {
  const group = new THREE.Group();
  const rand = seeded(23);
  ground(group, 0x23222a);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 0.3, 32), std(0x55525e));
  platform.position.y = 0.15;
  group.add(platform);
  // el círculo de runas: un anillo y signos dibujados, que brillan según `runes`
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  const c = 512;
  ctx.lineWidth = 10;
  for (const r of [470, 420, 250]) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = ((i + 2) / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 420, c + Math.sin(a) * 420);
    ctx.lineTo(c + Math.cos(b) * 420, c + Math.sin(b) * 420);
    ctx.stroke();
  }
  // signos entre los dos anillos de afuera
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    ctx.save();
    ctx.translate(c + Math.cos(a) * 445, c + Math.sin(a) * 445);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      ctx.moveTo((rand() - 0.5) * 30, (rand() - 0.5) * 30);
      ctx.lineTo((rand() - 0.5) * 30, (rand() - 0.5) * 30);
    }
    ctx.stroke();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  const runeMat = new THREE.MeshBasicMaterial({ map: tex, color: 0x7fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), runeMat);
  runes.rotation.x = -Math.PI / 2;
  runes.position.y = 0.32;
  group.add(runes);
  const runeLight = new THREE.PointLight(0x7fe8ff, 0, 14, 1.5);
  runeLight.position.y = 1.2;
  group.add(runeLight);
  // columnas con antorchas
  const flames: { mesh: THREE.Mesh; light: THREE.PointLight; seed: number }[] = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(4) });
  for (let i = 0; i < 6; i++) {
    // dos columnas enmarcan la loma de la horda, sin ninguna en el medio
    const a = (i / 6) * Math.PI * 2 + 11 * (Math.PI / 180);
    const x = Math.cos(a) * 7.8;
    const z = Math.sin(a) * 7.8;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.2, 8), std(0x6a6674));
    pillar.position.set(x, 1.6, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.25, 8), std(0x5a5664));
    cap.position.set(x, 3.3, z);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), flameMat);
    flame.position.set(x, 3.7, z);
    const light = new THREE.PointLight(0xff9040, 8, 12, 1.6);
    light.position.set(x, 4, z);
    flames.push({ mesh: flame, light, seed: rand() * 10 });
    group.add(pillar, cap, flame, light);
  }
  // la loma del fondo, por donde marcha la horda
  const ridge = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 16), std(0x1c1e26));
  ridge.scale.set(80, 6, 9);
  ridge.position.set(0, -2, 25);
  group.add(ridge);
  // estrellas y luna
  const starGeo = new THREE.BufferGeometry();
  const pts: number[] = [];
  for (let i = 0; i < 500; i++) {
    const a = rand() * Math.PI * 2;
    const e = 0.08 + rand() * 1.3;
    pts.push(Math.cos(a) * Math.cos(e) * 150, Math.sin(e) * 150, Math.sin(a) * Math.cos(e) * 150);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf4f0dc).multiplyScalar(0.95), fog: false }));
  // baja, detrás de la loma: la horda se recorta contra ella
  moon.position.set(-14, 12, 120);
  group.add(moon);
  sun(group, 0x9fb4ff, 1.1, new THREE.Vector3(-0.3, 0.8, 0.6), 0x3a4270, 0x1a1a22, 0.5, 14);
  shadows(group);
  return {
    group,
    background: skyGradient(0x070b1c, 0x4a3d78),
    fog: new THREE.Fog(0x2a2448, 40, 140),
    update(t, p) {
      const glow = p.runes ?? 0;
      runeMat.color.setHex(0x7fe8ff).multiplyScalar(0.25 + glow * 1.6);
      runes.rotation.z = t * 0.08;
      runeLight.intensity = glow * 4;
      for (const f of flames) {
        const k = 0.8 + 0.2 * Math.sin(t * 13 + f.seed) * Math.sin(t * 7.3 + f.seed * 2);
        f.light.intensity = 8 * k;
        f.mesh.scale.set(1, k * 1.1, 1);
      }
    },
  };
}

function negro(): CineSet {
  return { group: new THREE.Group(), background: new THREE.Color(0x000000), fog: null, update() {} };
}

export function buildSets(): Record<SetId, CineSet> {
  return { feria: feria(), estacionamiento: estacionamiento(), circulo: circulo(), negro: negro() };
}

// ---------- utilería ----------

/** Un auto de figuras simples, con la trompa hacia +z. `headlights` prende los faros; `trunk` abre el baúl. */
function makeCar(color: number): Prop {
  const g = new THREE.Group();
  const paint = std(color, { roughness: 0.4, metalness: 0.3 });
  const glass = std(0x1d2530, { roughness: 0.2, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 4.3), paint);
  body.position.y = 0.58;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.58, 2.1), glass);
  cabin.position.set(0, 1.18, -0.25);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.06, 1.9), paint);
  roof.position.set(0, 1.49, -0.25);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.2, 0.15), std(0x222222));
  bumperF.position.set(0, 0.35, 2.18);
  const bumperB = bumperF.clone();
  bumperB.position.z = -2.18;
  g.add(body, cabin, roof, bumperF, bumperB);
  const tire = std(0x151515);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
  for (const x of [-0.86, 0.86]) {
    for (const z of [-1.4, 1.4]) {
      const w = new THREE.Mesh(wheelGeo, tire);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.34, z);
      g.add(w);
    }
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x8a1010 });
  for (const x of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.05), headMat);
    h.position.set(x, 0.68, 2.16);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), tailMat);
    tl.position.set(x, 0.7, -2.16);
    g.add(h, tl);
  }
  // el baúl, con bisagra arriba, contra la luneta
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.9, -1.3);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.95), paint);
  lid.position.set(0, 0, -0.47);
  hinge.add(lid);
  g.add(hinge);
  const beams: THREE.SpotLight[] = [];
  for (const x of [-0.62, 0.62]) {
    const s = new THREE.SpotLight(0xfff0c8, 0, 40, 0.45, 0.5, 1.2);
    s.position.set(x, 0.7, 2.2);
    s.target.position.set(x * 2, 0, 14);
    g.add(s, s.target);
    beams.push(s);
  }
  shadows(g);
  return {
    object: g,
    update(_t, p) {
      const on = p.headlights ?? 0;
      headMat.color.setHex(0xfff4d0).multiplyScalar(0.6 + on * 3);
      for (const s of beams) s.intensity = on * 14;
      hinge.rotation.x = (p.trunk ?? 0) * 1.3;
    },
  };
}

/** Bolsa de golf con cuatro palos asomando. `clubGlow` los hace brillar (el encantamiento). */
function golfBag(): Prop {
  const g = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.9, 12), std(0x1f3a6b, { roughness: 0.7 }));
  bag.position.y = 0.45;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.12, 12), std(0xf3f3f3));
  band.position.y = 0.72;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 16, Math.PI), std(0x222222));
  strap.position.set(0.16, 0.5, 0);
  strap.rotation.z = -Math.PI / 2;
  g.add(bag, band, strap);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: 0.7, roughness: 0.3, emissive: 0x6fe0ff, emissiveIntensity: 0 });
  const shaftMat = std(0x9aa4b2, { metalness: 0.6, roughness: 0.3 });
  const heads: THREE.Mesh[] = [];
  [[-0.06, 0.05, 0.28], [0.07, 0.04, 0.22], [0.0, -0.07, 0.25], [-0.08, -0.04, 0.18]].forEach(([x, z, extra], i) => {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5), shaftMat);
    shaft.position.set(x, 0.9 + extra / 2, z);
    const head = new THREE.Mesh(i === 0 ? new THREE.SphereGeometry(0.075, 10, 8) : new THREE.BoxGeometry(0.1, 0.05, 0.035), headMat);
    head.position.set(x + 0.03, 1.2 + extra, z);
    if (i === 0) head.scale.set(1.2, 0.7, 1);
    heads.push(head);
    g.add(shaft, head);
  });
  const glowLight = new THREE.PointLight(0x6fe0ff, 0, 5, 1.5);
  glowLight.position.y = 1.3;
  g.add(glowLight);
  shadows(g);
  return {
    object: g,
    update(t, p) {
      const glow = p.clubGlow ?? 0;
      headMat.emissiveIntensity = glow * (2.5 + 0.6 * Math.sin(t * 6));
      glowLight.intensity = glow * 6;
    },
  };
}

export function buildProp(kind: PropKind, club: THREE.Object3D | null): Prop {
  if (kind === 'car') return makeCar(0x8c2a22);
  if (kind === 'carBlue') return makeCar(0x2d4f7a);
  if (kind === 'golfBag') return golfBag();
  // el palo de verdad (club.glb), con el mismo brillo que la bolsa cuando está encantado
  const g = new THREE.Group();
  const model = club ?? new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1).translate(0, 0, 0.5), std(0xcfd6e0));
  model.scale.setScalar(CLUB_LENGTH);
  g.add(model);
  const mats: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.emissive = new THREE.Color(0x6fe0ff);
    m.material = mat;
    m.castShadow = true;
    mats.push(mat);
  });
  const light = new THREE.PointLight(0x6fe0ff, 0, 4, 1.5);
  light.position.z = CLUB_LENGTH;
  g.add(light);
  return {
    object: g,
    update(t, p) {
      const glow = p.clubGlow ?? 0;
      for (const m of mats) m.emissiveIntensity = glow * (0.8 + 0.3 * Math.sin(t * 6));
      light.intensity = glow * 0.6;
    },
  };
}
