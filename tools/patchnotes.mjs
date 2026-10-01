// Patch notes: todo commit de main tiene que figurar en PATCHNOTES.md, nombrado por su hash corto.
// Un commit que toca PATCHNOTES.md se cuenta solo (no puede nombrarse a sí mismo).
// uso: node tools/patchnotes.mjs             lista lo que falta, contra el PATCHNOTES.md del disco
//      node tools/patchnotes.mjs --pre-push  lo corre .githooks/pre-push: frena la subida de main si falta algo
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const FILE = 'PATCHNOTES.md';
const BRANCH = 'refs/heads/main';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const lines = (text) => text.split('\n').filter(Boolean);

// los commits de la historia de `tip` que las notas no nombran
function missing(tip, notes) {
  const named = notes.match(/\b[0-9a-f]{7,40}\b/g) ?? [];
  const self = new Set(lines(git('log', '--format=%H', tip, '--', FILE)));
  return lines(git('rev-list', '--no-merges', tip))
    .filter((hash) => !self.has(hash) && !named.some((n) => hash.startsWith(n)));
}

const describe = (hash) => git('log', '-1', '--date=format:%d/%m %H:%M', '--format=%h  %ad  %s', hash);

if (process.argv.includes('--pre-push')) {
  // git pasa por stdin una línea por rama: <ref local> <sha local> <ref remota> <sha remota>
  const pushed = lines(readFileSync(0, 'utf8')).map((l) => l.split(' '))
    .filter(([, sha, ref]) => ref === BRANCH && !/^0+$/.test(sha));
  for (const [, sha] of pushed) {
    let notes = '';
    try { notes = git('show', `${sha}:${FILE}`); } catch { /* todavía no existe */ }
    const left = missing(sha, notes);
    if (left.length === 0) continue;
    console.error(`\n${FILE} no nombra ${left.length} commit(s) de los que se suben a main:\n`);
    for (const hash of left) console.error(`  ${describe(hash)}`);
    console.error(`
Antes de subir: sumá esos cambios a ${FILE}, en la sección del día (la más nueva arriba), escritos
para quien juega y con el hash corto al final de cada línea. Commitealo aparte y volvé a hacer push.
\`node tools/patchnotes.mjs\` muestra lo que falta contra el archivo del disco.
`);
    process.exit(1);
  }
} else {
  const left = missing('HEAD', existsSync(FILE) ? readFileSync(FILE, 'utf8') : '');
  if (left.length === 0) console.log(`${FILE} nombra todos los commits.`);
  else {
    console.log(`Faltan en ${FILE} (${left.length}):`);
    for (const hash of left) console.log(`  ${describe(hash)}`);
    process.exitCode = 1;
  }
}
