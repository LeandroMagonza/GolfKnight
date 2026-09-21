// Bot que juega solo, para chequear el balance y para mirarlo jugar. Se activa con ?bot en la URL
// (http://localhost:5173/?bot) y lo usa tools/botplay.mjs. Maneja el juego como una persona: mueve el
// mouse, aprieta teclas y carga los tiros en tiempo real.
//
// Juega con el reparto de palos del diseño: el driver cobra, el hierro abre (chamanes, escudos, jefe),
// el wedge se saca enemigos de encima, el palazo pega de cerca y el putter lo libera de un agarre. No
// busca filas: solo corre hasta la pelota más cercana, así que es una cota inferior de lo que hace una persona.

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

const KEYS: Record<string, string> = { driver: 'Digit1', iron: 'Digit2', wedge: 'Digit3' };

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

    // agarrado: apunta al otro lado del campo y salta con el putter
    if (pl.grabbedBy) {
      if (escaping || !pl.unlocked.has('putter')) return;
      escaping = true;
      stats.grabs++;
      aim(p.x > 0 ? -12 : 12, 20);
      setTimeout(() => {
        key('Space');
        stats.jumps++;
        escaping = false;
      }, 120);
      return;
    }
    // Nadie lo persigue, pero el que le pasa por encima lo atropella. Si uno viene derecho hacia su puesto:
    // palazo si está listo (lo manda 15 m atrás); si no, suelta lo que esté cargando y se corre dos puestos.
    const threat = gk.horde.enemies.find((e: any) => e.alive && !e.passed && !e.frozen && e.state === 'walk' && (e.stats.behavior === 'melee' || e.stats.behavior === 'kamikaze')
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

    const ironReady = pl.unlocked.has('iron') && pl.cooldowns.iron <= 0;
    const inIron = (e: any) => dist(e) > 7 && dist(e) < 39;
    let club = 'driver';
    let target: any = null;

    // 1) hielo a quien haga falta abrir: chamán conjurando, escudo sin hielo, jefe sin hielo
    if (ironReady) {
      target = alive.find((e) => e.casting && inIron(e))
        ?? alive.filter((e) => e.stats.shield && !e.chilled && inIron(e)).sort((a, b) => a.position.z - b.position.z)[0]
        ?? alive.find((e) => e.stats.boss && !e.chilled && inIron(e))
        ?? null;
      if (target) club = 'iron';
    }
    // 2) rodeado: el wedge los saca de encima (no daña, pero compra tiempo y los deja lejos)
    const near = alive.filter((e) => dist(e) < 8 && !e.stats.heavy);
    if (!target && near.length >= 3 && pl.unlocked.has('wedge') && gk.clock - pushedAt > 3) {
      club = 'wedge';
      target = near.sort((a, b) => dist(b) - dist(a))[0];
      pushedAt = gk.clock;
    }
    // 3) un alma en pena que se le viene encima va primero: corre derecho hacia él, es un tiro fácil
    if (!target) target = alive.filter((e) => e.stats.behavior === 'grabber' && dist(e) < 32).sort((a, b) => dist(a) - dist(b))[0] ?? null;
    // 4) si no, driver: al que tenga encima o, si no, al más avanzado que se pueda dañar
    if (!target) {
      const hittable = alive.filter((e) => !e.warded && !(e.stats.shield && !e.chilled && dist(e) > 6));
      const pool = hittable.length ? hittable : alive;
      target = pool.filter((e) => dist(e) < 7).sort((a, b) => dist(a) - dist(b))[0] ?? pool.sort((a, b) => a.position.z - b.position.z)[0];
    }
    if (pl.club.id !== club) key(KEYS[club]);

    // Cuánto cargar: la vida del blanco dice el nivel (nivel n = n de daño, y cada nivel es un quinto de
    // la barra); además la carga tiene que alcanzar para llegar hasta él.
    const minRange = club === 'driver' ? 18 : club === 'iron' ? 6 : 5;
    const maxRange = club === 'driver' ? 60 : club === 'iron' ? 40 : 28;
    const chargeTime = club === 'driver' ? 1 : club === 'iron' ? 0.5 : 0.4;
    const need = Math.min(3, Math.max(1, target.hp));
    const reach = Math.min(0.99, Math.max(0, (dist(target) + 4 - minRange) / (maxRange - minRange)));
    const want = club === 'iron' ? 0.3 : club === 'wedge' ? 0.5 : Math.max(reach, (need - 1) / 3 + 0.02);

    // Anticipación: mientras carga, pega y la pelota vuela, el enemigo sigue caminando hacia la puerta
    // (en diagonal, no derecho). Se apunta a donde va a estar.
    const speed = target.frozen ? 0 : target.stats.speed * target.speedMul * (target.chilled ? 0.4 : 1);
    if (target.stats.behavior === 'grabber' && !target.frozen && dist(target) > 3) {
      // viene hacia el golfista: se apunta un poco más acá sobre esa misma línea
      const k = Math.max(0.2, 1 - (speed * (0.6 + want)) / dist(target));
      aim(p.x + (target.position.x - p.x) * k, p.z + (target.position.z - p.z) * k);
    } else if (target.target === 'gate' && speed > 0) {
      const lead = 0.12 + want * chargeTime + 0.4 + (club === 'driver' ? dist(target) / 90 : Math.sqrt((2 * dist(target) * 0.84) / 50));
      const gx = Math.max(-2.3, Math.min(2.3, target.position.x)) - target.position.x;
      const gz = 0.8 - target.position.z;
      const gl = Math.hypot(gx, gz) || 1;
      aim(target.position.x + (gx / gl) * speed * lead, Math.max(1, target.position.z + (gz / gl) * speed * lead));
    } else {
      aim(target.position.x, target.position.z);
    }

    setTimeout(() => {
      if (pl.mode !== 'free' || pl.grabbedBy || pl.club.id !== club) return;
      stats.byClub[club] = (stats.byClub[club] ?? 0) + 1;
      // Carga de verdad: mantiene apretado y suelta al llegar a la potencia buscada. El hierro sale
      // con poca carga; un toque de driver alcanza para un goblin y lo demás pide carga.
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
