// La versión de escritorio (itch.io y Steam): el mismo juego web adentro de Electron, sin reescribir nada.
// tools/desktop.mjs compila el juego (sin herramientas de prueba) en web/, al lado de este archivo, y arma
// el ejecutable. Ver docs/monetizacion.md.
//
// El juego se sirve desde app://golfknight/ (no desde file://): así los módulos, los fetch de los modelos y
// el localStorage andan como en la web. Arranca en pantalla completa; F11 o Alt+Enter la cambian, y la
// pausa tiene «Salir del juego» (ver preload.cjs).
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'web');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    fullscreen: true,
    backgroundColor: '#0c1219',
    title: 'Golf Knight',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // la música y las voces suenan sin esperar un click, como en cualquier juego instalado
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.setMenu(null);
  win.loadURL('app://golfknight/index.html');
  // los enlaces de afuera (la página de Abe, itch, Steam) se abren en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const file = path.normalize(path.join(ROOT, decodeURIComponent(new URL(request.url).pathname)));
    if (!file.startsWith(ROOT + path.sep)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  ipcMain.on('gk-quit', () => app.quit());
  ipcMain.on('gk-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(!win.isFullScreen());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
