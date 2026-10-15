# El Gusano de las cavernas (14/10)

**Qué pone a prueba: anticipar.** Tirar adonde va a asomar, antes de que asome. Solo recibe asomado, y
asoma poco: el que espera a verlo para cargar llega tarde.

Código: `src/game/bosses/gusano/` (`fight.ts` la pelea, `look.ts` los modelos, `index.ts` las versiones).
Probar: `?ola=10&jefe=gusano.puesto` (o el panel B > Pruebas > Jefes).

## Qué hace

- **Va bajo tierra.** Se ve la tierra que se mueve (un lomo de tierra con piedras que saltan) y el surco
  de terrones que deja atrás, en línea recta. Cada viaje es de 10 a 16 m, siempre entre los 9 y los 43 m
  de los puestos (z 18 a 52), y busca no salir encima de una loma.
- **Avisa dónde sale:** 1.5 s antes de llegar, el piso marca el lugar con un anillo naranja que se va
  cerrando y latiendo más rápido.
- **Asoma** (sale en 0.35 s, con una explosión de tierra) y se queda **1.7 s** al principio, **1.1 s** a
  los dos minutos, con un anillo a su alrededor que se cierra (amarillo y rojo al final). **Solo recibe
  mientras asoma** (desde la mitad de la salida hasta la mitad de la metida). Bajo tierra no es un
  enemigo: no se le puede pegar, y el bot no le apunta.
- **Tira** al meterse (según la versión, ver abajo) y **se mete dejando una loma** en el agujero (1.5 m de
  alto, como la del geomante pero un poco más chica): tapa al driver. Quedan hasta 10; la que pasa del
  tope, la más vieja, baja.
- **Cada vez más rápido:** bajo tierra va de 5 a 8.5 m/s en los primeros dos minutos, y asoma menos.
- **Vida:** 45 (+2 por nivel), en la barra de arriba, que dice además si está bajo tierra o asomado.

## Cómo se le gana

- **El wedge** tarda en caer (0.6 s de carga más casi 2 s de vuelo): se tira **mientras la tierra viene**,
  adonde apunta el surco, para que caiga justo cuando asoma. Su área (4–5 m) perdona errar el lugar por
  poco, pero no el momento.
- **El hierro** (1 s de vuelo, pasa por arriba de las lomas) se suelta cuando aparece el anillo naranja.
- **El driver** llega casi en el acto, pero hay que tenerlo **cargado de antes** y soltarlo cuando asoma; y
  a medida que el campo se llena de lomas, cada vez hay menos líneas libres.
- **El putter**, si sale cerca (a menos de 20 m).

## Las versiones

| Id | Qué cambia |
| --- | --- |
| `gusano.puesto` | Al asomar te marca el puesto (verde) y al meterse te escupe ahí: **corréte**. Pegarle no lo frena. Las lomas quedan. |
| `gusano.puerta` | Al asomar apunta a la puerta (una franja naranja) y al meterse le escupe (−1), **salvo que le pegues mientras asoma**, con lo que sea. No se esquiva: hay que anticiparlo cada vez. |
| `gusano.efimero` | Como «puesto», pero cada loma baja sola a los 20 s: el campo se llena menos. |
| `gusano.tunel` | Como «puesto», y además **la tierra que se mueve recibe**: lo que le pegás bajo tierra se lo sacás al gusano. Un blanco que corre: hierro o putter adelantados, o un globo adonde va a pasar. |

## Los números para tocar (arriba de `fight.ts`)

- `TRIP` (lo largo de cada viaje), `FIELD` (por dónde anda), `MOUND_GAP` (cuánto se aleja de las lomas).
- `SPEED` (5 → 8.5 m/s) y `WINDOW` (1.7 → 1.1 s), en `ramp` 120 s.
- `RISE` 0.35 s, `DIVE` 0.45 s, `SHOW_AHEAD` 1.5 s (cuánto antes marca el lugar).
- `HP` 45; `MOUND` (alto 1.5, radios 2.6 × 2.2, tope 10, vida 20 s en «efímero»).
- `SPIT` (a tu puesto: vuela 0.8 s, radio 1.6 m), `GATE_SPIT` (saca 1).

## Cómo le fue al bot

(se completa abajo)

## Lo que se sabe que falta

(se completa abajo)
