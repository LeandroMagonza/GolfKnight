# La Hidra (14/10)

**Qué pone a prueba: el tempo.** Un tiro flojo ya, o uno fuerte después. Cortarle una cabeza pide pegar
fuerte; quemar el muñón y frenar un escupitajo piden pegar *ya*, con lo que sea.

Código: `src/game/bosses/hidra/` (`fight.ts` la pelea, `look.ts` los modelos, `index.ts` las versiones).
Probar: `?ola=10&jefe=hidra.clasica` (o el panel B > Pruebas > Jefes).

## Qué hace

- **Entra y se planta.** Aparece al fondo, camina hasta unos 24 m de los puestos (z 33) y se queda. Cada 16 s
  se corre de costado (entre x −8 y 8), despacio: no se queda en un lugar ni va a la puerta.
- **Tres cabezas en cuellos largos**, cada una con su vida (5; +1 cada 4 niveles), flotando unos 4 m
  adelante del cuerpo, a 19–21 m de los puestos: les llegan el driver, el hierro, el wedge y, a las del
  medio, el putter.
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
  **una más cada vez** (4, después 5...). Vida del cuerpo: 30 + el nivel.
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
| `hidra.siempre` | **Al cuerpo se le pega siempre** (60 de vida): las cabezas no lo tapan, solo atacan. Los muñones quemados vuelven a dar cabeza a los 15 s. Cortar cabezas es para bajar la presión, no para habilitar el daño. |
| `hidra.apurada` | Como la clásica, con **1.4 s** para el muñón: solo llega un golpe 1 desde una pelota que ya estaba al lado. |

## Los números para tocar (arriba de `fight.ts`)

- `HOLD_Z` 33 (dónde se planta), `WADE` (cada cuánto y cuánto se corre).
- `HEAD_HP` 5, `BODY_HP` (30 tapado, 60 siempre), `STRONG` (la cabeza fuerte).
- `BODY_WINDOW` 10 s al descubierto; `RESPROUT` 15 s (versión «siempre»); `BUD_TIME` 1.3 s lo que tarda en
  crecer una cabeza.
- La ventana del muñón va en cada versión (`window`, en `index.ts`); `STUMP_ARM` 0.3 s de seguro.
- `SPIT` (a tu puesto: aviso 1.2 s, vuelo 0.85 s, radio 1.6 m), `GATE_SPIT` (aviso 2.4 s, saca 1).
- `GAP`: de 3.2 a 1.8 s entre ataques en 150 s; uno de cada 3 a la puerta, uno de cada 2 desde los 70 s.

## Cómo le fue al bot

(se completa abajo)

## Lo que se sabe que falta

(se completa abajo)
