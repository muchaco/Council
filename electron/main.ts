import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import { logDiagnosticsError, logDiagnosticsEvent } from './lib/diagnostics/logger.js';
import { setupDatabaseHandlers } from './handlers/db.js';
import { setupLLMHandlers } from './handlers/llm.js';
import { setupSettingsHandlers } from './handlers/settings.js';
import { setupConductorHandlers } from './handlers/conductor.js';
import { setupExportHandlers } from './handlers/export.js';
import { setupSessionStateHandlers } from './handlers/session-state-handlers.js';
import { setupDiagnosticsHandlers } from './handlers/diagnostics.js';
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
  logDiagnosticsEvent({
    event_name: 'app.window.create.started',
    context: {
      preload_path: preloadPath,
      is_development: isDev,
    },
  });
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Log preload script loading errors
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    logDiagnosticsError('app.window.preload_error', error, {
      preload_path: preloadPath,
    });
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
    logDiagnosticsEvent({
      event_name: 'app.security.window_open_blocked',
      level: 'error',
    });
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigationTarget(url, isDev)) {
      event.preventDefault();
      logDiagnosticsEvent({
        event_name: 'app.security.navigation_blocked',
        level: 'error',
        context: {
          url,
        },
      });
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
      logDiagnosticsEvent({
        event_name: 'app.security.protocol_request_blocked',
        level: 'error',
        context: {
          url: request.url,
        },
      });
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
  setupSessionStateHandlers();
  setupDiagnosticsHandlers();

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
