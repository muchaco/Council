"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const db_js_1 = require("./handlers/db.js");
const llm_js_1 = require("./handlers/llm.js");
const settings_js_1 = require("./handlers/settings.js");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
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
    }
    else {
        // In production, use the static build with hash-based routing
        const indexPath = path_1.default.join(__dirname, '..', '..', 'out', 'index.html');
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
electron_1.app.whenReady().then(() => {
    // Register protocol for static files
    electron_1.protocol.registerFileProtocol('app', (request, callback) => {
        const url = request.url.substr(6); // Remove 'app://'
        const filePath = path_1.default.join(__dirname, '..', '..', 'out', url);
        callback({ path: filePath });
    });
    createWindow();
    (0, db_js_1.setupDatabaseHandlers)();
    (0, llm_js_1.setupLLMHandlers)();
    (0, settings_js_1.setupSettingsHandlers)();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
//# sourceMappingURL=main.js.map