# Los poderes que se ven

15/10/2026. Dos pedidos de Leandro:

> «hay algo que tenemos pendiente hace mucho, que es que el blindaje, el escudo, no se nota de lejos qué
> nivel tienen, y acá pasa similar, estuvo bien que pusiste números grandes sobre la cabeza [el jefe de
> la coraza], porque el blindaje en sí no se notaba que cambiaba, deberíamos tenerlo más notorio, quizás
> tamaño o ícono levemente distinto, y que haga animación y ruido cuando un enemigo gana un poder, o
> incluso un poder en específico.»

> «que en el tutorial no te ponga automáticamente el palo, sino que te obligue a tener un paso de apretar
> el botón para pasar al palo correspondiente»

## El nivel en el ícono

Los íconos de arriba de la vida (`drawBadge` y `drawPips` en `game/enemies.ts`) cambian con el nivel. Vale
para los que llevan número: el escudo y el blindaje.

| Nivel | Tamaño | Borde | Dibujo | Número |
|---|---|---|---|---|
| 1 | como siempre | negro | el de siempre | chico, como siempre |
| 2 | ×1.4 | plateado | el yelmo con cresta; el escudo con una banda de metal arriba | grande y grueso, blanco con borde negro |
| 3 o más | ×1.8 | dorado | el yelmo con cresta dorada y cuernos; la banda dorada | igual que el 2 |
| El muro | ×1.8 | dorado | banda dorada | ∞ |

- **Crece para arriba.** El ícono grande se apoya en la fila de la vida y sobresale por encima, así no
  tapa al enemigo. La vida no se corre de donde estaba.
- **El tamaño se lee antes que el número.** Desde la cámara alta, a 30 o 40 m, el número no se lee, pero
  un ícono el doble de grande con borde dorado sí.
- Los íconos del recorrido de la partida (el HUD de arriba) no cambian: no llevan número.
- Las constantes: `TIER_SCALE`, `TIER_RIM` y `drawTierMarks`.

## Cuando gana un poder

Si un enemigo gana un poder en plena oleada, o le sube el nivel, se ve y se oye. No hace falta que lo
avise quien se lo da: el enemigo mira sus poderes en cada cuadro (`Enemy.updatePowers`) y se da cuenta
solo. Funciona con todo lo que da poderes:
- el espectro (blindaje, bendito, esquiva, se cura, élite);
- las placas que reparte el jefe de la coraza;
- la bandera (el punto de vida de más);
- el chamán (entrar en su círculo);
- lo que se agregue más adelante.

Lo que se ve (`game/powerGain.ts`):
- **Dos anillos del color del poder que le suben por el cuerpo**, de los pies a la cabeza.
- **El cuerpo brilla del color del poder** y se apaga en 0.6 s.
- **El ícono del poder, grande, salta arriba de su vida** con su número. Rebota, se queda un segundo y se
  va subiendo. Mide 1.1 m, un poco más con nivel 2 o 3. Mide lo mismo en un élite.
- **Su ícono en la fila destella** con un halo blanco durante 0.7 s.

Si **le baja** el nivel no hay anillos ni brillo: el ícono con el número nuevo aparece apagado, se achica
y se hunde.

Lo que no cuenta:
- **Lo que trae al aparecer**, ni lo que le llega en su primer medio segundo. Si la bandera ya está en
  alto, o aparece al lado del chamán, no festeja.
- **El círculo del chamán**, si salió de la protección hace menos de 1.2 s. Así no festeja cada vez que
  roza el borde.
- **Los jefes y sus partes** (los que tienen guion): cada jefe muestra lo suyo.

### El sonido

`audio.powerGain(poder, nivel, sube)`, al final de `audio/audio.ts`. Lo llama `main.ts` con el evento
`powerGained` de la horda.

Es un arpegio corto que sube, en una campana de FM tibia: senoidal, poca modulación, con filtro y
reverb. Nada de 8 bits. Cada poder tiene su registro, y debajo suena bajito el grabado que ya es de ese
poder, cuando hay uno:

| Poder | Notas | Debajo |
|---|---|---|
| Blindaje | grave (sol, re, sol) | el metal del blindado |
| Escudo | medio-grave | un golpe de madera |
| Bendito | agudo, cuatro notas | la burbuja que se arma |
| Esquiva | agudo y rápido | el tic de la esquiva |
| Se cura | medio | la cura |
| Fantasma, intocable | más lento | — |
| Élite | grave y menor | — |
| Bandera | si bemol, fa, si bemol | — |
| Chamán | medio-agudo | — |

- **Cada nivel más suena un tono más arriba.** El blindaje 3 suena más alto que el 1.
- **Al bajar de nivel**, dos notas que bajan, más bajito.
- **Una vez por ráfaga.** Si les llega a muchos a la vez (la bandera en alto), suena una sola vez: hay
  140 ms entre uno y otro. No suena después de perder.

**Ojo, el espectro ya tenía sonido propio**: `zap` para el blindaje y la esquiva, la cura y la burbuja.
Ahora suena eso más el arpegio. Si molesta, se le saca el `audio.zap()` a `levelUp` en
`bosses/espectro/index.ts` (ese archivo es de los jefes: no lo toqué).

### Cómo probarlo

`?prueba=poderes` (ver `pruebas.md`):
- **Atrás**: el escudo 1, 2, 3 y el muro.
- **En el medio**: el blindaje 1, 2 y 3.
- **Adelante**: tres goblins. Cada 3 s a uno le llega lo que sigue de su lista: el blindaje que sube de a
  uno hasta 3, la esquiva, se cura y élite.

Probado en el navegador:
- se distinguen los tres niveles;
- el ícono que salta se ve;
- a 60 fps;
- sin errores.

## El tutorial: sacar el palo con su tecla

Antes, cuando un paso traía otro palo (el hierro, el wedge, el putter), el tutorial te lo ponía en la
mano. Ahora (`next` y `begin` en `src/tutorial.ts`):
1. Aparece el cartel del paso.
2. El palo nuevo entra a la barra con su saltito, al lado del que tenías.
3. La instrucción dice: «Ahora, el **Hierro 7**. Apretá **2** para sacarlo: cada palo tiene su tecla, y
   se cambia en cualquier momento». La tecla sale de `CLUB_KEYS`.
4. Los enemigos y la loma salen **recién cuando lo sacaste**: con la tecla o con la rueda del mouse. Si
   estabas a mitad de un tiro, sale cuando termina.
5. Un «¡Eso!» y sigue el paso como siempre, solo con ese palo.

Los pasos del driver (del 1 al 6) no cambian: ya lo tenés en la mano.

Probado en el navegador saltando al paso del hierro:
- antes de la tecla: sin enemigos, con el driver en la mano, y el driver y el hierro en la barra;
- después de apretar 2: el hierro en la mano y los tres goblins con la loma.
