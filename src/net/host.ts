// El que juega, transmitiendo (ver docs/multijugador.md). Mientras haya alguien mirando, cada tanto le manda
// una foto de todo lo que se ve (snapshot.ts), y le reenvía en el momento cada efecto, sonido y cartel:
// esos métodos se envuelven (`mirror`) y cada llamada sale también por la red. El juego no se entera.
import * as THREE from 'three';
import { BALL_RADIUS } from '../core/ballistics';
import { mounds } from '../core/terrain';
import { ENEMIES } from '../core/waves';
import type { Abe } from '../coop/abe';
import type { Abilities } from '../game/abilities';
import type { Balls } from '../game/balls';
import type { Enemy, Horde } from '../game/enemies';
import type { Player } from '../game/player';
import type { Link, NetMsg } from './link';
import { encodeArgs, r2, SNAP_HZ, type BallSnap, type EnemySnap, type GameSnap, type Hello, type NetEvent, type Snap } from './snapshot';

/** Lo que se reenvía tal cual: el que mira llama al mismo método. Solo estos (el que mira no acepta otros). */
export const MIRRORED = {
  fx: ['explosion', 'frost', 'swipe', 'blink', 'spark', 'lightning'],
  au: ['chargeTick', 'whoosh', 'duff', 'tock', 'thud', 'kill', 'bounce', 'explosion', 'zap', 'frost', 'growl', 'gateHit', 'hurt', 'waveHorn', 'victory', 'defeat'],
  hud: ['showBanner', 'feedback', 'showEnd', 'hideEnd', 'gateAlert'],
  vis: ['setDayProgress'],
} as const;

/** Envuelve métodos de `obj`: cada llamada avisa a `on` (con sus argumentos) y después hace lo suyo. */
export function mirror(obj: object, methods: readonly string[], on: (f: string, args: unknown[]) => void): void {
  const o = obj as Record<string, unknown>;
  for (const f of methods) {
    const orig = o[f];
    if (typeof orig !== 'function') continue;
    o[f] = function (this: unknown, ...args: unknown[]) {
      on(f, args);
      return (orig as (...a: unknown[]) => unknown).apply(this, args);
    };
  }
}

/** De dónde saca el que transmite lo que manda. */
export interface HostSource {
  hello(): Omit<Hello, 'k'>;
  game(): GameSnap;
  player(): Player | null;
  horde: Horde;
  balls: Balls;
  abilities: Abilities;
  abe: Abe;
}

/**
 * Si Abe se corta, su lugar lo espera este tiempo (ms) antes de pasar al que sigue: con mal wifi se va y
 * vuelve, y antes volvía como uno que solo mira.
 */
const ABE_SEAT_MS = 30000;

export class NetHost {
  /** Los que están mirando: la conexión, y de qué pestaña es (ver `Watch.me`). */
  readonly watchers = new Map<string, string>();
  /** Cambió cuántos miran. */
  onWatchers: ((n: number) => void) | null = null;
  /** Enemigos que el que mira ya sabe cómo armar. Se vacía cuando entra alguien. */
  private readonly announced = new Set<number>();
  /** Ids para lo que no tiene (pelotas, piedras), sin tocar esas clases. */
  private readonly ids = new WeakMap<object, number>();
  private nextId = 1;
  private last = -Infinity;
  private readonly kinds = new WeakMap<object, string>();

  /**
   * Abe: el primero de los que miran. Se lo reconoce por su pestaña (`abeMe`): si se corta y vuelve, vuelve
   * a ser Abe. Si se va, su lugar lo espera `ABE_SEAT_MS` y después pasa al que sigue.
   */
  private abeId: string | null = null;
  private abeMe: string | null = null;
  private abeGoneAt = 0;
  /** Abe pidió el hechizo del lugar `slot` en (x, z). */
  onCast: ((slot: number, x: number, z: number) => void) | null = null;
  /** Abe eligió de lo que le ofrecen: la carta (o -1) y el lugar. */
  onPick: ((card: number, slot: number) => void) | null = null;
  /**
   * Partida privada: no entra nadie más (los que ya miran siguen). Y los que el caballero echó, que no
   * vuelven en esta sesión. Al que vuelve a entrar desde otra pestaña lo frena la privada.
   */
  isPrivate = false;
  private readonly banned = new Set<string>();

  constructor(private readonly link: Link, private readonly src: HostSource) {
    link.onMessage = (m, from) => {
      if (this.banned.has(from)) return;
      if (m.k === 'watch') this.join(from, typeof m.me === 'string' && m.me ? m.me.slice(0, 40) : from);
      else if (from !== this.abeId) return;
      else if (m.k === 'cast' && Number.isInteger(m.i) && Number.isFinite(m.x) && Number.isFinite(m.z)) this.onCast?.(m.i as number, m.x as number, m.z as number);
      else if (m.k === 'pick' && Number.isInteger(m.c) && Number.isInteger(m.s)) this.onPick?.(m.c as number, m.s as number);
    };
    link.onPeer = (id, joined) => {
      if (joined || !this.watchers.delete(id)) return;
      this.updateRoles();
      this.onWatchers?.(this.watchers.size);
    };
    // al cerrar o recargar (R) se avisa: WebRTC solo, tarda bastante en darse cuenta
    addEventListener('pagehide', () => {
      if (this.watchers.size) this.link.send({ k: 'bye' });
    });
  }

  private join(id: string, me: string): void {
    // al echado no se le hace caso tampoco si vuelve a entrar desde la misma pestaña
    if (this.banned.has(me)) {
      this.banned.add(id);
      this.link.send({ k: 'kicked' }, id);
      return;
    }
    // la misma pestaña que vuelve (se cortó): la conexión vieja ya no sirve, la nueva toma su lugar
    const back = [...this.watchers].some(([, m]) => m === me);
    // privada: el que no estaba no entra (se le avisa, así no se queda esperando). El que vuelve, sí
    if (this.isPrivate && !this.watchers.has(id) && !back && me !== this.abeMe) {
      this.link.send({ k: 'closed' }, id);
      return;
    }
    for (const [peer, m] of [...this.watchers]) if (m === me && peer !== id) this.watchers.delete(peer);
    this.watchers.set(id, me);
    this.announced.clear();
    this.link.send({ k: 'hello', ...this.src.hello() }, id);
    this.updateRoles();
    this.link.send({ k: 'role', abe: id === this.abeId }, id);
    this.last = -Infinity;
    this.onWatchers?.(this.watchers.size);
  }

  /** ¿Hay un Abe mirando? */
  get hasAbe(): boolean {
    return this.abeId !== null;
  }

  /**
   * El caballero echa a Abe: se le avisa, no se le hace caso nunca más (tampoco si vuelve a entrar desde
   * esa pestaña), y el que sigue pasa a ser Abe en el acto.
   */
  kickAbe(): void {
    const id = this.abeId;
    if (!id) return;
    this.link.send({ k: 'kicked' }, id);
    this.banned.add(id);
    if (this.abeMe) this.banned.add(this.abeMe);
    this.watchers.delete(id);
    this.abeMe = null;
    this.updateRoles();
    this.onWatchers?.(this.watchers.size);
  }

  /**
   * Quién es Abe: la pestaña que ya lo era, si está; si se fue, nadie hasta que pasa `ABE_SEAT_MS` (por si
   * vuelve); y si no hay Abe, el primero que mira. Si cambió, se les avisa al de antes y al nuevo.
   */
  private updateRoles(now = performance.now()): void {
    // Abe se fue (se cortó o cerró la página): desde ahora corre lo que se le guarda el lugar
    if (this.abeId && !this.watchers.has(this.abeId)) {
      this.abeId = null;
      this.abeGoneAt = now;
    }
    let next: string | null = null;
    for (const [peer, me] of this.watchers) if (me === this.abeMe) next = peer;
    if (!next && !(this.abeMe && now - this.abeGoneAt < ABE_SEAT_MS)) {
      next = this.watchers.keys().next().value ?? null;
      this.abeMe = next ? this.watchers.get(next)! : null;
    }
    if (next === this.abeId) return;
    if (this.abeId && this.watchers.has(this.abeId)) this.link.send({ k: 'role', abe: false }, this.abeId);
    this.abeId = next;
    if (next) this.link.send({ k: 'role', abe: true }, next);
  }

  /** Un efecto, sonido o cartel que acaba de pasar. */
  record(o: NetEvent['o'], f: string, args: unknown[]): void {
    if (!this.watchers.size) return;
    const ev: NetEvent = { k: 'ev', t: performance.now(), o, f, a: encodeArgs(args) };
    this.link.send(ev as unknown as NetMsg);
  }

  /** En cada cuadro: si toca, manda la foto. */
  tick(now: number): void {
    // el lugar de Abe que se guardaba para él se venció: pasa al que sigue
    if (this.abeMe && !this.abeId && this.watchers.size) this.updateRoles();
    if (!this.watchers.size || now - this.last < 1000 / SNAP_HZ) return;
    this.last = now;
    this.link.send(this.snap(now) as unknown as NetMsg);
  }

  close(): void {
    this.link.close();
  }

  private idOf(o: object): number {
    let id = this.ids.get(o);
    if (id === undefined) {
      id = this.nextId++;
      this.ids.set(o, id);
    }
    return id;
  }

  private kindOf(e: Enemy): string {
    let k = this.kinds.get(e.stats);
    if (!k) {
      k = Object.keys(ENEMIES).find((key) => ENEMIES[key as keyof typeof ENEMIES] === e.stats) ?? '';
      this.kinds.set(e.stats, k);
    }
    return k;
  }

  private snap(now: number): Snap {
    const { horde, balls, abilities } = this.src;
    const enemies: EnemySnap[] = [];
    for (const e of horde.enemies) {
      if (e.state === 'gone') continue;
      const s = e.snapshot();
      if (!this.announced.has(e.id)) {
        this.announced.add(e.id);
        s.spawn = { kind: this.kindOf(e), mods: { ...e.mods } };
      }
      enemies.push(s);
    }
    const view = abilities.view;
    const ballList: BallSnap[] = [];
    for (const b of balls.list) if (!b.done) ballList.push(this.ball(b, b.mesh, b.trail, b.ricochet?.marker));
    for (const b of view.balls) ballList.push(this.ball(b, b.mesh, b.trail));
    return {
      k: 'snap',
      t: now,
      g: this.src.game(),
      p: this.src.player()?.snapshot() ?? null,
      e: enemies,
      b: ballList,
      r: horde.flying.map((f) => {
        const marker = f.marker;
        return {
          id: this.idOf(f.key), k: f.k, x: r2(f.mesh.position.x), y: r2(f.mesh.position.y), z: r2(f.mesh.position.z),
          m: marker ? [r2(marker.position.x), r2(marker.position.y), r2(marker.position.z), r2((marker.material as THREE.MeshBasicMaterial).opacity)] : undefined,
        };
      }),
      mk: view.marks,
      ca: view.carts,
      mo: mounds.map((m) => [r2(m.x), r2(m.z), r2(m.height), r2(m.rx), r2(m.rz), r2(m.target)]),
      ab: this.src.abe.view,
    };
  }

  private ball(key: object, mesh: THREE.Mesh, trail: THREE.Line, marker?: THREE.Mesh): BallSnap {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const radius = (mesh.geometry as THREE.SphereGeometry).parameters?.radius ?? BALL_RADIUS;
    const out: BallSnap = {
      id: this.idOf(key),
      x: r2(mesh.position.x), y: r2(mesh.position.y), z: r2(mesh.position.z),
      s: r2(radius / BALL_RADIUS),
      c: mat.emissive.getHex(),
      i: r2(mat.emissiveIntensity),
      o: mat.transparent ? r2(mat.opacity) : 1,
      tc: (trail.material as THREE.LineBasicMaterial).color.getHex(),
      tv: trail.visible,
      v: mesh.visible,
    };
    if (marker) out.m = [r2(marker.position.x), r2(marker.position.y), r2(marker.position.z), r2((marker.material as THREE.MeshBasicMaterial).opacity), r2(marker.scale.x)];
    return out;
  }
}
