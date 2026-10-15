// El gusano de las cavernas (ver docs/jefes/gusano.md): la prueba de anticipar.
//
// Va bajo tierra: se ve la tierra que se mueve y el surco que deja. Un rato antes de llegar, el piso
// marca dónde va a salir (un anillo que se cierra). Asoma un momento (1.7 s al principio, 1.1 s al final),
// tira (a tu puesto, o a la puerta según la versión) y se vuelve a meter, y donde se metió deja una loma,
// que tapa al driver: el campo se va llenando y empuja al hierro y al wedge. Solo recibe asomado, así que
// hay que tirar antes: el wedge, que tarda en caer, se tira mientras viene; el driver, cargado de antes.
//
// Bajo tierra no es un enemigo (nada lo puede tocar, ni el bot le apunta): al asomar aparece uno nuevo con
// la vida que le quedaba (la lleva este archivo, y la barra grande de arriba), y al meterse se va. La tierra
// que se mueve, el surco, las marcas y las lomas son adornos de acá; en la versión «túnel» la tierra que se
// mueve es también un enemigo, y lo que le pegan se lo saca al gusano.
import * as THREE from 'three';
import { L } from '../../../i18n';
import { mounds, type Mound } from '../../../core/terrain';
import type { Enemy, EnemyScript } from '../../enemies';
import { BossBar, GATE_Z, GroundMark, LaneMark, TEE_Z, arcPoint, fieldHalfAt, heightAt, nearestSpot, partStats } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { COLORS, clodGeo, globGeo, moleLook, poseWorm, wormLook } from './look';

export interface Variant {
  /** Contra qué tira al asomar: tu puesto (te corrés) o la puerta (se frena pegándole mientras asoma). */
  target: 'player' | 'gate';
  /** Las lomas que deja: quedan (hasta un tope) o se van solas al rato. */
  moundsFade: boolean;
  /** La tierra que se mueve encima de él también recibe golpes (y se los saca al gusano). */
  tunnel: boolean;
}

/** De dónde sale al empezar (al fondo), y por dónde anda: entre qué z, y cuánto le deja a cada costado. */
const START_Z = 62;
const FIELD = { minZ: 18, maxZ: 52, margin: 4 };
/** Lo largo de cada viaje bajo tierra. */
const TRIP = { min: 10, max: 16 };
/** No sale a menos de esto de una loma (si puede): así reparte las lomas por el campo. */
const MOUND_GAP = 4.5;
/**
 * Lo que sube la presión con la pelea: va más rápido bajo tierra (m/s) y asoma menos tiempo (s), de
 * `start` a `end` en los primeros `ramp` segundos.
 */
const SPEED = { start: 5, end: 8.5, ramp: 120 };
const WINDOW = { start: 1.7, end: 1.1, ramp: 120 };
/** Lo que tarda en salir y en meterse. Saliendo recibe desde la mitad; metiéndose, hasta la mitad. */
const RISE = 0.35;
const DIVE = 0.45;
/** Cuánto antes de salir se marca el lugar (el anillo que se cierra). */
const SHOW_AHEAD = 1.5;
/** Vida (más con la dificultad: +2 por nivel). */
const HP = 45;
/**
 * La loma que deja al meterse: alto y radios (como la del geomante, un poco más chica), cuánto tarda en
 * crecer, cuántas quedan a la vez (pasando eso, la más vieja baja) y cuánto duran en la versión que se van.
 */
const MOUND = { height: 1.5, rx: 2.6, rz: 2.2, grow: 0.6, cap: 10, life: 20 };
/** El escupitajo a tu puesto (cae cuando se mete) y el de la puerta. */
const SPIT = { flight: 0.8, radius: 1.6, arc: 4 };
const GATE_SPIT = { flight: 1.2, arc: 7, damage: 1 };
/** El surco: un terrón cada `step` m, que dura `life` s (de un depósito de `pool`). */
const TRAIL = { step: 0.45, life: 3.2, pool: 90 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (u: number) => {
  const v = clamp01(u);
  return v * v * (3 - 2 * v);
};
const ramp = (r: { start: number; end: number; ramp: number }, t: number) => r.start + (r.end - r.start) * clamp01(t / r.ramp);

type Phase = 'travel' | 'rise' | 'up' | 'dive' | 'dead';

interface Glob {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  flight: number;
  arc: number;
  kind: 'player' | 'gate';
  source: Enemy | null;
  mark: GroundMark | null;
}

interface Clod {
  mesh: THREE.Mesh;
  age: number;
  size: number;
}

/** Lo que miden los modelos (los mide `addLook`): la vida del enemigo va a esa altura, sin escalar. */
const measured = { worm: 5, mole: 0.9 };

export function startWorm(ctx: BossCtx, v: Variant): BossFight {
  const { horde, scene } = ctx;
  const maxHp = HP + 2 * ctx.level + ctx.bonusHp;
  let hp = maxHp;

  if (!horde.hasLook('gusano')) measured.worm = horde.addLook('gusano', wormLook());
  if (!horde.hasLook('gusano-tierra')) measured.mole = horde.addLook('gusano-tierra', moleLook());
  const wormHeight = measured.worm;

  const bar = new BossBar(L('El Gusano de las cavernas', 'The Cave Worm'), '#d94a3a');
  const warn = new GroundMark(scene, COLORS.warn, false, 3).opacity(0);
  const globMat = new THREE.MeshBasicMaterial({ color: COLORS.acid });
  const gateGlobMat = new THREE.MeshBasicMaterial({ color: COLORS.gate });
  const clodMats = [new THREE.MeshStandardMaterial({ color: COLORS.darkDirt, roughness: 1, flatShading: true }), new THREE.MeshStandardMaterial({ color: COLORS.dirt, roughness: 1, flatShading: true })];

  // ---- el surco ----
  const clods: Clod[] = [];
  for (let i = 0; i < TRAIL.pool; i++) {
    const mesh = new THREE.Mesh(clodGeo, clodMats[i % 2]);
    mesh.visible = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    clods.push({ mesh, age: TRAIL.life, size: 1 });
  }
  let clodNext = 0;
  let clodSide = 1;
  function dropClod(x: number, z: number, along: THREE.Vector3): void {
    const c = clods[clodNext];
    clodNext = (clodNext + 1) % clods.length;
    clodSide = -clodSide;
    const side = 0.35 + 0.25 * ctx.rng();
    const cx = x + along.z * side * clodSide;
    const cz = z - along.x * side * clodSide;
    c.age = 0;
    c.size = 0.28 + 0.18 * ctx.rng();
    c.mesh.position.set(cx, heightAt(cx, cz), cz);
    c.mesh.rotation.set(ctx.rng() * 3, ctx.rng() * 3, ctx.rng() * 3);
    c.mesh.visible = true;
  }
  function updateClods(dt: number): void {
    for (const c of clods) {
      if (!c.mesh.visible) continue;
      c.age += dt;
      if (c.age >= TRAIL.life) {
        c.mesh.visible = false;
        continue;
      }
      // salta un poco al salir y se va hundiendo
      const pop = Math.min(1, c.age / 0.15);
      const fade = clamp01((c.age - TRAIL.life * 0.6) / (TRAIL.life * 0.4));
      c.mesh.scale.set(c.size * pop * (1 - fade * 0.7), c.size * 0.55 * pop * (1 - fade), c.size * pop * (1 - fade * 0.7));
    }
  }

  // ---- la tierra que se mueve (adorno, o enemigo en la versión «túnel») ----
  const moleDecor = moleLook();
  moleDecor.visible = false;
  scene.add(moleDecor);
  let mole: Enemy | null = null;
  const moleScript: EnemyScript = {
    update(e) {
      e.knock.set(0, 0, 0);
      return true;
    },
    onDamage(e) {
      hp = Math.max(0, e.hp);
    },
    onDeath(e) {
      hp = 0;
      e.remove();
      dieUnderground(e.position.clone());
    },
  };

  // ---- las lomas ----
  const mine: { m: Mound; age: number }[] = [];
  function raiseMound(x: number, z: number): void {
    const m: Mound = { x, z, height: 0, target: 0, rx: MOUND.rx, rz: MOUND.rz, owner: 0 };
    mounds.push(m);
    mine.push({ m, age: 0 });
    stats.lomas++;
    // pasando el tope, baja la más vieja
    const standing = mine.filter((x2) => x2.m.target > 0 || x2.age < MOUND.grow);
    if (standing.length > MOUND.cap) standing[0].m.target = 0;
  }
  function updateMounds(dt: number): void {
    for (let i = mine.length - 1; i >= 0; i--) {
      const it = mine[i];
      it.age += dt;
      // ya se fue del todo (la baja la horda, ver Horde.updateMounds)
      if (!mounds.includes(it.m)) {
        mine.splice(i, 1);
        continue;
      }
      if (it.age <= MOUND.grow + dt) {
        // crece rápido (la horda la deja quieta: el blanco es la altura de ahora)
        it.m.height = it.m.target = MOUND.height * ease(it.age / MOUND.grow);
      } else if (v.moundsFade && it.age > MOUND.life) it.m.target = 0;
    }
  }

  // ---- el gusano ----
  let phase: Phase = 'travel';
  let phaseT = 0;
  const from = new THREE.Vector3(0, 0, START_Z);
  const to = new THREE.Vector3();
  const pos = new THREE.Vector3().copy(from);
  let tripLen = 1;
  let traveled = 0;
  let sinceClod = 0;
  let worm: Enemy | null = null;
  let windowLen = WINDOW.start;
  let hitThisTime = false;
  let attack: { kind: 'player' | 'gate'; to: THREE.Vector3; mark: GroundMark | null; lane: LaneMark | null } | null = null;
  const holes: THREE.Vector3[] = [];
  const globs: Glob[] = [];
  const stats = { asomadas: 0, golpeadas: 0, aPuerta: 0, aVos: 0, cortes: 0, lomas: 0, alTunel: 0 };
  const windowRing = new GroundMark(scene, 0xff3b30, false, 2.4).opacity(0);
  let dead = false;
  let deathDecor: { obj: THREE.Object3D; t: number } | null = null;

  /** El próximo lugar donde sale: a un viaje de donde está, adentro del campo, lejos de las lomas. */
  function pickNext(): void {
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;
    for (let k = 0; k < 24; k++) {
      const ang = ctx.rng() * Math.PI * 2;
      const d = TRIP.min + (TRIP.max - TRIP.min) * ctx.rng();
      const x = pos.x + Math.sin(ang) * d;
      const z = Math.min(FIELD.maxZ, Math.max(FIELD.minZ, pos.z + Math.cos(ang) * d));
      const half = fieldHalfAt(z) - FIELD.margin;
      if (Math.abs(x) > half) continue;
      let score = 0;
      for (const m of mounds) if (Math.hypot(m.x - x, m.z - z) < MOUND_GAP) score -= 3;
      for (const h of holes.slice(-3)) if (Math.hypot(h.x - x, h.z - z) < MOUND_GAP) score -= 2;
      score -= Math.abs(Math.hypot(x - pos.x, z - pos.z) - (TRIP.min + TRIP.max) / 2) * 0.05;
      score += ctx.rng() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = new THREE.Vector3(x, 0, z);
      }
    }
    to.copy(best ?? new THREE.Vector3((ctx.rng() * 2 - 1) * 8, 0, 30));
    from.copy(pos);
    tripLen = Math.max(1, Math.hypot(to.x - from.x, to.z - from.z));
    traveled = 0;
  }

  function spawnMole(): void {
    if (!v.tunnel) return;
    mole?.remove();
    mole = horde.spawnCustom(partStats('stoneling', {
      name: L('Gusano bajo tierra', 'Burrowing worm'), behavior: 'golem', height: measured.mole, radius: 0.85, hp: maxHp, speed: 0, heavy: true, boss: true, score: 0,
    }), 'gusano-tierra', pos.x, pos.z, {}, moleScript);
    mole.setHp(hp, maxHp);
  }

  const wormScript: EnemyScript = {
    update(e) {
      e.knock.set(0, 0, 0);
      return true;
    },
    // recibe saliendo (desde la mitad), asomado, y metiéndose (hasta la mitad)
    filter: (_e, amount) => (phase === 'up' || (phase === 'rise' && phaseT > RISE * 0.5) || (phase === 'dive' && phaseT < DIVE * 0.5) ? amount : 0),
    onDamage(e, dealt) {
      hp = Math.max(0, e.hp);
      if (dealt <= 0) return;
      hitThisTime = true;
      // a la puerta: cualquier golpe mientras asoma lo frena
      if (attack?.kind === 'gate') {
        attack.lane?.dispose();
        attack = null;
        stats.cortes++;
        ctx.feedback(L('¡Lo frenaste!', 'Stopped it!'));
      }
    },
    onDeath() {
      hp = 0;
      die();
    },
  };

  function surface(): void {
    phase = 'rise';
    phaseT = 0;
    hitThisTime = false;
    stats.asomadas++;
    windowLen = ramp(WINDOW, ctx.clock());
    holes.push(to.clone());
    mole?.remove();
    mole = null;
    moleDecor.visible = false;
    warn.opacity(0);
    worm = horde.spawnCustom(partStats('stoneling', {
      name: L('Gusano de las cavernas', 'Cave Worm'), behavior: 'golem', height: wormHeight, radius: 1.15, hp: maxHp, speed: 0, heavy: true, boss: true, score: 500,
    }), 'gusano', to.x, to.z, {}, wormScript);
    worm.setHp(hp, maxHp);
    const p = ctx.player();
    worm.heading = Math.atan2(p.position.x - to.x, p.position.z - to.z);
    poseWorm(worm.body, 0, 0, 0, 0);
    ctx.effects.explosion(new THREE.Vector3(to.x, heightAt(to.x, to.z) + 0.5, to.z), 2.6, COLORS.dirt);
    ctx.audio.explosion(false);
    if (ctx.over()) return;
    // lo que tira al meterse: la marca ya, para que se vea venir
    if (v.target === 'player') {
      const x = ctx.spots()[nearestSpot(ctx, p.position.x)];
      attack = { kind: 'player', to: new THREE.Vector3(x, 0, TEE_Z), mark: new GroundMark(scene, COLORS.acid, true, SPIT.radius).at(x, TEE_Z).opacity(0.2), lane: null };
    } else {
      attack = { kind: 'gate', to: new THREE.Vector3(0, 1.2, GATE_Z + 1), mark: null, lane: new LaneMark(scene, COLORS.gate, 1.1).between(to.x, to.z - 1, 0, GATE_Z + 1).opacity(0.2) };
    }
  }

  function spit(): void {
    const a = attack;
    attack = null;
    if (!a || !worm || ctx.over()) {
      a?.mark?.dispose();
      a?.lane?.dispose();
      return;
    }
    a.lane?.dispose();
    const head = worm.body.getObjectByName('head');
    const fromPos = head ? head.getWorldPosition(new THREE.Vector3()) : worm.position.clone().setY(worm.position.y + 4);
    const mesh = new THREE.Mesh(globGeo, a.kind === 'gate' ? gateGlobMat : globMat);
    mesh.scale.setScalar(a.kind === 'gate' ? 0.5 : 0.4);
    mesh.position.copy(fromPos);
    scene.add(mesh);
    const dest = a.kind === 'gate' ? a.to.clone() : a.to.clone().setY(heightAt(a.to.x, a.to.z) + 0.2);
    globs.push({ mesh, from: fromPos, to: dest, t: 0, flight: a.kind === 'gate' ? GATE_SPIT.flight : SPIT.flight, arc: a.kind === 'gate' ? GATE_SPIT.arc : SPIT.arc, kind: a.kind, source: worm, mark: a.mark });
    ctx.audio.casterCast();
  }

  function updateGlobs(dt: number): void {
    for (let i = globs.length - 1; i >= 0; i--) {
      const g = globs[i];
      g.t += dt / g.flight;
      const u = Math.min(1, g.t);
      arcPoint(g.from, g.to, u, g.arc, g.mesh.position);
      g.mesh.rotation.x += dt * 7;
      g.mesh.rotation.y += dt * 5;
      g.mark?.opacity(0.4 + 0.25 * u);
      if (u < 1) continue;
      scene.remove(g.mesh);
      g.mark?.dispose();
      globs.splice(i, 1);
      if (g.kind === 'gate') {
        ctx.effects.explosion(g.to.clone(), 2.2, COLORS.gate);
        if (!ctx.over() && g.source) {
          ctx.hitGate(GATE_SPIT.damage, g.source);
          stats.aPuerta++;
        }
        continue;
      }
      ctx.effects.explosion(g.to.clone().setY(g.to.y + 0.2), SPIT.radius, COLORS.acid);
      ctx.audio.casterHit();
      const p = ctx.player();
      if (!ctx.over() && p.alive && !p.invulnerable && Math.hypot(p.position.x - g.to.x, p.position.z - g.to.z) < SPIT.radius + 0.25) {
        ctx.hitPlayer(1, g.to, g.source);
        stats.aVos++;
      }
    }
  }

  function die(): void {
    if (dead) return;
    dead = true;
    phase = 'dead';
    phaseT = 0;
    attack?.mark?.dispose();
    attack?.lane?.dispose();
    attack = null;
    warn.opacity(0);
    windowRing.opacity(0);
    moleDecor.visible = false;
    bar.set(0, maxHp, '');
    ctx.banner(L('¡Cayó el Gusano!', 'The Worm falls!'), '', 2.5);
  }

  /** Muerto bajo tierra (la versión «túnel»): sale de golpe y se desploma. */
  function dieUnderground(at: THREE.Vector3): void {
    const obj = wormLook();
    obj.position.set(at.x, heightAt(at.x, at.z), at.z);
    obj.rotation.y = Math.atan2(ctx.player().position.x - at.x, ctx.player().position.z - at.z);
    scene.add(obj);
    deathDecor = { obj, t: 0 };
    ctx.effects.explosion(new THREE.Vector3(at.x, at.y + 0.5, at.z), 2.6, COLORS.dirt);
    die();
  }

  /** Bajo tierra: la tierra se mueve hacia donde va a salir, dejando el surco. */
  function travel(dt: number, t: number): void {
    const speed = ramp(SPEED, ctx.clock());
    const step = Math.min(speed * dt, tripLen - traveled);
    traveled += step;
    const along = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
    pos.copy(from).addScaledVector(along, traveled);
    pos.y = heightAt(pos.x, pos.z);
    sinceClod += step;
    while (sinceClod >= TRAIL.step) {
      sinceClod -= TRAIL.step;
      dropClod(pos.x, pos.z, along);
    }
    // la tierra que se mueve
    const obj = mole ? mole.body : moleDecor;
    if (mole) {
      mole.position.copy(pos);
      mole.heading = Math.atan2(along.x, along.z);
      mole.body.rotation.y = mole.heading;
      mole.setHp(hp, maxHp);
    } else {
      moleDecor.visible = true;
      moleDecor.position.copy(pos);
      moleDecor.rotation.y = Math.atan2(along.x, along.z);
    }
    obj.position.y = (mole ? 0 : pos.y) + 0.05 * Math.sin(t * 25);
    for (let i = 0; i < 5; i++) {
      const r = obj.getObjectByName(`rock${i}`);
      if (r) r.position.y = 0.2 + 0.25 * Math.abs(Math.sin(t * 11 + i * 1.7));
    }
    // dónde va a salir: el anillo que se cierra
    const left = (tripLen - traveled) / speed;
    if (left < SHOW_AHEAD) {
      const u = 1 - left / SHOW_AHEAD;
      warn.at(to.x, to.z).size(3 - 1.6 * u).opacity(0.25 + 0.5 * u * (0.7 + 0.3 * Math.sin(t * (8 + 14 * u))));
    } else warn.opacity(0);
    if (traveled >= tripLen - 1e-3) surface();
  }

  function updateWorm(dt: number, t: number): void {
    phaseT += dt;
    const e = worm;
    switch (phase) {
      case 'travel':
        travel(dt, t);
        return;
      case 'rise': {
        if (e) poseWorm(e.body, ease(phaseT / RISE), 0, 0.25, t);
        windowRing.at(to.x, to.z).size(2.6).color(0xffd64a).opacity(0.6);
        if (phaseT >= RISE) {
          phase = 'up';
          phaseT = 0;
        }
        break;
      }
      case 'up': {
        const u = phaseT / windowLen;
        // se va tirando para adelante para escupir
        if (e) poseWorm(e.body, 1, 0.6 * ease((u - 0.5) * 2), 0.25, t);
        windowRing.at(to.x, to.z).size(2.6 - 1.4 * u).color(u > 0.65 ? 0xff3b30 : 0xffd64a).opacity(0.55 + 0.35 * Math.abs(Math.sin(t * (6 + 10 * u))));
        attack?.mark?.opacity(0.2 + 0.3 * u);
        attack?.lane?.opacity(0.15 + 0.4 * u * (0.7 + 0.3 * Math.sin(t * 18)));
        if (phaseT >= windowLen) {
          spit();
          phase = 'dive';
          phaseT = 0;
          windowRing.opacity(0);
          if (hitThisTime) stats.golpeadas++;
        }
        break;
      }
      case 'dive': {
        if (e) poseWorm(e.body, 1 - ease(phaseT / DIVE), 0.6, 0.15, t);
        if (phaseT >= DIVE) {
          e?.remove();
          worm = null;
          raiseMound(to.x, to.z);
          ctx.effects.explosion(new THREE.Vector3(to.x, heightAt(to.x, to.z) + 0.3, to.z), 1.8, COLORS.dirt);
          pos.copy(to);
          pickNext();
          phase = 'travel';
          phaseT = 0;
          spawnMole();
        }
        break;
      }
      case 'dead': {
        // se desploma hacia adelante y se hunde (el enemigo muere solo; el adorno, si murió bajo tierra)
        const body = e?.body ?? deathDecor?.obj;
        const u = clamp01(phaseT / 2.2);
        if (deathDecor) deathDecor.t += dt;
        if (body) {
          poseWorm(body, deathDecor ? Math.min(1, phaseT / 0.35) * (1 - ease((u - 0.5) * 2)) : 1 - ease((u - 0.45) * 1.8), 0.6 + 1.6 * ease(u * 1.5), 0, t);
        }
        if (deathDecor && phaseT > 2.4) {
          scene.remove(deathDecor.obj);
          deathDecor = null;
        }
        break;
      }
    }
    // la garganta brilla más cuanto más cerca de escupir (el juego le apaga el brillo en cada cuadro)
    if (e?.alive) {
      e.heading = Math.atan2((attack?.to.x ?? ctx.player().position.x) - e.position.x, (attack?.to.z ?? TEE_Z) - e.position.z);
      e.body.rotation.y = e.heading;
      const throat = e.body.getObjectByName('throat') as THREE.Mesh | undefined;
      const mat = throat?.material as THREE.MeshStandardMaterial | undefined;
      if (mat) {
        const glow = phase === 'up' ? 0.6 + 0.8 * (phaseT / windowLen) * (0.75 + 0.25 * Math.sin(t * 30)) : 0.5;
        mat.emissive.setHex(attack?.kind === 'gate' ? COLORS.gate : attack ? COLORS.acid : 0xff7a3a).multiplyScalar(glow);
      }
    }
  }

  pickNext();
  spawnMole();
  ctx.banner(L('El Gusano de las cavernas', 'The Cave Worm'), L('Va bajo tierra: tirá adonde va a asomar, antes de que asome', 'It moves underground: shoot where it will surface, before it does'), 4);

  return {
    get done() {
      return dead;
    },
    update(dt) {
      const t = ctx.clock();
      if (!dead && worm && !worm.alive && hp <= 0) die();
      updateWorm(dt, t);
      updateClods(dt);
      updateGlobs(dt);
      updateMounds(dt);
      if (!dead) {
        const sub = phase === 'travel'
          ? L('Bajo tierra', 'Underground')
          : phase === 'dive' ? L('Se mete', 'Diving') : L('¡Asomó!', 'Surfaced!');
        bar.set(hp, maxHp, sub);
      }
    },
    bot: {
      // el escupitajo a tu puesto: desde que asoma hasta que cae
      danger(x, within) {
        if (attack?.kind === 'player' && Math.abs(attack.to.x - x) < SPIT.radius + 1) {
          const left = (phase === 'rise' ? RISE - phaseT + windowLen : phase === 'up' ? windowLen - phaseT : 0) + SPIT.flight;
          if (left < within + 0.3) return true;
        }
        for (const g of globs) if (g.kind === 'player' && Math.abs(g.to.x - x) < SPIT.radius + 1 && (1 - g.t) * g.flight < within + 0.3) return true;
        return false;
      },
      // asomado, lo más urgente; la tierra que se mueve (túnel), también vale
      weight(e) {
        if (e === worm) return phase === 'dive' ? 0.5 : 3;
        if (e === mole) return 1.5;
        return 1;
      },
    },
    log: () => ({ ...stats, vida: hp, lomasEnPie: mine.filter((x) => x.m.target > 0).length }),
    dispose() {
      bar.dispose();
      warn.dispose();
      windowRing.dispose();
      attack?.mark?.dispose();
      attack?.lane?.dispose();
      for (const g of globs) {
        scene.remove(g.mesh);
        g.mark?.dispose();
      }
      for (const c of clods) scene.remove(c.mesh);
      scene.remove(moleDecor);
      if (deathDecor) scene.remove(deathDecor.obj);
      // las lomas del gusano se van con él
      for (const it of mine) {
        const i = mounds.indexOf(it.m);
        if (i >= 0) mounds.splice(i, 1);
      }
      globMat.dispose();
      gateGlobMat.dispose();
      for (const m of clodMats) m.dispose();
    },
  };
}
