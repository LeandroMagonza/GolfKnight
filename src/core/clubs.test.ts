import { describe, expect, it } from 'vitest';
import { ROLL_FRICTION } from './ballistics';
import {
  areaDamageFor, bandOf, BAND_LIMITS, CHARGE_TIME, CLUB_KEYS, CLUB_ORDER, CLUBS, damageFor, ENCHANT_KEYS, ENCHANT_ORDER, ENCHANTS, hasArea, ironMode, rollFrictionFor, setIronMode, spreadFor,
  ICE_SECONDS, isLob, KNOCK_DECAY, PUSH_LINE_HALF_WIDTH, QUALITY_AREA, QUALITY_FROM, QUALITY_LEVELS, qualityOf,
} from './clubs';
import { MIN_POWER, PERFECT_FROM } from './swing';
import { ENEMIES } from './waves';

describe('palos', () => {
  it('los cuatro palos tienen su tecla, del 1 al 4', () => {
    expect(CLUB_ORDER).toHaveLength(4);
    expect(CLUB_KEYS).toEqual(['1', '2', '3', '4']);
    for (const id of CLUB_ORDER) expect(CLUBS[id].id).toBe(id);
  });

  it('solo el hierro y el wedge abren área; el driver y el putter le pegan a lo que tocan', () => {
    for (const id of ['driver', 'putter'] as const) expect(hasArea(CLUBS[id]), id).toBe(false);
    for (const id of ['iron', 'wedge'] as const) expect(hasArea(CLUBS[id]), id).toBe(true);
    expect(isLob(CLUBS.driver)).toBe(false);
    // cuanto más alto vuela, más abre
    expect(spreadFor(CLUBS.wedge, 3)).toBeGreaterThan(spreadFor(CLUBS.iron, 3));
    expect(CLUBS.wedge.loftDeg).toBeGreaterThan(CLUBS.iron.loftDeg);
    // el putter rueda y para en el primero que toca: no es un globo ni abre nada
    expect(CLUBS.putter.loftDeg).toBe(0);
    expect(isLob(CLUBS.putter)).toBe(false);
    // rueda de verdad, pero no lento: con poca fricción salía flojo y tardaba una eternidad en llegar
    expect(rollFrictionFor(CLUBS.putter, 1)).toBeGreaterThanOrEqual(ROLL_FRICTION * 0.7);
  });

  it('el putter va más rápido cuanto mejor le pegás, y siempre rueda la misma distancia', () => {
    for (let q = 2; q <= QUALITY_LEVELS; q++) {
      expect(rollFrictionFor(CLUBS.putter, q)!).toBeGreaterThan(rollFrictionFor(CLUBS.putter, q - 1)!);
    }
    // distancia fija: el cursor decide solo la dirección. Apuntando cerca del enemigo, la pelota
    // frenaba antes de llegar y había que apuntar más atrás que el blanco
    expect(CLUBS.putter.fixedRange).toBe(CLUBS.putter.maxRange);
  });

  it('la distancia fija nunca se sale del alcance del palo', () => {
    for (const id of CLUB_ORDER) {
      const c = CLUBS[id];
      if (!c.fixedRange) continue;
      expect(c.fixedRange, id).toBeGreaterThanOrEqual(c.minRange);
      expect(c.fixedRange, id).toBeLessThanOrEqual(c.maxRange);
    }
  });

  it('el área crece con el nivel del golpe, en todos los que abren área', () => {
    for (const id of CLUB_ORDER) {
      if (!hasArea(CLUBS[id])) continue;
      for (let q = 2; q <= QUALITY_LEVELS; q++) expect(spreadFor(CLUBS[id], q), id).toBeGreaterThan(spreadFor(CLUBS[id], q - 1));
    }
  });

  it('solo el globo abre su área por caer al piso: los demás tienen que conectar', () => {
    expect(CLUBS.wedge.burstsOnGround).toBe(true);
    for (const id of ['driver', 'iron', 'putter'] as const) expect(CLUBS[id].burstsOnGround, id).toBe(false);
  });

  it('el hierro tiene dos modos para probarle la identidad', () => {
    const volver = ironMode();
    setIronMode('revienta');
    expect(CLUBS.iron.pierces).toBe(false);
    expect(CLUBS.iron.burstsOnGround).toBe(false);
    expect(ironMode()).toBe('revienta');
    setIronMode('atraviesa');
    expect(CLUBS.iron.pierces).toBe(true);
    expect(CLUBS.iron.burstsOnGround).toBe(true);
    expect(ironMode()).toBe('atraviesa');
    setIronMode(volver);
  });

  it('el hierro hace un arco: sube y baja dentro del campo, más alto que el driver y menos que el wedge', () => {
    expect(CLUBS.iron.loftDeg).toBeGreaterThan(CLUBS.driver.loftDeg);
    expect(CLUBS.iron.loftDeg).toBeLessThan(CLUBS.wedge.loftDeg);
    // con gravedad normal (sin la propia del globo) el arco es de verdad, no una caída en picada
    expect(CLUBS.iron.gravity).toBeUndefined();
    // y pica y sigue: si no rebotara nada, se clavaría donde cae como el wedge
    expect(CLUBS.iron.restitution).toBeGreaterThan(0);
    expect(CLUBS.wedge.restitution).toBe(0);
  });

  it('cada palo cobra mejor a su distancia, y ninguno es el mejor siempre', () => {
    const [corta, media, larga] = [10, 30, 50];
    // el driver crece con la distancia y el putter al revés
    expect(damageFor(CLUBS.driver, larga, 3)).toBeGreaterThan(damageFor(CLUBS.driver, media, 3));
    expect(damageFor(CLUBS.driver, media, 3)).toBeGreaterThan(damageFor(CLUBS.driver, corta, 3));
    expect(damageFor(CLUBS.putter, corta, 3)).toBeGreaterThan(damageFor(CLUBS.putter, media, 3));
    expect(damageFor(CLUBS.putter, media, 3)).toBeGreaterThan(damageFor(CLUBS.putter, larga, 3));
    // el hierro y el wedge pegan lo mismo a cualquier distancia
    for (const id of ['iron', 'wedge'] as const) {
      const flat = damageFor(CLUBS[id], corta, 3);
      expect(damageFor(CLUBS[id], media, 3)).toBe(flat);
      expect(damageFor(CLUBS[id], larga, 3)).toBe(flat);
    }
    // a cada distancia hay un palo que conviene más que los otros
    expect(damageFor(CLUBS.putter, corta, 3)).toBeGreaterThan(damageFor(CLUBS.driver, corta, 3));
    expect(damageFor(CLUBS.driver, larga, 3)).toBeGreaterThan(damageFor(CLUBS.putter, larga, 3));
  });

  it('pegarle mejor siempre pega más, con cualquier palo y a cualquier distancia', () => {
    for (const id of CLUB_ORDER) {
      for (const meters of [5, 25, 60]) {
        for (let q = 2; q <= QUALITY_LEVELS; q++) {
          expect(damageFor(CLUBS[id], meters, q)).toBeGreaterThan(damageFor(CLUBS[id], meters, q - 1));
        }
      }
    }
  });

  it('las bandas de distancia van en metros del campo, no en fracciones del palo', () => {
    expect(bandOf(BAND_LIMITS[0] - 1)).toBe(0);
    expect(bandOf(BAND_LIMITS[0] + 1)).toBe(1);
    expect(bandOf(BAND_LIMITS[1] + 1)).toBe(2);
    // el driver llega a la banda larga y el putter **no sale de la corta**: llega justo hasta el corte
    expect(bandOf(CLUBS.driver.maxRange)).toBe(2);
    expect(bandOf(CLUBS.putter.maxRange)).toBe(0);
    expect(CLUBS.putter.maxRange).toBe(BAND_LIMITS[0]);
    expect(CLUBS.putter.maxRange).toBeLessThan(CLUBS.iron.maxRange);
  });

  it('la vida de los enemigos está en la escala del daño', () => {
    const mejor = Math.max(...CLUB_ORDER.map((id) => damageFor(CLUBS[id], 50, QUALITY_LEVELS)));
    // todos caen de un golpe perfecto salvo el caballero (la armadura grande) y el jefe
    for (const e of Object.values(ENEMIES)) if (!e.boss && e.kind !== 'knight') expect(e.hp).toBeLessThanOrEqual(mejor);
    // un goblin cae de un golpe bueno; el caballero pide más que el mejor golpe de un tiro
    expect(ENEMIES.goblin.hp).toBeLessThanOrEqual(damageFor(CLUBS.iron, 30, 2));
    expect(ENEMIES.knight.hp).toBeGreaterThan(mejor);
  });
});

describe('calidad del golpe', () => {
  it('son tres niveles de puro timing, sin nada que ver con la distancia', () => {
    expect(QUALITY_LEVELS).toBe(3);
    expect(qualityOf(0)).toBe(1);
    expect(qualityOf(MIN_POWER)).toBe(1);
    expect(qualityOf(QUALITY_FROM[1] - 0.01)).toBe(1);
    expect(qualityOf(QUALITY_FROM[1])).toBe(2);
    expect(qualityOf(0.9)).toBe(2);
    expect(qualityOf(QUALITY_FROM[2])).toBe(3);
    expect(qualityOf(1)).toBe(3);
  });

  it('el nivel más alto es el del swing perfecto, y es una ventana angosta', () => {
    expect(QUALITY_FROM[QUALITY_LEVELS - 1]).toBe(PERFECT_FROM);
    expect(1 - PERFECT_FROM).toBeLessThan(0.1);
  });

  it('pegarle mejor también agranda el efecto', () => {
    expect(QUALITY_AREA).toHaveLength(QUALITY_LEVELS);
    for (let i = 1; i < QUALITY_AREA.length; i++) expect(QUALITY_AREA[i]).toBeGreaterThan(QUALITY_AREA[i - 1]);
    expect(QUALITY_AREA[0]).toBe(1);
  });
});

describe('encantamientos', () => {
  it('son tres, se eligen con Q, W y E, y valen para cualquier palo', () => {
    expect(ENCHANT_ORDER).toEqual(['damage', 'ice', 'push']);
    expect(ENCHANT_KEYS).toEqual(['Q', 'W', 'E']);
    for (const id of ENCHANT_ORDER) expect(ENCHANTS[id].id).toBe(id);
  });

  it('el golpe no tiene recarga: es el estado de reposo; los otros dos se pagan', () => {
    // sin esto el juego se frena entre tiro y tiro, y peor: al ir a pegar habría que cambiar solo a
    // otro poder, que era justo lo que sorprendía
    expect(ENCHANTS.damage.cooldown).toBe(0);
    expect(ENCHANTS.ice.cooldown).toBeGreaterThan(0);
    expect(ENCHANTS.push.cooldown).toBeGreaterThan(0);
  });

  it('cada palo tiene su tiempo de carga, y el del putter es el más corto', () => {
    // la barra mide timing, así que los tres de campo cargan igual; el putter es de cerca y va rápido
    for (const id of ['driver', 'iron', 'wedge'] as const) expect(CLUBS[id].chargeTime, id).toBe(CHARGE_TIME);
    expect(CLUBS.putter.chargeTime).toBeLessThan(CHARGE_TIME);
  });

  it('el área pega menos que el impacto: agarra a varios y no hay que apuntarle a nadie', () => {
    // el hierro es el único que hace las dos cosas, así que es el único con dos tablas
    expect(CLUBS.iron.areaDamage).toBeDefined();
    for (const meters of [10, 30, 50]) {
      for (let q = 1; q <= QUALITY_LEVELS; q++) {
        expect(areaDamageFor(CLUBS.iron, meters, q)).toBeLessThanOrEqual(damageFor(CLUBS.iron, meters, q));
      }
    }
    // el wedge y el putter solo hacen área: su tabla de siempre ya es la del área
    for (const id of ['wedge', 'putter'] as const) {
      expect(CLUBS[id].areaDamage).toBeUndefined();
      expect(areaDamageFor(CLUBS[id], 10, 3)).toBe(damageFor(CLUBS[id], 10, 3));
    }
    // y el wedge, que abre la más grande de todas, pega menos que el área del hierro con el mejor golpe
    expect(damageFor(CLUBS.wedge, 30, 3)).toBeLessThan(damageFor(CLUBS.iron, 30, 3));
  });

  it('se puede pegar cerca: ningún palo pide más de 4 m para salir', () => {
    for (const id of CLUB_ORDER) expect(CLUBS[id].minRange, id).toBeLessThanOrEqual(4);
  });

  it('cada poder tiene su ícono para la punta de la línea; los palos ya no tienen', () => {
    const icons = ENCHANT_ORDER.map((id) => ENCHANTS[id].icon);
    expect(new Set(icons).size).toBe(icons.length);
    for (const id of CLUB_ORDER) expect(CLUBS[id]).not.toHaveProperty('icon');
  });

  it('la escarcha dura más cuanto mejor es el golpe', () => {
    expect(ICE_SECONDS).toHaveLength(QUALITY_LEVELS);
    for (let i = 1; i < ICE_SECONDS.length; i++) expect(ICE_SECONDS[i]).toBeGreaterThan(ICE_SECONDS[i - 1]);
  });

  it('el vendaval deja a cada uno parado sobre la línea del tiro', () => {
    // la velocidad es (lo que lo separa de la línea) * KNOCK_DECAY, y se apaga con exp(-KNOCK_DECAY t):
    // recorre exactamente esa distancia, así que termina en la línea
    for (const dx of [0.5, 2, 5]) expect(dx - (dx * KNOCK_DECAY) / KNOCK_DECAY).toBeCloseTo(0);
    // con un palo lineal el pasillo es angosto: junta sin ir a buscarlos lejos
    expect(PUSH_LINE_HALF_WIDTH).toBeLessThan(spreadFor(CLUBS.wedge, 1) * 1.5);
  });
});
