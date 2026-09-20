// Animación por capas sobre un AnimationMixer de Three.js.
// Capa inferior (cadera y piernas) y capa superior (columna para arriba) se alimentan de clips
// distintos, partiendo las pistas de cada clip por hueso. Así el personaje camina con un clip y
// toca la flauta con otro. Un "one shot" (roll, ataque) toma el cuerpo entero mientras dura.
import * as THREE from 'three';

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
  private oneShot: { action: THREE.AnimationAction; until: number; freezeAt: number | null } | null = null;
  private time = 0;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    this.upper = collectUpperBones(root);
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
    this.oneShot = { action: a, until: hold ? Infinity : this.time + duration, freezeAt: hold ? freezeAt : null };
    return duration;
  }

  clearOneShot(): void {
    this.oneShot = null;
  }

  /**
   * Deja el cuerpo entero en la pose de un clip en el instante `time`, sin avanzar. Llamándolo en
   * cada cuadro con otro instante se recorre el clip a mano (el backswing sigue al medidor).
   */
  poseOneShot(name: string, time: number): void {
    const a = this.action(name, 'full');
    if (this.oneShot?.action !== a) {
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
    }
    a.paused = true;
    a.time = time;
    this.oneShot = { action: a, until: Infinity, freezeAt: null };
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
  }
}
