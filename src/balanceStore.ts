// Dónde guarda el panel de balance (src/debug.ts) lo que se ajusta, aparte del panel: así el simulador de
// la carga (src/arco.ts) puede dejar sus tiempos para el juego sin cargar todo el panel.

/**
 * El balance ajustado se guarda en el navegador y vuelve al recargar. Hace falta porque cambiar de
 * campo recarga la página: sin esto, tocar diez números y probarlos en otro campo era imposible. El
 * botón «Restaurar» lo borra y devuelve los valores del código.
 */
export const BALANCE_KEY = 'gk.balance';

/**
 * Sube cuando el juego **redefine** un valor que el panel guarda. Un guardado viejo lo trae con el
 * número de antes y pisa la decisión nueva sin que nadie se entere: pasó con el mínimo de distancia,
 * que ahora es 0 en los cuatro palos, y con la carga del putter, que se emparejó con la de los demás.
 * Al subir la versión esos vuelven al valor del código y el resto de lo tocado se conserva (ver
 * RESET_ON_UPGRADE en src/debug.ts).
 */
export const BALANCE_VERSION = 19;
