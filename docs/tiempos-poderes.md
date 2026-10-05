# Los poderes con tiempos (5/10/2026)

Cuánto tarda el caballero en matar a un enemigo de **6 de vida** con cada poder, con los tiempos medidos
en el juego (`logs/medir-tiempos.mjs`, a 60 cuadros por segundo, con el driver a 25 m). Sirve para
comparar los poderes entre sí y para elegir los números del poder nuevo (el que se cura).

## Los tiempos del caballero

| Qué | Cuánto |
|---|---|
| Cargar hasta el golpe 2 | 0.63 s apretando |
| Cargar hasta el golpe 3 | entre 0.82 y 0.88 s (la ventana dura 0.06 s) |
| De soltar al impacto | 0.04 s (golpe 1), 0.11 s (2), 0.18 s (3) |
| Correr 1 puesto · 2 · 4 | 0.40 s · 0.53 s · 0.82 s |
| Vuelo del driver | 0.14 s a 15 m, 0.25 s a 25 m |
| Vuelo del putter | 0.40 s a 15 m |
| Vuelo del hierro | 0.8 s a 15 m, 1.2 s a 35 m |
| Vuelo del wedge | 1.3 s a 15 m, 1.7 s a 25 m, 2.1 s a 35 m |

**Tiros seguidos** (tirar, correr a la pelota más cercana, que en promedio está a 1.5 puestos, cargar y
tirar otra vez):

| Golpe | Entre un tiro y el siguiente | Daño del driver a media distancia | Daño por segundo |
|---|---|---|---|
| Flojo (1) | **0.88 s** | 1 | 1.1 |
| Medio (2) | **1.52 s** | 2 | 1.3 |
| Fuerte (3) | **1.78 s** | 3 | 1.7 (si clavás la ventana de 0.06 s) |

La recarga de los poderes depende de la dificultad: sin el punto en «Poderes» tardan ×1.6. La burbuja
del bendito vuelve a los 8 s (5 con el punto), la del élite a los 4.8 s (3), y la esquiva a los 8 s (5).

## Cuánto tarda cada poder, a 6 de vida

El tiempo va desde el primer impacto hasta el que lo mata (se suman los huecos entre tiros).

| Poder | Cómo se lo mata sin cartas | Tiros | Tiempo |
|---|---|---|---|
| Sin poder | 2 fuertes | 2 | 1.8 s |
| | 3 medios | 3 | 3.0 s |
| **Fantasma** (1 por golpe) | 6 flojos: cargar no sirve | 6 | 4.4 s |
| **Blindaje 1** | 3 fuertes (3 − 1 = 2) | 3 | 3.6 s |
| | 6 medios (2 − 1 = 1) | 6 | 7.6 s |
| **Blindaje 2** (el élite desde el escenario 2) | 6 fuertes (3 − 2 = 1); el flojo y el medio no entran | 6 | 8.9 s |
| **Escudo** | 3 wedges fuertes (2 de área, cae de arriba) | 3 | 3.6 s, más 1.7 s de vuelo |
| | 6 wedges medios (1 de área) | 6 | 7.6 s, más 1.7 s de vuelo |
| **Esquiva** (el daño se la recarga) | cebo flojo + fuerte, dos veces | 4 | 4.4 s |
| | cebo flojo + medio, tres veces | 6 | 6.3 s |
| **Divino** común, hasta el 5/10 (vuelve solo a los 8 s) | romper la burbuja con un flojo + 2 fuertes | 3 | 3.6 s |
| | flojo + 3 medios (entran en los 8 s, y en los 5 de la difícil) | 4 | 4.6 s |
| **Divino, desde el 5/10** (todos: cada golpe le devuelve la burbuja, y además vuelve sola) | flojo + fuerte, dos veces | 4 | 4.4 s |
| | flojo + medio, tres veces | 6 | 6.3 s |
| **Se cura** (6 de vida: cada 4.2 s) | arrancar ya cargando justo después de la cura: 3 medios | 3 | 3.0 s, dentro del ciclo |

**Lo que dicen los números:**
- El **divino** era el más blando: costaba un tiro flojo de más (0.9 s), y después la ventana de 8 s
  alcanzaba para cualquier cosa. Desde el 5/10 **a todos los benditos cada golpe les devuelve la
  burbuja** (pedido de Leandro): quedan **igual que el que esquiva** (4 tiros fuertes o 6 medios), pero
  con otra pregunta: romper y pegar, en vez de hacerlo saltar y pegar. La burbuja también vuelve sola.
- El **blindaje** es el más lento si no clavás el golpe 3, y el blindaje 2 sin cartas es el peor de todos
  (9 s). El fantasma se resuelve con ritmo: 6 flojos, 4.4 s.
- El **escudo** pide el wedge, que vuela 1.7 s: el tiempo es parecido al blindaje, pero hay que anticiparlo.

## Cómo cambian las cartas estos números

| Carta | Fantasma | Blindaje | Escudo | Esquiva | Divino |
|---|---|---|---|---|---|
| **Silenciador** (5 s; 2.5 al élite) | pega entero: 2 fuertes | sin blindaje: 2 fuertes | sin escudo, **también el muro** (desde hoy) | la gasta, y no recarga mientras dure | **desde hoy** apaga la burbuja, y la recarga empieza cuando termina el silencio: unos 13 s libres |
| **Golpe fantasma** | entero | entero | pasa | **no lo ve venir** (desde el 4/10) | pasa sin romperla |
| **Guante fantasma** (5 a 7 s) | todos los tiros enteros: 2 fuertes | ídem | ídem | ídem | ídem |
| **Fuerza** (5 a 7 s, todo pega 2) | no cambia (tope 1) | el flojo pasa a entrar: 2 − 1 = 1 cada 0.9 s | el wedge medio pega 2: 3 wedges | el golpe después del cebo puede ser flojo: pega 2 | no cambia |
| **Fuego** (2, 3 y 4 mordiscos de 1) | cada mordisco entra | el blindaje no le resta | con wedge | con wedge | la burbuja se come el toque |
| **Rayo** (1 por rayo) | entra | no le resta | | | ½ |
| **Lupa** / **Maldición** de Abe | hasta 2 por golpe: 3 medios | +1 antes del blindaje | | | |
| **Romper el hielo** (+1) | hasta 2 por golpe | +1 | | | |
| **Eco**, **Clon** (dos pelotas por tiro) | el doble de golpes por tiro | | | sin cebo, no: salta al soltar y las dos van adonde estaba. **Después del cebo pegan las dos**: la esquiva salta solo al soltar o al tirar una habilidad, y ni el clon ni el eco son un soltar nuevo | una rompe, la otra pega |
| **Potencia**, **Herrero**, **En racha** | no cambian (tope 1) | +1 por golpe | | | |
| **Chispa** de Abe (clavado 0.5 s) | — | — | — | no le impide saltar (salta igual) | — |
| **Silencio** de Abe (2 a 3 s) | como el silenciador, más corto | | | | |

## El poder nuevo: el que se cura

Tres versiones (idea de Leandro), con 6 de vida:

| Versión | Qué pide | Con fuerte (1.78 s) | Con medio (1.52 s) | Con flojo (0.88 s) |
|---|---|---|---|---|
| **A**: se cura entero X s después del **primer** golpe | todo el daño en X s desde que empezás | X ≥ 1.8 | X ≥ 3.0 | X ≥ 4.4 |
| **B**: se cura X s después del **último** golpe | que ningún hueco entre golpes pase de X | X ≥ 1.8 | X ≥ 1.5 | X ≥ 0.9 |
| **C**: se cura **cada X s**, con aviso | todo el daño entre una cura y la siguiente | X ≥ 1.8 | X ≥ 3.0 | X ≥ 4.4 |

- **B** con 3 s es blanda: los tres golpes entran sin apuro. Para que no se pueda errar un tiro cargando
  tendría que ser unos 2 s, y aun así **el flojo cada 0.9 s nunca lo deja curarse**: se resuelve igual
  que el fantasma, y se parece al divino (bajarle algo y pegar seguido).
- **A** y **C** piden lo mismo (todo el daño dentro de una ventana), pero en A la ventana la abrís vos con
  el primer golpe, y un área o una chispa que lo roza sin querer la abre en mal momento. En C la marca
  el enemigo con un aviso: le pegás cuando te deja, y mientras tanto atendés a otros. Es lo distinto.
- **Con C cada 4 s**: dos fuertes entran con 2 s de margen para arrancar, tres medios con 1 s, y con
  flojos no llega (4.4 s). Pide cargar y arrancar justo después del aviso. Al élite, cada 3 s: solo con
  fuertes, o con cartas (fuerza, potencia, lupa, eco).
- **Lo que lo resuelve**: el silencio (no se cura mientras dure, y el reloj arranca cuando termina, como
  el divino), la fuerza, la potencia, la lupa y la maldición, el eco y el clon (más daño en la ventana), y
  el fuego si los mordiscos caen dentro.

### Cómo quedó (5/10): la C, con el ciclo sacado de su vida

Leandro eligió la C, con este criterio: **al élite se lo tiene que poder matar con golpes medios, usando
todo el ciclo, con un poco de margen** (el fuerte es difícil de clavar), arrancando ya cargando antes de la
cura. Así que el ciclo no es fijo: sale de su vida (`REGEN` y `regenPeriod` en core/waves).

`ciclo = margen + (golpes medios que le hacen falta − 1) × 1.5 s`, con un golpe medio de 2.

| Vida | Golpes medios | Ciclo (común, margen 1.2 s) | Ciclo (élite, margen 0.8 s) | Con flojos (1 cada 0.88 s) |
|---|---|---|---|---|
| 3 (orco) | 2 | 2.7 s | — | 1.8 s: llega |
| 4 (esqueleto) | 2 | 2.7 s | — | 2.6 s: justo |
| 6 (chamán) | 3 | 4.2 s | — | 4.4 s: no llega |
| 7 (élite del primer escenario) | 4 | — | 5.3 s | 5.3 s: justo, sin errar uno |
| 11 (élite del segundo) | 6 | — | 8.3 s | 8.8 s: no llega |
| 14 (élite del tercero) | 7 | — | 9.8 s | 11.4 s: no llega |

- **3 s son cuatro flojos**, no tres: a 0, 0.9, 1.8 y 2.6 s del primero, corriendo a la pelota entre
  uno y otro (los 0.88 s ya incluyen correr un puesto y medio).
- Con poca dificultad el margen se multiplica por la recarga (×1.6): un poco más de aire.
- Se cura **entero** y brilla verde aunque esté sano: así se le lee el ritmo. La barra verde debajo de la
  vida es el ciclo; silenciado se pone gris y no corre.
- Va desde los de 2 de vida (como el fantasma): al goblin se lo mata de un golpe y la cura no se vería.

### El fuego contra el que se cura

Los tiros de fuego **no pegan con el palo**: solo prenden (el palo pega, la habilidad pone el efecto,
desde el 1/10). El primer mordisco es en el acto, y después uno cada 2 s: 2, 3 y 4 de daño en total, en
2, 4 y 6 s. Contra el que se cura sirve poco, porque los mordiscos se reparten en varios ciclos y cada cura
borra lo hecho: con el ciclo de 4.2 s entran dos o tres. Con la Fuerza el tiro de fuego además pega 2 al
tocar.
