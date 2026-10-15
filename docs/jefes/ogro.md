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

### `ogro.devuelve` — te devuelve las pelotas, y si no le mandás nada batea piedras a la puerta y a vos

Lo de arriba, más apurado (desde el 15/10, `quick` / `QUICK`): **la que devuelve vuelve un 35 % más rápido**
(vuela por lo menos 0.55 s) y queda **abierto menos** (2.4, 2.1 y 1.8 s). Y la **paciencia**: con el palo en
alto y nada que batear, se impacienta (un arco rojo se va llenando alrededor de la zona: 3.4 s, 2.8 y 2.2
según la fase). Cuando se llena tira una piedra al aire sobre el punto de bateo y 1.1 s después la batea:
**a la puerta** (el carril rojo hasta la puerta; le saca 1) o **a vos** (el carril rojo te sigue mientras la
tiene en el aire, y al batearla queda la marca roja donde estabas, como la de las pelotas; te saca 1). Van en
el orden puerta, vos, puerta, puerta, vos. **Una pelota que le llega mientras tanto se la corta** (batea tu
pelota, la piedra se cae y se rompe). Es el reloj de la pelea: no alcanza con tirarle globos desde lejos, hay
que cebarlo seguido. Vida 75.

### `ogro.batea` — no batea pelotas: va a buscar a los que vienen y los batea a la puerta

La idea de los enemigos, sola. No te devuelve nada (le entra todo, siempre), pero bajan goblins, uno cada
6.2 s (5.2 y 4.4 en las fases que siguen; goblins, goblinas y en las últimas, orcos). Desde el 15/10
(`shuffle` / `SHUFFLE`) **cada uno baja por su columna** (en cualquier lugar de la cancha, hasta 13 m del
centro) hasta la línea del ogro y ahí espera, y **el ogro se corre de costado** (3.6 m/s, con los pasos de
lado) a buscar al que llega primero: va hacia donde sabe que viene, y apenas lo tiene en el punto lo batea.
Una franja roja va del palo al que va a buscar. Después de cada batazo se vuelve a armar en 0.6 s. A los de la
escolta que cruzan su línea (de 1 m adelante a 4 m atrás del punto) también los va a buscar. El que batea sale
volando por arriba de tu línea y le saca 1 a la puerta (sea goblin, orco o huargo). Hay que bajarlos antes de
que llegue a buscarlos: el que espera en la línea es un blanco quieto, pero él viene rápido. En el aire
todavía se lo puede bajar (una pelota rasante que le pase por debajo le pega). Vida 70.

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

**Las corridas del 15/10** (después de los cambios de abajo; una o dos partidas, el bot «humano» desde la
oleada 10, `logs/tandas/ogro-rey-15-10b.jsonl` y `-c.jsonl`):

| Versión | Resultado | Lo que se ve |
|---|---|---|
| `devuelve` | perdió la puerta a los 55 s (al ogro le quedaban 42 de 75) | el ogro le sacó solo 1 de puerta (cortó 3 de 4 piedras) y ninguna devuelta le pegó; la puerta la perdió con la escolta mientras le pegaba al ogro (el bot no ceba a propósito) |
| `batea` (con 4.4 m/s, uno cada 4.6 s) | perdió la puerta a los 40 s | bateó a 7 (el bug, arreglado); 10 de puerta: demasiado |
| `batea` (con los números de ahora, salvo el 1 de puerta fijo) | 1 de 2 | 8 bateados en cada una; 9 y 5 de puerta. Después se dejó en 1 lo que saca cada uno |

`batea` quedó del lado difícil para el bot (no prioriza bien a los que esperan en la línea); falta que lo
juegue Leandro.

## Lo que haría falta en el código compartido

- **Para el bot** (`src/bot.ts`): que el jefe pueda decir «a este, carnada» (algo como `BossBot.bait?(e)`,
  que `planFor` trate como `canDodge`) y «a este, solo con estos palos» (`BossBot.clubs?(e)`, para que pruebe
  el wedge contra el ogro en guardia). Sin eso el bot ceba de casualidad.
- Nada más por ahora: para batear se usa `balls.list` (la pelota se marca `done` antes de que `Balls` la
  mueva: la pelea se actualiza entre la horda y las pelotas) y el resto son enemigos con guion.

## Cambios del 15/10 (lo que jugó Leandro)

Leandro jugó `devuelve` (ganó en 114 s, perdiendo 1 de puerta: «estaba muy fácil») y `batea` (ganó en 147 s;
el ogro bateó solo a 2).

- **El bug del bateo (todas las que tienen fila).** Leandro: «anda mal lo de batear a un goblin: el goblin se
  queda parado un poco atrás, el ogro batea, y el goblin no sale volando, e intenta de nuevo con el mismo
  goblin. Con un huargo y un caballero sí funcionó, los mandó girando hacia la puerta, muy divertido. Con la
  goblina también falla, con el orco también». Era el guion de la fila: el de adelante caminaba al punto de
  bateo solo mientras el palo estaba «listo» (`guard`); al entrar al círculo el ogro empezaba el golpe, el
  palo dejaba de estar listo, y el goblin volvía a su lugar de espera (2.7 m atrás). En los 0.15 s hasta el
  impacto daba un paso atrás y salía del círculo justo a tiempo. El huargo y el caballero eran de la escolta
  (sin guion: siguen caminando hacia la puerta), por eso a ellos sí. Ahora el de adelante sigue caminando
  mientras baja el palo, y en el impacto se cuenta medio metro de más (`inHit(e, 0.5)`). No hizo falta tocar
  `enemies.ts`.
- **`devuelve` más apurado.** Leandro: «el disparo que devuelve debería ser más rápido, no sé si hace falta que
  sea tan coreografiado de que esté un rato largo esperando, podría tirarte pelotas y piedras más seguido,
  tirarle más a la puerta también». La devuelta va un 35 % más rápido, el abierto dura medio segundo menos, la
  paciencia es la mitad (3.4 s en vez de 7) y la piedra sale en 1.1 s en vez de 1.5. Las piedras van a la
  puerta y también a vos (las que van a vos, 2 de cada 5). Vida 75 (igual).
- **`batea` se mueve.** Leandro: «que haga algo y se mueva para los costados mientras, puede moverse hacia
  donde sabe que viene un enemigo y pegarle más rápido». Ver arriba: ya no hay una fila por su carril, sino
  goblins por toda la cancha y él que va a buscarlos. Como con el arreglo ya no se le escapa ninguno, salen más
  espaciados (6.2 s en vez de 4.6) y cada uno saca 1 de puerta. `completo` sigue con la fila por el carril
  (con el arreglo del bug).

## Problemas conocidos

- Mientras se corre de costado con el palo en alto (en `batea`), probablemente se desliza sin mover las
  piernas (la pose del golpe es de todo el cuerpo); con el palo abajo camina de lado. No lo vi en fotos.
