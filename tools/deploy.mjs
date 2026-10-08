// Publica el juego en GitHub Pages: compila las versiones y sube dist/ a la rama gh-pages del mismo remoto.
// La rama gh-pages es solo el sitio compilado, así que se pisa entera en cada publicación. Y la demo, a la
// página de itch, para jugar en el navegador (ver tools/itch.mjs).
// uso: npm run deploy [-- --sin-itch]
import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { buildAll, EDITIONS } from './build.mjs';
import { pushItch } from './itch.mjs';

const run = (cmd, cwd = process.cwd()) => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd, cwd = process.cwd()) => execSync(cmd, { cwd }).toString().trim();

const remote = out('git remote get-url origin');
const source = out('git rev-parse --short HEAD');
// la versión que se ve en la pantalla de entrada: día y hora de esta publicación
const now = new Date();
const two = (n) => String(n).padStart(2, '0');
const build = `${now.getDate()}/${now.getMonth() + 1} ${two(now.getHours())}:${two(now.getMinutes())}`;
run('npx tsc --noEmit');
// las tres versiones (ver tools/build.mjs): la completa en la raíz, y la demo y la de Abe en /demo/ y /abe/
buildAll(EDITIONS, build);
// sin esto GitHub pasa el sitio por Jekyll, que ignora lo que empieza con guion bajo
writeFileSync('dist/.nojekyll', '');
if (existsSync('dist/.git')) rmSync('dist/.git', { recursive: true, force: true });
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git -c user.name="${out('git config user.name')}" -c user.email="${out('git config user.email')}" commit -q -m "Publica ${source}"`, 'dist');
run(`git push -f "${remote}" gh-pages`, 'dist');
rmSync('dist/.git', { recursive: true, force: true });
// la demo en itch: la misma de /demo/
const itch = !process.argv.includes('--sin-itch') && pushItch('dist/demo', 'html5', build);
console.log(`Publicado: versión ${build} (${source}). GitHub Pages tarda un minuto o dos en actualizar.${itch ? ' La demo, también en itch.' : ''}`);
