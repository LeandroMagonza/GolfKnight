// Oleadas: qué enemigos salen y cada cuánto. WaveDirector decide cuándo aparece el próximo.
// Los enemigos salen sueltos, sin formación: las filas se arman y se desarman solas porque cada uno
// camina a su ritmo, y encontrarlas es el juego.
//
// **Cuerpo y poder van por separado.** El tipo (el cuerpo) dice cuánta vida tiene, qué tan rápido va y
// cómo se ve: una escalera de vida de 1 a 10 que se lee por el tamaño. El poder (escudo, blindaje,
// explota, fantasma, aura, tierra, bandera, hechizo...) se le reparte **al azar** en cada oleada, así
// que no siempre es el mismo bicho el que viene con el mismo poder.
//
// **La partida se arma al azar** (`buildRun`): tres escenarios de tres oleadas, cada uno con su poder y un
// élite al final, y después la oleada del jefe. Un tercio de los enemigos sale con poder: la mitad con
// el del escenario y el resto con los de escenarios anteriores, más algunos de apoyo.

export type EnemyKind = 'goblin' | 'goblina' | 'orc' | 'skeleton' | 'warchief' | 'shaman' | 'knight' | 'stoneling' | 'wraith' | 'golem';

/**
 * melee: camina y pega. kamikaze: corre y explota. shaman: se planta cerca de la puerta y sostiene su
 * aura con las manos en alto. grabber: persigue al golfista, lo atrapa y lo lastima hasta que se
 * escapa. golem: se planta a distancia y le tira piedras a la puerta. banner: se queda al fondo y,
 * mientras vive, todos tienen 1 de vida más. geomancer: se planta y levanta una loma adelante suyo.
 * ranged: se planta y le tira hechizos al golfista, que tiene que moverse de puesto para esquivarlos.
 *
 * Salvo el alma en pena, el gólem y los chamanes, el comportamiento **sale del poder**, no del cuerpo:
 * cualquiera puede explotar, cavar, llevar la bandera o tirar hechizos (ver `behaviorOf`).
 */
export type Behavior = 'melee' | 'kamikaze' | 'shaman' | 'grabber' | 'golem' | 'banner' | 'geomancer' | 'ranged';

/** Aura: «ward» vuelve inmunes a los de alrededor (el invencible); «heal» los cura de a poco (el que cura). */
export type Aura = 'ward' | 'heal';

/**
 * **Poderes**: lo que se le suma a un cuerpo. Se ven en íconos arriba de la vida. En una oleada se
 * reparten al azar (ver `spawnOrder`), o van fijos por grupo (`WaveGroup.mods`).
 */
export interface EnemyMods {
  /** Armadura: se le resta a cada golpe (1 a 3). */
  armor?: number;
  /** Escudo de frente: le resta esto a lo que le llega de frente (1 a 5, o SHIELD_WALL). */
  shield?: number;
  /** Escudo divino que se recarga a los tantos segundos. */
  divine?: number;
  aura?: Aura;
  /** Etéreo: ningún golpe le saca más de 1. Se ve medio transparente. */
  ethereal?: boolean;
  /** Explota: corre a la puerta y revienta al llegar o al tocarte, y se lleva a los de al lado. */
  explode?: boolean;
  /** Cava: se planta y levanta una loma adelante suyo (ver GEOMANCER). */
  dig?: boolean;
  /** Lleva la bandera: se queda al fondo y todos tienen 1 de vida más mientras vive. */
  banner?: boolean;
  /** Tira hechizos al golfista desde lejos (ver RANGED). */
  ranged?: boolean;
  /** Esquiva: si le apuntás cuando la carga llega a 2, salta al costado (ver DODGE). */
  dodge?: boolean;
  /** Vida de más o de menos sobre la del cuerpo. */
  hp?: number;
  /** Tamaño, sobre el del cuerpo (el élite viene más grande). Agranda también su radio para las pelotas. */
  size?: number;
}

export interface EnemyStats {
  kind: EnemyKind;
  name: string;
  /** Malla del personaje dentro de dungeon.glb. */
  mesh: string;
  behavior: Behavior;
  /** Altura a la que se escala el modelo, en metros. */
  height: number;
  radius: number;
  hp: number;
  /** Velocidad media. Cada enemigo sale con una variación propia (ver SPEED_SPREAD). */
  speed: number;
  /** Corre en vez de caminar. */
  runs: boolean;
  /**
   * Daño al golfista (al atropellarlo, o al pegarle). En los cuerpos es el mismo que a la puerta, y
   * crece con la vida: los goblins 1, del orco al chamán 2, el caballero y el gólem chico 3. Con 3 de
   * vida, chocarse con uno de los grandes (o con un élite, ver `ELITE.damage`) te mata.
   */
  damage: number;
  /** Daño a la puerta. Los que pelean cuerpo a cuerpo lo hacen una sola vez: llegan, golpean y se pierden adentro. */
  gateDamage: number;
  /** No se aturde ni sale volando con los golpes. */
  heavy: boolean;
  /**
   * Escudo: **blindaje de frente**. Lo que le llega de frente (la pelota que no cae a plomo, o un área que
   * estalla adelante suyo) rebota o se frena igual, pero le resta este número al daño y el resto entra.
   * 0 = sin escudo. SHIELD_WALL = el muro: no pasa nada.
   */
  shield: number;
  /** Jefe: el hielo lo ralentiza pero nunca lo congela, y no recibe poderes. */
  boss: boolean;
  /**
   * Segundos entre ataques, para los que atacan a distancia (hoy, el gólem). Los cuerpo a cuerpo no lo
   * usan: su ritmo lo marca la animación del golpe.
   */
  attackEvery?: number;
  /** Armadura: se le resta a cada golpe. */
  armor?: number;
  /** Escudo divino: el primer golpe no le entra, y se le recarga a los tantos segundos. */
  divine?: number;
  /** Aura que sostiene mientras vive y no está silenciado. */
  aura?: Aura;
  /** Etéreo: ningún golpe le saca más de 1, sin importar la fuerza. */
  ethereal?: boolean;
  /** Color con el que se tiñe el modelo (0 = sin teñir). */
  tint: number;
  score: number;
}

const base = { behavior: 'melee' as Behavior, runs: false, heavy: false, shield: 0, boss: false, tint: 0 };

/**
 * El escudo muro: un escudo de 10 no deja pasar nada de frente, por fuerte que sea (el mejor golpe es 4,
 * así que desde el escudo 4 ya casi nada entra de frente; la calavera lo deja claro a la vista). Obliga a resolverlo de otra forma: por detrás, de costado o con la granada. Es la calavera, y
 * late en violeta como los inmunes del chamán.
 */
export const SHIELD_WALL = 10;

/** Segundos entre piedras del gólem (valor de partida; se ajusta en el panel de balance). */
export const GOLEM_THROW_EVERY = 4;

/**
 * Los cuerpos, por vida: una escalera de 1 a 10 que se lee por el tamaño. El chamán es un cuerpo más: el
 * aura es un poder, y le puede tocar a cualquiera.
 */
export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  goblin: { ...base, kind: 'goblin', name: 'Goblin', mesh: 'Character_Goblin_Male', height: 1.25, radius: 0.45, hp: 1, speed: 3.6, runs: true, damage: 1, gateDamage: 1, score: 10 },
  goblina: { ...base, kind: 'goblina', name: 'Goblina', mesh: 'Character_Goblin_Female', height: 1.25, radius: 0.45, hp: 2, speed: 3.3, runs: true, damage: 1, gateDamage: 1, score: 15 },
  orc: { ...base, kind: 'orc', name: 'Orco', mesh: 'Character_Goblin_Warrior_Male', height: 1.55, radius: 0.6, hp: 3, speed: 2.6, damage: 2, gateDamage: 2, score: 20 },
  skeleton: { ...base, kind: 'skeleton', name: 'Esqueleto', mesh: 'Character_Skeleton_Soldier_01', height: 1.8, radius: 0.55, hp: 4, speed: 2.1, damage: 2, gateDamage: 2, score: 25 },
  warchief: { ...base, kind: 'warchief', name: 'Jefe goblin', mesh: 'Character_Goblin_WarChief', height: 1.65, radius: 0.62, hp: 5, speed: 2.3, damage: 2, gateDamage: 2, score: 30 },
  shaman: { ...base, kind: 'shaman', name: 'Chamán goblin', mesh: 'Character_Goblin_Shaman', height: 1.45, radius: 0.5, hp: 6, speed: 2.2, damage: 2, gateDamage: 2, score: 40 },
  knight: { ...base, kind: 'knight', name: 'Caballero esqueleto', mesh: 'Character_Skeleton_Knight', height: 2.2, radius: 0.85, hp: 8, speed: 1.5, damage: 3, gateDamage: 3, heavy: true, score: 50 },
  stoneling: { ...base, kind: 'stoneling', name: 'Gólem chico', mesh: 'Character_Rock_Golem', height: 2.1, radius: 0.95, hp: 10, speed: 1.4, damage: 3, gateDamage: 3, heavy: true, score: 70 },
  wraith: { ...base, kind: 'wraith', name: 'Alma en pena', mesh: 'Character_Tormented_Soul', behavior: 'grabber', height: 1.9, radius: 0.5, hp: 2, speed: 5.8, runs: true, damage: 1, gateDamage: 0, score: 40 },
  golem: { ...base, kind: 'golem', name: 'Gólem de roca', mesh: 'Character_Rock_Golem', behavior: 'golem', height: 4.0, radius: 1.7, hp: 80, speed: 1.3, damage: 2, gateDamage: 1, heavy: true, boss: true, attackEvery: GOLEM_THROW_EVERY, score: 500 },
};

/** Los poderes que cambian cómo se mueve: solo los recibe un cuerpo que camina y pega. */
const BEHAVIOR_POWERS = ['explode', 'dig', 'banner', 'ranged', 'aura'] as const;

/**
 * Cómo se comporta un cuerpo con sus poderes. El alma en pena y el gólem tienen el suyo; el resto camina y
 * pega, salvo que un poder diga otra cosa.
 */
export function behaviorOf(stats: EnemyStats, mods: EnemyMods = {}): Behavior {
  if (stats.behavior !== 'melee') return stats.behavior;
  if (mods.explode) return 'kamikaze';
  if (mods.dig) return 'geomancer';
  if (mods.banner) return 'banner';
  if (mods.ranged) return 'ranged';
  if (mods.aura) return 'shaman';
  return 'melee';
}

/**
 * Topes para que ninguna combinación quede imposible con el mejor golpe en 4. Cada enemigo trae un solo
 * poder, así que el blindaje y el etéreo nunca van juntos en el mismo; lo que queda es cuidar los
 * cuerpos grandes: el etéreo (que se lleva de a 1 por golpe) no va en los de más de 8 de vida, y el
 * blindaje 3 (que al mejor golpe le deja pasar 1) solo en los de hasta 4. Y el etéreo tampoco va en los
 * de 1 de vida: al goblin no le cambia nada, así que el fantasma pasa al próximo que pueda tenerlo.
 */
export const LIMITS = { etherealMinHp: 2, etherealMaxHp: 8, armor3MaxHp: 4 };

/**
 * ¿Este cuerpo puede recibir este poder? Los jefes, ninguno; los que ya se comportan distinto, solo los
 * de defensa; y con los topes de LIMITS.
 */
export function canTake(kind: EnemyKind, mods: EnemyMods): boolean {
  const s = ENEMIES[kind];
  if (s.boss) return false;
  if (mods.ethereal && (s.hp > LIMITS.etherealMaxHp || s.hp < LIMITS.etherealMinHp)) return false;
  if ((mods.armor ?? 0) >= 3 && s.hp > LIMITS.armor3MaxHp) return false;
  const changesBehavior = BEHAVIOR_POWERS.some((k) => mods[k]);
  return !changesBehavior || s.behavior === 'melee';
}

/** Cada enemigo camina entre (1 - x) y (1 + x) veces la velocidad de su tipo. */
export const SPEED_SPREAD = 0.22;
/** A qué distancia de la puerta se plantan el chamán y el gólem, en metros. */
export const SHAMAN_HOLD_Z = 10;
export const GOLEM_HOLD_Z = 22;
/** Radio del aura del chamán: los enemigos que están adentro son inmunes mientras él conjure. */
export const SHAMAN_WARD_RADIUS = 8;

/**
 * Aura de curación: cada «every» segundos, los que están a «radius» metros del curandero recuperan
 * «amount» (sin pasar de su vida). Con el ritmo de tiro de hoy (un tiro cada 1.5 s, más o menos) cada 3 s
 * es un punto cada dos tiros: al que se mata en uno o dos tiros seguidos no llega a curarlo, pero al
 * caballero o a un grupo que se deja a medias sí. Cada 2 s ya empata casi con el daño a un solo blanco.
 */
export const HEAL_AURA = { radius: 6, every: 3, amount: 1 };

/** La abanderada se planta a esta z: unos 42 m de la línea de los puestos, en la banda larga. */
export const BANNER_HOLD_Z = 51;

/**
 * Geomante: se planta al llegar a «holdZ» y **canaliza** «channel» segundos, con los brazos arriba: la
 * loma crece de a poco hasta «height» metros, a «ahead» metros adelante suyo, así él queda detrás, al
 * pie, tapado. Si se lo mata mientras canaliza, la loma baja. Si termina, **la loma queda para el resto
 * de la partida** y él sigue a la puerta: tardar en matarlo complica el campo hasta el final.
 */
export const GEOMANCER = { holdZ: 38, ahead: 5, height: 1.8, rx: 3.4, rz: 2.8, channel: 8 };

/**
 * Hechicero: se planta a «holdZ» (unos 25 m de los puestos) y cada «every» segundos le tira un hechizo
 * al puesto donde está el golfista. Tarda «flight» segundos en llegar y el piso lo marca en rojo desde
 * que sale: da tiempo a correrse un puesto. Si al caer el golfista está a menos de «radius» metros, le
 * saca «damage». Silenciado no tira.
 */
export const RANGED = { holdZ: 34, every: 4.5, flight: 1.6, radius: 1.4, damage: 1 };

/**
 * Esquiva: mientras cargás, en el momento en que la barra pasa del golpe débil al medio (la carga 2), el
 * que tenés «más o menos» apuntado (a menos de `aimWidth` metros de la línea del tiro, más su radio)
 * salta `distance` metros al costado, y no vuelve a saltar hasta `cooldown` segundos después. Se le
 * gana esperando que se le pase, o cargando mirando para otro lado y apuntándole recién al final.
 * Silenciado no esquiva.
 */
export const DODGE = { cooldown: 5, distance: 3.2, aimWidth: 2.2, hop: 0.6, hopTime: 0.35 };

/**
 * Alma en pena: va solo por el golfista. Cuando lo agarra le saca `damage` de una y lo deja congelado
 * `hold` segundos (no puede moverse, ni tirar, ni usar habilidades). Después se esfuma: agarra una vez y
 * se va. No hay forma de soltarse antes: la defensa es pegarle antes de que llegue.
 */
export const GRAB = { damage: 1, hold: 1.5 };

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  /** Poderes fijos para todos los de este grupo (el élite). */
  mods?: EnemyMods;
  /**
   * En qué punto de la oleada salen, de 0 a 1. Sin esto, los grupos grandes se reparten parejo y los de
   * uno o dos salen hacia la mitad. El élite de cada escenario llega al final de su oleada, con unos
   * pocos chicos detrás (`ELITE.at`): si llegaba último, se lo veía caminando solo.
   */
  at?: number;
  /** Salen sin poder: el cuerpo fuerte del escenario, para que el élite sea el único de ese cuerpo con poder. */
  plain?: boolean;
}

/** Los poderes que se reparten al azar. */
export type PowerKey = 'shield' | 'armor' | 'explode' | 'ranged' | 'dig' | 'heal' | 'ethereal' | 'ward' | 'dodge' | 'divine' | 'banner';

/**
 * Un poder, según el escenario (`tier`: 0, 1 y 2, y 3 en la oleada del jefe): el escudo y el blindaje
 * suben de nivel con la partida, de 1 en el primer escenario hasta 3 en el tercero. No pasan de 3: con
 * el mejor golpe en 4, un escudo o un blindaje de 4 ya no deja pasar nada.
 */
export const POWERS: Record<PowerKey, (tier: number, rand: () => number) => EnemyMods> = {
  shield: (tier, rand) => ({ shield: 1 + Math.floor(rand() * Math.min(3, tier + 1)) }),
  armor: (tier, rand) => ({ armor: 1 + Math.floor(rand() * Math.min(3, tier + 1)) }),
  explode: () => ({ explode: true }),
  ranged: () => ({ ranged: true }),
  // cava: por ahora afuera de las partidas (ver docs/pendientes.md). El poder sigue andando
  dig: () => ({ dig: true }),
  heal: () => ({ aura: 'heal' }),
  ethereal: () => ({ ethereal: true }),
  ward: () => ({ aura: 'ward' }),
  dodge: () => ({ dodge: true }),
  divine: () => ({ divine: 5 }),
  banner: () => ({ banner: true }),
};

/**
 * **Los poderes de escenario**: cada partida sortea tres de estos, uno por escenario. Son los que se
 * defienden de los golpes; los que cambian cómo se mueve el que los lleva van aparte (SUPPORT_POWERS).
 */
export const SCENARIO_POWERS = ['shield', 'armor', 'ethereal', 'divine', 'dodge'] as const;
export type ScenarioPower = (typeof SCENARIO_POWERS)[number];

/**
 * **Los de apoyo**: tirar hechizos, curar, volver inmunes, llevar la bandera. La partida sortea dos, uno
 * para el segundo escenario y otro para el tercero, y salen de a pocos. Explotar va con la estampida;
 * cavar, por ahora, no sale.
 */
export const SUPPORT_POWERS = ['ranged', 'heal', 'ward', 'banner'] as const;

/** El élite de cada escenario lleva el poder del escenario en su versión más dura. */
export const BOSS_POWERS: Record<ScenarioPower, (tier: number) => EnemyMods> = {
  // la calavera: de frente no le entra nada
  shield: () => ({ shield: SHIELD_WALL }),
  // 1 en el primer escenario y 2 después: con 3, el gólem chico pedía diez golpes perfectos
  armor: (tier) => ({ armor: Math.min(2, tier + 1) }),
  ethereal: () => ({ ethereal: true }),
  // el divino se le recarga más rápido
  divine: () => ({ divine: 3 }),
  dodge: () => ({ dodge: true }),
};

/** Qué parte de los enemigos de una oleada sale con poder, y de esos, cuántos con el del escenario. */
export const POWERED_SHARE = 1 / 3;
export const FOCUS_SHARE = 0.5;

/** Una aparición: el tipo y sus poderes. */
export interface Spawn {
  kind: EnemyKind;
  mods?: EnemyMods;
  /** No recibe poder en el reparto (ver WaveGroup.plain). */
  plain?: boolean;
  /** Segundos después del anterior en que sale (ver `spawnOrder`). Sin esto, el intervalo de la oleada. */
  delay?: number;
}

export interface Wave {
  title: string;
  groups: WaveGroup[];
  /** Segundos entre apariciones. */
  interval: number;
  /** A qué escenario pertenece: 0, 1 o 2, y 3 la del jefe. Decide el nivel de los escudos y el blindaje. */
  scenario: number;
  /** El poder del escenario: la mitad de los que salen con poder lo traen. */
  focus?: PowerKey;
  /** Primera oleada del escenario: el primero que aparece y puede tenerlo presenta el poder. */
  debut?: boolean;
  /** Los poderes de los escenarios anteriores: siguen viniendo, en la otra mitad. */
  old?: PowerKey[];
  /** Poderes de apoyo, y cuántos los traen. Cuentan dentro del tercio con poder. */
  supports?: { key: PowerKey; count: number }[];
  /** La estampida: qué parte de la oleada, entre los más chicos, explota. Va aparte del tercio. */
  explode?: number;
}

/** Una partida: sus diez oleadas, los tres poderes de escenario y los dos de apoyo que salieron. */
export interface Run {
  waves: Wave[];
  powers: ScenarioPower[];
  supports: PowerKey[];
}

const TITLES: Record<ScenarioPower, string> = {
  shield: 'Escudos al frente', armor: 'Acorazados', ethereal: 'Fantasmas', divine: 'Los benditos', dodge: 'Los escurridizos',
};
const BOSS_TITLES: Record<ScenarioPower, string> = {
  shield: 'con la calavera', armor: 'blindado', ethereal: 'fantasma', divine: 'bendito', dodge: 'escurridizo',
};

/** La escalera de vida, de menor a mayor. */
export const LADDER: EnemyKind[] = ['goblin', 'goblina', 'orc', 'skeleton', 'warchief', 'shaman', 'knight', 'stoneling'];
/**
 * El cuerpo fuerte de cada escenario: aparece desde la primera oleada (sin poder hasta la última) y es
 * el élite. Si el poder no le entra, el élite es el de más abajo en la escalera que pueda tenerlo.
 */
export const HEAVY: EnemyKind[] = ['warchief', 'knight', 'stoneling'];

/**
 * El tamaño del élite, según el modelo: llega a `height` metros (más alto que cualquier enemigo común),
 * y crece por lo menos `minScale`. El jefe goblin, que es chico, crece mucho; el caballero, que ya es
 * grande, poco. Pega `damage` a la puerta y al golfista, sea del cuerpo que sea: dejarlo pasar cuesta
 * caro, y chocarse con él te mata. Y trae vida de más sobre la de su cuerpo: `hp[escenario]`.
 */
export const ELITE = { height: 3.0, minScale: 1.25, at: 0.85, damage: 3, hp: [2, 3, 4] };

/** El élite del escenario `scenario` con el poder `power`: cierra la última oleada del escenario. */
export function elite(scenario: number, power: ScenarioPower): WaveGroup {
  const mods: EnemyMods = BOSS_POWERS[power](scenario);
  let kind: EnemyKind = 'skeleton';
  for (let i = LADDER.indexOf(HEAVY[scenario]); i >= 0; i--) {
    if (canTake(LADDER[i], mods)) {
      kind = LADDER[i];
      break;
    }
  }
  const size = Math.max(ELITE.minScale, ELITE.height / ENEMIES[kind].height);
  return { kind, count: 1, at: ELITE.at, mods: { ...mods, size, hp: (mods.hp ?? 0) + ELITE.hp[scenario] } };
}

/** `n` distintos de `list`, al azar. */
function draw<T>(list: readonly T[], n: number, rand: () => number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

/** Los cuerpos de una oleada: goblins, goblinas, orcos y esqueletos, más lo que se agregue. */
function bodies(goblin: number, goblina: number, orc: number, skeleton: number, more: [EnemyKind, number][] = []): WaveGroup[] {
  const groups: WaveGroup[] = [
    { kind: 'goblin', count: goblin }, { kind: 'goblina', count: goblina }, { kind: 'orc', count: orc }, { kind: 'skeleton', count: skeleton },
    ...more.map(([kind, count]) => ({ kind, count })),
  ];
  return groups.filter((g) => g.count > 0);
}

/**
 * Arma una partida: **tres escenarios de tres oleadas y la oleada del jefe**. Cada escenario presenta un
 * poder (sorteado entre SCENARIO_POWERS) y termina con un élite que lo lleva en su versión más dura.
 * El cuerpo fuerte del escenario (HEAVY) viene desde la primera oleada: uno, después tres, y tres en la
 * última, siempre sin poder: de ese cuerpo, el único con poder es el élite, así se distingue.
 * Los escenarios se acumulan: en el segundo siguen viniendo algunos con el poder del primero. La del
 * medio del segundo escenario es la estampida: muchos, chicos, y varios que explotan. Desde el segundo
 * escenario entra además un poder de apoyo por escenario, de a pocos.
 */
export function buildRun(rand: () => number = Math.random): Run {
  const powers = draw(SCENARIO_POWERS, 3, rand);
  const supports = draw(SUPPORT_POWERS, 2, rand);
  const at = (scenario: number, i: number) => ({ scenario, focus: powers[scenario], debut: i === 0, old: powers.slice(0, scenario) });
  const boss = (scenario: number) => elite(scenario, powers[scenario]);
  const bossTitle = (scenario: number) => `Élite: ${ENEMIES[boss(scenario).kind].name.toLowerCase()} ${BOSS_TITLES[powers[scenario]]}`;
  // el cuerpo fuerte del escenario: 1, 3 y 3, siempre sin poder; de ese cuerpo, el único con poder es el élite
  const heavy = (scenario: number, count: number): WaveGroup => ({ kind: HEAVY[scenario], count, plain: true });
  const waves: Wave[] = [
    // primer escenario: los cuerpos de 1 a 4, el jefe goblin desde el arranque, y el poder solo
    { title: TITLES[powers[0]], interval: 2.1, groups: [...bodies(8, 5, 2, 2), heavy(0, 1)], ...at(0, 0) },
    { title: 'Refuerzos', interval: 2.05, groups: [...bodies(6, 5, 3, 2), heavy(0, 3)], ...at(0, 1) },
    { title: bossTitle(0), interval: 2.0, groups: [...bodies(6, 5, 3, 2), heavy(0, 3), boss(0)], ...at(0, 2) },
    // segundo escenario: el caballero desde el arranque, el chamán, y el primer apoyo
    { title: TITLES[powers[1]], interval: 1.85, groups: [...bodies(6, 5, 3, 2, [['warchief', 2]]), heavy(1, 1)], ...at(1, 0), supports: [{ key: supports[0], count: 1 }] },
    { title: 'La estampida', interval: 1.3, groups: [...bodies(13, 8, 2, 0), heavy(1, 3)], ...at(1, 1), explode: 0.3 },
    { title: bossTitle(1), interval: 2.1, groups: [...bodies(5, 4, 2, 2, [['warchief', 2], ['shaman', 2]]), heavy(1, 3), boss(1)], ...at(1, 2), supports: [{ key: supports[0], count: 2 }] },
    // tercer escenario: el gólem chico desde el arranque, el alma en pena, y el segundo apoyo
    { title: TITLES[powers[2]], interval: 1.75, groups: [...bodies(6, 5, 3, 3, [['warchief', 1], ['shaman', 1], ['knight', 1], ['wraith', 1]]), heavy(2, 1)], ...at(2, 0), supports: [{ key: supports[1], count: 1 }] },
    { title: 'Refuerzos', interval: 1.9, groups: [...bodies(5, 4, 3, 2, [['warchief', 1], ['shaman', 1], ['knight', 1], ['wraith', 2]]), heavy(2, 3)], ...at(2, 1), supports: [{ key: supports[1], count: 2 }] },
    { title: bossTitle(2), interval: 1.9, groups: [...bodies(5, 4, 2, 2, [['warchief', 1], ['shaman', 1], ['knight', 1]]), heavy(2, 3), boss(2)], ...at(2, 2), supports: [{ key: supports[1], count: 2 }] },
    // el jefe solo ya tiene 80 de vida: la escolta es más chica, con los tres poderes y los dos apoyos
    {
      title: 'El Gólem de roca', interval: 1.75, scenario: 3, old: [...powers],
      groups: bodies(6, 4, 3, 2, [['golem', 1], ['warchief', 1], ['shaman', 1], ['knight', 1], ['wraith', 1]]),
      supports: supports.map((key) => ({ key, count: 1 })),
    },
  ];
  return { waves, powers, supports };
}

/** Segundos de descanso entre oleadas. */
export const INTERMISSION = 6;

/**
 * Metros que camina un enemigo desde que aparece hasta la zona de los puestos. Con esto se calcula
 * cuánto tarda cada tipo en llegar (ver `spawnOrder`).
 */
export const TRAVEL = 58;

/** Segundos que tarda en llegar a los puestos un enemigo de este tipo. */
export function travelTime(kind: EnemyKind): number {
  return TRAVEL / ENEMIES[kind].speed;
}

/** Lo que tarda en llegar cada uno; el jefe cuenta como si caminara al paso promedio de los demás. */
function lags(kinds: EnemyKind[]): number[] {
  const walkers = kinds.filter((k) => !ENEMIES[k].boss);
  const average = walkers.reduce((n, k) => n + travelTime(k), 0) / Math.max(1, walkers.length);
  return kinds.map((k) => (ENEMIES[k].boss ? average : travelTime(k)));
}

/** Cuándo llega cada uno de `order` a los puestos, en segundos desde que sale el primero. */
export function arrivals(order: Spawn[], interval: number): number[] {
  const lag = lags(order.map((s) => s.kind));
  let t = 0;
  return order.map((s, i) => (t += i ? s.delay ?? interval : 0) + lag[i]);
}

/** Los de `order` en el orden en que llegan a los puestos. */
export function arrivalOrder(order: Spawn[], interval: number): Spawn[] {
  const t = arrivals(order, interval);
  return order.map((s, i) => ({ s, t: t[i] })).sort((a, b) => a.t - b.t).map((x) => x.s);
}

/**
 * Orden de aparición de una oleada: mezcla los grupos de forma pareja **en el orden en que tienen que
 * llegar**, y hace salir antes a los lentos para que lleguen en su lugar. Si salieran en ese orden, el
 * grande que cierra la oleada (el élite, a 1.4 m/s) llegaba medio minuto después que los goblins que
 * salieron con él, caminando solo. El jefe queda donde está. Después reparte los poderes al azar
 * (`rand`), uno por enemigo:
 * - en la estampida, primero explotan algunos de los chicos;
 * - un tercio del resto sale con poder: los de apoyo que traiga la oleada, y de los demás, la mitad con
 *   el del escenario (el primero que aparece lo presenta, si es la primera del escenario) y la otra mitad
 *   con los de escenarios anteriores.
 * Los poderes caen en cualquier cuerpo que pueda tenerlos (ver `canTake` y sus topes).
 */
export function spawnOrder(wave: Wave, rand: () => number = Math.random): Spawn[] {
  const slots: { spawn: Spawn; at: number }[] = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) {
      const at = g.at ?? (g.count <= 2 ? 0.4 + 0.2 * i : (i + 0.5) / g.count);
      slots.push({ spawn: g.mods ? { kind: g.kind, mods: g.mods } : g.plain ? { kind: g.kind, plain: true } : { kind: g.kind }, at });
    }
  }
  slots.sort((a, b) => a.at - b.at);
  // el turno `k` llega en k·intervalo + lo que tarda: sale justo cuando tiene que salir para llegar a
  // tiempo. Cada uno lleva la espera desde el anterior, así llegan con el ritmo de la oleada
  const arriving = slots.map((s) => s.spawn);
  const lag = lags(arriving.map((s) => s.kind));
  const leave = arriving.map((spawn, k) => ({ spawn, t: k * wave.interval - lag[k] })).sort((a, b) => a.t - b.t);
  leave.forEach((l, i) => { if (i) l.spawn.delay = l.t - leave[i - 1].t; });
  const order = leave.map((s) => s.spawn);

  // lo que va "primero" o "al final" se mide por cuándo llegan (`arriving`), no por cuándo salen
  const open = () => arriving.filter((s) => !s.mods && !s.plain && !ENEMIES[s.kind].boss);
  const give = (mods: EnemyMods, first: boolean): boolean => {
    const free = open().filter((s) => canTake(s.kind, mods));
    if (!free.length) return false;
    const pick = first ? free[0] : free[Math.floor(rand() * free.length)];
    pick.mods = mods;
    return true;
  };
  // la estampida: explotan los más chicos
  if (wave.explode) {
    const small = open().filter((s) => ENEMIES[s.kind].hp <= 2);
    for (let n = Math.round(order.length * wave.explode); n > 0 && small.length; n--) {
      small.splice(Math.floor(rand() * small.length), 1)[0].mods = { explode: true };
    }
  }
  const total = Math.round(open().length * POWERED_SHARE);
  const supports = Math.min(total, (wave.supports ?? []).reduce((n, s) => n + s.count, 0));
  const old = wave.old ?? [];
  let focus = wave.focus ? (old.length ? Math.ceil((total - supports) * FOCUS_SHARE) : total - supports) : 0;
  let rest = total - supports - focus;
  // el que presenta el poder del escenario va primero, así ningún otro poder le gana de mano
  if (wave.debut && focus > 0 && give(POWERS[wave.focus!](wave.scenario, rand), true)) focus--;
  let left = supports;
  for (const s of wave.supports ?? []) for (let i = 0; i < s.count && left > 0; i++, left--) give(POWERS[s.key](wave.scenario, rand), false);
  for (; focus > 0; focus--) give(POWERS[wave.focus!](wave.scenario, rand), false);
  for (; rest > 0 && old.length; rest--) give(POWERS[old[Math.floor(rand() * old.length)]](wave.scenario, rand), false);
  // los escudos sorteados van de menor a mayor a lo largo de la oleada: el más duro, al final
  const shielded = arriving.filter((s) => s.mods?.shield && s.mods.shield < SHIELD_WALL && !wave.groups.some((g) => g.mods === s.mods));
  const levels = shielded.map((s) => s.mods!.shield!).sort((a, b) => a - b);
  shielded.forEach((s, i) => { s.mods = { ...s.mods, shield: levels[i] }; });
  return order;
}

export type DirectorEvent =
  | { type: 'wave'; index: number; wave: Wave }
  | { type: 'spawn'; kind: EnemyKind; mods?: EnemyMods }
  | { type: 'cleared'; index: number }
  | { type: 'victory' };

/**
 * Máquina de estados de las oleadas. update() recibe cuántos enemigos quedan vivos y devuelve lo
 * que pasó en este paso.
 */
export class WaveDirector {
  index = -1;
  private queue: Spawn[] = [];
  private timer = 2.5;
  private phase: 'rest' | 'spawning' | 'fighting' | 'done' = 'rest';
  /**
   * Modo infinito (para probar): la oleada no se termina nunca. Cuando se vacía la cola, se vuelve a
   * llenar con la misma composición, así que siguen saliendo los mismos bichos para siempre.
   */
  endless = false;

  constructor(private readonly waves: Wave[] = buildRun().waves, private readonly rest = INTERMISSION) {}

  /** Las oleadas de esta partida. */
  get list(): readonly Wave[] {
    return this.waves;
  }

  get waveCount(): number {
    return this.waves.length;
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  get pending(): number {
    return this.queue.length;
  }

  /** Segundos que faltan para la próxima oleada, o 0 si hay una en curso. */
  get restLeft(): number {
    return this.phase === 'rest' ? Math.max(0, this.timer) : 0;
  }

  /**
   * Deja correr el descanso entre oleadas sin que pase nada más: se usa mientras el juego está frenado
   * por un cartel. El reloj baja hasta casi cero pero la oleada no arranca hasta el próximo update().
   */
  wait(dt: number): void {
    if (this.phase === 'rest') this.timer = Math.max(0.05, this.timer - dt);
  }

  /**
   * Salta directo a una oleada (para probar). Deja la cola vacía y el descanso casi terminado, así que
   * la oleada pedida arranca en el próximo update.
   */
  goTo(index: number): void {
    this.index = Math.max(0, Math.min(this.waves.length - 1, index)) - 1;
    this.queue = [];
    this.phase = 'rest';
    this.timer = 0.05;
  }

  get nextTitle(): string {
    return this.waves[this.index + 1]?.title ?? '';
  }

  update(dt: number, alive: number): DirectorEvent[] {
    const events: DirectorEvent[] = [];
    if (this.phase === 'done') return events;
    this.timer -= dt;
    if (this.phase === 'rest') {
      if (this.timer > 0) return events;
      this.index++;
      const wave = this.waves[this.index];
      this.queue = spawnOrder(wave);
      this.phase = 'spawning';
      this.timer = 0;
      events.push({ type: 'wave', index: this.index, wave });
    }
    if (this.phase === 'spawning') {
      while (this.timer <= 0 && this.queue.length) {
        const next = this.queue.shift()!;
        events.push({ type: 'spawn', kind: next.kind, ...(next.mods ? { mods: next.mods } : {}) });
        this.timer += this.queue[0]?.delay ?? this.waves[this.index].interval;
      }
      if (!this.queue.length) {
        if (this.endless) this.queue = spawnOrder(this.waves[this.index]);
        else this.phase = 'fighting';
      }
      return events;
    }
    if (this.phase === 'fighting' && alive === 0) {
      events.push({ type: 'cleared', index: this.index });
      if (this.index + 1 >= this.waves.length) {
        this.phase = 'done';
        events.push({ type: 'victory' });
      } else {
        this.phase = 'rest';
        this.timer = this.rest;
      }
    }
    return events;
  }
}
