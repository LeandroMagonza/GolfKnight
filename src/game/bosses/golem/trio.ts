// Los tres gólems (14/10, la otra idea de Leandro): tres gólems más chicos, plantados a distintas
// distancias, que levantan piedras y las tiran a la puerta, cada uno con su reloj. Mientras la levanta, un
// anillo dorado se le cierra en los pies; cuando se cierra, la piedra brilla: cualquier golpe que le entre
// en esa ventana le hace soltarla encima (se pega y queda aturdido, y aturdido cada golpe le entra uno
// más). Timeando bien, la puerta no recibe nada. Cada tiro los apura un poco, y cuando cae uno los otros
// se enojan y van más rápido.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { GATE_Z, partStats } from '../kit';
import type { BossCtx, BossFight } from '../types';
import { stunStars } from './looks';
import { Overhead } from './overhead';

/** Dónde se planta cada uno: a distintas distancias, para que no se los agarre con un mismo tiro. */
const POSTS = [
  { x: -10, z: 38 },
  { x: 0, z: 46 },
  { x: 10, z: 41 },
];
const ENTER_Z = 60;
const WALK_SPEED = 2.6;
/** El cuerpo: el gólem de roca, más chico que el jefe solo. */
const HEIGHT = 3.4;
const RADIUS = 1.35;
/** Vida de cada uno (más un tercio de la del talento del golpe 4). */
const HP = 40;
/** Segundos entre piedras de cada uno al arrancar, lo mínimo, y cuánto se apura con cada tiro. */
const CYCLE = 9;
const CYCLE_MIN = 4.5;
const CYCLE_DECAY = 0.95;
/** La primera piedra de cada uno, después de llegar: escalonadas. */
const FIRST = [3, 6.5, 10];
/** Cuando cae uno, los que quedan van a esta parte del ciclo. */
const ANGER = 0.8;
/** La piedra: cualquier golpe en la ventana la corta (ver Overhead). */
const OVER = { lift: 1.3, window: 1.4, need: 1, radius: 0.95, gate: 1, flight: 1.4 };
/** Soltársela encima: lo que se pega, lo que queda aturdido, y lo que pega de más cada golpe mientras. */
const SELF = 3;
const STUN_TIME = 3;
const STUN_BONUS = 1;
const STUN_POSE = 0.72;
const ROAR_TIME = 1.6;

type Act = 'enter' | 'idle' | 'big' | 'stun' | 'roar';

interface Golem {
  e: Enemy;
  act: Act;
  t: number;
  next: number;
  cycle: number;
  overhead: Overhead;
  stars: THREE.Group;
}

export function startTrio(ctx: BossCtx): BossFight {
  const { horde } = ctx;
  const golems: Golem[] = [];
  const order = [0, 1, 2].sort(() => ctx.rng() - 0.5);
  let fallen = 0;

  POSTS.forEach((post, i) => {
    let g: Golem | null = null;
    const script: EnemyScript = {
      update(e, dt) {
        if (g) step(g, dt);
        return true;
      },
      filter(_e, amount) {
        return g?.act === 'stun' && amount > 0 ? amount + STUN_BONUS : amount;
      },
      onDamage(_e, dealt) {
        g?.overhead.hit(dealt);
      },
      onDeath() {
        if (!g) return;
        g.stars.visible = false;
        fallen++;
        // los que quedan se enojan: rugen y van más rápido
        for (const o of golems) {
          if (o === g || !o.e.alive) continue;
          o.cycle = Math.max(CYCLE_MIN, o.cycle * ANGER);
          o.next = Math.min(o.next, o.cycle);
          if (o.act === 'idle') {
            o.act = 'roar';
            o.t = 0;
            o.e.animator.playOneShot('Rallying', o.e.animator.clipDuration('Rallying') / ROAR_TIME || 1);
          }
        }
        if (golems.some((o) => o !== g && o.e.alive)) {
          ctx.audio.bossAppear();
          ctx.banner(L('¡Los otros se enojan!', 'The others get angry!'), L('Tiran más seguido', 'They throw more often'), 2);
        }
      },
    };
    const stats = partStats('golem', {
      name: L('Gólem', 'Golem'), height: HEIGHT, radius: RADIUS, hp: HP + Math.round(ctx.bonusHp / 3), speed: WALK_SPEED, boss: true, heavy: true, score: 250,
    });
    const e = horde.spawnCustom(stats, 'golem', post.x, ENTER_Z + i * 2, {}, script);
    const stars = stunStars();
    stars.visible = false;
    stars.scale.setScalar(0.8);
    ctx.scene.add(stars);
    g = { e, act: 'enter', t: 0, next: FIRST[order[i]], cycle: CYCLE, overhead: new Overhead(ctx, e, OVER), stars };
    golems.push(g);
  });

  function step(g: Golem, dt: number): void {
    const e = g.e;
    const post = POSTS[golems.indexOf(g)];
    g.t += dt;
    e.scriptGesture = 0;
    e.scriptSwing = null;
    if (g.act === 'enter') {
      if (e.walkToward(post.x, post.z, WALK_SPEED, dt)) g.act = 'idle';
      return;
    }
    e.knock.set(0, 0, 0);
    e.position.x = post.x;
    e.position.z = post.z;
    e.faceToward(e.position.x, GATE_Z, dt);
    const big = g.overhead.update(dt);
    if (ctx.over()) {
      e.animator.setLocomotion('Idle', 1);
      return;
    }
    if (g.act === 'idle') {
      e.animator.setLocomotion('Idle', 1);
      g.next -= dt;
      if (g.next <= 0) {
        g.act = 'big';
        g.overhead.begin();
      }
    } else if (g.act === 'big') {
      e.scriptGesture = 1;
      e.scriptSwing = g.overhead.swing;
      if (big === 'dropped') {
        horde.damage(e, SELF, null, 0);
        ctx.feedback(L('¡Aturdido!', 'Stunned!'));
        g.act = 'stun';
        g.t = 0;
        e.animator.poseOneShot('Hard Landing', STUN_POSE);
      } else if (!g.overhead.busy) {
        g.act = 'idle';
        // cada tiro (cortado o no) lo apura un poco
        g.cycle = Math.max(CYCLE_MIN, g.cycle * CYCLE_DECAY);
        g.next = g.cycle;
      }
    } else if (g.act === 'stun') {
      g.stars.visible = true;
      g.stars.position.set(e.position.x, e.position.y + e.height + 0.4, e.position.z);
      g.stars.rotation.y += dt * 4;
      if (g.t >= STUN_TIME) {
        g.act = 'idle';
        g.stars.visible = false;
        e.animator.clearOneShot();
        g.cycle = Math.max(CYCLE_MIN, g.cycle * CYCLE_DECAY);
        g.next = g.cycle;
      }
    } else if (g.act === 'roar' && g.t >= ROAR_TIME) {
      g.act = 'idle';
    }
  }

  return {
    get done() {
      return golems.every((g) => !g.e.alive);
    },
    update(dt) {
      // los que murieron: que se les caiga la piedra que tenían arriba y terminen de volar las tiradas
      for (const g of golems) if (!g.e.alive) g.overhead.update(dt, true);
    },
    bot: {
      weight(e) {
        const g = golems.find((x) => x.e === e);
        if (!g) return 1;
        // que la pelota le llegue en la ventana
        const win = g.overhead.windowIn();
        if (win && win.open < 2 && win.close > 0.9) return 3.5;
        return g.act === 'stun' ? 2 : 1;
      },
    },
    log: () => ({
      vivos: golems.filter((g) => g.e.alive).length,
      vida: golems.map((g) => Math.max(0, g.e.hp)).join('/'),
      cortadas: golems.reduce((n, g) => n + g.overhead.count.cut, 0),
      tiradas: golems.reduce((n, g) => n + g.overhead.count.thrown, 0),
      enLaPuerta: golems.reduce((n, g) => n + g.overhead.count.landed, 0),
      caidos: fallen,
      accion: golems.map((g) => (g.overhead.busy ? g.overhead.phase : g.act)).join('/'),
    }),
    dispose() {
      for (const g of golems) {
        g.overhead.dispose();
        ctx.scene.remove(g.stars);
      }
    },
  };
}
