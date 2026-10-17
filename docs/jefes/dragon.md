# El Dragón (`dragon`)

**Qué pone a prueba: pegarle a lo que vuela, con el palo que llega, y en el momento justo.** El dragón está
siempre en el aire: el driver y el putter le pasan por abajo, y hay que bajarlo con el hierro o el globo del
wedge. Y elegir **cuándo**: pegarle mientras trae enemigos los suelta antes de la línea (y se golpean al
caer), y pegarle mientras carga el fuego se lo corta.

Lo que pidió Leandro (17/10):

> un dragon, me imagino que tiene partes donde vuela y partes que esta en el campo. quizas viene volando desde
> atras, con enemigos agarrados en las patas, y vos le tenes que pegar con el hierro o con el wedge, si le
> pegas deja caer a los enemigos donde le hayas pegado y le haces danio a los enemigos por la caida, si no, los
> deja caer mucho mas adelante, en la linea de 10 o 20. tambien tira fuego para arriba, que cae en multiples
> spots de tus pelotas, quemandolas si estan y haciendote danio si estas vos, osea que tenes que esquivar eso,
> me imagino que primero tira 3 spots, despues 5, despues 7 y al final 8. otra posibilidad es que en vez de
> tirar todo junto, tire tipo rafaga y tengas que ir esquivando, hace las dos opciones. no me imagino mucho la
> parte que esta en tierra la verdad, quizas seria todo volando y le pegas cuando va a tirar el fuego o cuando
> va a dejar enemigos. quizas en algun momento vuela de un lado al otro en vez de venir de atras

Código: `src/game/bosses/dragon/` (`index.ts` las versiones y la escolta, `fight.ts` la pelea, `look.ts` el
modelo, `look.test.ts`). Probar: `?ola=10&jefe=dragon.lluvia` (o `dragon.rafaga`, `dragon.cruce`; o el panel
B > Pruebas > Jefes).

## Lo que se decidió

- **Todo volando** (Leandro: «quizás sería todo volando y le pegás cuando va a tirar el fuego o cuando va a
  dejar enemigos»). No baja nunca: se le pega en las dos cosas que hace.
- **«Desde atrás» es desde atrás tuyo**: de detrás de la cámara, por arriba de la puerta, hacia el campo. Lo
  probé primero desde el fondo (del lado de la horda, hacia vos) y no se veía: desde la cámara se ve la cancha
  hasta unos 37 m de los puestos (z 46, más allá está la barra de arriba), y lo que vuela se ve más arriba en la
  pantalla (a 4 m de alto es como si estuviera 13 m más lejos), así que el dragón llegaba debajo de la barra y
  se lo veía 2 o 3 s. Desde atrás tuyo **se lo ve todo el camino**: te pasa por arriba, baja en picada pasando
  la línea y se aleja hacia la marca, y le pegás de espaldas (las pelotas van para el mismo lado). Y se lee
  igual que lo pidió Leandro: si no le pegás, los suelta «mucho más adelante», en la línea de 10 o 20 (los
  carteles del campo); si le pegás antes, los suelta ahí, golpeándose.
- **Como los suelta más cerca que en la línea, la caída tiene que valer la pena:** les saca **3** (el goblin,
  la goblina y el orco se mueren; al esqueleto le queda 1).
- **Los «spots de tus pelotas» son los puestos de la línea** (`ctx.spots()`): son **9** (cada 4 m, de x −16 a
  16; los dos de cada punta sin guardias). El 3, 5, 7, 8 va tal cual: con 8 de 9 queda **un solo puesto
  libre**. Elige primero **tu puesto**, después los que tienen pelota, después al azar.
- **Quemar una pelota**: la que esté en un puesto donde cae fuego se quema (queda un carbón humeando) y el
  puesto **arde 4 s**: los guardias no tiran ahí, y la quemada **sigue contando para el tope** de pelotas hasta
  que vuelve (a los 4 s, al mismo puesto si sigue libre). Si no, el guardia la reponía en el acto y quemar no
  costaba nada.
- **Las dos opciones del fuego son dos versiones** (`lluvia` y `rafaga`), y la tercera (`cruce`) es «de un lado
  al otro»: lo usé para el fuego, que es donde cruzar cambia cómo se esquiva (una ola que barre la línea). Las
  pasadas con enemigos vienen siempre desde atrás.

## Cómo es (lo común)

- **Se le pega en el aire.** Las pelotas lo tocan en la franja de alturas que ocupa, desde lo más bajo que tiene
  colgando (las garras, o los pies de los que trae) hasta arriba de las alas (`Enemy.hitBand`, nuevo). Nunca más
  abajo de **1.15 m**: el driver sube como mucho 0.89 m (su tiro fijo de 50 m a 3.5°) y el putter rueda, así que
  **le pasan por abajo**. El **hierro** apuntado a su sombra le entra a 1.2-1.3 m de alto (por eso el cilindro
  es grande: 2.9 m de radio) y el **globo del wedge** le cae de arriba (y su área, que se mide en el piso, lo
  agarra aunque caiga al lado).
- **El anillo naranja en el piso** (alrededor de su sombra) dice que está bajo: ahí le llega el hierro. Sin
  anillo está alto: solo le llega el wedge que le cae encima (o nada, cuando pasa por arriba de todo).
- **La pasada** (una sí y una no con el fuego): va a buscar enemigos **por arriba de todo** (no se lo ve: solo
  su sombra cruzando la cancha hacia vos), da la vuelta atrás tuyo y vuelve con 2 a 4 enemigos en las patas
  (goblins, orcos, esqueletos, cada vez más). Te pasa por arriba a 8 m (más bajo tapaba la cancha), baja en
  picada pasando la línea hasta llevarlos con los pies a 1.15 m, y va a 5 m/s hacia un punto de la **línea de
  10 o de 20**, marcado con un disco naranja y una franja. Al llegar **frena y abre las garras 1.2 s** («le
  pegás cuando va a dejar enemigos») y los suelta. **Si le pegás antes, los suelta donde está** y caen dando
  vueltas. A los que trae también se les puede pegar (el hierro que los toca revienta ahí y el área le llega).
- **El fuego**: da la vuelta y se planta a unos 14 m de los puestos (z 23), bajo, se para de manos, levanta el
  cuello y la boca se le prende. Tira **3 bolas, después 5, después 7, y de ahí siempre 8**. Cada bola marca su
  puesto con un disco naranja y un anillo que se cierra; al caer quema la pelota que haya y **te saca 1 si
  estás** (y te corta el tiro si estabas cargando ahí). **Pegarle mientras carga le corta el fuego**: le
  revienta en la boca (3 de daño de más) y queda tosiendo 1.2 s. Silenciado tampoco tira; congelado o aturdido
  se queda en el aire sin hacer nada (pero el golpe le corta lo que estaba haciendo igual).
- **El respiro**: después del fuego se va al fondo a dar vueltas 6 s (fuera de la vista) antes de la próxima
  pasada. Sin eso traía enemigos cada 10 s y la puerta caía antes del minuto.
- **Arriba no le llega lo que revienta en el piso**: las áreas se miden en el piso, sin altura, así que un globo
  que caía debajo de su sombra le pegaba aunque volara a 17 m. Ahora, con lo más bajo que tiene a más de 4 m,
  solo le pega la pelota que lo toca en el aire (`AREA_REACH`).
- **La presión sube sola**: las pasadas traen más y más duros; el fuego, más bolas; todo va un 25 % más rápido
  (y el respiro, más corto) a los 2 minutos y medio.
- **La regla de la puerta**: mientras viva, cada pasada deja 2 a 4 enemigos a 10-20 m de la puerta, sin tope.
  Ignorarlo es comerse una pasada tras otra.
- **La escolta** viene con un 30 % menos de cada grupo: el dragón trae los suyos.
- **La vida**: 32, más una por nivel de dificultad, más la del talento del golpe 4. La barra de arriba dice qué
  está por hacer («Trae enemigos», «¡Los va a soltar!», «¡Va a tirar fuego!»...).

## Las versiones

| Id | El fuego |
| --- | --- |
| `dragon.lluvia` | **Todo junto, con aviso.** Las marcas aparecen apenas empieza a cargar (1.7 s) y las bolas tardan 1.3 s en caer: unos 3 s para ir a un puesto sin marca. Pegarle mientras carga corta todo. |
| `dragon.rafaga` | **En ráfaga, a tu puesto.** Carga 1 s (sin marcas) y escupe de a una, cada 0.5 s, **al puesto donde estás**; cada una tarda 1.1 s en caer y marca su puesto al salir. Hay que ir moviéndose (o pegarle: cualquier golpe corta el resto). |
| `dragon.cruce` | **Cruzando de un lado al otro.** En vez de plantarse, sale por un costado y cruza la cancha a unos 12 m de los puestos (z 21), escupiendo la bola de cada puesto marcado un poco antes de pasarle por arriba (cae 1 s después): una ola que barre la línea. Las marcas están desde que empieza a cruzar. Se esquiva yendo a un puesto sin marca, o pasando al que ya se quemó. Pegarle corta el resto. |

## Los números para tocar (arriba de `fight.ts`)

- `HP` (32 + 1 por nivel), `RADIUS` 2.9, `MIN_BAND` 1.15 (lo más bajo que lo tocan las pelotas), `ALT` (las
  alturas), `IRON_REACH` (hasta dónde se dibuja el anillo de «le llega el hierro»), `AREA_REACH` 4 (hasta dónde
  le llega lo que revienta en el piso).
- `SPEED` (con enemigos 5 m/s; cruzando 8; yendo y viniendo 15-20), `HURRY` (+25 % en 150 s).
- `BACK` (dónde da la vuelta, atrás tuyo), `REST` (el respiro: 6 s), `PASS` (a qué altura te pasa por arriba, dónde baja en picada, cuánto
  frena antes de soltar), `HOVER` (dónde se planta: z 23), `CROSS` (por dónde cruza: z 21).
- `DROP_LINES` (10 y 20 m), `CARRY` (qué trae en cada pasada), `FALL.damage` 3 (el golpe de la caída).
- `FIRE_COUNTS` 3, 5, 7, 8; `RAIN`, `BURST`, `SWEEP` (cuánto carga, cada cuánto, lo que vuela cada bola);
  `BLAST` (radio 1.7, te saca 1); `BURN.time` 4 s; `CHOKE` (3 de más y 1.2 s tosiendo).
- En `index.ts`: `ESCORT` 0.7 (cuánto de la escolta de siempre).

## El modelo

Hecho por código en three, facetado como la hidra (`look.ts`): un dragón rojo de cuatro patas con la panza
amarilla, cuernos de hueso, ojos amarillos, placas oscuras en el lomo, cola de seis pedazos con punta de pala, y
dos alas de murciélago (brazo, antebrazo con tres dedos y la tela en festones). Mide unos 10 m de punta a punta
y 12 de ala a ala (`SCALE` 1.25). Todo se anima por código (`DragonRig`): el aleteo (el antebrazo llega tarde y
la punta se pliega al subir), el cuerpo que sube con cada golpe de ala, la cola que ondula, el alabeo en las
curvas, las patas recogidas volando y colgando cuando agarra o se planta, las garras que se abren al soltar, y
el cuello que se levanta con la boca abierta y brillando para tirar el fuego al cielo. Los que trae cuelgan de
las garras y patalean. El fuego son bolas con halo y estela de partículas del atlas de efectos (`fireBlur`,
`flame`, `smoke`), las explosiones de siempre, y llamitas y humo en el puesto que arde. Al morir cae en picada y
se estrella.

Se miró en fotos del juego (`tools/jefe-fotos.mjs`): de espaldas pasándote por arriba se ve enorme y se lee
muy bien; plantado, de frente, parado de manos con las alas abiertas; cruzando, de costado.

Sonidos: los que ya están (`growl` al salir y al cargar, `cast-fire` al escupir, las explosiones, `burn-tick` al
quemar una pelota, `thud` de los que caen de un golpe).

## Cómo le fue al bot

`node tools/jefes-tanda.mjs dragon --juegos=2 --tope=300` (el bot «humano», desde la oleada 10, a velocidad
10). Cada fila es una de las tandas que se fueron corrigiendo:

| Tanda | lluvia | rafaga | cruce | Lo que se vio y se cambió |
| --- | --- | --- | --- | --- |
| 1 (venía del fondo) | 0/2 | 0/2 | 0/2 | Casi no le pegaba (0-10 golpes en 3-4 min): en el campo plano el bot **nunca tiraba el hierro ni el wedge** salvo a los escudos. Arreglado en `bot.ts`. Y el dragón casi no se veía (ver «Lo que se decidió»): pasó a venir desde atrás tuyo. |
| 2 (desde atrás) | 1/2 | 0/2 | 0/2 | Le pega (5-10 golpes), pero la puerta cae antes del minuto: traía enemigos cada 10 s, la escolta entera, y el bot lo perseguía a él y se olvidaba de la horda. |
| 3 (con el respiro, la escolta al 70 % y el bot que lo pesa menos) | **2/2** | **1/2** | **1/2** | Gana 4 de 6. Peleas de 2 a 3 minutos (con la escolta), 13-20 golpes al dragón, la mayoría de los enemigos los suelta de un golpe (14 de 19, 29 de 31), corta el fuego 1-4 veces por pelea, le queman 9-25 pelotas, el fuego le pega 0-2 veces. Pierde de puerta. |

Ningún error de la página en ninguna. Después de la tanda 3 se agregó `AREA_REACH` (arriba no le llega lo que
revienta en el piso): le saca algunos golpes de wedge al bot, que tiraba globos a la sombra cuando pasaba alto;
no se volvió a correr.

El bot no juega como una persona acá: no sabe que pegarle mientras carga corta el fuego (lo pesa un poco más,
nada más), ni elige la pelota que lo deja en el puesto libre. Las tandas sirven para ver que se puede ganar y
que no se rompe; lo fino lo tiene que decir Leandro jugando.

## Archivos compartidos (cambios chicos)

- `enemies.ts`: `Enemy.hitBand` (la franja de alturas que tocan las pelotas; null para todos los demás, que
  siguen igual), y lo que vuela no se empuja con los de al lado.
- `balls.ts`: el choque con un enemigo respeta `hitBand` (sin `hitBand`, igual que antes).
- `bot.ts`: la línea del driver y el putter no cuenta a lo que vuela por arriba de 0.9 m; contra lo que vuela
  prueba siempre el hierro y el wedge (antes solo con relieve: en el campo plano nunca le tiraba); y el hierro
  no, si vuela alto.
- `tees.ts`: `closed` (puestos donde los guardias no tiran) y `held` (pelotas que no están pero cuentan para el
  tope). Los pone el dragón y los saca al terminar.

## Para decidir

- **Desde atrás tuyo, o desde el fondo.** Elegí desde atrás tuyo porque desde el fondo no se veía (ver arriba).
  Pasándote por arriba se ve enorme un momento (por eso pasa a 8 m y baja en picada pasando la línea): ¿molesta?
- **Los que suelta de un golpe caen más cerca tuyo que en la línea** (viene desde atrás), así que la caída les
  saca 3 (casi todos se mueren). ¿Está bien que pegarle sea casi siempre la jugada?
- **`cruce` usa el «de un lado al otro» para el fuego**, no para la pasada con enemigos. Si Leandro lo quería
  para las pasadas, es otra versión.
- **8 de 9 puestos** deja un solo puesto libre (con la ráfaga y el cruce, siempre hay por dónde). ¿O que el 8
  sea el tope y nunca queme todos menos uno?
- **Quemar una pelota** la saca 4 s y el puesto arde (los guardias no tiran ahí). ¿Más o menos castigo?
- **El rato a solas con él** no se midió: con el respiro y las vueltas, pasa más de la mitad del tiempo fuera del
  alcance del hierro. Si se hace largo cuando no queda escolta, se puede acortar el respiro a solas.
- Un clip que ayudaría (no está): los enemigos colgando de las garras usan el «Idle» y patalean por código;
  con un «Falling» o «Hanging» de Mixamo se verían mejor.
