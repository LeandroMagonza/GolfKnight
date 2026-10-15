# El Nigromante (14/10)

**Qué pone a prueba: dónde y cuándo matar.** No alcanza con matar rápido: hay que elegir a quién, dónde
cae y en qué momento.

Va al fondo de la cancha, parado en unas andas que cargan cuatro esqueletos, y anda de costado de una
punta a la otra (a 40-47 m de los puestos: la banda larga del driver). No pega nunca: lo que lastima es
la horda que él trae de vuelta. **Cualquier pelotazo a cualquier parte de las andas (la tabla, él, los
porteadores) le baja la vida a él.** Cuando muere se apagan sus marcas, las tumbas que estaban por salir
se deshacen, y queda la horda que haya en la cancha.

Se prueba con `?ola=10&jefe=nigromante.<versión>` o en el panel B > Pruebas > Jefes.

## Lo común a todas las versiones

- **El cuerpo**: un modelo propio, `public/models/nigromante.glb` (0.7 MB): el mago de la cinemática de
  negro y violeta con ribetes verdes, con la calavera y las manos de hueso del esqueleto esclavo del pack, y
  una capucha. Lo arma `tools/boss_nigromante.py` (usa las piezas de `synty_mage.py`). Clips: Idle,
  Walking, Hard Landing (morir y caerse), Pointing (marcar) y Rallying (alzar muertos). El bastón, las
  andas y las llamas son de código (`src/game/bosses/nigromante/litter.ts`). Los porteadores son el
  esqueleto esclavo de `dungeon.glb`.
- **Él gira en la tabla para mirarte**, aunque las andas vayan de costado. Cuando conjura se queda
  quieto, levanta el bastón y sale un rayo verde hasta el elegido: medio segundo de aviso de a quién va.
- **La tumba**: donde va a volver alguien queda un disco verde que late, con un anillo que se cierra
  hacia el centro (lo que falta) y la llama con la calavera arriba. Al cerrarse, el que estaba sale del
  piso en 0.7 s.
- **Los que vuelven salen verdosos** y no se los vuelve a marcar ni a encadenar: vuelven una sola vez.
- **Alza muertos**: si en la cancha quedan menos de 4 (y pasaron 20 s), cada 9 s levanta los brazos y
  saca 2 esqueletos (3 cuando le queda poca vida) entre él y vos, con su tumba 1.8 s antes. Así nunca se
  queda sin a quién marcar cuando la escolta se termina.
- **La escolta**: la última oleada sin el gólem, con un 70 % más de cada cuerpo (menos el alma en pena)
  y saliendo cada 2.5 s en vez de 1.75: unos 32 enemigos durante un minuto y medio.
- **Se apura solo**: cuanto menos vida le queda, más seguido marca (de 3 a 2 s), más rápido vuelven los
  muertos (de 3 a 2.2 s) y más rápido lo llevan de una punta a la otra.
- **La barra de arriba** dice su vida y cuántos marcados (o cadenas) tiene.
- **Las cartas que sirven**: el **hoyo** se traga a un marcado y no vuelve; el **silenciador** le apaga la
  marca; el wedge y el hierro (y el viento que junta) para las cadenas.

## Las versiones

### `nigromante.marcas` — la de Leandro

Cada 3 s marca a uno: una llama verde con una calavera arriba de la cabeza y un anillo verde a los pies.
**Primero al que le estás pegando** (le pegaste en los últimos 4 s y sigue vivo); si no, al de más vida,
y entre esos al más cerca. Hasta 5 a la vez (4 con dificultad baja, menos de 3): al marcar uno más,
**suelta al más viejo**, que titila mientras es el próximo en soltarse. No marca a los que están a menos
de 7 m de la línea, ni a los kamikazes.

**Si matás a un marcado, vuelve entero a los 3 s, donde cayó**, el mismo cuerpo con los mismos poderes.

Cómo se le gana: terminar de un golpe lo que se empieza (lo que dejás herido lo marca), dejar venir a
los marcados grandes y lentos hasta que los suelte, y a los chicos que no dan tiempo matarlos **lejos**:
el que vuelve, vuelve lejos. Matar a un marcado cerca de la línea es tenerlo de nuevo encima a los 3 s.
Y de paso, pegarle a él con el driver sin que la fila pase por un marcado.

### `nigromante.huesos` — vuelve como esqueleto

Igual, pero el marcado que matás vuelve como **esqueleto** (4 de vida, lento), sea lo que sea. Cambia la
cuenta: matar a un goblin marcado (1 de vida) te deja un esqueleto de 4; matar a un caballero marcado (8)
te deja uno de 4. Los marcados chicos conviene dejarlos, los grandes conviene matarlos.

**15/10:** a Leandro le pareció fuerte («mataba a uno de lv bajo cerca y después spawneaba de lv 4 y me
costaba matarlo, perdí por la puerta»), pero con contrajuego: no se tocó la regla. Lo que se agregó es que **se
lea antes qué va a salir**: arriba de la llama de cada marcado y de cada tumba va un cartelito con una calavera,
una flecha y los 4 cuadraditos verdes de vida del esqueleto. Con **borde rojo** si el marcado tiene menos de 4
(matarlo te deja algo más fuerte), con borde verde si no (`drawBonesTag` en `fx.ts`).

### `nigromante.cadenas` — matar juntos

En vez de marcar, cada 5 s (3.5 casi muerto) **encadena de a 2 o 3 que van cerca** (a menos de 5.5 m),
hasta 3 cadenas: una cadena de luz verde entre ellos y un anillo a los pies de cada uno.

**La regla (desde el 15/10): mientras quede uno del grupo en pie, el que cae vuelve.** Leandro: «el grupo
solo revivía al primero, una vez que matabas a uno y se ponía a revivir el resto podían morir sin revivir;
probaría cambiarlo para que cuando hay un grupo tengan que estar muertos los 3 para que no revivan, eso te
fuerza a matarlos más en área o pegarle a los que más vida tienen antes para poder matarlos a la vez». Y:
«tiene counterplay y me parece que está bueno por ese lado, te hace jugar distinto».

- El que cae deja su tumba (el disco verde con el anillo que se cierra: 2.6 s, 2 s casi muerto). **La cadena
  no se suelta**: sigue atada desde los vivos hasta la tumba, gruesa y titilando, y los anillos de los que
  quedan titilan también.
- Si al cerrarse la tumba queda alguno del grupo en pie, **el caído vuelve y vuelve a la cadena** (con su
  anillo; «¡Volvió! Quedaba uno del grupo en pie»). Puede volver todas las veces que haga falta.
- Si en algún momento **están todos caídos a la vez** (o sea, murieron todos dentro de la ventana), la cadena
  se rompe: no vuelve nadie, y a él le sacás 4 (de a 2) o 6 (de a 3), con un rayo de vuelta hasta el bastón.
- El que pasa la línea se suelta del grupo; si queda uno solo, la cadena se suelta y el caído que esperaba
  vuelve igual (suelto). El que se traga el hoyo cuenta como caído para siempre.

Pide áreas (hierro, wedge, el viento que junta) y alinear el driver corriéndose cargando: tres en fila
caen de un tiro. Con un grande en la cadena, primero se lo baja sin matarlo y después se los liquida
juntos. Ya no sirve matarlos de a uno: los primeros vuelven mientras el último siga en pie.

### `nigromante.porteadores` — voltearlo

Como `marcas`, pero **los cuatro porteadores son enemigos aparte** (4 de vida cada uno, pesados). Al
pegarle a un porteador le pegás a él solo, no al nigromante (las andas, para las pelotas, son solo la
tabla). Cada porteador que cae hace las andas más lentas y la tabla se ladea para ese lado. **Con dos
caídos se le caen las andas**: 5 s en el piso, sin marcar ni moverse, y **cada golpe le saca uno más**.
Después se levanta, alza a los porteadores caídos y sigue.

Agrega el «cuándo» de una ventana: voltearlo cuando tenés pelotas a mano para aprovechar los 5 s.

## Los números (en `src/game/bosses/nigromante/fight.ts`, arriba de todo)

| Qué | Cuánto | Constante |
|---|---|---|
| Vida | 40 + 2 por nivel de dificultad + el golpe 4 | `NECRO_HP`, `NECRO_HP_PER_LEVEL` |
| Dónde anda | entra a z 55, va y viene entre z 49 y 56, x de 4 a 11 a cada lado | `ENTER_Z`, `PATROL_Z`, `PATROL_X` |
| Velocidad | 1 a 1.7 m/s según la vida que le queda; 1.6 s quieto en cada punta | `PATROL_SPEED`, `PATROL_PAUSE` |
| Marcas | cada 3 a 2 s, hasta 5 (4 con nivel < 3) | `MARK_EVERY`, `MAX_MARKS`, `MAX_MARKS_EASY` |
| Aviso del rayo | 0.45 s levantando el bastón + 0.32 s de viaje | `CAST_WINDUP`, `BEAM_TRAVEL` (fx.ts) |
| «Al que le pegás» | le pegaste hace menos de 4 s | `HIT_MEMORY` |
| Vuelve a los | 3 a 2.2 s | `REVIVE_DELAY` |
| Alza muertos | con menos de 4 en la cancha, cada 9 s, 2 o 3 | `RAISE_BELOW`, `RAISE_EVERY`, `RAISE_COUNT` |
| Escolta | ×1.7, cada 2.5 s | `ESCORT_MORE`, `ESCORT_INTERVAL` |
| Cadenas | cada 5 a 3.5 s, hasta 3, a 5.5 m; el caído vuelve a los 2.6 a 2 s si queda alguno en pie; rompe 4 o 6 | `CHAIN_EVERY`, `MAX_CHAINS`, `CHAIN_REACH`, `CHAIN_WINDOW`, `CHAIN_DAMAGE` |
| Porteadores | 4 de vida; caen con 2; 5 s en el piso, +1 por golpe | `BEARER_HP`, `DROP_AT`, `DROP_TIME`, `DROP_BONUS` |

## Cómo le fue al bot

- **Primera tanda (15/10, una partida por versión):** ganó las cuatro.
- **`cadenas` con la regla nueva (15/10, una partida):** ganó en 90 s perdiendo 3 de puerta: 2 cadenas, las 2
  rotas, 1 encadenado que volvió porque quedaba otro en pie. El bot, cuando hay uno caído, va con todo por los
  que quedan de esa cadena (`weight` 6).

## Lo que se sabe que falta o puede fallar

(ver abajo)
