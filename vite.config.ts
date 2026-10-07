import { defineConfig } from 'vite';

/**
 * La versión que se ve en la pantalla de entrada: día y hora del build, en la hora de la máquina que
 * compila. La publicación (tools/deploy.mjs) la pasa en GK_BUILD para anunciar la misma que queda subida.
 */
function stamp(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
const BUILD = process.env.GK_BUILD ?? stamp();

/**
 * Qué versión del juego se compila (ver src/edition.ts y tools/build.mjs): la completa, la demo o la de
 * Abe. Las herramientas de prueba van solo en la completa.
 */
const EDITION = process.env.GK_EDITION ?? 'full';
if (!['full', 'demo', 'abe'].includes(EDITION)) throw new Error(`GK_EDITION desconocida: ${EDITION}`);
const DEV_TOOLS = EDITION === 'full';

// base relativa: el juego se publica en una subcarpeta de GitHub Pages (leandromagonza.github.io/GolfKnight/)
// y tiene que andar igual abierto desde cualquier ruta.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD), __EDITION__: JSON.stringify(EDITION), __DEV_TOOLS__: JSON.stringify(DEV_TOOLS) },
  build: {
    chunkSizeWarningLimit: 1500,
    // la completa en dist/, y las otras adentro, cada una en su carpeta: dist/demo/ y dist/abe/
    outDir: EDITION === 'full' ? 'dist' : `dist/${EDITION}`,
    // la cinemática es una página aparte (cine.html), mientras sea una prueba. Abe no la ve
    rollupOptions: { input: EDITION === 'abe' ? { main: 'index.html' } : { main: 'index.html', cine: 'cine.html' } },
  },
});
