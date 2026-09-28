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
- **La barra se ve como un arco**, entre los palos y las habilidades, como en los juegos de golf: verde
  (débil) en los dos bordes, amarillo (medio) y rojo (fuerte) arriba en el medio. La aguja sube por la
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
| **1 · Driver** | rasante, atraviesa la fila entera | 4-66 m | 1 / 2 / 3 | 1 / 3 / 5 | **2 / 4 / 8** |
| **2 · Hierro 7** | arco bajo que revienta en el que toca | 4-55 m | 1 / 3 / 7 | 1 / 3 / 7 | 1 / 3 / 7 |
| **3 · Wedge** | globo alto, cae en picada y se queda ahí | 3-55 m | pifia / 1 / 2 | pifia / 1 / 2 | pifia / 1 / 2 |
| **4 · Putter** | rueda y le pega al primero que toca | 2-20 m | **2 / 4 / 8** | — | — |

Los tres números de cada casilla son el daño según la calidad del golpe. El putter llega justo hasta la
línea de 20 m, así que nunca sale de la banda corta.

**La pifia:** con el wedge, el golpe 1 no sale. El palo pasa, suena el fallo, la pelota se queda en el
puesto y cuenta como errar. Es para que el globo, que abre el área más grande sin apuntarle a nadie, pida
también timing.

**El área pega menos que el impacto**, porque agarra a varios y no hay que apuntarle a nadie. El hierro
es el único que hace las dos cosas: **el que se come el pelotazo cobra el impacto** (1 / 3 / 7) y los de
alrededor cobran el área (**1 / 2 / 4**). Nadie cobra las dos por un mismo tiro. El wedge solo hace
área, así que su tabla ya *es* la del área; por eso, abriendo la más grande de todas, es la más baja.

**Quién abre área y cuándo:**

| Palo | ¿Atraviesa? | ¿Abre área? | ¿Y si cae al piso sin tocar a nadie? |
| --- | --- | --- | --- |
| Driver | sí, a todos los de la fila | no | pica y sigue |
| Hierro 7 | no | sí, al contacto (1.8 / 2.2 / 2.7 m) | **no pasa nada: hay que conectar** |
| Wedge | no | sí, donde cae (4.2 / 5 m en los golpes 2 y 3) | igual explota: cae adonde apuntaste |
| Putter | no | no: le pega al que toca, a él solo | se queda ahí |

El **escudo es blindaje de frente**: la pelota que le llega de frente, venga rasante o en arco, rebota
igual, pero a ese golpe le resta su número y el resto entra. El del goblin guerrero es 4: un golpe 3 de
lejos con el driver (8), o de cerca con el putter (8), lo mata igual de frente. Lo único que no cuenta
como de frente es lo que cae a más de 45°, el globo del wedge. El escudo también cubre del **daño en
área** que estalla adelante suyo, a él y a los que tiene detrás, con el mismo descuento. El ícono del escudo, antes
de la vida, dice cuánto resta. Al del escudo se lo resuelve pegándole fuerte, con la
granada, cayéndole detrás con el wedge, o pegándole de costado.

El **escudo muro** (violeta, más grande, con el brillo de los inmunes del chamán) no deja pasar nada de
frente, por fuerte que sea.

El hierro tiene **dos modos** en el panel de balance, para probarle la identidad: *revienta* (el de
arriba) y *atraviesa* (pasa de largo hasta a tres y abre su área donde cae, le pegue a alguien o no).

### Las habilidades (`Q`, `W`, `E`, `R`) y las cartas

**Al terminar cada oleada salen tres cartas y te quedás con una** (click, o `1`, `2`, `3`). Hay de tres
clases:

- **Habilidad**: una nueva va al primer lugar libre de `Q`, `W`, `E` o `R`. Si ya la tenés, sube de
  nivel (hasta 3): pega más o agarra más, pero **recarga un 30 % más lento por nivel**.
- **Mejora**: cosas que valen para todo el juego. A propósito no tocan la tabla de daño de ningún palo,
  para no romper la regla de «cada palo tiene su distancia».
- **No hay cartas de curarse**: eran mucho peores que el Botiquín, que cura un poco al terminar cada
  oleada. Si la puerta está a la mitad o te queda una vida, una de las tres cartas es sí o sí el
  Botiquín (mientras no esté al tope).

Cada habilidad tira **su propia pelota**: no gasta la del puesto. Sale en el acto hacia el mouse, aun con
un tiro cargando.

**Palo y elemento** (15): cualquier palo con hielo, fuego o rayo, y el driver, el hierro y el wedge con
viento. Es un tiro de ese palo, instantáneo, con pelota gratis y **cargado al nivel de la habilidad**, que
además:
- *Hielo*: enfría a cada uno que alcanza.
- *Fuego*: lo prende; pierde 1 de vida por segundo.
- *Rayo*: salta al enemigo más cercano, una vez por nivel. **Nunca salta a uno que ya tocó**, así que
  no puede dar vueltas matando a todo.
- *Viento* (antes era el vendaval, solo rasante), distinto con cada palo:
  - driver: el viento va detrás de la pelota y **junta sobre la línea** a los que pasa (3 m de cada
    lado; 3.75 y 4.5 en los niveles 2 y 3), para el próximo tiro;
  - hierro: donde revienta, una ráfaga **manda para atrás** 6 m (8 y 10) a los que están a 3.5 m;
  - wedge: donde cae, un remolino **los amontona** hacia el centro, desde 4.5 m (5.25 y 6).
  Con el putter no hay.

**Las demás** (12):

| Habilidad | Qué hace |
| --- | --- |
| Granada | silencia a los que agarra (sin escudo, sin aura, sin inmunidad, vulnerables); a los del borde los tira a los costados |
| Hielo | zona fría que dura: el que está adentro camina lento |
| Carrito | un carrito de golf cruza el campo de costado a la altura que apuntás, y atropella |
| Hoyo | el primero que lo pisa cae y no vuelve (los jefes no) |
| Bandera | los que están cerca van hacia ella en vez de a la puerta |
| Pólvora | marca; el marcado que muere explota, y encadena si los de al lado están marcados |
| Boomerang | tirás el palo de la mano: va y vuelve pegando, y mientras vuela ese palo no se puede usar |
| Lluvia de pelotas | una pelota en cada puesto |
| Caddie dorado | unos segundos con pelota infinita en tu puesto |
| Lupa | los agranda: más fáciles de pegar, y vulnerables |
| Clon | una copia tuya repite tus próximos tiros desde donde la dejaste |
| Palazo | no hace daño: manda lejos hacia atrás a lo que tengas encima (a 4 m; 4.75 y 5.5 m en los niveles 2 y 3) y les corta el ataque. Te saca de encima al alma en pena |

**Mejoras**: Muñeca rápida (el débil y el medio un 15 % más rápidos: llegás antes al golpe 3, y la
ventana del perfecto dura lo mismo), Punto dulce (el perfecto dura un 35 % más: abre igual y el rebote
llega más tarde), Swing parejo (hasta 3 niveles: cada uno acerca un tercio los tiempos de la barra a
partes iguales, y al tercero débil, medio y fuerte duran lo mismo; las otras mejoras de la barra van
encima, así que el fuerte puede terminar durando más que el débil), Ritmo (cada tiro seguido **sin errar** te hace llegar antes
al golpe 3, hasta tres, y ahí se queda hasta que errás), En racha (después de 4 tiros seguidos sin errar,
los golpes de palo que pegan 1 pasan a pegar 2 hasta que errás: sube el piso de cada palo sin tocar el techo, y al putter no le hace nada), Carga en
carrera (la barra arranca cuando apretás, aunque estés corriendo a un puesto con pelota; si soltás antes
de llegar, sale al llegar), El albañil (cada tiro que mata a dos suma 1, a tres suma 2, y así; cada 5, la puerta +1; no se corta),
Botiquín (hasta 3 niveles: al terminar cada oleada, la puerta +1 y vos +1 por nivel), Perfecto de regalo (cada 8 bajas, el próximo tiro arranca clavado arriba),
Carcaj (si vas a pegar sin pelota, te aparece una; una cada 12 s), Pelota extra (los guardias mantienen
una más), Segundo aire (apretar una habilidad que recarga la tira igual, y recarga él 30 s).

Las mejoras tomadas se ven en **una columna a la izquierda**, con lo que cuentan: cuánto le falta al
carcaj o al segundo aire, cuántas bajas llevás para el perfecto de regalo, cómo va cada racha. El
perfecto de regalo no se pierde si cancelás el tiro o volvés a empezar la carga: queda para el próximo.
**Errar** es un tiro de palo que no le pega a nadie (o solo a escudos e inmunes). Pegarle sin matar no
corta ninguna racha.

**Maestrías**, que solo salen con dos habilidades del mismo elemento:
- *Hielo*: un segundo hielo sobre el que ya está frío lo **congela**, y el golpe que rompe el hielo pega
  el doble.
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
  R. Si un alma en pena te agarra, los primeros 2 s no hay forma de soltarse; después, **sacudite con A
  y D** (seis toques) o usá el palazo, si lo tenés. Al soltarte, el alma en pena se esfuma: agarra una
  vez y se va.
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
| Alma en pena | 2 | la única que te persigue: te agarra (2 s sin poder soltarte) y te desangra; cuando te soltás, se esfuma |
| Gólem de roca | 80 | el jefe: tira piedras a la puerta desde lejos. No recibe poderes |

| Poder | Qué hace |
| --- | --- |
| **Escudo 1 a 5** | blindaje de frente: a lo que le llega de frente le resta su número. Cada nivel es un escudo distinto: madera, tablones, hueso, escudo rojo, redondo |
| **Escudo calavera (10)** | de frente no entra nada: por detrás, de costado o con la granada |
| **Blindaje 1 a 3** | le resta eso a cada golpe, venga de donde venga. Tiñe de acero |
| **Explota** | corre a la puerta y revienta al llegar o al tocarte, y se lleva a los de al lado. Late en rojo |
| **Divino** | el primer golpe no le entra; se le recarga a los 5 s |
| **Etéreo** | ningún golpe le saca más de 1: hay que pegarle muchas veces. Medio transparente |
| **Cava** | se planta y canaliza 8 s una loma adelante suyo, que tapa al driver. Si lo matás antes, baja; si termina, queda hasta el final de la partida |
| **Bandera** | se queda al fondo (unos 42 m); mientras vive, todos tienen 1 de vida más |
| **Hechicero** | se planta a unos 25 m y cada 4.5 s te tira un hechizo al puesto donde estás. El piso se marca en rojo: corréte un puesto |
| **Cura** | se planta cerca de la puerta y cada 3 s le devuelve 1 de vida a los que tiene a 6 m. Aura y cuerpo verdes |
| **Invencible** | se planta cerca de la puerta y vuelve inmunes a los que tiene a 8 m. Aura violeta |
| **Esquiva** | si le apuntás más o menos (a unos 2 m de la línea) cuando la carga pasa a 2, salta 3 m al costado; recarga 5 s. Esperá a que se le pase, o cargá mirando a otro lado y apuntale al final |

- Los poderes que cambian cómo se mueve (explota, cava, bandera, hechicero, aura) solo los recibe un
  cuerpo que camina y pega; los de defensa, cualquiera menos el jefe.
- **Se ven en íconos** antes de la vida: escudo (con cuánto resta), blindaje (con su número), calavera
  (violeta, ∞), las auras, la bandera, la bomba, la loma, el hechizo, el etéreo (con su 1), el divino
  y la esquiva (una flecha doble; estos dos, apagados mientras recargan). Lo que la granada silencia
  (escudo, blindaje, auras, bandera, loma, hechizo, esquiva) se tacha con un prohibido rojo mientras dura.
- Ningún enemigo con aura queda protegido ni curado por otra aura.
- **Diez oleadas**. La primera trae los cuerpos de 1 a 4 (goblin, goblina, orco, esqueleto) sin poderes.
  Desde ahí cada una presenta un poder, y desde la quinta también un cuerpo: escudo; blindaje; explota;
  jefe goblin y hechicero; chamán y cava; caballero y cura; gólem chico y etéreo; alma en pena e
  invencible; y el Gólem de roca con la esquiva.
- **El reparto**: un tercio de los enemigos de cada oleada sale con poder. La mitad de esos con el nuevo
  (el primero que aparece lo presenta) y el resto con alguno de los que ya se vieron, sobre cualquier
  cuerpo que pueda tenerlo: con mala suerte, un caballero etéreo. El blindaje sale en 1 cuando se presenta, y el escudo de 1 a 3; los dos suben de nivel con la partida
  (el escudo hasta 5, y a veces la calavera). En cada oleada, los escudos sorteados salen **de menor a
  mayor**, y la de los escudos la cierra un esqueleto con la calavera.
- El caballero y el gólem chico cierran la oleada en que se presentan.
- **De pasada**: el escudo divino lo presenta uno solo en la cuarta, y la bandera uno solo en la de
  cavar. Desde la oleada siguiente entran en el sorteo como los demás.
- En `WAVES` (`src/core/waves.ts`): `groups` (los cuerpos) y `power` (el que presenta). El reparto está en
  `spawnOrder`, y `node --experimental-transform-types tools/oleadas.mts` mide qué tan difícil es cada una.

## El campo: cuatro mapas, uno por partida

El campo ya no es un plano, y **cada partida sale uno de cuatro mapas diseñados**: *Valle del medio*,
*La meseta*, *Los dos carriles* y *La loma sola*. Cambia dónde está la cobertura, por dónde vienen en
fila y desde qué puesto conviene pegar, sin que ninguno quede injugable. `?campo=1` a `?campo=4` fuerza
uno, y `?plano` deja el campo liso (es lo que usa la prueba general, que mide trayectorias).

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

## Cinemática de la intro (prueba)

`cine.html` (https://leandromagonza.github.io/GolfKnight/cine.html, y el link *Ver la intro animada* en
la pantalla de inicio) cuenta la historia con los modelos 3D: la feria medieval, el atropello en el
estacionamiento, el círculo de runas, el mago y los palos de golf como arma. Todavía no reemplaza a las
placas de la intro. La historia y el plan están en `docs/cinematica.md`.

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
- Voces: `tools/voces.py` las genera con Kokoro (con el Python del asistente,
  `E:sistente\.venv\Scripts\python.exe tools/voces.py`) en `public/voices/`; cada globo dice la
  suya con `voice`, y la música baja mientras alguien habla.
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

## Estructura

- `src/core/`: lógica pura con tests (`ballistics`, `clubs`, `swing`, `waves`).
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
los clips (locomoción, golf y `Dropping`) y exporta todo junto; el juego se queda con la malla que
necesita en cada caso (`mesh` en `ENEMIES`, `src/core/waves.ts`). El putter ya no se usa para pegar, así que
`Golf Putt` queda sin uso por ahora (serviría para animar el tiro del portal). Para rearmarlo:

```
blender -b --python tools/retarget_to_glb.py -- "<PolygonDungeon>/Models/Characters.fbx" "<PolygonDungeon>/Textures/Dungeons_Texture_01.png" public/models/dungeon.glb "Idle=<pack>/idle.fbx" "Running=<pack>/running.fbx" "Walking=<pack>/walking.fbx" "Falling To Roll=<pack>/falling to roll.fbx" "Hard Landing=<pack>/hard landing.fbx" "Golf Drive=assets/mixamo/Golf Drive.fbx" "Golf Chip=assets/mixamo/Golf Chip.fbx" "Golf Putt=assets/mixamo/Golf Putt.fbx" "Dropping=assets/mixamo/Dropping.fbx"
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
  `Falling To Roll` y `Hard Landing` del Action Adventure Pack de MonsterTamer y los clips `Golf Drive`
  (driver y hierro), `Golf Chip` (wedge) y `Golf Putt` (putter).
- `player-guard3.glb` y `guard.glb` (el mismo archivo): el guardia de `Dropping.fbx` (Guard03) con todos
  los clips del jugador más `Dropping`. Es el segundo skin, y el que hace guardia al lado de la puerta.
  Sus hombros descansan a 31° de los del esqueleto de los clips, así que se arma con
  `retarget_to_glb.py` (con `-` en lugar del atlas) y no con `fbx_to_glb.py`.
- Los skins Caballero y Caballera salen de `dungeon.glb`. La lista está en `SKINS` (`src/main.ts`).
- `club.glb`: el palo de "Used Golf Club" (`Assets/Used Golf Club` del proyecto Unity).
- `player-peasant.glb`: el modelo anterior, sin clips de golf; sirve para probar el swing procedural.

Los FBX originales están en `assets/mixamo/`. Los clips vienen de un esqueleto Mixamo de 69 huesos y
otras proporciones; `fbx_to_glb.py` descarta las pistas de los huesos que el guardia no tiene (dedos) y
reescala el recorrido de la cadera. Para rearmar:

```
blender -b --python tools/fbx_to_glb.py -- assets/mixamo/castle_guard_01.fbx public/models/player.glb --normalize-humanoid "Idle=<pack>/idle.fbx" "Running=<pack>/running.fbx" "Walking=<pack>/walking.fbx" "Falling To Roll=<pack>/falling to roll.fbx" "Hard Landing=<pack>/hard landing.fbx" "assets/mixamo/Golf Drive.fbx" "assets/mixamo/Golf Chip.fbx" "assets/mixamo/Golf Putt.fbx"
blender -b --python tools/club_to_glb.py -- "<Used Golf Club>/Assets/Meshes/Golf Club Model.fbx" "<Used Golf Club>/Assets/Textures" public/models/club.glb
```

(`<pack>` es `MonsterTamer/web/assets/mixamo/action-adventure-pack`.)

Cómo funciona el swing con clips: `golfClips.ts` muestrea la mano derecha del clip y encuentra el
impacto (máxima velocidad horizontal), el tope (la pausa anterior), el address y el final; también
de dónde sale la pelota y cómo va el palo respecto de la mano. Mientras se carga, el clip se recorre
a mano entre el address y el tope siguiendo al medidor; al soltar salta al punto equivalente de la
bajada, y la pelota sale cuando el clip cruza el impacto. Cualquier otro clip de swing debería andar
sin anotar tiempos: alcanza con sumarlo en `SWING_CLIP` (`player.ts`).