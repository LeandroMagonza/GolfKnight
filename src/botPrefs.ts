// Lo que se le cambia al bot (src/bot.ts) desde el panel de balance, en la pestaña Pruebas. Va aparte del
// bot, que se carga solo con ?bot, para que el panel lo pueda tocar sin traerlo. El bot lo lee en cada
// decisión: vale en el acto, también en medio de una partida. Se guarda en este navegador; en la
// dirección, `?bot&sinhabilidades` lo apaga igual (para las pruebas).

export interface BotPrefs {
  /**
   * Usa las habilidades (10/10, pedido de Leandro: ver si pasa el juego sin ellas). Apagado no tira Q W E
   * R, ni el silenciador del combo, ni el palazo; y en las cartas se queda con una mejora o una cura
   * cuando hay.
   */
  abilities: boolean;
}

const KEY = 'gk.botPrefs';

export const BOT_PREFS: BotPrefs = { abilities: true };

try {
  Object.assign(BOT_PREFS, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
} catch { /* sin localStorage, lo de siempre */ }
if (new URLSearchParams(location.search).has('sinhabilidades')) BOT_PREFS.abilities = false;

export function saveBotPrefs(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(BOT_PREFS));
  } catch { /* queda para esta partida */ }
}
