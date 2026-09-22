// Los palos y los poderes.
//
// Reparto de roles, después del rediseño: **el palo es la entrega y el poder es el efecto.**
// - El **palo** (1, 2, 3, 4) decide cómo llega la pelota: rasante y atravesando, en arco bajo que cae
//   y rueda, en globo alto que se queda donde cae, o rodando. Y decide cuánto daño hace según a qué
//   distancia pega.
// - El **poder** (Q, W, E) decide qué hace cuando llega: golpear, enfriar o barrer. Los tres tienen
//   recarga, así que cada tiro es elegir cuál gastar.
//
// De ahí sale una regla sola que explica las doce combinaciones: **cuanto más rasante, más lineal y
// preciso; cuanto más alto, más zonal y amplio.** El driver le aplica el efecto a cada uno que
// atraviesa; los demás lo aplican en un área donde caen, más grande cuanto más alto vuela el palo.
//
// Las otras dos cosas quedaron separadas de verdad:
// - **El mouse dice dónde cae**, para todos los palos.
// - **La barra dice solo qué tan bien le pegaste**: tres niveles de calidad, puro timing.

export type ClubId = 'driver' | 'iron' | 'wedge' | 'putter';
export type EnchantId = 'damage' | 'ice' | 'push';

export interface Club {
  id: ClubId;
  name: string;
  /** Cómo vuela, para el HUD. */
  title: string;
  hint: string;
  /** Ángulo de salida en grados. 0 = rueda por el piso. */
  loftDeg: number;
  minRange: number;
  maxRange: number;
  /** Segundos que tarda el medidor en ir de 0 a 100 %. */
  chargeTime: number;
  /**
   * Radio del efecto donde toca el piso, en metros. **0 = no abre área** (el driver). Cuanto más alto
   * vuela el palo, más grande.
   */
  spread: number;
  /**
   * La pelota le aplica el efecto a cada uno que atraviesa en el aire, y sigue (driver y hierro). Sin
   * esto, el primero que toca es donde cae: ahí abre el área y se termina (wedge y putter).
   */
  pierces: boolean;
  /** Al tocar el piso y abrir su área, la pelota muere. Sin esto sigue rodando (el hierro). */
  stopsOnLand: boolean;
  /** Daño por banda de distancia (corta, media, larga) y nivel de calidad (1, 2, 3). */
  damage: number[][];
  /** Impulso que recibe el enemigo golpeado, en m/s. */
  knockback: number;
  restitution: number;
  bounceKeep: number;
  /** Enemigos que puede golpear una misma pelota. */
  maxHits: number;
  /** Gravedad propia del vuelo. Más gravedad = mismo globo, pero llega mucho antes. */
  gravity?: number;
  /** Cuánto lo frena el pasto al rodar. Menos que lo normal = rueda lento y tarda en parar. */
  rollFriction?: number;
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

export const CLUBS: Record<ClubId, Club> = {
  driver: {
    id: 'driver', name: 'Driver', title: 'Rasante', hint: 'Sale casi al ras y atraviesa la fila entera. Cobra de lejos y poco de cerca',
    loftDeg: 3.5, minRange: 6, maxRange: 66, chargeTime: 1.0, spread: 0,
    pierces: true, stopsOnLand: false,
    damage: [[1, 2, 3], [1, 3, 5], [2, 4, 8]],
    knockback: 5, restitution: 0.3, bounceKeep: 0.8, maxHits: 99, color: 0xffb347,
  },
  iron: {
    id: 'iron', name: 'Hierro 7', title: 'Arco bajo', hint: 'Sube, baja y sigue rodando: atraviesa como el driver y abre un área chica donde cae. Pasa por arriba de las lomas',
    loftDeg: 27, minRange: 6, maxRange: 55, chargeTime: 0.85, spread: 1.8,
    pierces: true, stopsOnLand: false,
    damage: [[1, 3, 7], [1, 3, 7], [1, 3, 7]],
    knockback: 4, restitution: 0.28, bounceKeep: 0.72, maxHits: 3, rollFriction: 6, color: 0x7fd4ff,
  },
  wedge: {
    id: 'wedge', name: 'Wedge', title: 'Globo', hint: 'Globo alto: tarda en llegar, cae en picada y se queda ahí, abriendo un área grande',
    loftDeg: 55, minRange: 5, maxRange: 55, chargeTime: 0.7, spread: 4.2,
    pierces: false, stopsOnLand: true,
    damage: [[1, 3, 7], [1, 3, 7], [1, 3, 7]],
    knockback: 0, restitution: 0, bounceKeep: 0, maxHits: 1, color: 0xff6b4a,
  },
  putter: {
    id: 'putter', name: 'Putter', title: 'Rodado', hint: 'Rueda lento por el piso y para en el primero que toca. Cobra de cerca como ninguno, pero no llega lejos',
    loftDeg: 0, minRange: 3, maxRange: 22, chargeTime: 0.6, spread: 1.6,
    pierces: false, stopsOnLand: true,
    damage: [[2, 4, 8], [1, 3, 5], [1, 2, 3]],
    knockback: 10, restitution: 0, bounceKeep: 1, maxHits: 1, rollFriction: 3, color: 0xc9a2ff,
  },
};

/** Los cuatro palos, en el orden de las teclas 1, 2, 3 y 4. */
export const CLUB_ORDER: ClubId[] = ['driver', 'iron', 'wedge', 'putter'];

/** Tecla de cada palo, para el HUD. */
export const CLUB_KEYS = ['1', '2', '3', '4'];

/** Daño de un tiro: lo deciden el palo, a qué distancia pega, y qué tan bien se le pegó. */
export function damageFor(club: Club, meters: number, quality: number): number {
  return club.damage[bandOf(meters)][Math.min(QUALITY_LEVELS, Math.max(1, quality)) - 1];
}

export interface Enchant {
  id: EnchantId;
  name: string;
  title: string;
  hint: string;
  /** Segundos de recarga: los tres la tienen, así que elegir uno es no tener los otros un rato. */
  cooldown: number;
  /** Símbolo que se dibuja en la punta de la línea de tiro. Los palos no tienen: tapaban la puntería. */
  icon: string;
  color: number;
}

/**
 * Los poderes se eligen con Q, W y E, y valen para cualquier palo. Los tres tienen recarga: el golpe
 * la tiene corta (es el de siempre) y los otros dos larga, así que la decisión es cuándo gastarlos.
 */
export const ENCHANTS: Record<EnchantId, Enchant> = {
  damage: {
    id: 'damage', name: 'Golpe', title: 'daño', hint: 'Puro daño, el del palo a esa distancia. Recarga corta',
    cooldown: 1.2, icon: '✦', color: 0xffb347,
  },
  ice: {
    id: 'ice', name: 'Escarcha', title: 'los enfría', hint: 'Frío: camina lento, sin escudo y sin aura. No hace daño',
    cooldown: 4, icon: '❄', color: 0x7fd4ff,
  },
  push: {
    id: 'push', name: 'Vendaval', title: 'los junta', hint: 'Los junta sobre la línea del tiro, en fila. No hace daño',
    cooldown: 3, icon: '➤', color: 0xff6b4a,
  },
};

export const ENCHANT_ORDER: EnchantId[] = ['damage', 'ice', 'push'];

/** Tecla de cada poder, para el HUD. */
export const ENCHANT_KEYS = ['Q', 'W', 'E'];

/**
 * Calidad del golpe: puro timing, tres niveles. La barra sube y después rebota; soltar arriba del
 * todo es el nivel 3. No tiene nada que ver con la distancia, que la decide el mouse.
 */
export const QUALITY_LEVELS = 3;
/** Potencia a partir de la cual empieza cada nivel. */
export const QUALITY_FROM = [0, 0.55, 0.92];
export function qualityOf(power: number): number {
  let q = 1;
  for (let i = 1; i < QUALITY_FROM.length; i++) if (power >= QUALITY_FROM[i]) q = i + 1;
  return q;
}

/** Un globo cae en un punto del piso y hace su efecto ahí; el driver, no. */
export function isLob(club: Club): boolean {
  return club.spread > 0 && club.loftDeg > 0.001;
}

/** Radio de la explosión de los kamikazes. */
export const EXPLOSION_RADIUS = 3.6;

/**
 * Escarcha: enfría a los que alcanza (caminan lento, no se cubren con el escudo y, si son chamanes,
 * se les apaga el aura). No congela ni cambia el daño que reciben. El área la pone el palo y la
 * calidad del golpe; la duración, solo la calidad.
 */
export const ICE_SLOW = 0.4;
export const ICE_SECONDS = [3, 5, 8];
/** Con el driver, que es lineal, el hielo va a cada uno que atraviesa. */
export const ICE_LINE_SECONDS = [2, 4, 6];

/**
 * Vendaval: barre un rectángulo orientado según la línea del tiro y empuja a cada uno **hacia la
 * línea**, justo lo que lo separa de ella, así que terminan todos en fila sobre el tiro, servidos
 * para el siguiente. Los que quedan a la misma profundidad no se enciman: quedan hombro con hombro.
 * Con el driver es un pasillo angosto a lo largo de todo el vuelo; con los globos, un rectángulo
 * ancho donde caen.
 */
export const PUSH_LINE_HALF_WIDTH = 3;
/** El empujón es una velocidad que se apaga con exp(-KNOCK_DECAY t): recorre velocidad / KNOCK_DECAY. */
export const KNOCK_DECAY = 6;

/** Cuánto agranda el área cada nivel de calidad. */
export const QUALITY_AREA = [1, 1.2, 1.5];

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
