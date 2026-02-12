import { contextBridge, ipcRenderer } from 'electron';

const dbTagsAPI = Object.freeze({
  create: (name: string) => ipcRenderer.invoke('db:tag:create', name),
  getAll: () => ipcRenderer.invoke('db:tag:getAll'),
  getByName: (name: string) => ipcRenderer.invoke('db:tag:getByName', name),
  delete: (id: number) => ipcRenderer.invoke('db:tag:delete', id),
  cleanupOrphaned: () => ipcRenderer.invoke('db:tag:cleanupOrphaned'),
});

const dbSessionTagsAPI = Object.freeze({
  add: (sessionId: string, tagId: number) => ipcRenderer.invoke('db:sessionTag:add', sessionId, tagId),
  remove: (sessionId: string, tagId: number) => ipcRenderer.invoke('db:sessionTag:remove', sessionId, tagId),
  getBySession: (sessionId: string) => ipcRenderer.invoke('db:sessionTag:getBySession', sessionId),
});

// Database API
const dbAPI = Object.freeze({
  // Personas
  createPersona: (data: unknown) => ipcRenderer.invoke('db:persona:create', data),
  getPersonas: () => ipcRenderer.invoke('db:persona:getAll'),
  getPersona: (id: string) => ipcRenderer.invoke('db:persona:get', id),
  updatePersona: (id: string, data: unknown) => ipcRenderer.invoke('db:persona:update', id, data),
  deletePersona: (id: string) => ipcRenderer.invoke('db:persona:delete', id),
  
  // Messages
  createMessage: (data: unknown) => ipcRenderer.invoke('db:message:create', data),
  getMessages: (sessionId: string) => ipcRenderer.invoke('db:message:getBySession', sessionId),
  getNextTurnNumber: (sessionId: string) => ipcRenderer.invoke('db:message:getNextTurnNumber', sessionId),
  
  // Session Personas
  addPersonaToSession: (sessionId: string, personaId: string, isConductor: boolean) =>
    ipcRenderer.invoke('db:sessionPersona:add', sessionId, personaId, isConductor),
  getSessionPersonas: (sessionId: string) => ipcRenderer.invoke('db:sessionPersona:getBySession', sessionId),
  
  // Hush - "The Hush Button" feature
  hushPersona: (sessionId: string, personaId: string, turns: number) => 
    ipcRenderer.invoke('db:persona:hush', sessionId, personaId, turns),
  unhushPersona: (sessionId: string, personaId: string) => 
    ipcRenderer.invoke('db:persona:unhush', sessionId, personaId),
  
  // Tags
  tags: dbTagsAPI,
  sessionTags: dbSessionTagsAPI,
});

// LLM API
const llmAPI = Object.freeze({
  chat: (request: unknown) => ipcRenderer.invoke('llm:chat', request),
});

// Settings API
const settingsAPI = Object.freeze({
  getApiKeyStatus: () => ipcRenderer.invoke('settings:getApiKeyStatus'),
  setApiKey: (key: string) => ipcRenderer.invoke('settings:setApiKey', key),
  testConnection: () => ipcRenderer.invoke('settings:testConnection'),
  getDefaultModel: () => ipcRenderer.invoke('settings:getDefaultModel'),
  setDefaultModel: (defaultModel: string) => ipcRenderer.invoke('settings:setDefaultModel', defaultModel),
  getModelCatalog: () => ipcRenderer.invoke('settings:getModelCatalog'),
});

// Conductor API
const conductorAPI = Object.freeze({
  enable: (sessionId: string, mode: 'automatic' | 'manual') =>
    ipcRenderer.invoke('conductor:enable', { sessionId, mode }),
  disable: (sessionId: string) => ipcRenderer.invoke('conductor:disable', sessionId),
  processTurn: (sessionId: string) => ipcRenderer.invoke('conductor:processTurn', sessionId),
  resetCircuitBreaker: (sessionId: string) => ipcRenderer.invoke('conductor:resetCircuitBreaker', sessionId),
  getBlackboard: (sessionId: string) => ipcRenderer.invoke('conductor:getBlackboard', sessionId),
  updateBlackboard: (sessionId: string, blackboard: unknown) => 
    ipcRenderer.invoke('conductor:updateBlackboard', { sessionId, blackboard }),
});

// Export API
const exportAPI = Object.freeze({
  exportSessionToMarkdown: (sessionId: string) => 
    ipcRenderer.invoke('export:sessionToMarkdown', sessionId),
});

const sessionCommandAPI = Object.freeze({
  createFull: (command: unknown) => ipcRenderer.invoke('session:command:createFull', command),
  update: (sessionId: string, input: unknown) => ipcRenderer.invoke('session:command:update', sessionId, input),
  delete: (sessionId: string) => ipcRenderer.invoke('session:command:delete', sessionId),
  archive: (sessionId: string) => ipcRenderer.invoke('session:command:archive', sessionId),
  unarchive: (sessionId: string) => ipcRenderer.invoke('session:command:unarchive', sessionId),
});

const sessionQueryAPI = Object.freeze({
  list: () => ipcRenderer.invoke('session:query:list'),
  get: (sessionId: string) => ipcRenderer.invoke('session:query:get', sessionId),
  getParticipants: (sessionId: string) => ipcRenderer.invoke('session:query:participants', sessionId),
  loadSnapshot: (sessionId: string) => ipcRenderer.invoke('session:query:loadSnapshot', sessionId),
});

const diagnosticsAPI = Object.freeze({
  getStatus: () => ipcRenderer.invoke('diagnostics:getStatus'),
  openLogsDirectory: () => ipcRenderer.invoke('diagnostics:openLogsDirectory'),
  getSummary: () => ipcRenderer.invoke('diagnostics:getSummary'),
  exportBundle: () => ipcRenderer.invoke('diagnostics:exportBundle'),
});

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electronDB', dbAPI);
contextBridge.exposeInMainWorld('electronLLM', llmAPI);
contextBridge.exposeInMainWorld('electronSettings', settingsAPI);
contextBridge.exposeInMainWorld('electronConductor', conductorAPI);
contextBridge.exposeInMainWorld('electronExport', exportAPI);
contextBridge.exposeInMainWorld('electronSessionCommand', sessionCommandAPI);
contextBridge.exposeInMainWorld('electronSessionQuery', sessionQueryAPI);
contextBridge.exposeInMainWorld('electronDiagnostics', diagnosticsAPI);

export type ElectronDB = typeof dbAPI;
export type ElectronLLM = typeof llmAPI;
export type ElectronSettings = typeof settingsAPI;
export type ElectronConductor = typeof conductorAPI;
export type ElectronExport = typeof exportAPI;
export type ElectronSessionCommand = typeof sessionCommandAPI;
export type ElectronSessionQuery = typeof sessionQueryAPI;
export type ElectronDiagnostics = typeof diagnosticsAPI;
