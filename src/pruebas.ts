// Las pruebas del pulido (14/10, Leandro: «andá pensando pruebas específicas para que yo pueda testear
// directamente los cambios»). Con `?prueba=<nombre>` (solo con las herramientas de prueba), la partida arranca
// sin oleadas: aparecen los enemigos de la prueba delante del golfista, caminando despacio, y cuando caen
// todos vuelven a aparecer. La puerta y el golfista no pierden vida. La lista y qué mirar, en docs/pruebas.md.
import type { AbilityId, Element } from './core/abilities';
import { DIVINE, POWERS, REGEN, type EnemyKind, type EnemyMods } from './core/waves';

export interface Prueba {
  /** El cartel de arriba al empezar. */
  title: string;
  /** Qué hacer y qué mirar. */
  hint: string;
  /** Cada uno: tipo, poderes, y dónde (metros adelante del golfista, y al costado: + a la derecha de la pantalla). */
  enemies: { kind: EnemyKind; mods?: EnemyMods; at: [number, number] }[];
  /** Las habilidades que se aprenden al empezar. */
  learn?: AbilityId[];
  /** El guante puesto todo el rato (el aura). */
  glove?: Element;
  /** Los enemigos aparecen prendidos fuego. */
  burn?: boolean;
  /** Cada cuántos segundos se congelan los que están vivos (0: nunca). */
  freezeEvery?: number;
  /** Al caer todos, salen las cartas (y la oleada terminada). */
  cards?: boolean;
  /** A qué parte de su velocidad caminan. */
  pace?: number;
}

const hard = undefined;
const row = (kind: EnemyKind, n: number, k: number, gap: number, mods?: EnemyMods): Prueba['enemies'] =>
  Array.from({ length: n }, (_, i) => ({ kind, mods, at: [k + (i % 2) * 2, (i - (n - 1) / 2) * gap] as [number, number] }));

export const PRUEBAS: Record<string, Prueba> = {
  golpes: {
    title: 'Prueba: los golpes',
    hint: 'Pegale con golpe 1, 2, 3 y el perfecto: cada uno tiene su impacto y su sonido de palo; el perfecto congela un instante. Fijate que se aplastan al recibir.',
    enemies: row('orc', 5, 16, 3.2, { hp: 30 }),
    pace: 0.25,
  },
  fuego: {
    title: 'Prueba: el fuego',
    hint: 'El aura de fuego está puesta (el guante). Los enemigos ya vienen prendidos: llamas, el crepitar y el chisporroteo de cada quemadura. Tus tiros los vuelven a prender, con estela de fuego.',
    enemies: row('orc', 5, 18, 3.4, { hp: 20 }),
    learn: ['glove-fire', 'iron-fire'],
    glove: 'fire',
    burn: true,
    pace: 0.3,
  },
  hielo: {
    title: 'Prueba: el hielo',
    hint: 'Cada 5 s se congelan: les crecen cristales. Pegales congelados y se rompen (o esperá a que se suelten). El aura de hielo está puesta.',
    enemies: row('skeleton', 4, 16, 3.5, { hp: 20 }),
    learn: ['glove-ice', 'iron-ice'],
    glove: 'ice',
    freezeEvery: 5,
    pace: 0.3,
  },
  auras: {
    title: 'Prueba: las auras',
    hint: 'Tenés los cuatro guantes en Q W E R: tiralos uno por uno para ver cada aura (fuego, hielo, rayo, fantasma) y la estela de la pelota de fuego.',
    enemies: row('goblina', 4, 20, 3, { hp: 10 }),
    learn: ['glove-fire', 'glove-ice', 'glove-lightning', 'glove-ghost'],
    pace: 0.3,
  },
  burbuja: {
    title: 'Prueba: la burbuja del bendito',
    hint: 'Romper la burbuja: se disuelve con el borde encendido, destello y sonido. A los pocos segundos se vuelve a armar, con su sonido.',
    enemies: row('orc', 4, 15, 3.5, { ...POWERS.divine(2, Math.random, hard), hp: 12 }),
    pace: 0.25,
  },
  blindado: {
    title: 'Prueba: el blindado',
    hint: 'Cada pelotazo al blindado suena a metal y saca chispas.',
    enemies: row('skeleton', 4, 15, 3.5, { armor: 2, hp: 20 }),
    pace: 0.25,
  },
  escudo: {
    title: 'Prueba: el escudo',
    hint: 'Pegale de frente al escudo: rebota con chispas y sonido de metal más agudo. Ojo, la que rebota vuelve hacia vos.',
    enemies: row('orc', 3, 16, 4, { shield: 3, hp: 12 }),
    pace: 0.25,
  },
  intocable: {
    title: 'Prueba: el intocable',
    hint: 'Pegale mientras está cerrado (violeta): la pelota rebota con otro sonido y un anillo violeta. Cuando se abre, le entra.',
    enemies: row('orc', 4, 16, 3.5, { ...POWERS.phase(2, Math.random, hard), hp: 12 }),
    pace: 0.25,
  },
  curacion: {
    title: 'Prueba: la curación',
    hint: 'El chamán curandero del medio llena su barra y cura entero a los de su círculo (élite y jefe, 5 como mucho): círculo verde, cruces y sonido. A los costados, dos que se curan solos.',
    enemies: [
      { kind: 'shaman', mods: { aura: 'heal' }, at: [20, 0] },
      { kind: 'orc', mods: { hp: 8 }, at: [18, -2.5] },
      { kind: 'orc', mods: { hp: 8 }, at: [18, 2.5] },
      { kind: 'skeleton', mods: { hp: 8 }, at: [22, -2] },
      { kind: 'skeleton', mods: { hp: 8 }, at: [22, 2] },
      { kind: 'orc', mods: { regen: REGEN.margin, hp: REGEN.hp + 4 }, at: [16, -8] },
      { kind: 'orc', mods: { regen: REGEN.margin, hp: REGEN.hp + 4 }, at: [16, 8] },
    ],
    pace: 0.15,
  },
  esquiva: {
    title: 'Prueba: la esquiva',
    hint: 'Al soltar el tiro, el escurridizo salta: suena y deja rayas. Cuando le vuelve la esquiva suena un tic chiquito.',
    enemies: row('goblina', 4, 16, 3.5, { ...POWERS.dodge(2, Math.random, hard), hp: 6 }),
    pace: 0.25,
  },
  hechiceros: {
    title: 'Prueba: los hechiceros',
    hint: 'Se plantan lejos y te tiran: suena al conjurar y al caer el hechizo.',
    enemies: row('goblina', 3, 30, 5, { ranged: true, apart: true }),
    pace: 0.8,
  },
  muertes: {
    title: 'Prueba: las voces',
    hint: 'Uno de cada tipo: cada uno tiene su sonido al morir. Al caer todos suena la oleada terminada y salen las cartas (con sus sonidos).',
    enemies: (['goblin', 'goblina', 'orc', 'skeleton', 'warchief', 'shaman', 'knight', 'stoneling', 'wraith'] as EnemyKind[]).map((kind, i) => ({ kind, at: [16 + (i % 2) * 3, (i - 4) * 2.4] as [number, number] })),
    cards: true,
    pace: 0.2,
  },
  jefe: {
    title: 'Prueba: el élite y el jefe',
    hint: 'Entra un élite (aviso y risa) y el gólem jefe (rugido; tira rocas: el tiro y la caída suenan). Al morir, el jefe tiene su sonido.',
    enemies: [
      { kind: 'knight', mods: { size: 1.25, hp: 6 }, at: [22, -6] },
      { kind: 'golem', at: [40, 3] },
    ],
    pace: 0.5,
  },
  quejidos: {
    title: 'Prueba: los quejidos',
    hint: 'Uno de cada tipo, con mucha vida: al recibir cada uno se queja con su voz, y el golpe suena según de qué está hecho (hueso, armadura, piedra). El élite del medio gruñe grave cada vez que le pegás.',
    enemies: [
      ...(['goblin', 'goblina', 'orc', 'skeleton', 'warchief', 'shaman', 'knight', 'stoneling', 'wraith'] as EnemyKind[]).map((kind, i) => ({ kind, mods: { hp: 40 }, at: [17 + (i % 2) * 3, (i - 4) * 2.6] as [number, number] })),
      { kind: 'orc', mods: { size: 1.25, hp: 60 }, at: [24, 0] },
    ],
    pace: 0.12,
  },
  palos: {
    title: 'Prueba: el golpe de cada palo',
    hint: 'Probá los cuatro palos (1 2 3 4): cada uno tiene su golpe grabado (el putter un tic, el hierro un click, el wedge más cuerpo, el driver el ping metálico), más fuerte cuanto mejor el golpe. Tiene que sonar justo cuando el palo toca la pelota.',
    enemies: row('orc', 5, 18, 3.2, { hp: 30 }),
    pace: 0.2,
  },
  disparos: {
    title: 'Prueba: los disparos',
    hint: 'Q W E R: driver de fuego, hierro de hielo, wedge de rayo y putter fantasma. Cada uno suena a su palo y a su elemento.',
    enemies: row('orc', 5, 20, 3.2, { hp: 30 }),
    learn: ['driver-fire', 'iron-ice', 'wedge-lightning', 'putter-ghost'],
    pace: 0.2,
  },
  invocaciones: {
    title: 'Prueba: carrito, hoyo, bandera y pólvora',
    hint: 'Q W E R: el carrito arranca, el hoyo se clava en la tierra (y el que cae suena), la bandera vuela y se clava, la pólvora chisporrotea.',
    enemies: row('goblin', 8, 22, 2.2, { hp: 6 }),
    learn: ['cart', 'hole', 'flag', 'powder'],
    pace: 0.25,
  },
  mejoras: {
    title: 'Prueba: lluvia, caddie, lupa y clon',
    hint: 'Q W E R: la lluvia de pelotas sube, el caddie brilla dorado, la lupa crece, el clon junta energía.',
    enemies: row('orc', 5, 20, 3.2, { hp: 20 }),
    learn: ['rain', 'caddie', 'lens', 'clone'],
    pace: 0.2,
  },
  refuerzos: {
    title: 'Prueba: eco, potencia, fuerza y palazo',
    hint: 'Q W E R: el eco (pulsos), la potencia (corto), la fuerza (largo) y el palazo, que suena al conectar. Los guantes, en ?prueba=auras.',
    enemies: row('orc', 5, 9, 3.2, { hp: 20 }),
    learn: ['echo', 'boost', 'might', 'shove'],
    pace: 0.3,
  },
  explosiones: {
    title: 'Prueba: las explosiones',
    hint: 'Con el hierro y el wedge en grupos apretados: fogonazo, humo, rayas y la marca quemada. Compará con ?pulido=0.',
    enemies: [...row('goblin', 6, 18, 1.2, { hp: 4 }), ...row('goblina', 6, 24, 1.2, { hp: 4 })],
    pace: 0.2,
  },
};

/** Cuánto dura la burbuja del bendito en volver (para la prueba no hace falta esperar tanto). */
export const PRUEBA_DIVINE = DIVINE.every;
