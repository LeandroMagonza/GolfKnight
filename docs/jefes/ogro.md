# Ogro bateador (14/10)

**Qué pone a prueba:** elegir el palo según la trayectoria, y cebarlo. Lo que le llega de frente lo batea y
te lo devuelve; el globo del wedge no lo puede batear; y después de cada batazo queda abierto un rato.

Idea de Leandro: «que tuviera como la esquiva, pero en vez de saltar, le pega un batazo a la pelota que
tiraste, y te la devuelve bastante rápido, así que una de cada X pelotas la tenés que esquivar, y quizás si
la mandás cargada y te pega te hace más daño». Y después: «quizás el ogro también podría batear enemigos que
se pusieran en la línea de su palo, y que estos salgan volando hacia la puerta, o sea que tu counterplay es
matar a los enemigos de esa línea».

El código está en `src/game/bosses/ogro/` (`pelea.ts` la pelea, `partes.ts` lo que se dibuja, `index.ts` las
versiones). Se prueba con `?ola=10&jefe=ogro.<versión>` o desde el panel B > Pruebas > Jefes.

## Cómo es (lo común a todas)

- **El cuerpo:** el ogro de los monstruos nuevos, agrandado a 4.6 m. Entra corriendo hasta media cancha y se
  planta **de costado**, como un bateador. El golpe es el *drive* de los golfistas (todos los personajes
  comparten esqueleto y clips): con el palo arriba, en el tope del backswing, espera; al batear baja el palo
  de verdad.
- **La zona de bateo:** un círculo naranja en el piso entre él y el punto donde estaría la pelota. Lo que
  entra ahí **de frente** (yendo hacia el fondo) y por debajo de su cabeza, lo batea. Mientras está listo, el
  círculo late naranja y la mano del palo brilla.
- **Lo que no batea:** el **globo del wedge** (lo que cae a más de 45°, la misma regla del escudo), el golpe
  **fantasma** (no lo ve venir, como la esquiva) y el **silenciador** (lo apaga al tocarlo: silenciado baja el
  palo y no batea mientras dure). Tampoco el daño en área que estalla cerca (el hierro que revienta en uno de
  al lado le entra), el fuego, el rayo ni el carrito: solo batea pelotas.
- **El batazo:** la pelota desaparece en el palo y vuelve en línea, roja, **hasta donde estabas cuando la
  bateó** (como el rebote del escudo: la marca roja queda quieta en el piso y late más rápido cuanto menos
  falta). Si cuando cae seguís adentro de la marca, te pega. **La cargada vuelve más rápido y pega más:**
  golpe 1 a 20 m/s, golpe 2 a 24 y golpe 3 a 29 (entre 0.75 y 1.3 s de vuelo), y te saca 1, 1 y 2. La de
  habilidad vuelve como un golpe 1: es la carnada gratis.
- **Abierto:** después de cada golpe (le haya pegado a algo o no) baja el palo y queda abierto 2.9 s (2.5 y
  2.1 en las fases que siguen): el círculo se pone dorado y un arco dorado alrededor dice cuánto le queda.
  Ahí le entra todo. Después levanta el palo en medio segundo (mientras lo levanta, todavía le entra).
- **Las fases:** al sacarle un tercio de la vida, o a los 55 s y a los 110 s (lo que llegue antes: no se
  puede esperar sin fin), se corre de costado por lo menos 6 m y se acerca: se planta a 37, 32 y 27 m de la
  puerta (28, 23 y 18 m de tu línea). Más cerca, la pelota vuelve antes; en la última el putter ya le llega.
  Mientras se mueve no batea: es un regalo corto.
- **Cómo se le gana:** cebarlo con algo barato (un golpe 1, una habilidad), correrse de la marca y castigarlo
  abierto con lo fuerte (el driver o el hierro de 3; en la última fase, el putter de 4). Y entre batazo y
  batazo, globos: el wedge le entra siempre, pero pega poco (pifia, 1, 2).
- **Los números** están arriba de `pelea.ts`, con nombre: `BODY`, `STANCE_Z`, `ZONE`, `SWING`, `OPEN`,
  `RAISE`, `RETURN`, `RALLY`, `FUNGO`, `QUEUE`, `FLY`, `PHASE_HP`, `PHASE_TIME`.

## Las versiones

### `ogro.devuelve` — te devuelve las pelotas, y si no le mandás nada batea piedras a la puerta

Lo de arriba, más la **paciencia**: con el palo en alto y nada que batear, se impacienta (un arco rojo se va
llenando alrededor de la zona: 7 s, 5.5 y 4.3 según la fase). Cuando se llena tira una piedra al aire sobre
el punto de bateo, se marca un carril rojo hasta la puerta, y 1.5 s después la batea: le saca 1 a la puerta.
**Una pelota que le llega mientras tanto se la corta** (batea tu pelota, la piedra se cae y se rompe). Es el
reloj de la pelea: no alcanza con tirarle globos desde lejos, hay que cebarlo cada tanto. Vida 60.

### `ogro.batea` — no batea pelotas: batea a la puerta a los de su carril

La idea de los enemigos, sola. No te devuelve nada (le entra todo, siempre), pero una **fila de goblins**
baja por su carril (la franja roja que sale del punto de bateo hacia el fondo), uno cada 5.5 s (4.4 y 3.4
en las fases que siguen; goblins, goblinas y en las últimas, orcos). El que llega al punto de bateo sale
volando por arriba de tu línea y le pega a la puerta lo de su cuerpo (el orco, 2). Batea también a
cualquiera de la escolta que se meta en el punto. Hay que limpiar el carril: el driver derecho por la fila
agarra a varios de una. En el aire todavía se lo puede bajar (una pelota rasante que le pase por debajo le
pega). Vida 50.

### `ogro.peloteo` — la que te devuelve queda en tu línea, dorada, y vale más cada vez

Como `devuelve` (con la paciencia y las piedras), pero la pelota bateada, cuando cae, **queda en tu línea**
como pelota dorada en el puesto más cercano (con un anillo dorado). Esa pelota, si le pega, **pega 1 más por
cada vez que fue y vino** (hasta 4). Si te la vuelve a batear, vuelve un 10 % más rápido y la próxima vale
uno más: el tenis con el ogro. Lo natural es esquivarla, volver a buscarla y pegarle con esa mientras está
abierto. Vida 66 (los dorados pegan más).

### `ogro.completo` — devuelve las pelotas y batea a la puerta la fila de su carril

Las dos ideas juntas, sin las piedras (la fila ya es el reloj). Lo interesante es cómo se cruzan: el driver
derecho por el carril pasa por su zona y te lo batea, así que la fila se limpia **en ángulo** desde un puesto
del costado (del lado del punto de bateo, no del de su cuerpo), con globos, o mientras está abierto. Y cada
goblin que batea también lo deja abierto: dejar pasar uno cuesta 1 de puerta, pero abre una ventana. Vida 60.

## El bot

Lo que sabe del ogro (`BossFight.bot`): dónde va a caer cada pelota devuelta (`danger`, para correrse), y
cuánto le importa pegarle (`weight`): con el palo en alto poco (0.25), abierto mucho (3) si la pelota llega a
tiempo, con la piedra en el aire o la paciencia por llenarse 2.5 (cualquier pelota la corta), y a los de la
fila 3 cuando están a menos de 12 m del palo.

Lo que no puede hacer: elegir el globo contra él (el bot solo usa el hierro y el wedge contra escudos o con
relieve) ni cebarlo a propósito (su carnada es solo para la esquiva y la burbuja). Ver «Lo que haría falta».

(Resultados de las tandas: abajo.)

## Lo que haría falta en el código compartido

- **Para el bot** (`src/bot.ts`): que el jefe pueda decir «a este, carnada» (algo como `BossBot.bait?(e)`,
  que `planFor` trate como `canDodge`) y «a este, solo con estos palos» (`BossBot.clubs?(e)`, para que pruebe
  el wedge contra el ogro en guardia). Sin eso el bot ceba de casualidad.
- Nada más por ahora: para batear se usa `balls.list` (la pelota se marca `done` antes de que `Balls` la
  mueva: la pelea se actualiza entre la horda y las pelotas) y el resto son enemigos con guion.

## Problemas conocidos

(abajo)
