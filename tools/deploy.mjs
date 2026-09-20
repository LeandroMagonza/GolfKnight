// Publica el juego en GitHub Pages: compila con Vite y sube dist/ a la rama gh-pages del mismo remoto.
// La rama gh-pages es solo el sitio compilado, así que se pisa entera en cada publicación.
// uso: npm run deploy
import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';

const run = (cmd, cwd = process.cwd()) => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd, cwd = process.cwd()) => execSync(cmd, { cwd }).toString().trim();

const remote = out('git remote get-url origin');
const source = out('git rev-parse --short HEAD');
run('npx tsc --noEmit');
run('npx vite build');
// sin esto GitHub pasa el sitio por Jekyll, que ignora lo que empieza con guion bajo
writeFileSync('dist/.nojekyll', '');
if (existsSync('dist/.git')) rmSync('dist/.git', { recursive: true, force: true });
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git -c user.name="${out('git config user.name')}" -c user.email="${out('git config user.email')}" commit -q -m "Publica ${source}"`, 'dist');
run(`git push -f "${remote}" gh-pages`, 'dist');
rmSync('dist/.git', { recursive: true, force: true });
console.log('Publicado. GitHub Pages tarda un minuto o dos en actualizar.');
