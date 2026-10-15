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
- **Muere** (desde el 15/10) con una animación propia: se retuerce 1.2 s sacudiéndose y largando terrones,
  se desploma hacia adelante como un árbol (0.7 s, con una explosión de tierra y un golpe grave al pegar
  contra el piso) y se hunde despacio (1.6 s), con la garganta que se apaga. Suena la voz de muerte del
  gólem jefe (`audio.death('golem')`, ya grabada: no se tocó audio.ts). La oleada termina recién cuando
  cayó al piso, para que se vea.

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
| `gusano.puerta` | Al asomar apunta a la puerta (una franja naranja) y al meterse le escupe (−1), **salvo que le pegues mientras asoma**, con lo que sea. No se esquiva: hay que anticiparlo cada vez. Desde el 15/10 asoma un 25 % más que las otras (de 2.1 a 1.4 s, en vez de 1.7 a 1.1). |
| `gusano.efimero` | **Fuera del panel desde el 15/10** (sigue andando por la dirección). Como «puesto», pero cada loma baja sola a los 20 s. |
| `gusano.tunel` | **Fuera del panel desde el 15/10** (sigue andando por la dirección). Como «puesto», y además **la tierra que se mueve recibe**: lo que le pegás bajo tierra se lo sacás al gusano. |

## Los números para tocar (arriba de `fight.ts`)

- `TRIP` (lo largo de cada viaje), `FIELD` (por dónde anda), `MOUND_GAP` (cuánto se aleja de las lomas).
- `SPEED` (5 → 8.5 m/s) y `WINDOW` (1.7 → 1.1 s), en `ramp` 120 s.
- `RISE` 0.35 s, `DIVE` 0.45 s, `SHOW_AHEAD` 1.5 s (cuánto antes marca el lugar).
- `HP` 45; `MOUND` (alto 1.5, radios 2.6 × 2.2, tope 10, vida 20 s en «efímero»).
- `SPIT` (a tu puesto: vuela 0.8 s, radio 1.6 m), `GATE_SPIT` (saca 1).

## Lo que dijo Leandro (15/10) y qué se hizo

Jugó las cuatro (`logs/partidas-jefes-leandro.txt`): ganó «puesto», «efímero» y «túnel» en 91–107 s, y
perdió «puerta» (9 a la puerta en 84 s, cortó 9).

- **«Le falta animación al morirse, y no sé si un ruido».** Antes el enemigo se moría como cualquiera (se
  frenaba y se hundía de a poco) y el gusano casi no se movía. Ahora se retuerce, se desploma y se hunde
  (ver «Qué hace»), con terrones, una explosión de tierra al caer y la voz de muerte del gólem jefe.
- **«Cuando levanta tierra, esa tierra tiene color distinto a la del campo, marca un cuadrado alrededor de
  donde sale, y no tiene las líneas de pasto ni de metros».** En el campo liso cada loma llevaba una malla
  propia, cuadrada, pintada con dos verdes fijos y sin la textura del pasto, que además tapaba las rayas de
  distancia. Desde el 15/10 la loma **deforma la malla del campo** también en el liso, como ya pasaba con
  relieve (`World.buildTerrain` guarda siempre la malla; `MoundView` ya no arma la suya): queda con el
  mismo pasto, las franjas de corte y las rayas de metros apoyadas encima. Vale también para las lomas del
  geomante.
- **«`gusano.puerta`: medio difícil de pegarle porque está poco tiempo afuera, pero no digo que esté
  op».** Asoma un 25 % más (`window: 1.25` en `index.ts`).
- **«Gusano efímero no sé qué tiene».** Lo único que cambiaba era que cada loma bajaba sola a los 20 s.
  Jugando no se nota: con el tope de 10 lomas de «puesto» el campo se ve casi igual, y la loma que baja no
  avisa. No valía la pena hacerlo legible (sería otra versión de «puesto» con una regla más): queda fuera
  del panel y del sorteo (`hidden`).
- **«Gusano túnel no me parece que haga falta».** Fuera del panel y del sorteo (`hidden`); el código
  queda.

## Cómo le fue al bot

- 15/10, una partida de «puesto» después de los cambios: perdió por vida (le escupió 2 veces), con el
  gusano a 3 de vida, a los 76 s. En la tanda del 15/10 a la madrugada había ganado 2 de 4 versiones. La
  animación de muerte no la llegó a ver el bot: probarla a mano.

## Lo que se sabe que falta

- Ver en el navegador la muerte y una loma en el campo liso (que no quede ningún borde).
