import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import { setupDatabaseHandlers } from './handlers/db.js';
import { setupLLMHandlers } from './handlers/llm.js';
import { setupSettingsHandlers } from './handlers/settings.js';
import { setupConductorHandlers } from './handlers/conductor.js';
import { setupExportHandlers } from './handlers/export.js';
import { resolveAppProtocolRequestPath } from './lib/security/app-protocol-path.js';
import {
  configureTrustedRendererFileEntrypoints,
  isTrustedNavigationTarget,
} from './lib/security/trusted-sender.js';

// Disable GPU acceleration to avoid VAAPI version errors
app.commandLine.appendSwitch('disable-gpu');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const isDev = process.env.NODE_ENV === 'development';
  const preloadPath = path.join(__dirname, 'preload.js');
  const outDirectoryPath = path.resolve(__dirname, '..', '..', '..', 'out');
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
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173" 
        : "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      isDev 
        ? "connect-src 'self' http://localhost:5173 ws://localhost:5173" 
        : "connect-src 'self'",
    ];
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives.join('; ')],
      },
    });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://index.html');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    console.warn('Blocked window open attempt from renderer');
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigationTarget(url, isDev)) {
      event.preventDefault();
      console.warn('Blocked untrusted navigation target from renderer');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const outDirectoryPath = path.resolve(__dirname, '..', '..', '..', 'out');
  configureTrustedRendererFileEntrypoints([path.join(outDirectoryPath, 'index.html')]);

  // Register protocol for static files
  protocol.registerFileProtocol('app', (request, callback) => {
    const resolvedRequestPath = resolveAppProtocolRequestPath(request.url, outDirectoryPath);

    if (resolvedRequestPath === null) {
      console.warn('Blocked unsafe app protocol request');
      callback({ error: -10 });
      return;
    }

    callback({ path: resolvedRequestPath });
  });

  createWindow();
  
  setupDatabaseHandlers();
  setupLLMHandlers();
  setupSettingsHandlers();
  setupConductorHandlers();
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
