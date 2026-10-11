// Los números de unas partidas, como quedan en Supabase (tabla golf_runs, ver src/telemetry.ts): cuánto
// tira una persona, cuánto pega, con qué golpe le sale y cuándo suelta (11/10, Leandro: para que el bot
// humano juegue como una persona, y para ver la dificultad con partidas de verdad). Lo usa
// tools/partidas.mts, que las lee; acá solo las cuentas.

/** Una fila de golf_runs, con lo que se usa de `data`. */
export interface RunRow {
  player_id: string;
  version: string;
  level: number;
  result: string;
  wave: number;
  seconds: number;
  created_at?: string;
  data: {
    shots?: number;
    hits?: number;
    host?: string;
    bot?: boolean;
    waves?: { q?: number[]; abilities?: number; hurt?: number; gate?: number }[];
    /** A cuántos ms del tope de la barra se soltó cada tiro (desde el 11/10). */
    releases?: number[];
  };
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Tiros por minuto, qué parte pega, qué parte sale con cada golpe (del 1 al 4), habilidades, y la vida y la
 * puerta que se pierden por minuto; con cuándo suelta (ver `releaseStats`). Sin las de menos de medio
 * minuto (se dejaron apenas empezadas).
 */
export function summarize(rows: RunRow[]): Record<string, number | number[]> {
  const list = rows.filter((r) => r.seconds >= 30);
  const total = (f: (r: RunRow) => number) => list.reduce((n, r) => n + (f(r) || 0), 0);
  const waves = (r: RunRow) => r.data.waves ?? [];
  const minutes = total((r) => r.seconds) / 60;
  const shots = total((r) => r.data.shots ?? 0);
  const q = [0, 1, 2, 3].map((i) => total((r) => waves(r).reduce((n, w) => n + (w.q?.[i] ?? 0), 0)));
  const graded = q.reduce((a, b) => a + b, 0);
  const per = (v: number) => (minutes > 0 ? round(v / minutes) : 0);
  return {
    partidas: list.length,
    ganadas: list.filter((r) => r.result === 'victory').length,
    minutos: round(minutes, 1),
    oleada: list.length ? round(total((r) => r.wave) / list.length, 1) : 0,
    tirosPorMinuto: per(shots),
    pegan: shots ? round(total((r) => r.data.hits ?? 0) / shots) : 0,
    golpes: q.map((n) => (graded ? round(n / graded) : 0)),
    habilidadesPorMinuto: per(total((r) => waves(r).reduce((n, w) => n + (w.abilities ?? 0), 0))),
    vidaPorMinuto: per(total((r) => waves(r).reduce((n, w) => n + Math.min(w.hurt ?? 0, 99), 0))),
    puertaPorMinuto: per(total((r) => waves(r).reduce((n, w) => n + Math.min(w.gate ?? 0, 99), 0))),
    ...releaseStats(list.flatMap((r) => r.data.releases ?? [])),
  };
}

/**
 * Cuándo se suelta, sobre el tope de la barra (ms; ver SwingMeter.offPeak): qué parte sale antes del fuerte,
 * en el fuerte y pasado (sin las mejoras de la barra, el fuerte son ±30 ms alrededor del tope), el promedio y
 * el desvío de los que quedan cerca del tope (±250 ms: los que buscaban el 3), y cuántos caen en cada tramo
 * de 25 ms. Para que el bot humano le erre como una persona.
 */
export function releaseStats(offs: number[], half = 30): Record<string, number | number[]> {
  if (!offs.length) return { soltadas: 0 };
  const share = (f: (o: number) => boolean) => round(offs.filter(f).length / offs.length);
  const near = offs.filter((o) => Math.abs(o) <= 250);
  const mean = near.length ? near.reduce((a, b) => a + b, 0) / near.length : 0;
  const sd = near.length > 1 ? Math.sqrt(near.reduce((a, b) => a + (b - mean) ** 2, 0) / (near.length - 1)) : 0;
  // de −250 a +250 en tramos de 25 ms (el primero junta todo lo de antes, y el último todo lo de después)
  const bins = Array.from({ length: 22 }, () => 0);
  for (const o of offs) bins[Math.max(0, Math.min(21, Math.floor((o + 250) / 25) + 1))]++;
  return {
    soltadas: offs.length,
    antesDelFuerte: share((o) => o < -half),
    enElFuerte: share((o) => Math.abs(o) <= half),
    pasado: share((o) => o > half),
    cercaPromedioMs: Math.round(mean),
    cercaDesvioMs: Math.round(sd),
    cadaVeinticincoMs: bins,
  };
}
