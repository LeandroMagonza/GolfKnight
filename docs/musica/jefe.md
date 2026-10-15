# La música del jefe (15/10)

Tres versiones para la pelea final, en `src/audio/music/songs/jefe.ts`, para elegir en **musica.html**
(«El jefe»). Son las más grandes del juego: coro, metales, timbales, taikos, campanas, y una sala de
reverb larga propia (aparte de la del juego) para el coro y los metales.

Las tres comparten cómo se arman:

- **Entran con el fundido.** El cambio a la música del jefe es un fundido de 2,5 s: un golpe en el segundo
  cero no se oiría. Por eso cada una arranca con un compás que crece (redoble, platillo al revés, coro que
  sube) y **el golpe fuerte cae justo cuando el fundido terminó**.
- **La forma corre sola**: intro, A, B, clímax y vuelve (a la A, no a la intro), así se desarrolla aunque la
  partida esté tranquila. Duran de 2:20 a 3:10 la primera vuelta antes de repetir.
- **La tensión suma capas** (`intensity`, de 0 a 1: la puerta baja, enemigos cerca): se mira cada dos
  compases y prende o apaga con un margen, así nada entra a mitad de frase ni titila.

## jefe.requiem — «Réquiem para un golfista»

- **Carácter:** épica coral de catedral, con guiño: es un réquiem... para un golfista. Los bajos del coro
  cantan el *Dies irae* (el canto gregoriano de los réquiem, el que usan todas las películas para decir
  «fatalidad»), y el clímax termina en **re mayor** (si bemol, do, ¡re!): el caballero puede ganar.
- **Re menor, 80 por minuto** (compás de 3 s).
- **Instrumentos:** coro grave en «o» y coro entero en «a» (sierras por filtros de formantes), órgano,
  trompas y trombones, cuerdas en ostinato de semicorcheas (acentos 3+3+2), contrabajo, timbales afinados,
  taikos, platillos, campana grande de iglesia y campanas tubulares.
- **Forma (62 compases, ~3:06):** levanta (redoble en la dominante) → **golpe** en re menor con el pedal de
  órgano y la campana → Dies irae → A (tema en las trompas, después en el coro) → B (más luminosa: si bemol,
  fa, do; las trompas suben hasta el la agudo) → clímax (el tema en todo el coro a dos octavas, contracanto,
  trombones con puntillo, órgano, y el final en re mayor con campanas) → respiro (Dies irae otra vez, quieto)
  → vuelve a la A con más capas.
- **Tensión:** desde 0.3, taikos y trombones en la A; desde 0.55, el contracanto de las trompas y el coro
  agudo canta la B; desde 0.8, redobles, timbales en semicorcheas y platillos más seguido.

## jefe.batalla — «Batalla en siete»

- **Carácter:** batalla que no para. Está en **7/8** (2+2+3): el compás «tropieza para adelante» todo el
  tiempo, que es lo que la hace implacable; distinta de todo lo demás del juego.
- **Do menor**, semicorchea de 0.1 s (compás de 1.4 s). El clímax sube un tono (re menor) y cierra en re
  mayor; la coda vuelve por sol.
- **Instrumentos:** taikos (grande, medio, el «ka» del borde), cuerdas graves en ostinato, contrabajo,
  violines largos en la B2 y el clímax, trompas, trombones, coro y gritos del coro («¡HA!»), timbales.
- **Forma (102 compases, ~2:23):** levanta (redoble de toms) → **golpe** con grito → intro de tambores → A
  (tema en las trompas) → B (el coro canta en notas largas, fanfarria de trompas en 2+2+3) → **quiebre: solo
  de tambores con gritos** → A2 (el tema en trompas, trombones y coro juntos) → B2 → clímax un tono arriba
  → coda → vuelve a A2.
- **Tensión:** desde 0.35, rellenos de toms; desde 0.6, golpes de trombones en los acentos; desde 0.8,
  taikos al doble y el coro agudo.

## jefe.tambores — «Tambores de guerra» (para un jefe de ritmo)

- **Carácter:** un **bombo en cada pulso**, siempre igual (el 1 apenas más fuerte), que se lee como un
  metrónomo, y que **se apura de 90 a 150 golpes por minuto en 3 minutos** (después se queda en 150). Arriba,
  un canto de guerra que va **en el pulso** (negras) y deja el cuarto tiempo de cada frase para un «¡HA!»
  del coro. Empieza con los bajos solos y termina en tutti: la pelea se pone frenética sola (y da un poco
  de risa, como debe).
- **Sol dórico** (el mi natural del acorde de do mayor lo hace épico y no fúnebre).
- **Instrumentos:** bombo (grave + golpe medio, que se oye en parlantes chicos), coro grave, trompas,
  trombones, coro agudo, cuerdas (corcheas y después semicorcheas), contrabajo, ka en 2 y 4, toms a
  contratiempo, timbal, platillos y campanas tubulares.
- **Forma:** un compás de cuenta (el bombo crece con el fundido) → **golpe** en sol menor → fases de 16
  compases que se van llenando (bajos solos; + trompas y la respuesta de los metales; + cuerdas, trombones,
  timbal; + toms y platillos; + coro agudo y semicorcheas; tutti con campanas) → repite las tres últimas.
  El tempo sube aparte de las fases: a los 40 s va por 103, al minuto y medio por 120, a los 2 min por 130.
- **Tensión:** desde 0.4, toms a contratiempo (siempre más bajos que el bombo); desde 0.65, golpes de
  trombones en el 1; desde 0.85, redobles y platillos cada dos compases.

### Cómo lo lee un jefe de ritmo

El tempo no sale del transporte (lo comparten dos canciones en el fundido y nadie lo cambia): la canción
lleva su propio reloj en segundos. Lo que cae cada golpe es una cuenta cerrada, así que se puede preguntar
en cualquier momento:

```ts
const { pulsoTambores } = await import('../../audio/music/songs/jefe'); // al armar el jefe (import dinámico)
// al soltar el tiro:
const p = pulsoTambores(); // null si no suenan los tambores
if (p && Math.min(p.desde, p.hasta) < 0.1) { /* ¡a tiempo! */ }
```

- `pulsoTambores()` → `{ bpm, golpe, desde, hasta, previo, proximo }`: el tempo de ahora, cuántos golpes
  van (con decimales), los segundos desde el último golpe y hasta el próximo, y esos dos golpes en la hora
  del audio (`Tone.getContext().currentTime`). Cuenta **lo que sale por el parlante** (descuenta la latencia
  de salida del navegador) y se pausa con el juego (va en segundos del transporte).
- `tamboresSegundo(b)` y `tamboresGolpes(s)`: en qué segundo de la canción cae el golpe `b`, y cuántos golpes
  van a los `s` segundos (para dibujar los próximos golpes por adelantado). `tamboresBpm(s)`: el tempo.
  `TAMBORES_BPM` tiene el 90, el 150 y los 180 s.
- El golpe 0 es el primero del compás de cuenta; el golpe fuerte de la entrada es el 4.
- Ojo: el jugador además tarda en apretar y la pantalla en mostrar (unos 30 a 60 ms); conviene una ventana
  de ±100 ms o más, y probarlo con la mano.

## Lo que revisé (sin escucharlas)

PENDIENTE

## Dudas

PENDIENTE
