// Sube a itch.io con butler, el programa oficial de itch: de una versión a la siguiente manda solo lo
// que cambió, y la app de itch actualiza sola a los que la tienen. Cada cosa va en su canal de la página
// (https://forja-de-almas.itch.io/golf-knight): la demo para jugar en el navegador en `html5` (la sube
// `npm run deploy`) y la completa de Windows en `windows` (la sube `npm run desktop -- --publicar`).
// Hace falta butler y haber hecho `butler login` una vez (8/10). Sin eso avisa y sigue. Ver
// docs/monetizacion.md.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const ITCH_GAME = 'forja-de-almas/golf-knight';
export const ITCH_PAGE = 'https://forja-de-almas.itch.io/golf-knight';

/** Sube la carpeta `dir` al canal `channel` de la página, con la versión que se ve en itch. */
export function pushItch(dir, channel, version) {
  if (spawnSync('butler', ['--version'], { stdio: 'ignore', shell: true }).status !== 0) {
    console.log(`itch: no está butler, no se subió ${channel}`);
    return false;
  }
  if (!existsSync(join(homedir(), '.config', 'itch', 'butler_creds'))) {
    console.log(`itch: falta \`butler login\`, no se subió ${channel}`);
    return false;
  }
  execSync(`butler push "${dir}" ${ITCH_GAME}:${channel} --userversion "${version}"`, { stdio: 'inherit' });
  return true;
}
