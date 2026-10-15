// El pulso de la pelea con música: dónde cae cada beat y cuánto le erró un tiro. Y el anillo que late a
// los pies del golfista, que muestra la ventana (cuándo soltar).
//
// Dos relojes, uno solo a la vez:
// - **El audio** (lo normal): la canción del jefe marca cada pulso que agenda en su grilla (ver
//   audio/music/beat.ts), en la hora del audio. «Ahora» es lo que sale por el parlante: la hora del audio
//   menos la latencia de salida. Así la ventana se mide contra lo que se escucha, aunque el juego ande
//   trabado o en la congelada del golpe perfecto. En pausa el transporte se pausa con el juego.
// - **El del juego**: sin audio (no arrancó, el navegador no lo deja), con ?liviano (el bot a x8: el audio
//   iría a otro ritmo que el juego) o mientras carga la canción. Los pulsos los marca este mismo reloj, con
//   los segundos de juego, al tempo pedido.
// El jefe pide el tempo en los dos (`want`), así al pasar de uno al otro sigue igual.
import * as THREE from 'three';
import * as Tone from 'tone';
import { BeatGrid, type Beat } from '../../../audio/music/beat';
import { heightAt } from '../kit';
import type { BossCtx } from '../types';

/** ?liviano: el juego corre a pasos fijos, más rápido que el audio (las tandas del bot). */
const LIGHT = typeof location !== 'undefined' && new URLSearchParams(location.search).has('liviano');

export type Fuente = 'audio' | 'juego';

export class Pulso {
  private readonly game: BeatGrid;
  private gameT = 0;
  private gameNext = 0.5;
  private want: { bpm: number; phase: number };
  private audioGrid: BeatGrid | null = null;

  constructor(private readonly ctx: BossCtx, private readonly songId: string, bpm: number) {
    this.game = new BeatGrid(bpm);
    this.game.driven = true;
    this.want = { bpm, phase: 0 };
  }

  /** Pide tempo y fase (entran al empezar el compás siguiente). */
  ask(bpm: number, phase: number): void {
    this.want = { bpm, phase };
    this.game.want(bpm, phase);
    this.audioGrid?.want(bpm, phase);
  }

  /** Cada cuadro de juego: el reloj del juego marca sus pulsos (un poco adelante, como la canción). */
  update(dt: number): void {
    this.gameT += dt;
    while (this.gameNext <= this.gameT + 0.2) {
      const b = this.game.mark(this.gameNext);
      this.gameNext += 60 / b.bpm;
    }
    // la grilla de la canción, cuando ya suena: la maneja el jefe desde ahí
    const g = LIGHT || !this.ctx.audio.ready ? null : this.ctx.audio.music.beatOf(this.songId);
    if (g && g !== this.audioGrid) {
      g.driven = true;
      g.want(this.want.bpm, this.want.phase);
    }
    this.audioGrid = g;
  }

  /** Lo que sale por el parlante ahora, en la hora del audio. */
  private heard(): number {
    const raw = Tone.getContext().rawContext as AudioContext;
    const lat = Math.min(0.3, Math.max(0, (raw.outputLatency || 0) + (raw.baseLatency || 0)));
    return raw.currentTime - lat;
  }

  /** ¿Se puede usar la canción? Suena, el transporte anda y sus pulsos están al día. */
  private audioLive(): number | null {
    const g = this.audioGrid;
    if (!g?.last) return null;
    const ctx = Tone.getContext();
    if (ctx.state !== 'running' || Tone.getTransport().state !== 'started') return null;
    const now = this.heard();
    // el último marcado va un poco adelante de lo que se oye; si quedó muy atrás (pausa, se cortó), no vale
    return now - g.last.t < 1.2 && g.last.t - now < 1 ? now : null;
  }

  /** La grilla que vale, la hora en ella y de cuál reloj es. */
  current(): { grid: BeatGrid; now: number; fuente: Fuente } {
    const now = this.audioLive();
    if (now !== null) return { grid: this.audioGrid!, now, fuente: 'audio' };
    return { grid: this.game, now: this.gameT, fuente: 'juego' };
  }

  /** El tempo que suena (el del último pulso). */
  get bpm(): number {
    return this.current().grid.bpm;
  }
}

/** Cuánto va del pulso `p` al siguiente (0 a 1), y lo que dura ese pulso. */
export function beatPhase(grid: BeatGrid, now: number): { f: number; len: number; prev: Beat | null; next: Beat | null } {
  const prev = grid.prev(now);
  const next = grid.next(now);
  if (!prev || !next) return { f: 0, len: 0.6, prev, next };
  const len = Math.max(0.05, next.t - prev.t);
  return { f: THREE.MathUtils.clamp((now - prev.t) / len, 0, 1), len, prev, next };
}

const ringGeo = new THREE.RingGeometry(0.9, 1, 56);
const thinGeo = new THREE.RingGeometry(0.95, 1, 56);
const discGeo = new THREE.CircleGeometry(1, 40);

/**
 * El anillo del beat, a los pies del golfista (se lee desde la cámara alta): un aro fijo, y otro que se
 * cierra sobre él y llega justo en el beat (como en los juegos de ritmo). Mientras dura la ventana el aro
 * fijo se prende dorado. Al soltar, un destello: dorado si fue a tiempo, rojo si fue pifia.
 */
export class Anillo {
  private readonly group = new THREE.Group();
  private readonly fixedMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  private readonly closeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  private readonly waveMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  private readonly flashMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  private readonly fixed = new THREE.Mesh(ringGeo, this.fixedMat);
  private readonly closing = new THREE.Mesh(thinGeo, this.closeMat);
  private readonly wave = new THREE.Mesh(thinGeo, this.waveMat);
  private readonly flash = new THREE.Mesh(discGeo, this.flashMat);
  private waveAge = 9;
  private flashAge = 9;
  /** El radio del aro fijo. */
  constructor(private readonly scene: THREE.Scene, private readonly radius = 1.45) {
    for (const m of [this.fixed, this.closing, this.wave, this.flash]) {
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      this.group.add(m);
    }
    this.flash.position.y = -0.01;
    scene.add(this.group);
    this.show(false);
  }

  show(on: boolean): void {
    this.group.visible = on;
  }

  /** Cayó un beat: la onda que sale del aro. */
  beat(strong: boolean): void {
    this.waveAge = 0;
    this.waveMat.color.setHex(strong ? 0xffe8a0 : 0xffd36a);
  }

  /** Soltaste: a tiempo (dorado) o pifia (rojo). */
  release(ok: boolean): void {
    this.flashAge = 0;
    this.flashMat.color.setHex(ok ? 0xffd36a : 0xff3b2f);
  }

  /**
   * Cada cuadro: dónde (los pies del golfista), cuánto va del beat (`f`, de 0 a 1), y si estamos en la
   * ventana. `win` es la ventana como fracción del beat (para el ancho del aro que se cierra).
   */
  update(dt: number, x: number, z: number, f: number, inWindow: boolean): void {
    this.group.position.set(x, heightAt(x, z) + 0.07, z);
    const r = this.radius;
    this.fixed.scale.setScalar(inWindow ? r * 1.06 : r);
    this.fixedMat.opacity = inWindow ? 0.95 : 0.38;
    this.fixedMat.color.setHex(inWindow ? 0xfff0a8 : 0xffd36a);
    // el que se cierra: de 2.6 veces el aro a el aro, justo en el beat
    const k = 1 + 1.6 * (1 - f) * (1 - f * 0.25);
    this.closing.scale.setScalar(r * k);
    this.closeMat.opacity = 0.15 + 0.65 * f;
    this.waveAge += dt;
    const w = Math.min(1, this.waveAge / 0.3);
    this.wave.scale.setScalar(r * (1 + 0.5 * w));
    this.waveMat.opacity = this.waveAge < 0.3 ? 0.8 * (1 - w) : 0;
    this.flashAge += dt;
    const u = Math.min(1, this.flashAge / 0.35);
    this.flash.scale.setScalar(r * (0.6 + 0.6 * u));
    this.flashMat.opacity = this.flashAge < 0.35 ? 0.55 * (1 - u) : 0;
  }

  dispose(): void {
    this.scene.remove(this.group);
    for (const m of [this.fixedMat, this.closeMat, this.waveMat, this.flashMat]) m.dispose();
  }
}
