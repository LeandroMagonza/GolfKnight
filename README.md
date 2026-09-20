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

La idea que ordena todo: **el driver es el único palo que hace daño**. Los otros preparan el tiro:
el hierro abre defensas, el wedge acomoda enemigos y el putter te mueve a vos.

- **Puestos y pelotas.** El golfista no camina libre: se mueve de costado entre nueve puestos marcados
  con un banderín, con `A` y `D`. Un toque es un puesto y dos toques son dos; mantener apretado no
  repite, para que sea fácil de controlar. Corre muy rápido. **Solo se pega donde hay una pelota**: los guardias las van tirando desde
  atrás. Nunca hay más de tres esperando, llegan más rápido cuantas menos quedan, y nunca caen en el
  puesto donde estás parado, así que después de cada tiro hay que moverse. Sin pelota, el swing sale
  al aire.
- Mouse apunta. Mantener click (o `F`) carga el swing; soltar pega. Click derecho (o `X`) cancela.
- **La carga va por niveles: 1, 2 y 3**, y con el driver el nivel es el daño. El cuarto escalón es el
  **crítico**: soltar justo al tope (el último 8 % de la barra) pega 8. La barra sube lenta al principio
  y rápida al final, y después del tope rebota rápido por todo el rango, de 0 a 100 %. El crítico es lo
  que más daño por segundo rinde, después la carga completa, y spamear toques lo que menos (hay un test
  que lo fija). El **alcance** va aparte: crece con la carga y, cuando llega al máximo, se queda ahí.
- El nivel se ve y se escucha donde estás mirando: la línea de tiro cambia de color y de grosor con
  cada nivel (blanca, amarilla, naranja, y roja en el crítico; gris si en el puesto no hay pelota), y
  suena una nota por escalón (do, mi, sol, y la octava en el crítico). Con el hierro y el wedge, la
  punta de la línea lleva el color y el ícono del palo; con el driver no.
- **La vida está en la misma escala**: los cuadraditos sobre cada enemigo son su vida. Un goblin tiene
  2, así que pide nivel 2; cargar de más es tiempo perdido.
- Vos tenés 3 de vida y la puerta 10. **Nadie te persigue**: todos van derecho a la puerta. Pero el que
  te pasa por encima te atropella: te saca 1 y muere en el choque, así que ese ya no llega a la puerta.
  A la puerta cada enemigo le saca 1 (el caballero y el kamikaze, 2). Después de recibir un golpe hay un
  segundo de respiro, titilando: el que pasa en ese momento sigue de largo. Entre oleadas se
  recupera 1 de vida y 2 de puerta.
- Palos con `1`-`3`, rueda o `Q`/`E`. Después de usar el hierro o el wedge vuelve solo el driver. Si cambiás en medio de un tiro, el palo queda en cola (borde
  punteado) y entra solo cuando el tiro termina o lo cancelás.
  - **Driver · Rompevientos**: recto y casi rasante (18-60 m), atraviesa a toda la fila. **Racha**: cada
    baja del driver le suma +10 % de daño, hasta +50 % (tres escalones de una si el swing fue perfecto).
    Pegar sin matar la mantiene; un tiro que no daña a nadie la corta. Con daño en números enteros casi
    no se nota: está pendiente rehacerla.
  - **Hierro 7 · Escarcha**: globo de hielo (6-40 m), sin daño, recarga de 2 s. Congela en un centro chico y enfría alrededor. *Frío*: camina al 40 %, no
    tiene escudo (desaparece mientras dura), si es chamán se le apaga el aura, y recibe 25 % más de
    daño. *Congelado*: además no camina ni ataca. Dura de 3 a 5 s según la carga; el swing perfecto
    agranda las dos zonas y suma duración. Al jefe nunca lo congela, pero frío camina y ataca más lento.
  - **Wedge · Vendaval**: globo rápido (5-28 m, llega en medio segundo), sin daño: empuja a todos hacia
    afuera desde donde cae. Con swing perfecto, además los deja *expuestos* 4 s: reciben 50 % más.
- **Putter · Portal**, en `Espacio`: te teletransporta al puesto más cercano al cursor y te deja una
  pelota ahí. Recarga de 8 s.
  Es la única salida cuando un alma en pena te tiene agarrado.
- **Palazo** en `Shift` (o `V`): golpe corto de 2 de daño a lo que tengas encima, hasta cuatro
  enemigos, con 2.5 s de recarga. Los manda unos 15 m hacia atrás (a los pesados, apenas).
- `G` (o el botón) cambia cómo se apuntan los globos: **al cursor** (caen donde está el mouse y la
  carga define solo la fuerza del efecto) o **por carga** (la carga es la distancia, como el driver).
- `Esc` pausa, `R` reinicia, `M` silencia la música, `C` cambia el skin del golfista.
- Un enemigo que llega a la puerta le pega una sola vez y desaparece adentro.
- Pierde si cae la puerta o el golfista.

Son 6 oleadas, y cada una presenta un enemigo y el palo que lo resuelve. Se arranca solo con el
driver y el palazo; los demás palos no se ven hasta que llegan. Cuando llega uno aparece su cartel y
el juego queda frenado hasta cerrarlo con un click. Las habilidades con recarga muestran cuánto tardan
y, mientras recargan, el número bajando. Para probar con todo habilitado desde el principio: `http://localhost:5173/?palos`.
Para mirar al bot jugar una partida: `http://localhost:5173/?bot` (se pueden combinar: `?bot&palos`).

| Oleada | Enemigo nuevo | Palo nuevo |
| --- | --- | --- |
| 1 | Goblins y esqueletos | Solo driver |
| 2 | Goblin guerrero | Hierro 7 |
| 3 | Estampida con kamikazes | Wedge |
| 4 | Alma en pena | Putter |
| 5 | Chamán | |
| 6 | Gólem de roca | |

Los enemigos salen sueltos, sin formación, y cada uno camina en línea recta a su ritmo: las filas se arman y se
deshacen solas, y encontrarlas es el juego.

| Enemigo (vida) | Qué hace |
| --- | --- |
| Goblin (2) | Rápido y débil, viene en montón |
| Esqueleto (4) | Pide un tiro bien cargado |
| Goblin kamikaze (2) | Corre a la puerta (o a vos) y explota; su explosión también daña a la horda |
| Goblin guerrero (4) | Su escudo devuelve el driver que le llega de frente. Con hielo encima no se cubre |
| Caballero esqueleto (5) | Lento, mucha vida, casi no se deja empujar |
| Alma en pena (2) | La única que te persigue. Si te agarra no podés caminar ni pegar, y te saca vida hasta que saltás con el putter (o se cansa, a los 5 s) |
| Chamán goblin (3) | Camina con el grupo con las manos en alto. Los enemigos a menos de 8 m son inmunes a todo. A él nunca lo protege nadie. Con hielo encima se le apaga el aura |
| Gólem de roca (80) | Jefe. Se planta a 22 m y le tira piedras a la puerta cada 4 s; de cerca pega |

El diseño, lo que se probó y lo que queda abierto está en `docs/diseno-combate.md`.

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
    cartel, puestos y pelotas, palo en cola, medidor y niveles, racha, hielo, empujón, chamán, putter,
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