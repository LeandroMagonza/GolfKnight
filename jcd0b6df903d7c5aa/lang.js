// El idioma del juego, decidido antes que cualquier otra cosa. Lo cargan index.html y cine.html como
// script común al final del <body>: corre antes que los módulos, así los textos fijos del HTML ya
// están traducidos al primer cuadro. Ver docs/localizacion.md.
//
// Cómo decide: ?lang=es o ?lang=en en la dirección (solo para esa visita); si no, lo elegido con el
// botón de idioma (localStorage gk.lang, lo escribe setLang en src/i18n.ts); si no, el navegador:
// español si alguno de sus idiomas preferidos es español, inglés si no.
//
// Deja el resultado en <html lang>, que es lo que lee src/i18n.ts. Con inglés, traduce los elementos
// marcados: data-en (el texto), data-en-html (el contenido con etiquetas) y data-en-<atributo> (title,
// aria-label, placeholder...).
(function () {
  var lang = 'es';
  try {
    var asked = new URLSearchParams(location.search).get('lang');
    var saved = null;
    try {
      saved = localStorage.getItem('gk.lang');
    } catch (e) { /* sin localStorage: decide el navegador */ }
    if (asked === 'es' || asked === 'en') lang = asked;
    else if (saved === 'es' || saved === 'en') lang = saved;
    else {
      var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
      lang = 'en';
      for (var i = 0; i < prefs.length; i++) if (/^es\b/i.test(prefs[i])) lang = 'es';
    }
  } catch (e) { /* algo raro en el navegador: queda español */ }
  document.documentElement.lang = lang;
  if (lang === 'es') return;
  var all = document.querySelectorAll('*');
  for (var j = 0; j < all.length; j++) {
    var el = all[j];
    for (var k = 0; k < el.attributes.length; k++) {
      var a = el.attributes[k];
      if (a.name === 'data-en') el.textContent = a.value;
      else if (a.name === 'data-en-html') el.innerHTML = a.value;
      else if (a.name.indexOf('data-en-') === 0) el.setAttribute(a.name.slice(8), a.value);
    }
  }
})();
