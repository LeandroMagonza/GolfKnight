# Jefes del último escenario (14/10)

El jefe de hoy (el gólem de roca que tira piedras a la puerta) es una prueba de DPS con un reloj que es tu
vida: nada de lo que hace se puede evitar, así que la pelea se decide antes de empezar. Si llegás con 1 de
vida, ni jugando perfecto se le gana, salvo matándolo antes de la primera piedra.

Lo que se le pide a cada jefe nuevo:

- **Todo lo que pega se puede evitar jugando bien.** Llegar con 1 de vida es tenso, no una derrota segura.
- **Se gana con los cuatro palos.** Las cartas ayudan, pero no son necesarias.
- **La presión sube sola** (acelera, fases): una carrera contra su ritmo, no contra tu vida.
- **Se lee desde la cámara alta:** marcas en el piso, brillos, avisos con tiempo.
- **No camina derecho a la puerta.** Para eso está el resto de la horda.
- **Cada jefe lleva al extremo una habilidad del jugador** (abajo), para que cada uno pida algo distinto.
- **Mientras está vivo, puede romperte la puerta entera** (Leandro, 15/10: «si el limo te hace solo 8 de
  daño, y vos mataste al resto de la ola con por lo menos 9, podés ignorarlo y ganar igual. Para mí los
  jefes tienen que tener potencial de romperte toda la puerta mientras están vivos»). Nada de topes: su
  presión sobre la puerta sigue mientras viva, y la pelea no termina sin matarlo (o sin cumplir lo que
  pide su versión). Ignorarlo nunca puede ser la jugada.

## Qué habilidad del jugador pone a prueba cada uno

| Habilidad | Qué se le pide | Jefe |
|---|---|---|
| Repartir atención | varios relojes a la vez | Gólem de las piedras |
| Cortar una carga | bajarle puntos a tiempo, desviarlo | Minotauro |
| Palo según trayectoria | el globo no se puede batear | Ogro bateador |
| Priorizar dentro de la ola | a quién primero | Espectro hechicero |
| Dónde y cuándo matar | no matar a los marcados, o matar juntos | Nigromante |
| Timing de la barra | leerle la carga al rival | Caballero negro |
| Espacio en la línea | puestos trabados, huevos que nacen | Araña reina |
| Área contra muchos chicos, y la línea | se divide, escupe a los puestos | Limo |
| Interceptar | bajar lo que vuela | Lagarto lancero |
| Ráfaga contra presión constante | blindaje que baja solo; se cura si no le pegás | Jefes de ritmo |
| Tempo (flojo ya o fuerte después) | cerrar el muñón en 2 s | Hidra |
| Anticipar | tirar adonde va a asomar | Gusano |
| Pelotas | qué pelota usar antes de que la roben | Rey goblin ladrón |
| Distancia exacta | el globo en la plataforma | Torre de asedio |
| Ritmo (soltar en el beat) | todo tiro fuera del beat de su canción sale pifia | Bardo del metal, Ogro tamborilero |
| Elegir y cambiar de palo | lo que sale del piso y lo sellado pide un palo; a él, el que canta | El Caddie |
| Pegarle a lo que vuela, y cuándo | solo el hierro y el wedge le llegan; pegarle mientras trae enemigos o carga el fuego se lo corta | Dragón |
| Cortar a tiempo y a quién bajar | patea a la horda hacia la puerta (a 20 m, gol): golpes fuertes mientras corre, o matar al marcado | Futbolista |

Cada familia tiene su doc en `docs/jefes/<familia>.md`, con lo que hace cada versión y cómo le fue al bot.

## Cómo probarlos

- **Panel B > Pruebas > Jefes:** un botón por jefe. Arranca en la última oleada con ese jefe (antes, las
  cartas de las oleadas salteadas). «Con el bot» lo juega el bot. «En las partidas» elige el jefe de las
  partidas normales en este navegador: el de siempre, uno nuevo al azar, o uno fijo.
- **Por la dirección:** `?ola=10&jefe=<id>` (con `&bot=humano`, lo juega el bot).
- **Fotos:** `node tools/lock.mjs navegador -- node tools/jefe-fotos.mjs <id> 2 6 12 20` (con la placa de
  video, vida y puerta infinitas, el bot jugando; `--sinbot`, `--mortal`, `--tope=S`).
- **El bot contra el jefe:** `node tools/lock.mjs navegador -- node tools/bot-tanda.mjs --vivo --juegos=3
  --velocidad=8 --url="ola=10&jefe=<id>"`. Cada partida dice cómo terminó y los números del jefe (`log`).
- **El registro de la partida** anota qué jefe salió (`boss`, `clasico` si fue el de siempre) y sus números
  (`bossLog`).

## Cómo se arma un jefe (para quien programa)

Cada familia vive en `src/game/bosses/<familia>/index.ts`, que exporta `BOSSES: BossDef[]`, una por versión
(ids `familia.version`). El juego carga solo el que toca (`registry.ts`, import dinámico): un jefe a medio
hacer no rompe al resto. El ejemplo completo está en `src/game/bosses/ejemplo/index.ts` (`?jefe=ejemplo`).

- **`BossDef`** (`types.ts`): `id`, `name` (con `L('…', '…')`: lo ve el jugador), `blurb` (para el panel),
  `models` (GLB propios de public/models, se cargan al empezar), `escort(wave)` (cambiar la escolta de la
  última oleada, que llega sin el gólem de siempre) y `start(ctx) → BossFight`.
- **`BossFight`**: `update(dt)` cada cuadro de juego; `done` (ganado: la oleada termina cuando esto es true
  y no queda nadie vivo); `blocks(from, to)` (puestos trabados, regla del juego); `bot` (lo que el bot
  necesita: `danger(x, within)` y `weight(e)`); `log()` (sus números); `dispose()`.
- **`BossCtx`**: la escena, la horda, el golfista, los puestos, las pelotas, los efectos, el sonido,
  dungeon.glb y los modelos propios, `hitGate`, `hitPlayer`, `banner`, `feedback`, `spots()`, `rng`,
  `level` (dificultad), `bonusHp`, `clock()`, `over()`.
- **Las partes del jefe son enemigos de verdad** (`horde.spawnCustom(stats, look, x, z, mods, script)`): las
  pelotas, las habilidades, los escudos y el bot las ven como a cualquiera. `stats` sale de
  `partStats(tipo, { vida, altura, radio, boss... })`; `look` es un tipo ya registrado (`'stoneling'`,
  `'ogre'`...) o una plantilla propia (`horde.addLook(clave, objeto, clips, malla)`). El guion
  (`EnemyScript`): `update(e, dt)` (true = lo mueve el guion), `filter(e, daño, tiro)` (cuánto le entra),
  `onDamage`, `onDeath`.
- **En el enemigo, para los guiones:** `walkToward`, `faceToward`, `heading`, `body` (el modelo),
  `animator` (los clips), `scriptGesture` y `scriptSwing` (el golpe de brazo por código), `setHp`,
  `stunFor`, `stunned`, `remove`, `knock`.
- **Kit** (`kit.ts`): las medidas del campo (`TEE_Z` 9, `GATE_Z` 0, `SPAWN_Z` 68, `FIELD_HALF_WIDTH` 18,
  `heightAt`), `partStats`, `flatMat`, `facet` y `rockLook` (modelos facetados por código), `GroundMark` y
  `LaneMark` (marcas en el piso), `BossBar` (la barra grande de arriba), `arcPoint`, `touchesPlayer`,
  `nearestSpot`, `disposeObject`.
- **El golfista**: `player.pin(s)` (no cambia de puesto), `Player.blockStep` (lo maneja `blocks`), `hit`.
- **Los textos que ve el jugador** van con `L('español', 'english')`; el test de traducciones lo exige. Los
  que no ve (el `blurb` del panel, registros, avisos de consola) llevan al final de la línea un comentario
  `// i18n-ok: por qué`.

**Turnos:** todo lo que abre un navegador o Blender va con `node tools/lock.mjs navegador -- …` (o
`blender`): la compu no aguanta dos a la vez.

## Primera tanda del bot (15/10)

Los agentes se cortaron el 14/10 a la noche (se acabaron los tokens) cuando estaban probando: el código de
las 62 versiones quedó escrito y anda (ningún error en la tanda), pero varios docs de `docs/jefes/` tienen
«pendiente» en lo del bot. Esta tanda lo cubre por arriba: el bot «humano», una partida por versión desde la
oleada 10 (con las cartas de las anteriores), `node tools/jefes-tanda.mjs`. **Una sola partida cada una:**
sirve para ver qué está muy fácil o muy difícil, no para afinar números.

**Para comparar, el gólem de siempre:** el bot le ganó 4 de 4, perdiendo 2 de puerta en promedio.

| Familia | Ganó | Lo que se ve |
|---|---|---|
| Araña | 0 de 4 | la puerta cae entre 36 y 115 s: muy difícil para el bot (¿los huevos?) |
| Caballero negro | 3 de 5 | pierde en `fuerte` y `atajable` |
| Espectro | 4 de 4 | tres sin perder puerta: fácil |
| Gólem de las piedras | 1 de 4 | solo gana `trio`; las piedras le ganan |
| Gusano | 2 de 4 | `efimero` lo mata a él (vida 0) |
| Hidra | 4 de 4 | |
| Lagarto | 1 de 5 | solo gana `doble`: las lanzas a la puerta le ganan |
| Limo | 5 de 5 | |
| Minotauro | 2 de 4 | pierde en `carga` y `brutal` (`brutal` es la dura a propósito) |
| Nigromante | 4 de 4 | |
| Ogro | 4 de 4 | |
| Rey ladrón | 4 de 4 | peleas cortas (50–70 s): fácil |
| Ritmo | 5 de 8 | pierde en `pareja` y `pulso`; `doble` no terminó en 6 minutos |
| Torre | 1 de 3 | pierde en `muralla` y `casco` |

Las partidas, una por línea, en `logs/tandas/jefes-2026-10-15-02-12.jsonl`.

## La regla de la puerta, familia por familia (15/10)

Revisado contra «mientras está vivo, puede romperte la puerta entera» (sin `bardo`, que estaba en obra):

- **Limo: no la cumplía, arreglado.** El que llegaba a la puerta sacaba un poco (8 el grande) y la pelea
  terminaba sin matarlo. Ahora cualquier limo que llega a la puerta **la rompe entera** (cartel al empezar,
  y en la línea espera unos segundos con un disco rojo que se llena). `limo.escupe` paraba a media cancha
  y solo escupía al puesto: ahora su franja se acerca sin tope y, si no lo matás, cruza.
- **La cumplen** (la pelea termina solo matándolo y su presión sobre la puerta no tiene techo): gólem
  (piedras), araña (arañitas de los huevos), caballero (`puerta`, `fuerte`, `atajable`, `devuelve`),
  lagarto (lanzas), minotauro (embestidas: media puerta cada una, toda en `brutal`), nigromante (alza
  esqueletos mientras viva), ogro (piedras o bateados a la puerta), el resto de ritmo (lanzas o goblins), hidra
  (escupitajos a la puerta), `gusano.puerta`, `rey.puerta`, torre (si llega a la línea larga goblins sin
  parar).
- **Ritmo: `coraza-escolta` no la cumplía a solas, arreglado.** Castigaba repartiendo blindaje a la escolta,
  y sin escolta no hacía nada. Ahora, si no hay a quién, tira la lanza a la puerta.
- **Espectro:** no tiene vida que bajar; su presión son los élites que hace, y un élite que entra tira la
  puerta. En `ola` y `eterno` la pelea termina con la oleada, pero mientras quede escolta puede hacer
  élites: no se lo puede ignorar. No se tocó.
- **Para que decida Leandro (no se tocaron):** `caballero.puesto`, `rey.lanza`, `rey.gloton`,
  `rey.palanquin` y `gusano.puesto` le tiran solo **a vos**, nunca a la puerta. No se los puede ignorar para
  ganar (la oleada no termina sin matarlos, y te pueden matar), pero no rompen la puerta. Para cumplir la
  regla al pie de la letra habría que darles algo contra la puerta: es un cambio de diseño, no un número.

## Segunda tanda del bot (15/10, después del feedback de Leandro)

La misma tanda que la primera (una partida por versión, el bot «humano», tope de 4 minutos), después de los
cambios del 15/10. Ningún error de la página en ninguna versión, y `ritmo.doble` ahora termina.

| Familia | Ganó | Perdió en |
|---|---|---|
| Araña | 0 de 4 | todas (sin cambios: sigue difícil para el bot) |
| Bardo (nuevo) | 2 de 2 | |
| Caballero negro | 3 de 5 | `puerta`, `devuelve` |
| Espectro | 4 de 5 | `ola` |
| Gólem de las piedras | 2 de 4 | `crece`, `ventana` |
| Gusano | 4 de 4 | |
| Hidra | 3 de 4 | `siempre` |
| Lagarto | 1 de 5 | todas menos `pasos` (el bot no se para a devolver lanzas) |
| Limo | 5 de 5 | |
| Minotauro | 3 de 5 | `billar`, `coraza` |
| Nigromante | 4 de 4 | |
| Ogro | 3 de 4 | `batea` |
| Rey ladrón | 4 de 4 | (peleas más largas: 58–157 s, antes 50–70) |
| Ritmo | 8 de 9 | `pulso-escolta` |
| Torre | 1 de 3 | `arqueros`, `muralla` (el bot no tira globos a la plataforma) |

El bot no juega como una persona en lagarto, torre y araña: ahí manda lo que diga Leandro jugando.
