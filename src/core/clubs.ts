// Los palos encantados. Cada palo define cómo vuela la pelota (loft, alcance), cuánto tarda en
// cargarse el swing y qué hace el encantamiento.
//
// Reparto de roles: el driver es el único que hace daño de verdad (el que cobra). El hierro abre
// defensas, el wedge arma las filas y el putter siembra tótems que después detona el driver.

export type ClubId = 'driver' | 'iron' | 'wedge' | 'putter';

export type Enchant =
  /** Atraviesa a todos los enemigos de la línea. */
  | 'pierce'
  /** Globo de hielo: enfría a los que toca (lentos, sin escudo, sin aura). No los congela. */
  | 'ice'
  /** Globo que no daña: donde cae, barre a todos hacia la línea del tiro. */
  | 'push'
  /** Rueda lento y, donde para, deja un tótem que explota cuando el driver le pega. */
  | 'trap';

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
  /** Cuánto lo frena el pasto al rodar, en m/s². Menos que lo normal = rueda lento y tarda en parar. */
  rollFriction?: number;
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
    id: 'iron', name: 'Hierro 7', title: 'Escarcha', hint: 'Globo de hielo: los enfría. Frío = camina lento, sin escudo y sin aura',
    enchant: 'ice', loftDeg: 40, minRange: 6, maxRange: 40, chargeTime: 1.0, damage: 0, knockback: 0,
    restitution: 0, bounceKeep: 0, maxHits: 1, cooldown: 2, gravity: 50, color: 0x7fd4ff,
  },
  wedge: {
    id: 'wedge', name: 'Wedge', title: 'Vendaval', hint: 'Globo sin daño: junta a todos sobre la línea del tiro, en fila',
    enchant: 'push', loftDeg: 45, minRange: 5, maxRange: 28, chargeTime: 0.4, damage: 0, knockback: 0,
    restitution: 0, bounceKeep: 0, maxHits: 1, cooldown: 0, gravity: 75, color: 0xff6b4a,
  },
  putter: {
    id: 'putter', name: 'Putter', title: 'Tótem', hint: 'Rueda lento y deja un tótem donde para. Pegale con el driver para detonarlo',
    enchant: 'trap', loftDeg: 0, minRange: 4, maxRange: 24, chargeTime: 0.9, damage: 0, knockback: 0,
    restitution: 0, bounceKeep: 1, maxHits: 0, cooldown: 6, rollFriction: 3, color: 0xc9a2ff,
  },
};

/** Palos que se eligen con 1-3 y la rueda. El putter va aparte, en la F. */
export const CLUB_ORDER: ClubId[] = ['driver', 'iron', 'wedge'];

/** Un globo cae en un punto del piso; el driver no. */
export function isLob(club: Club): boolean {
  return club.enchant === 'ice' || club.enchant === 'push';
}

/**
 * Control de altura (W sube, S baja), por escalones y no continuo, igual que la carga y que el daño.
 * El escalón se suma al loft del palo, pero **no cambia dónde cae la pelota**: la velocidad se
 * recalcula para llegar al mismo punto. Subir la altura levanta la pelota por encima de una loma o de
 * los que están en el medio, a cambio de que tarde más y de que deje de atravesar la fila. Se mantiene
 * de un tiro al siguiente: es una forma de tirar, no un gesto.
 */
export const HEIGHT_LEVELS: { name: string; delta: number }[] = [
  { name: 'Rasante', delta: -8 },
  { name: 'Normal', delta: 0 },
  { name: 'Globo', delta: 14 },
  { name: 'Bombeado', delta: 28 },
];
export const HEIGHT_DEFAULT = 1;
/** Un driver no se puede aplastar más de esto, ni un wedge levantar más. */
export const LOFT_MIN = 2.5;
export const LOFT_MAX = 80;
/** Loft final de un tiro en grados: el del palo más el escalón de altura. El putter siempre rueda. */
export function loftFor(club: Club, height: number): number {
  if (club.loftDeg <= 0.001) return 0;
  const level = HEIGHT_LEVELS[Math.min(HEIGHT_LEVELS.length - 1, Math.max(0, height))];
  return Math.min(LOFT_MAX, Math.max(LOFT_MIN, club.loftDeg + level.delta));
}

/** Radio de la explosión de los kamikazes. */
export const EXPLOSION_RADIUS = 3.6;

/**
 * Hielo del hierro. Enfría a los que toca: caminan lento, no se cubren con el escudo y, si son
 * chamanes, se les apaga el aura. No los congela (no los deja duros) y no cambia el daño que reciben.
 * Carga igual que el driver y cada escalón es mejor que el anterior: más área y más duración.
 */
export const ICE_RADIUS = 3;
export const ICE_SLOW = 0.4;
/** Por escalón de carga (1, 2, 3 y crítico): cuánto se agranda la zona, y cuántos segundos dura. */
export const ICE_LEVELS: { area: number; seconds: number }[] = [
  { area: 1, seconds: 3 },
  { area: 1.15, seconds: 4.5 },
  { area: 1.3, seconds: 6.5 },
  { area: 1.7, seconds: 8 },
];
export function iceLevel(power: number, perfect = false): { area: number; seconds: number } {
  return ICE_LEVELS[perfect ? CHARGE_LEVELS : chargeLevel(power) - 1];
}

/**
 * Tótem del putter. La pelota rueda lento y donde para deja un tótem. No hace nada por sí solo: explota
 * cuando le pega una pelota de driver, y ahí hace daño en área y empuja a todos en círculo. Cuanto mejor
 * cargado sale el putt, más fuerte explota. Es la única forma de hacer daño lejos de la línea del tiro.
 */
export const TRAP_RADIUS = 5;
export const TRAP_DAMAGE = [2, 3, 4, 10];
export const TRAP_KNOCKBACK = 40;
/** Segundos que aguanta un tótem sin detonar, y cuántos puede haber a la vez. */
export const TRAP_LIFE = 25;
export const TRAP_MAX = 3;
export function trapDamage(power: number, perfect = false): number {
  return TRAP_DAMAGE[perfect ? CHARGE_LEVELS : chargeLevel(power) - 1];
}

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
 * Vendaval del wedge: barre un rectángulo orientado según la línea del tiro. Empuja SOLO hacia los
 * costados de esa línea, y **hacia adentro**: cada uno recorre exactamente lo que lo separa de ella, así
 * que todos terminan sobre la línea del tiro, en fila, servidos para el driver. Los que están a la misma
 * profundidad no se enciman: quedan hombro con hombro, pegados a la línea. Mueve a todos lo mismo,
 * pesen lo que pesen. El ancho crece con cada escalón de carga.
 */
export const PUSH_HALF_DEPTH = 3.5;
export const PUSH_HALF_WIDTHS = [4, 5, 6, 8];
export function pushHalfWidth(power: number, perfect = false): number {
  return PUSH_HALF_WIDTHS[perfect ? CHARGE_LEVELS : chargeLevel(power) - 1];
}
/** El empujón es una velocidad que se apaga con exp(-KNOCK_DECAY t): recorre velocidad / KNOCK_DECAY. */
export const KNOCK_DECAY = 6;

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
