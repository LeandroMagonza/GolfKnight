// Los idiomas del juego: español (el original, rioplatense) e inglés. La estrategia completa está en
// docs/localizacion.md.
//
// Todo texto que ve el jugador se escribe donde se usa, con los dos idiomas juntos:
//   L('Oleada despejada', 'Wave cleared')
//   L((n: number) => `Oleada ${n}`, (n: number) => `Wave ${n}`)
// `L` devuelve el del idioma de la página. El idioma no cambia con la página abierta (cambiarlo recarga,
// ver `setLang`), así que se puede usar al armar datos al cargar un módulo, no solo al mostrar.
//
// El idioma lo decide public/lang.js, un script común que corre antes que los módulos (así traduce los
// textos fijos del HTML sin que se vea el español un instante), y lo deja en <html lang>. Sin página
// (las pruebas de vitest) es español.
//
// src/i18n.test.ts frena los textos en español que quedan afuera de un `L`: lo que no ve el jugador
// (ids, registros, mensajes de error para quien programa) se marca con un comentario `i18n-ok` en la línea.

export type Lang = 'es' | 'en';

export const LANGS: readonly Lang[] = ['es', 'en'];

/** El nombre de cada idioma en su idioma, para el botón que lo cambia. */
export const LANG_NAMES: Record<Lang, string> = { es: 'Español', en: 'English' };

/** Dónde queda guardado el idioma elegido con el botón (lo lee también public/lang.js). */
const KEY = 'gk.lang';

export const lang: Lang = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'es';

/** El texto (o la función que lo arma) en el idioma de la página. */
export function L<T>(es: T, en: T): T {
  return lang === 'en' ? en : es;
}

/**
 * Cambia el idioma y recarga. Se saca el `?lang=` de la dirección: si no, le ganaría a lo elegido (ver
 * public/lang.js).
 */
export function setLang(next: Lang): void {
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // sin localStorage: que lo diga la dirección, al menos por esta visita
    url.searchParams.set('lang', next);
  }
  location.replace(url.toString());
}
