-- Golf Knight: las partidas que manda el juego al terminar (src/telemetry.ts).
-- Va en el proyecto de Supabase del ManaMod (kdwiuiciobekuedpmfpj). Se corre una vez, en el SQL Editor.
--
-- La clave pública que va en el juego solo puede agregar filas: no puede leer, cambiar ni borrar.
-- Para mirar los datos, el Table Editor o el SQL Editor del panel.

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
