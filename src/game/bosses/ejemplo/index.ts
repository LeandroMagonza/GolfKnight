// Un jefe de ejemplo, para ver cómo se arma uno (no sale en el panel ni en el sorteo; ?jefe=ejemplo):
// un gólem que se planta a media cancha y cada tanto suelta una piedra que rueda derecho a la puerta.
// Muestra lo básico: un cuerpo con guion propio (un modelo de dungeon.glb), partes hechas por código (las
// piedras, enemigos de verdad: las pelotas y las habilidades les pegan), una marca en el piso que avisa,
// daño a la puerta y al golfista, y lo que necesita saber el bot.
import { L } from '../../../i18n';
import type { Enemy, EnemyScript } from '../../enemies';
import { GATE_Z, LaneMark, partStats, rockLook, touchesPlayer, heightAt } from '../kit';
import type { BossCtx, BossDef, BossFight } from '../types';

const HOLD_Z = 34;
const EVERY = 4;
const ROLL_SPEED = 4.5;

function start(ctx: BossCtx): BossFight {
  const { horde } = ctx;
  if (!horde.hasLook('ejemplo-piedra')) horde.addLook('ejemplo-piedra', rockLook(0.7, 0x8a8478));
  const rocks: { e: Enemy; lane: LaneMark }[] = [];
  let timer = 2;
  let swing = -1;

  // el cuerpo: el gólem chico de dungeon.glb, más grande y con más vida, manejado por su guion
  const bodyScript: EnemyScript = {
    update(e, dt) {
      e.scriptGesture = swing >= 0 ? 1 : 0;
      e.scriptSwing = swing >= 0 ? Math.min(1.25, swing / 0.6) : null;
      // hasta su lugar (walkToward para a 30 cm: por eso el margen)
      if (e.position.z > HOLD_Z + 0.5) {
        e.walkToward(e.position.x, HOLD_Z, 1.6, dt);
        return true;
      }
      e.animator.setLocomotion('Idle', 1);
      e.faceToward(e.position.x, GATE_Z, dt);
      if (ctx.over() || e.stunned) return true;
      if (swing >= 0) {
        swing += dt;
        if (swing >= 0.6 && swing - dt < 0.6) roll(e.position.x + (ctx.rng() * 2 - 1) * 8);
        if (swing > 0.8) swing = -1;
      } else if ((timer -= dt) <= 0) {
        timer = EVERY;
        swing = 0;
      }
      return true;
    },
  };
  const boss = horde.spawnCustom(partStats('stoneling', { name: L('Gólem de ejemplo', 'Example golem'), height: 3.2, radius: 1.3, hp: 30 + ctx.bonusHp, boss: true, heavy: true }), 'stoneling', 0, 60, {}, bodyScript);

  /** Una piedra que sale rodando derecho a la puerta desde x. */
  function roll(x: number): void {
    const lane = new LaneMark(ctx.scene, 0xff7a3c, 1.6).between(x, HOLD_Z - 2, x, GATE_Z);
    const script: EnemyScript = {
      update(e, dt) {
        e.knock.set(0, 0, 0);
        e.position.z -= ROLL_SPEED * dt;
        e.position.y = heightAt(e.position.x, e.position.z);
        e.body.rotation.x -= (ROLL_SPEED / 0.7) * dt;
        if (touchesPlayer(ctx, e) && !ctx.player().invulnerable) {
          ctx.hitPlayer(1, e.position, e);
          e.remove();
        } else if (e.position.z <= GATE_Z + 1) {
          // a la puerta le saca la vida que le quede a la piedra
          ctx.hitGate(e.hp, e);
          e.remove();
        }
        return true;
      },
      onDeath(e) {
        ctx.effects.explosion(e.position.clone().setY(0.6), 1.2, 0x9a8f80);
        e.remove();
      },
    };
    const e = horde.spawnCustom(partStats('stoneling', { name: L('Piedra', 'Rock'), height: 1.4, radius: 0.7, hp: 2, heavy: true }), 'ejemplo-piedra', x, HOLD_Z - 2, {}, script);
    rocks.push({ e, lane });
  }

  return {
    get done() {
      return !boss.alive;
    },
    update() {
      for (let i = rocks.length - 1; i >= 0; i--) {
        if (rocks[i].e.state !== 'gone' && rocks[i].e.alive) continue;
        rocks[i].lane.dispose();
        rocks.splice(i, 1);
      }
    },
    bot: {
      // el puesto que va a pisar una piedra pronto
      danger(x, within) {
        return rocks.some(({ e }) => e.alive && Math.abs(e.position.x - x) < 1.6 && (e.position.z - 9) / ROLL_SPEED < within + 0.5);
      },
      // las piedras apuran más que el gólem
      weight(e) {
        return rocks.some((r) => r.e === e) ? 2 : 1;
      },
    },
    log: () => ({ piedras: rocks.length }),
    dispose() {
      for (const r of rocks) r.lane.dispose();
    },
  };
}

export const BOSSES: BossDef[] = [
  {
    id: 'ejemplo',
    name: L('Gólem de ejemplo', 'Example golem'),
    blurb: 'Ejemplo para armar jefes: se planta y suelta piedras que ruedan a la puerta.', // i18n-ok: el panel de pruebas
    hidden: true,
    start,
  },
];
