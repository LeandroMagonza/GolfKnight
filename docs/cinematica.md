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

## Lo que falta o conviene mejorar

- El mago es de otro estilo (Mixamo pintado) que los de Synty. Se nota poco con la luz de noche, pero
  queda pendiente pasarlo a la paleta de Synty (idea de `tools/synty_style.py`) o reemplazarlo.
- No hay clip de agarrar el palo: aparece en la mano entre un plano y otro.
- El auto que atropella entra de costado y casi no se ve antes del destello: a propósito (el chiste es
  que no lo ve venir), pero se puede mostrar más.
- Sonido: por ahora usa los sonidos sintetizados del juego (viento, golpe, campanas, cuerno). Falta
  música y un bocinazo.
- Integrarla al juego en lugar de las placas, con "Saltar".
- Formato de redes: una segunda cámara por plano para 9:16, y el render a mp4 cuadro por cuadro.
