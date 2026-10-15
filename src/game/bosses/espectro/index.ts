// El espectro hechicero (14/10, idea de Leandro): pone a prueba **priorizar dentro de la ola**. No tiene
// una vida que bajar: aparece (se teletransporta) pegado a un enemigo de la horda, su huésped, unido por un
// lazo violeta, y mientras no lo desterrás le va dando cosas de a escalones (poderes, vida, cura). Si llega
// al último, el huésped se vuelve élite (la calavera: el que entra tira la puerta, el que te pisa te mata) y
// el espectro se va a buscar otro. Para desterrarlo hay que sacarle 3 cada vez que aparece (un buen
// driver de lejos, o dos o tres tiros). Prefiere huéspedes lejos de tu puesto, fuertes y que tarden en
// llegar, y cada vez vuelve antes y apura más.
//
// Las versiones (ver docs/jefes/espectro.md) cambian qué da (poderes, vida y cura, o mezcla) y cómo se
// gana (desterrarlo N veces y limpiar la ola, o solo ganar la oleada).
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Wave, WaveGroup } from '../../../core/waves';
import type { Enemy, EnemyScript } from '../../enemies';
import { BossBar, FIELD_HALF_WIDTH, fieldHalfAt, heightAt, partStats } from '../kit';
import type { BossCtx, BossDef, BossFight } from '../types';
import { give, own, type Step } from './buffs';
import { addGlow, CastPlate, GrantedBubble, HostMark, Labels, materialsOf, Tether } from './visuals';

/** Lo que hay que sacarle cada vez que aparece para desterrarlo (uno más con el golpe 4). */
const BANISH_HP = 3;
/** Veces que hay que desterrarlo, en las versiones de destierro. */
const BANISH_GOAL = 5;
/** Segundos desde que arranca la pelea hasta que aparece la primera vez. */
const FIRST_AT = 7;
/** Segundos entre que se va (desterrado, o con su élite hecho) y que vuelve: la primera vez y la última. */
const REST = [5, 3] as const;
/** En cuántas apariciones llega a lo más rápido (el descanso y el paso de cada versión). */
const RAMP = 5;
/** Segundos de aviso: el anillo que se cierra sobre el próximo huésped antes de que aparezca. */
const WARN = 1.3;
/**
 * Dónde busca huésped (z): nunca encima de la línea (`min`), y de preferencia hasta `near`: más allá queda
 * debajo de la barra de arriba, y de tan lejos ni se lo ve. Si no hay nadie más cerca, igual va al fondo
 * (si no, al que mata todo de lejos casi no le aparece).
 */
const HOST_Z = { min: 20, near: 46 };
/**
 * Si a su huésped le falta menos que esto (s) para la línea, lo suelta y se va a otro: el élite hecho
 * pegado a la línea sería una derrota sin salida.
 */
const LET_GO_ETA = 4;
/** Al elegir huésped, lo que pesa: lejos de tu puesto (de costado), mucha vida, y un poco de azar. */
const PICK = { side: 1.2, hp: 0.8, luck: 0.5, far: 1.5 };
/**
 * Dónde flota respecto del huésped (m): al costado (hacia el medio de la cancha), apenas detrás, y en el aire.
 * Al costado se le puede tirar derecho; el área del hierro que revienta en el huésped lo alcanza igual.
 */
const PERCH = { back: 0.5, side: 1.6, hover: 0.45 };
/** Sin huésped (la horda ya no está, en las de destierro): cuánto espera antes de aparecer solo, y cada cuánto salta. */
const ALONE = { wait: 4, hop: 5.5, z: [28, 42] as const, x: [4, 12] as const };
/** Cuánto crece el huésped por escalón (sobre su tamaño), sin ser élite: que se vea que se pone fuerte. */
const GROW = 0.08;
/** Cuánto más rápido corre el reloj de los escalones por cada punto de dificultad. */
const LEVEL_RUSH = 0.02;
/**
 * El bot: cuánto más le importa el espectro que un común, recién aparecido y a punto de hacer el élite (va
 * subiendo con los escalones), y el huésped al que el lazo cura sin parar.
 */
const BOT = { specter: [2.5, 6] as const, healingHost: 0.3 };
/**
 * El eterno (15/10, Leandro): no se lo destierra para siempre ni tiene una vida total; cada aparición trae
 * más vida, de `hp[0]` a `hp[1]` a lo largo de `ramp` s (lo que tarda en salir la escolta: 40 × 2.2 s), y
 * nunca más de uno por aparición (que se vea subir: 1, 2, 3...). `rest`: el descanso entre apariciones,
 * corto (siempre vuelve). `plate`: a cuánto arriba de la cabeza va su placa (vida y barra de casteo).
 */
const ETERNO = { hp: [1, 5] as const, ramp: 88, rest: [5, 3.5] as const, plate: 1.5 };
/** El espectro: lo que mide, su radio, y su violeta. */
const BODY = { height: 2.4, radius: 0.6 };
const COLOR = 0xa77bff;
const CSS = '#a77bff';

/** La escolta (sin el gólem de siempre): más larga que la de siempre, con cuerpos fuertes para huésped. */
const ESCORT: { interval: number; groups: WaveGroup[] } = {
  interval: 2.2,
  groups: [
    { kind: 'goblin', count: 10 }, { kind: 'goblina', count: 8 }, { kind: 'orc', count: 6 }, { kind: 'skeleton', count: 6 },
    { kind: 'warchief', count: 3 }, { kind: 'shaman', count: 1 }, { kind: 'knight', count: 3 }, { kind: 'stoneling', count: 2 },
    { kind: 'wraith', count: 1 },
  ],
};

interface Version {
  /** Los escalones de cada aparición, en orden: el último es el élite. */
  ladder: Step[];
  /** Segundos entre un escalón y el siguiente: la primera aparición y desde la RAMP-ésima. */
  step: readonly [number, number];
  /** Cuántas veces hay que desterrarlo para ganar; null: se gana la oleada (viene hasta que se termina). */
  goal: number | null;
  /** El lazo cura al huésped en cada escalón (pegarle al huésped mientras tanto es tirar tiros). */
  heals: boolean;
  /**
   * El eterno: sin barra de jefe; cada aparición con más vida (ETERNO), una barra de casteo sobre la cabeza
   * (matarlo antes de que se llene corta el hechizo), y vuelve mientras haya horda.
   */
  eterno?: boolean;
}

const VERSIONS: Record<string, Version> = {
  poderes: { ladder: ['power', 'power', 'elite'], step: [4.5, 3.2], goal: BANISH_GOAL, heals: false },
  vida: { ladder: ['pulse', 'pulse', 'pulse', 'pulse', 'pulse', 'elite'], step: [2.3, 1.6], goal: BANISH_GOAL, heals: true },
  mezcla: { ladder: ['hp', 'power', 'hp', 'elite'], step: [3.4, 2.4], goal: BANISH_GOAL, heals: true },
  ola: { ladder: ['hp', 'power', 'hp', 'elite'], step: [3.4, 2.4], goal: null, heals: true },
  eterno: { ladder: ['hp', 'power', 'hp', 'elite'], step: [3.6, 2.6], goal: null, heals: true, eterno: true },
};

/** Lo que va a dar el escalón `step`, para la barra de casteo (el poder todavía no se sabe cuál). */
function preview(step: Step): { label: string; color: string } {
  switch (step) {
    case 'pulse':
      return { label: L('+1 vida', '+1 HP'), color: '#6be38a' };
    case 'hp':
      return { label: L('+2 vida', '+2 HP'), color: '#6be38a' };
    case 'power':
      return { label: L('+poder', '+power'), color: '#ffd96a' };
    case 'elite':
      return { label: L('¡ÉLITE!', 'ELITE!'), color: '#ff5a5a' };
  }
}

type Phase = 'rest' | 'warn' | 'bound' | 'alone';

function escort(wave: Wave): void {
  // las marcas de olas especiales que ya pasaron (los chicos de la estampida) se quedan
  wave.groups = [...wave.groups.filter((g) => g.mark), ...ESCORT.groups.map((g) => ({ ...g }))];
  wave.interval = ESCORT.interval;
}

function start(ctx: BossCtx, v: Version): BossFight {
  const { horde, effects, audio, scene } = ctx;
  if (!horde.hasLook('espectro')) horde.addLook('espectro', ctx.dungeon.scene, ctx.dungeon.animations, 'Character_Tormented_Soul');
  const hp = BANISH_HP + (ctx.bonusHp > 0 ? 1 : 0);
  const rush = 1 + LEVEL_RUSH * ctx.level;
  const purple = new THREE.Color(COLOR);

  // el eterno no tiene barra de jefe: su vida es la de cada aparición (Leandro: «que no tenga vida propia así
  // como la barra esa, solo tiene vida cuando aparece»)
  const bar = v.eterno ? null : new BossBar(L('Espectro hechicero', 'Sorcerer Wraith'), CSS);
  const plate = v.eterno ? new CastPlate(scene, CSS) : null;
  /** La vida de la aparición de ahora (en el eterno sube de a una) y el huésped anterior (vuelve en otro). */
  let life = v.eterno ? ETERNO.hp[0] - 1 : hp;
  let lastHost: Enemy | null = null;
  /** Hechizos cortados (lo mataste con la barra de casteo a medio llenar). */
  let cut = 0;
  const tether = new Tether(scene, COLOR);
  const mark = new HostMark(scene, COLOR);
  const labels = new Labels(scene);
  const bubbles: GrantedBubble[] = [];

  let phase: Phase = 'rest';
  let timer = FIRST_AT;
  let age = 0;
  let host: Enemy | null = null;
  let hostMats: THREE.MeshStandardMaterial[] = [];
  let specter: Enemy | null = null;
  let specterMats: THREE.MeshStandardMaterial[] = [];
  /** Lo que lleva del escalón que viene (s), y hacia qué lado de su huésped flota. */
  let clock = 0;
  let side = 1;
  /** Solo: dónde flota. */
  const anchor = new THREE.Vector3();
  /** Cuánto lleva sin encontrar huésped. */
  let lonely = 0;
  let shown = false;
  // lo que cuenta el registro
  let appearances = 0;
  let banished = 0;
  let elites = 0;
  let jumps = 0;
  let steps = 0;
  let won = false;
  /** Por qué escalón va cada uno que tuvo de huésped: si vuelve a él, sigue de ahí. */
  const tier = new Map<Enemy, number>();
  /** Lo que creció cada uno: el tamaño con el que llegó (el gigante ya viene grande) y el de ahora. */
  const grown = new Map<Enemy, { base: number; now: number }>();
  /** Lo último que se escribió en la barra: se reescribe solo si cambia. */
  let barKey = '';

  const ramp = () => Math.min(1, appearances / RAMP);
  const stepTime = () => THREE.MathUtils.lerp(v.step[0], v.step[1], ramp()) / rush;
  const restTime = () => (v.eterno ? THREE.MathUtils.lerp(ETERNO.rest[0], ETERNO.rest[1], ramp()) : THREE.MathUtils.lerp(REST[0], REST[1], ramp()));

  /** La vida de la próxima aparición del eterno: sigue al reloj de la escolta, pero sube de a una. */
  function nextLife(): number {
    const u = Math.min(1, ctx.clock() / ETERNO.ramp);
    const want = Math.round(THREE.MathUtils.lerp(ETERNO.hp[0], ETERNO.hp[1], u));
    return THREE.MathUtils.clamp(want, life, life + 1);
  }

  /** ¿Sirve de huésped? Los que caminan a la puerta (y el chamán), en la cancha, sin ser élite ni jefe. */
  function canHost(e: Enemy): boolean {
    return e.alive && !e.passed && e !== specter && !e.script && !e.stats.boss && e.size <= 1 && !e.mods.apart
      && (e.behavior === 'melee' || e.behavior === 'shaman')
      && e.position.z >= HOST_Z.min;
  }

  /** Lo que le falta a `e` para la línea (s); a los que no van para ahí, mucho. */
  const eta = (e: Enemy) => Math.min(99, e.lineEta());

  /** El mejor huésped: lejos de tu puesto, con vida, y que no llegue a la línea antes de hacerse élite. */
  function pick(except: Enemy | null): Enemy | null {
    const px = ctx.player().position.x;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of horde.enemies) {
      if (e === except || !canHost(e)) continue;
      const left = eta(e);
      if (left < LET_GO_ETA + 2) continue;
      const need = (v.ladder.length - (tier.get(e) ?? 0)) * stepTime() + 2;
      let score = (Math.abs(e.position.x - px) / FIELD_HALF_WIDTH) * PICK.side + Math.min(1, e.maxHp / 10) * PICK.hp + ctx.rng() * PICK.luck;
      // llegaría antes de hacerse élite: sirve menos (igual lo pone fuerte)
      if (left < need) score -= 1;
      if (e.position.z > HOST_Z.near) score -= PICK.far;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  /** Dónde flota junto a su huésped (o solo, en su lugar). */
  function perch(out: THREE.Vector3): THREE.Vector3 {
    if (!host) return out.copy(anchor);
    const x = host.position.x + side * (PERCH.side + host.radius);
    const z = host.position.z + PERCH.back;
    const half = fieldHalfAt(z) - 1;
    return out.set(THREE.MathUtils.clamp(x, -half, half), 0, z);
  }

  const spot = new THREE.Vector3();
  const script: EnemyScript = {
    update(e, dt) {
      // nada lo empuja: flota donde quiere (el viento, el palazo y los demás no lo mueven)
      e.knock.set(0, 0, 0);
      perch(spot);
      const k = 1 - Math.exp(-9 * dt);
      e.position.x += (spot.x - e.position.x) * k;
      e.position.z += (spot.z - e.position.z) * k;
      e.position.y = heightAt(e.position.x, e.position.z);
      e.body.position.y = PERCH.hover + 0.15 * Math.sin(age * 2.3);
      if (host) e.faceToward(host.position.x, host.position.z, dt);
      else e.faceToward(ctx.player().position.x, ctx.player().position.z, dt, 3);
      e.animator.setLocomotion('Idle', 0.7);
      // con huésped, los brazos al frente, hacia él (el agarre del alma en pena: está canalizando)
      e.scriptGesture = host && !e.silenced && !e.frozen ? 1 : 0;
      e.scriptSwing = null;
      return true;
    },
    onDeath(e) {
      banish(e);
    },
  };

  /** Aparece junto a su huésped (o solo, en `anchor`). */
  function appear(): void {
    perch(spot);
    if (v.eterno) life = nextLife();
    const full = v.eterno ? life + (ctx.bonusHp > 0 ? 1 : 0) : hp;
    const e = horde.spawnCustom(
      partStats('wraith', { name: L('Espectro hechicero', 'Sorcerer Wraith'), hp: full, height: BODY.height, radius: BODY.radius, speed: 0, runs: false, damage: 0, gateDamage: 0, score: 60 }),
      'espectro', spot.x, spot.z, { apart: true }, script,
    );
    // traslúcido, como un alma: se ve el huésped a través
    specterMats = materialsOf(e);
    for (const m of specterMats) {
      m.transparent = true;
      m.opacity = 0.82;
    }
    specter = e;
    appearances++;
    lonely = 0;
    effects.blink(spot.clone(), COLOR);
    audio.casterCast();
    if (!shown && v.eterno) {
      shown = true;
      ctx.banner(L('¡El espectro hechicero!', 'The Sorcerer Wraith!'), L('Matalo antes de que llene su barra · vuelve con más vida', 'Kill it before its bar fills · it comes back stronger'), 3);
    } else if (!shown) {
      shown = true;
      ctx.banner(L('¡El espectro hechicero!', 'The Sorcerer Wraith!'), L(`Sacale ${hp} antes de que haga un élite`, `Deal ${hp} before it makes an elite`), 3);
    }
  }

  /** Se va sin que lo destierres (hizo su élite, o se quedó sin huésped): no cuenta. */
  function leave(): void {
    if (specter) {
      effects.blink(specter.position.clone(), COLOR);
      if (specter.alive) specter.remove();
    }
    specter = null;
    unbind();
    phase = 'rest';
    timer = restTime();
  }

  /** Lo desterraste: le sacaste lo suyo. */
  function banish(e: Enemy): void {
    if (e !== specter) return;
    banished++;
    // el eterno: si tenía el hechizo a medio hacer, se corta (lo que iba a dar no sale)
    const midCast = !!v.eterno && host !== null && phase === 'bound' && clock > 0.05;
    if (midCast) cut++;
    const at = e.position.clone();
    effects.blink(at, COLOR);
    effects.explosion(at.clone().setY(at.y + 1.4), 1.6, COLOR);
    e.remove();
    specter = null;
    unbind();
    phase = 'rest';
    timer = restTime();
    if (v.goal !== null && banished >= v.goal) {
      won = true;
      ctx.banner(L('¡Espectro desterrado!', 'Wraith banished!'), L('Ahora, el resto de la horda', 'Now, the rest of the horde'), 2.5);
    } else if (v.eterno) ctx.feedback(midCast ? L('¡Hechizo cortado!', 'Spell broken!') : L('¡Se esfumó!', 'Vanished!'));
    else ctx.feedback(L('¡Desterrado!', 'Banished!'));
  }

  function bind(e: Enemy): void {
    host = e;
    hostMats = materialsOf(e);
    // flota del lado del medio de la cancha (en el borde, afuera no hay lugar)
    side = Math.abs(e.position.x) > 1 ? -Math.sign(e.position.x) : ctx.rng() < 0.5 ? -1 : 1;
  }

  function unbind(): void {
    if (host) lastHost = host;
    plate?.hide();
    host = null;
    hostMats = [];
    tether.hide();
    mark.hide();
  }

  /** El huésped sube un escalón. Devuelve true si fue el último (el élite). */
  function levelUp(e: Enemy): boolean {
    const t = tier.get(e) ?? 0;
    const step = v.ladder[Math.min(t, v.ladder.length - 1)];
    const got = give(e, step, horde, ctx.rng);
    tier.set(e, t + 1);
    steps++;
    if (got.what === 'divine') bubbles.push(new GrantedBubble(e));
    const top = e.position.clone().setY(e.position.y + e.height + 1);
    labels.add(top, got.label, got.color, got.what === 'elite');
    effects.blink(e.position.clone(), COLOR);
    if (got.what === 'elite') {
      elites++;
      audio.eliteAlert();
      ctx.feedback(L('¡El espectro hizo un élite!', 'The wraith made an elite!'));
      return true;
    }
    if (got.what === 'hp' || got.what === 'regen') audio.heal();
    else if (got.what === 'divine') audio.bubbleUp();
    else audio.zap();
    return false;
  }

  /** Su huésped ya no sirve: se pasa a otro (con el mismo daño encima), o se va si no hay. */
  function jump(): void {
    const next = pick(host);
    if (!next || !specter) {
      leave();
      return;
    }
    effects.blink(specter.position.clone(), COLOR);
    bind(next);
    perch(spot);
    specter.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
    effects.blink(spot.clone(), COLOR);
    audio.casterCast();
    jumps++;
  }

  /** Un lugar lejos de tu puesto, en el fondo, para flotar solo. */
  function lonelySpot(): void {
    const px = ctx.player().position.x;
    const sign = px > 0 ? -1 : px < 0 ? 1 : ctx.rng() < 0.5 ? -1 : 1;
    const z = THREE.MathUtils.lerp(ALONE.z[0], ALONE.z[1], ctx.rng());
    const x = sign * THREE.MathUtils.lerp(ALONE.x[0], ALONE.x[1], ctx.rng());
    const half = fieldHalfAt(z) - 1.5;
    anchor.set(THREE.MathUtils.clamp(x, -half, half), 0, z);
  }

  /** El huésped crece de a poco con sus escalones (hasta que es élite: ahí lo agranda el élite). */
  function grow(dt: number): void {
    for (const [e, t] of tier) {
      if (!e.alive) {
        tier.delete(e);
        grown.delete(e);
        continue;
      }
      if (e.size > 1) continue;
      let g = grown.get(e);
      if (!g) grown.set(e, (g = { base: e.mods.giant ?? 1, now: e.mods.giant ?? 1 }));
      const want = g.base * (1 + GROW * t);
      if (Math.abs(want - g.now) < 0.001) continue;
      g.now += (want - g.now) * (1 - Math.exp(-4 * dt));
      own(e, horde).giant = g.now;
    }
  }

  function updateBar(): void {
    if (!bar) return;
    const s = specter?.alive ? specter.hp : 0;
    let value: number;
    let max: number;
    let sub: string;
    if (v.goal !== null) {
      const count = L(`desterrado ${banished} de ${v.goal}`, `banished ${banished} of ${v.goal}`);
      value = v.goal - banished;
      max = v.goal;
      if (won) sub = L('Desterrado. Ahora, la horda', 'Banished. Now, the horde');
      else if (phase === 'bound' || phase === 'alone') sub = L(`Sacale ${s} para desterrarlo · ${count}`, `Deal ${s} to banish it · ${count}`);
      else if (phase === 'warn') sub = L(`¡Aparece! · ${count}`, `Appearing! · ${count}`);
      else sub = count;
    } else {
      value = s;
      max = hp;
      sub = phase === 'warn' ? L('¡Aparece!', 'Appearing!') : L(`Ganá la oleada · desterrado ${banished} · élites ${elites}`, `Win the wave · banished ${banished} · elites ${elites}`);
    }
    const key = `${value}/${max}/${sub}`;
    if (key === barKey) return;
    barKey = key;
    bar.set(value, max, sub);
  }

  return {
    get done() {
      return v.goal === null || won;
    },
    update(dt) {
      age += dt;
      labels.update(dt);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        if (bubbles[i].update(dt)) continue;
        bubbles[i].dispose();
        bubbles.splice(i, 1);
      }
      grow(dt);
      // el espectro murió por otro lado (el hoyo no llama a onDeath)
      if (specter && !specter.alive && specter.state !== 'gone') banish(specter);
      if (won || ctx.over()) {
        if (specter) leave();
        tether.hide();
        mark.hide();
        updateBar();
        return;
      }

      switch (phase) {
        case 'rest': {
          timer -= dt;
          if (timer > 0) break;
          // el eterno vuelve en otro (si hay otro)
          const next = (v.eterno ? pick(lastHost) : null) ?? pick(null);
          if (next) {
            bind(next);
            phase = 'warn';
            timer = WARN;
            break;
          }
          // nadie le sirve: espera; en las de destierro, si ya no queda horda, aparece solo
          lonely += dt;
          if (v.goal !== null && lonely >= ALONE.wait && !horde.enemies.some((e) => e.alive && !e.passed && e !== specter && !e.mods.apart)) {
            lonelySpot();
            phase = 'alone';
            timer = ALONE.hop;
            appear();
          }
          break;
        }
        case 'warn': {
          if (!host || !canHost(host)) {
            unbind();
            phase = 'rest';
            timer = 0;
            break;
          }
          timer -= dt;
          mark.warn(host, 1 - Math.max(0, timer) / WARN, age);
          if (timer <= 0) {
            phase = 'bound';
            clock = 0;
            appear();
          }
          break;
        }
        case 'bound': {
          if (!specter) break;
          if (!host || !host.alive || host.passed || eta(host) < LET_GO_ETA) {
            jump();
            if (phase !== 'bound') break;
          }
          const h = host!;
          // silenciado o congelado, no da nada: el reloj se queda quieto
          const paused = specter.silenced || specter.frozen;
          if (!paused) clock += dt;
          const step = stepTime();
          if (clock >= step) {
            clock -= step;
            if (levelUp(h)) {
              leave();
              break;
            }
          }
          const t = tier.get(h) ?? 0;
          const pulse = 0.5 + 0.5 * Math.sin(age * (4 + 6 * (clock / step)));
          mark.bound(h, clock / step, pulse);
          const from = specter.position.clone().setY(specter.position.y + PERCH.hover + specter.height * 0.55).addScaledVector(specter.facing, 0.45);
          const to = h.position.clone().setY(h.position.y + h.height * 0.55);
          tether.update(from, to, 0.05 + 0.025 * t, dt, paused);
          addGlow(hostMats, purple, (0.18 + 0.1 * t) * (0.7 + 0.3 * pulse));
          if (plate) {
            const what = preview(v.ladder[Math.min(t, v.ladder.length - 1)]);
            const at = specter.position.clone().setY(specter.position.y + PERCH.hover + specter.height + ETERNO.plate);
            plate.show(at, specter.hp, specter.maxHp, clock / step, what.label, what.color, paused);
          }
          break;
        }
        case 'alone': {
          if (!specter) break;
          // si vuelve a haber horda, se le pega a alguno
          const next = pick(null);
          if (next) {
            bind(next);
            phase = 'bound';
            clock = 0;
            perch(spot);
            effects.blink(specter.position.clone(), COLOR);
            specter.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
            effects.blink(spot.clone(), COLOR);
            break;
          }
          timer -= dt;
          if (timer <= 0) {
            // salta a otro lugar lejos de vos
            effects.blink(specter.position.clone(), COLOR);
            lonelySpot();
            specter.position.set(anchor.x, heightAt(anchor.x, anchor.z), anchor.z);
            effects.blink(anchor.clone(), COLOR);
            audio.casterCast();
            timer = ALONE.hop;
          }
          mark.alone(specter.position.x, specter.position.z, age);
          break;
        }
      }
      if (specter?.alive) addGlow(specterMats, purple, 0.35 + 0.15 * Math.sin(age * 3));
      updateBar();
    },
    bot: {
      weight(e) {
        if (e === specter) {
          if (!host) return BOT.specter[0];
          const done = ((tier.get(host) ?? 0) + clock / stepTime()) / v.ladder.length;
          return THREE.MathUtils.lerp(BOT.specter[0], BOT.specter[1], Math.min(1, done));
        }
        // al que el lazo cura entero en cada escalón, pegarle es perder el tiro
        if (v.heals && e === host && phase === 'bound') return BOT.healingHost;
        return 1;
      },
    },
    log: (): Record<string, number | string> => (v.eterno
      ? { apariciones: appearances, muertes: banished, cortados: cut, elites, saltos: jumps, escalones: steps, vida: life, meta: 'eterno' } // i18n-ok: el registro
      : { apariciones: appearances, desterrados: banished, elites, saltos: jumps, escalones: steps, meta: v.goal ?? 'ola' }), // i18n-ok: el registro
    dispose() {
      if (specter?.alive) specter.remove();
      bar?.dispose();
      plate?.dispose();
      tether.dispose();
      mark.dispose();
      labels.dispose();
      for (const b of bubbles) b.dispose();
    },
  };
}

const NAME = L('Espectro hechicero', 'Sorcerer Wraith');

export const BOSSES: BossDef[] = [
  {
    id: 'espectro.poderes',
    name: NAME,
    blurb: 'Se pega a uno de la horda y le da poderes (blindaje, bendito, esquiva, se cura) y al final lo hace élite. Ganás desterrándolo 5 veces (3 de daño cada una) y limpiando la ola.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, VERSIONS.poderes),
  },
  {
    id: 'espectro.vida',
    name: NAME,
    blurb: 'Se pega a uno y cada 2 s le da +1 de vida y lo cura entero (pegarle al huésped no sirve); al final lo hace élite. Ganás desterrándolo 5 veces.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, VERSIONS.vida),
  },
  {
    id: 'espectro.mezcla',
    name: NAME,
    blurb: 'Vida y poderes alternados (+2 vida y cura, un poder, +2 vida, élite). Ganás desterrándolo 5 veces.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, VERSIONS.mezcla),
  },
  {
    id: 'espectro.ola',
    name: NAME,
    blurb: 'Como la mezcla, pero se gana la oleada: el espectro viene hasta que se acaba; desterrarlo solo evita los élites.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, VERSIONS.ola),
  },
  {
    id: 'espectro.eterno',
    name: NAME,
    blurb: 'No muere ni tiene barra de jefe: aparece junto a uno con 1 de vida, después 2... hasta 5 al final de la escolta, y castea (barra sobre la cabeza): +2 vida, un poder, +2 vida, élite. Matarlo corta el hechizo; vuelve en otro mientras haya horda.', // i18n-ok: el panel de pruebas
    escort,
    start: (ctx) => start(ctx, VERSIONS.eterno),
  },
];
