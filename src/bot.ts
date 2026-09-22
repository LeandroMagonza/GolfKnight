// Bot que juega solo, para chequear el balance y para mirarlo jugar. Se activa con ?bot en la URL
// (http://localhost:5173/?bot) y lo usa tools/botplay.mjs. Maneja el juego como una persona: mueve el
// mouse, aprieta teclas y carga los tiros en tiempo real.
//
// Juega con el reparto nuevo: elige **palo** por la distancia a la que está el blanco (el driver cobra
// de lejos, el putter de cerca, el hierro y el wedge parejo) y **encantamiento** por la situación
// (escarcha para abrir defensas, vendaval cuando lo rodean, golpe el resto del tiempo). No busca filas
// ni clava el golpe, y suelta apuntando al nivel 2, así que es una cota inferior de lo que hace una persona.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Gk = any;

export interface BotStats {
  byClub: Record<string, number>;
  melee: number;
  moves: number;
  dodges: number;
  grabs: number;
  jumps: number;
}

/** Los palos se recorren con Q y E, así que el bot cuenta pasos hasta el que quiere. */
const CLUB_KEYS = ['driver', 'iron', 'wedge', 'putter'];

function key(code: string): void {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
}

export function startBot(): BotStats {
  const gk: Gk = (window as any).__gk;
  const stats: BotStats = { byClub: {}, melee: 0, moves: 0, dodges: 0, grabs: 0, jumps: 0 };
  (window as any).__bot = stats;

  // El bot apunta moviendo el mouse. Para que el mouse de quien mira no le corra la puntería, repite
  // su última posición en cada cuadro.
  let aimX = innerWidth / 2;
  let aimY = innerHeight / 3;
  const aim = (x: number, z: number) => {
    const s = gk.screenOf(x, z);
    aimX = s.x;
    aimY = s.y;
  };
  const holdAim = () => {
    dispatchEvent(new MouseEvent('mousemove', { clientX: aimX, clientY: aimY }));
    requestAnimationFrame(holdAim);
  };
  holdAim();

  let escaping = false;
  let dodgedAt = 0;
  let cardSince = 0;
  let pushedAt = -10;

  setInterval(() => {
    const pl = gk.player;
    // cartel de palo nuevo: lo deja un par de segundos, para que quien mira lo pueda leer, y lo cierra
    if (gk.cardOpen) {
      if (!cardSince) cardSince = performance.now();
      if (performance.now() - cardSince > 2500) {
        cardSince = 0;
        gk.dismissCard();
      }
      return;
    }
    if (!pl || gk.ended || gk.paused || !pl.alive || gk.director.index < 0) return;
    const p = pl.position;
    const dist = (e: any) => Math.hypot(e.position.x - p.x, e.position.z - p.z);

    // agarrado: la única salida es el palazo, que la suelta y la deja aturdida
    if (pl.grabbedBy) {
      if (escaping || pl.meleeCooldown > 0) return;
      escaping = true;
      stats.grabs++;
      key('ShiftLeft');
      stats.melee++;
      setTimeout(() => { escaping = false; }, 200);
      return;
    }
    // Nadie lo persigue, pero el que le pasa por encima lo atropella. Si uno viene derecho hacia su puesto:
    // palazo si está listo (lo manda 15 m atrás); si no, suelta lo que esté cargando y se corre dos puestos.
    const threat = gk.horde.enemies.find((e: any) => e.alive && !e.passed && e.state === 'walk' && (e.stats.behavior === 'melee' || e.stats.behavior === 'kamikaze')
      && e.position.z > p.z - 0.5 && e.position.z - p.z < 4.5 && Math.abs(e.position.x - p.x) < 1.8);
    if (threat && pl.atSpot && performance.now() - dodgedAt > 500) {
      dodgedAt = performance.now();
      if (pl.meleeCooldown <= 0 && pl.mode !== 'swinging' && threat.stats.behavior === 'melee' && dist(threat) < 3.2) {
        aim(threat.position.x, threat.position.z);
        stats.melee++;
        setTimeout(() => key('ShiftLeft'), 40);
        return;
      }
      stats.dodges++;
      if (pl.mode === 'charging') key('KeyX');
      const i = gk.tees.nearest(p.x);
      const up = i + 2 < gk.tees.spots.length && (i - 2 < 0 || threat.position.x < p.x);
      for (let n = 0; n < 2; n++) key(up ? 'KeyA' : 'KeyD');
      return;
    }
    if (pl.mode !== 'free' || !pl.atSpot) return;

    // sin pelota en este puesto: corre hasta la más cercana (A sube de puesto, D baja)
    const here = gk.tees.nearest(p.x);
    if (!gk.tees.hasBall(here)) {
      const to = gk.tees.nearestBall(here);
      if (to >= 0) {
        stats.moves++;
        for (let i = 0; i < Math.abs(to - here); i++) key(to > here ? 'KeyA' : 'KeyD');
      }
      return;
    }

    const alive: any[] = gk.horde.enemies.filter((e: any) => e.alive && !e.passed);
    if (!alive.length) return;

    const iceReady = pl.unlocked.has('iron') && pl.cooldowns.ice <= 0;
    const pushReady = pl.unlocked.has('wedge') && pl.cooldowns.push <= 0;
    let enchant = 'damage';
    let target: any = null;

    // 1) escarcha a quien haya que abrir: chamán conjurando, escudo sin hielo, jefe sin hielo
    if (iceReady) {
      target = alive.find((e) => e.casting && dist(e) < 50)
        ?? alive.filter((e) => e.stats.shield && !e.chilled && dist(e) < 50).sort((a, b) => a.position.z - b.position.z)[0]
        ?? alive.find((e) => e.stats.boss && !e.chilled && dist(e) < 50)
        ?? null;
      if (target) enchant = 'ice';
    }
    // 2) rodeado: el vendaval los junta sobre la línea y los saca de encima
    const near = alive.filter((e) => dist(e) < 9);
    if (!target && near.length >= 3 && pushReady && gk.clock - pushedAt > 3) {
      enchant = 'push';
      target = near.sort((a, b) => dist(b) - dist(a))[0];
      pushedAt = gk.clock;
    }
    // 3) un alma en pena que se le viene encima va primero: corre derecho hacia él, es un tiro fácil
    if (!target) target = alive.filter((e) => e.stats.behavior === 'grabber' && dist(e) < 32).sort((a, b) => dist(a) - dist(b))[0] ?? null;
    // 4) si no, al que tenga encima o al más avanzado que se pueda dañar
    if (!target) {
      const hittable = alive.filter((e) => !e.warded && !(e.stats.shield && !e.chilled && dist(e) > 6));
      const pool = hittable.length ? hittable : alive;
      target = pool.filter((e) => dist(e) < 7).sort((a, b) => dist(a) - dist(b))[0] ?? pool.sort((a, b) => a.position.z - b.position.z)[0];
    }

    // El palo lo decide la distancia, que es de donde sale el daño. Con un efecto en área conviene el
    // palo que más abre, mientras llegue.
    const d = dist(target);
    let club = 'driver';
    if (enchant !== 'damage') club = pl.unlocked.has('wedge') && d < 54 ? 'wedge' : 'iron';
    else if (d <= 12 && pl.unlocked.has('putter')) club = 'putter';
    else if (d <= 40 && pl.unlocked.has('iron')) club = 'iron';
    if (!pl.unlocked.has(club)) club = 'driver';
    // Q y E recorren los palos en círculo: cuenta el camino más corto
    const order = CLUB_KEYS.filter((id) => pl.unlocked.has(id));
    const from = order.indexOf(pl.club.id);
    const to = order.indexOf(club);
    if (from >= 0 && to >= 0 && from !== to) {
      const fwd = (to - from + order.length) % order.length;
      const back = order.length - fwd;
      for (let i = 0; i < Math.min(fwd, back); i++) key(fwd <= back ? 'KeyE' : 'KeyQ');
    }
    if (pl.enchant.id !== enchant) key(`Digit${['damage', 'ice', 'push'].indexOf(enchant) + 1}`);

    // La barra ya no tiene nada que ver con la distancia: apunta a soltar en el nivel 2, que es lo que
    // haría alguien sin clavarla. El alcance lo da el mouse.
    const want = 0.78;
    const chargeTime = club === 'wedge' ? 0.7 : club === 'putter' ? 0.6 : club === 'iron' ? 0.85 : 1;

    // Anticipación: mientras carga, pega y la pelota vuela, el enemigo sigue caminando hacia la puerta
    // (en diagonal, no derecho). Se apunta a donde va a estar.
    const speed = target.stats.speed * target.speedMul * (target.chilled ? 0.4 : 1);
    if (target.stats.behavior === 'grabber' && d > 3) {
      // viene hacia el golfista: se apunta un poco más acá sobre esa misma línea
      const k = Math.max(0.2, 1 - (speed * (0.6 + want)) / d);
      aim(p.x + (target.position.x - p.x) * k, p.z + (target.position.z - p.z) * k);
    } else if (target.target === 'gate' && speed > 0) {
      const lead = 0.12 + want * chargeTime + 0.4 + (club === 'driver' ? d / 90 : Math.sqrt((2 * d * 0.84) / 50));
      const gx = Math.max(-2.3, Math.min(2.3, target.position.x)) - target.position.x;
      const gz = 0.8 - target.position.z;
      const gl = Math.hypot(gx, gz) || 1;
      aim(target.position.x + (gx / gl) * speed * lead, Math.max(1, target.position.z + (gz / gl) * speed * lead));
    } else {
      aim(target.position.x, target.position.z);
    }

    setTimeout(() => {
      if (pl.mode !== 'free' || pl.grabbedBy) return;
      stats.byClub[club] = (stats.byClub[club] ?? 0) + 1;
      // Carga de verdad: mantiene apretado y suelta al llegar a la calidad buscada.
      pl.startSwing();
      const poll = () => {
        if (pl.mode !== 'charging') return;
        if (pl.meter.power >= want) pl.releaseSwing();
        else requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }, 120);
  }, 250);
  return stats;
}
