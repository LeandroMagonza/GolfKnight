/// <reference types="vite/client" />

/** Día y hora del build (ver vite.config.ts): la versión que se ve en la pantalla de entrada. */
declare const __BUILD__: string;
/** El mismo momento, en milisegundos: para comparar con la última versión publicada (ver checkUpdate en main). */
declare const __BUILD_TIME__: number;
/** Qué versión del juego es esta compilación: 'full', 'demo' o 'abe' (ver src/edition.ts). */
declare const __EDITION__: string;
/** Si trae las herramientas de prueba (ver src/edition.ts). */
declare const __DEV_TOOLS__: boolean;
