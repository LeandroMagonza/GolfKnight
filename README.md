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
| **Barra de carga** | **qué tan bien** le pegaste: tres niveles de calidad, puro timing |
| **Palo** (`1`, `2`, `3`, `4`) | **cómo llega** la pelota, y cuánto pega a esa distancia |
| **Poder** (`Q`, `W`, `E`) | **qué hace** cuando llega |

- **Puestos y pelotas.** El golfista no camina libre: se mueve de costado entre nueve puestos marcados
  con un banderín, con `A` y `D`. Un toque es un puesto y dos toques son dos; mantener apretado no
  repite. Corre con easing: un puesto lleva unos 0.4 s. **Solo se pega donde hay una pelota**: los
  guardias las van tirando desde atrás. Nunca hay más de tres esperando, llegan más rápido cuantas
  menos quedan, y nunca caen en el puesto donde estás parado, así que después de cada tiro hay que
  moverse. Sin pelota no se puede ni empezar a cargar (la línea de tiro queda gris).
- Mantener click carga el swing y soltar pega. Click derecho (o `X`) cancela. Si llegás a un puesto
  con el botón ya apretado, la carga arranca sola. `Espacio` *clava* la calidad donde esté la barra, y
  el tiro sale cuando soltás el click.
- **La calidad va por niveles: 1, 2 y 3.** La barra sube lenta al principio y rápida al final; el
  nivel 3 es el último 8 %, y después del tope rebota por todo el rango. La barra **no tiene nada que
  ver con la distancia**: eso lo decide el mouse.
- La línea de tiro dibuja el arco real: blanca, amarilla y roja según la calidad, y con el color del
  poder cuando no estás cargando. El anillo (o el rectángulo del vendaval) marca qué va a agarrar el
  efecto, y arriba de todo un símbolo dice qué poder está en la mano. **El palo no tiene símbolo**: el
  que tenía tapaba justo el punto al que estás apuntando.
- **El campo tiene marcas de distancia cada 10 m, contadas desde la línea de los puestos**: la raya
  donde estás parado dice 0. Las de 20 y 40 m están resaltadas porque ahí cambia la banda de daño.

### Los palos (`1`, `2`, `3` y `4`)

Cada palo tiene su distancia preferida, así que elegir palo es elegir a qué distancia querés pelear.
Ninguno es el mejor siempre.

| Palo | Cómo llega | Alcance | Corta (≤20 m) | Media (20-40 m) | Larga (+40 m) |
| --- | --- | --- | --- | --- | --- |
| **1 · Driver** | rasante, atraviesa la fila entera | 6-66 m | 1 / 2 / 3 | 1 / 3 / 5 | **2 / 4 / 8** |
| **2 · Hierro 7** | arco bajo: sube, baja y sigue rodando | 6-55 m | 1 / 3 / 7 | 1 / 3 / 7 | 1 / 3 / 7 |
| **3 · Wedge** | globo alto, cae en picada y se queda ahí | 5-55 m | 1 / 3 / 7 | 1 / 3 / 7 | 1 / 3 / 7 |
| **4 · Putter** | rueda lento y para en el primero que toca | 3-22 m | **2 / 4 / 8** | 1 / 3 / 5 | — |

Los tres números de cada casilla son el daño según la calidad del golpe. El putter no llega más allá
de sus 22 m, así que su banda larga no existe.

**Atravesar y abrir área son dos cosas distintas**, y el hierro es el único que hace las dos:

| Palo | ¿Atraviesa en el aire? | ¿Abre área donde toca el piso? | ¿Después? |
| --- | --- | --- | --- |
| Driver | sí, a todos los de la fila | no | pica y sigue |
| Hierro 7 | sí, hasta a tres | sí, chica (1.8 m) | sigue rodando |
| Wedge | no | sí, grande (4.2 m) | se queda donde cayó |
| Putter | no | sí, chica (1.6 m), donde para | se queda |

### Los poderes (`Q`, `W`, `E`)

El poder vale para cualquier palo, y **cómo se reparte lo decide el palo**. La regla es una sola:
*cuanto más rasante, más lineal y preciso; cuanto más alto, más zonal y amplio.*

| | Con el driver (lineal) | Con el hierro (línea + área chica) | Con el wedge (área grande) | Con el putter (área chica) |
| --- | --- | --- | --- | --- |
| **Q · Golpe** | daña a cada uno que atraviesa | daña a los que atraviesa y donde cae | daña donde cae, a muchos | daña al que frena la pelota |
| **W · Escarcha** | enfría a cada uno de la línea | enfría la línea y donde cae | enfría un área grande | enfría donde para |
| **E · Vendaval** | un pasillo angosto a lo largo del tiro | barre la línea y donde cae | los junta en un rectángulo grande | los junta donde para |

- **Los tres tienen recarga**: el golpe 1.2 s, el vendaval 3 s y la escarcha 4 s. El poder queda
  elegido hasta que elijas otro; si el que tenés no está listo cuando vas a pegar, entra solo el que sí
  lo esté.
- *Frío*: camina al 40 %, no se cubre con el escudo y, si es chamán, se le apaga el aura. No congela
  ni cambia el daño que recibe. Dura 3, 5 u 8 s según la calidad.
- *Vendaval*: empuja a cada uno **hacia la línea del tiro**, justo lo que lo separa de ella, así que
  terminan todos en fila sobre el tiro, servidos para el siguiente driver. Los que quedan a la misma
  profundidad no se enciman: se paran hombro con hombro. Mueve a todos lo mismo, pesen lo que pesen.
- Pegarle mejor también agranda el área: ×1, ×1.2 y ×1.5.

### Lo demás

- **Palazo** en `Shift` (o `V`): no hace daño. Empuja unos 14 m hacia atrás a todo lo que tengas a
  4 m, a todos por igual, y les corta el ataque. 2.5 s de recarga. Es la única salida cuando un alma
  en pena te tiene agarrado.
- Vos tenés 3 de vida y la puerta 10. **Nadie te persigue**: todos van derecho a la puerta. Pero el que
  te pasa por encima te atropella: te saca 1 y muere en el choque. A la puerta cada enemigo le saca 1
  (el caballero y el kamikaze, 2). Después de recibir un golpe hay un segundo de respiro, titilando.
  **El que ya pasó tu línea queda fuera de juego**: se desvanece, no se le puede pegar y corre hasta
  la puerta. Entre oleadas se recupera 1 de vida y 2 de puerta.
- La puntería tiene un arco de 180 grados: de costado a costado, pero no para atrás.

| Enemigo (vida) | Qué lo hace distinto |
| --- | --- |
| Goblin (2) | rápido y en montón |
| Goblin kamikaze (2) | explota al tocarte, y se lleva a los vecinos |
| Esqueleto (4) | lento y duro |
| Goblin guerrero (4) | con escudo: rebota el tiro rasante de frente |
| Caballero esqueleto (10) | el único, además del jefe, que aguanta el mejor golpe |
| Chamán goblin (3) | hace inmunes a los que tiene a 8 m; a él nadie lo protege |
| Alma en pena (2) | la única que te persigue: te agarra y te desangra |
| Gólem de roca (80) | el jefe: tira piedras a la puerta desde lejos |

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
recargar:

- el **daño de cada palo** en cada banda de distancia y para cada nivel de golpe, más su alcance y el
  radio de su área;
- dónde **cortan las bandas** (20 y 40 m por defecto);
- la **recarga de cada poder**;
- la **vida, velocidad y daño de cada enemigo** (a los que ya están en el campo se les empareja);
- botones de prueba: **oleada infinita** (repite la composición de la oleada en curso, no se termina
  nunca), **vida infinita**, **puerta infinita** y **saltar a la oleada 1 a 6**;
- **Copiar configuración**, que deja en el portapapeles todo el balance como texto para pasarlo y
  llevarlo al código.

Los cambios valen desde el tiro siguiente y desde el enemigo siguiente. No se guardan: al recargar
vuelve el balance del código.

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
  - `botplay.mjs`: un bot (`src/bot.ts`, el mismo de `?bot`) juega las 6 oleadas, para chequear balance. No
    camina ni busca filas: es una cota inferior. Con `--ver` abre una ventana para mirarlo.
  - `swingshot.mjs`: capturas de cerca de cada fase del swing, y distancia cabeza-pelota en el impacto.
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