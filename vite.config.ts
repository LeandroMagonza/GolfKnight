import { defineConfig } from 'vite';

// base relativa: el juego se publica en una subcarpeta de GitHub Pages (leandromagonza.github.io/GolfKnight/)
// y tiene que andar igual abierto desde cualquier ruta.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    // la cinemática es una página aparte (cine.html), mientras sea una prueba
    rollupOptions: { input: { main: 'index.html', cine: 'cine.html' } },
  },
});
