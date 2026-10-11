// La base de Supabase (el proyecto del ManaMod, donde está golf_runs; ver src/telemetry.ts), desde la compu.
// La conexión va en web/.supabase-db, una línea que no se sube a git y no se muestra nunca:
//   postgresql://postgres:CONTRASEÑA@db.kdwiuiciobekuedpmfpj.supabase.co:5432/postgres
// (la contraseña de la base: Project Settings → Database). Con esa se puede todo: leer y cambiar la tabla y el
// esquema. El proyecto es también el del ManaMod: acá solo se toca lo del Golf Knight.
//
// Como módulo, `connect()` (lo usa tools/partidas.mts). Solo, corre SQL y muestra lo que devuelve:
//   node tools/db.mjs "select count(*) from golf_runs"
//   node tools/db.mjs --archivo=docs/telemetria.sql
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const FILE = new URL('../.supabase-db', import.meta.url);

/** Conectado a la base, o sale avisando qué falta. */
export async function connect() {
  let url;
  try {
    url = readFileSync(FILE, 'utf8').trim();
  } catch {
    console.log('Falta web/.supabase-db con la conexión a la base (ver tools/db.mjs).');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
  } catch (e) {
    // sin la conexión en el mensaje: lleva la contraseña
    console.log(`No se pudo conectar a la base: ${String(e.message).replaceAll(url, '…')}`);
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
