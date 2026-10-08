// Publica el juego: compila las tres versiones, arma el sitio de GitHub Pages en dist-pages/ y lo sube a la
// rama gh-pages del mismo remoto (se pisa entera en cada publicación), y sube la demo a itch (ver
// tools/itch.mjs). uso: npm run deploy [-- --sin-itch] [-- --local]   (--local: arma dist-pages/ y no sube nada)
//
// Desde el 8/10 el juego se juega en itch.io, y GitHub Pages queda así (ver docs/monetizacion.md):
// - la raíz: el aviso de que se mudó a itch (site/index.html), y version.json, el que leen las apps de
//   escritorio para avisar que hay una nueva;
// - abe/p<N>/: Abe, uno por protocolo (NET_PROTOCOL en src/net/snapshot.ts). Los de protocolos anteriores
//   se traen de la gh-pages publicada y no se borran nunca: una app vieja manda a su Abe. abe/ solo
//   reenvía al primero (los enlaces de antes de los protocolos);
// - una carpeta con nombre sacado de la contraseña de .amigos (que no se sube): la completa, con las
//   herramientas de prueba, para los que ayudan a probar. La raíz pide la contraseña;
// - demo/: reenvía a itch.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { buildAll, EDITIONS, OUT } from './build.mjs';
import { ITCH_PAGE, pushItch } from './itch.mjs';

const run = (cmd, cwd = process.cwd()) => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd, cwd = process.cwd()) => execSync(cmd, { cwd }).toString().trim();

const PAGES = 'dist-pages';
const remote = out('git remote get-url origin');
const source = out('git rev-parse --short HEAD');
// la versión que se ve en la pantalla de entrada: día y hora de esta publicación
const now = new Date();
const two = (n) => String(n).padStart(2, '0');
const build = `${now.getDate()}/${now.getMonth() + 1} ${two(now.getHours())}:${two(now.getMinutes())}`;

/** La carpeta de la completa: sale de la contraseña, con la misma cuenta que hace site/index.html. */
function friendsFolder() {
  if (!existsSync('.amigos')) throw new Error('falta .amigos: la contraseña de la versión para los que prueban (una línea; no se sube a git)');
  const clean = readFileSync('.amigos', 'utf8').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) throw new Error('.amigos está vacío');
  return `j${createHash('sha256').update(`golfknight:${clean}`).digest('hex').slice(0, 16)}`;
}

/** El protocolo de Abe de este código. */
const protocol = Number(/export const NET_PROTOCOL = (\d+)/.exec(readFileSync('src/net/snapshot.ts', 'utf8'))?.[1]);
if (!protocol) throw new Error('no encontré NET_PROTOCOL en src/net/snapshot.ts');

/** Una página que manda a otra dirección (conserva lo que traiga el enlace, si `keep`). */
const redirect = (to, keep = false) => `<!doctype html><meta charset="utf-8"><title>Golf Knight</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${keep ? '' : `<meta http-equiv="refresh" content="0; url=${to}">`}
<script>location.replace(${JSON.stringify(to)}${keep ? ' + location.search + location.hash' : ''});</script>
<p><a href="${to}">Golf Knight</a></p>
`;

/** Los Abe de protocolos anteriores, de la gh-pages publicada: no se borran nunca. */
function keepOldAbe() {
  try {
    execSync(`git fetch -q "${remote}" gh-pages`, { stdio: 'ignore' });
  } catch {
    return 0;
  }
  const files = out('git ls-tree -r --name-only FETCH_HEAD -- abe').split('\n').filter((f) => {
    const m = /^abe\/p(\d+)\//.exec(f);
    return m && Number(m[1]) !== protocol;
  });
  for (const f of files) {
    mkdirSync(dirname(join(PAGES, f)), { recursive: true });
    writeFileSync(join(PAGES, f), execSync(`git show "FETCH_HEAD:${f}"`, { maxBuffer: 1 << 28 }));
  }
  return files.length;
}

run('npx tsc --noEmit');
const secret = friendsFolder();
// las tres versiones (ver tools/build.mjs): la completa en dist/, y la demo y la de Abe en dist/demo/ y dist/abe/
buildAll(EDITIONS, build);

rmSync(PAGES, { recursive: true, force: true });
// la raíz: el aviso de la mudanza, con los banners y el ícono
cpSync('site', PAGES, { recursive: true });
for (const lang of ['es', 'en']) cpSync(`promo/itch/${lang}/banner-1920x600.png`, join(PAGES, `banner-${lang}.png`));
cpSync('promo/itch/icono-512.png', join(PAGES, 'icono.png'));
cpSync('public/version.json', join(PAGES, 'version.json'));
// Abe: el de este protocolo, los anteriores, y abe/ que reenvía al primero
cpSync(OUT.abe, join(PAGES, 'abe', `p${protocol}`), { recursive: true });
const old = keepOldAbe();
writeFileSync(join(PAGES, 'abe', 'index.html'), redirect('p1/', true));
// la completa, para los que prueban (sin la demo ni Abe, que viven adentro de dist/)
const inner = [OUT.demo, OUT.abe].map((p) => join(p) + sep);
cpSync(OUT.full, join(PAGES, secret), { recursive: true, filter: (src) => !inner.some((p) => `${join(src)}${sep}`.startsWith(p)) });
// la demo de antes: a itch
mkdirSync(join(PAGES, 'demo'), { recursive: true });
writeFileSync(join(PAGES, 'demo', 'index.html'), redirect(ITCH_PAGE));
// sin esto GitHub pasa el sitio por Jekyll, que ignora lo que empieza con guion bajo
writeFileSync(join(PAGES, '.nojekyll'), '');
console.log(`sitio: ${PAGES}/ · Abe p${protocol}${old ? ` (y ${old} archivos de protocolos anteriores)` : ''} · la completa en /${secret}/`);
if (process.argv.includes('--local')) process.exit(0);

run('git init -q -b gh-pages', PAGES);
run('git add -A', PAGES);
run(`git -c user.name="${out('git config user.name')}" -c user.email="${out('git config user.email')}" commit -q -m "Publica ${source}"`, PAGES);
run(`git push -f "${remote}" gh-pages`, PAGES);
rmSync(join(PAGES, '.git'), { recursive: true, force: true });
// la demo en itch
const itch = !process.argv.includes('--sin-itch') && pushItch(OUT.demo, 'html5', build);
console.log(`Publicado: versión ${build} (${source}). GitHub Pages tarda un minuto o dos en actualizar.${itch ? ' La demo, también en itch.' : ''}`);
