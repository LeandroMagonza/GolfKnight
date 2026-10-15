# Jefes de ritmo (14/10)

La idea es de Leandro: «un jefe que arranque con blindaje alto y vaya bajando, y suba de golpe cuando le
pegás; podemos tener jefes más de burst, y jefes más de pegarle de a ratos; también podría haber uno que
se empiece a curar si no le pegás cada 3 segundos». Son dos ritmos opuestos, y cada uno pide una cosa:

- **La coraza** (el Caballero de hierro) pide **ráfaga**: esperar la ventana y descargarle todo junto.
- **El pulso** (el Chamán eterno) pide **cadencia**: pegarle seguido, sin pausas, entre los demás.

Ninguno camina a la puerta: se plantan a media cancha y cada tanto se cambian de lugar (hay que volver a
apuntar, y a veces cambiar de palo). Con el correr de la pelea se plantan más cerca (de unos 40 m a unos
25 m de la línea, en 150 s) y todo se pone más apretado: esa es la presión que sube sola.

El código está en `src/game/bosses/ritmo/`: `coraza.ts` y `pulso.ts` son los dos ritmos, `cuerpo.ts` el
cuerpo (cómo se planta y se cambia de lugar, y los avisos de cada golpe), `piezas.ts` lo que se ve (el
dial del piso, el número sobre la cabeza, lo que tiran) e `index.ts` las versiones.

## Las versiones

| Id | Qué tiene de distinto |
|---|---|
| `ritmo.coraza` | La de base. Ráfaga: en 0, el primer golpe prende una mecha de 2 s; lo que entra en esos 2 s entra entero, y ahí se cierra al tope. Si se le pasa la ventana, tira la lanza a la puerta |
| `ritmo.coraza-escolta` | Igual, pero si se le pasa la ventana **reparte su blindaje**: +1 a los de la escolta que tiene cerca |
| `ritmo.tope` | «De a ratos»: el primer golpe en 0 lo cierra en el acto. Un golpe por ventana, que sea el más fuerte. Baja más rápido |
| `ritmo.suma` | Cada golpe que entra le **suma 2** de blindaje, sin mecha |
| `ritmo.pulso` | La de base del pulso: si pasan 3.4 s sin pegarle se cura y te tira hechizos. Llama goblins cada tanto |
| `ritmo.pulso-escolta` | Igual, pero mientras se cura **cura también a la escolta** que tiene cerca, con vida de más |
| `ritmo.pareja` | Los dos a la vez, en dos cuerpos: el caballero y el chamán. El chamán, al curarse, cura también al caballero |
| `ritmo.doble` | Los dos ritmos en un solo cuerpo (la Paladina caída): cualquier pelota que la toque le corta la cura, aunque el blindaje se la coma |
