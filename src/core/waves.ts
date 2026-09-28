// Oleadas: qué enemigos salen y cada cuánto. WaveDirector decide cuándo aparece el próximo.
// Los enemigos salen sueltos, sin formación: las filas se arman y se desarman solas porque cada uno
// camina a su ritmo, y encontrarlas es el juego.
//
// **Cuerpo y poder van por separado.** El tipo (el cuerpo) dice cuánta vida tiene, qué tan rápido va y
// cómo se ve: una escalera de vida de 1 a 10 que se lee por el tamaño. El poder (escudo, blindaje,
// explota, fantasma, aura, tierra, bandera, hechizo...) se le reparte **al azar** en cada oleada, así
// que no siempre es el mismo bicho el que viene con el mismo poder.

export type EnemyKind = 'goblin' | 'goblina' | 'orc' | 'skeleton' | 'warchief' | 'shaman' | 'healer' | 'knight' | 'stoneling' | 'wraith' | 'golem';

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

/** Aura: «ward» vuelve inmunes a los de alrededor (el chamán); «heal» los cura de a poco (el curandero). */
export type Aura = 'ward' | 'heal';

/**
 * **Poderes**: lo que se le suma a un cuerpo. Se ven en íconos arriba de la vida. En una oleada van fijos
 * por grupo (`WaveGroup.mods`) o repartidos al azar (`Wave.powers`).
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
 * El escudo muro: con el mejor golpe en 8, un escudo de 10 no deja pasar nada de frente, por fuerte que
 * sea. Obliga a resolverlo de otra forma: por detrás, de costado o con la granada. Es la calavera, y
 * late en violeta como los inmunes del chamán.
 */
export const SHIELD_WALL = 10;

/** Segundos entre piedras del gólem (valor de partida; se ajusta en el panel de balance). */
export const GOLEM_THROW_EVERY = 4;

/**
 * Los cuerpos, por vida: una escalera de 1 a 10 que se lee por el tamaño. El chamán y el curandero
 * comparten modelo (el curandero va teñido de verde): el pack trae un solo chamán.
 */
export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  goblin: { ...base, kind: 'goblin', name: 'Goblin', mesh: 'Character_Goblin_Male', height: 1.25, radius: 0.45, hp: 1, speed: 3.6, runs: true, damage: 1, gateDamage: 1, score: 10 },
  goblina: { ...base, kind: 'goblina', name: 'Goblina', mesh: 'Character_Goblin_Female', height: 1.25, radius: 0.45, hp: 2, speed: 3.3, runs: true, damage: 1, gateDamage: 1, score: 15 },
  orc: { ...base, kind: 'orc', name: 'Orco', mesh: 'Character_Goblin_Warrior_Male', height: 1.55, radius: 0.6, hp: 3, speed: 2.6, damage: 1, gateDamage: 1, score: 20 },
  skeleton: { ...base, kind: 'skeleton', name: 'Esqueleto', mesh: 'Character_Skeleton_Soldier_01', height: 1.8, radius: 0.55, hp: 4, speed: 2.1, damage: 1, gateDamage: 1, score: 25 },
  warchief: { ...base, kind: 'warchief', name: 'Jefe goblin', mesh: 'Character_Goblin_WarChief', height: 1.65, radius: 0.62, hp: 5, speed: 2.3, damage: 1, gateDamage: 1, score: 30 },
  shaman: { ...base, kind: 'shaman', name: 'Chamán goblin', mesh: 'Character_Goblin_Shaman', behavior: 'shaman', aura: 'ward', height: 1.45, radius: 0.5, hp: 6, speed: 2.2, damage: 0, gateDamage: 0, score: 60 },
  healer: { ...base, kind: 'healer', name: 'Curandero goblin', mesh: 'Character_Goblin_Shaman', behavior: 'shaman', aura: 'heal', height: 1.45, radius: 0.5, hp: 7, speed: 2.2, damage: 0, gateDamage: 0, tint: 0x9be58f, score: 60 },
  knight: { ...base, kind: 'knight', name: 'Caballero esqueleto', mesh: 'Character_Skeleton_Knight', height: 2.2, radius: 0.85, hp: 8, speed: 1.5, damage: 1, gateDamage: 2, heavy: true, score: 50 },
  stoneling: { ...base, kind: 'stoneling', name: 'Gólem chico', mesh: 'Character_Rock_Golem', height: 2.1, radius: 0.95, hp: 10, speed: 1.4, damage: 1, gateDamage: 2, heavy: true, score: 70 },
  wraith: { ...base, kind: 'wraith', name: 'Alma en pena', mesh: 'Character_Tormented_Soul', behavior: 'grabber', height: 1.9, radius: 0.5, hp: 2, speed: 5.8, runs: true, damage: 1, gateDamage: 0, score: 40 },
  golem: { ...base, kind: 'golem', name: 'Gólem de roca', mesh: 'Character_Rock_Golem', behavior: 'golem', height: 4.0, radius: 1.7, hp: 80, speed: 1.3, damage: 2, gateDamage: 1, heavy: true, boss: true, attackEvery: GOLEM_THROW_EVERY, score: 500 },
};

/** Los poderes que cambian cómo se mueve: solo los recibe un cuerpo que camina y pega. */
const BEHAVIOR_POWERS = ['explode', 'dig', 'banner', 'ranged', 'aura'] as const;

/**
 * Cómo se comporta un cuerpo con sus poderes. El alma en pena, el gólem y los chamanes tienen el suyo; el
 * resto camina y pega, salvo que un poder diga otra cosa.
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

/** Alma en pena: cada cuánto lastima mientras tiene agarrado al golfista, y cuánto aguanta agarrada. */
export const GRAB_TICK = 1.6;
export const GRAB_MAX = 5;

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  /** Poderes fijos para todos los de este grupo. */
  mods?: EnemyMods;
}

/** Poderes que se reparten al azar en la oleada: `count` enemigos (que puedan tenerlo) salen con `mods`. */
export interface WavePower {
  mods: EnemyMods;
  count: number;
}

/** Una aparición: el tipo y sus poderes. */
export interface Spawn {
  kind: EnemyKind;
  mods?: EnemyMods;
}

export interface Wave {
  title: string;
  groups: WaveGroup[];
  /** Poderes repartidos al azar entre los de la oleada. */
  powers?: WavePower[];
  /** Segundos entre apariciones. */
  interval: number;
}

/**
 * Las oleadas. Cada una presenta, como mucho, una cosa nueva (un cuerpo o un poder), y la dificultad sube
 * pareja: ver «Balance de las oleadas» en docs/diseno-combate.md, y `tools/oleadas.mts` para medirla.
 */
export const WAVES: Wave[] = [
  { title: 'Los cuatro palos', interval: 2.2, groups: [{ kind: 'goblin', count: 8 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 2 }, { kind: 'skeleton', count: 2 }] },
  { title: 'Escudos al frente', interval: 2.1, groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }],
    powers: [{ mods: { shield: 1 }, count: 4 }] },
  { title: 'La estampida', interval: 1.6, groups: [{ kind: 'goblin', count: 10 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 1 }],
    powers: [{ mods: { explode: true }, count: 4 }, { mods: { shield: 1 }, count: 2 }] },
  { title: 'Acorazados', interval: 2.0, groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 2 }, { kind: 'warchief', count: 1 }],
    powers: [{ mods: { armor: 1 }, count: 4 }, { mods: { shield: 2 }, count: 2 }] },
  { title: 'Almas en pena', interval: 1.9, groups: [{ kind: 'wraith', count: 2 }, { kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }],
    powers: [{ mods: { explode: true }, count: 2 }, { mods: { shield: 2 }, count: 2 }, { mods: { armor: 1 }, count: 2 }] },
  { title: 'Los benditos', interval: 1.9, groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }, { kind: 'warchief', count: 1 }],
    powers: [{ mods: { divine: 5 }, count: 4 }, { mods: { armor: 1 }, count: 2 }, { mods: { explode: true }, count: 2 }] },
  { title: 'Fantasmas', interval: 1.85, groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }, { kind: 'knight', count: 1 }],
    powers: [{ mods: { ethereal: true }, count: 4 }, { mods: { shield: 2 }, count: 2 }, { mods: { explode: true }, count: 2 }] },
  { title: 'La tierra se levanta', interval: 1.8, groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 4 }, { kind: 'skeleton', count: 4 }, { kind: 'warchief', count: 1 }],
    powers: [{ mods: { dig: true }, count: 2 }, { mods: { armor: 2 }, count: 2 }, { mods: { shield: 3 }, count: 1 }, { mods: { divine: 5 }, count: 2 }] },
  { title: 'Los chamanes', interval: 1.8, groups: [{ kind: 'shaman', count: 1 }, { kind: 'healer', count: 1 }, { kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 3 }],
    powers: [{ mods: { shield: 3 }, count: 2 }, { mods: { explode: true }, count: 2 }, { mods: { ethereal: true }, count: 2 }] },
  { title: 'Hechiceros', interval: 1.75, groups: [{ kind: 'goblin', count: 6 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 4 }, { kind: 'skeleton', count: 3 }, { kind: 'warchief', count: 2 }, { kind: 'stoneling', count: 1 }],
    powers: [{ mods: { ranged: true }, count: 2 }, { mods: { armor: 2 }, count: 2 }, { mods: { shield: 4 }, count: 1 }, { mods: { explode: true }, count: 3 }, { mods: { divine: 5 }, count: 2 }] },
  { title: 'Bajo la bandera', interval: 1.7, groups: [{ kind: 'goblin', count: 7 }, { kind: 'goblina', count: 5 }, { kind: 'orc', count: 4 }, { kind: 'skeleton', count: 3 }, { kind: 'warchief', count: 2 }, { kind: 'knight', count: 1 }, { kind: 'healer', count: 1 }],
    powers: [{ mods: { banner: true }, count: 1 }, { mods: { shield: SHIELD_WALL }, count: 1 }, { mods: { armor: 3 }, count: 1 }, { mods: { shield: 4 }, count: 2 }, { mods: { ethereal: true }, count: 2 }, { mods: { dig: true }, count: 1 }, { mods: { explode: true }, count: 3 }] },
  // el jefe solo ya tiene 80 de vida: la escolta es más chica que la de la oleada anterior, para que el
  // salto no sea de golpe
  { title: 'El Gólem de roca', interval: 1.7, groups: [{ kind: 'golem', count: 1 }, { kind: 'goblin', count: 6 }, { kind: 'goblina', count: 4 }, { kind: 'orc', count: 3 }, { kind: 'skeleton', count: 2 }, { kind: 'warchief', count: 1 }, { kind: 'wraith', count: 1 }],
    powers: [{ mods: { banner: true }, count: 1 }, { mods: { ranged: true }, count: 1 }, { mods: { shield: 5 }, count: 1 }, { mods: { explode: true }, count: 3 }, { mods: { ethereal: true }, count: 1 }] },
];

/** Segundos de descanso entre oleadas. */
export const INTERMISSION = 6;

/**
 * Orden de aparición de una oleada: mezcla los grupos de forma pareja y determinista. Después reparte
 * los poderes al azar (`rand`) entre los que puedan recibirlos: uno por enemigo.
 */
export function spawnOrder(wave: Wave, rand: () => number = Math.random): Spawn[] {
  const slots: { spawn: Spawn; at: number }[] = [];
  for (const g of wave.groups) {
    // los grupos de uno o dos (jefe, chamanes) salen hacia la mitad de la oleada
    for (let i = 0; i < g.count; i++) slots.push({ spawn: g.mods ? { kind: g.kind, mods: g.mods } : { kind: g.kind }, at: g.count <= 2 ? 0.4 + 0.2 * i : (i + 0.5) / g.count });
  }
  slots.sort((a, b) => a.at - b.at);
  const order = slots.map((s) => s.spawn);
  for (const p of wave.powers ?? []) {
    const free = order.filter((s) => !s.mods && canTake(s.kind, p.mods));
    for (let i = 0; i < p.count && free.length; i++) {
      const pick = free.splice(Math.floor(rand() * free.length), 1)[0];
      pick.mods = p.mods;
    }
  }
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
      this.queue = spawnOrder(wave);
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
