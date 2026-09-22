// Oleadas: qué enemigos salen y cada cuánto. WaveDirector decide cuándo aparece el próximo.
// Los enemigos salen sueltos, sin formación: las filas se arman y se desarman solas porque cada uno
// camina a su ritmo, y encontrarlas es el juego.
import type { ClubId } from './clubs';

export type EnemyKind = 'goblin' | 'skeleton' | 'kamikaze' | 'warrior' | 'knight' | 'shaman' | 'wraith' | 'golem';

/**
 * melee: camina y pega. kamikaze: corre y explota. shaman: camina con el grupo y vuelve inmunes a los
 * que tiene cerca. grabber: persigue al golfista, lo atrapa y lo lastima hasta que se escapa.
 * golem: se planta a distancia y le tira piedras a la puerta.
 */
export type Behavior = 'melee' | 'kamikaze' | 'shaman' | 'grabber' | 'golem';

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
  /** Lleva escudo: frena los tiros rasantes que le llegan de frente. */
  shield: boolean;
  /** Jefe: el hielo lo ralentiza pero nunca lo congela. */
  boss: boolean;
  /** Color con el que se tiñe el modelo (0 = sin teñir). */
  tint: number;
  score: number;
}

const base = { behavior: 'melee' as Behavior, runs: false, heavy: false, shield: false, boss: false, tint: 0 };

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  goblin: { ...base, kind: 'goblin', name: 'Goblin', mesh: 'Character_Goblin_Male', height: 1.25, radius: 0.45, hp: 2, speed: 3.6, runs: true, damage: 1, gateDamage: 1, score: 10 },
  skeleton: { ...base, kind: 'skeleton', name: 'Esqueleto', mesh: 'Character_Skeleton_Soldier_01', height: 1.8, radius: 0.55, hp: 4, speed: 2.1, damage: 1, gateDamage: 1, score: 20 },
  kamikaze: { ...base, kind: 'kamikaze', name: 'Goblin kamikaze', mesh: 'Character_Goblin_Female', behavior: 'kamikaze', height: 1.25, radius: 0.45, hp: 2, speed: 3.2, runs: true, damage: 1, gateDamage: 2, tint: 0xffa08a, score: 20 },
  warrior: { ...base, kind: 'warrior', name: 'Goblin guerrero', mesh: 'Character_Goblin_Warrior_Male', height: 1.55, radius: 0.6, hp: 4, speed: 2.4, damage: 1, gateDamage: 1, shield: true, score: 30 },
  knight: { ...base, kind: 'knight', name: 'Caballero esqueleto', mesh: 'Character_Skeleton_Knight', height: 2.2, radius: 0.85, hp: 10, speed: 1.5, damage: 1, gateDamage: 2, heavy: true, score: 50 },
  shaman: { ...base, kind: 'shaman', name: 'Chamán goblin', mesh: 'Character_Goblin_Shaman', behavior: 'shaman', height: 1.45, radius: 0.5, hp: 3, speed: 2.2, damage: 0, gateDamage: 0, score: 60 },
  wraith: { ...base, kind: 'wraith', name: 'Alma en pena', mesh: 'Character_Tormented_Soul', behavior: 'grabber', height: 1.9, radius: 0.5, hp: 2, speed: 5.8, runs: true, damage: 1, gateDamage: 0, score: 40 },
  golem: { ...base, kind: 'golem', name: 'Gólem de roca', mesh: 'Character_Rock_Golem', behavior: 'golem', height: 4.0, radius: 1.7, hp: 80, speed: 1.3, damage: 2, gateDamage: 1, heavy: true, boss: true, score: 500 },
};

/** Cada enemigo camina entre (1 - x) y (1 + x) veces la velocidad de su tipo. */
export const SPEED_SPREAD = 0.22;
/** A qué distancia de la puerta se plantan el chamán y el gólem, en metros. */
export const SHAMAN_HOLD_Z = 10;
export const GOLEM_HOLD_Z = 22;
/** Radio del aura del chamán: los enemigos que están adentro son inmunes mientras él conjure. */
export const SHAMAN_WARD_RADIUS = 8;
/** Segundos entre piedras del gólem. */
export const GOLEM_THROW_EVERY = 4;
/** Alma en pena: cada cuánto lastima mientras tiene agarrado al golfista, y cuánto aguanta agarrada. */
export const GRAB_TICK = 1.6;
export const GRAB_MAX = 5;

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
}

export interface Wave {
  title: string;
  groups: WaveGroup[];
  /** Segundos entre apariciones. */
  interval: number;
  /** Palo que se estrena en esta oleada: es el que resuelve al enemigo nuevo. */
  unlock?: ClubId;
}

export const WAVES: Wave[] = [
  { title: 'Solo vos y el driver: buscá la fila', interval: 2.2, groups: [{ kind: 'goblin', count: 8 }, { kind: 'skeleton', count: 4 }] },
  { title: 'Escudos al frente', unlock: 'iron', interval: 2.2, groups: [{ kind: 'warrior', count: 3 }, { kind: 'skeleton', count: 4 }, { kind: 'goblin', count: 5 }] },
  { title: 'La estampida', unlock: 'wedge', interval: 1.5, groups: [{ kind: 'goblin', count: 10 }, { kind: 'kamikaze', count: 4 }, { kind: 'skeleton', count: 4 }] },
  { title: 'Almas en pena', unlock: 'putter', interval: 1.9, groups: [{ kind: 'wraith', count: 3 }, { kind: 'skeleton', count: 5 }, { kind: 'warrior', count: 3 }, { kind: 'goblin', count: 5 }, { kind: 'knight', count: 1 }] },
  { title: 'El chamán los vuelve inmunes', interval: 1.6, groups: [{ kind: 'shaman', count: 2 }, { kind: 'warrior', count: 4 }, { kind: 'skeleton', count: 6 }, { kind: 'goblin', count: 8 }, { kind: 'kamikaze', count: 4 }, { kind: 'knight', count: 1 }] },
  { title: 'El Gólem de roca', interval: 1.5, groups: [{ kind: 'golem', count: 1 }, { kind: 'knight', count: 3 }, { kind: 'warrior', count: 5 }, { kind: 'skeleton', count: 4 }, { kind: 'kamikaze', count: 6 }, { kind: 'goblin', count: 8 }, { kind: 'shaman', count: 1 }, { kind: 'wraith', count: 2 }] },
];

/** Palos disponibles durante la oleada número index (el driver está siempre). */
export function unlockedAt(index: number, waves: Wave[] = WAVES): ClubId[] {
  const out: ClubId[] = ['driver'];
  for (let i = 0; i <= index && i < waves.length; i++) {
    const u = waves[i].unlock;
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

/** Segundos de descanso entre oleadas. */
export const INTERMISSION = 6;

/** Orden de aparición de una oleada: mezcla los grupos de forma pareja y determinista. */
export function spawnOrder(wave: Wave): EnemyKind[] {
  const slots: { kind: EnemyKind; at: number }[] = [];
  for (const g of wave.groups) {
    // los grupos de uno o dos (jefe, chamanes) salen hacia la mitad de la oleada
    for (let i = 0; i < g.count; i++) slots.push({ kind: g.kind, at: g.count <= 2 ? 0.4 + 0.2 * i : (i + 0.5) / g.count });
  }
  slots.sort((a, b) => a.at - b.at);
  return slots.map((s) => s.kind);
}

export type DirectorEvent =
  | { type: 'wave'; index: number; wave: Wave }
  | { type: 'spawn'; kind: EnemyKind }
  | { type: 'cleared'; index: number }
  | { type: 'victory' };

/**
 * Máquina de estados de las oleadas. update() recibe cuántos enemigos quedan vivos y devuelve lo
 * que pasó en este paso.
 */
export class WaveDirector {
  index = -1;
  private queue: EnemyKind[] = [];
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

  /** Palo que estrena la oleada que viene, si estrena alguno. */
  get nextUnlock(): ClubId | undefined {
    return this.waves[this.index + 1]?.unlock;
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
        events.push({ type: 'spawn', kind: this.queue.shift()! });
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
