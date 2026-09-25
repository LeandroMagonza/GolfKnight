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
- **La calidad va por niveles: 1, 2 y 3.** La barra sube lenta al principio y rápida al final; el
  nivel 3 es el último 8 %, y después del tope rebota por todo el rango. La barra **no tiene nada que
  ver con la distancia**: eso lo decide el mouse.
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
| **3 · Wedge** | globo alto, cae en picada y se queda ahí | 3-55 m | 1 / 2 / 5 | 1 / 2 / 5 | 1 / 2 / 5 |
| **4 · Putter** | rueda y le pega al primero que toca | 2-20 m | **2 / 4 / 8** | — | — |

Los tres números de cada casilla son el daño según la calidad del golpe. El putter llega justo hasta la
línea de 20 m, así que nunca sale de la banda corta.

**El área pega menos que el impacto**, porque agarra a varios y no hay que apuntarle a nadie. El hierro
es el único que hace las dos cosas: **el que se come el pelotazo cobra el impacto** (1 / 3 / 7) y los de
alrededor cobran el área (**1 / 2 / 4**). Nadie cobra las dos por un mismo tiro. El wedge solo hace
área, así que su tabla ya *es* la del área; por eso, abriendo la más grande de todas, es la más baja.

**Quién abre área y cuándo:**

| Palo | ¿Atraviesa? | ¿Abre área? | ¿Y si cae al piso sin tocar a nadie? |
| --- | --- | --- | --- |
| Driver | sí, a todos los de la fila | no | pica y sigue |
| Hierro 7 | no | sí, al contacto (1.8 / 2.2 / 2.7 m) | **no pasa nada: hay que conectar** |
| Wedge | no | sí, donde cae (4.2 / 5 / 6.3 m) | igual explota: cae adonde apuntaste |
| Putter | no | no: le pega al que toca, a él solo | se queda ahí |

El **escudo** frena cualquier pelota que le llegue de frente, venga rasante o en arco. Lo único que lo
pasa es lo que cae a más de 45°, o sea el globo del wedge. Y el escudo también tapa del **daño en
área** que estalla adelante suyo, a él y a los que tiene detrás. Al del escudo se lo resuelve
silenciándolo con el vendaval, cayéndole detrás con el wedge, o pegándole de costado.

El hierro tiene **dos modos** en el panel de balance, para probarle la identidad: *revienta* (el de
arriba) y *atraviesa* (pasa de largo hasta a tres y abre su área donde cae, le pegue a alguien o no).

### Las habilidades (`Q`, `W`, `E`, `R`) y las cartas

**Al terminar cada oleada salen tres cartas y te quedás con una** (click, o `1`, `2`, `3`). Hay de tres
clases:

- **Habilidad**: una nueva va al primer lugar libre de `Q`, `W`, `E` o `R`. Si ya la tenés, sube de
  nivel (hasta 3): pega más o agarra más, pero **recarga un 30 % más lento por nivel**.
- **Mejora**: cosas que valen para todo el juego. A propósito no tocan la tabla de daño de ningún palo,
  para no romper la regla de «cada palo tiene su distancia».
- **Curarse**: la puerta (+3) o vos (+1). **Ya no te curás solo entre oleadas**: curarse es elegir no
  mejorar. Si la puerta está a la mitad o te queda una vida, una de las tres cartas es sí o sí para
  curarse.

Cada habilidad tira **su propia pelota**: no gasta la del puesto. Sale en el acto hacia el mouse, aun con
un tiro cargando.

**Palo y elemento** (12): cualquier palo con hielo, fuego o rayo. Es un tiro de ese palo, instantáneo, con
pelota gratis y **cargado al nivel de la habilidad**, que además:
- *Hielo*: enfría a cada uno que alcanza.
- *Fuego*: lo prende; pierde 1 de vida por segundo.
- *Rayo*: salta al enemigo más cercano, una vez por nivel. **Nunca salta a uno que ya tocó**, así que
  no puede dar vueltas matando a todo.

**Las demás** (12):

| Habilidad | Qué hace |
| --- | --- |
| Granada | silencia a los que agarra (sin escudo, sin aura, sin inmunidad, vulnerables); a los del borde los tira a los costados |
| Hielo | zona fría que dura: el que está adentro camina lento |
| Vendaval | rasante, los junta sobre la línea del tiro |
| Carrito | un carrito de golf cruza el campo de costado a la altura que apuntás, y atropella |
| Hoyo | el primero que lo pisa cae y no vuelve (los jefes no) |
| Bandera | los que están cerca van hacia ella en vez de a la puerta |
| Pólvora | marca; el marcado que muere explota, y encadena si los de al lado están marcados |
| Boomerang | tirás el palo de la mano: va y vuelve pegando, y mientras vuela ese palo no se puede usar |
| Lluvia de pelotas | una pelota en cada puesto |
| Caddie dorado | unos segundos con pelota infinita en tu puesto |
| Lupa | los agranda: más fáciles de pegar, y vulnerables |
| Clon | una copia tuya repite tus próximos tiros desde donde la dejaste |

**Mejoras**: Muñeca rápida (la barra carga un 15 % antes), Punto dulce (el perfecto un 35 % más ancho),
Ritmo (cada tiro seguido que mata carga el próximo más rápido), Racha del albañil (5 tiros seguidos
matando curan 1 de puerta), Perfecto de regalo (cada 8 bajas, el próximo tiro arranca clavado arriba),
Carcaj (si vas a pegar sin pelota, te aparece una; una cada 12 s), Pelota extra (los guardias mantienen
una más), Segundo aire (apretar una habilidad que recarga la tira igual, y recarga él 30 s).

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

**La pelota de reserva (`S`) está apagada**: las habilidades ya traen su propia pelota. Se puede volver
a prender desde el panel de balance.

**La cámara se encuadra sola**: al subirla o inclinarla se aleja lo necesario para que la línea de los
puestos quede siempre justo arriba de las barras de abajo. Se apaga o se ajusta en el panel.

Todos esos números viven en `src/core/abilities.ts` y `src/core/cards.ts`, y se tocan en vivo en el panel de balance, que además tiene una sección para sacar cartas o tomar cualquier habilidad o mejora al instante.

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
- las **habilidades**: recarga, alcance y los números de cada una (radio y duración del hielo,
  silencio y vulnerabilidad del vendaval, radio y fuerza de la granada);
- el **tiempo de carga** y la **rapidez del putter**;
- la **vida, velocidad, daño y ritmo de ataque de cada enemigo** (a los que ya están en el campo se les
  empareja), y **prender o apagar** un tipo entero sin cambiar la composición de las oleadas;
- **cambiar de campo** (reinicia la partida: el terreno se arma una sola vez);
- botones de prueba: **oleada infinita** (repite la composición de la oleada en curso, no se termina
  nunca), **vida infinita**, **puerta infinita** y **saltar a la oleada 1 a 6**;
- **Copiar configuración**, que deja en el portapapeles todo el balance como texto para pasarlo y
  llevarlo al código.

Los cambios valen desde el tiro siguiente y desde el enemigo siguiente, y **se guardan en el navegador**:
al recargar vuelven. Hace falta porque cambiar de campo recarga la página. El botón *Restaurar* los
borra y devuelve los valores del código.

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