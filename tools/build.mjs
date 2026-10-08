// Compila las versiones del juego (ver src/edition.ts y docs/monetizacion.md): la completa en dist/, la
// demo en dist/demo/ y la de Abe en dist/abe/. Cada una anda sola: se puede subir su carpeta a cualquier
// lado (itch.io, Steam, otra página).
// uso: node tools/build.mjs [full|demo|abe]...   (sin nada, las tres)
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EDITIONS = ['full', 'demo', 'abe'];

/** Dónde queda cada una. */
export const OUT = { full: 'dist', demo: 'dist/demo', abe: 'dist/abe' };

/** Lo que cada versión no usa: public/ se copia entero, así que se saca de su carpeta después de compilar. */
const PRUNE = {
  full: [],
  // el modelo del campesino no lo usa nadie todavía
  demo: ['models/player-peasant.glb'],
  // Abe no ve la cinemática: ni su escenario, ni el mago, ni las voces
  abe: ['models/player-peasant.glb', 'models/cine-dungeon.glb', 'models/mage.glb', 'voices'],
};

/**
 * Saca los pedazos de código que no carga nadie: lo que una versión no tiene (el bot, en la demo y en la
 * de Abe) igual sale como archivo aparte, aunque ya nadie lo pida.
 */
function pruneOrphans(out) {
  const dir = join(out, 'assets');
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f));
  const texts = [...readdirSync(out).filter((f) => f.endsWith('.html')).map((f) => join(out, f)), ...files.map((f) => join(dir, f))]
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  for (const f of files) {
    if (!texts.some((t) => t.path !== join(dir, f) && t.text.includes(f))) rmSync(join(dir, f));
  }
}

function size(path) {
  const s = statSync(path);
  return s.isDirectory() ? readdirSync(path).reduce((n, f) => n + size(join(path, f)), 0) : s.size;
}

/**
 * Compila una versión. La completa vacía dist/ entero (con las otras adentro): por eso, si van varias,
 * va primero. `build` es la versión que se ve en la pantalla de entrada (día y hora).
 */
export function buildEdition(edition, build) {
  if (!EDITIONS.includes(edition)) throw new Error(`versión desconocida: ${edition} (son ${EDITIONS.join(', ')})`);
  const env = { ...process.env, GK_EDITION: edition, ...(build ? { GK_BUILD: build } : {}) };
  execSync('npx vite build --logLevel warn', { stdio: 'inherit', env });
  for (const p of PRUNE[edition]) rmSync(join(OUT[edition], p), { recursive: true, force: true });
  pruneOrphans(OUT[edition]);
  const out = OUT[edition];
  // lo de las otras versiones, que viven adentro de dist/, no cuenta para la completa
  const inner = edition === 'full' ? EDITIONS.filter((e) => e !== 'full' && existsSync(OUT[e])).reduce((n, e) => n + size(OUT[e]), 0) : 0;
  console.log(`${edition}: ${out}/ · ${((size(out) - inner) / 1e6).toFixed(1)} MB`);
}

/** Compila varias, en el orden que no se pisan (la completa primero). */
export function buildAll(editions = EDITIONS, build) {
  for (const e of EDITIONS.filter((x) => editions.includes(x))) buildEdition(e, build);
}

// corrido directo (no importado desde deploy.mjs)
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase()) {
  const asked = process.argv.slice(2);
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  buildAll(asked.length ? asked : EDITIONS);
}
