# El Caddie (17/10)

**Qué pone a prueba: elegir el palo y cambiarlo rápido.** Pedido de Leandro (17/10):

> un jefe que ni se que es ni tengo clara la mecanica, pero la idea es que te haga mucho cambiar de palos
> como cosa obvia me imaginaba que hiciera spawnear zombies quizas desde el piso, en formaciones particulares,
> que te incentiven a ganarles de distintas formas [...] o formaciones mixtas de la misma velocidad que te
> obligen a ir cambiando de palos
> si no, podria ser un jefe que vaya bufeando enemigos para que solo lo puedas matar con un palo, o que sea
> mucho mas facil matarlo con ese palo, similar a lo de que si esta adelante le ponga blindaje 2

**El personaje:** el caddie de la horda. Un goblin grandote (3.2 m) con una bolsa de golf más alta que él
colgada a la espalda, con los cuatro palos asomando, cada uno con su funda de color. Un caddie te dice qué
palo usar; este te lo impone. Sale del piso en el medio del fondo, grita, y se queda a 32–38 m de la línea
yendo y viniendo de costado.

Código: `src/game/bosses/caddie/` (`fight.ts` la pelea, `formations.ts` las formaciones, `fx.ts` colores,
sellos, hoyos y gritos, `look.ts` la bolsa, `index.ts` las versiones). Se prueba con
`?ola=10&jefe=caddie.<versión>`.

## Un color por palo

Los palos del HUD comparten color (los colores son de las habilidades), así que en esta pelea cada palo
tiene el suyo, siempre junto con su ícono (el mismo del HUD, `public/clubs/`):

| Palo | Color |
|---|---|
| Driver | amarillo |
| Hierro | rojo |
| Wedge | verde |
| Putter | azul |

Desde la cámara alta se lee por el color: el anillo a los pies, la funda que sube de la bolsa, el ícono
arriba de la cabeza y el grito.

## Lo común: él canta un palo

- **Cada tanto canta un palo**: se para, saca el palo de la bolsa (sube y brilla), levanta los brazos
  (Rallying) y grita «¡Driver!» con letras grandes del color del palo. Arriba de su cabeza queda el ícono
  del palo que cantó, y un anillo de ese color a los pies.
- **A él solo le pega entero el palo que cantó.** Con cualquier otro, 1 por golpe (como al fantasma); lo
  mismo el rayo que salta, el fuego y las explosiones. El golpe fantasma y las pelotas de ese palo que salen
  de una habilidad (el hierro de rayo cuando cantó hierro) entran enteras. Cartelito «¡Con el putter!» si le
  pegás con otro (cada 2.5 s como mucho).
- **El palo va rotando**: de una bolsa de cuatro mezclada (los cuatro en cada vuelta), nunca el mismo dos
  veces seguidas.
- **Para el putter se viene adelante**, corriendo hasta 15 m de la línea (el putter rueda 20), y se queda
  ahí hasta el próximo grito; después vuelve corriendo al fondo. Es la ventana del putter.
- **Se apura solo**: canta más seguido cuanto menos vida le queda, y después de minuto y medio, un poco más
  seguido igual (hasta 1.5 s menos). Con poca dificultad canta más espaciado (un 25 % más en el nivel 0, nada
  en el 10).
- **A la puerta, 1 cada uno** de lo que sale del piso (el orco sacaba 2: un pelotón entero eran 10, la puerta
  entera).
- **La escolta**: la de siempre, sin chamanes ni apoyos (el aura y la bandera taparían lo que piden los
  palos).
- **Cuando muere** se le apagan los sellos y lo que marchaba en formación sigue suelto, como cualquiera.
- **La regla de la puerta**: mientras vive no para (formaciones o los que saca del piso, sin tope), y cada uno
  que llega le pega a la puerta (10 de vida: una formación entera que pasa casi la rompe).

## Las versiones

### `caddie.formaciones` — la primera idea de Leandro

Con cada grito **salen del piso formaciones pensadas para ese palo**: primero un hoyo de tierra con un anillo
del color del palo que se cierra (1.5 s de aviso), y del hoyo sale cada uno, subiendo (0.7 s), con una
nube de tierra. Marchan **en formación** (a 2 m/s, todos igual) hasta 5 m de la línea, y de ahí van sueltos.
No hay reglas nuevas: cada formación usa los poderes de siempre y la forma en que viene.

| Formación | Palo | Qué es | Por qué ese palo |
|---|---|---|---|
| Columna | driver | 6 goblinas (2) en fila india, sobre la fila de un puesto, al fondo (de 38 a 54 m de la línea) | el driver atraviesa: desde ese puesto un tiro se lleva la fila; de lejos el golpe 1 ya les saca 2 |
| Pelotón | hierro | 5 orcos (3) apretados en rombo, a media cancha | el hierro le pega a uno y revienta encima de los otros: un golpe 3 los mata a todos |
| Tortuga | wedge | 6 goblinas (2) con escudo 3, en bloque | de frente rebota todo (y vuelve); el globo cae a plomo y detrás de ellas el escudo no cubre |
| Emboscada | putter | 3 goblinas (2) con blindaje 1, que salen a 10–19 m de la línea, en filas distintas | el putter de cerca les saca 3 con el golpe 2; el driver de cerca necesita el golpe 3 |

**Desde la mitad de su vida, mixtas**: dos partes una al lado de la otra, a la misma altura y la misma
velocidad (desde el 80 %, tres). En las mixtas, la parte del putter son los **acorazados**: 2 goblinas con
**blindaje 2** (la idea de Leandro: «si está adelante le ponga blindaje 2, para que casi que sin el putter y
un poco de carga no lo puedas matar»): de lejos solo les entra un driver clavado; cuando llegan a tiro del
putter, el putter con carga.

Canta cada 10 s (7 s casi muerto). Si hay más de 24 marchando, el grito espera.

### `caddie.sellos` — la segunda idea

No hay formaciones: **les pone sellos a los de la horda**. Cada 3.2 s (2 s casi muerto) le tira a uno la
funda de un palo (vuela en arco, del color del palo) y le queda el sello: el ícono del palo arriba de la vida
y el anillo de color. **Al sellado solo le pega entero ese palo; los otros, 1 por golpe.** Hasta 6 a la vez.

- **A quién**: primero al que le estás pegando; si no, al de más vida. No a los de 1 de vida (no cambia
  nada), ni a los kamikazes, ni a los que están a menos de 7 m de la línea.
- **Qué palo**: el que mejor le pega donde está y como viene. Blindado: putter si está cerca, driver si
  no. Con escudo: wedge. A menos de 18 m: putter. Con dos o más pegados: hierro. Si no, el que menos sellos
  tiene (el putter solo si está a menos de 26 m).
- **Si la cancha se vacía** (menos de 5), cada 7 s saca 2 del piso (orcos o esqueletos) a media cancha, que
  después sella. Así sigue sin tope cuando se acaba la escolta.
- Él canta su palo cada 8 s (5.5 s casi muerto), sin formación.

### `caddie.mixto` — la mezcla

**Siempre formaciones mixtas** (dos partes; tres cuando perdió el 60 % de la vida), y **cada parte con el sello
de su palo**: lo que en `formaciones` es un incentivo acá es la regla (con otro palo, 1). Una formación
pide dos o tres palos a la vez, y llegan juntos. Canta cada 14 s (10 s casi muerto).

## Los números

| | |
|---|---|
| Vida | 40 + 3 por nivel de dificultad + el golpe 4 (70 en el nivel 10) |
| Dónde | 32–38 m de la línea (x de 2 a 10 para cada lado); para el putter, a 15 m |
| Grito | 1.3 s quieto |
| Hoyo | 1.5 s de aviso, 0.7 s saliendo |
| Marcha | 2 m/s (la emboscada 2.3), en formación hasta 5 m de la línea |

## El bot

El bot sabe de los sellos: `BossBot.dealt` (nuevo, en `types.ts`) le dice cuánto le entra a cada uno con cada
palo, y `bot.ts` se lo pregunta al calcular lo que vale cada tiro (driver y putter derecho, hierro y wedge en
área, el hierro a la cabeza, el globo detrás del escudo). Las formaciones las juega con lo que ya sabía: la
línea del driver, el área, el globo detrás del escudo, el putter de cerca.

Dos tandas del 17/10, el bot «humano» en dificultad base, desde la oleada 10 (`bot-tanda.mjs --juegos=2`
con `base&jefe=caddie.<versión>`). **Una partida es poco**: sirve para ver si hay algo roto o desbalanceado
de más, no para afinar.

**Primera tanda** (vida 30 + 2 por nivel, cantaba cada 9→6 s, el orco le sacaba 2 a la puerta): ganó 3 de
6, peleas de 46 a 77 s. Las derrotas, por la puerta: en una de `formaciones` pasaron dos pelotones (10 de
puerta solo los orcos). Con eso: la vida a 40 + 3 por nivel, los gritos más espaciados, más espaciados aún
con poca dificultad, y 1 de puerta por cada uno de lo que sale del piso.

**Segunda tanda** (lo de ahora, salvo los últimos retoques de `mixto` y `sellos`):

| Versión | Ganó | Duración | Bajas de formación con su palo | Sellados muertos con su palo |
|---|---|---|---|---|
| formaciones | 1 de 2 | 67 s / perdió a los 61 s (le quedaban 14 de 40) | 19 de 23 y 19 de 23 | |
| sellos | 1 de 2 | 110 s / perdió a los 86 s (le quedaba 1) | | 7 de 14 y 9 de 14 |
| mixto | 1 de 2 | 101 s / perdió a los 62 s | 36 de 52 y 17 de 23 | |

- **El bot cambia de palo bien con las formaciones**: el 80 % de las bajas de formación (y el 70 % en
  `mixto`) son con el palo de esa parte. Le pega con la línea del driver a la columna, el hierro al
  pelotón, el globo detrás de la tortuga y el putter a la emboscada, todo con lo que ya sabía.
- **Con los sellos le cuesta más** (55–65 % con el palo del sello): elige el blanco por lo que vale, y el
  sello se lo baja a 1, pero la línea del driver igual pasa por sellados de otro palo.
- **A él le pega mucho con el palo equivocado** (en `sellos`, 19 golpes de 1 contra 7 enteros): casi todos
  de paso, con la línea del driver que va a otro y lo agarra (es grande y está en el medio del fondo).
- Después de los últimos retoques (`mixto` canta cada 14→10 s y pasa a tres partes recién al 60 %; los que
  saca del piso en `sellos` son 2, cada 7 s, y le pegan 1 a la puerta) no se volvió a correr: la compu
  estaba ocupada con las tandas de los otros jefes.

## Para decidir

- **¿1 con el palo equivocado, o 0?** Hoy cualquier otro palo le saca 1 (como al fantasma): nada es imposible y
  las cartas siempre ayudan algo. Con 0 sería «solo ese palo», más claro pero más duro (y el rayo que salta,
  el fuego y las explosiones también le sacan 1; el golpe fantasma entra entero).
- **¿Le pega a vos?** El caddie no pega: lo que lastima es lo que sale del piso. Cuando se viene adelante
  para el putter (a 15 m) podría barrer el puesto de enfrente, para que esa ventana tenga riesgo.
- **El HUD**: los palos del HUD comparten color; acá cada palo tiene uno (amarillo, rojo, verde, azul).
  Prender la tarjeta del palo que canta en el HUD ayudaría a leerlo, pero es tocar `hud.ts` (compartido).
- **El modelo**: el goblin común de `dungeon.glb` agrandado a 3.2 m, con la bolsa, los palos y las fundas
  hechos por código (`look.ts`) y colgados del pecho (se mueven con el grito). No tiene gorra de caddie: se
  podría sumar una visera en Blender, o un clip de Mixamo de **«Pointing»** para cantar el palo señalando (en
  `dungeon.glb` hoy hay solo Rallying, que es el que usa para gritar; Pointing está en `cine-dungeon.glb`).
- **Escolta**: la de siempre sin chamanes ni apoyos. En `formaciones` y `mixto` capaz sobra (lo que sale
  del piso ya es mucho); en `sellos` es la materia prima.
- **Las fotos** (`logs/jefe-caddie.*.png`): la columna con sus anillos amarillos sobre la fila de un puesto,
  la bolsa con el palo que canta levantado, y los sellos se leen desde la cámara alta (los íconos son chicos
  a 40 m: los agrandé a 1.6 m después de las fotos).
