# Golf Knight: la cinemática de la intro

26/9/2026. Primera prueba publicada en `cine.html`. La idea es que reemplace a las placas de texto de
la intro, y más adelante sumar una cámara para un formato vertical de redes.

## La historia (versión de la prueba)

Idea de Leandro: el protagonista no era un golfista profesional ni estaba jugando. Estaba en una
**feria medieval disfrazado de caballero**, y los palos de golf seguían en el baúl del auto. Lo atropella
un auto en el estacionamiento; el hechizo, que buscaba "un gran guerrero con armadura y un arma de
precisión letal", ve la armadura y toma los palos por su arma.

Eso resuelve el problema del modelo: el mismo caballero sirve para antes y después, y el chiste se
cuenta solo.

| # | Plano | Qué pasa | Dura |
| --- | --- | --- | --- |
| 1 | La feria | De día, carpas y guirnaldas. El caballero camina por la feria; un goblin y un esqueleto charlan al costado. *"Sábado. Feria medieval." / "Tu disfraz: impecable. Los de los demás, sospechosamente buenos."* | 6.5 s |
| 2 | El estacionamiento | Atardecer. Llega a su auto con el baúl abierto y la bolsa de golf adentro. *"Los palos de golf seguían en el baúl desde el domingo."* Busca algo, se da vuelta por los faros, y lo atropellan. Destello blanco. | 6 s |
| 3 | Nada | Negro: *"Y después, nada."* | 2.8 s |
| 4 | El círculo | De noche, un círculo de runas brillando. El caballero se levanta; el mago festeja: *"¡Funcionó! ¡Vino el Gran Guerrero!"* — *"¿...Perdón?"* | 8 s |
| 5 | El arma | *"La profecía pedía armadura reluciente… y un arma de precisión letal."* La cámara va a la bolsa: los palos se encienden. *"¿Los palos de golf?"* | 8.5 s |
| 6 | La horda | De espaldas, con el driver brillando en la mano. La horda cruza la loma delante de la luna. *"¡Las hordas marchan sobre Valdehoyo!"* — *"Yo vine a una feria."* Título. | 8.5 s |

Unos 40 segundos. Al terminar pasa al juego.

## Cómo está hecha

- **Todo es función del tiempo.** Dado un segundo, el reproductor pone cada actor, clip, cámara, texto
  y luz donde tiene que estar. No simula cuadro a cuadro. Por eso se puede arrastrar la barra, abrir
  `?t=12.5`, sacar cuadros sueltos con `tools/cine.mjs` y, más adelante, renderizar a video cuadro por
  cuadro sin que salga distinto.
- **El guion es datos** (`src/cine/intro.ts`, campos en `src/cine/types.ts`): planos con escenario,
  claves de cámara, recorrido y clips de cada actor, textos (subtítulo, globo sobre un personaje,
  placa, título), sonidos del juego y números que varían (fundido, destello, temblor, runas, brillo de
  los palos, faros). Cambiar la historia es tocar ese archivo.
- **Escenarios de figuras simples** (`src/cine/sets.ts`): carpas a rayas, guirnaldas, autos de cajas,
  bolsa de golf, círculo de runas dibujado, columnas con antorchas, luna y estrellas. Cada uno con su
  luz y su cielo.
- **Personajes**: el caballero y la horda salen de PolygonDungeon (`cine-dungeon.glb`, con los clips
  nuevos retargeteados); el mago es Abe, de Mixamo (`mage.glb`). El palo en la mano es el `club.glb`
  del juego.
- Imagen con franjas de cine (2.2:1), sombras, corrección ACES y brillo.

## Ajustes del 28/9, después de verla

Leandro todavía no decidió entre la feria medieval y un torneo de golf como comienzo. Lo que marcó de
esta versión, ya corregido:

- **Música**, distinta para cada mundo (`src/cine/music.ts`, sintetizada con Tone.js). *Feria*: laúd,
  flauta dulce, tambor y pandereta, alegre; en el estacionamiento queda sonando de lejos (más baja y sin
  agudos) y el atropello la corta en seco, sin eco. *Magia*: coro, campanas y un zumbido grave, en
  menor, desde el círculo. *Horda*: tambores tipo taiko y metales encima de la magia en el último plano.
  Todo sigue al tiempo del guion, así que al arrastrar la barra la música sigue donde corresponde. Cada
  plano dice qué suena con `music`. Más una bocina antes del atropello.
- **El cartel de la feria** achica la letra hasta que el texto entra, y ya no lo cruza un poste.
- **Feria → estacionamiento**: fundido a negro y un subtítulo, *"A la salida."*, en vez del corte seco
  de día a atardecer.
- **El estacionamiento temblaba todo el plano**: era un error del motor, que usaba el valor inicial de
  una rampa (el temblor del golpe) desde el comienzo del plano. Ahora un número vale recién desde que
  empieza su rampa.
- **Pies bajo tierra en el círculo**: la plataforma mide 30 cm y los actores estaban en 0. Cada
  escenario dice ahora a qué altura está su piso.
- **La bolsa de palos** se ve de más lejos, con el caballero y el mago alrededor.
- **El caballero miraba para atrás en el final**: el `Idle` gira la cabeza hasta 70°. Ahora usa
  `Idle 2`, que mira al frente (también el mago).
- Cada plano se dibuja una vez durante la carga: el primer cuadro de cada escenario trababa la imagen
  un segundo mientras la música seguía.

## Voces (28/9)

Leandro eligió quedarse con la feria medieval y pidió voces. Primero salieron de **Kokoro** (local,
gratis, el TTS de su asistente) y después, a pedido suyo, se rehicieron con **OpenAI**
(`gpt-4o-mini-tts`), que actúa: cada personaje tiene voz e indicación general, y cada línea dice cómo
se actúa. Las líneas están en `tools/voces_lineas.py`; `tools/voces_openai.py` genera las que usa la
cinemática (`public/voices/`) y `tools/voces.py` las de Kokoro (`public/voices/kokoro/`), que se oyen
con **`cine.html?voces=kokoro`** para comparar.

| Personaje | OpenAI | Indicación | Kokoro |
| --- | --- | --- | --- |
| Narradora | `coral` | rioplatense; narradora de cuento cómico, cálida, un poco irónica, pausada | `ef_dora` |
| Mago | `onyx` | latino neutro (es del otro mundo); mago anciano, grave, solemne y teatral | `em_santa` a 0.88 |
| Caballero | `verse` | rioplatense; tipo común disfrazado que no entiende nada, natural | `em_alex` |

Por línea: el mago exaltado en "¡Funcionó!", misterioso en la profecía y alarmado en "¡Las hordas…!";
el caballero aturdido en "¿Perdón?", incrédulo en "¿Los palos de golf?" y resignado en el remate;
la narradora irónica en "sospechosamente buenos" y seca en "Y después, nada.".

- OpenAI deja hasta 1.5 s de silencio al principio y al final: el script lo recorta
  (`--recortar` lo hace con los que ya están, sin llamar a la API).
- Las voces actuadas son más lentas: la feria pasó a 9.5 s y el estacionamiento a 8 s (el atropello y
  la bocina se corrieron), para que nada se pise. Con Kokoro los mismos tiempos sobran.
- Mientras alguien habla la música baja unos 7 dB.
- Se dice un texto apenas distinto del que se lee (comas en vez de puntos suspensivos).
- La key de OpenAI se lee de `E:sistente\.env` sin imprimirla. Una pasada completa son unos 30 s de
  audio: menos de un centavo de dólar.

## Lo que falta o conviene mejorar

- El mago es de otro estilo (Mixamo pintado) que los de Synty. Se nota poco con la luz de noche, pero
  queda pendiente pasarlo a la paleta de Synty (idea de `tools/synty_style.py`) o reemplazarlo.
- No hay clip de agarrar el palo: aparece en la mano entre un plano y otro.
- El auto que atropella entra de costado y casi no se ve antes del destello: a propósito (el chiste es
  que no lo ve venir), pero se puede mostrar más.
- Integrarla al juego en lugar de las placas, con "Saltar".
- Formato de redes: una segunda cámara por plano para 9:16, y el render a mp4 cuadro por cuadro.
