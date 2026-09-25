// Los palos.
//
// **El palo es la entrega, y ahora es todo el tiro**: decide cómo llega la pelota (rasante y
// atravesando, en arco bajo que cae y rueda, en globo alto que se queda donde cae, o rodando) y cuánto
// daño hace según a qué distancia pega. Los palos ya no llevan poder: lo que antes era combinar un palo
// con escarcha o vendaval ahora son habilidades aparte, con su propia pelota (ver `core/abilities`).
//
// Las otras dos cosas siguen separadas:
// - **El mouse dice dónde cae**, para todos los palos.
// - **La barra dice solo qué tan bien le pegaste**: tres niveles de calidad, puro timing.

export type ClubId = 'driver' | 'iron' | 'wedge' | 'putter';

export interface Club {
  id: ClubId;
  name: string;
  /** Cómo vuela, para el HUD. */
  title: string;
  hint: string;
  /** Ángulo de salida en grados. 0 = rueda por el piso. */
  loftDeg: number;
  /**
   * Distancia mínima: **0 en los cuatro**, y es a propósito. Un mínimo parecía razonable (nadie pega un
   * drive de dos metros) pero en el juego se traducía en que, con los enemigos encima, de golpe no
   * podías pegarles por estar demasiado cerca. Justo el momento en que más falta hace. Si querés
   * reventar el wedge abajo tuyo, podés.
   */
  minRange: number;
  maxRange: number;
  /**
   * Segundos que tarda el medidor en ir de 0 a 100 %. **Es el mismo para los cuatro palos** (ver
   * CHARGE_TIME): la barra mide timing, y si cada palo tuviera su ritmo, elegir palo cambiaría también
   * la dificultad de clavar el golpe, que es otra cosa.
   */
  chargeTime: number;
  /**
   * Radio del área que abre, en metros, **uno por nivel de golpe**. Todo en cero = no abre área (el
   * driver y el putter). Cuanto más alto vuela el palo, más grande.
   */
  spread: number[];
  /**
   * La pelota le pega a cada uno que atraviesa en el aire, y sigue. Sin esto, el primero que toca es
   * donde termina el tiro.
   */
  pierces: boolean;
  /**
   * Abre su área al tocar el piso, sin necesidad de pegarle a nadie (el wedge, que es un globo que cae
   * donde se apunta). Sin esto, el área solo sale si la pelota conecta con un enemigo.
   */
  burstsOnGround: boolean;
  /** Al abrir su área, la pelota muere. Sin esto sigue rodando. */
  stopsOnLand: boolean;
  /**
   * Daño por banda de distancia (corta, media, larga) y nivel de calidad (1, 2, 3). Es lo que hace la
   * pelota **al pegarle a alguien**. En los palos que no atraviesan (wedge y putter) el único daño que
   * hacen es el del área, así que esta tabla *es* la del área.
   */
  damage: number[][];
  /**
   * Daño del **área**, para el palo que hace las dos cosas (el hierro). Pega menos que el impacto: el
   * área agarra a varios y no hay que apuntarle a nadie. Sin esto, el área usa la tabla de arriba.
   */
  areaDamage?: number[][];
  /** Impulso que recibe el enemigo golpeado, en m/s. */
  knockback: number;
  restitution: number;
  bounceKeep: number;
  /** Enemigos que puede golpear una misma pelota. */
  maxHits: number;
  /** Gravedad propia del vuelo. Más gravedad = mismo globo, pero llega mucho antes. */
  gravity?: number;
  /**
   * Cuánto lo frena el pasto al rodar, **uno por nivel de golpe**. La velocidad de salida se calcula
   * para que la pelota pare justo en el punto pedido, así que **más fricción = sale más fuerte y llega
   * antes**: por eso cargar más sube este número. Vacío = la fricción normal del pasto.
   */
  rollFriction?: number[];
  /**
   * Distancia fija, en metros: el mouse decide **solo la dirección** y el tiro siempre llega igual de
   * lejos. 0 = la distancia la da el cursor, como siempre. Nació del putter: apuntando cerca del
   * enemigo la pelota frenaba antes de llegar, así que había que apuntar más atrás que el blanco.
   */
  fixedRange: number;
  color: number;
}

/**
 * Cuánto pega cada palo. La gracia es que **cada palo tiene su distancia preferida**: el driver cobra
 * de lejos, el putter de cerca, y el hierro y el wedge pegan parejo a cualquier distancia. Así elegir
 * palo es elegir a qué distancia querés pelear, y no hay un palo que sea el mejor siempre.
 */
export const BAND_LIMITS = [20, 40];
export const BAND_NAMES = ['corta', 'media', 'larga'];
export function bandOf(meters: number): number {
  return meters <= BAND_LIMITS[0] ? 0 : meters <= BAND_LIMITS[1] ? 1 : 2;
}

/**
 * Lo que tarda la barra en llegar arriba, igual para los cuatro palos. La barra mide **timing**: si
 * cada palo tuviera su ritmo, elegir palo sería también elegir qué tan difícil es clavar el golpe.
 */
export const CHARGE_TIME = 0.85;

/**
 * **Los cuatro palos comparten color.** Antes cada uno tenía el suyo y el del hierro era celeste, el
 * mismo del hielo: parecía que el palo traía el poder, cuando son cosas independientes. Los colores
 * son de las habilidades; los palos se distinguen por su ícono y su tecla.
 */
export const CLUB_COLOR = 0xe6e2d3;

export const CLUBS: Record<ClubId, Club> = {
  driver: {
    id: 'driver', name: 'Driver', title: 'Rasante', hint: 'Sale casi al ras y atraviesa la fila entera. Cobra de lejos y poco de cerca',
    loftDeg: 3.5, minRange: 0, maxRange: 66, chargeTime: CHARGE_TIME, spread: [0, 0, 0],
    pierces: true, burstsOnGround: false, stopsOnLand: false,
    damage: [[1, 2, 3], [1, 3, 5], [2, 4, 8]],
    knockback: 5, restitution: 0.3, bounceKeep: 0.8, maxHits: 99, fixedRange: 55, color: CLUB_COLOR,
  },
  iron: {
    id: 'iron', name: 'Hierro 7', title: 'Arco bajo', hint: 'Arco que pasa por arriba de las lomas y revienta en el que toca, salpicando a los de al lado',
    loftDeg: 27, minRange: 0, maxRange: 55, chargeTime: CHARGE_TIME, spread: [1.8, 2.2, 2.7],
    // modo por defecto: no atraviesa, y el área sale solo si le pega a alguien (ver IRON_MODES)
    pierces: false, burstsOnGround: false, stopsOnLand: true,
    damage: [[1, 3, 7], [1, 3, 7], [1, 3, 7]],
    areaDamage: [[1, 2, 4], [1, 2, 4], [1, 2, 4]],
    knockback: 4, restitution: 0.28, bounceKeep: 0.72, maxHits: 3, rollFriction: [6, 6, 6], fixedRange: 0, color: CLUB_COLOR,
  },
  wedge: {
    id: 'wedge', name: 'Wedge', title: 'Globo', hint: 'Globo alto: tarda en llegar, cae en picada donde apuntás y abre un área grande, le pegue a alguien o no. Al del escudo hay que caerle detrás, o silenciarlo antes',
    loftDeg: 55, minRange: 0, maxRange: 55, chargeTime: CHARGE_TIME, spread: [4.2, 5, 6.3],
    pierces: false, burstsOnGround: true, stopsOnLand: true,
    // todo su daño es de área, y es la más grande de todas: por eso pega bastante menos que un impacto
    damage: [[1, 2, 5], [1, 2, 5], [1, 2, 5]],
    knockback: 0, restitution: 0, bounceKeep: 0, maxHits: 1, fixedRange: 0, color: CLUB_COLOR,
  },
  putter: {
    id: 'putter', name: 'Putter', title: 'Rodado', hint: 'Rueda hasta 20 m y le pega al primero que toca, a él solo. Cobra de cerca como ninguno',
    loftDeg: 0, minRange: 0, maxRange: 20, chargeTime: CHARGE_TIME, spread: [0, 0, 0],
    pierces: false, burstsOnGround: false, stopsOnLand: true,
    damage: [[2, 4, 8], [1, 3, 5], [1, 2, 3]],
    // siempre rueda los 20 m: apuntando cerca del enemigo frenaba antes de llegar. Y cuanto mejor el
    // golpe, más rápido va (la fricción decide la velocidad de salida, no la distancia)
    knockback: 10, restitution: 0, bounceKeep: 1, maxHits: 1, rollFriction: [20, 50, 80], fixedRange: 20, color: CLUB_COLOR,
  },
};

/** Radio del área de un palo para un nivel de golpe (1, 2, 3). 0 = no abre área. */
export function spreadFor(club: Club, quality: number): number {
  return club.spread[Math.min(QUALITY_LEVELS, Math.max(1, quality)) - 1] ?? 0;
}

/** Cuánto lo frena el pasto para un nivel de golpe. Sin tabla propia, la fricción normal del pasto. */
export function rollFrictionFor(club: Club, quality: number): number | undefined {
  return club.rollFriction?.[Math.min(QUALITY_LEVELS, Math.max(1, quality)) - 1];
}

/** ¿Este palo abre área en algún nivel? */
export function hasArea(club: Club): boolean {
  return club.spread.some((r) => r > 0);
}

/**
 * Los dos modos del hierro, para probar cuál le da identidad propia. Se cambia en el panel (tecla B).
 * - **revienta**: no atraviesa; el primero que toca es donde explota, al ras del piso. Si cae al piso
 *   sin tocar a nadie, no hace nada. Hay que conectar.
 * - **atraviesa**: pasa de largo hasta a tres y además abre su área donde cae, le pegue a alguien o no.
 */
export type IronMode = 'revienta' | 'atraviesa';
export const IRON_MODES: Record<IronMode, Pick<Club, 'pierces' | 'burstsOnGround' | 'stopsOnLand'>> = {
  revienta: { pierces: false, burstsOnGround: false, stopsOnLand: true },
  atraviesa: { pierces: true, burstsOnGround: true, stopsOnLand: false },
};
export function setIronMode(mode: IronMode): void {
  Object.assign(CLUBS.iron, IRON_MODES[mode]);
}
export function ironMode(): IronMode {
  return CLUBS.iron.pierces ? 'atraviesa' : 'revienta';
}

/** Los cuatro palos, en el orden de las teclas 1, 2, 3 y 4. */
export const CLUB_ORDER: ClubId[] = ['driver', 'iron', 'wedge', 'putter'];

/** Tecla de cada palo, para el HUD. */
export const CLUB_KEYS = ['1', '2', '3', '4'];

/** Daño de un tiro: lo deciden el palo, a qué distancia pega, y qué tan bien se le pegó. */
export function damageFor(club: Club, meters: number, quality: number): number {
  return club.damage[bandOf(meters)][Math.min(QUALITY_LEVELS, Math.max(1, quality)) - 1];
}

/**
 * Daño del área donde cae. Pega menos que el impacto en el palo que hace las dos cosas: el área agarra
 * a varios y no hay que apuntarle a nadie. En los que solo hacen área, es su tabla de siempre.
 */
export function areaDamageFor(club: Club, meters: number, quality: number): number {
  const table = club.areaDamage ?? club.damage;
  return table[bandOf(meters)][Math.min(QUALITY_LEVELS, Math.max(1, quality)) - 1];
}

/**
 * Pelota de reserva (tecla S): la deja a los pies, en el puesto donde está parado. Es la salida para
 * cuando los guardias tiran las pelotas lejos y quedás mirando llegar a la horda sin nada que pegarle.
 * Se recarga sola, de a una, y se pueden guardar unas pocas: es un respiro, no una fuente infinita.
 *
 * **Apagada**: desde que las habilidades traen su propia pelota ya no hace falta. Se vuelve a prender
 * desde el panel de balance.
 */
export const RESERVE = { enabled: false, cooldown: 10, max: 2 };

/**
 * Correrse cargando (experimental): mientras cargás el tiro, A y D te corren **con la pelota** hacia
 * un costado, sin cambiar de puesto, para alinearte con una fila. Dos formas, para probar cuál va:
 * - **pasos**: cada toque corre `step` metros;
 * - **continuo**: mantener apretado corre a `speed` m/s, y podés tirar desde cualquier punto.
 * Nunca más de `reach` metros para cada lado (los puestos están a 4 m: 1.2 es un 30 %). **apagado**
 * es como antes: durante la carga, A y D quedan anotadas para después del tiro. **efecto** no mueve
 * al golfista: A y D le dan efecto a la pelota y el tiro se curva (ver `CURVE`).
 */
export type ShiftMode = 'apagado' | 'pasos' | 'continuo' | 'efecto';
export const SHIFT_MODES: ShiftMode[] = ['apagado', 'pasos', 'continuo', 'efecto'];
export const SHIFT: { mode: ShiftMode; reach: number; step: number; speed: number } = { mode: 'continuo', reach: 1.2, step: 0.4, speed: 4 };

/**
 * Efecto (el modo `efecto` de `SHIFT`), **solo para el driver y el putter**: mientras cargás, A y D
 * curvan el tiro hacia ese lado, y la línea de tiro muestra la curva. El efecto se mide en **metros de
 * desvío al final del tiro**, hasta `max` para cada lado.
 * - `variant`: *continuo* (mantener apretado lo hace crecer a `rate` m/s) o *discreto* (cada toque suma
 *   `step` metros).
 * - `reset`: cuándo vuelve a cero. *disparar*: se mantiene hasta que sale el tiro. *soltar*: vuelve a
 *   cero apenas no hay ninguna de las dos teclas apretada (con *discreto*, hay que tocar y mantener).
 */
export type CurveVariant = 'continuo' | 'discreto';
export type CurveReset = 'disparar' | 'soltar';
export const CURVE_VARIANTS: CurveVariant[] = ['continuo', 'discreto'];
export const CURVE_RESETS: CurveReset[] = ['disparar', 'soltar'];
export const CURVE: { variant: CurveVariant; reset: CurveReset; max: number; step: number; rate: number } = { variant: 'continuo', reset: 'disparar', max: 6, step: 1.5, rate: 8 };
/** Los palos que aceptan efecto: los dos que van derecho. El hierro y el wedge caen donde apuntás. */
export const CURVE_CLUBS: ClubId[] = ['driver', 'putter'];

/**
 * Calidad del golpe: puro timing, tres niveles. La barra sube y después rebota; soltar arriba del
 * todo es el nivel 3. No tiene nada que ver con la distancia, que la decide el mouse.
 */
export const QUALITY_LEVELS = 3;
/** Potencia a partir de la cual empieza cada nivel. */
export const QUALITY_FROM = [0, 0.55, 0.92];
export function qualityOf(power: number): number {
  let q = 1;
  for (let i = 1; i < QUALITY_FROM.length; i++) if (power >= qualityStart(i)) q = i + 1;
  return q;
}

/**
 * Lo que agrandan las mejoras la ventana del golpe perfecto (la carta «Punto dulce»). Va aparte de
 * QUALITY_FROM porque ese lo guarda el panel de balance: si la mejora lo tocara, quedaría guardada para
 * la partida siguiente.
 */
export const QUALITY_BONUS = { perfectWiden: 1 };

/** Dónde empieza de verdad el nivel `i`, con la ventana del perfecto agrandada por las mejoras. */
export function qualityStart(i: number): number {
  if (i !== QUALITY_LEVELS - 1) return QUALITY_FROM[i];
  return Math.max(QUALITY_FROM[i - 1] + 0.01, 1 - (1 - QUALITY_FROM[i]) * QUALITY_BONUS.perfectWiden);
}

/** Un globo se calcula para caer en el punto apuntado; el rasante y el rodado, no. */
export function isLob(club: Club): boolean {
  return hasArea(club) && club.loftDeg > 0.001;
}

/** Radio de la explosión de los kamikazes. */
export const EXPLOSION_RADIUS = 3.6;

/** El empujón es una velocidad que se apaga con exp(-KNOCK_DECAY t): recorre velocidad / KNOCK_DECAY. */
export const KNOCK_DECAY = 6;

/** Palazo (botón aparte): no hace daño. Empuja hacia atrás a todo lo que tenga alrededor, con recarga. */
export const MELEE_RANGE = 4;
/**
 * Impulso del palazo en m/s. El empujón se frena solo (decae a razón de 6 por segundo), así que el
 * enemigo recorre impulso / 6: con 84 son 14 m.
 */
export const MELEE_KNOCKBACK = 84;
export const MELEE_COOLDOWN = 2.5;
export const MELEE_MAX_TARGETS = 12;
/** Segundos que quedan trastabillando los golpeados (les corta el ataque en curso). */
export const MELEE_STAGGER = 0.7;

/**
 * Tótem del putter: en pausa. El código sigue en `src/game/traps.ts` y volver a prenderlo es plantar
 * uno cuando para la pelota del putter. Quedó afuera al separar palo de encantamiento, para ver
 * primero cómo funciona la combinación sin él.
 */
export const TRAP_RADIUS = 5;
export const TRAP_DAMAGE = [2, 3, 4, 10];
export const TRAP_KNOCKBACK = 40;
export const TRAP_LIFE = 25;
export const TRAP_MAX = 3;
export function trapDamage(power: number, perfect = false): number {
  return TRAP_DAMAGE[perfect ? QUALITY_LEVELS : qualityOf(power) - 1];
}

/** Alcance en metros para una potencia 0..1. Solo lo usan las pruebas: en el juego lo da el mouse. */
export function rangeFor(club: Club, power: number): number {
  return club.minRange + (club.maxRange - club.minRange) * Math.min(1, Math.max(0, power));
}
