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
  addPersonaToSession: (sessionId: string, personaId: string, isConductor: boolean) =>
    ipcRenderer.invoke('db:sessionPersona:add', sessionId, personaId, isConductor),
  getSessionPersonas: (sessionId: string) => ipcRenderer.invoke('db:sessionPersona:getBySession', sessionId),
  
  // Hush - "The Hush Button" feature
  hushPersona: (sessionId: string, personaId: string, turns: number) => 
    ipcRenderer.invoke('db:persona:hush', sessionId, personaId, turns),
  unhushPersona: (sessionId: string, personaId: string) => 
    ipcRenderer.invoke('db:persona:unhush', sessionId, personaId),
  
  // Archive
  archiveSession: (id: string) => ipcRenderer.invoke('db:session:archive', id),
  unarchiveSession: (id: string) => ipcRenderer.invoke('db:session:unarchive', id),
  
  // Tags
  tags: {
    create: (name: string) => ipcRenderer.invoke('db:tag:create', name),
    getAll: () => ipcRenderer.invoke('db:tag:getAll'),
    getByName: (name: string) => ipcRenderer.invoke('db:tag:getByName', name),
    delete: (id: number) => ipcRenderer.invoke('db:tag:delete', id),
    cleanupOrphaned: () => ipcRenderer.invoke('db:tag:cleanupOrphaned'),
  },
  sessionTags: {
    add: (sessionId: string, tagId: number) => ipcRenderer.invoke('db:sessionTag:add', sessionId, tagId),
    remove: (sessionId: string, tagId: number) => ipcRenderer.invoke('db:sessionTag:remove', sessionId, tagId),
    getBySession: (sessionId: string) => ipcRenderer.invoke('db:sessionTag:getBySession', sessionId),
  },
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

// Conductor API
const conductorAPI = {
  enable: (sessionId: string, conductorPersonaId: string) =>
    ipcRenderer.invoke('conductor:enable', { sessionId, conductorPersonaId }),
  disable: (sessionId: string) => ipcRenderer.invoke('conductor:disable', sessionId),
  processTurn: (sessionId: string) => ipcRenderer.invoke('conductor:processTurn', sessionId),
  resetCircuitBreaker: (sessionId: string) => ipcRenderer.invoke('conductor:resetCircuitBreaker', sessionId),
  getBlackboard: (sessionId: string) => ipcRenderer.invoke('conductor:getBlackboard', sessionId),
  updateBlackboard: (sessionId: string, blackboard: unknown) => 
    ipcRenderer.invoke('conductor:updateBlackboard', { sessionId, blackboard }),
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
contextBridge.exposeInMainWorld('electronConductor', conductorAPI);
contextBridge.exposeInMainWorld('electronExport', exportAPI);

export type ElectronDB = typeof dbAPI;
export type ElectronLLM = typeof llmAPI;
export type ElectronSettings = typeof settingsAPI;
export type ElectronConductor = typeof conductorAPI;
export type ElectronExport = typeof exportAPI;
