// Oleadas: qué enemigos salen y cada cuánto. WaveDirector decide cuándo aparece el próximo.
// Los enemigos salen sueltos, sin formación: las filas se arman y se desarman solas porque cada uno
// camina a su ritmo, y encontrarlas es el juego.
//
// **Cuerpo y poder van por separado.** El tipo (el cuerpo) dice cuánta vida tiene, qué tan rápido va y
// cómo se ve: una escalera de vida de 1 a 10 que se lee por el tamaño. El poder (escudo, blindaje,
// explota, fantasma, aura, tierra, bandera, hechizo...) se le reparte **al azar** en cada oleada, así
// que no siempre es el mismo bicho el que viene con el mismo poder.
//
// Cada oleada suma un cuerpo y un poder. Un tercio de los enemigos sale con poder: la mitad con el nuevo
// de la oleada (el primero que aparece lo presenta) y el resto con alguno de los que ya se vieron.

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
  orc: { ...base, kind: 'orc', name: 'Orco', mesh: 'Character_Goblin_Warrior_Male', height: 1.55, radius: 0.6, hp: 3, speed: 2.6, damage: 1, gateDamage: 1, score: 20 },
  skeleton: { ...base, kind: 'skeleton', name: 'Esqueleto', mesh: 'Character_Skeleton_Soldier_01', height: 1.8, radius: 0.55, hp: 4, speed: 2.1, damage: 1, gateDamage: 1, score: 25 },
  warchief: { ...base, kind: 'warchief', name: 'Jefe goblin', mesh: 'Character_Goblin_WarChief', height: 1.65, radius: 0.62, hp: 5, speed: 2.3, damage: 1, gateDamage: 1, score: 30 },
  shaman: { ...base, kind: 'shaman', name: 'Chamán goblin', mesh: 'Character_Goblin_Shaman', height: 1.45, radius: 0.5, hp: 6, speed: 2.2, damage: 1, gateDamage: 1, score: 40 },
  knight: { ...base, kind: 'knight', name: 'Caballero esqueleto', mesh: 'Character_Skeleton_Knight', height: 2.2, radius: 0.85, hp: 8, speed: 1.5, damage: 1, gateDamage: 2, heavy: true, score: 50 },
  stoneling: { ...base, kind: 'stoneling', name: 'Gólem chico', mesh: 'Character_Rock_Golem', height: 2.1, radius: 0.95, hp: 10, speed: 1.4, damage: 1, gateDamage: 2, heavy: true, score: 70 },
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

/** ¿Este cuerpo puede recibir este poder? Los jefes, ninguno; los que ya se comportan distinto, solo los de defensa. */
export function canTake(kind: EnemyKind, mods: EnemyMods): boolean {
  const s = ENEMIES[kind];
  if (s.boss) return false;
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

/** Alma en pena: cada cuánto lastima mientras tiene agarrado al golfista, y cuánto aguanta agarrada. */
export const GRAB_TICK = 1.6;
export const GRAB_MAX = 5;
/**
 * Los primeros GRAB_MIN segundos no hay forma de soltarse: ni sacudiéndose ni con el palazo. Después,
 * GRAB_STRUGGLE toques de A o D (los de antes no cuentan), o el palazo. Al soltarse, de la forma que
 * sea, el alma en pena se esfuma: agarra una vez y se va.
 */
export const GRAB_MIN = 2;
export const GRAB_STRUGGLE = 6;

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  /** Poderes fijos para todos los de este grupo. */
  mods?: EnemyMods;
  /**
   * En qué punto de la oleada salen, de 0 a 1. Sin esto, los grupos grandes se reparten parejo y los de
   * uno o dos salen hacia la mitad. El caballero y el gólem chico, cuando se presentan, cierran la oleada.
   */
  at?: number;
}

/** Los poderes que se reparten al azar. */
export type PowerKey = 'shield' | 'armor' | 'explode' | 'ranged' | 'dig' | 'heal' | 'ethereal' | 'ward' | 'dodge' | 'divine' | 'banner';

/**
 * Un poder, según cuántas oleadas pasaron desde que se presentó (`age`, 0 en la suya): el escudo y el
 * blindaje suben de nivel con la partida. El blindaje sale en 1 en su oleada; el escudo, de 1 a 3.
 */
export const POWERS: Record<PowerKey, (age: number, rand: () => number) => EnemyMods> = {
  // de 1 a 3 al presentarse, uno más cada oleada y media, hasta 5; desde la sexta después, a veces la calavera
  shield: (age, rand) => {
    if (age >= 6 && rand() < 0.15) return { shield: SHIELD_WALL };
    return { shield: 1 + Math.floor(rand() * Math.min(5, 3 + Math.floor(age / 1.5))) };
  },
  // hasta 1 al presentarse, hasta 2 a las tres oleadas y hasta 3 a las seis
  armor: (age, rand) => ({ armor: 1 + Math.floor(rand() * Math.min(3, 1 + Math.floor(age / 3))) }),
  explode: () => ({ explode: true }),
  ranged: () => ({ ranged: true }),
  dig: () => ({ dig: true }),
  heal: () => ({ aura: 'heal' }),
  ethereal: () => ({ ethereal: true }),
  ward: () => ({ aura: 'ward' }),
  dodge: () => ({ dodge: true }),
  divine: () => ({ divine: 5 }),
  banner: () => ({ banner: true }),
};

/** Qué parte de los enemigos de una oleada sale con poder, y de esos, cuántos con el nuevo. */
export const POWERED_SHARE = 1 / 3;
export const FRESH_SHARE = 0.5;

/** Una aparición: el tipo y sus poderes. */
export interface Spawn {
  kind: EnemyKind;
  mods?: EnemyMods;
}

export interface Wave {
  title: string;
  groups: WaveGroup[];
  /** El poder que presenta esta oleada. De ahí en adelante entra en el sorteo de todas. */
  power?: PowerKey;
  /**
   * Un poder de más que se presenta de pasada: lo trae **uno solo** de la oleada, además del tercio con
   * poder, y desde la siguiente entra en el sorteo como los demás.
   */
  extra?: PowerKey;
  /** Segundos entre apariciones. */
  interval: number;
}

/**
 * Las oleadas. La primera trae los cuerpos de 1 a 4 de vida, sin poderes; desde ahí, cada una presenta
 * un poder y, a partir de la quinta, un cuerpo más de la escalera. La dificultad sube pareja: ver
 * «Balance de las oleadas» en docs/diseno-combate.md, y `tools/oleadas.mts` para medirla.
 */
export const WAVES: Wave[] = [
  { title: 'Los cuatro palos', interval: 2.1, groups: [{ kind: 'goblin', count: 8 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 2 }, { kind: 'skeleton', count: 2 }] },
  // los escudos salen de menor a mayor, y cierra un esqueleto con la calavera: de frente no le entra nada
  { title: 'Escudos al frente', interval: 2.4, power: 'shield', groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 2 }, { kind: 'skeleton', count: 2 }, { kind: 'skeleton', count: 1, at: 1, mods: { shield: SHIELD_WALL } }] },
  { title: 'Acorazados', interval: 1.9, power: 'armor', groups: [{ kind: 'goblin', count: 7 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }] },
  { title: 'La estampida', interval: 1.7, power: 'explode', extra: 'divine', groups: [{ kind: 'goblin', count: 8 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }] },
  { title: 'Hechiceros', interval: 2.05, power: 'ranged', groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }, { kind: 'warchief', count: 2 }] },
  { title: 'La tierra se levanta', interval: 2.2, power: 'dig', extra: 'banner', groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }, { kind: 'warchief', count: 2 }, { kind: 'shaman', count: 2 }] },
  { title: 'Los que curan', interval: 1.85, power: 'heal', groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }, { kind: 'warchief', count: 2 }, { kind: 'shaman', count: 1 }, { kind: 'knight', count: 1, at: 1 }] },
  { title: 'Fantasmas', interval: 1.8, power: 'ethereal', groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }, { kind: 'warchief', count: 2 }, { kind: 'shaman', count: 1 }, { kind: 'knight', count: 1 }, { kind: 'stoneling', count: 1, at: 1 }] },
  { title: 'Los invencibles', interval: 1.75, power: 'ward', groups: [{ kind: 'wraith', count: 2 }, { kind: 'goblin', count: 6 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }, { kind: 'warchief', count: 2 }, { kind: 'shaman', count: 1 }, { kind: 'knight', count: 1 }] },
  // el jefe solo ya tiene 80 de vida: la escolta es más chica que la de la oleada anterior, para que el
  // salto no sea de golpe. Presenta el último poder, el de esquivar, que no le pesa al jefe (no lo recibe)
  { title: 'El Gólem de roca', interval: 1.75, power: 'dodge', groups: [{ kind: 'golem', count: 1 }, { kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 2 }, { kind: 'warchief', count: 1 }, { kind: 'shaman', count: 1 }, { kind: 'wraith', count: 1 }] },
];

/** Segundos de descanso entre oleadas. */
export const INTERMISSION = 6;

/** Los poderes en juego en la oleada `index`: el que presenta y los que ya se vieron, con su edad. */
export function powerPool(waves: Wave[], index: number): { fresh?: PowerKey; old: { key: PowerKey; age: number }[] } {
  const old: { key: PowerKey; age: number }[] = [];
  for (let i = 0; i < index; i++) {
    for (const key of [waves[i].power, waves[i].extra]) if (key && !old.some((o) => o.key === key)) old.push({ key, age: index - i });
  }
  const fresh = waves[index]?.power;
  return fresh && !old.some((o) => o.key === fresh) ? { fresh, old } : { old };
}

/**
 * Orden de aparición de la oleada `index`: mezcla los grupos de forma pareja. Después reparte los poderes
 * al azar (`rand`): un tercio de los enemigos sale con uno, la mitad de esos con el nuevo de la oleada y
 * el resto con alguno de los que ya se vieron. El primero que aparece y puede tenerlo presenta el nuevo.
 * Los poderes caen en cualquier cuerpo que pueda tenerlos: con mala suerte, un caballero fantasma.
 */
export function spawnOrder(waves: Wave[], index: number, rand: () => number = Math.random): Spawn[] {
  const wave = waves[index];
  const slots: { spawn: Spawn; at: number }[] = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) {
      const at = g.at ?? (g.count <= 2 ? 0.4 + 0.2 * i : (i + 0.5) / g.count);
      slots.push({ spawn: g.mods ? { kind: g.kind, mods: g.mods } : { kind: g.kind }, at });
    }
  }
  slots.sort((a, b) => a.at - b.at);
  const order = slots.map((s) => s.spawn);

  const pool = powerPool(waves, index);
  const open = () => order.filter((s) => !s.mods && !ENEMIES[s.kind].boss);
  const total = Math.round(open().length * POWERED_SHARE);
  const fresh = pool.fresh ? (pool.old.length ? Math.ceil(total * FRESH_SHARE) : total) : 0;
  const give = (mods: EnemyMods, first: boolean) => {
    const free = open().filter((s) => canTake(s.kind, mods));
    if (!free.length) return;
    const pick = first ? free[0] : free[Math.floor(rand() * free.length)];
    pick.mods = mods;
  };
  for (let i = 0; i < total; i++) {
    if (i < fresh) give(POWERS[pool.fresh!](0, rand), i === 0);
    else if (pool.old.length) {
      const o = pool.old[Math.floor(rand() * pool.old.length)];
      give(POWERS[o.key](o.age, rand), false);
    }
  }
  // el de pasada: uno solo, cualquiera que pueda tenerlo
  if (wave.extra) give(POWERS[wave.extra](0, rand), false);
  // los escudos que salieron sorteados van de menor a mayor a lo largo de la oleada: el más duro, al final
  const shielded = order.filter((s) => s.mods?.shield && s.mods.shield < SHIELD_WALL && !wave.groups.some((g) => g.mods === s.mods));
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

  constructor(private readonly waves: Wave[] = WAVES, private readonly rest = INTERMISSION) {}

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
      this.queue = spawnOrder(this.waves, this.index);
      this.phase = 'spawning';
      this.timer = 0;
      events.push({ type: 'wave', index: this.index, wave });
    }
    if (this.phase === 'spawning') {
      while (this.timer <= 0 && this.queue.length) {
        const next = this.queue.shift()!;
        events.push({ type: 'spawn', kind: next.kind, ...(next.mods ? { mods: next.mods } : {}) });
        this.timer += this.waves[this.index].interval;
      }
      if (!this.queue.length) {
        if (this.endless) this.queue = spawnOrder(this.waves, this.index);
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
