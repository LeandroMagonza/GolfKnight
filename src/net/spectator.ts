// El que mira (ver docs/multijugador.md). No simula nada: arma los mismos enemigos que el que juega, los
// pone donde dicen las fotos (suavizando entre una y otra), y repite los efectos, sonidos y carteles a su
// hora. La cámara es suya (ver fieldcam.ts): adelante y atrás por la cancha, el ángulo y el zoom.
import * as THREE from 'three';
import { BALL_RADIUS } from '../core/ballistics';
import { heightAt, mounds, type Mound } from '../core/terrain';
import { BOLT_SLOT, castColor, type Abe, type SpellId } from '../coop/abe';
import { ABE_BOLT, type Offer } from '../coop/spells';
import { FieldCamera } from './fieldcam';
import { ENEMIES, type EnemyKind, type EnemyMods } from '../core/waves';
import type { Abilities } from '../game/abilities';
import type { Enemy, Horde } from '../game/enemies';
import type { Player } from '../game/player';
import { FIELD_HALF_WIDTH } from '../game/world';
import { L } from '../i18n';
import type { Link } from './link';
import { MIRRORED } from './host';
import {
  byId, EventQueue, HostClock, lerp, lerpAngle, Timeline,
  type AnimState, type BallSnap, type GameSnap, type Hello, type HostMsg, type NetEvent, type PlayerSnap, type ProjSnap, type Snap,
} from './snapshot';

const TRAIL_POINTS = 18;
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 12, 10);
const markGeo = new THREE.RingGeometry(0.7, 1, 32);
const previewGeo = new THREE.RingGeometry(0.9, 1, 48);
/** Sin noticias del que juega por este tiempo (ms), se avisa que se cortó. */
const STALE_MS = 4000;
/** Sin encontrar al que juega en este tiempo (ms), se avisa. */
const LOST_MS = 15000;
/**
 * Sin el que juega por este tiempo (ms), se vuelve a entrar a la sala de cero (5/10): con mal wifi la
 * conexión se moría y no volvía sola. Abe sigue siendo Abe: lo reconoce su pestaña (ver `me`). **Solo
 * si ya había estado conectado** (6/10): antes corría desde que se abría la página, y si la primera
 * conexión tardaba más de 12 s la cortaba y volvía a empezar, una y otra vez. Y más que los 23 s que el
 * que juega espera una respuesta: volver antes chocaba con el intento anterior.
 */
const RELINK_MS = 30000;

/** El de esta pestaña: el mismo aunque se recargue, para que Abe vuelva a ser Abe (ver host.ts). */
function tabId(): string {
  try {
    let id = sessionStorage.getItem('gk.me');
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem('gk.me', id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

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
  /** Los hechizos de Abe, para dibujarlos. */
  abe: Abe;
  /** Dónde cae en el piso un punto de la pantalla (coordenadas -1..1), o null si no toca el piso. */
  groundAt(x: number, y: number): { x: number; z: number } | null;
  /** El panel de Abe: si lo es, cuál eligió y cómo están sus hechizos. */
  showAbe(s: AbeStatus): void;
  /** Vuelve a entrar a la sala de cero: una conexión nueva. */
  reconnect(): Promise<Link>;
}

/** Cómo está un lugar: si se puede tirar ya, y los segundos que le faltan de cuántos. */
export interface SlotState {
  ready: boolean;
  left: number;
  total: number;
}

/** Cómo están los hechizos, para el panel de Abe. */
export interface AbeStatus {
  /** Este es Abe (el primero que entró). */
  abe: boolean;
  /** El hechizo elegido para el próximo toque (0 a 3, el orden de los botones), o -1: la chispa. */
  selected: number;
  /** La chispa, el ataque básico. */
  bolt: SlotState;
  /** Cada lugar: qué hechizo y de qué nivel, si se puede tirar ya, y los segundos que le faltan de cuántos. */
  slots: ({ id: SpellId; level: number } & SlotState)[];
  /** Lo que le ofrecen ahora, y cuántos le deben (contando ese). */
  offer: Offer | null;
  picks: number;
  /** Ya no está en la partida (lo echaron, o era privada): el panel no se muestra. */
  gone?: boolean;
  /** Por qué no se puede ninguno, si no es la recarga (pausa, carta, no empezó). */
  why: string | null;
}

const NO_ABE: AbeStatus = { abe: false, selected: BOLT_SLOT, bolt: { ready: false, left: 0, total: 1 }, slots: [], offer: null, picks: 0, why: null };

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
  /** Lo echaron, o la partida era privada: ya no escucha nada. */
  private out = false;
  /** Cuándo se empezó a buscar la partida, y si alguna vez apareció el que juega. */
  private readonly born = performance.now();
  private everHost = false;
  private paused = false;
  /** El juego del que juega está frenado (pausa o carta): acá todo quieto, también los efectos. */
  frozen = false;
  readonly cam: FieldCamera;
  /** Es Abe: el primero que entró, que tira los hechizos. */
  isAbe = false;
  /**
   * Lo que sale con el próximo toque: un hechizo (0 a 3, botones o teclas 1 a 4) o la chispa (-1). Después
   * de tirar un hechizo vuelve a la chispa; tocar otra vez el elegido, también.
   */
  selected = BOLT_SLOT;
  /** El de esta pestaña (ver `tabId`). */
  private readonly me = tabId();
  /**
   * Desde cuándo se perdió al que juega (para volver a entrar a la sala), y si se está reconectando. En
   * 0 mientras no se lo perdió: antes de conectarse la primera vez no se vuelve a entrar.
   */
  private lostSince = 0;
  private relinking = false;
  private relinks = 0;
  /** Adónde apunta el caballero: la línea desde su pelota y la marca donde cae. */
  private readonly knightLine: THREE.Line;
  private readonly knightRing: THREE.Mesh;
  /** Cómo están los hechizos según la última foto, y hasta cuándo no se manda otro pedido. */
  private abeState: AbeStatus = NO_ABE;
  /** El tamaño de cada lugar (radio, o ancho de la línea), según el que juega. */
  private sizes: number[] = [];
  private castLock = 0;
  /** Dónde está el mouse en el piso, y el círculo que muestra dónde caería (o la línea desde el caballero). */
  private aim: { x: number; z: number } | null = null;
  private readonly preview: THREE.Mesh;
  private readonly previewLine: THREE.Line;

  constructor(private link: Link, private readonly d: SpectatorDeps) {
    this.attach(link);
    d.note(L('Conectando con la partida…', 'Connecting to the game…'));

    // arranca alta, desde atrás del golfista, mirando toda la cancha
    const cam = d.camera;
    cam.far = 500;
    cam.updateProjectionMatrix();
    // lo bastante lejos para que entre todo el ancho de la cancha: en un celular parado, bastante más
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
    const dist = Math.max(68, Math.min(130, (FIELD_HALF_WIDTH + 3) / Math.tan(halfFov)));
    this.cam = new FieldCamera(cam, d.dom, dist);
    // un toque en el piso: lo que esté elegido (la chispa, o el hechizo)
    this.cam.onTap = (x, y) => {
      const at = d.groundAt(x, y);
      if (at) this.cast(at.x, at.z);
    };
    // la niebla, más lejos: desde arriba se ve todo el campo
    const fog = d.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = 140;
      fog.far = 320;
    }

    // Abe: un toque en el piso tira el hechizo elegido; arrastrar sigue siendo girar la cámara
    this.preview = new THREE.Mesh(previewGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    this.preview.rotation.x = -Math.PI / 2;
    this.preview.visible = false;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.previewLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6, depthTest: false }));
    this.previewLine.visible = false;
    this.previewLine.frustumCulled = false;
    d.scene.add(this.preview, this.previewLine);
    // adónde apunta el caballero: la línea desde su pelota y el anillo donde cae (lo ven todos los que miran)
    const kGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.knightLine = new THREE.Line(kGeo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.5, depthTest: false }));
    this.knightLine.frustumCulled = false;
    this.knightRing = new THREE.Mesh(previewGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    this.knightRing.rotation.x = -Math.PI / 2;
    this.knightLine.visible = this.knightRing.visible = false;
    d.scene.add(this.knightLine, this.knightRing);
    // el mouse encima del piso: ahí va el círculo de lo que saldría
    d.dom.addEventListener('pointermove', (e) => {
      const r = d.dom.getBoundingClientRect();
      this.aim = d.groundAt(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    });
    d.dom.addEventListener('pointerleave', () => {
      this.aim = null;
    });
  }

  /** Escucha esta conexión (la primera, o la nueva al reconectar). */
  private attach(link: Link): void {
    this.link = link;
    link.onTrouble = () => {
      if (link !== this.link || this.host) return;
      // ya se dijo por qué: el «no encuentro la partida» de LOST_MS no lo tiene que tapar
      this.everHost = true;
      this.d.note(L(
        'Encontré la partida, pero sus redes no dejan conectarse directo (pasa con algunos routers, o con el celular con datos). Sigo intentando. Si no sale, probá desde otra red.',
        `Found the game, but your networks won't connect directly (some routers do this, or phones on mobile data). Still trying. If it doesn't work, try another network.`,
      ));
    };
    link.onPeer = (id, joined) => {
      if (link !== this.link) return;
      // a cada uno que aparece se le pregunta: si es el que juega, contesta con el saludo
      if (joined) link.send({ k: 'watch', me: this.me }, id);
      else if (id === this.host) this.lost();
    };
    link.onMessage = (m, from) => {
      if (link === this.link) this.receive(m as unknown as HostMsg, from);
    };
  }

  /** Cómo está lo que saldría con `slot` (-1 la chispa). */
  private stateOf(slot: number): SlotState | undefined {
    return slot === BOLT_SLOT ? this.abeState.bolt : this.abeState.slots[slot];
  }

  /**
   * Abe pide lo elegido (la chispa o el hechizo) en (x, z). Lo decide el que juega: acá solo se manda, si
   * parece que se puede. Tirado el hechizo, lo que sigue es la chispa.
   */
  cast(x: number, z: number): boolean {
    const slot = this.selected;
    if (!this.send(slot, x, z)) return false;
    if (slot !== BOLT_SLOT) this.select(BOLT_SLOT);
    return true;
  }

  /** Q, W, E y R: el hechizo de ese lugar sale ya, donde está el mouse, sin cambiar lo elegido. */
  quickCast(slot: number): boolean {
    return !!this.aim && this.send(slot, this.aim.x, this.aim.z);
  }

  private send(slot: number, x: number, z: number): boolean {
    const ready = this.stateOf(slot)?.ready;
    if (!this.isAbe || !this.host || !ready || performance.now() < this.castLock) return false;
    // la chispa recarga rápido: el freno de pedidos repetidos es más corto
    this.castLock = performance.now() + (slot === BOLT_SLOT ? 150 : 400);
    this.link.send({ k: 'cast', i: slot, x, z }, this.host);
    return true;
  }

  /** Elige el hechizo `i` (0 a 3) para el próximo toque; el que ya estaba elegido, o -1, vuelve a la chispa. */
  select(i: number): void {
    if (!this.isAbe) return;
    this.selected = i !== BOLT_SLOT && this.abeState.slots[i] && i !== this.selected ? i : BOLT_SLOT;
    this.abeState = { ...this.abeState, selected: this.selected };
    this.d.showAbe(this.abeState);
  }

  /** Abe elige de lo que le ofrecen: la carta `card` (-1, quedarse como está) y, con todo lleno, en qué lugar va. */
  pick(card: number, slot = -1): void {
    if (!this.isAbe || !this.host) return;
    this.link.send({ k: 'pick', c: card, s: slot }, this.host);
  }

  private receive(m: HostMsg, from: string): void {
    if (this.out) return;
    // te echó el caballero, o la partida es privada: se corta acá (la privada se contesta antes del saludo)
    if ((m.k === 'kicked' && from === this.host) || (m.k === 'closed' && !this.host)) {
      this.out = true;
      this.everHost = true;
      this.host = null;
      this.preview.visible = this.previewLine.visible = false;
      this.d.showAbe({ ...NO_ABE, gone: true });
      this.d.note(m.k === 'kicked'
        ? L('El caballero te sacó de la partida.', 'The knight kicked you out of the game.')
        : L('La partida es privada: el caballero no deja entrar a nadie más.', `This game is private: the knight isn't letting anyone else in.`));
      this.link.close();
      return;
    }
    if (m.k === 'hello') {
      this.again = false;
      this.host = from;
      this.everHost = true;
      this.heard = performance.now();
      this.lostSince = 0;
      this.relinks = 0;
      this.reset();
      this.d.onHello(m);
      this.d.note(L('Esperando la primera foto…', 'Waiting for the first frame…'));
      return;
    }
    if (from !== this.host) return;
    this.heard = performance.now();
    if (m.k === 'again') this.again = true;
    else if (m.k === 'bye') this.lost();
    else if (m.k === 'role') this.isAbe = !!m.abe;
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
    if (this.out) return;
    this.host = null;
    if (!this.lostSince) this.lostSince = performance.now();
    this.preview.visible = this.previewLine.visible = false;
    this.knightLine.visible = this.knightRing.visible = false;
    this.abeState = NO_ABE;
    this.d.showAbe(NO_ABE);
    this.d.note(this.again
      ? L('El caballero empieza otra partida…', 'The knight is starting another game…')
      : L('El que juega se fue (o reinició). Esperando a que vuelva…', 'The player left (or restarted). Waiting for them to come back…'));
  }

  /** El que juega avisó que empieza otra partida: se va y vuelve enseguida. */
  private again = false;

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
    this.d.abe.applyRemote([]);
    this.isAbe = false;
    this.selected = BOLT_SLOT;
    mounds.length = 0;
  }

  update(dt: number): void {
    this.cam.update(dt);
    const now = performance.now();
    if (!this.everHost && now - this.born > LOST_MS) {
      this.everHost = true;
      this.d.note(L(
        'No encuentro la partida (sigo buscando). ¿El que juega sigue con la página abierta? ¿Es el enlace de ahora?',
        `Can't find the game (still looking). Does the player still have the page open? Is this the latest link?`,
      ));
    }
    // sin noticias del que juega hace rato: se vuelve a entrar a la sala, de cero
    const stale = this.host && now - this.heard > STALE_MS;
    if (stale && !this.lostSince) this.lostSince = this.heard + STALE_MS;
    if ((!this.host || stale) && this.lostSince && now - this.lostSince > RELINK_MS) void this.relink();
    if (!this.host || !this.clock.ready) return;
    if (stale) {
      this.d.note(this.relinks
        ? L(`Se cortó la conexión. Reconectando… (intento ${this.relinks})`, `Connection lost. Reconnecting… (try ${this.relinks})`)
        : L('Se cortó la conexión con el que juega. Esperando…', 'Lost the connection to the player. Waiting…'));
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
    this.updateAbe(b);
  }

  /** Vuelve a entrar a la sala con una conexión nueva (la vieja se cierra). */
  private async relink(): Promise<void> {
    if (this.relinking || this.out) return;
    this.relinking = true;
    this.relinks++;
    this.lostSince = performance.now();
    this.d.note(L(`Reconectando con la partida… (intento ${this.relinks})`, `Reconnecting to the game… (try ${this.relinks})`));
    try {
      this.link.close();
      const link = await this.d.reconnect();
      if (this.out) link.close();
      else this.attach(link);
    } catch (e) {
      console.warn('reconectar', e);
    } finally {
      this.relinking = false;
    }
  }

  /** Adónde apunta el caballero, como lo dice la foto. */
  private showKnightAim(am: GameSnap['am']): void {
    const on = !!am;
    this.knightLine.visible = this.knightRing.visible = on;
    if (!am) return;
    const [x, z, tx, tz, r, charging] = am;
    const pos = this.knightLine.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, x, heightAt(x, z) + 0.12, z);
    pos.setXYZ(1, tx, heightAt(tx, tz) + 0.12, tz);
    pos.needsUpdate = true;
    this.knightLine.computeLineDistances();
    const opacity = charging ? 0.8 : 0.35;
    (this.knightLine.material as THREE.LineDashedMaterial).opacity = opacity;
    (this.knightRing.material as THREE.MeshBasicMaterial).opacity = opacity;
    this.knightRing.position.set(tx, heightAt(tx, tz) + 0.1, tz);
    this.knightRing.scale.setScalar(Math.max(0.6, r));
  }

  /** Los hechizos en camino, el panel de Abe y el círculo de dónde caería el elegido. */
  private updateAbe(b: Snap): void {
    this.d.abe.applyRemote(b.ab);
    const g = b.g;
    this.showKnightAim(g.am);
    const why = !g.st ? L('Todavía no empezó la partida', `The game hasn't started yet`)
      : g.tu ? L(
        'El caballero está en el tutorial: elegí tus hechizos, vas a poder tirar cuando empiece la partida',
        'The knight is in the tutorial: pick your spells, you can cast once the game starts',
      )
        : g.pa ? L('En pausa', 'Paused') : g.cd ? L('Está eligiendo una carta', `He's picking a card`) : g.en ? L('Terminó la partida', 'Game over') : null;
    const a = g.abe;
    this.sizes = a.s.map(([, , , , size]) => size);
    if (this.selected >= a.s.length) this.selected = BOLT_SLOT;
    const [boltLeft, boltTotal] = a.b ?? [0, ABE_BOLT.cooldown];
    this.abeState = {
      abe: this.isAbe,
      selected: this.selected,
      bolt: { ready: !why && boltLeft <= 0, left: boltLeft, total: boltTotal },
      slots: a.s.map(([id, level, left, total]) => ({ id, level, ready: !why && left <= 0, left, total })),
      offer: a.o,
      picks: a.p,
      why,
    };
    this.d.showAbe(this.abeState);
    const bolt = this.selected === BOLT_SLOT;
    const slot = bolt ? null : this.abeState.slots[this.selected];
    const aim = this.isAbe && (bolt || slot) ? this.aim : null;
    // la corriente se ve como la línea desde el caballero; lo demás, como el círculo donde cae
    const line = slot?.id === 'current';
    this.preview.visible = !!aim && !line;
    this.previewLine.visible = !!aim && line;
    if (!aim) return;
    const ready = (bolt ? this.abeState.bolt : slot!).ready;
    const color = ready ? castColor(bolt ? 'bolt' : slot!.id) : 0x8a94a3;
    const y = heightAt(aim.x, aim.z) + 0.09;
    this.preview.position.set(aim.x, y, aim.z);
    this.preview.scale.setScalar(bolt ? ABE_BOLT.radius : this.sizes[this.selected] ?? 3);
    const mat = this.preview.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = ready ? 0.75 : 0.35;
    // la corriente: la línea del caballero hasta donde tocaría
    const player = this.d.player();
    if (this.previewLine.visible && player) {
      const pos = this.previewLine.geometry.attributes.position as THREE.BufferAttribute;
      // (acá el golfista solo tiene la posición del cuerpo, que está a un paso de su puesto)
      pos.setXYZ(0, player.position.x, heightAt(player.position.x, player.position.z) + 0.1, player.position.z);
      pos.setXYZ(1, aim.x, y, aim.z);
      pos.needsUpdate = true;
      (this.previewLine.material as THREE.LineBasicMaterial).color.setHex(color);
    }
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
      !g.st ? L('El que juega está en la pantalla de inicio…', 'The player is on the title screen…')
        : g.tu && !g.pa ? L('El caballero está haciendo el tutorial…', 'The knight is doing the tutorial…')
        : g.pa ? L('Pausa', 'Paused')
          : g.cd ? L('Eligiendo una carta…', 'Picking a card…')
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
