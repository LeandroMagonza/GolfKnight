# La Hidra (14/10)

**Qué pone a prueba: el tempo.** Un tiro flojo ya, o uno fuerte después. Cortarle una cabeza pide pegar
fuerte; quemar el muñón y frenar un escupitajo piden pegar *ya*, con lo que sea.

Código: `src/game/bosses/hidra/` (`fight.ts` la pelea, `look.ts` los modelos, `index.ts` las versiones).
Probar: `?ola=10&jefe=hidra.clasica` (o el panel B > Pruebas > Jefes).

## Qué hace

- **Entra y se planta.** Aparece al fondo, camina hasta unos 24 m de los puestos (z 33) y se queda. Cada 16 s
  se corre de costado (entre x −8 y 8), despacio: no se queda en un lugar ni va a la puerta.
- **Tres cabezas en cuellos largos**, cada una con su vida (5; +1 cada 4 niveles), en **cinco cuellos**
  como mucho (eran siete). Desde el 15/10 van **abiertas, a unos 4.5 m una de otra**, y de dos alturas:
  - los cuellos **bajos** (el del medio y los de las puntas) llevan la cabeza casi en el piso (a 1.25 m),
    más adelante (a unos 18 m de los puestos): el **driver** rasante se lee que les llega;
  - los **altos** (los dos de entre medio), con la cabeza a 3.4 m, un poco más atrás (a unos 20 m).
  Empieza con la baja del medio y las dos altas. Un wedge agarra una, o dos si cae justo entre dos: ya no
  todas. (Las pelotas les pegan a toda la columna debajo de la cabeza, alta o baja: el driver también le
  llega a las altas, pero ahora se ve que puede.)
- **Escupen**, de a una, cada vez más seguido (de 3.2 s entre ataques a 1.8 s en dos minutos y medio, y
  más seguido cuantas más cabezas tenga):
  - **A tu puesto** (verde): la cabeza se echa atrás con la boca verde y el piso de tu puesto se marca
    verde. Avisa 1.2 s y vuela 0.85 s: **corréte un puesto**.
  - **A la puerta** (naranja, uno de cada tres; desde el minuto y diez, uno de cada dos): la cabeza se
    levanta más, la boca brilla naranja y una franja naranja va de ella a la puerta. Avisa 2.4 s. **No se
    esquiva: se corta pegándole a esa cabeza mientras carga, con cualquier golpe** (el golpe 1 alcanza).
    Si llega, la puerta pierde 1.
  - Cualquier golpe a una cabeza que está cargando le corta el ataque, sea cual sea. Congelada,
    silenciada o aturdida, tampoco ataca.
- **El muñón.** Al cortarle una cabeza, la cabeza cae rodando y el cuello se desploma: la punta queda en
  el piso **brillando como brasa, con un anillo que se cierra** (amarillo, y rojo al final). Hay que pegarle
  al muñón **con lo que sea** antes de que se cierre (2 s): se quema, queda un cabito negro, y por ahí no
  sale nada. Si no llegás, revienta en verde y **le salen dos cabezas** (en ese cuello y en el libre de al
  lado), enteras.
  - El muñón no recibe los primeros 0.3 s: si no, la misma pelota que cortó la cabeza (el driver que
    atraviesa, el área del hierro) lo quemaba sola, y no hacía falta el segundo tiro.
  - El golpe 1 alcanza, así que gana el que tira rápido. El wedge no llega: pifia el golpe 1, y el golpe 2
    tarda 0.6 s en cargar más unos 1.8 s en caer. Sí sirve tirarlo *antes*, a la cabeza que estás por
    cortar: si cae justo después, quema el muñón.
  - El área del hierro (2.2 m con el golpe 1) quema varios muñones juntos si están a menos de unos 3 m.
- **El cuerpo** (versión clásica): mientras le quede alguna cabeza (o un muñón abierto, o una cabeza
  creciendo) está **cubierto**: brilla violeta como los inmunes del chamán y las pelotas rebotan sin
  volver hacia vos. Cuando no le queda ninguna, **queda al descubierto 10 s** (le late un corazón rojo en
  el pecho y un anillo dorado lo rodea): ahí se le pega. Pasados los 10 s, le vuelven a salir cabezas,
  **una más cada vez** (4, después 5, que es el tope). Vida del cuerpo: 30 + el nivel.
- **La barra de arriba** dice la vida del cuerpo y, abajo, cuántas cabezas tiene y si está cubierto (o
  cuántos segundos le quedan al descubierto).

## Cómo se le gana

1. Cortar las cabezas **de a una** (un driver fuerte, o el putter a las del medio), y **en el tiro
   siguiente, rápido, quemar el muñón** con un golpe 1. Mejor tener una pelota al lado antes de cortar.
2. A la que carga contra la puerta (naranja), pegarle ya, con lo que haya. A la verde, correrse.
3. **No cortar varias juntas**: un wedge que mata tres cabezas abre tres muñones a la vez, y quemar tres
   en 2 s es casi imposible (salvo un hierro al del medio). Es la gracia de la hidra.
4. Sin cabezas, todo al cuerpo durante los 10 s.

Las cartas ayudan (el hielo y el silencio frenan ataques, el rayo salta a los muñones, una habilidad sale
en el acto y quema un muñón), pero no hacen falta.

## Las versiones

| Id | Qué cambia |
| --- | --- |
| `hidra.clasica` | La de arriba: 2 s para el muñón, le salen dos, el cuerpo solo recibe sin cabezas. |
| `hidra.fuerte` | Si no quemás el muñón vuelve **una sola** cabeza, roja, más grande, con casi el doble de vida (9) y que ataca el doble de seguido. Menos cabezas, pero cada error pesa más. |
| `hidra.siempre` | **Al cuerpo se le pega siempre** (75 de vida): las cabezas no lo tapan, solo atacan. Empieza con **4 cabezas**, atacan un 15 % más seguido, y los muñones quemados vuelven a dar cabeza a los **8 s**. Cortar cabezas es para bajar la presión, no para habilitar el daño (hasta el 15/10: 60 de vida, 3 cabezas, 15 s). |
| `hidra.apurada` | Como la clásica, con **1.4 s** para el muñón: solo llega un golpe 1 desde una pelota que ya estaba al lado. |

## Los números para tocar (arriba de `fight.ts`)

- `HOLD_Z` 33 (dónde se planta), `WADE` (cada cuánto y cuánto se corre: entre x −6 y 6).
- `SLOTS` 5 cuellos; `SPREAD` (4 m entre cuellos; los bajos a 5.8 m del cuerpo, los altos a 3.8);
  `HEAD_LOW` 1.25 m la cabeza de los bajos (`isLow`: los pares); `NECK_LINKS` lo largo de cada cuello.
- `HEAD_HP` 5, `BODY_HP` (30 tapado, 75 siempre), `STRONG` (la cabeza fuerte).
- En la versión (`index.ts`): `heads` con cuántas empieza, `resprout` (la de «siempre», 8 s), `pace`
  (por cuánto se multiplica el tiempo entre ataques).
- `BODY_WINDOW` 10 s al descubierto; `RESPROUT` 15 s (versión «siempre»); `BUD_TIME` 1.3 s lo que tarda en
  crecer una cabeza.
- La ventana del muñón va en cada versión (`window`, en `index.ts`); `STUMP_ARM` 0.3 s de seguro.
- `SPIT` (a tu puesto: aviso 1.2 s, vuelo 0.85 s, radio 1.6 m), `GATE_SPIT` (aviso 2.4 s, saca 1).
- `GAP`: de 3.2 a 1.8 s entre ataques en 150 s; uno de cada 3 a la puerta, uno de cada 2 desde los 70 s.

## Lo que dijo Leandro (15/10) y qué se hizo

Jugó cinco «clásica» (ganó una, a los 113 s; en las otras la puerta cayó entre 45 y 100 s), una «fuerte»
(perdió), una «siempre» (ganó en 76 s perdiendo 1 de puerta) y una «apurada» (perdió). Llegó a 7 cabezas.

- **«Está difícil de pegarle a las cabezas por la altura; ahí entendí que con el wedge es mucho más
  fácil, probablemente demasiado»**, y después: **«quizás la hidra podría tener las cabezas, o algunas
  cabezas, cerca del piso, que se les pueda pegar con el driver, y que estén más separadas entre sí para
  que el wedge no les pegue a todas».** Las cabezas iban a 1.3 m una de otra (un wedge las agarraba a
  todas) y a 3.4 m de alto. Ahora: cuellos bajos con la cabeza casi en el piso (los pares) y altos (los
  impares), separados unos 4.5 m (ver «Qué hace»). El área del wedge, además, bajó un 20 % para todos
  (core/clubs, otro cambio de la misma noche).
- **«Quizás 7 cabezas es mucho».** Tope de 5 cuellos.
- **«Me gusta la idea pero siento que está raro».** Lo de arriba debería ordenarlo: se ve qué palo va a
  cada cabeza (driver a las bajas; hierro o driver a las altas) y el wedge deja de resolver todo.
- **«Hidra siempre me parece bastante fácil».** Más vida (75), 4 cabezas al empezar, ataques más
  seguidos y las cabezas quemadas vuelven a los 8 s: la presión no baja nunca del todo.

## Cómo le fue al bot

- 15/10, una partida de «clásica» después de los cambios: ganó en 86 s (7 cortadas, 7 quemadas, ninguna
  creció, llegó a 4 cabezas), con 3 escupitajos a la puerta y la puerta en 1 (lo demás, la escolta).

## Lo que se sabe que falta

- Verla en el navegador: que los cuellos largos de las puntas no se vean cortados y que las cabezas bajas
  no se metan en el piso con las lomas.
- «Siempre» no se probó con el bot después del cambio.
