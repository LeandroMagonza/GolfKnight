// Los palos encantados. Cada palo define cómo vuela la pelota (loft, alcance), cuánto tarda en
// cargarse el swing y qué hace el encantamiento.
//
// Reparto de roles: el driver es el único que hace daño de verdad (el que cobra). El hierro abre
// defensas, el wedge acomoda enemigos y el putter mueve al golfista.

export type ClubId = 'driver' | 'iron' | 'wedge' | 'putter';

export type Enchant =
  /** Atraviesa a todos los enemigos de la línea. */
  | 'pierce'
  /** Globo de hielo: congela en un centro chico y enfría alrededor (lento, sin escudo, sin aura). */
  | 'ice'
  /** Globo que no daña: donde cae empuja a todos hacia afuera. Perfecto: además los deja expuestos. */
  | 'push'
  /** La pelota del putter queda en el piso y el golfista puede saltar hasta ella. */
  | 'portal';

export interface Club {
  id: ClubId;
  name: string;
  /** Nombre del encantamiento, para el HUD. */
  title: string;
  hint: string;
  enchant: Enchant;
  /** Ángulo de salida en grados. 0 = rueda por el piso. */
  loftDeg: number;
  /** Alcance de vuelo (o de rodado, para el putter) con potencia mínima y máxima, en metros. */
  minRange: number;
  maxRange: number;
  /** Segundos que tarda el medidor en ir de 0 a 100 %. */
  chargeTime: number;
  damage: number;
  /** Impulso que recibe el enemigo golpeado, en m/s. */
  knockback: number;
  /** Cuánta velocidad conserva la pelota al rebotar contra el piso (vertical). */
  restitution: number;
  /** Cuánta velocidad horizontal conserva en cada pique. */
  bounceKeep: number;
  /** Enemigos que puede golpear una misma pelota. */
  maxHits: number;
  /** Segundos de recarga después de usarlo (0 = sin recarga). */
  cooldown: number;
  color: number;
}

export const CLUBS: Record<ClubId, Club> = {
  driver: {
    id: 'driver', name: 'Driver', title: 'Rompevientos', hint: 'Recto y fuerte: atraviesa toda la fila. Cada baja lo carga; un tiro que no daña a nadie lo descarga',
    enchant: 'pierce', loftDeg: 7, minRange: 18, maxRange: 60, chargeTime: 1.0, damage: 60, knockback: 5,
    restitution: 0.3, bounceKeep: 0.8, maxHits: 99, cooldown: 0, color: 0xffb347,
  },
  iron: {
    id: 'iron', name: 'Hierro 7', title: 'Escarcha', hint: 'Globo de hielo: congela en el centro y enfría alrededor. Frío = lento, sin escudo, sin aura, y recibe más daño',
    enchant: 'ice', loftDeg: 40, minRange: 6, maxRange: 40, chargeTime: 0.8, damage: 0, knockback: 0,
    restitution: 0, bounceKeep: 0, maxHits: 1, cooldown: 2, color: 0x7fd4ff,
  },
  wedge: {
    id: 'wedge', name: 'Wedge', title: 'Vendaval', hint: 'Globo sin daño: empuja a todos hacia afuera. Perfecto: además quedan expuestos y reciben más daño',
    enchant: 'push', loftDeg: 58, minRange: 5, maxRange: 28, chargeTime: 0.8, damage: 0, knockback: 0,
    restitution: 0, bounceKeep: 0, maxHits: 1, cooldown: 0, color: 0xff6b4a,
  },
  putter: {
    id: 'putter', name: 'Putter', title: 'Portal', hint: 'Espacio tira la pelota; Espacio de nuevo te lleva hasta ella',
    enchant: 'portal', loftDeg: 0, minRange: 3, maxRange: 22, chargeTime: 0, damage: 0, knockback: 0,
    restitution: 0, bounceKeep: 1, maxHits: 0, cooldown: 8, color: 0xc9a2ff,
  },
};

/** Palos que se eligen con 1-3 y la rueda. El putter va aparte, en la barra espaciadora. */
export const CLUB_ORDER: ClubId[] = ['driver', 'iron', 'wedge'];

/** Un globo cae en un punto del piso; el driver no. */
export function isLob(club: Club): boolean {
  return club.enchant === 'ice' || club.enchant === 'push';
}

/** Radio de la explosión de los kamikazes. */
export const EXPLOSION_RADIUS = 3.6;

/**
 * Hielo del hierro. En el centro (ICE_CORE) congela; hasta ICE_RADIUS enfría: lento, sin escudo, sin
 * aura, y recibe más daño. La duración sube con la carga. El swing perfecto agranda las dos zonas y
 * suma duración.
 */
export const ICE_CORE = 1.3;
export const ICE_RADIUS = 3;
export const ICE_SLOW = 0.4;
export const ICE_PERFECT_AREA = 1.3;
export const ICE_PERFECT_SECONDS = 1.5;
export function iceSeconds(power: number, perfect = false): number {
  return 3 + 2 * clamp01(power) + (perfect ? ICE_PERFECT_SECONDS : 0);
}
/** Cuánto más daño recibe un enemigo frío (o congelado). */
export const CHILL_DAMAGE_TAKEN = 1.25;

/** Wedge perfecto: los empujados quedan expuestos (reciben más daño) durante unos segundos. */
export const EXPOSED_SECONDS = 4;
export const EXPOSED_DAMAGE_TAKEN = 1.5;

/** Palazo (botón aparte): golpe corto alrededor del golfista, con recarga. */
export const MELEE_RANGE = 2.4;
export const MELEE_DAMAGE = 30;
export const MELEE_KNOCKBACK = 9;
export const MELEE_COOLDOWN = 2.5;
export const MELEE_MAX_TARGETS = 4;
/** Segundos que quedan trastabillando los golpeados (les corta el ataque en curso). */
export const MELEE_STAGGER = 0.7;

/** Empujón del wedge: radio, y velocidad que le da a un enemigo parado en el centro. */
export const PUSH_RADIUS = 4.2;
export function pushSpeed(power: number): number {
  return 27 * (0.55 + 0.45 * clamp01(power));
}

/** Un toque de driver pega bastante menos que un swing cargado: el costo de pegar fuerte es el tiempo. */
export const DRIVER_MIN_DAMAGE = 0.55;
export function driverPowerFactor(power: number): number {
  return DRIVER_MIN_DAMAGE + (1 - DRIVER_MIN_DAMAGE) * clamp01(power);
}

/**
 * Racha del driver: cada baja suma un escalón de daño, hasta un tope (tres escalones si el swing fue
 * perfecto). Pegar sin matar la mantiene. Un tiro que no daña a nadie la corta.
 */
export const STREAK_STEP = 0.1;
export const STREAK_MAX = 5;
export const STREAK_PERFECT_KILL = 3;
export function streakBonus(streak: number): number {
  return 1 + STREAK_STEP * Math.min(STREAK_MAX, Math.max(0, streak));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Alcance en metros para una potencia 0..1. */
export function rangeFor(club: Club, power: number): number {
  return club.minRange + (club.maxRange - club.minRange) * clamp01(power);
}
