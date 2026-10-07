import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ABILITIES as ABILITIES_ES } from './core/abilities';
import type { Lang } from './i18n';
import { looksSpanish } from './i18n.scan';

// La otra mitad de la red de src/i18n.test.ts (ver docs/localizacion.md): carga los datos del juego en
// inglés (cartas, habilidades, enemigos, oleadas, dificultad, palos, hechizos de Abe, el tenis) y frena si
// a alguno le queda un texto en español. Como el buscador no ve un nombre suelto sin tildes («Hoyo»),
// además compara cada texto con el mismo en español: si quedó igual, es que no se tradujo.

/** Los textos que se dicen igual en los dos idiomas. */
const SAME = new Set(['Driver', 'Wedge', 'Putter', 'Goblin']);

/** Un azar fijo, para que el sorteo de la partida sea el mismo en los dos idiomas. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Carga los módulos de nuevo, en `lang`. El idioma lo lee src/i18n.ts de <html lang> al cargar, así que
 * se arma una página falsa (y una dirección: el tenis mira si está ?tenis).
 */
async function load(lang: Lang) {
  vi.stubGlobal('document', { documentElement: { lang } });
  vi.stubGlobal('location', { search: '', href: 'http://localhost/' });
  vi.resetModules();
  try {
    return {
      abilities: await import('./core/abilities'),
      cards: await import('./core/cards'),
      clubs: await import('./core/clubs'),
      difficulty: await import('./core/difficulty'),
      terrain: await import('./core/terrain'),
      waves: await import('./core/waves'),
      spells: await import('./coop/spells'),
      tennis: await import('./tennis/mode'),
    };
  } finally {
    vi.unstubAllGlobals();
  }
}
type Game = Awaited<ReturnType<typeof load>>;

/** Todos los textos que ve el jugador en los datos del juego, cada uno con un nombre que dice de dónde salió. */
function texts({ abilities, cards, clubs, difficulty, terrain, waves, spells }: Game): Map<string, string> {
  const out = new Map<string, string>();
  const add = (key: string, text: string | null | undefined) => {
    if (text != null) out.set(key, text);
  };
  const card = (key: string, c: ReturnType<typeof cards.describe>) => {
    add(`${key}.name`, c.name);
    add(`${key}.title`, c.title);
    add(`${key}.hint`, c.hint);
    add(`${key}.tag`, c.tag);
    add(`${key}.up`, c.up);
    add(`${key}.cool`, c.cool?.text);
  };
  for (const id of abilities.ABILITY_LIST) {
    const a = abilities.ABILITIES[id];
    add(`ability.${id}.name`, a.name);
    add(`ability.${id}.title`, a.title);
    add(`ability.${id}.hint`, a.hint);
    for (let level = 1; level <= abilities.MAX_LEVEL; level++) {
      card(`card.${id}.${level}`, cards.describe({ kind: 'ability', id, level }));
      add(`hintAt.${id}.${level}`, abilities.hintAt(a, level));
      add(`upgradeNote.${id}.${level}`, abilities.upgradeNote(id, level));
      add(`cooldownNote.${id}.${level}`, cards.cooldownNote(id, level)?.text);
    }
  }
  for (const id of cards.PERK_LIST) {
    for (let level = 1; level <= Math.max(2, cards.PERKS[id].max); level++) card(`perk.${id}.${level}`, cards.describe({ kind: 'perk', id, level }));
  }
  card('heal.gate', cards.describe({ kind: 'heal', id: 'gate' }));
  card('heal.player', cards.describe({ kind: 'heal', id: 'player' }));
  for (const [element, info] of Object.entries(abilities.ELEMENT_INFO)) {
    add(`element.${element}.name`, info.name);
    add(`element.${element}.adj`, info.adj);
    add(`element.${element}.hint`, info.hint);
  }
  for (const [kind, e] of Object.entries(waves.ENEMIES)) add(`enemy.${kind}`, e.name);
  for (const [mod, title] of Object.entries(waves.MOD_TITLES)) add(`mod.${mod}`, title);
  const all = Object.fromEntries(difficulty.TALENTS.map((t) => [t.id, t.levels.length]));
  const rules = [waves.HARDEST, difficulty.rulesFor({}), difficulty.rulesFor({ special: 1, support: 1 }), difficulty.rulesFor(all)];
  for (let seed = 1; seed <= 40; seed++) {
    rules.forEach((r, i) => waves.buildRun(seeded(seed), r).waves.forEach((w, k) => add(`wave.${seed}.${i}.${k}`, w.title)));
  }
  for (const t of difficulty.TALENTS) {
    add(`talent.${t.id}`, t.name);
    t.levels.forEach((text, i) => add(`talent.${t.id}.${i + 1}`, text()));
  }
  for (const c of Object.values(clubs.CLUBS)) {
    add(`club.${c.id}.name`, c.name);
    add(`club.${c.id}.title`, c.title);
    add(`club.${c.id}.hint`, c.hint);
  }
  clubs.BAND_NAMES.forEach((b, i) => add(`band.${i}`, b));
  terrain.COURSES.forEach((c, i) => add(`course.${i}`, c.name));
  add('bolt.name', spells.BOLT_INFO.name);
  add('bolt.hint', spells.boltHint());
  for (const id of spells.SPELL_ORDER) {
    add(`spell.${id}.name`, spells.SPELL_INFO[id].name);
    for (let level = 1; level <= spells.SPELL_MAX_LEVEL; level++) {
      add(`spell.${id}.${level}.hint`, spells.spellHint(id, level));
      add(`spell.${id}.${level}.size`, spells.spellSize(id, level));
    }
  }
  return out;
}

/** Los textos del modo tenis, que cambia los palos y las cartas (por eso va con módulos propios). */
function tennisTexts({ abilities, clubs, tennis }: Game): Map<string, string> {
  tennis.applyTennis();
  const out = new Map<string, string>();
  for (const id of clubs.CLUB_ORDER.concat('wedge')) {
    const c = clubs.CLUBS[id];
    out.set(`club.${id}.name`, c.name).set(`club.${id}.title`, c.title).set(`club.${id}.hint`, c.hint);
  }
  for (const id of abilities.ABILITY_LIST) {
    const a = abilities.ABILITIES[id];
    out.set(`ability.${id}.name`, a.name).set(`ability.${id}.title`, a.title).set(`ability.${id}.hint`, a.hint);
    for (let level = 1; level <= abilities.MAX_LEVEL; level++) out.set(`hintAt.${id}.${level}`, abilities.hintAt(a, level));
  }
  return out;
}

/** Lo que sigue en español: lo que parece español, o lo que quedó igual que en español. */
function untranslated(en: Map<string, string>, es: Map<string, string>): string[] {
  const left: string[] = [];
  for (const [key, text] of en) {
    if (looksSpanish(text)) left.push(`${key}: ${text}`);
    else if (text === es.get(key) && !SAME.has(text)) left.push(`${key}: ${text} (igual que en español)`);
  }
  return left;
}

describe('el juego en inglés', () => {
  let es: Game;
  let en: Game;
  beforeAll(async () => {
    es = await load('es');
    en = await load('en');
  });

  it('no le queda ningún texto en español', () => {
    const textsEs = texts(es);
    const textsEn = texts(en);
    // los dos idiomas arman lo mismo: si no, la comparación de abajo no vale
    expect([...textsEn.keys()]).toEqual([...textsEs.keys()]);
    expect(textsEn.size).toBeGreaterThan(500);
    expect(untranslated(textsEn, textsEs)).toEqual([]);
  });

  it('el modo tenis tampoco', async () => {
    const tennisEs = tennisTexts(await load('es'));
    const tennisEn = tennisTexts(await load('en'));
    expect([...tennisEn.keys()]).toEqual([...tennisEs.keys()]);
    expect(untranslated(tennisEn, tennisEs)).toEqual([]);
    expect(tennisEn.get('ability.driver-ice.name')).toBe('Ice Drive');
    expect(tennisEn.get('ability.driver-ice.hint')).toBe('An instant drive that chills enemies');
    expect(tennisEn.get('hintAt.driver-ice.3')).toBe('An instant drive that chills and freezes enemies');
    expect(tennisEn.get('ability.wedge-fire.name')).toBe('Fire Lob');
    expect(tennisEs.get('ability.driver-ice.name')).toBe('Plano de hielo');
    expect(tennisEs.get('ability.driver-ice.hint')).toBe('Un plano instantáneo que enfría a los enemigos');
  });

  it('el elemento va adelante, como en inglés', () => {
    const { abilities } = en;
    expect(abilities.ABILITIES['driver-ice'].name).toBe('Ice Driver');
    expect(abilities.ABILITIES['wedge-silence'].name).toBe('Silencing Wedge');
    expect(abilities.ABILITIES['iron-lightning'].name).toBe('Lightning Iron');
    expect(abilities.ABILITIES['glove-fire'].name).toBe('Fire Glove');
    expect(abilities.ABILITIES['glove-fire'].title).toBe('fire shots');
    expect(abilities.hintAt(abilities.ABILITIES['driver-ice'], 1)).toBe('An instant driver shot that chills enemies');
    expect(abilities.hintAt(abilities.ABILITIES['driver-ice'], 3)).toBe('An instant driver shot that chills and freezes enemies');
    expect(abilities.hintAt(abilities.ABILITIES['glove-ice'], 3)).toBe('For a few seconds, all your club shots also chill and freeze');
    // y en español, como siempre
    expect(ABILITIES_ES['driver-ice'].name).toBe('Driver de hielo');
    expect(ABILITIES_ES['glove-fire'].name).toBe('Guante de fuego');
    expect(es.abilities.ABILITIES['driver-ice'].name).toBe('Driver de hielo');
  });

  it('las frases que se arman con pedazos quedan bien', () => {
    const powered = en.difficulty.TALENTS.find((t) => t.id === 'powered')!;
    expect(powered.levels[0]()).toBe('A third of the enemies have a power, instead of a quarter');
    expect(powered.levels[1]()).toBe('Half of them have a power');
    expect(en.cards.cooldownNote('shove', 2)?.text).toMatch(/^Cooldown: 12 s → [\d.]+ s · slower$/);
    expect(en.cards.describe({ kind: 'ability', id: 'cart', level: 2 }).tag).toBe('ABILITY · LEVEL 2');
    expect(en.abilities.upgradeNote('wedge-lightning', 2)).toBe('Area: 4.2 → 5 m');
    expect(en.abilities.elementNote('lightning', 1, 2)).toBe('All your lightning, jumps per side: 2 → 3');
    expect(en.abilities.elementNote('ice', 2, 3)).toBe('All your ice: 6.5 → 8 s, and freezes');
    expect(en.spells.spellSize('current', 1)).toBe('4 m wide line');
    expect(en.spells.spellSize('hail', 1)).toBe('3 m zone');
    // el élite: «Elite: armored skeleton knight»
    const elites = en.waves.buildRun(seeded(7)).waves.map((w) => w.title).filter((t) => t.startsWith('Elite: '));
    expect(elites).toHaveLength(3);
    for (const t of elites) expect(t).toMatch(/^Elite: [a-z -]+$/);
  });
});
