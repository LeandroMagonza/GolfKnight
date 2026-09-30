// Pelotas en juego: física de core/ballistics y choques contra la horda, según cómo entrega el palo.
//
// Dos cosas independientes: si el palo **atraviesa** (le pega a cada uno que toca en el aire y sigue: el
// driver) y si **abre un área** (el hierro y el wedge, más grande cuanto más alto vuela). Los palos ya
// no llevan poder: el hielo, el viento y la granada van con su propia pelota (ver game/abilities).
import * as THREE from 'three';
import { applySpin, BALL_RADIUS, launch, launchWith, ROLL_FRICTION, spinFor, stepBall, type BallState, type BounceParams, type Spin } from '../core/ballistics';
import { burnSeconds, ELEMENTS, lv, type Element } from '../core/abilities';
import { areaDamageFor, damageFor, hasArea, rollFrictionFor, spreadFor, type Club } from '../core/clubs';
import type { Effects } from './effects';
import type { Enemy, Horde } from './enemies';
import type { Shot } from './player';
import type { Traps } from './traps';
import { heightAt, terrainOn } from '../core/terrain';
import { FIELD_HALF_WIDTH, GATE_Z, TEE_LINE_Z } from './world';
import { SHIELD_TOP } from '../core/shield';
import { bounceOffEnemy, MAX_BALL_SPEED, stepTennis, TENNIS, type TennisPhase } from '../tennis/bounce';

const TRAIL_POINTS = 18;
const MAX_STEP = 0.3;
/** Segundos después de los cuales un tiro ya se da por jugado. */
const SETTLE_AFTER = 1.8;

export interface Ball {
  state: BallState;
  club: Club;
  /** Rebote y rodado ya resueltos para este tiro: la fricción depende del nivel del golpe. */
  bounce: BounceParams;
  /** Nivel de calidad del golpe: 1, 2 o 3. */
  quality: number;
  /** De dónde salió, para saber a qué distancia pega. */
  from: THREE.Vector3;
  /** Tiros de habilidad (palo y elemento): el elemento que deja en cada uno que alcanza. */
  element: Element | null;
  /** Es de una habilidad, no del puesto: no cuenta para las rachas. */
  ability: boolean;
  /** A quiénes ya tocó el rayo de esta pelota: nunca salta dos veces al mismo. */
  zapped: Set<number>;
  /** Driver de viento: hacia dónde sale, cuántos metros ya barrió el viento y a quiénes ya acomodó. */
  dir: THREE.Vector3;
  windSwept: number;
  windCaught: Set<number>;
  /** Efecto: la curva del tiro, y cuánto va de ella. */
  spin: Spin | null;
  spinTime: number;
  hitIds: Set<number>;
  hits: number;
  /** Daño de más a cada uno que alcanza (la potencia). */
  bonus: number;
  /** Ya abrió su área: no la vuelve a abrir aunque siga rodando. */
  burst: boolean;
  /** Enemigos que mató esta pelota. */
  kills: number;
  /** Ya le pegó a alguien (evento 'connected'): para las rachas de tiros sin errar. */
  connected: boolean;
  /**
   * Sale con el bonus de la mejora «En racha». Se decide la primera vez que pega, no al tirarla: así
   * cuentan los tiros anteriores que conectaron mientras esta volaba. Undefined = todavía no pegó.
   */
  hot?: boolean;
  /** Ya se avisó cómo le fue (evento 'settled'). */
  settled: boolean;
  age: number;
  restTime: number;
  mesh: THREE.Mesh;
  trail: THREE.Line;
  trailPositions: Float32Array;
  done: boolean;
  /** Modo tenis: la pelota que rebota y vuelve (ver src/tennis). Null en las del golf. */
  phase: TennisPhase | null;
  /** Modo tenis: cuántas veces se la devolvió el tenista. Cada `TENNIS.rallyStep`, pega 1 más. */
  rally: number;
  /** Modo tenis: la que pasó de largo vuelve a la línea por el aire, como tirada por un alcanzapelotas. */
  toss?: { from: THREE.Vector3; to: THREE.Vector3; t: number };
}

export type BallEvent =
  /** Un palo le pegó a alguien. */
  | { type: 'hit'; club: Club; enemy: Enemy; pos: THREE.Vector3; damage: number; quality: number; killed: boolean }
  /** Un palo de área abrió su área. */
  | { type: 'land'; pos: THREE.Vector3; hits: number; quality: number }
  | { type: 'bounce'; pos: THREE.Vector3 }
  | { type: 'blocked'; enemy: Enemy; warded: boolean }
  /** Un tiro le pegó a alguien por primera vez. Sale apenas pega, sin esperar a que la pelota pare. */
  | { type: 'connected'; ability: boolean }
  /** Un tiro ya se jugó: a cuántos alcanzó y cuántas bajas hizo. */
  | { type: 'settled'; club: Club; hits: number; kills: number; ability: boolean }
  /** Tenis: la pelota rebotó en un enemigo y viene de vuelta, o pegó en una pared. */
  | { type: 'returned'; ball: Ball }
  | { type: 'wall'; ball: Ball }
  /** Tenis: la pelota quedó en el piso para levantarla, o se perdió (se la llevan los alcanzapelotas). */
  | { type: 'floor'; ball: Ball }
  | { type: 'lost'; ball: Ball };

const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 12, 10);
/** Tenis: hacia dónde empuja la pelota que vuelve a los que atraviesa. */
const AWAY = new THREE.Vector3(0, 0, 1);
/** Tenis: tope de pasos por cuadro, cuánto tarda en volver a la línea la que pasó de largo, y el color de la pared del fondo. */
const MAX_TENNIS_STEPS = 60;
const TOSS_TIME = 0.6;
export const MAGIC_WALL_COLOR = 0x9d7bff;

/** Tenis: el golpe plano sale de la altura de la raqueta, rasante y a la velocidad del nivel del golpe. */
function tennisLaunch(shot: Shot): BallState {
  const speed = TENNIS.outSpeed[Math.min(TENNIS.outSpeed.length, Math.max(1, shot.quality)) - 1];
  const dir = new THREE.Vector3(shot.dir.x, 0, shot.dir.z).normalize();
  return {
    pos: { x: shot.from.x, y: 0.9, z: shot.from.z },
    vel: { x: dir.x * speed, y: 0, z: dir.z * speed },
    rolling: false, resting: false, bounces: 0,
  };
}

export class Balls {
  readonly list: Ball[] = [];
  onEvent: ((e: BallEvent) => void) | null = null;
  /**
   * El daño de un tiro de palo con la mejora «En racha»: recibe el daño de la tabla y devuelve el que
   * pega. Null si no está en racha. Las habilidades nunca pasan por acá.
   */
  hotDamage: ((base: number) => number) | null = null;
  /** Tótems: en pausa (ver core/clubs). El módulo sigue vivo para poder volver a prenderlo. */
  traps: Traps | null = null;

  constructor(private readonly scene: THREE.Scene, private readonly horde: Horde, private readonly effects: Effects) {}

  /** @param lift velocidad y ángulo de salida ya calculados contra el terreno, con relieve */
  fire(shot: Shot, range: number, lift: { speed: number; angle: number } | null = null): Ball {
    const loft = THREE.MathUtils.degToRad(shot.club.loftDeg);
    // la fricción del rodado sale del nivel del golpe: con el putter, cuanto mejor le pegás, más rápido va
    const bounce: BounceParams = {
      restitution: shot.club.restitution,
      bounceKeep: shot.club.bounceKeep,
      gravity: shot.club.gravity,
      rollFriction: rollFrictionFor(shot.club, shot.quality),
    };
    // el plano del tenis sale rasante y a velocidad fija, y vuela con su propia física (ver src/tennis).
    // Los tiros de habilidad con elemento no: esos son de una vez y no vuelven
    const tennis = !!shot.club.returns && !shot.element;
    const state = tennis
      ? tennisLaunch(shot)
      : lift
      ? launchWith({ x: shot.from.x, y: heightAt(shot.from.x, shot.from.z) + BALL_RADIUS, z: shot.from.z }, shot.dir.x, shot.dir.z, lift.speed, lift.angle)
      : launch({ x: shot.from.x, y: BALL_RADIUS, z: shot.from.z }, shot.dir.x, shot.dir.z, range, loft, shot.club.gravity, bounce.rollFriction);
    const color = shot.club.color;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: shot.quality >= 3 ? 1.6 : 0.7 });
    const mesh = new THREE.Mesh(ballGeo, mat);
    mesh.position.set(state.pos.x, state.pos.y, state.pos.z);
    const trailPositions = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i++) trailPositions.set([state.pos.x, state.pos.y, state.pos.z], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    trail.frustumCulled = false;
    this.scene.add(mesh, trail);
    // el efecto curva hacia la derecha de la pantalla, que es el costado (-dz, dx) de la dirección
    const spin = tennis ? null : spinFor(state, range, shot.curve, -shot.dir.z, shot.dir.x, bounce.rollFriction ?? ROLL_FRICTION);
    const ball: Ball = {
      state, club: shot.club, bounce, quality: shot.quality,
      from: shot.from.clone(), spin, spinTime: 0,
      element: shot.element ?? null, ability: !!shot.ability, zapped: new Set(),
      dir: new THREE.Vector3(shot.dir.x, 0, shot.dir.z).normalize(), windSwept: 0, windCaught: new Set(),
      hitIds: new Set(), hits: 0, bonus: shot.bonus ?? 0, burst: false, kills: 0, connected: false, settled: false, age: 0, restTime: 0, mesh, trail, trailPositions, done: false,
      phase: tennis ? 'out' : null, rally: 0,
    };
    this.list.push(ball);
    return ball;
  }

  /** El daño con el que pega esta pelota: el de la tabla, o el de «En racha» si le toca. */
  private damageOf(ball: Ball, base: number): number {
    // la potencia suma a cada uno que alcanza (a la pifia no: esa no sale)
    if (base > 0 && ball.bonus) base += ball.bonus;
    // la racha del tenis: cada tantas devoluciones de la misma pelota, pega uno más
    if (base > 0 && ball.rally) base += Math.floor(ball.rally / TENNIS.rallyStep);
    if (ball.ability) return base;
    if (ball.hot === undefined) ball.hot = this.hotDamage !== null;
    return ball.hot && this.hotDamage ? this.hotDamage(base) : base;
  }

  /** Avisa una sola vez por pelota que conectó con alguien. */
  private checkConnected(ball: Ball): void {
    if (ball.connected || ball.hits <= 0) return;
    ball.connected = true;
    this.onEvent?.({ type: 'connected', ability: ball.ability });
  }

  /** A qué distancia del golfista pegó: es lo que decide cuánto hace el palo. */
  private metersTo(ball: Ball, pos: { x: number; z: number }): number {
    return Math.hypot(pos.x - ball.from.x, pos.z - ball.from.z);
  }

  /**
   * La pelota llegó (al piso o a un enemigo): abre su área acá. `finish` dice si con eso se termina el
   * tiro (el globo se queda donde cayó) o si la pelota sigue viaje rodando (el hierro que atraviesa).
   */
  private burst(ball: Ball, finish = true, at?: { x: number; y: number; z: number }): void {
    ball.burst = true;
    const pos = new THREE.Vector3(at?.x ?? ball.state.pos.x, at?.y ?? ball.state.pos.y, at?.z ?? ball.state.pos.z);
    const radius = spreadFor(ball.club, ball.quality);
    this.effects.explosion(pos, radius, ball.club.color);
    // el área pega menos que el impacto: agarra a varios y no hay que apuntarle a nadie. Al que esta
    // misma pelota ya golpeó no le toca otra vez: un tiro es un daño por enemigo
    const damage = this.damageOf(ball, areaDamageFor(ball.club, this.metersTo(ball, pos), ball.quality));
    this.horde.shot = { club: ball.club.id, quality: ball.quality, ability: ball.ability };
    const hits = this.horde.blast(pos, radius, damage, ball.club.knockback, null, ball.hitIds, (e) => this.applyElement(ball, e), (e) => this.burnBlocked(ball, e));
    this.horde.shot = null;
    this.onEvent?.({ type: 'land', pos, hits, quality: ball.quality });
    if (ball.element === 'wind') this.windBurst(ball, pos);
    ball.hits += hits;
    this.checkConnected(ball);
    if (finish) ball.done = true;
  }

  /**
   * El pelotazo a un enemigo puntual, con el número de **impacto** (no el del área). `finish` dice si con
   * eso se termina el tiro: el que atraviesa sigue, y pierde un poco de velocidad.
   */
  private directHit(ball: Ball, enemy: Enemy, finish: boolean, guard = 0, push?: THREE.Vector3): boolean {
    const s = ball.state;
    ball.hitIds.add(enemy.id);
    const pos = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
    this.effects.spark(pos, ball.club.color);
    const dir = push ?? new THREE.Vector3(s.vel.x, 0, s.vel.z).normalize();
    const damage = this.damageOf(ball, damageFor(ball.club, this.metersTo(ball, s.pos), ball.quality));
    this.horde.shot = { club: ball.club.id, quality: ball.quality, ability: ball.ability };
    const killed = this.horde.damage(enemy, damage, dir, ball.club.knockback, false, guard);
    this.horde.shot = null;
    // contra el escudo, si no pasó nada no es un golpe: para las rachas es como errar
    const landed = guard === 0 || this.horde.lastDealt > 0;
    if (landed) ball.hits++;
    if (killed) ball.kills++;
    this.checkConnected(ball);
    if (landed) this.onEvent?.({ type: 'hit', club: ball.club, enemy, pos, damage, quality: ball.quality, killed });
    if (landed) this.applyElement(ball, enemy);
    if (finish) ball.done = true;
    return landed;
  }

  /**
   * El elemento de un tiro de habilidad, en uno que alcanzó (de impacto o de área). El nivel de la
   * habilidad es la calidad del tiro, y decide cuánto dura el frío o el fuego y cuántas veces salta el
   * rayo.
   */
  private applyElement(ball: Ball, enemy: Enemy): void {
    // el viento no es de a uno: va detrás de la pelota o donde revienta (windTrail, windBurst)
    if (!ball.element || ball.element === 'wind') return;
    if (ball.element === 'ice') this.horde.applyIce(enemy, lv(ELEMENTS.iceSeconds, ball.quality));
    else if (ball.element === 'fire') enemy.burn(burnSeconds(lv(ELEMENTS.burnTicks, ball.quality)));
    else if (ball.element === 'lightning') this.horde.chain(enemy, lv(ELEMENTS.chainJumps, ball.quality), ball.zapped);
  }

  /** Al que el escudo le paró el golpe, el fuego lo prende igual. */
  private burnBlocked(ball: Ball, enemy: Enemy): void {
    if (ball.element === 'fire') enemy.burn(burnSeconds(lv(ELEMENTS.burnTicks, ball.quality)));
  }

  /**
   * El viento donde revienta la pelota: con el wedge, un remolino que los amontona; con el hierro, una
   * ráfaga que los manda para atrás, hacia donde iba el tiro.
   */
  private windBurst(ball: Ball, pos: THREE.Vector3): void {
    const level = ball.quality;
    if (ball.club.id === 'wedge') {
      const radius = lv(ELEMENTS.windPull, level);
      this.horde.whirl(pos, radius);
      this.effects.swipe(pos, radius);
    } else if (ball.club.id === 'iron') {
      this.horde.gust(pos, ELEMENTS.windPushRadius, ball.dir, lv(ELEMENTS.windPush, level));
      this.effects.swipe(pos, ELEMENTS.windPushRadius);
    }
  }

  /**
   * Driver de viento: el viento va **detrás** de la pelota y barre el tramo que ya pasó, así que a cada
   * uno lo acomoda después de que la pelota le pegó: los junta sobre la línea del tiro para el próximo.
   */
  private windTrail(ball: Ball): void {
    const s = ball.state;
    const gone = (s.pos.x - ball.from.x) * ball.dir.x + (s.pos.z - ball.from.z) * ball.dir.z;
    if (gone <= ball.windSwept) return;
    const half = lv(ELEMENTS.windLine, ball.quality);
    const mid = ball.from.clone().addScaledVector(ball.dir, (ball.windSwept + gone) / 2);
    mid.y = heightAt(mid.x, mid.z);
    this.horde.sweep(mid, ball.dir, half, (gone - ball.windSwept) / 2, ball.windCaught);
    // un remolino cada tantos metros: uno por cuadro sería una nube continua
    if (Math.floor(gone / 6) > Math.floor(ball.windSwept / 6)) this.effects.swipe(new THREE.Vector3(s.pos.x, heightAt(s.pos.x, s.pos.z), s.pos.z), half);
    ball.windSwept = gone;
  }

  /** La pelota tocó a alguien: según el palo, lo atraviesa, revienta ahí, o le pega solo a él. */
  private hitEnemy(ball: Ball, enemy: Enemy): void {
    // tenis: de ida, el primero que toca la devuelve; de vuelta, atraviesa a los que se cruce y los
    // empuja para atrás (si no, la vuelta te los traía hacia la puerta)
    if (ball.phase === 'out') {
      this.directHit(ball, enemy, false);
      // con los enemigos que no rebotan, los atraviesa y la devuelve la pared del fondo
      if (TENNIS.enemyBounce) this.sendBack(ball, enemy);
      return;
    }
    if (ball.phase === 'back') {
      this.directHit(ball, enemy, false, 0, AWAY);
      return;
    }
    // los que no atraviesan terminan en el primero que tocan. Si abren área, revientan **al ras del
    // piso, abajo del enemigo**, que es lo que se ve; si no, le pegan a él solo.
    if (!ball.club.pierces) {
      if (hasArea(ball.club)) {
        // El que se come el pelotazo cobra el **impacto**, que pega más; los de alrededor, el área.
        // Queda marcado en hitIds, así que la explosión no le cobra de nuevo: un daño por enemigo.
        this.directHit(ball, enemy, false);
        // el globo detona donde cayó, que es adonde apuntaste; el que revienta al contacto, en el enemigo
        const at = ball.club.burstsOnGround ? undefined : { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z };
        this.burst(ball, true, at);
      } else {
        this.directHit(ball, enemy, true);
      }
      return;
    }
    // el que atraviesa: a cada uno que toca le cobra el pelotazo y sigue
    this.directHit(ball, enemy, ball.hits + 1 >= ball.club.maxHits);
    if (!ball.done) {
      ball.state.vel.x *= 0.88;
      ball.state.vel.z *= 0.88;
    }
  }

  /**
   * Tenis: rebota como en un ladrillo (un enemigo, o la pared del fondo) y viene de vuelta hacia el
   * tenista, a la velocidad de vuelta.
   */
  private sendBack(ball: Ball, enemy: Enemy | null): void {
    const s = ball.state;
    const v = bounceOffEnemy(s.vel.x, s.vel.z, Math.min(MAX_BALL_SPEED, TENNIS.backSpeed));
    s.vel.x = v.vx;
    s.vel.z = v.vz;
    // que no lo vuelva a tocar al salir, pero sí a los demás, aunque ya les haya pegado de ida
    ball.hitIds.clear();
    if (enemy) ball.hitIds.add(enemy.id);
    ball.phase = 'back';
    this.onEvent?.({ type: 'returned', ball });
  }

  private collide(ball: Ball): void {
    const s = ball.state;
    for (const e of this.horde.enemies) {
      if (!e.alive || e.passed || ball.hitIds.has(e.id)) continue;
      // la altura se mide desde los pies del enemigo, que con relieve no están en y = 0
      if (s.pos.y - e.position.y > e.height + BALL_RADIUS) continue;
      const dx = s.pos.x - e.position.x;
      const dz = s.pos.z - e.position.z;
      const r = e.radius + BALL_RADIUS;
      if (dx * dx + dz * dz > r * r) continue;
      // El escudo, o el aura de un chamán, devuelven **cualquier** pelota que les llegue de frente, no
      // solo la que atraviesa: si no, el hierro reventaba contra el escudo y lo mataba igual. Lo único
      // que lo pasa es lo que cae casi a plomo, que es el globo del wedge (ver Enemy.blocks).
      // El hierro que le llega por encima del escudo (a la cabeza) no rebota: le pega y revienta ahí
      const overShield = ball.club.id === 'iron' && s.pos.y - e.position.y > e.height * SHIELD_TOP;
      if (ball.phase === 'back' && e.warded) {
        // de vuelta el aura la deja pasar, sin daño
        ball.hitIds.add(e.id);
        continue;
      }
      // de vuelta le llega por la espalda: el escudo de frente no la para
      if (ball.phase !== 'back' && (e.warded || (e.blocks(s.vel.x, s.vel.y, s.vel.z) && !overShield))) {
        // el escudo frena la pelota igual (rebota), pero es blindaje de frente: lo que pasa de su
        // número entra. El muro y el aura del chamán no dejan pasar nada
        const leaked = !e.warded && !e.shieldWall && this.directHit(ball, e, false, e.shieldLevel);
        ball.hitIds.add(e.id);
        // el fuego prende igual: el escudo para la pelota, no las llamas
        if (!leaked) this.burnBlocked(ball, e);
        this.effects.spark(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z), e.warded ? 0xb26bff : 0xcccccc);
        if (!leaked) this.onEvent?.({ type: 'blocked', enemy: e, warded: e.warded || e.shieldWall });
        // la del tenis rebota en el escudo igual que en el enemigo: vuelve
        if (ball.phase === 'out') {
          this.sendBack(ball, e);
          continue;
        }
        const n = Math.hypot(dx, dz) || 1;
        const dot = (s.vel.x * dx + s.vel.z * dz) / n;
        s.vel.x = (s.vel.x - (2 * dot * dx) / n) * 0.4;
        s.vel.z = (s.vel.z - (2 * dot * dz) / n) * 0.4;
        continue;
      }
      this.hitEnemy(ball, e);
      if (ball.done) return;
    }
  }

  private drawBall(ball: Ball): void {
    const s = ball.state;
    ball.mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
    const t = ball.trailPositions;
    t.copyWithin(3, 0, t.length - 3);
    t[0] = s.pos.x;
    t[1] = s.pos.y;
    t[2] = s.pos.z;
    ball.trail.geometry.attributes.position.needsUpdate = true;
    // quieta en el piso, sin estela
    ball.trail.visible = ball.phase !== 'floor';
  }

  private settle(ball: Ball): void {
    if (ball.settled) return;
    ball.settled = true;
    this.onEvent?.({ type: 'settled', club: ball.club, hits: ball.hits, kills: ball.kills, ability: ball.ability });
  }

  /** Tenis: las que vienen de vuelta, que el tenista puede devolver. */
  get returning(): Ball[] {
    return this.list.filter((b) => !b.done && b.phase === 'back');
  }

  /** Tenis: las que están quietas en el piso, para levantarlas (no las que todavía vienen por el aire). */
  get onFloor(): Ball[] {
    return this.list.filter((b) => !b.done && b.phase === 'floor' && !b.toss);
  }

  /** Saca una pelota sin que cuente como tiro jugado: el tenista la devolvió o la levantó. */
  retire(ball: Ball): void {
    ball.settled = true;
    ball.done = true;
  }

  /** Tenis: la atrapa la raqueta: queda quieta ahí hasta el impacto del golpe (ver main, `catchBall`). */
  hold(ball: Ball): void {
    ball.phase = 'held';
    ball.state.vel.x = 0;
    ball.state.vel.y = 0;
    ball.state.vel.z = 0;
  }

  /** Tenis: la manda por el aire a la línea del tenista, donde queda para levantarla. */
  toLine(ball: Ball): void {
    const s = ball.state;
    const edge = FIELD_HALF_WIDTH - 1;
    ball.phase = 'floor';
    ball.toss = {
      from: new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z),
      to: new THREE.Vector3(THREE.MathUtils.clamp(s.pos.x, -edge, edge), BALL_RADIUS, TEE_LINE_Z - 0.5),
      t: 0,
    };
    s.vel.x = 0;
    s.vel.y = 0;
    s.vel.z = 0;
  }

  /** Tenis: un paso de la pelota que rebota. */
  private updateTennis(ball: Ball, dt: number): void {
    const s = ball.state;
    if (ball.phase === 'held') return;
    if (ball.phase === 'floor') {
      // volando a la línea: una parábola corta, y al llegar queda para levantarla
      const toss = ball.toss;
      if (!toss) return;
      toss.t = Math.min(1, toss.t + dt / TOSS_TIME);
      s.pos.x = toss.from.x + (toss.to.x - toss.from.x) * toss.t;
      s.pos.z = toss.from.z + (toss.to.z - toss.from.z) * toss.t;
      s.pos.y = toss.from.y + (toss.to.y - toss.from.y) * toss.t + Math.sin(toss.t * Math.PI) * 2.4;
      if (toss.t >= 1) {
        ball.toss = undefined;
        this.onEvent?.({ type: 'floor', ball });
      }
      return;
    }
    // con números locos en el panel se aceleraba sin fin y se colgaba: tope de velocidad y de pasos
    const speed = Math.hypot(s.vel.x, s.vel.z);
    if (speed > MAX_BALL_SPEED) {
      s.vel.x *= MAX_BALL_SPEED / speed;
      s.vel.z *= MAX_BALL_SPEED / speed;
    }
    const steps = Math.min(MAX_TENNIS_STEPS, Math.max(1, Math.ceil((Math.min(speed, MAX_BALL_SPEED) * dt) / MAX_STEP)));
    const wallZ = TEE_LINE_Z + TENNIS.backWall;
    const moving = () => ball.phase === 'out' || ball.phase === 'back';
    for (let i = 0; i < steps && !ball.done && moving(); i++) {
      if (stepTennis(s, dt / steps, FIELD_HALF_WIDTH, 0, TENNIS.hop)) this.onEvent?.({ type: 'wall', ball });
      // la pared mágica del fondo devuelve todo lo que llega
      if (ball.phase === 'out' && s.pos.z >= wallZ && s.vel.z > 0) {
        s.pos.z = wallZ;
        this.sendBack(ball, null);
        this.effects.blink(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z), MAGIC_WALL_COLOR);
      }
      this.collide(ball);
      // pasó de largo: se va hasta la muralla y un alcanzapelotas la tira a la línea
      if (ball.phase === 'back' && s.pos.z < GATE_Z + 2) this.toLine(ball);
    }
    if (ball.age > 60) this.lose(ball);
  }

  private lose(ball: Ball): void {
    if (ball.done) return;
    ball.done = true;
    this.onEvent?.({ type: 'lost', ball });
  }

  update(dt: number): void {
    for (const ball of this.list) {
      const s = ball.state;
      ball.age += dt;
      if (ball.phase) {
        this.updateTennis(ball, dt);
        if (ball.age >= SETTLE_AFTER) this.settle(ball);
        this.drawBall(ball);
        continue;
      }
      const speed = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
      const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
      for (let i = 0; i < steps && !ball.done && !s.resting; i++) {
        applySpin(s, ball.spin, ball.spinTime, dt / steps);
        ball.spinTime += dt / steps;
        const landed = stepBall(s, dt / steps, ball.bounce, terrainOn() ? heightAt : undefined);
        // la muralla devuelve la pelota
        if (s.pos.z < GATE_Z - 0.4 && s.vel.z < 0) {
          s.pos.z = GATE_Z - 0.4;
          s.vel.z *= -0.5;
        }
        if (landed) {
          // solo el globo abre su área por tocar el piso; los demás tienen que conectar con alguien
          if (ball.club.burstsOnGround && hasArea(ball.club) && ball.club.loftDeg > 0.001 && !ball.burst) {
            this.burst(ball, ball.club.stopsOnLand);
            if (ball.done) break;
          }
          if (s.bounces === 1) this.onEvent?.({ type: 'bounce', pos: new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z) });
        }
        this.collide(ball);
      }
      if (ball.element === 'wind' && ball.club.id === 'driver' && !ball.done) this.windTrail(ball);
      // la que para sin haber tocado a nadie y abre área por el piso (el globo) hace su efecto ahí
      if (s.resting && !ball.done && !ball.burst && ball.club.burstsOnGround && hasArea(ball.club)) this.burst(ball);
      if (s.resting) ball.restTime += dt;
      if (ball.restTime > 1.2 || ball.age > 14 || Math.abs(s.pos.x) > 90 || s.pos.z > 150) ball.done = true;
      if (ball.done || s.resting || ball.age >= SETTLE_AFTER) this.settle(ball);
      this.drawBall(ball);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const ball = this.list[i];
      if (!ball.done) continue;
      this.scene.remove(ball.mesh, ball.trail);
      (ball.mesh.material as THREE.Material).dispose();
      ball.trail.geometry.dispose();
      (ball.trail.material as THREE.Material).dispose();
      this.list.splice(i, 1);
    }
  }
}
