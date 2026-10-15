// El ritmo del azar (15/10, idea de Leandro: «una ventana que no sepas con anterioridad si vas a tener que
// meter muchos golpes simples o un golpe fuerte: podría por unos segundos tener blindado o fantasma
// aleatoriamente, y en esa ventana tenés que bajarle 1 de vida si está blindado y 3 si está fantasma, o te
// pega a la puerta»). Cada tanto gira una ruleta sobre la cabeza y sale una de las dos:
//   blindado  blindaje 3: lo flojo rebota, y hay que meterle UN golpe fuerte (el 4 deja pasar 1).
//   fantasma  etéreo: cada golpe le saca 1 como mucho, y hay que meterle TRES, rápido.
// Si se cumple, se tambalea y queda sin blindaje un rato (el premio: descargarle). Si no, tira la lanza a la
// puerta. Entre ventana y ventana tiene blindaje 2: lo flojo no le entra, lo fuerte a medias.
import * as THREE from 'three';
import { L } from '../../../i18n';
import { GATE_HALF_WIDTH, GATE_Z } from '../kit';
import type { BossCtx } from '../types';
import { Cuerpo, type Golpe, pickStation } from './cuerpo';
import { Dial, Rings, spearMesh, Volley } from './piezas';

/** Los números del azar (ver docs/jefes/ritmo.md). Los pares van del principio al final de la pelea. */
export const AZAR = {
  /**
   * El blindaje entre ventanas: lo flojo no le entra y lo fuerte entra a medias. Con 1, el bot lo mataba en 70 s
   * habiendo visto una sola ruleta: la pelea tiene que pasar por las ventanas.
   */
  base: 2,
  /** Lo que espera entre una ventana y la próxima ruleta. */
  rest: [4.5, 3.0],
  /** La ruleta: lo que gira antes de decir cuál sale (el aviso), y cuánto se ve cada cara mientras gira. */
  spin: 1.3,
  flip: 0.16,
  /** Lo que dura la ventana, según cuál salió (con cada nivel de dificultad, `levelWindow` menos). */
  window: { blindado: [4.6, 3.6], fantasma: [6.2, 4.8] },
  levelWindow: 0.05,
  /** Lo que hay que sacarle en la ventana. */
  need: { blindado: 1, fantasma: 3 },
  /** El blindaje de la cara blindada: el golpe 4 deja pasar 1, los demás rebotan. */
  armor: 3,
  /** El premio: lo que queda tambaleándose, sin blindaje. */
  reward: 2.5,
  /** La lanza a la puerta: el brazo atrás, el vuelo y cuánto le saca. */
  spearWindup: 0.9,
  spearFlight: 1.5,
  spearDamage: 1,
  /** Cuánto se queda plantado después de cada ventana, antes de irse a otro lugar. */
  settle: 1.0,
};

type Cara = 'blindado' | 'fantasma';

const STEEL = 0x4f8dff;
const GHOST = 0xbfe6ff;
const GOLD = 0xffc21a;
const RED = 0xff5a3c;
const TRACK = 0x1a1f28;
const CSS: Record<Cara, string> = { blindado: '#8fb8ff', fantasma: '#d8f2ff' };

const lerp = (pair: readonly number[], h: number) => pair[0] + (pair[1] - pair[0]) * h;

/**
 * El cartel de arriba de la cabeza: la palabra grande (BLINDADO / FANTASMA, o «¿?» mientras gira) y abajo
 * cuántos golpes pide, uno por cuadradito (se llenan con lo que le sacás).
 */
class Cartel {
  readonly sprite: THREE.Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly tex: THREE.CanvasTexture;
  private last = '';
  constructor(private readonly scene: THREE.Scene) {
    this.canvas.width = 512;
    this.canvas.height = 200;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.sprite.renderOrder = 13;
    this.sprite.scale.set(5.2, (5.2 * 200) / 512, 1);
    scene.add(this.sprite);
  }
  /** `word` en `color`; `need` cuadraditos con `done` llenos (need 0: sin cuadraditos). */
  set(word: string, color: string, need = 0, done = 0, sub = ''): void {
    const key = `${word}|${color}|${need}|${done}|${sub}`;
    if (key === this.last) return;
    this.last = key;
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, 512, 200);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `900 ${word.length > 6 ? 76 : 96}px sans-serif`;
    c.lineWidth = 12;
    c.strokeStyle = '#0b0f14';
    c.strokeText(word, 256, 62);
    c.fillStyle = color;
    c.fillText(word, 256, 62);
    if (need > 0) {
      const size = 44;
      const gap = 14;
      const x0 = 256 - (need * size + (need - 1) * gap) / 2;
      for (let i = 0; i < need; i++) {
        c.beginPath();
        c.roundRect(x0 + i * (size + gap), 128, size, size, 9);
        c.fillStyle = i < done ? '#ffd34d' : 'rgba(10, 14, 20, 0.75)';
        c.fill();
        c.lineWidth = 5;
        c.strokeStyle = color;
        c.stroke();
      }
    } else if (sub) {
      c.font = '800 44px sans-serif';
      c.lineWidth = 9;
      c.strokeText(sub, 256, 150);
      c.fillStyle = color;
      c.fillText(sub, 256, 150);
    }
    this.tex.needsUpdate = true;
  }
  over(x: number, y: number, z: number): void {
    this.sprite.position.set(x, y, z);
  }
  visible(on: boolean): void {
    this.sprite.visible = on;
  }
  dispose(): void {
    this.scene.remove(this.sprite);
    this.tex.dispose();
    this.sprite.material.dispose();
  }
}

export class Azar {
  state: 'calma' | 'ruleta' | 'ventana' | 'premio' = 'calma';
  private t = 0;
  private cara: Cara = 'blindado';
  private len = 1;
  private done = 0;
  /** La lanza: en qué punto del brazo va (0 a 1.25), o -1 si no. */
  private spear = -1;
  private moveIn = -1;
  private readonly quota: Dial;
  private readonly clock: Dial;
  private readonly cartel: Cartel;
  /** Los materiales del cuerpo y su opacidad de siempre (el fantasma se pone traslúcido). */
  private readonly mats: { mat: THREE.Material; opacity: number; transparent: boolean }[] = [];
  private faded = 1;
  readonly log = { ventanas: 0, blindadas: 0, fantasmas: 0, cumplidas: 0, falladas: 0, lanzas: 0 };

  constructor(private readonly ctx: BossCtx, private readonly body: Cuerpo, private readonly volley: Volley, private readonly rings: Rings) {
    this.quota = new Dial(ctx.scene, 3, 2.6, 3.3, 0.2);
    this.clock = new Dial(ctx.scene, 24, 3.5, 4.0, 0);
    this.cartel = new Cartel(ctx.scene);
    body.onLand((g) => this.landed(g));
    body.e.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) this.mats.push({ mat, opacity: mat.opacity, transparent: mat.transparent });
    });
    this.t = AZAR.rest[0];
    this.sync();
  }

  private get heat(): number {
    return Cuerpo.heat(this.ctx);
  }

  update(dt: number): void {
    const e = this.body.e;
    if (!e.alive) {
      this.show();
      return;
    }
    this.updateSpear(dt);
    if (this.body.arrived && !this.ctx.over()) {
      this.t -= dt;
      switch (this.state) {
        case 'calma':
          if (this.t <= 0 && !this.body.walking) this.spin();
          break;
        case 'ruleta':
          if (this.t <= 0) this.reveal();
          break;
        case 'ventana':
          if (this.t <= 0) this.missed();
          break;
        case 'premio':
          if (this.t <= 0) this.calm(AZAR.settle);
          break;
      }
      if (this.moveIn >= 0 && (this.moveIn -= dt) < 0) {
        const s = pickStation(this.ctx, e.position.x, e.position.z);
        this.body.goTo(s.x, s.z);
      }
    }
    this.sync();
    this.show();
  }

  /** Arranca la ruleta: se planta, y gira entre las dos caras. */
  private spin(): void {
    this.state = 'ruleta';
    this.t = AZAR.spin;
    this.moveIn = -1;
    this.body.stop();
    this.cara = this.ctx.rng() < 0.5 ? 'blindado' : 'fantasma';
    this.ctx.audio.casterCast();
    const e = this.body.e;
    this.rings.add(e.position.x, e.position.z, 0xffffff, 1.2, 4.5, 0.5);
  }

  /** Sale la cara: arranca la ventana. */
  private reveal(): void {
    const e = this.body.e;
    this.state = 'ventana';
    this.len = this.t = Math.max(2.2, lerp(AZAR.window[this.cara], this.heat) - this.ctx.level * AZAR.levelWindow);
    this.done = 0;
    this.log.ventanas++;
    if (this.cara === 'blindado') {
      this.log.blindadas++;
      this.ctx.audio.armorHit();
      this.ctx.feedback(L('¡Blindado! Un golpe fuerte', 'Armored! One strong hit'));
    } else {
      this.log.fantasmas++;
      this.ctx.audio.bubbleUp();
      this.ctx.feedback(L('¡Fantasma! Tres golpes', 'Ghost! Three hits'));
    }
    this.rings.add(e.position.x, e.position.z, this.cara === 'blindado' ? STEEL : GHOST, 1.5, 6, 0.55);
  }

  private landed(g: Golpe): void {
    if (this.state !== 'ventana' || g.dealt <= 0) return;
    this.done += g.dealt;
    const need = AZAR.need[this.cara];
    if (this.done < need) {
      this.ctx.audio.zap();
      return;
    }
    // ¡cumplido! se tambalea y queda sin blindaje un rato
    this.log.cumplidas++;
    this.state = 'premio';
    this.t = AZAR.reward;
    const e = this.body.e;
    // se queda plantado (el premio no lo mueve; con `body.stop`, no con `stunFor`: hasta el 15/10 el juego no le
    // descontaba el aturdido al que mueve su guion y quedaba aturdido para siempre)
    this.body.stop();
    this.body.play('Hit', 1);
    this.ctx.audio.bubblePop();
    this.rings.add(e.position.x, e.position.z, GOLD, 1.5, 6.5, 0.6);
    this.ctx.feedback(L('¡Bien! Descargale', 'Nice! Unload on it'));
  }

  /** Se le pasó la ventana: tira la lanza a la puerta. */
  private missed(): void {
    this.log.falladas++;
    this.spear = 0;
    this.ctx.feedback(this.cara === 'blindado'
      ? L('¡No pasó el blindaje! Lanza a la puerta', "Didn't break the armor! Spear at the gate")
      : L('¡Faltaron golpes! Lanza a la puerta', 'Not enough hits! Spear at the gate'));
    this.calm(AZAR.spearWindup + AZAR.settle);
  }

  private calm(settle: number): void {
    this.state = 'calma';
    this.t = lerp(AZAR.rest, this.heat);
    this.moveIn = settle;
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
    this.spear += dt / (this.spear < 1 ? AZAR.spearWindup : 0.25 * AZAR.spearWindup);
    this.body.swing = Math.min(1.25, this.spear);
    if (before < 1 && this.spear >= 1) this.throwSpear();
    if (this.spear >= 1.25) {
      this.spear = -1;
      this.body.swing = null;
    }
  }

  private throwSpear(): void {
    const e = this.body.e;
    this.log.lanzas++;
    const from = e.position.clone().setY(e.position.y + e.height * 0.9);
    const gx = THREE.MathUtils.clamp(e.position.x * 0.3, -GATE_HALF_WIDTH + 1, GATE_HALF_WIDTH - 1);
    this.volley.fire({
      mesh: spearMesh(), from, to: new THREE.Vector3(gx, 1.6, GATE_Z + 0.6), flight: AZAR.spearFlight, height: 8, aim: true,
      land: (at) => {
        this.ctx.effects.explosion(at, 1.2, 0xb8c0cc);
        if (!this.ctx.over()) this.ctx.hitGate(AZAR.spearDamage, e);
      },
    });
    this.ctx.audio.bossThrow();
  }

  /** Lo que el juego lee: el blindaje y el etéreo de la cara de ahora. */
  private sync(): void {
    const m = this.body.e.mods;
    const armor = this.state === 'premio' ? 0 : this.state === 'ventana' && this.cara === 'blindado' ? AZAR.armor : AZAR.base;
    const ghost = this.state === 'ventana' && this.cara === 'fantasma';
    if ((m.armor ?? 0) !== armor) m.armor = armor;
    if (!!m.ethereal !== ghost) m.ethereal = ghost;
  }

  /** El cartel, los diales del piso, el brillo y lo traslúcido del fantasma. */
  private show(): void {
    const e = this.body.e;
    const on = e.alive && !this.ctx.over();
    this.quota.visible(on && this.state === 'ventana');
    this.clock.visible(on && (this.state === 'ventana' || this.state === 'ruleta'));
    this.cartel.visible(on);
    const ghostly = on && this.state === 'ventana' && this.cara === 'fantasma';
    this.fade(ghostly ? 0.45 : 1);
    if (!on) {
      this.body.shine.k = 0;
      return;
    }
    const { x, z } = e.position;
    this.quota.at(x, z);
    this.clock.at(x, z);
    this.cartel.over(x, e.position.y + e.height + 2.2, z);
    const now = this.ctx.clock();
    const shine = this.body.shine;
    switch (this.state) {
      case 'calma': {
        this.cartel.visible(false);
        shine.k = 0;
        break;
      }
      case 'ruleta': {
        // gira entre las dos caras, cada vez más lento: no se sabe cuál sale hasta el final
        const u = 1 - this.t / AZAR.spin;
        const face: Cara = Math.floor((u * u * AZAR.spin) / AZAR.flip) % 2 === 0 ? 'blindado' : 'fantasma';
        this.cartel.set('¿?', CSS[face], 0, 0, face === 'blindado' ? L('blindado', 'armored') : L('fantasma', 'ghost')); // i18n-ok: signos
        this.clock.show(24 * (this.t / AZAR.spin), 0xffffff, TRACK, 0.8, 0.2);
        shine.color = face === 'blindado' ? STEEL : GHOST;
        shine.k = 0.25 + 0.2 * Math.sin(now * 20);
        break;
      }
      case 'ventana': {
        const need = AZAR.need[this.cara];
        const word = this.cara === 'blindado' ? L('BLINDADO', 'ARMORED') : L('FANTASMA', 'GHOST');
        this.cartel.set(word, CSS[this.cara], need, Math.min(need, this.done));
        // el reloj de la ventana: se vacía; en rojo el último segundo
        const left = this.t / this.len;
        this.clock.show(24 * left, this.t < 1 ? RED : this.cara === 'blindado' ? STEEL : GHOST, TRACK, 0.85, 0.2);
        this.quota.show(Math.min(need, this.done) * (3 / need), GOLD, TRACK, 0.8, 0.3);
        shine.color = this.cara === 'blindado' ? 0x2f5fbf : 0x6fa8c8;
        shine.k = 0.3 + 0.15 * Math.sin(now * 6);
        break;
      }
      case 'premio': {
        this.cartel.set(L('¡YA!', 'NOW!'), '#ffd34d');
        this.clock.visible(false);
        shine.color = 0xffa41a;
        shine.k = 0.45 + 0.25 * Math.sin(now * 8);
        break;
      }
    }
  }

  /** Traslúcido (el fantasma) o como siempre. */
  private fade(to: number): void {
    if (Math.abs(this.faded - to) < 0.01) return;
    this.faded = to;
    for (const m of this.mats) {
      m.mat.transparent = to < 1 ? true : m.transparent;
      m.mat.opacity = to < 1 ? m.opacity * to : m.opacity;
    }
  }

  /** Para el bot: cuánto le importa pegarle ahora. */
  weight(): number {
    if (!this.body.arrived) return 0.3;
    if (this.state === 'ventana' || this.state === 'premio') return 4;
    return 1;
  }

  dispose(): void {
    this.fade(1);
    this.quota.dispose();
    this.clock.dispose();
    this.cartel.dispose();
  }
}
