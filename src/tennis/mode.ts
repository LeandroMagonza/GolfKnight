// Modo tenis (prototipo): un tenista en vez del golfista. Se entra con ?tenis en la URL, o con el botón
// de la intro, que recarga la página con eso. Todo lo demás (enemigos, oleadas, cartas, habilidades,
// la barra de carga) es el mismo juego.
//
// Los golpes son dos de los palos de siempre, con otro nombre, para que las habilidades de palo y
// elemento sigan andando: el **plano** es el driver (sale rasante, rebota en el primer enemigo y
// vuelve) y el **globo** es el wedge (cae donde apuntás, revienta en área y esa pelota se pierde). El
// hierro y el putter no están.
import { ABILITIES, ABILITY_LIST } from '../core/abilities';
import { CLUB_ORDER, CLUBS } from '../core/clubs';

export const TENNIS_ON = new URLSearchParams(location.search).has('tenis');

/** Arma los golpes y las cartas del tenis. Va antes de armar el HUD, que dibuja los palos. */
export function applyTennis(): void {
  Object.assign(CLUBS.driver, { name: 'Plano', title: 'Rasante', hint: 'Rebota y vuelve', returns: true });
  Object.assign(CLUBS.wedge, { name: 'Globo', title: 'Globo', hint: 'Área, no vuelve' });
  CLUB_ORDER.splice(0, CLUB_ORDER.length, 'driver', 'wedge');
  // las habilidades del hierro y del putter no tienen golpe que las tire
  for (let i = ABILITY_LIST.length - 1; i >= 0; i--) {
    const a = ABILITIES[ABILITY_LIST[i]];
    if (a.club === 'iron' || a.club === 'putter') ABILITY_LIST.splice(i, 1);
    else if (a.club === 'driver') {
      a.name = a.name.replace('Driver', 'Plano');
      a.hint = a.hint.replace('Un tiro de driver', 'Un plano');
    } else if (a.club === 'wedge') {
      a.name = a.name.replace('Wedge', 'Globo');
      a.hint = a.hint.replace('Un tiro de wedge', 'Un globo');
    }
  }
  Object.assign(ABILITIES.rain, { title: 'el bolsillo', hint: `Los alcanzapelotas te tiran ${POCKET_RAIN} pelotas al bolsillo` });
  Object.assign(ABILITIES.caddie, { title: 'pelota infinita', hint: 'Durante unos segundos el bolsillo nunca se vacía: apenas sacás, el caddie te da otra, dorada' });
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
