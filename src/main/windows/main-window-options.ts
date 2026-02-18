import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const buildMainWindowOptions = (): Electron.BrowserWindowConstructorOptions => ({
  width: 1280,
  height: 840,
  show: false,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    preload: path.resolve(__dirname, "../../../preload/preload/index.js"),
  },
});
