import { afterEach, describe, expect, it } from 'vitest';
import { BALL_RADIUS, launch, launchSpeed, launchWith, previewOver, stepBall, type BallState } from './ballistics';
import { COURSES, course, FLAT_UNTIL_Z, heightAt, normalAt, pickCourse, raycastTerrain, relief, reliefAt } from './terrain';

const rad = (deg: number) => (deg * Math.PI) / 180;
const params = { restitution: 0.3, bounceKeep: 0.8 };

function fly(s: BallState, ground: (x: number, z: number) => number, seconds = 6): BallState {
  for (let t = 0; t < seconds && !s.resting; t += 1 / 240) stepBall(s, 1 / 240, params, ground);
  return s;
}

describe('terrain', () => {
  afterEach(() => { pickCourse('1'); });

  it('?plano es el plano de siempre; con campo, hay lomas y un valle', () => {
    const hill = COURSES[0].hills[0];
    pickCourse('plano');
    expect(heightAt(hill.x, hill.z)).toBe(0);
    pickCourse('1');
    expect(heightAt(hill.x, hill.z)).toBeGreaterThan(1.8);
    expect(heightAt(COURSES[0].valleys[0].x, 40)).toBeLessThan(-0.7);
  });

  it('un número elige campo y sin número sale uno cualquiera, siempre de la lista', () => {
    for (let i = 1; i <= COURSES.length; i++) expect(pickCourse(String(i))).toBe(COURSES[i - 1]);
    // da la vuelta, así que ?campo=99 no rompe
    expect(pickCourse('99')).toBe(COURSES[(99 - 1) % COURSES.length]);
    for (let i = 0; i < 30; i++) expect(COURSES).toContain(pickCourse(null));
  });

  it('en todos los campos, cerca de los puestos y de la muralla el piso es plano', () => {
    for (let c = 1; c <= COURSES.length; c++) {
      pickCourse(String(c));
      for (let x = -30; x <= 30; x += 3) for (let z = -5; z <= FLAT_UNTIL_Z; z += 1) expect(reliefAt(x, z)).toBe(0);
    }
  });

  it('en todos los campos las pendientes son suaves: se puede caminar y la pelota no queda rodando', () => {
    for (let c = 1; c <= COURSES.length; c++) {
      pickCourse(String(c));
      let steepest = 0;
      for (let x = -25; x <= 25; x += 0.5) for (let z = 10; z <= 70; z += 0.5) {
        const n = normalAt(x, z, reliefAt);
        steepest = Math.max(steepest, Math.hypot(n.x, n.z) / n.y);
      }
      expect(steepest, course().name).toBeLessThan(0.4); // por debajo de la fricción del rodado sobre la gravedad (9 / 22)
    }
  });

  it('el rayo del mouse encuentra el terreno, también sobre una loma', () => {
    pickCourse('1');
    const hill = COURSES[0].hills[1];
    const from = { x: hill.x, y: 30, z: hill.z - 30 };
    const len = Math.hypot(30, 30);
    const hit = raycastTerrain(from, { x: 0, y: -30 / len, z: 30 / len }, 300, reliefAt)!;
    expect(hit.y).toBeCloseTo(reliefAt(hit.x, hit.z), 2);
    // sobre el plano el rayo habría llegado justo al centro de la loma; con la loma, la toca antes
    expect(hit.z).toBeLessThan(hill.z);
    expect(hit.y).toBeGreaterThan(1.5);
  });
});

describe('pelota sobre terreno', () => {
  const flat = () => 0;

  it('sobre un terreno plano vuela igual que sin terreno', () => {
    const a = launch({ x: 0, y: 0, z: 0 }, 0, 1, 30, rad(30));
    const b = launch({ x: 0, y: 0, z: 0 }, 0, 1, 30, rad(30));
    for (let i = 0; i < 400; i++) {
      stepBall(a, 1 / 120, params);
      stepBall(b, 1 / 120, params, flat);
    }
    expect(b.pos.x).toBeCloseTo(a.pos.x, 3);
    expect(b.pos.z).toBeCloseTo(a.pos.z, 3);
    expect(b.bounces).toBe(a.bounces);
  });

  it('una loma frena al tiro rasante: la pelota no llega atrás por el piso', () => {
    const wall = (_x: number, z: number) => 2.5 * Math.exp(-0.5 * ((z - 30) / 4) ** 2);
    const speed = launchSpeed(60, rad(3.5));
    const s = launchWith({ x: 0, y: BALL_RADIUS, z: 0 }, 0, 1, speed, rad(3.5));
    let firstTouchZ = -1;
    for (let t = 0; t < 3 && firstTouchZ < 0; t += 1 / 480) if (stepBall(s, 1 / 480, params, wall)) firstTouchZ = s.pos.z;
    expect(firstTouchZ).toBeGreaterThan(18);
    expect(firstTouchZ).toBeLessThan(30); // la toca en la subida, antes de la cima
    expect(s.vel.y).toBeGreaterThan(0); // y rebota hacia arriba, por encima de lo que haya detrás
  });

  it('un globo calculado con la diferencia de altura cae donde se apuntó, arriba de una loma o en un pozo', () => {
    for (const rise of [2, -1.5]) {
      const target = 25;
      const ground = (_x: number, z: number) => rise * Math.min(1, Math.max(0, (z - 10) / 5));
      const v = launchSpeed(target, rad(45), 50, rise);
      const s = launchWith({ x: 0, y: BALL_RADIUS, z: 0 }, 0, 1, v, rad(45));
      let landedAt = -1;
      for (let t = 0; t < 5 && landedAt < 0; t += 1 / 480) if (stepBall(s, 1 / 480, { restitution: 0, bounceKeep: 0, gravity: 50 }, ground)) landedAt = s.pos.z;
      expect(landedAt).toBeGreaterThan(target - 0.4);
      expect(landedAt).toBeLessThan(target + 0.4);
    }
  });

  it('rodando, la pendiente la lleva cuesta abajo y termina quieta', () => {
    const slope = (x: number) => -0.2 * x;
    const s: BallState = { pos: { x: 0, y: BALL_RADIUS, z: 0 }, vel: { x: 0, y: 0, z: 3 }, rolling: true, resting: false, bounces: 1 };
    fly(s, (x) => slope(x));
    expect(s.resting).toBe(true);
    expect(s.pos.x).toBeGreaterThan(0.05);
    expect(s.pos.y).toBeCloseTo(slope(s.pos.x) + BALL_RADIUS, 3);
  });

  it('la línea de tiro se corta donde el tiro toca el terreno', () => {
    const wall = (_x: number, z: number) => 2.5 * Math.exp(-0.5 * ((z - 30) / 4) ** 2);
    const s = launchWith({ x: 0, y: BALL_RADIUS, z: 0 }, 0, 1, launchSpeed(60, rad(3.5)), rad(3.5));
    const path = previewOver(s, 22, wall, 24);
    expect(path).toHaveLength(25);
    const end = path[path.length - 1];
    expect(end.z).toBeLessThan(30);
    expect(end.y).toBeCloseTo(wall(0, end.z) + BALL_RADIUS, 1);
  });
});
