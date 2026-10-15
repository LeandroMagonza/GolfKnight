// La pelea con el nigromante (14/10, idea de Leandro; ver docs/jefes/nigromante.md). Pone a prueba
// **dónde y cuándo matar**: él se queda al fondo, llevado en andas, y marca a los de la horda (o los
// encadena). Matar a un marcado lo trae de vuelta a los segundos, donde cayó; a los encadenados hay que
// matarlos juntos. Él no pega: lo que lastima es la horda que vuelve. Cualquier pelotazo a las andas le
// baja la vida, y cuando muere se apagan sus marcas.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { EnemyKind, EnemyMods, Wave } from '../../../core/waves';
import type { Enemy, EnemyScript } from '../../enemies';
import { heightAt, partStats, SPAWN_Z, TEE_Z } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { BEAM_TRAVEL, ChainRingFx, GREEN, GraveFx, LinkFx, MarkFx, NecroFx } from './fx';
import { addBearerLook, addLitterLook, BEARER_HEIGHT, BEARER_SPOTS, Litter, LITTER_RADIUS, LITTER_RADIUS_BARE } from './litter';

/** Lo que cambia entre versiones (ver index.ts). */
export interface Version {
  /** Qué les pone a los de la horda: marcas (el que matás vuelve) o cadenas (se matan juntos o vuelven). */
  mode: 'marks' | 'chains';
  /** Cómo vuelve el que mataste marcado: el mismo, entero, o un esqueleto. */
  revive: 'same' | 'bones';
  /** Los porteadores son enemigos aparte: si caen, las andas se caen y él queda en el piso. */
  bearers: boolean;
  /** El cartel de la regla, al empezar (lo ve el jugador). */
  hint: string;
}

// ---- él y las andas ----
/** Su vida: la base, lo que suma cada nivel de dificultad, y el golpe 4 (`bonusHp`). */
const NECRO_HP = 70;
const NECRO_HP_PER_LEVEL = 3;
/**
 * Entra hasta ENTER_Z y de ahí va y viene de costado entre PATROL_Z (29 a 37 m de los puestos). Más al fondo
 * casi no se lo veía desde la cámara de siempre, ni a quién marcaba.
 */
const ENTER_Z = 45;
const PATROL_Z: [number, number] = [38, 46];
/** Hasta dónde va de costado (y desde dónde: no se queda en el medio). */
const PATROL_X: [number, number] = [3, 10];
/** A qué velocidad lo llevan: entrando, y yendo y viniendo (más rápido cuanto menos vida le queda). */
const ENTER_SPEED = 2.2;
const PATROL_SPEED: [number, number] = [1.0, 1.7];
/** Lo que se queda parado en cada punta antes de cruzar. */
const PATROL_PAUSE = 1.6;
/** Lo que gira la tabla (más lento que un enemigo: es una tabla con cuatro tipos abajo). */
const TURN_RATE = 2.2;

// ---- las marcas ----
/** Cada cuánto marca a uno: con toda la vida, y casi muerto. */
const MARK_EVERY: [number, number] = [3.0, 2.0];
/** Cuántos marcados a la vez: al marcar uno más, suelta al más viejo. Con poca dificultad, menos. */
const MAX_MARKS = 5;
const MAX_MARKS_EASY = 4;
const EASY_LEVEL = 3;
/** La primera marca, desde que arranca la pelea (que se lo vea entrar). */
const FIRST_MARK = 4;
/** Lo que levanta el bastón antes de que salga el rayo: el aviso de a quién va. */
const CAST_WINDUP = 0.45;
/** «El que le estás pegando»: le pegaste hace menos de esto, y lo marca primero. */
const HIT_MEMORY = 4;
/** No marca a los que están por llegar (a menos de esto de la línea) ni a los que recién aparecen. */
const MARK_NEAR = 7;
const MARK_FAR_Z = 63;
/** Cuánto tarda en volver el que mataste marcado (con toda la vida, y casi muerto). */
const REVIVE_DELAY: [number, number] = [3.0, 2.2];
/** Lo que tarda en salir del piso. */
const RISE_TIME = 0.7;
/** El tinte de los que volvieron: verdosos. No se los vuelve a marcar ni a encadenar. */
const REVIVED_TINT = 0x9fe6a0;

// ---- alzar muertos (que nunca se quede sin a quién marcar) ----
/** Si quedan menos de RAISE_BELOW en el campo, cada RAISE_EVERY s alza esqueletos adelante suyo. */
const RAISE_BELOW = 4;
const RAISE_EVERY = 9;
const RAISE_COUNT: [number, number] = [2, 3];
/** Lo que tarda en salir lo que alza (la tumba avisa). */
const RAISE_DELAY = 1.8;
/** No alza al principio: la escolta está entrando. */
const RAISE_FROM = 20;

// ---- la escolta ----
/** La última oleada, más larga y más espaciada: la pelea dura un par de minutos y la horda tiene que alcanzar. */
const ESCORT_MORE = 1.7;
const ESCORT_INTERVAL = 2.5;

// ---- las cadenas ----
/** Cada cuánto encadena (con toda la vida, y casi muerto), cuántas cadenas a la vez, y a qué distancia junta. */
const CHAIN_EVERY: [number, number] = [5, 3.5];
const MAX_CHAINS = 3;
const CHAIN_REACH = 5.5;
/** Desde que cae el primero de una cadena, lo que hay para matar al resto. */
const CHAIN_WINDOW = 2.0;
/** Lo que le saca a él romper una cadena entera, según cuántos tenía. */
const CHAIN_DAMAGE: Record<number, number> = { 2: 4, 3: 6 };

// ---- los porteadores ----
/** La vida de cada porteador, y con cuántos en pie se caen las andas. */
const BEARER_HP = 4;
const DROP_AT = 2;
/** Lo que queda en el piso, y lo que le suma a cada golpe mientras tanto. */
const DROP_TIME = 5;
const DROP_BONUS = 1;
/** Lo que se ladea la tabla por cada porteador de diferencia entre un lado y el otro. */
const TILT_PER = 0.07;

const lerp = (r: [number, number], u: number) => r[0] + (r[1] - r[0]) * Math.max(0, Math.min(1, u));

/** La última oleada, sin el gólem: más gente, más espaciada (ver ESCORT_MORE). */
export function escort(wave: Wave): void {
  wave.interval = ESCORT_INTERVAL;
  for (const g of wave.groups) if (!g.mark && g.kind !== 'wraith') g.count = Math.round(g.count * ESCORT_MORE);
}

/** Una tumba: donde va a salir uno (el marcado que mataste, el encadenado, o uno que él alza). */
interface Grave {
  x: number;
  z: number;
  kind: EnemyKind;
  mods: EnemyMods;
  born: number;
  /** Cuándo sale (para las cadenas, cuando se cierra la ventana). */
  at: number;
  fx: GraveFx;
  /** Lo alzó él: sale como esqueleto común (se lo puede marcar). */
  raised?: boolean;
  /** Si es de una cadena: si la rompen, no sale. */
  chain?: Chain;
}

interface Chain {
  members: Enemy[];
  links: LinkFx[];
  rings: Map<Enemy, ChainRingFx>;
  /** Cuándo se cierra la ventana (desde que cayó el primero), o -1. */
  until: number;
  fallen: number;
  /** La rompieron entera: se resuelve en el próximo cuadro. */
  broken: boolean;
}

export function startNecro(ctx: BossCtx, cfg: Version): BossFight {
  const { horde } = ctx;
  const fx = new NecroFx(ctx.scene);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  // ---- el cuerpo: las andas con él arriba, un solo enemigo ----
  const look = addLitterLook(horde, 'nigro-andas', ctx.models, ctx.dungeon);
  const hp = NECRO_HP + NECRO_HP_PER_LEVEL * ctx.level + ctx.bonusHp;
  const stats = partStats('golem', {
    name: L('El Nigromante', 'The Necromancer'),
    behavior: 'melee', height: look.height, radius: cfg.bearers ? LITTER_RADIUS_BARE : LITTER_RADIUS,
    hp, speed: 0, heavy: true, boss: true, tint: 0,
  });
  let speed = 0;
  let goal = new THREE.Vector2(0, ENTER_Z);
  let entering = true;
  let pause = 0;
  let side = ctx.rng() < 0.5 ? -1 : 1;
  /** Se queda quieto mientras conjura. */
  let hold = 0;
  let dropped = 0;
  const fury = () => 1 - boss.hp / boss.maxHp;

  const bossScript: EnemyScript = {
    update(e, dt) {
      e.knock.set(0, 0, 0);
      speed = 0;
      if (ctx.over() || dropped > 0) {
        e.animator.setLocomotion('Idle', 1);
        return true;
      }
      if (hold > 0) hold -= dt;
      const dx = goal.x - e.position.x;
      const dz = goal.y - e.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.25) {
        entering = false;
        e.faceToward(e.position.x, e.position.z - 10, dt, TURN_RATE);
        if ((pause -= dt) <= 0) {
          // a la otra punta, a otra profundidad
          side = -side;
          goal = new THREE.Vector2(side * lerp(PATROL_X, ctx.rng()), lerp(PATROL_Z, ctx.rng()));
          pause = PATROL_PAUSE;
        }
      } else if (hold <= 0) {
        const bearers = cfg.bearers ? bearersUp() / BEARER_SPOTS.length : 1;
        speed = (entering ? ENTER_SPEED : lerp(PATROL_SPEED, fury())) * bearers;
        const step = Math.min(dist, speed * dt);
        e.position.x += (dx / dist) * step;
        e.position.z += (dz / dist) * step;
        e.faceToward(goal.x, goal.y, dt, TURN_RATE);
      }
      e.position.y = heightAt(e.position.x, e.position.z);
      e.animator.setLocomotion('Idle', 1);
      return true;
    },
    // en el piso (las andas caídas), cada golpe le saca uno más
    filter: (_e, amount) => (dropped > 0 && amount > 0 ? amount + DROP_BONUS : amount),
    onDeath: () => necroDied(),
  };
  const boss = horde.spawnCustom(stats, 'nigro-andas', 0, SPAWN_Z, {}, bossScript);
  boss.heading = Math.PI;
  const litter = new Litter(boss, ctx.dungeon, !cfg.bearers);

  // ---- los de la horda: a quién le estás pegando, y quién muere ----
  const lastHit = new Map<Enemy, number>();
  /** Los que ya volvieron una vez (o son suyos): no se los marca ni encadena. */
  const spent = new Set<Enemy>();
  const tracker: EnemyScript = {
    onDamage(e, dealt) {
      if (dealt > 0) lastHit.set(e, ctx.clock());
    },
    onDeath: (e) => regularDied(e),
  };
  /** A cada enemigo común se le cuelga `tracker` (sin `update`: se mueve como siempre). */
  function adopt(): void {
    for (const e of horde.enemies) if (e.script === null && e.alive && !e.passed) e.script = tracker;
  }
  const regular = (e: Enemy) => e.script === tracker;

  const graves: Grave[] = [];
  const counts = { marks: 0, markedKills: 0, revived: 0, raised: 0, chains: 0, broken: 0, failed: 0, drops: 0 };

  function regularDied(e: Enemy): void {
    lastHit.delete(e);
    if (!boss.alive) return;
    const mark = marked.get(e);
    if (mark) {
      mark.dispose();
      marked.delete(e);
      counts.markedKills++;
      const delay = lerp(REVIVE_DELAY, fury());
      addGrave(e.position.x, e.position.z, e.stats.kind, e.mods, delay);
    }
    const chain = chainOf.get(e);
    if (chain) chainDied(chain, e);
  }

  function addGrave(x: number, z: number, kind: EnemyKind, mods: EnemyMods, delay: number, extra: Partial<Grave> = {}): Grave {
    const now = ctx.clock();
    const g: Grave = { x, z, kind, mods, born: now, at: now + delay, fx: new GraveFx(fx, x, z), ...extra };
    graves.push(g);
    return g;
  }

  /** Sale uno de la tumba: el mismo (o un esqueleto), entero, saliendo del piso. */
  function rise(g: Grave): void {
    const bones = g.raised || cfg.revive === 'bones';
    const kind: EnemyKind = bones ? 'skeleton' : g.kind;
    const mods: EnemyMods = bones ? {} : { ...g.mods };
    let t = 0;
    const script: EnemyScript = {
      update(e, dt) {
        t += dt;
        const u = Math.min(1, t / RISE_TIME);
        e.body.position.y = -(1 - u * u * (3 - 2 * u)) * e.stats.height * 0.9;
        e.animator.setLocomotion('Idle', 1);
        if (u < 1) return true;
        e.body.position.y = 0;
        e.script = tracker;
        return false;
      },
    };
    const e = horde.spawnCustom(partStats(kind, { tint: g.raised ? 0 : REVIVED_TINT }), kind, g.x, g.z, mods, script);
    e.heading = Math.PI;
    if (!g.raised) spent.add(e);
    tmpA.set(g.x, heightAt(g.x, g.z), g.z);
    ctx.effects.blink(tmpA, GREEN);
  }

  // ---- las marcas ----
  const marked = new Map<Enemy, MarkFx>();
  const maxMarks = ctx.level < EASY_LEVEL ? MAX_MARKS_EASY : MAX_MARKS;
  let markTimer = FIRST_MARK;
  let cast: { targets: Enemy[]; t: number; beamed: boolean } | null = null;

  const headOf = (e: Enemy, out: THREE.Vector3) => out.set(e.position.x, e.position.y + e.height + 0.3, e.position.z);

  function markable(e: Enemy): boolean {
    return e.alive && !e.passed && regular(e) && !spent.has(e) && !marked.has(e) && !chainOf.has(e) && !e.silenced
      && e.behavior !== 'kamikaze' && e.position.z > TEE_Z + MARK_NEAR && e.position.z < MARK_FAR_Z;
  }

  /** Cuánto le interesa: el que le estás pegando primero; si no, el de más vida, y entre esos el más cerca. */
  function interest(e: Enemy): number {
    const hit = lastHit.get(e);
    const since = hit === undefined ? Infinity : ctx.clock() - hit;
    return (since < HIT_MEMORY ? 1000 - since * 50 : 0) + e.maxHp * 10 + e.hp - (e.position.z - TEE_Z) * 0.2;
  }

  function pickMark(): Enemy | null {
    let best: Enemy | null = null;
    let score = -Infinity;
    for (const e of horde.enemies) {
      if (!markable(e)) continue;
      const s = interest(e);
      if (s > score) {
        score = s;
        best = e;
      }
    }
    return best;
  }

  function unmark(e: Enemy): void {
    const m = marked.get(e);
    if (!m) return;
    m.dispose();
    marked.delete(e);
    if (e.alive) ctx.effects.spark(headOf(e, tmpA), GREEN);
  }

  function applyMark(e: Enemy): void {
    // al llegar a las cinco, suelta al más viejo
    if (marked.size >= maxMarks) unmark(marked.keys().next().value!);
    marked.set(e, new MarkFx(fx, e));
    counts.marks++;
    ctx.effects.spark(headOf(e, tmpA), GREEN);
  }

  /** Levanta el bastón y le tira el rayo a cada uno (la marca, o la cadena, llega con el rayo). */
  function startCast(targets: Enemy[]): void {
    cast = { targets, t: 0, beamed: false };
    hold = CAST_WINDUP + BEAM_TRAVEL + 0.2;
    litter.point();
    ctx.audio.casterCast();
  }

  function updateCast(dt: number): void {
    if (!cast) return;
    cast.t += dt;
    if (!cast.beamed && cast.t >= CAST_WINDUP) {
      cast.beamed = true;
      for (const target of cast.targets) {
        const from = new THREE.Vector3();
        const to = new THREE.Vector3();
        fx.beam(() => litter.staffTip(from), () => headOf(target, to));
      }
    }
    if (cast.t < CAST_WINDUP + BEAM_TRAVEL) return;
    const targets = cast.targets;
    cast = null;
    if (cfg.mode === 'marks') {
      if (markable(targets[0])) applyMark(targets[0]);
    } else {
      makeChain(targets.filter(chainable));
    }
  }

  // ---- las cadenas ----
  const chains: Chain[] = [];
  const chainOf = new Map<Enemy, Chain>();
  let chainTimer = FIRST_MARK;

  function chainable(e: Enemy): boolean {
    return e.alive && !e.passed && regular(e) && !spent.has(e) && !chainOf.has(e) && !e.silenced
      && e.behavior !== 'kamikaze' && e.position.z > TEE_Z + MARK_NEAR + 3 && e.position.z < MARK_FAR_Z;
  }

  /** Dos o tres juntos: el que más le interesa y los más cerca de él. */
  function pickChain(): Enemy[] | null {
    const pool = horde.enemies.filter(chainable).sort((a, b) => interest(b) - interest(a));
    for (const seed of pool) {
      const near = pool
        .filter((o) => o !== seed && Math.hypot(o.position.x - seed.position.x, o.position.z - seed.position.z) < CHAIN_REACH)
        .sort((a, b) => Math.hypot(a.position.x - seed.position.x, a.position.z - seed.position.z) - Math.hypot(b.position.x - seed.position.x, b.position.z - seed.position.z))
        .slice(0, 2);
      if (near.length) return [seed, ...near];
    }
    return null;
  }

  function makeChain(members: Enemy[]): void {
    if (members.length < 2) return;
    const chain: Chain = { members, links: [], rings: new Map(), until: -1, fallen: 0, broken: false };
    for (let i = 0; i + 1 < members.length; i++) chain.links.push(new LinkFx(fx));
    for (const m of members) {
      chain.rings.set(m, new ChainRingFx(fx, m));
      chainOf.set(m, chain);
    }
    chains.push(chain);
    counts.chains++;
  }

  function chainDied(chain: Chain, e: Enemy): void {
    chain.fallen++;
    const now = ctx.clock();
    if (chain.until < 0) chain.until = now + CHAIN_WINDOW;
    // la tumba cuenta lo que queda de la ventana: si no rompen la cadena a tiempo, sale
    addGrave(e.position.x, e.position.z, e.stats.kind, e.mods, Math.max(0.3, chain.until - now), { chain });
    chain.rings.get(e)?.dispose();
    chain.rings.delete(e);
    if (!chain.members.some((m) => m.alive)) chain.broken = true;
  }

  function dropChain(chain: Chain): void {
    const i = chains.indexOf(chain);
    if (i < 0) return;
    chains.splice(i, 1);
    for (const l of chain.links) l.dispose();
    for (const r of chain.rings.values()) r.dispose();
    for (const m of chain.members) chainOf.delete(m);
  }

  function updateChains(dt: number): void {
    const now = ctx.clock();
    for (const chain of [...chains]) {
      // (romper una puede matarlo a él, y ahí se sueltan todas)
      if (!chains.includes(chain)) continue;
      if (chain.broken) {
        // rota entera: no vuelve nadie, y a él le pega
        counts.broken++;
        const damage = CHAIN_DAMAGE[Math.min(3, chain.members.length)] ?? 4;
        for (const g of graves) {
          if (g.chain !== chain) continue;
          const from = new THREE.Vector3(g.x, heightAt(g.x, g.z) + 0.8, g.z);
          fx.beam(() => from, () => litter.staffTip(tmpB));
          g.at = Infinity;
        }
        dropChain(chain);
        if (boss.alive) {
          horde.damage(boss, damage, null, 0, true);
          ctx.effects.explosion(tmpA.set(boss.position.x, boss.position.y + 2.4, boss.position.z), 1.6, GREEN);
          ctx.feedback(L('¡Cadena rota!', 'Chain broken!'));
        }
        continue;
      }
      // los que se fueron sin morir (pasaron la línea, el hoyo, llegaron a la puerta) se sueltan
      for (const m of chain.members) {
        if (m.alive && !m.passed) continue;
        chain.rings.get(m)?.dispose();
        chain.rings.delete(m);
      }
      const up = chain.members.filter((m) => m.alive && !m.passed);
      if (chain.until >= 0 && now >= chain.until) {
        // no llegaron: los que cayeron vuelven (sus tumbas ya están contando) y la cadena se suelta
        counts.failed++;
        dropChain(chain);
        continue;
      }
      if (chain.until < 0 && up.length < 2) {
        dropChain(chain);
        continue;
      }
      if (chain.until >= 0 && up.length === 0) {
        chain.broken = true;
        continue;
      }
      // las cadenas, entre los que siguen en pie (con uno caído, titilan: hay que apurarse)
      const alarm = chain.until >= 0;
      let li = 0;
      for (let i = 0; i + 1 < up.length; i++) chain.links[li++].update(up[i], up[i + 1], now, alarm);
      for (; li < chain.links.length; li++) chain.links[li].update(up[0], up[0], now, false);
      for (const r of chain.rings.values()) r.update(now, alarm);
    }
    if (!boss.alive || ctx.over() || dropped > 0 || cast) return;
    if (chains.length >= MAX_CHAINS) return;
    if ((chainTimer -= dt) > 0) return;
    const group = pickChain();
    chainTimer = group ? lerp(CHAIN_EVERY, fury()) : 0.5;
    if (group) startCast(group);
  }

  // ---- los porteadores (la versión en que van aparte) ----
  const bearers: (Enemy | null)[] = [];
  const bearerKey = 'nigro-porteador';
  function bearerAt(i: number, out: THREE.Vector3): THREE.Vector3 {
    const [x, z] = BEARER_SPOTS[i];
    const h = boss.heading;
    const c = Math.cos(h);
    const s = Math.sin(h);
    // del espacio de las andas (adelante +z) al mundo, girado como ellas
    return out.set(boss.position.x + x * c + z * s, 0, boss.position.z - x * s + z * c);
  }
  function bearersUp(): number {
    return bearers.filter((b) => b?.alive).length;
  }
  function spawnBearer(i: number, rising: boolean): void {
    const p = bearerAt(i, tmpA);
    let t = rising ? 0 : RISE_TIME;
    const script: EnemyScript = {
      update(e, dt) {
        e.knock.set(0, 0, 0);
        t += dt;
        const u = Math.min(1, t / RISE_TIME);
        e.body.position.y = -(1 - u * u * (3 - 2 * u)) * e.stats.height * 0.9;
        snapBearer(e, i);
        if (speed > 0.1) e.animator.setLocomotion('Walking', speed / (1.5 * (BEARER_HEIGHT / 1.8)));
        else e.animator.setLocomotion('Idle', 1);
        return true;
      },
      onDeath: () => {
        bearers[i] = null;
        if (boss.alive && dropped <= 0 && bearersUp() <= DROP_AT) drop();
      },
    };
    const st = partStats('skeleton', { name: L('Porteador', 'Bearer'), hp: BEARER_HP, height: BEARER_HEIGHT, radius: 0.45, heavy: true, speed: 0 });
    bearers[i] = horde.spawnCustom(st, bearerKey, p.x, p.z, {}, script);
    bearers[i]!.heading = boss.heading;
    if (rising) ctx.effects.blink(p.setY(heightAt(p.x, p.z)), GREEN);
  }
  function snapBearer(e: Enemy, i: number): void {
    const p = bearerAt(i, tmpB);
    e.position.set(p.x, heightAt(p.x, p.z), p.z);
    e.heading = boss.heading;
  }
  if (cfg.bearers && addBearerLook(horde, bearerKey, ctx.dungeon)) {
    for (let i = 0; i < BEARER_SPOTS.length; i++) spawnBearer(i, false);
  }

  /** Se le caen las andas: queda en el piso, sin marcar, y cada golpe le saca uno más. */
  function drop(): void {
    dropped = DROP_TIME;
    counts.drops++;
    cast = null;
    boss.animator.playOneShot('Hard Landing', 1.2, true, 0.5);
    ctx.effects.explosion(tmpA.set(boss.position.x, boss.position.y + 0.4, boss.position.z), 2.2, 0x9a8f80);
    ctx.feedback(L('¡Se cayó! Pegale ahora', 'He fell! Hit him now'));
  }

  function updateDrop(dt: number): void {
    if (!cfg.bearers) return;
    // la tabla se ladea hacia el lado que perdió porteadores
    let left = 0;
    let right = 0;
    for (const [i, b] of bearers.entries()) if (!b?.alive) (BEARER_SPOTS[i][0] < 0 ? left++ : right++);
    const tilt = dropped > 0 ? 0 : (right - left) * TILT_PER;
    litter.tilt += (tilt - litter.tilt) * (1 - Math.exp(-6 * dt));
    if (dropped > 0) {
      litter.drop = Math.min(1.25, litter.drop + dt * 4);
      dropped -= dt;
      if (dropped <= 0 && boss.alive) {
        // se levanta, y alza a sus porteadores
        boss.animator.clearOneShot();
        litter.raise();
        for (let i = 0; i < bearers.length; i++) if (!bearers[i]?.alive) spawnBearer(i, true);
        hold = 1.2;
      }
    } else litter.drop = Math.max(0, litter.drop - dt * 2);
    // en su lugar después de que los enemigos se empujan entre sí
    for (const [i, b] of bearers.entries()) if (b?.alive) snapBearer(b, i);
  }

  // ---- alzar muertos ----
  let raiseTimer = RAISE_EVERY;
  function updateRaise(dt: number): void {
    if (!boss.alive || ctx.over() || dropped > 0 || ctx.clock() < RAISE_FROM) return;
    if ((raiseTimer -= dt) > 0) return;
    const field = horde.enemies.filter((e) => e.alive && !e.passed && regular(e)).length;
    if (field >= RAISE_BELOW) {
      raiseTimer = 1;
      return;
    }
    raiseTimer = RAISE_EVERY;
    litter.raise();
    hold = 1.4;
    const n = Math.round(lerp(RAISE_COUNT, fury()));
    for (let i = 0; i < n; i++) {
      const x = THREE.MathUtils.clamp(boss.position.x + (ctx.rng() * 2 - 1) * 9, -13, 13);
      const z = boss.position.z - 5 - ctx.rng() * 10;
      addGrave(x, z, 'skeleton', {}, RAISE_DELAY, { raised: true });
      counts.raised++;
    }
  }

  // ---- cuando muere ----
  let over = false;
  function necroDied(): void {
    if (over) return;
    over = true;
    for (const e of [...marked.keys()]) unmark(e);
    for (const c of [...chains]) dropChain(c);
    for (const g of graves) {
      g.fx.dispose();
      ctx.effects.spark(tmpA.set(g.x, heightAt(g.x, g.z) + 0.6, g.z), GREEN);
    }
    graves.length = 0;
    cast = null;
    litter.collapse();
    // los porteadores se caen con él (no hay que matarlos)
    for (const b of bearers) {
      if (!b?.alive) continue;
      ctx.effects.blink(tmpA.copy(b.position), GREEN);
      b.remove();
    }
    ctx.banner(L('¡El Nigromante cayó!', 'The Necromancer has fallen!'), L('Sus marcas se apagan', 'His marks fade away'), 2.5);
  }

  let hinted = false;
  return {
    get done() {
      return !boss.alive;
    },
    update(dt) {
      adopt();
      fx.update(dt);
      const p = ctx.player().position;
      litter.update(dt, speed, p.x, p.z);
      if (!hinted && ctx.clock() > 3.5) {
        // después del cartel de la oleada, que lo taparía
        hinted = true;
        ctx.banner(L('El Nigromante', 'The Necromancer'), cfg.hint, 4);
      }
      if (!boss.alive) return;
      // las marcas: se sueltan los que se fueron (sin morir de un golpe), los silenciados y los que pasaron
      for (const e of [...marked.keys()]) if (!e.alive || e.passed || e.silenced) unmark(e);
      const leaving = marked.size >= maxMarks ? marked.keys().next().value : null;
      for (const [e, m] of marked) m.update(dt, e === leaving);
      updateCast(dt);
      if (cfg.mode === 'marks' && !cast && dropped <= 0 && !ctx.over() && boss.position.z < MARK_FAR_Z && (markTimer -= dt) <= 0) {
        const target = pickMark();
        markTimer = target ? lerp(MARK_EVERY, fury()) : 0.4;
        if (target) startCast([target]);
      }
      if (cfg.mode === 'chains') updateChains(dt);
      updateDrop(dt);
      updateRaise(dt);
      // las tumbas: cuentan y sale el que estaba
      const now = ctx.clock();
      for (let i = graves.length - 1; i >= 0; i--) {
        const g = graves[i];
        if (g.at === Infinity) {
          g.fx.dispose();
          graves.splice(i, 1);
          continue;
        }
        g.fx.update(dt, (now - g.born) / Math.max(0.01, g.at - g.born));
        if (now < g.at || ctx.over()) continue;
        g.fx.dispose();
        graves.splice(i, 1);
        rise(g);
        if (!g.raised) counts.revived++;
        ctx.audio.casterHit();
      }
      for (const e of lastHit.keys()) if (!e.alive) lastHit.delete(e);
    },
    bot: {
      weight(e) {
        if (e === boss) return dropped > 0 ? 3 : 1.4;
        if (marked.has(e)) return cfg.revive === 'bones' ? (e.maxHp >= 4 ? 0.8 : 0.15) : 0.25;
        const chain = chainOf.get(e);
        if (chain) return chain.until >= 0 ? 6 : 1.3;
        if (bearers.includes(e)) return 1.2;
        return 1;
      },
    },
    log: () => ({
      version: `${cfg.mode}/${cfg.revive}${cfg.bearers ? '/porteadores' : ''}`, // i18n-ok: registro
      vida: Math.max(0, boss.hp), // i18n-ok: registro
      ...counts,
    }),
    dispose() {
      for (const m of marked.values()) m.dispose();
      marked.clear();
      for (const c of [...chains]) dropChain(c);
      for (const g of graves) g.fx.dispose();
      graves.length = 0;
      litter.dispose();
      fx.dispose();
    },
  };
}
