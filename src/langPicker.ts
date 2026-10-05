// El botón de idioma de la pantalla de entrada (ES · EN, junto a la versión): el de ahora encendido, el
// otro cambia y recarga (ver src/i18n.ts). Solo está en la entrada: en plena partida no se cambia.
import { lang, setLang, type Lang } from './i18n';

export function setupLangPicker(): void {
  const box = document.getElementById('langpick');
  if (!box) return;
  for (const button of Array.from(box.querySelectorAll<HTMLButtonElement>('button[data-lang]'))) {
    const mine = button.dataset.lang === lang;
    button.classList.toggle('on', mine);
    button.setAttribute('aria-pressed', String(mine));
    button.addEventListener('click', () => {
      button.blur();
      if (!mine) setLang(button.dataset.lang as Lang);
    });
  }
}
