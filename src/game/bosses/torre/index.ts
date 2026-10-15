// La Torre de asedio (14/10, ver docs/jefes/torre.md). Una torre de madera que rueda despacio hacia la
// puerta, con paradas: lo peligroso es lo que lleva arriba. Los arqueros de la plataforma te tiran al
// puesto (con marca en el piso: corréte). La plataforma es chica: un globo del wedge que cae justo arriba
// (la distancia exacta) barre a los arqueros; el que le pega a la pared de adelante no los toca. Las
// ruedas se rompen con lo que pega bajo (el driver) y la frenan. Si llega a la línea, baja la rampa y sale
// la horda.
//
// Las pelotas chocan con la torre como con un cilindro (ver Balls.collide): el globo que entra por arriba
// del piso de la plataforma (TOP_HIT_Y) revienta ahí y su área barre a los de arriba. Los arqueros solo
// cobran de pelotas que les llegan a la altura (ver `crewFilter`): el driver que pasa por abajo no.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Ball } from '../../balls';
import type { Enemy, EnemyScript, Horde } from '../../enemies';
import { BossBar, GATE_HALF_WIDTH, GATE_Z, GroundMark, LaneMark, TEE_Z, arcPoint, disposeObject, flatMat, heightAt, nearestSpot, partStats } from '../kit';
import type { BossCtx, BossDef, BossFight } from '../types';

// ---- la torre ----
/** Para las pelotas es un cilindro de este radio: la torre mide 3 m de ancho. */
const TOWER_RADIUS = 1.5;
/** El piso de arriba, donde están los arqueros. */
const PLATFORM_Y = 5;
/**
 * Lo que cuenta como «arriba»: la pelota que toca la torre de esta altura para arriba cae en la
 * plataforma y barre a los arqueros. Más abajo le pegó a la pared.
 */
const TOP_HIT_Y = PLATFORM_Y - 0.3;
/** Lo que le pega por debajo de esto le pega a las ruedas. */
const WHEEL_Y = 1.4;
/** El globo que cae a menos de esto del centro de la torre avisa si quedó corto o largo. */
const HINT_NEAR = 4.5;
/** Arranca acá, ya rodando, en un carril al azar entre -LANE_X y LANE_X. */
const START_Z = 63;
const LANE_X = 6;
/** Hasta acá llega: la rampa, al caer, toca la línea de los puestos. */
const ARRIVE_Z = 16;
/** Rueda un rato y se para otro: con las ruedas sanas, 0.6 m/s de promedio (unos 80 s hasta la línea). */
const ROLL_SPEED = 1;
const ROLL_TIME = 4;
const PAUSE_TIME = 2.5;

// ---- las ruedas ----
const WHEELS_HP = 10;
/** Con las ruedas casi rotas va a esta parte del paso. */
const MIN_PACE = 0.3;
/** Rotas del todo, se para y las arreglan: tarda esto, y cada golpe bajo mientras tanto lo atrasa (por punto). */
const REPAIR_TIME = 10;
const REPAIR_SETBACK = 1.5;
/** Arregladas, quedan así (parte de la vida de las ruedas). */
const REPAIRED = 0.6;

// ---- los arqueros ----
const ARCHER_HP = 1;
const ARCHER_HEIGHT = 1.3;
/** La guarnición: hay que matarlos a todos (más unos por nivel de dificultad). */
const GARRISON = 18;
const GARRISON_PER_LEVEL = 1;
const START_ON_TOP = 2;
/** Dónde se paran arriba, respecto del centro (adelante es hacia la puerta, -z): entran cinco. */
const TOP_SLOTS: [number, number][] = [[-0.85, -0.55], [0.85, -0.55], [0, -0.6], [-0.5, 0.5], [0.5, 0.5]];
/** Sube uno cada tanto (del arranque al final de la rampa); con menos de dos arriba, enseguida. */
const CLIMB_EVERY: [number, number] = [6, 3.5];
const CLIMB_SOON = 1.5;
const CLIMB_TIME = 2.6;
/** La escalera, atrás (+z respecto del centro). */
const LADDER_Z = 1.75;
/** El que está a la altura h cobra de las pelotas que pasan de h menos esto para arriba. */
const CREW_REACH = 0.3;
const ARCHER_TINT = 0xe0b088;

// ---- las flechas ----
/** Tensa el arco (la marca ya está en el piso) y la flecha vuela. */
const ARROW_DRAW = 0.9;
const ARROW_FLIGHT = 1;
const ARROW_RADIUS = 1.3;
const ARROW_DAMAGE = 1;
const ARROW_HEIGHT = 3.5;
/** Cada arquero tira cada tanto (del arranque al final de la rampa)... */
const ARCHER_EVERY: [number, number] = [6, 4.2];
/** ...pero entre todos, no más de una flecha cada tanto, ni más de dos marcas a la vez. */
const VOLLEY_GAP: [number, number] = [1.7, 1];
const MAX_MARKS = 2;
/** Las de fuego a la puerta (la versión muralla): tensa más, y se ve venir. */
const FIRE_DRAW = 2.6;
const FIRE_FLIGHT = 1.8;
const FIRE_GAP: [number, number] = [5, 3.2];
const FIRE_DAMAGE = 1;
/** En cuántos segundos la presión llega a lo más alto. */
const RAMP = 120;

// ---- la rampa ----
/** Llegó: la rampa tarda esto en caer, y después sale un goblin cada tanto. */
const RAMP_DROP = 1.2;
const POUR_EVERY = 2.2;

/** Lo que cambia entre versiones. */
interface Rules {
  /** Los arqueros te tiran a vos (marca en el piso) o, con flechas de fuego, a la puerta. */
  target: 'player' | 'gate';
  /** Las ruedas se rompen con los golpes bajos y la frenan. */
  wheels: boolean;
  /** Vida de la torre. 0: no se rompe, se gana matando a toda la guarnición. */
  hp: number;
  /** Con vida: por cuánto se multiplica el globo que cae arriba. */
  topMul: number;
  /** Con vida: los arqueros no se acaban (siguen subiendo). */
  endless: boolean;
  /** El paso de la torre (1 = ROLL_SPEED). */
  pace: number;
}

interface Archer {
  e: Enemy;
  state: 'walk' | 'climb' | 'top';
  slot: number;
  /** Cuánto subió (0 a 1). */
  climb: number;
  ladderX: number;
  /** Cuánto le falta para poder tirar otra vez. */
  cool: number;
  /** Tensando: cuánto lleva (-1, no). */
  draw: number;
  to: THREE.Vector3 | null;
  marks: GroundMark[];
  lane: LaneMark | null;
  flame: THREE.Mesh | null;
}

interface Arrow {
  mesh: THREE.Object3D;
  marks: GroundMark[];
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  time: number;
  gate: boolean;
  /** Clavada en el piso: cuánto le queda a la vista. */
  stuck: number;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Lo que mide el modelo de la torre (lo mide addLook): con esa altura va a escala 1, y es la de las pelotas. */
let towerHeight = 6.2;
const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * La torre, de cajas como la utilería de la cinemática: cuatro ruedas, el armazón con cueros adelante, la
 * plataforma con almenas bajas (que se vea a los arqueros), la escalera atrás y la rampa levantada adelante.
 * El frente mira a +z, como los personajes: con `heading` = π queda mirando a la puerta.
 */
function towerLook(): THREE.Group {
  const g = new THREE.Group();
  const wood = flatMat(0x8a5a2e);
  const dark = flatMat(0x5a3a1c);
  const hide = flatMat(0xa8825a);
  const metal = flatMat(0x3c3c3c, { metalness: 0.4, roughness: 0.6 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    parent.add(b);
    return b;
  };
  // el armazón: cuatro postes, travesaños y cruces a los costados
  for (const x of [-1.35, 1.35]) for (const z of [-1.35, 1.35]) box(0.26, PLATFORM_Y, 0.26, dark, x, PLATFORM_Y / 2, z);
  for (const y of [1.0, 2.4, 3.8]) {
    for (const z of [-1.35, 1.35]) box(2.7, 0.18, 0.2, wood, 0, y, z);
    for (const x of [-1.35, 1.35]) box(0.2, 0.18, 2.7, wood, x, y, 0);
  }
  for (const x of [-1.38, 1.38]) {
    for (const [y, a] of [[1.7, 0.9], [3.1, -0.9]] as [number, number][]) {
      const brace = box(0.12, 2.0, 0.14, wood, x, y, 0);
      brace.rotation.x = a;
    }
  }
  // el frente, cubierto de cueros (abajo de la rampa)
  box(2.6, 0.9, 0.1, hide, 0, 0.75, 1.42);
  // la plataforma y sus almenas bajas: adelante y a los costados
  box(3.1, 0.22, 3.1, wood, 0, PLATFORM_Y, 0);
  for (let i = 0; i < 4; i++) {
    const x = -1.2 + i * 0.8;
    box(0.42, 0.55, 0.16, wood, x, PLATFORM_Y + 0.38, 1.47);
  }
  for (const x of [-1.47, 1.47]) for (const z of [-0.8, 0, 0.8]) box(0.16, 0.55, 0.42, wood, x, PLATFORM_Y + 0.38, z);
  // un banderín en la esquina de atrás
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), dark);
  pole.position.set(1.3, PLATFORM_Y + 0.65, -1.3);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36), flatMat(0xa3262a, { side: THREE.DoubleSide }));
  flag.position.set(1.3, PLATFORM_Y + 1.0, -1.0);
  flag.rotation.y = Math.PI / 2;
  g.add(pole, flag);
  // la escalera, atrás
  for (const x of [-0.35, 0.35]) box(0.08, PLATFORM_Y + 0.3, 0.08, dark, x, (PLATFORM_Y + 0.3) / 2, -1.55);
  for (let y = 0.4; y < PLATFORM_Y; y += 0.45) box(0.7, 0.06, 0.08, wood, 0, y, -1.55);
  // las ruedas: cada una en su grupo (el eje), para girarla y torcerla cuando se rompe
  const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.3, 10);
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.36, 6);
  let n = 0;
  for (const z of [1.05, -1.05]) {
    for (const x of [-1.62, 1.62]) {
      const hub = new THREE.Group();
      hub.name = `rueda-${n++}`;
      hub.position.set(x, 0.62, z);
      const w = new THREE.Mesh(wheelGeo, dark);
      w.rotation.z = Math.PI / 2;
      w.castShadow = true;
      const h = new THREE.Mesh(hubGeo, metal);
      h.rotation.z = Math.PI / 2;
      // un rayo, para que se vea girar
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.1, 0.12), wood);
      hub.add(w, h, spoke);
      g.add(hub);
    }
    box(3.0, 0.16, 0.16, dark, 0, 0.62, z);
  }
  // la rampa: levantada contra el frente, con la bisagra abajo. Al llegar cae hacia adelante (+z)
  const ramp = new THREE.Group();
  ramp.name = 'rampa';
  ramp.position.set(0, 1.2, 1.5);
  box(2.4, PLATFORM_Y - 1.2, 0.14, wood, 0, (PLATFORM_Y - 1.2) / 2, 0, ramp);
  for (let y = 0.5; y < PLATFORM_Y - 1.2; y += 0.9) box(2.5, 0.1, 0.18, metal, 0, y, 0.02, ramp);
  g.add(ramp);
  return g;
}

/** El arco del arquero: medio aro y la cuerda. */
function bowLook(): THREE.Group {
  const g = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 4, 10, Math.PI), flatMat(0x5a3a1c));
  arc.rotation.z = -Math.PI / 2;
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.84, 0.01), flatMat(0xe8e0c8));
  g.add(arc, string);
  return g;
}

/** Una flecha: la vara a lo largo de +z (para apuntarla con lookAt) y la punta. */
function arrowLook(fire: boolean): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.0), flatMat(0x6a4a2a));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), fire ? new THREE.MeshBasicMaterial({ color: 0xffa040 }) : flatMat(0x9a9a9a));
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 0.58;
  g.add(shaft, tip);
  if (fire) {
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.7 }));
    glow.position.z = 0.55;
    g.add(glow);
  }
  return g;
}

function lookOf(ctx: BossCtx, kind: string, mesh: string): string {
  if (ctx.horde.hasLook(kind)) return kind;
  const key = `torre-${kind}`;
  if (!ctx.horde.hasLook(key)) ctx.horde.addLook(key, ctx.dungeon.scene, ctx.dungeon.animations, mesh);
  return key;
}

function start(ctx: BossCtx, rules: Rules): BossFight {
  const { horde, scene, effects, audio } = ctx;
  const spots = ctx.spots();
  if (!horde.hasLook('torre-asedio')) towerHeight = horde.addLook('torre-asedio', towerLook());
  const archerLook = lookOf(ctx, 'goblin', 'Character_Goblin_Male');
  const bar = new BossBar(L('Torre de asedio', 'Siege Tower'), '#c98a3a');

  const pos = new THREE.Vector3(Math.round((ctx.rng() * 2 - 1) * LANE_X), 0, START_Z);
  let move: 'roll' | 'pause' | 'stuck' | 'arrived' = 'roll';
  let moveLeft = ROLL_TIME;
  let wheels = WHEELS_HP;
  let repairLeft = 0;
  let spin = 0;
  let rampT = 0;
  let pourTimer = 0;
  let collapse = -1;
  let won = false;
  /** Para las pruebas (logs/torre-ventana.mjs): la torre quieta, para medir dónde cae el globo. */
  let hold = false;

  const archers: Archer[] = [];
  const corpses: { e: Enemy; dx: number; dy: number; dz: number }[] = [];
  const arrows: Arrow[] = [];
  let garrison = rules.endless ? Infinity : GARRISON + Math.round(GARRISON_PER_LEVEL * ctx.level);
  const total = garrison;
  let climbTimer = 1;
  let volleyGap = 2.5;
  /** Las pelotas que ya avisaron si quedaron cortas o largas (una vez por pelota). */
  const told = new WeakSet<Ball>();
  const stats = { arriba: 0, cortos: 0, largos: 0, golpesRuedas: 0, atascos: 0, arquerosMuertos: 0, flechas: 0, pegadas: 0, fuego: 0, llego: 0, goblins: 0 };

  const ramp = () => Math.min(1, ctx.clock() / RAMP);

  // ---- la torre ----
  const towerHp = rules.hp > 0 ? rules.hp + ctx.bonusHp : 1;
  const towerScript: EnemyScript = {
    update(e, dt) {
      e.knock.set(0, 0, 0);
      e.position.set(pos.x, heightAt(pos.x, pos.z), pos.z);
      e.heading = Math.PI;
      if (collapse >= 0) {
        // abandonada: se va de espaldas, y se hunde
        collapse += dt;
        e.body.rotation.x = -Math.min(1.25, collapse * collapse * 0.7);
        e.position.y -= Math.max(0, collapse - 1.2) * 2;
        if (collapse > 2.4) e.remove();
        return true;
      }
      // torcida con las ruedas rotas
      e.body.rotation.z = move === 'stuck' ? 0.06 : 0;
      return true;
    },
    filter: (e, amount, shot) => towerFilter(e, amount, shot),
    onDeath(e) {
      // la de vida: se rompe
      effects.explosion(e.position.clone().setY(3), 4, 0xc98a3a);
      audio.explosion(true);
      won = true;
    },
  };
  const tower = horde.spawnCustom(
    partStats('stoneling', { name: L('Torre de asedio', 'Siege Tower'), height: towerHeight, radius: TOWER_RADIUS, hp: towerHp, boss: true, heavy: true, behavior: 'golem', speed: 0.6, score: 500 }),
    'torre-asedio', pos.x, pos.z, {}, towerScript,
  );
  const wheelParts = [0, 1, 2, 3].map((i) => tower.body.getObjectByName(`rueda-${i}`)).filter((o): o is THREE.Object3D => !!o);
  const rampPart = tower.body.getObjectByName('rampa');

  /** La pelota de este tiro más cerca de `e` (la que le está pegando), o null si no es una pelota. */
  function ballOf(e: Enemy, shot: NonNullable<Horde['shot']>): Ball | null {
    let best: Ball | null = null;
    let bestD = Infinity;
    for (const b of ctx.balls.list) {
      if (b.done || b.club.id !== shot.club || b.ability !== shot.ability) continue;
      const d = Math.hypot(b.state.pos.x - e.position.x, b.state.pos.z - e.position.z);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  function towerFilter(e: Enemy, amount: number, shot: Horde['shot']): number {
    const hurts = rules.hp > 0;
    if (!shot) return hurts ? amount : 0;
    const b = ballOf(e, shot);
    const y = b ? b.state.pos.y - e.position.y : 1;
    if (y >= TOP_HIT_Y) {
      // cayó en la plataforma: el área barre a los de arriba (ver crewFilter)
      stats.arriba++;
      effects.explosion(new THREE.Vector3(pos.x, e.position.y + PLATFORM_Y + 0.4, pos.z), 1.8, 0xe8c890);
      if (b && !told.has(b)) {
        told.add(b);
        if (stats.arriba <= 2) ctx.feedback(L('¡Justo arriba!', 'Right on top!'));
      }
      return hurts ? amount * rules.topMul : 0;
    }
    if (b && shot.club === 'wedge') hint(b);
    // abajo, las ruedas: solo los golpes directos (el área de un globo que cayó al lado, no)
    if (rules.wheels && b && !b.burst && y < WHEEL_Y && move !== 'arrived') hitWheels(amount);
    else if (!hurts && b && !b.burst) horde.emit({ type: 'immune', enemy: e });
    return hurts ? amount : 0;
  }

  /** El globo que no cayó arriba: avisa si quedó corto (contra la pared o antes) o largo (detrás). */
  function hint(b: Ball): void {
    if (b.ability || told.has(b)) return;
    const dir = new THREE.Vector3(pos.x - b.from.x, 0, pos.z - b.from.z).normalize();
    const along = (b.state.pos.x - pos.x) * dir.x + (b.state.pos.z - pos.z) * dir.z;
    const side = Math.abs((b.state.pos.x - pos.x) * dir.z - (b.state.pos.z - pos.z) * dir.x);
    // el que cayó lejos le estaba tirando a otro (a la escolta, que pasa al lado)
    if (b.burst && Math.hypot(along, side) > HINT_NEAR) return;
    told.add(b);
    if (side > TOWER_RADIUS + 1) {
      ctx.feedback(L('¡Desviado!', 'Off to the side!'));
      return;
    }
    // contra la pared, o antes de la torre: corto
    if (!b.burst || along < 0) {
      stats.cortos++;
      ctx.feedback(L('¡Corto! Más lejos', 'Short! Further'));
    } else {
      stats.largos++;
      ctx.feedback(L('¡Largo! Más cerca', 'Long! Closer'));
    }
  }

  function hitWheels(amount: number): void {
    effects.spark(new THREE.Vector3(pos.x, 0.7, pos.z - TOWER_RADIUS), 0xd8b070);
    if (move === 'stuck') {
      // mientras las arreglan, cada golpe bajo las atrasa
      repairLeft = Math.min(REPAIR_TIME, repairLeft + REPAIR_SETBACK * amount);
      return;
    }
    stats.golpesRuedas += amount;
    wheels = Math.max(0, wheels - amount);
    if (wheels <= 0) {
      move = 'stuck';
      repairLeft = REPAIR_TIME;
      stats.atascos++;
      audio.thud();
      ctx.banner(L('¡Ruedas rotas!', 'Wheels broken!'), L('La torre se para mientras las arreglan', 'The tower stops while they fix them'), 2);
    }
  }

  function updateTower(dt: number): void {
    if (hold && move !== 'arrived') return;
    if (move === 'arrived') {
      rampT = Math.min(1, rampT + dt / RAMP_DROP);
      if (rampPart) rampPart.rotation.x = (Math.PI / 2) * smooth(rampT) * 0.97;
      if (rampT >= 1 && !won && !ctx.over()) {
        pourTimer -= dt;
        if (pourTimer <= 0) {
          pourTimer = POUR_EVERY;
          horde.spawn('goblin', new THREE.Vector3(pos.x + (ctx.rng() - 0.5) * 1.6, 0, pos.z - 3.8));
          stats.goblins++;
        }
      }
      return;
    }
    if (move === 'stuck') {
      repairLeft -= dt;
      if (repairLeft <= 0) {
        wheels = Math.round(WHEELS_HP * REPAIRED);
        move = 'roll';
        moveLeft = ROLL_TIME;
        ctx.feedback(L('¡Arreglaron las ruedas!', 'They fixed the wheels!'));
      }
    } else if (move === 'pause') {
      moveLeft -= dt;
      if (moveLeft <= 0) {
        move = 'roll';
        moveLeft = ROLL_TIME;
      }
    } else {
      const pace = rules.pace * (rules.wheels ? MIN_PACE + (1 - MIN_PACE) * (wheels / WHEELS_HP) : 1);
      const dz = ROLL_SPEED * pace * dt;
      pos.z -= dz;
      spin += dz / 0.62;
      moveLeft -= dt;
      if (moveLeft <= 0) {
        move = 'pause';
        moveLeft = PAUSE_TIME;
      }
      if (pos.z <= ARRIVE_Z) arrive();
    }
    // las ruedas giran al rodar; las rotas, torcidas
    const broken = rules.wheels ? Math.min(4, Math.floor((1 - wheels / WHEELS_HP) * 4 + 0.001)) : 0;
    wheelParts.forEach((w, i) => {
      w.rotation.x = -spin;
      const bad = i < broken;
      w.rotation.z = bad ? (i % 2 ? 0.35 : -0.35) : 0;
      w.position.y = bad ? 0.5 : 0.62;
    });
  }

  function arrive(): void {
    pos.z = ARRIVE_Z;
    move = 'arrived';
    stats.llego = 1;
    pourTimer = 0.3;
    audio.eliteAlert();
    ctx.banner(L('¡La torre llegó a la línea!', 'The tower reached the line!'), L('Bajó la rampa: sale la horda', 'The ramp is down: here comes the horde'), 2.5);
  }

  // ---- los arqueros ----
  /** Los de la torre cobran solo de lo que les llega a la altura: el driver que pasa por abajo, no. */
  function crewFilter(e: Enemy, amount: number, shot: Horde['shot']): number {
    if (!shot) return amount;
    const b = ballOf(e, shot);
    if (!b) return amount;
    return b.state.pos.y >= e.position.y - CREW_REACH ? amount : 0;
  }

  function archerScript(): EnemyScript {
    return {
      update(e, dt) {
        e.knock.set(0, 0, 0);
        const a = archers.find((x) => x.e === e);
        if (!a) return true;
        const ground = heightAt(pos.x, pos.z);
        if (a.state === 'walk') {
          // hasta el pie de la escalera, atrás de la torre (que se va moviendo)
          if (e.walkToward(pos.x + a.ladderX, pos.z + LADDER_Z, 2.6, dt, true, 0.25)) a.state = 'climb';
          return true;
        }
        if (a.state === 'climb') {
          a.climb = Math.min(1, a.climb + dt / CLIMB_TIME);
          e.position.set(pos.x + a.ladderX, ground + a.climb * PLATFORM_Y, pos.z + LADDER_Z);
          e.heading = Math.PI;
          e.animator.setLocomotion('Walking', 0.7);
          if (a.climb >= 1) {
            a.state = 'top';
            a.slot = freeSlot();
            a.cool = 1 + ctx.rng() * 2;
          }
          return true;
        }
        const s = TOP_SLOTS[a.slot] ?? [0, 0];
        e.position.set(pos.x + s[0], ground + PLATFORM_Y + 0.11, pos.z + s[1]);
        if (a.draw >= 0 && a.to) {
          e.faceToward(a.to.x, a.to.z, dt, 10);
          e.scriptGesture = 1;
          e.scriptSwing = 0.45;
        } else {
          e.scriptGesture = 0;
          e.faceToward(pos.x + s[0], GATE_Z, dt, 4);
        }
        e.animator.setLocomotion('Idle', 1);
        return true;
      },
      filter: (e, amount, shot) => crewFilter(e, amount, shot),
      onDeath(e) {
        stats.arquerosMuertos++;
        const a = archers.find((x) => x.e === e);
        if (!a) return;
        cancelDraw(a);
        // el cuerpo sigue en la torre mientras cae
        corpses.push({ e, dx: e.position.x - pos.x, dy: e.position.y - heightAt(pos.x, pos.z), dz: e.position.z - pos.z });
      },
    };
  }

  function freeSlot(): number {
    for (let i = 0; i < TOP_SLOTS.length; i++) if (!archers.some((a) => a.state === 'top' && a.slot === i && a.e.alive)) return i;
    return 0;
  }

  function spawnArcher(onTop: boolean): void {
    if (garrison <= 0) return;
    garrison--;
    const ladderX = (ctx.rng() - 0.5) * 0.3;
    const x = onTop ? pos.x : pos.x + ladderX + (ctx.rng() - 0.5) * 2;
    const z = onTop ? pos.z : pos.z + LADDER_Z + 2.5;
    const e = horde.spawnCustom(
      partStats('goblin', { name: L('Arquero', 'Archer'), height: ARCHER_HEIGHT, radius: 0.45, hp: ARCHER_HP, behavior: 'golem', tint: ARCHER_TINT, score: 15 }),
      archerLook, x, z, {}, archerScript(),
    );
    // el arco en la mano izquierda, adelante (en el modelo, adelante es +z)
    const sc = e.body.scale.x || 1;
    const bow = bowLook();
    bow.scale.multiplyScalar(1 / sc);
    bow.position.set(0.22 / sc, 0.78 / sc, 0.3 / sc);
    e.body.add(bow);
    const a: Archer = { e, state: onTop ? 'top' : 'walk', slot: onTop ? freeSlot() : -1, climb: onTop ? 1 : 0, ladderX, cool: 1.5 + ctx.rng() * 2.5, draw: -1, to: null, marks: [], lane: null, flame: null };
    archers.push(a);
  }

  function cancelDraw(a: Archer): void {
    a.marks.forEach((m) => m.dispose());
    a.marks = [];
    a.lane?.dispose();
    a.lane = null;
    if (a.flame) {
      a.flame.parent?.remove(a.flame);
      (a.flame.material as THREE.Material).dispose();
      a.flame = null;
    }
    a.draw = -1;
    a.to = null;
  }

  const gateMode = rules.target === 'gate';

  function startDraw(a: Archer): void {
    a.draw = 0;
    if (gateMode) {
      a.to = new THREE.Vector3((ctx.rng() * 2 - 1) * GATE_HALF_WIDTH, 3, GATE_Z + 0.5);
      // una franja larga hasta la puerta: se ve de lejos que va a tirar ahí
      a.lane = new LaneMark(scene, 0xff7a20, 0.7).between(pos.x, pos.z - TOWER_RADIUS, a.to.x, GATE_Z + 1).opacity(0.15);
      a.flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.9 }));
      a.flame.position.set(0, ARCHER_HEIGHT + 0.25, 0);
      a.e.group.add(a.flame);
      audio.casterCast();
      return;
    }
    // a tu puesto: donde estás ahora
    const x = spots[nearestSpot(ctx, ctx.player().anchor.x)];
    a.to = new THREE.Vector3(x, heightAt(x, TEE_Z) + 0.1, TEE_Z);
    a.marks = [new GroundMark(scene, 0xff3b30, true, ARROW_RADIUS).at(x, TEE_Z).opacity(0.15), new GroundMark(scene, 0xff3b30, false, ARROW_RADIUS).at(x, TEE_Z).opacity(0.7)];
  }

  function release(a: Archer): void {
    if (!a.to) return;
    const from = a.e.position.clone().add(new THREE.Vector3(0, ARCHER_HEIGHT * 0.75, 0));
    const mesh = arrowLook(gateMode);
    mesh.position.copy(from);
    scene.add(mesh);
    arrows.push({ mesh, marks: a.marks, from, to: a.to, t: 0, time: gateMode ? FIRE_FLIGHT : ARROW_FLIGHT, gate: gateMode, stuck: -1 });
    a.marks = [];
    a.lane?.dispose();
    a.lane = null;
    if (a.flame) {
      a.flame.parent?.remove(a.flame);
      (a.flame.material as THREE.Material).dispose();
      a.flame = null;
    }
    a.draw = -1;
    a.to = null;
    a.cool = lerp(ARCHER_EVERY[0], ARCHER_EVERY[1], ramp()) * (0.8 + 0.4 * ctx.rng());
    stats.flechas++;
    audio.whoosh(0.5);
  }

  function land(ar: Arrow): void {
    ar.marks.forEach((m) => m.dispose());
    ar.marks = [];
    if (ar.gate) {
      effects.explosion(ar.to.clone(), 1.4, 0xff7a20);
      if (!ctx.over()) ctx.hitGate(FIRE_DAMAGE, tower);
      stats.fuego++;
      ar.stuck = 0;
      return;
    }
    const p = ctx.player();
    const d = Math.min(Math.hypot(p.position.x - ar.to.x, p.position.z - ar.to.z), Math.hypot(p.anchor.x - ar.to.x, p.anchor.z - ar.to.z));
    effects.spark(ar.to.clone().setY(0.3), 0xd8c8a0);
    if (p.alive && d < ARROW_RADIUS && !ctx.over()) {
      if (!p.invulnerable) stats.pegadas++;
      ctx.hitPlayer(ARROW_DAMAGE, ar.to, tower);
      ar.stuck = 0;
      return;
    }
    // clavada en el piso un rato
    ar.stuck = 3;
  }

  function updateArchers(dt: number): void {
    for (let i = archers.length - 1; i >= 0; i--) {
      if (archers[i].e.alive) continue;
      cancelDraw(archers[i]);
      archers.splice(i, 1);
    }
    // los muertos siguen pegados a la torre mientras caen
    const ground = heightAt(pos.x, pos.z);
    for (let i = corpses.length - 1; i >= 0; i--) {
      const c = corpses[i];
      if (c.e.state === 'gone') {
        corpses.splice(i, 1);
        continue;
      }
      c.e.position.x = pos.x + c.dx;
      c.e.position.z = pos.z + c.dz;
      c.e.position.y = Math.min(c.e.position.y, ground + c.dy);
    }
    if (won || ctx.over()) return;
    const onTop = archers.filter((a) => a.state === 'top').length;
    const coming = archers.length - onTop;
    climbTimer -= dt;
    if (climbTimer <= 0 && garrison > 0 && onTop + coming < TOP_SLOTS.length) {
      spawnArcher(false);
      climbTimer = onTop + coming < 2 ? CLIMB_SOON : lerp(CLIMB_EVERY[0], CLIMB_EVERY[1], ramp());
    }
    // las flechas: cada uno a su ritmo, pero entre todos una cada tanto y no más de dos marcas a la vez
    volleyGap -= dt;
    const marks = archers.filter((a) => a.draw >= 0).length + arrows.filter((x) => x.t < 1 && !x.gate).length;
    for (const a of archers) if (a.state === 'top' && a.draw < 0) a.cool -= dt;
    const ready = archers.filter((a) => a.state === 'top' && a.draw < 0 && a.cool <= 0).sort((p, q) => p.cool - q.cool)[0];
    if (ready && volleyGap <= 0 && (gateMode ? !archers.some((a) => a.draw >= 0) : marks < MAX_MARKS) && ctx.player().alive) {
      startDraw(ready);
      volleyGap = gateMode ? lerp(FIRE_GAP[0], FIRE_GAP[1], ramp()) : lerp(VOLLEY_GAP[0], VOLLEY_GAP[1], ramp());
    }
    for (const a of archers) {
      if (a.draw < 0) continue;
      a.draw += dt;
      const need = gateMode ? FIRE_DRAW : ARROW_DRAW;
      const u = Math.min(1, a.draw / need);
      a.marks[0]?.opacity(0.12 + 0.25 * u);
      a.lane?.opacity(0.12 + 0.3 * u);
      if (a.flame) a.flame.scale.setScalar(0.6 + 0.8 * u + 0.15 * Math.sin(ctx.clock() * 20));
      if (a.draw >= need) release(a);
    }
  }

  function updateArrows(dt: number): void {
    const next = new THREE.Vector3();
    for (let i = arrows.length - 1; i >= 0; i--) {
      const ar = arrows[i];
      if (ar.stuck >= 0) {
        ar.stuck -= dt;
        if (ar.stuck <= 0) {
          disposeObject(scene, ar.mesh);
          arrows.splice(i, 1);
        }
        continue;
      }
      ar.t += dt / ar.time;
      const u = Math.min(1, ar.t);
      const h = ar.gate ? ARROW_HEIGHT * 1.6 : ARROW_HEIGHT;
      arcPoint(ar.from, ar.to, u, h, ar.mesh.position);
      arcPoint(ar.from, ar.to, Math.min(1, u + 0.02), h, next);
      if (u < 0.99) ar.mesh.lookAt(next);
      ar.marks[0]?.opacity(0.25 + 0.35 * u);
      if (u >= 1) land(ar);
    }
  }

  /** La guarnición se terminó: la abandonan y se cae. */
  function abandon(): void {
    won = true;
    collapse = 0;
    audio.explosion(true);
    effects.explosion(new THREE.Vector3(pos.x, 3, pos.z), 3.5, 0xc98a3a);
    ctx.banner(L('¡La torre cayó!', 'The tower fell!'), L('No le quedan arqueros', 'No archers left'), 2.5);
  }

  /** Ganada: los que quedan en la torre se van. */
  function clearCrew(): void {
    for (const a of archers) {
      cancelDraw(a);
      if (a.e.alive) {
        effects.explosion(a.e.position.clone().setY(a.e.position.y + 0.6), 0.8, 0xd8b070);
        a.e.remove();
      }
    }
    archers.length = 0;
    for (const ar of arrows) {
      ar.marks.forEach((m) => m.dispose());
      disposeObject(scene, ar.mesh);
    }
    arrows.length = 0;
  }

  for (let i = 0; i < START_ON_TOP; i++) spawnArcher(true);
  ctx.banner(L('La torre de asedio', 'The Siege Tower'), L('Un globo justo en la plataforma barre a los arqueros', 'A lob right onto the platform sweeps the archers'), 3.5);

  const fight: BossFight & { hold: boolean } = {
    get hold() {
      return hold;
    },
    set hold(v: boolean) {
      hold = v;
    },
    get done() {
      return won;
    },
    update(dt) {
      if (won) {
        clearCrew();
        bar.show(false);
        updateArchers(dt);
        return;
      }
      updateTower(dt);
      updateArchers(dt);
      updateArrows(dt);
      if (!rules.endless && garrison <= 0 && !archers.length) abandon();
      // la barra: la guarnición que queda (o la vida de la torre), las ruedas y cuánto le falta
      const meters = Math.max(0, Math.round(pos.z - TEE_Z));
      const where = move === 'arrived' ? L('¡En la línea!', 'At the line!') : L(`a ${meters} m`, `${meters} m away`);
      const wheelText = !rules.wheels ? '' : move === 'stuck' ? L(` · Arreglando las ruedas: ${Math.ceil(repairLeft)} s`, ` · Fixing the wheels: ${Math.ceil(repairLeft)} s`) : L(` · Ruedas ${Math.round((wheels / WHEELS_HP) * 100)} %`, ` · Wheels ${Math.round((wheels / WHEELS_HP) * 100)} %`);
      if (rules.hp > 0) {
        bar.set(tower.hp, tower.maxHp, `${where}${wheelText} · ${L('Arqueros', 'Archers')}: ${archers.length}`);
      } else {
        const left = garrison + archers.length;
        bar.set(left, total, `${L('Arqueros', 'Archers')}: ${left} · ${where}${wheelText}`);
      }
    },
    bot: {
      // donde va a caer una flecha (las que se tensan y las que vuelan)
      danger(x) {
        const near = (v: THREE.Vector3 | null) => !!v && Math.abs(v.x - x) < ARROW_RADIUS + 0.7;
        if (gateMode) return false;
        return archers.some((a) => a.draw >= 0 && near(a.to)) || arrows.some((ar) => !ar.gate && ar.stuck < 0 && near(ar.to));
      },
      weight(e) {
        // el bot no sabe tirar el globo a la plataforma: a los arqueros casi no les tira (los mata de casualidad)
        if (archers.some((a) => a.e === e)) return a0(e);
        if (e === tower) return rules.hp > 0 ? 1 : move === 'arrived' ? 0 : rules.wheels ? 0.5 : 0;
        return 1;
      },
    },
    log: () => ({ z: Math.round(pos.z), ruedas: wheels, guarnicion: Number.isFinite(garrison) ? garrison + archers.length : archers.length, torre: rules.hp > 0 ? tower.hp : 0, ...stats }),
    dispose() {
      for (const a of archers) cancelDraw(a);
      for (const ar of arrows) {
        ar.marks.forEach((m) => m.dispose());
        disposeObject(scene, ar.mesh);
      }
      bar.dispose();
    },
  };
  return fight;

  function a0(e: Enemy): number {
    // el que sube (abajo, en la escalera) sí se puede: el globo largo que cae detrás de la torre
    const a = archers.find((x) => x.e === e);
    return a && a.state !== 'top' && e.position.y - heightAt(pos.x, pos.z) < 1 ? 1 : 0.2;
  }
}

const BASE: Rules = { target: 'player', wheels: true, hp: 0, topMul: 1, endless: false, pace: 1 };

export const BOSSES: BossDef[] = [
  {
    id: 'torre.arqueros',
    name: L('Torre de asedio', 'Siege Tower'),
    blurb: 'Hay que matar a toda la guarnición con globos en la plataforma; los arqueros te tiran al puesto; el driver le rompe las ruedas.', // i18n-ok: el panel de pruebas
    start: (ctx) => start(ctx, BASE),
  },
  {
    id: 'torre.muralla',
    name: L('Torre de asedio', 'Siege Tower'),
    blurb: 'Como arqueros, pero tiran flechas de fuego a la puerta (tensan 2.6 s): no te apuntan a vos, hay que barrerlos antes.', // i18n-ok: el panel de pruebas
    start: (ctx) => start(ctx, { ...BASE, target: 'gate' }),
  },
  {
    id: 'torre.casco',
    name: L('Torre de asedio', 'Siege Tower'),
    blurb: 'La torre tiene vida y se rompe a golpes; el globo en la plataforma le pega el triple y barre a los arqueros, que no se acaban. Las ruedas no se rompen.', // i18n-ok: el panel de pruebas
    start: (ctx) => start(ctx, { ...BASE, wheels: false, hp: 55, topMul: 3, endless: true, pace: 0.85 }),
  },
];
