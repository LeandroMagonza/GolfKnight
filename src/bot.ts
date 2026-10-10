// Bot que juega solo, para chequear el balance, para mirarlo jugar y para probar de Abe sin un amigo. Se
// activa con ?bot en la URL (http://localhost:5173/?bot) y lo usa tools/botplay.mjs. Con
// ?bot&transmitir=CÓDIGO espera a Abe y juega una partida tras otra (ver `botAutostart` en main). Maneja el
// juego como una persona: mueve el mouse, aprieta teclas y carga los tiros en tiempo real, con la barra
// de verdad.
//
// Desde el 9/10 (pedidos de Leandro: el de antes erraba mucho, sobre todo en diagonal y contra los que
// esquivan; después, perdió contra el élite del escudo) juega en serio, con tres niveles (`?bot=perfecto`,
// `bueno` o `flojo`; sin nada, perfecto):
// - **Apunta adonde va a estar el enemigo.** Simula el vuelo de la pelota con la misma física del juego
//   (core/ballistics, con los números de cada palo) y mide la velocidad de cada enemigo mirándolo caminar
//   (va en diagonal, frena, lo enfría el hielo): el blanco es dónde van a coincidir los dos. Mientras carga
//   sigue corrigiendo, y también mientras baja el palo, hasta que sale la pelota.
// - **Carga lo justo.** De cada palo y cada golpe sabe cuánto pega (con el blindaje, el tope del fantasma,
//   la lupa y la marca de Abe) y cuánto tarda la barra en llegar.
// - **Elige el tiro y el puesto.** Prueba los tiros que tiene desde cada puesto con pelota (contando lo
//   que tarda en ir) y se queda con el que más vale por segundo: lo que les saca a todos los que agarra la
//   línea, pesado por lo que apura cada uno (cuánto le falta para llegar) y por lo que es (el élite y el
//   jefe pesan más; el silenciado con escudo, más todavía mientras dure). Así deja venir a los de un lado
//   que no apuran, y cuando se encolumnan los atraviesa juntos con el driver. Con el driver además se
//   corre con la pelota (hasta `SHIFT.reach`) para que la línea agarre a otro más.
// - **Nunca le tira a un escudo de frente**, ni de rebote más atrás en la línea del driver: vuelve contra
//   el caballero. Al del escudo: **el hierro a la cabeza** (apuntado detrás de él, el arco le llega por
//   encima del escudo); **el globo del wedge** cayendo detrás o al costado (lo que estalla adelante lo tapa
//   el escudo), donde agarre a más; o el combo: **carga un tiro fuerte y en el momento justo tira el
//   silenciador**, contando lo que tarda en llegar cada pelota, para que el fuerte le llegue con el escudo
//   bajo (al élite el silencio le dura la mitad: hay que clavarlo).
// - **Clava la carga y espera** (la barra espaciadora): contra el intocable carga, clava el golpe y suelta
//   justo para que la pelota llegue cuando se le abre la ventana.
// - **El que esquiva y la burbuja**: un tiro corto de cebo (la esquiva salta al soltar, la burbuja se come
//   el primer golpe) y después el que importa, antes de que se recarguen.
// - **El que se cura** (9/10, de mirarlo jugar: le pegaba justo antes de la cura, y se distraía con otro
//   y volvía tarde): lo que le saca solo vale si lo puede terminar antes de que se cure. Si no llega,
//   carga, clava y suelta para que la pelota le llegue recién curado, con todo el ciclo por delante; y al
//   que ya empezó lo termina antes que a otro (lo que le sacó se pierde si se cura).
// - **Las habilidades, cada una a lo suyo** (ver `abilityPlan`): las de tiro con la misma puntería que los
//   tiros y solo si llegan (el putter, 20 m); el carrito, a una fila; el hoyo, en el camino de uno; la
//   bandera, detrás de un grupo para juntarlo; la pólvora y la lupa, en un montón; los refuerzos, cuando
//   hay a quién pegarle.
// - **Se corre** de los hechizos que le caen en el puesto y de las pelotas que le devuelve un escudo (la
//   marca roja: va adonde estaba). Y de los que le van a pasar por encima camino a la puerta (lo
//   atropellan; el élite, de una): mira por dónde va a pasar cada uno, no carga en un puesto por el que
//   alguien pasa antes de que termine el golpe, suelta la carga si se le viene uno, y al que lo tiene
//   encima le da un palazo si lo tiene listo.
// - Las cartas, al azar.
// - **Sin habilidades** (10/10, en el panel de balance, pestaña Pruebas, o `?sinhabilidades`; ver
//   botPrefs): no tira Q W E R, ni el silenciador del combo, ni el palazo, y en las cartas se queda con una
//   mejora o una cura cuando hay. Para ver si pasa el juego sin ellas.

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { BALL_RADIUS, GRAVITY, launch, launchSpeed, stepBall, type BounceParams } from './core/ballistics';
import { areaDamageFor, CLUBS, damageFor, fourthFrom, qualityMarks, qualityOf, rollFrictionFor, SHIFT, spreadFor, topQuality, type Club, type ClubId } from './core/clubs';
import { ABILITIES, CART, ELEMENTS, FLAG, LENS, POWDER, shotQuality } from './core/abilities';
import { behindShield, RICOCHET, SHIELD_FRONT, SHIELD_TOP, shieldFaces } from './core/shield';
import { heightAt } from './core/terrain';
import { DODGE, RANGED, SHIELD_WALL } from './core/waves';
import type { ChargeTimes } from './core/swing';
import { BOT_PREFS } from './botPrefs';
import { TRAMPLE_REACH } from './game/enemies';

type Gk = any;
type Enemy = any;

export interface BotStats {
  /** El nivel con el que juega. */
  skill: string;
  byClub: Record<string, number>;
  /** Habilidades tiradas, por nombre. */
  casts: Record<string, number>;
  melee: number;
  moves: number;
  dodges: number;
  grabs: number;
  jumps: number;
  /** Tiros cortos para gastarle la esquiva o la burbuja a uno. */
  baits: number;
  /** Veces que se corrió de un hechizo o de un rebote. */
  evades: number;
  /** Cargas que soltó porque se le venía uno encima. */
  aborts: number;
  /** Tiros que salieron corridos del puesto para alinear a varios. */
  aligned: number;
  /** Tiros de hierro a la cabeza, por encima del escudo. */
  heads: number;
  /** Silenciadores tirados mientras cargaba el tiro fuerte (el combo). */
  combos: number;
  /** Cargas clavadas esperando el momento (el intocable). */
  holds: number;
  /** Pelotas (sin los cebos) que le pegaron a alguien, y las que no. */
  hit: number;
  miss: number;
}

/** Qué tan bien juega. */
export interface BotSkill {
  /** Cada cuánto decide qué hacer (s): lo que tarda en reaccionar. */
  think: number;
  /** El error de puntería, en metros (el desvío típico). */
  aimError: number;
  /** Qué tan seguido saca el golpe que buscaba (si no, le sale uno menos). */
  timing: number;
  /** Si no es null, suelta siempre en este golpe y no piensa (el de antes). */
  fixedQuality: number | null;
  /** Busca líneas que agarren a varios con el driver, corriéndose con la pelota. */
  align: boolean;
  /** Elige a qué puesto ir según el tiro que tiene desde ahí (si no, al más cercano con pelota). */
  posts: boolean;
  /** Le gasta la esquiva y la burbuja con un tiro corto antes del que importa. */
  bait: boolean;
  /** Se corre de los hechizos que le caen. */
  evade: boolean;
  /** Contra el escudo: hierro a la cabeza y wedge. */
  shields: boolean;
  /** Usa las habilidades pensando (si no, al grupo más cercano, como el de antes). */
  abilities: boolean;
  /** Sabe del que se cura: no le pega lo que no llega a terminar, espera la cura y termina lo que empezó. */
  regen: boolean;
}

export const BOT_SKILLS: Record<string, BotSkill> = {
  perfecto: { think: 0.05, aimError: 0, timing: 1, fixedQuality: null, align: true, posts: true, bait: true, evade: true, shields: true, abilities: true, regen: true },
  bueno: { think: 0.3, aimError: 0.35, timing: 0.85, fixedQuality: null, align: false, posts: true, bait: true, evade: true, shields: true, abilities: true, regen: true },
  // más o menos el de antes: suelta en el 2 y no sabe nada de los poderes
  flojo: { think: 0.6, aimError: 0.8, timing: 1, fixedQuality: 2, align: false, posts: false, bait: false, evade: false, shields: false, abilities: false, regen: false },
};

/** Cada palo tiene su tecla: Digit1 a Digit4, en este orden. */
const CLUB_ORDER: ClubId[] = ['driver', 'iron', 'wedge', 'putter'];
/** Las teclas de los cuatro lugares de habilidad. */
const SLOT_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'];
/** Hasta dónde llega el putter de verdad (rueda 20 m y frena): un poco menos, para no quedar corto. */
const PUTTER_REACH = 18.5;
/** Lo que tarda en volver a estar listo después de un tiro (moverse al otro puesto, más o menos). */
const AFTER_SHOT = 0.7;
/** Lo que tarda en llegar el mouse al juego, para las habilidades que salen al toque. */
const CAST_LAG = 0.1;
/** El globo de la pólvora y la lupa (ver LOB en game/abilities). */
const LOB = { loftDeg: 55, gravity: 40 };
/**
 * El que se cura: lo que llega hasta `before` s antes de la cura es antes; hasta `after` s después, no se
 * sabe (cuenta como después, sin tiempo para seguir). `wait` es cuánto después de la cura hacerla llegar
 * cuando la espera.
 */
const REGEN_EDGE = { before: 0.12, after: 0.08, wait: 0.2 };
/** Cuánto se puede apartar el cuerpo de la pelota al pararse a tirar (según adónde apunte), más margen. */
const STANCE_PAD = 1.0;

function key(code: string): void {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
}

/** Un número al azar con distribución normal (media 0, desvío 1). */
function gauss(): number {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ---- el vuelo de la pelota ----

/** La distancia que lleva recorrida la pelota, cada 1/240 s, desde que sale. */
const flights = new Map<string, number[]>();
const FLIGHT_DT = 1 / 240;

/** Cómo viaja la pelota rasante (driver, putter) de ese palo y ese golpe, con la misma física que el juego. */
function flightOf(club: Club, q: number, range: number): number[] {
  const id = `${club.id}:${q}:${range.toFixed(1)}`;
  let f = flights.get(id);
  if (f) return f;
  const loft = THREE.MathUtils.degToRad(club.loftDeg);
  const bounce: BounceParams = { restitution: club.restitution, bounceKeep: club.bounceKeep, gravity: club.gravity, rollFriction: rollFrictionFor(club, q) };
  const s = launch({ x: 0, y: BALL_RADIUS, z: 0 }, 0, 1, range, loft, club.gravity, bounce.rollFriction);
  f = [0];
  for (let i = 0; i < 4 / FLIGHT_DT && !s.resting; i++) {
    stepBall(s, FLIGHT_DT, bounce);
    f.push(s.pos.z);
  }
  flights.set(id, f);
  return f;
}

/** Lo que tarda un tiro parabólico que cae a `range` m en recorrer `x` m (el wedge, el hierro, los globos). */
function lobTime(loftDeg: number, gravity: number, range: number, x = range): number {
  const loft = THREE.MathUtils.degToRad(loftDeg);
  const v = launchSpeed(Math.max(1, range), loft, gravity);
  return x / (v * Math.cos(loft));
}

/** Cuánto tarda la pelota en recorrer `dist` metros, o Infinity si no llega. */
function flightTime(club: Club, q: number, dist: number): number {
  if (club.id === 'wedge' || club.id === 'iron') return dist > club.maxRange ? Infinity : lobTime(club.loftDeg, club.gravity ?? GRAVITY, dist);
  if (club.id === 'putter' && dist > PUTTER_REACH) return Infinity;
  const f = flightOf(club, q, club.fixedRange > 0 ? club.fixedRange : dist);
  for (let i = 1; i < f.length; i++) {
    if (f[i] >= dist) return (i - 1 + (dist - f[i - 1]) / Math.max(1e-6, f[i] - f[i - 1])) * FLIGHT_DT;
  }
  return Infinity;
}

/** Hasta dónde llega la pelota rasante de ese palo y golpe. */
function travel(club: Club, q: number): number {
  if (club.id === 'putter') return PUTTER_REACH;
  const f = flightOf(club, q, club.fixedRange > 0 ? club.fixedRange : club.maxRange);
  return f[f.length - 1];
}

/** Cuánto tarda la barra en llegar al golpe `q` (el 1 es soltar enseguida). */
function chargeTime(q: number, t: ChargeTimes): number {
  if (q <= 1) return 0.02;
  if (q === 2) return t.weak;
  if (q === 3) return t.weak + t.mid;
  const [, b] = qualityMarks();
  return t.weak + t.mid + ((fourthFrom() - b) / (1 - b)) * (t.strong / 2);
}

/** Lo que tarda en ir de un puesto a otro (`n` puestos): uno, unos 0.4 s. */
function walkTime(n: number): number {
  return n === 0 ? 0 : 0.3 + 0.13 * n;
}

// ---- lo que sabe de cada enemigo ----

interface Track {
  x: number;
  z: number;
  t: number;
  vx: number;
  vz: number;
  fresh: boolean;
}

/** Un tiro pensado: a quién, con qué palo y golpe, desde qué puesto, y cómo apuntar. */
interface Plan {
  target: number;
  club: Club;
  q: number;
  /** El puesto desde donde sale (el de ahora, o al que tiene que ir). */
  spot: number;
  /** Cuánto correrse con la pelota (metros de x) antes de soltar, o null si no. */
  shift: number | null;
  /** Cómo apuntar: adonde va a estar (`lead`), adonde está ahora (el cebo), detrás (el wedge), o a la cabeza (el hierro). */
  mode: 'lead' | 'bait' | 'area' | 'head';
  /** Lo que vale por segundo: para elegir entre tiros y puestos. */
  score: number;
  /** El wedge: dónde cae, respecto de donde va a estar el blanco (detrás o al costado). */
  offset?: { x: number; z: number };
  /** El combo: el silenciador del lugar `slot`, que tarda `flight` s en llegar, tirado mientras carga. */
  combo?: { slot: number; flight: number };
  /** Clavar la carga y soltar recién a esta hora del juego (para que llegue cuando se abre el intocable). */
  releaseAt?: number;
  /** El error de puntería de este tiro (fijo para todo el tiro, como el pulso de una persona). */
  nx: number;
  nz: number;
}

/** Lo que agarra la línea de un tiro: a quiénes, a qué distancia y cuándo, y si la devuelve un escudo. */
interface Scan {
  hits: { e: Enemy; d: number; t: number }[];
  ricochet: boolean;
}

export function startBot(): BotStats {
  const gk: Gk = (window as any).__gk;
  const name = new URLSearchParams(location.search).get('bot') || 'perfecto';
  const skill = BOT_SKILLS[name] ?? BOT_SKILLS.perfecto;
  const stats: BotStats = { skill: BOT_SKILLS[name] ? name : 'perfecto', byClub: {}, casts: {}, melee: 0, moves: 0, dodges: 0, grabs: 0, jumps: 0, baits: 0, evades: 0, aborts: 0, aligned: 0, heads: 0, combos: 0, holds: 0, hit: 0, miss: 0 };
  (window as any).__bot = stats;

  // El bot apunta moviendo el mouse. Para que el mouse de quien mira no le corra la puntería, repite
  // su última posición en cada cuadro.
  let aimX = innerWidth / 2;
  let aimY = innerHeight / 3;
  const aim = (x: number, z: number) => {
    const s = gk.screenOf(x, z);
    aimX = s.x;
    aimY = s.y;
  };
  const holdAim = () => {
    dispatchEvent(new MouseEvent('mousemove', { clientX: aimX, clientY: aimY }));
    requestAnimationFrame(holdAim);
  };
  holdAim();

  const tracks = new Map<number, Track>();
  const tee = new THREE.Vector3();
  let plan: Plan | null = null;
  /** Cuándo soltó, para medir cuánto tarda en salir la pelota (baja el palo). */
  let releasedAt = -1;
  let shotsAtRelease = 0;
  let delay = 0.2;
  /** Desde que soltó hasta que termina el gesto y puede moverse (se mide, como `delay`). */
  let swingFrom = -1;
  let swingTail = 0.6;
  /** Las pelotas que salieron (sin los cebos), para contar las que pegan. */
  const flying: any[] = [];
  let baitShot = false;
  let nextThink = 0;
  /** Recién tiró una habilidad: espera a que salga antes de cargar un tiro. */
  let busyUntil = 0;
  /** El silenciador del combo, esperando su momento: qué lugar y a qué hora del juego tirarlo. */
  let combo: { slot: number; at: number } | null = null;
  let castAt = -10;
  let dodgedAt = -10;
  let cardSince = 0;
  let escaping = false;
  let last = performance.now();
  /** Para las pruebas: mira (sigue midiendo a los enemigos) pero no toca nada. */
  let off = false;

  const alive = (): Enemy[] => gk.horde.enemies.filter((e: Enemy) => e.alive && !e.passed);
  const has = (id: ClubId) => gk.player.unlocked?.has?.(id) ?? true;

  /** Mira a todos: dónde están y a qué velocidad van (promediando, para que un tropezón no lo engañe). */
  function observe(now: number): void {
    const seen = new Set<number>();
    for (const e of gk.horde.enemies) {
      if (!e.alive || e.passed) continue;
      seen.add(e.id);
      const t = tracks.get(e.id);
      if (!t) {
        tracks.set(e.id, { x: e.position.x, z: e.position.z, t: now, vx: 0, vz: 0, fresh: true });
        continue;
      }
      const dt = now - t.t;
      if (dt < 0.08) continue;
      const k = t.fresh ? 1 : 0.5;
      t.vx += ((e.position.x - t.x) / dt - t.vx) * k;
      t.vz += ((e.position.z - t.z) / dt - t.vz) * k;
      t.x = e.position.x;
      t.z = e.position.z;
      t.t = now;
      t.fresh = false;
    }
    for (const id of tracks.keys()) if (!seen.has(id)) tracks.delete(id);
  }

  /** Dónde va a estar `e` dentro de `t` segundos. */
  function predict(e: Enemy, t: number): { x: number; z: number } {
    const tr = tracks.get(e.id);
    // recién aparecido: todavía no se le midió la velocidad, va derecho hacia la puerta
    const vx = tr && !tr.fresh ? tr.vx : 0;
    const vz = tr && !tr.fresh ? tr.vz : -(e.walkSpeed ?? 0);
    return { x: e.position.x + vx * t, z: Math.max(0.8, e.position.z + vz * t) };
  }

  /** Cuándo se vuelve un problema: llega a la puerta, o al caballero (el alma en pena). */
  function eta(e: Enemy, from: THREE.Vector3): number {
    const tr = tracks.get(e.id);
    const speed = Math.max(0.3, tr && !tr.fresh ? Math.hypot(tr.vx, tr.vz) : e.walkSpeed ?? 1);
    if (e.state === 'attack') return 0;
    if (e.behavior === 'grabber') return Math.hypot(e.position.x - from.x, e.position.z - from.z) / speed;
    // el hechicero se queda lejos tirando: molesta, pero no llega
    if (e.behavior === 'ranged') return 6;
    return Math.max(0, e.position.z - 1) / speed;
  }

  /** Cuánto apura: de 1 (lejos) a 5 (encima). */
  function urgency(e: Enemy, from: THREE.Vector3): number {
    return 1 + 4 * clamp01(1 - eta(e, from) / 14);
  }

  /** Lo que es: el élite y el jefe pesan más; el que apura de otra forma (kamikaze, alma en pena), también. */
  function weight(e: Enemy): number {
    let w = 1;
    if (e.size > 1 || e.stats?.boss) w = 3;
    else if (e.behavior === 'grabber' || e.behavior === 'kamikaze') w = 2;
    // abierto ahora: silenciado con escudo o blindaje (dura poco: hay que aprovecharlo)
    if (e.silenced && (e.hasShield || e.armorLevel > 0)) w *= 2;
    return w;
  }

  /**
   * Lo que vale sacarle `dmg` a `e` con una pelota que le llega dentro de `t` s: lo que le saca de verdad,
   * más un plus si lo mata, por lo que pesa y apura. Al que se cura (ver `regenWindow`), lo que no lo
   * termina vale solo si se lo puede terminar antes de que se cure; y terminar al que ya se empezó salva lo
   * que se le sacó (si no, se pierde): vale eso de más, y apura más cuanto menos le falta para curarse.
   */
  function value(e: Enemy, dmg: number, from: THREE.Vector3, t = 0): number {
    if (dmg <= 0) return 0;
    let hp: number = e.hp;
    let saved = 0;
    let urge = urgency(e, from);
    const rg = skill.regen ? regenWindow(e, t) : null;
    if (rg) {
      hp = rg.hp;
      const invested = e.maxHp - hp;
      if (dmg < hp) {
        if (finishTime(e, hp - dmg, from) > rg.left) return 0;
        saved = invested / 2;
      } else saved = invested;
      // si no es este tiro, ¿llega otro antes de que se cure?
      if (invested > 0) urge = Math.max(urge, rg.left < 1.5 * shotGap(topQuality()) ? 5 : 3);
    }
    return (Math.min(hp, dmg) + (dmg >= hp ? 1.5 : 0) + saved) * weight(e) * urge;
  }

  /**
   * El que se cura (ver REGEN en core/waves): la vida que tiene cuando le llega la pelota, dentro de `t` s
   * (si se curó antes, entera), y cuánto le falta desde ahí para la próxima cura. Silenciado el ciclo no
   * corre, y arranca de cero cuando se le pasa. Null si no se cura.
   */
  function regenWindow(e: Enemy, t: number): { hp: number; left: number } | null {
    if (!e.mods?.regen) return null;
    const period: number = e.regenPeriod;
    const heal = healIn(e);
    if (t < heal - REGEN_EDGE.before) return { hp: e.hp, left: heal - t };
    if (t < heal + REGEN_EDGE.after) return { hp: e.maxHp, left: 0 };
    return { hp: e.maxHp, left: heal + period * Math.ceil((t - heal) / period) - t };
  }

  /** Cuánto le falta al que se cura para curarse. */
  function healIn(e: Enemy): number {
    return (e.silenced ? e.silenceTimer : 0) + (1 - e.regenProgress) * e.regenPeriod;
  }

  /** De un tiro al otro: cargar el golpe `q`, bajar el palo, ir al otro puesto y pensarlo. */
  function shotGap(q: number): number {
    return chargeTime(q, gk.player.timing) + delay + AFTER_SHOT + skill.think + 0.1;
  }

  /**
   * Cuánto tardan los tiros que siguen en sacarle `rest` de vida a `e` (desde `o`, con el driver o el
   * putter): cada uno con el golpe más corto que lo termina, o el más fuerte. Infinity si no le entra.
   */
  function finishTime(e: Enemy, rest: number, o: THREE.Vector3): number {
    const d = Math.hypot(e.position.x - o.x, e.position.z - o.z);
    const tops = Array.from({ length: topQuality() }, (_, i) => i + 1);
    const hit = (q: number) => Math.max(...(['driver', 'putter'] as ClubId[])
      .filter((id) => has(id) && (id !== 'putter' || d <= PUTTER_REACH))
      .map((id) => Math.max(0, Math.max(1, damageFor(CLUBS[id], d, q)) - e.armor)), 0);
    let time = 0;
    for (let i = 0; i < 8 && rest > 0; i++) {
      const q = tops.find((n) => hit(n) >= rest) ?? tops[tops.length - 1];
      const dmg = e.ethereal && !e.silenced ? Math.min(1, hit(q)) : hit(q);
      if (dmg <= 0) return Infinity;
      rest -= dmg;
      time += shotGap(q);
    }
    return rest > 0 ? Infinity : time;
  }

  /** ¿Tiene el escudo en alto dentro de `t` s? El silencio y el aturdido lo bajan mientras duran. */
  function shieldUpAt(e: Enemy, t: number): boolean {
    if (!e.hasShield || !e.alive) return false;
    if ((e.silenceTimer ?? 0) > t + 0.05) return false;
    if ((e.stunTimer ?? 0) > t + 0.05) return false;
    return true;
  }

  /** ¿El escudo de `e` para una pelota que sale de `o` y pasa por (x, z)? (De frente, en su arco.) */
  function faces(e: Enemy, o: THREE.Vector3, x: number, z: number): boolean {
    const dx = x - o.x;
    const dz = z - o.z;
    const len = Math.hypot(dx, dz) || 1;
    const f = e.facing;
    return (dx * f.x + dz * f.z) / len < -SHIELD_FRONT;
  }

  /** ¿Está protegido (el aura, o el intocable cerrado) cuando le llegaría la pelota, dentro de `t` s? */
  function shutAt(e: Enemy, t: number): boolean {
    if (!e.warded) {
      // abierto: que no se cierre antes de que llegue
      if (e.mods?.phase && e.phaseBar < 0) return -e.phaseBar * e.mods.phase < t;
      return false;
    }
    // el intocable cerrado se abre solo: si se abre antes de que llegue, vale
    if (e.mods?.phase && e.phaseShut) {
      const shut = e.phaseCycle - e.mods.phase;
      const opens = e.phaseBar * shut;
      return !(t > opens + 0.05 && t < opens + e.mods.phase - 0.05);
    }
    return true;
  }

  /**
   * Lo que le saca un pelotazo de `raw` dentro de `t` s: con el blindaje, el tope del fantasma, la lupa y la
   * marca de Abe. El golpe fantasma (`ghost`) entra entero. La burbuja se come el golpe.
   */
  function dealt(e: Enemy, raw: number, t: number, ghost = false): number {
    if (raw <= 0) return 0;
    const mark = e.markTimer > t ? 1 : 0;
    if (ghost) return Math.max(1, Math.round(raw)) + mark;
    if (shutAt(e, t)) return mark;
    if (e.divineReady && !e.silenced) return mark;
    let d = Math.max(1, Math.round(raw)) + (e.vulnerable ? 1 : 0);
    d = Math.max(0, d - e.armor);
    if (e.ethereal && !e.silenced) d = Math.min(d, e.enlarged ? LENS.ghostHit : 1);
    return d + mark;
  }

  /**
   * Lo que el escudo le descuenta a `e` de algo que estalla en (x, z) dentro de `t` s: el del escudo que mire
   * hacia la explosión y lo cubra (el suyo, o el de uno que tenga adelante). El muro, todo.
   */
  function areaGuard(x: number, z: number, e: Enemy, t: number): number {
    const at = { x, z };
    const pe = predict(e, t);
    let guard = 0;
    for (const s of alive()) {
      if (!shieldUpAt(s, t)) continue;
      const ps = predict(s, t);
      if (!shieldFaces(at, ps, s.facing)) continue;
      if (s === e || behindShield(at, ps, s.radius, pe, e.radius)) guard = Math.max(guard, s.shieldLevel);
    }
    return guard;
  }

  /** Lo que vale un área de `raw` que estalla en (x, z) dentro de `t` s, de radio `r`, para todos los que agarra. */
  function areaValue(x: number, z: number, r: number, raw: number, t: number, o: THREE.Vector3, need: Enemy | null = null): number {
    let total = 0;
    let got = need === null;
    for (const e of alive()) {
      const p = predict(e, t);
      if (Math.hypot(p.x - x, p.z - z) - e.radius > r) continue;
      const guard = areaGuard(x, z, e, t);
      if (guard >= SHIELD_WALL) continue;
      const dmg = Math.max(0, dealt(e, raw, t) - guard);
      if (dmg <= 0) continue;
      if (e === need) got = true;
      total += value(e, dmg, o, t);
    }
    return got ? total : 0;
  }

  /** Dónde y cuándo le pega la pelota a `e` (saliendo de `o` dentro de `lead` s): el blanco y la distancia. */
  function intercept(e: Enemy, club: Club, q: number, o: THREE.Vector3, lead: number): { x: number; z: number; d: number; t: number } | null {
    let t = lead + 0.3;
    let p = predict(e, t);
    for (let i = 0; i < 4; i++) {
      const d = Math.hypot(p.x - o.x, p.z - o.z);
      const ft = flightTime(club, q, d);
      if (!Number.isFinite(ft)) return null;
      t = lead + ft;
      p = predict(e, t);
    }
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    return Number.isFinite(flightTime(club, q, d)) ? { ...p, d, t } : null;
  }

  /**
   * Lo que agarra una línea de driver o putter desde `o` hacia (x, z), hasta donde llega: a quiénes y cuándo.
   * Se corta en el primer escudo que la para, y ahí la pelota vuelve contra el caballero (`ricochet`); el
   * aura de invencible la frena; el putter se queda en el primero que toca. Los que tienen la esquiva lista
   * saltan al soltar: no cuentan. El golpe fantasma (`ghost`) y el silenciador pasan los escudos.
   */
  function scanLine(club: Club, q: number, o: THREE.Vector3, x: number, z: number, lead: number, ghost = false, hush = false, open: Enemy | null = null): Scan {
    const len = Math.hypot(x - o.x, z - o.z) || 1;
    const ux = (x - o.x) / len;
    const uz = (z - o.z) / len;
    const reach = travel(club, q);
    const out: { e: Enemy; along: number; t: number }[] = [];
    for (const e of gk.horde.enemies) {
      if (!e.alive || e.passed) continue;
      const along0 = (e.position.x - o.x) * ux + (e.position.z - o.z) * uz;
      if (along0 < 0.5 || along0 > reach + 2) continue;
      // la esquiva salta con cualquier tiro que pase cerca (menos el fantasma, que no lo ve venir)
      if (!ghost && e.canDodge && Math.abs((e.position.x - o.x) * uz - (e.position.z - o.z) * ux) < DODGE.aimWidth + e.radius) continue;
      // dónde está cuando la pelota pasa por ahí
      const ft = flightTime(club, q, along0);
      if (!Number.isFinite(ft)) continue;
      const p = predict(e, lead + ft);
      const along = (p.x - o.x) * ux + (p.z - o.z) * uz;
      const side = Math.abs((p.x - o.x) * uz - (p.z - o.z) * ux);
      if (side > e.radius + BALL_RADIUS || along > reach) continue;
      out.push({ e, along, t: lead + ft });
    }
    out.sort((a, b) => a.along - b.along);
    const hits: Scan['hits'] = [];
    for (const h of out) {
      if (!ghost && !hush && h.e !== open && shieldUpAt(h.e, h.t) && faces(h.e, o, x, z)) return { hits, ricochet: true };
      if (!ghost && shutAt(h.e, h.t)) break;
      hits.push({ e: h.e, d: h.along, t: h.t });
      if (!club.pierces) break;
    }
    return { hits, ricochet: false };
  }

  /**
   * El hierro a la cabeza, por encima del escudo: dónde apuntar (detrás de `e`) para que el arco le llegue a
   * la altura de la cabeza, que el escudo no tapa. Null si no se puede (muy cerca, o más allá del alcance).
   */
  function headShot(e: Enemy, q: number, o: THREE.Vector3, lead: number): { x: number; z: number; d: number; t: number; range: number } | null {
    const club = CLUBS.iron;
    const tan = Math.tan(THREE.MathUtils.degToRad(club.loftDeg));
    const g = club.gravity ?? GRAVITY;
    let t = lead + 0.8;
    for (let i = 0; i < 4; i++) {
      const p = predict(e, t);
      const d = Math.hypot(p.x - o.x, p.z - o.z);
      // a la altura de la cabeza (entre lo que tapa el escudo y el tope), contando la loma donde va a estar:
      // la pelota sale de la altura 0 del puesto y el arco no sabe de lomas
      const want = heightAt(p.x, p.z) + e.height * (SHIELD_TOP + 1) / 2 - BALL_RADIUS;
      const contact = d - e.radius;
      // el arco: y = x tan(a) (1 - x / R). Para que pase por la cabeza en `contact`, R sale de ahí
      if (contact < 4 || want <= 0 || want >= contact * tan * 0.95) return null;
      const range = contact / (1 - want / (contact * tan));
      if (range > club.maxRange) return null;
      t = lead + lobTime(club.loftDeg, g, range, contact);
      if (i === 3) {
        const ux = (p.x - o.x) / d;
        const uz = (p.z - o.z) / d;
        return { x: o.x + ux * range, z: o.z + uz * range, d, t, range };
      }
    }
    return null;
  }

  /** El mejor tiro contra `e` desde `o` (el puesto `spot`, a `walk` s de ir), o null si no tiene uno. */
  function planFor(e: Enemy, o: THREE.Vector3, spot: number, walk: number, times: ChargeTimes): Plan | null {
    const noise = () => (skill.aimError ? gauss() * skill.aimError : 0);
    const make = (club: Club, q: number, mode: Plan['mode'], score: number): Plan => ({ target: e.id, club, q, spot, shift: null, mode, score, nx: noise(), nz: noise() });
    const near = Math.hypot(e.position.x - o.x, e.position.z - o.z);
    const tops = Array.from({ length: topQuality() }, (_, i) => i + 1);
    // el de antes: driver o putter en el golpe fijo, a lo que esté
    if (skill.fixedQuality) {
      const club = near <= 12 && has('putter') ? CLUBS.putter : CLUBS.driver;
      const q = Math.min(skill.fixedQuality, topQuality());
      return intercept(e, club, q, o, chargeTime(q, times) + delay + walk) ? make(club, q, 'lead', 1 / (1 + near)) : null;
    }
    // la esquiva y la burbuja: primero un tiro corto que se las gaste (vale menos que pegar, pero habilita)
    if (skill.bait && (e.canDodge || (e.divineReady && !e.silenced)) && has('driver') && near < travel(CLUBS.driver, 1)) {
      const cost = chargeTime(1, times) + delay + walk + AFTER_SHOT;
      return make(CLUBS.driver, 1, 'bait', (0.5 * value(e, Math.min(e.hp, 3), o, cost)) / cost);
    }
    let best: Plan | null = null;
    const consider = (p: Plan) => {
      if (!best || p.score > best.score) best = p;
    };
    // driver o putter, derecho: lo que agarra la línea, si no hay un escudo de frente en el camino
    for (const id of ['putter', 'driver'] as ClubId[]) {
      if (!has(id)) continue;
      const club = CLUBS[id];
      for (const q of tops) {
        const lead = chargeTime(q, times) + delay + walk;
        const hit = intercept(e, club, q, o, lead);
        if (!hit) continue;
        const scan = scanLine(club, q, o, hit.x, hit.z, lead);
        if (scan.ricochet || !scan.hits.some((h) => h.e === e)) continue;
        const total = scan.hits.reduce((n, h) => n + value(h.e, dealt(h.e, damageFor(club, h.d, q), h.t), o, h.t), 0);
        if (total <= 0) continue;
        consider(make(club, q, 'lead', total / (lead + AFTER_SHOT)));
      }
    }
    // Que la pelota llegue a una hora justa (`arrive` s desde ahora): carga, clava el golpe y suelta a
    // tiempo. Cuándo soltar se ajusta con el vuelo, que depende de dónde esté
    const timed = (arrive: number) => {
      if (arrive > 5) return;
      for (const id of ['putter', 'driver'] as ClubId[]) {
        if (!has(id)) continue;
        const club = CLUBS[id];
        for (const q of tops) {
          let lead = Math.max(0.1, arrive - 0.3);
          let hit = intercept(e, club, q, o, lead);
          for (let i = 0; i < 3 && hit; i++) {
            lead += arrive - hit.t;
            hit = intercept(e, club, q, o, lead);
          }
          if (!hit || lead < chargeTime(q, times) + delay + walk || shutAt(e, hit.t)) continue;
          const scan = scanLine(club, q, o, hit.x, hit.z, lead);
          if (scan.ricochet || !scan.hits.some((h) => h.e === e)) continue;
          const total = scan.hits.reduce((n, h) => n + value(h.e, dealt(h.e, damageFor(club, h.d, q), h.t), o, h.t), 0);
          if (total <= 0) continue;
          const p = make(club, q, 'lead', total / (lead + AFTER_SHOT));
          p.releaseAt = gk.clock + lead - delay;
          consider(p);
        }
      }
    };
    // el intocable cerrado: que llegue cuando se abre (un poco adentro de la ventana, por las dudas)
    if (e.mods?.phase && e.phaseShut && !e.silenced) timed(e.phaseBar * (e.phaseCycle - e.mods.phase) + Math.min(0.5, e.mods.phase / 2));
    // el que se cura: que llegue recién curado, con todo el ciclo por delante para terminarlo
    if (skill.regen && e.mods?.regen && !e.silenced) timed(healIn(e) + REGEN_EDGE.wait);
    // el escudo de frente: el hierro a la cabeza o el globo del wedge, que le caen por arriba
    if (skill.shields && e.hasShield) {
      if (has('iron')) {
        for (const q of tops) {
          const lead = chargeTime(q, times) + delay + walk;
          const h = headShot(e, q, o, lead);
          if (!h || !shieldUpAt(e, h.t) || !faces(e, o, h.x, h.z)) continue;
          const dmg = dealt(e, damageFor(CLUBS.iron, h.d, q), h.t);
          if (dmg > 0) consider(make(CLUBS.iron, q, 'head', value(e, dmg, o, h.t) / (lead + AFTER_SHOT)));
        }
      }
      if (has('wedge')) {
        // El globo cae donde se apunta, y lo que estalla adelante del escudo lo tapa el escudo: detrás o al
        // costado de él, donde además agarre a otros. Se prueban puntos alrededor (a 1.5 y 2.5 m: la
        // espalda, las diagonales de atrás y los costados) y encima de los que tiene cerca
        for (const q of tops.filter((n) => n >= 2)) {
          const lead = chargeTime(q, times) + delay + walk;
          const hit = intercept(e, CLUBS.wedge, q, o, lead);
          if (!hit) continue;
          const r = spreadFor(CLUBS.wedge, q);
          const raw = areaDamageFor(CLUBS.wedge, hit.d, q);
          const f = e.facing;
          const spots: { x: number; z: number }[] = [];
          for (const k of [1.5, 2.5]) {
            for (const deg of [180, 130, 230, 90, 270]) {
              const a = THREE.MathUtils.degToRad(deg);
              // girado desde adonde mira: 180 es la espalda
              spots.push({ x: (f.x * Math.cos(a) - f.z * Math.sin(a)) * k, z: (f.x * Math.sin(a) + f.z * Math.cos(a)) * k });
            }
          }
          for (const other of alive()) {
            if (other === e) continue;
            const p = predict(other, hit.t);
            const dx = p.x - hit.x;
            const dz = p.z - hit.z;
            if (Math.hypot(dx, dz) < r) spots.push({ x: dx, z: dz });
          }
          let bestSpot: { x: number; z: number; v: number } | null = null;
          for (const s of spots) {
            const x = hit.x + s.x;
            const z = hit.z + s.z;
            if (Math.hypot(x - o.x, z - o.z) > CLUBS.wedge.maxRange) continue;
            const v = areaValue(x, z, r, raw, hit.t, o, e);
            if (v > 0 && (!bestSpot || v > bestSpot.v)) bestSpot = { ...s, v };
          }
          if (bestSpot) {
            const p = make(CLUBS.wedge, q, 'area', bestSpot.v / (lead + AFTER_SHOT));
            p.offset = { x: bestSpot.x, z: bestSpot.z };
            consider(p);
          }
        }
      }
      // El combo: un tiro fuerte derecho, y mientras carga (o mientras baja el palo) el silenciador, para
      // que llegue justo antes: el escudo está bajo cuando llega el fuerte. Al élite el silencio le dura la
      // mitad, así que la pelota fuerte tiene que llegar dentro de esa ventana
      const hushSlot = !BOT_PREFS.abilities ? -1 : (gk.abilities.slots as any[]).findIndex((s, i) => s && String(s.id).endsWith('-silence') && gk.abilities.cooldowns[i] <= 0);
      if (hushSlot >= 0) {
        const s = gk.abilities.slots[hushSlot];
        const hushClub = CLUBS[ABILITIES[s.id].club as ClubId];
        const hushQ = shotQuality(hushClub.id, s.level);
        const secs = ELEMENTS.silenceSeconds;
        const lasts = secs[Math.min(secs.length - 1, s.level - 1)] * (e.size > 1 ? ELEMENTS.silenceElite : 1);
        for (const id of ['putter', 'driver'] as ClubId[]) {
          if (!has(id)) continue;
          const club = CLUBS[id];
          for (const q of tops) {
            const lead = chargeTime(q, times) + delay + walk;
            const hit = intercept(e, club, q, o, lead);
            if (!hit) continue;
            const hushFlight = flightTime(hushClub, hushQ, hit.d);
            // hay que poder tirarlo después de empezar a cargar, y el silencio tiene que alcanzar
            if (!Number.isFinite(hushFlight) || hit.t - hushFlight - CAST_LAG < walk + 0.1 || lasts < 0.2) continue;
            const scan = scanLine(club, q, o, hit.x, hit.z, lead, false, false, e);
            if (scan.ricochet || !scan.hits.some((h) => h.e === e)) continue;
            // silenciado no tiene blindaje
            const total = scan.hits.reduce((n, h) => n + value(h.e, h.e === e ? Math.max(1, damageFor(club, h.d, q)) + (h.e.markTimer > h.t ? 1 : 0) : dealt(h.e, damageFor(club, h.d, q), h.t), o, h.t), 0);
            const p = make(club, q, 'lead', total / (lead + AFTER_SHOT));
            p.combo = { slot: hushSlot, flight: hushFlight };
            consider(p);
          }
        }
      }
    }
    const b = best as Plan | null;
    // con el driver: ¿corriéndose con la pelota la línea agarra a otro más?
    if (b && skill.align && b.club.id === 'driver' && b.mode === 'lead' && (SHIFT.mode === 'continuo' || SHIFT.mode === 'pasos')) b.shift = alignShift(e, b.q, o, times, walk);
    return b;
  }

  /**
   * Hasta dónde correrse (metros de x, dentro de `SHIFT.reach`) para que la línea del driver que pasa por
   * `e` agarre a la mayor cantidad: se prueba la recta que pasa por `e` y por cada uno de los otros, y
   * dónde cruza la línea de los puestos. Null si quedarse quieto es igual de bueno.
   */
  function alignShift(e: Enemy, q: number, o: THREE.Vector3, times: ChargeTimes, walk = 0): number | null {
    const club = CLUBS.driver;
    const lead = chargeTime(q, times) + delay + walk;
    const hit = intercept(e, club, q, o, lead);
    if (!hit) return null;
    const worth = (from: THREE.Vector3) => {
      const h = intercept(e, club, q, from, lead);
      if (!h) return -1;
      const scan = scanLine(club, q, from, h.x, h.z, lead);
      if (scan.ricochet || !scan.hits.some((x) => x.e === e)) return -1;
      return scan.hits.reduce((n, x) => n + value(x.e, dealt(x.e, damageFor(club, x.d, q), x.t), from, x.t), 0);
    };
    let best = { shift: 0, value: worth(o) };
    const spotX = gk.tees.spots[gk.tees.nearest(o.x)]?.x ?? o.x;
    const from = new THREE.Vector3();
    for (const other of alive()) {
      if (other === e) continue;
      const p = predict(other, lead + flightTime(club, q, Math.hypot(other.position.x - o.x, other.position.z - o.z)));
      if (!Number.isFinite(p.x) || Math.abs(p.z - hit.z) < 1) continue;
      // la recta por los dos, hasta la línea de los puestos
      const k = (o.z - hit.z) / (p.z - hit.z);
      const x = hit.x + (p.x - hit.x) * k;
      const shift = x - spotX;
      if (Math.abs(shift) > SHIFT.reach) continue;
      from.set(x, o.y, o.z);
      const v = worth(from);
      if (v > best.value * 1.15) best = { shift, value: v };
    }
    return best.shift !== 0 ? best.shift : null;
  }

  /** El mejor tiro desde el puesto `spot` (a `walk` s de ir): contra los que más apuran y pesan. */
  function bestFrom(spot: number, walk: number, times: ChargeTimes): Plan | null {
    const o = new THREE.Vector3();
    gk.player.teePosition(o);
    o.x += gk.tees.spots[spot].x - gk.player.anchor.x;
    const list = alive().map((e) => ({ e, w: weight(e) * urgency(e, o) })).sort((a, b) => b.w - a.w);
    let best: Plan | null = null;
    for (const { e } of list.slice(0, 10)) {
      const p = planFor(e, o, spot, walk, times);
      if (p && (!best || p.score > best.score)) best = p;
    }
    return best;
  }

  /**
   * Adónde ir y qué tirar: el mejor tiro de este puesto (si tiene pelota) contra el de los otros puestos con
   * pelota, contando lo que tarda en llegar a cada uno. Sin `posts`, al más cercano con pelota.
   */
  function choose(times: ChargeTimes): Plan | null {
    const tees = gk.tees;
    const here = tees.nearest(gk.player.anchor.x);
    if (!skill.posts) {
      if (tees.hasBall(here)) return bestFrom(here, 0, times);
      const to = tees.nearestBall(here);
      return to >= 0 ? { ...(bestFrom(to, walkTime(Math.abs(to - here)), times) ?? fallbackPlan(to)) } : null;
    }
    let best: Plan | null = null;
    for (let i = 0; i < tees.spots.length; i++) {
      if (!tees.hasBall(i)) continue;
      const p = bestFrom(i, walkTime(Math.abs(i - here)), times);
      // ¿llega sin cruzarse con nadie, y termina el golpe antes de que le caiga algo o le pasen por encima?
      if (p && skill.evade && !pathSafe(here, i, busyFor(p, 0))) continue;
      if (p && (!best || p.score > best.score)) best = p;
    }
    return best;
  }

  /** Lo que le falta para terminar el golpe `p` (cargar, esperar si clava, bajar el palo), con `elapsed` cargado. */
  function busyFor(p: Plan, elapsed: number): number {
    const wait = p.releaseAt !== undefined ? Math.max(0, p.releaseAt - gk.clock) : 0;
    return Math.max(chargeTime(p.q, gk.player.timing) - elapsed, wait, 0) + swingTail;
  }

  /** ¿Se puede estar en el puesto de `x` los próximos `busy` s, sin que le caiga nada ni lo atropellen? */
  function safeFor(x: number, busy: number): boolean {
    return !incoming(x) && trampleAt(x, busy + 0.25) === Infinity;
  }

  /**
   * ¿Puede ir del puesto `here` al `to` y quedarse ahí `stay` s? Que no le caiga nada en el de llegada, y
   * que nadie le pase por encima en los puestos que cruza (cuando pasa por cada uno) ni en el de llegada.
   */
  function pathSafe(here: number, to: number, stay: number): boolean {
    const spots = gk.tees.spots;
    if (to === here) return safeFor(spots[here].x, stay);
    if (incoming(spots[to].x)) return false;
    const step = Math.sign(to - here);
    for (let k = here + step; ; k += step) {
      const at = walkTime(Math.abs(k - here));
      const until = k === to ? at + stay + 0.25 : at + 0.3;
      if (trampleAt(spots[k].x, until, Math.max(0, at - 0.45)) !== Infinity) return false;
      if (k === to) return true;
    }
  }

  /** Los que atropellan si le pasan por encima (ver `Enemy.update`): van a la puerta y no frenan por él. */
  function tramples(e: Enemy): boolean {
    if (e.state !== 'walk') return false;
    const b = e.behavior;
    return e.bombLive || b === 'melee' || b === 'banner' || b === 'geomancer' || b === 'kamikaze' || (b === 'shaman' && e.forsaken);
  }

  /**
   * Cuándo le pasa por encima el primero de los que atropellan si está en el puesto de `x` entre `from` y
   * `until` s desde ahora (Infinity si nadie): por dónde va a ir cada uno, con la velocidad que lleva, contra
   * dónde va a estar el cuerpo. Cargando o bajando el palo en ese puesto, el cuerpo está donde está; si no,
   * se va a parar al lado de la pelota, hasta 1.5 m según adónde apunte (en `STANCE_PAD` de margen).
   */
  function trampleAt(x: number, until: number, from = 0): number {
    const pl = gk.player;
    const set = pl.mode !== 'free' && Math.abs(x - pl.anchor.x) < 0.5;
    const bx = set ? pl.position.x : x;
    const bz = set ? pl.position.z : pl.anchor.z;
    const pad = set ? 0.35 : STANCE_PAD;
    let first = Infinity;
    for (const e of alive()) {
      if (!tramples(e)) continue;
      const tr = tracks.get(e.id);
      const vx = tr && !tr.fresh ? tr.vx : 0;
      const vz = tr && !tr.fresh ? tr.vz : -(e.walkSpeed ?? 0);
      // al élite, más margen: si lo pisa es la partida
      const reach = e.radius + TRAMPLE_REACH + pad + (e.size > 1 ? 0.4 : 0);
      for (let t = from; t <= Math.min(until, first); t += 0.05) {
        if (Math.hypot(e.position.x + vx * t - bx, e.position.z + vz * t - bz) < reach) {
          first = t;
          break;
        }
      }
    }
    return first;
  }

  /**
   * Adónde correrse desde el puesto `here`: el más cerca de los que se puede llegar sin cruzarse con nadie y
   * quedarse un rato (mejor con pelota). Si no hay ninguno, el de los cercanos donde más tarda en llegarle
   * alguien. -1 si quedarse es lo mejor.
   */
  function refuge(here: number): number {
    const tees = gk.tees;
    const near: number[] = [];
    for (let i = Math.max(0, here - 3); i <= Math.min(tees.spots.length - 1, here + 3); i++) if (i !== here) near.push(i);
    let best = -1;
    let bestScore = -Infinity;
    for (const i of near) {
      if (!pathSafe(here, i, 1.5)) continue;
      const score = -Math.abs(i - here) + (tees.hasBall(i) ? 0.5 : 0);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    if (best >= 0) return best;
    // nada seguro: donde más tarde le llegue
    let later = trampleAt(tees.spots[here].x, 3);
    for (const i of near) {
      if (incoming(tees.spots[i].x)) continue;
      const t = trampleAt(tees.spots[i].x, 3, walkTime(Math.abs(i - here)));
      if (t > later) {
        best = i;
        later = t;
      }
    }
    return best;
  }

  /** Ir a un puesto sin un tiro pensado todavía (no hay a quién, o no llega): se decide al llegar. */
  function fallbackPlan(spot: number): Plan {
    return { target: -1, club: CLUBS.driver, q: 1, spot, shift: null, mode: 'lead', score: 0, nx: 0, nz: 0 };
  }

  /** El blanco de un tiro en curso: adónde apuntar ahora, con lo que le falta para salir. */
  function aimPlan(p: Plan, left: number): boolean {
    const e = (gk.horde.enemies as Enemy[]).find((x) => x.id === p.target && x.alive && !x.passed);
    if (!e) return false;
    gk.player.teePosition(tee);
    if (p.mode === 'bait') {
      aim(e.position.x, e.position.z);
      return true;
    }
    if (p.mode === 'head') {
      const h = headShot(e, p.q, tee, left);
      if (!h) return false;
      aim(h.x + p.nx, h.z + p.nz);
      return true;
    }
    const hit = intercept(e, p.club, p.q, tee, left);
    const x = hit ? hit.x : e.position.x;
    const z = hit ? hit.z : e.position.z;
    // el wedge cae al lado del blanco (detrás o al costado), donde se eligió
    aim(x + (p.offset?.x ?? 0) + p.nx, z + (p.offset?.z ?? 0) + p.nz);
    // el combo: cuándo tirar el silenciador, para que llegue justo antes que esta pelota
    if (p.combo && hit && combo?.slot === p.combo.slot) combo.at = gk.clock + hit.t - p.combo.flight - CAST_LAG - 0.05;
    return true;
  }

  /** Cargando: corrige la puntería, se corre si hay que alinear, y suelta en el golpe buscado. */
  function charge(dt: number, clock: number): void {
    const pl = gk.player;
    const p = plan!;
    const times: ChargeTimes = pl.meter.timing;
    const wait = p.releaseAt !== undefined ? Math.max(0, p.releaseAt - clock) : 0;
    const left = Math.max(chargeTime(p.q, times) - (pl.meter.elapsed ?? 0), wait, 0) + delay;
    if (!aimPlan(p, left)) {
      // se murió (o se fue) el blanco, o ya no hay cómo: otro desde acá, o suelta la carga
      const next = bestFrom(gk.tees.nearest(pl.anchor.x), 0, times);
      if (next && next.club.id === p.club.id && next.q >= p.q) plan = { ...next, shift: null };
      else {
        key('KeyX');
        plan = combo = null;
      }
      return;
    }
    if (p.shift !== null) {
      const diff = p.shift - pl.shift;
      if (Math.abs(diff) > 0.02) pl.shiftStance(Math.sign(diff) * Math.min(Math.abs(diff), SHIFT.speed * dt));
    }
    if (qualityOf(pl.meter.power) >= p.q) {
      // hay que esperar: clava el golpe (la barra espaciadora) y suelta a su hora
      if (wait > 0) {
        if (!pl.meter.locked) {
          key('Space');
          stats.holds++;
        }
        return;
      }
      pl.releaseSwing();
      releasedAt = swingFrom = clock;
      shotsAtRelease = gk.shots;
      baitShot = p.mode === 'bait';
      stats.byClub[p.club.id] = (stats.byClub[p.club.id] ?? 0) + 1;
      if (p.mode === 'bait') stats.baits++;
      if (p.mode === 'head') stats.heads++;
      if (p.shift !== null && Math.abs(pl.shift) > 0.1) stats.aligned++;
    }
  }

  // ---- las habilidades ----

  /** Una habilidad pensada: dónde apuntar y lo que vale. */
  interface Cast {
    slot: number;
    x: number;
    z: number;
    value: number;
  }

  /**
   * Lo que vale tirar ahora la habilidad del lugar `slot` y dónde (ver el encabezado). Null si no conviene.
   * Los números son a ojo: las que pegan o frenan valen por los que agarran (pesados por lo que apuran); los
   * refuerzos, cuando hay a quién pegarle. Las habilidades no gastan pelota y recargan solas: conviene
   * usarlas aunque agarren a uno solo, si apura.
   */
  function abilityPlan(slot: number, o: THREE.Vector3): Cast | null {
    const s = gk.abilities.slots[slot];
    const a = ABILITIES[s.id];
    if (!a) return null;
    const level: number = s.level;
    const list = alive();
    const near = list.filter((e) => Math.hypot(e.position.x - o.x, e.position.z - o.z) < 45);
    const w = (e: Enemy) => weight(e) * urgency(e, o);
    const mid = (l: Enemy[]) => ({ x: l.reduce((t, e) => t + e.position.x, 0) / l.length, z: l.reduce((t, e) => t + e.position.z, 0) / l.length });
    switch (a.kind) {
      case 'shot': {
        const club = CLUBS[a.club as ClubId];
        const q = shotQuality(club.id, level);
        const ghost = a.element === 'ghost';
        const hush = a.element === 'silence';
        let best: Cast | null = null;
        for (const e of near) {
          const hit = intercept(e, club, q, o, CAST_LAG);
          if (!hit) continue;
          let touched: { e: Enemy; d: number; t: number }[];
          if (club.id === 'wedge' || club.id === 'iron') {
            // cae donde se apunta y abre su área
            const r = spreadFor(club, q) || 1;
            touched = list.filter((x) => {
              const p = predict(x, hit.t);
              return Math.hypot(p.x - hit.x, p.z - hit.z) < r + x.radius;
            }).map((x) => ({ e: x, d: hit.d, t: hit.t }));
          } else {
            const scan = scanLine(club, q, o, hit.x, hit.z, CAST_LAG, ghost, hush);
            if (scan.ricochet) continue;
            touched = scan.hits;
          }
          if (!touched.some((h) => h.e === e)) continue;
          let v = 0;
          for (const h of touched) {
            if (ghost) v += value(h.e, dealt(h.e, damageFor(club, h.d, q), h.t, true), o, h.t);
            // el silencio abre al del escudo, el blindado, el chamán y el que conjura; y al que se cura y ya
            // se empezó, le para la cura
            else if (hush) v += (h.e.hasShield || h.e.armorLevel > 0 || h.e.auraKind || h.e.casting || h.e.size > 1 || (h.e.mods?.regen && h.e.hp < h.e.maxHp) ? 4 : 0.4) * w(h.e);
            else v += (a.element === 'fire' || a.element === 'lightning' ? 1.2 : 1) * w(h.e);
          }
          // y de paso le gasta la esquiva a los que estén cerca de la línea
          if (!ghost) v += list.filter((x) => x.canDodge).length * 0.5;
          if (!best || v > best.value) best = { slot, x: hit.x, z: hit.z, value: v };
        }
        return best && best.value >= 1.5 ? best : null;
      }
      case 'powder':
      case 'lens': {
        const radius = (a.kind === 'powder' ? POWDER.radius : LENS.radius)[Math.min(2, level - 1)];
        let best: Cast | null = null;
        for (const e of near) {
          const d = Math.hypot(e.position.x - o.x, e.position.z - o.z);
          const t = CAST_LAG + lobTime(LOB.loftDeg, LOB.gravity, Math.min(d, a.range));
          const c = predict(e, t);
          const v = list.reduce((n, x) => {
            const p = predict(x, t);
            return Math.hypot(p.x - c.x, p.z - c.z) < radius ? n + w(x) * (a.kind === 'lens' && x.size > 1 ? 2 : 1) : n;
          }, 0);
          if (!best || v > best.value) best = { slot, x: c.x, z: c.z, value: v };
        }
        return best && best.value >= 4 ? best : null;
      }
      case 'hole': {
        // en el camino del que más apura (no se traga élites ni jefes): donde va a estar en un rato
        const e = list.filter((x) => x.size <= 1 && !x.stats?.boss).sort((p, q) => w(q) - w(p))[0];
        if (!e || w(e) < 4) return null;
        const p = predict(e, 0.6);
        return { slot, x: p.x, z: p.z, value: w(e) };
      }
      case 'flag': {
        // detrás del grupo que más apura: van hacia ella (se alejan de la puerta) y quedan juntos
        const group = list.filter((x) => x.size <= 1 && !x.stats?.boss && eta(x, o) < 10);
        if (group.length < 3) return null;
        const c = mid(group);
        const r = FLAG.radius[Math.min(2, level - 1)];
        const at = { x: c.x, z: Math.min(c.z + 6, o.z + a.range) };
        const n = group.filter((x) => Math.hypot(x.position.x - at.x, x.position.z - at.z) < r).length;
        return n >= 3 ? { slot, x: at.x, z: at.z, value: n } : null;
      }
      case 'cart': {
        // cruza la cancha a lo ancho: a la altura donde haya más en fila
        let best: Cast | null = null;
        const dmg = CART.damage[Math.min(2, level - 1)];
        for (const e of near) {
          const z = e.position.z;
          let v = 0;
          for (const x of list) {
            // cuando pasa por su x (el carrito va a CART.speed), ¿está a esa altura?
            const t = CAST_LAG + (Math.abs(x.position.x - (o.x <= 0 ? -1 : 1) * 21)) / CART.speed;
            const p = predict(x, t);
            if (Math.abs(p.z - z) < CART.width + x.radius) v += value(x, Math.min(dmg, x.hp), o, t) / Math.max(1, x.hp);
          }
          if (!best || v > best.value) best = { slot, x: o.x, z, value: v };
        }
        return best && best.value >= 3.5 ? best : null;
      }
      case 'rain': {
        const balls = gk.tees.spots.filter((s: any) => s.ball).length;
        return balls <= 1 && list.length >= 3 ? { slot, x: o.x, z: o.z + 20, value: 1 } : null;
      }
      case 'caddie':
        return near.length >= 4 ? { slot, x: o.x, z: o.z + 20, value: 1 } : null;
      case 'clone':
      case 'might':
      case 'echo':
      case 'boost':
        // los refuerzos: cuando hay a quién pegarle (un élite cerca, o varios)
        return near.length >= 4 || near.some((e) => e.size > 1 || e.stats?.boss) ? { slot, x: o.x, z: o.z + 20, value: 1 } : null;
      case 'glove': {
        // el fantasma, contra escudos, blindados, etéreos e inmunes; los otros, con varios cerca
        const tough = near.some((e) => e.hasShield || e.armorLevel > 0 || e.ethereal || e.warded);
        if (a.element === 'ghost' ? tough : near.length >= 3) return { slot, x: o.x, z: o.z + 20, value: 1 };
        return null;
      }
      default:
        // el palazo va aparte (el que se le viene encima)
        return null;
    }
  }

  /** Tira la habilidad que más vale ahora, si alguna conviene. Devuelve si tiró. */
  function useAbility(clock: number): boolean {
    const ab = gk.abilities;
    gk.player.teePosition(tee);
    if (!skill.abilities) return useAbilityOld(clock);
    let best: Cast | null = null;
    for (let i = 0; i < ab.slots.length; i++) {
      if (ab.cooldowns[i] > 0 || !ab.slots[i]) continue;
      const c = abilityPlan(i, tee);
      if (c && (!best || c.value > best.value)) best = c;
    }
    if (!best) return false;
    const c = best;
    castAt = clock;
    busyUntil = clock + 0.15;
    aim(c.x, c.z);
    const id: string = ab.slots[c.slot].id;
    stats.casts[id] = (stats.casts[id] ?? 0) + 1;
    setTimeout(() => key(SLOT_KEYS[c.slot]), 80);
    return true;
  }

  /** Las habilidades como antes (el flojo): al grupo más cercano; el silenciador, al que haya que abrir. */
  function useAbilityOld(clock: number): boolean {
    const ab = gk.abilities;
    const list = alive();
    const p = gk.player.position;
    const dist = (e: Enemy) => Math.hypot(e.position.x - p.x, e.position.z - p.z);
    const center = (l: Enemy[]) => [l.reduce((t, e) => t + e.position.x, 0) / l.length, l.reduce((t, e) => t + e.position.z, 0) / l.length];
    const open = list.find((e) => e.casting && dist(e) < 44)
      ?? list.filter((e) => e.shieldUp && dist(e) < 44).sort((a, b) => a.position.z - b.position.z)[0]
      ?? list.find((e) => e.stats.boss && !e.silenced && dist(e) < 44);
    const group = list.slice().sort((a, b) => dist(a) - dist(b)).slice(0, 4);
    for (let i = 0; i < ab.slots.length; i++) {
      if (ab.cooldowns[i] > 0 || !ab.slots[i]) continue;
      const id: string = ab.slots[i].id;
      if (id === 'shove') continue;
      const opener = id.endsWith('-silence');
      if (opener && !open) continue;
      if (!opener && group.length < 2) continue;
      const [x, z] = opener ? [open.position.x, open.position.z] : center(group);
      castAt = clock;
      busyUntil = clock + 0.15;
      aim(x, z);
      stats.casts[id] = (stats.casts[id] ?? 0) + 1;
      setTimeout(() => key(SLOT_KEYS[i]), 80);
      return true;
    }
    return false;
  }

  /**
   * Lo que cae del cielo en el puesto de `x`: los hechizos (marcan el piso) y las pelotas que devolvió un
   * escudo (la marca roja, quieta donde estaba el caballero cuando rebotó). Adónde no estar.
   */
  function incoming(x: number): boolean {
    const z = gk.player.anchor.z;
    if ((gk.horde.flying ?? []).some((f: any) => f.marker && Math.abs(f.marker.position.x - x) < RANGED.radius + 0.7 && Math.abs(f.marker.position.z - z) < RANGED.radius + 1)) return true;
    return (gk.balls.list as any[]).some((b) => b.ricochet && !b.done && Math.abs(b.ricochet.to.x - x) < RICOCHET.radius + 0.7 && Math.abs(b.ricochet.to.z - z) < RICOCHET.radius + 1);
  }

  /** Va al puesto `to` (A sube de puesto, D baja). */
  function goTo(to: number, here: number): void {
    if (to === here) return;
    stats.moves++;
    for (let i = 0; i < Math.abs(to - here); i++) key(to > here ? 'KeyA' : 'KeyD');
  }

  /** Decide qué hacer con el golfista libre, en su puesto o yendo. */
  function decide(clock: number): void {
    const pl = gk.player;
    const p = pl.position;
    const dist = (e: Enemy) => Math.hypot(e.position.x - p.x, e.position.z - p.z);
    // agarrado: congelado, no hay nada que hacer hasta que se va
    if (pl.grabbedBy) {
      if (!escaping) stats.grabs++;
      escaping = true;
      return;
    }
    escaping = false;
    const tees = gk.tees;
    const here = tees.nearest(pl.anchor.x);
    // un hechizo o un rebote le va a caer en el puesto: al más seguro de los de al lado
    if (skill.evade && pl.atSpot && incoming(pl.anchor.x)) {
      const to = refuge(here);
      if (to >= 0) {
        stats.evades++;
        goTo(to, here);
        return;
      }
    }
    // Nadie lo persigue, pero el que le pasa por encima lo atropella (el élite, de una). Si uno le va a pasar
    // por encima enseguida: palazo si está listo y lo tiene encima (lo manda 15 m atrás; al élite no, que
    // si falla es la partida); si no, al puesto más seguro
    const soon = trampleAt(pl.anchor.x, 1.2);
    if (soon < 1.2 && pl.atSpot && clock - dodgedAt > 0.3) {
      dodgedAt = clock;
      const shoveSlot = gk.abilities.slots.findIndex((s: any) => s?.id === 'shove');
      const shoveReady = BOT_PREFS.abilities && shoveSlot >= 0 && gk.abilities.cooldowns[shoveSlot] <= 0;
      const threat = alive().filter(tramples).sort((a, b) => dist(a) - dist(b))[0];
      if (shoveReady && threat && threat.size <= 1 && threat.behavior === 'melee' && dist(threat) < 3.2) {
        aim(threat.position.x, threat.position.z);
        setTimeout(() => key(SLOT_KEYS[shoveSlot]), 40);
        stats.melee++;
        return;
      }
      const to = refuge(here);
      if (to >= 0) {
        stats.dodges++;
        goTo(to, here);
        return;
      }
    }
    if (!pl.atSpot || clock < busyUntil) return;
    if (!alive().length) {
      // sin enemigos: que lo encuentre la próxima oleada parado en una pelota
      if (!tees.hasBall(here)) {
        const to = tees.nearestBall(here);
        if (to >= 0) goTo(to, here);
      }
      return;
    }

    // Las habilidades salen en el acto y no gastan la pelota del puesto, así que van antes del tiro.
    // Una por vuelta
    if (BOT_PREFS.abilities && clock - castAt > 0.6 && useAbility(clock)) return;

    const next = choose(pl.timing);
    if (!next) {
      if (!tees.hasBall(here)) {
        const to = tees.nearestBall(here);
        if (to >= 0 && (!skill.evade || pathSafe(here, to, 1))) goTo(to, here);
      }
      return;
    }
    // el mejor tiro es desde otro puesto: va, y al llegar lo vuelve a pensar
    if (next.spot !== here) {
      goTo(next.spot, here);
      return;
    }
    if (next.target < 0) return;
    // a veces no le sale el golpe que buscaba (los niveles que no son perfectos)
    if (next.mode !== 'bait' && next.q > 1 && Math.random() > skill.timing) next.q--;
    plan = next;
    combo = next.combo ? { slot: next.combo.slot, at: Infinity } : null;
    if (pl.club.id !== next.club.id) key(`Digit${CLUB_ORDER.indexOf(next.club.id) + 1}`);
    aimPlan(next, chargeTime(next.q, pl.timing) + delay);
    pl.startSwing();
    if (pl.mode !== 'charging') plan = combo = null;
  }

  function frame(): void {
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // cartas entre oleadas (y el cartel de palo nuevo): las deja un par de segundos, para que quien mira
    // las pueda leer, y se queda con una al azar
    if (gk.cardOpen) {
      plan = null;
      if (!cardSince) cardSince = now;
      if (now - cardSince > 2500) {
        cardSince = 0;
        if (gk.choice) {
          // sin habilidades, una mejora o una cura si hay: una habilidad nueva no la usaría
          const all = (gk.choice as any[]).map((c, i) => ({ c, i }));
          const useful = BOT_PREFS.abilities ? all : all.filter(({ c }) => c.kind !== 'ability');
          const from = useful.length ? useful : all;
          gk.pickCard(from[Math.floor(Math.random() * from.length)].i);
        } else gk.dismissCard();
      }
      return;
    }
    const pl = gk.player;
    if (!pl || gk.ended || gk.paused || !pl.alive) {
      plan = null;
      return;
    }
    const clock: number = gk.clock;
    observe(clock);
    if (off) return;
    // salió la pelota: cuánto tardó desde que soltó (lo que baja el palo)
    if (releasedAt >= 0 && gk.shots > shotsAtRelease) {
      delay += (Math.min(0.6, clock - releasedAt) - delay) * 0.3;
      releasedAt = -1;
      plan = null;
      const ball = gk.balls.list[gk.balls.list.length - 1];
      if (ball && !baitShot) flying.push(ball);
    }
    // el silenciador del combo, a su hora: la puntería sigue en el blanco del tiro fuerte
    if (combo && !BOT_PREFS.abilities) combo = null;
    if (combo && clock >= combo.at) {
      const id: string = gk.abilities.slots[combo.slot]?.id;
      if (id && gk.abilities.cooldowns[combo.slot] <= 0) {
        key(SLOT_KEYS[combo.slot]);
        stats.casts[id] = (stats.casts[id] ?? 0) + 1;
        stats.combos++;
      }
      combo = null;
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      const b = flying[i];
      if (!b.done && gk.balls.list.includes(b)) continue;
      if (b.hits > 0) stats.hit++;
      else stats.miss++;
      flying.splice(i, 1);
    }
    if (pl.mode === 'charging') {
      // un hechizo o un rebote le cae encima, o alguien le va a pasar por encima antes de que termine el
      // golpe: suelta la carga y se corre
      if (skill.evade && plan && plan.mode !== 'bait' && !safeFor(pl.anchor.x, busyFor(plan, pl.meter.elapsed ?? 0))) {
        key('KeyX');
        stats.aborts++;
        plan = combo = null;
        nextThink = 0;
        return;
      }
      if (plan) charge(dt, clock);
      return;
    }
    // bajando el palo: sigue corrigiendo hasta que sale la pelota
    if (pl.mode === 'swinging') {
      if (plan && releasedAt >= 0) aimPlan(plan, Math.max(0, delay - (clock - releasedAt)));
      return;
    }
    // terminó el gesto: cuánto tardó desde que soltó
    if (swingFrom >= 0) {
      swingTail += (Math.min(1.2, clock - swingFrom) - swingTail) * 0.3;
      swingFrom = -1;
    }
    if (pl.mode !== 'free') return;
    plan = null;
    if (clock < nextThink) return;
    nextThink = clock + skill.think;
    decide(clock);
  }
  requestAnimationFrame(frame);
  // para revisar sus decisiones desde la consola o las pruebas
  (window as any).__botDebug = {
    choose, bestFrom, planFor, alignShift, headShot, abilityPlan, predict, intercept, scanLine, weight, urgency, value, regenWindow, finishTime, trampleAt, refuge, incoming, chargeTime, skill, tee,
    get plan() { return plan; }, get delay() { return delay; }, get swingTail() { return swingTail; }, get off() { return off; }, set off(v: boolean) { off = v; },
  };
  return stats;
}
