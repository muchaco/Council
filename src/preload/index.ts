import { contextBridge, ipcRenderer } from "electron";
import type { WindowApi } from "../shared/ipc/window-api.js";

const windowApi: WindowApi = {
  health: {
    ping: async (request) => ipcRenderer.invoke("health:ping", request),
  },
  settings: {
    getView: async (request) => ipcRenderer.invoke("settings:get-view", request),
    setGlobalDefaultModel: async (request) =>
      ipcRenderer.invoke("settings:set-global-default-model", request),
  },
  providers: {
    testConnection: async (request) => ipcRenderer.invoke("providers:test-connection", request),
    saveConfig: async (request) => ipcRenderer.invoke("providers:save-config", request),
    refreshModelCatalog: async (request) =>
      ipcRenderer.invoke("providers:refresh-model-catalog", request),
  },
  agents: {
    list: async (request) => ipcRenderer.invoke("agents:list", request),
    getEditorView: async (request) => ipcRenderer.invoke("agents:get-editor-view", request),
    save: async (request) => ipcRenderer.invoke("agents:save", request),
    delete: async (request) => ipcRenderer.invoke("agents:delete", request),
    refreshModelCatalog: async (request) =>
      ipcRenderer.invoke("agents:refresh-model-catalog", request),
  },
  councils: {
    list: async (request) => ipcRenderer.invoke("councils:list", request),
    getEditorView: async (request) => ipcRenderer.invoke("councils:get-editor-view", request),
    save: async (request) => ipcRenderer.invoke("councils:save", request),
    delete: async (request) => ipcRenderer.invoke("councils:delete", request),
    setArchived: async (request) => ipcRenderer.invoke("councils:set-archived", request),
    refreshModelCatalog: async (request) =>
      ipcRenderer.invoke("councils:refresh-model-catalog", request),
  },
};

contextBridge.exposeInMainWorld("api", windowApi);
