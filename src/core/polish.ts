/**
 * El pulido de efectos y sonidos (14/10, ver docs/assets.md). Leandro: «todo lo que hagas tiene que ser
 * activable y desactivable»: cada cosa tiene su llave (1 prendida, 0 apagada). Se tocan en el panel B
 * (Visual → Pulido) y con `?ajuste=pulido.<llave>:0`; `?pulido=0` apaga todo de una (para comparar con lo de
 * antes).
 */
export const POLISH = {
  /** El impacto de la pelota según el golpe: chispa, estrella, destello y, en el perfecto, el estallido grande. */
  impacts: 1,
  /** La congelada del golpe perfecto: el juego se frena un instante al pegar. */
  hitstop: 1,
  /** El enemigo se aplasta y se estira al recibir un golpe. */
  squash: 1,
  /** La explosión del hierro y el wedge (y las demás): humo, estrellas y la marca quemada. */
  explosions: 1,
  /** El aura del golfista con el guante (fuego, hielo, rayo, viento, fantasma, silencio), y la estela de la pelota de fuego. */
  auras: 1,
  /** Las llamas del enemigo prendido fuego. */
  burning: 1,
  /** Los cristales del congelado, que se rompen al soltarlo. */
  frozen: 1,
  /** La burbuja nueva del bendito: hexágonos y brillo que se mueven, se revienta y se vuelve a armar. */
  bubble: 1,
  /** El brillo y las cruces de la curación (el que se cura y el curandero). */
  heals: 1,
  /** Los sonidos grabados en vez de los sintetizados (golpes, explosiones, puerta, victoria, derrota). */
  samples: 1,
  /** La voz de muerte de cada enemigo, el élite que aparece y el jefe. */
  voices: 1,
  /** Los sonidos de los poderes: burbuja, metal, rebote en el intocable, curación, esquiva, hechiceros. */
  powerSounds: 1,
  /** Los sonidos de la partida: oleada terminada, cartas, botones. */
  uiSounds: 1,
  /** El fuego: el crepitar de los que se queman y el chisporroteo de cada quemadura. */
  fireSounds: 1,
  // ---- la segunda tanda de sonido (14/10, Leandro: el golpe y la muerte «parecen salidos de Atari», saturados y a destiempo) ----
  /** El enemigo se queja al recibir (cada tipo con su voz), y el élite gruñe grave cada vez que le pegan. */
  groans: 1,
  /** Un sonido por tipo de poder: los disparos suenan a su elemento, y el carrito, el hoyo, la bandera, el clon... cada uno el suyo. */
  abilitySounds: 1,
  /** La mezcla: un limitador de verdad al final y más margen para los grabados. Apagada, vuelve el de antes, que dejaba saturar cuando suenan varios juntos (se aplica al recargar). */
  mix: 1,
  /** Los efectos suenan en el acto. Apagada, vuelven a sonar 0,1 s tarde, como antes (el adelanto con que Tone agenda la música). */
  onTime: 1,
  // ---- la cuarta tanda (15/10, Leandro: «el golpe a la pelota suena como a vidrio», «cuando perdés debería haber un ruido más fuerte», «los ruidos me parece que clipean») ----
  /** El swing grabado: el palo cortando el aire, agendado para que su pico caiga en el impacto. Apagada, vuelve el soplido sintetizado. */
  swing: 1,
  /** Al perder: la puerta que cae o el caballero que se queja, la música que se apaga y un silencio antes del final. Apagada, el final suena en el acto. */
  defeatPause: 1,
  /** Tope de voces: no más de 3 a la vez del mismo grabado, ni de 8 campanas de baja; y un recorte suave al final que no deja pasar de 0 dB. Se nota al recargar. */
  mixGuard: 1,
};
export type PolishKey = keyof typeof POLISH;

/** ¿Está prendido? */
export function polished(key: PolishKey): boolean {
  return POLISH[key] > 0;
}

/** Prende o apaga todo de una (`?pulido=0`). */
export function setAllPolish(on: boolean): void {
  for (const k of Object.keys(POLISH) as PolishKey[]) POLISH[k] = on ? 1 : 0;
}
