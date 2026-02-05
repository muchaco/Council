import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import { setupDatabaseHandlers } from './handlers/db.js';
import { setupLLMHandlers } from './handlers/llm.js';
import { setupSettingsHandlers } from './handlers/settings.js';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Set Content Security Policy for security
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3000; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; " +
          "font-src 'self'; " +
          "connect-src 'self' http://localhost:3000 ws://localhost:3000;"
        ],
      },
    });
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, use the static build with hash-based routing
    const indexPath = path.join(__dirname, '..', '..', 'out', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle navigation for hash-based routing
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Prevent default navigation for internal links
    if (url.startsWith('file://')) {
      event.preventDefault();
      const hash = url.split('#')[1] || '';
      mainWindow?.webContents.executeJavaScript(`
        window.location.hash = '${hash}';
      `);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Register protocol for static files
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6); // Remove 'app://'
    const filePath = path.join(__dirname, '..', '..', 'out', url);
    callback({ path: filePath });
  });

  createWindow();
  
  setupDatabaseHandlers();
  setupLLMHandlers();
  setupSettingsHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
