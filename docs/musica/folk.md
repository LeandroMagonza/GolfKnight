# Folk: las tres canciones de escenario (15/10)

Tres canciones de la misma banda de feria medieval, una por escenario, que se van oscureciendo de la
primera a la tercera. Están en `src/audio/music/songs/folk.ts`. Se eligen en musica.html (o en el panel
B, pestaña Sonido): `folk.feria` para el escenario 1, `folk.marcha` para el 2 y `folk.asedio` para el 3.

## La banda (la misma en las tres)

Todo sintetizado, sin ondas cuadradas ni arpegios de 8 bits:

- **Laúd**: dos sierras apenas desafinadas (las cuerdas de a pares del laúd) con un filtro que arranca
  abierto y se cierra en unas centésimas: suena a cuerda pulsada que pierde el brillo. Hace el bajo y el
  acompañamiento.
- **Flauta dulce**: casi un seno, con un poco de los armónicos impares, un vibrato chico y un soplido
  filtrado en cada ataque. Articula (corta un poco cada nota) y hace el adorno de las flautas folk: un
  golpecito de la nota de arriba antes de la nota (el «cut», marcado con `~` en las melodías).
- **Viola de arco**: dos sierras con ataque lento, un filtro que se abre al apoyar el arco y vibrato. Canta
  los temas más largos y hace la segunda voz.
- **Bordón** (como una zanfoña o los roncones de una gaita): tónica y quinta graves detrás de un filtro.
  Cuando una nota del bordón queda a un semitono de una del acorde (el sol contra el fa# del re mayor, por
  ejemplo) esa nota baja sola, como el gaitero que cierra un roncón: así acompaña sin raspar.
- **Pandero**: un parche grave (el «bum») y los dedos en el borde (el «tek»: un parche agudo cortito con un
  chasquido de ruido).
- **Pandereta**: solo los cascabeles (ruido arriba de 6,5 kHz, lejos de los golpes y las voces), golpes
  cortos y una sacudida larga al empezar cada sección y en los redobles.
- **Bombo grande**: un parche bien grave, para la tensión y para el asedio.

A la salida, un pozo suave en 2,5 kHz (−6 dB): ahí viven los golpes y las voces, y la música les deja
lugar. La reverb y el limitador los pone el juego (la misma cadena que la de siempre).

Los instrumentos están hechos con nodos de Web Audio pelados, no con los sintetizadores de Tone (ver «Lo
que cuesta» abajo); Tone sigue llevando el tiempo (el transporte) y la salida.

## Las canciones

| | `folk.feria` | `folk.marcha` | `folk.asedio` |
| --- | --- | --- | --- |
| Escenario | 1 | 2 | 3 |
| Carácter | alegre, saltarina: la feria | seria, con empuje | oscura, urgente |
| Tonalidad | sol mayor (un fa natural mixolidio en el B) | la menor con el si bemol frigio | re menor (con el do# del la mayor) |
| Compás y tempo | 6/8, 116 negras con puntillo | 4/4, 126 | 4/4, 136 |
| El laúd | el «bum-chic» de las gigas; rasgueos en el B; arpegios en la intro y el puente | el bajo en 3+3+2 sobre la pedal y corcheas arriba | al galope: corchea y dos semicorcheas |
| La forma | intro 4, A 16, B 16, A 16, puente 8, B 16, A 16 compases | igual | igual |
| Hasta repetirse | ~1 min 31 s (y la segunda vuelta cambia quién canta el primer A) | ~2 min 48 s | ~2 min 35 s |

Las tres tienen la misma forma (intro, A, B, A, puente, B, A, y vuelve al primer A sin la intro), pero cada
vuelta del A y del B está orquestada distinto:

- **La feria**: el A lo canta la flauta con el laúd y el pandero; el B (más largo, con notas sostenidas
  para respirar) lo canta la viola y la flauta le contesta cuando ella sostiene; el segundo A suma la viola
  en terceras abajo; el puente deja el laúd solo con el bordón y la flauta de a ratos; el segundo B va con
  la flauta en terceras arriba; el último A, todos: la flauta y la viola el mismo tema a la octava. La
  segunda vez que pasa la forma el primer A lo canta la viola.
- **La marcha**: la viola canta el A (en la última frase cae al si bemol: la cadencia frigia), la flauta el
  B con la viola sosteniendo notas largas abajo; el segundo A lo toma la flauta con la viola a la octava; el
  puente se queda en el la contra el si bemol, con el pandero casi solo y la viola en notas largas; el
  segundo B y el último A, con segunda voz y la percusión llena.
- **El asedio**: el bombo grande late desde el primer compás; la viola canta el A, la flauta el B (en
  3+3+2, a contrapié del galope); el puente son tambores de guerra (el bombo en 3+3+2) con el bordón grave
  y la viola en notas largas; después vuelve todo.

Al final de cada frase de 8 compases hay un redoble (los dedos del pandero en crescendo y la pandereta
sacudida), y la pandereta se sacude al entrar cada sección: marca dónde empieza cada parte.

Las melodías se escriben como texto en el archivo (`'G4:2 B4 D5:2 B4 | ...'`: nota, duración en pasos,
compases separados por `|`); si un compás no suma, la canción no carga y el panel dice cuál. La segunda voz
(las terceras de las bandas de feria) se arma sola a partir de la melodía y el acorde.

## La tensión

La perilla de tensión (lo que manda el juego: enemigos cerca de la línea, la puerta baja) no cambia el
tempo; suma capas de a poco (cada una entra a lo largo de 0,15 de tensión, sin golpes):

- **En las tres**: el filtro del bordón se abre (de 360 Hz a ~1,1 kHz) y sube un poco: suena más gaita.
- **La feria**: desde 0,3 los dedos rellenan las corcheas del pandero; desde 0,35 la segunda voz en el
  primer A; desde 0,5 la pandereta en todas las corcheas; desde 0,55 el laúd rellena el «bum-chic»; desde
  0,7 el bombo grande cada dos compases.
- **La marcha**: desde 0,3 golpes fantasma del pandero; desde 0,4 la flauta en terceras en el primer A;
  desde 0,5 la pandereta en semicorcheas y la segunda voz en el puente; desde 0,55 el laúd empuja con
  semicorcheas; desde 0,65 el bombo grande en el 3.
- **El asedio**: desde 0,3 el pandero galopa; desde 0,4 la pandereta en semicorcheas y la segunda voz;
  desde 0,6 el bombo grande a contrapié; desde 0,8 el pandero en todas las corcheas.

## Qué revisé (sin escucharlas)

(se completa con las medidas finales)

## Dudas y cosas para mirar

(se completa)
