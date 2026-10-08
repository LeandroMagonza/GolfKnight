// Arma la versión de escritorio para Windows (itch.io, y más adelante Steam): compila el juego para vender
// (sin herramientas de prueba), lo pone adentro de Electron (desktop/main.cjs) y deja la carpeta lista para
// subir en release/golf-knight-<versión>-win32-x64/. Ver docs/monetizacion.md.
// uso: node tools/desktop.mjs [full|demo]   (sin nada, la completa)
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packager } from '@electron/packager';
import { buildEdition } from './build.mjs';

const edition = process.argv[2] ?? 'full';
if (!['full', 'demo'].includes(edition)) throw new Error(`versión de escritorio desconocida: ${edition} (son full y demo)`);
const name = edition === 'demo' ? 'golf-knight-demo' : 'golf-knight';
const title = edition === 'demo' ? 'Golf Knight Demo' : 'Golf Knight';

const now = new Date();
const two = (n) => String(n).padStart(2, '0');
const build = `${now.getDate()}/${now.getMonth() + 1} ${two(now.getHours())}:${two(now.getMinutes())}`;

// 1) la app: el proceso de Electron y el juego compilado en web/
const app = resolve('release', `app-${edition}`);
rmSync(app, { recursive: true, force: true });
mkdirSync(app, { recursive: true });
execSync('npx tsc --noEmit', { stdio: 'inherit' });
buildEdition(edition, build, join(app, 'web'));
for (const f of ['main.cjs', 'preload.cjs']) cpSync(join('desktop', f), join(app, f));
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
writeFileSync(join(app, 'package.json'), JSON.stringify({ name, productName: title, version, main: 'main.cjs', private: true }, null, 2));

// 2) el ejecutable, con el Electron de node_modules
const electronVersion = JSON.parse(readFileSync('node_modules/electron/package.json', 'utf8')).version;
const icon = resolve('desktop', 'icon.ico');
const [out] = await packager({
  dir: app,
  out: resolve('release'),
  name,
  executableName: title,
  platform: 'win32',
  arch: 'x64',
  electronVersion,
  asar: true,
  overwrite: true,
  appCopyright: 'Leandro Magonza',
  win32metadata: { CompanyName: 'Leandro Magonza', ProductName: title, FileDescription: title },
  ...(statSync(icon, { throwIfNoEntry: false }) ? { icon } : {}),
});

// 3) los idiomas de Chromium que no hacen falta (el juego es en español y en inglés): unos 40 MB menos
const locales = join(out, 'locales');
for (const f of readdirSync(locales)) if (!/^(en-US|en-GB|es|es-419)\.pak$/.test(f)) rmSync(join(locales, f));

const size = (p) => (statSync(p).isDirectory() ? readdirSync(p).reduce((n, f) => n + size(join(p, f)), 0) : statSync(p).size);
console.log(`${title} ${build}: ${out} · ${(size(out) / 1e6).toFixed(0)} MB`);
