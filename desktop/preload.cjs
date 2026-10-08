// Lo que el juego puede pedirle a la app de escritorio (ver main.cjs). En la web no existe
// `window.gkDesktop`, y el juego no muestra lo que depende de esto.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gkDesktop', {
  quit: () => ipcRenderer.send('gk-quit'),
  toggleFullscreen: () => ipcRenderer.send('gk-fullscreen'),
});
