// Golf Knight: defendé la puerta de Valdehoyo a pelotazos. Prototipo jugable.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GameAudio } from './audio/audio';
import { BALL_RADIUS, GRAVITY, launch, launchSpeed, launchWith, previewOver, previewPath, previewRoll, ROLL_FRICTION, spinFor } from './core/ballistics';
import { heightAt, mounds, pickCourse, raycastTerrain, relief, terrainOn } from './core/terrain';
import { ABILITIES, ABILITY_KEYS, ABILITY_LIST, ECHO, ELEMENT_INFO, ELEMENTS, elementTotal, lv, MIGHT, PALAZO, shotQuality, SLOTS, type AbilityId, type Element } from './core/abilities';
import { describe, drawCards, HEALS, mixPartners, PERK_LIST, PERK_NUMBERS, PERKS, type Build, type Card, type PerkId } from './core/cards';
import { areaDamageFor, bandOf, BAND_NAMES, CLUB_ORDER, CLUBS, damageFor, FOURTH, ironMode, setIronMode, spreadFor, isLob, QUALITY_LEVELS, qualityMarks, qualityOf, rollFrictionFor, topQuality, CHARGE, SHIFT, CURVE, type Club, type ClubId } from './core/clubs';
import { buildRun, ENEMIES, RANGED, SCENARIO_POWERS, SHIELD_WALL, WaveDirector, type EnemyKind, type EnemyMods, type RunRules, type ScenarioPower } from './core/waves';
import { earnPoint, hillsOn, loadProgress, MAX_POINTS, rulesFor, saveProgress, setLevel, TALENTS, used, type Progress } from './core/difficulty';
import type { EndInfo, EndStat } from './endscreen';
import { arcLayout, timingWith } from './core/swing';
import { Abilities } from './game/abilities';
import { Balls, RICOCHET_COLOR } from './game/balls';
import { RICOCHET } from './core/shield';
import { MoundView } from './game/mounds';
import { Effects } from './game/effects';
import { badgeImage, Horde, SCENARIO_ICONS, shadowMat, SHIELD_MODELS, SHIELD_PROPS } from './game/enemies';
import { BALLS, TEE_Z, Tees } from './game/tees';
import { Traps } from './game/traps';
import { analyzeSwing, sampleHand } from './game/golfClips';
import { CLUB_LENGTH } from './game/swingPose';
import { Player, type Shot } from './game/player';
import { FIELD_HALF_WIDTH, GATE_Z, GUARD_POSTS, WALL_FRONT_Z, WALL_TOP, World } from './game/world';
import { loadVisual, VISUAL, Visuals } from './game/visuals';
import { keepOnlyMesh, skinnedHeight, stripRootMotion } from './game/models';
import { DebugPanel, loadBalance, type SavedExtras } from './debug';
import { Hud, type PerkChip } from './hud';
import { Input, type InputEvents } from './input';
import { Intro } from './intro';
import { DifficultyMenu } from './difficultyMenu';
import { paintThreat } from './threat';
import { flushRuns, RunRecorder } from './telemetry';
import { Tutorial } from './tutorial';
import { applyTennis, POCKET_RAIN, switchMode, TENNIS_ON } from './tennis/mode';
import { TENNIS, timingQuality } from './tennis/bounce';
import { gaugePower, gaugeTimes, TennisPlay } from './tennis/play';
import { Pocket } from './tennis/pocket';
import { Court } from './tennis/court';
import type { Ball } from './game/balls';
import { connect, roomCode } from './net/link';
import { MIRRORED, mirror, NetHost } from './net/host';
import { NetSpectator } from './net/spectator';
import { r2, type GameSnap, type Hello } from './net/snapshot';
import { Abe, BOLT_SLOT, castColor, SPELL_INFO } from './coop/abe';
import { ABE_SLOTS, BOLT_INFO, boltHint, spellHint, spellSize } from './coop/spells';
import type { AbeStatus } from './net/spectator';
import { L } from './i18n';
import { ABE_ONLY, DEMO, DEMO_LOCKS, DEV_TOOLS } from './edition';

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
/**
 * La dificultad: los puntos ganados y dónde están puestos (ver core/difficulty.ts). Se eligen en un menú
 * entre partidas, desde la pantalla de inicio o el cartel del final.
 */
// la demo no tiene los talentos (ver src/edition.ts): siempre la partida de base, y no se guarda nada
const progress: Progress = DEMO || ABE_ONLY ? { points: 0, picks: {} } : loadProgress();
/** Los campos con lomas son un talento: sin él se juega en el liso. Es lo que está armado ahora. */
let builtHills = hillsOn(progress.picks);
// el tenis se juega en cancha lisa: la pelota que rebota no sabe de lomas. ?campo=N y ?plano mandan
// sobre la dificultad (las pruebas y el que mira usan el campo del que juega)
let gameCourse = pickCourse(params.has('plano') || TENNIS_ON ? 'plano' : params.get('campo') ?? (builtHills ? null : 'plano'));
// el balance ajustado en el panel vuelve al recargar: cambiar de campo recarga la página, así que sin
// esto se perdía todo lo tocado. Tiene que aplicarse antes de armar el mundo (las bandas se dibujan)
// (solo con las herramientas de prueba: lo que se publica para jugadores juega con los números del código)
const savedBalance: SavedExtras = DEV_TOOLS ? loadBalance() : {};
// el modo tenis cambia los palos y las cartas: antes de armar el HUD, que dibuja los palos
if (TENNIS_ON) applyTennis();
const world = new World(scene);
loadVisual(params);
const visuals = new Visuals(renderer, scene, camera, world.sun, world.hemi, shadowMat);
const effects = new Effects(scene);
const horde = new Horde(scene);
const balls = new Balls(scene, horde, effects);
/** Las lomas del geomante, a la vista (la altura ya la leen todos de core/terrain). */
const moundView = new MoundView(scene, world);
const abilities = new Abilities(scene, horde, effects);
/** El granizo de Abe, el segundo jugador (src/coop): lo pide el que mira, cae en este juego. */
const abe = new Abe(scene, horde, effects);
const tees = new Tees(scene);
const traps = new Traps(scene, horde, effects);
balls.traps = traps;
/** Modo tenis: el bolsillo de pelotas (null en el golf), y la cancha con sus paredes. */
const pocket = TENNIS_ON ? new Pocket(scene) : null;
const court = TENNIS_ON ? new Court(scene) : null;
balls.tennis = TENNIS_ON;
// la vuelta tarda lo que haga falta para que llegues corriendo (ver returnTime)
balls.tennisX = () => player?.anchor.x ?? 0;
// la que para un escudo vuelve al puesto donde estás parado
balls.playerAt = () => player?.anchor ?? null;
// el espectador todavía no ve las pelotas de los puestos (ver docs/multijugador.md): mejor ninguna que
// unas quietas que no son
if (TENNIS_ON || params.has('mirar')) tees.setVisible(false);

// ---------- estado ----------
const GATE_MAX = 10;
/** Color de la línea de tiro según la calidad del golpe: flojo, bueno y perfecto. */
const QUALITY_COLORS = [0xffffff, 0xffe066, 0xff2d3c];
/** La del palo que pifia con el golpe 1 (el wedge), como su arco: gris, verde y amarillo. */
const DUFF_COLORS = [0x6b7480, 0x5be07a, 0xffd21f];
/** Con el golpe 4, como el arco: el 3 en naranja y el 4 en rojo (con la pifia, el 3 amarillo y el 4 naranja). */
const QUALITY_COLORS_4 = [0xffffff, 0xffe066, 0xff9a2e, 0xff2d3c];
const DUFF_COLORS_4 = [0x6b7480, 0x5be07a, 0xffd21f, 0xff9a2e];
const hud = new Hud();
const audio = new GameAudio();
const difficultyMenu = new DifficultyMenu(progress, DEMO);
/**
 * La partida de esta vez: tres escenarios, cada uno con un poder sorteado, y el jefe (ver `buildRun`), con
 * lo que diga la dificultad. Reiniciar recarga la página, así que cada partida sortea de nuevo; si se
 * cambia la dificultad antes de empezar, se vuelve a armar al arrancar (`rebuildRun`).
 */
let rules = runRules();
// el golpe 4 es un talento de la dificultad, y en el tenis no hay
FOURTH.on = rules.fourth && !TENNIS_ON;
let run = buildRun(Math.random, rules);
const director = new WaveDirector(run.waves, rules.rest);
const POWER_NAMES: Record<ScenarioPower, string> = L(
  { shield: 'Escudo', armor: 'Blindaje', ethereal: 'Fantasma', divine: 'Escudo divino', dodge: 'Esquiva', regen: 'Se cura', phase: 'Intocable' },
  { shield: 'Shield', armor: 'Armor', ethereal: 'Ghost', divine: 'Divine shield', dodge: 'Dodge', regen: 'Regenerates', phase: 'Untouchable' },
);
/** Los títulos de las insignias de la partida: un escenario con su poder, y el jefe. */
const stageTitle = L((n: number, power: string) => `Escenario ${n}: ${power}`, (n: number, power: string) => `Stage ${n}: ${power}`);
const BOSS_TITLE = L('El jefe', 'The boss');
/** El cartel grande de cada oleada. */
const waveTitle = L((n: number) => `Oleada ${n}`, (n: number) => `Wave ${n}`);
/** El título del cartel del final al ganar (también en el que mira). */
const VICTORY_TITLE = L('¡Valdehoyo resiste!', 'Valdehoyo stands!');
/** Abe y los que miran además de él, en la intro y en la pausa. */
const abeAndWatchers = L((others: number) => `🧙 Abe y ${others} mirando`, (others: number) => `🧙 Abe + ${others} watching`);
function showRun(): void {
  hud.setRun([
    ...run.powers.map((p, i) => ({ src: badgeImage(SCENARIO_ICONS[p]), title: stageTitle(i + 1, POWER_NAMES[p]) })),
    { src: badgeImage('skull'), title: BOSS_TITLE },
  ]);
}
showRun();

/** Las reglas de la partida: las de la dificultad, y en la demo, sin los poderes que no trae (DEMO_LOCKS). */
function runRules(): RunRules {
  const r = rulesFor(progress.picks);
  return DEMO ? { ...r, pool: SCENARIO_POWERS.filter((p) => !DEMO_LOCKS.powers.includes(p)) } : r;
}

/** Se cambió la dificultad en la pantalla de inicio: la partida se arma de nuevo con la elegida. */
function rebuildRun(): void {
  difficultyMenu.dirty = false;
  rules = runRules();
  FOURTH.on = rules.fourth && !TENNIS_ON;
  run = buildRun(Math.random, rules);
  director.load(run.waves, rules.rest);
  showRun();
}

/**
 * El botón de la dificultad, en la pantalla de inicio y en el cartel del final: aparece con el primer
 * punto. Es la llama con el nivel (ver src/threat.ts), y late si hay puntos sin poner. En la partida, la
 * misma llama va al lado del título de la oleada.
 */
const diffButtons = [document.getElementById('diffbtn'), document.getElementById('enddiff')].filter((x): x is HTMLElement => !!x);
function paintDifficulty(): void {
  // en la demo se ve siempre, con candado: es lo que trae la completa
  const on = (DEMO || progress.points > 0) && !params.has('mirar');
  const state = { level: used(progress.picks), points: progress.points, max: MAX_POINTS, locked: DEMO };
  for (const b of diffButtons) {
    b.hidden = !on;
    if (on) paintThreat(b, state);
  }
  // el que mira ve la del que juega (llega con la foto)
  if (!params.has('mirar')) hud.setHeat(state.level, MAX_POINTS);
}
for (const b of diffButtons) {
  b.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    difficultyMenu.show();
  });
}
difficultyMenu.onChange = paintDifficulty;
// si antes de empezar se prendió o se apagó el terreno irregular, el campo se cambia en el acto (en el
// cartel del final no hace falta: la R arma la partida nueva). ?plano y ?campo mandan sobre la dificultad
difficultyMenu.onClose = () => {
  if (started || hillsOn(progress.picks) === builtHills || params.has('plano') || params.has('campo') || TENNIS_ON) return;
  builtHills = hillsOn(progress.picks);
  gameCourse = pickCourse(builtHills ? null : 'plano');
  world.rebuildField();
  // la marca de caída, como al armarla: con relieve se dibuja por encima del piso
  landingMat.depthTest = !relief.on;
  landingMat.needsUpdate = true;
};

/**
 * El registro de la partida, que se manda solo al terminar (src/telemetry.ts). Arranca con la primera
 * oleada (el tutorial no cuenta). Ni el bot, ni el espectador, ni las pruebas automáticas mandan nada.
 */
const RECORD = !ABE_ONLY && !params.has('bot') && !params.has('mirar') && !navigator.webdriver;
let recorder: RunRecorder | null = null;
/** Cómo se anota quién pegó: el cuerpo, y si es élite o hace algo distinto, eso también. */
function sourceOf(enemy: { stats: { kind: EnemyKind }; size: number; behavior: string } | null, fallback: string): string {
  if (!enemy) return fallback;
  return `${enemy.size > 1 ? 'élite ' : ''}${enemy.stats.kind}${enemy.behavior !== 'melee' ? ` (${enemy.behavior})` : ''}`; // i18n-ok: el registro
}
/** La carta, para el registro: clase, cuál y nivel. */
function cardKey(card: Card): string {
  return card.kind === 'heal' ? `curar:${card.id}` : `${card.kind === 'ability' ? 'habilidad' : 'mejora'}:${card.id}:${card.level}`;
}
/** El rebote del escudo le pega al golfista sin enemigo: así el registro lo distingue del hechizo. */
let ricochetHit = false;
/** Cómo quedó el golfista, para el final del registro. */
function buildForLog(): unknown {
  return { abilities: abilities.slots.map((s) => [s.id, s.level]), perks };
}
// la partida que se deja por la mitad (se cierra la pestaña, o R desde la pausa) queda como abandonada
addEventListener('pagehide', () => {
  if (recorder && !recorder.finished && !ended) recorder.finish('abandoned', { score, hp: player?.hp ?? 0, gate: gateHp, build: buildForLog() });
});
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
const ALL_CLUBS = DEV_TOOLS && params.has('palos');
/** Con ?bot en la URL juega solo (src/bot.ts), para mirarlo o para chequear el balance. */
const BOT = DEV_TOOLS && params.has('bot');
/**
 * El espectador (src/net): con ?mirar=CÓDIGO no se juega, se mira la partida de otro con cámara propia.
 * ?transmitir=CÓDIGO es el que juega, transmitiendo (lo pone el botón de invitar). Con &local van entre
 * pestañas del mismo navegador, sin red: para probar.
 */
const WATCH = params.get('mirar');
const NET_LOCAL = params.has('local');
// (la versión de Abe es siempre el que mira, también mientras pide el enlace)
if (WATCH || ABE_ONLY) {
  abilities.remote = true;
  document.body.classList.add('watching');
}
/**
 * El tutorial, mientras dura (ver src/tutorial.ts). La primera vez es lo que empieza el botón grande de la
 * intro; ?tutorial lo fuerza. En las pruebas automáticas no, salvo con ?tutorial.
 */
let tutorial: Tutorial | null = null;
const TUTORIAL_KEY = 'gk.tutorialDone';
function tutorialDone(): boolean {
  try {
    return !!localStorage.getItem(TUTORIAL_KEY);
  } catch {
    return false;
  }
}
const tutorialFirst = params.has('tutorial') || (!tutorialDone() && !navigator.webdriver);
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
  // Los globos (hierro y wedge) miden la distancia sobre el piso plano, no sobre el relieve: así cuánto
  // más lejos cae depende solo de cuánto más arriba está el mouse. Contra el relieve, la cara de una loma
  // tapa su espalda desde la cámara: al subir el mouse por la loma el punto trepaba bien, pero al pasar
  // la cima saltaba para adelante (a la cara de la loma) en vez de seguir hacia atrás. La marca de caída
  // igual se dibuja sobre el terreno, y el globo se calcula para caer ahí.
  const flat = !terrainOn() || isLob(player.club);
  const hit = flat
    ? raycaster.ray.intersectPlane(groundPlane, scratchAim)
    : (aimOnGround(scratchAim) ? scratchAim : null);
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
  dir.normalize();
  // en el tutorial se apunta solo hacia los enemigos del paso
  const range = tutorial?.aimRange(tee);
  if (range) {
    const a = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), range[0], range[1]);
    dir.set(Math.sin(a), 0, Math.cos(a));
  }
  player.aimDir.copy(dir);
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
  if (!terrainOn() || club.loftDeg <= 0.001) return null;
  const angle = THREE.MathUtils.degToRad(club.loftDeg);
  // desde otro lugar (el clon) se calcula contra el terreno de ahí
  if (from) tee.copy(from);
  else player.teePosition(tee);
  if (!isLob(club)) return { speed: launchSpeed(range, angle, club.gravity), angle };
  const teeH = heightAt(tee.x, tee.z);
  const rise = heightAt(tee.x + player.aimDir.x * range, tee.z + player.aimDir.z * range) - teeH;
  // El globo promete pasar por arriba de las lomas: si con su ángulo de siempre el arco se estrella
  // contra una loma antes de llegar, sale más empinado, lo justo para pasarla. Sin esto el hierro (27°)
  // chocaba con la cara de la loma: la marca de caída retrocedía hasta la loma y, al subir el mouse,
  // saltaba de golpe detrás de los enemigos.
  for (let a = angle; a <= LOB_MAX_ANGLE; a += LOB_ANGLE_STEP) {
    const speed = launchSpeed(range, a, club.gravity, rise);
    if (a + LOB_ANGLE_STEP > LOB_MAX_ANGLE || clearsTerrain(range, a, speed, club.gravity ?? GRAVITY, teeH)) return { speed, angle: a };
  }
  return { speed: launchSpeed(range, angle, club.gravity, rise), angle };
}

/** Hasta qué ángulo se empina un globo para pasar una loma, y de a cuánto. */
const LOB_MAX_ANGLE = THREE.MathUtils.degToRad(72);
const LOB_ANGLE_STEP = THREE.MathUtils.degToRad(3);

/**
 * ¿El arco (desde `tee`, hacia `player.aimDir`) pasa por arriba del terreno hasta llegar? Se mira cada
 * cuarto de metro, con un margen chico, hasta casi el punto de caída, y tiene que clavarse ahí.
 */
function clearsTerrain(range: number, angle: number, speed: number, gravity: number, teeH: number): boolean {
  const tan = Math.tan(angle);
  const cos = Math.cos(angle);
  const k = gravity / (2 * speed * speed * cos * cos);
  const over = (d: number) => teeH + BALL_RADIUS + d * tan - k * d * d - heightAt(tee.x + player.aimDir.x * d, tee.z + player.aimDir.z * d);
  for (let d = 0.25; d < range - 0.4; d += 0.25) if (over(d) < 0.15) return false;
  // y que se clave donde apuntaste: detrás de una cima, si la bajada es más empinada que la caída de la
  // pelota, la pelota pasa por arriba del punto y cae más atrás
  return over(range + 0.5) < 0;
}

/** Último nivel de carga que sonó, para tocar una nota solo cuando cambia. */
let lastLevel = 0;

/** Último nivel de calidad que sonó. */
let lastQuality = 0;

/** ¿El golfista está parado en un puesto que tiene pelota? */
function hasBallHere(): boolean {
  // el tenista puede pegar si tiene pelota en el bolsillo o si viene alguna para devolver
  if (tennis) return tennis.canStart();
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
    ? previewRoll(start, { restitution: club.restitution, bounceKeep: club.bounceKeep, gravity: club.gravity, rollFriction: friction }, spin, PREVIEW_POINTS, terrainOn() ? heightAt : undefined)
    : previewOver(start, club.gravity ?? GRAVITY, terrainOn() ? heightAt : () => 0, PREVIEW_POINTS, 4, spin);
}

/**
 * A qué distancia va a pegar el tiro: con eso se calcula el daño que muestran el arco y el cartel. Los
 * globos revientan donde apuntás, así que es la distancia del mouse. El driver y el putter tienen
 * distancia fija y le pegan al que se les cruce: es la del **primer enemigo sobre la línea**, y si no hay
 * nadie, la del mouse. Antes se mostraba siempre el daño a 50 m (el del driver de lejos), aunque el
 * enemigo estuviera a 15.
 */
function impactRange(club: Club, range: number): number {
  if (isLob(club) || club.fixedRange <= 0) return range;
  player.teePosition(tee);
  const dx = player.aimDir.x;
  const dz = player.aimDir.z;
  let best = Infinity;
  for (const e of horde.enemies) {
    if (!e.alive || e.passed) continue;
    const ex = e.position.x - tee.x;
    const ez = e.position.z - tee.z;
    const along = ex * dx + ez * dz;
    const side = Math.abs(ex * dz - ez * dx);
    const reach = e.radius + BALL_RADIUS;
    if (along <= 0 || along > range + reach || side > reach) continue;
    // donde la pelota le toca el costado, no su centro
    best = Math.min(best, Math.max(0, along - Math.sqrt(reach * reach - side * side)));
  }
  if (best < Infinity) return best;
  return THREE.MathUtils.clamp(Math.hypot(aimPoint.x - tee.x, aimPoint.z - tee.z), club.minRange, club.maxRange);
}

function updatePreview(): void {
  const charging = player.mode === 'charging';
  const club = player.club;
  const range = shotRange(club);
  const hitAt = impactRange(club, range);
  const show = started && !ended && player.alive && player.mode !== 'swinging' && !player.grabbedBy;
  previewLine.visible = show;
  landing.visible = show;
  // en carrera la pelota es la del puesto al que va: si no tuviera, la carga ya se habría cortado
  const ballHere = hasBallHere();
  teeBall.visible = show && player.mode === 'charging' && ballHere && !pocket;
  // la barra dice solo la calidad; la distancia y el daño los dice el cursor y el palo
  const quality = qualityOf(player.meter.power);
  // el que atraviesa y además abre área tiene dos números: lo que saca al pegarle y lo que saca el área
  // la potencia y el herrero suman a lo que pega (menos a la pifia, que no sale), y con la fuerza pega
  // por lo menos lo suyo
  const floor = balls.minDamage(club.id);
  const plus = (n: number) => (n > 0 ? Math.max(n, floor) + nextShot.bonus + smithBonus : n);
  const damage = plus(damageFor(club, hitAt, quality));
  const areaHit = plus(areaDamageFor(club, hitAt, quality));
  const echo = nextShot.echoes ? L(` · eco ×${nextShot.echoes}`, ` · echo ×${nextShot.echoes}`) : '';
  // lo que dura unos segundos, con lo que le queda
  const timed = (mightLeft > 0 ? L(` · fuerza ${Math.ceil(mightLeft)} s`, ` · might ${Math.ceil(mightLeft)} s`) : '') + (glove ? ` · ${ELEMENT_INFO[glove.element].name.toLowerCase()} ${Math.ceil(glove.left)} s` : '');
  const dmgLabel = (damage <= 0 && areaHit <= 0
    ? L('pifia: no sale', 'whiff: no shot')
    : club.areaDamage && club.pierces
      ? L(`${damage} al pegarle · ${areaHit} en área`, `${damage} on hit · ${areaHit} area`)
      : L(`${damage} de daño`, `${damage} damage`)) + echo + timed;
  // el palo que pifia con el golpe 1 (el wedge) lo marca en el arco
  const duff = damageFor(club, hitAt, 1) <= 0 && areaDamageFor(club, hitAt, 1) <= 0;
  // tenis: el arco es el del timing, y aparece solo cuando se acerca la pelota (o en el saque)
  if (tennis) {
    const g = tennis.gauge;
    const times = gaugeTimes();
    hud.setMarks(arcLayout(times, times), qualityMarks(), false, [1, 2, 3].map((q) => plus(damageFor(club, hitAt, q))));
    hud.setMeter(!!g && !ended, g ? gaugePower(g.err, qualityMarks()) : 0, !!g?.locked, g ? (g.inReach ? L(`a tiro · ${plus(damageFor(club, hitAt, timingQuality(g.err)))} de daño`, `in reach · ${plus(damageFor(club, hitAt, timingQuality(g.err)))} damage`) : L('no llegás', 'too far')) : '', g && g.err > 0 ? 1 : -1);
    hud.setMeterReach(!g || g.inReach);
    if (g) placeMeter();
  }
  // mientras carga, los tiempos con los que arrancó la carga; si no, los de ahora
  if (!tennis) {
    const levels = Array.from({ length: topQuality() }, (_, i) => i + 1);
    hud.setMarks(arcLayout(player.meter.charging ? player.meter.timing : player.timing, CHARGE), qualityMarks(), duff, levels.map((q) => plus(damageFor(club, hitAt, q))), FOURTH.on ? FOURTH.share : 0);
  }
  // en el tenis, el arco es el del timing (arriba)
  if (!tennis) {
    hud.setMeter(charging, player.meter.power, player.meter.locked, `${hitAt.toFixed(0)} m · ${BAND_NAMES[bandOf(hitAt)]} · ${dmgLabel}`, player.meter.side);
    if (charging) placeMeter();
  }
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
      : previewPath({ x: tee.x, y: 0, z: tee.z }, player.aimDir.x, player.aimDir.z, range, loft, PREVIEW_POINTS, club.gravity, terrainOn() ? heightAt : undefined);
  const pos = previewGeo.attributes.position as THREE.BufferAttribute;
  // el arco se ve siempre, no solo mientras se carga
  path.forEach((p, i) => pos.setXYZ(i, p.x, p.y, p.z));
  pos.needsUpdate = true;
  // la línea toma el color del palo; mientras se carga, el de la calidad del golpe
  const lineColors = FOURTH.on ? (duff ? DUFF_COLORS_4 : QUALITY_COLORS_4) : duff ? DUFF_COLORS : QUALITY_COLORS;
  const lineColor = charging ? lineColors[quality - 1] : club.color;
  previewMat.color.setHex(!ballHere ? 0x6b7480 : lineColor);
  previewMat.size = charging ? (quality >= topQuality() ? 10 : 4 + quality * 1.5) : 5;
  previewMat.opacity = !ballHere ? 0.25 : charging ? 0.95 : 0.3;
  // (la esquiva ya no salta con la carga: salta al soltar o al tirar una habilidad, ver onRelease)
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
/**
 * El arco de carga va donde se mira mientras se carga, no abajo en el HUD: al costado de la cabeza, de la
 * pelota o del camino del tiro, según VISUAL.meterAt (panel B, Visual). Siempre del lado del golfista:
 * así no tapa la pelota ni la línea de tiro, que salen del otro lado.
 */
function placeMeter(): void {
  const ballAt = player.teePosition(new THREE.Vector3());
  const ball = toScreen(ballAt, 0.1);
  const head = toScreen(player.position, 2.1);
  // de qué lado de la pelota está el golfista, en pantalla
  const away = Math.sign(head.x - ball.x) || -1;
  if (VISUAL.meterAt === 'cabeza') {
    hud.placeMeter(head.x + away * 62, head.y);
  } else if (VISUAL.meterAt === 'pelota') {
    hud.placeMeter(ball.x + away * 170, ball.y - 40);
  } else {
    const ahead = toScreen(ballAt.clone().addScaledVector(player.aimDir, 9), 0.4);
    hud.placeMeter(ahead.x + away * 90, ahead.y);
  }
}

function toScreen(pos: THREE.Vector3, height: number): { x: number; y: number } {
  const v = new THREE.Vector3(pos.x, pos.y + height, pos.z).project(camera);
  return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
}

/** Cuánto festeja el golfista, ya sin el cartel encima, antes de que aparezca el de la victoria. */
const VICTORY_CARD_DELAY_MS = 3500;

// cada número del cartel del final suena con la nota siguiente del arpegio de las bajas; al perder, un
// golpe seco. El que mira no: le llegan los sonidos del que juega
if (!WATCH) hud.end.onBeat = (i, result) => (result === 'victory' ? audio.kill(i) : audio.tock(false));
if (!WATCH) hud.end.onUnlock = (max) => audio.unlock(max);

/** El mejor puntaje de este navegador. */
const RECORD_KEY = 'gk.record';
function readRecord(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(RECORD_KEY)) || 0);
  } catch {
    return 0;
  }
}

/**
 * Lo que dice el cartel del final (ver src/endscreen.ts): el puntaje, el récord, los números de la
 * partida (del registro, ver src/telemetry.ts) y cómo quedó la dificultad.
 */
function endInfo(result: 'victory' | 'defeat', title: string, detail: string, level: number, earned: string): EndInfo {
  const before = readRecord();
  // el bot no cuenta para el récord: juega para probar
  const record = !BOT && score > before;
  if (record) {
    try { localStorage.setItem(RECORD_KEY, String(score)); } catch { /* sin localStorage: no se guarda */ }
  }
  const t = recorder?.totals ?? { seconds: gameClock, shots, hits: 0, perfects: 0, damage: 0, abilities: 0, best: 0 };
  const stats: EndStat[] = [
    { label: L('Oleada', 'Wave'), value: result === 'victory' ? director.waveCount : Math.max(1, director.index + 1), of: director.waveCount },
    // desde que arrancó, sin pausas ni cartas (el registro cuenta desde la primera oleada)
    { label: L('Tiempo', 'Time'), value: gameClock, kind: 'time' },
    { label: L('Bajas', 'Kills'), value: kills },
    { label: L('Daño hecho', 'Damage dealt'), value: t.damage },
    { label: L('Puntería', 'Accuracy'), value: t.shots > 0 ? Math.min(100, (100 * t.hits) / t.shots) : 0, kind: 'pct' },
    { label: L('Golpes perfectos', 'Perfect hits'), value: t.perfects },
    { label: L('Mejor tiro', 'Best shot'), value: Math.max(1, t.best), unit: t.best > 1 ? L('bajas', 'kills') : L('baja', 'kill') },
    { label: L('Racha sin errar', 'Hit streak'), value: bestStreak, unit: L('tiros', 'shots') },
    { label: L('Habilidades', 'Abilities'), value: t.abilities },
    { label: L('Puerta', 'Gate'), value: gateHp, of: GATE_MAX },
  ];
  return {
    result, title, detail, score, best: Math.max(before, record ? score : 0), record, stats, earned,
    level: progress.points > 0
      ? L(`Dificultad: jugaste en el nivel ${level} · tenés ${progress.points} de ${MAX_POINTS} desbloqueados`, `Difficulty: you played level ${level} · ${progress.points} of ${MAX_POINTS} unlocked`)
      : '',
  };
}

/** Lo que trae la completa, en el cartel del final de la demo (ver DEMO_LOCKS en src/edition.ts). */
function demoTeaser(): string {
  const n = DEMO_LOCKS.powers.length;
  const cards = LOCKED_CARDS.size;
  return L(
    `En la versión completa, cada partida ganada desbloquea un nivel de dificultad, y vienen ${n} poderes de enemigos más y ${cards} cartas más para el caballero`,
    `In the full game, every win unlocks a difficulty level, and there are ${n} more enemy powers and ${cards} more cards for the knight`,
  );
}

/**
 * Termina la partida. `title` y `detail` van al cartel, en el idioma del jugador; `cause` es lo que guarda
 * el registro: siempre en español (el `detail` de siempre), así se comparan las partidas de los dos idiomas.
 */
function endGame(result: 'victory' | 'defeat', title: string, detail: string, cause: string): void {
  if (ended) return;
  ended = result;
  player.cancelSwing();
  // ya no hay a quién tirarle: el gólem y los hechiceros bajan los brazos
  horde.ceaseFire = true;
  // si se perdió por la puerta, el golfista termina igual que cuando muere: tirado en el piso
  if (result === 'defeat') player.fall();
  // y si ganó, festeja: se da vuelta hacia la ciudad con los brazos en alto
  else player.celebrate();
  // ganar con todos los puntos de dificultad puestos desbloquea un nivel más (el bot no: juega para probar)
  const level = used(progress.picks);
  const earned = result === 'victory' && !BOT && !DEMO && earnPoint(progress);
  if (earned) saveProgress(progress);
  paintDifficulty();
  const info = endInfo(result, title, detail, level, DEMO && result === 'victory' ? demoTeaser() : '');
  // el nivel nuevo revienta al final del cartel (ver src/endscreen.ts)
  if (earned) info.unlock = { level: progress.points, max: MAX_POINTS };
  // al ganar, el cartel espera a que se vea el festejo: tapa la cancha con un velo oscuro
  if (result === 'victory') setTimeout(() => { if (ended === 'victory') hud.showEnd(info); }, VICTORY_CARD_DELAY_MS);
  else hud.showEnd(info);
  recorder?.finish(result, { cause, score, hp: player.hp, gate: gateHp, build: buildForLog() });
  if (result === 'victory') audio.victory();
  else audio.defeat();
}

horde.onEvent = (e) => {
  lastEvent = e.type;
  tutorial?.onEvent(e);
  switch (e.type) {
    case 'damage': {
      recorder?.damage(e.amount, e.killed, !!horde.shot);
      const s = toScreen(e.enemy.position, e.enemy.height);
      // el que cae al hoyo no muestra daño: el «¡Al hoyo!» ya lo dice
      const text = `${e.crit ? '✸ ' : ''}${e.amount}${e.killed ? ' ☠' : ''}`;
      if (!e.swallowed) hud.float(s.x, s.y, text, e.killed || e.crit ? 'kill' : '');
      if (e.killed) {
        // la de un tiro de palo suena desde las pelotas (evento 'kill'), que saben el nivel del golpe y
        // cuántas lleva; las demás (fuego, carrito, hoyo...) suenan acá, como la baja de un golpe 1 (3ra)
        if (!horde.shot) audio.kill(1);
        kills++;
        score += e.enemy.stats.score;
      }
      break;
    }
    case 'divine': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, '✦', 'hurt');
      audio.bounce();
      break;
    }
    case 'detonate': {
      // la marca de Abe: estalla en su color (el daño de más ya va en el número que flota)
      effects.explosion(e.enemy.position.clone().setY(e.enemy.position.y + e.enemy.height * 0.5), 0.9, BOLT_INFO.color);
      audio.zap();
      break;
    }
    case 'armored': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, L('blindado', 'armored'), 'hurt');
      break;
    }
    case 'frozen': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, L('❄ congelado', '❄ frozen'), '');
      audio.frost();
      break;
    }
    case 'powder':
      effects.explosion(e.pos, e.radius, ABILITIES.powder.color);
      audio.explosion();
      break;
    case 'fireBlast':
      effects.explosion(e.pos, e.radius, ELEMENT_INFO.fire.color);
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
      recorder?.hurt(e.amount, sourceOf(e.enemy, ricochetHit ? 'rebote del escudo' : 'hechizo'), false); // i18n-ok: el registro
      if (godMode.godPlayer) player.hp = player.maxHp;
      audio.hurt();
      shake = Math.max(shake, e.enemy?.grabbing ? 0.1 : 0.3);
      const s = toScreen(player.position, 2);
      hud.float(s.x, s.y, Number.isFinite(e.amount) ? `-${e.amount}` : '☠', 'hurt');
      if (!player.alive) {
        const elite = (e.enemy?.size ?? 1) > 1;
        const cause = elite ? 'Te atropelló el élite' : 'Valdehoyo se quedó sin golfista'; // i18n-ok: el registro, en español
        endGame('defeat', L('Caíste en combate', 'You fell in battle'), elite
          ? L('Te atropelló el élite', 'The elite ran you over')
          : L('Valdehoyo se quedó sin golfista', 'Valdehoyo ran out of golfers'), cause);
      }
      break;
    }
    case 'gateHit':
      recorder?.hurt(e.amount, sourceOf(e.enemy, ''), true);
      if (!godMode.godGate) gateHp = Math.max(0, gateHp - e.amount);
      audio.gateHit();
      world.flashDoor();
      hud.gateAlert();
      // el élite que entra la tira abajo de una, le quede la vida que le quede
      if (gateHp <= 0) {
        const elite = e.enemy.size > 1;
        const cause = elite ? 'Entró el élite' : 'Las hordas entraron a Valdehoyo'; // i18n-ok: el registro, en español
        endGame('defeat', L('La puerta cayó', 'The gate fell'), elite
          ? L('Entró el élite', 'The elite got in')
          : L('Las hordas entraron a Valdehoyo', 'The hordes stormed Valdehoyo'), cause);
      }
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
      hud.float(s.x, s.y, Number.isFinite(e.enemy.gateDamage) ? L(`puerta -${e.enemy.gateDamage}`, `gate -${e.enemy.gateDamage}`) : L('puerta ☠', 'gate ☠'), 'hurt');
      break;
    }
    case 'explosion':
      effects.explosion(e.pos, e.radius, 0xffa03c);
      audio.explosion();
      if (e.pos.distanceTo(player.position) < 14) shake = Math.max(shake, 0.25);
      break;
    case 'immune': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, L('inmune', 'immune'), 'hurt');
      break;
    }
    case 'shielded': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, '🛡', 'hurt');
      break;
    }
    case 'grab':
      audio.growl();
      audio.frost();
      effects.frost(player.position, 1.4);
      hud.feedback(L('¡El alma en pena te congeló!', 'The wraith froze you!'), 'bad');
      break;
    case 'release':
      // agarra una vez y se va
      effects.blink(e.enemy.position, 0xb8c4ff);
      audio.whoosh(0.6);
      break;
    case 'dodged':
      audio.whoosh(0.5);
      break;
    case 'rockThrown':
      audio.growl();
      break;
    case 'spellCast':
      audio.zap();
      break;
    case 'spellLanded':
      effects.explosion(e.pos, RANGED.radius, 0xd24dff);
      if (e.hit) shake = Math.max(shake, 0.25);
      break;
    case 'rockLanded':
      effects.explosion(e.pos, 2.2, 0x9a958a);
      shake = Math.max(shake, 0.15);
      break;
    case 'healed': {
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, `+${e.amount}`, 'heal');
      // el que se cura entero: un destello verde (el cuerpo ya brilla), que se vea que perdiste lo hecho
      if (e.enemy.mods.regen) effects.blink(e.enemy.position.clone(), 0x3ee07a);
      break;
    }
    case 'mound':
      shake = Math.max(shake, 0.12);
      hud.feedback(e.settled
        ? L('La loma quedó para siempre. El geomante va para la puerta', 'The hill is here to stay. The geomancer heads for the gate')
        : L('¡El geomante levanta la tierra! Matalo antes de que termine, o la loma queda', "The geomancer is raising a hill! Kill him before he's done or it stays"), 'bad');
      break;
    case 'banner':
      hud.feedback(e.up ? L('¡La bandera en alto! Todos tienen 1 de vida más', 'Banner up! They all get +1 HP') : L('Cayó la bandera', 'Banner down'), e.up ? 'bad' : 'good');
      break;
  }
};

/**
 * Los escudos del pack (shields.glb, armado con tools/props_to_glb.py): cada uno centrado, del tamaño del
 * de madera y mirando para adelante, listo para colgarlo de un enemigo según el nivel de su escudo.
 */
function prepareShields(gltf: GLTF): void {
  for (const [level, name] of Object.entries(SHIELD_MODELS)) {
    const src = gltf.scene.getObjectByName(name);
    if (!src) continue;
    const model = src.clone();
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const holder = new THREE.Group();
    holder.add(model);
    // del ancho del de madera (0.84 en unidades del modelo del enemigo)
    holder.scale.setScalar(0.95 / Math.max(size.x, size.y));
    SHIELD_PROPS.set(Number(level), holder);
  }
}

balls.onEvent = (e) => {
  if (e.type === 'settled' && !e.ability) tutorial?.onShotDone();
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
      if (e.hits > 1) hud.feedback(L(`¡Le pegó a ${e.hits}!`, `Hit ${e.hits} at once!`), 'good');
      break;
    case 'bounce':
      audio.bounce();
      break;
    // tenis: rebotó en un enemigo o en una pared, o quedó en el piso para levantarla
    case 'returned':
    case 'wall':
      audio.bounce();
      break;
    case 'floor':
      audio.bounce();
      break;
    case 'blocked': {
      audio.bounce();
      const s = toScreen(e.enemy.position, e.enemy.height);
      hud.float(s.x, s.y, e.warded ? L('inmune', 'immune') : L('¡Bloqueado!', 'Blocked!'), 'hurt');
      break;
    }
    case 'ricochet': {
      // la que devolvió un escudo cayó: si seguías adentro de la marca, te pega 1, venga como venga
      effects.explosion(e.pos, RICOCHET.radius, RICOCHET_COLOR);
      audio.bounce();
      const hit = player.alive && !player.invulnerable && Math.hypot(player.anchor.x - e.pos.x, player.anchor.z - e.pos.z) <= RICOCHET.radius;
      if (hit) {
        player.hit(RICOCHET.damage, e.pos);
        ricochetHit = true;
        horde.emit({ type: 'playerHit', enemy: null, amount: RICOCHET.damage });
        ricochetHit = false;
      }
      break;
    }
    case 'connected':
      // sin errar: suma apenas pega, sin esperar a que la pelota pare. Así el tiro siguiente ya lo ve
      if (e.ability) break;
      setCleanStreak(cleanStreak + 1);
      break;
    case 'kill': {
      // cada baja sigue el arpegio del golpe hacia arriba: con un golpe 2 (3ra), la primera es la 5ta,
      // la segunda la 8va. Las notas siguen sonando y se arma el acorde
      audio.kill(e.quality - 1 + e.kills);
      // el doblete se canta (y suma) en el acto, cuando cae el segundo; el tercero suma otra vez
      if (e.ability || e.kills < 2) break;
      recorder?.extraKill(e.kills);
      const name = MULTI_KILL[e.kills] ?? L(`¡${e.kills} de un tiro!`, `${e.kills} in one shot!`);
      // el albañil y el herrero: las bajas de más de un mismo tiro. Matar para avanzar es obligatorio;
      // matar a varios de un tiro es lo que se les pide
      const progress: string[] = [];
      if (perks.masonStreak) progress.push(masonStep());
      if (perks.giftPerfect) progress.push(giftStep());
      if (perks.smithStreak) progress.push(smithStep());
      hud.feedback(progress.length ? `${name} ${progress.join(' · ')}` : name, 'good');
      break;
    }
    case 'settled':
      // las rachas cuentan los tiros del puesto, no las habilidades
      if (e.ability) break;
      if (e.hits === 0) setCleanStreak(0);
      else recorder?.hit();
      break;
  }
};

abilities.onEvent = (e) => {
  switch (e.type) {
    case 'cast':
      audio.whoosh(0.7);
      break;
    case 'mark':
      lastLanding = [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1), e.hits];
      audio.explosion();
      if (e.hits) hud.feedback(`${ABILITIES[e.id].name} ×${e.hits}`, e.hits > 2 ? 'good' : 'neutral');
      break;
    case 'swallow':
      audio.thud();
      hud.feedback(L('¡Al hoyo!', 'Hole in one!'), 'good');
      break;
    case 'bump':
      audio.thud();
      break;
  }
};

/** La rueda del mouse recorre los palos habilitados, en círculo. Con teclas se elige directo. */
function cycleClub(delta: number): void {
  if (cardOpen || !player) return;
  const order = CLUB_ORDER.filter((id) => player.unlocked.has(id));
  if (order.length < 2) return;
  const i = order.indexOf((player.pendingClub ?? player.club).id);
  dropNextShot();
  player.setClub(CLUBS[order[(i + delta + order.length) % order.length]]);
}

/** 1, 2, 3 y 4 eligen palo. */
function selectClub(index: number): void {
  // en el que mira, 1 a 4 eligen el hechizo de Abe
  if (WATCH) {
    spectator?.select(index);
    return;
  }
  if (choice) {
    pickCard(index);
    return;
  }
  if (cardOpen || !player || index < 0 || index >= CLUB_ORDER.length) return;
  const id = CLUB_ORDER[index];
  if (!player.unlocked.has(id)) {
    return;
  }
  if (id !== (player.pendingClub ?? player.club).id) dropNextShot();
  player.setClub(CLUBS[id]);
}

/**
 * Q, W, E y R tiran la habilidad de ese lugar **en el acto**, hacia donde está el mouse, con su propia
 * pelota: no gastan la del puesto ni cortan el tiro que se esté cargando. Se puede tirar corriendo entre
 * puestos. Los lugares se llenan eligiendo cartas entre oleadas.
 */
function castAbility(index: number): void {
  // Abe, con teclado: Q, W, E y R tiran ese hechizo ya, donde está el mouse
  if (WATCH) {
    spectator?.quickCast(index);
    return;
  }
  if (!started || paused || ended || cardOpen || !player || index < 0 || index >= SLOTS) return;
  // congelado por el alma en pena, tampoco
  if (!player.alive || player.stunned || player.grabbedBy) return;
  player.teePosition(tee);
  const result = abilities.cast(index, tee, player.aimDir, aimPoint);
  const slot = abilities.slots[index];
  // la esquiva salta también ni bien tirás una habilidad que se apunta (las que no tienen alcance, no).
  // Al golpe fantasma no lo ve venir (4/10)
  if (result === 'ok' && ABILITIES[slot.id].range > 0 && ABILITIES[slot.id].element !== 'ghost') horde.dodgeAim(tee, player.aimDir);
  if (result === 'ok') recorder?.ability();
  // el lugar vacío no dice nada: no hay nada que tirar
  if (result === 'cooling') {
    const name = ABILITIES[slot.id].name;
    const left = abilities.cooldowns[index].toFixed(1);
    hud.feedback(L(`${name} recargando: ${left} s`, `${name} on cooldown: ${left} s`), 'neutral');
  } else if (result === 'blocked') hud.feedback(ABILITIES[slot.id].kind === 'melee' ? L('En pleno swing no hay palazo', "Can't whack mid-swing") : L('No hay palo para tirar ahora', "Can't shoot right now"), 'neutral');
}

// ---------- cartas y mejoras ----------
/** Las mejoras tomadas, y cuántas veces cada una. */
const perks: Partial<Record<PerkId, number>> = {};
/** Las tres cartas en pantalla, o null. */
let choice: Card[] | null = null;
/** El albañil: las bajas de más de cada tiro, juntadas (un doblete suma 1, un triplete 2). */
let masonPoints = 0;
/** El herrero: lo mismo, por su lado, y el daño de más que espera a la próxima pelota de palo. */
let smithPoints = 0;
let smithBonus = 0;

/** Una baja de más para el albañil: cada tantas, la puerta +1. Devuelve qué decir. */
function masonStep(): string {
  const every = PERK_NUMBERS.masonStreak;
  masonPoints++;
  if (masonPoints % every === 0 && (gateHp < GATE_MAX || player.hp < player.maxHp)) {
    gateHp = Math.min(GATE_MAX, gateHp + 1);
    player.heal(1);
    return L('¡Los albañiles! La puerta +1 y vos +1', 'The masons! Gate +1, you +1');
  }
  return L(`Albañil ${masonPoints % every || every}/${every}`, `Mason ${masonPoints % every || every}/${every}`);
}

/** Una baja de más para el perfecto de regalo: cada tantas, el próximo tiro arranca clavado. */
function giftStep(): string {
  const every = PERK_NUMBERS.giftPerfect;
  giftPoints++;
  if (giftPoints % every === 0) {
    player.giftPerfect = true;
    return L('¡Próximo tiro: perfecto!', 'Next shot: perfect!');
  }
  return L(`Perfecto ${giftPoints % every}/${every}`, `Perfect ${giftPoints % every}/${every}`);
}

/** Una baja de más para el herrero: cada tantas, la próxima pelota pega más. Devuelve qué decir. */
function smithStep(): string {
  const every = PERK_NUMBERS.smithStreak;
  smithPoints++;
  if (smithPoints % every === 0) {
    smithBonus += PERK_NUMBERS.smithBonus;
    return L(`¡El herrero! Próxima pelota +${smithBonus}`, `The smith! Next ball +${smithBonus}`);
  }
  return L(`Herrero ${smithPoints % every}/${every}`, `Smith ${smithPoints % every}/${every}`);
}
/** Cómo se canta un tiro que mata a varios; de 5 para arriba, «¡N de un tiro!». */
const MULTI_KILL: Record<number, string> = L(
  { 2: '¡Doblete!', 3: '¡Triplete!', 4: '¡Cuádruple!' },
  { 2: 'Double!', 3: 'Triple!', 4: 'Quadruple!' },
);
/**
 * Tiros seguidos del puesto **sin errar** (le pegaron a alguien, maten o no): el ritmo y «En racha».
 * Suma cuando el tiro conecta y vuelve a 0 cuando uno termina sin pegarle a nadie.
 */
let cleanStreak = 0;
/** La racha más larga de la partida, para el cartel del final. */
let bestStreak = 0;

/** Cambia la racha sin errar y lo que depende de ella: el apuro del ritmo y el bonus de «En racha». */
function setCleanStreak(n: number): void {
  const wasHot = hotStreakOn();
  cleanStreak = n;
  bestStreak = Math.max(bestStreak, n);
  const hot = hotStreakOn();
  if (hot && !wasHot) hud.feedback(L('¡En racha!', 'Hot streak!'), 'good');
  else if (!hot && wasHot) hud.feedback(L('Se cortó la racha', 'Streak broken'), 'bad');
  updateStreakEffects();
}

function hotStreakOn(): boolean {
  return !!perks.hotStreak && cleanStreak >= PERK_NUMBERS.hotStreakShots;
}

function updateStreakEffects(): void {
  updateTiming();
  // suma, pero sin pasar del tope y sin bajar nunca; la pifia (0) no se toca
  balls.hotDamage = hotStreakOn() ? (base) => (base <= 0 ? base : Math.max(base, Math.min(base + PERK_NUMBERS.hotStreakAdd, PERK_NUMBERS.hotStreakCap))) : null;
}
/** El perfecto de regalo: las bajas de más de cada tiro, juntadas, como el albañil. */
let giftPoints = 0;
/** Carcaj: si hay pelota a mano, y cuánto falta para la próxima. */
const quiver = { ready: true, timer: 0 };
/** Caddie dorado: segundos que le quedan. */
let caddieLeft = 0;
/** Fuerza: segundos que le quedan (ver MIGHT). */
let mightLeft = 0;
/** Guante: de qué elemento, de qué nivel y cuántos segundos le quedan (ver GLOVE). */
let glove: { element: Element; level: number; left: number } | null = null;
/** Nivel del palazo que se está dando: lo pone la habilidad al salir, lo usa el golpe al conectar. */
let meleeLevel = 1;

/** Las cartas que la demo no trae: tiros de algunos elementos, los guantes y algunas mejoras (DEMO_LOCKS). */
const LOCKED_CARDS: ReadonlySet<string> = new Set(DEMO ? [
  ...ABILITY_LIST.filter((id) => (DEMO_LOCKS.gloves && ABILITIES[id].kind === 'glove') || DEMO_LOCKS.elements.includes(ABILITIES[id].element as Element)),
  ...DEMO_LOCKS.perks,
] : []);

function build(): Build {
  return { slots: abilities.slots, perks, hp: player.hp, hpMax: player.maxHp, gate: gateHp, gateMax: GATE_MAX, locked: LOCKED_CARDS, cooldown: abilities.cooldownScale };
}

/**
 * Al terminar una oleada salen tres cartas y te quedás con una. El juego queda frenado hasta que
 * elegís, pero el descanso entre oleadas sigue corriendo: si lo pensaste con calma, la oleada arranca
 * apenas elegís.
 */
function offerChoice(): boolean {
  const cards = drawCards(build());
  if (!cards.length) return false;
  recorder?.offered(cards.map(cardKey));
  choice = cards;
  cardOpen = true;
  player.cancelSwing();
  const b = build();
  hud.showChoice(cards.map((c) => describe(c, b)), director.nextTitle);
  return true;
}

function pickCard(i: number): void {
  // en pausa las cartas quedan debajo: ni con el número ni con un click se elige
  if (paused) return;
  const card = choice?.[i];
  if (!card) return;
  choice = null;
  cardOpen = false;
  hud.hideChoice();
  recorder?.picked(cardKey(card));
  applyCard(card);
}

function applyCard(card: Card): void {
  const d = describe(card);
  if (card.kind === 'ability') {
    // desde el panel se puede pedir una quinta: no hay lugar, y se avisa en vez de perderla callada
    if (!abilities.learn(card.id)) {
      hud.feedback(L(`${d.name}: no hay lugar (o ya está en el nivel máximo)`, `${d.name}: no room (or already max level)`), 'neutral');
      return;
    }
    const slot = abilities.slots.findIndex((s) => s.id === card.id);
    hud.feedback(card.level > 1 ? L(`${d.name}: nivel ${card.level}`, `${d.name}: level ${card.level}`) : L(`${d.name} en la ${ABILITY_KEYS[slot]}`, `${d.name} on ${ABILITY_KEYS[slot]}`), 'good');
  } else if (card.kind === 'perk') {
    perks[card.id] = (perks[card.id] ?? 0) + 1;
    applyPerks();
    hud.feedback(d.name, 'good');
  } else if (card.id === 'gate') {
    gateHp = Math.min(GATE_MAX, gateHp + HEALS.gate);
    hud.feedback(L('Los albañiles remiendan la puerta', 'The masons patch up the gate'), 'good');
  } else {
    player.heal(HEALS.player);
    hud.feedback(L('Recuperás el aliento', 'You catch your breath'), 'good');
  }
}

/** Pasa las mejoras tomadas a los números del juego. Se llama cada vez que se toma una. */
function applyPerks(): void {
  BALLS.max = 3 + (perks.extraBall ?? 0);
  if (pocket) pocket.max = TENNIS.pocketMax + (perks.extraBall ?? 0);
  abilities.secondWind.owned = !!perks.secondWind;
  horde.mastery.ice = !!perks.masteryIce;
  horde.mastery.fire = !!perks.masteryFire;
  horde.mastery.lightning = !!perks.masteryLightning;
  updateStreakEffects();
}

/**
 * Los tiempos de la barra con las mejoras: la muñeca apura el débil, el ritmo (según la racha) el débil y
 * el medio, y el punto dulce alarga el fuerte.
 */
function currentTiming() {
  const wrist = Math.pow(PERK_NUMBERS.quickWrist, perks.quickWrist ?? 0);
  const rhythm = perks.rhythm ? 1 - PERK_NUMBERS.rhythmStep * Math.min(cleanStreak, PERK_NUMBERS.rhythmMax) : 1;
  return timingWith(CHARGE, {
    weakMul: wrist,
    lowMul: rhythm,
    strongMul: Math.pow(PERK_NUMBERS.sweetSpot, perks.sweetSpot ?? 0),
  });
}

function updateTiming(): void {
  player.timing = currentTiming();
}

/**
 * Botiquín: al terminar una oleada, la puerta y vos se curan un poco por cada vez que lo tomaste. Es la
 * curación automática de antes, ahora como carta; si algún día hay personajes, es candidato a poder
 * inicial del más fácil (como la sangre del Ironclad en Slay the Spire).
 */
function medkitHeal(): void {
  const n = perks.medkit ?? 0;
  if (!n) return;
  const gate = Math.min(GATE_MAX - gateHp, n * PERK_NUMBERS.medkitGate);
  const hp = Math.min(player.maxHp - player.hp, n * PERK_NUMBERS.medkitPlayer);
  gateHp += gate;
  player.heal(hp);
  if (gate > 0 || hp > 0) {
    const parts = [gate ? L(`la puerta +${gate}`, `gate +${gate}`) : '', hp ? L(`vos +${hp}`, `you +${hp}`) : ''];
    hud.feedback(`${L('Botiquín', 'First-aid kit')}: ${parts.filter(Boolean).join(' · ')}`, 'good');
  }
}

/** Al terminar cada escenario: la puerta recupera `SCENARIO_HEAL.gate` y el golfista, toda su vida. */
const SCENARIO_HEAL = { gate: 7 };
function scenarioHeal(): void {
  const gate = Math.min(GATE_MAX - gateHp, SCENARIO_HEAL.gate);
  gateHp += gate;
  player.heal(player.maxHp);
  hud.feedback(gate > 0
    ? L(`Fin del escenario: la puerta +${gate}, y vos a pleno`, `Stage cleared: gate +${gate}, you at full HP`)
    : L('Fin del escenario: vos a pleno', 'Stage cleared: you at full HP'), 'good');
}

/** Carcaj: vas a pegar donde no hay pelota y te aparece una a los pies, si está lista. */
function useQuiver(): void {
  if (pocket) {
    // en el tenis el carcaj pone una en el bolsillo, si está vacío
    if (!perks.quiver || !quiver.ready || pocket.count > 0) return;
    quiver.ready = false;
    quiver.timer = PERK_NUMBERS.quiverCooldown;
    pocket.add(1);
    hud.feedback(L('Carcaj', 'Quiver'), 'neutral');
    return;
  }
  if (!perks.quiver || !quiver.ready || !player.atSpot || hasBallHere()) return;
  quiver.ready = false;
  quiver.timer = PERK_NUMBERS.quiverCooldown;
  tees.place(player.spotIndex);
  audio.bounce();
  hud.feedback(L('Carcaj', 'Quiver'), 'neutral');
}

// ---------- modo tenis ----------
/** El golpe del tenis (ver src/tennis/play.ts): null en el golf. */
const tennis = pocket && court ? new TennisPlay({
  scene, camera, balls, pocket, court,
  player: () => player,
  clock: () => gameClock,
  active: () => started && !ended,
  whoosh: (power) => audio.whoosh(power),
  bounce: () => audio.bounce(),
  feedback: (text, tone) => hud.feedback(text, tone),
  blink: (pos) => effects.blink(pos, 0xe8ff6a),
}) : null;

/** -1, 0 o +1: A/izquierda o D/derecha apretadas, en pantalla. */
function heldRight(): number {
  const k = input.keys;
  return (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
}

/**
 * Las fichas de las mejoras tomadas, para la columna del HUD: las que saltan solas muestran cuánto les
 * falta, y las rachas, cuánto llevás.
 */
/** Cuántas bajas de más lleva una mejora que las junta (el albañil, el herrero, el perfecto de regalo). */
const doubles = L(
  (points: number, every: number) => `dobletes ${points % every}/${every}`,
  (points: number, every: number) => `doubles ${points % every}/${every}`,
);
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
        chip.status = chip.ready ? L('¡listo!', 'ready!') : doubles(giftPoints, PERK_NUMBERS.giftPerfect);
        break;
      case 'quiver':
        chip.ready = quiver.ready;
        chip.status = quiver.ready ? L('lista', 'ready') : `⟳ ${Math.ceil(quiver.timer)} s`;
        chip.cooling = quiver.ready ? 0 : quiver.timer / PERK_NUMBERS.quiverCooldown;
        break;
      case 'secondWind': {
        const left = abilities.secondWind.left;
        chip.ready = left <= 0;
        chip.status = chip.ready ? L('listo', 'ready') : `⟳ ${Math.ceil(left)} s`;
        chip.cooling = left / PERK_NUMBERS.secondWindCooldown;
        break;
      }
      case 'rhythm': {
        const k = Math.min(cleanStreak, PERK_NUMBERS.rhythmMax);
        chip.status = L(`racha ${k}/${PERK_NUMBERS.rhythmMax}`, `streak ${k}/${PERK_NUMBERS.rhythmMax}`);
        chip.ready = k >= PERK_NUMBERS.rhythmMax;
        break;
      }
      case 'masonStreak':
        chip.status = doubles(masonPoints, PERK_NUMBERS.masonStreak);
        break;
      case 'smithStreak': {
        const count = doubles(smithPoints, PERK_NUMBERS.smithStreak);
        chip.ready = smithBonus > 0;
        chip.status = chip.ready ? L(`¡próxima +${smithBonus}! · ${count}`, `next +${smithBonus}! · ${count}`) : count;
        break;
      }
      case 'medkit': {
        const gate = n * PERK_NUMBERS.medkitGate;
        const hp = n * PERK_NUMBERS.medkitPlayer;
        chip.status = L(`+${gate} puerta · +${hp} vida`, `+${gate} gate · +${hp} HP`);
        break;
      }
      case 'hotStreak': {
        chip.ready = hotStreakOn();
        const bonus = L(`+${PERK_NUMBERS.hotStreakAdd} hasta ${PERK_NUMBERS.hotStreakCap}`, `+${PERK_NUMBERS.hotStreakAdd} up to ${PERK_NUMBERS.hotStreakCap}`);
        chip.status = chip.ready ? L(`¡en racha! ${bonus}`, `hot streak! ${bonus}`) : L(`sin errar ${cleanStreak}/${PERK_NUMBERS.hotStreakShots}`, `no misses ${cleanStreak}/${PERK_NUMBERS.hotStreakShots}`);
        break;
      }
      case 'extraBall':
        chip.status = `+${n}`;
        break;
    }
    out.push(chip);
  }
  return out;
}

/**
 * Lo armado para el próximo tiro (el eco y la potencia). Se gasta al pegar, y se pierde si cancelás el
 * tiro, cambiás de palo o pifiás: así no hay reintentos.
 */
const nextShot = { echoes: 0, bonus: 0 };
/** Los ecos que faltan salir, con el reloj de juego (no corre en pausa). */
const echoQueue: { at: number; shot: Shot; range: number; lift: ReturnType<typeof shotLift> }[] = [];

function dropNextShot(): void {
  if (!nextShot.echoes && !nextShot.bonus) return;
  hud.feedback(nextShot.echoes && nextShot.bonus
    ? L('Se perdieron el eco y la potencia', 'Echo and boost lost')
    : nextShot.echoes ? L('Se perdió el eco', 'Echo lost') : L('Se perdió la potencia', 'Boost lost'), 'bad');
  nextShot.echoes = 0;
  nextShot.bonus = 0;
}

/** Sale el eco que toque: el mismo tiro, desde el mismo lugar y hacia el mismo lado. */
function fireEchoes(): void {
  for (let i = echoQueue.length - 1; i >= 0; i--) {
    const e = echoQueue[i];
    if (e.at > gameClock) continue;
    echoQueue.splice(i, 1);
    audio.tock(e.shot.quality >= topQuality());
    effects.blink(e.shot.from.clone(), ABILITIES.echo.color);
    balls.fire(e.shot, e.range, e.lift);
  }
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

if (!ABE_ONLY) abilities.hooks = {
  fireShot(clubId: ClubId, level: number, element: Element) {
    const club = CLUBS[clubId];
    player.teePosition(tee);
    const range = shotRange(club);
    // el wedge saltea la pifia: su nivel 1 sale con el golpe 2
    const quality = shotQuality(clubId, level);
    audio.tock(quality >= QUALITY_LEVELS);
    balls.fire({ club, quality, level, power: 1, curve: 0, element, ability: true, from: tee.clone(), dir: player.aimDir.clone() }, range, shotLift(club, range));
  },
  fillSpots() {
    if (pocket) {
      for (let i = 0; i < POCKET_RAIN; i++) pocket.toss(player.anchor);
      hud.feedback(L(`¡Lluvia de pelotas! +${POCKET_RAIN}`, `Ball shower! +${POCKET_RAIN}`), 'good');
      return POCKET_RAIN;
    }
    const n = tees.fillAll();
    if (n) hud.feedback(L(`¡Lluvia de pelotas! +${n}`, `Ball shower! +${n}`), 'good');
    return n;
  },
  startCaddie(seconds: number) {
    caddieLeft = seconds;
    hud.feedback(L('¡Caddie dorado!', 'Golden caddie!'), 'good');
  },
  placeClone,
  melee(level: number) {
    meleeLevel = level;
    return player.startMelee();
  },
  armEcho(shots: number) {
    nextShot.echoes = Math.max(nextShot.echoes, shots);
    hud.feedback(shots > 1 ? L(`Eco ×${shots}`, `Echo ×${shots}`) : L('Eco', 'Echo'), 'good');
  },
  armBoost(bonus: number) {
    nextShot.bonus = Math.max(nextShot.bonus, bonus);
    hud.feedback(L(`Potencia +${bonus}`, `Boost +${bonus}`), 'good');
  },
  startMight(seconds: number) {
    mightLeft = seconds;
    hud.feedback(L(`¡Fuerza! Todo pega ${MIGHT.floor} o más`, `Might! Every hit deals ${MIGHT.floor}+`), 'good');
  },
  startGlove(element: Element, level: number, seconds: number) {
    // uno nuevo reemplaza al que estaba: la pelota lleva un solo elemento
    glove = { element, level, left: seconds };
    // en inglés el elemento va adelante: «Fire Glove!»
    const adj = ELEMENT_INFO[element].adj;
    hud.feedback(L(`¡Guante ${adj}!`, `${adj} Glove!`), 'good');
  },
};

/** La fuerza: lo mínimo que pega una pelota de este palo que sale ahora (0 = sin fuerza). */
balls.minDamage = (club) => (mightLeft > 0 ? (club === 'putter' ? MIGHT.putter : MIGHT.floor) : 0);
/** El elemento compartido: el efecto sale del total de lo que tenés de ese elemento (ver core/abilities). */
balls.elementTotal = (element) => elementTotal(abilities.slots, element);
/** Las maestrías mixtas que tenés. */
balls.partners = (element) => mixPartners(perks, element);

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

function saveTutorialDone(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch { /* la próxima vez sale de nuevo */ }
}

/** Terminó el tutorial (o se cortó desde el panel): vuelven los cuatro palos y arranca la partida. */
function finishTutorial(): void {
  tutorial = null;
  saveTutorialDone();
  for (const id of CLUB_ORDER) player.unlocked.add(id);
  player.setClub(CLUBS.driver);
  hud.showBanner(L('¡A defender Valdehoyo!', 'Defend Valdehoyo!'), L('Que no lleguen a la puerta', "Don't let them reach the gate"), 2.5);
}

function dismissCard(): void {
  if (!cardOpen) return;
  cardOpen = false;
  hud.hideCard();
}

/**
 * Empieza la partida. `quiet`: arranca sola, sin un click (reiniciando con alguien mirando). El navegador no
 * deja prender el sonido sin un click o una tecla: se prende con el primero.
 */
async function startGame(withTutorial = false, quiet = false): Promise<void> {
  if (started) return;
  started = true;
  difficultyMenu.hide();
  if (difficultyMenu.dirty) rebuildRun();
  // la recarga de las habilidades, con la dificultad («Recarga lenta»); el tenis no tiene dificultad
  abilities.cooldownScale = TENNIS_ON ? 1 : rules.cooldown;
  if (quiet) {
    const unlock = () => {
      removeEventListener('pointerdown', unlock, true);
      removeEventListener('keydown', unlock, true);
      void audio.start().then(() => audio.startMusic());
    };
    addEventListener('pointerdown', unlock, true);
    addEventListener('keydown', unlock, true);
  } else {
    await audio.start();
    audio.startMusic();
  }
  overlay.hidden = true;
  if (withTutorial && !TENNIS_ON) {
    tutorial = new Tutorial({
      horde,
      player: () => player,
      tees,
      hud,
      onlyClub(id) {
        player.unlocked.clear();
        player.unlocked.add(id);
        player.setClub(CLUBS[id]);
      },
      finish: finishTutorial,
    });
    tutorial.start();
    return;
  }
  // el que lo salteó ya no lo ve primero (el tenis no cuenta: ese no tiene tutorial)
  if (!TENNIS_ON) saveTutorialDone();
  // con ?palos, para probar: arranca eligiendo una carta
  if (ALL_CLUBS) offerChoice();
  if (BOT) {
    const { startBot } = await import('./bot');
    startBot();
    hud.feedback(L('Juega el bot', 'Bot playing'), 'neutral');
  }
}

/**
 * Panel de balance (tecla B): toca los números del juego en vivo y trae los botones de prueba. Se arma
 * una sola vez, cuando ya hay golfista.
 */
let debugPanel: DebugPanel | null = null;
// sin las herramientas de prueba (la demo, la de Abe), tampoco su botón
if (!DEV_TOOLS) document.getElementById('balancebtn')?.remove();
function makeDebugPanel(): DebugPanel {
  return new DebugPanel({
    director,
    difficultyPoints: {
      get: () => progress.points,
      set(points) {
        progress.points = points;
        // si ya no alcanzan, se sacan de los últimos talentos
        const keep = { ...progress.picks };
        progress.picks = {};
        for (const t of TALENTS) setLevel(progress, t.id, keep[t.id] ?? 0);
        saveProgress(progress);
        difficultyMenu.refresh();
      },
    },
    flags: godMode,
    refreshEnemies() {
      // los enemigos comparten el objeto de ENEMIES, así que la velocidad y el daño ya les llegaron
      // solos: lo único que se copió al aparecer, y hay que emparejar, es la vida.
      for (const e of horde.enemies) {
        if (!e.alive) continue;
        // la del tipo, más lo que sumen sus modificadores y la bandera
        e.maxHp = Math.max(1, e.stats.hp + (e.mods.hp ?? 0)) + (e.bannered ? 1 : 0);
        e.hp = Math.max(1, Math.min(e.hp, e.maxHp));
      }
    },
    goToWave(index) {
      tutorial?.stop();
      for (const e of horde.enemies) e.state = 'gone';
      // si ya habías perdido (o ganado), la partida vuelve: el golfista se levanta y la puerta se arregla
      if (ended) {
        ended = null;
        horde.ceaseFire = false;
        hud.hideEnd();
        player.revive();
        gateHp = GATE_MAX;
      }
      director.goTo(index);
      hud.showBanner(waveTitle(index + 1), L('saltada desde el panel', 'skipped from the panel'), 2);
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
    abeGrant: () => abe.grantPick(),
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
    applyVisual: () => visuals.apply(),
    fps: () => frameTimes.filter((t) => performance.now() - t < 1000).length,
    timing: currentTiming,
    tennis: TENNIS_ON,
    switchMode: () => switchMode(!TENNIS_ON),
  });
}

/** El botón (y la N) de todo el sonido: música y efectos, en el que juega y en el que mira. */
const muteBtn = document.getElementById('muteall') as HTMLButtonElement;
function showAllSound(): void {
  muteBtn.textContent = audio.allMuted ? L('🔇 Sin sonido (N)', '🔇 Muted (N)') : L('🔊 Sonido (N)', '🔊 Sound (N)');
}
function toggleAllSound(): void {
  audio.toggleAll();
  showAllSound();
}
showAllSound();
muteBtn.addEventListener('click', (e) => {
  (e.currentTarget as HTMLElement).blur();
  toggleAllSound();
});

function togglePause(): void {
  if (!started || ended) return;
  paused = !paused;
  player.cancelSwing();
  hud.setPause(paused);
  if (paused) audio.pause();
  else audio.resume();
}

/**
 * La versión de Abe (ver src/edition.ts): el teclado solo elige y tira sus hechizos (1 a 4, Q W E R), lo
 * lleva por la cancha (flechas) y apaga el sonido, como al que mira desde la completa.
 */
const abeKeys: InputEvents = {
  swingStart() {},
  swingRelease() {},
  swingCancel() {},
  castAbility: (i) => spectator?.quickCast(i),
  selectClub: (i) => spectator?.select(i),
  tiltCamera() {},
  raiseCamera: (d) => spectator?.cam.walk(d * 3),
  debugPanel() {},
  space() {},
  // la R es el cuarto hechizo
  restart: () => spectator?.quickCast(3),
  pause() {},
  muteToggle() {
    if (audio.ready) audio.toggleMute();
  },
  muteAll: toggleAllSound,
  skin() {},
  step() {},
};

const input = new Input(ABE_ONLY ? abeKeys : {
  swingStart() {
    if (!started || paused || ended || cardOpen) return;
    useQuiver();
    // tenis: te preparás para devolver la que viene, o tirás una para arriba para sacar
    if (tennis) {
      if (player.mode === 'charging') return;
      if (!tennis.press()) {
        hud.feedback(L('¡Sin pelota!', 'No ball!'), 'bad');
        return;
      }
      // si todavía no puede (terminando el golpe anterior, aturdido), no hay nada preparado
      player.startSwing();
      if ((player.mode as string) !== 'charging') tennis.cancel();
      return;
    }
    player.startSwing();
  },
  swingRelease() {
    // tenis: el golpe sale cuando llega la pelota (o la del saque, arriba)
    if (tennis && started && !paused && !ended) {
      tennis.release();
      return;
    }
    if (started && !paused && !ended && player.mode === 'charging') {
      audio.whoosh(player.meter.power);
      player.releaseSwing();
    }
  },
  swingCancel() {
    if (player?.mode === 'charging') dropNextShot();
    tennis?.cancel();
    player?.cancelSwing();
  },
  castAbility,
  selectClub,
  tiltCamera,
  raiseCamera,
  debugPanel() {
    if (!WATCH) debugPanel?.toggle();
  },
  space() {
    // con el menú de dificultad abierto, el Espacio no arranca la partida
    if (difficultyMenu.open) return;
    if (!started) intro.advance();
    else if (cardOpen && !choice) dismissCard();
    else lockSwing();
  },
  step(right) {
    // en el tutorial el golfista se queda en su puesto, salvo en el paso de ir a buscar la pelota (y
    // cargando, en el de correrse con la pelota)
    if (tutorial && !(player?.mode === 'charging' ? tutorial.canShift : tutorial.canMove)) return;
    if (started && !paused && !ended && !cardOpen && player) player.step(-right);
  },
  restart() {
    // R solo desde la pausa o desde el cartel del final, que son los dos lugares que la ofrecen. En
    // pleno juego un toque de más te borraba la partida sin preguntar nada
    if (difficultyMenu.open) return;
    // al final, la R es «Jugar de nuevo»: arranca otra partida en el acto
    if (started && ended) playAgain();
    else if (started && paused) {
      // desde la pausa vuelve a la pantalla de inicio. Con Abe (o alguien mirando): se les avisa, y la
      // partida nueva arranca sola, así nadie se queda esperando
      if (netHost?.restarting()) sessionStorage.setItem(AUTOSTART_KEY, '1');
      location.reload();
    }
    // en pleno juego la R es el cuarto lugar de habilidad
    else castAbility(3);
  },
  pause() {
    if (difficultyMenu.open) difficultyMenu.hide();
    else togglePause();
  },
  muteToggle() {
    if (audio.ready) audio.toggleMute();
  },
  muteAll: toggleAllSound,
  skin() {
    if (!paused && !WATCH) void cycleSkin();
  },
}, renderer.domElement);

// ---------- carga ----------
const loader = new GLTFLoader();


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
  { id: 'guard2', name: L('Guardia del castillo', 'Castle guard'), url: `${MODELS}player.glb` },
  { id: 'guard3', name: L('Guardia veterano', 'Veteran guard'), url: `${MODELS}player-guard3.glb` },
  { id: 'knight', name: L('Caballero', 'Knight'), url: `${MODELS}dungeon.glb`, mesh: 'Character_Hero_Knight_Male' },
  { id: 'knightF', name: L('Caballera', 'Lady knight'), url: `${MODELS}dungeon.glb`, mesh: 'Character_Hero_Knight_Female' },
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
  const p = new Player(root, gltf.animations, scene, clubModel && !pocket ? clubModel.clone() : null);
  p.spotXs = tees.spots.map((s) => s.x);
  if (pocket) {
    // el tenista: raqueta, y camina libre de costado
    p.rig.useRacket();
    // con getters: lo que se toque en el panel entra en el acto, sin recargar
    p.freeMove = {
      get speed() { return TENNIS.runSpeed; },
      get charging() { return TENNIS.chargeMove; },
      half: FIELD_HALF_WIDTH - 1,
    };
  }
  // la versión de Abe no le pega a nada: el caballero de verdad juega en la compu del otro (ver src/edition.ts)
  if (!ABE_ONLY) {
    p.canFire = () => {
      if (tennis) return tennis.fire();
      const i = p.stanceSpot();
      return i >= 0 && tees.take(i);
    };
    p.canStart = () => hasBallHere();
    // la pifia: un golpe que con ese palo no pega nada (el golpe 1 del wedge) no sale. La pelota se queda
    // en el puesto y cuenta como errar
    p.duffs = (club, quality) => {
      // en el tenis no hay pifia: el nivel lo da el timing
      if (tennis) return false;
      const range = shotRange(club);
      return damageFor(club, range, quality) <= 0 && areaDamageFor(club, range, quality) <= 0;
    };
    p.onDuff = () => {
      // la pifia también gasta el eco y la potencia
      dropNextShot();
      audio.duff();
      hud.feedback(L('¡Pifia!', 'Whiff!'), 'bad');
      setCleanStreak(0);
      tutorial?.onDuff();
    };
    // la esquiva salta ni bien soltás (pifie o no): siempre, si está lista. Se le gana haciéndola saltar
    // con un tiro cualquiera y pegándole con el que importa antes de que recargue. Al tiro fantasma (el
    // guante fantasma) no lo ve venir
    p.onRelease = () => {
      if (tennis || glove?.element === 'ghost') return;
      p.teePosition(tee);
      horde.dodgeAim(tee, p.aimDir);
    };
    p.onWhiff = () => {
      audio.whoosh(0.3);
      hud.feedback(L('¡Sin pelota!', 'No ball!'), 'bad');
    };
    p.onShot = (shot) => {
      // tenis: el nivel lo decidió el timing, y quizás es una que volvía
      const t = tennis?.shot();
      if (t) shot = { ...shot, quality: t.quality };
      shots++;
      // el perfecto es el golpe más alto que hay: el 3, o el 4 con su talento
      recorder?.shot(shot.quality >= QUALITY_LEVELS);
      audio.tock(shot.quality >= topQuality());
      if (shot.quality >= topQuality()) hud.feedback(shot.quality > QUALITY_LEVELS ? L('¡Golpe 4!', 'Hit 4!') : L('¡Golpe perfecto!', 'Perfect hit!'), 'good');
      const range = shotRange(shot.club);
      // la potencia y el herrero van en este tiro, y el eco lo repite igual (con eso incluido). El herrero
      // se gasta recién acá, cuando sale la pelota: cancelar, cambiar de palo o pifiar no lo tocan
      const bonus = nextShot.bonus + smithBonus;
      if (bonus) shot = { ...shot, bonus };
      smithBonus = 0;
      // el guante: el tiro lleva su elemento, al nivel del guante, y pega como siempre (el eco y el clon, igual)
      if (glove) shot = { ...shot, element: glove.element, level: glove.level, gloved: true };
      // tenis: si le pegó a una que venía de vuelta, esa ya está en la raqueta y sale como un saque, desde
      // tu lugar y por donde marca la línea de tiro
      const back = t?.back ?? null;
      const lift = shotLift(shot.club, range);
      const fired = balls.fire(shot, range, lift);
      tennis?.fired(fired);
      if (back) {
        fired.rally = back.rally + 1;
        balls.retire(back);
        const bonus = Math.floor(fired.rally / TENNIS.rallyStep);
        const s = toScreen(fired.mesh.position, 0.8);
        hud.float(s.x, s.y, bonus ? `×${fired.rally} +${bonus}` : `×${fired.rally}`, bonus ? 'kill' : '');
      }
      for (let k = 1; k <= nextShot.echoes; k++) {
        echoQueue.push({ at: gameClock + k * ECHO.delay, shot: { ...shot, ability: true, from: shot.from.clone(), dir: shot.dir.clone() }, range, lift });
      }
      nextShot.echoes = 0;
      nextShot.bonus = 0;
      // el clon repite el tiro desde donde quedó, **hacia el mouse**: las dos pelotas se cruzan donde
      // apuntaste. Con el palo de distancia fija, solo la dirección
      if (clone && clone.shots > 0) {
        const from = clone.pos.clone();
        const dx = aimPoint.x - from.x;
        const dz = aimPoint.z - from.z;
        const len = Math.hypot(dx, dz);
        // para atrás no se tira: si el mouse queda detrás del clon, sale para el mismo lado que el tuyo
        const dir = len > 0.5 && dz > 0.3 ? new THREE.Vector3(dx / len, 0, dz / len) : shot.dir.clone();
        const cloneRange = shot.club.fixedRange > 0 ? range : THREE.MathUtils.clamp(len, shot.club.minRange, shot.club.maxRange);
        balls.fire({ ...shot, from, dir }, cloneRange, shotLift(shot.club, cloneRange, from));
        effects.blink(from, ABILITIES.clone.color);
        if (--clone.shots <= 0) removeClone();
      }
    };
    p.onGift = () => audio.chargeTick(topQuality());
    // Palazo (una habilidad más): no hace daño. Empuja hacia atrás a todo lo que haya alrededor de un punto
    // un paso adelante del golfista, hacia donde apunta.
    p.onMelee = () => {
      const radius = lv(PALAZO.radius, meleeLevel);
      const center = p.position.clone().addScaledVector(p.aimDir, 1);
      const targets = horde.nearest(center, radius, new Set(), PALAZO.targets);
      effects.swipe(center, radius);
      audio.whoosh(0.9);
      const dir = new THREE.Vector3();
      for (const e of targets) {
        // los manda hacia atrás, por donde vinieron, apenas abiertos hacia el costado de donde estaban
        dir.set((e.position.x - p.position.x) * 0.25, 0, 1).normalize();
        e.shove(dir, PALAZO.knockback);
        // es el botón de sacárselos de encima: además les corta el ataque
        e.stagger(lv(PALAZO.stagger, meleeLevel));
      }
      if (targets.length) {
        audio.thud();
        shake = Math.max(shake, 0.12);
        hud.feedback(targets.length > 1 ? L(`¡Palazo! ×${targets.length}`, `Whack! ×${targets.length}`) : L('¡Palazo!', 'Whack!'), 'neutral');
      }
    };
  }
  return p;
}

let swappingSkin = false;

/** Cambia el modelo del golfista sin tocar la partida: misma posición, vida y palo. */
async function cycleSkin(delta = 1, save = true): Promise<void> {
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
    fresh.timing = player.timing;
    fresh.giftPerfect = player.giftPerfect;
    fresh.onGift = player.onGift;
    fresh.setClub(player.club);
    fresh.aimDir.copy(player.aimDir);
    player.dispose(scene);
    player = fresh;
    skinIndex = next;
    if (save) localStorage.setItem(SKIN_KEY, SKINS[next].id);
    hud.setSkin(SKINS[next].name);
    // el botón ya no dice el nombre (no entra en la barra de arriba): se avisa al cambiarlo
    if (save) hud.feedback(`Skin: ${SKINS[next].name}`, 'neutral');
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
  const [clubGltf, guardGltf, dungeon, shieldsGltf] = await Promise.all([optional(`${MODELS}club.glb`), loadGltf(`${MODELS}guard.glb`).catch(() => null), loadGltf(`${MODELS}dungeon.glb`), optional(`${MODELS}shields.glb`)]);
  if (shieldsGltf) prepareShields(shieldsGltf);
  clubModel = clubGltf?.scene ?? null;
  player = await makePlayer(SKINS[skinIndex]).catch(() => {
    // si el skin guardado ya no existe, vuelve al primero
    skinIndex = 0;
    return makePlayer(SKINS[0]);
  });
  player.placeAt(tees.centerIndex);
  // arranca con una pelota a los pies y dos a los costados (el tenista, con la del bolsillo)
  if (!pocket) for (const d of [0, -2, 2]) tees.place(tees.centerIndex + d);
  if (guardGltf) {
    world.addGuards(scene, guardGltf);
    tees.guards = GUARD_POSTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  }
  if (pocket) pocket.guards = GUARD_POSTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  for (const k of kinds) measured[k] = +horde.register(k, dungeon).toFixed(3);
  hud.setClub(player.club);
  hud.setSkin(SKINS[skinIndex].name);
  hud.onSkinClick = () => void cycleSkin();
  if (!ABE_ONLY) {
    hud.onCardDismiss = dismissCard;
    hud.onPick = pickCard;
  }
  if (DEV_TOOLS) debugPanel = makeDebugPanel();
  player.update(0);
}

// ---------- inicio ----------
const overlay = document.getElementById('overlay')!;
/** Reiniciando con alguien mirando, la partida nueva arranca sola (ver `restart`). */
const AUTOSTART_KEY = 'gk.autostart';

/**
 * «Jugar de nuevo», en el cartel del final (el botón o la R): otra partida que arranca sola, sin pasar
 * por la pantalla de inicio, con la dificultad que haya quedado puesta (la llama está ahí mismo, en el
 * cartel). Si hay alguien mirando se le avisa, y se queda para la nueva.
 */
function playAgain(): void {
  netHost?.restarting();
  try {
    sessionStorage.setItem(AUTOSTART_KEY, '1');
  } catch { /* sin sessionStorage: vuelve a la pantalla de inicio */ }
  location.reload();
}
document.getElementById('again')?.addEventListener('click', (e) => {
  (e.currentTarget as HTMLElement).blur();
  if (ended && !difficultyMenu.open) playAgain();
});
const intro = new Intro((withTutorial) => {
  if (!WATCH && !ABE_ONLY) void startGame(withTutorial);
}, tutorialFirst && !TENNIS_ON, TENNIS_ON, () => switchMode(!TENNIS_ON), !!WATCH || ABE_ONLY);
// el espectador no tiene intro: entra directo a mirar. La versión de Abe sin sala pide el enlace
if (WATCH) overlay.hidden = true;
else if (ABE_ONLY) showAbeJoin();
if (!ABE_ONLY) {
  intro.onInvite = async () => {
    const link = await invite();
    showPauseInvite(link);
    return link;
  };
}

/**
 * La versión de Abe sin sala (ver src/edition.ts): se entra con el enlace del caballero, o escribiendo el
 * código de su sala (o pegando el enlace entero).
 */
function showAbeJoin(): void {
  document.body.classList.add('abejoin');
  const box = document.getElementById('abejoin')!;
  box.hidden = false;
  const field = box.querySelector('input') as HTMLInputElement;
  box.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = field.value.trim();
    const code = (/mirar=([A-Za-z0-9]+)/.exec(raw)?.[1] ?? raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return;
    const url = new URL(location.href);
    url.searchParams.set('mirar', code);
    location.href = url.toString();
  });
  field.focus();
}
loadModels().then(() => {
  intro.setReady();
  // reiniciaste con alguien mirando: arranca directo (ver `restart`)
  if (!WATCH && !ABE_ONLY && sessionStorage.getItem(AUTOSTART_KEY)) {
    sessionStorage.removeItem(AUTOSTART_KEY);
    void startGame(false, true);
  }
  paintDifficulty();
  // las partidas que no salieron la vez pasada (sin red, o dejadas por la mitad)
  if (RECORD) void flushRuns();
  if (WATCH) void startWatching(WATCH);
}).catch((e) => {
  console.error(e);
  intro.setError(L('Error cargando modelos', 'Error loading models'));
});

// ---------- espectador (src/net) ----------
const netNote = document.getElementById('netnote')!;
const watchersEl = document.getElementById('watchers')!;
let netHost: NetHost | null = null;
let spectator: NetSpectator | null = null;
/** El que mira: desde cuándo la partida del que juega está terminada (0 = no lo está). */
let watchEndSince = 0;

// sale un hechizo de Abe: su sonido (también le llega al que mira) y, acá, a cuántos agarró
abe.origin = () => player?.anchor ?? { x: 0, z: TEE_Z };
abe.onLand = (spell, pos, hits) => {
  // la chispa sale seguido: un ruidito corto, y sin cartel
  if (spell === 'bolt') {
    audio.bounce();
    return;
  }
  if (spell === 'hail') audio.frost();
  else if (spell === 'whirl' || spell === 'current' || spell === 'push') audio.whoosh(0.9);
  else if (spell === 'curse') audio.zap();
  else audio.thud();
  if (!hits) return;
  const s = toScreen(pos, 1.5);
  hud.float(s.x, s.y, `Abe ${SPELL_INFO[spell].icon} ×${hits}`, '');
};

/**
 * El panel de Abe (el que mira): sus hechizos en botones grandes, que se tocan bien con el dedo, con la
 * recarga de cada uno; y arriba, cuando le toca, las cartas de hechizo nuevo. Con todo lleno, elegir una
 * carta pide en qué lugar va (o se queda como está). Solo toca el DOM cuando cambia algo.
 */
const abeEl = document.getElementById('abe')!;
const abeSlotsEl = abeEl.querySelector('.spells') as HTMLElement;
const abeOfferEl = abeEl.querySelector('.offer') as HTMLElement;
const abeNewBtn = abeEl.querySelector('.newspell') as HTMLButtonElement;
// primero la chispa (el ataque básico, lo que sale si no hay hechizo elegido), y después los cuatro
// hechizos: 1 a 4 los eligen, Q W E R los tiran ya donde está el mouse
abeSlotsEl.innerHTML = `<button type="button" class="spell bolt" data-i="${BOLT_SLOT}" style="--c:${`#${BOLT_INFO.color.toString(16).padStart(6, '0')}`}"><span class="icon">${BOLT_INFO.icon}</span><span class="name">${BOLT_INFO.name}</span><span class="lv">${L('básico', 'basic')}</span><span class="cd"></span></button>`
  + Array.from({ length: ABE_SLOTS }, (_, i) => `<button type="button" class="spell" data-i="${i}"><span class="icon"></span><span class="name"></span><span class="lv"></span><kbd>${i + 1} · ${ABILITY_KEYS[i]}</kbd><span class="cd"></span></button>`).join('');
const abeBoltBtn = abeSlotsEl.querySelector('.bolt') as HTMLButtonElement;
const abeSpellBtns = Array.from(abeSlotsEl.querySelectorAll('.spell:not(.bolt)')) as HTMLButtonElement[];
/** La carta elegida con todo lleno, esperando a que diga en qué lugar va; y si las cartas están a la vista. */
let abeSwap: number | null = null;
let abeOfferOpen = true;
let abeOfferKey = '';
let abeLast: AbeStatus | null = null;
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
/** El nivel de un hechizo, corto: «nv 2». */
const spellLevel = L((n: number) => `nv ${n}`, (n: number) => `lv ${n}`);
abeSlotsEl.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button.spell') as HTMLButtonElement | null;
  if (!btn) return;
  btn.blur();
  const i = Number(btn.dataset.i);
  if (abeSwap !== null) {
    if (abeLast?.slots[i]) spectator?.pick(abeSwap, i);
    abeSwap = null;
  } else spectator?.select(i);
  // (la chispa es -1: elegirla es soltar el hechizo; tocar el hechizo elegido, también)
  abeKey = '';
});
abeOfferEl.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const card = el.closest('button.card') as HTMLButtonElement | null;
  if (card) {
    card.blur();
    const c = Number(card.dataset.c);
    // con lugares libres va directo; con todo lleno, primero dice dónde
    if ((abeLast?.slots.length ?? 0) < ABE_SLOTS) spectator?.pick(c, -1);
    else abeSwap = c;
  } else if (el.closest('button.keep')) {
    spectator?.pick(-1, -1);
    abeSwap = null;
  } else if (el.closest('button.later')) {
    abeOfferOpen = false;
    abeSwap = null;
  } else return;
  abeKey = '';
});
abeNewBtn.addEventListener('click', () => {
  abeNewBtn.blur();
  abeOfferOpen = true;
  abeKey = '';
});
let abeKey = '';
function showAbe(s: AbeStatus): void {
  abeLast = s;
  if (s.gone) {
    abeEl.hidden = true;
    abeKey = '';
    return;
  }
  const offerKey = JSON.stringify(s.offer);
  if (offerKey !== abeOfferKey) {
    // llegó otra oferta: se muestra, y lo que estaba eligiendo se olvida
    abeOfferKey = offerKey;
    abeOfferOpen = true;
    abeSwap = null;
  }
  const key = JSON.stringify([s.abe, s.selected, s.why, offerKey, s.picks, abeSwap, abeOfferOpen,
    s.bolt.ready, Math.round((s.bolt.left / s.bolt.total) * 20),
    s.slots.map((x) => [x.id, x.level, x.ready, Math.ceil(x.left), Math.round((x.left / x.total) * 40)])]);
  if (key === abeKey) return;
  abeKey = key;
  abeEl.hidden = false;
  abeEl.classList.toggle('other', !s.abe);
  abeEl.classList.toggle('swap', abeSwap !== null);
  (abeEl.querySelector('.who') as HTMLElement).textContent = s.abe
    ? L('🧙 Sos Abe, el mago que lo invocó', "🧙 You're Abe, the wizard who summoned him")
    : L('Mirando · Abe es el primero que entró', 'Watching · Abe is the first to join');
  // la chispa: elegida cuando no hay hechizo elegido
  abeBoltBtn.classList.toggle('on', s.selected === BOLT_SLOT && abeSwap === null);
  abeBoltBtn.classList.toggle('ready', s.bolt.ready);
  (abeBoltBtn.querySelector('.cd') as HTMLElement).style.height = !s.bolt.ready && !s.why ? `${Math.round((100 * s.bolt.left) / Math.max(0.1, s.bolt.total))}%` : '0';
  abeSpellBtns.forEach((btn, i) => {
    const st = s.slots[i];
    btn.classList.toggle('empty', !st);
    btn.classList.toggle('on', !!st && i === s.selected && abeSwap === null);
    btn.classList.toggle('ready', !!st?.ready);
    btn.style.setProperty('--c', st ? hex(SPELL_INFO[st.id].color) : '#4a5666');
    (btn.querySelector('.icon') as HTMLElement).textContent = st ? SPELL_INFO[st.id].icon : '·';
    (btn.querySelector('.name') as HTMLElement).textContent = st ? SPELL_INFO[st.id].name : L('vacío', 'empty');
    (btn.querySelector('.lv') as HTMLElement).textContent = st ? spellLevel(st.level) : '';
    // lo que falta de la recarga tapa el botón, de arriba para abajo
    (btn.querySelector('.cd') as HTMLElement).style.height = st && !st.ready && !s.why ? `${Math.round((100 * st.left) / Math.max(0.1, st.total))}%` : '0';
  });
  // las cartas de hechizo nuevo (solo hechizos que el juego conoce: vienen por la red)
  const offer = s.abe && s.offer ? { level: Math.max(1, Math.min(3, Math.round(s.offer.level))), spells: s.offer.spells.filter((id) => id in SPELL_INFO) } : null;
  const full = s.slots.length >= ABE_SLOTS;
  abeOfferEl.hidden = !offer || !abeOfferOpen;
  abeNewBtn.hidden = !offer || abeOfferOpen;
  abeNewBtn.textContent = s.picks > 1 ? L(`✨ ${s.picks} hechizos nuevos`, `✨ ${s.picks} new spells`) : L('✨ Hechizo nuevo', '✨ New spell');
  if (offer) {
    let title: string;
    if (abeSwap !== null) {
      const name = SPELL_INFO[offer.spells[abeSwap]].name;
      title = L(`¿En qué lugar va ${name} nv ${offer.level}? Tocá el hechizo que reemplaza`, `Where does ${name} lv ${offer.level} go? Tap the spell it replaces`);
    } else {
      title = (full
          ? L(`Hechizos de nivel ${offer.level}: elegí uno y reemplazá otro, o quedate como estás`, `Level ${offer.level} spells: pick one to replace another, or keep yours`)
          : s.slots.length ? L('Elegí un hechizo nuevo', 'Pick a new spell') : L('Elegí tu primer hechizo', 'Pick your first spell'));
    }
    (abeOfferEl.querySelector('.title') as HTMLElement).textContent = title;
    (abeOfferEl.querySelector('.cards') as HTMLElement).innerHTML = offer.spells.map((id, c) => {
      const info = SPELL_INFO[id];
      return `<button type="button" class="card${abeSwap === c ? ' on' : ''}" data-c="${c}" style="--c:${hex(info.color)}"><span class="icon">${info.icon}</span><span class="name">${info.name} <small>${spellLevel(offer.level)}</small></span><span class="shape">${spellSize(id, offer.level)}</span><span class="hint">${spellHint(id, offer.level)}</span></button>`;
    }).join('');
    (abeOfferEl.querySelector('.keep') as HTMLElement).hidden = !full;
  }
  const sel = s.selected === BOLT_SLOT ? null : s.slots[s.selected];
  (abeEl.querySelector('.help') as HTMLElement).textContent = abeSwap !== null ? L('Tocá abajo el lugar donde va', 'Tap the slot below where it goes')
    : s.why ?? (sel
      ? `${SPELL_INFO[sel.id].name}: ${spellHint(sel.id, sel.level)} · ${sel.ready
        ? L(`el próximo toque lo tira (tocá el botón otra vez para volver a la ${BOLT_INFO.name.toLowerCase()})`, `your next tap casts it (tap the button again to go back to ${BOLT_INFO.name.toLowerCase()})`)
        : L(`listo en ${Math.ceil(sel.left)} s`, `ready in ${Math.ceil(sel.left)} s`)}`
      : `${L('Tocá el piso', 'Tap the ground')}: ${boltHint().replace(/^./, (c) => c.toLowerCase())}. ${s.slots.length
        ? L('Elegí un hechizo y el próximo toque lo tira', 'Pick a spell and your next tap casts it')
        : offer ? L('Elegí arriba tu primer hechizo', 'Pick your first spell above') : ''}`);
}

/** El que mira: dónde cae en el piso un punto de la pantalla (-1..1). */
function groundAt(x: number, y: number): { x: number; z: number } | null {
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  const { origin: o, direction: d } = raycaster.ray;
  const hit = raycastTerrain(o, d) ?? raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  return hit ? { x: hit.x, z: hit.z } : null;
}

/** El campo de esta partida, como va en la URL: 0 liso, 1..N con relieve. */
function courseNumber(): number {
  return relief.on ? relief.index + 1 : 0;
}

/** El enlace para mirar esta partida. */
function watchLink(code: string): string {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set('mirar', code);
  const c = courseNumber();
  if (c) url.searchParams.set('campo', String(c));
  else url.searchParams.set('plano', '');
  if (TENNIS_ON) url.searchParams.set('tenis', '');
  if (NET_LOCAL) url.searchParams.set('local', '');
  return url.toString().replace(/=(&|$)/g, '$1');
}

/**
 * Empieza a transmitir con el código `code`. La sala y el campo quedan en la URL: reiniciar (R) recarga
 * la página, y así vuelve a la misma sala y a la misma cancha, y el que mira sigue sin hacer nada.
 */
async function startHosting(code: string): Promise<string> {
  if (!netHost) {
    const link = await connect(code, NET_LOCAL);
    netHost = new NetHost(link, {
      hello: (): Omit<Hello, 'k'> => ({
        v: __BUILD__,
        course: courseNumber(),
        tenis: TENNIS_ON,
        skin: SKINS[skinIndex].id,
        powers: run.powers,
        day: director.waveCount > 1 ? Math.max(0, director.index) / (director.waveCount - 1) : 0,
      }),
      game: (): GameSnap => ({
        st: started,
        pa: paused,
        cd: cardOpen,
        en: ended,
        gate: gateHp,
        gmax: GATE_MAX,
        hp: player?.hp ?? 0,
        mhp: player?.maxHp ?? 3,
        w: tutorial ? null : [director.index, director.waveCount, horde.aliveCount, director.pending, Math.round(director.restLeft * 10) / 10],
        sc: director.list[director.index]?.scenario ?? -1,
        score,
        kills,
        pk: pocket ? [pocket.count, pocket.max] : undefined,
        ht: used(progress.picks),
        abe: abe.status,
        tu: !!tutorial,
        // adónde apunta: lo mismo que se le dibuja a él (la línea de tiro y la marca de caída)
        am: landing.visible && player ? [r2(tee.x), r2(tee.z), r2(landing.position.x), r2(landing.position.z), r2(landing.scale.x), player.mode === 'charging' ? 1 : 0] : null,
      }),
      player: () => player ?? null,
      horde,
      balls,
      abilities,
      abe,
    });
    const host = netHost;
    // Abe pide un hechizo o la chispa: sale si la partida está andando y ese lugar ya recargó. En el
    // tutorial no: ahí los enemigos los pone el tutorial, y un empujón le desarma el paso
    host.onCast = (slot, x, z) => {
      if (!started || paused || cardOpen || ended || tutorial) return;
      const s = slot === BOLT_SLOT ? 'bolt' : abe.slots[slot]?.id;
      if (s && abe.cast(slot, x, z) && s !== 'bolt') effects.blink(new THREE.Vector3(x, heightAt(x, z), z), castColor(s));
    };
    // y elige sus hechizos, cuando quiera: la partida no lo espera
    host.onPick = (card, slot) => {
      abe.pick(card, slot);
    };
    // la privada sigue al reiniciar: está en la URL
    host.isPrivate = new URL(location.href).searchParams.has('privada');
    mirror(effects, MIRRORED.fx, (f, a) => host.record('fx', f, a));
    mirror(audio, MIRRORED.au, (f, a) => host.record('au', f, a));
    mirror(hud, MIRRORED.hud, (f, a) => host.record('hud', f, a));
    mirror(visuals, MIRRORED.vis, (f, a) => host.record('vis', f, a));
    host.onWatchers = (n) => {
      watchersEl.hidden = n === 0;
      // el primero que entra es Abe, el mago que te invocó; los demás miran
      watchersEl.textContent = n === 1 ? L('🧙 Abe está con vos', '🧙 Abe is with you') : abeAndWatchers(n - 1);
      intro.setWatchers(n);
      setPauseWatchers(n);
      showNetControls();
    };
    // alguien quiso entrar y la red no dejó: que se sepa de este lado también (cada tanto, no en cada intento)
    let troubleAt = -Infinity;
    host.onTrouble = () => {
      if (performance.now() - troubleAt < 15000) return;
      troubleAt = performance.now();
      hud.feedback(L('Alguien quiso entrar, pero sus redes no dejan conectarse directo', `Someone tried to join, but your networks won't connect directly`), 'bad');
    };
    showNetControls();
  }
  const url = new URL(location.href);
  url.searchParams.set('transmitir', code);
  const c = courseNumber();
  if (!TENNIS_ON) {
    url.searchParams.delete('plano');
    url.searchParams.delete('campo');
    if (c) url.searchParams.set('campo', String(c));
    else url.searchParams.set('plano', '');
  }
  history.replaceState(null, '', url.toString().replace(/=(&|$)/g, '$1'));
  return watchLink(code);
}

/**
 * Lo que el caballero manda en su sala, en la intro y en la pausa: echar a Abe (el que sigue pasa a ser
 * Abe) y hacer la partida privada (no entra nadie más; los que miran siguen).
 */
const netControls = Array.from(document.querySelectorAll('.netctl')) as HTMLElement[];
function showNetControls(): void {
  for (const el of netControls) {
    el.hidden = !netHost;
    (el.querySelector('.kick') as HTMLElement).hidden = !netHost?.hasAbe;
    (el.querySelector('.private') as HTMLElement).textContent = netHost?.isPrivate
      ? L('🔒 Privada: no entra nadie más', '🔒 Private: nobody else can join')
      : L('🔓 Abierta: entra el que tenga el enlace', '🔓 Open: anyone with the link can join');
  }
}
for (const el of netControls) {
  el.querySelector('.kick')!.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    netHost?.kickAbe();
    showNetControls();
  });
  el.querySelector('.private')!.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (!netHost) return;
    netHost.isPrivate = !netHost.isPrivate;
    const url = new URL(location.href);
    if (netHost.isPrivate) url.searchParams.set('privada', '');
    else url.searchParams.delete('privada');
    history.replaceState(null, '', url.toString().replace(/=(&|$)/g, '$1'));
    showNetControls();
  });
}

/** El botón de invitar: abre una sala (o usa la que ya hay) y devuelve el enlace. */
async function invite(): Promise<string> {
  return startHosting(params.get('transmitir') ?? new URL(location.href).searchParams.get('transmitir') ?? roomCode());
}
// reiniciando con la sala abierta (o desde una prueba): vuelve a transmitir solo
if (!ABE_ONLY && params.get('transmitir') && !WATCH) {
  void invite().then((link) => {
    intro.showInvite(link);
    showPauseInvite(link);
  });
}

// también se invita con la partida empezada: desde la pausa
const pauseInvite = document.querySelector('#pause .invite') as HTMLElement;
const pauseInviteOpen = pauseInvite.querySelector('.open') as HTMLButtonElement;
function showPauseInvite(link: string): void {
  pauseInviteOpen.hidden = true;
  (pauseInvite.querySelector('.box') as HTMLElement).hidden = false;
  (pauseInvite.querySelector('input') as HTMLInputElement).value = link;
}
function setPauseWatchers(n: number): void {
  (pauseInvite.querySelector('.who') as HTMLElement).textContent = n === 0
    ? L('Todavía no entró nadie: puede entrar ahora, con la partida empezada.', "Nobody's joined yet: they can still join mid-game.")
    : n === 1 ? L('🧙 Abe ya está en la partida', '🧙 Abe is already in the game') : abeAndWatchers(n - 1);
}
setPauseWatchers(0);
if (!ABE_ONLY) pauseInviteOpen.addEventListener('click', () => {
  pauseInviteOpen.disabled = true;
  invite().then((link) => {
    showPauseInvite(link);
    intro.showInvite(link);
  }).catch((e) => {
    console.error(e);
    pauseInviteOpen.disabled = false;
    pauseInviteOpen.textContent = L('No se pudo abrir la sala. Probar de nuevo', "Couldn't open the room. Try again");
  });
});
pauseInvite.querySelector('.copy')!.addEventListener('click', (e) => {
  const input = pauseInvite.querySelector('input') as HTMLInputElement;
  void navigator.clipboard?.writeText(input.value).catch(() => {
    input.select();
    document.execCommand('copy');
  });
  const btn = e.currentTarget as HTMLButtonElement;
  btn.textContent = L('¡Copiado!', 'Copied!');
  // el foco fuera del botón: así Esc vuelve a sacar la pausa
  btn.blur();
});

async function startWatching(code: string): Promise<void> {
  const link = await connect(code, NET_LOCAL);
  spectator = new NetSpectator(link, {
    scene,
    camera,
    dom: renderer.domElement,
    horde,
    abilities,
    player: () => player,
    targets: { fx: effects, au: () => (audio.ready ? audio : null), hud, vis: visuals },
    showGame(g) {
      hud.setBars(g.gate, g.gmax, g.hp, g.mhp);
      if (g.w) hud.setWave(...g.w);
      hud.setScenario(g.sc);
      hud.setScore(g.score, g.kills);
      if (g.pk) hud.setPocket(g.pk[0], g.pk[1]);
      hud.setHeat(g.ht ?? 0, MAX_POINTS);
      // el cartel del final sigue a la foto: sin esto, si el que juega reiniciaba, al que mira le quedaba
      // «La puerta cayó» arriba de la partida nueva. Y el que entró con la partida ya terminada lo ve igual
      // El cartel animado llega como evento (al ganar, después del festejo): el simple sale solo si no
      // llegó, porque se entró con la partida ya terminada
      const endEl = document.getElementById('end')!;
      if (!g.en) watchEndSince = 0;
      else if (!watchEndSince) watchEndSince = performance.now();
      if (!g.en && !endEl.hidden) hud.hideEnd();
      else if (g.en && endEl.hidden && performance.now() - watchEndSince > VICTORY_CARD_DELAY_MS + 1500) {
        hud.showEndPlain(g.en === 'victory' ? VICTORY_TITLE : L('Terminó la partida', 'Game over'), g.en === 'victory' ? 'victory' : 'defeat');
      }
    },
    onHello(h) {
      // la cancha se arma una sola vez al cargar: si no es la del que juega, se vuelve a entrar con la suya
      if (h.course !== courseNumber() || h.tenis !== TENNIS_ON) {
        const url = new URL(location.href);
        url.searchParams.delete('campo');
        url.searchParams.delete('plano');
        url.searchParams.delete('tenis');
        if (h.course) url.searchParams.set('campo', String(h.course));
        else url.searchParams.set('plano', '');
        if (h.tenis) url.searchParams.set('tenis', '');
        location.replace(url.toString().replace(/=(&|$)/g, '$1'));
        return;
      }
      const powers = h.powers.filter((p): p is ScenarioPower => p in POWER_NAMES);
      hud.setRun([
        ...powers.map((p, i) => ({ src: badgeImage(SCENARIO_ICONS[p]), title: stageTitle(i + 1, POWER_NAMES[p]) })),
        { src: badgeImage('skull'), title: BOSS_TITLE },
      ]);
      visuals.setDayProgress(h.day, true);
      const skin = SKINS.findIndex((s) => s.id === h.skin);
      if (skin >= 0 && skin !== skinIndex) void cycleSkin(skin - skinIndex, false);
      if (h.v !== __BUILD__) hud.feedback(L('El que juega tiene otra versión: recarguen los dos', 'The knight is on another version: both of you, reload'), 'bad');
    },
    note(text) {
      netNote.hidden = !text;
      if (text) netNote.textContent = text;
    },
    abe,
    groundAt,
    showAbe,
    reconnect: () => connect(code, NET_LOCAL),
  });
}

// el sonido del que mira arranca con su primer click (el navegador no deja antes)
if (WATCH) {
  const sound = document.getElementById('netsound')!;
  sound.hidden = false;
  const unlock = () => {
    void audio.start().then(() => audio.startMusic());
    sound.hidden = true;
    removeEventListener('pointerdown', unlock);
  };
  addEventListener('pointerdown', unlock);
}

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
/**
 * A cuántos píxeles por encima de las tarjetas de los palos queda la línea de los puestos. Se mide desde
 * las tarjetas y no desde todo el HUD de abajo: el texto de ayuda de cada palo tiene su largo, y con el
 * del wedge (dos renglones) la cámara se alejaba sola al elegirlo.
 */
const CAM_MARGIN = 117;
const cam = {
  pitch: savedBalance.camera?.pitch ?? 32, dist: 18.9, rise: savedBalance.camera?.rise ?? 0, ahead: 5.5,
  auto: savedBalance.camera?.auto ?? true, margin: savedBalance.camera?.margin ?? CAM_MARGIN,
};
/** Dónde empieza el HUD de abajo, en píxeles desde arriba. Se mide cada tanto: casi no cambia. */
let hudTop = innerHeight * 0.8;
let hudMeasured = -Infinity;
const hudBottom = document.getElementById('rows')!;

/**
 * La barra de arriba (8/10, pedido de Leandro): el campo se dibuja **debajo** de ella, no detrás. La
 * cámara sigue ocupando toda la ventana, pero con la imagen corrida hacia abajo (`setViewOffset`): lo que
 * queda tapado es cielo, y el campo se ve entero, un poco más chico. El mouse y `toScreen` siguen midiendo
 * sobre la ventana entera, y la proyección ya lo tiene en cuenta. Su alto se mide (en un celular puede
 * crecer) y queda en --head, para lo que va debajo.
 */
const topbar = document.getElementById('topbar');
let headPx = -1;
function applyView(): void {
  const h = topbar ? Math.round(topbar.getBoundingClientRect().height) : 0;
  if (h === headPx && camera.view?.fullWidth === innerWidth && camera.view?.height === innerHeight) return;
  headPx = h;
  document.documentElement.style.setProperty('--head', `${h}px`);
  const below = Math.max(1, innerHeight - h);
  camera.aspect = innerWidth / below;
  if (h > 0) camera.setViewOffset(innerWidth, below, 0, -h, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
applyView();
const CAM_LIMITS = { pitch: [12, 78], rise: [-3, 14] };

function tiltCamera(delta: number): void {
  // la rueda inclina la cámara solo jugando: con un menú o un cartel abierto (la pantalla de inicio, la
  // dificultad, las cartas, la pausa, el final) es del menú. Y el espectador acerca con la rueda su propia cámara
  if (!started || paused || ended || cardOpen || difficultyMenu.open || WATCH) return;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + delta * 2.5, CAM_LIMITS.pitch[0], CAM_LIMITS.pitch[1]);
  hud.feedback(L(`Cámara: ${cam.pitch.toFixed(0)}° de inclinación`, `Camera: ${cam.pitch.toFixed(0)}° tilt`), 'neutral');
  debugPanel?.save();
}

function raiseCamera(delta: number): void {
  // el que mira: las flechas lo llevan para adelante y para atrás por la cancha
  if (WATCH) {
    spectator?.cam.walk(delta * 3);
    return;
  }
  cam.rise = THREE.MathUtils.clamp(cam.rise + delta * 0.6, CAM_LIMITS.rise[0], CAM_LIMITS.rise[1]);
  const rise = `${cam.rise >= 0 ? '+' : ''}${cam.rise.toFixed(1)}`;
  hud.feedback(L(`Cámara: ${rise} m de altura`, `Camera: ${rise} m height`), 'neutral');
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
      applyView();
    }
    // A qué altura de la pantalla tiene que quedar la línea de los puestos, y cuántos grados por debajo
    // del centro de la mirada es eso. La cámara mira con `pitch` hacia abajo, así que el rayo al puesto
    // baja `pitch + debajo` grados: de ahí sale a cuántos metros por detrás del puesto va la cámara. El
    // centro de la mirada es el de lo que queda debajo de la barra de arriba (ver applyView)
    const targetPx = THREE.MathUtils.clamp(hudTop - cam.margin, innerHeight * 0.3, innerHeight);
    const view = innerHeight - headPx;
    const ndc = 1 - (2 * (targetPx - headPx)) / view;
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

// De a dos, la partida no espera a que Abe elija su hechizo (6/10, pedido de Leandro): lo que no elige le
// queda guardado para cuando quiera (ver Abe.grantPick)
function updateWaves(dt: number): void {
  for (const e of director.update(dt, horde.aliveCount)) {
    switch (e.type) {
      case 'wave': {
        // se anota siempre (los números del cartel del final salen de acá), pero solo se manda con RECORD
        if (!WATCH && !recorder && e.index === 0) {
          recorder = new RunRecorder({
            version: DEMO ? `${__BUILD__} demo` : __BUILD__, level: used(progress.picks), picks: { ...progress.picks }, points: progress.points,
            powers: run.powers, supports: run.supports, specials: run.specials, mode: TENNIS_ON ? 'tenis' : 'golf', course: courseNumber(),
          }, RECORD);
        }
        recorder?.wave(e.index + 1, e.wave.title, e.wave.mod);
        audio.waveHorn();
        hud.showBanner(waveTitle(e.index + 1), `${e.wave.scenario < 3 ? L(`Escenario ${e.wave.scenario + 1}`, `Stage ${e.wave.scenario + 1}`) : BOSS_TITLE} · ${e.wave.title}`);
        // el día avanza con la partida: la primera oleada es de mañana y la última al atardecer
        visuals.setDayProgress(director.waveCount > 1 ? e.index / (director.waveCount - 1) : 0);
        // no se cura solo entre oleadas, salvo con el botiquín: cura al **empezar** cada oleada, así el
        // nivel que se acaba de tomar en las cartas ya cura en esta
        medkitHeal();
        break;
      }
      case 'spawn':
        // apagado desde el panel de balance: la oleada sigue igual, pero este tipo no sale
        if (disabledKinds.has(e.kind)) break;
        {
          // una bandera por vez: si ya hay un abanderado en el campo, este sale sin bandera
          let mods = e.mods;
          if (mods?.banner && horde.enemies.some((x) => x.alive && !x.passed && x.behavior === 'banner')) {
            const { banner: _, ...rest } = mods;
            mods = Object.keys(rest).length ? rest : undefined;
          }
          horde.spawn(e.kind, undefined, mods);
        }
        // el élite cierra su escenario: que se note cuando entra
        if ((e.mods?.size ?? 1) > 1) hud.showBanner(L('¡Llega el élite!', 'Here comes the elite!'), ENEMIES[e.kind].name, 2.5);
        break;
      case 'cleared':
        // al terminar un escenario: la puerta se arregla un poco y el golfista recupera toda su vida
        if (director.list[e.index + 1] && director.list[e.index + 1].scenario !== director.list[e.index].scenario) scenarioHeal();
        if (e.index + 1 < director.waveCount && !offerChoice()) hud.showBanner(L('¡Oleada despejada!', 'Wave cleared!'), '', 2.5);
        // Abe también gana un hechizo por oleada (aunque todavía no haya entrado: los elige al llegar)
        if (e.index + 1 < director.waveCount) abe.grantPick();
        break;
      case 'victory':
        endGame('victory', VICTORY_TITLE, L('La profecía se cumplió… con un hierro 7', 'The prophecy came true… with a 7 iron'),
          'La profecía se cumplió… con un hierro 7'); // i18n-ok: el registro, en español
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
  // la versión de Abe es siempre el que mira: lo del que juega ni se compila (ver src/edition.ts)
  if (WATCH || ABE_ONLY) watchFrame(dt);
  else playFrame(dt, nowMs);
}

/** El que mira no simula nada: pone todo donde dicen las fotos del que juega, y dibuja. */
function watchFrame(dt: number): void {
  spectator?.update(dt);
  moundView.update();
  // en pausa o eligiendo carta, quieto como en el del que juega
  const step = spectator?.frozen ? 0 : dt;
  effects.update(step);
  world.update(step);
  visuals.updateDay(dt);
  visuals.render();
}

/** El que juega: la partida entera. */
function playFrame(dt: number, nowMs: number): void {
  if (player && cardOpen && !paused) director.wait(dt);
  if (player && !paused && !cardOpen) {

    if (started) gameClock += dt;
    recorder?.tick(dt);
    // carcaj: se repone solo
    if (!quiver.ready && (quiver.timer -= dt) <= 0) quiver.ready = true;
    // caddie dorado: mientras dure, el puesto donde estás nunca se queda sin pelota
    if (caddieLeft > 0 && pocket) {
      caddieLeft -= dt;
      if (pocket.count === 0 && pocket.incoming === 0) pocket.toss(player.anchor, true);
    } else if (caddieLeft > 0) {
      caddieLeft -= dt;
      const i = player.stanceSpot();
      if (i >= 0 && !tees.hasBall(i)) tees.place(i, true);
    }
    if (clone && (clone.left -= dt) <= 0) removeClone();
    if (mightLeft > 0) mightLeft = Math.max(0, mightLeft - dt);
    if (glove && (glove.left -= dt) <= 0) glove = null;
    // correrse cargando, en el modo continuo: mantener A o D corre con la pelota. El derecho de la
    // pantalla es hacia -x, como en `step`
    // Y el efecto: mantener A o D curva el tiro (continuo), y con «al soltar» vuelve a cero apenas no
    // hay ninguna de las dos apretada
    // el tenista camina con las teclas apretadas, cargando o no. El derecho de la pantalla es -x
    // y si no tocás nada y viene una pelota cerca, el imán te lleva
    // (sacando, no: el saque se hace parado)
    if (pocket) player.moveDir = started && !ended && !cardOpen && !tennis?.servingNow ? -heldRight() : 0;
    if (!pocket && started && !ended && player.mode === 'charging' && (!tutorial || tutorial.canShift)) {
      const right = (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0) - (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0);
      if (SHIFT.mode === 'continuo' && right) player.shiftStance(-right * SHIFT.speed * dt);
      if (player.curving) {
        if (CURVE.variant === 'continuo' && right) player.bendShot(right * CURVE.rate * dt);
        if (CURVE.reset === 'soltar' && !right) player.curve = 0;
      }
    }
    // terminada la partida (o tirado en el piso) el golfista ya no sigue al mouse
    if (!ended && player.alive) updateAim();
    const active = started && !ended;
    // (en el tenis no: mantener apretado sacaría sin querer)
    if (!tennis && active && input.swingHeld && player.mode !== 'charging' && player.atSpot && hasBallHere()) player.startSwing();
    player.update(dt);
    fireEchoes();
    // en el tutorial no hay oleadas: los enemigos los pone él
    if (active && tutorial) tutorial.update(dt);
    else if (active) updateWaves(dt);
    if (started) {
      horde.update(dt, player);
      moundView.update();
      balls.update(dt);
      abilities.update(dt);
      abe.update(dt);
      const stance = player.mode === 'charging' || player.mode === 'swinging';
      // en la postura la pelota se dibuja a los pies del golfista, aunque se haya corrido cargando
      if (tennis) {
        tennis.update(dt);
        hud.setPocket(pocket!.count, pocket!.max);
      }
      else tees.update(dt, player.spotIndex, stance && player.stanceSpot() >= 0 ? player.spotIndex : -1);
      traps.update(dt);
    }
    effects.update(dt);
    world.update(dt);
    updateCamera(dt);
    updatePreview();

    hud.setClub(player.club, player.pendingClub);
    hud.setAbilities(abilities.slots, abilities.cooldowns, abilities.slots.map((_, i) => abilities.cooldownOf(i)));
    hud.setClubState(player.unlocked);
    hud.setPerks(perkStatus());
    hud.setBars(gateHp, GATE_MAX, player.hp, player.maxHp);
    if (!tutorial) hud.setWave(director.index, director.waveCount, horde.aliveCount, director.pending, director.restLeft);
    hud.setScenario(director.list[director.index]?.scenario ?? -1);
    hud.setScore(score, kills);
  }
  // el panel se lee también en pausa: se abre desde ahí, y sus números calculados tienen que estar vivos
  debugPanel?.tick();
  netHost?.tick(nowMs);
  visuals.updateDay(dt);
  visuals.render();
}
renderer.setAnimationLoop(frame);

addEventListener('resize', () => {
  headPx = -1;
  applyView();
  renderer.setSize(innerWidth, innerHeight);
  visuals.resize(innerWidth, innerHeight);
});

// Para inspección automática (Playwright) y debugging en consola. Solo con las herramientas de prueba
if (DEV_TOOLS) (window as any).__gk = {
  /** El espectador: el que transmite (y cuántos miran) o el que mira. */
  net: {
    get host() { return netHost; },
    get spectator() { return spectator; },
    invite,
    /** Dónde está la cámara (para ver que la del que mira no se va para el costado). */
    get eye() { return camera.position.toArray().map((v) => +v.toFixed(2)); },
  },
  get player() { return player; },
  get audio() { return audio; },
  /** El granizo de Abe (el segundo jugador). */
  get abe() { return abe; },
  get horde() { return horde; },
  get balls() { return balls; },
  get director() { return director; },
  get gateHp() { return gateHp; },
  set gateHp(v: number) { gateHp = v; },
  /** Termina la partida en el acto, para las pruebas. */
  finish(result: 'victory' | 'defeat') { endGame(result, result, '', 'prueba'); }, // i18n-ok: solo para las pruebas
  get score() { return score; },
  get kills() { return kills; },
  get shots() { return shots; },
  get ended() { return ended; },
  get tutorial() { return tutorial; },
  /** Pone una mejora en un nivel (0 la saca), para las pruebas. */
  perk(id: PerkId, level: number) {
    if (level > 0) perks[id] = level;
    else delete perks[id];
    applyPerks();
  },
  /** Dónde está la marca de caída del tiro, para las pruebas. */
  get landingAt() { return [+landing.position.x.toFixed(1), +landing.position.z.toFixed(1)]; },
  get paused() { return paused; },
  get lastEvent() { return lastEvent; },
  get lastLanding() { return lastLanding; },
  set closeup(v: boolean) { closeup = v; },
  get measured() { return measured; },
  get aim() { return [aimPoint.x, aimPoint.z].map((v) => +v.toFixed(2)); },
  get fps() { const t = performance.now(); return frameTimes.filter((x) => t - x < 1000).length; },
  /** Píxel de pantalla que corresponde a un punto del piso, para apuntar con el mouse en los tests. */
  /** Lo visual del panel B (sombras, luz, dónde va el arco de carga). */
  get visual() { return VISUAL; },
  // con los globos el mouse apunta sobre el piso plano (ver updateAim): el píxel es el del plano
  screenOf(x: number, z: number) { return toScreen(new THREE.Vector3(x, isLob(player.club) || !terrainOn() ? 0 : heightAt(x, z), z), 0); },
  heightAt,
  spawn(kind: EnemyKind, x: number, z: number, mods?: EnemyMods) { return horde.spawn(kind, new THREE.Vector3(x, 0, z), mods); },
  mounds,
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
    const hitAt = impactRange(club, range);
    return { club: club.id, range: +range.toFixed(1), hitAt: +hitAt.toFixed(1), band: bandOf(hitAt), damage: damageFor(club, hitAt, qualityOf(player.meter.power)) };
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
  /** Modo tenis: el bolsillo, y la pelota que se devolvería ahora mismo. */
  get pocket() { return pocket; },
  tennis: TENNIS,
  get tennisPlay() { return tennis; },

  get traps() { return traps; },
  /** Las habilidades: cuáles se tienen, las recargas y las zonas de hielo en el piso. */
  get abilities() { return abilities; },
  /** Tira una habilidad por nombre, como si se apretara su tecla. */
  cast(id: AbilityId) {
    if (!abilities.slots.some((s) => s.id === id)) abilities.learn(id);
    castAbility(abilities.slots.findIndex((s) => s.id === id));
  },
  /** A qué fracción de su velocidad camina el que pisa hielo, para la anticipación del bot. */
  get iceSlow() { return ELEMENTS.chillSlow; },
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