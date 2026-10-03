# Golf Knight · Patch notes

Qué cambió en el juego, de lo más nuevo a lo más viejo. Se juega en
https://leandromagonza.github.io/GolfKnight/ (la versión publicada se ve en la esquina de la pantalla
de entrada).

Al final de cada línea van los commits que la cubren. `main` no se puede subir si algún commit no
figura acá: lo frena el hook `.githooks/pre-push`, y `npm run patchnotes` muestra lo que falta.

## 3 de octubre

**De a dos (nuevo)**
- Llega Abe, el mago que te invocó: el primer amigo que entra con tu enlace (Invitar, en la intro o en
  la pausa) juega de Abe. Con un click en el piso marca un círculo celeste y al rato cae granizo ahí:
  los que agarra quedan lentos un rato. No hace daño, así que la idea es que él frene y vos pegues.
  Recarga cada 8 s. Los que entran después solo miran; si Abe se va, el siguiente pasa a ser Abe.
  `c74820e`
- Al que mira ya no le queda «La puerta cayó» cuando reiniciás: el cartel se va con la partida nueva.
  `a6d2d9a`

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
