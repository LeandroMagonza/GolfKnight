// Dónde están los jefes: cada carpeta de src/game/bosses con un index.ts que exporta BOSSES. Se cargan
// recién cuando hacen falta (import dinámico), así un jefe a medio hacer no rompe a los demás ni al juego.
import type { BossDef } from './types';

/** El jefe de siempre: el gólem de roca que tira piedras (no es un módulo: va en la oleada como antes). */
export const CLASSIC = 'clasico';
/** En las partidas normales, uno al azar entre los nuevos. */
export const RANDOM = 'azar';

const MODULES = import.meta.glob<{ BOSSES: BossDef[] }>('./*/index.ts');

const familyOf = (id: string) => id.split('.')[0];

/** El jefe `id` (`familia.version`, o solo `familia`: la primera versión). Null si no existe o no carga. */
export async function loadBoss(id: string): Promise<BossDef | null> {
  const loader = MODULES[`./${familyOf(id)}/index.ts`];
  if (!loader) return null;
  try {
    const list = (await loader()).BOSSES ?? [];
    return list.find((b) => b.id === id) ?? (id === familyOf(id) ? list[0] ?? null : null);
  } catch (e) {
    console.error(`[gk] el jefe ${id} no carga:`, e);
    return null;
  }
}

/** Todos los jefes, por familia; la que no carga viene con su error (para verlo en el panel). */
export async function listBosses(withHidden = false): Promise<{ family: string; bosses: BossDef[]; error?: string }[]> {
  const out = await Promise.all(Object.entries(MODULES).map(async ([path, loader]) => {
    const family = path.split('/')[1];
    try {
      const bosses = ((await loader()).BOSSES ?? []).filter((b) => withHidden || !b.hidden);
      return { family, bosses };
    } catch (e) {
      return { family, bosses: [], error: (e as Error).message };
    }
  }));
  return out.filter((f) => f.bosses.length || f.error).sort((a, b) => a.family.localeCompare(b.family));
}
