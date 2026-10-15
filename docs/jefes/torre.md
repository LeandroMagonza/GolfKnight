# Torre de asedio (`torre`)

**Qué pone a prueba: la distancia exacta.** El globo del wedge tiene que caer justo en la plataforma de
arriba, que es chica, y la torre se mueve.

Código: `src/game/bosses/torre/index.ts`. Probar: `?ola=10&jefe=torre.arqueros` (o el panel B > Pruebas >
Jefes).

## Qué hace

Una torre de madera (3 m de ancho, la plataforma a 5 m) entra rodando desde el fondo, en un carril al azar
entre x = -6 y 6, y **avanza despacio hacia la línea, con paradas**: rueda 4 s a 1 m/s y se para 2.5 s. Con
las ruedas sanas tarda unos 80 s en llegar. Lo peligroso es lo que lleva arriba.

**El techo de escudos (15/10).** Los arqueros se tapan con un techo de nueve escudos rojos y lo levantan
para tirar. El ciclo: tapados 5 s (3.5 a los dos minutos), el techo **tiembla** 0.8 s (el aviso), se levanta
hacia atrás en 0.5 s, quedan **destapados 3.8 s** y lo bajan en 0.5 s. Tapados no tiran, y **el globo que
cae en el techo rebota sin tocarlos** («¡Tapados! Tirá cuando levantan los escudos»). La barra de arriba dice
«Tapados» o «¡Destapados!». El globo tarda 2-2.5 s en llegar a la torre: tirado cuando el techo empieza a
temblar, cae con la plataforma destapada.

**Los arqueros** (goblins con arco, color arena) están en la plataforma, de a cinco como mucho. Destapados
tiran **ráfagas: todos los de arriba a la vez**, una al levantar el techo y otra a la mitad (la segunda desde
el minuto o a solas). Las marcas rojas aparecen cuando tensan (1 s) y la flecha vuela 0.75 s; radio 1.3 m, te
saca 1. **El primero a tu puesto, el segundo y el tercero a los de al lado** (hay que correrse dos), el cuarto
otra vez a tu puesto, y **con la plataforma llena, el quinto a la puerta** (una franja naranja hasta la
puerta; le saca 1). Si
matás al que tensa, no tira.

**La sacudida:** el golpe 3 del driver o del hierro que le pega directo a la torre (a las ruedas o a la
pared) la sacude, y **los que estaban tensando sueltan el arco sin tirar** («¡Sacudida!»). Una vez cada
1.2 s.

**Cómo se los mata: el globo justo arriba.** Las pelotas chocan con la torre como con un cilindro. El globo
que entra por arriba (de 4.7 m para arriba) revienta en la plataforma y su área (4.2 / 5 m) barre a todos
los de arriba («¡Justo arriba!»). El que pega en la pared de adelante revienta ahí, y a los de arriba no
les llega. **Los de arriba solo cobran de lo que les llega a la altura**: el driver que pasa por abajo, el
hierro que revienta contra la pared, el globo que cae al lado en el piso, nada.

El globo cae a 55°, así que **para que caiga arriba hay que apuntar un poco detrás de la torre**: el anillo
entre 2 y 6 m detrás del centro (medido, ver abajo). Apuntando al pie de la torre pega en la pared. Para
enseñarlo, el globo que no cae arriba avisa: **«¡Corto! Más lejos»** (contra la pared, o antes),
**«¡Largo! Más cerca»** (detrás), o «¡Desviado!». La línea del tiro ayuda: el final del arco tiene que
bajar sobre los arqueros.

**Suben más**: uno cada 6 s (3.5 s a los dos minutos) por la escalera de atrás (tarda 2.6 s en subir). Con
menos de dos arriba, el siguiente sube enseguida. El que está abajo de la escalera sí cobra del globo que
cae en el piso detrás de la torre (también con el techo cerrado).

**A solas (15/10).** Cuando se termina la escolta (pasó lo que tarda en salir y no queda nadie, o 20 s
después igual) sale el cartel «¡La torre apura!»: rueda 1.8 veces más rápido, se tapan un 25 % menos, suben
más seguido, y **la guarnición que queda abajo se recorta a 6**. Es para que el rato a solas sea corto: o
le embocás tres o cuatro globos destapados, o llega a la línea.

**Las ruedas** (en las versiones que las tienen) se rompen con lo que pega abajo (de 1.4 m para abajo: el
driver, el putter, el hierro corto): 10 de vida entre las cuatro. Rotas a medias la frenan (hasta un 30 %
del paso); **rotas del todo, la torre se para** («¡Ruedas rotas!») y las arreglan en 10 s; cada golpe bajo
mientras tanto lo atrasa 1.5 s por punto. Arregladas quedan al 60 %. Las rotas se ven torcidas.

**Si llega a la línea** (z = 16), baja la rampa hacia adelante y **sale un goblin cada 2.2 s**: van
derecho a la puerta (y te atropellan si te pasan por encima). Los arqueros siguen tirando.

## Las versiones

| id | Qué tiene de distinto |
|---|---|
| `torre.arqueros` | La de base. **Se gana matando a toda la guarnición** (18 arqueros más uno por nivel de dificultad): sin arqueros la abandonan y se cae. La torre no tiene vida. Las ruedas se rompen. Los arqueros te tiran al puesto. |
| `torre.muralla` | Igual, pero **tiran flechas de fuego a la puerta**: dos por vez, al levantar el techo, tensando 2.4 s con una llama en la punta y **una franja naranja del pie de la torre a la puerta**. No te apuntan a vos: hay que barrerlos (el globo apenas se destapan) o sacudirla antes de que suelten. Cada una le saca 1 a la puerta. |
| `torre.casco` | **La torre tiene vida (45; era 55) y se rompe a golpes**: todo lo que le pega le saca lo normal, y **el globo que cae arriba destapada, el triple** (y barre a los arqueros; en el techo cerrado, lo normal). Los arqueros no se acaban (siguen subiendo). Las ruedas no se rompen; va un 15 % más lenta. |

## Cómo se le gana

- **Globos arriba, destapados**, con el golpe 2 o 3 (el 1 pifia): el anillo un poco detrás de la torre,
  tirado cuando el techo tiembla. Cada uno que entra barre la plataforma entera; mejor cuando hay tres o
  cuatro arriba (pero con cinco, uno tira a la puerta).
- **Las ráfagas: corréte dos puestos** para el lado que quedó sin marca, o **sacudila** con un golpe 3 del
  driver o del hierro mientras tensan.
- **El driver a las ruedas** para ganar tiempo: tres o cuatro tiros fuertes la paran 10 s, y un tiro cada
  tanto mientras la arreglan la deja parada.
- La escolta sigue llegando: el hierro y el driver para ellos.

## Los números para tocar

Todos arriba de `torre/index.ts`, con su comentario:

- Torre: `TOWER_RADIUS` (1.5), `PLATFORM_Y` (5), `TOP_HIT_Y` (4.7: desde dónde es «arriba»), `WHEEL_Y`,
  `ROLL_SPEED` / `ROLL_TIME` / `PAUSE_TIME`, `START_Z`, `ARRIVE_Z`, `pace` de cada versión.
- Ruedas: `WHEELS_HP` (10), `MIN_PACE` (0.3), `REPAIR_TIME` (10 s), `REPAIR_SETBACK` (1.5 s), `REPAIRED`.
- Arqueros: `GARRISON` (18) + `GARRISON_PER_LEVEL`, `START_ON_TOP`, `CLIMB_EVERY` (6 → 3.5 s), `CLIMB_SOON`,
  `CLIMB_TIME`, `ARCHER_HP` (1), `CREW_REACH`.
- Techo: `COVER` (tapados, el aviso, lo que tarda en levantarse, destapados, cuándo salen las ráfagas).
  `SHAKE` (qué golpe sacude y cada cuánto). `ALONE` (a solas: el paso, lo tapados, lo que suben, la
  guarnición que queda). `ESCORT` (cuándo se terminó la escolta).
- Flechas: `ARROW_DRAW` (1), `ARROW_FLIGHT` (0.75), `ARROW_RADIUS` (1.3); a quién va cada uno de la ráfaga,
  en `volley()`; las de fuego: `FIRE_DRAW` (2.4), `FIRE_VOLLEY` (2), `FIRE_DAMAGE`.
- Rampa: `POUR_EVERY` (2.2 s).
- `casco`: `hp` (45) y `topMul` (3).

## Lo que cambió el 15/10 (lo que dijo Leandro)

«La torre muy fácil también, le tiré todo con el wedge y no hizo mucho, tiró varias flechas pero no era
difícil esquivar». En sus partidas, `arqueros` en 84 s (5 globos arriba, 18 arqueros, 1 flecha le pegó) y
`casco` en 77 s. Lo que cambió, sin que sea un chequeo de daño:

- **El wedge solo ya no alcanza**: el techo de escudos tapa a los arqueros más de la mitad del tiempo, y el
  globo tiene que caer arriba **y** con el techo levantado. Hay que leer el aviso (el techo tiembla) y tirar.
- **Flechas más amenazantes**: ráfagas de todos a la vez, a tu puesto y a los dos de al lado (hay que
  correrse dos), el quinto a la puerta, y más rápidas (vuelan 0.75 s, eran 1). Antes era una flecha cada
  1.7 s, nunca más de dos marcas.
- **Contrajuego**: el golpe 3 del driver o del hierro contra la torre la sacude y corta la ráfaga.
- **El rato a solas, corto**: al terminar la escolta apura (paso 1.8, menos tapados, suben más) y le quedan 6
  abajo como mucho. `casco` baja a 45 de vida.

## Cómo le fue al bot

- Primera tanda (15/10, antes de los cambios): ganó `arqueros`, perdió `muralla` y `casco`. El bot no sabe
  tirar el globo a la plataforma (le tira poco a los arqueros de arriba), así que no mide bien esta pelea.
- Después de los cambios (`arqueros`, 1 partida): perdió la puerta a los 32 s de juego. Sin barrer la
  plataforma (0 globos arriba: el bot no los tira), con cuatro arriba el cuarto de cada ráfaga iba a la
  puerta: 10 de 12 ráfagas le sacaron 1. Ninguna flecha le pegó a él (las ráfagas se esquivan corriéndose).
  Pasé la de la puerta al quinto (plataforma llena). El bot no sirve para medir esta pelea: hay que jugarla.

## Lo que falta o no me convence

- El quinto de la ráfaga a la puerta castiga dejar que se llene la plataforma; si es mucho, que tire a tu puesto.
- La sacudida pide el golpe 3: si con las mejoras de la barra se vuelve fácil, que pida además el driver solo.
