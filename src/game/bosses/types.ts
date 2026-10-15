// Los jefes del último escenario (14/10). Cada familia de jefes vive en su carpeta,
// src/game/bosses/<familia>/index.ts, que exporta `BOSSES`: la lista de sus versiones (para probar
// variantes de una misma idea). El juego carga solo el que toca (ver registry.ts) y lo arranca cuando
// empieza la última oleada. Ver docs/jefes.md.
import type * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GameAudio } from '../../audio/audio';
import type { Wave } from '../../core/waves';
import type { Balls } from '../balls';
import type { Effects } from '../effects';
import type { Enemy, Horde } from '../enemies';
import type { Player } from '../player';
import type { Tees } from '../tees';

export interface BossDef {
  /** `familia.version` (la carpeta, un punto y la versión): va en ?jefe= y en el registro de la partida. */
  id: string;
  /** El nombre que ve el jugador, con L('…', '…'): el cartel de la oleada. */
  name: string;
  /** Una línea para el panel de pruebas: qué tiene de distinto esta versión. En español (el panel es de prueba). */
  blurb: string;
  /** Modelos de public/models que usa además de dungeon.glb: se cargan al empezar la partida. */
  models?: string[];
  /** Fuera del panel y del sorteo (el ejemplo). */
  hidden?: boolean;
  /**
   * La escolta: recibe la última oleada, ya sin el gólem de siempre, y la puede cambiar (`wave.groups`, el
   * intervalo...). Sin esto va la escolta de siempre.
   */
  escort?(wave: Wave): void;
  /** Arranca la pelea, al empezar la última oleada. */
  start(ctx: BossCtx): BossFight;
}

export interface BossFight {
  /** Cada cuadro de juego (no corre en pausa ni con las cartas). */
  update(dt: number): void;
  /** Ganado. La oleada termina cuando esto es true y no queda ningún enemigo vivo. */
  readonly done: boolean;
  /**
   * Regla del juego (no solo del bot): true si no se puede ir del puesto `from` al `to` (de a uno). La
   * telaraña, por ejemplo. El bot también la respeta.
   */
  blocks?(from: number, to: number): boolean;
  /**
   * Al soltar un tiro (antes de que baje el palo): el jefe puede decidir que salga pifia (el palo pasa, la
   * pelota se queda en el puesto, suena y se ve como la pifia de siempre), con su propio cartelito. El jefe
   * con música (bardo): fuera del beat, pifia.
   */
  onRelease?(info: ReleaseInfo): ReleaseVerdict | void;
  /** Lo que el bot necesita saber de este jefe. */
  bot?: BossBot;
  /** Números propios del jefe para el registro de la partida (y para las tandas del bot). */
  log?(): Record<string, number | string>;
  /** Al terminar la partida o al irse: sacar de la escena lo que no sea un enemigo. */
  dispose?(): void;
}

export interface BossBot {
  /**
   * ¿Le va a caer algo al que esté parado en el puesto de `x` (sobre la línea de los puestos) en los
   * próximos `within` s? El bot no se queda ni tira ahí.
   */
  danger?(x: number, within: number): boolean;
  /**
   * Cuántos segundos esperar para soltar el tiro (0 = ya): el bot carga, clava el golpe y suelta a su hora.
   * El jefe con música: hasta el próximo beat.
   */
  releaseWait?(): number;
  /** Multiplica cuánto le importa pegarle a `e` (1 = como a cualquiera, 0 = no tirarle, 3 = urgente). */
  weight?(e: Enemy): number;
}

/** El tiro que se acaba de soltar (ver `BossFight.onRelease`). */
export interface ReleaseInfo {
  /** El palo (`driver`, `iron`...). */
  club: string;
  /** Dónde estaba la barra al soltar (0 a 1). */
  power: number;
}

/** Lo que decide el jefe del tiro soltado. */
export interface ReleaseVerdict {
  /** Sale pifia. */
  pifia?: boolean;
  /** El cartelito en vez de «¡Pifia!» (con L('…', '…')). */
  text?: string;
}

/** Lo que el juego le da a cada jefe. */
export interface BossCtx {
  readonly scene: THREE.Scene;
  readonly horde: Horde;
  /** El golfista (puede cambiar de objeto si cambia de skin: pedirlo cada vez). */
  player(): Player;
  readonly tees: Tees;
  readonly balls: Balls;
  readonly effects: Effects;
  readonly audio: GameAudio;
  /** dungeon.glb: los personajes de PolygonDungeon y los monstruos humanoides, con sus clips. */
  readonly dungeon: GLTF;
  /** Los de `BossDef.models`, ya cargados (los que no se pudieron cargar no están). */
  readonly models: ReadonlyMap<string, GLTF>;
  /** Al azar (Math.random, salvo en pruebas). */
  readonly rng: () => number;
  /** El nivel de dificultad de la partida (0 a 10). */
  readonly level: number;
  /** La vida de más que la dificultad le da al jefe (el talento del golpe 4: `bossHp`). */
  readonly bonusHp: number;
  /** Segundos de juego desde que arrancó la pelea. */
  clock(): number;
  /** La partida terminó (cayó la puerta o el golfista): no atacar más. */
  over(): boolean;
  /** Le pega a la puerta, a nombre de `source` (para el registro y el cartel del final). */
  hitGate(amount: number, source: Enemy): void;
  /** Le pega al golfista desde `from` (respeta su respiro de invulnerable). */
  hitPlayer(amount: number, from: THREE.Vector3, source: Enemy | null): void;
  /** El cartel grande de arriba. */
  banner(title: string, sub?: string, seconds?: number): void;
  /** El cartelito chico (como «¡Esquivó!»). */
  feedback(text: string): void;
  /** Dónde está cada puesto (x, sobre la línea de los puestos, z = TEE_Z). */
  spots(): readonly number[];
}
