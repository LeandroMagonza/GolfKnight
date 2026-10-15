// El ritmo de ráfaga (la coraza, idea de Leandro): arranca con el blindaje alto, que baja solo, y sube de
// golpe cuando le pegás. Hay que esperar la ventana y descargarle todo junto. Tres formas de «subir de
// golpe», para probar:
//   mecha  con el blindaje en 0, el primer golpe prende una mecha: lo que entre hasta que se apaga entra
//          entero, y ahí se cierra al tope. Pegarle antes de tiempo lo cierra en el acto.
//   tope   el primer golpe lo cierra al tope en el acto: un solo golpe por ventana, que sea el más fuerte.
//   suma   cada golpe que entra le suma `bump` al blindaje: mejor pegarle en 0 y con golpes grandes.
// Si se le pasa la ventana sin que le peguen, castiga: tira la lanza a la puerta, o reparte su blindaje a
// la escolta. Y cada vez que se cierra después de una ráfaga pisa fuerte y tira esquirlas a los puestos.
// Desde el 15/10 (Leandro: «si le pegás al blindaje y no lográs pasar, que haga el ataque que te tira metales
// a vos»), la pelota que rebota en el blindaje cerrado le devuelve una esquirla al puesto del golfista.
import * as THREE from 'three';
import { L } from '../../../i18n';
import { GATE_HALF_WIDTH, GATE_Z, heightAt, nearestSpot, TEE_Z } from '../kit';
import type { BossCtx } from '../types';
import { Cuerpo, type Golpe, pickStation, playerInside, targetSpots } from './cuerpo';
import { Dial, plateMesh, Rings, shardMesh, spearMesh, Tag, Volley } from './piezas';

export type CorazaMode = 'mecha' | 'tope' | 'suma';

export interface CorazaOpts {
  mode: CorazaMode;
  /** Qué hace si se le pasa la ventana: tirar la lanza a la puerta, o repartir su blindaje a la escolta. */
  punish: 'lanza' | 'placas';
  /** Dónde se planta: -1 a la izquierda, 1 a la derecha, 0 en cualquier lado (la pareja los separa). */
  side?: number;
  /** El radio de los anillos del piso (el del doble va más afuera, para que entre el reloj de la cura). */
  ring?: number;
  /**
   * La pelota que rebota en el blindaje le devuelve una esquirla al golfista (sí por omisión). En el doble no:
   * ahí tocarlo aunque rebote es lo que se pide (le corta la cura).
   */
  rebote?: boolean;
}

/** Los números de la coraza (ver docs/jefes/ritmo.md). Los pares van del principio al final de la pelea. */
export const CORAZA = {
  /** El blindaje cerrado: más que el mejor golpe (4), así cerrado no le entra nada. */
  top: 5,
  /** Segundos que tarda en bajar cada punto (de 5 a 0 en 5 s). En «tope», más rápido: cada ventana es un golpe solo. */
  drainEvery: 1.0,
  drainEveryTope: 0.7,
  /** mecha: cuánto queda abierto desde el primer golpe en 0, antes de cerrarse de golpe (15/10: era 2.2 a 1.6; Leandro: «está fácil»). */
  fuse: [1.9, 1.4],
  /** Cuánto espera abierto sin que le peguen antes de castigar (15/10: era 4.2 a 2.6). */
  openFor: [3.6, 2.3],
  /** Con cada nivel de dificultad, la ventana sin golpes dura esto menos. */
  levelOpen: 0.08,
  /** suma: cuánto le sube cada golpe que entra, y desde cuánto cuenta como que se cerró (las esquirlas). */
  bump: 2,
  closeAt: 4,
  /** Las esquirlas al cerrarse después de una ráfaga: cuántos puestos, cuánto vuelan, el radio y el daño. */
  shards: [2, 3],
  shardFlight: 1.5,
  shardRadius: 1.4,
  shardDamage: 1,
  /** La lanza a la puerta: el brazo atrás, el vuelo y cuánto le saca. */
  spearWindup: 0.9,
  spearFlight: 1.5,
  spearDamage: 1,
  /** Las placas a la escolta: a cuántos, hasta qué blindaje (el tope de los comunes), a qué distancia y cuánto vuelan. */
  plates: [3, 5],
  plateCap: 2,
  plateRadius: 16,
  plateFlight: 0.9,
  /** Cuánto se queda plantado después de cerrarse, antes de irse a otro lugar (el pisotón). */
  settle: 1.0,
  /**
   * La esquirla de vuelta (la pelota que rebota en el blindaje): al puesto donde está el golfista, lo que
   * vuela (lo justo para cambiarse de puesto), y lo mínimo entre una y otra (si rebotan varias juntas).
   */
  counterFlight: 1.35,
  counterEvery: 1.2,
};

const STEEL = 0x4f8dff;
const GOLD = 0xffc21a;
const FUSE = 0xff5a1f;
const MUTED = 0x6b7480;
const TRACK = 0x1a1f28;

const lerp = (pair: readonly number[], h: number) => pair[0] + (pair[1] - pair[0]) * h;

export class Coraza {
  /** El blindaje, con decimales: el que resta es el redondeado para arriba. */
  armor = CORAZA.top;
  state: 'cerrado' | 'abierto' | 'mecha' = 'cerrado';
  private openT = 0;
  private fuseT = 0;
  private fuseLen = 1;
  private windowHits = 0;
  /** suma: se abrió desde el último cierre (las esquirlas salen una vez por vuelta). */
  private opened = false;
  /** La lanza: en qué punto del brazo va (0 a 1.25), o -1 si no. */
  private spear = -1;
  /** Cuánto falta para irse a otro lugar (-1: no se va). */
  private moveIn = -1;
  /** Cuándo puede devolver la próxima esquirla (ver `counterEvery`). */
  private counterAt = 0;
  private readonly plates: Dial;
  private readonly clock: Dial;
  readonly tag: Tag;
  readonly log = { ventanas: 0, aprovechadas: 0, golpesEnVentana: 0, apurados: 0, castigos: 0, esquirlas: 0, esquirlasPegaron: 0, placas: 0, rebotes: 0, rebotesPegaron: 0 };

  constructor(private readonly ctx: BossCtx, private readonly body: Cuerpo, private readonly o: CorazaOpts, private readonly volley: Volley, private readonly rings: Rings) {
    const r = o.ring ?? 2.6;
    this.plates = new Dial(ctx.scene, CORAZA.top, r, r + 0.7, 0.16);
    this.clock = new Dial(ctx.scene, 24, r + 0.9, r + 1.4, 0);
    this.tag = new Tag(ctx.scene, 1.7);
    body.onLand((g) => this.landed(g));
    body.onTouch((raw, shot) => this.touched(raw, shot));
    this.sync();
  }

  private get heat(): number {
    return Cuerpo.heat(this.ctx);
  }
  /** Cuánto espera abierto sin que le peguen. */
  get openFor(): number {
    return Math.max(1.6, lerp(CORAZA.openFor, this.heat) - this.ctx.level * CORAZA.levelOpen);
  }
  private get drainEvery(): number {
    return this.o.mode === 'tope' ? CORAZA.drainEveryTope : CORAZA.drainEvery;
  }
  /** Cerrado: no conviene pegarle (el bot no le tira). */
  get shut(): boolean {
    return this.state === 'cerrado' && !this.body.silenced;
  }

  update(dt: number): void {
    const e = this.body.e;
    if (!e.alive) {
      this.show();
      return;
    }
    this.updateSpear(dt);
    // silenciado se le apagan los poderes: los relojes quedan quietos y le entra todo (el blindaje lo saca el juego)
    if (this.body.arrived && !this.body.silenced && !this.ctx.over()) {
      if (this.state === 'cerrado') {
        this.armor = Math.max(0, this.armor - dt / this.drainEvery);
        if (this.armor <= 0) this.open();
      } else if (this.state === 'abierto') {
        this.openT += dt;
        if (this.openT >= this.openFor) this.missed();
      } else {
        this.fuseT -= dt;
        if (this.fuseT <= 0) this.close(true);
      }
      if (this.moveIn >= 0 && (this.moveIn -= dt) < 0) {
        const s = pickStation(this.ctx, e.position.x, e.position.z, this.o.side ?? 0);
        this.body.goTo(s.x, s.z);
      }
    }
    this.sync();
    this.show();
  }

  /** El blindaje llegó a 0: la ventana. */
  private open(): void {
    const e = this.body.e;
    this.armor = 0;
    this.state = 'abierto';
    this.openT = 0;
    this.windowHits = 0;
    this.opened = true;
    this.moveIn = -1;
    this.log.ventanas++;
    this.body.stop();
    this.ctx.audio.bubblePop();
    this.rings.add(e.position.x, e.position.z, GOLD, 1.5, 5, 0.5);
  }

  private landed(g: Golpe): void {
    // solo las pelotas que el blindaje mide: lo que lo pasa (fuego, rayo, fantasma) entra sin despertarlo
    if (!g.shot || g.bypass || g.killed || this.body.silenced || !this.body.arrived) return;
    const st = this.state;
    if (st !== 'cerrado' || (this.o.mode === 'suma' && this.opened)) {
      if (this.windowHits++ === 0) this.log.aprovechadas++;
      this.log.golpesEnVentana++;
    }
    switch (this.o.mode) {
      case 'mecha':
        if (st === 'cerrado') {
          this.log.apurados++;
          this.close(true, true);
        } else if (st === 'abierto') {
          this.state = 'mecha';
          this.fuseT = this.fuseLen = lerp(CORAZA.fuse, this.heat);
        }
        break;
      case 'tope':
        if (st === 'cerrado') this.log.apurados++;
        this.close(true, st === 'cerrado');
        break;
      case 'suma': {
        const before = st === 'cerrado' ? this.armor : 0;
        this.armor = Math.min(CORAZA.top, before + CORAZA.bump);
        this.state = 'cerrado';
        this.ctx.audio.armorHit();
        if (before < CORAZA.closeAt && this.armor >= CORAZA.closeAt && this.opened) {
          this.opened = false;
          this.stomp();
          this.moveIn = CORAZA.settle;
        }
        break;
      }
    }
  }

  /**
   * Cada pelota que lo toca, antes del blindaje: si está cerrado y no lo pasa (rebota entera), le devuelve
   * una esquirla al golfista. Lo que sí pasa lo maneja `landed` (en la mecha, lo cierra: «¡Muy pronto!»).
   */
  private touched(raw: number, shot: boolean): void {
    if (this.o.rebote === false || !shot || raw <= 0 || !this.body.arrived || this.body.silenced || this.ctx.over()) return;
    if (this.state !== 'cerrado' || raw > this.body.e.armor) return;
    const now = this.ctx.clock();
    if (now < this.counterAt) return;
    this.counterAt = now + CORAZA.counterEvery;
    this.counter();
  }

  /** La esquirla de vuelta: al puesto donde está parado el golfista, con su marca roja (cambiate de puesto). */
  private counter(): void {
    const e = this.body.e;
    this.log.rebotes++;
    const x = this.ctx.spots()[nearestSpot(this.ctx, this.ctx.player().position.x)];
    const from = e.position.clone().setY(e.position.y + e.height * 0.7);
    this.ctx.audio.ricochet();
    this.rings.add(e.position.x, e.position.z, STEEL, 1.0, 3.5, 0.35);
    this.volley.fire({
      mesh: shardMesh(), from, to: new THREE.Vector3(x, heightAt(x, TEE_Z) + 0.2, TEE_Z), flight: CORAZA.counterFlight, height: 6,
      mark: { color: 0xff3b30, radius: CORAZA.shardRadius },
      land: (at) => {
        this.ctx.effects.explosion(at, CORAZA.shardRadius, 0x8fa3c0);
        this.ctx.audio.bossRock();
        if (this.ctx.over() || !playerInside(this.ctx, at.x, at.z, CORAZA.shardRadius)) return;
        this.log.rebotesPegaron++;
        this.ctx.hitPlayer(CORAZA.shardDamage, at, e);
      },
    });
  }

  /** Se cierra al tope. Con `shards`, pisa fuerte y tira esquirlas; después se va a otro lugar. */
  private close(shards: boolean, early = false, settle: number = CORAZA.settle): void {
    const e = this.body.e;
    this.armor = CORAZA.top;
    this.state = 'cerrado';
    this.opened = false;
    this.ctx.audio.armorHit();
    this.rings.add(e.position.x, e.position.z, STEEL, 1.2, 5.5, 0.45);
    if (early) this.ctx.feedback(L('¡Muy pronto! Se cerró', 'Too early! It closed'));
    if (shards) this.stomp();
    this.moveIn = settle;
  }

  /** Se le pasó la ventana: castiga y se cierra. */
  private missed(): void {
    this.log.castigos++;
    // sin escolta cerca a quien darle las placas, tira la lanza: si no, a solas no tenía con qué apurar a
    // la puerta y se lo podía dejar para el final (15/10, la regla de la puerta: ver docs/jefes.md)
    if (this.o.punish === 'lanza' || !this.sharePlates()) {
      this.spear = 0;
      this.ctx.feedback(L('¡Se te pasó! Tira la lanza a la puerta', 'Missed it! It throws its spear at the gate'));
      this.close(false, false, CORAZA.spearWindup + CORAZA.settle);
    } else this.close(false, false, CORAZA.settle + 0.5);
  }

  /** El pisotón: esquirlas a los puestos (el del golfista y otros), con su marca en el piso. */
  private stomp(): void {
    const e = this.body.e;
    this.body.play('Hard Landing', 1.3);
    const from = e.position.clone().setY(e.position.y + e.height * 0.6);
    const n = Math.round(lerp(CORAZA.shards, this.heat));
    for (const i of targetSpots(this.ctx, n)) {
      const x = this.ctx.spots()[i];
      this.log.esquirlas++;
      this.volley.fire({
        mesh: shardMesh(), from, to: new THREE.Vector3(x, heightAt(x, TEE_Z) + 0.2, TEE_Z), flight: CORAZA.shardFlight, height: 7,
        mark: { color: 0xff3b30, radius: CORAZA.shardRadius },
        land: (at) => {
          this.ctx.effects.explosion(at, CORAZA.shardRadius, 0x8fa3c0);
          this.ctx.audio.bossRock();
          if (this.ctx.over() || !playerInside(this.ctx, at.x, at.z, CORAZA.shardRadius)) return;
          this.log.esquirlasPegaron++;
          this.ctx.hitPlayer(CORAZA.shardDamage, at, e);
        },
      });
    }
    this.ctx.audio.bossThrow();
  }

  /** El brazo atrás y la lanza a la puerta. Silenciado o muerto, no la tira. */
  private updateSpear(dt: number): void {
    if (this.spear < 0) return;
    if (!this.body.alive || this.body.silenced || this.ctx.over()) {
      this.spear = -1;
      this.body.swing = null;
      return;
    }
    const before = this.spear;
    this.spear += dt / (this.spear < 1 ? CORAZA.spearWindup : 0.25 * CORAZA.spearWindup);
    this.body.swing = Math.min(1.25, this.spear);
    if (before < 1 && this.spear >= 1) this.throwSpear();
    if (this.spear >= 1.25) {
      this.spear = -1;
      this.body.swing = null;
    }
  }

  private throwSpear(): void {
    const e = this.body.e;
    const from = e.position.clone().setY(e.position.y + e.height * 0.9);
    const gx = THREE.MathUtils.clamp(e.position.x * 0.3, -GATE_HALF_WIDTH + 1, GATE_HALF_WIDTH - 1);
    this.volley.fire({
      mesh: spearMesh(), from, to: new THREE.Vector3(gx, 1.6, GATE_Z + 0.6), flight: CORAZA.spearFlight, height: 8, aim: true,
      land: (at) => {
        this.ctx.effects.explosion(at, 1.2, 0xb8c0cc);
        if (!this.ctx.over()) this.ctx.hitGate(CORAZA.spearDamage, e);
      },
    });
    this.ctx.audio.bossThrow();
  }

  /**
   * Reparte su blindaje: placas que vuelan a los de la escolta más cercanos, +1 a cada uno hasta el tope
   * de los comunes. Solo a los que no tienen otra defensa (con el etéreo o un escudo quedarían imposibles).
   * False si no había a quién (no hace nada).
   */
  private sharePlates(): boolean {
    const e = this.body.e;
    const n = Math.round(lerp(CORAZA.plates, this.heat));
    const all = this.ctx.horde.enemies;
    const picks = all
      .filter((o) => o !== e && o.alive && !o.passed && !o.stats.boss && o.armorLevel < CORAZA.plateCap
        && !o.hasShield && !o.ethereal && !o.divineEvery && !o.mods.phase && !o.mods.regen && !o.mods.dodge
        // los poderes van en un objeto que podría ser de más de uno: a esos no
        && !all.some((x) => x !== o && x.mods === o.mods)
        && Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) < CORAZA.plateRadius)
      .sort((a, b) => Math.hypot(a.position.x - e.position.x, a.position.z - e.position.z) - Math.hypot(b.position.x - e.position.x, b.position.z - e.position.z))
      .slice(0, n);
    if (!picks.length) return false;
    this.body.play('Rallying', 1.5);
    this.ctx.feedback(L('¡Se te pasó! Reparte su blindaje', 'Missed it! It hands out its armor'));
    const from = e.position.clone().setY(e.position.y + e.height * 0.7);
    for (const o of picks) {
      this.volley.fire({
        mesh: plateMesh(), from, to: o.position.clone(), follow: () => (o.alive && !o.passed ? o.position : null), flight: CORAZA.plateFlight, height: 3, spin: 9,
        land: (at) => {
          if (!o.alive || o.passed) return;
          o.mods.armor = Math.min(CORAZA.plateCap, o.armorLevel + 1);
          this.log.placas++;
          this.ctx.effects.spark(at, STEEL);
          this.ctx.audio.armorHit();
        },
      });
    }
    return true;
  }

  /** El blindaje que resta el juego (el número del yelmo sobre la vida). */
  private sync(): void {
    const e = this.body.e;
    const a = this.state === 'cerrado' ? Math.ceil(this.armor - 1e-6) : 0;
    if ((e.mods.armor ?? 0) !== a) e.mods.armor = a;
  }

  /** El dial del piso, el número sobre la cabeza y el brillo del cuerpo. */
  private show(): void {
    const e = this.body.e;
    const on = e.alive && !this.ctx.over();
    this.plates.visible(on);
    this.clock.visible(on);
    this.tag.visible(on);
    if (!on) {
      this.body.shine.k = 0;
      return;
    }
    const { x, z } = e.position;
    this.plates.at(x, z);
    this.clock.at(x, z);
    this.tag.over(e);
    const t = this.ctx.clock();
    const shine = this.body.shine;
    if (this.body.silenced) {
      this.plates.show(CORAZA.top, MUTED, TRACK, 0.5);
      this.clock.show(0, MUTED, TRACK, 0, 0);
      this.tag.set('0', '#c8ccd2');
      shine.k = 0;
      return;
    }
    if (this.state === 'cerrado') {
      this.plates.show(this.armor, STEEL);
      this.clock.show(0, STEEL, TRACK, 0, 0);
      this.tag.set(String(Math.ceil(this.armor - 1e-6)), '#8fb8ff');
      shine.color = 0x2f5fbf;
      shine.k = 0.1 + 0.15 * (this.armor / CORAZA.top);
    } else if (this.state === 'abierto') {
      this.plates.show(0, GOLD, TRACK, 0.75, 0.25);
      this.clock.show(24 * (1 - this.openT / this.openFor), GOLD, TRACK, 0.85, 0.2);
      this.tag.set(L('¡YA!', 'NOW!'), '#ffd34d');
      shine.color = 0xffa41a;
      shine.k = 0.45 + 0.25 * Math.sin(t * 8);
    } else {
      this.plates.show(0, FUSE, TRACK, 0.75, 0.25);
      this.clock.show(24 * (this.fuseT / this.fuseLen), FUSE, TRACK, 0.9, 0.2);
      this.tag.set(this.fuseT.toFixed(1), '#ff7a4a');
      shine.color = 0xff4a1a;
      shine.k = 0.5 + 0.3 * Math.sin(t * 16);
    }
  }

  /** Para el bot: cuánto le importa pegarle ahora. */
  weight(): number {
    if (!this.body.arrived) return 0.3;
    if (this.body.silenced || this.state !== 'cerrado') return 3;
    // suma: con el blindaje en 1 vale la pena igual
    return this.o.mode === 'suma' && this.armor <= 1 ? 1 : 0;
  }

  dispose(): void {
    this.plates.dispose();
    this.clock.dispose();
    this.tag.dispose();
  }
}

