// Dónde están las canciones: cada archivo de songs/ exporta SONGS. Se cargan recién cuando hacen falta
// (import dinámico), así una canción a medio hacer no rompe al resto ni al juego.
import type { SongDef } from './types';

/** La de siempre: el arpegio de laúd en re dórico (songs/clasica.ts). */
export const DEFAULT_SONG = 'clasica.dorica';

const MODULES = import.meta.glob<{ SONGS: SongDef[] }>('./songs/*.ts');

const fileOf = (id: string) => id.split('.')[0];

export async function loadSong(id: string): Promise<SongDef | null> {
  const loader = MODULES[`./songs/${fileOf(id)}.ts`];
  if (!loader) return null;
  try {
    return (await loader()).SONGS?.find((s) => s.id === id) ?? null;
  } catch (e) {
    console.error(`[gk] la canción ${id} no carga:`, e); // i18n-ok: consola
    return null;
  }
}

/** Todas las canciones; el archivo que no carga viene con su error (para verlo en el panel). */
export async function listSongs(): Promise<{ file: string; songs: SongDef[]; error?: string }[]> {
  const out = await Promise.all(Object.entries(MODULES).map(async ([path, loader]) => {
    const file = path.split('/').pop()!.replace(/\.ts$/, '');
    try {
      return { file, songs: (await loader()).SONGS ?? [] };
    } catch (e) {
      return { file, songs: [], error: (e as Error).message };
    }
  }));
  return out.sort((a, b) => a.file.localeCompare(b.file));
}
