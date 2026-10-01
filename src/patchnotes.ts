// Las patch notes en el juego: una libreta junto a la versión, en la pantalla de entrada, que abre
// PATCHNOTES.md como hojas rayadas. Del archivo se muestran solo los días: el encabezado (cómo se
// mantiene), los hashes de los commits y la sección «Detrás de escena» son para quien programa.
//
// Un puntito sobre la libreta avisa que hay notas que todavía no se abrieron en este navegador.

import notes from '../PATCHNOTES.md?raw';

const SEEN_KEY = 'gk.notesSeen';
const BACKSTAGE = 'Detrás de escena';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** El texto de una línea: sin los hashes del final, con `código` y **negrita**. */
function inline(text: string): string {
  return escape(text.replace(/(\s*`[0-9a-f]{7,40}`)+\s*$/, ''))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** El markdown de PATCHNOTES.md (días, secciones en negrita y viñetas) pasado a HTML. */
function render(md: string): string {
  const out: string[] = [];
  let item: string | null = null;
  let list = false;
  let skipping = false;
  const flush = () => {
    if (item !== null) out.push(`<li>${inline(item)}</li>`);
    item = null;
  };
  const close = () => {
    flush();
    if (list) out.push('</ul>');
    list = false;
  };
  const body = md.slice(md.indexOf('\n## ') + 1);
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      close();
      skipping = false;
      out.push(`<h3>${inline(line.slice(3))}</h3>`);
    } else if (/^\*\*[^*]+\*\*$/.test(line)) {
      close();
      skipping = line.slice(2, -2) === BACKSTAGE;
      if (!skipping) out.push(`<h4>${inline(line.slice(2, -2))}</h4>`);
    } else if (skipping) {
      continue;
    } else if (line.startsWith('- ')) {
      flush();
      if (!list) out.push('<ul>');
      list = true;
      item = line.slice(2);
    } else if (item !== null && line.startsWith('  ')) {
      item += ' ' + line.trim();
    } else if (line === '') {
      close();
    }
  }
  close();
  return out.join('');
}

/** Un número que cambia si cambian las notas, para el puntito de «hay algo nuevo». */
function digest(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

export function setupPatchNotes(): void {
  const button = document.getElementById('notesbtn');
  const panel = document.getElementById('notes');
  if (!button || !panel) return;
  const page = panel.querySelector<HTMLElement>('.page')!;
  const rings = panel.querySelector('.rings');
  if (rings) rings.innerHTML = '<i></i>'.repeat(14);
  const version = digest(notes);
  let seen = false;
  try {
    seen = localStorage.getItem(SEEN_KEY) === version;
  } catch { /* sin localStorage: el puntito se queda */ }
  button.classList.toggle('fresh', !seen);

  const open = () => {
    if (!page.innerHTML) page.innerHTML = render(notes);
    panel.hidden = false;
    page.scrollTop = 0;
    page.focus();
    button.classList.remove('fresh');
    try {
      localStorage.setItem(SEEN_KEY, version);
    } catch { /* la próxima vez vuelve el puntito */ }
  };
  const close = () => {
    panel.hidden = true;
    (document.activeElement as HTMLElement | null)?.blur();
  };
  button.addEventListener('click', () => {
    (button as HTMLElement).blur();
    open();
  });
  panel.querySelector('.close')?.addEventListener('click', close);
  // un click afuera de la libreta la cierra
  panel.addEventListener('click', (e) => {
    if (e.target === panel) close();
  });
  // con la libreta abierta el teclado y la rueda son de ella: el Espacio no arranca la partida, Esc la cierra
  addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    e.stopPropagation();
    if (e.code === 'Escape') close();
  }, { capture: true });
  panel.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
}
