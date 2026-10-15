// El bestiario (bestiario.html): todos los enemigos en fila, al tamaño del juego, con los clips del juego.
// Sirve para mirar los monstruos nuevos al lado de la horda de siempre antes de mandarlos a las oleadas.
// Los modos repiten lo que hace el juego: caminar y correr a la escala de tiempo con la que los mueve
// (`setLocomotion` en enemies.ts), el golpe por código de los humanoides (el brazo derecho arriba y
// abajo) o el clip "Attack" de los bichos, y la muerte congelada al 42 % de "Hard Landing".
// "Avanzan" los hace andar de verdad a su velocidad: si los pies patinan, la escala no coincide.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ENEMIES, NEW_KINDS, type EnemyKind, type EnemyStats } from './core/waves';
import { stripRootMotion } from './game/models';
import { rotateWorld } from './game/swingPose';

const MODELS = `${import.meta.env.BASE_URL}models/`;
const $ = (id: string) => document.getElementById(id)!;

type Mode = 'Idle' | 'Walking' | 'Running' | 'Attack' | 'Death';
const MODES: [Mode, string][] = [['Idle', 'Quietos'], ['Walking', 'Caminan'], ['Running', 'Corren'], ['Attack', 'Atacan'], ['Death', 'Mueren']];

interface Actor {
  kind: EnemyKind;
  stats: EnemyStats;
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  action: THREE.AnimationAction | null;
  arm: THREE.Object3D | null;
  spine: THREE.Object3D | null;
  tag: HTMLElement;
  x: number;
  z: number;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc4e4);
scene.fog = new THREE.Fog(0x9cc4e4, 40, 90);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xe8f2ff, 0x4d5a36, 1.3));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(-8, 16, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 20, bottom: -20, near: 1, far: 60 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x5b8a40, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(240, 240, 0x4c7637, 0x4c7637);
(grid.material as THREE.Material).opacity = 0.35;
(grid.material as THREE.Material).transparent = true;
grid.position.y = 0.005;
scene.add(grid);

const loader = new GLTFLoader();
async function load(file: string): Promise<GLTF | null> {
  try {
    const gltf = await loader.loadAsync(MODELS + file);
    for (const c of gltf.animations) stripRootMotion(c, gltf.scene);
    return gltf;
  } catch {
    return null;
  }
}

const ORDER: EnemyKind[] = [...NEW_KINDS, 'goblin', 'goblina', 'orc', 'skeleton', 'warchief', 'shaman', 'knight', 'stoneling', 'wraith', 'golem'];
const files = [...new Set(ORDER.map((k) => ENEMIES[k].model ?? 'dungeon.glb'))];
const loaded = new Map(await Promise.all(files.map(async (f) => [f, await load(f)] as const)));

/** La malla del tipo, sola y a su altura del juego (como Horde.register y el constructor de Enemy). */
function makeActor(kind: EnemyKind): Actor | null {
  const stats = ENEMIES[kind];
  const gltf = loaded.get(stats.model ?? 'dungeon.glb');
  if (!gltf) return null;
  const model = cloneSkinned(gltf.scene);
  let found = false;
  const drop: THREE.Object3D[] = [];
  model.traverse((o) => {
    if (!(o as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (o.name === stats.mesh) found = true;
    else drop.push(o);
  });
  if (!found) return null;
  for (const o of drop) o.parent?.remove(o);
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    m.skeleton.update();
    m.castShadow = true;
    m.frustumCulled = false;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.metalness = 0;
    mat.roughness = 0.85;
    m.material = mat;
  });
  const box = new THREE.Box3().setFromObject(model, true);
  model.scale.setScalar(stats.height / (box.max.y - Math.min(0, box.min.y)));
  const root = new THREE.Group();
  root.add(model);
  scene.add(root);
  const tag = document.createElement('div');
  tag.className = 'tag' + ((NEW_KINDS as EnemyKind[]).includes(kind) ? ' new' : '');
  tag.innerHTML = `<b>${stats.name}</b><small>${stats.height} m · vida ${stats.hp}<br>${stats.speed} m/s${stats.runs ? ' corriendo' : ''}</small>`;
  $('labels').appendChild(tag);
  return {
    kind, stats, root, model, tag, x: 0, z: 0,
    mixer: new THREE.AnimationMixer(model),
    clips: new Map(gltf.animations.map((c) => [c.name, c])),
    action: null,
    arm: model.getObjectByName('mixamorigRightArm') ?? null,
    spine: model.getObjectByName('mixamorigSpine1') ?? null,
  };
}

const actors = ORDER.map(makeActor).filter((a): a is Actor => !!a);
const missing = ORDER.filter((k) => !actors.some((a) => a.kind === k));
if (missing.length) $('note').textContent += ` Sin modelo todavía: ${missing.map((k) => ENEMIES[k].name).join(', ')}.`;
$('loading').remove();

let mode: Mode = 'Walking';
let onlyNew = false;
let moving = false;
let clock = 0;

function layout(): void {
  const shown = actors.filter((a) => !onlyNew || (NEW_KINDS as EnemyKind[]).includes(a.kind));
  const widths = shown.map((a) => Math.max(1.6, a.stats.radius * 2.4));
  let x = -widths.reduce((s, w) => s + w, 0) / 2;
  for (const a of actors) {
    a.root.visible = shown.includes(a);
    a.tag.style.display = a.root.visible ? '' : 'none';
  }
  shown.forEach((a, i) => {
    a.x = x + widths[i] / 2;
    a.z = 0;
    x += widths[i];
  });
  fit(x * 2);
}

/** Aleja la cámara hasta que entre la fila entera a lo ancho, mirando un poco desde arriba. */
let rowWidth = 8;
function fit(width = rowWidth): void {
  rowWidth = width;
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = (Math.max(8, width) / 2 + 1.5) / (half * camera.aspect) + 2;
  camera.position.set(0, dist * 0.42, dist);
  controls.target.set(0, 1.2, 0);
  controls.update();
}

/** Escala de tiempo y velocidad como en el juego: los clips de Mixamo avanzan ~1.5 m/s caminando y ~4 corriendo a 1.8 m. */
function gait(a: Actor): { clip: string; timeScale: number; speed: number } | null {
  const stride = a.stats.height / 1.8;
  if (mode === 'Walking') {
    const speed = a.stats.runs ? Math.min(a.stats.speed, 1.6) : a.stats.speed;
    return { clip: 'Walking', timeScale: speed / (1.5 * stride), speed };
  }
  if (mode === 'Running') {
    const speed = Math.max(a.stats.speed, 3.5);
    return { clip: 'Running', timeScale: speed / (4 * stride), speed };
  }
  return null;
}

function play(a: Actor, name: string, loop: boolean): THREE.AnimationAction | null {
  const clip = a.clips.get(name);
  if (!clip) return null;
  const action = a.mixer.clipAction(clip);
  if (a.action !== action) {
    a.action?.stop();
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.play();
    a.action = action;
  }
  return action;
}

function setMode(m: Mode): void {
  mode = m;
  clock = 0;
  for (const a of actors) {
    a.action?.stop();
    a.action = null;
    a.root.position.z = 0;
  }
  paintButtons();
}

const q = new THREE.Quaternion();
const AXIS = new THREE.Vector3(1, 0, 0);
const smooth = (u: number) => u * u * (3 - 2 * u);

function update(a: Actor, dt: number): void {
  const g = gait(a);
  a.root.position.x = a.x;
  if (g) {
    const action = play(a, g.clip, true);
    if (action) action.timeScale = g.timeScale;
    if (moving) {
      a.root.position.z += g.speed * dt;
      if (a.root.position.z > 8) a.root.position.z -= 16;
    } else a.root.position.z = 0;
    a.mixer.update(dt);
    return;
  }
  a.root.position.z = 0;
  if (mode === 'Idle') {
    play(a, 'Idle', true);
    a.mixer.update(dt);
    return;
  }
  if (mode === 'Death') {
    // como el juego: a 1.3x, congelada al 42 %; un rato quieta y vuelve a empezar
    const action = play(a, 'Hard Landing', false);
    if (!action) return;
    const freeze = action.getClip().duration * 0.42;
    const t = (clock * 1.3) % (freeze + 2.5);
    action.paused = true;
    action.time = Math.min(t, freeze);
    a.mixer.update(0);
    return;
  }
  // el golpe: la preparación y el impacto del juego (startAttack), con una pausa entre golpes
  const slow = a.stats.heavy ? 1.5 : 1;
  const hitAt = 0.45 * slow;
  const cycle = hitAt + 0.45 * slow + 0.9;
  const t = clock % cycle;
  if (a.clips.has('Attack')) {
    const action = play(a, 'Attack', false)!;
    const scale = (0.45 * action.getClip().duration) / hitAt;
    action.paused = true;
    action.time = Math.min(t * scale, action.getClip().duration - 1e-3);
    a.mixer.update(0);
    return;
  }
  play(a, 'Idle', true);
  a.mixer.update(dt);
  if (!a.arm) return;
  const u = t / hitAt;
  let angle: number;
  let lean: number;
  if (u < 1) angle = -2.9 * smooth(Math.min(1, u / 0.75));
  else angle = -2.9 + 2.2 * smooth(Math.min(1, (u - 1) / 0.25));
  lean = u < 1 ? -0.18 * smooth(u) : 0.3 * smooth(Math.min(1, (u - 1) / 0.25));
  // entra y sale suave, como `gesture` en el juego
  const weight = Math.min(1, t / 0.12, Math.max(0, (cycle - 0.5 - t) / 0.3));
  a.model.updateMatrixWorld(true);
  rotateWorld(a.arm, q.setFromAxisAngle(AXIS, angle * weight));
  if (a.spine) rotateWorld(a.spine, q.setFromAxisAngle(AXIS, lean * weight));
}

const clipButtons = MODES.map(([m, label]) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = () => setMode(m);
  $('clips').appendChild(b);
  return [m, b] as const;
});
const whoButtons = ([['Nuevos', true], ['Todos', false]] as const).map(([label, value]) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = () => {
    onlyNew = value;
    layout();
    paintButtons();
  };
  $('who').appendChild(b);
  return [value, b] as const;
});
$('move').onclick = () => {
  moving = !moving;
  paintButtons();
};
function paintButtons(): void {
  for (const [m, b] of clipButtons) b.classList.toggle('on', m === mode);
  for (const [v, b] of whoButtons) b.classList.toggle('on', v === onlyNew);
  $('move').classList.toggle('on', moving);
}

const v = new THREE.Vector3();
function placeTags(): void {
  // con muchos en fila los carteles se pisan: uno sí y uno no, más abajo
  let i = 0;
  for (const a of actors) {
    if (!a.root.visible) continue;
    v.set(a.root.position.x, -0.15, a.root.position.z).project(camera);
    a.tag.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
    a.tag.style.top = `${((1 - v.y) / 2) * innerHeight + (i++ % 2) * 46}px`;
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fit();
});

onlyNew = actors.some((a) => (NEW_KINDS as EnemyKind[]).includes(a.kind));
layout();
paintButtons();
let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  for (const a of actors) if (a.root.visible) update(a, dt);
  controls.update();
  renderer.render(scene, camera);
  placeTags();
});
(window as unknown as { __bestiary: unknown }).__bestiary = { actors, setMode, missing };
