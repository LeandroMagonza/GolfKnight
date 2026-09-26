// Cómo se escribe una cinemática: un guion de planos, cada uno con su escenario, su cámara, lo que hace
// cada actor y los textos. Todos los tiempos son segundos desde el comienzo del plano, y todo se
// calcula como función del tiempo: se puede saltar a cualquier segundo y el cuadro sale igual.

export type Vec3 = [number, number, number];

/** Quién puede aparecer: personajes animados o utilería armada por código. */
export type Cast = Record<string, CastEntry>;
export type CastEntry =
  | { kind: 'character'; model: 'dungeon' | 'mage'; mesh?: string; height: number }
  | { kind: 'prop'; build: PropKind };
export type PropKind = 'car' | 'carBlue' | 'golfBag' | 'club';

export type SetId = 'feria' | 'estacionamiento' | 'negro' | 'circulo';

/** Qué clip suena desde `at`. Con `fade` se mezcla con el anterior durante esos segundos. */
export interface AnimKey {
  at: number;
  clip: string;
  loop?: boolean;
  /** 0 congela el primer cuadro (o el de `from`). */
  speed?: number;
  fade?: number;
  /** Desde qué segundo del clip arranca. */
  from?: number;
}

/**
 * Dónde está el actor en `at`. Entre dos puntos va en línea recta; `face` es hacia dónde mira, en
 * grados (0 = hacia +z, 90 = hacia +x), y el giro se hace al principio del tramo.
 */
export interface PathKey {
  at: number;
  x: number;
  z: number;
  y?: number;
  face?: number;
  /** Giro alrededor del eje de avance (para la utilería tirada en el piso), en grados. */
  roll?: number;
  ease?: 'linear' | 'smooth';
}

export interface ActorCue {
  path: PathKey[];
  anim?: AnimKey[];
  /** La utilería que va en la mano derecha de otro actor (el palo). */
  hold?: string;
  /** Solo se ve entre estos dos segundos del plano. */
  show?: [number, number];
}

/** A qué mira la cámara: un punto, o un actor a cierta altura. */
export type LookAt = Vec3 | { actor: string; y?: number; dx?: number; dz?: number };

export interface CamKey {
  at: number;
  pos: Vec3;
  look: LookAt;
  fov?: number;
}

export interface TextCue {
  at: number;
  until: number;
  text: string;
  /** caption: subtítulo abajo · say: globo sobre `who` · card: placa sobre negro · title: el nombre del juego */
  kind: 'caption' | 'say' | 'card' | 'title';
  who?: string;
}

/**
 * Un número del plano que cambia con el tiempo: de `from` a `to` entre `at` y `at + dur`. Los que
 * entiende el motor: fade (negro encima), flash (blanco encima), shake (temblor de cámara); el resto
 * lo leen los escenarios y la utilería (runes, clubGlow, headlights).
 */
export interface Ramp {
  at: number;
  dur: number;
  param: string;
  from: number;
  to: number;
}

export type SfxName = 'whoosh' | 'thud' | 'explosion' | 'zap' | 'frost' | 'growl' | 'gateHit' | 'hurt' | 'waveHorn' | 'victory';

export interface Shot {
  name: string;
  set: SetId;
  dur: number;
  camera: CamKey[];
  actors?: Record<string, ActorCue>;
  text?: TextCue[];
  ramps?: Ramp[];
  sfx?: { at: number; name: SfxName }[];
}

export interface Script {
  cast: Cast;
  shots: Shot[];
}
