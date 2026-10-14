# Pruebas del pulido

14/10/2026. Cada cosa nueva de efectos y sonidos se prueba con un enlace. Se abre la versión completa (la de
los que prueban) y se agrega `?prueba=<nombre>` al final. Hay que hacer click en "Empezar".

## Cómo funcionan

- **Sin oleadas.** Aparecen los enemigos de la prueba delante del golfista, caminando despacio.
- **Se repiten.** Cuando caen todos, vuelven a salir.
- **No se pierde.** La puerta y el golfista no pierden vida.
- **Con agregados.** Algunas pruebas traen habilidades o el guante puesto.

Para comparar con lo de antes:
- **`&pulido=0`** apaga todo lo nuevo.
- **`&ajuste=pulido.<llave>:0`** apaga una sola cosa.
- **En el panel B** (pestaña Visual, sección "Pulido") está cada llave. Ahí también se pueden prender o apagar todas de una.

| Prueba | Qué mirar y escuchar |
|---|---|
| `?prueba=golpes` | El impacto según el golpe: el 1 con triangulitos blancos, el 2 con una estrella de puntas, el 3 con un destello, y el perfecto con un estallido naranja, estrellas que saltan y una congelada de un instante. Cada golpe tiene su sonido de palo y el perfecto, una estrellita. El enemigo se aplasta al recibir. |
| `?prueba=fuego` | El aura de fuego del guante en el golfista. Los enemigos vienen prendidos: llamas, el crepitar (sube con cuantos más se queman) y el chisporroteo de cada quemadura. La pelota de fuego deja estela. |
| `?prueba=hielo` | Cada 5 s se congelan y les crecen cristales. Pegales congelados y los cristales se rompen y saltan, o esperá a que se suelten. Además, el aura de hielo. |
| `?prueba=auras` | Los cuatro guantes en Q, W, E y R: fuego, hielo, rayo y fantasma. |
| `?prueba=burbuja` | La burbuja nueva del bendito: el borde brilla, tiene hexágonos y tiembla. Al romperla se disuelve con el borde encendido, con destello y sonido. Al volver a armarse crece desde adentro, con chispitas y su sonido. |
| `?prueba=blindado` | Cada pelotazo al blindado suena a metal. |
| `?prueba=escudo` | De frente, la pelota rebota con chispas y un metal más agudo. |
| `?prueba=intocable` | Mientras está cerrado, la pelota rebota con otro sonido y un anillo violeta. |
| `?prueba=curacion` | El chamán curandero nuevo. Llena su barra (6 s) y cura entero a todos los de su círculo: el élite y el jefe recuperan 5 como mucho. Se ve un círculo de runas verde, cruces que suben y un sonido. A los costados hay dos enemigos que se curan solos. |
| `?prueba=esquiva` | El salto del escurridizo suena y deja rayas. Cuando le vuelve la esquiva, suena un tic chiquito. |
| `?prueba=hechiceros` | Suena cuando conjuran y cuando cae el hechizo. |
| `?prueba=muertes` | Uno de cada tipo, cada uno con su voz al morir. Al caer todos suena la oleada terminada y salen las cartas: suenan al aparecer y al elegir. |
| `?prueba=jefe` | Entra un élite, con aviso y risa. Después el gólem: rugido al entrar, la roca que tira y la que cae, y su muerte. |
| `?prueba=palos` | El golpe de cada palo (1 2 3 4): el putter un tic, el hierro un click, el wedge con más cuerpo, el driver el ping metálico. Más fuerte cuanto mejor el golpe, y justo cuando el palo toca la pelota. |
| `?prueba=quejidos` | Uno de cada tipo con mucha vida: cada uno se queja con su voz al recibir, y el golpe suena según de qué está hecho (cuerpo, hueso, armadura, piedra, fantasma). El élite del medio gruñe grave cada vez que le pegás. |
| `?prueba=disparos` | Q W E R: driver de fuego, hierro de hielo, wedge de rayo y putter fantasma. Cada uno suena a su palo y a su elemento. |
| `?prueba=invocaciones` | Q W E R: el carrito arranca, el hoyo se clava (y el que cae suena), la bandera vuela y se clava, la pólvora chisporrotea. |
| `?prueba=mejoras` | Q W E R: la lluvia de pelotas sube, el caddie brilla dorado, la lupa crece, el clon junta energía. |
| `?prueba=refuerzos` | Q W E R: eco, potencia, fuerza y el palazo (suena al conectar: dejalos acercar). |
| Perder una partida | Ya sin `?prueba`: cuando cae la puerta o el golfista, los que siguen pegándole a la puerta no suenan más. |
| `?prueba=explosiones` | Grupos apretados para el hierro y el wedge: fogonazo, humo, rayas y la marca quemada en el piso. |

## Las llaves

Las llaves están en `POLISH`, en `src/core/polish.ts`.

| Llave | Qué apaga |
|---|---|
| `impacts` | Los impactos de la pelota, las chispas del escudo y el anillo del intocable |
| `hitstop` | La congelada del perfecto |
| `squash` | El aplastado al recibir |
| `explosions` | Las explosiones nuevas (vuelven las esferas de antes) |
| `auras` | El aura del guante y la estela de la pelota de fuego |
| `burning` | Las llamas del que se quema |
| `frozen` | Los cristales del congelado |
| `bubble` | La burbuja nueva del bendito (vale para los que salen después de tocarla) |
| `heals` | Las cruces y el círculo de la curación |
| `samples` | Los sonidos grabados del palo, de la pelota contra el enemigo, explosiones, puerta, daño, victoria y derrota (vuelven los sintetizados) |
| `voices` | Las voces de muerte, el élite y el jefe |
| `powerSounds` | Burbuja, metal, rebotes, curación, esquiva y hechiceros |
| `uiSounds` | La oleada terminada y las cartas |
| `fireSounds` | El crepitar y el chisporroteo |
| `groans` | Los quejidos al recibir, y el gruñido del élite |
| `abilitySounds` | El sonido de cada poder (vuelve el whoosh de antes para todos) |
| `mix` | La mezcla sin saturar: vuelve el limitador de antes, que dejaba recortar con varios sonidos juntos. Se nota al recargar |
| `onTime` | Los sonidos en el acto: vuelven a sonar una décima tarde, como antes |
