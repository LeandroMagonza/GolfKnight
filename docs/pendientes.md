# Golf Knight: pendientes

28/9/2026. Temas abiertos que no son de una sola tarea. Cuando uno se resuelve, pasa a
`diseno-combate.md` con lo que se hizo.

## Tutorial: lo que falta

El 29/9 se hizo la primera parte: los cuatro palos, cargar y clavar la carga (ver `diseno-combate.md`).
Queda de la idea original:

- **Un modificador por vez**: cada poder nuevo solo, o con uno o dos goblins, con una pregunta clara.
  - **Escudo**: el globo que cae detrás, la granada, o pegarle de costado con el putter (casi nadie lo
    descubre solo).
  - **Blindaje**: ya aparece en el paso de cargar.
  - **Fantasma**: pegarle fuerte no sirve; hacen falta muchos golpes.
  - **Chamán y curandero**: el aura del piso; matarlo primero o silenciarlo.
  - **Abanderada**: se queda al fondo; hace falta un tiro largo.
- Cómo se presenta lo que llega con las cartas (habilidades, mejoras), que no depende de la oleada.
- Quizás un paso de moverse entre puestos con A y D, y uno del golpe perfecto (hoy solo se lo menciona).

## La cinemática del final

4/10, pedido de Leandro: al ganar, una cinemática antes del cartel del final. Hoy el golfista festeja con
los brazos en alto unos segundos y después aparece el cartel con los números (`src/endscreen.ts`). La
cinemática iría en ese hueco, con el reproductor de la de la intro (ver `cinematica.md`).

## Los campos

Revisar los mapas (29/9: la meseta se bajó y se sacó *Los dos carriles*). Qué pregunta hace cada uno,
si alguno tapa demasiado con el mejor golpe en 4, y si hacen falta otros.

## Las descripciones

Revisar todas las descripciones: habilidades, mejoras, poderes y carteles. Muchas no son claras, y otras
dan información de más que confunde. Que cada una diga qué hace en una frase, y lo demás, si hace falta,
en el panel.

## El jefe

Hoy termina siendo una carrera: el Gólem tira piedras a la puerta y no hay forma de evitar que pegue,
así que hay que matar a todos los demás y tener vida para aguantarlo hasta que muera. Mejorarlo, y
posiblemente sumar otros jefes. Ideas de Leandro:

- **Piedras que nacen en la línea de 20.** En vez de tirar piedras, se apoya en la tierra y van
  apareciendo piedras a lo largo de la línea de 20 m, con distintas vidas. Toman velocidad unos segundos
  y salen contra la puerta: el guerrero tiene tiempo de pegarles antes de que se lancen, mientras le
  pega al jefe. Las piedras se cargan cada vez más rápido o salen más grandes.
- **Bowling.** El jefe tira una piedra rodando, y se le puede pegar. Pero con el jefe tan quieto puede
  aburrir.
- **Tres jefes.** Tres que tiran piedras, y hay que matar a los tres mientras se les pega a las piedras
  de cada uno: conviene concentrarse en uno sin desatender las piedras de los otros.

## Cavar

El poder de cavar (el que levanta una loma) quedó afuera de las partidas en el rediseño por escenarios:
no encajaba ni como poder de escenario ni como apoyo. El código sigue andando (`POWERS.dig`); falta
decidir dónde va.

## Más formas de silenciar, con recargas que pidan pensar

La granada ahora saca también el blindaje, así que resuelve escudo, aura, inmunidad y blindaje de una.
Si se suman más formas de silenciar, cada una tiene que tener una recarga que obligue a elegir cuándo
usarla. Si se puede silenciar todo el tiempo, los enemigos que piden una solución distinta se resuelven
todos igual, y el juego se vuelve monótono. Es lo mismo que pasó con el palazo cuando pegaba gratis.

## Escudo y blindaje: resuelto, se unificaron

Ver «El escudo pasa a ser blindaje de frente» en `diseno-combate.md`. Queda para mirar jugando si 4 es el
número del guerrero, y si el muro necesita un modelo propio (el pack tiene escudos más imponentes).

## Otros

- **La bandera** está hecha por código (un palo y un paño). El pack tiene cinco estandartes de verdad
  (`SM_Wep_Banner_01` a `05`): se pasan con `tools/props_to_glb.py`, como los escudos.
- **Modelos sin usar**: la guerrera goblin, el esqueleto soldado 02, el esclavo y los dos fantasmas.
  Podrían ser cuerpos nuevos en la escalera de vida, o el aspecto de un poder.
- **La prueba general** (`tools/playtest.mjs`) sigue usando la API vieja de los poderes y se cae al
  arrancar.
