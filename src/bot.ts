// Bot que juega solo, para chequear el balance, para mirarlo jugar y para probar de Abe sin un amigo. Se
// activa con ?bot en la URL (http://localhost:5173/?bot) y lo usa tools/botplay.mjs. Con
// ?bot&transmitir=CÓDIGO espera a Abe y juega una partida tras otra (ver `botAutostart` en main). Maneja el
// juego como una persona: mueve el mouse, aprieta teclas y carga los tiros en tiempo real, con la barra
// de verdad.
//
// Desde el 9/10 (pedido de Leandro: el de antes erraba mucho, sobre todo en diagonal y contra los que
// esquivan) juega en serio, con tres niveles (`?bot=perfecto`, `bueno` o `flojo`; sin nada, perfecto):
// - **Apunta adonde va a estar el enemigo.** Simula el vuelo de la pelota con la misma física del juego
//   (core/ballistics, con los números de cada palo) y mide la velocidad de cada enemigo mirándolo caminar
//   (va en diagonal, frena, lo enfría el hielo): el blanco es dónde van a coincidir los dos. Mientras carga
//   sigue corrigiendo, y también mientras baja el palo, hasta que sale la pelota.
// - **Carga lo justo.** De cada palo y cada golpe sabe cuánto pega (con el blindaje, el tope del fantasma,
//   la lupa y la marca de Abe) y cuánto tarda la barra en llegar: si con el golpe 2 lo mata, suelta en el
//   2; si no, clava el más alto. Al fantasma, golpes cortos (más que 1 no le entra).
// - **Driver y putter.** El putter de cerca (pega más), el driver de lejos. El wedge solo contra el escudo
//   de frente, que el resto rebota (y vuelve contra el caballero): el globo cae por arriba. El hierro, no.
// - **Alinea.** Con el driver, que atraviesa, se corre con la pelota (hasta `SHIFT.reach`) para que la línea
//   agarre a otro más.
// - **El que esquiva y la burbuja**: un tiro corto de cebo (la esquiva salta al soltar, la burbuja se come
//   el primer golpe) y después el que importa, antes de que se recarguen.
// - **Se corre** de los hechizos que le caen en el puesto, y del que se le viene encima (o le da un palazo).
// - Las habilidades, al grupo más cercano (el silenciador, al que haya que abrir), y las cartas, al azar.

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { BALL_RADIUS, launch, launchSpeed, stepBall, type BounceParams } from './core/ballistics';
import { areaDamageFor, CLUBS, damageFor, fourthFrom, qualityMarks, qualityOf, rollFrictionFor, SHIFT, spreadFor, topQuality, type Club, type ClubId } from './core/clubs';
import { DODGE, RANGED } from './core/waves';
import type { ChargeTimes } from './core/swing';

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
  /** Veces que se corrió de un hechizo. */
  evades: number;
  /** Tiros que salieron corridos del puesto para alinear a varios. */
  aligned: number;
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
  /** Si no es null, suelta siempre en este golpe (no cuenta cuánto le falta al enemigo). */
  fixedQuality: number | null;
  /** Busca líneas que agarren a varios con el driver, corriéndose con la pelota. */
  align: boolean;
  /** Le gasta la esquiva y la burbuja con un tiro corto antes del que importa. */
  bait: boolean;
  /** Se corre de los hechizos que le caen. */
  evade: boolean;
  /** Usa el wedge contra el escudo de frente. */
  wedge: boolean;
}

export const BOT_SKILLS: Record<string, BotSkill> = {
  perfecto: { think: 0.05, aimError: 0, timing: 1, fixedQuality: null, align: true, bait: true, evade: true, wedge: true },
  bueno: { think: 0.3, aimError: 0.35, timing: 0.85, fixedQuality: null, align: false, bait: true, evade: true, wedge: true },
  // más o menos el de antes: suelta en el 2 y no sabe nada de los poderes
  flojo: { think: 0.6, aimError: 0.8, timing: 1, fixedQuality: 2, align: false, bait: false, evade: false, wedge: false },
};

/** Cada palo tiene su tecla: Digit1 a Digit4, en este orden. */
const CLUB_ORDER: ClubId[] = ['driver', 'iron', 'wedge', 'putter'];
/** Las teclas de los cuatro lugares de habilidad. */
const SLOT_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'];
/** Hasta dónde llega el putter de verdad (rueda 20 m y frena): un poco menos, para no quedar corto. */
const PUTTER_REACH = 18.5;
/** Lo que tarda en volver a estar listo después de un tiro (moverse al otro puesto, más o menos). */
const AFTER_SHOT = 0.7;

function key(code: string): void {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
}

/** Un número al azar con distribución normal (media 0, desvío 1). */
function gauss(): number {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

// ---- el vuelo de la pelota ----

/** La distancia que lleva recorrida la pelota, cada 1/240 s, desde que sale. */
const flights = new Map<string, number[]>();
const FLIGHT_DT = 1 / 240;

/** Cómo viaja la pelota de ese palo y ese golpe, con la misma física que el juego (sobre piso plano). */
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

/** Cuánto tarda la pelota en recorrer `dist` metros, o Infinity si no llega. */
function flightTime(club: Club, q: number, dist: number): number {
  if (club.id === 'wedge') {
    // el globo cae donde se apunta: el tiempo de vuelo de un tiro parabólico
    const loft = THREE.MathUtils.degToRad(club.loftDeg);
    const g = club.gravity ?? 22;
    const v = launchSpeed(Math.max(1, dist), loft, g);
    return dist > club.maxRange ? Infinity : (2 * v * Math.sin(loft)) / g;
  }
  const f = flightOf(club, q, club.fixedRange > 0 ? club.fixedRange : dist);
  if (club.id === 'putter' && dist > PUTTER_REACH) return Infinity;
  for (let i = 1; i < f.length; i++) {
    if (f[i] >= dist) return (i - 1 + (dist - f[i - 1]) / Math.max(1e-6, f[i] - f[i - 1])) * FLIGHT_DT;
  }
  return Infinity;
}

/** Cuánto tarda la barra en llegar al golpe `q` (el 1 es soltar enseguida). */
function chargeTime(q: number, t: ChargeTimes): number {
  if (q <= 1) return 0.02;
  if (q === 2) return t.weak;
  if (q === 3) return t.weak + t.mid;
  const [, b] = qualityMarks();
  return t.weak + t.mid + ((fourthFrom() - b) / (1 - b)) * (t.strong / 2);
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

/** Lo que le saca un pelotazo de `raw` (con el blindaje, el tope del fantasma, la lupa y la marca). */
function dealt(e: Enemy, raw: number, at: number): number {
  if (raw <= 0) return 0;
  let d = Math.max(1, Math.round(raw)) + (e.vulnerable ? 1 : 0);
  d = Math.max(0, d - e.armor);
  if (e.ethereal && !e.silenced) d = Math.min(d, e.enlarged ? 2 : 1);
  // la marca de Abe es un golpe aparte que entra siempre (si todavía la tiene cuando llega la pelota)
  if (e.markTimer > at) d += 1;
  return d;
}

/** Un tiro pensado: a quién, con qué palo y golpe, desde dónde, y si es un cebo. */
interface Plan {
  target: number;
  club: Club;
  q: number;
  /** Cuánto correrse con la pelota (metros de x) antes de soltar, o null si no. */
  shift: number | null;
  /** Tiro corto para gastarle la esquiva o la burbuja: apunta adonde está ahora. */
  bait: boolean;
  /** El wedge cae un poco detrás del enemigo: el escudo no tapa lo que estalla de su lado. */
  behind: number;
  /** El error de puntería de este tiro (fijo para todo el tiro, como el pulso de una persona). */
  nx: number;
  nz: number;
}

export function startBot(): BotStats {
  const gk: Gk = (window as any).__gk;
  const name = new URLSearchParams(location.search).get('bot') || 'perfecto';
  const skill = BOT_SKILLS[name] ?? BOT_SKILLS.perfecto;
  const stats: BotStats = { skill: BOT_SKILLS[name] ? name : 'perfecto', byClub: {}, casts: {}, melee: 0, moves: 0, dodges: 0, grabs: 0, jumps: 0, baits: 0, evades: 0, aligned: 0, hit: 0, miss: 0 };
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
  /** Las pelotas que salieron (sin los cebos), para contar las que pegan. */
  const flying: any[] = [];
  let baitShot = false;
  let delay = 0.2;
  let nextThink = 0;
  let castAt = -10;
  let dodgedAt = 0;
  let cardSince = 0;
  let escaping = false;
  let last = performance.now();
  /** Para las pruebas: mira (sigue midiendo a los enemigos) pero no toca nada. */
  let off = false;

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

  /** ¿El escudo de `e` frena una pelota que sale de `o` hacia (x, z)? */
  function shields(e: Enemy, o: THREE.Vector3, x: number, z: number): boolean {
    const dx = x - o.x;
    const dz = z - o.z;
    const len = Math.hypot(dx, dz) || 1;
    return !!e.blocks?.((dx / len) * 50, 0, (dz / len) * 50);
  }

  /**
   * Lo que agarra una línea de driver o putter desde `o` hacia (x, z): a quiénes y cuánto les saca, hasta
   * donde llega. Se corta en el primer escudo que la frena (rebota), y el putter en el primero que toca.
   * Los que esquivan con la esquiva lista saltan al soltar: no cuentan.
   */
  function lineHits(club: Club, q: number, o: THREE.Vector3, x: number, z: number, lead: number): { e: Enemy; d: number }[] {
    const len = Math.hypot(x - o.x, z - o.z) || 1;
    const ux = (x - o.x) / len;
    const uz = (z - o.z) / len;
    const out: { e: Enemy; d: number; along: number }[] = [];
    for (const e of gk.horde.enemies) {
      if (!e.alive || e.passed) continue;
      // dónde está cuando la pelota pasa por su altura
      const along0 = (e.position.x - o.x) * ux + (e.position.z - o.z) * uz;
      if (along0 < 0.5) continue;
      const ft = flightTime(club, q, along0);
      if (!Number.isFinite(ft)) continue;
      const p = predict(e, lead + ft);
      const along = (p.x - o.x) * ux + (p.z - o.z) * uz;
      const side = Math.abs((p.x - o.x) * uz - (p.z - o.z) * ux);
      // la esquiva salta con cualquier tiro que pase cerca
      if (e.canDodge && Math.abs((e.position.x - o.x) * uz - (e.position.z - o.z) * ux) < DODGE.aimWidth + e.radius) continue;
      if (side > e.radius + BALL_RADIUS) continue;
      out.push({ e, d: along, along });
    }
    out.sort((a, b) => a.along - b.along);
    const hits: { e: Enemy; d: number }[] = [];
    for (const h of out) {
      if (h.e.shieldUp && h.e.stunTimer <= 0 && shields(h.e, o, x, z)) break;
      if (h.e.warded) {
        if (club.pierces) continue;
        break;
      }
      hits.push(h);
      if (!club.pierces) break;
    }
    return hits;
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

  /** Los palos que puede usar ahora. */
  const has = (id: ClubId) => gk.player.unlocked?.has?.(id) ?? true;

  /** El mejor tiro contra `e`, o null si no tiene uno que le saque algo. */
  function planFor(e: Enemy, o: THREE.Vector3, times: ChargeTimes): Plan | null {
    const noise = () => (skill.aimError ? gauss() * skill.aimError : 0);
    const plain = (club: Club, q: number, extra: Partial<Plan> = {}): Plan => ({ target: e.id, club, q, shift: null, bait: false, behind: 0, nx: noise(), nz: noise(), ...extra });
    const near = Math.hypot(e.position.x - o.x, e.position.z - o.z);
    // la esquiva y la burbuja: primero un tiro corto que se las gaste
    if (skill.bait && (e.canDodge || (e.divineReady && !e.silenced)) && has('driver') && near < 60) {
      return plain(CLUBS.driver, 1, { bait: true });
    }
    const tops = Array.from({ length: topQuality() }, (_, i) => i + 1);
    const qualities = skill.fixedQuality ? [Math.min(skill.fixedQuality, topQuality())] : tops;
    // el escudo de frente: driver y putter rebotan. El globo del wedge le cae por arriba
    const front = e.shieldUp && e.stunTimer <= 0 && shields(e, o, e.position.x, e.position.z);
    if (front) {
      if (!skill.wedge || !has('wedge')) return null;
      let best: { q: number; value: number } | null = null;
      for (const q of qualities.filter((n) => n >= 2)) {
        const hit = intercept(e, CLUBS.wedge, q, o, chargeTime(q, times) + delay);
        if (!hit || shutAt(e, hit.t)) continue;
        const dmg = dealt(e, areaDamageFor(CLUBS.wedge, hit.d, q), hit.t);
        const value = dmg >= e.hp ? 100 - chargeTime(q, times) : dmg / (chargeTime(q, times) + delay + AFTER_SHOT);
        if (dmg > 0 && (!best || value > best.value)) best = { q, value };
      }
      return best ? plain(CLUBS.wedge, best.q, { behind: Math.min(1, spreadFor(CLUBS.wedge, best.q) * 0.25) }) : null;
    }
    // driver o putter, y qué golpe: el más corto que lo mata; si ninguno, el que más saca por segundo
    let best: { club: Club; q: number; value: number } | null = null;
    for (const id of ['putter', 'driver'] as ClubId[]) {
      if (!has(id)) continue;
      const club = CLUBS[id];
      for (const q of qualities) {
        const lead = chargeTime(q, times) + delay;
        const hit = intercept(e, club, q, o, lead);
        if (!hit || shutAt(e, hit.t)) continue;
        const hits = lineHits(club, q, o, hit.x, hit.z, lead);
        if (!hits.some((h) => h.e === e)) continue;
        const dmg = dealt(e, damageFor(club, hit.d, q), hit.t);
        if (dmg <= 0) continue;
        const cost = lead + AFTER_SHOT;
        // matarlo vale más que cualquier daño; entre los que lo matan, el más rápido. Los demás que agarra
        // la línea suman un poco
        const others = hits.filter((h) => h.e !== e).reduce((n, h) => n + Math.min(h.e.hp, dealt(h.e, damageFor(club, h.d, q), hit.t)), 0);
        const value = (dmg >= e.hp ? 100 - lead : dmg / cost) + others * 0.3;
        if (!best || value > best.value) best = { club, q, value };
      }
    }
    if (!best) return null;
    const p = plain(best.club, best.q);
    // con el driver: ¿corriéndose con la pelota la línea agarra a otro más?
    if (skill.align && best.club.id === 'driver' && (SHIFT.mode === 'continuo' || SHIFT.mode === 'pasos')) p.shift = alignShift(e, best.q, o, times);
    return p;
  }

  /**
   * Hasta dónde correrse (metros de x, dentro de `SHIFT.reach`) para que la línea del driver que pasa por
   * `e` agarre a la mayor cantidad: se prueba la recta que pasa por `e` y por cada uno de los otros, y
   * dónde cruza la línea de los puestos. Null si quedarse quieto es igual de bueno.
   */
  function alignShift(e: Enemy, q: number, o: THREE.Vector3, times: ChargeTimes): number | null {
    const club = CLUBS.driver;
    const lead = chargeTime(q, times) + delay;
    const hit = intercept(e, club, q, o, lead);
    if (!hit) return null;
    const value = (from: THREE.Vector3) => {
      const h = intercept(e, club, q, from, lead);
      if (!h) return -1;
      const hits = lineHits(club, q, from, h.x, h.z, lead);
      if (!hits.some((x) => x.e === e)) return -1;
      return hits.reduce((n, x) => n + Math.min(x.e.hp, dealt(x.e, damageFor(club, x.d, q), h.t)), 0);
    };
    const base = value(o);
    let best = { shift: 0, value: base };
    const spot = o.x - gk.player.shift;
    const from = new THREE.Vector3();
    for (const other of gk.horde.enemies) {
      if (other === e || !other.alive || other.passed) continue;
      const p = predict(other, lead + flightTime(club, q, Math.hypot(other.position.x - o.x, other.position.z - o.z)));
      if (!Number.isFinite(p.x) || Math.abs(p.z - hit.z) < 1) continue;
      // la recta por los dos, hasta la línea de los puestos
      const k = (o.z - hit.z) / (p.z - hit.z);
      const x = hit.x + (p.x - hit.x) * k;
      const shift = x - spot;
      if (Math.abs(shift) > SHIFT.reach) continue;
      from.set(x, o.y, o.z);
      const v = value(from);
      if (v > best.value + 0.5) best = { shift, value: v };
    }
    return best.shift !== 0 ? best.shift : null;
  }

  /** Elige a quién tirarle: el que antes se vuelve un problema y al que se le puede sacar algo. */
  function choose(o: THREE.Vector3, times: ChargeTimes): Plan | null {
    const alive = (gk.horde.enemies as Enemy[]).filter((e) => e.alive && !e.passed);
    // primero los que se pueden matar ya, entre los que apuran; después el resto, por apuro
    const byEta = alive.map((e) => ({ e, eta: eta(e, o) })).sort((a, b) => a.eta - b.eta);
    for (const { e } of byEta.slice(0, 8)) {
      const p = planFor(e, o, times);
      if (p) return p;
    }
    return null;
  }

  /** El blanco de un tiro en curso: adónde apuntar ahora, con lo que le falta para salir. */
  function aimPlan(p: Plan, left: number): boolean {
    const e = (gk.horde.enemies as Enemy[]).find((x) => x.id === p.target && x.alive && !x.passed);
    if (!e) return false;
    gk.player.teePosition(tee);
    if (p.bait) {
      aim(e.position.x, e.position.z);
      return true;
    }
    const hit = intercept(e, p.club, p.q, tee, left);
    const x = hit ? hit.x : e.position.x;
    const z = hit ? hit.z : e.position.z;
    // el wedge, un poco detrás (del lado de la espalda): el escudo tapa lo que estalla de su frente
    const len = Math.hypot(x - tee.x, z - tee.z) || 1;
    aim(x + ((x - tee.x) / len) * p.behind + p.nx, z + ((z - tee.z) / len) * p.behind + p.nz);
    return true;
  }

  /** Cargando: corrige la puntería, se corre si hay que alinear, y suelta en el golpe buscado. */
  function charge(dt: number, clock: number): void {
    const pl = gk.player;
    const p = plan!;
    const times: ChargeTimes = pl.meter.timing;
    const left = Math.max(0, chargeTime(p.q, times) - (pl.meter.elapsed ?? 0)) + delay;
    if (!aimPlan(p, left)) {
      // se murió (o se fue) el blanco: otro, con la misma carga
      pl.teePosition(tee);
      const next = choose(tee, times);
      if (next && next.club.id === p.club.id) plan = { ...next, q: p.q, shift: null };
      else {
        key('KeyX');
        plan = null;
      }
      return;
    }
    if (p.shift !== null) {
      const diff = p.shift - pl.shift;
      if (Math.abs(diff) > 0.02) pl.shiftStance(Math.sign(diff) * Math.min(Math.abs(diff), SHIFT.speed * dt));
    }
    if (qualityOf(pl.meter.power) >= p.q) {
      pl.releaseSwing();
      releasedAt = clock;
      shotsAtRelease = gk.shots;
      baitShot = p.bait;
      stats.byClub[p.club.id] = (stats.byClub[p.club.id] ?? 0) + 1;
      if (p.bait) stats.baits++;
      if (p.shift !== null && Math.abs(pl.shift) > 0.1) stats.aligned++;
    }
  }

  /** Lo que cae del cielo en su puesto (los hechizos marcan el piso): adónde no estar. */
  function incoming(x: number): boolean {
    return (gk.horde.flying ?? []).some((f: any) => f.marker && Math.abs(f.marker.position.x - x) < RANGED.radius + 0.7 && Math.abs(f.marker.position.z - gk.player.anchor.z) < RANGED.radius + 1);
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
    // un hechizo le va a caer en el puesto: al de al lado, del lado que no cae
    if (skill.evade && incoming(pl.anchor.x)) {
      const up = here + 1 < tees.spots.length && !incoming(tees.spots[here + 1].x);
      const down = here - 1 >= 0 && !incoming(tees.spots[here - 1].x);
      if (up || down) {
        stats.evades++;
        key(up ? 'KeyA' : 'KeyD');
        return;
      }
    }
    // Nadie lo persigue, pero el que le pasa por encima lo atropella. Si uno viene derecho hacia su puesto:
    // palazo si está listo (lo manda 15 m atrás); si no, se corre dos puestos.
    const shoveSlot = gk.abilities.slots.findIndex((s: any) => s.id === 'shove');
    const shoveReady = shoveSlot >= 0 && gk.abilities.cooldowns[shoveSlot] <= 0;
    const threat = gk.horde.enemies.find((e: Enemy) => e.alive && !e.passed && e.state === 'walk' && (e.behavior === 'melee' || e.behavior === 'kamikaze')
      && e.position.z > p.z - 0.5 && e.position.z - p.z < 4.5 && Math.abs(e.position.x - p.x) < 1.8);
    if (threat && pl.atSpot && performance.now() - dodgedAt > 500) {
      dodgedAt = performance.now();
      if (shoveReady && threat.behavior === 'melee' && dist(threat) < 3.2) {
        aim(threat.position.x, threat.position.z);
        setTimeout(() => key(SLOT_KEYS[shoveSlot]), 40);
        stats.melee++;
        return;
      }
      stats.dodges++;
      const up = here + 2 < tees.spots.length && (here - 2 < 0 || threat.position.x < p.x);
      for (let n = 0; n < 2; n++) key(up ? 'KeyA' : 'KeyD');
      return;
    }
    if (!pl.atSpot) return;
    // sin pelota en este puesto: va a la más cercana (A sube de puesto, D baja)
    if (!tees.hasBall(here)) {
      const to = tees.nearestBall(here);
      if (to >= 0) {
        stats.moves++;
        for (let i = 0; i < Math.abs(to - here); i++) key(to > here ? 'KeyA' : 'KeyD');
      }
      return;
    }
    const alive: Enemy[] = gk.horde.enemies.filter((e: Enemy) => e.alive && !e.passed);
    if (!alive.length) return;

    // Las habilidades salen en el acto y no gastan la pelota del puesto, así que van antes del tiro:
    // apunta, espera a que la puntería llegue al juego y aprieta la tecla. Una por vuelta.
    if (clock - castAt > 1) {
      const ab = gk.abilities;
      const center = (list: Enemy[]) => [list.reduce((t, e) => t + e.position.x, 0) / list.length, list.reduce((t, e) => t + e.position.z, 0) / list.length];
      // el silenciador va encima de quien haya que abrir (chamán conjurando, escudo en alto, jefe sin
      // silenciar); todo lo demás, al grupo más cercano
      const open = alive.find((e) => e.casting && dist(e) < 44)
        ?? alive.filter((e) => e.shieldUp && dist(e) < 44).sort((a, b) => a.position.z - b.position.z)[0]
        ?? alive.find((e) => e.stats.boss && !e.silenced && dist(e) < 44);
      const group = alive.slice().sort((a, b) => dist(a) - dist(b)).slice(0, 4);
      for (let i = 0; i < ab.slots.length; i++) {
        if (ab.cooldowns[i] > 0) continue;
        const id: string = ab.slots[i].id;
        if (id === 'shove') continue;
        const opener = id.endsWith('-silence');
        if (opener && !open) continue;
        if (!opener && group.length < 2) continue;
        const [x, z] = opener ? [open.position.x, open.position.z] : center(group);
        castAt = clock;
        aim(x, z);
        stats.casts[id] = (stats.casts[id] ?? 0) + 1;
        setTimeout(() => key(SLOT_KEYS[i]), 80);
        return;
      }
    }

    pl.teePosition(tee);
    const next = choose(tee, pl.timing);
    if (!next) return;
    // a veces no le sale el golpe que buscaba (los niveles que no son perfectos)
    if (!next.bait && next.q > 1 && Math.random() > skill.timing) next.q--;
    plan = next;
    if (pl.club.id !== next.club.id) key(`Digit${CLUB_ORDER.indexOf(next.club.id) + 1}`);
    aimPlan(next, chargeTime(next.q, pl.timing) + delay);
    pl.startSwing();
    if (pl.mode !== 'charging') plan = null;
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
        if (gk.choice) gk.pickCard(Math.floor(Math.random() * gk.choice.length));
        else gk.dismissCard();
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
    for (let i = flying.length - 1; i >= 0; i--) {
      const b = flying[i];
      if (!b.done && gk.balls.list.includes(b)) continue;
      if (b.hits > 0) stats.hit++;
      else stats.miss++;
      flying.splice(i, 1);
    }
    if (pl.mode === 'charging') {
      // un hechizo le cae encima: suelta la carga y se corre
      if (skill.evade && incoming(pl.anchor.x) && plan && !plan.bait) {
        key('KeyX');
        plan = null;
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
    if (pl.mode !== 'free') return;
    plan = null;
    if (clock < nextThink) return;
    nextThink = clock + skill.think;
    decide(clock);
  }
  requestAnimationFrame(frame);
  // para revisar sus decisiones desde la consola o las pruebas
  (window as any).__botDebug = { choose, planFor, alignShift, predict, intercept, lineHits, get plan() { return plan; }, get delay() { return delay; }, tee, get off() { return off; }, set off(v: boolean) { off = v; } };
  return stats;
}
