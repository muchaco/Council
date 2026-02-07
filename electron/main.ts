import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import { setupDatabaseHandlers } from './handlers/db.js';
import { setupLLMHandlers } from './handlers/llm.js';
import { setupSettingsHandlers } from './handlers/settings.js';
import { setupOrchestratorHandlers } from './handlers/orchestrator.js';
import { setupExportHandlers } from './handlers/export.js';

// Disable GPU acceleration to avoid VAAPI version errors
app.commandLine.appendSwitch('disable-gpu');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Loading preload script from:', preloadPath);
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // Disable sandbox to allow preload script to load properly
      // This is safe because we use contextIsolation and don't expose Node APIs
      sandbox: false,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Log preload script loading errors
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('Preload script error:', preloadPath, error);
  });

  // Set Content Security Policy
  // Note: These settings are for development. Production builds should use stricter CSP.
  // The 'unsafe-eval' and 'unsafe-inline' are required for React development tools and HMR.
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const isDev = process.env.NODE_ENV === 'development';
    
    const cspDirectives = [
      "default-src 'self'",
      // In dev, allow unsafe-inline/eval for React dev tools; in prod, use strict settings
      isDev 
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3000" 
        : "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      isDev 
        ? "connect-src 'self' http://localhost:3000 ws://localhost:3000" 
        : "connect-src 'self'",
    ];
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives.join('; ')],
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
  setupOrchestratorHandlers();
  setupExportHandlers();

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
