// Golf Knight: defendé la puerta de Valdehoyo a pelotazos. Prototipo jugable.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GameAudio } from './audio/audio';
import { BALL_RADIUS, GRAVITY, launchSpeed, launchWith, previewOver, previewPath } from './core/ballistics';
import { heightAt, pickCourse, raycastTerrain, relief } from './core/terrain';
import { areaDamageFor, bandOf, BAND_NAMES, CLUB_ORDER, CLUBS, damageFor, ENCHANT_KEYS, ENCHANT_ORDER, hasArea, ironMode, setIronMode, spreadFor, ENCHANTS, isLob, MELEE_COOLDOWN, MELEE_KNOCKBACK, MELEE_MAX_TARGETS, MELEE_RANGE, MELEE_STAGGER, PUSH_LINE_HALF_WIDTH, QUALITY_AREA, QUALITY_LEVELS, qualityOf, RESERVE, type Club, type ClubId, type Enchant, type EnchantId } from './core/clubs';
import { PERFECT_FROM } from './core/swing';
import { ENEMIES, unlockedAt, WaveDirector, type EnemyKind } from './core/waves';
import { Balls } from './game/balls';
import { Effects } from './game/effects';
import { Horde } from './game/enemies';
import { TEE_Z, Tees } from './game/tees';
import { Traps } from './game/traps';
import { analyzeSwing, sampleHand } from './game/golfClips';
import { CLUB_LENGTH } from './game/swingPose';
import { Player } from './game/player';
import { GATE_Z, GUARD_POSTS, WALL_FRONT_Z, World } from './game/world';
import { DebugPanel, loadBalance } from './debug';
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
// El campo de esta partida sale de core/terrain: ?campo=N fuerza uno y ?plano deja el campo liso. Tiene
// que decidirse antes de armar el mundo, porque la malla del terreno se construye una sola vez.
const params = new URLSearchParams(location.search);
const gameCourse = pickCourse(params.has('plano') ? 'plano' : params.get('campo'));
// el balance ajustado en el panel vuelve al recargar: cambiar de campo recarga la página, así que sin
// esto se perdía todo lo tocado. Tiene que aplicarse antes de armar el mundo (las bandas se dibujan)
const savedBalance = loadBalance();
const world = new World(scene);
const effects = new Effects(scene);
const horde = new Horde(scene);
const balls = new Balls(scene, horde, effects);
const tees = new Tees(scene);
const traps = new Traps(scene, horde, effects);
balls.traps = traps;

// ---------- estado ----------
const GATE_MAX = 10;
/** Color de la línea de tiro según la calidad del golpe: flojo, bueno y perfecto. */
const QUALITY_COLORS = [0xffffff, 0xffe066, 0xff2d3c];
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
/** Dónde abrió su área el último tiro y a cuántos agarró: [x, z, alcanzados]. Solo para las pruebas. */
let lastLanding: [number, number, number] | null = null;
let closeup = false;
/** Hay un cartel de palo nuevo en pantalla: el juego queda frenado hasta que se lo cierre. */
let cardOpen = false;
/** Segundos de juego transcurridos (no corre en pausa). */
let gameClock = 0;
/** Con ?palos en la URL arrancan todos los palos habilitados, para probar sin jugar las oleadas. */
const ALL_CLUBS = params.has('palos');
/** Con ?bot en la URL juega solo (src/bot.ts), para mirarlo o para chequear el balance. */
const BOT = params.has('bot');
/** Trucos del panel de balance: el golfista o la puerta no reciben daño. */
const godMode = { godPlayer: false, godGate: false };
/** Tipos de enemigo apagados desde el panel: las oleadas los saltean. */
const disabledKinds = new Set<EnemyKind>((savedBalance.disabled ?? []) as EnemyKind[]);
/**
 * Pelotas de reserva (tecla S). Arranca con el cargador lleno y se repone de a una; los números están
 * en core/clubs y se tocan en el panel de balance. `timer` cuenta hacia la próxima carga.
 */
const reserve = { charges: RESERVE.max, timer: 0 };

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
// zona del wedge: un rectángulo con una raya en el medio, que es desde donde barre hacia cada costado
const sweepMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
const sweepEdgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
const sweepBox = new THREE.Group();
sweepBox.add(
  new THREE.Mesh(new THREE.PlaneGeometry(2, 2), sweepMat),
  new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2, 2)), sweepEdgeMat),
  new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0)]), sweepEdgeMat),
);
sweepBox.rotation.x = -Math.PI / 2;
sweepBox.visible = false;
scene.add(sweepBox);
// sobre una pendiente las marcas del piso, que son planas, se hundirían en el terreno: con relieve se
// dibujan siempre por encima
if (relief.on) for (const m of [landingMat, sweepMat, sweepEdgeMat]) m.depthTest = false;
const teeBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 }));
teeBall.visible = false;
scene.add(teeBall);

function updateAim(): void {
  // con la cámara de depuración el mouse ya no corresponde al campo: la puntería queda como estaba
  if (closeup) return;
  raycaster.setFromCamera(new THREE.Vector2(input.pointer.x, input.pointer.y), camera);
  // El punto apuntado sale de cortar el rayo con **el plano a la altura del terreno de ahí**, y se
  // itera un par de veces para que converja. No se usa el choque contra el terreno: ese se traba en la
  // cara de una loma y, al pasarla, el cursor pegaba un salto de varios metros.
  const hit = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  if (hit) {
    if (relief.on) {
      for (let i = 0; i < 3; i++) {
        groundPlane.constant = -heightAt(hit.x, hit.z);
        if (!raycaster.ray.intersectPlane(groundPlane, hit)) break;
      }
      groundPlane.constant = 0;
      hit.y = 0;
    }
    aimPoint.copy(hit);
  }
  else {
    // el mouse está sobre el horizonte: apunta lejos en esa dirección
    aimPoint.copy(player.position).addScaledVector(raycaster.ray.direction.clone().setY(0).normalize(), 80);
  }
  // La pelota está quieta en el puesto y el que se acomoda alrededor es el golfista, así que la línea
  // del tiro es, simplemente, de la pelota al cursor. No se tira para atrás: hay un arco de 180 grados,
  // de costado a costado.
  player.teePosition(tee);
  aimPoint.z = Math.max(aimPoint.z, tee.z);
  const dir = new THREE.Vector3(aimPoint.x - tee.x, 0, aimPoint.z - tee.z);
  // muy encima de la pelota no hay dirección que valga: se deja la última
  if (dir.lengthSq() < 0.09) return;
  player.aimDir.copy(dir.normalize());
}

/**
 * Alcance del tiro: **siempre lo da el mouse**, para todos los palos. La barra ya no tiene nada que
 * ver con la distancia; solo dice qué tan bien se le pegó.
 */
function shotRange(club: Club): number {
  // con distancia fija el mouse decide solo la dirección: el tiro siempre llega igual de lejos. El
  // putter lo necesita porque, apuntando cerca del enemigo, la pelota frenaba antes de llegar
  if (club.fixedRange > 0) return THREE.MathUtils.clamp(club.fixedRange, club.minRange, club.maxRange);
  player.teePosition(tee);
  return THREE.MathUtils.clamp(Math.hypot(aimPoint.x - tee.x, aimPoint.z - tee.z), club.minRange, club.maxRange);
}

/**
 * Con relieve, cómo sale el tiro: el driver se inclina lo que sube o baja el terreno hasta el cursor, y
 * los globos se calculan para caer en el punto aunque esté más alto o más bajo. Sobre piso plano
 * devuelve null y la pelota vuela como siempre.
 */
const MAX_PITCH = 0.21;
/** Cuánto tiene que levantarse el terreno para que el tiro rasante lo esquive, en metros. */
const RISE_BLOCKS = 0.6;
function shotLift(club: Club, range: number): { speed: number; angle: number } | null {
  if (!relief.on || club.loftDeg <= 0.001) return null;
  const angle = THREE.MathUtils.degToRad(club.loftDeg);
  player.teePosition(tee);
  const teeH = heightAt(tee.x, tee.z);
  if (isLob(club)) {
    const rise = heightAt(tee.x + player.aimDir.x * range, tee.z + player.aimDir.z * range) - teeH;
    return { speed: launchSpeed(range, angle, club.gravity, rise), angle };
  }
  // El tiro rasante se inclina hacia **lo más alto que se cruza en el camino**, no hacia la altura del
  // cursor. Si no, apuntando detrás de una loma el tiro bajaba y se clavaba más abajo en la misma loma:
  // la marca del piso, en vez de quedarse en la cima, se volvía para adelante.
  //
  // Todo se mide sobre el tiro que va a salir, hasta `range`, no hasta donde está el cursor. Con
  // distancia fija no son lo mismo: acercando el mouse al golfista cambiaba la trayectoria de un tiro
  // que igual salía a 55 m, porque leía el terreno abajo del cursor en vez del que se va a cruzar.
  const dist = Math.max(1, range);
  const endX = tee.x + player.aimDir.x * dist;
  const endZ = tee.z + player.aimDir.z * dist;
  let pitch = Math.atan2(heightAt(endX, endZ) - teeH, dist);
  for (let s = 4; s < dist; s += 1) {
    const h = heightAt(tee.x + player.aimDir.x * s, tee.z + player.aimDir.z * s);
    // solo cuentan las lomas de verdad: un desnivel chico no tapa nada, y si contara, apuntar al fondo
    // de un valle levantaría el tiro y les pasaría por encima a los que están abajo
    if (h - teeH < RISE_BLOCKS) continue;
    pitch = Math.max(pitch, Math.atan2(h - teeH, s));
  }
  return { speed: launchSpeed(range, angle, club.gravity), angle: angle + THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH) };
}

/** Último nivel de carga que sonó,/** Último nivel de carga que sonó,/** Último nivel de carga que sonó, para tocar una nota solo cuando cambia. */
let lastLevel = 0;

/** Último nivel de calidad que sonó. */
let lastQuality = 0;

/** ¿El golfista está parado en un puesto que tiene pelota? */
function hasBallHere(): boolean {
  const i = tees.nearest(player.anchor.x);
  return Math.abs(tees.spots[i].x - player.anchor.x) < 0.1 && tees.hasBall(i);
}

/**
 * S: saca una pelota de la reserva y la apoya en el puesto donde está parado. Es la salida para cuando
 * los guardias las tiran todas lejos y te toca mirar cómo llega la horda sin nada que pegarle. Se
 * recarga sola, de a una, y guarda pocas: es un respiro, no una fuente infinita.
 */
function dropBall(): void {
  if (!started || paused || ended || cardOpen || !player?.alive) return;
  const i = tees.nearest(player.anchor.x);
  if (Math.abs(tees.spots[i].x - player.anchor.x) >= 0.1) {
    hud.feedback('Llegá al puesto primero', 'neutral');
    return;
  }
  if (tees.hasBall(i)) {
    hud.feedback('Acá ya hay pelota', 'neutral');
    return;
  }
  if (reserve.charges <= 0) {
    hud.feedback(`Reserva: ${Math.ceil(RESERVE.cooldown - reserve.timer)} s para la próxima`, 'neutral');
    return;
  }
  reserve.charges--;
  tees.place(i);
  audio.bounce();
  hud.feedback(reserve.charges ? `Pelota de la reserva · queda ${reserve.charges}` : 'Última pelota de la reserva', 'good');
}

/**
 * La punta de la línea de tiro lleva el ícono del **poder**, y solo de los poderes que tienen uno (ver
 * `Enchant.icon`): el golpe y el vendaval no dibujan nada. El del palo no va nunca, que tapaba justo el
 * punto al que se apunta. Va chico y levantado sobre el punto de caída, que queda libre.
 */
const tipTextures = new Map<EnchantId, THREE.CanvasTexture>();
function tipTexture(enchant: Enchant): THREE.CanvasTexture {
  let tex = tipTextures.get(enchant.id);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(64, 64, 46, 0, Math.PI * 2);
  ctx.fillStyle = '#' + enchant.color.toString(16).padStart(6, '0');
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(8, 12, 18, 0.85)';
  ctx.stroke();
  ctx.fillStyle = '#10161d';
  ctx.font = 'bold 62px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(enchant.icon, 64, 68);
  tex = new THREE.CanvasTexture(c);
  tipTextures.set(enchant.id, tex);
  return tex;
}
const tipMat = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
const tip = new THREE.Sprite(tipMat);
tip.scale.set(0.95, 0.95, 1);
tip.renderOrder = 20;
tip.visible = false;
scene.add(tip);
let tipEnchant: EnchantId | null = null;

function updatePreview(): void {
  const charging = player.mode === 'charging';
  const club = player.club;
  const enchant = player.enchant;
  const range = shotRange(club);
  const show = started && !ended && player.alive && player.mode !== 'swinging' && !player.grabbedBy;
  previewLine.visible = show;
  landing.visible = show;
  const ballHere = hasBallHere();
  teeBall.visible = show && charging && ballHere;
  // la barra dice solo la calidad; la distancia y el daño los dice el cursor y el palo
  const quality = qualityOf(player.meter.power);
  // el que atraviesa y además abre área tiene dos números: lo que saca al pegarle y lo que saca el área
  const damage = damageFor(club, range, quality);
  const areaHit = areaDamageFor(club, range, quality);
  const dmgLabel = club.areaDamage && club.pierces ? `${damage} al pegarle · ${areaHit} en área` : `${damage} de daño`;
  hud.setMeter(charging, player.meter.power, player.meter.locked,
    `${range.toFixed(0)} m · ${BAND_NAMES[bandOf(range)]}${enchant.id === 'damage' ? ` · ${dmgLabel}` : ` · ${enchant.name}`}`);
  tip.visible = show && ballHere && enchant.icon !== '';
  if (!show) {
    sweepBox.visible = false;
    return;
  }
  player.teePosition(tee);
  // con relieve la línea se corta donde el tiro toca el terreno: así se ve cuándo una loma tapa
  const loft = THREE.MathUtils.degToRad(club.loftDeg);
  const lift = shotLift(club, range);
  const path = lift
    ? previewOver(launchWith({ x: tee.x, y: heightAt(tee.x, tee.z) + BALL_RADIUS, z: tee.z }, player.aimDir.x, player.aimDir.z, lift.speed, lift.angle), club.gravity ?? GRAVITY, heightAt, PREVIEW_POINTS)
    // el rodado no tiene vuelo que calcular, pero sí tiene que ir pegado al piso: se le pasa el terreno
    : previewPath({ x: tee.x, y: 0, z: tee.z }, player.aimDir.x, player.aimDir.z, range, loft, PREVIEW_POINTS, club.gravity, relief.on ? heightAt : undefined);
  const pos = previewGeo.attributes.position as THREE.BufferAttribute;
  // el arco se ve siempre, no solo mientras se carga
  path.forEach((p, i) => pos.setXYZ(i, p.x, p.y, p.z));
  pos.needsUpdate = true;
  // la línea toma el color del encantamiento; mientras se carga, el de la calidad del golpe
  const lineColor = charging ? QUALITY_COLORS[quality - 1] : enchant.id === 'damage' ? club.color : enchant.color;
  previewMat.color.setHex(!ballHere ? 0x6b7480 : lineColor);
  previewMat.size = charging ? (quality >= QUALITY_LEVELS ? 10 : 4 + quality * 1.5) : 5;
  previewMat.opacity = !ballHere ? 0.25 : charging ? 0.95 : 0.3;
  if (charging && quality !== lastLevel) audio.chargeTick(quality);
  lastLevel = charging ? quality : 0;
  const end = path[path.length - 1];
  const area = QUALITY_AREA[quality - 1];
  // dónde cae y qué agarra: un anillo del tamaño del efecto, o el rectángulo del vendaval
  const rect = enchant.id === 'push';
  const radius = spreadFor(club, quality);
  const linear = !hasArea(club);
  const half = linear ? PUSH_LINE_HALF_WIDTH * area : radius * 1.5;
  const depth = linear ? range / 2 : radius;
  sweepBox.visible = rect;
  landing.visible = !rect;
  if (rect) {
    // el rectángulo sale de la línea del tiro. Con un palo lineal es un pasillo a lo largo de todo el tiro
    const cx = linear ? tee.x + player.aimDir.x * depth : end.x;
    const cz = linear ? tee.z + player.aimDir.z * depth : end.z;
    sweepBox.position.set(cx, heightAt(cx, cz) + 0.08, cz);
    sweepBox.rotation.z = Math.atan2(player.aimDir.x, player.aimDir.z);
    sweepBox.scale.set(half, depth, 1);
    sweepMat.color.setHex(enchant.color);
    sweepEdgeMat.color.setHex(enchant.color);
    sweepMat.opacity = charging ? 0.22 : 0.1;
    sweepEdgeMat.opacity = charging ? 0.95 : 0.45;
  } else {
    landing.position.set(end.x, heightAt(end.x, end.z) + 0.05, end.z);
    // el anillo solo muestra el área cuando el área sale por caer al piso (el globo). El hierro tiene
    // que conectar con alguien, así que dibujarle el círculo grande prometía algo que no pasa
    landing.scale.setScalar(club.burstsOnGround ? Math.max(0.7, radius) : 0.7);
    landingMat.opacity = charging ? 0.85 : 0.35;
    landingMat.color.setHex(enchant.id === 'damage' ? club.color : enchant.color);
  }
  // la punta de la línea dice con qué poder se está por pegar, levantada para no tapar dónde cae
  const tipAt = Math.min(range, Math.hypot(end.x - tee.x, end.z - tee.z));
  const tipX = tee.x + player.aimDir.x * tipAt;
  const tipZ = tee.z + player.aimDir.z * tipAt;
  tip.position.set(tipX, heightAt(tipX, tipZ) + 2.3, tipZ);
  if (tip.visible && tipEnchant !== enchant.id) {
    tipEnchant = enchant.id;
    tipMat.map = tipTexture(enchant);
    tipMat.needsUpdate = true;
  }
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
      if (godMode.godPlayer) player.hp = player.maxHp;
      audio.hurt();
      shake = Math.max(shake, e.enemy.grabbing ? 0.1 : 0.3);
      const s = toScreen(player.position, 2);
      hud.float(s.x, s.y, `-${e.amount}`, 'hurt');
      if (!player.alive) endGame('defeat', 'Caíste en combate', 'Valdehoyo se quedó sin golfista');
      break;
    }
    case 'gateHit':
      if (!godMode.godGate) gateHp = Math.max(0, gateHp - e.amount);
      audio.gateHit();
      world.flashDoor();
      hud.gateAlert();
      if (gateHp <= 0) endGame('defeat', 'La puerta cayó', 'Las hordas entraron a Valdehoyo');
      break;
    case 'trample': {
      // lo atropelló y murió en el choque: ese enemigo ya no llega a la puerta
      effects.explosion(new THREE.Vector3(e.enemy.position.x, 0.8, e.enemy.position.z), 1.4, 0xd96b5b);
      break;
    }
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
      hud.feedback('¡Te atrapó! Shift para sacártela de encima', 'bad');
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
      // el número de daño lo saca el evento 'damage' de la horde, que vale para todas las formas de
      // pegar. Poner otro acá hacía aparecer dos números por golpe.
      audio.thud();
      break;
    case 'land':
      lastLanding = [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1), e.hits];
      if (e.enchant === 'ice') {
        audio.frost();
        if (e.hits) hud.feedback(e.hits > 2 ? `¡Fríos ×${e.hits}!` : `Fríos ×${e.hits}`, e.hits > 2 ? 'good' : 'neutral');
      } else if (e.enchant === 'push') {
        audio.explosion();
        if (e.pos.distanceTo(player.position) < 14) shake = Math.max(shake, 0.15);
        if (e.hits >= 3) hud.feedback(`¡Vendaval! ×${e.hits}`, 'good');
      } else {
        audio.explosion();
        audio.thud();
        if (e.pos.distanceTo(player.position) < 16) shake = Math.max(shake, 0.2);
        if (e.hits > 1) hud.feedback(`¡Le pegó a ${e.hits}!`, 'good');
      }
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
      break;
  }
};

/** La rueda del mouse recorre los palos habilitados, en círculo. Con teclas se elige directo. */
function cycleClub(delta: number): void {
  if (cardOpen || !player) return;
  const order = CLUB_ORDER.filter((id) => player.unlocked.has(id));
  if (order.length < 2) return;
  const i = order.indexOf((player.pendingClub ?? player.club).id);
  player.setClub(CLUBS[order[(i + delta + order.length) % order.length]]);
}

/** 1, 2, 3 y 4 eligen palo. */
function selectClub(index: number): void {
  if (cardOpen || !player || index < 0 || index >= CLUB_ORDER.length) return;
  const id = CLUB_ORDER[index];
  if (!player.unlocked.has(id)) {
    hud.feedback(`${CLUBS[id].name}: todavía no lo tenés`, 'neutral');
    return;
  }
  player.setClub(CLUBS[id]);
}

/** Qué poderes se tienen: el golpe desde el principio, y los otros los van dando las oleadas. */
function enchantOwned(id: EnchantId): boolean {
  return player.powers.has(id);
}

/** Listo para usar: se lo tiene y no está recargando. */
function enchantReady(id: EnchantId): boolean {
  return enchantOwned(id) && player.cooldowns[id] <= 0;
}

/** Q, W y E eligen qué hace la pelota cuando llega. */
function selectEnchant(index: number): void {
  if (cardOpen || !player || index < 0 || index >= ENCHANT_ORDER.length) return;
  const id = ENCHANT_ORDER[index];
  if (!enchantOwned(id)) {
    hud.feedback(`${ENCHANTS[id].name}: todavía no lo tenés`, 'neutral');
    return;
  }
  player.setEnchant(ENCHANTS[id]);
}

/**
 * Espacio: clava el daño donde esté la barra. La barra se queda quieta en ese nivel (el alcance sigue
 * subiendo) y el tiro sale con eso cuando se suelta el click. Sirve para elegir el daño primero y
 * esperar a que los enemigos se alineen después.
 */
function lockSwing(): void {
  if (!started || paused || ended || !player?.lockSwing()) return;
  const p = player.meter.power;
  const q = qualityOf(p);
  audio.chargeTick(q);
  hud.feedback(q >= QUALITY_LEVELS ? '¡Golpe perfecto clavado! Soltá cuando quieras' : `Clavado en ${q}: soltá cuando quieras`, q >= QUALITY_LEVELS ? 'good' : 'neutral');
}

/**
 * Si la oleada que viene estrena un **poder**, lo habilita ya y muestra el cartel. El juego queda
 * frenado hasta que se lo cierre con un click, pero el descanso entre oleadas sigue corriendo: si se
 * leyó con calma, la oleada arranca apenas se cierra. Los palos no se desbloquean: están los cuatro
 * desde la primera oleada.
 */
function offerUnlock(): boolean {
  const id = director.nextUnlock;
  if (!id || player.powers.has(id)) return false;
  player.powers.add(id);
  player.cancelSwing();
  cardOpen = true;
  const power = ENCHANTS[id];
  hud.showCard({
    name: power.name,
    title: power.title,
    key: ENCHANT_KEYS[ENCHANT_ORDER.indexOf(id)],
    hint: power.hint,
    cooldown: power.cooldown,
    color: power.color,
    next: director.nextTitle,
  });
  return true;
}

function dismissCard(): void {
  if (!cardOpen) return;
  cardOpen = false;
  hud.hideCard();
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

/**
 * Panel de balance (tecla B): toca los números del juego en vivo y trae los botones de prueba. Se arma
 * una sola vez, cuando ya hay golfista.
 */
let debugPanel: DebugPanel | null = null;
function makeDebugPanel(): DebugPanel {
  return new DebugPanel({
    director,
    flags: godMode,
    refreshEnemies() {
      // los enemigos comparten el objeto de ENEMIES, así que la velocidad y el daño ya les llegaron
      // solos: lo único que se copió al aparecer, y hay que emparejar, es la vida.
      for (const e of horde.enemies) {
        if (!e.alive) continue;
        e.maxHp = e.stats.hp;
        e.hp = Math.max(1, Math.min(e.hp, e.maxHp));
      }
    },
    goToWave(index) {
      for (const e of horde.enemies) e.state = 'gone';
      for (const id of unlockedAt(index)) player.powers.add(id);
      director.goTo(index);
      hud.showBanner(`Oleada ${index + 1}`, 'saltada desde el panel', 2);
    },
    disabled: disabledKinds,
    setCourse(index) {
      // el terreno se arma una sola vez al cargar, así que cambiar de campo es volver a entrar
      const url = new URL(location.href);
      if (index === null) url.searchParams.delete('campo');
      else url.searchParams.set('campo', String(index + 1));
      url.searchParams.delete('plano');
      location.href = url.toString();
    },
    courseIndex: () => relief.index,
    camera: () => ({ pitch: cam.pitch, rise: cam.rise, dist: cam.dist }),
  });
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
  selectEnchant,
  selectClub,
  tiltCamera,
  raiseCamera,
  debugPanel() {
    debugPanel?.toggle();
  },
  space() {
    if (!started) intro.advance();
    else if (cardOpen) dismissCard();
    else lockSwing();
  },
  step(right) {
    if (started && !paused && !ended && !cardOpen && player) player.step(-right);
  },
  dropBall,
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
  if (ALL_CLUBS) for (const id of ENCHANT_ORDER) p.powers.add(id);
  p.spotXs = tees.spots.map((s) => s.x);
  p.canFire = () => {
    const i = tees.nearest(p.anchor.x);
    return Math.abs(tees.spots[i].x - p.anchor.x) < 0.1 && tees.take(i);
  };
  p.canStart = () => hasBallHere();
  p.enchantAvailable = enchantOwned;
  p.onWhiff = () => {
    audio.whoosh(0.3);
    hud.feedback('¡Sin pelota! Movete con A / D', 'bad');
  };
  p.onDenied = (enchant) => hud.feedback(`${enchant.name} recargando: ${p.cooldowns[enchant.id].toFixed(1)} s`, 'neutral');
  p.onShot = (shot) => {
    shots++;
    audio.tock(shot.quality >= QUALITY_LEVELS);
    if (shot.quality >= QUALITY_LEVELS) hud.feedback('¡Golpe perfecto!', 'good');
    const range = shotRange(shot.club);
    balls.fire(shot, range, shotLift(shot.club, range));
  };
  // Palazo: botón aparte, con recarga. No hace daño: empuja hacia atrás a todo lo que haya alrededor de
  // un punto un paso adelante del golfista, hacia donde apunta.
  p.onMelee = () => {
    // agarrado, el palazo es la forma de zafar: la suelta y la deja aturdida
    const held = p.grabbedBy;
    if (held) {
      p.release(held);
      held.letGo(3);
      hud.feedback('¡Te la sacaste de encima!', 'good');
    }
    const center = p.position.clone().addScaledVector(p.aimDir, 1);
    const targets = horde.nearest(center, MELEE_RANGE, new Set(), MELEE_MAX_TARGETS);
    effects.swipe(center, MELEE_RANGE);
    audio.whoosh(0.9);
    const dir = new THREE.Vector3();
    for (const e of targets) {
      // los manda hacia atrás, por donde vinieron, apenas abiertos hacia el costado de donde estaban
      dir.set((e.position.x - p.position.x) * 0.25, 0, 1).normalize();
      e.shove(dir, MELEE_KNOCKBACK);
      // es el botón de sacárselos de encima: además les corta el ataque
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
    // el puesto es el ancla: copiarlo deja al golfista nuevo exactamente donde estaba, aun a mitad de camino
    fresh.anchor.copy(player.anchor);
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
    player.update(0);
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
  hud.onCardDismiss = dismissCard;
  debugPanel = makeDebugPanel();
  player.update(0);
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

/**
 * La cámara, para poder probar ángulos sin tocar código: la rueda del mouse cambia la **inclinación**
 * (más alto = ves más lejos, más bajo = ves más el campo de frente) y las flechas arriba y abajo la
 * **suben y bajan sin girarla**. Los valores salen en "copiar configuración".
 */
const cam = { pitch: savedBalance.camera?.pitch ?? 32, dist: 18.9, rise: savedBalance.camera?.rise ?? 0, ahead: 5.5 };
const CAM_LIMITS = { pitch: [12, 78], rise: [-3, 14] };

function tiltCamera(delta: number): void {
  // en pausa la rueda no es del juego: se está leyendo el panel de balance, que está por encima
  if (paused) return;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + delta * 2.5, CAM_LIMITS.pitch[0], CAM_LIMITS.pitch[1]);
  hud.feedback(`Cámara: ${cam.pitch.toFixed(0)}° de inclinación`, 'neutral');
  debugPanel?.save();
}

function raiseCamera(delta: number): void {
  cam.rise = THREE.MathUtils.clamp(cam.rise + delta * 0.6, CAM_LIMITS.rise[0], CAM_LIMITS.rise[1]);
  hud.feedback(`Cámara: ${cam.rise >= 0 ? '+' : ''}${cam.rise.toFixed(1)} m de altura`, 'neutral');
  debugPanel?.save();
}

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
  // La cámara sigue al **puesto**, no al cuerpo. Apuntar mueve al golfista alrededor de la pelota, y si
  // la cámara lo seguía, moverse el mouse movía la cámara: el foco es dónde está la pelota.
  // Nunca se mete detrás de la muralla: cerca de la puerta mira más desde arriba.
  const x = player.anchor.x * 0.75;
  // La cámara se arma desde el punto que mira: se aleja `dist` con una inclinación de `pitch` grados.
  // Así la rueda cambia el ángulo sin cambiar qué tan lejos está, y las flechas suben las dos cosas a
  // la vez, que es mover la cámara para arriba sin girarla.
  const pitch = THREE.MathUtils.degToRad(cam.pitch);
  const lookZ = player.anchor.z + cam.ahead;
  camLook.set(x, cam.rise, lookZ);
  // nunca se retrasa más allá de la cara de las torres: bajándola desde un puesto del costado, la
  // cámara quedaba adentro de una torre y el techo tapaba un pedazo de pantalla
  camPos.set(x, cam.rise + Math.sin(pitch) * cam.dist, Math.max(lookZ - Math.cos(pitch) * cam.dist, WALL_FRONT_Z + 0.6));
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
        for (const id of unlockedAt(e.index)) player.powers.add(id);
        hud.showBanner(`Oleada ${e.index + 1}`, e.wave.title);
        break;
      }
      case 'spawn':
        // apagado desde el panel de balance: la oleada sigue igual, pero este tipo no sale
        if (disabledKinds.has(e.kind)) break;
        horde.spawn(e.kind);
        if (e.kind === 'golem') hud.showBanner('¡El Gólem de roca!', 'Tira piedras a la puerta. El hielo no lo congela, pero lo frena');
        else if (e.kind === 'shaman') hud.feedback('¡Chamán! Los que tiene cerca son inmunes: apagalo con hielo', 'bad');
        else if (e.kind === 'wraith') hud.feedback('¡Alma en pena! Si te atrapa, sacátela con el palazo (Shift)', 'bad');
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

    if (started) gameClock += dt;
    // la reserva se repone de a una, y solo con la partida en curso
    if (started && !ended && reserve.charges < RESERVE.max) {
      reserve.timer += dt;
      if (reserve.timer >= RESERVE.cooldown) {
        reserve.timer = 0;
        reserve.charges++;
      }
    } else if (reserve.charges >= RESERVE.max) {
      reserve.timer = 0;
    }
    updateAim();
    const active = started && !ended;
    if (active && input.swingHeld && player.mode !== 'charging' && player.atSpot && hasBallHere()) player.startSwing();
    player.update(dt);
    if (active) updateWaves(dt);
    if (started) {
      horde.update(dt, player);
      balls.update(dt);
      const stance = player.mode === 'charging' || player.mode === 'swinging';
      tees.update(dt, player.spotIndex, stance && player.atSpot ? player.spotIndex : -1);
      traps.update(dt);
    }
    effects.update(dt);
    world.update(dt);
    updateCamera(dt);
    updatePreview();

    hud.setClub(player.club, player.pendingClub);
    hud.setEnchant(player.enchant, player.cooldowns, enchantOwned);
    hud.setClubState(player.unlocked, player.meleeCooldown);
    hud.setReserve(reserve.charges, Math.max(0, RESERVE.cooldown - reserve.timer), RESERVE.cooldown, RESERVE.max);
    hud.setBars(gateHp, GATE_MAX, player.hp, player.maxHp);
    hud.setWave(director.index, director.waveCount, horde.aliveCount, director.pending, director.restLeft);
    hud.setScore(score, kills);
  }
  // el panel se lee también en pausa: se abre desde ahí, y sus números calculados tienen que estar vivos
  debugPanel?.tick();
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
  get lastLanding() { return lastLanding; },
  set closeup(v: boolean) { closeup = v; },
  get measured() { return measured; },
  get aim() { return [aimPoint.x, aimPoint.z].map((v) => +v.toFixed(2)); },
  get fps() { const t = performance.now(); return frameTimes.filter((x) => t - x < 1000).length; },
  /** Píxel de pantalla que corresponde a un punto del piso, para apuntar con el mouse en los tests. */
  screenOf(x: number, z: number) { return toScreen(new THREE.Vector3(x, heightAt(x, z), z), 0); },
  heightAt,
  spawn(kind: EnemyKind, x: number, z: number) { return horde.spawn(kind, new THREE.Vector3(x, 0, z)); },
  /** Tiro con una calidad de golpe exacta, sin depender del timing. Cae donde esté el mouse. */
  shootPower(power: number) {
    player.startSwing();
    player.meter.setPower(power);
    player.releaseSwing();
  },
  /** Qué palo está en la mano y a qué distancia va a caer, para las pruebas. */
  get shotInfo() {
    const club = player.club;
    const range = shotRange(club);
    return { club: club.id, enchant: player.enchant.id, range: +range.toFixed(1), band: bandOf(range), damage: damageFor(club, range, qualityOf(player.meter.power)) };
  },
  /** Color actual de la línea de tiro y palo que muestra la punta, para las pruebas. */
  get aimLine() { return { color: previewMat.color.getHex(), tip: tipEnchant, tipVisible: tip.visible }; },
  get cardOpen() { return cardOpen; },
  offerUnlock,
  dismissCard,
  get clock() { return gameClock; },
  /** Desde dónde sale la pelota ahora mismo. */
  get tee() { player.teePosition(tee); return [tee.x, tee.z]; },
  get tees() { return tees; },

  get traps() { return traps; },
  get enchant() { return player.enchant.id; },
  set enchant(id: EnchantId) { player.setEnchant(ENCHANTS[id]); },
  cycleClub, selectEnchant, selectClub, enchantReady, setIronMode, ironMode, dropBall,
  /** Pelotas de reserva (S): cuántas quedan y cuánto falta para la próxima. */
  get reserve() { return { charges: reserve.charges, left: +Math.max(0, RESERVE.cooldown - reserve.timer).toFixed(1), max: RESERVE.max, cooldown: RESERVE.cooldown }; },
  /** Qué campo salió esta partida, y el panel de balance. */
  get course() { return { index: relief.index, name: gameCourse.name, relieve: relief.on }; },
  get camera() { return { pitch: +cam.pitch.toFixed(1), rise: +cam.rise.toFixed(2), dist: cam.dist }; },
  get debug() { return debugPanel; },
  godMode,
  unlockAll() { for (const id of ENCHANT_ORDER) player.powers.add(id); },
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