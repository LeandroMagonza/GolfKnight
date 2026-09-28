# Golf Knight: pendientes

28/9/2026. Temas abiertos que no son de una sola tarea. Cuando uno se resuelve, pasa a
`diseno-combate.md` con lo que se hizo.

## Tutorial: un rato a solas con cada cosa

**El problema.** Los amigos que lo prueban por primera vez se sienten abrumados. Les caen muchos
enemigos a la vez y no llegan a entender varias cosas: qué hace cada palo, por qué a uno no le entra el
driver, qué significa un aura en el piso. Hoy todo se presenta con un cartel y en medio de la oleada,
con el resto de la horda encima.

**La idea.** Darle al jugador un tiempo a solas con cada palo y con cada modificador antes de mezclarlo
con lo demás.

- **Un palo por vez.** Unos pocos enemigos quietos o lentos, puestos donde ese palo luce:
  - el driver, una fila lejos;
  - el hierro, uno detrás de una loma;
  - el wedge, un grupo apretado;
  - el putter, uno encima de la línea.

  Recién cuando le pegó con ese palo, pasa al siguiente.
- **Un modificador por vez.** Cada enemigo o modificador nuevo aparece primero solo, o con uno o dos
  goblins, y con una pregunta clara: cómo se le gana a este.
  - **Escudo**: se lo resuelve con el globo que cae detrás, con la granada, o **pegándole de costado
    con el putter**. Eso último hoy no lo descubre casi nadie; habría que enseñarlo a propósito,
    poniendo al del escudo al costado de un puesto.
  - **Blindaje**: el golpe flojo no le entra. Hay que pegarle fuerte, o silenciarlo con la granada.
  - **Fantasma**: al revés que el blindaje. Pegarle fuerte no sirve: hacen falta muchos golpes (el
    driver que atraviesa una fila, el fuego).
  - **Chamán y curandero**: el aura del piso. Hay que matarlo primero, o silenciarlo.
  - **Abanderada**: se queda al fondo; hace falta un tiro largo.
  - **Geomante**: la loma tapa al driver; hay que ir por arriba, con el hierro o el globo.
- **Menos texto.** Coincide con lo anotado el 20/9 («aprender jugando»): mejor que se entienda por lo
  que pasa en el campo que por un cartel. Donde haga falta, una frase corta en el momento.

**A definir.**
- ¿Es un modo aparte (práctica), o las primeras oleadas de la partida pasan a ser así?
- ¿Se puede saltear para quien ya jugó?
- Cómo se presenta lo que llega con las cartas (habilidades, mejoras), que no depende de la oleada.

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
