// La base de Supabase del Golf Knight (donde está golf_runs; ver src/telemetry.ts), desde la compu.
// La conexión va en web/.supabase-db, que no se sube a git y no se muestra nunca (la primera línea que no
// empieza con #; la contraseña va tal cual, sin escapar nada):
//   postgresql://postgres:CONTRASEÑA@db.ID-DEL-PROYECTO.supabase.co:5432/postgres
// (la del botón Connect del proyecto, con la contraseña de la base). Con esa se puede todo: leer y cambiar
// la tabla y el esquema.
//
// Como módulo, `connect()` (lo usa tools/partidas.mts). Solo, corre SQL y muestra lo que devuelve:
//   node tools/db.mjs "select count(*) from golf_runs"
//   node tools/db.mjs --archivo=docs/telemetria.sql
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const FILE = new URL('../.supabase-db', import.meta.url);

/**
 * La conexión del archivo: la primera línea que no es un comentario (#). Se separa a mano, así la
 * contraseña puede tener cualquier cosa (@, :, /, #) sin escaparla: va hasta la última @.
 */
function readConnection() {
  let text;
  try {
    text = readFileSync(FILE, 'utf8');
  } catch {
    return { error: 'Falta web/.supabase-db con la conexión a la base (ver tools/db.mjs).' };
  }
  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#')) ?? '';
  const m = /^postgres(?:ql)?:\/\/([^:/]+):(.*)@([^@/:]+)(?::(\d+))?\/([^?\s]+)/.exec(line);
  if (!m) return { error: 'En web/.supabase-db no hay una conexión que empiece con postgresql://usuario:contraseña@…' };
  const [, user, password, host, port, database] = m;
  if (!password || /^\[?YOUR-PASSWORD\]?$|^CONTRASEÑA$/.test(password)) return { error: 'Falta la contraseña en web/.supabase-db.' };
  if (host.includes('REF')) return { error: 'Falta el id del proyecto en web/.supabase-db (donde dice REF).' };
  return { config: { user, password, host, port: Number(port ?? 5432), database }, secret: password };
}

/** Conectado a la base, o sale avisando qué falta. */
export async function connect() {
  const { config, secret, error } = readConnection();
  if (error) {
    console.log(error);
    process.exit(1);
  }
  const client = new pg.Client({ ...config, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
  } catch (e) {
    // sin la contraseña en el mensaje
    console.log(`No se pudo conectar a la base (${config.host}): ${String(e.message).replaceAll(secret, '…')}`);
    process.exit(1);
  }
  return client;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const file = args.find((a) => a.startsWith('--archivo='))?.slice('--archivo='.length);
  const sql = file ? readFileSync(file, 'utf8') : args.filter((a) => !a.startsWith('--')).join(' ');
  if (!sql.trim()) {
    console.log('uso: node tools/db.mjs "select …"   o   node tools/db.mjs --archivo=x.sql');
    process.exit(1);
  }
  const client = await connect();
  try {
    const res = await client.query(sql);
    for (const r of Array.isArray(res) ? res : [res]) {
      if (r.rows?.length) console.table(r.rows);
      else console.log(`${r.command ?? 'listo'}${r.rowCount != null ? ` · ${r.rowCount} filas` : ''}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
