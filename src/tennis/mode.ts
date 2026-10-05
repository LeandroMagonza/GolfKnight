// Modo tenis (prototipo): un tenista en vez del golfista. Se entra con ?tenis en la URL, o con el botón
// de la intro, que recarga la página con eso. Todo lo demás (enemigos, oleadas, cartas, habilidades,
// la barra de carga) es el mismo juego.
//
// Hay un solo golpe, el **plano**, que es el driver con otro nombre (así sus habilidades de elemento
// siguen andando): sale rasante, rebota y vuelve. El **globo** (el wedge) quedó solo como habilidad: como
// golpe no entraba en el ida y vuelta, y con el timing casi siempre salía el golpe 1, que en el wedge es
// 0 de daño. El hierro y el putter no están.
import { ABILITIES, ABILITY_LIST, shotHint, shotName } from '../core/abilities';
import { CLUB_ORDER, CLUBS } from '../core/clubs';
import { L } from '../i18n';

export const TENNIS_ON = new URLSearchParams(location.search).has('tenis');

/** Arma los golpes y las cartas del tenis. Va antes de armar el HUD, que dibuja los palos. */
export function applyTennis(): void {
  Object.assign(CLUBS.driver, { name: L('Plano', 'Drive'), title: L('Rasante', 'Line drive'), hint: L('Rebota y vuelve', 'Bounces back'), returns: true });
  Object.assign(CLUBS.wedge, { name: L('Globo', 'Lob'), title: L('Globo', 'Lob'), hint: L('Área', 'Area') });
  CLUB_ORDER.splice(0, CLUB_ORDER.length, 'driver');
  // las habilidades del hierro y del putter no tienen golpe que las tire
  for (let i = ABILITY_LIST.length - 1; i >= 0; i--) {
    const a = ABILITIES[ABILITY_LIST[i]];
    // el boomerang tira el palo de la mano y pasa al otro: con una sola raqueta no hay otro
    if (a.club === 'iron' || a.club === 'putter' || a.id === 'boomerang') ABILITY_LIST.splice(i, 1);
    // los del driver y el wedge cambian de nombre: «Plano de hielo», «Un plano instantáneo que...»
    else if (a.club === 'driver' && a.element) {
      a.name = shotName(L('Plano', 'Drive'), a.element);
      a.hint = shotHint(L('plano', 'drive'), a.club, a.element);
    } else if (a.club === 'wedge' && a.element) {
      a.name = shotName(L('Globo', 'Lob'), a.element);
      a.hint = shotHint(L('globo', 'lob'), a.club, a.element);
    }
  }
  Object.assign(ABILITIES.rain, {
    title: L('el bolsillo', 'the pocket'),
    hint: L(`Los alcanzapelotas te tiran ${POCKET_RAIN} pelotas al bolsillo`, `The ball kids toss ${POCKET_RAIN} balls into your pocket`),
  });
  Object.assign(ABILITIES.caddie, { title: L('pelota infinita', 'endless balls'), hint: L('Unos segundos de pelota infinita en el bolsillo', 'A few seconds of endless balls in your pocket') });
}

/** Cuántas pelotas trae la lluvia de pelotas en el tenis. */
export const POCKET_RAIN = 3;

/** Va a la otra modalidad: recarga la página con o sin ?tenis. */
export function switchMode(tennis: boolean): void {
  const url = new URL(location.href);
  if (tennis) url.searchParams.set('tenis', '');
  else url.searchParams.delete('tenis');
  location.href = url.toString();
}
