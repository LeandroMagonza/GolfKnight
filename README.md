# Golf Knight (web)

Un golfista cae en un mundo de fantasía por un hechizo que pedía "un gran guerrero". Le encantaron
los palos, y ahora defiende la puerta de la ciudad de Valdehoyo de las hordas a pelotazos.

Prototipo en Vite + Three.js + Tone.js, con la misma estructura que `MonsterTamer/web` (de ahí salen
`animator.ts`, el pipeline de Blender y las herramientas de Playwright). El proyecto Unity que está
en la carpeta de arriba queda solo como fuente de assets.

**Jugar:** https://leandromagonza.github.io/GolfKnight/

## Correr

```
npm install
npm run dev          # http://localhost:5173
npm test             # core: balística, medidor de swing, oleadas
npm run typecheck
npm run deploy       # compila y publica en GitHub Pages (rama gh-pages)
```

## Cómo se juega

Defendés la puerta de Valdehoyo a pelotazos, desde una línea de puestos de tiro. Cada control quiere
decir una sola cosa:

| Control | Qué decide |
| --- | --- |
| **Mouse** | hacia dónde y **a qué distancia** cae la pelota |
| **Arco de carga** | **qué tan bien** le pegaste: tres niveles de calidad, puro timing |
| **Palo** (`1`, `2`, `3`, `4`) | **cómo llega** la pelota, y cuánto pega a esa distancia |
| **Habilidad** (`Q`, `W`, `E`, `R`) | las que elegiste en las cartas: salen en el acto, con su propia pelota |
| **Rueda** del mouse / `↑` `↓` | inclinar la cámara / subirla y bajarla sin girarla |

- **Puestos y pelotas.** El golfista no camina libre: se mueve de costado entre nueve puestos marcados
  con un banderín, con `A` y `D`. Un toque es un puesto y dos toques son dos; mantener apretado no
  repite. Corre con easing: un puesto lleva unos 0.4 s. **Solo se pega donde hay una pelota**: los
  guardias las van tirando desde atrás. Nunca hay más de tres esperando, llegan más rápido cuantas
  menos quedan, y nunca caen en el puesto donde estás parado, así que después de cada tiro hay que
  moverse. Sin pelota no se puede ni empezar a cargar (la línea de tiro queda gris).
- Mantener click carga el swing y soltar pega. Click derecho (o `X`) cancela. Si llegás a un puesto
  con el botón ya apretado, la carga arranca sola. `Espacio` *clava* la calidad donde esté la barra, y
  el tiro sale cuando soltás el click.
- **La calidad va por niveles: 1, 2 y 3.** La barra se define por **tiempos**, iguales para los cuatro
  palos: tarda 0.63 s en cruzar el tramo débil y 0.185 s el medio, así que el fuerte abre a los 0.815 s
  de apretar, y dura 0.06 s en cada pasada. Después del tope rebota por todo el rango y vuelve a pasar
  por el fuerte, que dura otra vez lo mismo. Las mejoras mueven esos tiempos (ver más abajo). La barra
  **no tiene nada que ver con la distancia**: eso lo decide el mouse.
- **La barra se ve como un arco**, como en los juegos de golf, y **va donde se mira mientras se carga**:
  al costado de la cabeza del golfista (o, a elegir en el panel B > Visual, al costado de la pelota o
  unos metros adelante sobre el tiro), siempre del lado del golfista para no tapar la pelota ni la línea.
  Solo aparece cargando. Verde (débil) en los dos bordes, amarillo (medio) y rojo (fuerte) arriba en el
  medio. La aguja sube por la
  izquierda, pasa por arriba en el tope y el rebote la baja por la derecha; al volver a subir cruza de
  nuevo, y así.
- La línea de tiro dibuja el arco real: blanca, amarilla y roja según la calidad. El anillo marca
  dónde cae, y con el wedge, el tamaño del área.
- **El campo tiene marcas de distancia cada 10 m, contadas desde la línea de los puestos**: la raya
  donde estás parado dice 0. Las de 20 y 40 m están resaltadas porque ahí cambia la banda de daño.

### Los palos (`1`, `2`, `3` y `4`)

Cada palo tiene su distancia preferida, así que elegir palo es elegir a qué distancia querés pelear.
Ninguno es el mejor siempre.

| Palo | Cómo llega | Alcance | Corta (≤20 m) | Media (20-40 m) | Larga (+40 m) |
| --- | --- | --- | --- | --- | --- |
| **1 · Driver** | rasante, atraviesa la fila entera | siempre 50 m | 1 / 2 / 3 | 1 / 2 / 3 | **2 / 3 / 4** |
| **2 · Hierro 7** | arco bajo que revienta en el que toca | 4-55 m | 1 / 2 / 3 | 1 / 2 / 3 | 1 / 2 / 3 |
| **3 · Wedge** | globo alto, cae en picada y se queda ahí | 3-55 m | pifia / 1 / 2 | pifia / 1 / 2 | pifia / 1 / 2 |
| **4 · Putter** | rueda y le pega al primero que toca | siempre 20 m | **2 / 3 / 4** | — | — |

Los tres números de cada casilla son el daño según la calidad del golpe. El putter llega justo hasta la
línea de 20 m, así que nunca sale de la banda corta.

**La pifia:** con el wedge, el golpe 1 no sale. El palo pasa, suena el fallo, la pelota se queda en el
puesto y cuenta como errar. Es para que el globo, que abre el área más grande sin apuntarle a nadie, pida
también timing.

**El área pega menos que el impacto**, porque agarra a varios y no hay que apuntarle a nadie. El hierro
es el único que hace las dos cosas: **el que se come el pelotazo cobra el impacto** (1 / 2 / 3) y los de
alrededor cobran el área (**1 / 2 / 3**, en un radio de 2.2 / 3 / 3.5 m según el golpe). Nadie cobra las dos por un mismo tiro. El wedge solo hace
área, así que su tabla ya *es* la del área; por eso, abriendo la más grande de todas, es la más baja.

**Quién abre área y cuándo:**

| Palo | ¿Atraviesa? | ¿Abre área? | ¿Y si cae al piso sin tocar a nadie? |
| --- | --- | --- | --- |
| Driver | sí, a todos los de la fila | no | pica y sigue |
| Hierro 7 | no | sí, al contacto (2.2 / 3 / 3.5 m) | **no pasa nada: hay que conectar** |
| Wedge | no | sí, donde cae (4.2 / 5 m en los golpes 2 y 3) | igual explota: cae adonde apuntaste |
| Putter | no | no: le pega al que toca, a él solo | se queda ahí |

El **escudo es blindaje de frente**: la pelota que le llega de frente, venga rasante o en arco, rebota
igual, pero a ese golpe le resta su número y el resto entra. El del goblin guerrero es 4: un golpe 3 de
lejos con el driver (8), o de cerca con el putter (8), lo mata igual de frente. Lo único que no cuenta
como de frente es lo que cae a más de 45°, el globo del wedge. El escudo también cubre del **daño en
área** que estalla adelante suyo, a él y a los que tiene detrás, con el mismo descuento. El ícono del escudo, antes
de la vida, dice cuánto resta. Al del escudo se lo resuelve pegándole fuerte, silenciándolo,
cayéndole detrás con el wedge, con el golpe fantasma, o pegándole de costado.

**La pelota que rebota en un escudo vuelve hacia vos** (desde el 2/10): sale roja, en arco, y el piso
marca dónde va a caer, como el hechizo. La marca **te sigue** mientras vuela (te moviste a buscar otra
pelota: va para ahí), y en los últimos 0.6 s se queda quieta: ese es el momento de correrse. Si cuando
cae seguís adentro de la marca, te saca 1, venga como venga. Tarda entre 1 y 1.8 s según la distancia. Los números están en `RICOCHET` (core/shield) y en el panel B, pestaña Enemigos. El aura
del chamán no la devuelve: la frena y listo.

El **escudo muro** (violeta, más grande, con el brillo de los inmunes del chamán) no deja pasar nada de
frente, por fuerte que sea.

El hierro tiene **dos modos** en el panel de balance, para probarle la identidad: *revienta* (el de
arriba) y *atraviesa* (pasa de largo hasta a tres y abre su área donde cae, le pegue a alguien o no).

### Las habilidades (`Q`, `W`, `E`, `R`) y las cartas

**Al terminar cada oleada salen tres cartas y te quedás con una** (click, o `1`, `2`, `3`). Hay de tres
clases:

- **Habilidad**: una nueva va al primer lugar libre de `Q`, `W`, `E` o `R`. Si ya la tenés, sube de
  nivel (hasta 3; los tiros del wedge, hasta 2, porque su golpe 1 es la pifia y se saltea: salen con el
  golpe 2 y el 3): pega más o agarra más, y recarga igual (el costo es la carta que no elegiste; solo el palazo recarga un 30 % más lento por nivel, porque con poca recarga dejaría frenar la oleada sin fin).
- **Mejora**: cosas que valen para todo el juego. A propósito no tocan la tabla de daño de ningún palo,
  para no romper la regla de «cada palo tiene su distancia».
- **No hay cartas de curarse**: eran mucho peores que el Botiquín, que cura un poco al terminar cada
  oleada. Si la puerta está a la mitad o te queda una vida, una de las tres cartas es sí o sí el
  Botiquín (mientras no esté al tope).

Cada habilidad tira **su propia pelota**: no gasta la del puesto. Sale en el acto hacia el mouse, aun con
un tiro cargando.

**Palo y elemento** (23): cualquier palo con hielo, fuego, rayo, fantasma o silencio, y el driver, el
hierro y el wedge con viento. Es una pelota de ese palo, instantánea y gratis, que vuela como ese palo
(el driver atraviesa una fila, el wedge cae a plomo y abre un área). **El palo pega y la habilidad pone
el efecto**: salvo el fantasma, **no pegan ni empujan**, solo dejan el efecto, y el efecto sale solo si
la pelota **toca** (si el escudo la para, la burbuja divina se la come o el aura de invencible lo
protege, no hace nada). Lo que hace cada una, por nivel:
- *Hielo*: enfría 5 s (6.5 y 8) a cada uno que toca; en el nivel 3, además lo congela (al élite y al jefe no: solo los frena), y el golpe que rompe el hielo pega 1 más, también al fantasma. El frío lleva a cada uno al 40 % de su velocidad pero no por debajo de 1 m/s, y a todos los frena por lo menos un 20 %: mucho a los rápidos, poco a los lentos.
- *Fuego*: lo prende; pierde 1 de vida cada 2 s, el primero también a los 2 s (desde el 5/10): 2 en total (3 y 4), y el blindaje no le resta. Volver a prenderlo no suma: le alarga el fuego.
- *Rayo*: **a cada uno que toca le cae un rayo**, y de ahí sale para los dos lados: en cada rama salta
  al más cercano 2 veces (3 y 4), a 6 m como mucho, sacándole 1 a cada uno. Un rayo **nunca toca dos
  veces al mismo** ni vuelve al que lo largó; el rayo de otro sí. El blindaje no le resta.
- *Viento* (antes era el vendaval, solo rasante), distinto con cada palo:
  - driver: el viento va detrás de la pelota y **junta sobre la línea** a los que pasa (3 m de cada
    lado; 3.75 y 4.5 en los niveles 2 y 3), para el próximo tiro;
  - hierro: donde revienta, una ráfaga **manda para atrás** 6 m (8 y 10) a los que están a 3.5 m;
  - wedge: donde cae, un remolino **los amontona** hacia el centro, desde 4.5 m (5.25 y 6).
  Con el putter no hay.
- *Fantasma* (el único que pega: un golpe cargado al nivel de la habilidad): le entra entero a
  cualquiera. Pasa escudos (también el de la calavera), blindaje, el tope del enemigo fantasma, el aura de
  invencible y la burbuja divina (sin gastarla). El del driver atraviesa además las lomas. La esquiva no
  lo ve venir: no salta, y el golpe no se la recarga.
- *Silenciador*: silencia 5 s (6.5 y 8) a cada uno que toca (al élite, la mitad): se le apagan
  **todos** los poderes (escudo, blindaje, fantasma, divino, esquiva, auras, bandera, hechizo, bomba); la
  burbuja divina y la esquiva quedan gastadas y recién recargan cuando se le pasa el silencio,
  para que lo que venga después le entre. El wedge silenciador es el silencio en área (la granada se
  fue el 1/10). Ningún escudo lo para, ni el muro de la calavera, ni la burbuja: lo silencia al tocarlo y
  la pelota sigue.

**Las demás** (16):

| Habilidad | Qué hace |
| --- | --- |
| Carrito | un carrito de golf cruza el campo de costado a la altura que apuntás, y atropella |
| Hoyo | el primero que lo pisa cae entero y no vuelve, tenga los poderes que tenga (los jefes y los élites no). Recarga 20 s |
| Bandera | los que están cerca van hacia ella en vez de a la puerta |
| Pólvora | marca; el marcado que muere explota, y encadena si los de al lado están marcados |
| Lluvia de pelotas | una pelota en cada puesto; son de regalo, así que los guardias siguen reponiendo las suyas |
| Caddie dorado | unos segundos con pelota infinita en tu puesto |
| Lupa | los agranda: más fáciles de pegar, y vulnerables |
| Clon | una copia tuya repite tus próximos tiros desde donde la dejaste |
| Palazo | no hace daño: manda lejos hacia atrás a lo que tengas encima (a 4 m; 4.75 y 5.5 m en los niveles 2 y 3) y les corta el ataque |
| Fuerza | 5 s (6 y 7) en que todos tus tiros pegan por lo menos 2, el putter 3. También los de habilidad: los de efecto, que solos no pegan, pegan 2 y dejan su efecto. Recarga 20 s |
| Guante (fantasma, de hielo, de fuego, de rayo) | 5 s (6 y 7) en que todos tus tiros de palo llevan ese elemento al nivel del guante, y pegan como siempre. El de hielo congela en el nivel 3; con el fantasma, la esquiva no salta al soltar. Uno nuevo reemplaza al que estaba. Recarga 20 s |

**Mejoras**: Muñeca rápida (el tramo débil dura un 20 % menos: el golpe 2 y el 3 llegan antes, y duran
lo mismo), Punto dulce (el perfecto dura un 35 % más: abre igual y el rebote llega más tarde). Cada una
mueve un solo número; con las dos la barra queda más pareja, pero el fuerte sigue siendo el tramo más
corto. Ritmo (cada tiro seguido **sin errar** te hace llegar antes
al golpe 3, hasta tres, y ahí se queda hasta que errás), En racha (después de 4 tiros seguidos sin errar,
los golpes de palo que pegan 1 pasan a pegar 2 hasta que errás: sube el piso de cada palo sin tocar el techo, y al putter no le hace nada), El albañil (cada tiro que mata a dos suma 1, a tres suma 2, y así; cada 3, la puerta +1 y vos +1; no se corta),
El herrero (cuenta igual; cada 2, la próxima pelota pega +1, y no se pierde al cancelar, cambiar de palo ni pifiar),
Botiquín (hasta 3 niveles: al empezar cada oleada, la puerta +1 y vos +1 por nivel), Perfecto de regalo (cuenta igual que el albañil; cada 5, el próximo tiro arranca clavado arriba),
Carcaj (si vas a pegar sin pelota, te aparece una; una cada 10 s), Pelota extra (los guardias mantienen
una más), Segundo aire (apretar una habilidad que recarga la tira igual, y recarga él 30 s).

Las mejoras tomadas se ven en **una columna a la izquierda**, con lo que cuentan: cuánto le falta al
carcaj o al segundo aire, cuántas bajas llevás para el perfecto de regalo, cómo va cada racha. El
perfecto de regalo no se pierde si cancelás el tiro o volvés a empezar la carga: queda para el próximo.
**Errar** es un tiro de palo que no le pega a nadie (o solo a escudos e inmunes). Pegarle sin matar no
corta ninguna racha.

**Maestrías**, que solo salen con dos habilidades del mismo elemento:
- *Hielo*: un segundo hielo sobre el que ya está frío lo **congela**, y el golpe que rompe el hielo pega
  1 más.
- *Fuego*: el que muere prendido contagia a los de al lado.
- *Rayo*: salta una vez más, y cada salto pega el doble.

**Enemigos nuevos**: el *goblin acorazado* (1 de vida, pero le resta 1 a cada golpe: el driver de cerca
no le hace nada) y el *esqueleto bendito* (el primer golpe no le entra, y el escudo se le recarga a los
5 s).

**Correrse cargando** (experimental): mientras cargás el tiro, `A` y `D` te corren **con la pelota**
hasta 1.2 m para cada lado (un 30 % de lo que hay entre puestos), sin cambiar de puesto, para alinearte
con una fila. En el panel de balance se elige cómo: *continuo* (mantener apretado, 4 m/s; el de
arranque), *pasos* (0.4 m por toque), *apagado* (como antes) o *efecto*: ahí no te corrés, sino que
`A` y `D` **curvan el tiro** del driver o del putter, hasta 6 m de desvío al final, y la línea de tiro
muestra la curva. La curva crece manteniendo (*continuo*) o de a escalones (*discreto*), y vuelve a
cero al disparar o al soltar la tecla; las dos cosas se eligen en el panel.

**El área pega parejo**: todo el que está adentro del radio del hierro, del wedge o del kamikaze cobra el daño
entero, esté en el centro o en el borde.

**La cámara se encuadra sola**: al subirla o inclinarla se aleja lo necesario para que la línea de los
puestos quede siempre justo arriba de las barras de abajo. Se apaga o se ajusta en el panel.

Todos esos números viven en `src/core/abilities.ts` y `src/core/cards.ts`, y se tocan en vivo en el panel de balance, donde además se da o se saca cualquier habilidad o mejora subiéndole o bajándole el nivel.

### Lo demás

- **El palazo ya no es un botón aparte**: es una habilidad más, que sale en las cartas y va en Q, W, E o
  R.
- Vos tenés 3 de vida y la puerta 10. **Nadie te persigue**: todos van derecho a la puerta. Pero el que
  te pasa por encima te atropella: te saca 1 y muere en el choque. A la puerta cada enemigo le saca 1
  (el caballero y el kamikaze, 2). Después de recibir un golpe hay un segundo de respiro, titilando.
  **El que ya pasó tu línea queda fuera de juego**: se desvanece, no se le puede pegar y corre hasta
  la puerta. Entre oleadas no se cura solo: curarse es una de las cartas.
- La puntería tiene un arco de 180 grados: de costado a costado, pero no para atrás.

**Cuerpo y poder van por separado.** El cuerpo dice cuánta vida tiene (una escalera de 1 a 10 que se lee
por el tamaño), qué tan rápido va y cómo se ve. El poder se le reparte **al azar** en cada oleada, así que
no siempre es el mismo bicho el que viene con el mismo poder.

| Cuerpo | Vida | Nota |
| --- | --- | --- |
| Goblin | 1 | rápido y en montón |
| Goblina | 2 | rápida |
| Orco | 3 | |
| Esqueleto | 4 | lento |
| Jefe goblin | 5 | |
| Chamán goblin | 6 | un cuerpo más: el aura es un poder y le puede tocar a cualquiera |
| Caballero esqueleto | 8 | pesado; cae justo con el mejor golpe |
| Gólem chico | 10 | pesado; el único, además del jefe, que aguanta el mejor golpe |
| Alma en pena | 2 | la única que va por vos: si te agarra te saca 1 y te deja congelado 1.5 s, y se esfuma |
| Gólem de roca | 80 | el jefe: tira piedras a la puerta desde lejos. No recibe poderes |

| Poder | Qué hace |
| --- | --- |
| **Escudo 1 a 5** | blindaje de frente: a lo que le llega de frente le resta su número. Cada nivel es un escudo distinto: madera, tablones, hueso, escudo rojo, redondo |
| **Escudo calavera (10)** | de frente no entra nada: por detrás, de costado, silenciado o con el golpe fantasma |
| **Blindaje 1 a 3** | le resta eso a cada golpe, venga de donde venga. Tiñe de acero |
| **Explota** | corre a la puerta y revienta al llegar o al tocarte, y se lleva a los de al lado. Late en rojo |
| **Divino** | con la burbuja arriba es inmune a todo golpe y a todo tiro de efecto: el primero se lo come y se le recarga a los 5 s. **La pelota que la rompe desaparece** (el driver no sigue de largo). La pasan el golpe fantasma (sin gastarla) y el hoyo (que se lo traga entero), y el silencio se la apaga: recién empieza a recargar cuando se le pasa. Y cada golpe que le entra le devuelve la burbuja (5/10): hay que rompérsela antes de cada golpe |
| **Etéreo** | ningún golpe le saca más de 1 (agrandado por la lupa, hasta 2; el golpe fantasma de nivel 2, entero): hay que pegarle muchas veces. Casi transparente, con un brillo celeste |
| **Cava** | se planta y canaliza 8 s una loma adelante suyo, que tapa al driver. Si lo matás antes, baja; si termina, queda hasta el final de la partida |
| **Bandera** | se queda al fondo (unos 42 m); mientras vive, todos tienen 1 de vida más |
| **Hechicero** | se planta a unos 25 m y cada 4.5 s te tira un hechizo al puesto donde estás. El piso se marca en rojo: corréte un puesto |
| **Cura** | se planta cerca de la puerta y cada 3 s le devuelve 1 de vida a los que tiene a 6 m. Aura y cuerpo verdes |
| **Invencible** | se planta cerca de la puerta y vuelve inmunes a los que tiene a 8 m. Aura violeta |
| **Esquiva** | si le apuntás más o menos (a unos 2 m de la línea), salta 3 m al costado **ni bien soltás el tiro o tirás una habilidad**, siempre; recarga 5 s. Hacela saltar con algo (un tiro flojo, una habilidad) y pegale con lo que importa antes de que recargue, o agarrala con un área. **Recibir daño se la recarga en el acto**: después de cada golpe hay que volver a hacerla saltar. Al golpe fantasma no lo ve venir: no salta, y no se la recarga |
| **Se cura** (5/10) | se cura **entero** cada tanto: la barra verde debajo de la vida se llena y al llenarse el cuerpo brilla verde. El ciclo sale de su vida: alcanza para matarlo con golpes medios seguidos (uno cada 1.5 s) y sobran 1.2 s (al élite, 0.8). Con 6 de vida, cada 4.2 s. Conviene arrancar ya cargando justo después de la cura. Silenciado no se cura, y el ciclo vuelve a empezar cuando se le pasa. Trae 2 de vida de más (el élite no) |
| **Intocable** (5/10) | casi todo el tiempo es **invulnerable**, como los que protege el chamán (violeta, y las pelotas rebotan): su barra violeta se descarga en 3.5 s y cuando se vacía queda vulnerable 1.5 s (la barra se pone dorada), y vuelve a empezar. Hay que tirar para que la pelota llegue en esa ventana. El élite: 3 s y 2 s. Con poca dificultad la ventana dura más. El golpe fantasma le entra siempre; silenciado es vulnerable, y cuando se le pasa arranca invulnerable |

- Los poderes que cambian cómo se mueve (explota, cava, bandera, hechicero, aura) solo los recibe un
  cuerpo que camina y pega; los de defensa, cualquiera menos el jefe.
- **Se ven en íconos** antes de la vida, cada uno con su forma y su color: escudo naranja (con
  cuánto resta, o ∞ el que no deja pasar nada), blindaje en un yelmo azul (con su número), la **calavera**,
  que marca al élite,
  etéreo (fantasma blanco con ojos), divino (aureola amarilla), esquiva (flecha doble turquesa),
  invencible (estrella violeta), cura (cruz verde), hechizo (llama rosa), bandera (roja), bomba (negra)
  y loma (marrón, con pasto). El divino y la
  esquiva se apagan mientras recargan. El silenciador apaga todos los poderes (escudo, blindaje,
  fantasma, divino, auras, bandera, loma, hechizo, esquiva, bomba): se tachan con un prohibido rojo
  mientras dura. La calavera no: el élite sigue matando de una.
- Ningún enemigo con aura queda protegido ni curado por otra aura.
- **La partida: tres escenarios y el jefe.** Cada partida sortea **tres poderes de escenario** entre
  escudo, blindaje, fantasma, divino y esquiva. Cada escenario son tres oleadas: la primera presenta su
  poder (lo trae el primero que aparece), y la tercera la cierra un **élite**: el cuerpo fuerte del
  escenario (jefe goblin en el primero, caballero en el segundo, gólem chico en el tercero) con el poder
  en su versión más dura (la calavera, blindaje 2, el divino que recarga en 3 s...) y agrandado hasta
  unos 3 m, así que el jefe goblin crece mucho y el caballero poco.
- **El cuerpo fuerte viene desde el arranque del escenario**: uno en la primera oleada, tres en la
  segunda y tres en la tercera, **siempre sin poder**: de ese cuerpo, el único con poder es el élite. La décima es la
  del Gólem de roca, con todo lo anterior mezclado.
- **La dificultad decide cuánto de lo que sigue sale** (ver más abajo). Sin puntos, cada oleada trae solo
  el poder de su escenario, sin olas especiales, apoyos ni kamikazes, y el jefe viene con enemigos comunes.
- **Con poder**: un cuarto de cada oleada (un tercio con el talento). Si los poderes **se acumulan**, la
  mitad trae el del escenario y la otra mitad los de escenarios anteriores. Uno solo por enemigo.
- **Apoyo**: la partida sortea poderes de apoyo (hechicero, cura, invencible, bandera): con un punto, uno
  en el último escenario; con dos, uno en el segundo y otro en el tercero, de a uno o dos por oleada.
  **Cavar**, por ahora, no sale.
- **Olas especiales**: con un punto, la segunda oleada de la partida es una; con dos, también la segunda
  del segundo o del tercer escenario (otra distinta). **Cada una deja su marca en las oleadas que siguen**:
  - **La estampida**: muchos más, chicos, y casi un tercio explota. Después, cada oleada trae 10 chicos
    de más, y cada goblin o goblina sin otro poder tiene un 10 % de salir kamikaze. Sin estampida no
    hay kamikazes.
  - **Los gigantes**: menos, bien más grandes (×1.7, sin llegar a los 3 m del élite), con 3 de vida
    más y un 15 % más lentos. Después, 3 gigantes por oleada.
  - **Todos con poder**: cada uno trae un poder de escenario, aunque no haya salido sorteado en la
    partida, y 1 de vida menos. Después, 2 por oleada con los poderes que no salieron.
- **Los cuerpos** suben con los escenarios: del goblin al esqueleto y el jefe goblin en el primero;
  entran el caballero y el chamán en el segundo; el gólem chico y el alma en pena en el tercero.
- **Arriba, debajo del número de oleada**, van los íconos de los tres poderes de la partida y la
  calavera del jefe, con el escenario en curso encendido.
- **Topes** para que nada quede imposible con el mejor golpe en 4: escudo y blindaje van de 1 a 3 (más
  en el tercer escenario), el etéreo no va en cuerpos de más de 8 de vida ni en los de 1 (al goblin no
  le cambia nada: el fantasma pasa al próximo que pueda tenerlo) y el blindaje 3 solo en los de hasta 4.
- **Una bandera por vez**: si ya hay un abanderado en el campo, el siguiente sale sin bandera.
- **Los que sostienen un aura** (cura, invencible) caminan al paso del aliado más lento que tengan
  cerca, para no dejarlo afuera.
- En el código: `buildRun` arma la partida y `spawnOrder` reparte los poderes (`src/core/waves.ts`).
  `node --experimental-transform-types tools/oleadas.mts` mide qué tan difícil es cada oleada,
  promediando muchas partidas.

### La dificultad: talentos al revés

Cada partida ganada **con todos los puntos puestos** da un punto de dificultad, y cada punto puesto hace
la partida más difícil. Se reparten como uno quiera en un menú entre partidas (en la pantalla de inicio,
con el primer punto, y en el cartel del final), y se pueden mover cuando se quiera: vale para la próxima
partida. Se guarda en el navegador. Son 16 puntos en 11 talentos. En el juego, ganar un punto se anuncia
como «¡Desbloqueaste el nivel N de dificultad!».

**El cartel del final** (`src/endscreen.ts`): el título entra de golpe, el puntaje cuenta hacia arriba
con el récord del navegador al lado, y aparecen de a uno, cada uno con su nota, los números de la
partida: oleada, tiempo, bajas, daño, puntería, golpes perfectos, el mejor tiro, la racha sin errar,
habilidades y cómo quedó la puerta. Al final, el aviso del nivel desbloqueado. Al ganar, además, rayos y
papelitos. Los números salen del registro de la partida (`src/telemetry.ts`), que ahora se anota siempre
aunque solo se mande cuando corresponde.

| Talento | Niveles |
| --- | --- |
| Poderes acumulados | los poderes de los escenarios anteriores siguen viniendo |
| Olas especiales | 1: la segunda oleada es especial y deja su marca; 2: otra más adelante |
| Apoyos | 1: en el último escenario; 2: desde el segundo |
| Poderes más duros | escudos y blindajes de hasta 3 (sin el punto, hasta 2), y el escurridizo y el bendito recargan a tiempo (sin el punto, ×1.6) |
| Más rápidos | sin puntos los enemigos van a ×0.76; 1: ×0.88; 2: a su velocidad; 3: ×1.12 |
| Terreno irregular | se juega en uno de los tres campos con lomas (sin el punto, en el liso). Cambiarlo en la pantalla de inicio cambia el campo en el acto |
| Más con poder | 1: un tercio en vez de un cuarto; 2: la mitad |
| Élites más duros | +2 de vida (sin el punto, el élite trae 2 menos) |
| Escolta del jefe | el jefe viene con los poderes de la partida y los apoyos |
| Sin respiro | 4 s de descanso entre oleadas en vez de 6 |
| Golpe 4 | en el medio del rojo de la barra aparece el golpe 4 (en rojo; el 3 queda a los costados, en naranja): pega 1 más que el 3, también en el área, y entre los dos duran lo que el 3 sin el talento. A cambio los comunes traen +1 de vida, los élites +2 y el jefe +8. Es el único talento que también te da algo. Las habilidades no tienen golpe 4. Los números del golpe están en `FOURTH` (`src/core/clubs.ts`, panel B, pestaña Carga) |

Con todo puesto es la partida de antes del 3/10, más rápida y con menos descanso, y con dos olas especiales
que dejan marca en vez de tres. Los números están en `DIFFICULTY` (`src/core/difficulty.ts`) y las marcas
en `MARKS` (`src/core/waves.ts`); los dos se tocan en el panel B, pestaña Enemigos, donde también se
pueden poner los puntos ganados para probar cualquier nivel.

### Las partidas se mandan solas

Al terminar (o al dejarla por la mitad), la partida se manda a Supabase, al proyecto del ManaMod, tabla
`golf_runs` (`src/telemetry.ts`): nivel y talentos, resultado y oleada, y por oleada tiros, aciertos,
perfectos, bajas, daño, habilidades, y la vida y la puerta que se perdieron con quién las sacó; las cartas
ofrecidas y elegidas. Sin datos personales: un id al azar por navegador. Lo que no sale queda en una cola
y se manda la próxima vez. No mandan el bot, el espectador ni las pruebas automáticas. La tabla se crea
una vez con `docs/telemetria.sql`, que trae también consultas para mirar.

## El campo: tres mapas, uno por partida

Desde el 3/10 las lomas son un talento de dificultad (*Terreno irregular*): sin él se juega en el campo
liso. Con él, **cada partida sale uno de tres mapas diseñados**: *Valle del medio*,
*La meseta* (más baja que al principio) y *La loma sola*. Cambia dónde está la cobertura, por dónde
vienen en fila y desde qué puesto conviene pegar, sin que ninguno quede injugable. `?campo=1` a
`?campo=3` fuerza uno, y `?plano` deja el campo liso (es lo que usa la prueba general, que mide trayectorias).

Son formas diseñadas, no ruido: el driver sale rasante, así que una loma es cobertura y una zanja es un
carril. Al azar, atravesar filas sería una lotería.

- Cerca de los puestos y de la muralla el piso es plano; el relieve entra de a poco desde los 14 m.
- Los enemigos caminan sobre el terreno.
- **Una loma tapa al driver**, que sale rasante: al que está detrás no le llega. La línea de tiro se
  corta donde el tiro toca el terreno, para que se vea. El hierro y el wedge pasan por arriba.
- **Un valle es un carril**: los que bajan por ahí quedan servidos para un tiro a lo largo.
- **No hay control de altura.** El tiro se inclina solo lo que sube o baja el terreno entre la pelota y
  el cursor: apuntando a la cima de una loma sube, apuntando al fondo del valle baja. Los globos caen
  en el punto apuntado aunque esté más alto o más bajo.
- La pelota pica según la pendiente y rueda cuesta abajo. El pasto amortigua: la que entra de frente
  contra la cara de una loma se clava, la que la roza sigue de largo.
- Lo que falta a propósito: las pendientes no frenan a los enemigos, no hay búnker ni agua, y el bot no
  aprovecha el relieve.

La altura sale de `src/core/terrain.ts` (ahí se agregan mapas nuevos), y la pelota contra el terreno de
`src/core/ballistics.ts`. `node tools/relieve.mjs` lo prueba y deja capturas en `logs/relieve-*.png`.

## Panel de balance y pruebas (`B`)

`B`, o el botón *Balance*, abre un panel al costado que toca los números del juego en vivo, sin
recargar. Va en pestañas:

- **Palos**: el daño de cada palo en cada banda de distancia y para cada nivel de golpe, su alcance, el
  radio de su área, la rapidez del rodado, la distancia fija y los dos modos del hierro; y dónde
  **cortan las bandas** (20 y 40 m por defecto).
- **Carga**: los cuatro tiempos de la barra (débil, medio, fuerte y rebote), cómo quedan con las
  mejoras que tenés, y dónde se dibuja cada tramo.
- **Tiro**: qué hacen A y D mientras cargás (nada, correrse de a pasos, correrse seguido o darle
  efecto). Cada modo muestra solo sus números.
- **Habilidades**: la lista de las 27 con el **nivel que tiene** cada una. Subirlo se la da (va al primer
  lugar libre) y bajarlo a 0 se la saca; si ya tiene cuatro, avisa. El botón *números* abre una
  ventanita con la recarga, el alcance y lo que hace en cada nivel. Arriba, *Sacar tres cartas ahora*.
- **Mejoras**: lo mismo con las mejoras (cuántas veces tomada cada una, con sus números al lado), y las
  dos curaciones.
- **Enemigos**: vida, velocidad, daño y ritmo de ataque de cada uno (a los que ya están en el campo se
  les empareja), y **prender o apagar** un tipo entero sin cambiar la composición de las oleadas.
- **Campo**: cambiar de campo (reinicia la partida: el terreno se arma una sola vez) y la cámara.
- **Visual**: lo que se ve y no cambia cómo se juega, cada cosa con su interruptor y los cuadros por
  segundo arriba para ver cuánto cuesta. **Sombras** del sol (con resolución), **corrección de color**
  (ninguna, ACES, AgX, neutra) y exposición, **hora del día** (mediodía, tarde, atardecer: sol, cielo en
  degradé y niebla; la altura y la dirección del sol se tocan sueltas), **contorno de luz** en los
  personajes y **brillo** en lo que emite luz. *Todo apagado* deja el juego como era antes. Se guarda
  aparte del balance, así que *Restaurar* no lo toca. Vive en `src/game/visuals.ts`.
- **Pruebas**: **oleada infinita** (repite la composición de la oleada en curso), **vida infinita**,
  **puerta infinita** y **saltar a cualquier oleada**.

Abajo, en todas, **Copiar configuración** deja en el portapapeles todo el balance como texto para
pasarlo y llevarlo al código.

Los cambios valen desde el tiro siguiente y desde el enemigo siguiente, y **se guardan en el navegador**:
al recargar vuelven. Hace falta porque cambiar de campo recarga la página. El botón *Restaurar* los
borra y devuelve los valores del código.

## La cinemática de la intro

**Es la intro del juego**: al entrar se abre a pantalla completa arriba de todo (un iframe con
`cine.html?embed`) mientras el juego carga por debajo, y al terminar o con **Saltar** (arriba a la
derecha, o `Esc`) queda la placa de controles para arrancar. Cuenta la historia con los modelos 3D: la
feria medieval, el atropello en el estacionamiento, el círculo de runas, el mago y los palos de golf
como arma. Reemplazó a las placas de texto. Sale una vez por sesión (al reiniciar con `R` no vuelve),
*Ver la intro de nuevo* la repite, `?sincine` la saca y `?cine` la fuerza (las pruebas automáticas no
la ven, salvo con `?cine`). También se abre sola en https://leandromagonza.github.io/GolfKnight/cine.html.
La historia y el plan están en `docs/cinematica.md`.

- El guion es `src/cine/intro.ts`: planos con escenario, cámara, qué hace cada actor, textos, sonidos y
  números que cambian con el tiempo (fundidos, brillo de las runas y de los palos, faros). Los campos
  están explicados en `src/cine/types.ts`.
- El reproductor (`src/cine/player.ts`) calcula todo como función del tiempo, así que se puede ir a
  cualquier segundo: la barra de abajo se arrastra, `?t=12.5` en la URL abre pausado ahí, espacio pausa,
  las flechas mueven un segundo y `,` `.` un cuadro.
- Escenarios y utilería (carpas, autos, bolsa de palos, círculo de runas) son figuras simples, en
  `src/cine/sets.ts`.
- `node tools/cine.mjs` saca tres cuadros por plano (o los segundos que se le pasen) a
  `logs/cine-*.png`, con la GPU.
- Voces: actuadas con OpenAI (`tools/voces_openai.py`, en `public/voices/`) y, para comparar, las de
  Kokoro (`tools/voces.py`, en `public/voices/kokoro/`, se oyen con `?voces=kokoro`). Se corren con el
  Python del asistente (`E:sistente\.venv\Scripts\python.exe`); las líneas están en
  `tools/voces_lineas.py`. Cada globo dice la suya con `voice`, y la música baja mientras alguien habla.
- Modelos propios: `cine-dungeon.glb` (los personajes de PolygonDungeon con los clips de la
  cinemática: Hit By Car, Getting Up, Looking Around, Pointing, Rallying, Reacting, Talking) y
  `mage.glb` (el mago, un personaje de Mixamo, con las texturas bajadas a 1024 con
  `fbx_to_glb.py --max-texture=1024`).

## Publicar

El juego está en https://leandromagonza.github.io/GolfKnight/, junto a los otros juegos de la landing
(`S:\LeandroMagonza.github.io`, que lo lista en `script.js`). El repo es
https://github.com/LeandroMagonza/GolfKnight: el código va en `main` y el sitio compilado en la rama
`gh-pages`, que es la que sirve GitHub Pages.

```
npm run deploy
```

Compila con Vite (`base: './'`, así que anda en cualquier subcarpeta) y sube `dist/` a `gh-pages`.
La carpeta `assets/` (FBX originales de Mixamo y modelos sin usar) no se sube al repo: son archivos
fuente de terceros que no corresponde redistribuir. Los GLB ya armados que usa el juego sí están, en
`public/models/`.

Cada commit de `main` tiene que figurar en [`PATCHNOTES.md`](PATCHNOTES.md) con su hash corto. El
hook `.githooks/pre-push` frena el push si falta alguno (`npm install` lo deja configurado con
`core.hooksPath`), y `npm run patchnotes` lista lo que falta contra el archivo del disco.

## Estructura

- `src/core/`: lógica pura con tests (`ballistics`, `clubs`, `swing`, `waves`, `difficulty`).
- `src/difficultyMenu.ts`: el menú de dificultad entre partidas. `src/telemetry.ts`: el registro de cada partida.
- `src/game/`: `player` (estados libre / cargando / swing, salto por el portal, agarre), `tees` (los puestos de tiro y las pelotas que tiran los guardias), `golfClips` (detecta solo las fases de los clips de swing), `swingPose` (el palo, y un swing
  procedural con IK de respaldo), `balls` (pelotas y encantamientos), `enemies` (horda, hielo, aura del chamán), `effects`, `world`.
- `src/audio/audio.ts`: todo sintetizado con Tone.js.
- `tools/`:
  - `playtest.mjs`: prueba automática con comprobaciones (sale con error si alguna falla): palos bloqueados,
    cartel, puestos y pelotas, palo en cola, medidor y niveles, fila de goblins, hielo, empujón, chamán, putter,
    alma en pena, vida, puerta, pausa y
    derrota. Capturas en `logs/`.
  - `oleadas.mts`: la dificultad de cada oleada (vida efectiva por segundo), para que la curva suba pareja.
    Se corre con `node --experimental-transform-types tools/oleadas.mts`.
  - `props_to_glb.py`: junta props de PolygonDungeon (los escudos) en un GLB con el atlas del pack.
  - `botplay.mjs`: un bot (`src/bot.ts`, el mismo de `?bot`) juega las oleadas, para chequear balance. No
    camina ni busca filas: es una cota inferior. Con `--ver` abre una ventana para mirarlo.
  - `swingshot.mjs`: capturas de cerca de cada fase del swing, y distancia cabeza-pelota en el impacto.
  - `visual.mjs`: capturas de la misma escena con la capa visual apagada y en cada hora del día
    (`logs/visual-*.png`). Usa la GPU, no el render por software. Las pruebas automáticas arrancan con
    lo visual apagado, salvo `?visual` en la URL.
  - `rootmotion.mjs`: chequeo de regresión del root motion. Mide el desplazamiento de la cadera en cada clip,
    para la horda y cada skin; falla si alguno pasa de 5 cm.
  - `clipinfo.mjs`: fases detectadas de los clips de golf (address, tope, impacto, final).
  - `club_to_glb.py`: normaliza el modelo del palo (mango en el origen, a lo largo de +Z, largo 1).
  - `retarget_to_glb.py`: retargetea clips de Mixamo a otro esqueleto (los personajes de PolygonDungeon, o un
    personaje Mixamo cuya pose de reposo no coincide con la de los clips).
  - `fbx_to_glb.py`, `mt_blender.py`, `inspect_fbx.py`, `glb-info.mjs`: pipeline de modelos (Blender CLI).

`window.__gk` expone el estado del juego en la consola (spawn de enemigos, tiro exacto, `unlockAll()`, etc.).

## Modelos

La horda y los dos caballeros salen de `public/models/dungeon.glb`: los 16 personajes de PolygonDungeon
(`Assets/PolygonDungeon/Models/Characters.fbx` del proyecto Unity), que comparten un esqueleto y no
traen animaciones. `tools/retarget_to_glb.py` renombra los huesos a los de Mixamo, les retargetea
los clips (locomoción, golf, `Dropping` y `Rallying`, el festejo al ganar) y exporta todo junto; el juego se queda con la malla que
necesita en cada caso (`mesh` en `ENEMIES`, `src/core/waves.ts`). El putter ya no se usa para pegar, así que
`Golf Putt` queda sin uso por ahora (serviría para animar el tiro del portal). Para rearmarlo:

```
blender -b --python tools/retarget_to_glb.py -- "<PolygonDungeon>/Models/Characters.fbx" "<PolygonDungeon>/Textures/Dungeons_Texture_01.png" public/models/dungeon.glb "Idle=<pack>/idle.fbx" "Running=<pack>/running.fbx" "Walking=<pack>/walking.fbx" "Falling To Roll=<pack>/falling to roll.fbx" "Hard Landing=<pack>/hard landing.fbx" "Golf Drive=assets/mixamo/Golf Drive.fbx" "Golf Chip=assets/mixamo/Golf Chip.fbx" "Golf Putt=assets/mixamo/Golf Putt.fbx" "Dropping=assets/mixamo/Dropping.fbx" "Strafe Left=<extra>/Left Strafe Walking.fbx" "Strafe Right=<extra>/Right Strafe Walking.fbx" "Rallying=assets/mixamo/Rallying.fbx"
```

Sumar un enemigo es agregar una entrada en `ENEMIES` con la malla del personaje (quedan sin usar
fantasmas, jefe goblin, goblin hembra guerrera y esqueletos esclavo y soldado 02). La altura
se normaliza sola. Los clips solo cubren la locomoción: el golpe, las manos en alto del chamán, el
agarre del alma en pena y el lanzamiento del gólem se arman por código sobre los brazos (`applyGesture` en `src/game/enemies.ts`),
y la muerte reusa `Hard Landing`. Si algún día hay clips de ataque de Mixamo, entran por el mismo script.

Los bichos del pack cute (lobos, caparazón, bombín, dragón) ya no se usan; sus GLB quedaron en
`assets/models-cute/`.


## Personajes y palo

- `player.glb`: el guardia `castle_guard_01` (Guard02) de Mixamo, con `Idle`, `Running`, `Walking`,
  `Falling To Roll` y `Hard Landing` del Action Adventure Pack de MonsterTamer, los clips `Golf Drive`
  (driver y hierro), `Golf Chip` (wedge) y `Golf Putt` (putter), y `Rallying` (los brazos en alto: el
  festejo al ganar, el mismo clip de la cinemática). Los cuatro skins lo tienen.
- `player-guard3.glb` y `guard.glb`: el guardia de `Dropping.fbx` (Guard03) con todos los clips del
  jugador más `Dropping` (`guard.glb` es el armado anterior, sin `Rallying`: los de la puerta no festejan). Es el segundo skin, y el que hace guardia al lado de la puerta.
  Sus hombros descansan a 31° de los del esqueleto de los clips, así que se arma con
  `retarget_to_glb.py` (con `-` en lugar del atlas) y no con `fbx_to_glb.py`.
- Los skins Caballero y Caballera salen de `dungeon.glb`. La lista está en `SKINS` (`src/main.ts`).
- `club.glb`: el palo de "Used Golf Club" (`Assets/Used Golf Club` del proyecto Unity).
- `player-peasant.glb`: el modelo anterior, sin clips de golf; sirve para probar el swing procedural.

Los FBX originales están en `assets/mixamo/`. Los clips vienen de un esqueleto Mixamo de 69 huesos y
otras proporciones; `fbx_to_glb.py` descarta las pistas de los huesos que el guardia no tiene (dedos) y
reescala el recorrido de la cadera. Para rearmar:

```
blender -b --python tools/fbx_to_glb.py -- assets/mixamo/castle_guard_01.fbx public/models/player.glb --normalize-humanoid "Idle=<pack>/idle.fbx" "Running=<pack>/running.fbx" "Walking=<pack>/walking.fbx" "Falling To Roll=<pack>/falling to roll.fbx" "Hard Landing=<pack>/hard landing.fbx" "assets/mixamo/Golf Drive.fbx" "assets/mixamo/Golf Chip.fbx" "assets/mixamo/Golf Putt.fbx" "Strafe Left=<extra>/Left Strafe Walking.fbx" "Strafe Right=<extra>/Right Strafe Walking.fbx" "Rallying=assets/mixamo/Rallying.fbx"
blender -b --python tools/club_to_glb.py -- "<Used Golf Club>/Assets/Meshes/Golf Club Model.fbx" "<Used Golf Club>/Assets/Textures" public/models/club.glb
```

(`<pack>` es `MonsterTamer/web/assets/mixamo/action-adventure-pack` y `<extra>`, `MonsterTamer/web/assets/mixamo/extra`: los dos clips de caminar de costado, que usa el tenista. El Guardia veterano, `player-guard3.glb` y `guard.glb`, se arma igual que `dungeon.glb` pero con `assets/mixamo/Dropping.fbx` de base y `-` como atlas.)

Cómo funciona el swing con clips: `golfClips.ts` muestrea la mano derecha del clip y encuentra el
impacto (máxima velocidad horizontal), el tope (la pausa anterior), el address y el final; también
de dónde sale la pelota y cómo va el palo respecto de la mano. Mientras se carga, el clip se recorre
a mano entre el address y el tope siguiendo al medidor; al soltar salta al punto equivalente de la
bajada, y la pelota sale cuando el clip cruza el impacto. Cualquier otro clip de swing debería andar
sin anotar tiempos: alcanza con sumarlo en `SWING_CLIP` (`player.ts`).