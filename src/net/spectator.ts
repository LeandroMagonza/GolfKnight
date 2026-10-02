// El que mira (ver docs/multijugador.md). No simula nada: arma los mismos enemigos que el que juega, los
// pone donde dicen las fotos (suavizando entre una y otra), y repite los efectos, sonidos y carteles a su
// hora. La cámara es suya: arrastrar gira, la rueda acerca, el botón derecho desplaza.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BALL_RADIUS } from '../core/ballistics';
import { mounds, type Mound } from '../core/terrain';
import { ENEMIES, type EnemyKind, type EnemyMods } from '../core/waves';
import type { Abilities } from '../game/abilities';
import type { Enemy, Horde } from '../game/enemies';
import type { Player } from '../game/player';
import type { Link } from './link';
import { MIRRORED } from './host';
import {
  byId, EventQueue, HostClock, lerp, lerpAngle, Timeline,
  type AnimState, type BallSnap, type GameSnap, type Hello, type HostMsg, type NetEvent, type PlayerSnap, type ProjSnap, type Snap,
} from './snapshot';

const TRAIL_POINTS = 18;
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 12, 10);
const markGeo = new THREE.RingGeometry(0.7, 1, 32);
/** Sin noticias del que juega por este tiempo (ms), se avisa que se cortó. */
const STALE_MS = 4000;
/** Sin encontrar al que juega en este tiempo (ms), se avisa. */
const LOST_MS = 15000;

/** Con qué dibuja el que mira: las mismas piezas del juego. */
export interface SpectatorDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  horde: Horde;
  abilities: Abilities;
  player(): Player | undefined;
  /** Los objetos a los que van los eventos (efectos, sonido, HUD, el día). El sonido, solo si está listo. */
  targets: { fx: object; au: () => object | null; hud: object; vis: object };
  /** El HUD de arriba. */
  showGame(g: GameSnap): void;
  /** Llegó el saludo del que juega. */
  onHello(h: Hello): void;
  /** Lo que se le cuenta al que mira: conectando, esperando, pausa… Null lo esconde. */
  note(text: string | null): void;
}

interface RemoteBall {
  mesh: THREE.Mesh;
  trail: THREE.Line;
  positions: Float32Array;
  marker: THREE.Mesh | null;
}

export class NetSpectator {
  private readonly clock = new HostClock();
  private readonly timeline = new Timeline<Snap>();
  private readonly events = new EventQueue<NetEvent>();
  private readonly enemies = new Map<number, Enemy>();
  private readonly spawns = new Map<number, { kind: string; mods: Record<string, unknown> }>();
  private readonly balls = new Map<number, RemoteBall>();
  private host: string | null = null;
  /** Cuándo llegó lo último del que juega. */
  private heard = 0;
  /** Cuándo se empezó a buscar la partida, y si alguna vez apareció el que juega. */
  private readonly born = performance.now();
  private everHost = false;
  private paused = false;
  /** El juego del que juega está frenado (pausa o carta): acá todo quieto, también los efectos. */
  frozen = false;
  readonly controls: OrbitControls;

  constructor(private readonly link: Link, private readonly d: SpectatorDeps) {
    link.onPeer = (id, joined) => {
      // a cada uno que aparece se le pregunta: si es el que juega, contesta con el saludo
      if (joined) link.send({ k: 'watch' }, id);
      else if (id === this.host) this.lost();
    };
    link.onMessage = (m, from) => this.receive(m as unknown as HostMsg, from);
    d.note('Conectando con la partida…');

    // arranca alta, desde atrás del golfista, mirando toda la cancha
    const cam = d.camera;
    cam.far = 500;
    cam.updateProjectionMatrix();
    cam.position.set(0, 52, -14);
    this.controls = new OrbitControls(cam, d.dom);
    this.controls.target.set(0, 0, 30);
    this.controls.enableDamping = true;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 140;
    // nunca por debajo del piso
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
    this.controls.update();
    // la niebla, más lejos: desde arriba se ve todo el campo
    const fog = d.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = 140;
      fog.far = 320;
    }
  }

  private receive(m: HostMsg, from: string): void {
    if (m.k === 'hello') {
      this.host = from;
      this.everHost = true;
      this.heard = performance.now();
      this.reset();
      this.d.onHello(m);
      this.d.note('Esperando la primera foto…');
      return;
    }
    if (from !== this.host) return;
    this.heard = performance.now();
    if (m.k === 'bye') this.lost();
    else if (m.k === 'snap') {
      this.clock.sync(m.t, performance.now());
      // el tipo y los poderes vienen una sola vez: se guardan aunque esa foto no llegue a dibujarse
      for (const e of m.e) if (e.spawn) this.spawns.set(e.id, e.spawn);
      this.timeline.push(m);
    } else if (m.k === 'ev') {
      this.events.push(m);
    }
  }

  /** El que juega se fue: queda todo como estaba hasta que vuelva (reiniciar es volver a entrar). */
  private lost(): void {
    this.host = null;
    this.d.note('El que juega se fue (o reinició). Esperando a que vuelva…');
  }

  /** Empieza de cero: saca todo lo que había de la partida anterior. */
  private reset(): void {
    this.timeline.clear();
    this.events.clear();
    for (const e of this.enemies.values()) this.d.horde.removeRemote(e);
    this.enemies.clear();
    this.spawns.clear();
    for (const id of [...this.balls.keys()]) this.removeBall(id);
    this.d.horde.applyRemoteFlying([], 0);
    this.d.abilities.applyRemote([], []);
    mounds.length = 0;
  }

  update(dt: number): void {
    this.controls.update();
    // el centro de la cámara no se va del campo
    const t = this.controls.target;
    t.set(THREE.MathUtils.clamp(t.x, -25, 25), 0, THREE.MathUtils.clamp(t.z, -5, 80));
    const now = performance.now();
    if (!this.everHost && now - this.born > LOST_MS) {
      this.everHost = true;
      this.d.note('No encuentro la partida. ¿El que juega sigue con la página abierta? ¿Es el enlace de ahora?');
    }
    if (!this.host || !this.clock.ready) return;
    if (now - this.heard > STALE_MS) {
      this.d.note('Se cortó la conexión con el que juega. Esperando…');
      return;
    }
    const at = this.clock.renderTime(now);
    for (const ev of this.events.due(at)) this.play(ev);
    const s = this.timeline.sample(at);
    if (!s) return;
    const { a, b, u } = s;
    this.game(b.g);
    // en pausa o eligiendo carta el juego del que juega no avanza: acá tampoco. Las animaciones se quedan
    // en el instante exacto de la foto, sin correr solas (si no, caminaban en el lugar, y el que estaba
    // cayéndose muerto volvía para atrás con cada foto)
    this.frozen = b.g.pa || b.g.cd;
    const step = this.frozen ? 0 : dt;
    const player = this.d.player();
    if (player && b.p) {
      const p = lerpPlayer(a.p ?? b.p, b.p, u);
      player.applyRemote(this.frozen ? { ...p, a: still(p.a) } : p, step);
    }
    this.updateEnemies(a, b, u, step);
    this.updateBalls(a.b, b.b, u);
    this.d.horde.applyRemoteFlying(lerpProj(a.r, b.r, u), step);
    const carts = byId(a.ca);
    this.d.abilities.applyRemote(b.mk, b.ca.map((c) => ({ ...c, x: lerp(carts.get(c.id)?.x ?? c.x, c.x, u) })));
    this.updateMounds(b.mo);
  }

  private game(g: GameSnap): void {
    this.d.showGame(g);
    if (g.pa !== this.paused) {
      this.paused = g.pa;
      const au = this.d.targets.au() as { pause?: () => void; resume?: () => void } | null;
      if (g.pa) au?.pause?.();
      else au?.resume?.();
    }
    this.d.note(
      !g.st ? 'El que juega está en la pantalla de inicio…'
        : g.pa ? 'Pausa'
          : g.cd ? 'Eligiendo una carta…'
            : null,
    );
  }

  /** Un evento suelto: el mismo método, del mismo lado. Solo los de la lista de `MIRRORED`. */
  private play(ev: NetEvent): void {
    const allowed = MIRRORED[ev.o] as readonly string[] | undefined;
    if (!allowed?.includes(ev.f)) return;
    const target = ev.o === 'au' ? this.d.targets.au() : this.d.targets[ev.o];
    const fn = (target as Record<string, unknown> | null)?.[ev.f];
    if (typeof fn !== 'function') return;
    const args = ev.a.map((x) => {
      const v = (x as { v?: unknown })?.v;
      return Array.isArray(v) ? new THREE.Vector3(v[0], v[1], v[2]) : x;
    });
    try {
      (fn as (...a: unknown[]) => void).apply(target, args);
    } catch (e) {
      console.warn('evento del que juega', ev.o, ev.f, e);
    }
  }

  private updateEnemies(a: Snap, b: Snap, u: number, dt: number): void {
    const prev = byId(a.e);
    const seen = new Set<number>();
    for (const s of b.e) {
      seen.add(s.id);
      let enemy = this.enemies.get(s.id);
      if (!enemy) {
        const spawn = this.spawns.get(s.id);
        if (!spawn || !(spawn.kind in ENEMIES)) continue;
        enemy = this.d.horde.spawnRemote(s.id, spawn.kind as EnemyKind, spawn.mods as EnemyMods, s.x, s.z) ?? undefined;
        if (!enemy) continue;
        this.enemies.set(s.id, enemy);
      }
      const p = prev.get(s.id) ?? s;
      enemy.applyRemote(this.frozen ? { ...s, a: still(s.a) } : s, lerp(p.x, s.x, u), lerp(p.y, s.y, u), lerp(p.z, s.z, u), lerpAngle(p.yaw, s.yaw, u));
      enemy.updateRemote(dt);
    }
    for (const [id, enemy] of this.enemies) {
      if (seen.has(id)) continue;
      this.d.horde.removeRemote(enemy);
      this.enemies.delete(id);
    }
  }

  private updateBalls(before: BallSnap[], now: BallSnap[], u: number): void {
    const prev = byId(before);
    const seen = new Set<number>();
    for (const s of now) {
      seen.add(s.id);
      const p = prev.get(s.id) ?? s;
      const x = lerp(p.x, s.x, u);
      const y = lerp(p.y, s.y, u);
      const z = lerp(p.z, s.z, u);
      let ball = this.balls.get(s.id);
      if (!ball) {
        ball = this.makeBall(s, x, y, z);
        this.balls.set(s.id, ball);
      }
      const mat = ball.mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(s.c);
      mat.emissiveIntensity = s.i;
      mat.transparent = s.o < 1;
      mat.opacity = s.o;
      ball.mesh.position.set(x, y, z);
      ball.mesh.visible = s.v;
      (ball.trail.material as THREE.LineBasicMaterial).color.setHex(s.tc);
      ball.trail.visible = s.tv;
      const t = ball.positions;
      t.copyWithin(3, 0, t.length - 3);
      t[0] = x;
      t[1] = y;
      t[2] = z;
      ball.trail.geometry.attributes.position.needsUpdate = true;
      if (s.m) {
        if (!ball.marker) {
          ball.marker = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
          ball.marker.rotation.x = -Math.PI / 2;
          this.d.scene.add(ball.marker);
        }
        ball.marker.position.set(s.m[0], s.m[1], s.m[2]);
        (ball.marker.material as THREE.MeshBasicMaterial).opacity = s.m[3];
        ball.marker.scale.setScalar(s.m[4]);
      }
    }
    for (const id of [...this.balls.keys()]) if (!seen.has(id)) this.removeBall(id);
  }

  private makeBall(s: BallSnap, x: number, y: number, z: number): RemoteBall {
    const mesh = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: s.c, emissiveIntensity: s.i }));
    mesh.scale.setScalar(s.s);
    const positions = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i++) positions.set([x, y, z], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: s.tc, transparent: true, opacity: 0.85 }));
    trail.frustumCulled = false;
    this.d.scene.add(mesh, trail);
    return { mesh, trail, positions, marker: null };
  }

  private removeBall(id: number): void {
    const b = this.balls.get(id);
    if (!b) return;
    this.d.scene.remove(b.mesh, b.trail);
    (b.mesh.material as THREE.Material).dispose();
    b.trail.geometry.dispose();
    (b.trail.material as THREE.Material).dispose();
    if (b.marker) {
      this.d.scene.remove(b.marker);
      (b.marker.material as THREE.Material).dispose();
    }
    this.balls.delete(id);
  }

  /** Las lomas: las mismas (el mismo objeto, que es lo que sigue la vista), con su altura de ahora. */
  private updateMounds(list: Snap['mo']): void {
    const key = (x: number, z: number) => `${x.toFixed(1)},${z.toFixed(1)}`;
    const keep = new Set<Mound>();
    for (const [x, z, height, rx, rz, target] of list) {
      let m = mounds.find((o) => key(o.x, o.z) === key(x, z));
      if (!m) {
        m = { x, z, height, rx, rz, target, owner: 0 };
        mounds.push(m);
      }
      m.height = height;
      m.target = target;
      keep.add(m);
    }
    for (let i = mounds.length - 1; i >= 0; i--) if (!keep.has(mounds[i])) mounds.splice(i, 1);
  }
}

function lerpPlayer(a: PlayerSnap, b: PlayerSnap, u: number): PlayerSnap {
  // el clip posado (el backswing) se mueve a la par de la carga: también se suaviza
  const sa = a.a.s;
  const sb = b.a.s;
  const shot = sa && sb && sa[0] === sb[0] && sb[2] === 0 ? [sb[0], lerp(sa[1], sb[1], u), 0, sb[3]] as typeof sb : sb;
  return {
    ...b,
    x: lerp(a.x, b.x, u),
    y: lerp(a.y, b.y, u),
    z: lerp(a.z, b.z, u),
    yaw: lerpAngle(a.yaw, b.yaw, u),
    rw: lerp(a.rw, b.rw, u),
    rp: lerp(a.rp, b.rp, u),
    a: { ...b.a, s: shot },
  };
}

/** La animación quieta en el instante de la foto: el clip de cuerpo entero, con velocidad 0. */
function still(a: AnimState): AnimState {
  return a.s ? { ...a, s: [a.s[0], a.s[1], 0, a.s[3]] } : a;
}

function lerpProj(a: ProjSnap[], b: ProjSnap[], u: number): ProjSnap[] {
  const prev = byId(a);
  return b.map((s) => {
    const p = prev.get(s.id) ?? s;
    return { ...s, x: lerp(p.x, s.x, u), y: lerp(p.y, s.y, u), z: lerp(p.z, s.z, u) };
  });
}
