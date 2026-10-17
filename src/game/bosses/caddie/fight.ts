// La pelea con el caddie (17/10, pedido de Leandro: «un jefe que te haga mucho cambiar de palos»; ver
// docs/jefes/caddie.md). Pone a prueba **elegir el palo y cambiarlo rápido**.
//
// El caddie se queda al fondo con la bolsa a la espalda y cada tanto **canta un palo**: lo saca de la bolsa,
// lo levanta y grita «¡Driver!». Le pega de verdad solo ese palo (con los otros, 1 por golpe, como al
// fantasma), y el palo que canta va rotando: nunca el mismo dos veces seguidas, y los cuatro en cada vuelta.
// Para el putter se viene adelante, a tiro.
//
// Lo que hace además, según la versión:
// - **formaciones**: con cada grito salen del piso formaciones pensadas para ese palo (ver formations.ts);
//   desde la mitad de su vida, mixtas, a la misma velocidad.
// - **sellos**: les pone a los de la horda el sello de un palo (les tira la funda): solo ese palo les pega
//   entero. Si la cancha se vacía, saca más del piso.
// - **mixto**: siempre formaciones mixtas, y cada una con el sello de su palo.
//
// Mientras vive no para: las formaciones (o los que saca del piso) siguen sin tope, y cada uno que llega le
// pega a la puerta. Ignorarlo nunca es la jugada.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { ClubId } from '../../../core/clubs';
import { laneX } from '../../../core/field';
import type { EnemyKind, EnemyMods, Wave } from '../../../core/waves';
import type { Enemy, EnemyScript, Horde } from '../../enemies';
import { heightAt, partStats, TEE_Z } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { CaddieFx, CallFx, CLUB_TINT, CoverFx, HoleFx, SealFx } from './fx';
import { buildFormation, clampX, FORM, MIXED_PART, PART_CLUB, SOLO_PART, type PartId, type Slot } from './formations';
import { CaddieLook } from './look';

/** Lo que cambia entre versiones (ver index.ts). */
export interface CaddieCfg {
  /** Qué sale del piso con cada grito: nada, una formación de su palo (mixtas desde la mitad), o siempre mixtas. */
  formations: 'none' | 'solo' | 'mixed';
  /** Los de las formaciones llevan el sello de su palo (si no, solo el anillo de su color). */
  sealed: boolean;
  /** Les pone sellos a los de la horda. */
  seals: boolean;
  /** El cartel de la regla, al empezar (lo ve el jugador). */
  hint: string;
}

// ---- él ----
/** Su vida: la base, lo que suma cada nivel de dificultad, y el golpe 4 (`bonusHp`). */
const HP = 40;
const HP_PER_LEVEL = 3;
const HEIGHT = 3.2;
const RADIUS = 1.1;
/**
 * Dónde se queda: al fondo, a 32–38 m de la línea, yendo y viniendo de costado. A 40–46 m (la banda larga
 * del driver) quedaba chiquito arriba de todo de la pantalla, y no se le leía el palo.
 */
const HOME_Z: [number, number] = [41, 47];
const HOME_X: [number, number] = [2, 10];
const PATROL_SPEED = 1.6;
/** Sale del piso acá, al empezar, y lo que tarda. */
const ENTER_Z = 46;
const ENTER_TIME = 1.6;
const PATROL_PAUSE = 1.2;
/** Para el putter se viene corriendo hasta acá (a 15 m de la línea: el putter rueda 20). */
const FRONT_Z = TEE_Z + 15;
const RUN_SPEED = 4.6;
/** Lo que dura el grito (quieto, con el palo arriba). */
const SHOUT = 1.3;

// ---- los gritos ----
/** Cada cuánto canta otro palo, con toda la vida y casi muerto: con formaciones de un palo, mixtas, y sin formaciones. */
const CALL_EVERY: Record<CaddieCfg['formations'], [number, number]> = { solo: [10, 7], mixed: [14, 10], none: [8, 5.5] };
/** Con poca dificultad canta más espaciado: hasta esto más, en el nivel 0 (en el 10, nada). */
const CALL_EASY = 0.25;
/** Después de un rato se apura igual (la presión sube sola): desde CALL_HURRY.from s, hasta `max` s menos. */
const CALL_HURRY = { from: 90, per: 60, max: 1.5 };
const FIRST_CALL = 2.5;
/** Desde qué parte de la vida perdida las formaciones salen mixtas de dos, y de tres (en `mixto`, de tres). */
const MIX_AT = [0.5, 0.8];
const MIXED_THREE_AT = 0.6;
/** Si hay más de esto marchando, el grito espera un poco (sin tope: solo se corre). */
const MAX_MARCHING = 24;

// ---- las formaciones ----
/** Lo que avisa el hoyo antes de que salga, y lo que tarda en salir. */
const HOLE_TIME = 1.5;
const RISE_TIME = 0.7;
/** A esta distancia de la línea los suelta: de ahí van solos, a su paso, como cualquiera. */
const HANDOFF = 5;

// ---- los sellos ----
/** Cada cuánto sella a uno (con toda la vida, y casi muerto), cuántos a la vez, y el primero. */
const SEAL_EVERY: [number, number] = [3.2, 2.0];
const MAX_SEALS = 6;
const FIRST_SEAL = 5;
/** Lo que vuela la funda. */
const TOSS_TIME = 0.6;
/** No sella a los que están por llegar ni a los que recién aparecen. */
const SEAL_NEAR = 7;
const SEAL_FAR_Z = 62;
/** «El que le estás pegando»: lo sella primero. */
const HIT_MEMORY = 4;
/** Si quedan menos de RAISE_BELOW en la cancha, cada RAISE_EVERY s saca RAISE_KINDS del piso. */
const RAISE_BELOW = 5;
const RAISE_EVERY = 7;
const RAISE_FROM = 12;
const RAISE_KINDS: EnemyKind[] = ['orc', 'skeleton', 'orc'];
/** Cuántos saca cada vez. */
const RAISE_COUNT = 2;

/** Cada cuánto, como mucho, el cartelito de «con el putter». */
const NAG_EVERY = 2.5;

const CLUBS: ClubId[] = ['driver', 'iron', 'wedge', 'putter'];
/** El cartelito cuando le pegás con otro palo a algo sellado (lo ve el jugador). */
const WITH: Record<ClubId, string> = {
  driver: L('¡Con el driver!', 'Use the driver!'),
  iron: L('¡Con el hierro!', 'Use the iron!'),
  wedge: L('¡Con el wedge!', 'Use the wedge!'),
  putter: L('¡Con el putter!', 'Use the putter!'),
};

const lerp = (r: [number, number], u: number) => r[0] + (r[1] - r[0]) * Math.max(0, Math.min(1, u));

/** La escolta: la de siempre sin chamanes ni apoyos (el aura y la bandera tapan lo que piden los palos). */
export function escort(wave: Wave): void {
  wave.groups = wave.groups.filter((g) => g.kind !== 'shaman');
  delete wave.supports;
}

/** Una formación en marcha. */
interface Formation {
  members: Member[];
  parts: PartId[];
  speed: number;
  /** Cuánto caminó (desde que salieron todos). */
  travelled: number;
  /** Cuándo arranca a caminar. */
  startAt: number;
}

interface Member {
  slot: Slot;
  form: Formation;
  state: 'hole' | 'rising' | 'march' | 'free';
  hole: HoleFx;
  /** Cuándo sale del hoyo. */
  at: number;
  /** Desde que empezó a salir. */
  t: number;
  /** El pozo: cuánto hace que salió (se cierra solo), y si ya se fue. */
  holeAge: number;
  holeGone: boolean;
  e: Enemy | null;
}

export function startCaddie(ctx: BossCtx, cfg: CaddieCfg): BossFight {
  const { horde } = ctx;
  const fx = new CaddieFx(ctx.scene);
  const tmp = new THREE.Vector3();
  const counts = { calls: 0, forms: 0, members: 0, right: 0, wrong: 0, seals: 0, sealRight: 0, sealWrong: 0, raised: 0, bossRight: 0, bossWrong: 0, other: 0, maxMarch: 0 };
  const byClub: Record<ClubId, number> = { driver: 0, iron: 0, wedge: 0, putter: 0 };

  // ---- los sellos (y los anillos de las formaciones): qué palo le pega a quién ----
  const marks = new Map<Enemy, { fx: SealFx; club: ClubId; seal: boolean }>();
  let nagged = -Infinity;
  /** Cuánto le entra a `e` de un golpe de `amount` del tiro `shot`, según su sello (o el palo que canta, si es él). */
  function sealFilter(e: Enemy, amount: number, shot: Horde['shot']): number {
    const club = e === boss ? current : marks.get(e)?.seal ? marks.get(e)!.club : null;
    if (!club || (!boss.alive && e !== boss) || amount <= 1) return amount;
    // el golpe fantasma pasa (es lo suyo, pasar las defensas); una pelota de ese palo, también la de una
    // habilidad, entra entera. Lo demás (otro palo, el rayo que salta, el fuego, las explosiones), 1
    if (shot?.ghost) return amount;
    if (shot && shot.club === club) return amount;
    if (!shot) {
      counts.other++;
      return 1;
    }
    const now = ctx.clock();
    if (now - nagged > NAG_EVERY) {
      nagged = now;
      ctx.feedback(WITH[club]);
    }
    return 1;
  }
  function unmark(e: Enemy): void {
    const m = marks.get(e);
    if (!m) return;
    m.fx.dispose();
    marks.delete(e);
  }
  function mark(e: Enemy, club: ClubId, seal: boolean): void {
    unmark(e);
    marks.set(e, { fx: new SealFx(fx, e, club, seal), club, seal });
  }

  /** Lo que se cuelga a los de la horda (los comunes, y los que saca del piso): el sello y a quién le pegaste. */
  const lastHit = new Map<Enemy, number>();
  const plain: EnemyScript = {
    filter: sealFilter,
    onDamage(e, dealt) {
      if (dealt > 0) lastHit.set(e, ctx.clock());
    },
    onDeath: (e) => died(e),
  };
  function died(e: Enemy): void {
    lastHit.delete(e);
    const m = marks.get(e);
    if (m?.seal && boss.alive) {
      const club = horde.shot?.club;
      if (club && !horde.shot?.ability) club === m.club ? counts.sealRight++ : counts.sealWrong++;
    }
    unmark(e);
  }

  // ---- él ----
  const hp = HP + HP_PER_LEVEL * ctx.level + ctx.bonusHp;
  /** El palo que canta: el único que le pega de verdad. */
  let current: ClubId | null = null;
  let bag: ClubId[] = [];
  let mode: 'enter' | 'patrol' | 'advance' | 'front' = 'enter';
  let goal = new THREE.Vector2(0, lerp(HOME_Z, 0.5));
  let pause = 0;
  let side = ctx.rng() < 0.5 ? -1 : 1;
  let shout = 0;
  /** El grito que espera a que llegue adelante (el putter). */
  let pendingCall: ClubId | null = null;
  let callTimer = FIRST_CALL;
  /** El brazo que tira la funda (sellos): de 0 a 1.25, o -1. */
  let toss = -1;
  let born = 0;
  const fury = () => 1 - boss.hp / boss.maxHp;

  const bossScript: EnemyScript = {
    update(e, dt) {
      e.knock.set(0, 0, 0);
      e.scriptGesture = toss >= 0 ? 1 : 0;
      e.scriptSwing = toss >= 0 ? Math.min(1.25, toss / 0.45) : null;
      if (toss >= 0 && (toss += dt) > 0.6) toss = -1;
      if (ctx.over() || e.stunned) {
        e.animator.setLocomotion('Idle', 1);
        return true;
      }
      if (mode === 'enter') {
        // sale del piso, en el medio del fondo, y grita
        born += dt;
        const u = Math.min(1, born / ENTER_TIME);
        e.body.position.y = -(1 - u * u * (3 - 2 * u)) * HEIGHT;
        e.animator.setLocomotion('Idle', 1);
        if (u >= 1) {
          e.body.position.y = 0;
          mode = 'patrol';
          pause = PATROL_PAUSE;
          shout = SHOUT;
          e.animator.playOneShot('Rallying', (e.animator.clipDuration('Rallying') || SHOUT) / SHOUT);
          ctx.audio.bossThrow();
        }
        return true;
      }
      if (shout > 0) {
        shout -= dt;
        e.animator.setLocomotion('Idle', 1);
        e.faceToward(e.position.x, e.position.z - 10, dt, 4);
        return true;
      }
      const run = mode === 'advance' || (mode === 'patrol' && e.position.z < HOME_Z[0] - 3);
      const arrived = e.walkToward(goal.x, goal.y, run ? RUN_SPEED : PATROL_SPEED, dt, run, 0.25);
      if (!arrived) return true;
      e.faceToward(e.position.x, e.position.z - 10, dt, 4);
      if (mode === 'advance') {
        mode = 'front';
        if (pendingCall) call(pendingCall);
        pendingCall = null;
      } else if (mode === 'patrol' && (pause -= dt) <= 0) {
        side = -side;
        goal = new THREE.Vector2(side * lerp(HOME_X, ctx.rng()), lerp(HOME_Z, ctx.rng()));
        pause = PATROL_PAUSE;
      }
      return true;
    },
    filter: sealFilter,
    onDamage(_e, dealt) {
      const club = horde.shot?.club;
      if (dealt > 0 && club) club === current ? counts.bossRight++ : counts.bossWrong++;
    },
    onDeath: () => bossDied(),
  };
  const boss = horde.spawnCustom(
    partStats('goblin', { name: L('El Caddie', 'The Caddie'), height: HEIGHT, radius: RADIUS, hp, speed: 0, heavy: true, boss: true, damage: 3, gateDamage: 3, score: 500 }),
    'goblin', 0, ENTER_Z, {}, bossScript,
  );
  boss.heading = Math.PI;
  boss.body.position.y = -HEIGHT;
  ctx.effects.explosion(new THREE.Vector3(0, heightAt(0, ENTER_Z) + 0.4, ENTER_Z), 2.2, 0x6b4a2a);
  const look = new CaddieLook(boss);
  let bossMark: SealFx | null = null;

  /** El próximo palo: de una bolsa con los cuatro, mezclada, sin repetir el de ahora. */
  function nextClub(): ClubId {
    if (!bag.length) {
      bag = [...CLUBS].sort(() => ctx.rng() - 0.5);
      if (bag[bag.length - 1] === current) bag.reverse();
    }
    return bag.pop()!;
  }

  /** Canta `club`: lo levanta, grita, y (según la versión) sale la formación. */
  function call(club: ClubId): void {
    current = club;
    counts.calls++;
    byClub[club]++;
    look.setActive(club);
    bossMark?.dispose();
    bossMark = new SealFx(fx, boss, club, true, 2.8);
    shout = SHOUT;
    boss.animator.playOneShot('Rallying', (boss.animator.clipDuration('Rallying') || SHOUT) / SHOUT);
    fx.add(new CallFx(fx, boss, club));
    ctx.audio.bossThrow();
    if (cfg.formations !== 'none') formation(club);
    // después del putter, de vuelta al fondo
    if (club !== 'putter' && mode === 'front') {
      mode = 'patrol';
      goal = new THREE.Vector2(side * lerp(HOME_X, ctx.rng()), lerp(HOME_Z, ctx.rng()));
    }
  }

  /** Le toca cantar: el putter, viniéndose adelante primero. */
  function startCall(): void {
    const club = nextClub();
    if (club === 'putter' && mode !== 'front') {
      pendingCall = club;
      mode = 'advance';
      // adelante, en una fila del medio para no pisar a nadie en la línea
      goal = new THREE.Vector2(clampX(boss.position.x * 0.5, FRONT_Z, 4), FRONT_Z);
      return;
    }
    call(club);
  }

  // ---- las formaciones ----
  const forms: Formation[] = [];
  const marching = () => forms.reduce((n, f) => n + f.members.filter((m) => m.state !== 'free' && (!m.e || m.e.alive)).length, 0);

  function formation(club: ClubId): void {
    let parts: PartId[];
    const others = CLUBS.filter((c) => c !== club).sort(() => ctx.rng() - 0.5);
    const u = fury();
    const n = cfg.formations === 'mixed' ? (u < MIXED_THREE_AT ? 2 : 3) : u < MIX_AT[0] ? 1 : u < MIX_AT[1] ? 2 : 3;
    if (n === 1) parts = [SOLO_PART[club]];
    else parts = [MIXED_PART[club], ...others.slice(0, n - 1).map((c) => MIXED_PART[c])];
    const slots = buildFormation(parts, boss.position.x, ctx.spots(), ctx.rng);
    const now = ctx.clock();
    const form: Formation = { members: [], parts, speed: parts.length === 1 && parts[0] === 'emboscada' ? FORM.ambushSpeed : FORM.speed, travelled: 0, startAt: now + HOLE_TIME + RISE_TIME };
    for (const slot of slots) {
      form.members.push({ slot, form, state: 'hole', hole: new HoleFx(fx, slot.x, slot.z, PART_CLUB[slot.part], 0.4 + 0.5 * (slot.kind === 'orc' ? 0.6 : 0.45)), at: now + HOLE_TIME, t: 0, holeAge: 0, holeGone: false, e: null });
    }
    forms.push(form);
    counts.forms++;
  }

  /** Sale uno de la formación: del hoyo, subiendo. */
  function rise(m: Member): void {
    const { slot } = m;
    const script: EnemyScript = {
      update(e, dt) {
        if (m.state === 'rising') {
          m.t += dt;
          const u = Math.min(1, m.t / RISE_TIME);
          e.body.position.y = -(1 - u * u * (3 - 2 * u)) * e.stats.height * 0.95;
          e.knock.set(0, 0, 0);
          e.animator.setLocomotion('Idle', 1);
          e.faceToward(e.position.x, e.position.z - 10, dt);
          if (u >= 1) {
            e.body.position.y = 0;
            m.state = 'march';
          }
          return true;
        }
        if (m.state !== 'march') return false;
        const f = m.form;
        const tz = slot.z - f.travelled;
        if (tz <= TEE_Z + HANDOFF || !boss.alive || ctx.over()) {
          m.state = 'free';
          return false;
        }
        if (e.stunned || e.frozen) {
          e.animator.setLocomotion('Idle', e.frozen ? 0.001 : 1);
          return true;
        }
        const tx = laneX(slot.x, slot.z, tz);
        const d = Math.hypot(tx - e.position.x, tz - e.position.z);
        // si lo empujaron, alcanza a los otros
        const behind = d > 1.0;
        e.walkToward(tx, tz, f.speed * (behind ? 1.8 : 1.08), dt, behind, 0.02);
        return true;
      },
      filter: sealFilter,
      onDamage(e, dealt) {
        if (dealt > 0) lastHit.set(e, ctx.clock());
      },
      onDeath(e) {
        const club = horde.shot?.club;
        if (club && !horde.shot?.ability) club === PART_CLUB[slot.part] ? counts.right++ : counts.wrong++;
        died(e);
      },
    };
    // a la puerta le saca 1 cada uno (el orco sacaba 2: un pelotón entero eran 10, la puerta entera)
    const e = horde.spawnCustom(partStats(slot.kind, { gateDamage: 1 }), slot.kind, slot.x, slot.z, { ...slot.mods }, script);
    e.heading = Math.PI;
    e.body.position.y = -e.stats.height;
    m.e = e;
    m.state = 'rising';
    mark(e, PART_CLUB[slot.part], cfg.sealed);
    counts.members++;
    tmp.set(slot.x, heightAt(slot.x, slot.z) + 0.3, slot.z);
    ctx.effects.explosion(tmp, 0.9, 0x6b4a2a);
  }

  function updateForms(dt: number): void {
    const now = ctx.clock();
    for (let i = forms.length - 1; i >= 0; i--) {
      const f = forms[i];
      if (now >= f.startAt) f.travelled += f.speed * dt;
      let risenSome = false;
      for (const m of f.members) {
        if (m.state === 'hole') {
          m.hole.update(dt, Math.min(1, 1 - (m.at - now) / HOLE_TIME));
          if (now >= m.at && boss.alive && !ctx.over()) {
            rise(m);
            risenSome = true;
          }
        } else if (!m.holeGone) {
          // el pozo se va cerrando detrás del que salió
          m.holeAge += dt;
          m.hole.update(dt, 1, Math.min(1, Math.max(0, (m.holeAge - RISE_TIME) / 0.6)));
          if (m.holeAge > RISE_TIME + 0.6) {
            m.holeGone = true;
            m.hole.dispose();
          }
        }
      }
      if (risenSome) ctx.audio.thud();
      // se termina cuando ya no queda nadie marchando ni por salir
      const live = f.members.some((m) => m.state === 'hole' || ((m.state === 'rising' || m.state === 'march') && m.e?.alive && !m.e.passed));
      const holes = f.members.some((m) => m.state === 'hole' || !m.holeGone);
      if (!live && !holes) forms.splice(i, 1);
    }
  }

  // ---- los sellos a los de la horda ----
  let sealTimer = FIRST_SEAL;
  const tosses = new Set<Enemy>();

  /** A cada enemigo común se le cuelga `plain` (sin `update`: se mueve como siempre). */
  function adopt(): void {
    for (const e of horde.enemies) if (e.script === null && e.alive && !e.passed) e.script = plain;
  }

  function sealable(e: Enemy): boolean {
    return e.alive && !e.passed && e.script === plain && !marks.has(e) && !tosses.has(e) && e.behavior !== 'kamikaze'
      && !e.mods.apart && e.maxHp >= 2 && e.position.z > TEE_Z + SEAL_NEAR && e.position.z < SEAL_FAR_Z;
  }

  function interest(e: Enemy): number {
    const hit = lastHit.get(e);
    const since = hit === undefined ? Infinity : ctx.clock() - hit;
    return (since < HIT_MEMORY ? 1000 - since * 50 : 0) + e.hp * 10 - (e.position.z - TEE_Z) * 0.2;
  }

  /** El palo que le toca a `e`: el que mejor le pega donde está y como viene; si no, el que menos hay. */
  function sealClubFor(e: Enemy): ClubId {
    const d = e.position.z - TEE_Z;
    if (e.armorLevel > 0) return d <= 22 ? 'putter' : 'driver';
    if (e.hasShield) return 'wedge';
    if (d <= 18) return 'putter';
    const near = horde.enemies.filter((o) => o !== e && o.alive && !o.passed && Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) < 3.5).length;
    if (near >= 2) return 'iron';
    const used: Record<ClubId, number> = { driver: 0, iron: 0, wedge: 0, putter: 0 };
    for (const m of marks.values()) if (m.seal) used[m.club]++;
    const pool = CLUBS.filter((c) => c !== 'putter' || d <= 26);
    pool.sort((a, b) => used[a] - used[b] || ctx.rng() - 0.5);
    return pool[0];
  }

  function updateSeals(dt: number): void {
    if (!cfg.seals || !boss.alive || ctx.over()) return;
    if ((sealTimer -= dt) > 0) return;
    const active = [...marks.values()].filter((m) => m.seal).length + tosses.size;
    if (active >= MAX_SEALS) {
      sealTimer = 0.5;
      return;
    }
    let best: Enemy | null = null;
    let score = -Infinity;
    for (const e of horde.enemies) {
      if (!sealable(e)) continue;
      const s = interest(e);
      if (s > score) {
        score = s;
        best = e;
      }
    }
    if (!best) {
      sealTimer = 0.5;
      return;
    }
    sealTimer = lerp(SEAL_EVERY, fury());
    const target = best;
    const club = sealClubFor(target);
    tosses.add(target);
    toss = 0;
    ctx.audio.whoosh(0.5);
    const from = new THREE.Vector3(boss.position.x, boss.position.y + boss.height + 0.6, boss.position.z);
    const to = new THREE.Vector3();
    fx.add(new CoverFx(fx, from, () => to.set(target.position.x, target.position.y + target.height + 0.3, target.position.z), club, TOSS_TIME, () => {
      tosses.delete(target);
      if (!target.alive || target.passed || !boss.alive) return;
      mark(target, club, true);
      counts.seals++;
      ctx.effects.spark(to, CLUB_TINT[club]);
      ctx.audio.casterHit();
    }));
  }

  // ---- sacar del piso (sellos: que nunca se quede sin a quién sellar) ----
  let raiseTimer = RAISE_EVERY;
  const raising: { hole: HoleFx; x: number; z: number; kind: EnemyKind; at: number; born: number }[] = [];
  function updateRaise(dt: number): void {
    const now = ctx.clock();
    for (let i = raising.length - 1; i >= 0; i--) {
      const r = raising[i];
      r.hole.update(dt, Math.min(1, (now - r.born) / (r.at - r.born)));
      if (now < r.at) continue;
      r.hole.dispose();
      raising.splice(i, 1);
      if (!boss.alive || ctx.over()) continue;
      raisePlain(r.kind, r.x, r.z);
    }
    if (!cfg.seals || cfg.formations !== 'none' || !boss.alive || ctx.over() || now < RAISE_FROM) return;
    if ((raiseTimer -= dt) > 0) return;
    const field = horde.enemies.filter((e) => e.alive && !e.passed && e !== boss).length;
    if (field >= RAISE_BELOW) {
      raiseTimer = 1;
      return;
    }
    raiseTimer = RAISE_EVERY;
    shout = Math.max(shout, 0.8);
    boss.animator.playOneShot('Rallying', 1.8);
    for (let i = 0; i < RAISE_COUNT; i++) {
      const z = 36 + ctx.rng() * 14;
      const x = clampX((i - (RAISE_COUNT - 1) / 2) * 10 + (ctx.rng() * 2 - 1) * 3, z);
      const kind = RAISE_KINDS[Math.floor(ctx.rng() * RAISE_KINDS.length)];
      raising.push({ hole: new HoleFx(fx, x, z, current ?? 'driver', 0.75), x, z, kind, at: now + HOLE_TIME, born: now });
    }
  }
  function raisePlain(kind: EnemyKind, x: number, z: number): void {
    let t = 0;
    const script: EnemyScript = {
      update(e, dt) {
        t += dt;
        const u = Math.min(1, t / RISE_TIME);
        e.body.position.y = -(1 - u * u * (3 - 2 * u)) * e.stats.height * 0.95;
        e.knock.set(0, 0, 0);
        e.animator.setLocomotion('Idle', 1);
        if (u < 1) return true;
        e.body.position.y = 0;
        e.script = plain;
        return false;
      },
      filter: sealFilter,
      onDeath: (e) => died(e),
    };
    const mods: EnemyMods = {};
    // a la puerta, 1 (como los de las formaciones)
    const e = horde.spawnCustom(partStats(kind, { gateDamage: 1 }), kind, x, z, mods, script);
    e.heading = Math.PI;
    e.body.position.y = -e.stats.height;
    counts.raised++;
    tmp.set(x, heightAt(x, z) + 0.3, z);
    ctx.effects.explosion(tmp, 1, 0x6b4a2a);
  }

  // ---- cuando muere ----
  let over = false;
  function bossDied(): void {
    if (over) return;
    over = true;
    current = null;
    look.setActive(null);
    bossMark?.dispose();
    bossMark = null;
    // los sellos se apagan; los que marchaban siguen solos; los hoyos se cierran
    for (const e of [...marks.keys()]) {
      if (e.alive) ctx.effects.spark(tmp.set(e.position.x, e.position.y + e.height + 0.5, e.position.z), 0xffffff);
      unmark(e);
    }
    for (const f of forms) {
      for (const m of f.members) {
        if (m.state === 'march' || m.state === 'rising') {
          if (m.e) m.e.body.position.y = 0;
          m.state = 'free';
        }
        if (m.state === 'hole') m.state = 'free';
        if (!m.holeGone) m.hole.dispose();
        m.holeGone = true;
      }
    }
    forms.length = 0;
    for (const r of raising) r.hole.dispose();
    raising.length = 0;
    ctx.banner(L('¡El Caddie cayó!', 'The Caddie has fallen!'), L('Sus sellos se apagan', 'His seals fade away'), 2.5);
  }

  let hinted = false;
  return {
    get done() {
      return !boss.alive;
    },
    update(dt) {
      adopt();
      fx.update(dt);
      look.update(dt);
      bossMark?.update(dt);
      for (const m of marks.values()) m.fx.update(dt);
      // los que se fueron sin morir de un golpe (pasaron la línea, el hoyo) sueltan el sello
      for (const e of [...marks.keys()]) if (!e.alive || e.passed) unmark(e);
      for (const e of lastHit.keys()) if (!e.alive) lastHit.delete(e);
      if (!hinted && ctx.clock() > 3.5) {
        hinted = true;
        ctx.banner(L('El Caddie', 'The Caddie'), cfg.hint, 4);
      }
      updateForms(dt);
      updateRaise(dt);
      if (!boss.alive) return;
      counts.maxMarch = Math.max(counts.maxMarch, marching());
      updateSeals(dt);
      if (ctx.over() || mode === 'enter' || mode === 'advance' || shout > 0) return;
      if ((callTimer -= dt) > 0) return;
      if (cfg.formations !== 'none' && marching() > MAX_MARCHING) {
        callTimer = 1.5;
        return;
      }
      const hurry = Math.min(CALL_HURRY.max, Math.max(0, ctx.clock() - CALL_HURRY.from) / CALL_HURRY.per);
      const easy = 1 + CALL_EASY * Math.max(0, 1 - ctx.level / 10);
      callTimer = lerp(CALL_EVERY[cfg.formations], fury()) * easy - hurry;
      startCall();
    },
    bot: {
      weight(e) {
        // el jefe pesa 3 de por sí (ver bot.ts): un golpe de 1 con otro palo no tiene que ganarle a una baja
        if (e === boss) return 0.5;
        return 1;
      },
      dealt(e, club, dmg) {
        const c = e === boss ? current : marks.get(e)?.seal ? marks.get(e)!.club : null;
        if (!c || !boss.alive || dmg <= 1) return dmg;
        return club === c ? dmg : 1;
      },
    },
    log: () => ({
      version: `${cfg.formations}${cfg.sealed ? '/sellado' : ''}${cfg.seals ? '/sellos' : ''}`, // i18n-ok: registro
      vida: Math.max(0, boss.hp), // i18n-ok: registro
      max: boss.maxHp,
      ...counts,
      gritos: CLUBS.map((c) => `${c[0]}${byClub[c]}`).join(' '), // i18n-ok: registro
    }),
    dispose() {
      for (const e of [...marks.keys()]) unmark(e);
      bossMark?.dispose();
      for (const f of forms) for (const m of f.members) if (!m.holeGone) m.hole.dispose();
      forms.length = 0;
      for (const r of raising) r.hole.dispose();
      raising.length = 0;
      look.dispose();
      fx.dispose();
    },
  };
}
