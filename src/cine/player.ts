// El reproductor: dado un segundo del guion, deja la escena, la cámara y los textos exactamente como
// tienen que estar en ese instante. No simula nada cuadro a cuadro, así que saltar hacia atrás o hacia
// adelante da el mismo resultado que llegar reproduciendo.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { keepOnlyMesh, skinnedHeight } from '../game/models';
import { buildProp, buildSets, type CineSet, type Params, type Prop } from './sets';
import type { ActorCue, AnimKey, CamKey, LookAt, PathKey, Ramp, Script, SetId, Shot, TextCue } from './types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => u * u * (3 - 2 * u);
const DEG = Math.PI / 180;
/** Cuánto tarda un actor en girar hacia donde marca el tramo nuevo. */
const TURN_TIME = 0.35;

interface Actor {
  id: string;
  root: THREE.Group;
  height: number;
  mixer?: THREE.AnimationMixer;
  actions?: Map<string, THREE.AnimationAction>;
  hand?: THREE.Object3D;
  prop?: Prop;
}

export interface Models {
  dungeon: GLTF;
  mage: GLTF;
  club: THREE.Object3D | null;
}

export class CinePlayer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  readonly duration: number;
  private readonly sets: Record<SetId, CineSet>;
  private readonly actors = new Map<string, Actor>();
  private readonly starts: number[] = [];
  private readonly textEls = new Map<TextCue, HTMLElement>();
  private currentSet: SetId | null = null;
  private readonly fadeEl: HTMLElement;
  private readonly flashEl: HTMLElement;

  constructor(private readonly script: Script, models: Models, private readonly layer: HTMLElement) {
    this.sets = buildSets();
    for (const s of Object.values(this.sets)) {
      s.group.visible = false;
      this.scene.add(s.group);
    }
    let t = 0;
    for (const shot of script.shots) {
      this.starts.push(t);
      t += shot.dur;
    }
    this.duration = t;
    for (const [id, entry] of Object.entries(script.cast)) {
      const root = new THREE.Group();
      root.visible = false;
      this.scene.add(root);
      if (entry.kind === 'prop') {
        const prop = buildProp(entry.build, entry.build === 'club' ? models.club?.clone() ?? null : null);
        root.add(prop.object);
        this.actors.set(id, { id, root, height: 1, prop });
        continue;
      }
      const gltf = entry.model === 'mage' ? models.mage : models.dungeon;
      const model = cloneSkinned(gltf.scene);
      if (entry.mesh) keepOnlyMesh(model, entry.mesh);
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.frustumCulled = false;
        m.castShadow = true;
        m.receiveShadow = true;
        // como en el juego: los materiales vienen metálicos del export y brillan como cromo con cualquier luz
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.metalness = 0;
        mat.roughness = 0.85;
      });
      model.scale.multiplyScalar(entry.height / skinnedHeight(model));
      root.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const actions = new Map<string, THREE.AnimationAction>();
      for (const clip of gltf.animations) {
        const a = mixer.clipAction(clip);
        a.play();
        a.setEffectiveWeight(0);
        actions.set(clip.name, a);
      }
      const hand = model.getObjectByName('mixamorigRightHand') ?? undefined;
      this.actors.set(id, { id, root, height: entry.height, mixer, actions, hand });
    }
    this.fadeEl = this.overlay('#000');
    this.flashEl = this.overlay('#fff');
  }

  private overlay(color: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'veil';
    el.style.background = color;
    this.layer.appendChild(el);
    return el;
  }

  /** En qué plano cae el segundo `t` del guion, y cuánto va de ese plano. */
  locate(t: number): { index: number; shot: Shot; local: number } {
    let index = 0;
    while (index + 1 < this.starts.length && t >= this.starts[index + 1]) index++;
    return { index, shot: this.script.shots[index], local: t - this.starts[index] };
  }

  get shotStarts(): readonly number[] {
    return this.starts;
  }

  /** Deja todo como está en el segundo `t`. */
  evaluate(t: number): void {
    const { shot, local } = this.locate(Math.max(0, Math.min(this.duration - 1e-4, t)));
    const params = rampValues(shot.ramps ?? [], local);

    if (this.currentSet !== shot.set) {
      if (this.currentSet) this.sets[this.currentSet].group.visible = false;
      const set = this.sets[shot.set];
      set.group.visible = true;
      this.scene.background = set.background;
      this.scene.fog = set.fog;
      this.currentSet = shot.set;
    }
    this.sets[shot.set].update(t, params);

    const cues = shot.actors ?? {};
    for (const actor of this.actors.values()) {
      const cue = cues[actor.id];
      actor.root.visible = !!cue && (!cue.show || (local >= cue.show[0] && local < cue.show[1]));
      if (!cue || !actor.root.visible) continue;
      if (!cue.hold) placeOnPath(actor.root, cue.path, local);
      if (actor.mixer && cue.anim?.length) {
        evalAnim(actor, cue.anim, local);
        actor.root.updateMatrixWorld(true);
      }
      actor.prop?.update(t, scoped(params, actor.id));
    }
    // lo que va en la mano se ubica después, cuando la mano ya está en su lugar
    for (const actor of this.actors.values()) {
      const cue = cues[actor.id];
      if (!cue?.hold || !actor.root.visible) continue;
      const holder = this.actors.get(cue.hold);
      if (holder?.hand) holdInHand(actor.root, holder);
    }

    this.placeCamera(shot.camera, local, params.shake ?? 0, t);
    this.fadeEl.style.opacity = String(clamp01(params.fade ?? 0));
    this.flashEl.style.opacity = String(clamp01(params.flash ?? 0));
    this.placeText(shot, local);
  }

  private resolveLook(look: LookAt, out: THREE.Vector3): THREE.Vector3 {
    if (Array.isArray(look)) return out.set(look[0], look[1], look[2]);
    const a = this.actors.get(look.actor);
    if (!a) return out.set(0, 1, 0);
    return out.set(a.root.position.x + (look.dx ?? 0), a.root.position.y + (look.y ?? a.height * 0.85), a.root.position.z + (look.dz ?? 0));
  }

  private placeCamera(keys: CamKey[], local: number, shake: number, t: number): void {
    let i = 0;
    while (i + 1 < keys.length && local >= keys[i + 1].at) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const u = b === a ? 0 : smooth(clamp01((local - a.at) / (b.at - a.at)));
    const pa = new THREE.Vector3(...a.pos);
    const pb = new THREE.Vector3(...b.pos);
    this.camera.position.lerpVectors(pa, pb, u);
    const la = this.resolveLook(a.look, new THREE.Vector3());
    const lb = this.resolveLook(b.look, new THREE.Vector3());
    const look = la.lerp(lb, u);
    if (shake > 0) {
      const n = (f: number, s: number) => Math.sin(t * f + s) * Math.sin(t * f * 0.71 + s * 2);
      this.camera.position.x += n(47, 1) * shake * 0.12;
      this.camera.position.y += n(53, 2) * shake * 0.12;
      look.x += n(41, 3) * shake * 0.2;
    }
    this.camera.lookAt(look);
    const fov = THREE.MathUtils.lerp(a.fov ?? 40, b.fov ?? a.fov ?? 40, u);
    if (fov !== this.camera.fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private placeText(shot: Shot, local: number): void {
    const width = this.layer.clientWidth;
    const height = this.layer.clientHeight;
    for (const [cue, el] of this.textEls) {
      if (!shot.text?.includes(cue)) el.style.opacity = '0';
    }
    for (const cue of shot.text ?? []) {
      let el = this.textEls.get(cue);
      if (!el) {
        el = document.createElement('div');
        el.className = `cue ${cue.kind}`;
        el.textContent = cue.text;
        this.layer.appendChild(el);
        this.textEls.set(cue, el);
      }
      const inside = local >= cue.at && local < cue.until;
      const fade = Math.min(clamp01((local - cue.at) / 0.25), clamp01((cue.until - local) / 0.25));
      el.style.opacity = inside ? String(fade) : '0';
      if (cue.kind === 'say' && cue.who && inside) {
        const a = this.actors.get(cue.who);
        if (!a) continue;
        const head = new THREE.Vector3(a.root.position.x, a.root.position.y + a.height + 0.35, a.root.position.z).project(this.camera);
        const x = (head.x * 0.5 + 0.5) * width;
        const y = (-head.y * 0.5 + 0.5) * height;
        el.style.left = `${Math.max(120, Math.min(width - 120, x))}px`;
        el.style.top = `${Math.max(90, y)}px`;
      }
    }
  }
}

/** Los números del plano en `local`: cada rampa manda desde que empieza; antes de la primera vale su `from`. */
function rampValues(ramps: Ramp[], local: number): Params {
  const out: Params = {};
  const byParam = new Map<string, Ramp[]>();
  for (const r of ramps) {
    const list = byParam.get(r.param) ?? [];
    list.push(r);
    byParam.set(r.param, list);
  }
  for (const [param, list] of byParam) {
    list.sort((x, y) => x.at - y.at);
    let v = list[0].from;
    for (const r of list) {
      if (local >= r.at) v = THREE.MathUtils.lerp(r.from, r.to, r.dur > 0 ? clamp01((local - r.at) / r.dur) : 1);
    }
    out[param] = v;
  }
  return out;
}

/** Los números propios de un actor: `auto.headlights` le llega como `headlights` solo al auto. */
function scoped(params: Params, id: string): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (!k.includes('.')) out[k] = v;
  }
  const prefix = `${id}.`;
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  }
  return out;
}

function placeOnPath(root: THREE.Object3D, keys: PathKey[], local: number): void {
  let i = 0;
  while (i + 1 < keys.length && local >= keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  let u = b === a ? 0 : clamp01((local - a.at) / (b.at - a.at));
  if (b.ease === 'smooth') u = smooth(u);
  root.position.set(
    THREE.MathUtils.lerp(a.x, b.x, u),
    THREE.MathUtils.lerp(a.y ?? 0, b.y ?? a.y ?? 0, u),
    THREE.MathUtils.lerp(a.z, b.z, u),
  );
  // el giro: hacia donde marca el punto al que se llegó, en los primeros instantes del tramo
  const prevFace = faceAt(keys, i - 1);
  const face = faceAt(keys, i);
  const turn = clamp01((local - a.at) / TURN_TIME);
  const from = prevFace * DEG;
  let delta = face * DEG - from;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  root.rotation.set(0, from + delta * smooth(turn), 0);
  const roll = a.roll ?? 0;
  if (roll) root.rotateZ(roll * DEG);
}

function faceAt(keys: PathKey[], i: number): number {
  for (let k = Math.max(0, i); k >= 0; k--) if (keys[k].face !== undefined) return keys[k].face!;
  return keys.find((k) => k.face !== undefined)?.face ?? 0;
}

function evalAnim(actor: Actor, keys: AnimKey[], local: number): void {
  let i = 0;
  while (i + 1 < keys.length && local >= keys[i + 1].at) i++;
  const cur = keys[i];
  const prev = i > 0 ? keys[i - 1] : null;
  for (const a of actor.actions!.values()) a.setEffectiveWeight(0);
  const w = prev && cur.fade && prev.clip !== cur.clip ? clamp01((local - cur.at) / cur.fade) : 1;
  if (prev && w < 1) setClip(actor, prev, local, 1 - w);
  setClip(actor, cur, local, w);
  actor.mixer!.update(0);
}

function setClip(actor: Actor, key: AnimKey, local: number, weight: number): void {
  const action = actor.actions!.get(key.clip);
  if (!action) return;
  const dur = action.getClip().duration;
  const time = (key.from ?? 0) + Math.max(0, local - key.at) * (key.speed ?? 1);
  action.time = key.loop ? time % dur : Math.min(time, dur - 1e-3);
  action.setEffectiveWeight(weight);
}

/** El palo en la mano derecha: agarrado del mango y colgando hacia abajo y un poco adelante. */
function holdInHand(root: THREE.Object3D, holder: Actor): void {
  const hand = holder.hand!;
  hand.getWorldPosition(root.position);
  const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(holder.root.quaternion);
  const dir = new THREE.Vector3(0, -1, 0).addScaledVector(facing, 0.45).normalize();
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
}

export type { ActorCue };
