import { contextBridge, ipcRenderer } from 'electron';

// Database API
const dbAPI = {
  // Personas
  createPersona: (data: unknown) => ipcRenderer.invoke('db:persona:create', data),
  getPersonas: () => ipcRenderer.invoke('db:persona:getAll'),
  getPersona: (id: string) => ipcRenderer.invoke('db:persona:get', id),
  updatePersona: (id: string, data: unknown) => ipcRenderer.invoke('db:persona:update', id, data),
  deletePersona: (id: string) => ipcRenderer.invoke('db:persona:delete', id),
  
  // Sessions
  createSession: (data: unknown) => ipcRenderer.invoke('db:session:create', data),
  getSessions: () => ipcRenderer.invoke('db:session:getAll'),
  getSession: (id: string) => ipcRenderer.invoke('db:session:get', id),
  updateSession: (id: string, data: unknown) => ipcRenderer.invoke('db:session:update', id, data),
  deleteSession: (id: string) => ipcRenderer.invoke('db:session:delete', id),
  
  // Messages
  createMessage: (data: unknown) => ipcRenderer.invoke('db:message:create', data),
  getMessages: (sessionId: string) => ipcRenderer.invoke('db:message:getBySession', sessionId),
  
  // Session Personas
  addPersonaToSession: (sessionId: string, personaId: string, isOrchestrator: boolean) => 
    ipcRenderer.invoke('db:sessionPersona:add', sessionId, personaId, isOrchestrator),
  getSessionPersonas: (sessionId: string) => ipcRenderer.invoke('db:sessionPersona:getBySession', sessionId),
  
  // Archive
  archiveSession: (id: string) => ipcRenderer.invoke('db:session:archive', id),
  unarchiveSession: (id: string) => ipcRenderer.invoke('db:session:unarchive', id),
};

// LLM API
const llmAPI = {
  chat: (request: unknown) => ipcRenderer.invoke('llm:chat', request),
};

// Settings API
const settingsAPI = {
  getApiKey: () => ipcRenderer.invoke('settings:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('settings:setApiKey', key),
  testConnection: () => ipcRenderer.invoke('settings:testConnection'),
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  listModels: () => ipcRenderer.invoke('settings:listModels'),
};

// Orchestrator API
const orchestratorAPI = {
  enable: (sessionId: string, orchestratorPersonaId: string) => 
    ipcRenderer.invoke('orchestrator:enable', { sessionId, orchestratorPersonaId }),
  disable: (sessionId: string) => ipcRenderer.invoke('orchestrator:disable', sessionId),
  processTurn: (sessionId: string) => ipcRenderer.invoke('orchestrator:processTurn', sessionId),
  resetCircuitBreaker: (sessionId: string) => ipcRenderer.invoke('orchestrator:resetCircuitBreaker', sessionId),
  getBlackboard: (sessionId: string) => ipcRenderer.invoke('orchestrator:getBlackboard', sessionId),
  updateBlackboard: (sessionId: string, blackboard: unknown) => 
    ipcRenderer.invoke('orchestrator:updateBlackboard', { sessionId, blackboard }),
};

// Export API
const exportAPI = {
  exportSessionToMarkdown: (sessionId: string) => 
    ipcRenderer.invoke('export:sessionToMarkdown', sessionId),
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electronDB', dbAPI);
contextBridge.exposeInMainWorld('electronLLM', llmAPI);
contextBridge.exposeInMainWorld('electronSettings', settingsAPI);
contextBridge.exposeInMainWorld('electronOrchestrator', orchestratorAPI);
contextBridge.exposeInMainWorld('electronExport', exportAPI);

export type ElectronDB = typeof dbAPI;
export type ElectronLLM = typeof llmAPI;
export type ElectronSettings = typeof settingsAPI;
export type ElectronOrchestrator = typeof orchestratorAPI;
export type ElectronExport = typeof exportAPI;
