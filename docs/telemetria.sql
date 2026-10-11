-- Golf Knight: las partidas que manda el juego al terminar (src/telemetry.ts).
-- Va en el proyecto de Supabase del Golf Knight (qdcrurklskmjizmvxwzb; hasta el 11/10 estaba en el del
-- ManaMod). Se corre una vez: en el SQL Editor, o desde la compu con
--   node tools/db.mjs --archivo=docs/telemetria.sql
-- Se puede volver a correr: no rompe lo que ya está.
--
-- La clave pública que va en el juego solo puede agregar filas: no puede leer, cambiar ni borrar.
-- Para mirar los datos, npm run partidas (tools/partidas.mts), o el Table Editor del panel.

create table if not exists public.golf_runs (
  id uuid primary key,
  player_id text not null,
  created_at timestamptz not null default now(),
  version text,
  level int,
  result text check (result in ('victory', 'defeat', 'abandoned')),
  wave int,
  seconds int,
  data jsonb not null,
  -- una partida pesa unos pocos KB: esto frena a alguien que quiera llenar la base
  constraint golf_runs_size check (octet_length(data::text) < 100000)
);

alter table public.golf_runs enable row level security;
-- lo único que puede la clave pública: agregar partidas (sin leerlas). Supabase le da todo a las claves
-- públicas en cada tabla nueva; la regla de abajo ya frena el resto, pero mejor que ni lo tengan
revoke all on public.golf_runs from anon, authenticated;
grant usage on schema public to anon;
grant insert on public.golf_runs to anon;

drop policy if exists "golf_runs: el juego agrega partidas" on public.golf_runs;
create policy "golf_runs: el juego agrega partidas" on public.golf_runs
  for insert to anon with check (true);

create index if not exists golf_runs_created on public.golf_runs (created_at desc);

-- Ejemplos para mirar:
--
-- Dónde se pierde, por nivel de dificultad:
--   select level, result, wave, count(*) from golf_runs group by 1, 2, 3 order by 1, 2, 3;
--
-- Puntería y perfectos por partida:
--   select created_at, level, result, wave,
--          round(100.0 * (data->>'hits')::int / nullif((data->>'shots')::int, 0)) as punteria,
--          round(100.0 * (data->>'perfects')::int / nullif((data->>'shots')::int, 0)) as perfectos
--   from golf_runs order by created_at desc;
--
-- Quién saca más vida (al golfista y a la puerta):
--   select k as quien, sum(v::numeric) as vida
--   from golf_runs, jsonb_array_elements(data->'waves') w, jsonb_each_text(w->'by') as e(k, v)
--   group by 1 order by 2 desc;

-- Desde la compu se entra con la contraseña de la base (tools/db.mjs; web/.supabase-db, que no se sube).
-- Si alguna vez hace falta alguien que solo pueda leer esta tabla (ni cambiar ni borrar), este usuario:
-- sacarle los guiones, cambiar CONTRASEÑA por una larga y correrlo una vez. Se entra con
--   postgresql://golf_lector:CONTRASEÑA@db.qdcrurklskmjizmvxwzb.supabase.co:5432/postgres
--
-- create role golf_lector with login password 'CONTRASEÑA';
-- grant usage on schema public to golf_lector;
-- grant select on public.golf_runs to golf_lector;
-- create policy "golf_runs: el lector las lee" on public.golf_runs
--   for select to golf_lector using (true);
