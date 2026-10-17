# Futbolista (17/10)

**Qué pone a prueba:** cortar a tiempo y elegir a quién bajar. Corre entre los enemigos y los patea hacia tu
puerta. Los que patea a 20 m o menos de tu línea van derecho a la puerta (gol). Se lo frena pegándole fuerte
mientras corre o se prepara, o matando al que marcó antes de que llegue.

Lo que pidió Leandro: «un futbolista o algo así. El futbolista va corriendo hacia enemigos del campo y los
patea, lanzándolos para adelante, no tanto como el orco que salen girando, sino que salen con los brazos para
adelante los enemigos, y avanzan una cantidad de metros, quizás dependiente del peso del enemigo, ahí los
enemigos se levantan y siguen caminando. La idea es que su poder es que te avanza la wave, haciéndote que los
enemigos lleguen mucho antes del tiempo que tardarían caminando, y si patea desde el metro 20 en adelante
directamente los tira a la puerta. Fijate el tema del balance. Y como básico me imagino que tiene vida y le
vas pegando».

El código está en `src/game/bosses/futbolista/`: `pelea.ts` es la pelea (los números arriba, con nombre),
`look.ts` el modelo, la pelota y las poses por código, e `index.ts` las versiones. Se prueba con
`?ola=10&jefe=futbolista.goleador` (o `.pesado`, `.chico`), o desde el panel B > Pruebas > Jefes.

## El modelo

- **El futbolista** es el goblin de PolygonDungeon (el de taparrabos) vestido pintándole las caras, como visten
  los del pack: camiseta a bastones celestes y blancos, pantalón negro, medias blancas con una franja celeste,
  botines negros y muñequeras blancas. Mide 2.7 m (el goblin de la horda, 1.25). El modelo sale de
  `tools/boss_futbolista.py` por `retarget_to_glb.py` y queda en `public/models/futbolista.glb` (0.4 MB, con
  el clip «Getting Up»). Correr, caminar y estar quieto los toma de `dungeon.glb` (los huesos se llaman igual).
  Rehacerlo (con rutas absolutas: Blender no encuentra las relativas):

  ```
  node tools/lock.mjs blender -- "S:\blenderProjects\Blender Foundation\Blender 4.4\blender.exe" -b --python tools/retarget_to_glb.py -- S:\unityProyects\GolfKnight\Assets\PolygonDungeon\Models\Characters.fbx S:\unityProyects\GolfKnight\Assets\PolygonDungeon\Textures\Dungeons_Texture_01.png S:\unityProyects\GolfKnight\web\public\models\futbolista.glb --with=boss_futbolista "Getting Up=S:\unityProyects\GolfKnight\web\assets\mixamo\Getting Up.fbx"
  ```

  La vista previa (sin juego): `tools/kit_preview.py -- boss_futbolista logs/futbolista/vista.png`.
- **La pelota** está hecha por código: un icosaedro partido en tercios, con negro alrededor de los doce
  vértices (los pentágonos). La lleva a los pies: adelante cuando corre (gira), al costado cuando patea a otro.
- **La patada** son huesos por código encima de la animación (no hay clip de patada en `assets/mixamo/`):
  carga la pierna derecha atrás con los brazos abiertos, pega con el empeine y la pierna sigue arriba.
  **Clip que convendría bajar de Mixamo:** «Soccer Penalty Kick» (o «Soccer Pass»), «In Place». Si se baja, va a
  `assets/mixamo/` y se suma a la línea de arriba como `"Kick=…"`; después hay que cambiar `kickPose` por
  `playOneShot('Kick')`.
- **Los pateados** vuelan estilo superman (también con huesos por código): se acuestan de panza en el primer
  tramo del vuelo, con los brazos estirados por encima de la cabeza (con el cuerpo acostado quedan hacia
  adelante), las piernas juntas y la cabeza levantada. Caen de panza y patinan 1.6 m (un anillo de polvo),
  se dan vuelta panza arriba y se levantan con «Getting Up» (a 1.5×, 1.8 s), mirando para atrás, y giran
  hacia la puerta como cualquiera. Los bichos que no son humanoides (huargo, araña, limo) vuelan derechos y
  caen parados. Para mejorarlo: un clip de Mixamo de caer de panza y levantarse («Stand Up» desde boca abajo)
  quedaría mejor que darse vuelta de golpe al caer.

## Cómo es

1. **Entra corriendo** desde el fondo y se pone detrás del medio de la horda (6 m detrás, entre 30 y 52 m de la
   puerta). Ahí espera trotando el descanso entre patadas: 2.6 s, 2.0 s y 1.5 s según la fase.
2. **Elige a uno** de la horda que camina (no los que se plantan: chamán, abanderada, hechicero, geomante; ni
   los que ya vuelan). Con `gol` elige el que más le conviene: si llega a patearlo dentro de los 20 m, vale
   1.5 por lo que le sacaría a la puerta; si no, lo que avanza (los segundos de caminata que se ahorra). Todo
   dividido por lo que tarda en llegar. No va por los que llegan a tu línea antes que él, ni por los que ya
   están a menos de 4 m.
3. **Corre a buscarlo** (6.2, 7 y 7.8 m/s), a ponerse detrás de él en la línea de la patada. Se lee desde la
   cámara alta: un **anillo amarillo** en el marcado, un **carril amarillo** fino de él al marcado, y un
   **carril naranja** de lo que va a volar con un **disco naranja** donde cae. Si es gol, el carril y el anillo son
   **rojos** hasta la puerta.
4. **Carga la patada** pegado detrás del marcado (que sigue caminando: lo acompaña): 1, 0.85 y 0.72 s según la
   fase, y 0.6 s más si patea al arco. El anillo se pone naranja y late más rápido.
5. **Patea.** Cuánto vuela depende del tamaño: el goblin 18 m, el lagarto y el esqueleto 15, el orco 14, el
   chamán 13.6, el jefe goblin 12, el huargo 12, el caballero, el gólem chico, el ogro y el minotauro 7
   (`KICK`). Nunca cae a menos de 3 m de tu línea. **Si estaba a 20 m o menos de tu línea, va directo a la
   puerta** y le saca lo que le sacaría al llegar (goblin 1, orco 2, caballero 3, élite 2): «¡Gol!».
6. **Sin nadie a quien patear** (cuando se terminó la escolta, o no le sirve ninguno) patea **su pelota** a la
   puerta: se acomoda 0.9 s mirando a la puerta (carril rojo) y la pelota rueda a 7.5 m/s. Es un enemigo de 1
   de vida: cualquier golpe la para. Si llega, saca 1. Lo hace cada 2.4, 2 y 1.6 s. Es lo que hace que no se
   lo pueda ignorar: mientras viva, puede romperte la puerta entera.
7. **Las fases** suben al sacarle un tercio de la vida o a los 50 y 100 s: corre más rápido, carga más rápido,
   descansa menos y aguanta más.

**Lo que dice la barra de arriba:** la vida, y abajo qué está por hacer («Va a patear a uno», «¡Va a patear al
arco!», «¡Pelotazo a la puerta!»), con «Cortalo» y **el aguante en puntos** (●●○).

## El contrajuego

- **Cortarle la patada.** Cada intento (desde que sale a correr hasta que patea) tiene un aguante: 2, 3 y 4
  puntos según la fase. Un golpe fuerte (golpe 2 o 3 de palo, o lo que le saque 3 o más) le baja 2; uno flojo
  (golpe 1, las habilidades), 1, y además lo demora 0.3 s. Sin aguante, «¡Falta! Le cortaste la patada»:
  trastabilla 0.8 s y vuelve a su lugar a descansar. En la primera fase alcanza un golpe fuerte; en la última
  hacen falta dos. Vale para el pelotazo también.
- **Matar al marcado** antes de que llegue: «¡Le sacaste al marcado!» y vuelve a su lugar (0.7 s).
- **Bajar a los que vuelan o se levantan:** son enemigos de verdad todo el tiempo (en el aire y en el piso).
  El que cae cerca de tu línea queda 1.8 s levantándose: un blanco quieto.
- **Pegarle mientras descansa:** tiene vida (90 más 3 por nivel de dificultad y el talento de vida del jefe) y
  le entra todo, siempre.

El balance es la decisión entre cortarlo (gastar tiros en él) y limpiar la horda, y que dejarlo patear no es
gratis: adelanta la horda o hace gol.

## Las versiones

### `futbolista.goleador` — el que más le conviene

Lo de arriba. Vida 90.

### `futbolista.pesado` — va por los grandes

Elige por lo que le sacan a la puerta (el doble si es gol) y la vida: caballeros, ogros, minotauros, jefes
goblin. Vuelan poco (7 m), pero el gol de un caballero saca 3. Descansa un 30 % más. Pide bajar a los grandes
antes de que entren a los 20 m. Vida 90.

### `futbolista.chico` — los livianos, seguido y lejos

Solo patea a los chicos (sin los pesados ni los de más de 0.62 m de radio: goblins, goblinas, lagartos,
huargos, orcos, esqueletos), vuelan un 15 % más y descansa un 20 % menos. Mucho avance de horda, pocos goles
grandes. Vida 85.

## El bot

Lo que sabe del jefe (`weight`): al futbolista mientras corre, carga o va a patear la pelota, 3 (cortarlo); si
no, 1.2. Al marcado, 2.5. A la pelota del pelotazo, 3. A los que vuelan o se levantan, 1.6.

**Las corridas del 17/10** (el bot «humano», desde la oleada 10, `logs/futbolista/bot*.jsonl`):

| Corrida | Resultado | Lo que se ve |
|---|---|---|
| 1 (`goleador`, sin aguante y aturdido 1.8 s) | ganó en 55 s, perdió 2 | 9 cortadas, 1 patada: demasiado fácil |
| 2 (`goleador`, aguante 3/4/5) | ganó en 110 s, perdió 5 | 6 patadas, 1 gol, 13 pelotazos (10 parados) |
| 3 (una cada versión, aguante 3/4/5 y menos descanso) | 1 de 3 | `goleador` perdió la puerta en 43 s (3 goles: 7 de puerta), `chico` también (93 m de avance) |
| 4 (**los números de ahora**, dos cada versión) | **4 de 6** | `goleador` 1 de 2 (perdió 9 de puerta en promedio), `pesado` 2 de 2 (perdió 6.5), `chico` 1 de 2 (la que perdió fue por la vida del golfista) |

En la 4: entre 4 y 8 patadas cortadas por partida, 5 a 8 patadas, 48 a 131 m de horda adelantada, 0 a 2 goles,
y el rato a solas (pelotazos) de 30 a 50 s. Es de los difíciles para el bot (el gólem de siempre: 4 de 4
perdiendo 2), pero se gana.

## Lo que queda para decidir

- **Cuánto saca el gol.** Hoy lo que el pateado sacaría al llegar («como si llegara»): el gol de un caballero
  es 3. Si queda muy duro, se puede topar en 2.
- **El aguante**: si Leandro siente que un golpe fuerte debería cortar siempre (como dijo del contrajuego), es
  `CUT.guard` en 2, 2, 2. Con aguante 1 (sin puntos) el bot lo anulaba del todo.
- **La pelota del pelotazo** es un enemigo con el cuerpo de la araña gigante (los números): se queja y suena
  como la araña al morir (no hay sonido de pelota). Un sonido propio de pelotazo estaría mejor.
- **Las versiones**: `goleador` es la completa; `pesado` y `chico` cambian a quién elige y el ritmo. Si una
  queda, las otras se pueden sacar.
- No lo jugó Leandro todavía: falta ver si se lee bien desde la cámara (el anillo, los carriles) y si la
  patada por código convence (fotos en `logs/futbolista/s1.png`, `s2.png`, `s3.png`).
