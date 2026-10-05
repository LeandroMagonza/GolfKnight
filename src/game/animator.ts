// Animación por capas sobre un AnimationMixer de Three.js.
// Capa inferior (cadera y piernas) y capa superior (columna para arriba) se alimentan de clips
// distintos, partiendo las pistas de cada clip por hueso. Así el personaje camina con un clip y
// toca la flauta con otro. Un "one shot" (roll, ataque) toma el cuerpo entero mientras dura.
import * as THREE from 'three';
import type { AnimState } from '../net/snapshot';

type Layer = 'lower' | 'upper' | 'full';

/** Huesos de la columna para arriba: el primer hueso cuyo nombre termina en "Spine" y sus descendientes. */
export function collectUpperBones(root: THREE.Object3D): Set<string> {
  const set = new Set<string>();
  let spine: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!spine && /Spine$/.test(o.name)) spine = o;
  });
  spine?.traverse((o) => set.add(o.name));
  return set;
}

function trackNode(track: THREE.KeyframeTrack): string {
  return track.name.slice(0, track.name.lastIndexOf('.'));
}

function subClip(clip: THREE.AnimationClip, keep: (node: string) => boolean, suffix: string): THREE.AnimationClip {
  return new THREE.AnimationClip(clip.name + suffix, clip.duration, clip.tracks.filter((t) => keep(trackNode(t))));
}

export class LayeredAnimator {
  readonly mixer: THREE.AnimationMixer;
  fadeTime = 0.15;
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly targets = new Map<THREE.AnimationAction, number>();
  private readonly upper: Set<string>;
  private locomotion = '';
  private locoScale = 1;
  private override: string | null = null;
  private oneShot: { action: THREE.AnimationAction; until: number; freezeAt: number | null; upper?: boolean; name: string } | null = null;
  /**
   * Las piernas, aparte del clip posado con `poseOneShot`: con un clip de locomoción acá, ese clip mueve
   * solo de la cintura para arriba y las piernas siguen corriendo (el tenista que se prepara corriendo).
   */
  legs: { name: string; timeScale: number } | null = null;
  /**
   * Con las piernas aparte (`legs`), la cadera mantiene el giro del clip de arriba en vez del de las
   * piernas. La postura de golf gira la cadera 90° para mirar la pelota y el clip de caminar la pone
   * derecha: sin esto, el golfista que da pasitos con la pelota se daba vuelta entero, torso incluido.
   */
  keepHips = false;
  /** La cadera: el padre de la columna. */
  private readonly hips: THREE.Object3D | null;
  /** El giro de la cadera de cada clip, para `keepHips`. */
  private readonly hipsTracks = new Map<string, THREE.Interpolant | null>();
  /** La acción de las piernas que se usó por última vez, para seguir corrigiendo la cadera mientras se apaga. */
  private legsAction: THREE.AnimationAction | null = null;
  private time = 0;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    this.upper = collectUpperBones(root);
    let spine: THREE.Object3D | undefined;
    root.traverse((o) => {
      if (!spine && /Spine$/.test(o.name)) spine = o;
    });
    this.hips = spine?.parent ?? null;
    for (const c of clips) this.clips.set(c.name, c);
  }

  get clipList(): THREE.AnimationClip[] {
    return [...this.clips.values()];
  }

  has(name: string): boolean {
    return this.clips.has(name);
  }

  get busy(): boolean {
    return this.oneShot !== null;
  }

  private action(name: string, layer: Layer): THREE.AnimationAction {
    const key = `${name}:${layer}`;
    let a = this.actions.get(key);
    if (!a) {
      const base = this.clips.get(name);
      if (!base) throw new Error(`clip "${name}" no existe`);
      const clip = layer === 'full' ? base : subClip(base, (n) => this.upper.has(n) === (layer === 'upper'), ':' + layer);
      a = this.mixer.clipAction(clip);
      a.setEffectiveWeight(0);
      a.play();
      this.actions.set(key, a);
      this.targets.set(a, 0);
    }
    return a;
  }

  setLocomotion(name: string, timeScale = 1): void {
    if (name !== this.locomotion && this.upper.size) {
      // Las dos mitades del mismo clip tienen que ir en fase.
      this.action(name, 'upper').syncWith(this.action(name, 'lower'));
    }
    this.locomotion = name;
    this.locoScale = timeScale;
  }

  setUpperOverride(name: string | null): void {
    this.override = name;
  }

  clipDuration(name: string): number {
    return this.clips.get(name)?.duration ?? 0;
  }

  /**
   * Reproduce un clip de cuerpo entero una vez. Devuelve su duración real en segundos.
   * Con hold, el clip queda fijo hasta que se pida otra cosa (muerte, domado); freezeAt (0..1)
   * elige en qué fracción del clip congelarlo, por defecto el último cuadro.
   */
  playOneShot(name: string, timeScale = 1, hold = false, freezeAt: number | null = null): number {
    const a = this.action(name, 'full');
    a.reset();
    a.paused = false;
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = timeScale;
    a.play();
    const duration = a.getClip().duration / timeScale;
    this.oneShot = { action: a, until: hold ? Infinity : this.time + duration, freezeAt: hold ? freezeAt : null, name };
    return duration;
  }

  /** Un clip de cuerpo entero en loop, arrancando en el segundo `from`, hasta que se pida otra cosa (el festejo). */
  playLoop(name: string, from = 0, timeScale = 1): void {
    const a = this.action(name, 'full');
    a.reset();
    a.paused = false;
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.timeScale = timeScale;
    a.time = from;
    a.play();
    this.oneShot = { action: a, until: Infinity, freezeAt: null, name };
  }

  clearOneShot(): void {
    this.oneShot = null;
  }

  /**
   * Deja el cuerpo entero en la pose de un clip en el instante `time`, sin avanzar. Llamándolo en
   * cada cuadro con otro instante se recorre el clip a mano (el backswing sigue al medidor).
   */
  poseOneShot(name: string, time: number): void {
    const upper = !!this.legs && this.upper.size > 0;
    const a = this.action(name, upper ? 'upper' : 'full');
    if (this.oneShot?.action !== a) {
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
    }
    a.paused = true;
    a.time = time;
    this.oneShot = { action: a, until: Infinity, freezeAt: null, upper, name };
  }

  /** Lo que está mostrando, para el espectador (ver net/). */
  get state(): AnimState {
    const o = this.oneShot;
    return {
      l: this.locomotion,
      ls: Math.round(this.locoScale * 100) / 100,
      ...(this.keepHips ? { kh: true } : {}),
      legs: this.legs ? [this.legs.name, Math.round(this.legs.timeScale * 100) / 100] : null,
      s: o ? [o.name, Math.round(o.action.time * 1000) / 1000, o.action.paused ? 0 : o.action.timeScale, !!o.upper] : null,
    };
  }

  /**
   * El espectador: muestra lo que mostraba el del que juega. El clip de cuerpo entero sigue solo a su
   * velocidad, y se corrige si se fue de tiempo; el que está quieto en un instante se pone en ese instante.
   */
  applyState(s: AnimState): void {
    if (s.l && this.clips.has(s.l)) this.setLocomotion(s.l, s.ls);
    this.keepHips = !!s.kh;
    this.legs = s.legs && this.clips.has(s.legs[0]) ? { name: s.legs[0], timeScale: s.legs[1] } : null;
    if (!s.s || !this.clips.has(s.s[0])) {
      this.oneShot = null;
      return;
    }
    const [name, time, speed, upper] = s.s;
    const a = this.action(name, upper && this.upper.size ? 'upper' : 'full');
    if (this.oneShot?.action !== a) {
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
      a.time = time;
      this.oneShot = { action: a, until: Infinity, freezeAt: null, upper: upper && this.upper.size > 0, name };
    } else if (speed === 0 || Math.abs(a.time - time) > 0.15) {
      a.time = time;
    }
    a.paused = speed === 0;
    if (speed) a.timeScale = speed;
  }

  /** Suelta el clip que estaba posado con poseOneShot: sigue desde `from` a la velocidad dada. */
  resumeOneShot(from: number, timeScale: number): void {
    if (!this.oneShot) return;
    const a = this.oneShot.action;
    a.paused = false;
    a.time = from;
    a.timeScale = timeScale;
  }

  /** Instante actual del clip de cuerpo entero en curso, o -1 si no hay. */
  get oneShotTime(): number {
    return this.oneShot ? this.oneShot.action.time : -1;
  }

  setOneShotSpeed(timeScale: number): void {
    if (this.oneShot) this.oneShot.action.timeScale = timeScale;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.oneShot && this.time >= this.oneShot.until) this.oneShot = null;
    if (this.oneShot?.freezeAt != null && this.oneShot.action.time >= this.oneShot.freezeAt * this.oneShot.action.getClip().duration) {
      this.oneShot.action.paused = true;
    }
    for (const a of this.targets.keys()) this.targets.set(a, 0);

    if (this.oneShot) {
      this.targets.set(this.oneShot.action, 1);
      // el clip va solo arriba: las piernas, con su locomoción (o quietas, si ya no corre)
      if (this.oneShot.upper) {
        const legs = this.action(this.legs?.name ?? 'Idle', 'lower');
        legs.timeScale = this.legs?.timeScale ?? 1;
        this.targets.set(legs, 1);
        this.legsAction = legs;
      }
    } else if (this.locomotion) {
      if (!this.upper.size) {
        const full = this.action(this.locomotion, 'full');
        full.timeScale = this.locoScale;
        this.targets.set(full, 1);
      } else {
        const lower = this.action(this.locomotion, 'lower');
        const upperLoco = this.action(this.locomotion, 'upper');
        lower.timeScale = upperLoco.timeScale = this.locoScale;
        this.targets.set(lower, 1);
        if (this.override) {
          this.targets.set(this.action(this.override, 'upper'), 1);
        } else {
          this.targets.set(upperLoco, 1);
        }
      }
    }

    const k = Math.min(1, dt / this.fadeTime);
    for (const [a, target] of this.targets) {
      const w = a.getEffectiveWeight();
      const next = w + (target - w) * k;
      a.setEffectiveWeight(Math.abs(next - target) < 0.01 ? target : next);
    }
    this.mixer.update(dt);
    // la cadera, con el giro del clip de arriba en la medida en que pesan las piernas aparte
    if (this.keepHips && this.hips && this.oneShot && this.legsAction) {
      const w = this.legsAction.getEffectiveWeight();
      const q = w > 0.001 ? this.hipsAt(this.oneShot.name, this.oneShot.action.time) : null;
      if (q) this.hips.quaternion.slerp(q, Math.min(1, w));
    }
  }

  private readonly hipsQ = new THREE.Quaternion();

  /** El giro de la cadera en el clip `name` en el instante `time`, o null si el clip no la mueve. */
  private hipsAt(name: string, time: number): THREE.Quaternion | null {
    let it = this.hipsTracks.get(name);
    if (it === undefined) {
      const track = this.hips && this.clips.get(name)?.tracks.find((t) => t.name === `${this.hips!.name}.quaternion`);
      it = track ? new THREE.QuaternionLinearInterpolant(track.times, track.values, 4, new Float32Array(4)) : null;
      this.hipsTracks.set(name, it);
    }
    return it ? this.hipsQ.fromArray(it.evaluate(time) as unknown as number[]) : null;
  }
}
