// Golf Knight: defendé la puerta de Valdehoyo a pelotazos. Prototipo jugable.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GameAudio } from './audio/audio';
import { BALL_RADIUS, GRAVITY, launch, launchSpeed, launchWith, previewOver, previewPath, previewRoll, ROLL_FRICTION, spinFor } from './core/ballistics';
import { heightAt, pickCourse, raycastTerrain, relief } from './core/terrain';
import { ABILITIES, ABILITY_KEYS, ICE, SLOTS, type AbilityId, type Element } from './core/abilities';
import { describe, drawCards, HEALS, PERK_LIST, PERK_NUMBERS, PERKS, type Build, type Card, type PerkId } from './core/cards';
import { areaDamageFor, bandOf, BAND_NAMES, CLUB_ORDER, CLUBS, damageFor, ironMode, setIronMode, spreadFor, isLob, MELEE_KNOCKBACK, MELEE_MAX_TARGETS, MELEE_RANGE, MELEE_STAGGER, QUALITY_BONUS, QUALITY_LEVELS, qualityOf, qualityStart, rollFrictionFor, SHIFT, CURVE, type Club, type ClubId } from './core/clubs';
import { ENEMIES, WaveDirector, type EnemyKind } from './core/waves';
import { Abilities } from './game/abilities';
import { Balls } from './game/balls';
import { Effects } from './game/effects';
import { Horde } from './game/enemies';
import { BALLS, TEE_Z, Tees } from './game/tees';
import { Traps } from './game/traps';
import { analyzeSwing, sampleHand } from './game/golfClips';
import { CLUB_LENGTH } from './game/swingPose';
import { Player } from './game/player';
import { GATE_Z, GUARD_POSTS, WALL_FRONT_Z, WALL_TOP, World } from './game/world';
import { DebugPanel, loadBalance } from './debug';
import { Hud, type PerkChip } from './hud';
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
const abilities = new Abilities(scene, horde, effects);
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

// ---------- puntería ----------
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3(0, 0, 30);
/** Vector de trabajo de la puntería: se reusa en cada cuadro en vez de crear uno nuevo. */
const scratchAim = new THREE.Vector3();
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
// sobre una pendiente la marca del piso, que es plana, se hundiría en el terreno: con relieve se dibuja
// siempre por encima
if (relief.on) landingMat.depthTest = false;
const teeBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 }));
teeBall.visible = false;
scene.add(teeBall);

/** Hasta dónde se busca el punto apuntado, y cada cuánto se tantea el rayo, en metros. */
const AIM_REACH = 160;
const AIM_STEP = 1;

/**
 * Dónde apunta el mouse sobre el campo con relieve. Se avanza por el rayo hasta el primer paso que
 * queda **abajo del terreno** y ahí se bisecta: es el primer cruce de verdad, siempre, sea cual sea la
 * pendiente. Devuelve false si el rayo se va al horizonte sin tocar nada.
 *
 * Antes se cortaba el rayo con el plano a la altura del terreno del punto anterior, iterando tres
 * veces. Eso converge **solo si la loma es menos empinada que la mirada de la cámara**: en la primera
 * parte de una loma, que es la más empinada, el cursor se quedaba trabado abajo y recién aparecía bien
 * cerca de la punta. Y bajando la cámara empeoraba, porque la mirada se hace más rasante.
 */
function aimOnGround(out: THREE.Vector3): boolean {
  const o = raycaster.ray.origin;
  const d = raycaster.ray.direction;
  const over = (t: number) => o.y + d.y * t - heightAt(o.x + d.x * t, o.z + d.z * t);
  if (over(0) <= 0) return false;
  let lo = 0;
  let hi = -1;
  for (let t = AIM_STEP; t <= AIM_REACH; t += AIM_STEP) {
    if (over(t) <= 0) { hi = t; break; }
    lo = t;
  }
  if (hi < 0) return false;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (over(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return !!out.set(o.x + d.x * hi, 0, o.z + d.z * hi);
}

function updateAim(): void {
  // con la cámara de depuración el mouse ya no corresponde al campo: la puntería queda como estaba
  if (closeup) return;
  raycaster.setFromCamera(new THREE.Vector2(input.pointer.x, input.pointer.y), camera);
  const hit = relief.on
    ? (aimOnGround(scratchAim) ? scratchAim : null)
    : raycaster.ray.intersectPlane(groundPlane, scratchAim);
  if (hit) {
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
 * Con relieve, cómo sale el tiro. Los globos se calculan para caer en el punto apuntado aunque esté más
 * alto o más bajo. **El tiro rasante, no**: sale siempre igual, con el loft del palo y desde la altura
 * del caballero, y si hay una loma en el medio choca contra la loma.
 *
 * Antes se inclinaba solo para esquivar lo que se cruzaba, y eso rompía lo que el driver promete: el
 * mismo arco siempre. Apuntando a una montaña el tiro le pasaba por encima, cuando lo que tiene que
 * hacer es estrellarse ahí. Que la loma tape es información del campo, no un problema a corregir.
 *
 * Sobre piso plano devuelve null y la pelota vuela como siempre.
 */
function shotLift(club: Club, range: number, from?: THREE.Vector3): { speed: number; angle: number } | null {
  if (!relief.on || club.loftDeg <= 0.001) return null;
  const angle = THREE.MathUtils.degToRad(club.loftDeg);
  // desde otro lugar (el clon) se calcula contra el terreno de ahí
  if (from) tee.copy(from);
  else player.teePosition(tee);
  if (!isLob(club)) return { speed: launchSpeed(range, angle, club.gravity), angle };
  const teeH = heightAt(tee.x, tee.z);
  const rise = heightAt(tee.x + player.aimDir.x * range, tee.z + player.aimDir.z * range) - teeH;
  return { speed: launchSpeed(range, angle, club.gravity, rise), angle };
}

/** Último nivel de carga que sonó, para tocar una nota solo cuando cambia. */
let lastLevel = 0;

/** Último nivel de calidad que sonó. */
let lastQuality = 0;

/** ¿El golfista está parado en un puesto que tiene pelota? */
function hasBallHere(): boolean {
  // parado en el puesto, o corrido un poco cargando el tiro: la pelota va con él
  const i = player.stanceSpot();
  return i >= 0 && tees.hasBall(i);
}

/**
 * La línea de un tiro con efecto: se simula igual que va a volar la pelota (mismo arranque que
 * `Balls.fire`, misma curva), porque una recta o una parábola ya no la muestran. Así se ve adónde va a
 * terminar y se puede alinear con la fila curvando, en vez de correrse.
 */
function curvedPath(club: Club, range: number, loft: number, lift: { speed: number; angle: number } | null, quality: number, curve: number) {
  const dx = player.aimDir.x;
  const dz = player.aimDir.z;
  const friction = rollFrictionFor(club, quality);
  const start = lift
    ? launchWith({ x: tee.x, y: heightAt(tee.x, tee.z) + BALL_RADIUS, z: tee.z }, dx, dz, lift.speed, lift.angle)
    : launch({ x: tee.x, y: BALL_RADIUS, z: tee.z }, dx, dz, range, loft, club.gravity, friction);
  const spin = spinFor(start, range, curve, -dz, dx, friction ?? ROLL_FRICTION);
  return start.rolling
    ? previewRoll(start, { restitution: club.restitution, bounceKeep: club.bounceKeep, gravity: club.gravity, rollFriction: friction }, spin, PREVIEW_POINTS, relief.on ? heightAt : undefined)
    : previewOver(start, club.gravity ?? GRAVITY, relief.on ? heightAt : () => 0, PREVIEW_POINTS, 4, spin);
}

function updatePreview(): void {
  const charging = player.mode === 'charging';
  const club = player.club;
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
  hud.setMeter(charging, player.meter.power, player.meter.locked, `${range.toFixed(0)} m · ${BAND_NAMES[bandOf(range)]} · ${dmgLabel}`);
  if (!show) return;
  player.teePosition(tee);
  // con relieve la línea se corta donde el tiro toca el terreno: así se ve cuándo una loma tapa
  const loft = THREE.MathUtils.degToRad(club.loftDeg);
  const lift = shotLift(club, range);
  const curve = player.curving ? player.curve : 0;
  const path = curve
    ? curvedPath(club, range, loft, lift, quality, curve)
    : lift
      ? previewOver(launchWith({ x: tee.x, y: heightAt(tee.x, tee.z) + BALL_RADIUS, z: tee.z }, player.aimDir.x, player.aimDir.z, lift.speed, lift.angle), club.gravity ?? GRAVITY, heightAt, PREVIEW_POINTS)
      // el rodado no tiene vuelo que calcular, pero sí tiene que ir pegado al piso: se le pasa el terreno
      : previewPath({ x: tee.x, y: 0, z: tee.z }, player.aimDir.x, player.aimDir.z, range, loft, PREVIEW_POINTS, club.gravity, relief.on ? heightAt : undefined);
  const pos = previewGeo.attributes.position as THREE.BufferAttribute;
  // el arco se ve siempre, no solo mientras se carga
  path.forEach((p, i) => pos.setXYZ(i, p.x, p.y, p.z));
  pos.needsUpdate = true;
  // la línea toma el color del palo; mientras se carga, el de la calidad del golpe
  const lineColor = charging ? QUALITY_COLORS[quality - 1] : club.color;
  previewMat.color.setHex(!ballHere ? 0x6b7480 : lineColor);
  previewMat.size = charging ? (quality >= QUALITY_LEVELS ? 10 : 4 + quality * 1.5) : 5;
  previewMat.opacity = !ballHere ? 0.25 : charging ? 0.95 : 0.3;
  if (charging && quality !== lastLevel) audio.chargeTick(quality);
  lastLevel = charging ? quality : 0;
  const end = path[path.length - 1];
  const radius = spreadFor(club, quality);
  landing.position.set(end.x, heightAt(end.x, end.z) + 0.05, end.z);
  // el anillo solo muestra el área cuando el área sale por caer al piso (el globo). El hierro tiene
  // que conectar con alguien, así que dibujarle el círculo grande prometía algo que no pasa
  landing.scale.setScalar(club.burstsOnGround ? Math.max(0.7, radius) : 0.7);
  landingMat.opacity = charging ? 0.85 : 0.35;
  landingMat.color.setHex(club.color);
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
  // si se perdió por la puerta, el golfista termina igual que cuando muere: tirado en el piso
  if (result === 'defeat') player.fall();
  hud.showEnd(title, `${detail} · ${score} puntos · ${kills} bajas · ${shots} tiros`);
  if (result === 'victory') audio.victory();
  else audio.defeat();
}

horde.onEvent = (e) => {
  lastEvent = e.type;
  switch (e.type) {
    case 'damage': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      const text = `${e.crit ? '✸ ' : ''}${e.amount}${e.killed ? ' ☠' : ''}`;
      hud.float(s.x, s.y, text, e.killed || e.crit ? 'kill' : '');
      if (e.killed) {
        kills++;
        score += e.enemy.stats.score;
        // perfecto de regalo: cada tantas bajas, el próximo tiro arranca clavado
        if (perks.giftPerfect && ++giftKills >= PERK_NUMBERS.giftPerfect) {
          giftKills = 0;
          player.giftPerfect = true;
          hud.feedback('Próximo tiro: perfecto', 'good');
        }
      }
      break;
    }
    case 'divine': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, '✦', 'hurt');
      audio.bounce();
      break;
    }
    case 'armored': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, 'blindado', 'hurt');
      break;
    }
    case 'frozen': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, '❄ congelado', '');
      audio.frost();
      break;
    }
    case 'powder':
      effects.explosion(e.pos, e.radius, ABILITIES.powder.color);
      audio.explosion();
      break;
    case 'zap':
      effects.lightning(e.from, e.to);
      audio.zap();
      break;
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
    case 'shielded': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, '🛡', 'hurt');
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
      audio.explosion();
      audio.thud();
      if (e.pos.distanceTo(player.position) < 16) shake = Math.max(shake, 0.2);
      if (e.hits > 1) hud.feedback(`¡Le pegó a ${e.hits}!`, 'good');
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
      // las rachas cuentan los tiros del puesto, no las habilidades
      if (e.ability) break;
      streak = e.kills > 0 ? streak + 1 : 0;
      if (perks.masonStreak && streak > 0 && streak % PERK_NUMBERS.masonStreak === 0 && gateHp < GATE_MAX) {
        gateHp++;
        hud.feedback('¡Racha! La puerta +1', 'good');
      }
      updateChargeMul();
      break;
  }
};

abilities.onEvent = (e) => {
  switch (e.type) {
    case 'cast':
      audio.whoosh(0.7);
      break;
    case 'zone':
      lastLanding = [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1), e.hits];
      audio.frost();
      if (e.hits) hud.feedback(e.hits > 2 ? `¡Hielo ×${e.hits}!` : `Hielo ×${e.hits}`, e.hits > 2 ? 'good' : 'neutral');
      break;
    case 'gust':
      lastLanding = [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1), e.hits];
      if (e.hits >= 3) hud.feedback(`¡Vendaval! ×${e.hits}`, 'good');
      break;
    case 'mark':
      lastLanding = [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1), e.hits];
      audio.explosion();
      if (e.hits) hud.feedback(`${ABILITIES[e.id].name} ×${e.hits}`, e.hits > 2 ? 'good' : 'neutral');
      break;
    case 'swallow':
      audio.thud();
      hud.feedback('¡Al hoyo!', 'good');
      break;
    case 'bump':
      audio.thud();
      break;
    case 'grenade':
      lastLanding = [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1), e.hits];
      audio.explosion();
      if (e.pos.distanceTo(player.position) < 14) shake = Math.max(shake, 0.15);
      if (e.hits) hud.feedback(e.hits > 2 ? `¡Silenciados ×${e.hits}!` : `Silenciados ×${e.hits}`, e.hits > 2 ? 'good' : 'neutral');
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
  if (choice) {
    pickCard(index);
    return;
  }
  if (cardOpen || !player || index < 0 || index >= CLUB_ORDER.length) return;
  const id = CLUB_ORDER[index];
  if (!player.unlocked.has(id)) {
    hud.feedback(`${CLUBS[id].name}: todavía no lo tenés`, 'neutral');
    return;
  }
  player.setClub(CLUBS[id]);
}

/**
 * Q, W, E y R tiran la habilidad de ese lugar **en el acto**, hacia donde está el mouse, con su propia
 * pelota: no gastan la del puesto ni cortan el tiro que se esté cargando. Se puede tirar corriendo entre
 * puestos. Los lugares se llenan eligiendo cartas entre oleadas.
 */
function castAbility(index: number): void {
  if (!started || paused || ended || cardOpen || !player || index < 0 || index >= SLOTS) return;
  if (!player.alive || player.grabbedBy || player.stunned) return;
  player.teePosition(tee);
  const result = abilities.cast(index, tee, player.aimDir, aimPoint);
  const slot = abilities.slots[index];
  if (result === 'empty') hud.feedback(`${ABILITY_KEYS[index]}: vacío · se llena eligiendo cartas entre oleadas`, 'neutral');
  else if (result === 'cooling') hud.feedback(`${ABILITIES[slot.id].name} recargando: ${abilities.cooldowns[index].toFixed(1)} s`, 'neutral');
  else if (result === 'blocked') hud.feedback('No hay palo para tirar ahora', 'neutral');
}

// ---------- cartas y mejoras ----------
/** Las mejoras tomadas, y cuántas veces cada una. */
const perks: Partial<Record<PerkId, number>> = {};
/** Las tres cartas en pantalla, o null. */
let choice: Card[] | null = null;
/** Tiros seguidos del puesto que mataron a alguien: el ritmo y la racha del albañil. */
let streak = 0;
/** Bajas desde el último perfecto de regalo. */
let giftKills = 0;
/** Carcaj: si hay pelota a mano, y cuánto falta para la próxima. */
const quiver = { ready: true, timer: 0 };
/** Caddie dorado: segundos que le quedan. */
let caddieLeft = 0;

function build(): Build {
  return { slots: abilities.slots, perks, hp: player.hp, hpMax: player.maxHp, gate: gateHp, gateMax: GATE_MAX };
}

/**
 * Al terminar una oleada salen tres cartas y te quedás con una. El juego queda frenado hasta que
 * elegís, pero el descanso entre oleadas sigue corriendo: si lo pensaste con calma, la oleada arranca
 * apenas elegís.
 */
function offerChoice(): boolean {
  const cards = drawCards(build());
  if (!cards.length) return false;
  choice = cards;
  cardOpen = true;
  player.cancelSwing();
  hud.showChoice(cards.map(describe), director.nextTitle);
  return true;
}

function pickCard(i: number): void {
  const card = choice?.[i];
  if (!card) return;
  choice = null;
  cardOpen = false;
  hud.hideChoice();
  applyCard(card);
}

function applyCard(card: Card): void {
  const d = describe(card);
  if (card.kind === 'ability') {
    // desde el panel se puede pedir una quinta: no hay lugar, y se avisa en vez de perderla callada
    if (!abilities.learn(card.id)) {
      hud.feedback(`${d.name}: no hay lugar (o ya está en el nivel máximo)`, 'neutral');
      return;
    }
    const slot = abilities.slots.findIndex((s) => s.id === card.id);
    hud.feedback(card.level > 1 ? `${d.name}: nivel ${card.level}` : `${d.name} en la ${ABILITY_KEYS[slot]}`, 'good');
  } else if (card.kind === 'perk') {
    perks[card.id] = (perks[card.id] ?? 0) + 1;
    applyPerks();
    hud.feedback(d.name, 'good');
  } else if (card.id === 'gate') {
    gateHp = Math.min(GATE_MAX, gateHp + HEALS.gate);
    hud.feedback('Los albañiles remiendan la puerta', 'good');
  } else {
    player.heal(HEALS.player);
    hud.feedback('Recuperás el aliento', 'good');
  }
}

/** Pasa las mejoras tomadas a los números del juego. Se llama cada vez que se toma una. */
function applyPerks(): void {
  QUALITY_BONUS.perfectWiden = Math.pow(PERK_NUMBERS.sweetSpot, perks.sweetSpot ?? 0);
  hud.setPerfectWidth(1 - qualityStart(QUALITY_LEVELS - 1));
  BALLS.max = 3 + (perks.extraBall ?? 0);
  abilities.secondWind.owned = !!perks.secondWind;
  horde.mastery.ice = !!perks.masteryIce;
  horde.mastery.fire = !!perks.masteryFire;
  horde.mastery.lightning = !!perks.masteryLightning;
  updateChargeMul();
}

/** La muñeca rápida siempre, y el ritmo según la racha. */
function updateChargeMul(): void {
  const wrist = Math.pow(PERK_NUMBERS.quickWrist, perks.quickWrist ?? 0);
  const rhythm = perks.rhythm ? 1 - PERK_NUMBERS.rhythmStep * Math.min(streak, PERK_NUMBERS.rhythmMax) : 1;
  player.chargeMul = wrist * rhythm;
}

/** Carcaj: vas a pegar donde no hay pelota y te aparece una a los pies, si está lista. */
function useQuiver(): void {
  if (!perks.quiver || !quiver.ready || !player.atSpot || hasBallHere()) return;
  quiver.ready = false;
  quiver.timer = PERK_NUMBERS.quiverCooldown;
  tees.place(player.spotIndex);
  audio.bounce();
  hud.feedback('Carcaj', 'neutral');
}

/**
 * Las fichas de las mejoras tomadas, para la columna del HUD: las que saltan solas muestran cuánto les
 * falta, y las rachas, cuánto llevás.
 */
function perkStatus(): PerkChip[] {
  const out: PerkChip[] = [];
  for (const id of PERK_LIST) {
    const n = perks[id] ?? 0;
    if (!n) continue;
    const p = PERKS[id];
    const chip: PerkChip = { id, name: p.max > 1 && n > 1 ? `${p.name} ×${n}` : p.name, color: p.color, hint: p.hint, status: '', cooling: 0, ready: false };
    switch (id) {
      case 'giftPerfect':
        chip.ready = player.giftReady;
        chip.status = chip.ready ? '¡listo!' : `bajas ${giftKills}/${PERK_NUMBERS.giftPerfect}`;
        break;
      case 'quiver':
        chip.ready = quiver.ready;
        chip.status = quiver.ready ? 'lista' : `⟳ ${Math.ceil(quiver.timer)} s`;
        chip.cooling = quiver.ready ? 0 : quiver.timer / PERK_NUMBERS.quiverCooldown;
        break;
      case 'secondWind': {
        const left = abilities.secondWind.left;
        chip.ready = left <= 0;
        chip.status = chip.ready ? 'listo' : `⟳ ${Math.ceil(left)} s`;
        chip.cooling = left / PERK_NUMBERS.secondWindCooldown;
        break;
      }
      case 'rhythm': {
        const k = Math.min(streak, PERK_NUMBERS.rhythmMax);
        chip.status = `racha ${k}/${PERK_NUMBERS.rhythmMax}`;
        chip.ready = k >= PERK_NUMBERS.rhythmMax;
        break;
      }
      case 'masonStreak':
        chip.status = `racha ${streak % PERK_NUMBERS.masonStreak}/${PERK_NUMBERS.masonStreak}`;
        break;
      case 'extraBall':
        chip.status = `+${n}`;
        break;
    }
    out.push(chip);
  }
  return out;
}

/** Clon: una copia tuya que repite tus próximos tiros desde donde la dejaste. */
let clone: { pos: THREE.Vector3; shots: number; left: number; mesh: THREE.Group } | null = null;
function placeClone(shots: number, life: number): void {
  removeClone();
  player.teePosition(tee);
  const mesh = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: ABILITIES.clone.color, transparent: true, opacity: 0.35, depthWrite: false });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.7, 12), mat);
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat);
  head.position.y = 1.9;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28), new THREE.MeshBasicMaterial({ color: ABILITIES.clone.color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  mesh.add(body, head, ring);
  mesh.position.set(tee.x, heightAt(tee.x, tee.z), tee.z - 0.4);
  scene.add(mesh);
  clone = { pos: tee.clone(), shots, left: life, mesh };
  effects.blink(tee.clone(), ABILITIES.clone.color);
}
function removeClone(): void {
  if (!clone) return;
  scene.remove(clone.mesh);
  clone = null;
}

/** Un palo simple para el boomerang: vara y cabeza, que gira. */
function boomerangClub(): THREE.Object3D {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: 0.6, roughness: 0.3 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), metal);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.08), metal);
  head.position.set(0.08, -0.55, 0);
  g.add(shaft, head);
  return g;
}

abilities.hooks = {
  fireShot(clubId: ClubId, quality: number, element: Element) {
    const club = CLUBS[clubId];
    player.teePosition(tee);
    const range = shotRange(club);
    audio.tock(quality >= QUALITY_LEVELS);
    balls.fire({ club, quality, power: 1, curve: 0, element, ability: true, from: tee.clone(), dir: player.aimDir.clone() }, range, shotLift(club, range));
  },
  fillSpots() {
    const n = tees.fillAll();
    if (n) hud.feedback(`¡Lluvia de pelotas! +${n}`, 'good');
    return n;
  },
  startCaddie(seconds: number) {
    caddieLeft = seconds;
    hud.feedback('¡Caddie dorado!', 'good');
  },
  placeClone,
  throwClub: () => player.throwClub(),
  catchClub: () => player.catchClub(),
  clubMesh: boomerangClub,
};

/**
 * Espacio: clava el daño donde esté la barra. La barra se queda quieta en ese nivel (el alcance sigue
 * subiendo) y el tiro sale con eso cuando se suelta el click. Sirve para elegir el daño primero y
 * esperar a que los enemigos se alineen después.
 */
function lockSwing(): void {
  if (!started || paused || ended || !player) return;
  // la segunda apretada arranca la carga de nuevo: clavaste un nivel que no era y querés otro
  if (player.meter.locked) {
    if (player.restartCharge()) audio.chargeTick(1);
    return;
  }
  // sin cartel: la barra ya se ve quieta y encendida, y el cartel tapaba el campo en pleno tiro
  if (player.lockSwing()) audio.chargeTick(qualityOf(player.meter.power));
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
  // con ?palos, para probar: arranca eligiendo una carta
  if (ALL_CLUBS) offerChoice();
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
    offerChoice() {
      if (!cardOpen) offerChoice();
    },
    take: applyCard,
    slots: () => abilities.slots,
    setAbilityLevel: (id, level) => abilities.setLevel(id, level),
    perks: () => perks,
    setPerkLevel(id, level) {
      if (level > 0) perks[id] = level;
      else delete perks[id];
      applyPerks();
    },
    refreshPerks: applyPerks,
    camera: () => cam,
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
    if (!started || paused || ended || cardOpen) return;
    useQuiver();
    player.startSwing();
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
  castAbility,
  selectClub,
  tiltCamera,
  raiseCamera,
  debugPanel() {
    debugPanel?.toggle();
  },
  space() {
    if (!started) intro.advance();
    else if (cardOpen && !choice) dismissCard();
    else lockSwing();
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
    // R solo desde la pausa o desde el cartel del final, que son los dos lugares que la ofrecen. En
    // pleno juego un toque de más te borraba la partida sin preguntar nada
    if (started && (paused || ended)) location.reload();
    // en pleno juego la R es el cuarto lugar de habilidad
    else castAbility(3);
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
  p.spotXs = tees.spots.map((s) => s.x);
  p.canFire = () => {
    const i = p.stanceSpot();
    return i >= 0 && tees.take(i);
  };
  p.canStart = () => hasBallHere();
  p.onWhiff = () => {
    audio.whoosh(0.3);
    hud.feedback('¡Sin pelota! Movete con A / D', 'bad');
  };
  p.onShot = (shot) => {
    shots++;
    audio.tock(shot.quality >= QUALITY_LEVELS);
    if (shot.quality >= QUALITY_LEVELS) hud.feedback('¡Golpe perfecto!', 'good');
    const range = shotRange(shot.club);
    balls.fire(shot, range, shotLift(shot.club, range));
    // el clon repite el tiro desde donde quedó, hacia el mismo lado, igual de lejos
    if (clone && clone.shots > 0) {
      const from = clone.pos.clone();
      balls.fire({ ...shot, from }, range, shotLift(shot.club, range, from));
      effects.blink(from, ABILITIES.clone.color);
      if (--clone.shots <= 0) removeClone();
    }
  };
  p.onGift = () => audio.chargeTick(QUALITY_LEVELS);
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
    fresh.meleeCooldown = player.meleeCooldown;
    fresh.chargeMul = player.chargeMul;
    fresh.giftPerfect = player.giftPerfect;
    fresh.thrownClub = player.thrownClub;
    fresh.onGift = player.onGift;
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
  hud.onPick = pickCard;
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
 *
 * Con **encuadre automático** (`auto`) la cámara se aleja o se acerca sola para que la línea de los
 * puestos quede siempre justo arriba de las barras de abajo, a `margin` píxeles: al levantarla o
 * inclinarla se retrasa lo necesario, y el golfista nunca queda tapado por el HUD. Sin él, mira un
 * punto fijo `ahead` metros por delante del puesto, como antes.
 */
const cam = {
  pitch: savedBalance.camera?.pitch ?? 32, dist: 18.9, rise: savedBalance.camera?.rise ?? 0, ahead: 5.5,
  auto: savedBalance.camera?.auto ?? true, margin: savedBalance.camera?.margin ?? 24,
};
/** Dónde empieza el HUD de abajo, en píxeles desde arriba. Se mide cada tanto: casi no cambia. */
let hudTop = innerHeight * 0.8;
let hudMeasured = -Infinity;
const hudBottom = document.getElementById('bottom')!;
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
  const camY = cam.rise + Math.sin(pitch) * cam.dist;
  let lookZ = player.anchor.z + cam.ahead;
  if (cam.auto) {
    const now = performance.now();
    if (now - hudMeasured > 500) {
      hudMeasured = now;
      hudTop = hudBottom.getBoundingClientRect().top;
    }
    // A qué altura de la pantalla tiene que quedar la línea de los puestos, y cuántos grados por debajo
    // del centro de la mirada es eso. La cámara mira con `pitch` hacia abajo, así que el rayo al puesto
    // baja `pitch + debajo` grados: de ahí sale a cuántos metros por detrás del puesto va la cámara.
    const targetPx = THREE.MathUtils.clamp(hudTop - cam.margin, innerHeight * 0.3, innerHeight);
    const ndc = 1 - (2 * targetPx) / innerHeight;
    const below = Math.atan(-ndc * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const ray = Math.min(pitch + below, THREE.MathUtils.degToRad(88));
    const back = (camY - heightAt(player.anchor.x, player.anchor.z)) / Math.tan(ray);
    lookZ = player.anchor.z - back + Math.cos(pitch) * cam.dist;
  }
  camLook.set(x, cam.rise, lookZ);
  // Baja, nunca se retrasa más allá de la cara de las torres: bajándola desde un puesto del costado,
  // la cámara quedaba adentro de una torre y el techo tapaba un pedazo de pantalla. Más alta que las
  // torres ya no hay nada con qué chocar, y el tope le arruinaba el encuadre al levantarla
  const camZ = lookZ - Math.cos(pitch) * cam.dist;
  camPos.set(x, camY, camY < WALL_TOP + 1.5 ? Math.max(camZ, WALL_FRONT_Z + 0.6) : camZ);
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
        hud.showBanner(`Oleada ${e.index + 1}`, e.wave.title);
        break;
      }
      case 'spawn':
        // apagado desde el panel de balance: la oleada sigue igual, pero este tipo no sale
        if (disabledKinds.has(e.kind)) break;
        horde.spawn(e.kind);
        if (e.kind === 'golem') hud.showBanner('¡El Gólem de roca!', 'Tira piedras a la puerta. La granada lo deja vulnerable');
        else if (e.kind === 'shaman') hud.feedback('¡Chamán! Los que tiene cerca son inmunes: silencialo con la granada (Q)', 'bad');
        else if (e.kind === 'wraith') hud.feedback('¡Alma en pena! Si te atrapa, sacátela con el palazo (Shift)', 'bad');
        break;
      case 'cleared':
        // ya no se cura solo entre oleadas: curarse es una de las cartas, y elegirla es no mejorar
        if (e.index + 1 < director.waveCount && !offerChoice()) hud.showBanner('¡Oleada despejada!', '', 2.5);
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
    // carcaj: se repone solo
    if (!quiver.ready && (quiver.timer -= dt) <= 0) quiver.ready = true;
    // caddie dorado: mientras dure, el puesto donde estás nunca se queda sin pelota
    if (caddieLeft > 0) {
      caddieLeft -= dt;
      const i = player.stanceSpot();
      if (i >= 0 && !tees.hasBall(i)) tees.place(i, true);
    }
    if (clone && (clone.left -= dt) <= 0) removeClone();
    // correrse cargando, en el modo continuo: mantener A o D corre con la pelota. El derecho de la
    // pantalla es hacia -x, como en `step`
    // Y el efecto: mantener A o D curva el tiro (continuo), y con «al soltar» vuelve a cero apenas no
    // hay ninguna de las dos apretada
    if (started && !ended && player.mode === 'charging') {
      const right = (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0) - (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0);
      if (SHIFT.mode === 'continuo' && right) player.shiftStance(-right * SHIFT.speed * dt);
      if (player.curving) {
        if (CURVE.variant === 'continuo' && right) player.bendShot(right * CURVE.rate * dt);
        if (CURVE.reset === 'soltar' && !right) player.curve = 0;
      }
    }
    updateAim();
    const active = started && !ended;
    if (active && input.swingHeld && player.mode !== 'charging' && player.atSpot && hasBallHere()) player.startSwing();
    player.update(dt);
    if (active) updateWaves(dt);
    if (started) {
      horde.update(dt, player);
      balls.update(dt);
      abilities.update(dt);
      const stance = player.mode === 'charging' || player.mode === 'swinging';
      // en la postura la pelota se dibuja a los pies del golfista, aunque se haya corrido cargando
      tees.update(dt, player.spotIndex, stance && player.stanceSpot() >= 0 ? player.spotIndex : -1);
      traps.update(dt);
    }
    effects.update(dt);
    world.update(dt);
    updateCamera(dt);
    updatePreview();

    hud.setClub(player.club, player.pendingClub);
    hud.setAbilities(abilities.slots, abilities.cooldowns, abilities.slots.map((_, i) => abilities.cooldownOf(i)));
    hud.setClubState(player.unlocked, player.meleeCooldown, player.thrownClub);
    hud.setPerks(perkStatus());
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
    return { club: club.id, range: +range.toFixed(1), band: bandOf(range), damage: damageFor(club, range, qualityOf(player.meter.power)) };
  },
  /** Color actual de la línea de tiro, para las pruebas. */
  get aimLine() { return { color: previewMat.color.getHex() }; },
  get cardOpen() { return cardOpen; },
  offerChoice,
  pickCard,
  /** Las cartas en pantalla, y las mejoras tomadas. */
  get choice() { return choice; },
  get perks() { return perks; },
  /** Toma una carta sin sortear, como si la hubieras elegido. */
  take(card: Card) { applyCard(card); },
  dismissCard,
  get clock() { return gameClock; },
  /** Desde dónde sale la pelota ahora mismo. */
  get tee() { player.teePosition(tee); return [tee.x, tee.z]; },
  get tees() { return tees; },

  get traps() { return traps; },
  /** Las habilidades: cuáles se tienen, las recargas y las zonas de hielo en el piso. */
  get abilities() { return abilities; },
  /** Tira una habilidad por nombre, como si se apretara su tecla. */
  cast(id: AbilityId) {
    if (!abilities.slots.some((s) => s.id === id)) abilities.learn(id);
    castAbility(abilities.slots.findIndex((s) => s.id === id));
  },
  /** A qué fracción de su velocidad camina el que pisa hielo, para la anticipación del bot. */
  get iceSlow() { return ICE.slow; },
  cycleClub, castAbility, selectClub, setIronMode, ironMode,
  /** Pelotas de reserva (S): cuántas quedan y cuánto falta para la próxima. */
  /** Qué campo salió esta partida, y el panel de balance. */
  get course() { return { index: relief.index, name: gameCourse.name, relieve: relief.on }; },
  get camera() { return { pitch: +cam.pitch.toFixed(1), rise: +cam.rise.toFixed(2), dist: cam.dist }; },
  get debug() { return debugPanel; },
  godMode,
  /** Aprende (o sube de nivel) una habilidad, sin carta. */
  learn(id: AbilityId) { return abilities.learn(id); },
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