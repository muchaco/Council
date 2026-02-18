import { BrowserWindow, app } from "electron";
import { registerIpcHandlers } from "./ipc/register-ipc.js";
import { createMainWindow } from "./windows/create-main-window.js";

const bootstrap = (): void => {
  const ipcRuntime = registerIpcHandlers();
  app.on("web-contents-created", (_event, webContents) => {
    webContents.once("destroyed", () => {
      ipcRuntime.releaseWebContentsResources(webContents.id);
    });
  });

  createMainWindow();
};

app.whenReady().then(() => {
  bootstrap();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
