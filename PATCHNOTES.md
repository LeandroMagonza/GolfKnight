# Golf Knight · Patch notes

Qué cambió en el juego, de lo más nuevo a lo más viejo. Se juega en
https://forja-de-almas.itch.io/golf-knight (la versión publicada se ve en la esquina de la pantalla de
entrada).

Al final de cada línea van los commits que la cubren. `main` no se puede subir si algún commit no
figura acá: lo frena el hook `.githooks/pre-push`, y `npm run patchnotes` muestra lo que falta.

## 10 de octubre

**Para los que prueban**
- En el panel de balance (B), pestaña Pruebas, el bot se puede dejar **sin habilidades**: no tira
  ninguna, y en las cartas elige mejoras o curas. Para ver si pasa el juego sin ellas. `c07d7ea`

## 9 de octubre

**De a dos**
- **Abe entra aunque sus redes no dejen conectarse directo** (algunos routers, el celular con datos):
  ahora la partida pasa por un servidor intermedio. Antes se encontraban, pero no conectaban. También
  en la app de Windows. `b583947` `57f2cb4`
- **La marca de Abe entra siempre**: la pelota que toca a un marcado le saca 1 aparte, aunque rebote en
  el escudo, aunque esté blindado, sea invencible o un fantasma. Antes sumaba al golpe y se la comían las
  mismas defensas. También en la app de Windows. `2a38978` `8d59c81`
- **Abe, con pantalla nueva**: sus hechizos son tarjetas como las de los palos, pegadas al borde, con
  íconos nuevos. Las explicaciones salen antes de empezar y en la pausa, no jugando. La cámara ya no se
  mueve al hacer click: encuadra sola toda la cancha con el caballero en una punta. Arriba hay botones
  para girarla de a 90°, cambiar la altura y elegir dónde van los botones (para probar cuál queda mejor
  en el celular y en la compu). `2a38978` En una pantalla acostada, la cámara arranca de costado. `234c245`
- **Para los que prueban** (la versión con contraseña): el bot juega solo y espera a que entre Abe. Al
  terminar empieza otra partida, así se puede probar de Abe sin otra persona. `234c245`
  Y ahora juega bien: apunta adonde va a estar el enemigo y carga el golpe justo para matarlo. Contra el
  que esquiva, primero tira uno corto para gastarle la esquiva. Contra el escudo de frente usa el wedge,
  y se corre para alinear enemigos. Tiene tres niveles: perfecto, bueno y flojo. `07449a8`
  Y mejor todavía: elige desde qué puesto tirar y nunca le tira a un escudo de frente. Al del escudo le
  pega con el hierro a la cabeza, con el wedge detrás o al costado, o carga el golpe fuerte y le tira el
  silenciador justo antes. Contra el intocable, clava la carga y suelta cuando se abre. Usa bien las
  habilidades. Ganó partidas enteras contra cada poder. Para probar, `?poderes=` elige los poderes de la
  partida. `f21e524`
  Al que se cura ya no le pega justo antes de la cura: si no llega a matarlo antes, carga y espera a que
  se cure para pegarle con todo el ciclo por delante, y al que empezó lo termina antes de ir con otro. Ya
  no se deja atropellar: mira por dónde pasa cada enemigo, no carga ni camina por donde alguien le va a
  pasar por encima, y se corre de las pelotas que le devuelve un escudo. `5592950`

**Los palos**
- Las tarjetas de los palos dicen **cuánto pegan** en vez de hasta dónde llegan: lo de cada golpe (1·2·3)
  y lo que cambia (el driver, +1 a más de 40 m; el hierro, + área; el wedge, todo en área). `2a38978`

## 8 de octubre

**Dónde se juega**
- **Golf Knight se mudó a itch.io**: https://forja-de-almas.itch.io/golf-knight (la demo en el navegador
  y la completa para Windows). La dirección de antes dice que se mudó, con el botón a itch, y los
  enlaces para ser Abe siguen andando. Los que ayudan a probar entran ahí con una contraseña y siguen
  jugando la completa. `d8e9a87`
- Abe anda con cualquier versión del juego que hable lo mismo: la app de Windows ya no avisa «el que
  juega tiene otra versión» cada vez. `d8e9a87`
- El banner de la página de itch, nuevo: el caballero pegando y la horda viniendo por el campo. `2a2991f`
  Rehecho: el caballero a la izquierda apuntando a la derecha, la horda repartida por el campo y el
  título más grande. Las capturas, con un margen, para que en el celular no se vean pegadas. `8df32c1`

**Dificultad**
- Los **élites** tienen el doble de vida: el del primer escenario, 10 (eran 5), el del segundo 18 y el
  del tercero 24, y con cualquier poder piden el doble de golpes. Caminan un poco más lento, así hay
  tiempo de bajarlos. `380fabc`
- La **bandera** ya no desvía a los élites ni al jefe. `380fabc` `15b88b8`
- El **silencio** dura 2 s (eran 5), y sube hasta 4 s (eran 10). Al élite, la mitad. `380fabc`
- La pelota que rebota en un escudo va adonde estabas cuando rebotó: ya no te sigue mientras vuela. `380fabc`
- El élite blindado vuelve a traer blindaje 2 desde el segundo escenario (ayer lo habíamos bajado a 1):
  de lejos con el driver y de cerca con el putter le entra sin el golpe perfecto. `ffb3627`
- Con «Poderes más duros», el élite fantasma trae 2 de vida más (los comunes, 1). `ffb3627`

**Personajes**
- Los personajes para jugar son el **Caballero** y la **Caballera**: los dos guardias dejaron de estar
  (el guardia sigue cuidando la puerta). `0a25a08`

**La intro**
- Las voces de la cinemática ahora son de software (Kokoro), en español y **también en inglés**: el
  narrador, el mago y el caballero tienen voz en los dos idiomas. `8d6ea50`

**Versión de escritorio**
- Hay una **versión para Windows**, la que va a venderse en itch.io y después en Steam: arranca en
  pantalla completa (F11 o Alt+Enter la cambian), y la pantalla de inicio y la pausa tienen «Salir del
  juego». El enlace para invitar a Abe va a la página pública, así lo abre cualquiera. `b47d472`
- Si hay una versión nueva, la pantalla de inicio lo avisa, con el botón para bajarla. Sin internet no
  dice nada y se juega igual. `0a25a08` `ddbb8a5` `21febcd` `294338d`
  El botón lleva a la página del juego en itch.io. `382f3b6`
- Tiene ícono propio: un escudo con un palo de golf y una espada cruzados. `0a25a08`

**Detrás de escena**
- La demo y la versión de Windows se suben solas a la página de itch.io (con butler). `15b88b8` `f7762a4`
- Las imágenes y el texto de la página de itch.io, en español e inglés (`promo/itch/`). `e417880`
  Rehechas con el Caballero, la cámara del juego y los enemigos caminando de verdad. `0a25a08`
- El plan de itch, con una sola página: la demo para jugar en el navegador y la completa para bajar, la
  declaración de IA, cómo llegan las actualizaciones y qué pasa con las copias. `7e9dbc6`
- El plan de venta (`docs/monetizacion.md`): itch no cobra juegos que se juegan en el navegador, así que
  la completa va como descarga (la misma app de escritorio que Steam), y el precio propuesto. `673e25c`

## 7 de octubre

**Versiones**
- Hay una **demo**, en https://leandromagonza.github.io/GolfKnight/demo/: el juego sin los talentos de
  dificultad (se ven, con candado) y sin el panel de balance. Es la que va a ir a itch.io. `2cf7dd7`
- Y una versión **solo para ser Abe**, en https://leandromagonza.github.io/GolfKnight/abe/: para el amigo
  que no tiene el juego. Con el enlace del caballero entra directo; sin él, pide el código de la sala.
  `2cf7dd7`
- En la demo los enemigos traen escudo, esquiva, fantasma o intocable (tres de esos cuatro por partida),
  y el caballero no tiene los tiros fantasma ni de viento, los guantes, ni las mejoras de racha, las de
  matar a dos juntos y las maestrías mixtas. El blindaje, el escudo divino, los que se curan y esas 22
  cartas, en la completa. `d704132` `7b94dc4` `3622776` `7019bef` `228733a`
- El modo tenis ya no tiene botón en la pantalla de entrada: es un prototipo. `d704132`

**Habilidades**
- **El elemento compartido**: el efecto de cada elemento ya no va por el nivel de la carta, sino por la
  suma de los niveles de todo lo que tenés de ese elemento. Dos cartas de fuego de nivel 1 queman como una
  de nivel 2, y las dos; sumar el putter de fuego le sube el fuego a todo lo demás. Llega más alto que
  antes (el fuego hasta 6, el hielo y el silencio hasta 10 s), menos el rayo, que se queda en 4 saltos. La
  carta dice cuánto sube: «Todo tu fuego: 3 → 4 de daño». `7019bef`
- **Maestrías mixtas**, con una carta de cada elemento: *Escarcha ardiente* (los tiros de fuego también
  enfrían y los de hielo también queman), *Tormenta helada* (hielo y rayo) y *Tormenta de fuego* (fuego y
  rayo). La pelota pone los dos; el rayo que salta no prende ni enfría a nadie. `7019bef`
- **La maestría del fuego ahora explota**: el que muere prendido, de lo que sea, revienta y les saca 2 a
  los que tiene al lado; si a alguno lo mata prendido, explota también. Antes los contagiaba, y casi no
  se notaba. `228733a`
- **El viento, al doble**: el driver junta desde el doble de lejos, el hierro empuja el doble, y el
  remolino del wedge chupa desde el doble y los lleva hasta el centro, hasta que se chocan. `228733a`
- **Maestrías mixtas de viento**: *Ventisca* (con hielo), *Torbellino de fuego* y *Huracán* (con rayo).
  El viento va primero: los junta, y después les cae lo otro a todos los que movió. Los tiros del otro
  elemento también soplan. `228733a`

**Dificultad**
- La dificultad ahora es una **llama con tu nivel adentro**: ámbar con pocos puntos, roja y nerviosa con
  muchos, e infernal con todos puestos. En la pantalla de entrada es un botón grande con una rayita por
  punto, que late en dorado si te quedan puntos sin poner. `79f945c`
- En la partida, la llama va **al lado del título de la oleada** (Abe también la ve). `79f945c`
- **Desbloquear un nivel ahora se siente**: al final del cartel, la llama cae con el número de antes y
  revienta con el nuevo, con destello, temblor, chispas y fuego que sube desde abajo. Después aparece el
  botón de Dificultad latiendo para que pongas el punto. `79f945c`
- **«Poderes más duros» toca a todos los poderes**: además de los escudos de hasta 3 y la recarga del
  escurridizo y el bendito, el blindaje sale casi siempre de 2, los que se curan se curan más seguido, los
  intocables pasan más rato invulnerables y los fantasmas traen 1 de vida más. `f6fb30d`
- **El blindaje ya no pasa de 2** (antes llegaba a 3 con ese talento), y **el élite blindado trae 1**:
  con 2 había que meterle un golpe perfecto tras otro, de 1 cada uno. `f6fb30d`
- **Los que se curan, más fáciles sin ese talento**: tardan más en curarse (al de 6 de vida, cada 6 s en
  vez de 4.9). Con el talento, como hasta ahora. `f6fb30d`
- **Talento nuevo: Recarga lenta**. Tus habilidades tardan un 50 % más en recargar, y con el segundo
  punto el doble. La carta dice la recarga que va a tener. `f6fb30d`

**Pantalla**
- El cartel del final tiene un botón **Jugar de nuevo** (o la R): arranca otra partida en el acto, sin
  pasar por la pantalla de inicio. `f6fb30d`
- La rueda del mouse ya no inclina la cámara con un menú abierto (las cartas, la pausa, la dificultad, el
  final o la pantalla de inicio): solo jugando. `f6fb30d`
- **Barra de arriba**: las vidas, la oleada y los botones van en una barra fija, y el campo se dibuja
  debajo, así nada tapa a los que vienen (se ve entero, un poco más chico). `65d29af`
- **Las vidas**: el caballero tiene tres corazones (late el último), y la puerta un ícono con su número,
  que se agrieta a medida que baja y tiembla cuando le pegan. `65d29af`
- **El pasto**: tiene textura, franjas de corte, manchones más secos y más verdes, y pasto alto que se
  mueve con el viento a los costados. Se fueron las manchas de arena: no hacían nada y confundían.
  `65d29af`
- **Árboles y piedras nuevos**: pinos de pisos, árboles redondos (alguno de otoño), abedules blancos,
  arbustos, piedras con musgo y piedritas sueltas. Y flores en el pasto alto. `6c9c20d`
- **Marcas en el piso**: la pelota deja su pique donde cae, el hierro y el wedge levantan un pedazo de
  pasto delante del puesto, y la horda deja pisadas. Todo se va borrando. `6c9c20d`
- En el panel de balance (Visual) se puede probar la puerta con **una puerta por punto**, en el medio
  entre los corazones y la oleada. `6c9c20d`

**Enemigos**
- **Campo en trapecio, para probar** (panel de balance → Campo → Forma, o `?trapecio`): adelante igual
  que siempre, el fondo más ancho. Los enemigos salen sobre un arco y cada uno camina por su fila: los del
  medio derecho, los de las puntas en diagonal, y todos llegan repartidos a lo ancho de los puestos.
  `6c9c20d`
- **El intocable** se lee mejor: mientras no se le puede pegar, su barra es violeta, rayada, y se vacía;
  cuando se abre la ventana, la barra se llena de dorado a rojo, y al llenarse vuelve a cerrarse.
  `6c9c20d`
- El blindaje que se come el golpe entero ahora para la pelota: el driver y el hierro ya no siguen de
  largo detrás del acorazado. Si le sacan aunque sea 1, siguen como siempre. `4d6988e`

**De a dos**
- La ayuda de Abe ya no dice «marca, marca». `2cf7dd7`
- El remolino de Abe es más grande (5 m en vez de 2.5) y los lleva hasta el centro: antes casi no los
  movía. `228733a`

## 6 de octubre

**De a dos**
- El que mira ya no se pone a reconectar si la primera conexión tarda: antes, a los 12 s cortaba y
  volvía a empezar, una y otra vez, y así no llegaba a conectarse nunca. Ahora solo se reconecta si ya
  había estado conectado, a los 30 s sin noticias. `8645c58`
- Para encontrarse usa más servidores (8 en vez de 5): dos de los que tocaban estaban caídos. `8645c58`
- Si se encuentran pero las redes no dejan conectarse directo (pasa con algunos routers y con el celular
  con datos), los dos lo ven escrito, en vez de quedarse esperando sin saber. `8645c58`
- El ataque básico de Abe ahora es la **marca**: los que agarra quedan marcados un segundo, con un anillo
  lila a los pies, y el próximo golpe del caballero que les entra la detona y pega 1 más. Ya no los deja
  clavados. Es para marcar justo antes de que llegue la pelota. `260b226`
- La partida ya no espera a que Abe elija su hechizo, ni al arrancar ni entre oleadas: lo que no elige le
  queda guardado para cuando quiera. `260b226`
- Si Abe entra con la partida ya avanzada, no repasa los hechizos desde el nivel 1: arma sus cuatro de
  una, con los niveles que tendría si hubiera estado desde el principio (al final, dos de nivel 3 y dos
  de nivel 2). `260b226`
- Al reiniciar con R estando Abe, la partida nueva arranca sola y Abe sigue siendo Abe; a él se le avisa
  que empieza otra. `260b226`

**Golf**
- En el cartel del final ya no asoma una barra de scroll horizontal cada vez que entra un número.
  `658a192`

## 5 de octubre

**Idiomas**
- El juego está también en **inglés**. En la pantalla de entrada, abajo a la derecha junto a la versión,
  el botón **ES · EN** lo cambia. La primera vez arranca en el idioma del navegador: si entre tus
  idiomas está el español, en español. `ed47596`
- La intro en inglés tiene sus subtítulos y sus propias voces. `ed47596`
- Estas notas siguen solo en español. `ed47596`

**De a dos**
- Abe tiene ataque básico, la **chispa**: tocar el piso la tira (recarga 1.2 s) y los que agarra quedan
  clavados medio segundo. Elegir un hechizo es para el próximo toque: lo tira y vuelve a la chispa.
  Tocar otra vez el hechizo elegido lo suelta. Con teclado, 1 a 4 eligen y Q W E R tiran ya donde está
  el mouse. `41bda16`
- Abe ve adónde apunta el caballero: una línea punteada y el anillo donde cae. `41bda16`
- La cámara de Abe ya no gira libre: va para adelante y para atrás por la cancha, cambia el ángulo
  (botón derecho, o dos dedos para arriba y abajo) y acerca. `41bda16`
- Si Abe entra durante el tutorial, elige sus hechizos mientras tanto y juega cuando empieza la
  partida. `41bda16`
- Si a Abe se le corta la conexión y vuelve, sigue siendo Abe (antes volvía como uno que solo mira). Y
  el que mira se reconecta solo si pierde la partida un rato. `41bda16`

**Golf**
- El silenciador ya no rebota en el escudo común: lo silencia al tocarlo y la pelota sigue. `41bda16`
- Tampoco lo para el muro de la calavera (al élite el silencio le dura la mitad), ni la burbuja divina.
  `a7ce2c3`
- El silencio gasta la burbuja divina y la esquiva: recién empiezan a recargar cuando se le pasa el
  silencio. Antes silenciar al bendito era lo mismo que pegarle un tiro flojo. `a7ce2c3`
- La burbuja divina se come la pelota que la rompe: el driver ya no sigue de largo detrás del bendito.
  La fantasma y la silenciadora siguen. `a7ce2c3`
- Al élite bendito cada golpe que le entra le devuelve la burbuja, como al que esquiva: hay que
  rompérsela antes de cada golpe. `a7ce2c3` Y ahora a todos los benditos, no solo al élite (la burbuja
  también sigue volviendo sola). `a45fa8a`
- Poder nuevo, **el que se cura** (un corazón verde): cada tanto se cura entero. La barra verde debajo
  de su vida se llena, y al llenarse brilla verde y vuelve a tener toda la vida. Hay que meterle todo el
  daño entre una cura y la siguiente: con golpes medios seguidos alcanza (y sobra un poco), con flojos
  no. Conviene arrancar ya cargando, justo después de la cura. Silenciado no se cura. `a45fa8a` Y trae 2
  de vida de más: al de 2 de vida se lo mataba de un golpe. `edb6e9b`
- Poder nuevo, **el intocable** (un reloj de arena violeta): casi todo el tiempo es invulnerable, y las
  pelotas le rebotan. Su barra violeta se descarga, y cuando se vacía queda vulnerable un segundo y
  medio (la barra se pone dorada). Hay que tirar para que la pelota llegue justo en esa ventana. El
  golpe fantasma le entra siempre, y silenciado es vulnerable. `edb6e9b`
- El fuego ya no muerde en el acto: el primer mordisco llega a los 2 s, y después uno cada 2 s.
  `edb6e9b`
- Se fue la mejora **Swing parejo**: hacía lo del punto dulce y lo de la muñeca rápida a la vez, y
  mejor. Quedan dos, una para cada cosa: la **muñeca rápida** acorta solo el tramo débil (un 20 %), así
  el golpe 2 y el 3 llegan antes; el **punto dulce** alarga el golpe 3. Con las dos la barra queda más
  pareja, pero el 3 sigue siendo el más difícil de clavar. `3e09c0e`
- **Correrse con la pelota** se ve: mientras te movés con A o D cargando, el golfista deja de levantar
  el palo y lo apoya contra la pelota. Del lado de él para empujarla, del otro lado para traerla, y da
  pasitos. Al soltar la tecla vuelve a levantar el palo; la barra sigue cargando igual. `a6ea1be`
- El tutorial tiene un paso nuevo, el cuarto: dos goblins casi en fila que desde tu puesto no se pueden
  agarrar juntos. Hay que correrse con la pelota hasta alinearlos, y si no caen los dos del mismo tiro,
  vuelven a aparecer. `a6ea1be`
- El jefe goblin élite (y cualquier enemigo agrandado) ya no camina a los saltitos: mueve las piernas
  al ritmo de su tamaño. `a169768`

**Dificultad**
- Talento nuevo, **Golpe 4**, para los que ya clavan el 3 siempre. En el medio del rojo aparece el golpe
  4, que pega 1 más que el 3. El 3 queda a los costados, en naranja: entre los dos duran lo que duraba
  el 3, así que no es más fácil, es más fino. A cambio los enemigos traen 1 de vida más, los élites 2 y
  el jefe 8. Las habilidades no tienen golpe 4. `6573aa2`

**Detrás de escena**
- Todo texto que ve el jugador va con su inglés al lado, `L('español', 'english')` (`src/i18n.ts`), y
  `npm test` frena los que quedan solo en español. Estrategia y glosario en `docs/localizacion.md`.
  `ed47596` `72b1b36`

## 4 de octubre

**Golf**
- Al ganar, el golfista se da vuelta hacia la ciudad y festeja con los brazos en alto (el mismo gesto
  del mago en la intro). El cartel de victoria espera unos segundos para que se vea. `03c3613`
- Se va la habilidad Hielo (la zona en el piso): se parecía demasiado al wedge de hielo. El hielo queda
  en los tiros de palo. `3073ca0`
- Los escurridizos se recargan la esquiva cada vez que reciben daño: después de cada golpe hay que
  volver a hacerlos saltar. `3073ca0`
- Los élites ya no se congelan: el hielo solo los frena. `c99b13f`
- El golpe que rompe el hielo pega 1 más (antes pegaba el doble), como la lupa. Ahora también sirve
  contra los fantasmas: congelado, al fantasma le entran 2, y con la lupa encima, 3. `c99b13f`
- Habilidad nueva, **Fuerza**: 5 s (6 y 7) en que todos tus tiros pegan por lo menos 2, y el putter 3.
  Vale también para los tiros de habilidad: el fantasma de nivel 1 pasa a pegar 2, y los de hielo,
  fuego, rayo, viento y silencio, que solos no pegan, pegan 2 y dejan su efecto. Recarga 20 s.
  `16cd59a`
- Habilidades nuevas, los **guantes** (fantasma, de hielo, de fuego y de rayo): 5 s (6 y 7) en que
  todos tus tiros de palo llevan ese elemento y pegan como siempre. El de hielo congela en el nivel 3.
  Uno nuevo reemplaza al que estaba, y la barra de carga dice cuánto le queda. Recarga 20 s. `16cd59a`
- Los escurridizos no ven venir el golpe fantasma: no saltan, y el golpe no les recarga la esquiva.
  `16cd59a`
- Las pelotas con elemento van del color del elemento. `16cd59a`
- Cartel del final nuevo. El título entra de golpe, el puntaje cuenta hacia arriba con tu récord al
  lado («¡Nuevo récord!» si lo pasaste) y aparecen de a uno, cada uno con su nota, los números de la
  partida: oleada, tiempo, bajas, daño, puntería, golpes perfectos, el mejor tiro, la racha sin errar,
  habilidades y cómo quedó la puerta. Al ganar, además, rayos y papelitos. `39cda93`
- Ganar con todos los puntos puestos ahora dice «¡Desbloqueaste el nivel N de dificultad!» en vez de
  «Ganaste un punto de dificultad». `39cda93`

## 3 de octubre

**De a dos (nuevo)**
- Llega Abe, el mago que te invocó: el primer amigo que entra con tu enlace (Invitar, en la intro o en
  la pausa) juega de Abe. Con un click en el piso marca un círculo celeste y al rato cae granizo ahí:
  los que agarra quedan lentos un rato. No hace daño, así que la idea es que él frene y vos pegues.
  Recarga cada 8 s. Los que entran después solo miran; si Abe se va, el siguiente pasa a ser Abe.
  `c74820e`
- Al que mira ya no le queda «La puerta cayó» cuando reiniciás: el cartel se va con la partida nueva.
  `a6d2d9a`
- Abe tiene cuatro hechizos, en botones grandes que se tocan bien desde el celular (o con 1 a 4): elegís
  uno y tocás el piso. **Granizo** los frena; **Fila** los pone en fila hacia el caballero, para que el
  driver los atraviese a todos; **Maldición** los agranda y les suma 1 de daño por golpe; **Silencio**
  les apaga los poderes (escudo, blindaje, burbuja, auras). Duran poco, llegan a toda la cancha y
  agarran poco: hay que coordinar para aprovecharlos. Cada uno recarga por su lado, y ninguno hace
  daño. En el celular parado, la cámara arranca viendo todo el ancho de la cancha. `4860abe`
- Abe ahora va ganando sus hechizos: arranca eligiendo uno entre tres, y gana otro al terminar cada
  oleada, hasta tener 4. Después le salen de nivel más alto (cualquiera, no solo los que tiene) y elige
  cuál reemplaza o se queda con los suyos; puede tener el mismo dos veces, de distinto nivel, cada uno
  con su recarga. Son siete: **Granizo** (los frena), **Remolino** (los junta), **Corriente** (del
  caballero hasta donde toca Abe, los pone en fila), **Empujón** (los manda para atrás), **Maldición**,
  **Silencio** y **Trampa** (queda en el piso, y el primero que la pisa deja atrapados a los de alrededor).
  La Fila de antes es ahora la Corriente. `e45eec3`
- La oleada que viene espera a que elijan los dos: vos tu carta y Abe su hechizo. Vos ves que lo está
  esperando, y a él le salen las cartas solas. `e45eec3`
- Podés echar a Abe y hacer la partida privada (no entra nadie más), con los botones debajo del enlace,
  en la intro y en la pausa. Al echado le avisa; si había otro mirando, pasa a ser Abe. `e45eec3`

**Dificultad (nuevo)**
- La partida arranca más simple: cada oleada trae un solo poder (el de su escenario), no hay olas
  especiales, apoyos ni kamikazes, los enemigos van un poco más lentos, menos traen poder y los
  élites tienen menos vida. El jefe viene con enemigos comunes. `af3e875`
- Cada partida que ganás con todos tus puntos puestos te da un punto de dificultad. Se ponen en un menú
  entre partidas (en la entrada y en el cartel del final) y se pueden mover cuando quieras: poderes
  acumulados, olas especiales, apoyos, poderes más duros, más rápidos, más con poder, élites más duros,
  escolta del jefe y sin respiro. Son 13 puntos. `af3e875`
- Las olas especiales dejan su marca en el resto de la partida: después de la estampida vienen más
  chicos y algunos kamikazes (sin estampida no hay), después de los gigantes vienen algunos gigantes, y
  después de «todos con poder», unos pocos con los poderes que no salieron. `af3e875`
- Las lomas pasan a ser un talento, **Terreno irregular**: sin él se juega en el campo liso, y con él en
  uno de los tres campos con lomas. Poderes más duros pasa a ser un solo punto (escudos y blindajes
  hasta 3, y escurridizos y benditos con la recarga rápida). Siguen siendo 13 puntos. `00dfdeb`
- Prender o apagar el terreno irregular en la entrada cambia el campo en el acto, sin recargar la
  página. `98948f4`
- Más rápidos tiene un nivel más, y arranca más lento: sin puntos los enemigos van a 0.76 de su
  velocidad, y con los tres puntos, a 1.12 (lo que antes era con dos). Más con poder también suma
  uno: con el segundo, la mitad de los enemigos trae poder. Ahora son 15 puntos. `f12f491`

**Golf**
- Subir una habilidad de nivel ya no la hace recargar más lento: es mejora pura. Solo el palazo sigue
  recargando más lento al subir. `531e74d`
- El carcaj te da una pelota cada 10 s. `531e74d`
- El fuego pega menos y más lento: 2, 3 o 4 según el nivel, uno cada 2 s (eran 4, 5 y 6, uno cada
  1.5 s). Un tiro de fuego solo ya no mata al élite antes de que llegue. `635fdb1`
- El frío frena mucho a los rápidos y poco a los lentos: los lleva al 40 % de su velocidad pero no
  por debajo de 1 m/s, así que el caballero y el gólem chico ya no quedan casi quietos. `635fdb1`
- El perfecto de regalo pasa a contar como el albañil y el herrero: cada 5 tiros que matan a más de
  uno (eran 8 bajas cualquiera). `635fdb1`
- El albañil cura también al golfista: la puerta +1 y vos +1. `635fdb1`
- El rayo ya no lo frena el blindaje: le saca su 1 también al acorazado. `95d1207`
- El tiro fantasma le entra entero a todos desde el nivel 1: pasa escudos, blindaje, al enemigo fantasma
  (el putter fantasma le saca 2, como a cualquiera) y también a los inmunes del chamán. `95d1207`
- Los tiros de habilidad del wedge se saltean la pifia: tienen dos niveles, que salen con el golpe 2 y
  el 3 (pegan 1 y 2). El wedge fantasma de nivel 1 ya no pega 0, y el wedge de hielo congela en su
  nivel 2. `07e8d64`

**Detrás de escena**
- Cada partida se manda sola al terminar, para ver dónde se pierde y balancear con datos. Sin datos
  personales. `af3e875` `531e74d`

## 2 de octubre

**Espectador (nuevo)**
- Otro puede mirar tu partida en vivo desde su navegador: en la intro, «Invitar a alguien a mirar tu
  partida» te da un enlace para pasarle. Ve todo lo mismo (enemigos, tiros, efectos, sonidos, la vida y
  la oleada) con su propia cámara: arrastrando gira, con la rueda acerca. Puede entrar con la partida
  empezada, y si reiniciás se reengancha solo. Vos ves cuántos te están mirando. Es el primer paso para
  el segundo jugador. `32a62b7`
- En pausa o mientras elegís carta, el que mira ve todo quieto como vos: ya no quedan los enemigos
  caminando en el lugar ni el último de la oleada repitiendo un pedazo de su caída. Si el enlace no
  encuentra la partida, se lo dice. `f4d43c2`
- Se puede invitar a mirar con la partida empezada: en la pausa está el botón, con el enlace para
  copiar y cuántos están mirando. `ea0d4ca`

**Pantalla**
- La pausa queda arriba de la elección de carta (antes las cartas le quedaban encima), y en pausa no se
  elige carta sin querer con 1, 2 o 3. `ea0d4ca`

**Sonido**
- N (o el botón de arriba a la derecha) apaga todo el sonido, música y efectos, y queda así hasta que lo
  vuelvas a prender. Anda también mirando. La M sigue apagando solo la música. `f4d43c2`

**Golf**
- La carta para subir de nivel una habilidad dice qué mejora, de cuánto a cuánto (por ejemplo, el
  wedge de rayo: saltos por lado 2 → 3 y área 3.5 → 4.2 m). La lluvia de pelotas, que es igual en
  todos los niveles, ya no sale para subir. `5dcf88a`
- Ojo con los escudos: la pelota que rebota en uno vuelve hacia vos, roja y en arco, y el piso marca
  dónde va a caer. La marca te sigue mientras vuela y se queda quieta justo antes de caer: si te agarra
  adentro te saca 1 de vida, así que en ese momento corrétele. `6b382e5` `efee247`
- El albañil arregla la puerta cada 3 tiros que matan a más de uno (eran 5), y el herrero carga la
  próxima pelota cada 2 (eran 5). `79a203e`

**Detrás de escena**
- Idea escrita para un multijugador de a dos: el segundo jugador mira desde arriba y ayuda con empujones,
  zonas lentas y muros, en `docs/multijugador.md`. Todavía no está en el juego. `12642ae`

## 1 de octubre

**Golf**
- Las cartas se explican más corto: dicen qué hace cada habilidad y cada mejora, sin cada detalle.
  Las que suben de nivel dicen lo de ese nivel: la Potencia de nivel 2 dice que pega 2 más. Carcaj y
  Segundo aire dicen su recarga abajo, como las habilidades. `98c30f8` `1190c76` `3ba64e7`
- Los gigantes se notan: bien más grandes (sin llegar al tamaño del élite), con 1 de vida más que antes
  y un poco más lentos. `892b973`
- El palo pega y la habilidad pone el efecto: los tiros de fuego, hielo, rayo, viento y silencio ya no
  pegan, solo dejan el efecto, y el efecto es más grande (más fuego, más frío y congela en el nivel 3,
  más saltos de rayo y le cae también al que toca, más silencio). El golpe fantasma sigue pegando. `871a8a5`
- El hoyo vuelve a tragarse a cualquiera, aunque tenga la burbuja divina, pero tarda 20 s en recargar. `871a8a5`
- La segunda oleada de cada escenario trae una sorpresa, en orden al azar: **la estampida** (muchos y
  chicos), **los gigantes** (menos, más grandes y con más vida) o **todos con poder** (cada uno trae
  uno, hasta poderes que no salieron en la partida, pero con 1 de vida menos). `025d07e`
- La esquiva ahora salta ni bien soltás el tiro o tirás una habilidad. Hacela saltar con algo y pegale
  con lo que importa antes de que se recupere; el área del wedge la agarra igual. `025d07e`
- El golpe fantasma pasa también la burbuja divina. `025d07e`
- Se fue la granada: el silencio en área ahora es el wedge silenciador. `24f7283`
- Los efectos de las habilidades salen solo si el golpe toca: si el escudo para la pelota, el divino se
  come el golpe o el aura de invencible lo protege, no hay fuego, hielo, rayo ni silencio. El wedge,
  que cae a plomo, pasa los escudos. `24f7283`
- Los kamikazes salen en todas las oleadas: cualquier goblin sin otro poder puede ser uno. En la
  estampida siguen siendo muchos más. `24f7283`
- Habilidad nueva para los cuatro palos, el **golpe fantasma**: pasa escudos y blindaje (el del driver
  también atraviesa lomas) y desde el nivel 2 le pega entero al enemigo fantasma. `c6073d5`
- Habilidad nueva para los cuatro palos, el **golpe silenciador**: pega y deja silenciado al que
  alcanza; el golpe mismo choca con sus defensas, los siguientes no. `c6073d5`
- La granada ahora es solo silencio: ya no suma daño. `c6073d5`
- Las bajas suenan siguiendo la nota del golpe: si cargaste hasta el 2, la primera baja suena una nota
  más arriba, la segunda otra más. Todo una octava más grave que antes. `c6073d5`
- La granada silencia todos los poderes: ahora también al fantasma, al divino y a la bomba (el
  kamikaze silenciado muere sin explotar). Al élite le dura la mitad. `352e808`
- La lupa sirve contra fantasmas: al agrandado le entran hasta 2 por golpe. La lupa y la granada dicen
  ahora que los afectados reciben 1 de daño extra por golpe. `352e808`
- Rayo nuevo: cada enemigo que alcanza la pelota larga su propio rayo, que sale para los dos lados y
  salta de enemigo en enemigo sin repetir. Y ahora se ve. `352e808`
- El Gólem de roca ya no se congela: el hielo solo lo frena. `352e808`
- Cada baja suena, y cada baja más del mismo tiro suena más aguda: un triplete arma un acorde. Las que
  caen juntas en un área salen como un rasgueo rápido. `18cf55d`
- Mejora nueva, El herrero: cada tiro que mata a dos suma 1, a tres suma 2, y así; cada 5, tu próxima
  pelota pega 1 más, aunque canceles, cambies de palo o pifies. `18cf55d`
- Las cartas de habilidad dicen su recarga: la de base si es nueva, y de cuánto a cuánto pasa si la
  subís de nivel. `18cf55d`
- Se fue la habilidad Boomerang. `18cf55d`
- El albañil cuenta en el acto: el doblete suma al caer el segundo y el tercero vuelve a sumar, y
  también cuentan las bajas del área. El tiro que mata a varios se canta (¡Doblete!, ¡Triplete!)
  junto con el avance del albañil. `1adc8fb`

**Pantalla**
- Una libreta junto a la versión, en la pantalla de entrada, abre estas patch notes. Un puntito rojo
  avisa cuando hay notas nuevas que todavía no leíste. `dc0b938`

**Modo tenis (prototipo)**
- Tenis rehecho desde cero: el golpe y el saque se deciden por timing, con un círculo sobre la
  pelota que aparece cuando se acerca (y se apaga si no llegás). Mantener apretado es golpe 1; soltar
  justo antes del impacto ya no lo es. `6a3271e` `90c06aa` `e58ed17`
- La pelota que vuelve tarda según dónde rebotó, nunca menos de lo que tardás en llegar, y cae en
  espejo: rebota en los costados y la de la esquina vuelve por donde vino. Se la ve rebotar. `6a3271e` `90c06aa` `e58ed17`
- La pelota que mata a un enemigo lo atraviesa, y la que no devolviste vuelve sola al bolsillo. `90c06aa`
- Se fueron el imán, la puntería hacia vos, la devolución automática y la barra del golf. El globo
  queda solo como habilidad. `6a3271e` `e58ed17`
- Saque: se hace parado, se puede sacar con una sola pelota en el bolsillo, y si erraste sin pelotas
  volvés a sacar. `30ad92d` `fff4b80` `e58ed17`
- Las piernas corren mientras te preparás para el golpe. `90c06aa`
- Primeras pruebas de la noche, reemplazadas por el tenis rehecho: la vuelta apuntaba hacia vos o al
  centro, la pelota saltaba a tus pies después de dos rebotes de costado, los enemigos devolvían si
  sobrevivían y te atravesaban, había golpe guardado al soltar temprano, imán hacia la pelota, y la
  pelota en verde, amarillo o rojo según le llegaras. `5765a5e` `2cb1021`

**Detrás de escena**
- Estas patch notes, y el push a `main` se frena si falta anotar algún commit. `8b526f6`
- Una prueba del freno de las patch notes (un commit vacío). `8e5f2ef`
- Análisis de qué le sirve a cada enemigo y propuesta para que las cartas miren lo que viene (todavía
  no cambia nada en el juego). `2bd547e`

## 30 de septiembre

**Golf**
- El élite mata de una: si entra por la puerta se pierde la partida, y si te atropella te mata. `547e715`
- Fuego: quema cada 1.5 s, el blindaje no le resta y prende aunque el escudo pare la pelota. `a7d0847`
- Habilidades nuevas: eco (repite el próximo tiro) y potencia (más daño en el próximo). Se pierden
  si cancelás el tiro o cambiás de palo. `a7d0847`
- El empujón de los pelotazos depende de la carga (los golpes 2 y 3 hacen tropezar) y es menor
  contra los grandes. El palazo recarga en 12 s. `9f0c13c`
- El hierro le pega en la cabeza al que lleva escudo. `32ca218`
- Menos texto: sin explicaciones de poderes ni avisos de botones que no tenés, y la ayuda de los
  palos más corta. `32ca218`
- Corriendo, el cuerpo va siempre detrás de la línea (también en el tenis). `42fcc83`

**Modo tenis (prototipo nuevo)**
- Modo tenis, con `?tenis` o con el botón de la intro: el tiro plano rebota en el primer enemigo como
  en un rompeladrillos, vuelve atravesando y rebotando en el alambrado, y devolverlo suma racha; el
  globo revienta y se pierde. Bolsillo de pelotas, pelotas para levantar del fondo y un alcanzapelotas
  de emergencia. El tenista camina libre, con raqueta. `07dbfaf`
- Pared mágica al fondo, enemigos que rebotan o se atraviesan, la pelota que pasa de largo vuelve a
  la línea, devolución al cargar (la raqueta atrapa la pelota al soltar), topes para que no se cuelgue
  y números en vivo. El tenista corre de costado y va siempre sobre la línea, corriendo y pegando. `42fcc83` `48941c8`

## 29 de septiembre

**Escenarios y élites**
- La partida se arma en escenarios: tres de tres oleadas, cada uno con un poder sorteado (escudo,
  blindaje, fantasma, divino o esquiva) más dos de apoyo, y al final la oleada del Gólem de roca. Los
  poderes se acumulan de un escenario al siguiente, y el recorrido se ve en íconos arriba. `8edb958`
- Cada escenario lo cierra un élite (antes «mini jefe»): un cuerpo fuerte agrandado según su modelo,
  con el poder en su versión más dura y +2, +3 o +4 de vida según el escenario. La calavera lo marca.
  Es el único del cuerpo fuerte que trae poder, y el cuerpo fuerte aparece desde la primera oleada. `a445272` `61afaff` `8e52424` `7163f47` `fda4077`
- Al terminar cada escenario la puerta recupera 7 y el golfista toda su vida. `7c2184a`
- Los enemigos salen para llegar en su turno (el grande no llega solo), y ningún pesado sale antes
  que el primer liviano de la oleada. `43bc8f2` `77b8fe3`
- El daño de los enemigos crece con su vida (1, 2 o 3), a la puerta y al golfista; el élite pega 3. `3cc8a11`
- El que cura o hace inmune sigue de largo a la puerta si llega sin nadie en su círculo, y atropella
  como cualquiera. `43bc8f2` `500c3c8`
- El etéreo no va en los de 1 de vida. `a445272`
- El alma en pena te congela y se va. `8e52424`
- El hoyo: el enemigo cae adentro sin número de daño, y no se traga a los élites. `1684b26`
- El botiquín cura al empezar la oleada, así el nivel recién tomado ya cura. `07b5d6b`
- Las pelotas de la lluvia no frenan a los guardias, y nadie tira después de perder. `7163f47`

**Tutorial**
- Tutorial en ocho pasos, un palo por vez: buscar la pelota, dos en fila, blindados y dos del mismo
  tiro. Los enemigos quedan quietos y solo mueren con el tiro que se enseña (si no, vuelven a su
  lugar). Sin moverse ni apuntar a otro lado, y con notas cortas. `a747e10` `dbab6a1` `a3589bb`

**Tiro**
- Arco de carga en verde, amarillo y rojo, con el daño de cada nivel (el 3 encima del rojo). El
  wedge va en gris para la pifia, verde y amarillo. `a747e10` `50dc7ae` `a3589bb` `7c2184a`
- El arco avanza a velocidad pareja: cada tramo ocupa lo que dura, y las mejoras cambian su tamaño
  en vez de la velocidad. `0762071`
- El daño que muestra el arco es el del primer enemigo sobre la línea (driver y putter) o el de la
  distancia del mouse. `e7f0fd6`
- Hierro y wedge apuntan sobre el plano, sin saltos detrás de las lomas, y los globos se empinan para
  pasarlas. `dbab6a1` `a3589bb`

**Pantalla**
- La versión (día y hora de la publicación) en la esquina de la pantalla de entrada. `c5cf56c`
- Vida de más de 10 en capas de color, con sus íconos. El jefe tiene una barra roja de 10 y muestra
  cuántas barras enteras le quedan detrás. `4fdefc4` `a66765e`
- Íconos de poderes con color propio. `8e52424`
- Cámara más atrás: los puestos quedan a 70 px de las barras de abajo, así las habilidades no los
  tapan. Se encuadra desde las tarjetas de los palos, así que elegir el wedge ya no la mueve. `c22b37d` `81145e4`
- Terminada la partida, el golfista deja de seguir al mouse. `d21802f`
- Saltar de oleada desde el panel de balance (B) te revive. `43bc8f2`

## 28 de septiembre

**Enemigos y oleadas**
- Los enemigos se arman con cuerpo y poder: cuerpos de 1 a 10 de vida (goblin, goblina, orco,
  esqueleto, jefe goblin, chamán, caballero, gólem chico) y poderes que puede llevar cualquiera
  (escudo, blindaje, bendito, aura, etéreo, explotar, cavar, bandera, hechicero, cura, invencible,
  esquiva). `22b5d0b` `c7246bd` `37f965b`
- Enemigos nuevos: fantasma, curandero, abanderada y geomante. El geomante levanta una loma que tapa
  al driver: si lo matás antes de 8 s, la loma baja. `22b5d0b` `cb11b86`
- Hechicero: tira al puesto del golfista con una marca en el piso; se esquiva moviéndose. `c7246bd`
- Esquiva: si lo apuntás cuando la carga llega a 2, salta al costado (recarga 5 s). `4fe1d36`
- El escudo es blindaje de frente. Escudos numerados con modelos del pack, y la calavera: el muro que
  no deja pasar nada. La granada saca el blindaje. `22b5d0b` `c7246bd` `b3d3cd2`
- Antes de la vida, un ícono por poder (escudo y blindaje con su número, muro, auras, bandera,
  etéreo, divino); lo silenciado se tacha con un prohibido rojo. Cada ícono con forma propia. `cb11b86` `d48afa3`
- Oleadas rebalanceadas: la primera trae goblin, goblina, orco y esqueleto, y cada una de las
  siguientes presenta un poder; un tercio de los enemigos lleva un poder sorteado entre los ya
  vistos. `c7246bd` `37f965b` `4fe1d36` `3605240`
- Alma en pena: los primeros 2 s del agarre no te podés soltar; después te zafás sacudiéndote con A
  y D, y al soltarte se esfuma. `4fe1d36` `3605240`
- El fantasma, más traslúcido. `d48afa3`
- La luz sigue a la oleada: mañana en la primera, atardecer en la última. `cb11b86`
- La loma del geomante deforma el campo y las rayas de distancia la siguen. `cb11b86`

**Tiro**
- La carga se define por tiempos (débil, medio, fuerte, rebote), iguales para los cuatro palos. `22b5d0b`
- La barra pasa a ser un arco junto al golfista: verde en los bordes, amarillo y rojo en el centro,
  con la aguja que va y vuelve. Sale adelante del golfista. `b3d3cd2` `1ba0d6c` `14aa8ac`
- Wedge con pifia: pifia, 1 o 2 (el golpe 1 no sale), y área un escalón más chica. `22b5d0b`
- El vendaval va por palo: el driver junta sobre la línea, el hierro los manda atrás y el wedge los
  amontona. `b3d3cd2`
- Nuevo balance de los palos: driver con distancia fija de 50 m y mejor golpe 4. Pisa lo guardado en
  el panel. `14aa8ac`
- Sin carga en carrera. `d48afa3`

**Cartas y mejoras**
- Mejoras nuevas: En racha (+1 de daño, hasta 2, tras 4 tiros sin errar), Carga en carrera,
  Botiquín y Swing parejo. Ritmo cuenta tiros sin errar y el albañil cuenta bajas múltiples. `22b5d0b`
- El palazo sale en las cartas y va en Q W E R. `4fe1d36`
- Sin cartas de curarse: si la partida viene mal, sale sí o sí el Botiquín. `cb11b86`
- El clon tira hacia el mouse: las dos pelotas se cruzan donde apuntás. `c7246bd`
- La música silenciada sigue silenciada al reiniciar. `22b5d0b`

**Intro**
- La cinemática reemplaza a las placas de la intro: se abre al entrar mientras el juego carga
  debajo, una vez por sesión, con botón Saltar (o Esc). La placa de controles quedó al día. `9d5c108` `b8bafa5`
- El baúl: el caballero lo abre, saca los palos y lo atropellan mientras mira el driver. `a8655c6`
- La feria llena de caballeros y caballeras de otros colores. `6ad735f`
- Música para cada mundo (feria, magia y horda), sin temblor antes del golpe y con los pies sobre el
  piso. `899fd3b`
- Voces: narradora, mago y caballero, actuadas. `672e650` `1254618` `dd90b00`

## 26 de septiembre

- Capa visual: sombras, corrección de color, hora del día, contorno y brillo. Cada efecto se prende
  y apaga en la pestaña Visual del panel (B). `838c269`
- Cinemática de la intro, primera prueba: feria medieval, atropello y círculo de runas, con el mago. `4c14793`
- La muñeca rápida y el ritmo apuran solo el tramo hasta el golpe 3: la ventana del perfecto ya no
  se achica. Cancelar el tiro o reiniciar la carga ya no gasta el perfecto de regalo. `3acef96`
- Se va la pelota de reserva (S): la reemplaza el carcaj. `3acef96`
- Las mejoras tomadas se ven en una columna a la izquierda, con su cuenta regresiva o lo que llevan. `3acef96`
- El gólem ya no se da vuelta para tirar la piedra, y la levanta con los dos brazos. `3acef96`
- Panel de balance (B) en pestañas; las habilidades y mejoras se dan y se sacan con su nivel. `3acef96`

## 25 de septiembre

- Cartas entre oleadas: al terminar cada una salen tres (habilidad nueva o subir de nivel, mejora o
  curarse). La curación ya no es automática. `509cd96`
- Cuatro lugares de habilidad (Q, W, E y R), hasta nivel 3: cada nivel pega o agarra más y recarga
  un 30 % más lento. `509cd96`
- 24 habilidades: las 12 de palo y elemento (hielo, fuego o rayo; un tiro al instante, con pelota
  gratis), más granada, hielo, vendaval, carrito, hoyo, bandera, pólvora, boomerang, lluvia de
  pelotas, caddie dorado, lupa y clon. El rayo nunca vuelve a un enemigo que ya tocó. `509cd96`
- Mejoras: muñeca rápida, punto dulce, ritmo, racha del albañil, perfecto de regalo, carcaj, pelota
  extra, segundo aire, y las maestrías de hielo (congela; romper el hielo pega el doble), fuego
  (contagia) y rayo. `509cd96`
- Enemigos nuevos: goblin acorazado (resta 1 a cada golpe) y esqueleto bendito (escudo divino que se
  recarga a los 5 s), con dos oleadas nuevas. `509cd96`
- La explosión del kamikaze pega parejo en toda el área. `a2ef08b`

## 24 de septiembre

- Las habilidades van aparte de los palos: granada (Q), hielo (W) y vendaval (E), cada una con su
  recarga y su pelota. Salen al instante hacia el mouse, aun cargando un tiro, sin gastar la pelota
  del puesto. Los palos pegan su golpe y nada más. `cb0e0fd`
- Hielo: deja una zona fría donde cae; el que está adentro camina lento. `cb0e0fd`
- Granada: no hace daño; los tira a los costados de la línea del tiro y los silencia (sin escudo,
  aura ni inmunidad, y +1 de daño por pelotazo). Llega en la oleada 2. `cb0e0fd` `bfb8f2b`
- Vendaval: rasante, solo junta sobre la línea. Llega en la oleada 4. `bfb8f2b`
- Correrse cargando (experimental): A y D mueven al golfista con la pelota hasta 1.2 m por lado. En
  el modo «efecto», con driver o putter, A y D curvan el tiro y la línea muestra la curva. `bfb8f2b` `defa1b4`
- La cámara se aleja sola para que la línea de puestos quede justo arriba del HUD, que va pegado
  abajo. `defa1b4`
- El daño en área del hierro y el wedge pega parejo, sin caer hacia el borde. `defa1b4`
- Al caer la puerta, el golfista queda tirado en el piso, como al morir. `defa1b4`
- La R reinicia solo desde la pausa o la pantalla final: en pleno juego, un toque de más te borraba
  la partida. `e6d1c5e`

## 23 de septiembre

- Driver, hierro y putter hacen su daño y además dejan el poder (escarcha o vendaval) en un área
  donde llegan; el wedge aplica el poder en lugar del daño. Nadie cobra ni se enfría dos veces por la
  misma pelota. `555bc3d`
- Volver a apretar Espacio reinicia la carga y la destraba. Se fue el cartel de «soltá cuando
  quieras», que tapaba el campo. `555bc3d`
- Vuelven los nueve puestos; los dos de cada punta no reciben pelotas de los guardias (bandera
  apagada) y se usan con la pelota de reserva. `79f8dc2`
- La pelota de reserva (S) pedida mientras corrés a otro puesto se apoya al llegar. `403bae5`
- El vendaval cae en un óvalo, con la línea del tiro en el medio. `403bae5`
- La puntería encuentra el primer cruce con el terreno: se puede apuntar a toda la ladera que se ve. `f2d87a2`
- Un golpe de cero ya no muestra numerito. `5508d97`
- Panel de balance: copiar configuración incluye la distancia fija, el rodado y el modo del hierro. `5508d97`

## 22 de septiembre

- Teclas directas: palos en 1 a 4 (la rueda del mouse sigue recorriéndolos) y poderes en Q, W y E,
  con recarga. La punta de la línea lleva el símbolo del poder, y la barra de abajo va en una sola
  fila. `e2a3b79`
- El relieve está siempre: cuatro campos diseñados que se sortean por partida (`?campo=1..4` fuerza
  uno, `?plano` lo deja liso). Las marcas de distancia se cuentan desde la línea de los puestos, con
  20 y 40 m resaltadas. `e2a3b79`
- Hierro 7 con arco propio, bajo. Tiene dos modos: revienta (por defecto: explota abajo del primero
  que toca) y atraviesa (pasa hasta tres y abre un área chica donde cae). `e2a3b79` `ba29d34`
- Los cuatro palos desde el arranque, cada uno con su ícono. Lo que se gana jugando son los poderes:
  escarcha en la oleada 2 y vendaval en la 3. `c55fd79`
- El golfista se acomoda alrededor de la pelota y nunca queda delante de ella. La cámara sigue al
  puesto, no al golfista, así que no se mueve al apuntar. `5dfae29` `436ef8d` `1dc362f`
- Escudo: frena lo que le llega de frente, rasante o en arco (solo pasa lo que cae a plomo), también
  el daño en área que estalla adelante suyo, y tapa a los que tiene detrás. El hielo y el viento lo
  atraviesan. `5dfae29` `ba29d34` `72522f4`
- Un enemigo ya no cobra dos veces por el mismo tiro, y hay un solo número de daño por golpe. `e2a3b79` `ba29d34`
- Distancia fija: el mouse decide solo la dirección (driver a 55 m, putter a 20 m). Sin distancia
  mínima: se le puede pegar al que tenés encima. `79c0e22` `d852cb0` `5dfae29`
- El driver sale siempre con el mismo arco: si hay una loma en el medio, choca contra la loma. `72522f4`
- El putter va más rápido cuanto mejor le pegás. La carga dura lo mismo para los cuatro palos: la
  barra mide timing. `436ef8d` `79c0e22` `baa194e` `5dfae29`
- El área pega menos que el impacto. `5dfae29`
- Pelota de reserva con S: la apoya en tu puesto (dos cargas, una cada 10 s). `90e984c`
- Quedan siete puestos, sin los de las puntas. `79c0e22`
- Cámara ajustable (la rueda inclina, las flechas suben y bajan), sin meterse dentro de las torres. `5dfae29` `90e984c`
- La línea del putter va pegada al piso, y el vendaval barre detrás de la pelota. `90e984c`
- Moverse durante un tiro guarda un toque, no una cola. `5dfae29`
- Los mensajes del alma en pena dicen la salida correcta: el palazo. `c55fd79`
- Panel de balance (B): daño de cada palo por banda, alcances, carga, recargas, enemigos y campo;
  botones de prueba (oleada, vida y puerta infinitas, saltar de oleada) y copiar configuración. Lo
  ajustado se guarda en el navegador. `e2a3b79` `5dfae29` `436ef8d` `baa194e` `d852cb0`

## 21 de septiembre

- Solo daño base: se van la racha, el bonus de frío, el estado expuesto y la pérdida de daño al picar. `813aa42`
- Palazo sin daño (solo empuja), sin pelota no se puede cargar, el golfista se desliza entre puestos,
  y el enemigo que pasa la línea de puestos queda fuera de juego y corre a la puerta. `df3f5af`
- Tiro en dos tiempos: S clava el daño mientras cargás y el tiro sale al soltar. Hierro por escalones
  de frío, wedge que barre en rectángulo y arco de puntería de 180°. `7c273a7`
- El wedge sale de la línea del tiro, el empujón mueve a todos igual, y cambiar de palo cargando
  reinicia la carga. `87ac28a`
- Cursor chico, tipo mira, sobre el campo. `57feeac`
- Campo con relieve, de prueba (`?relieve`). `cbc9b75`
- Altura del tiro con W y S, tótems del putter que detona el driver, el wedge acerca y el hielo ya no
  congela. Se fue el teletransporte del putter. `8e4a360`
- El arco del tiro se ve siempre, no solo mientras cargás. `5d322bb`
- Rediseño: el palo es la entrega y el encantamiento es el efecto. El mouse da la distancia para los
  cuatro palos y la barra solo la calidad del golpe. El driver cobra de lejos, el putter de cerca, y
  hierro y wedge parejo. Los encantamientos (golpe, escarcha, vendaval) valen para cualquier palo. `63ca382`

## 20 de septiembre

- Primera versión publicada: el golfista defiende Valdehoyo de seis oleadas con el driver (el único
  que daña, atraviesa), el hierro (globo de hielo), el wedge (empuja) y el putter (portal); cada
  oleada presenta un enemigo y un palo. `cebdf20`
- El escudo desaparece mientras el guerrero tiene hielo encima. `e14bd87`
- El golfista se mueve entre nueve puestos y solo pega donde hay pelota (las tiran los guardias).
  Vida y daño en números chicos, y carga por niveles. `9425e62`
- Nadie persigue al golfista: todos van a la puerta, y el que te pasa por encima te atropella. Carga
  con curva, y la punta de la línea con el ícono del palo. `bf6f6e8`
- Tres niveles de daño y crítico de 8; la barra rebota por todo el rango. `07de153`
