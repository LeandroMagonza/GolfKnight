// Turnos para lo pesado (14/10): cuando varios trabajan a la vez (agentes armando jefes, por ejemplo), la
// compu no aguanta dos navegadores o dos Blender juntos (el 22/9 dos pruebas en paralelo la trabaron y las
// dos murieron por tiempo). Este espera su turno, corre el comando y suelta el turno al terminar.
//
//   node tools/lock.mjs <turno> -- <comando> [argumentos...]
//
// Turnos que se usan: «navegador» (todo lo que abre Chromium o un servidor de Vite: bot-tanda, jefe-fotos,
// playtest...) y «blender». El turno es una carpeta en logs/turnos/: si quedó de un proceso que ya no está
// (o tiene más de 40 minutos), se lo saca.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const cut = argv.indexOf('--');
const name = argv[0];
if (!name || cut < 1 || cut === argv.length - 1) {
  console.log('uso: node tools/lock.mjs <turno> -- <comando> [argumentos...]');
  process.exit(2);
}
const command = argv.slice(cut + 1);
mkdirSync('logs/turnos', { recursive: true });
const dir = `logs/turnos/${name}`;
const STALE_MS = 40 * 60000;

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

function tryTake() {
  try {
    mkdirSync(dir);
    writeFileSync(`${dir}/quien.json`, JSON.stringify({ pid: process.pid, since: Date.now(), command: command.join(' ') }));
    return true;
  } catch {
    try {
      const who = JSON.parse(readFileSync(`${dir}/quien.json`, 'utf8'));
      if (!alive(who.pid) || Date.now() - who.since > STALE_MS) {
        rmSync(dir, { recursive: true, force: true });
        return tryTake();
      }
    } catch {
      // la carpeta está pero todavía sin quien.json: el otro la está armando
    }
    return false;
  }
}

const release = () => rmSync(dir, { recursive: true, force: true });
let told = false;
const t0 = Date.now();
while (!tryTake()) {
  if (!told) {
    let who = '';
    try {
      who = JSON.parse(readFileSync(`${dir}/quien.json`, 'utf8')).command;
    } catch { /* */ }
    console.log(`[turno ${name}] esperando: lo tiene ${who || 'otro'}`);
    told = true;
  }
  await new Promise((r) => setTimeout(r, 1500));
}
if (told) console.log(`[turno ${name}] es mío (esperé ${Math.round((Date.now() - t0) / 1000)} s)`);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { release(); process.exit(130); });
// node y los .exe van directo, sin consola de por medio: así un «&» dentro de un argumento (las URL de
// bot-tanda) no se lee como otro comando. Lo demás (npx, que en Windows es un .cmd), por la consola, con
// cada argumento entre comillas
const direct = process.platform !== 'win32' || /^(node|.*\.exe)$/i.test(command[0]);
const child = direct
  ? spawn(command[0] === 'node' ? process.execPath : command[0], command.slice(1), { stdio: 'inherit' })
  : spawn(command.map((a) => (/[\s&|<>^"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' '), { stdio: 'inherit', shell: true });
child.on('exit', (code) => {
  release();
  process.exit(code ?? 1);
});
child.on('error', (e) => {
  console.log(`[turno ${name}] no pude correr el comando: ${e.message}`);
  release();
  process.exit(1);
});
