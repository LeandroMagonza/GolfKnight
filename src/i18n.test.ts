import { describe, expect, it } from 'vitest';
import cine from '../cine.html?raw';
import index from '../index.html?raw';
import { looksSpanish, scanCode, scanHtml } from './i18n.scan';

// Todo texto que ve el jugador va con su inglés al lado (ver src/i18n.ts y docs/localizacion.md). Si
// esto falla, el texto que aparece está en español y afuera de un L(...): envolverlo, o, si el jugador
// no lo ve nunca (un id, un registro), marcar la línea con un comentario i18n-ok.

/** Lo que el jugador no ve: el panel de balance (B) es una herramienta para quien balancea. */
const SKIP = new Set(['./debug.ts', './i18n.ts', './i18n.scan.ts']);

const sources = import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true });

describe('textos sin traducir en el código', () => {
  for (const [file, source] of Object.entries(sources)) {
    if (SKIP.has(file)) continue;
    it(file, () => {
      expect(scanCode(source).map((u) => `${file}:${u.line}  ${u.text}`)).toEqual([]);
    });
  }
});

describe('textos sin traducir en el HTML', () => {
  it('index.html', () => expect(scanHtml(index).map((u) => `index.html:${u.line}  ${u.text}`)).toEqual([]));
  it('cine.html', () => expect(scanHtml(cine).map((u) => `cine.html:${u.line}  ${u.text}`)).toEqual([]));
});

describe('el buscador', () => {
  it('encuentra el español afuera de L y deja pasar el de adentro', () => {
    const found = scanCode([
      "const a = '¡Golpe perfecto!';",
      "const b = L('¡Golpe perfecto!', 'Perfect shot!');",
      "const c = L((n: number) => `Oleada ${n}`, (n: number) => `Wave ${n}`);",
      'const d = `quedan ${n} en la puerta`;',
      "const e = 'de la'; // i18n-ok",
      "console.error('no se pudo abrir la sala', err);",
      'const f = /[\'"]/g.test(x) ? \'Sin pelota\' : y / 2;',
      "// '¡esto es un comentario!'",
      "const g = { name: 'Driver', hint: 'Obstáculos y explota' };",
    ].join('\n'));
    expect(found.map((u) => u.line)).toEqual([1, 4, 7, 9]);
  });

  it('mira los textos y atributos del HTML', () => {
    const found = scanHtml([
      '<head><title>Juego</title></head><body>',
      '<h1>Hola</h1>',
      '<h1 data-en="Hello">Hola</h1>',
      '<div data-en-html="<b>Hi</b>"><b>Hola</b> vos</div>',
      '<button title="Cerrar">×</button>',
      '<button title="Cerrar" data-en-title="Close">×</button>',
      '<style>.a { content: "hola" }</style>',
      '<div translate="no" title="Español">ES <b>Golf Knight</b></div>',
      '</body>',
    ].join('\n'));
    expect(found.map((u) => u.line)).toEqual([2, 5]);
  });

  it('reconoce el español', () => {
    expect(looksSpanish('Oleada despejada')).toBe(true);
    expect(looksSpanish('Pifia')).toBe(false);
    expect(looksSpanish('¡Pifia!')).toBe(true);
    expect(looksSpanish('Wave cleared')).toBe(false);
    expect(looksSpanish('translate(-50%, -100%)')).toBe(false);
  });
});
