// Una copia quieta del juego para probar (15/10): compila la versión completa (con el panel B, el
// bestiario y la música) en logs/local-build y la sirve en http://localhost:4180. A diferencia de
// `npm run dev`, no se recarga cuando alguien guarda un archivo (con varias sesiones o agentes trabajando,
// el servidor de desarrollo recargaba la página cada pocos segundos). Para ver cambios nuevos, volver a
// correrlo: compila de nuevo.
//
//   npm run local        (o node tools/local.mjs [puerto])
import { build, preview } from 'vite';

const port = Number(process.argv[2] ?? 4180);
const outDir = 'logs/local-build';
process.env.GK_OUT = outDir;
process.env.GK_EDITION = 'full';
const t0 = Date.now();
await build({ root: process.cwd(), logLevel: 'error', build: { outDir, emptyOutDir: true } });
const server = await preview({ root: process.cwd(), logLevel: 'error', build: { outDir }, preview: { port, strictPort: true } });
const stamp = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
console.log(`compilado a las ${stamp} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log(`  el juego:     http://localhost:${port}/`);
console.log(`  bestiario:    http://localhost:${port}/bestiario.html`);
console.log(`  música:       http://localhost:${port}/musica.html`);
console.log('Ctrl+C para cortar.');
void server;
