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
