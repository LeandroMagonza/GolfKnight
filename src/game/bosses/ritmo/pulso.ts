// El ritmo de presión constante (el pulso, idea de Leandro): si pasan unos 3 s sin pegarle, se empieza a
// curar, y mientras se cura te tira hechizos al puesto. Cada golpe le reinicia el reloj y le corta la cura.
// Pide una cadencia pareja: ir de pelota en pelota sin pausas, pegándole a él entre los demás.
// No es el «se cura» de los comunes (que se cura entero cada tanto, le pegues o no) ni el curandero (que
// cura a los de al lado siempre): este se cura solo si lo dejás respirar.
import * as THREE from 'three';
import { L } from '../../../i18n';
import type { EnemyKind } from '../../../core/waves';
import type { Enemy } from '../../enemies';
import { heightAt, partStats, TEE_Z } from '../kit';
import type { BossCtx } from '../types';
import { Cuerpo, pickStation, playerInside, targetSpots } from './cuerpo';
import { Dial, Rings, spellMesh, Tag, Volley } from './piezas';

export interface PulsoOpts {
  /**
   * Qué le reinicia el reloj: un golpe que le entra ('golpe'), o cualquier pelota que lo toque, aunque el
   * blindaje se la coma entera ('toque', el del doble: tocarlo aunque rebote).
   */
  reset: 'golpe' | 'toque';
  /** Mientras se cura, cura también a la escolta que tiene cerca, y le da vida de más. */
  escort: boolean;
  /** Llama refuerzos cada tanto (la presión de afuera que compite con la cadencia). */
  summons: boolean;
  /** A quiénes más cura (el caballero de la pareja). */
  allies?: () => Enemy[];
  /** Dónde se planta: -1 a la izquierda, 1 a la derecha, 0 en cualquier lado. */
  side?: number;
  /** Se cambia de lugar solo (en el doble lo mueve la coraza). */
  moves?: boolean;
  /** El radio del reloj del piso y la altura del número (el doble los corre para que no se encimen con la coraza). */
  ring?: number;
  lift?: number;
}

/** Los números del pulso (ver docs/jefes/ritmo.md). Los pares van del principio al final de la pelea. */
export const PULSO = {
  /** Los segundos sin pegarle antes de que se empiece a curar. */
  grace: [3.4, 2.5],
  /** Con cada nivel de dificultad, el reloj dura esto menos. */
  levelGrace: 0.04,
  /** Mientras se cura: cada cuánto, cuánto a él y cuánto a los que cura además (el caballero de la pareja). */
  healEvery: 1.0,
  heal: 2,
  allyHeal: 1,
  /** La escolta que cura: a qué distancia, cuánto por pulso y hasta cuánta vida de más. */
  escortRadius: 11,
  escortHeal: 1,
  overheal: 2,
  /** Los hechizos mientras se cura: el primero al rato de empezar, después cada `spellEvery`. */
  spellDelay: 0.8,
  spellEvery: 3.0,
  spellFlight: 1.5,
  spellRadius: 1.4,
  spellDamage: 1,
  /** Los refuerzos: cada cuánto y cuántos. */
  summonEvery: [15, 9],
  summonCount: [2, 4],
  /** Cada cuánto se cambia de lugar (mientras no se está curando). */
  relocateEvery: 14,
};

const HEAL = 0x3ee07a;
const MUTED = 0x6b7480;
const TRACK = 0x1a1f28;

const lerp = (pair: readonly number[], h: number) => pair[0] + (pair[1] - pair[0]) * h;

export class Pulso {
  state: 'contando' | 'curando' = 'contando';
  /** Lo que le falta al reloj para empezar a curarse. */
  left: number;
  private healT = 0;
  private spellT = 0;
  private summonT = 0;
  private relocT = 0;
  private readonly clock: Dial;
  readonly tag: Tag;
  /** La vida que tenía cada uno de la escolta antes de que le diera de más. */
  private readonly baseMax = new Map<Enemy, number>();
  readonly log = { curas: 0, curado: 0, curandoSeg: 0, cortadas: 0, hechizos: 0, hechizosPegaron: 0, refuerzos: 0, escoltaCurada: 0 };

  constructor(private readonly ctx: BossCtx, private readonly body: Cuerpo, private readonly o: PulsoOpts, private readonly volley: Volley, private readonly rings: Rings) {
    const r = o.ring ?? 2.4;
    this.clock = new Dial(ctx.scene, 24, r, r + 0.6, 0);
    this.tag = new Tag(ctx.scene, o.lift ? 1.2 : 1.7);
    this.left = this.grace;
    body.onLand((g) => {
      if (g.dealt > 0) this.reset();
    });
    if (o.reset === 'toque') body.onTouch((_raw, shot) => {
      if (shot) this.reset();
    });
  }

  private get heat(): number {
    return Cuerpo.heat(this.ctx);
  }
  /** Los segundos sin pegarle que aguanta antes de curarse. */
  get grace(): number {
    return Math.max(1.8, lerp(PULSO.grace, this.heat) - this.ctx.level * PULSO.levelGrace);
  }
  get healing(): boolean {
    return this.state === 'curando' && !this.body.silenced;
  }

  /** Le pegaron: el reloj vuelve a empezar y se le corta la cura. */
  private reset(): void {
    if (!this.body.arrived) return;
    this.left = this.grace;
    if (this.state !== 'curando') return;
    this.state = 'contando';
    this.body.cast = false;
    this.log.cortadas++;
  }

  update(dt: number): void {
    const e = this.body.e;
    if (!e.alive || this.ctx.over()) {
      this.body.cast = false;
      this.show();
      return;
    }
    // silenciado no se cura ni conjura: el reloj queda quieto
    if (this.body.arrived && !this.body.silenced) {
      if (this.state === 'contando') {
        this.left -= dt;
        if (this.left <= 0) this.startHealing();
      } else {
        this.log.curandoSeg += dt;
        if ((this.healT += dt) >= PULSO.healEvery) {
          this.healT -= PULSO.healEvery;
          this.healTick();
        }
        if ((this.spellT += dt) >= PULSO.spellEvery) {
          this.spellT = 0;
          this.castSpell();
        }
      }
      if (this.o.summons && (this.summonT += dt) >= lerp(PULSO.summonEvery, this.heat)) {
        this.summonT = 0;
        this.summon();
      }
      if (this.o.moves !== false && this.state === 'contando' && (this.relocT += dt) >= PULSO.relocateEvery && !this.body.walking) {
        this.relocT = 0;
        const s = pickStation(this.ctx, e.position.x, e.position.z, this.o.side ?? 0);
        this.body.goTo(s.x, s.z);
      }
    }
    this.body.cast = this.healing;
    this.show();
  }

  private startHealing(): void {
    this.state = 'curando';
    this.left = 0;
    this.healT = 0;
    this.spellT = PULSO.spellEvery - PULSO.spellDelay;
    this.log.curas++;
    // se planta a curarse (si iba caminando, se queda)
    if (this.o.moves !== false) this.body.stop();
    this.ctx.feedback(L('¡Se cura! Pegale', 'Healing! Hit it'));
  }

  private healTick(): void {
    const e = this.body.e;
    this.rings.add(e.position.x, e.position.z, HEAL, 1, this.o.escort ? PULSO.escortRadius : 3.5, 0.7);
    this.healOne(e, PULSO.heal);
    for (const a of this.o.allies?.() ?? []) if (a.alive && !a.passed) this.healOne(a, PULSO.allyHeal);
    if (this.o.escort) this.healEscort();
  }

  private healOne(e: Enemy, n: number): void {
    const amount = Math.min(n, e.maxHp - e.hp);
    if (amount <= 0) return;
    e.setHp(e.hp + amount);
    this.log.curado += amount;
    this.ctx.horde.emit({ type: 'healed', enemy: e, amount });
  }

  /** La escolta que tiene cerca: +1 de vida, aunque esté sana, hasta `overheal` de más. */
  private healEscort(): void {
    const e = this.body.e;
    for (const o of this.ctx.horde.enemies) {
      if (o === e || !o.alive || o.passed || o.stats.boss) continue;
      if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) > PULSO.escortRadius + o.radius) continue;
      let base = this.baseMax.get(o);
      if (base === undefined) this.baseMax.set(o, (base = o.maxHp));
      if (o.hp >= base + PULSO.overheal) continue;
      const hp = o.hp + PULSO.escortHeal;
      o.setHp(hp, Math.max(o.maxHp, hp));
      this.log.escoltaCurada += PULSO.escortHeal;
      this.ctx.horde.emit({ type: 'healed', enemy: o, amount: PULSO.escortHeal });
    }
  }

  /** Un hechizo al puesto del golfista, con la marca en el piso: corrés un puesto y listo. */
  private castSpell(): void {
    const e = this.body.e;
    const x = this.ctx.spots()[targetSpots(this.ctx, 1)[0]];
    const from = e.position.clone().setY(e.position.y + e.height);
    this.log.hechizos++;
    this.ctx.audio.casterCast();
    this.volley.fire({
      mesh: spellMesh(), from, to: new THREE.Vector3(x, heightAt(x, TEE_Z) + 0.3, TEE_Z), flight: PULSO.spellFlight, height: 8,
      mark: { color: 0xff3b30, radius: PULSO.spellRadius },
      land: (at) => {
        this.ctx.effects.explosion(at, PULSO.spellRadius, HEAL);
        this.ctx.audio.casterHit();
        if (this.ctx.over() || !playerInside(this.ctx, at.x, at.z, PULSO.spellRadius)) return;
        this.log.hechizosPegaron++;
        this.ctx.hitPlayer(PULSO.spellDamage, at, e);
      },
    });
  }

  /** Llama refuerzos: unos goblins que salen a su lado y van a la puerta como cualquiera. */
  private summon(): void {
    const e = this.body.e;
    const n = Math.round(lerp(PULSO.summonCount, this.heat));
    this.body.play('Rallying', 1.4);
    this.rings.add(e.position.x, e.position.z, 0xc77dff, 1, 4.5, 0.6);
    const turn = this.ctx.rng() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = turn + (k / n) * Math.PI * 2;
      const kind: EnemyKind = k % 2 ? 'goblina' : 'goblin';
      const m = this.ctx.horde.spawnCustom(partStats(kind, {}), kind, e.position.x + Math.cos(a) * 2.8, e.position.z - 1.5 + Math.sin(a) * 1.6);
      this.ctx.effects.blink(m.position.clone(), 0xc77dff);
    }
    this.log.refuerzos += n;
  }

  /** El reloj del piso, el número sobre la cabeza y el brillo verde mientras se cura. */
  private show(): void {
    const e = this.body.e;
    const on = e.alive && !this.ctx.over();
    this.clock.visible(on);
    this.tag.visible(on);
    if (!on) return;
    const { x, z } = e.position;
    this.clock.at(x, z);
    this.tag.over(e, this.o.lift ?? 1.5);
    const t = this.ctx.clock();
    if (this.body.silenced) {
      this.clock.show(24, MUTED, TRACK, 0.5);
      this.tag.visible(false);
      return;
    }
    if (!this.body.arrived) {
      this.clock.show(24, 0xe8eef8, TRACK, 0.35);
      this.tag.visible(false);
      return;
    }
    if (this.state === 'curando') {
      this.clock.show(24, HEAL, TRACK, 0.55 + 0.3 * Math.sin(t * 7));
      this.tag.set('+', '#5bff8a');
      // curándose brilla verde, aunque tenga coraza (el doble): es lo más urgente que hay que ver
      this.body.shine.color = HEAL;
      this.body.shine.k = 0.35 + 0.25 * Math.sin(t * 6);
      return;
    }
    if (this.body.shine.color === HEAL) this.body.shine.k = 0;
    const f = Math.max(0, this.left / this.grace);
    const color = f > 0.5 ? 0xf0f4ff : f > 0.25 ? 0xffa53d : 0xff3b30;
    this.clock.show(24 * f, color, TRACK, 0.8, 0.2);
    this.tag.set(this.left < 1 ? this.left.toFixed(1) : String(Math.ceil(this.left)), f > 0.5 ? '#f0f4ff' : f > 0.25 ? '#ffb15c' : '#ff5a4a');
  }

  /** Para el bot: más urgente cuanto menos le queda al reloj, y mucho si ya se está curando. */
  weight(): number {
    if (!this.body.arrived || this.body.silenced) return 1;
    if (this.state === 'curando') return 5;
    return 1 + 3 * (1 - Math.max(0, this.left) / this.grace);
  }

  dispose(): void {
    this.clock.dispose();
    this.tag.dispose();
  }
}
