// Busca textos en español que quedaron sin traducir: en el código, los que no están adentro de un `L(...)`;
// en el HTML, los que no tienen su data-en. Lo usa src/i18n.test.ts. Es una red, no un analizador
// completo: reconoce comentarios, comillas, plantillas y expresiones regulares, que es lo que hace falta
// para no confundir un texto con código.

/** Un texto sin traducir: la línea donde empieza y qué dice. */
export interface Untranslated {
  line: number;
  text: string;
}

/** Letras que solo tiene el español (en este juego, el inglés no las usa). */
const SPANISH_CHARS = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
/** Palabras cortas que delatan una frase en español (con al menos un espacio en el texto). */
const SPANISH_WORDS = /(?:^|[^\p{L}])(?:de|la|el|los|las|que|con|por|para|sin|una|del|al|se|tu|tus|vos|hay|más|está|están|oleada|puerta|palo|pelota|golpe|recarga)(?=[^\p{L}]|$)/iu;

/** ¿Parece un texto en español? */
export function looksSpanish(text: string): boolean {
  return SPANISH_CHARS.test(text) || (/\s/.test(text) && SPANISH_WORDS.test(text));
}

/** Llamadas cuyos textos no son para el jugador, o ya están traducidos. */
const EXEMPT_CALLS = new Set(['L', 'console.log', 'console.warn', 'console.error', 'console.info', 'console.debug', 'Error', 'TypeError', 'RangeError']);
/** Antes de estas palabras, una barra abre una expresión regular (y no es una división). */
const BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);

/** Los textos en español de un archivo de TypeScript que no están adentro de un `L(...)`. */
export function scanCode(source: string): Untranslated[] {
  const out: Untranslated[] = [];
  const lines = source.split('\n');
  const lineAt = (i: number) => {
    let n = 1;
    for (let k = 0; k < i; k++) if (source.charCodeAt(k) === 10) n++;
    return n;
  };
  // los paréntesis abiertos, y si cada uno es de una llamada exenta
  const parens: boolean[] = [];
  // lo último que no fue espacio ni comentario: decide si una barra es división o expresión regular
  let prev = '';
  let prevWord = '';
  let i = 0;

  const report = (start: number, text: string) => {
    if (parens.some(Boolean) || !looksSpanish(text)) return;
    const line = lineAt(start);
    if (lines[line - 1]?.includes('i18n-ok')) return;
    out.push({ line, text: text.replace(/\s+/g, ' ').trim().slice(0, 120) });
  };

  /** Lee código hasta `}` sin pareja (adentro de un `${...}`) o hasta el final. */
  const code = (inTemplate: boolean): void => {
    let braces = 0;
    while (i < source.length) {
      const c = source[i];
      const next = source[i + 1];
      if (c === '/' && next === '/') {
        while (i < source.length && source[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        i = end < 0 ? source.length : end + 2;
        continue;
      }
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        const start = i++;
        let text = '';
        while (i < source.length && source[i] !== c && source[i] !== '\n') {
          if (source[i] === '\\') text += source[++i] ?? '';
          else text += source[i];
          i++;
        }
        i++;
        report(start, text);
        prev = 'x';
        prevWord = '';
        continue;
      }
      if (c === '`') {
        const start = i++;
        let text = '';
        while (i < source.length && source[i] !== '`') {
          if (source[i] === '\\') {
            text += source[i + 1] ?? '';
            i += 2;
          } else if (source[i] === '$' && source[i + 1] === '{') {
            i += 2;
            text += ' ';
            const saved = prev;
            prev = '';
            code(true);
            prev = saved;
          } else text += source[i++];
        }
        i++;
        report(start, text);
        prev = 'x';
        prevWord = '';
        continue;
      }
      if (c === '/') {
        const division = /[\w$)\]]/.test(prev) && !BEFORE_REGEX.has(prevWord);
        if (!division) {
          // una expresión regular: hasta la barra que la cierra, fuera de los corchetes
          i++;
          let klass = false;
          while (i < source.length && source[i] !== '\n') {
            const r = source[i];
            if (r === '\\') i++;
            else if (r === '[') klass = true;
            else if (r === ']') klass = false;
            else if (r === '/' && !klass) break;
            i++;
          }
          i++;
          while (/[a-z]/i.test(source[i] ?? '')) i++;
          prev = 'x';
          prevWord = '';
          continue;
        }
      }
      if (/[A-Za-z_$]/.test(c)) {
        const m = /^[\w$]+(?:\s*\.\s*[\w$]+)*/.exec(source.slice(i, i + 200))!;
        prevWord = m[0].replace(/\s+/g, '');
        prev = 'x';
        i += m[0].length;
        continue;
      }
      if (c === '(') {
        parens.push(EXEMPT_CALLS.has(prevWord) && prev === 'x');
        prev = '(';
        prevWord = '';
        i++;
        continue;
      }
      if (c === ')') {
        parens.pop();
        prev = ')';
        prevWord = '';
        i++;
        continue;
      }
      if (c === '{') braces++;
      if (c === '}') {
        if (inTemplate && braces === 0) {
          i++;
          return;
        }
        braces--;
      }
      prev = c;
      prevWord = '';
      i++;
    }
  };
  code(false);
  return out;
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Atributos que el jugador lee (o escucha, con un lector de pantalla). */
const READ_ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];

/**
 * Los textos del <body> de un HTML que no tienen traducción: un texto tiene que estar en un elemento con
 * data-en (o adentro de uno con data-en-html), y title, aria-label, placeholder y alt, tener su
 * data-en-<atributo>. No mira adentro de <script>, <style> ni <svg>, ni de lo marcado translate="no" (el
 * nombre del juego, los nombres de los idiomas).
 */
export function scanHtml(html: string): Untranslated[] {
  const out: Untranslated[] = [];
  const body = html.indexOf('<body');
  const lineAt = (i: number) => html.slice(0, i).split('\n').length;
  const stack: { tag: string; attrs: Record<string, string> }[] = [];
  const tagRe = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  tagRe.lastIndex = Math.max(0, body);
  let last = tagRe.lastIndex;
  const skipping = () => stack.some((s) => s.tag === 'script' || s.tag === 'style' || s.tag === 'svg' || s.attrs.translate === 'no');
  const text = (from: number, to: number) => {
    const t = html.slice(from, to).replace(/&[a-z]+;|&#\d+;/g, ' ').trim();
    if (!t || !/\p{L}{2,}/u.test(t) || skipping()) return;
    const top = stack[stack.length - 1];
    if (top && 'data-en' in top.attrs) return;
    if (stack.some((s) => 'data-en-html' in s.attrs)) return;
    out.push({ line: lineAt(from), text: t.replace(/\s+/g, ' ').slice(0, 120) });
  };
  for (let m = tagRe.exec(html); m; m = tagRe.exec(html)) {
    text(last, m.index);
    last = tagRe.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    const [, close, rawTag, rawAttrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (close) {
      const at = stack.map((s) => s.tag).lastIndexOf(tag);
      if (at >= 0) stack.length = at;
      if (tag === 'body') break;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    }
    if (!skipping() && attrs.translate !== 'no') {
      for (const name of READ_ATTRS) {
        const value = attrs[name];
        if (value && /\p{L}{2,}/u.test(value) && !(`data-en-${name}` in attrs) && !stack.some((s) => 'data-en-html' in s.attrs)) {
          out.push({ line: lineAt(m.index), text: `${name}="${value}"` });
        }
      }
    }
    if (!selfClose && !VOID_TAGS.has(tag)) stack.push({ tag, attrs });
  }
  return out;
}
