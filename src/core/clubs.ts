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
  /** Globo que no daña: donde cae empuja a todos hacia afuera. */
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
  /** Gravedad propia del vuelo. Más gravedad = mismo globo, pero llega mucho antes. */
  gravity?: number;
  color: number;
}

// El driver sale casi rasante (3.5 grados): a 60 m no sube más de 0.9 m. Con más loft, un tiro cargado a
// fondo les pasaba por arriba a los goblins (1.25 m) en todo el tramo medio, y cargar más era pegar peor.
export const CLUBS: Record<ClubId, Club> = {
  driver: {
    id: 'driver', name: 'Driver', title: 'Rompevientos', hint: 'Recto y fuerte: atraviesa toda la fila. Es el único palo que hace daño',
    enchant: 'pierce', loftDeg: 3.5, minRange: 18, maxRange: 60, chargeTime: 1.0, damage: 1, knockback: 5,
    restitution: 0.3, bounceKeep: 0.8, maxHits: 99, cooldown: 0, color: 0xffb347,
  },
  iron: {
    id: 'iron', name: 'Hierro 7', title: 'Escarcha', hint: 'Globo de hielo: congela en el centro y enfría alrededor. Frío = lento, sin escudo y sin aura',
    enchant: 'ice', loftDeg: 40, minRange: 6, maxRange: 40, chargeTime: 0.5, damage: 0, knockback: 0,
    restitution: 0, bounceKeep: 0, maxHits: 1, cooldown: 2, gravity: 50, color: 0x7fd4ff,
  },
  wedge: {
    id: 'wedge', name: 'Wedge', title: 'Vendaval', hint: 'Globo sin daño: empuja a todos hacia afuera',
    enchant: 'push', loftDeg: 45, minRange: 5, maxRange: 28, chargeTime: 0.4, damage: 0, knockback: 0,
    restitution: 0, bounceKeep: 0, maxHits: 1, cooldown: 0, gravity: 75, color: 0xff6b4a,
  },
  putter: {
    id: 'putter', name: 'Putter', title: 'Portal', hint: 'Espacio te teletransporta al puesto más cercano al cursor',
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
 * Hielo del hierro. En el centro (ICE_CORE) congela; hasta ICE_RADIUS enfría: lento, sin escudo y sin
 * aura. No cambia el daño que recibe. La duración sube con la carga. El swing perfecto agranda las dos zonas y
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

/** Palazo (botón aparte): golpe corto alrededor del golfista, con recarga. */
export const MELEE_RANGE = 2.4;
export const MELEE_DAMAGE = 2;
/**
 * Impulso del palazo en m/s. El empujón se frena solo (decae a razón de 6 por segundo), así que el
 * enemigo recorre impulso / 6: con 84 son 14 m, que con el paso de simulación terminan siendo unos 15. Los pesados, una octava parte.
 */
export const MELEE_KNOCKBACK = 84;
export const MELEE_COOLDOWN = 2.5;
export const MELEE_MAX_TARGETS = 4;
/** Segundos que quedan trastabillando los golpeados (les corta el ataque en curso). */
export const MELEE_STAGGER = 0.7;

/** Empujón del wedge: radio, y velocidad que le da a un enemigo parado en el centro. */
export const PUSH_RADIUS = 4.2;
export function pushSpeed(power: number): number {
  return 27 * (0.55 + 0.45 * clamp01(power));
}

/**
 * La carga va por niveles, no de forma continua: así se sabe cuánto va a pegar. Sin cargar es nivel 1
 * y cada tercio de la barra suma uno, hasta 3. Con el driver, el nivel ES el daño: 1, 2 o 3. El cuarto
 * escalón es el crítico (swing perfecto), que pega CRIT_DAMAGE. Ese es TODO el daño: no hay racha, ni
 * estados que lo multipliquen, ni pérdida por picar. La vida de los enemigos está en la misma escala:
 * el goblin tiene 2, así que pide nivel 2; cargar de más es tiempo perdido.
 */
export const CHARGE_LEVELS = 3;
/** Daño del driver con swing perfecto (el crítico): no es un múltiplo del nivel, es este número. */
export const CRIT_DAMAGE = 8;
export function chargeLevel(power: number): number {
  return Math.min(CHARGE_LEVELS, 1 + Math.floor(clamp01(power) * CHARGE_LEVELS + 1e-9));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Alcance en metros para una potencia 0..1. */
export function rangeFor(club: Club, power: number): number {
  return club.minRange + (club.maxRange - club.minRange) * clamp01(power);
}
