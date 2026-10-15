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
//
// **Cuánto de todo eso sale lo decide la dificultad** (`RunRules`, que arma core/difficulty.ts con los
// puntos que puso el jugador). Sin puntos, cada oleada trae solo el poder de su escenario, sin olas
// especiales ni apoyos; `buildRun()` sin reglas arma la más difícil.

import { L } from '../i18n';
import { BUDGET, shotsFor } from './budget';
import { CHARGE, FOURTH } from './clubs';

export type EnemyKind = 'goblin' | 'goblina' | 'orc' | 'skeleton' | 'warchief' | 'shaman' | 'knight' | 'stoneling' | 'wraith' | 'golem' | NewKind;
/** Los monstruos nuevos (14/10): ya tienen modelo y animaciones, pero todavía no salen en las oleadas. */
export type NewKind = 'ogre' | 'minotaur' | 'lizardman' | 'warg' | 'spider' | 'slime';

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
  /** Armadura: se le resta a cada golpe (1 o 2, ver ARMOR_MAX). */
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
  /**
   * Va aparte (los hechiceros del talento, ver CASTERS): no cuenta para terminar la oleada. Se queda hasta
   * que lo matan, aunque empiece la siguiente.
   */
  apart?: boolean;
  /** Esquiva: si le apuntás al soltar el tiro o al tirar una habilidad, salta al costado (ver DODGE). */
  dodge?: boolean;
  /** Segundos que tarda en volver a esquivar, si no son los de DODGE (con poca dificultad, más). */
  dodgeEvery?: number;
  /** Se cura entero cada tanto (ver REGEN): los segundos de margen que da su ciclo. */
  regen?: number;
  /**
   * Intocable (ver PHASE): invulnerable salvo en su turno; en cuántos tiempos va el ritmo (3, o 2 con poca
   * dificultad): los grupos arrancan su ventana escalonados.
   */
  phase?: number;
  /** Intocable: qué parte del ciclo está abierto (la mitad; con poca dificultad, dos tercios). */
  phaseOpen?: number;
  /** Invisible: cada tanto se esfuma y camina cruzado hasta que vuelve a aparecer (ver STEALTH). */
  stealth?: boolean;
  /** Segundos a la vista entre una vez y la siguiente, si no son los de STEALTH (con poca dificultad, más). */
  stealthEvery?: number;
  /** Vida de más o de menos sobre la del cuerpo. */
  hp?: number;
  /**
   * Tamaño de élite, sobre el del cuerpo. Más de 1 **es** el élite (mata de una, calavera, el hoyo no lo
   * traga). Agranda también su radio para las pelotas.
   */
  size?: number;
  /** La oleada de los gigantes: más grande (y su radio para las pelotas), sin ser élite. */
  giant?: number;
  /** Velocidad, por sobre la de su cuerpo (los gigantes van más lentos). */
  speed?: number;
}

export interface EnemyStats {
  kind: EnemyKind;
  name: string;
  /** Malla del personaje dentro de dungeon.glb (o de `model`). */
  mesh: string;
  /**
   * Los que no comparten el esqueleto de PolygonDungeon (los bichos de cuatro patas, la araña, el limo)
   * traen su propio GLB con sus clips: el nombre del archivo en public/models.
   */
  model?: string;
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
   * vida, chocarse con uno de los grandes te mata; con un élite, siempre (ver `ELITE.damage`).
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
 * así que desde el escudo 4 ya casi nada entra de frente; la calavera lo deja claro a la vista). Obliga a resolverlo de otra forma: por detrás, de costado o silenciándolo. Es la calavera, y
 * late en violeta como los inmunes del chamán.
 */
export const SHIELD_WALL = 10;

/** Segundos entre piedras del gólem (valor de partida; se ajusta en el panel de balance). */
export const GOLEM_THROW_EVERY = 4;

/**
 * Los cuerpos, por vida: una escalera de 1 a 10 que se lee por el tamaño. El chamán es un cuerpo más: el
 * aura es un poder, y le puede tocar a cualquiera.
 */
// los tamaños del jefe goblin, el chamán y el caballero, más grandes desde el 13/10 (Leandro: el jefe goblin sin ser
// élite quedaba muy chico, el chamán olvidable, y el caballero tenía que imponer): eran 1.65, 1.45 y 2.2 m, y el
// radio creció igual
export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  goblin: { ...base, kind: 'goblin', name: 'Goblin', mesh: 'Character_Goblin_Male', height: 1.25, radius: 0.45, hp: 1, speed: 3.6, runs: true, damage: 1, gateDamage: 1, score: 10 },
  goblina: { ...base, kind: 'goblina', name: L('Goblina', 'Goblin Lass'), mesh: 'Character_Goblin_Female', height: 1.25, radius: 0.45, hp: 2, speed: 3.3, runs: true, damage: 1, gateDamage: 1, score: 15 },
  orc: { ...base, kind: 'orc', name: L('Orco', 'Orc'), mesh: 'Character_Goblin_Warrior_Male', height: 1.55, radius: 0.6, hp: 3, speed: 2.6, damage: 2, gateDamage: 2, score: 20 },
  skeleton: { ...base, kind: 'skeleton', name: L('Esqueleto', 'Skeleton'), mesh: 'Character_Skeleton_Soldier_01', height: 1.8, radius: 0.55, hp: 4, speed: 2.1, damage: 2, gateDamage: 2, score: 25 },
  warchief: { ...base, kind: 'warchief', name: L('Jefe goblin', 'Goblin Chief'), mesh: 'Character_Goblin_WarChief', height: 2.0, radius: 0.75, hp: 5, speed: 2.3, damage: 2, gateDamage: 2, score: 30 },
  shaman: { ...base, kind: 'shaman', name: L('Chamán goblin', 'Goblin Shaman'), mesh: 'Character_Goblin_Shaman', height: 1.85, radius: 0.64, hp: 6, speed: 2.2, damage: 2, gateDamage: 2, score: 40 },
  knight: { ...base, kind: 'knight', name: L('Caballero esqueleto', 'Skeleton Knight'), mesh: 'Character_Skeleton_Knight', height: 2.6, radius: 1.0, hp: 8, speed: 1.5, damage: 3, gateDamage: 3, heavy: true, score: 50 },
  stoneling: { ...base, kind: 'stoneling', name: L('Gólem chico', 'Small Golem'), mesh: 'Character_Rock_Golem', height: 2.1, radius: 0.95, hp: 10, speed: 1.4, damage: 3, gateDamage: 3, heavy: true, score: 70 },
  wraith: { ...base, kind: 'wraith', name: L('Huargo', 'Warg'), mesh: 'Character_Warg', model: 'warg.glb', behavior: 'grabber', height: 1.4, radius: 0.7, hp: 2, speed: 5.8, runs: true, damage: 1, gateDamage: 0, score: 40 },
  golem: { ...base, kind: 'golem', name: L('Gólem de roca', 'Rock Golem'), mesh: 'Character_Rock_Golem', behavior: 'golem', height: 4.0, radius: 1.7, hp: 80, speed: 1.3, damage: 2, gateDamage: 1, heavy: true, boss: true, attackEvery: GOLEM_THROW_EVERY, score: 500 },
  // Los nuevos: no están en LADDER ni en HEAVY, así que el director no los manda. Los números son de
  // partida, para probarlos en el bestiario (bestiario.html) o soltándolos con __gk.spawn.
  // Los humanoides van en dungeon.glb (tools/monster_*.py); los otros, cada uno en su GLB (tools/beast_*.py).
  // La altura cuenta los cuernos del minotauro y la cresta del lagarto, por eso van un poco más altos.
  ogre: { ...base, kind: 'ogre', name: L('Ogro', 'Ogre'), mesh: 'Character_Ogre', height: 2.8, radius: 1.05, hp: 9, speed: 1.5, damage: 3, gateDamage: 3, heavy: true, score: 60 },
  minotaur: { ...base, kind: 'minotaur', name: L('Minotauro', 'Minotaur'), mesh: 'Character_Minotaur', height: 2.8, radius: 0.95, hp: 7, speed: 2.0, damage: 3, gateDamage: 3, heavy: true, score: 55 },
  lizardman: { ...base, kind: 'lizardman', name: L('Hombre lagarto', 'Lizardman'), mesh: 'Character_Lizardman', height: 2.0, radius: 0.55, hp: 3, speed: 3.8, runs: true, damage: 2, gateDamage: 2, score: 25 },
  warg: { ...base, kind: 'warg', name: L('Huargo', 'Warg'), mesh: 'Character_Warg', model: 'warg.glb', height: 1.4, radius: 0.7, hp: 2, speed: 5.0, runs: true, damage: 1, gateDamage: 1, score: 20 },
  spider: { ...base, kind: 'spider', name: L('Araña gigante', 'Giant Spider'), mesh: 'Character_Spider', model: 'spider.glb', height: 1.1, radius: 0.9, hp: 4, speed: 3.4, runs: true, damage: 2, gateDamage: 2, score: 30 },
  slime: { ...base, kind: 'slime', name: L('Limo venenoso', 'Poison Slime'), mesh: 'Character_Slime', model: 'slime.glb', height: 1.2, radius: 0.8, hp: 5, speed: 1.6, damage: 2, gateDamage: 2, score: 35 },
};

/** Los monstruos nuevos, en el orden del bestiario. */
export const NEW_KINDS: NewKind[] = ['ogre', 'minotaur', 'lizardman', 'warg', 'spider', 'slime'];

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
 * blindaje 3 (que al mejor golpe le deja pasar 1; desde el 7/10 no sale, ver ARMOR_MAX) solo en los de hasta 4. Y el etéreo tampoco va en los
 * de 1 de vida: al goblin no le cambia nada, así que el fantasma pasa al próximo que pueda tenerlo.
 */
export const LIMITS = { etherealMinHp: 2, etherealMaxHp: 8, armor3MaxHp: 4, regenMinHp: 2 };

/**
 * ¿Este cuerpo puede recibir este poder? Los jefes, ninguno; los que ya se comportan distinto, solo los
 * de defensa; y con los topes de LIMITS.
 */
export function canTake(kind: EnemyKind, mods: EnemyMods): boolean {
  const s = ENEMIES[kind];
  if (s.boss) return false;
  if (mods.ethereal && (s.hp > LIMITS.etherealMaxHp || s.hp < LIMITS.etherealMinHp)) return false;
  // el que se cura, como el fantasma, desde 2 de vida: al goblin se lo mata de un golpe y la cura no se ve
  if (mods.regen && s.hp < LIMITS.regenMinHp) return false;
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
 * Aura de curación del chamán curandero, para los que están a `radius` metros.
 * - **Con `full` (desde el 14/10, Leandro: que cure como el que se curaba a sí mismo antes)**: un reloj de
 *   `cycle` segundos, que se ve en la barra debajo de su vida; al llenarse, **cura entero** a todos los de su
 *   círculo, salvo al élite y al jefe, que recuperan a lo sumo `bigCap`. Hay que matar lo que está adentro
 *   antes de que se llene, o al curandero.
 * - Sin `full` (lo de antes): cada `every` segundos, `amount` de vida a cada uno.
 */
export const HEAL_AURA = { radius: 6, every: 3, amount: 1, full: 1, cycle: 6, bigCap: 5 };

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
 * Esquiva: **ni bien soltás el tiro, o tirás una habilidad que se apunta**, el que tenés «más o menos»
 * apuntado (a menos de `aimWidth` metros de la línea, más su radio) salta `distance` metros al costado,
 * siempre, y no vuelve a saltar hasta `cooldown` segundos después. Se le gana haciéndolo saltar con
 * algo (un tiro flojo, una pifia, una habilidad) y pegándole con lo que importa antes de que recargue, o
 * con un área que lo agarre igual (el wedge). Silenciado, aturdido o congelado no esquiva. **Recibir daño
 * le recarga la esquiva en el acto** (4/10): después de cada golpe hay que volver a hacerlo saltar. (Hasta
 * el 1/10 saltaba cuando la carga pasaba al golpe 2.)
 */
export const DODGE = { cooldown: 5, distance: 3.2, aimWidth: 2.2, hop: 0.6, hopTime: 0.35 };

/**
 * **El invisible** (15/10, idea de Leandro): a los `first` s de aparecer se esfuma (un destello y un soplido
 * donde estaba) y, mientras no se lo ve, **camina cruzado**: elige un ángulo de `minAngle` a `maxAngle`
 * grados de su camino, para un lado o el otro, y se corre de costado **sin perder lo que avanza**: lo de
 * costado se suma (no se normaliza), así llega a la línea cuando llegaría a la vista. Si ese punto queda
 * afuera de la cancha prueba el otro lado, y si tampoco entra se queda en el borde (`margin` m antes).
 * A los `hidden` s (el élite, `eliteHidden`) vuelve a aparecer y sigue derecho; a los `visible` s, otra vez.
 *
 * - `onHit`: 1, el golpe que le entra a la vista lo esconde en el acto; 0, solo el reloj.
 * - El golpe que le llega escondido (también el que no le saca nada: el blindaje, la burbuja, el muro)
 *   **lo delata**: el pelotazo, el ruido y un destello blanco del cuerpo por `ping` s. No cambia su camino:
 *   dos golpes dicen para dónde va. Lo que muerde solo (el fuego) no lo delata, pero sus llamas se ven.
 * - A `line` m de la línea del golfista aparece y ya no se esconde (como el intocable y el que se cura).
 * - Silenciado aparece, y el reloj se queda quieto hasta que se le pasa.
 * - `fade`: lo que tarda en desvanecerse o en aparecer.
 */
export const STEALTH = { first: 1.5, visible: 3, hidden: 3, eliteHidden: 4, onHit: 1, minAngle: 25, maxAngle: 70, margin: 1, line: 6, ping: 0.45, fade: 0.25 };

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
  /**
   * Los suma una marca (la de la estampida): se meten entre los de la oleada, repartidos en lo que dura, sin
   * correrlos. Así los de siempre (el élite también) salen cuando salían sin la marca (12/10, Leandro: con
   * la estampida el élite tardaba más en salir, y eso ayudaba).
   */
  mark?: boolean;
}

/** Los poderes que se reparten al azar. */
export type PowerKey = 'shield' | 'armor' | 'explode' | 'ranged' | 'dig' | 'heal' | 'ethereal' | 'ward' | 'dodge' | 'divine' | 'banner' | 'regen' | 'phase' | 'stealth';

/**
 * Qué tan duros salen los poderes, según la dificultad (el talento «Poderes más duros», 7/10: toca a
 * todos los poderes de escenario):
 * - `cap`: hasta qué nivel llega el escudo.
 * - `armorRolls`: el blindaje (que no pasa de ARMOR_MAX) sale con el mayor de tantos sorteos: con 2, el
 *   blindaje 1 sale mucho menos.
 * - `recharge`: por cuánto se multiplica lo que tardan el escurridizo y el bendito en recargar, y lo que el
 *   invisible pasa a la vista entre una vez y la siguiente.
 * - `regen`: por cuánto se multiplica el margen del que se cura (más margen, más tarda en curarse).
 * - `timings`: en cuántos tiempos va el ritmo de los intocables (3; con poca dificultad, 2).
 * - `phaseOpen`: qué parte del ciclo está abierto cada intocable (la mitad; con poca dificultad, dos
 *   tercios).
 * - `full`: el escudo y el blindaje salen siempre al máximo (12/10, Leandro: con «Poderes más duros», el
 *   escudo de 3 y el blindaje de 2, también en el primer escenario; al escudo se le pega por el costado o
 *   con el área, y al blindaje con el driver de lejos o el putter de cerca).
 * - `ghostHp`: vida de más del fantasma común (el élite, desde el 12/10, nada: ver ELITE.hp).
 */
export interface PowerHardness {
  cap: number;
  armorRolls: number;
  recharge: number;
  regen: number;
  timings: number;
  phaseOpen: number;
  full: boolean;
  ghostHp: number;
}
export const HARDEST_POWERS: PowerHardness = { cap: 3, armorRolls: 2, recharge: 1, regen: 1, timings: 3, phaseOpen: 0.5, full: true, ghostHp: 1 };

/**
 * El blindaje no pasa de 2 (7/10, pedido de Leandro): con 3, al mejor golpe le entraba 1 y se terminaba
 * dependiendo del fuego. El escudo sí llega a 3, que se resuelve por detrás con el área.
 */
export const ARMOR_MAX = 2;

/**
 * **El blindado trae menos vida** (12/10, Leandro: «el problema no deben ser los enemigos con poca vida y
 * blindaje, sino los de mucha vida»): con blindaje 2, dos tercios de su vida (con la mitad, en el nivel 5
 * el bot ganaba 18 de 20: el más fácil); con 1, tres cuartos (para
 * arriba, al menos 1). Toda su vida: la del cuerpo y la que le sumen el élite, los gigantes o el golpe 4. El
 * jefe del final, no. Con el análisis de docs/dps.md y la mezcla de golpes de Leandro, lo que le ocupa de
 * más contra uno sin poder pasa de ×1.9 a ×1.4 (blindaje 1) y de ×4.6 a ×3.1 (blindaje 2). Por nivel de
 * blindaje (0, 1, 2).
 */
export const ARMOR_HP = [1, 0.75, 2 / 3];

/**
 * Lo que tarda en recargar el escudo divino, en segundos (el del élite, `elite`: desde el 12/10 lo mismo que
 * los comunes, como el escurridizo; era 3, y en el nivel 5 el bot ganaba 1 de 20). Además, **cada golpe que
 * le entra le devuelve la burbuja** (5/10, primero al élite y después a todos, pedido de Leandro): como el
 * que esquiva, hay que rompérsela antes de cada golpe.
 */
export const DIVINE = { every: 5, elite: 5 };

/**
 * En qué cuerpos caen el fantasma y el bendito (en prueba desde el 12/10, idea de Leandro: «en vez de
 * bajarle la vida, que vengan menos de los grandes»). Contra los dos la carga no sirve (al fantasma cada
 * golpe le saca 1; al bendito cada golpe pide antes otro que le rompa la burbuja), así que lo que cuestan
 * son tiros, uno por cada punto de vida. `ethereal` y `divine`: con 0 cae parejo en cualquiera que pueda
 * tenerlo; con k, con chance 1/vida^k (1: el de 4 de vida sale la mitad que el de 2). `giants`: con 0, no
 * se agrandan (ni en la oleada de gigantes ni con la marca). El élite, aparte (ver `elite`).
 */
export const POWER_BIAS = { ethereal: 0, divine: 0, giants: 1 };

/**
 * La velocidad de todos los que traen cada poder de escenario, élite incluido (el jefe del final, no), encima
 * de la que traigan. Es del poder, no de la dificultad: igual con «Poderes más duros» y sin él (Leandro,
 * 12/10: «todos los fantasmas un 10 % más lentos, siempre, me parece razonable; y después el talento le suma
 * uno de vida»). 1 es la de siempre; en prueba.
 */
export const POWER_SPEED: Record<ScenarioPower, number> = { shield: 1, armor: 1, ethereal: 1, divine: 1, dodge: 1, regen: 1, phase: 1, stealth: 1 };

/**
 * Cuántos salen con cada poder de escenario, sobre los que le tocarían (el que lo presenta y el élite,
 * siempre): con 0.7, de cada diez que le tocaban salen unos siete, y el resto sin poder. En prueba desde el
 * 12/10 para el bendito, que cuesta el doble de tiros y no tiene palo que lo resuelva (la burbuja se come
 * también el área). 1 es todos.
 */
export const POWER_COUNT: Record<ScenarioPower, number> = { shield: 1, armor: 1, ethereal: 1, divine: 1, dodge: 1, regen: 1, phase: 1, stealth: 1 };

/** A cuál de `free` le toca el poder `mods`: parejo, salvo el fantasma y el bendito (ver POWER_BIAS). */
function pickBody(free: Spawn[], mods: EnemyMods, rand: () => number): Spawn {
  const k = mods.ethereal ? POWER_BIAS.ethereal : mods.divine ? POWER_BIAS.divine : 0;
  if (!k) return free[Math.floor(rand() * free.length)];
  const weights = free.map((s) => ENEMIES[s.kind].hp ** -k);
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) if ((r -= weights[i]) < 0) return free[i];
  return free[free.length - 1];
}

/**
 * **El que se cura** (5/10, idea de Leandro): cada tanto se cura **entero**, con aviso (la barra verde
 * debajo de la vida se llena, y al llenarse el cuerpo brilla verde). Hay que meterle todo el daño entre
 * una cura y la siguiente, y conviene arrancar justo después de la cura, ya cargando.
 *
 * El ciclo sale de su vida: alcanza para matarlo **con golpes medios** (`hit` de daño cada `gap` s, el
 * ritmo medido del caballero: ver docs/tiempos-poderes.md) y sobran `margin` s (el élite, `eliteMargin`).
 * Con 6 de vida: 3 medios, 3 s, más el margen. Con flojos no llega. Silenciado no se cura, y el ciclo
 * vuelve a empezar cuando se le pasa. Trae `hp` de vida de más (no el élite, que ya trae la suya): al de
 * 2 de vida se lo mataba de un golpe y era como no tener poder.
 *
 * **No se cura justo antes de la línea** (11/10, pedido de Leandro: se curaba a unos metros y no quedaba
 * tiempo de volver a bajarlo). El ciclo corre un poco más lento (o, si le falta poco, un poco más rápido)
 * para que la cura que tocaría justo antes de cruzar la línea del golfista caiga `after` s después: así
 * el último ciclo antes de la línea es entero. Ver `regenPace`.
 * - `hurry`: lo más que se apura el ciclo (×1.1); si no alcanza, se frena.
 * - `slowest`: lo más que se frena de lejos (×0.7). Cerca de la línea se frena lo que haga falta: la
 *   barra casi llena espera a que cruce.
 *
 * **El ciclo arranca con el primer golpe** (`onHit`, 11/10, idea de Leandro): sano no corre; el primer
 * golpe que le entra lo arranca, y al llenarse se cura entero y se queda quieto hasta el próximo golpe.
 * Antes corría siempre, y había que esperar a que se curara para arrancar justo después (con el análisis
 * de docs/dps.md, al ritmo de Leandro lo mataba en un 35 a 55 % de los ciclos aun arrancando justo).
 * Así se abre con un golpe fuerte y hay un ciclo entero para rematarlo. 0 = como antes.
 *
 * **Con las cargas** (`byCharge`, 13/10, idea de Leandro: «que desde el primer golpe tengas poco tiempo para
 * matarlo»): el ciclo alcanza para rematarlo después del golpe más fuerte (el 3, o el 4 con el golpe 4) con
 * la combinación de golpes más rápida (ver `finishTime`: lo que se carga cada uno y `move`, lo que se tarda
 * entre tiros, el de Leandro), y sobra el margen por `slack` (lo que vuela la pelota). Con 5 de vida y sin
 * el golpe 4, después de un 3 alcanza para cargar un 2 y nada más. `minCharge`, el ciclo más corto. 0 = con
 * golpes medios, como antes.
 */
export const REGEN = { hit: 2, gap: 1.5, margin: 1.2, eliteMargin: 0.8, min: 2.5, hp: 2, after: 0.1, hurry: 0.1, slowest: 0.7, onHit: 1, byCharge: 1, move: 1, slack: 0.6, minCharge: 1.5 };

/**
 * Lo que se tarda en sacarle `hp` de vida con la combinación de golpes más rápida: cada tiro es lo de entre
 * tiros (`REGEN.move`) más la carga hasta el medio de su tramo (como en arco.html), y saca su número (el 4,
 * uno más que el 3, con el golpe 4).
 */
export function finishTime(hp: number): number {
  const red = FOURTH.on ? (CHARGE.strong * (1 - FOURTH.share)) / 4 : CHARGE.strong / 2;
  const shots = [
    { dmg: 1, t: CHARGE.weak / 2 },
    { dmg: 2, t: CHARGE.weak + CHARGE.mid / 2 },
    { dmg: 3, t: CHARGE.weak + CHARGE.mid + red },
    ...(FOURTH.on ? [{ dmg: 3 + FOURTH.bonus, t: CHARGE.weak + CHARGE.mid + CHARGE.strong / 2 }] : []),
  ];
  const best = [0];
  for (let x = 1; x <= hp; x++) best[x] = Math.min(...shots.map((s) => REGEN.move + s.t + best[Math.max(0, x - s.dmg)]));
  return best[Math.max(0, hp)];
}

/**
 * A qué ritmo corre el ciclo del que se cura (1, el de siempre): `eta` es lo que le falta para llegar a la
 * línea (Infinity si no va para ahí), `period` lo que dura el ciclo y `elapsed` lo que lleva. Busca que la
 * última cura antes de la línea caiga justo después de cruzarla (ver REGEN): de las dos que quedan
 * alrededor, mueve la que esté más cerca, apurándose solo un poco.
 *
 * Con `single` (el ciclo que arranca con el golpe, ver REGEN.onHit) viene una sola cura y después se queda
 * quieto: solo se frena si esa cura cae a menos de un ciclo de la línea, donde ya no daría tiempo de
 * volver a empezar; si cae antes, queda tiempo de abrirlo de nuevo.
 */
export function regenPace(eta: number, period: number, elapsed: number, single = false): number {
  if (!Number.isFinite(eta) || eta <= 0 || period <= 0) return 1;
  const aim = eta + REGEN.after;
  const next = Math.max(0, period - elapsed);
  // ninguna cura antes de cruzar: nada que mover
  if (next >= aim) return 1;
  if (single) return aim - next < period ? next / aim : 1;
  // la última antes de cruzar, y la primera después
  const before = next + Math.floor((aim - next) / period) * period;
  const after = before + period;
  if (after - aim < aim - before && after / aim <= 1 + REGEN.hurry) return after / aim;
  return Math.max(eta < period ? 0 : REGEN.slowest, before / aim);
}

/**
 * **El intocable** (5/10, idea de Leandro): **invulnerable** salvo en su ventana, como los que protege el
 * chamán (se lo ve violeta y las pelotas rebotan). Una barra violeta debajo de su vida se va descargando;
 * cuando se vacía queda **vulnerable** (la barra se pone dorada y se vacía), y vuelve a cerrarse.
 *
 * **Un ritmo para todos** (11/10, pedido de Leandro: ciclos mucho más cortos, que sea timear el golpe, y
 * que no dependa del tamaño). Los intocables van en tres grupos que se turnan, en un ciclo de `cycle` s:
 * cada grupo arranca su ventana un tercio de ciclo después del anterior, así se prende uno y se apaga otro.
 * El élite y el jefe, igual que los comunes. Con poca dificultad, **dos tiempos** (Leandro, 11/10; ver
 * `PowerHardness.timings`). La horda reparte los grupos en orden, a medida que aparecen.
 *
 * **Cuánto está abierto** (`PowerHardness.phaseOpen`, 12/10, Leandro: complicaban toda la oleada): la
 * mitad del ciclo (1.2 s abierto, 1.2 cerrado), y con poca dificultad dos tercios (1.6 y 0.8). Hasta ahí
 * era un tiempo (un tercio, y la mitad con dos tiempos), así que cada ventana era de un grupo solo; ahora
 * se pisan un poco: siempre hay alguno abierto.
 *
 * **Llegando a la línea queda abierto** (11/10, pedido de Leandro: se cerraba a unos metros y no había más
 * que dejarlo pasar). Si le falta `line` pulsos o menos para cruzar la línea del golfista se abre, y si ya
 * estaba abierto a `line + hold` pulsos, no se cierra: llega abierto, por un tramo que varía con el ritmo
 * (de uno a dos pulsos y medio), sin franjas fijas en la cancha.
 *
 * El golpe fantasma le entra siempre, y silenciado es vulnerable.
 */
export const PHASE = { cycle: 2.4, line: 1, hold: 0.5 };

/**
 * Dónde va el ritmo de los intocables para el grupo `group` de `n` (los tiempos), con el reloj de la horda
 * en `clock`, un ciclo de `cycle` s y abierto `open` de él: cuánto le falta para abrirse (0 si está
 * abierto) y cuánto le queda abierto (0 si está cerrado). El grupo g abre a los g/n del ciclo.
 */
export function phaseSlot(clock: number, cycle: number, group: number, n: number, open = 1 / n): { opensIn: number; openLeft: number } {
  const t = clock / cycle - group / n;
  const into = t - Math.floor(t);
  return into < open ? { opensIn: 0, openLeft: (open - into) * cycle } : { opensIn: (1 - into) * cycle, openLeft: 0 };
}

/** Cada cuántos segundos se cura uno de `maxHp` de vida con `margin` de margen. */
export function regenPeriod(maxHp: number, margin: number): number {
  // con las cargas: lo que falta después del golpe más fuerte, y el margen (ver REGEN.byCharge)
  if (REGEN.byCharge) return Math.max(REGEN.minCharge, finishTime(maxHp - (FOURTH.on ? 3 + FOURTH.bonus : 3)) + margin * REGEN.slack);
  return Math.max(REGEN.min, margin + (Math.ceil(maxHp / REGEN.hit) - 1) * REGEN.gap);
}

/** La esquiva, con la recarga que diga la dificultad. */
function dodgeMods(hard: PowerHardness): EnemyMods {
  return hard.recharge === 1 ? { dodge: true } : { dodge: true, dodgeEvery: DODGE.cooldown * hard.recharge };
}

/** El invisible: con poca dificultad pasa más rato a la vista. */
function stealthMods(hard: PowerHardness): EnemyMods {
  return hard.recharge === 1 ? { stealth: true } : { stealth: true, stealthEvery: STEALTH.visible * hard.recharge };
}

/** El blindaje de un común: de 1 en el primer escenario, y después 1 o 2 (el mayor de `armorRolls` sorteos). */
function armorLevel(tier: number, rand: () => number, hard: PowerHardness): number {
  let best = 0;
  for (let i = 0; i < Math.max(1, hard.armorRolls); i++) best = Math.max(best, rand());
  return 1 + Math.floor(best * Math.min(ARMOR_MAX, tier + 1));
}

/**
 * Un poder, según el escenario (`tier`: 0, 1 y 2, y 3 en la oleada del jefe): el escudo sube de nivel con
 * la partida, de 1 en el primer escenario hasta `hard.cap` (3) en el tercero, y el blindaje hasta 2. No
 * pasan de 3: con el mejor golpe en 4, un escudo o un blindaje de 4 ya no deja pasar nada.
 */
export const POWERS: Record<PowerKey, (tier: number, rand: () => number, hard?: PowerHardness) => EnemyMods> = {
  // con «Poderes más duros», al máximo siempre (ver PowerHardness.full)
  shield: (tier, rand, hard = HARDEST_POWERS) => ({ shield: hard.full ? hard.cap : 1 + Math.floor(rand() * Math.min(hard.cap, tier + 1)) }),
  armor: (tier, rand, hard = HARDEST_POWERS) => ({ armor: hard.full ? ARMOR_MAX : armorLevel(tier, rand, hard) }),
  explode: () => ({ explode: true }),
  ranged: () => ({ ranged: true }),
  // cava: por ahora afuera de las partidas (ver docs/pendientes.md). El poder sigue andando
  dig: () => ({ dig: true }),
  heal: () => ({ aura: 'heal' }),
  ethereal: (_tier, _rand, hard = HARDEST_POWERS) => (hard.ghostHp ? { ethereal: true, hp: hard.ghostHp } : { ethereal: true }),
  ward: () => ({ aura: 'ward' }),
  dodge: (_tier, _rand, hard = HARDEST_POWERS) => dodgeMods(hard),
  divine: (_tier, _rand, hard = HARDEST_POWERS) => ({ divine: DIVINE.every * hard.recharge }),
  banner: () => ({ banner: true }),
  // con poca dificultad, más margen (tarda más en curarse), y vida de más
  regen: (_tier, _rand, hard = HARDEST_POWERS) => ({ regen: REGEN.margin * hard.regen, hp: REGEN.hp }),
  // con poca dificultad, dos tiempos en vez de tres: el mismo ciclo, abierto la mitad
  phase: (_tier, _rand, hard = HARDEST_POWERS) => phaseMods(hard),
  stealth: (_tier, _rand, hard = HARDEST_POWERS) => stealthMods(hard),
};

/** El intocable: en cuántos tiempos va el ritmo y cuánto está abierto, según la dificultad. El mismo para todos los tamaños. */
function phaseMods(hard: PowerHardness): EnemyMods {
  return { phase: hard.timings, phaseOpen: hard.phaseOpen };
}

/**
 * **Los poderes de escenario**: cada partida sortea tres de estos, uno por escenario. Son los que se
 * defienden de los golpes; los que cambian cómo se mueve el que los lleva van aparte (SUPPORT_POWERS).
 */
export const SCENARIO_POWERS = ['shield', 'armor', 'ethereal', 'divine', 'dodge', 'regen', 'phase', 'stealth'] as const;
export type ScenarioPower = (typeof SCENARIO_POWERS)[number];

/**
 * **Los de apoyo**: curar, volver inmunes, llevar la bandera. La partida sortea dos, uno para el segundo
 * escenario y otro para el tercero, y salen de a pocos. Explotar va con la estampida; cavar, por ahora, no
 * sale. Tirar hechizos era uno más hasta el 11/10: ahora es su propio talento (ver CASTERS).
 */
export const SUPPORT_POWERS = ['heal', 'ward', 'banner'] as const;

/**
 * **Los hechiceros** (11/10, pedido de Leandro): un talento aparte. Se plantan lejos y te tiran hechizos; no
 * van a la puerta, así que **no cuentan para terminar la oleada** (`apart`): se suman a los de siempre (la
 * parte de la oleada que dice la dificultad, al menos uno) y se quedan hasta que los matás, aunque empiece
 * la siguiente. Uno solo se esquiva para siempre; el problema es cuando se juntan. Salen desde la segunda
 * oleada, en cuerpos chicos.
 */
export const CASTERS = { from: 1 };

/** El élite de cada escenario lleva el poder del escenario en su versión más dura. */
export const BOSS_POWERS: Record<ScenarioPower, (tier: number, hard?: PowerHardness) => EnemyMods> = {
  // la calavera: de frente no le entra nada
  shield: () => ({ shield: SHIELD_WALL }),
  // 1 en el primer escenario y 2 después: con 3, el gólem chico pedía diez golpes perfectos. Con 2 solo
  // a media distancia hace falta el perfecto: el driver de lejos y el putter de cerca pegan más (Leandro,
  // 8/10, que lo había bajado a 1 el 7/10)
  armor: (tier) => ({ armor: Math.min(ARMOR_MAX, tier + 1) }),
  ethereal: () => ({ ethereal: true }),
  // el divino se le recarga más rápido
  divine: (_tier, hard = HARDEST_POWERS) => ({ divine: DIVINE.elite * hard.recharge }),
  dodge: (_tier, hard = HARDEST_POWERS) => dodgeMods(hard),
  // menos margen: se lo mata con golpes medios, pero sin errar
  regen: (_tier, hard = HARDEST_POWERS) => ({ regen: REGEN.eliteMargin * hard.regen }),
  // el mismo ritmo que los comunes (11/10): se turna con ellos
  phase: (_tier, hard = HARDEST_POWERS) => phaseMods(hard),
  // el mismo reloj, pero más rato escondido (STEALTH.eliteHidden: lo lee el enemigo por ser élite)
  stealth: (_tier, hard = HARDEST_POWERS) => stealthMods(hard),
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
  /** Después de la estampida: cada chico sin poder puede salir kamikaze (`KAMIKAZE.chance`). Aparte del tercio. */
  kamikaze?: boolean;
  /** La ola especial, si es una (la segunda de un escenario). */
  mod?: WaveMod;
  /** Qué parte sale con poder. Sin esto, POWERED_SHARE. */
  share?: number;
  /** Velocidad de todos (menos el jefe), sobre la de su cuerpo. Sin esto, 1. */
  speed?: number;
  /** Vida de más de los comunes (no el élite ni el jefe), con el golpe 4. */
  extraHp?: number;
  /** Vida de más del jefe, con el golpe 4. */
  bossHp?: number;
  /** Qué tan duros salen los poderes. Sin esto, HARDEST_POWERS. */
  hard?: PowerHardness;
  /** La marca de los gigantes: cuántos de esta oleada salen gigantes. */
  giants?: number;
  /** La marca de «todos con poder»: unos pocos con poderes que no salieron en la partida. Aparte del tercio. */
  foreign?: { keys: PowerKey[]; count: number };
  /** Los hechiceros que se suman, en parte de los de la oleada (ver CASTERS). Aparte de todo. */
  casters?: number;
}

/**
 * **Las olas especiales** (1/10, pedido de Leandro): valen para toda la oleada, sin un enemigo que lo
 * lleve (no hay a quién matar para sacarlo). Con la dificultad (3/10) salen una o dos por partida: la
 * primera es siempre la segunda oleada de la partida, y la otra la segunda del segundo o del tercer
 * escenario. Cada una **deja su marca en el resto de la partida** (ver MARKS). Son situaciones para
 * aprovechar los tiros de otra forma:
 * - **La estampida**: muchos más y más chicos, y casi un tercio explota (`explode`). Premia las áreas y
 *   la fila del driver.
 * - **Los gigantes**: menos enemigos (`count` de los de siempre), todos bien más grandes (`scale`, pero
 *   sin pasar de `maxHeight`, así ninguno llega a los 3 m del élite), con `hp` de vida de más y a
 *   `speed` de su velocidad. Fáciles de pegar, piden más golpes. Es la bandera sin abanderada.
 * - **Todos con poder**: cada uno trae un poder, **de los cinco de escenario**, salieran sorteados en la
 *   partida o no, con `hp` de vida (de menos). Pide leer los íconos y elegir a quién primero.
 */
export const WAVE_MODS = ['stampede', 'giants', 'powered'] as const;
export type WaveMod = (typeof WAVE_MODS)[number];
export const MOD_TITLES: Record<WaveMod, string> = L(
  { stampede: 'La estampida', giants: 'Los gigantes', powered: 'Todos con poder' },
  { stampede: 'The Stampede', giants: 'The Giants', powered: 'All Powered Up' },
);
export const STAMPEDE = { explode: 0.3, interval: 1.3 };
export const GIANTS = { count: 0.6, scale: 1.7, maxHeight: 2.7, hp: 3, speed: 0.85, interval: 1.4 };

/** Cuánto crece este cuerpo en la oleada de los gigantes: `GIANTS.scale`, sin pasar de `GIANTS.maxHeight`. */
export function giantScale(kind: EnemyKind): number {
  return Math.max(1, Math.min(GIANTS.scale, GIANTS.maxHeight / ENEMIES[kind].height));
}
export const POWERED = { hp: -1 };

/**
 * **La marca de cada ola especial** (3/10, pedido de Leandro): lo que deja para todas las oleadas que
 * vienen después, así cada partida tiene su cara.
 * - Estampida: `stampede` chicos de más por oleada (goblins y goblinas), que pueden salir kamikazes.
 *   **Sin estampida no hay kamikazes.**
 * - Gigantes: `giants` gigantes por oleada.
 * - Todos con poder: `foreign` enemigos por oleada con los poderes de escenario que no salieron en la
 *   partida.
 */
export const MARKS = { stampede: 10, giants: 3, foreign: 2 };

/**
 * El kamikaze, fuera de la estampida (pedido de Leandro, 1/10): cada goblin o goblina (1 o 2 de vida) que
 * no trae otra cosa tiene esta chance de explotar, en las oleadas que siguen a la estampida (antes del
 * 3/10, en todas). En la estampida es una parte fija y más grande (`Wave.explode`). Da momentos para
 * aprovechar un tiro: matarlo en el medio del grupo es daño gratis.
 */
export const KAMIKAZE = { chance: 0.1 };

/** Una partida: sus diez oleadas, los tres poderes de escenario, y los de apoyo y las olas especiales que salieron. */
export interface Run {
  waves: Wave[];
  powers: ScenarioPower[];
  supports: PowerKey[];
  specials: WaveMod[];
}

/**
 * Lo que la dificultad cambia en la partida (lo arma core/difficulty.ts con los puntos del jugador).
 */
export interface RunRules {
  /** Los poderes de los escenarios anteriores siguen viniendo. Si no, cada oleada trae solo el de su escenario. */
  stack: boolean;
  /** Olas especiales: 0, 1 (la segunda oleada de la partida) o 2 (y otra en el segundo o el tercer escenario). */
  specials: number;
  /** Apoyos: 0, 1 (uno sorteado, en el último escenario) o 2 (uno en el segundo y otro en el tercero). */
  supports: number;
  hard: PowerHardness;
  /** Velocidad de los enemigos, sobre la de su cuerpo. */
  speed: number;
  /** Qué parte sale con poder. */
  share: number;
  /** Vida de más de cada élite, por escenario. */
  eliteHp: number[];
  /** La oleada del jefe trae los poderes de la partida y los apoyos. Si no, el jefe y enemigos comunes. */
  escort: boolean;
  /** Segundos de descanso entre oleadas. */
  rest: number;
  /** El golpe 4 (ver FOURTH en core/clubs). La vida de más que trae, en `eliteHp`, `extraHp` y `bossHp`. */
  fourth: boolean;
  /** Vida de más de cada enemigo común (no el élite, que la trae en `eliteHp`, ni el jefe). */
  extraHp: number;
  /** Vida de más del jefe. */
  bossHp: number;
  /**
   * De qué poderes de escenario se sortean los de la partida (la demo trae menos: ver src/edition.ts). Sin
   * esto, o con menos de tres (no alcanzan para los tres escenarios), de todos.
   */
  pool?: readonly ScenarioPower[];
  /**
   * Los poderes de los tres escenarios, en orden, sin sortear (para probar: `?poderes=` con las
   * herramientas de prueba). Con menos de tres, se sortean como siempre.
   */
  order?: readonly ScenarioPower[];
  /**
   * La ola especial de cada escenario, sin sortear (para probar: `?especiales=` con las herramientas de
   * prueba): `null`, ninguna; sin nada (`undefined`), la que diga la dificultad.
   */
  specialAt?: readonly (WaveMod | null | undefined)[];
  /** Por cuánto se multiplica la recarga de las habilidades del caballero (el talento «Recarga lenta»). */
  cooldown: number;
  /** Los hechiceros que se suman, en parte de cada oleada (ver CASTERS). 0, ninguno. */
  casters?: number;
}

/** Segundos de descanso entre oleadas. */
export const INTERMISSION = 6;

/**
 * Si matás a todos los que hay (o quedan `below` o menos) mientras la oleada sigue saliendo, el que sigue sale
 * a los `wait` segundos como mucho, en vez de esperar su turno (14/10, Leandro: que no te quedes sin
 * enemigos a los que pegarles). Con `wait` alto (99) queda como antes.
 */
export const SPAWN_RUSH = { wait: 0.5, below: 0 };

/** Todo al máximo: lo que arma `buildRun()` sin reglas. */
export const HARDEST: RunRules = {
  stack: true, specials: 2, supports: 2, hard: HARDEST_POWERS, speed: 1, share: 1 / 3, eliteHp: [0, 1, 2], escort: true, rest: INTERMISSION,
  fourth: false, extraHp: 0, bossHp: 0, cooldown: 1,
};

const TITLES: Record<ScenarioPower, string> = L({
  shield: 'Escudos al frente', armor: 'Acorazados', ethereal: 'Fantasmas', divine: 'Los benditos', dodge: 'Los escurridizos',
  regen: 'Los que se curan', phase: 'Los intocables', stealth: 'Los invisibles',
}, {
  shield: 'Shields Up', armor: 'Armored Up', ethereal: 'Ghosts', divine: 'The Blessed', dodge: 'The Slippery Ones',
  regen: 'The Regenerators', phase: 'The Untouchables', stealth: 'The Unseen',
});
/** El título de la oleada del élite: «Élite: caballero esqueleto blindado». En inglés el poder va adelante. */
const BOSS_TITLES: Record<ScenarioPower, (enemy: string) => string> = L({
  shield: (e: string) => `${e} con la calavera`, armor: (e: string) => `${e} blindado`, ethereal: (e: string) => `${e} fantasma`,
  divine: (e: string) => `${e} bendito`, dodge: (e: string) => `${e} escurridizo`, regen: (e: string) => `${e} que se cura`,
  phase: (e: string) => `${e} intocable`, stealth: (e: string) => `${e} invisible`,
}, {
  shield: (e: string) => `${e} with the skull`, armor: (e: string) => `armored ${e}`, ethereal: (e: string) => `ghost ${e}`,
  divine: (e: string) => `blessed ${e}`, dodge: (e: string) => `slippery ${e}`, regen: (e: string) => `regenerating ${e}`,
  phase: (e: string) => `untouchable ${e}`, stealth: (e: string) => `invisible ${e}`,
});

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
 * grande, poco. **Mata de una**: si entra por la puerta se pierde la partida, y si atropella al golfista
 * lo mata, tengan la vida que tengan (también con las mejoras que la suban). Y trae vida de más sobre la
 * de su cuerpo: `hp[escenario]` en la más difícil (la dificultad le puede sacar, ver `RunRules.eliteHp`).
 *
 * **El doble de golpes** (8/10, Leandro: se veían imponentes pero caían fácil): toda su vida, la del
 * cuerpo, la de más y la de su poder, va por `hpScale`. Con el poder que sea, los golpes que pide crecen
 * igual (el fantasma recibe 1 por golpe, al blindado le entra el golpe menos el blindaje, el bendito
 * pide romper y pegar). En la dificultad 0 el del primer escenario tiene 10 (eran 5). Y camina a `speed`
 * de su cuerpo: tarda el doble en caer, así que está más rato en el campo (sale antes, para llegar en su
 * lugar de la oleada).
 */
/**
 * `hp`: la vida de más de cada élite (por escenario), antes de ir al doble (`hpScale`). **Fija desde el
 * 12/10** (Leandro: «sacarla de las dificultades, así son menos variables»): la de los que no tenían
 * «Élites más duros» (eran 2, 3 y 4, y sin el punto 2 menos). Se toca en el panel B.
 */
export const ELITE = { height: 3.0, minScale: 1.25, at: 0.85, damage: Number.POSITIVE_INFINITY, hp: [0, 1, 2], hpScale: 2, speed: 0.85 };

/** El élite del escenario `scenario` con el poder `power`: cierra la última oleada del escenario. */
export function elite(scenario: number, power: ScenarioPower, hp = ELITE.hp[scenario], hard = HARDEST_POWERS): WaveGroup {
  const mods: EnemyMods = BOSS_POWERS[power](scenario, hard);
  let kind: EnemyKind = 'skeleton';
  for (let i = LADDER.indexOf(HEAVY[scenario]); i >= 0; i--) {
    if (canTake(LADDER[i], mods)) {
      kind = LADDER[i];
      break;
    }
  }
  const size = Math.max(ELITE.minScale, ELITE.height / ENEMIES[kind].height);
  const body = ENEMIES[kind].hp;
  const total = Math.round((body + (mods.hp ?? 0) + hp) * ELITE.hpScale);
  return { kind, count: 1, at: ELITE.at, mods: { ...mods, size, speed: (mods.speed ?? 1) * ELITE.speed, hp: total - body } };
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
 *
 * El resto lo dice la dificultad (`rules`, ver RunRules):
 * - si los poderes se acumulan: en el segundo escenario siguen viniendo algunos con el del primero;
 * - las olas especiales (WAVE_MODS): la primera es la segunda oleada de la partida, la otra la segunda
 *   del segundo o el tercer escenario, y cada una deja su marca en las que siguen (MARKS);
 * - los apoyos: uno sorteado en el último escenario, o uno en el segundo y otro en el tercero, de a pocos;
 * - la escolta del jefe, la velocidad, cuántos salen con poder, qué tan duros y la vida de los élites.
 */
export function buildRun(rand: () => number = Math.random, rules: RunRules = HARDEST): Run {
  const pool = rules.pool && rules.pool.length >= 3 ? rules.pool : SCENARIO_POWERS;
  const powers = rules.order && rules.order.length >= 3 ? rules.order.slice(0, 3) : draw(pool, 3, rand);
  const drawnSupports = draw(SUPPORT_POWERS, 2, rand);
  const drawnMods = draw(WAVE_MODS, 3, rand);
  // dónde va cada ola especial: la primera en el primer escenario, la segunda en el segundo o el tercero
  const later = 1 + Math.floor(rand() * 2);
  const specialAt: (WaveMod | undefined)[] = [undefined, undefined, undefined];
  if (rules.specials >= 1) specialAt[0] = drawnMods[0];
  if (rules.specials >= 2) specialAt[later] = drawnMods[1];
  // para probar: la que se eligió en cada escenario, o ninguna (ver RunRules.specialAt)
  rules.specialAt?.slice(0, 3).forEach((m, s) => { if (m !== undefined) specialAt[s] = m ?? undefined; });
  // el apoyo de cada escenario: con uno, en el último; con dos, uno en el segundo y otro en el tercero
  const supportAt: (PowerKey | undefined)[] = [undefined, undefined, undefined];
  if (rules.supports >= 2) [supportAt[1], supportAt[2]] = drawnSupports;
  else if (rules.supports >= 1) supportAt[2] = drawnSupports[0];
  const supports = supportAt.filter((k): k is PowerKey => !!k);
  const help = (s: number, count: number) => (supportAt[s] && count > 0 ? { supports: [{ key: supportAt[s]!, count }] } : {});

  const at = (scenario: number, i: number) => ({ scenario, focus: powers[scenario], debut: i === 0, old: rules.stack ? powers.slice(0, scenario) : [] });
  const boss = (scenario: number) => elite(scenario, powers[scenario], rules.eliteHp[scenario] ?? 0, rules.hard);
  const bossTitle = (scenario: number) => `${L('Élite', 'Elite')}: ${BOSS_TITLES[powers[scenario]](ENEMIES[boss(scenario).kind].name.toLowerCase())}`;
  // el cuerpo fuerte del escenario: 1, 3 y 2, siempre sin poder; de ese cuerpo, el único con poder es el
  // élite, que en la última es el tercero (13/10: con tres más el élite, la oleada del élite pedía un tercio
  // más que la anterior; ver docs/presupuesto.md)
  const heavy = (scenario: number, count: number): WaveGroup => ({ kind: HEAVY[scenario], count, plain: true });
  // la segunda de cada escenario: los cuerpos de siempre de ese escenario, o la ola especial que le tocó
  const usual: { interval: number; counts: [number, number, number, number]; more: [EnemyKind, number][] }[] = [
    { interval: 2.05, counts: [6, 5, 3, 2], more: [] },
    { interval: 1.9, counts: [6, 5, 3, 2], more: [['warchief', 2]] },
    { interval: 1.9, counts: [5, 4, 3, 2], more: [['warchief', 1], ['shaman', 1], ['knight', 1], ['wraith', 2]] },
  ];
  const second = (s: number): Wave => {
    const mod = specialAt[s];
    const { interval, counts, more } = usual[s];
    if (!mod) return { title: TITLES[powers[s]], ...at(s, 1), ...help(s, s), interval, groups: [...bodies(...counts, more), heavy(s, 3)] };
    // el apoyo del escenario viene también acá, salvo en la estampida, que ya es mucho
    const base = { title: MOD_TITLES[mod], mod, ...at(s, 1), ...(mod !== 'stampede' ? help(s, s) : {}) };
    if (mod === 'stampede') {
      // muchos y chicos; el alma en pena del tercer escenario viene igual
      const wraiths = more.filter(([k]) => k === 'wraith');
      return { ...base, interval: STAMPEDE.interval, groups: [...bodies(13, 8, 2, 0, wraiths), heavy(s, 3)], explode: STAMPEDE.explode };
    }
    if (mod === 'giants') {
      const few = (n: number) => (n > 0 ? Math.max(1, Math.round(n * GIANTS.count)) : 0);
      const [g, ga, o, sk] = counts.map(few);
      return { ...base, interval: interval * GIANTS.interval, groups: [...bodies(g, ga, o, sk, more.map(([k, n]): [EnemyKind, number] => [k, few(n)])), heavy(s, 3)] };
    }
    return { ...base, interval, groups: [...bodies(...counts, more), heavy(s, 3)] };
  };
  const waves: Wave[] = [
    // primer escenario: los cuerpos de 1 a 4, el jefe goblin desde el arranque, y el poder solo
    { title: TITLES[powers[0]], interval: 2.1, groups: [...bodies(8, 5, 2, 2), heavy(0, 1)], ...at(0, 0) },
    second(0),
    { title: bossTitle(0), interval: 2.0, groups: [...bodies(6, 5, 3, 2), heavy(0, 2), boss(0)], ...at(0, 2) },
    // segundo escenario: el caballero desde el arranque, el chamán, y el primer apoyo
    { title: TITLES[powers[1]], interval: 1.85, groups: [...bodies(6, 5, 3, 2, [['warchief', 2]]), heavy(1, 1)], ...at(1, 0), ...help(1, 1) },
    second(1),
    { title: bossTitle(1), interval: 2.1, groups: [...bodies(5, 4, 2, 2, [['warchief', 2], ['shaman', 1]]), heavy(1, 2), boss(1)], ...at(1, 2), ...help(1, 2) },
    // tercer escenario: el gólem chico desde el arranque, el alma en pena, y el segundo apoyo
    { title: TITLES[powers[2]], interval: 1.75, groups: [...bodies(6, 5, 3, 3, [['warchief', 1], ['shaman', 1], ['knight', 1], ['wraith', 1]]), heavy(2, 1)], ...at(2, 0), ...help(2, 1) },
    second(2),
    { title: bossTitle(2), interval: 1.9, groups: [...bodies(5, 4, 2, 2, [['warchief', 1], ['shaman', 1], ['knight', 1]]), heavy(2, 2), boss(2)], ...at(2, 2), ...help(2, 2) },
    // el jefe solo ya tiene 80 de vida: la escolta es más chica. Con escolta trae los poderes de la
    // partida y los apoyos; sin escolta, son enemigos comunes
    {
      title: L('El Gólem de roca', 'The Rock Golem'), interval: 1.75, scenario: 3, old: rules.escort ? [...powers] : [],
      groups: bodies(6, 4, 3, 2, [['golem', 1], ['warchief', 1], ['shaman', 1], ['knight', 1], ['wraith', 1]]),
      ...(rules.escort && supports.length ? { supports: supports.map((key) => ({ key, count: 1 })) } : {}),
    },
  ];
  const specials: WaveMod[] = [];
  const unused = pool.filter((p) => !powers.includes(p));
  for (const [i, w] of waves.entries()) {
    w.share = rules.share;
    w.speed = rules.speed;
    if (rules.casters && i >= CASTERS.from) w.casters = rules.casters;
    w.hard = rules.hard;
    if (rules.extraHp) w.extraHp = rules.extraHp;
    if (rules.bossHp) w.bossHp = rules.bossHp;
    // las marcas de las olas especiales que ya pasaron
    if (specials.includes('stampede')) {
      w.groups.unshift({ kind: 'goblin', count: Math.ceil(MARKS.stampede * 0.6), mark: true }, { kind: 'goblina', count: Math.floor(MARKS.stampede * 0.4), mark: true });
      w.kamikaze = true;
    }
    if (specials.includes('giants')) w.giants = MARKS.giants;
    if (specials.includes('powered') && unused.length) w.foreign = { keys: unused, count: MARKS.foreign };
    if (w.mod) specials.push(w.mod);
  }
  return { waves, powers, supports, specials };
}

/**
 * Metros que camina un enemigo desde que aparece hasta la zona de los puestos. Con esto se calcula
 * cuánto tarda cada tipo en llegar (ver `spawnOrder`).
 */
export const TRAVEL = 58;

/** Los que caminan más lento que esto son pesados: nunca salen antes que el primer liviano de la oleada. */
export const HEAVY_SPEED = 2;

/**
 * Los pesados, escalonados (13/10, en prueba; con 0, como antes): cada uno llega al menos `turns` intervalos
 * después del pesado anterior. En la 9 los gordos salían todos con los primeros goblins y llegaban juntos
 * (Leandro: «vinieron un montón de enemigos gordos a la vez»); con 2, llegan uno cada 4 s y la oleada
 * termina igual.
 */
export const HEAVY_GAP = { turns: 0 };

/** Segundos que tarda en llegar a los puestos un enemigo de este tipo. */
export function travelTime(kind: EnemyKind): number {
  return TRAVEL / ENEMIES[kind].speed;
}

/**
 * Lo que tarda en llegar cada uno; el jefe cuenta como si caminara al paso promedio de los demás. El
 * élite camina más lento que su cuerpo (`ELITE.speed`): sale antes, para llegar en su lugar.
 */
function lags(spawns: Spawn[]): number[] {
  const time = (s: Spawn) => travelTime(s.kind) / (s.mods?.size ? ELITE.speed : 1);
  const walkers = spawns.filter((s) => !ENEMIES[s.kind].boss);
  const average = walkers.reduce((n, s) => n + time(s), 0) / Math.max(1, walkers.length);
  return spawns.map((s) => (ENEMIES[s.kind].boss ? average : time(s)));
}

/** Cuándo llega cada uno de `order` a los puestos, en segundos desde que sale el primero. */
export function arrivals(order: Spawn[], interval: number): number[] {
  const lag = lags(order);
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
 * - primero los kamikazes, entre los chicos: en la estampida una parte fija, en las demás cada uno con
 *   su chance (`KAMIKAZE`);
 * - con la marca de «todos con poder», unos pocos con los poderes que no salieron en la partida;
 * - un tercio del resto (o lo que diga `wave.share`) sale con poder: los de apoyo que traiga la oleada, y
 *   de los demás, la mitad con el del escenario (el primero que aparece lo presenta, si es la primera del
 *   escenario) y la otra mitad con los de escenarios anteriores, si se acumulan.
 * Los poderes caen en cualquier cuerpo que pueda tenerlos (ver `canTake` y sus topes). Al final, la marca
 * de los gigantes agranda a unos cuantos, y todos (menos el jefe) van a la velocidad de la dificultad.
 */
export function spawnOrder(wave: Wave, rand: () => number = Math.random): Spawn[] {
  // (en la de gigantes, el fantasma y el bendito pueden quedar de su tamaño: ver POWER_BIAS.giants)
  const keepsSize = (s: Spawn) => !POWER_BIAS.giants && wave.mod === 'giants' && !!(s.mods?.ethereal || s.mods?.divine);
  const slots: { spawn: Spawn; at: number; mark: boolean }[] = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) {
      const at = g.at ?? (g.count <= 2 ? 0.4 + 0.2 * i : (i + 0.5) / g.count);
      slots.push({ spawn: g.mods ? { kind: g.kind, mods: g.mods } : g.plain ? { kind: g.kind, plain: true } : { kind: g.kind }, at, mark: !!g.mark });
    }
  }
  slots.sort((a, b) => a.at - b.at);

  // el presupuesto (ver core/budget): lo que pide cada uno, con la vida que va a tener de verdad (la de sus
  // poderes, el golpe 4, la de la oleada de gigantes o la de todos con poder, y el blindaje)
  const budget = !!BUDGET.on;
  const hpWith = (s: Spawn, mods: EnemyMods | undefined): number => {
    let hp = ENEMIES[s.kind].hp + (mods?.hp ?? 0);
    if (!mods?.size && !ENEMIES[s.kind].boss) {
      hp += wave.extraHp ?? 0;
      if (wave.mod === 'giants' && !(mods && keepsSize({ kind: s.kind, mods }))) hp += GIANTS.hp;
      if (wave.mod === 'powered') hp += POWERED.hp;
    }
    if (mods?.armor && !ENEMIES[s.kind].boss) hp = Math.ceil(hp * ARMOR_HP[Math.min(mods.armor, ARMOR_HP.length - 1)]);
    return Math.max(1, hp);
  };
  const cost = (s: Spawn, mods = s.mods): number => shotsFor(s.kind, mods, hpWith(s, mods));
  // sin poder: el cuerpo con la vida que traiga (la del élite también), sin lo que le hace el poder
  const plain = (s: Spawn): number => cost(s, s.mods ? { hp: s.mods.hp, size: s.mods.size } : undefined);
  // lo que piden los cuerpos de la oleada, sin poderes ni marcas (el jefe del final, aparte)
  const base = slots.filter((s) => !s.mark && !ENEMIES[s.spawn.kind].boss).reduce((n, s) => n + plain(s.spawn), 0);
  // la marca de la estampida: los chicos que entren en lo suyo (`BUDGET.marks`), repartidos parejo
  if (budget) {
    const marked = slots.filter((s) => s.mark);
    const each = marked.length ? marked.reduce((n, s) => n + plain(s.spawn), 0) / marked.length : 0;
    const fit = each > 0 ? Math.min(marked.length, Math.floor((base * BUDGET.marks) / each)) : 0;
    const keep = new Set(Array.from({ length: fit }, (_, i) => marked[Math.floor(((i + 0.5) * marked.length) / fit)]));
    for (let i = slots.length - 1; i >= 0; i--) if (slots[i].mark && !keep.has(slots[i])) slots.splice(i, 1);
  }
  // el turno `k` llega en k·intervalo + lo que tarda: sale justo cuando tiene que salir para llegar a
  // tiempo. Cada uno lleva la espera desde el anterior, así llegan con el ritmo de la oleada. Los que suma
  // una marca no tienen turno: llegan en su punto de lo que dura la oleada sin ellos (ver WaveGroup.mark)
  const span = Math.max(0, slots.filter((s) => !s.mark).length - 1) * wave.interval;
  let turn = 0;
  const timed = slots.map((s) => ({ spawn: s.spawn, due: s.mark ? s.at * span : turn++ * wave.interval })).sort((a, b) => a.due - b.due);
  const arriving = timed.map((s) => s.spawn);
  const lag = lags(arriving);
  const want = arriving.map((_, k) => timed[k].due - lag[k]);
  // pero ningún pesado sale antes que el primer liviano: el caballero que tiene su turno al principio
  // salía veinte segundos antes que todos, y se lo mataba tranquilo antes de que apareciera el resto.
  // Sale con el primero y llega un poco más tarde, en el medio del montón
  const lightStart = Math.min(...arriving.map((s, k) => (ENEMIES[s.kind].speed >= HEAVY_SPEED ? want[k] : Infinity)));
  let lastHeavy = -Infinity;
  const leave = arriving
    .map((spawn, k) => {
      if (!Number.isFinite(lightStart) || ENEMIES[spawn.kind].speed >= HEAVY_SPEED) return { spawn, t: want[k] };
      if (!HEAVY_GAP.turns) return { spawn, t: Math.max(want[k], lightStart) };
      // escalonados (ver HEAVY_GAP): llega cuando le toca, pero no antes de que pueda ni pegado al anterior
      const arrive = Math.max(want[k] + lag[k], lightStart + lag[k], lastHeavy + HEAVY_GAP.turns * wave.interval);
      lastHeavy = arrive;
      return { spawn, t: arrive - lag[k] };
    })
    .sort((a, b) => a.t - b.t);
  leave.forEach((l, i) => { if (i) l.spawn.delay = l.t - leave[i - 1].t; });
  const order = leave.map((s) => s.spawn);

  // lo que va "primero" o "al final" se mide por cuándo llegan (`arriving`), no por cuándo salen
  const open = () => arriving.filter((s) => !s.mods && !s.plain && !ENEMIES[s.kind].boss);
  const power = (key: PowerKey) => POWERS[key](wave.scenario, rand, wave.hard);
  // lo que pueden sumar los poderes de la oleada (ver BUDGET.powers). El élite paga de su oleada: de lo de
  // los poderes, a lo sumo la mitad (los comunes siempre traen algo del poder del escenario); lo que se
  // pase, en cuerpos: salen menos comunes (13/10, Leandro: «si es fantasma, viene un poco menos del resto»)
  const allowance = base * (wave.share ?? POWERED_SHARE) * BUDGET.powers;
  const eliteExtra = arriving.filter((s) => s.mods?.size).reduce((n, s) => n + cost(s) - plain(s), 0);
  let left = allowance - Math.min(eliteExtra, allowance / 2);
  let owed = budget ? eliteExtra - allowance / 2 : 0;
  // de a uno y salteados: dos seguidos dejaban un hueco largo en la oleada
  const lineup = [...arriving];
  const gone = new Set<Spawn>();
  while (owed > 0) {
    const spare = arriving.filter((s) => {
      const k = lineup.indexOf(s);
      return !s.mods && !s.plain && !ENEMIES[s.kind].boss && s !== order[0] && !gone.has(lineup[k - 1]) && !gone.has(lineup[k + 1]);
    });
    if (spare.length <= 1) break;
    const out = spare[Math.floor(rand() * spare.length)];
    gone.add(out);
    owed -= plain(out);
    // sale de la oleada sin correr a los de después: el que le sigue espera lo que esperaba él
    const i = order.indexOf(out);
    const next = order[i + 1];
    if (next && i > 0) next.delay = (next.delay ?? 0) + (out.delay ?? 0);
    order.splice(i, 1);
    arriving.splice(arriving.indexOf(out), 1);
  }
  // lo de la marca de los poderes que no salieron, aparte (ver BUDGET.marks)
  let foreignLeft = base * BUDGET.marks;
  /**
   * Le da el poder `mods` a uno de los que quedan sin poder. Con el presupuesto, a uno que no se pase del
   * tope (`BUDGET.cap`) y cuyo poder entre en lo que queda (`pay`: de dónde sale; el que presenta el poder,
   * siempre, y en la de todos con poder, solo el tope).
   */
  const give = (mods: EnemyMods, first: boolean, pay: 'powers' | 'foreign' | 'none' = 'powers'): boolean => {
    let free = open().filter((s) => canTake(s.kind, mods));
    if (budget) {
      const room = pay === 'powers' ? left : pay === 'foreign' ? foreignLeft : Infinity;
      free = free.filter((s) => cost(s, mods) <= BUDGET.cap && (first || cost(s, mods) - plain(s) <= room));
    }
    if (!free.length) return false;
    // menos de los que tocaban (ver POWER_COUNT): este queda sin poder, pero cuenta como dado
    const keep = first ? 1 : SCENARIO_POWERS.reduce((m, p) => (mods[p] ? m * POWER_COUNT[p] : m), 1);
    if (keep < 1 && rand() >= keep) return true;
    const pick = first ? free[0] : pickBody(free, mods, rand);
    if (budget) {
      const extra = cost(pick, mods) - plain(pick);
      if (pay === 'powers') left -= extra;
      else if (pay === 'foreign') foreignLeft -= extra;
    }
    pick.mods = mods;
    return true;
  };
  // la estampida: explotan los más chicos. En las demás, cada chico tiene su chance
  // (el alma en pena también tiene 2 de vida, pero no puede explotar)
  const small = open().filter((s) => ENEMIES[s.kind].hp <= 2 && canTake(s.kind, { explode: true }));
  if (wave.explode) {
    for (let n = Math.round(order.length * wave.explode); n > 0 && small.length; n--) {
      small.splice(Math.floor(rand() * small.length), 1)[0].mods = { explode: true };
    }
  } else if (wave.kamikaze) {
    for (const s of small) if (rand() < KAMIKAZE.chance) s.mods = { explode: true };
  }
  // el que presenta el poder del escenario va primero, así ningún otro poder le gana de mano
  const presented = !!wave.debut && !!wave.focus && wave.mod !== 'powered' && give(power(wave.focus!), true);
  // la marca de «todos con poder»: estos van aparte del tercio
  const foreign = wave.foreign;
  if (foreign) for (let i = 0; i < foreign.count; i++) give(power(foreign.keys[Math.floor(rand() * foreign.keys.length)]), false, 'foreign');
  if (wave.mod === 'powered') {
    // todos con poder: los apoyos que traiga, y a cada uno de los demás uno de los cinco de escenario,
    // haya salido sorteado en la partida o no
    for (const s of wave.supports ?? []) for (let i = 0; i < s.count; i++) give(power(s.key), false, 'none');
    for (let tries = 0; open().length && tries < 500; tries++) give(power(SCENARIO_POWERS[Math.floor(rand() * SCENARIO_POWERS.length)]), false, 'none');
  } else {
    const total = Math.round((open().length + (presented ? 1 : 0)) * (wave.share ?? POWERED_SHARE));
    const supports = Math.min(total, (wave.supports ?? []).reduce((n, s) => n + s.count, 0));
    const old = wave.old ?? [];
    let focus = wave.focus ? (old.length ? Math.ceil((total - supports) * FOCUS_SHARE) : total - supports) : 0;
    let rest = total - supports - focus;
    if (presented) focus--;
    let left = supports;
    for (const s of wave.supports ?? []) for (let i = 0; i < s.count && left > 0; i++, left--) give(power(s.key), false);
    for (; focus > 0; focus--) give(power(wave.focus!), false);
    for (; rest > 0 && old.length; rest--) give(power(old[Math.floor(rand() * old.length)]), false);
  }
  // los hechiceros del talento: se suman, en cuerpos chicos de la oleada, repartidos (nunca primeros)
  if (wave.casters) {
    const bodies = [...new Set(arriving.filter((s) => !ENEMIES[s.kind].boss && ENEMIES[s.kind].hp <= 3 && canTake(s.kind, { ranged: true })).map((s) => s.kind))];
    const count = bodies.length ? Math.max(1, Math.round(order.length * wave.casters)) : 0;
    for (let n = 0; n < count; n++) {
      const at = 1 + Math.floor(rand() * Math.max(1, order.length - 1));
      // en el medio del hueco entre dos, sin correr a los de después
      const next = order[at];
      const delay = (next?.delay ?? wave.interval) / 2;
      if (next) next.delay = delay;
      order.splice(at, 0, { kind: bodies[Math.floor(rand() * bodies.length)], mods: { ranged: true, apart: true }, delay });
    }
  }
  // los escudos sorteados van de menor a mayor a lo largo de la oleada: el más duro, al final
  const shielded = arriving.filter((s) => s.mods?.shield && s.mods.shield < SHIELD_WALL && !wave.groups.some((g) => g.mods === s.mods));
  const levels = shielded.map((s) => s.mods!.shield!).sort((a, b) => a - b);
  shielded.forEach((s, i) => { s.mods = { ...s.mods, shield: levels[i] }; });
  // la marca de los gigantes: unos cuantos al azar, ni el jefe ni el élite. Con el presupuesto, los que
  // entren en lo suyo (`BUDGET.marks`), y uno con poder solo si agrandado no se pasa del tope
  const growable = order.filter((s) => !ENEMIES[s.kind].boss && !s.mods?.size && !s.mods?.giant && (POWER_BIAS.giants || !(s.mods?.ethereal || s.mods?.divine)));
  let giantsLeft = base * BUDGET.marks;
  const grown = (s: Spawn): EnemyMods => ({ ...s.mods, giant: giantScale(s.kind), speed: GIANTS.speed, hp: (s.mods?.hp ?? 0) + GIANTS.hp });
  for (let n = wave.giants ?? 0; n > 0 && growable.length; n--) {
    const fits = budget ? growable.filter((s) => cost(s, grown(s)) - cost(s) <= giantsLeft && (!hasPower(s.mods) || cost(s, grown(s)) <= BUDGET.cap)) : growable;
    if (!fits.length) break;
    const s = fits[Math.floor(rand() * fits.length)];
    growable.splice(growable.indexOf(s), 1);
    if (budget) giantsLeft -= cost(s, grown(s)) - cost(s);
    s.mods = grown(s);
  }
  // lo que el modificador le cambia a todos (menos al jefe): no es un poder, va encima del que tengan
  const extra = (kind: EnemyKind): EnemyMods | null =>
    wave.mod === 'giants' ? { giant: giantScale(kind), hp: GIANTS.hp, speed: GIANTS.speed } : wave.mod === 'powered' ? { hp: POWERED.hp } : null;
  for (const s of order) {
    const add = extra(s.kind);
    if (add && !ENEMIES[s.kind].boss && !keepsSize(s)) s.mods = { ...s.mods, ...add, hp: (s.mods?.hp ?? 0) + (add.hp ?? 0) };
  }
  // la velocidad de la dificultad, encima de la que traigan
  if (wave.speed !== undefined && wave.speed !== 1) {
    for (const s of order) if (!ENEMIES[s.kind].boss) s.mods = { ...s.mods, speed: (s.mods?.speed ?? 1) * wave.speed };
  }
  // la vida de más del golpe 4: a los comunes y al jefe (el élite, el que tiene tamaño, ya la trae)
  if (wave.extraHp || wave.bossHp) {
    for (const s of order) {
      const add = ENEMIES[s.kind].boss ? wave.bossHp ?? 0 : s.mods?.size ? 0 : wave.extraHp ?? 0;
      if (add) s.mods = { ...s.mods, hp: (s.mods?.hp ?? 0) + add };
    }
  }
  // el blindado, con menos vida (ver ARMOR_HP): toda la que tenga, después de lo que le sumaron
  for (const s of order) {
    const armor = s.mods?.armor;
    if (!armor || ENEMIES[s.kind].boss) continue;
    const share = ARMOR_HP[Math.min(armor, ARMOR_HP.length - 1)];
    if (share >= 1) continue;
    const base = ENEMIES[s.kind].hp;
    s.mods = { ...s.mods, hp: Math.max(1, Math.ceil((base + (s.mods?.hp ?? 0)) * share)) - base };
  }
  // la velocidad de cada poder (ver POWER_SPEED)
  for (const s of order) {
    const mods = s.mods;
    if (!mods || ENEMIES[s.kind].boss) continue;
    const pace = SCENARIO_POWERS.reduce((m, p) => (mods[p] ? m * POWER_SPEED[p] : m), 1);
    if (pace !== 1) s.mods = { ...mods, speed: (mods.speed ?? 1) * pace };
  }
  return order;
}

/** ¿Trae algún poder? (Lo que agrega el modificador de la oleada, el tamaño, la vida y la velocidad, no cuenta.) */
export function hasPower(mods: EnemyMods | undefined): boolean {
  if (!mods) return false;
  return Object.keys(mods).some((k) => k !== 'giant' && k !== 'hp' && k !== 'size' && k !== 'speed');
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

  constructor(private waves: Wave[] = buildRun().waves, private rest = INTERMISSION) {}

  /** Cambia la partida antes de que empiece (se eligió otra dificultad en la pantalla de inicio). */
  load(waves: Wave[], rest = INTERMISSION): void {
    this.waves = waves;
    this.rest = rest;
  }

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
      // la cancha vacía: el que sigue no espera su turno (SPAWN_RUSH)
      if (alive <= SPAWN_RUSH.below) this.timer = Math.min(this.timer, SPAWN_RUSH.wait);
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
