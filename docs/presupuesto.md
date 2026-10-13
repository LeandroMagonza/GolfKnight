# El presupuesto de las oleadas

13/10/2026, pedido de Leandro: «ahora habría que armar más como un budget, donde no te salgan 3 caballeros
con poder». El código está en `src/core/budget.ts` (el modelo) y en `spawnOrder` de `src/core/waves.ts` (el
reparto); se mide con `node tools/sorteo.mjs`.

## La medida: cuántos tiros te pide cada enemigo

La vida de cada uno, multiplicada por lo que le hace su poder, sobre lo que le saca un golpe que pega. El
jugador de referencia es Leandro en el nivel 10 (11 y 12/10, con su carga nueva): 37.1 tiros por minuto,
87 % que pegan, golpes 1 a 4 en 33, 34, 20 y 13 % (2.13 de daño por golpe que pega).

Los poderes, jugados bien:

| Poder | Multiplica los tiros | Cómo se juega |
|---|---|---|
| Escudo | ×1 | por arriba o de costado (de frente: ×1.9, ×4.6, ×16 según el nivel) |
| Blindaje 1 / 2 | ×1 / ×1.9 | con el driver de lejos o el putter de cerca (con el hierro o el wedge, ×1.9 / ×4.6); trae ¾ y ⅔ de la vida |
| Fantasma | ×2.1 | cada golpe le saca 1 |
| Bendito, escurridizo | ×2 | cada golpe pide antes otro que le rompa la burbuja o lo haga saltar |
| Intocable | ×1.5 | le entra uno por ciclo |
| Se cura | hasta ×2 | hay que matarlo adentro de un ciclo; la cuenta da más, pero contra él se carga más |

Los de 1 y 2 de vida piden menos (×0.6 y ×0.8): caen de paso, con el driver que atraviesa a varios mientras
se le tira a uno más grande (Leandro: «no es lo mismo 3 goblins que un orco»). Es un número para empezar: el
registro de cada partida anota, por cuerpo, cuántos mueren en tiros que agarran a varios (`perKind`), y con
eso se ajusta.

## Las reglas

1. **El tope de un común con poder: 7 tiros.** El poder no cae en uno que se pase. Se acabaron el chamán
   fantasma de 8 de vida (9 tiros), el esqueleto gigante fantasma de 11 y el orco gigante que se cura de 9. La
   marca de los gigantes tampoco agranda a uno con poder si agrandado se pasa.
2. **Lo que pueden sumar los poderes de una oleada**: lo que piden sus cuerpos sin poder, por la parte que
   sale con poder (un tercio con «Más con poder», un cuarto sin él). La cantidad con poder sigue siendo la de
   siempre: el presupuesto es un techo, y corta los casos caros (tres cuerpos grandes con poder en la misma
   oleada). El que presenta el poder sale siempre.
3. **El élite paga de su oleada.** Lo que suma su poder (el fantasma o el bendito, unos 10 a 13 tiros más que
   el del escudo) sale primero de lo de los poderes, a lo sumo la mitad, así los comunes siempre traen algo
   del poder del escenario. Lo que se pase, en cuerpos: salen uno o dos comunes menos, salteados (Leandro: «si
   es fantasma, viene un poco menos del resto»).
4. **Cada marca suma a lo sumo un 10 %** de lo que piden los cuerpos de la oleada: los chicos de la
   estampida (los que entren, repartidos parejo), los gigantes, y los dos de los poderes que no salieron.
   Antes una oleada con dos marcas podía pedir la mitad más.
5. **La curva**: en la oleada del élite, el élite es el tercero del cuerpo fuerte (antes eran tres más el
   élite), y en la 6 viene un chamán en vez de dos. La 6 pedía un tercio más que la 5.

## Antes y ahora

`node tools/sorteo.mjs --veces=2000` con los talentos de Leandro del nivel 10 y los poderes al azar: los
tiros que pide cada oleada, el del medio y entre paréntesis del 5 al 95 % (los números absolutos salen
pesimistas, porque no cuentan las habilidades; sirven para comparar).

| Oleada | Antes | Ahora |
|---|---|---|
| 1 | 35 (28–48) | 35 (28–37) |
| 2 | 45 (38–63) | 46 (38–56) |
| 3 (élite) | 59 (45–82) | 50 (40–53) |
| 4 | 51 (42–67) | 47 (41–52) |
| 5 | 61 (53–76) | 57 (51–64) |
| 6 (élite) | **80** (66–97) | **65** (56–72) |
| 7 | 65 (55–81) | 61 (54–69) |
| 8 | 70 (62–86) | 67 (62–75) |
| 9 (élite) | **86** (70–102) | **73** (63–80) |
| 10 (jefe) | 85 | 84 |

La 6 ya no salta, y la misma oleada varía la mitad que antes entre una partida y otra.

## Las perillas

En `BUDGET` (`src/core/budget.ts`), en el panel B (pestaña de poderes) y con `?ajuste=presupuesto.*`:
`on` (0, el reparto de antes, para comparar), `cap` (el tope), `powers` (lo de los poderes, por la parte
con poder), `marks` (lo de cada marca), `small` (lo que piden los chicos), `regen` (el techo del que se cura) y
el jugador de referencia (`perMin`, `connect`, `mix`).

## Lo que falta

- **Las llegadas repartidas por carga**: hoy cada uno tiene su turno a intervalo fijo, y los gordos de la 9
  salen todos con los primeros goblins porque caminan más lento de lo que dura la oleada: llegan juntos en el
  último tercio. La idea es que los tiempos repartan los tiros que pide la oleada, no la cantidad.
- **Ajustar `small`** con lo que anote el registro de cada cuerpo.
- **El jefe del final**: aparte, con su rework.
