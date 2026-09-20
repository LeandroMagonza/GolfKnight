// Golf Knight: defendé la puerta de Valdehoyo a pelotazos. Prototipo jugable.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GameAudio } from './audio/audio';
import { previewPath } from './core/ballistics';
import { chargeLevel, CLUB_ORDER, CLUBS, ICE_CORE, ICE_PERFECT_AREA, ICE_RADIUS, isLob, MELEE_COOLDOWN, MELEE_DAMAGE, MELEE_KNOCKBACK, MELEE_MAX_TARGETS, MELEE_RANGE, MELEE_STAGGER, PUSH_RADIUS, rangeFor, STREAK_MAX, STREAK_PERFECT_KILL, streakBonus, type Club, type ClubId } from './core/clubs';
import { PERFECT_FROM } from './core/swing';
import { ENEMIES, unlockedAt, WaveDirector, type EnemyKind } from './core/waves';
import { Balls } from './game/balls';
import { Effects } from './game/effects';
import { Horde } from './game/enemies';
import { Tees } from './game/tees';
import { analyzeSwing, sampleHand } from './game/golfClips';
import { CLUB_LENGTH } from './game/swingPose';
import { Player } from './game/player';
import { GATE_Z, GUARD_POSTS, World } from './game/world';
import { Hud } from './hud';
import { Input } from './input';
import { Intro } from './intro';

// ---------- escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
const world = new World(scene);
const effects = new Effects(scene);
const horde = new Horde(scene);
const balls = new Balls(scene, horde, effects);
const tees = new Tees(scene);

// ---------- estado ----------
const GATE_MAX = 10;
/** Color de la línea de tiro y del anillo del cursor según el nivel de carga, 1 a 5. */
const LEVEL_COLORS = [0xffffff, 0x8be08b, 0xffe066, 0xffa53c, 0xff4a3c];
const PERFECT_COLOR = 0xfff1b8;
const hud = new Hud();
const audio = new GameAudio();
const director = new WaveDirector();
let player: Player;
let gateHp = GATE_MAX;
let score = 0;
let kills = 0;
let shots = 0;
let started = false;
let paused = false;
let ended: 'victory' | 'defeat' | null = null;
let shake = 0;
let frameTimes: number[] = [];
let lastEvent = '';
let closeup = false;
/** Hay un cartel de palo nuevo en pantalla: el juego queda frenado hasta que se lo cierre. */
let cardOpen = false;
/** Segundos de juego transcurridos (no corre en pausa). */
let gameClock = 0;
/**
 * Racha del driver. Sube con cada baja del driver (tres escalones si el swing fue perfecto), se
 * mantiene cuando el tiro daña sin matar, y se corta cuando un tiro de driver no daña a nadie: no le
 * pegó a nada, o solo a escudos e inmunes.
 */
let streak = 0;
/** Con ?palos en la URL arrancan todos los palos habilitados, para probar sin jugar las oleadas. */
const ALL_CLUBS = new URLSearchParams(location.search).has('palos');
/** Con ?bot en la URL juega solo (src/bot.ts), para mirarlo o para chequear el balance. */
const BOT = new URLSearchParams(location.search).has('bot');

/**
 * Cómo se apunta un globo (hierro y wedge). 'cursor': cae donde está el mouse y la carga solo define
 * la fuerza del efecto. 'carga': como el driver, la carga define la distancia. Se cambia con G.
 */
type LobAim = 'cursor' | 'carga';
const LOB_KEY = 'gk.globos';
let lobAim: LobAim = localStorage.getItem(LOB_KEY) === 'carga' ? 'carga' : 'cursor';

// ---------- puntería ----------
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3(0, 0, 30);
const tee = new THREE.Vector3();
const PREVIEW_POINTS = 28;
const previewGeo = new THREE.BufferGeometry();
previewGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((PREVIEW_POINTS + 1) * 3), 3));
const previewMat = new THREE.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false });
const previewLine = new THREE.Points(previewGeo, previewMat);
previewLine.frustumCulled = false;
previewLine.visible = false;
scene.add(previewLine);
const landingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const landing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), landingMat);
landing.rotation.x = -Math.PI / 2;
landing.position.y = 0.05;
landing.visible = false;
scene.add(landing);
// centro del hielo: adentro de este círculo congela, afuera solo enfría
const coreMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
const landingCore = new THREE.Mesh(new THREE.CircleGeometry(1, 32), coreMat);
landingCore.rotation.x = -Math.PI / 2;
landingCore.position.y = 0.045;
landingCore.visible = false;
scene.add(landingCore);
const teeBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 }));
teeBall.visible = false;
scene.add(teeBall);

function updateAim(): void {
  // con la cámara de depuración el mouse ya no corresponde al campo: la puntería queda como estaba
  if (closeup) return;
  raycaster.setFromCamera(new THREE.Vector2(input.pointer.x, input.pointer.y), camera);
  const hit = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  if (hit) aimPoint.copy(hit);
  else {
    // el mouse está sobre el horizonte: apunta lejos en esa dirección
    aimPoint.copy(player.position).addScaledVector(raycaster.ray.direction.clone().setY(0).normalize(), 80);
  }
  // La pelota sale desde el tee, que está a un costado del golfista y depende de hacia dónde apunta:
  // se itera un par de veces para que la línea tee -> mouse pase justo por el cursor.
  const dir = new THREE.Vector3(aimPoint.x - player.position.x, 0, aimPoint.z - player.position.z);
  if (dir.lengthSq() < 1.5) return;
  player.aimDir.copy(dir.normalize());
  for (let i = 0; i < 2; i++) {
    player.teePosition(tee);
    dir.set(aimPoint.x - tee.x, 0, aimPoint.z - tee.z);
    if (dir.lengthSq() > 0.25) player.aimDir.copy(dir.normalize());
  }
}

/** ¿Este palo cae donde está el cursor? */
function aimsAtCursor(club: Club): boolean {
  return lobAim === 'cursor' && isLob(club);
}

/**
 * Alcance del tiro: el punto del cursor para un globo apuntado con el mouse; si no, lo da la carga.
 * `reach` es la carga máxima a la que se llegó: sube hasta el tope y ahí se queda, aunque la barra de
 * potencia siga rebotando para el swing perfecto.
 */
function shotRange(club: Club, reach: number): number {
  if (!aimsAtCursor(club)) return rangeFor(club, reach);
  player.teePosition(tee);
  return THREE.MathUtils.clamp(Math.hypot(aimPoint.x - tee.x, aimPoint.z - tee.z), club.minRange, club.maxRange);
}

/** Último nivel de carga que sonó, para tocar una nota solo cuando cambia. */
let lastLevel = 0;

/** ¿El golfista está parado en un puesto que tiene pelota? */
function hasBallHere(): boolean {
  const i = tees.nearest(player.position.x);
  return Math.abs(tees.spots[i].x - player.position.x) < 0.1 && tees.hasBall(i);
}

function updatePreview(): void {
  const charging = player.mode === 'charging';
  const club = player.club;
  const cursorAim = aimsAtCursor(club);
  const range = shotRange(club, charging ? player.meter.reach : 1);
  const show = started && !ended && player.alive && player.mode !== 'swinging' && !player.grabbedBy;
  previewLine.visible = show;
  landing.visible = show && (charging || cursorAim);
  const ballHere = hasBallHere();
  teeBall.visible = show && charging && ballHere;
  landingCore.visible = landing.visible && club.enchant === 'ice';
  hud.setMeter(charging, player.meter.power, cursorAim ? `${range.toFixed(0)} m · fuerza ${Math.round(player.meter.power * 100)} %` : `${range.toFixed(0)} m`);
  const px = ((input.pointer.x + 1) / 2) * innerWidth;
  const py = ((1 - input.pointer.y) / 2) * innerHeight;
  hud.setChargeCursor(show && charging, px, py, chargeLevel(player.meter.power), player.meter.power >= PERFECT_FROM);
  if (!show) return;
  player.teePosition(tee);
  const loft = THREE.MathUtils.degToRad(club.loftDeg);
  const path = previewPath({ x: tee.x, y: 0, z: tee.z }, player.aimDir.x, player.aimDir.z, range, loft, PREVIEW_POINTS, club.gravity);
  const pos = previewGeo.attributes.position as THREE.BufferAttribute;
  path.forEach((p, i) => pos.setXYZ(i, p.x, charging ? p.y : 0.05, p.z));
  pos.needsUpdate = true;
  // La línea dice cuánto está cargado el tiro: cambia de color con cada nivel, y es dorada en el punto
  // justo del swing perfecto. Sin pelota en el puesto queda apagada.
  const level = chargeLevel(player.meter.power);
  const perfectLine = charging && player.meter.power >= PERFECT_FROM;
  previewMat.color.setHex(!ballHere ? 0x6b7480 : perfectLine ? PERFECT_COLOR : charging ? LEVEL_COLORS[level - 1] : club.color);
  previewMat.size = charging ? 4 + level : 5;
  previewMat.opacity = !ballHere ? 0.25 : charging ? 0.95 : 0.3;
  if (charging && level !== lastLevel) audio.chargeTick(level);
  lastLevel = charging ? level : 0;
  const end = path[path.length - 1];
  landing.position.set(end.x, 0.05, end.z);
  const perfectNow = charging && player.meter.power >= PERFECT_FROM;
  const wide = perfectNow ? ICE_PERFECT_AREA : 1;
  landing.scale.setScalar(club.enchant === 'ice' ? ICE_RADIUS * wide : club.enchant === 'push' ? PUSH_RADIUS : 0.7);
  landingCore.position.set(end.x, 0.045, end.z);
  landingCore.scale.setScalar(ICE_CORE * wide);
  coreMat.opacity = charging ? 0.4 : 0.18;
  landingMat.opacity = charging ? 0.85 : 0.35;
  landingMat.color.setHex(perfectNow ? 0xffd66b : club.color);
  teeBall.position.set(tee.x, 0.12, tee.z);
}

// ---------- eventos del juego ----------
function toScreen(pos: THREE.Vector3, height: number): { x: number; y: number } {
  const v = new THREE.Vector3(pos.x, pos.y + height, pos.z).project(camera);
  return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
}

function endGame(result: 'victory' | 'defeat', title: string, detail: string): void {
  if (ended) return;
  ended = result;
  player.cancelSwing();
  hud.showEnd(title, `${detail} · ${score} puntos · ${kills} bajas · ${shots} tiros`);
  if (result === 'victory') audio.victory();
  else audio.defeat();
}

horde.onEvent = (e) => {
  lastEvent = e.type;
  switch (e.type) {
    case 'damage': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, e.killed ? `${e.amount} ☠` : String(e.amount), e.killed ? 'kill' : '');
      if (e.killed) {
        kills++;
        score += e.enemy.stats.score;
      }
      break;
    }
    case 'attack':
      audio.growl();
      break;
    case 'playerHit': {
      audio.hurt();
      shake = Math.max(shake, e.enemy.grabbing ? 0.1 : 0.3);
      const s = toScreen(player.position, 2);
      hud.float(s.x, s.y, `-${e.amount}`, 'hurt');
      if (!player.alive) endGame('defeat', 'Caíste en combate', 'Valdehoyo se quedó sin golfista');
      break;
    }
    case 'gateHit':
      gateHp = Math.max(0, gateHp - e.amount);
      audio.gateHit();
      world.flashDoor();
      hud.gateAlert();
      if (gateHp <= 0) endGame('defeat', 'La puerta cayó', 'Las hordas entraron a Valdehoyo');
      break;
    case 'breach': {
      // entró por la puerta: una nube de polvo donde estaba, y el cartel del daño
      effects.explosion(new THREE.Vector3(e.enemy.position.x, 0.8, e.enemy.position.z), 1.6, 0xc9b38a);
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, `puerta -${e.enemy.stats.gateDamage}`, 'hurt');
      break;
    }
    case 'explosion':
      effects.explosion(e.pos, e.radius, 0xffa03c);
      audio.explosion();
      if (e.pos.distanceTo(player.position) < 14) shake = Math.max(shake, 0.25);
      break;
    case 'immune': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, 'inmune', 'hurt');
      break;
    }
    case 'grab':
      audio.growl();
      hud.feedback(player.unlocked.has('putter') ? '¡Te atrapó! Espacio para saltar' : '¡Te atrapó! Aguantá hasta que se canse', 'bad');
      break;
    case 'release':
      break;
    case 'rockThrown':
      audio.growl();
      break;
    case 'rockLanded':
      effects.explosion(e.pos, 2.2, 0x9a958a);
      shake = Math.max(shake, 0.15);
      break;
  }
};

balls.onEvent = (e) => {
  switch (e.type) {
    case 'hit':
      audio.thud();
      // una baja con swing perfecto vale tres escalones de racha
      if (e.killed) addStreak(e.perfect ? STREAK_PERFECT_KILL : 1);
      break;
    case 'ice':
      audio.frost();
      if (e.frozen) hud.feedback(e.chilled ? `¡Congelados ×${e.frozen}! Fríos ×${e.chilled}` : `¡Congelados ×${e.frozen}!`, 'good');
      else if (e.chilled) hud.feedback(`Fríos ×${e.chilled}`, 'neutral');
      break;
    case 'push':
      audio.explosion();
      if (e.pos.distanceTo(player.position) < 14) shake = Math.max(shake, 0.15);
      if (e.exposed && e.hits >= 1) hud.feedback(`¡Expuestos ×${e.hits}! Reciben más daño`, 'good');
      else if (e.hits >= 3) hud.feedback(`¡Vendaval! ×${e.hits}`, 'good');
      break;
    case 'bounce':
      audio.bounce();
      break;
    case 'blocked': {
      audio.bounce();
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, e.warded ? 'inmune' : '¡Bloqueado!', 'hurt');
      break;
    }
    case 'settled':
      // pegar sin matar mantiene la racha; un tiro que no dañó a nadie la corta
      if (e.hits === 0 && streak > 0) {
        streak = 0;
        hud.feedback('Racha perdida', 'bad');
      }
      break;
  }
};

function addStreak(n: number): void {
  const before = streak;
  streak = Math.min(STREAK_MAX, streak + n);
  if (streak === STREAK_MAX && before < STREAK_MAX) hud.feedback('¡Racha al máximo!', 'good');
}

function selectClub(index: number): void {
  if (cardOpen) return;
  if (!player || index < 0 || index >= CLUB_ORDER.length) return;
  const club = CLUBS[CLUB_ORDER[index]];
  if (!player.unlocked.has(club.id)) {
    hud.feedback(`${club.name}: todavía no lo tenés`, 'neutral');
    return;
  }
  // en medio de un tiro queda en cola; el HUD se pone al día en el bucle, cuando el cambio entra
  player.setClub(club);
}

/**
 * Espacio: el putter. Teletransporta al puesto más cercano al cursor. Tiene recarga, y es la única
 * salida cuando un alma en pena lo tiene agarrado.
 */
function usePutter(): void {
  if (!player.alive) return;
  if (!player.unlocked.has('putter')) {
    hud.feedback('El putter llega más adelante', 'neutral');
    return;
  }
  if (!player.portalReady) {
    hud.feedback(`Portal recargando: ${Math.ceil(player.cooldowns.putter)} s`, 'neutral');
    return;
  }
  const to = tees.nearest(aimPoint.x);
  if (to === tees.nearest(player.position.x) && !player.grabbedBy) return;
  const from = player.position.clone();
  if (!player.teleport(to)) return;
  effects.blink(from, CLUBS.putter.color);
  effects.blink(player.position, CLUBS.putter.color);
  audio.zap();
}

/**
 * Si la oleada que viene estrena un palo, lo habilita ya y muestra el cartel. El juego queda frenado
 * hasta que se lo cierre con un click, pero el descanso entre oleadas sigue corriendo: si se leyó con
 * calma, la oleada arranca apenas se cierra.
 */
function offerUnlock(): boolean {
  const id = director.nextUnlock;
  if (!id || player.unlocked.has(id)) return false;
  player.unlocked.add(id);
  player.cancelSwing();
  cardOpen = true;
  const club = CLUBS[id];
  hud.showCard({
    name: club.name,
    title: club.title,
    key: id === 'putter' ? 'Espacio' : String(CLUB_ORDER.indexOf(id) + 1),
    hint: club.hint,
    cooldown: club.cooldown,
    color: club.color,
    next: director.nextTitle,
  });
  return true;
}

function dismissCard(): void {
  if (!cardOpen) return;
  cardOpen = false;
  hud.hideCard();
}

function toggleLobAim(): void {
  lobAim = lobAim === 'cursor' ? 'carga' : 'cursor';
  localStorage.setItem(LOB_KEY, lobAim);
  hud.setLobAim(lobAim);
  hud.feedback(lobAim === 'cursor' ? 'Globos: caen donde está el cursor' : 'Globos: la carga es la distancia', 'neutral');
}

async function startGame(): Promise<void> {
  if (started) return;
  started = true;
  await audio.start();
  audio.startMusic();
  overlay.hidden = true;
  if (BOT) {
    const { startBot } = await import('./bot');
    startBot();
    hud.feedback('Juega el bot', 'neutral');
  }
}

function togglePause(): void {
  if (!started || ended) return;
  paused = !paused;
  player.cancelSwing();
  hud.setPause(paused);
  if (paused) audio.pause();
  else audio.resume();
}

const input = new Input({
  swingStart() {
    if (started && !paused && !ended && !cardOpen) player.startSwing();
  },
  swingRelease() {
    if (started && !paused && !ended && player.mode === 'charging') {
      audio.whoosh(player.meter.power);
      player.releaseSwing();
    }
  },
  swingCancel() {
    player?.cancelSwing();
  },
  selectClub,
  cycleClub(delta) {
    if (!player) return;
    // la rueda avanza desde el palo en cola, si hay uno, para poder pasar de largo; saltea los que faltan
    const order = CLUB_ORDER.filter((id) => player.unlocked.has(id));
    if (order.length < 2) return;
    const i = order.indexOf((player.pendingClub ?? player.club).id);
    player.setClub(CLUBS[order[(i + delta + order.length) % order.length]]);
  },
  space() {
    if (!started) intro.advance();
    else if (cardOpen) dismissCard();
    else if (!paused && !ended) usePutter();
  },
  lobAim() {
    if (started && !paused) toggleLobAim();
  },
  step(right) {
    if (started && !paused && !ended && !cardOpen && player) player.step(-right);
  },
  melee() {
    if (!started || paused || ended || cardOpen || !player) return;
    if (player.meleeCooldown > 0) hud.feedback(`Palazo recargando: ${player.meleeCooldown.toFixed(1)} s`, 'neutral');
    else player.startMelee();
  },
  restart() {
    if (started) location.reload();
  },
  pause: togglePause,
  muteToggle() {
    if (audio.ready) audio.toggleMute();
  },
  skin() {
    if (!paused) void cycleSkin();
  },
}, renderer.domElement);

// ---------- carga ----------
const loader = new GLTFLoader();

/**
 * Los clips de Mixamo desplazan la cadera; el movimiento lo maneja el juego. Se fija la posición
 * horizontal de la cadera (en espacio mundo, porque el nodo Armature viene rotado) en su valor inicial.
 */
function stripRootMotion(clip: THREE.AnimationClip, root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  for (const t of clip.tracks) {
    if (!t.name.endsWith('Hips.position')) continue;
    const node = root.getObjectByName(t.name.slice(0, -'.position'.length));
    const q = new THREE.Quaternion();
    (node?.parent ?? root).getWorldQuaternion(q);
    const inv = q.clone().invert();
    const v = t.values;
    const first = new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(q);
    const p = new THREE.Vector3();
    for (let i = 0; i < v.length; i += 3) {
      p.set(v[i], v[i + 1], v[i + 2]).applyQuaternion(q);
      p.x = first.x;
      p.z = first.z;
      p.applyQuaternion(inv);
      v[i] = p.x;
      v[i + 1] = p.y;
      v[i + 2] = p.z;
    }
  }
}

const measured: Record<string, number> = {};
let playerClips: THREE.AnimationClip[] = [];

// ---------- skins del golfista ----------
interface Skin {
  id: string;
  name: string;
  url: string;
  /** Malla a conservar cuando el GLB trae varios personajes sobre un mismo esqueleto. */
  mesh?: string;
}

/** Los modelos se piden relativos a la base del sitio, para que el juego ande publicado en una subcarpeta. */
const MODELS = `${import.meta.env.BASE_URL}models/`;

const SKINS: Skin[] = [
  { id: 'guard2', name: 'Guardia del castillo', url: `${MODELS}player.glb` },
  { id: 'guard3', name: 'Guardia veterano', url: `${MODELS}player-guard3.glb` },
  { id: 'knight', name: 'Caballero', url: `${MODELS}dungeon.glb`, mesh: 'Character_Hero_Knight_Male' },
  { id: 'knightF', name: 'Caballera', url: `${MODELS}dungeon.glb`, mesh: 'Character_Hero_Knight_Female' },
];
const SKIN_KEY = 'gk.skin';
const PLAYER_HEIGHT = 1.75;
const gltfCache = new Map<string, Promise<GLTF>>();
let clubModel: THREE.Object3D | null = null;
let skinIndex = Math.max(0, SKINS.findIndex((s) => s.id === localStorage.getItem(SKIN_KEY)));

/**
 * Todos los modelos animados entran por acá, y acá se les saca el desplazamiento de la cadera a
 * todos los clips: el movimiento lo maneja el juego. Si un clip lo conserva, el personaje avanza
 * dentro de la animación y pega un salto para atrás cuando el clip termina o reinicia el ciclo.
 * Vale también para los swings de golf, que corren la cadera unos 18 cm hacia el objetivo.
 */
function loadGltf(url: string): Promise<GLTF> {
  let p = gltfCache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((gltf) => {
      for (const c of gltf.animations) stripRootMotion(c, gltf.scene);
      return gltf;
    });
    gltfCache.set(url, p);
  }
  return p;
}

/** Deja en `root` solo la malla pedida (los GLB de PolygonDungeon traen los 16 personajes juntos). */
function keepOnlyMesh(root: THREE.Object3D, mesh: string): void {
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.name !== mesh) drop.push(o);
  });
  for (const o of drop) o.parent?.remove(o);
}

function skinnedHeight(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) sm.skeleton.update();
  });
  const box = new THREE.Box3().setFromObject(root, true);
  return box.max.y - Math.min(0, box.min.y);
}

async function makePlayer(skin: Skin): Promise<Player> {
  const gltf = await loadGltf(skin.url);
  const model = cloneSkinned(gltf.scene);
  if (skin.mesh) keepOnlyMesh(model, skin.mesh);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    // material propio: el parpadeo al recibir daño no tiene que teñir a los enemigos que comparten el GLB
    mesh.material = (mesh.material as THREE.Material).clone();
  });
  // El modelo va dentro de un grupo sin escala: el juego mueve el grupo, y todo lo que se mide en
  // "espacio del personaje" (tee, manos) queda en metros aunque el modelo venga en otra escala.
  model.scale.multiplyScalar(PLAYER_HEIGHT / skinnedHeight(model));
  const root = new THREE.Group();
  root.add(model);
  scene.add(root);
  playerClips = gltf.animations;
  const p = new Player(root, gltf.animations, scene, clubModel ? clubModel.clone() : null);
  if (ALL_CLUBS) for (const id of Object.keys(CLUBS) as ClubId[]) p.unlocked.add(id);
  p.spotXs = tees.spots.map((s) => s.x);
  p.canFire = () => {
    const i = tees.nearest(p.position.x);
    return Math.abs(tees.spots[i].x - p.position.x) < 0.1 && tees.take(i);
  };
  p.onWhiff = () => {
    audio.whoosh(0.3);
    hud.feedback('¡Sin pelota! Movete con A / D', 'bad');
  };
  p.onDenied = (club) => hud.feedback(`${club.name} recargando: ${p.cooldowns[club.id].toFixed(1)} s`, 'neutral');
  p.onShot = (shot) => {
    shots++;
    audio.tock(shot.perfect);
    if (shot.perfect) hud.feedback('¡Swing perfecto!', 'good');
    balls.fire(shot, shotRange(shot.club, shot.reach), shot.club.enchant === 'pierce' ? streakBonus(streak) : 1);
  };
  // Palazo: botón aparte, con recarga. Pega alrededor de un punto un paso adelante del golfista, hacia
  // donde apunta. No toca la racha del driver, ni para bien ni para mal.
  p.onMelee = () => {
    const center = p.position.clone().addScaledVector(p.aimDir, 1);
    const targets = horde.nearest(center, MELEE_RANGE, new Set(), MELEE_MAX_TARGETS);
    effects.swipe(center, MELEE_RANGE);
    audio.whoosh(0.9);
    const dir = new THREE.Vector3();
    for (const e of targets) {
      dir.set(e.position.x - p.position.x, 0, e.position.z - p.position.z).normalize();
      horde.damage(e, MELEE_DAMAGE, dir, MELEE_KNOCKBACK);
      // es el botón de sacárselos de encima: además de dañar, les corta el ataque
      e.stagger(MELEE_STAGGER);
    }
    if (targets.length) {
      audio.thud();
      shake = Math.max(shake, 0.12);
      hud.feedback(targets.length > 1 ? `¡Palazo! ×${targets.length}` : '¡Palazo!', 'neutral');
    }
  };
  return p;
}

let swappingSkin = false;

/** Cambia el modelo del golfista sin tocar la partida: misma posición, vida y palo. */
async function cycleSkin(delta = 1): Promise<void> {
  if (!player || swappingSkin || player.mode !== 'free' || player.grabbedBy || !player.alive) return;
  swappingSkin = true;
  try {
    const next = (skinIndex + delta + SKINS.length) % SKINS.length;
    const fresh = await makePlayer(SKINS[next]);
    fresh.placeAt(player.spotIndex);
    fresh.position.copy(player.position);
    fresh.hp = player.hp;
    for (const id of player.unlocked) fresh.unlocked.add(id);
    Object.assign(fresh.cooldowns, player.cooldowns);
    fresh.meleeCooldown = player.meleeCooldown;
    fresh.setClub(player.club);
    fresh.aimDir.copy(player.aimDir);
    player.dispose(scene);
    player = fresh;
    skinIndex = next;
    localStorage.setItem(SKIN_KEY, SKINS[next].id);
    hud.setSkin(SKINS[next].name);
    player.update(0, 0);
  } catch (e) {
    console.error('no se pudo cargar el skin', e);
  } finally {
    swappingSkin = false;
  }
}

async function loadModels(): Promise<void> {
  const kinds = Object.keys(ENEMIES) as EnemyKind[];
  // el palo y los guardias son opcionales: si faltan, el juego sigue con el palo de primitivas y sin guardias
  const optional = (url: string) => loader.loadAsync(url).catch(() => null);
  const [clubGltf, guardGltf, dungeon] = await Promise.all([optional(`${MODELS}club.glb`), loadGltf(`${MODELS}guard.glb`).catch(() => null), loadGltf(`${MODELS}dungeon.glb`)]);
  clubModel = clubGltf?.scene ?? null;
  player = await makePlayer(SKINS[skinIndex]).catch(() => {
    // si el skin guardado ya no existe, vuelve al primero
    skinIndex = 0;
    return makePlayer(SKINS[0]);
  });
  player.placeAt(tees.centerIndex);
  // arranca con una pelota a los pies y dos a los costados
  for (const d of [0, -2, 2]) tees.place(tees.centerIndex + d);
  if (guardGltf) {
    world.addGuards(scene, guardGltf);
    tees.guards = GUARD_POSTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  }
  for (const k of kinds) measured[k] = +horde.register(k, dungeon).toFixed(3);
  hud.setClub(player.club);
  hud.setSkin(SKINS[skinIndex].name);
  hud.onSkinClick = () => void cycleSkin();
  hud.setLobAim(lobAim);
  hud.onCardDismiss = dismissCard;
  hud.onLobAimClick = () => {
    if (started && !paused) toggleLobAim();
  };
  player.update(0, 0);
}

// ---------- inicio ----------
const overlay = document.getElementById('overlay')!;
const intro = new Intro(() => void startGame());
loadModels().then(() => intro.setReady()).catch((e) => {
  console.error(e);
  intro.setError('Error cargando modelos');
});

// ---------- bucle ----------
const timer = new THREE.Timer();
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camLookNow = new THREE.Vector3(0, 0, 18);
camera.position.set(0, 11, -2);

function updateCamera(dt: number): void {
  // cámara fija en orientación: detrás y arriba del golfista, mirando hacia donde viene la horda
  if (closeup) {
    // vista de depuración: de frente al golfista, para revisar la pose del swing
    // desde el lado de la pelota (hacia donde mira el cuerpo en la postura) y un poco desde adelante
    const f = player.teePosition(new THREE.Vector3()).sub(player.position).setY(0).normalize();
    const a = player.aimDir;
    camera.position.set(player.position.x + f.x * 3.2 + a.x * 1.6, 1.4, player.position.z + f.z * 3.2 + a.z * 1.6);
    camera.lookAt(player.position.x + f.x * 0.6, 0.8, player.position.z + f.z * 0.6);
    return;
  }
  // nunca se mete detrás de la muralla: cerca de la puerta mira más desde arriba
  const x = player.position.x * 0.75;
  camPos.set(x, 10, Math.max(player.position.z - 10.5, GATE_Z - 0.5));
  camLook.set(x, 0, player.position.z + 5.5);
  const k = 1 - Math.exp(-5 * dt);
  camera.position.lerp(camPos, k);
  camLookNow.lerp(camLook, k);
  camera.lookAt(camLookNow);
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camera.position.x += (Math.random() - 0.5) * shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * shake * 0.5;
  }
}

function updateWaves(dt: number): void {
  for (const e of director.update(dt, horde.aliveCount)) {
    switch (e.type) {
      case 'wave': {
        audio.waveHorn();
        // cada oleada estrena, como mucho, un palo: el que resuelve al enemigo nuevo
        // el palo nuevo ya se presentó con su cartel al terminar la oleada anterior; esto es la red de seguridad
        for (const id of unlockedAt(e.index)) player.unlocked.add(id);
        hud.showBanner(`Oleada ${e.index + 1}`, e.wave.title);
        break;
      }
      case 'spawn':
        horde.spawn(e.kind);
        if (e.kind === 'golem') hud.showBanner('¡El Gólem de roca!', 'Tira piedras a la puerta. El hielo no lo congela, pero lo frena');
        else if (e.kind === 'shaman') hud.feedback('¡Chamán! Los que tiene cerca son inmunes: apagalo con hielo', 'bad');
        else if (e.kind === 'wraith') hud.feedback('¡Alma en pena! Si te atrapa, saltá con el putter', 'bad');
        break;
      case 'cleared':
        if (e.index + 1 < director.waveCount) {
          player.heal(1);
          gateHp = Math.min(GATE_MAX, gateHp + 2);
          if (!offerUnlock()) hud.showBanner('¡Oleada despejada!', 'Los albañiles remiendan la puerta · recuperás el aliento', 2.5);
        }
        break;
      case 'victory':
        endGame('victory', '¡Valdehoyo resiste!', 'La profecía se cumplió… con un hierro 7');
        break;
    }
  }
}

function frame(): void {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const nowMs = performance.now();
  frameTimes.push(nowMs);
  if (frameTimes.length > 240) frameTimes = frameTimes.filter((t) => nowMs - t < 1000);
  if (player && cardOpen && !paused) director.wait(dt);
  if (player && !paused && !cardOpen) {
    // la cámara no rota: la derecha de la pantalla es -X, o sea el puesto anterior
    const hold = -input.move.right;

    if (started) gameClock += dt;
    updateAim();
    const active = started && !ended;
    player.update(dt, active ? hold : 0);
    if (active) updateWaves(dt);
    if (started) {
      horde.update(dt, player);
      balls.update(dt);
      const stance = player.mode === 'charging' || player.mode === 'swinging';
      tees.update(dt, player.spotIndex, stance && player.atSpot ? player.spotIndex : -1);
    }
    effects.update(dt);
    world.update(dt);
    updateCamera(dt);
    updatePreview();

    hud.setClub(player.club, player.pendingClub);
    hud.setClubState(player.unlocked, player.cooldowns, player.meleeCooldown);
    hud.setStreak(streak, streakBonus(streak));
    hud.setBars(gateHp, GATE_MAX, player.hp, player.maxHp);
    hud.setWave(director.index, director.waveCount, horde.aliveCount, director.pending, director.restLeft);
    hud.setScore(score, kills);
  }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Para inspección automática (Playwright) y debugging en consola.
(window as any).__gk = {
  get player() { return player; },
  get horde() { return horde; },
  get balls() { return balls; },
  get director() { return director; },
  get gateHp() { return gateHp; },
  set gateHp(v: number) { gateHp = v; },
  get score() { return score; },
  get kills() { return kills; },
  get shots() { return shots; },
  get ended() { return ended; },
  get paused() { return paused; },
  get lastEvent() { return lastEvent; },
  set closeup(v: boolean) { closeup = v; },
  get measured() { return measured; },
  get aim() { return [aimPoint.x, aimPoint.z].map((v) => +v.toFixed(2)); },
  get fps() { const t = performance.now(); return frameTimes.filter((x) => t - x < 1000).length; },
  /** Píxel de pantalla que corresponde a un punto del piso, para apuntar con el mouse en los tests. */
  screenOf(x: number, z: number) { return toScreen(new THREE.Vector3(x, 0, z), 0); },
  spawn(kind: EnemyKind, x: number, z: number) { return horde.spawn(kind, new THREE.Vector3(x, 0, z)); },
  /** Tiro con el alcance exacto en metros (sin depender del timing del test). Apunta donde esté el mouse. */
  shoot(meters: number) {
    const c = player.club;
    player.startSwing();
    player.meter.setPower((meters - c.minRange) / (c.maxRange - c.minRange));
    player.releaseSwing();
  },
  /** Tiro con una potencia exacta 0..1 (un globo apuntado con el cursor cae donde esté el mouse). */
  shootPower(power: number) {
    player.startSwing();
    player.meter.setPower(power);
    player.releaseSwing();
  },
  get streak() { return streak; },
  get cardOpen() { return cardOpen; },
  offerUnlock,
  dismissCard,
  get clock() { return gameClock; },
  /** Desde dónde sale la pelota ahora mismo. */
  get tee() { player.teePosition(tee); return [tee.x, tee.z]; },
  get tees() { return tees; },
  get lobAim() { return lobAim; },
  set lobAim(v: LobAim) { lobAim = v; hud.setLobAim(v); },
  usePutter,
  unlockAll() { for (const id of Object.keys(CLUBS) as ClubId[]) player.unlocked.add(id); },
  /** Recorrido de la mano derecha en un clip y sus fases, para revisar los clips de golf. */
  sampleClip(name: string, hz = 20) {
    const clip = playerClips.find((c) => c.name === name);
    return clip ? sampleHand(player.root, clip, hz).map((s) => [s.t, s.x, s.y, s.z].map((v) => +v.toFixed(2))) : null;
  },
  /**
   * Cuánto se va la cadera en horizontal en cada clip (metros): desvío máximo respecto del primer
   * cuadro y diferencia entre el último y el primero. Sirve para cazar root motion sin sacar.
   */
  hipsDrift(who: 'player' | 'enemy' = 'player', bone = 'mixamorigHips') {
    const enemy = horde.enemies.find((e) => e.alive);
    const root = who === 'player' ? player.root : enemy?.group;
    const clips = who === 'player' ? playerClips : enemy?.animator.clipList ?? [];
    if (!root) return null;
    const out: Record<string, { max: number; end: number }> = {};
    for (const clip of clips) {
      const s = sampleHand(root, clip, 30, bone);
      if (!s.length) continue;
      const d = (p: { x: number; z: number }) => Math.hypot(p.x - s[0].x, p.z - s[0].z);
      out[clip.name] = { max: +Math.max(...s.map(d)).toFixed(3), end: +d(s[s.length - 1]).toFixed(3) };
    }
    return out;
  },
  analyzeClip(name: string) {
    const clip = playerClips.find((c) => c.name === name);
    return clip ? analyzeSwing(player.root, clip, CLUB_LENGTH) : null;
  },
  /** Distancia del tee al punto apuntado. */
  get aimDistance() { return Math.hypot(aimPoint.x - tee.x, aimPoint.z - tee.z); },
  GATE_Z,
};