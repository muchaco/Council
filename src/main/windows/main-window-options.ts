import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REM_IN_PIXELS = 16;
const RENDERER_SHELL_MAX_WIDTH_REM = 72;
const RENDERER_MAIN_CONTENT_HORIZONTAL_PADDING_REM = 4;

export const MAIN_WINDOW_INITIAL_CONTENT_WIDTH_PX =
  (RENDERER_SHELL_MAX_WIDTH_REM + RENDERER_MAIN_CONTENT_HORIZONTAL_PADDING_REM) * REM_IN_PIXELS;

export const buildMainWindowOptions = (): Electron.BrowserWindowConstructorOptions => ({
  width: MAIN_WINDOW_INITIAL_CONTENT_WIDTH_PX,
  height: 840,
  useContentSize: true,
  show: false,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    preload: path.resolve(__dirname, "../../../preload/preload/index.js"),
  },
});
