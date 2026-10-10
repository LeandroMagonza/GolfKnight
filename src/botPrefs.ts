// Lo que se le cambia al bot (src/bot.ts) desde el panel de balance, en la pestaña Pruebas. Va aparte del
// bot, que se carga solo con ?bot, para que el panel lo pueda tocar sin traerlo. El bot lo lee en cada
// decisión: vale en el acto, también en medio de una partida. Se guarda en este navegador; en la
// dirección, `?bot&sinhabilidades` lo apaga igual (para las pruebas).

export interface BotPrefs {
  /**
   * Usa las habilidades y toma mejoras (10/10, pedido de Leandro: ver si pasa el juego sin ellas). Apagado
   * no tira Q W E R, ni el silenciador del combo, ni el palazo, y las cartas las cierra sin elegir ninguna
   * (en el sorteo solo salen habilidades y mejoras).
   */
  abilities: boolean;
  /**
   * Juega (10/10, Leandro: poder sacarlo desde el panel y seguir la partida a mano). Apagado no toca nada:
   * ni el mouse, ni las teclas, ni las cartas, y al terminar no arranca otra sola. No se guarda: con ?bot
   * arranca jugando.
   */
  playing: boolean;
}

const KEY = 'gk.botPrefs';

export const BOT_PREFS: BotPrefs = { abilities: true, playing: true };

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  if (typeof saved.abilities === 'boolean') BOT_PREFS.abilities = saved.abilities;
} catch { /* sin localStorage, lo de siempre */ }
if (new URLSearchParams(location.search).has('sinhabilidades')) BOT_PREFS.abilities = false;

export function saveBotPrefs(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ abilities: BOT_PREFS.abilities }));
  } catch { /* queda para esta partida */ }
}
