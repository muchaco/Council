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
    setContextLastN: async (request) => ipcRenderer.invoke("settings:set-context-last-n", request),
  },
  providers: {
    testConnection: async (request) => ipcRenderer.invoke("providers:test-connection", request),
    saveConfig: async (request) => ipcRenderer.invoke("providers:save-config", request),
    disconnect: async (request) => ipcRenderer.invoke("providers:disconnect", request),
    refreshModelCatalog: async (request) =>
      ipcRenderer.invoke("providers:refresh-model-catalog", request),
  },
  agents: {
    list: async (request) => ipcRenderer.invoke("agents:list", request),
    getEditorView: async (request) => ipcRenderer.invoke("agents:get-editor-view", request),
    save: async (request) => ipcRenderer.invoke("agents:save", request),
    delete: async (request) => ipcRenderer.invoke("agents:delete", request),
    setArchived: async (request) => ipcRenderer.invoke("agents:set-archived", request),
    refreshModelCatalog: async (request) =>
      ipcRenderer.invoke("agents:refresh-model-catalog", request),
  },
  councils: {
    list: async (request) => ipcRenderer.invoke("councils:list", request),
    getEditorView: async (request) => ipcRenderer.invoke("councils:get-editor-view", request),
    getCouncilView: async (request) => ipcRenderer.invoke("councils:get-view", request),
    save: async (request) => ipcRenderer.invoke("councils:save", request),
    delete: async (request) => ipcRenderer.invoke("councils:delete", request),
    setArchived: async (request) => ipcRenderer.invoke("councils:set-archived", request),
    start: async (request) => ipcRenderer.invoke("councils:start", request),
    pauseAutopilot: async (request) => ipcRenderer.invoke("councils:pause-autopilot", request),
    resumeAutopilot: async (request) => ipcRenderer.invoke("councils:resume-autopilot", request),
    generateManualTurn: async (request) =>
      ipcRenderer.invoke("councils:generate-manual-turn", request),
    injectConductorMessage: async (request) =>
      ipcRenderer.invoke("councils:inject-conductor-message", request),
    advanceAutopilotTurn: async (request) =>
      ipcRenderer.invoke("councils:advance-autopilot-turn", request),
    cancelGeneration: async (request) => ipcRenderer.invoke("councils:cancel-generation", request),
    exportTranscript: async (request) => ipcRenderer.invoke("councils:export-transcript", request),
    refreshModelCatalog: async (request) =>
      ipcRenderer.invoke("councils:refresh-model-catalog", request),
  },
  assistant: {
    createSession: async (request) => ipcRenderer.invoke("assistant:create-session", request),
    submit: async (request) => ipcRenderer.invoke("assistant:submit", request),
    cancelSession: async (request) => ipcRenderer.invoke("assistant:cancel-session", request),
    closeSession: async (request) => ipcRenderer.invoke("assistant:close-session", request),
  },
};

contextBridge.exposeInMainWorld("api", windowApi);
