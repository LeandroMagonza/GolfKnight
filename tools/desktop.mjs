// Arma la versión de escritorio para Windows (itch.io, y más adelante Steam): compila el juego para vender
// (sin herramientas de prueba), lo pone adentro de Electron (desktop/main.cjs) y deja la carpeta lista para
// subir en release/golf-knight-<versión>-win32-x64/. Ver docs/monetizacion.md.
// uso: node tools/desktop.mjs [full|demo] [--publicar]   (sin nada, la completa)
//
// --publicar: es la que se sube a itch. Anota su versión en public/version.json (con el próximo deploy
// queda en la página, y las apps viejas avisan que hay una nueva: ver checkUpdate en src/main.ts) y arma
// el zip para subir en release/itch/.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packager } from '@electron/packager';
import { buildEdition } from './build.mjs';

const args = process.argv.slice(2);
const publish = args.includes('--publicar');
const edition = args.find((a) => !a.startsWith('--')) ?? 'full';
/** Dónde se baja cada una: el aviso de versión nueva lleva ahí. Sin dirección, avisa sin el botón. */
const ITCH = 'https://forja-de-almas.itch.io/golf-knight';
const DOWNLOAD = { full: ITCH, demo: ITCH };
if (!['full', 'demo'].includes(edition)) throw new Error(`versión de escritorio desconocida: ${edition} (son full y demo)`);
const name = edition === 'demo' ? 'golf-knight-demo' : 'golf-knight';
const title = edition === 'demo' ? 'Golf Knight Demo' : 'Golf Knight';

const now = new Date();
const two = (n) => String(n).padStart(2, '0');
const build = `${now.getDate()}/${now.getMonth() + 1} ${two(now.getHours())}:${two(now.getMinutes())}`;
// el mismo momento en milisegundos, adentro del juego y en version.json
process.env.GK_BUILD_TIME = String(now.getTime());

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

if (publish) {
  // la versión publicada, para el aviso de las apps viejas (se sube con el próximo deploy)
  const path = join('public', 'version.json');
  let all = {};
  try { all = JSON.parse(readFileSync(path, 'utf8')); } catch { /* la primera vez */ }
  all[edition] = { build, time: now.getTime(), url: DOWNLOAD[edition] };
  writeFileSync(path, `${JSON.stringify(all, null, 2)}\n`);
  // y el zip para itch (con 7-Zip)
  mkdirSync(resolve('release', 'itch'), { recursive: true });
  const zip = resolve('release', 'itch', `${name}-windows.zip`);
  rmSync(zip, { force: true });
  execSync(`7z a -tzip -mx=7 "${zip}" "${out}"`, { stdio: 'ignore' });
  console.log(`para subir: ${zip} · ${(statSync(zip).size / 1e6).toFixed(0)} MB. Commitear public/version.json y hacer el deploy.`);
}
