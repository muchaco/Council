import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, dialog } from "electron";
import { buildMainWindowOptions } from "./main-window-options.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createMainWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow(buildMainWindowOptions());

  mainWindow.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      buttons: ["Leave", "Stay"],
      defaultId: 1,
      cancelId: 1,
      message: "You have unsaved changes.",
      detail: "If you leave now, your unsaved changes will be lost.",
    });

    if (choice === 0) {
      event.preventDefault();
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl !== undefined) {
    void mainWindow.loadURL(devServerUrl);
    return mainWindow;
  }

  const rendererIndexPath = path.resolve(__dirname, "../../renderer/index.html");
  void mainWindow.loadFile(rendererIndexPath);

  return mainWindow;
};
