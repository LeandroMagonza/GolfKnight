// El Rey goblin ladrón (14/10, ver docs/jefes/rey.md). Se queda al fondo, parado en un palanquín que
// cargan cuatro goblins, y manda pícaros que no van a la puerta: corren a tus puestos a robarte las
// pelotas. Cada pelota que le llega te la tira de vuelta (marca en el piso: corréte) o a la puerta, según
// la versión. Pone a prueba las pelotas: cuál usar primero (la que vienen a buscar), cuándo moverse, y el
// putter de cerca, que es el que mejor defiende la línea.
//
// Parado en una pelota no te la roban (como los guardias, que nunca tiran donde estás). Matar a los
// cargadores tira el palanquín: el rey cae al piso un rato, sin tirar, y le entra más (o recién ahí le
// entra, en la versión del palanquín).
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Wave } from '../../../core/waves';
import type { Enemy, EnemyScript } from '../../enemies';
import { BossBar, GATE_HALF_WIDTH, GATE_Z, GroundMark, LaneMark, TEE_Z, arcPoint, disposeObject, flatMat, heightAt, nearestSpot, partStats } from '../kit';
import type { BossCtx, BossDef, BossFight } from '../types';

// ---- el palanquín ----
/**
 * Dónde se planta: a 29 m de la línea. Más lejos (a 40 m, en la banda larga del driver) quedaba debajo de la
 * barra del jefe, arriba de todo de la pantalla.
 */
const HOLD_Z = 38;
/** Entra caminando desde acá. */
const ENTER_Z = 60;
const ENTER_SPEED = 2.2;
/** Va y viene de costado al fondo, entre -PATROL_X y PATROL_X, y en cada punta se queda un rato. */
const PATROL_X = 9;
const PATROL_SPEED = 1.1;
const PATROL_PAUSE: [number, number] = [1, 2.5];
/** Los palos, sobre los hombros de los cargadores; el rey se para un poco más arriba, en el almohadón. */
const POLE_Y = 1.25;
const SEAT_Y = POLE_Y + 0.3;
/** Dónde va cada cargador, respecto del centro: adelante es hacia la puerta (-z). */
const SLOTS: [number, number][] = [[-1.05, -1.75], [1.05, -1.75], [-1.05, 1.75], [1.05, 1.75]];
const PORTER_HP = 3;
const PORTER_HEIGHT = 1.55;
/** Con esta cantidad de cargadores vivos o menos, el palanquín se cae. */
const FALL_AT = 2;
/** Lo mínimo que queda el rey en el piso; después espera a que estén los cuatro cargadores. */
const DOWN_TIME = 9;
/** El recambio de un cargador muerto sale a los tantos segundos, desde atrás del palanquín. */
const REPLACE_DELAY = 2;
const REPLACE_FROM = 12;
const REPLACE_SPEED = 4;

// ---- el rey ----
const KING_HEIGHT = 2.7;
const KING_RADIUS = 0.9;

// ---- los pícaros ----
const THIEF_HP = 1;
const THIEF_HEIGHT = 1.3;
const THIEF_SPEED = 5.2;
/** Con la pelota, un poco más lentos: es la segunda oportunidad de pararlos. */
const CARRY_SPEED = 4.2;
/** Cada cuántos segundos sale uno, del arranque al final de la rampa. */
const THIEF_EVERY: [number, number] = [6.5, 2.8];
/** Cuántos puede haber a la vez, del arranque al final de la rampa. */
const THIEF_MAX: [number, number] = [2, 5];
/** El primero sale a los tantos segundos de arrancar (el palanquín todavía viene entrando). */
const FIRST_THIEF = 3;
/** Agarra la pelota a esta distancia de la línea (del lado de la horda). */
const GRAB_Z = 0.9;
/** Sin pelotas para robar, espera a esta distancia de la línea a que tiren una. */
const WAIT_Z = 3.5;
/** Con el rey por la mitad de la vida, se enoja: los pícaros salen de a dos y corren más. */
const ANGRY_AT = 0.5;
const ANGRY_SPEED = 1.15;
/** En cuántos segundos la presión llega a lo más alto (más pícaros, tiros más rápidos). */
const RAMP = 120;
const THIEF_TINT = 0xc39cf0;
const THIEF_COLOR = 0xb05cff;

// ---- el tiro del rey ----
/** Levanta la pelota con los dos brazos: la marca ya está en el piso desde que empieza. */
const THROW_WINDUP = 0.75;
/** Lo que vuela, del arranque al final de la rampa. */
const THROW_FLIGHT: [number, number] = [1.6, 1.15];
/** Entre un tiro y el siguiente, como mucho uno cada tanto. */
const THROW_GAP = 1.1;
const THROW_RADIUS = 1.4;
const THROW_HEIGHT = 7;
const THROW_DAMAGE = 1;
/** La que esquivaste queda en el puesto donde cayó: te la devuelve, y es tuya otra vez. */
const RETURN_DODGED = true;
/** A la puerta tarda esto, y le saca esto. */
const GATE_FLIGHT = 2;
const GATE_DAMAGE = 1;
/** Lo que tarda una pelota recuperada en volver volando a su puesto. */
const RECOVER_FLIGHT = 0.55;

/** Lo que cambia entre versiones. */
interface Rules {
  /** Adónde tira las pelotas que le llegan: a tu puesto (corréte) o a la puerta. */
  target: 'player' | 'gate';
  /** El pícaro se la lleva corriendo hasta el rey (si lo matás en el camino vuelve a su puesto) o se la come ahí. */
  carry: boolean;
  /** Arriba del palanquín no le entra nada: solo caído. */
  guarded: boolean;
  /** Cuánto le entra caído (1 = lo normal). */
  downMul: number;
  /** Vida del rey (más la de la dificultad). */
  hp: number;
}

type ThiefState = 'go' | 'wait' | 'carry' | 'back';

interface Thief {
  e: Enemy;
  state: ThiefState;
  /** Al puesto que va, o del que robó. */
  spot: number;
  lane: LaneMark;
  ring: GroundMark;
  /** La pelota que lleva arriba de la cabeza. */
  ball: THREE.Mesh | null;
}

interface Throw {
  mesh: THREE.Mesh;
  marks: GroundMark[];
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  time: number;
  gate: boolean;
}

interface Flyback {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  spot: number;
  t: number;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const ballGeo = new THREE.SphereGeometry(0.2, 12, 10);

/** El palanquín, de cajas como las de la cinemática: dos palos largos, la tarima, el almohadón y un techito. */
function palanquinLook(): THREE.Group {
  const g = new THREE.Group();
  const wood = flatMat(0x7a4a26);
  const dark = flatMat(0x4a2c16);
  const red = flatMat(0xa3262a);
  const gold = flatMat(0xd9a93a, { metalness: 0.35, roughness: 0.45 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    g.add(b);
    return b;
  };
  // los palos van a la altura de los hombros (el origen del grupo): ahí los agarran los cargadores
  for (const x of [-1.05, 1.05]) box(0.14, 0.14, 4.8, dark, x, 0, 0);
  box(2.2, 0.22, 2.3, wood, 0, 0.12, 0);
  for (const z of [-1.16, 1.16]) box(2.24, 0.08, 0.08, gold, 0, 0.24, z);
  for (const x of [-1.11, 1.11]) box(0.08, 0.08, 2.32, gold, x, 0.24, 0);
  box(1.3, 0.14, 1.3, red, 0, 0.3, 0.1);
  // el respaldo del trono, atrás (lejos de la puerta)
  box(1.5, 1.2, 0.16, red, 0, 0.85, 0.85);
  box(1.6, 0.12, 0.2, gold, 0, 1.48, 0.85);
  // cuatro postes y el techito, alto para que se vea el rey abajo
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.1, 6);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Mesh(postGeo, gold);
    p.position.set(x, 1.75, z);
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.9, 4), red);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.75;
  roof.castShadow = true;
  g.add(roof);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), gold);
  knob.position.y = 4.25;
  g.add(knob);
  // un banderín arriba: se ve de lejos dónde está el rey
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), dark);
  pole.position.set(0, 4.85, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), flatMat(0xd9a93a, { side: THREE.DoubleSide }));
  flag.position.set(0.36, 5.2, 0);
  g.add(pole, flag);
  return g;
}

/** La corona: un aro de oro con puntas, que brilla un poco para leerse de lejos. */
function crownLook(): THREE.Group {
  const g = new THREE.Group();
  const gold = flatMat(0xffcf4a, { metalness: 0.5, roughness: 0.35, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.13, 10, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), gold);
    spike.position.set(Math.sin(a) * 0.19, 0.13, Math.cos(a) * 0.19);
    g.add(spike);
  }
  return g;
}

/** La bolsa del pícaro, en la espalda. */
function sackLook(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), flatMat(0x8a6a3e));
  m.scale.set(1, 1.15, 0.8);
  return m;
}

function ballMesh(color = 0xffffff, glow = 0xfff1b8): THREE.Mesh {
  return new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 0.9 }));
}

/** Un tipo ya registrado como modelo, o la malla de dungeon.glb si no estuviera. */
function lookOf(ctx: BossCtx, kind: string, mesh: string): string {
  if (ctx.horde.hasLook(kind)) return kind;
  const key = `rey-${kind}`;
  if (!ctx.horde.hasLook(key)) ctx.horde.addLook(key, ctx.dungeon.scene, ctx.dungeon.animations, mesh);
  return key;
}

function start(ctx: BossCtx, rules: Rules): BossFight {
  const { horde, tees, scene, effects, audio } = ctx;
  const spots = ctx.spots();
  const kingLook = lookOf(ctx, 'warchief', 'Character_Goblin_WarChief');
  const porterLook = lookOf(ctx, 'orc', 'Character_Goblin_Warrior_Male');
  const thiefLook = lookOf(ctx, 'goblin', 'Character_Goblin_Male');

  // el palanquín no es un enemigo: es utilería que se mueve con el rey
  const litter = palanquinLook();
  scene.add(litter);
  const crown = crownLook();
  scene.add(crown);
  const bar = new BossBar(L('Rey goblin ladrón', 'Goblin Thief King'), '#d9a93a');

  const pos = new THREE.Vector3(0, 0, ENTER_Z);
  let phase: 'enter' | 'patrol' | 'down' = 'enter';
  let patrolTo = 0;
  let pauseLeft = 0;
  let moveX = 0;
  /** Cuánto está caído el palanquín (0 arriba, 1 en el piso) y hacia qué lado se inclina. */
  let drop = 0;
  const tilt = new THREE.Vector2();
  let downFor = 0;
  /** El rey saltando del palanquín al piso o de vuelta (0 a 1), y desde dónde. */
  let hop = 1;
  const hopFrom = new THREE.Vector3();

  const thieves: Thief[] = [];
  const throws: Throw[] = [];
  const flybacks: Flyback[] = [];
  let thiefTimer = FIRST_THIEF;
  let queued = 0;
  let throwGap = 0;
  let windup: { t: number; to: THREE.Vector3; marks: GroundMark[]; gate: boolean } | null = null;
  let swingAfter = -1;
  let angry = false;
  let won = false;
  let scattered = false;
  const stats = { robadas: 0, recuperadas: 0, tiradas: 0, pegadas: 0, devueltas: 0, aPuerta: 0, picaros: 0, picarosMuertos: 0, caidas: 0, cargadoresMuertos: 0 };

  const ramp = () => Math.min(1, ctx.clock() / RAMP);
  const king = (): Enemy => kingE;
  const up = () => phase !== 'down';
  /** ¿Está el golfista en ese puesto (o yendo)? Ahí no se roba. */
  const playerOn = (i: number) => ctx.player().alive && ctx.player().spotIndex === i;

  // ---- el rey ----
  const kingScript: EnemyScript = {
    update(e, dt) {
      e.knock.set(0, 0, 0);
      const ground = heightAt(pos.x, pos.z);
      if (phase === 'down') {
        // en el piso, adelante del palanquín (del lado de la puerta): salta y queda tirado
        const to = new THREE.Vector3(pos.x, heightAt(pos.x, pos.z - 2.4), pos.z - 2.4);
        hop = Math.min(1, hop + dt / 0.5);
        arcPoint(hopFrom, to, hop, 1.2, e.position);
        e.scriptGesture = 0;
        return true;
      }
      // arriba: vuelve de un salto si estaba en el piso
      const seat = new THREE.Vector3(pos.x, ground + SEAT_Y - drop * 0.8, pos.z);
      if (hop < 1) {
        hop = Math.min(1, hop + dt / 0.6);
        arcPoint(hopFrom, seat, hop, 1.4, e.position);
      } else e.position.copy(seat);
      // arenga a los suyos; para tirar, levanta la pelota con los dos brazos
      if (windup) {
        e.faceToward(windup.to.x, windup.to.z, dt);
        e.scriptGesture = 1;
        e.scriptSwing = Math.min(1, windup.t / THROW_WINDUP);
      } else if (swingAfter >= 0) {
        e.scriptGesture = 1;
        e.scriptSwing = 1 + Math.min(0.25, swingAfter);
      } else {
        e.scriptGesture = 0;
        e.faceToward(pos.x, GATE_Z, dt, 3);
        e.animator.setLocomotion('Rallying', 0.8);
      }
      return true;
    },
    filter(e, amount) {
      if (!up()) return amount * rules.downMul;
      if (rules.guarded) {
        horde.emit({ type: 'immune', enemy: e });
        return 0;
      }
      return amount;
    },
    onDeath() {
      won = true;
    },
  };
  const kingE = horde.spawnCustom(
    partStats('warchief', { name: L('Rey goblin', 'Goblin King'), height: KING_HEIGHT, radius: KING_RADIUS, hp: rules.hp + ctx.bonusHp, boss: true, heavy: true, behavior: 'golem', score: 500 }),
    kingLook, pos.x, pos.z, {}, kingScript,
  );
  const head = kingE.body.getObjectByName('mixamorigHead');

  // ---- los cargadores ----
  const porters: (Enemy | null)[] = [null, null, null, null];
  /** Los de recambio, corriendo hacia su lugar. */
  const coming: { e: Enemy; slot: number }[] = [];
  const replaceAt: number[] = [];

  const slotPos = (i: number, out = new THREE.Vector3()) => out.set(pos.x + SLOTS[i][0], 0, pos.z + SLOTS[i][1]);

  function porterScript(slot: number): EnemyScript {
    return {
      update(e, dt) {
        e.knock.set(0, 0, 0);
        const c = coming.find((x) => x.e === e);
        if (c) {
          // el de recambio corre hasta su lugar; al llegar, agarra el palo
          const to = slotPos(slot);
          if (e.walkToward(to.x, to.z, REPLACE_SPEED, dt, true, 0.35)) {
            coming.splice(coming.indexOf(c), 1);
            porters[slot] = e;
          }
          return true;
        }
        const to = slotPos(slot);
        e.position.set(to.x, heightAt(to.x, to.z), to.z);
        // miran a la puerta; de costado van de lado (Strafe), entrando caminan
        e.heading = Math.PI;
        if (phase === 'enter') e.animator.setLocomotion('Walking', 0.9);
        else if (phase === 'down' || Math.abs(moveX) < 0.05) e.animator.setLocomotion('Idle', 1);
        else e.animator.setLocomotion(moveX > 0 ? 'Strafe Right' : 'Strafe Left', 0.9);
        return true;
      },
      onDeath(e) {
        stats.cargadoresMuertos++;
        const i = porters.indexOf(e);
        if (i >= 0) porters[i] = null;
        const c = coming.findIndex((x) => x.e === e);
        if (c >= 0) coming.splice(c, 1);
        replaceAt.push(ctx.clock() + REPLACE_DELAY);
      },
    };
  }

  function spawnPorter(slot: number, x: number, z: number): Enemy {
    return horde.spawnCustom(
      partStats('orc', { name: L('Cargador', 'Bearer'), height: PORTER_HEIGHT, radius: 0.55, hp: PORTER_HP, heavy: true, behavior: 'golem', score: 30 }),
      porterLook, x, z, {}, porterScript(slot),
    );
  }
  SLOTS.forEach((_, i) => {
    const at = slotPos(i);
    porters[i] = spawnPorter(i, at.x, at.z);
  });

  /** El palanquín se cae: el rey salta al piso y queda ahí, sin tirar. */
  function fall(): void {
    phase = 'down';
    downFor = 0;
    hop = 0;
    hopFrom.copy(kingE.position);
    // la que estaba levantando se le cae: vuelve a la bolsa
    if (windup) {
      windup.marks.forEach((m) => m.dispose());
      windup = null;
      queued++;
    }
    stats.caidas++;
    kingE.animator.playOneShot('Hard Landing', 1, true, 0.42);
    audio.thud();
    ctx.banner(L('¡Se cayó el rey!', 'The king fell!'), rules.guarded ? L('Ahora le entra: ¡pegale!', 'Now he can be hurt: hit him!') : L('Le entra el doble mientras está en el piso', 'He takes double damage while down'), 2);
    // se inclina hacia donde faltan cargadores
    tilt.set(0, 0);
    porters.forEach((p, i) => {
      if (!p) tilt.add(new THREE.Vector2(SLOTS[i][0], SLOTS[i][1]));
    });
  }

  /** Vuelve arriba: los cuatro cargadores están y ya pasó lo mínimo en el piso. */
  function rise(): void {
    phase = 'patrol';
    pauseLeft = 0.8;
    hop = 0;
    hopFrom.copy(kingE.position);
    kingE.animator.clearOneShot();
    ctx.feedback(L('¡El rey volvió al palanquín!', 'The king is back on his litter!'));
  }

  // ---- los pícaros ----
  /** ¿Le sirve al pícaro `t` la pelota del puesto `i`? (Que esté, que no estés ahí, que no vaya otro.) */
  const stealable = (i: number, t: Thief | null) => tees.hasBall(i) && !playerOn(i) && !thieves.some((o) => o !== t && o.state === 'go' && o.spot === i);

  function pickBall(t: Thief): number {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < spots.length; i++) {
      if (!stealable(i, t)) continue;
      const d = Math.hypot(spots[i] - t.e.position.x, TEE_Z - t.e.position.z);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  }

  /** Sin pelota a la vista, espera adelante del puesto de los guardias más cercano (no el tuyo). */
  function waitSpot(t: Thief): number {
    let best = tees.centerIndex;
    let bestD = Infinity;
    tees.spots.forEach((s, i) => {
      if (!s.spawns || playerOn(i)) return;
      const d = Math.abs(s.x - t.e.position.x) + (thieves.some((o) => o !== t && o.state === 'wait' && o.spot === i) ? 6 : 0);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  const backPoint = () => new THREE.Vector3(pos.x, 0, pos.z + 2.6);

  function thiefScript(): EnemyScript {
    return {
      update(e, dt) {
        const t = thieves.find((x) => x.e === e);
        if (!t) return true;
        if (ctx.over() || e.frozen) {
          e.animator.setLocomotion('Idle', e.frozen ? 0.001 : 1);
          return true;
        }
        const speed = (angry ? ANGRY_SPEED : 1) * (t.state === 'carry' ? CARRY_SPEED : THIEF_SPEED);
        if (t.state === 'go' || t.state === 'wait') {
          if (t.state === 'wait' || !stealable(t.spot, t)) {
            const i = pickBall(t);
            if (i >= 0) {
              t.state = 'go';
              t.spot = i;
            } else {
              t.state = 'wait';
              t.spot = waitSpot(t);
            }
          }
          const tx = spots[t.spot];
          const tz = TEE_Z + (t.state === 'go' ? GRAB_Z : WAIT_Z);
          const there = e.walkToward(tx, tz, speed, dt, true, 0.3);
          if (t.state === 'wait' && there) e.faceToward(tx, TEE_Z, dt);
          if (t.state === 'go' && Math.hypot(e.position.x - tx, e.position.z - tz) < 0.6 && stealable(t.spot, t)) steal(t);
          return true;
        }
        // de vuelta al palanquín, con la pelota o sin ella
        const back = backPoint();
        if (e.walkToward(back.x, back.z, speed, dt, true, 0.6)) {
          if (t.state === 'carry') deliver();
          drop1(t);
          e.remove();
        }
        return true;
      },
      onDeath(e) {
        stats.picarosMuertos++;
        const t = thieves.find((x) => x.e === e);
        if (!t) return;
        // el que se la llevaba la suelta: vuelve volando a su puesto
        if (t.state === 'carry') recover(t);
        drop1(t);
      },
    };
  }

  function spawnThief(): void {
    const side = ctx.rng() < 0.5 ? -1 : 1;
    const x = pos.x + side * 0.9;
    const z = pos.z + 2.6;
    const e = horde.spawnCustom(
      partStats('goblin', { name: L('Pícaro', 'Thief'), height: THIEF_HEIGHT, radius: 0.45, hp: THIEF_HP, behavior: 'grabber', tint: THIEF_TINT, score: 15 }),
      thiefLook, x, z, {}, thiefScript(),
    );
    const s = e.body.scale.x || 1;
    const sack = sackLook();
    sack.scale.multiplyScalar(1 / s);
    sack.position.set(0, 0.72 / s, -0.26 / s);
    e.body.add(sack);
    const t: Thief = { e, state: 'wait', spot: tees.centerIndex, lane: new LaneMark(scene, THIEF_COLOR, 0.8), ring: new GroundMark(scene, THIEF_COLOR, false, 0.85), ball: null };
    thieves.push(t);
    stats.picaros++;
  }

  function steal(t: Thief): void {
    if (!tees.take(t.spot)) return;
    stats.robadas++;
    effects.blink(new THREE.Vector3(spots[t.spot], 0.3, TEE_Z), THIEF_COLOR);
    audio.dodge();
    if (stats.robadas <= 2) ctx.feedback(L('¡Te robaron una pelota!', 'A ball got stolen!'));
    if (rules.carry) {
      t.state = 'carry';
      t.ball = ballMesh();
      t.ball.position.y = THIEF_HEIGHT + 0.3;
      t.e.group.add(t.ball);
    } else {
      // se la come ahí: el rey ya tiene una para tirar
      t.state = 'back';
      queued++;
    }
  }

  function deliver(): void {
    queued++;
  }

  /** La pelota del pícaro que mataste vuelve volando a su puesto (o al libre más cerca). */
  function recover(t: Thief): void {
    if (!t.ball) return;
    const from = new THREE.Vector3();
    t.ball.getWorldPosition(from);
    const mesh = ballMesh();
    mesh.position.copy(from);
    scene.add(mesh);
    flybacks.push({ mesh, from, spot: t.spot, t: 0 });
    stats.recuperadas++;
    ctx.feedback(L('¡Recuperada!', 'Got it back!'));
  }

  /** Saca lo del pícaro que no es el enemigo (la marca, el anillo y la pelota que lleva). */
  function drop1(t: Thief): void {
    t.lane.dispose();
    t.ring.dispose();
    if (t.ball) {
      t.ball.parent?.remove(t.ball);
      (t.ball.material as THREE.Material).dispose();
      t.ball = null;
    }
  }

  /** Un puesto libre para una pelota que cae: el pedido si está libre, si no el libre más cerca. */
  function freeSpot(near: number): number {
    if (!tees.hasBall(near)) return near;
    let best = -1;
    for (let i = 0; i < spots.length; i++) if (!tees.hasBall(i) && (best < 0 || Math.abs(i - near) < Math.abs(best - near))) best = i;
    return best;
  }

  // ---- los tiros del rey ----
  function startWindup(): void {
    const gate = rules.target === 'gate';
    let to: THREE.Vector3;
    const marks: GroundMark[] = [];
    if (gate) {
      to = new THREE.Vector3((ctx.rng() * 2 - 1) * GATE_HALF_WIDTH * 0.8, 2.2, GATE_Z + 0.6);
    } else {
      // a tu puesto: donde estás ahora (no adonde vas)
      const p = ctx.player();
      const x = spots[nearestSpot(ctx, p.anchor.x)];
      to = new THREE.Vector3(x, heightAt(x, TEE_Z) + 0.15, TEE_Z);
      marks.push(new GroundMark(scene, 0xff3b30, true, THROW_RADIUS).at(x, TEE_Z).opacity(0.18), new GroundMark(scene, 0xff3b30, false, THROW_RADIUS).at(x, TEE_Z).opacity(0.7));
    }
    windup = { t: 0, to, marks, gate };
    queued--;
    audio.growl();
  }

  function release(): void {
    if (!windup) return;
    const from = kingE.position.clone().add(new THREE.Vector3(0, KING_HEIGHT + 0.3, 0));
    const mesh = ballMesh(0xffffff, 0xff5a2a);
    mesh.scale.setScalar(1.3);
    mesh.position.copy(from);
    scene.add(mesh);
    const time = windup.gate ? GATE_FLIGHT : lerp(THROW_FLIGHT[0], THROW_FLIGHT[1], ramp());
    throws.push({ mesh, marks: windup.marks, from, to: windup.to, t: 0, time, gate: windup.gate });
    windup = null;
    swingAfter = 0;
    throwGap = THROW_GAP;
    stats.tiradas++;
    audio.bossThrow();
  }

  function land(th: Throw): void {
    th.marks.forEach((m) => m.dispose());
    scene.remove(th.mesh);
    (th.mesh.material as THREE.Material).dispose();
    if (th.gate) {
      effects.explosion(th.to.clone(), 1.6, 0xff7a3c);
      ctx.hitGate(GATE_DAMAGE, kingE);
      stats.aPuerta++;
      return;
    }
    const p = ctx.player();
    const d = Math.min(Math.hypot(p.position.x - th.to.x, p.position.z - th.to.z), Math.hypot(p.anchor.x - th.to.x, p.anchor.z - th.to.z));
    effects.explosion(th.to.clone(), 0.9, 0xffe0a0);
    if (p.alive && d < THROW_RADIUS && !ctx.over()) {
      if (!p.invulnerable) stats.pegadas++;
      ctx.hitPlayer(THROW_DAMAGE, th.to, kingE);
      return;
    }
    // la esquivaste: queda en el puesto, y es tuya otra vez
    if (!RETURN_DODGED) return;
    const i = freeSpot(nearestSpot(ctx, th.to.x));
    if (i >= 0 && !playerOn(i)) {
      tees.place(i, false, true);
      stats.devueltas++;
    }
  }

  // ---- el palanquín y la pelea ----
  function moveLitter(dt: number): void {
    moveX = 0;
    if (phase === 'enter') {
      pos.z = Math.max(HOLD_Z, pos.z - ENTER_SPEED * dt);
      if (pos.z <= HOLD_Z) {
        phase = 'patrol';
        pauseLeft = 0.5;
        patrolTo = pos.x;
      }
    } else if (phase === 'patrol') {
      if (pauseLeft > 0) pauseLeft -= dt;
      else {
        const dx = patrolTo - pos.x;
        if (Math.abs(dx) < 0.05) {
          pauseLeft = lerp(PATROL_PAUSE[0], PATROL_PAUSE[1], ctx.rng());
          // la próxima punta: del otro lado, a por lo menos 5 m
          let next = (ctx.rng() * 2 - 1) * PATROL_X;
          if (Math.abs(next - pos.x) < 5) next = pos.x > 0 ? -Math.abs(next) - 2 : Math.abs(next) + 2;
          patrolTo = THREE.MathUtils.clamp(next, -PATROL_X, PATROL_X);
        } else {
          const step = Math.sign(dx) * Math.min(Math.abs(dx), PATROL_SPEED * dt);
          pos.x += step;
          moveX = step / dt;
        }
      }
    }
    // el palanquín: a la altura de los hombros, con un vaivén al caminar; caído, en el piso y torcido
    const target = phase === 'down' ? 1 : 0;
    drop += (target - drop) * (1 - Math.exp(-8 * dt));
    const walking = phase === 'enter' || Math.abs(moveX) > 0.05;
    const bob = walking ? Math.sin(ctx.clock() * 9) * 0.04 : 0;
    litter.position.set(pos.x, heightAt(pos.x, pos.z) + POLE_Y - drop * (POLE_Y - 0.25) + bob, pos.z);
    // con un cargador menos ya se ladea un poco: avisa que está por caerse
    const missing = new THREE.Vector2();
    porters.forEach((p, i) => {
      if (!p) missing.add(new THREE.Vector2(SLOTS[i][0], SLOTS[i][1]));
    });
    const lean = phase === 'down' ? tilt : missing;
    const k = phase === 'down' ? 0.28 : 0.12;
    litter.rotation.set(Math.sign(lean.y) * -k * Math.min(1, Math.abs(lean.y)), 0, Math.sign(lean.x) * k * Math.min(1, Math.abs(lean.x)));
  }

  function updateThieves(dt: number): void {
    for (let i = thieves.length - 1; i >= 0; i--) {
      const t = thieves[i];
      if (t.e.alive) continue;
      drop1(t);
      thieves.splice(i, 1);
    }
    const pulse = 0.5 + 0.5 * Math.sin(ctx.clock() * 8);
    for (const t of thieves) {
      const go = t.state === 'go';
      const x = spots[t.spot];
      // la franja hasta la pelota que viene a buscar, y un anillo en esa pelota
      if (go || t.state === 'wait') {
        t.lane.between(t.e.position.x, t.e.position.z, x, TEE_Z + GRAB_Z).opacity(go ? 0.3 : 0.12);
        t.ring.at(x, TEE_Z).size(go ? 0.75 + 0.15 * pulse : 0.6).opacity(go ? 0.55 + 0.35 * pulse : 0);
      } else {
        t.lane.opacity(0);
        t.ring.opacity(0);
      }
    }
    if (ctx.over() || won) return;
    thiefTimer -= dt;
    const max = Math.round(lerp(THIEF_MAX[0], THIEF_MAX[1], ramp()));
    if (thiefTimer <= 0 && thieves.length < max) {
      thiefTimer = lerp(THIEF_EVERY[0], THIEF_EVERY[1], ramp());
      spawnThief();
      if (angry && thieves.length < max) spawnThief();
    }
  }

  function updateThrows(dt: number): void {
    if (swingAfter >= 0) {
      swingAfter += dt;
      if (swingAfter > 0.3) swingAfter = -1;
    }
    throwGap -= dt;
    if (windup) {
      windup.t += dt;
      const u = Math.min(1, windup.t / THROW_WINDUP);
      windup.marks[0]?.opacity(0.12 + 0.2 * u);
      if (windup.t >= THROW_WINDUP) release();
    } else if (queued > 0 && throwGap <= 0 && up() && hop >= 1 && !ctx.over() && !won && ctx.player().alive) startWindup();
    for (let i = throws.length - 1; i >= 0; i--) {
      const th = throws[i];
      th.t += dt / th.time;
      const u = Math.min(1, th.t);
      arcPoint(th.from, th.to, u, th.gate ? THROW_HEIGHT * 1.3 : THROW_HEIGHT, th.mesh.position);
      th.mesh.rotation.x += dt * 9;
      // la marca se llena a medida que llega
      th.marks[0]?.opacity(0.3 + 0.35 * u);
      if (u < 1) continue;
      throws.splice(i, 1);
      land(th);
    }
    for (let i = flybacks.length - 1; i >= 0; i--) {
      const f = flybacks[i];
      f.t += dt / RECOVER_FLIGHT;
      const u = Math.min(1, f.t);
      const to = new THREE.Vector3(spots[f.spot], 0.15, TEE_Z);
      arcPoint(f.from, to, u, 2.5, f.mesh.position);
      if (u < 1) continue;
      flybacks.splice(i, 1);
      scene.remove(f.mesh);
      (f.mesh.material as THREE.Material).dispose();
      const at = freeSpot(f.spot);
      if (at >= 0) tees.place(at, false, true);
    }
  }

  function updatePorters(): void {
    // los recambios salen de atrás del palanquín, de a uno por cada muerto
    for (let i = replaceAt.length - 1; i >= 0; i--) {
      if (ctx.clock() < replaceAt[i] || won) continue;
      replaceAt.splice(i, 1);
      const slot = porters.findIndex((p, s) => !p && !coming.some((c) => c.slot === s));
      if (slot < 0) continue;
      const x = pos.x + SLOTS[slot][0] * 2;
      const z = pos.z + REPLACE_FROM;
      coming.push({ e: spawnPorter(slot, x, z), slot });
    }
  }

  /** El rey murió: los suyos se van, y el palanquín queda tirado. */
  function scatter(): void {
    scattered = true;
    for (const t of thieves) {
      drop1(t);
      if (t.e.alive) {
        effects.explosion(t.e.position.clone().setY(0.6), 0.8, THIEF_COLOR);
        t.e.remove();
      }
    }
    thieves.length = 0;
    for (const p of [...porters, ...coming.map((c) => c.e)]) {
      if (p?.alive) {
        effects.explosion(p.position.clone().setY(0.7), 0.9, 0x9a8f80);
        p.remove();
      }
    }
    coming.length = 0;
    windup?.marks.forEach((m) => m.dispose());
    windup = null;
    for (const th of throws) {
      th.marks.forEach((m) => m.dispose());
      scene.remove(th.mesh);
    }
    throws.length = 0;
    phase = 'down';
    tilt.set(1, -1);
    ctx.banner(L('¡Cayó el Rey goblin!', 'The Goblin King is down!'), '', 2.5);
  }

  ctx.banner(L('El Rey goblin ladrón', 'The Goblin Thief King'), L('Sus pícaros vienen por tus pelotas', 'His thieves are after your golf balls'), 3);

  return {
    get done() {
      return won;
    },
    update(dt) {
      if (!kingE.alive) won = true;
      if (won) {
        if (!scattered) scatter();
        // el palanquín queda tirado
        moveLitter(dt);
        bar.show(false);
        return;
      }
      moveLitter(dt);
      updatePorters();
      // con dos cargadores menos, se cae
      if (phase === 'patrol' && porters.filter(Boolean).length <= FALL_AT) fall();
      if (phase === 'down') {
        downFor += dt;
        if (downFor >= DOWN_TIME && porters.every(Boolean) && !coming.length) rise();
      }
      if (!angry && kingE.hp <= kingE.maxHp * ANGRY_AT) {
        angry = true;
        ctx.banner(L('¡El rey se enoja!', 'The king is furious!'), L('Más pícaros, y más rápidos', 'More thieves, and faster'), 2);
        audio.eliteAlert();
      }
      updateThieves(dt);
      updateThrows(dt);
      // la corona sigue la cabeza
      if (head) {
        head.getWorldPosition(crown.position);
        crown.position.y += 0.12 * (KING_HEIGHT / 2.7);
      } else crown.position.copy(kingE.position).setY(kingE.position.y + KING_HEIGHT + 0.05);
      crown.rotation.y += dt * 0.6;
      // la barra: la vida, y lo que hay que hacer
      const left = Math.max(0, kingE.hp);
      let sub: string;
      if (!up()) sub = rules.guarded ? L('¡En el piso! Ahora le entra', 'He\'s down! Now he can be hurt') : L('¡En el piso! Le entra el doble', 'He\'s down! Double damage');
      else if (rules.guarded) sub = L('Tirá a los cargadores para bajarlo', 'Hit the bearers to bring him down');
      else sub = L(`Pelotas en la bolsa: ${queued} · Pícaros: ${thieves.length}`, `Balls in his sack: ${queued} · Thieves: ${thieves.length}`);
      bar.set(left, kingE.maxHp, sub);
      bar.color(up() ? '#d9a93a' : '#ff6a3a');
    },
    bot: {
      // donde va a caer una pelota del rey (la que levanta y las que vuelan)
      danger(x) {
        const near = (m: THREE.Vector3) => Math.abs(m.x - x) < THROW_RADIUS + 0.7;
        if (windup && !windup.gate && near(windup.to)) return true;
        return throws.some((th) => !th.gate && near(th.to));
      },
      weight(e) {
        const t = thieves.find((x) => x.e === e);
        if (t) {
          // el que lleva una pelota es lo más urgente (en la puerta, más); el que viene, según cuánto le falta
          if (t.state === 'carry') return rules.target === 'gate' ? 4 : 3;
          if (t.state === 'back') return 0.3;
          return 2 + Math.max(0, 1.5 - (e.position.z - TEE_Z) / 15);
        }
        if (e === kingE) return rules.guarded && up() ? 0 : up() ? 1 : 2.5;
        // los cargadores: en el del palanquín son la llave; si no, un poco
        if (porters.includes(e) || coming.some((c) => c.e === e)) return rules.guarded ? (up() ? 1.6 : 0.4) : 0.5;
        return 1;
      },
    },
    log: () => ({ rey: Math.max(0, king().hp), ...stats }),
    dispose() {
      for (const t of thieves) drop1(t);
      for (const th of throws) {
        th.marks.forEach((m) => m.dispose());
        scene.remove(th.mesh);
      }
      for (const f of flybacks) scene.remove(f.mesh);
      windup?.marks.forEach((m) => m.dispose());
      disposeObject(scene, litter);
      disposeObject(scene, crown);
      bar.dispose();
    },
  };
}

/** Sin el jefe goblin de la escolta: se confundía con el rey. */
function escort(wave: Wave): void {
  wave.groups = wave.groups.filter((g) => g.kind !== 'warchief');
}

const BASE: Rules = { target: 'player', carry: true, guarded: false, downMul: 2, hp: 60 };

export const BOSSES: BossDef[] = [
  {
    id: 'rey.lanza',
    name: L('Rey goblin ladrón', 'Goblin Thief King'),
    blurb: 'Los pícaros se llevan la pelota hasta el rey (matalos y vuelve) y él te la tira al puesto: esquivala y es tuya.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, BASE),
  },
  {
    id: 'rey.puerta',
    name: L('Rey goblin ladrón', 'Goblin Thief King'),
    blurb: 'Como lanza, pero cada pelota que le llega la tira a la puerta: no se esquiva, hay que pararlos antes.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, { ...BASE, target: 'gate' }),
  },
  {
    id: 'rey.gloton',
    name: L('Rey goblin ladrón', 'Goblin Thief King'),
    blurb: 'El pícaro se come la pelota en el puesto y el rey te tira una en el acto: no hay segunda oportunidad.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, { ...BASE, carry: false }),
  },
  {
    id: 'rey.palanquin',
    name: L('Rey goblin ladrón', 'Goblin Thief King'),
    blurb: 'Arriba del palanquín es inmune: matá dos cargadores, cae al piso y recién ahí le entra.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, { ...BASE, guarded: true, downMul: 1, hp: 36 }),
  },
];
