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

// base relativa: el juego se publica en una subcarpeta de GitHub Pages (leandromagonza.github.io/GolfKnight/)
// y tiene que andar igual abierto desde cualquier ruta.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  build: {
    chunkSizeWarningLimit: 1500,
    // la cinemática es una página aparte (cine.html), mientras sea una prueba
    rollupOptions: { input: { main: 'index.html', cine: 'cine.html' } },
  },
});
