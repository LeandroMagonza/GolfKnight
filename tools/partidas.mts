// Lee las partidas de Supabase (tabla golf_runs, ver src/telemetry.ts) y saca sus números: cuánto tira cada
// uno, cuánto pega, con qué golpe le sale, cuándo suelta, hasta dónde llega en cada nivel (11/10, Leandro:
// para que el bot humano juegue como una persona, y ver la dificultad con partidas de verdad).
//
//   npm run partidas -- [opciones]
//
// La conexión a la base va en web/.supabase-db (ver tools/db.mjs).
//
//   --por=jugador    cómo juntarlas: jugador (y de dónde juega), nivel, version, host o resultado
//   --jugador=3f2a   solo las de ese id (alcanza con el principio; está en el panel B, pestaña Pruebas)
//   --desde=2026-10-11   solo las de ese día en adelante
//   --host=github    solo las de ese sitio: github (la de los amigos), itch, golfknight (la app)
//   --version=demo   solo las de las versiones que dicen eso
//   --todas          también las que jugó el bot un rato (prendido desde el panel)
//   --filas          además, una línea por partida
//   --json           los números en JSON, para pegarlos
import { summarize, type RunRow } from '../src/core/runStats.ts';
import { connect } from './db.mjs';

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const by = opt('por') ?? 'jugador';

const where: string[] = [];
const values: unknown[] = [];
const add = (sql: string, v: unknown) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };
if (opt('jugador')) add('player_id like ?', `${opt('jugador')}%`);
if (opt('desde')) add('created_at >= ?', opt('desde'));
if (opt('host')) add(`data->>'host' ilike ?`, `%${opt('host')}%`);
if (opt('version')) add('version ilike ?', `%${opt('version')}%`);
if (!args.includes('--todas')) where.push(`coalesce((data->>'bot')::boolean, false) = false`);

const client = await connect();
const { rows } = await client.query<RunRow>(
  `select player_id, version, level, result, wave, seconds, created_at, data from golf_runs${where.length ? ` where ${where.join(' and ')}` : ''} order by created_at`,
  values,
);
await client.end();

// el sitio, corto: la de los amigos, itch, la app
const site = (r: RunRow) => {
  const h = r.data.host ?? '';
  return h.includes('github') ? 'web' : h.includes('itch') || h.includes('hwcdn') ? 'itch' : h === 'golfknight' ? 'app' : h || '?';
};
const keyOf: Record<string, (r: RunRow) => string> = {
  jugador: (r) => `${r.player_id.slice(0, 8)} (${site(r)})`,
  nivel: (r) => `nivel ${r.level}`,
  version: (r) => r.version,
  host: site,
  resultado: (r) => r.result,
};
const key = keyOf[by] ?? keyOf.jugador;
const groups = new Map<string, RunRow[]>();
for (const r of rows) {
  const k = key(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k)!.push(r);
}

console.log(`${rows.length} partidas${where.length ? ` (${where.length} filtros)` : ''}, por ${by}\n`);
const out: Record<string, unknown> = {};
for (const [k, list] of groups) {
  const s = summarize(list);
  out[k] = s;
  if (args.includes('--json')) continue;
  const pct = (v: unknown) => `${Math.round(Number(v) * 100)} %`;
  console.log(`${k}: ${s.partidas} partidas (${s.ganadas} ganadas, ${s.minutos} min) · oleada ${s.oleada} · ${s.tirosPorMinuto} tiros/min · pegan ${pct(s.pegan)}`
    + ` · golpes 1-2-3-4: ${(s.golpes as number[]).map((g) => Math.round(g * 100)).join('-')} % · ${s.habilidadesPorMinuto} habilidades/min`
    + ` · vida −${s.vidaPorMinuto}/min · puerta −${s.puertaPorMinuto}/min`);
  if (Number(s.soltadas) > 0) {
    console.log(`   soltando (${s.soltadas}): antes del fuerte ${pct(s.antesDelFuerte)}, en el fuerte ${pct(s.enElFuerte)}, pasado ${pct(s.pasado)}`
      + ` · cerca del tope: ${s.cercaPromedioMs} ms en promedio, ±${s.cercaDesvioMs} ms`);
    console.log(`   cada 25 ms, de −250 a +250: ${(s.cadaVeinticincoMs as number[]).join(' ')}`);
  }
}
if (args.includes('--json')) console.log(JSON.stringify(out, null, 1));
if (args.includes('--filas')) {
  console.log('');
  for (const r of rows) {
    console.log(`${String(r.created_at).slice(0, 24)} · ${r.player_id.slice(0, 8)} · ${site(r)} · ${r.version} · nivel ${r.level} · ${r.result} en la oleada ${r.wave} · ${r.seconds} s`);
  }
}
