# Épica: las tres canciones de escenario (15/10)

Un juego alternativo de canciones de escenario, en clave de banda sonora épica: una orquesta chica de
fantasía y un tema propio del juego, «el del caballero», que pasa por las tres. Están en
`src/audio/music/songs/epica.ts`. Se eligen en musica.html (o en el panel B, pestaña Sonido):
`epica.llamado` para el escenario 1, `epica.marcha` para el 2 y `epica.asedio` para el 3.

Es épico pero con un guiño (es una comedia): el acorde de Do en re mayor que suena a aventura de matiné,
un pizzicato en puntas de pie con cromatismos en la marcha (los goblins acercándose), y en medio del asedio
la celesta tocando el tema del caballero como una caja de música.

## La orquesta (la misma en las tres)

Todo sintetizado, sin ondas cuadradas ni arpegios de 8 bits. Cada instrumento tiene su lugar en el estéreo
(cornos a la izquierda, cuerdas y trombones a la derecha) y manda un poco a una sala propia, además de la
reverb y el limitador del juego. A la salida hay un hueco suave de 3 dB alrededor de 2,5 kHz, donde viven
los golpes y las voces.

- **Cuerdas cortas** (el ostinato): dos sierras desafinadas con un filtro que se abre con el golpe de arco
  y se cierra enseguida. Con tensión, el filtro general se abre más (más brillo, más urgencia).
- **Pizzicato**: lo mismo pellizcado, más oscuro y con cola.
- **Colchón de cuerdas**: tres sierras por nota, entrada lenta, pasabajos en 1,1 kHz.
- **Violines con melodía**: más rápidos de entrada, con un vibrato chico y pasabajos en 2 kHz.
- **Cornos**: dos sierras con un filtro que florece al entrar y se asienta (el «buaa» del metal). Llevan
  el tema.
- **Trombones y tuba**: lo mismo más grave y con más mordida; quinta y octava para los golpes.
- **Chelos y contrabajos**: el bajo.
- **Coro**: tres sierras por nota pasadas por dos formantes de vocal «o/a» (650 y 1080 Hz), con un
  vibrato lento.
- **Celesta**: FM suave, poquito.
- **Timbales**: un parche afinado en la fundamental del acorde, con dos armónicos y el golpe de la baqueta
  (solo, un parche suena a bombo electrónico). Redobles en fusas que crecen hacia las secciones.
- **Bombo y taikos**: parches graves con un golpe de cuero.
- **Redoblante**: ruido rosa recortado (450 Hz a 4,2 kHz) más el cuerpo del parche.
- **Platillos**: un golpe y un crescendo de un compás, ruido arriba de 4 kHz.

### Por qué no usa los instrumentos de Tone

Las primeras versiones usaban `PolySynth`, `MonoSynth`, `MembraneSynth` y `NoiseSynth` de Tone, y la
orquesta entera costaba más de lo que el audio aguanta en vivo: cada voz de Tone queda armada (señales,
envolventes y filtros andando aunque no suene). Ahora cada nota y cada golpe arma sus nodos nativos de
Web Audio y se desarma sola al terminar (`voices`, `membrane` y `noise` en el archivo); de Tone quedan los
efectos (filtros, paneos, vibratos, la sala) y el transporte. Suenan igual: mismas envolventes, mismos
filtros, mismas recetas de ruido.

La sala propia es una convolución con una respuesta inventada (ruido que se apaga en unos 2,5 s y se
oscurece). Con una Freeverb de Tone (que tiene pocos peines), las notas largas de los cornos hacían silbar
la reverb en 553 Hz (el do#5 del tema), 17 dB arriba del resto.

## Las canciones

| | `epica.llamado` | `epica.marcha` | `epica.asedio` |
| --- | --- | --- | --- |
| Escenario | 1 | 2 | 3 |
| Carácter | heroico, esperanzado | marcha tensa | asedio: tambores y metales |
| Tonalidad | re mayor, con el do natural del mixolidio | la menor (Si bemol frigio en la parte escondida) | re menor |
| Tempo | 104 | 120 | 130 |
| Pulso | cuerdas al galope (corchea y dos semicorcheas) | semicorcheas seguidas y «um-pa» de marcha | todo en 3+3+2 |
| El tema del caballero | entero, en los cornos | su cabeza en menor, y sigue una marcha distinta | lento, en notas largas arriba de los tambores |
| Forma (compases) | intro 4, A 8, B 8, A2 8, C 8, A3 8 | intro 4, A 8, B 8, C 8, D 4, A2 8, B2 8 | intro 4, A 8, B 8, C 8, D 4, A2 8, B2 8 |
| Hasta repetirse | 1 min 42 s | 1 min 36 s | 1 min 29 s |
| La segunda vuelta | la intro se apaga en vez de crecer; el solo del respiro lo hacen los violines | el tema del A en los violines, los cornos arriba | el tema del A baja a los trombones, los violines arriba |

### `epica.llamado` — El llamado (escenario 1)

El «tema principal». Re mayor, 104. Intro con redoble de timbal y la llamada del corno (re… la, la quinta
que sube con el «ta-tán» corto-largo). **A**: el tema entero en los cornos sobre las cuerdas al galope y
los timbales. **B**: los violines preguntan y los cornos contestan, con los trombones abajo. **A2**: el
tema pasa abajo, a los trombones, y los cornos hacen un contracanto. **C**: el respiro: coro, pizzicato y
un corno solo que sube por Si bemol, Fa y Do (bVI–bVII, la cadencia de las películas de aventura) con
campanitas, hasta el **A3**, con todos (redoblante de marcha, platillo, bombo, violines arriba).

### `epica.marcha` — La marcha (escenario 2)

La menor, 120. Intro con el redoblante solo y las cuerdas que entran. **A**: la cabeza del tema en menor
(la… mi) y sigue una marcha nueva, con cuerdas en semicorcheas y el bajo de «um-pa». **B**: los violines
arriba en do mayor, los cornos contestando con la cabeza del tema. **C**: a escondidas: un pizzicato con
cromatismos, el coro grave, un latido de timbal y, a lo lejos, el corno con el tema en re. **D**: subida
cromática del bajo (Fa, Fa#, Sol, Sol#) con redoble y platillo. **A2** y **B2** con todos: el tema en
cornos y trombones; en el B2 los cornos acompañan a los violines.

### `epica.asedio` — El asedio (escenario 3)

Re menor, 130. Todo en 3+3+2 (acentos en el 1, el «y» del 2 y el 4): taikos, bajo, golpes de trombón y un
ostinato de cuerdas que marca esos acentos. **A**: el tema del caballero en menor, en notas largas.
**B**: el coro grande y los cornos arriba. **C**: el respiro: un latido de taiko, el coro grave,
pizzicato en los acentos y la celesta tocando el tema como caja de música. **D**: subida con redoble de
redoblante y de timbal. **A2** (cornos en dos voces, violines arriba) y **B2** (violines con la melodía,
cornos contestando) con todos.

## La tensión

Las tres usan `intensity` (0 a 1) sin tocar el tempo; las capas entran de a poco (unos 2 s):

- **desde 0,2** (percusión): el redoblante de marcha, más golpes de timbal, los fantasmas de los taikos
  del asedio, redobles al final de las frases.
- **desde 0,45** (contramelodía): violines arriba, el coro, en el asedio los cornos en dos voces; en los
  respiros vuelve el ostinato de cuerdas bajito, para que no se caiga la urgencia.
- **desde 0,7** (metales): golpes de trombón, bombo, platillos, rellenos de taiko.
- y todo el tiempo: el filtro del ostinato se abre con la tensión.

Con tensión 0 cada canción está completa (no es un esqueleto esperando capas).

## Qué revisé (sin escuchar)

NIVELES

## Dudas

- Es la primera vez que estos instrumentos suenan: los timbres salen de la teoría y del espectrograma, no
  del oído. Lo que más me preocupa: que los cornos suenen a sintetizador de los 80 en vez de a metal (si
  pasa: bajar `hi` y `mid` del filtro de `horn`, o subir el ataque) y el coro (dos formantes fijos: puede
  sonar a «uuu» de órgano).
- El tema del caballero aparece en las tres. Es a propósito (una familia, como en las películas), pero si
  cansa en una partida entera: la marcha y el asedio solo citan la cabeza y siguen con otra cosa.
- La reverb del juego (una Freeverb de Tone) tiene notas que «silban» (sus peines se juntan en algunas
  frecuencias, por ejemplo 553 Hz en el canal derecho). Por eso los cornos van a la izquierda. Si en algún
  momento se cambia esa reverb, se puede volver a ubicar la orquesta como en un escenario.
