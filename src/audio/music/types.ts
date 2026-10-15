// Las canciones del juego (15/10). Cada una es un módulo en src/audio/music/songs/<nombre>.ts que exporta
// SONGS: una o varias canciones, todas sintetizadas con Tone.js como el resto del audio. El juego elige cuál
// suena según dónde está la partida (`MusicSlot`) y cambia de una a otra con un fundido (ver player.ts).
// Ver docs/musica.md.
import type * as Tone from 'tone';

/** Dónde suena: cada escenario, mientras hay un élite en la cancha, y la pelea con el jefe. */
export type MusicSlot = 'escenario1' | 'escenario2' | 'escenario3' | 'elite' | 'jefe';
export const MUSIC_SLOTS: readonly MusicSlot[] = ['escenario1', 'escenario2', 'escenario3', 'elite', 'jefe'];

export interface SongDef {
  /** `archivo.nombre` (el archivo de songs/ sin .ts, un punto y el nombre): va en el panel y en lo guardado. */
  id: string;
  /** Para el panel, en español. */
  name: string;
  /** Para dónde se pensó (el panel la propone ahí primero; se puede poner en cualquiera). */
  role: MusicSlot | 'escenario';
  /** Una línea para el panel: el carácter, los instrumentos, el tempo. En español. */
  blurb: string;
  /**
   * Arma la canción: sus instrumentos conectados a `out`, y sus notas agendadas en `transport` (en segundos,
   * no en '8n': el transporte lo comparten dos canciones mientras una entra y la otra sale, así que nadie le
   * cambia el tempo). Se llama ya con el audio andando, o adentro de Tone.Offline para renderizarla.
   */
  build(out: Tone.InputNode, transport: ReturnType<typeof Tone.getTransport>): Song;
}

export interface Song {
  /** Empieza a sonar en el instante `time` del transporte (en segundos). */
  start(time: number): void;
  /** Deja de agendar notas desde `time` (lo que ya sonó se apaga solo con su release). */
  stop(time: number): void;
  /**
   * Qué tan tensa está la cosa, de 0 a 1 (opcional): la puerta baja, muchos enemigos cerca, el jefe por
   * caer. La canción puede sumar capas, abrir un filtro, apurar el pulso de la percusión...
   */
  intensity?(level: number): void;
  /** Libera instrumentos y efectos. */
  dispose(): void;
}
