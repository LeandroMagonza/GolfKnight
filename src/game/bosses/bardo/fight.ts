// La pelea con el bardo (15/10, idea de Leandro: «un guitarrista de metal, que va tocando y tirándote
// poderes, y solo podés pegarle si soltás la pelota en un beat»). Ver docs/jefes/bardo.md.
//
// - **La regla:** mientras toca, todo tiro soltado fuera del beat sale pifia (contra él y contra la
//   escolta). El beat es el de su canción (songs/bardo.ts): la campana del ride en cada negra, y el anillo
//   a tus pies que se cierra y se prende dorado en la ventana. Las habilidades no tienen ritmo: entran igual.
// - **El tempo sube solo** (no por pifiar): 100, 130 y 160 por minuto, por la vida que le queda o por el
//   tiempo, lo que llegue antes. La ventana se achica un poco al acelerar.
// - **Lo que tira, al ritmo:** al empezar un compás marca tu puesto (acorde de poder: cae 4 beats después,
//   en el próximo «uno»; te corrés) o suelta notas malditas que van saltando de a un beat hacia la puerta
//   (se les pega, en el beat). Cada 8 compases se cambia de lugar en el escenario.
// - **Castigo por pifiar:** cada 3 pifias le da pie al acople: una franja roja hasta la puerta, 4 beats de
//   aviso con los amplificadores en rojo, y le saca 2 a la puerta.
// - **El contrajuego:** un golpe perfecto (golpe 3), en el beat, le corta lo que esté cargando (el acorde
//   y el acople) y lo deja un compás sin tocar.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Beat } from '../../../audio/music/beat';
import type { Enemy, EnemyScript, Horde } from '../../enemies';
import { BossBar, GATE_Z, GroundMark, LaneMark, heightAt, nearestSpot, partStats, TEE_Z } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { addBardLook, addDrumShotLook, addNoteLook, addOgreLook, Amps, BARD_LOOK, DRUM_SHOT_LOOK, NOTE_LOOK, OGRE_LOOK, ORANGE, RED, Rig } from './look';
import { Anillo, beatPhase, Pulso, type Fuente } from './pulso';

export interface BardoOpts {
  /** La canción que pone (con su grilla de pulsos). */
  song: string;
  /** El tempo de cada fase. */
  tempos: readonly number[];
  /** La ventana de cada fase: cuánto antes o después del beat vale soltar (s). */
  windows: readonly number[];
  hp: number;
  name: string;
  /** Cómo se ve y cómo se llama lo que tira (ver ESTILOS). */
  estilo: keyof typeof ESTILOS;
}

/** Lo que cambia de un músico al otro: el cuerpo, lo que lleva, el color, lo que tira, los carteles. */
const ESTILOS = {
  metal: {
    look: BARD_LOOK,
    kind: 'skeleton',
    add: (h: Horde, ctx: BossCtx) => {
      addBardLook(h, ctx.dungeon);
      addNoteLook(h);
    },
    prop: 'guitarra',
    color: RED,
    bar: '#c8203a',
    amps: true,
    shotLook: NOTE_LOOK,
    shotName: () => L('Nota maldita', 'Cursed note'),
    cut: () => L('¡Le cortaste el solo!', 'Solo cut!'),
    punish: () => L('acople', 'feedback'),
    punishNow: () => L('¡Acople! Cortalo con un golpe perfecto', 'Feedback! Cut it with a perfect hit'),
  },
  tambor: {
    look: OGRE_LOOK,
    kind: 'ogre',
    add: (h: Horde, ctx: BossCtx) => {
      addOgreLook(h, ctx.dungeon);
      addDrumShotLook(h);
    },
    prop: 'tambor',
    color: ORANGE,
    bar: '#d2691e',
    amps: false,
    shotLook: DRUM_SHOT_LOOK,
    shotName: () => L('Tamborcito', 'Little drum'),
    cut: () => L('¡Le cortaste el redoble!', 'Drum roll cut!'),
    punish: () => L('redoble', 'drum roll'),
    punishNow: () => L('¡Redoble a la puerta! Cortalo con un golpe perfecto', 'Drum roll at the gate! Cut it with a perfect hit'),
  },
} as const;

/**
 * Dónde toca: el escenario a media cancha (no más lejos: la barra del jefe tapa el fondo), con dos torres
 * de amplificadores a los costados, detrás (en el medio taparían a la horda que viene).
 */
const STAGE_Z = 28;
const STAGE_XS = [-6.5, 0, 6.5];
const AMPS_Z = 32;
const AMPS_XS = [-11.5, 11.5];
const ENTRY_Z = 46;
const WALK_SPEED = 3;
/** Vida por nivel de dificultad. */
const HP_PER_LEVEL = 2;
/** La ventana de los primeros compases, para agarrarle la mano. */
const FIRST_WINDOW = 0.15;
const FIRST_BARS = 2;
/** La fase por tiempo (s desde que empieza a tocar), si la vida no la apuró antes. */
const PHASE_BY_TIME = [0, 55, 105];
/** Pifias que le dan pie al acople, y lo que le saca a la puerta. */
const ACOPLE_AT = 3;
const ACOPLE_DAMAGE = 2;
/** El acorde: radio de lo que pega (en x, sobre la línea de los puestos). */
const CHORD_REACH = 1.8;
/** Notas por tanda en cada fase, y en cuántos saltos (uno por beat) llegan a la puerta. */
const NOTES = [1, 1, 2];
const NOTE_HOPS = 12;
/** Lo alto de cada salto (bajito: la pelota les tiene que poder pegar). */
const NOTE_ARC = 0.8;
const NOTE_HP = 1;
/** Golpe que corta lo que carga (el perfecto). */
const CUT_QUALITY = 3;

interface Chord {
  x: number;
  left: number;
  disc: GroundMark;
  ring: GroundMark;
}

interface Note {
  e: Enemy;
  lane: LaneMark;
  from: THREE.Vector3;
  to: THREE.Vector3;
  hop: number;
  hopT: number;
  hopLen: number;
  /** Dónde arranca y termina el salto de ahora. */
  a: THREE.Vector3;
  b: THREE.Vector3;
}

/**
 * El brazo del rasgueo (el `scriptSwing` del enemigo) a `f` del beat (0 recién pasó, 1 el próximo): sube
 * hasta arriba, espera, y baja de golpe para pegar justo en el beat.
 */
function strum(f: number): number {
  if (f < 0.6) return 0.75 * (f / 0.6);
  if (f < 0.8) return 0.75 + 0.25 * ((f - 0.6) / 0.2);
  return 1 + 0.25 * ((f - 0.8) / 0.2);
}

export function startBardo(ctx: BossCtx, o: BardoOpts): BossFight {
  const { horde, scene } = ctx;
  const st = ESTILOS[o.estilo];
  st.add(horde, ctx);
  const COLOR = st.color;
  const maxHp = o.hp + ctx.bonusHp + Math.round(ctx.level * HP_PER_LEVEL);
  const pulso = new Pulso(ctx, o.song, o.tempos[0]);
  const ring = new Anillo(scene);
  const amps = st.amps ? new Amps(scene, AMPS_XS, AMPS_Z) : null;
  const bar = new BossBar(o.name, st.bar);
  ctx.audio.music.force(o.song);

  const chords: Chord[] = [];
  const notes: Note[] = [];
  let acople: { left: number; lane: LaneMark; x: number } | null = null;
  /** Arriba del escenario y tocando: desde ahí vale la regla. */
  let show = false;
  let showT = 0;
  let phase = 0;
  let bars = 0;
  let stunBars = 0;
  let spot = 1;
  let goal: { x: number; z: number } | null = { x: 0, z: STAGE_Z };
  let pifias = 0;
  let fuente: Fuente = 'juego';
  let lastBeatT = -Infinity;
  let musicOff = false;
  let pulse = 0;
  const stats = {
    enBeat: 0, pifias: 0, offMs: 0, tempranas: 0, tardias: 0, acordes: 0, acordesPegaron: 0, cortes: 0,
    notas: 0, notasPuerta: 0, notasBajadas: 0, acoples: 0, beatsAudio: 0, beatsJuego: 0,
  };

  // ---- el cuerpo ----
  const script: EnemyScript = {
    update(e, dt) {
      e.knock.set(0, 0, 0);
      if (goal) {
        if (e.walkToward(goal.x, goal.z, WALK_SPEED, dt)) {
          goal = null;
          if (!show) startShow();
        }
      } else {
        e.animator.setLocomotion('Idle', 1);
        e.faceToward(e.position.x, GATE_Z, dt);
      }
      // rasguea en cada beat: el brazo sube y baja de golpe justo en el beat (el molino del metal)
      const playing = show && stunBars === 0;
      e.scriptGesture = playing || !show ? 1 : 0;
      const { grid, now } = pulso.current();
      const f = beatPhase(grid, now).f;
      e.scriptSwing = strum(f);
      return true;
    },
    filter(_e, amount, shot) {
      // afinando (mientras sube al escenario) no le entra nada: la pelea es al ritmo
      if (!show) return 0;
      // el golpe perfecto (en el beat: los otros ni salen) le corta lo que carga
      if (shot && !shot.ability && shot.quality >= CUT_QUALITY && (chords.length || acople)) cut();
      return amount;
    },
    onDeath() {
      for (const n of notes) if (n.e.alive) {
        ctx.effects.explosion(n.e.position.clone().setY(0.8), 1, COLOR);
        n.e.remove();
      }
      clearChords();
      clearAcople();
      stopMusic();
      ring.show(false);
    },
  };
  const boss = horde.spawnCustom(partStats(st.kind, {
    name: o.name, hp: maxHp, height: 4, radius: 1.3, boss: true, heavy: true, speed: WALK_SPEED, score: 500,
  }), st.look, 0, ENTRY_Z, {}, script);
  boss.heading = Math.PI;
  const rig = new Rig(boss, scene, st.prop, COLOR);

  function stopMusic(): void {
    if (musicOff) return;
    musicOff = true;
    ctx.audio.music.force(null);
  }

  function startShow(): void {
    show = true;
    showT = 0;
    bars = 0;
    ring.show(true);
    ctx.banner(L('¡Soltá en el beat!', 'Release on the beat!'), L('Fuera del ritmo, pifia. El anillo a tus pies marca cuándo.', 'Off the beat, you whiff. The ring at your feet shows when.'), 4);
  }

  const windowNow = () => (bars < FIRST_BARS ? FIRST_WINDOW : o.windows[Math.min(phase, o.windows.length - 1)]);
  const ruleOn = () => show && boss.alive && !ctx.over();

  // ---- lo que tira ----

  function clearChords(): void {
    for (const c of chords) {
      c.disc.dispose();
      c.ring.dispose();
    }
    chords.length = 0;
  }
  function clearAcople(): void {
    acople?.lane.dispose();
    acople = null;
  }

  /** Le cortaron lo que cargaba: un compás sin tocar. */
  function cut(): void {
    stats.cortes++;
    clearChords();
    clearAcople();
    // (sin stunFor: a las partes de jefe el juego no les descuenta el aturdido, ver docs/jefes/ritmo.md)
    stunBars = 1;
    ctx.effects.explosion(boss.position.clone().setY(2.4), 1.6, 0xffd36a);
    ctx.feedback(st.cut());
  }

  /** Marca el puesto `x`: cae en 4 beats. */
  function chordAt(x: number): void {
    if (chords.some((c) => Math.abs(c.x - x) < 0.5)) return;
    stats.acordes++;
    const disc = new GroundMark(scene, COLOR, true, CHORD_REACH).at(x, TEE_Z).opacity(0.18);
    const r = new GroundMark(scene, COLOR, false, CHORD_REACH * 2).at(x, TEE_Z).opacity(0.7);
    chords.push({ x, left: 4, disc, ring: r });
  }

  function strike(c: Chord): void {
    const pos = new THREE.Vector3(c.x, heightAt(c.x, TEE_Z), TEE_Z);
    ctx.effects.lightning(new THREE.Vector3(c.x, 16, TEE_Z + 2), pos.clone().setY(pos.y + 0.2));
    ctx.effects.explosion(pos.clone().setY(pos.y + 0.4), CHORD_REACH, COLOR);
    ctx.audio.explosion(true);
    const p = ctx.player();
    if (p.alive && Math.abs(p.position.x - c.x) < CHORD_REACH && Math.abs(p.position.z - TEE_Z) < 2.5) {
      if (!p.invulnerable) stats.acordesPegaron++;
      ctx.hitPlayer(1, pos, boss);
    }
  }

  function volley(): void {
    const n = NOTES[Math.min(phase, NOTES.length - 1)];
    for (let i = 0; i < n; i++) {
      const side = n === 1 ? (ctx.rng() < 0.5 ? -1 : 1) : i === 0 ? -1 : 1;
      const from = new THREE.Vector3(boss.position.x + side * 1.8, 0, boss.position.z - 1.5);
      const tx = THREE.MathUtils.clamp(from.x * 0.35 + (ctx.rng() * 2 - 1) * 2.2, -2.4, 2.4);
      const to = new THREE.Vector3(tx, 0, GATE_Z + 0.8);
      const lane = new LaneMark(scene, COLOR, 1.1).between(from.x, from.z, to.x, to.z).opacity(0.22);
      const e = horde.spawnCustom(partStats('goblin', { name: st.shotName(), hp: NOTE_HP, height: 1.5, radius: 0.6, speed: 0, gateDamage: 1, score: 5 }), st.shotLook, from.x, from.z, {}, noteScript);
      notes.push({ e, lane, from, to, hop: 0, hopT: 0, hopLen: 0.5, a: from.clone(), b: from.clone() });
      stats.notas++;
    }
  }

  const noteScript: EnemyScript = {
    update(e, dt) {
      e.knock.set(0, 0, 0);
      const n = notes.find((x) => x.e === e);
      if (!n) return true;
      n.hopT += dt;
      const u = Math.min(1, n.hopT / n.hopLen);
      e.position.lerpVectors(n.a, n.b, u);
      e.position.y = heightAt(e.position.x, e.position.z) + Math.sin(Math.PI * u) * NOTE_ARC;
      e.heading = Math.PI;
      if (n.hop >= NOTE_HOPS && u >= 1) {
        stats.notasPuerta++;
        ctx.hitGate(1, e);
        ctx.effects.explosion(e.position.clone().setY(0.8), 1.2, COLOR);
        e.remove();
      }
      return true;
    },
    onDeath(e) {
      stats.notasBajadas++;
      ctx.effects.explosion(e.position.clone().setY(0.8), 1, COLOR);
      e.remove();
    },
  };

  function startAcople(): void {
    pifias -= ACOPLE_AT;
    stats.acoples++;
    const x = boss.position.x;
    const lane = new LaneMark(scene, COLOR, 2.2).between(x, boss.position.z - 1.5, 0, GATE_Z + 0.5).opacity(0.35);
    acople = { left: 4, lane, x };
    ctx.feedback(st.punishNow());
  }

  function fireAcople(): void {
    if (!acople) return;
    const from = new THREE.Vector3(acople.x, 2.5, boss.position.z - 1.5);
    const to = new THREE.Vector3(0, 1.2, GATE_Z + 0.5);
    ctx.effects.lightning(from, to);
    ctx.effects.explosion(to, 2.2, COLOR);
    ctx.hitGate(ACOPLE_DAMAGE, boss);
    clearAcople();
  }

  // ---- el ritmo ----

  function onBeat(b: Beat): void {
    const strong = b.n % 4 === 0;
    amps?.beat(strong);
    ring.beat(strong);
    pulse = 1;
    if (!ruleOn()) return;
    const len = 60 / b.bpm;
    // lo que cuenta beats: los acordes, el acople, los saltos de las notas
    for (let i = chords.length - 1; i >= 0; i--) {
      const c = chords[i];
      c.left--;
      if (c.left <= 0) {
        strike(c);
        c.disc.dispose();
        c.ring.dispose();
        chords.splice(i, 1);
      }
    }
    if (acople && --acople.left <= 0) fireAcople();
    for (const n of notes) {
      if (!n.e.alive || n.hop >= NOTE_HOPS) continue;
      n.hop++;
      n.a.copy(n.e.position).setY(0);
      n.b.lerpVectors(n.from, n.to, n.hop / NOTE_HOPS);
      n.hopT = 0;
      n.hopLen = len * 0.9;
    }
    if (strong) onBar();
  }

  function onBar(): void {
    bars++;
    if (stunBars > 0) {
      stunBars--;
      return;
    }
    // cada 8 compases se cambia de lugar en el escenario (sigue tocando mientras camina)
    if (bars % 8 === 0) {
      const options = [0, 1, 2].filter((i) => i !== spot);
      spot = options[Math.floor(ctx.rng() * options.length)];
      goal = { x: STAGE_XS[spot], z: STAGE_Z };
    }
    if (pifias >= ACOPLE_AT && !acople) {
      startAcople();
      return;
    }
    // el primer compás es para agarrarle el ritmo
    if (bars <= 1) return;
    const k = bars % 4;
    if (k === 1) {
      // el acorde: tu puesto (y en las fases rápidas, uno de al lado también)
      const spots = ctx.spots();
      const mine = nearestSpot(ctx, ctx.player().position.x);
      chordAt(spots[mine]);
      if (phase >= 1) {
        const near = [mine - 1, mine + 1].filter((i) => i >= 0 && i < spots.length);
        chordAt(spots[near[Math.floor(ctx.rng() * near.length)]]);
      }
    } else if (k === 3) volley();
  }

  /** Los beats que pasaron desde el último cuadro (en el reloj que vale). */
  function tickBeats(): void {
    const { grid, now, fuente: f } = pulso.current();
    if (f !== fuente) {
      // cambió de reloj (entró la canción, o se cortó): sigue desde el beat de ahora, sin repetir
      fuente = f;
      lastBeatT = grid.prev(now)?.t ?? now;
      return;
    }
    for (let guard = 0; guard < 8; guard++) {
      const b = grid.next(lastBeatT);
      if (!b || b.t > now) break;
      lastBeatT = b.t;
      if (f === 'audio') stats.beatsAudio++;
      else stats.beatsJuego++;
      onBeat(b);
    }
  }

  function updatePhase(): void {
    let p = boss.hp / maxHp > 2 / 3 ? 0 : boss.hp / maxHp > 1 / 3 ? 1 : 2;
    for (let i = PHASE_BY_TIME.length - 1; i > 0; i--) if (showT >= PHASE_BY_TIME[i]) {
      p = Math.max(p, i);
      break;
    }
    p = Math.min(p, o.tempos.length - 1);
    if (p <= phase) return;
    phase = p;
    pulso.ask(o.tempos[p], p);
    ctx.banner(L('¡Más rápido!', 'Faster!'), `♩ = ${o.tempos[p]}`, 2.5); // i18n-ok: el número del tempo
  }

  pulso.ask(o.tempos[0], 0);

  return {
    get done() {
      return !boss.alive;
    },
    update(dt) {
      pulso.update(dt);
      if (show) showT += dt;
      if (boss.alive) updatePhase();
      tickBeats();
      pulse = Math.max(0, pulse - dt * 4);
      rig.update(pulse);
      // las marcas de los acordes: el aro se cierra de a un beat (4, 3, 2, 1) y el disco se llena
      for (const c of chords) {
        c.ring.size(CHORD_REACH * (1 + 0.25 * c.left)).opacity(0.5 + 0.4 * pulse);
        c.disc.opacity(0.18 + 0.12 * (4 - c.left) + 0.15 * pulse);
      }
      if (acople) acople.lane.opacity(0.3 + 0.45 * pulse);
      amps?.update(dt, acople ? 0.5 + 0.5 * pulse : 0);
      for (let i = notes.length - 1; i >= 0; i--) {
        if (notes[i].e.alive) continue;
        notes[i].lane.dispose();
        notes.splice(i, 1);
      }
      // el anillo a tus pies
      const { grid, now } = pulso.current();
      const p = ctx.player();
      const off = grid.offset(now);
      const inWin = off !== null && Math.abs(off) <= windowNow();
      ring.update(dt, p.position.x, p.position.z, beatPhase(grid, now).f, inWin);
      if (ruleOn()) {
        const acc = pifias > 0 ? ` · ${st.punish()} ${'●'.repeat(pifias)}${'○'.repeat(Math.max(0, ACOPLE_AT - pifias))}` : '';
        bar.set(boss.hp, maxHp, `♩ ${Math.round(grid.bpm)} · ${L('soltá en el beat', 'release on the beat')}${acc}`);
      } else bar.set(boss.hp, maxHp, boss.alive ? L('afinando…', 'tuning up…') : '');
      bar.show(boss.alive);
      if (!boss.alive || ctx.over()) {
        stopMusic();
        ring.show(false);
      }
    },
    onRelease() {
      if (!ruleOn()) return;
      const { grid, now } = pulso.current();
      const off = grid.offset(now);
      if (off === null) return;
      const ok = Math.abs(off) <= windowNow();
      ring.release(ok);
      if (ok) {
        stats.enBeat++;
        stats.offMs += Math.abs(off) * 1000;
        return;
      }
      stats.pifias++;
      pifias++;
      if (off < 0) stats.tempranas++;
      else stats.tardias++;
      return { pifia: true, text: L('¡Fuera de ritmo!', 'Off the beat!') };
    },
    bot: {
      // los acordes que caen pronto en ese puesto
      danger(x, within) {
        const { grid, now } = pulso.current();
        const len = 60 / Math.max(40, grid.bpm);
        return chords.some((c) => Math.abs(c.x - x) < CHORD_REACH + 0.4 && c.left * len - (now - (grid.prev(now)?.t ?? now)) < within + 0.6);
      },
      // las notas apuran (van a la puerta); él, más si está cargando algo que se le puede cortar
      weight(e) {
        if (notes.some((n) => n.e === e)) return 3;
        if (e === boss) return !show ? 0 : chords.length || acople ? 1.6 : 1;
        return 1;
      },
      // suelta en el beat: espera al próximo si no está en la ventana
      releaseWait() {
        if (!ruleOn()) return 0;
        const { grid, now } = pulso.current();
        const off = grid.offset(now);
        if (off !== null && Math.abs(off) <= windowNow() * 0.5) return 0;
        const nx = grid.next(now);
        return nx ? Math.max(0.001, nx.t - now) : 0;
      },
    },
    log: () => ({
      fuente,
      vida: Math.round((100 * Math.max(0, boss.hp)) / maxHp),
      fase: phase,
      bpm: Math.round(pulso.bpm),
      compases: bars,
      enBeat: stats.enBeat,
      pifias: stats.pifias,
      tempranas: stats.tempranas,
      tardias: stats.tardias,
      offMedioMs: stats.enBeat ? Math.round(stats.offMs / stats.enBeat) : 0,
      acordes: stats.acordes,
      acordesPegaron: stats.acordesPegaron,
      cortes: stats.cortes,
      notas: stats.notas,
      notasBajadas: stats.notasBajadas,
      notasPuerta: stats.notasPuerta,
      acoples: stats.acoples,
      beatsAudio: stats.beatsAudio,
      beatsJuego: stats.beatsJuego,
      tocando: Math.round(showT),
    }),
    dispose() {
      stopMusic();
      clearChords();
      clearAcople();
      for (const n of notes) n.lane.dispose();
      ring.dispose();
      amps?.dispose();
      rig.dispose();
      bar.dispose();
    },
  };
}
