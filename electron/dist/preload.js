"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Database API
const dbAPI = {
    // Personas
    createPersona: (data) => electron_1.ipcRenderer.invoke('db:persona:create', data),
    getPersonas: () => electron_1.ipcRenderer.invoke('db:persona:getAll'),
    getPersona: (id) => electron_1.ipcRenderer.invoke('db:persona:get', id),
    updatePersona: (id, data) => electron_1.ipcRenderer.invoke('db:persona:update', id, data),
    deletePersona: (id) => electron_1.ipcRenderer.invoke('db:persona:delete', id),
    // Sessions
    createSession: (data) => electron_1.ipcRenderer.invoke('db:session:create', data),
    getSessions: () => electron_1.ipcRenderer.invoke('db:session:getAll'),
    getSession: (id) => electron_1.ipcRenderer.invoke('db:session:get', id),
    updateSession: (id, data) => electron_1.ipcRenderer.invoke('db:session:update', id, data),
    deleteSession: (id) => electron_1.ipcRenderer.invoke('db:session:delete', id),
    // Messages
    createMessage: (data) => electron_1.ipcRenderer.invoke('db:message:create', data),
    getMessages: (sessionId) => electron_1.ipcRenderer.invoke('db:message:getBySession', sessionId),
    // Session Personas
    addPersonaToSession: (sessionId, personaId, isOrchestrator) => electron_1.ipcRenderer.invoke('db:sessionPersona:add', sessionId, personaId, isOrchestrator),
    getSessionPersonas: (sessionId) => electron_1.ipcRenderer.invoke('db:sessionPersona:getBySession', sessionId),
    // Hush - "The Hush Button" feature
    hushPersona: (sessionId, personaId, turns) => electron_1.ipcRenderer.invoke('db:persona:hush', sessionId, personaId, turns),
    unhushPersona: (sessionId, personaId) => electron_1.ipcRenderer.invoke('db:persona:unhush', sessionId, personaId),
    // Archive
    archiveSession: (id) => electron_1.ipcRenderer.invoke('db:session:archive', id),
    unarchiveSession: (id) => electron_1.ipcRenderer.invoke('db:session:unarchive', id),
    // Tags
    tags: {
        create: (name) => electron_1.ipcRenderer.invoke('db:tag:create', name),
        getAll: () => electron_1.ipcRenderer.invoke('db:tag:getAll'),
        getByName: (name) => electron_1.ipcRenderer.invoke('db:tag:getByName', name),
        delete: (id) => electron_1.ipcRenderer.invoke('db:tag:delete', id),
        cleanupOrphaned: () => electron_1.ipcRenderer.invoke('db:tag:cleanupOrphaned'),
    },
    sessionTags: {
        add: (sessionId, tagId) => electron_1.ipcRenderer.invoke('db:sessionTag:add', sessionId, tagId),
        remove: (sessionId, tagId) => electron_1.ipcRenderer.invoke('db:sessionTag:remove', sessionId, tagId),
        getBySession: (sessionId) => electron_1.ipcRenderer.invoke('db:sessionTag:getBySession', sessionId),
    },
};
// LLM API
const llmAPI = {
    chat: (request) => electron_1.ipcRenderer.invoke('llm:chat', request),
};
// Settings API
const settingsAPI = {
    getApiKey: () => electron_1.ipcRenderer.invoke('settings:getApiKey'),
    setApiKey: (key) => electron_1.ipcRenderer.invoke('settings:setApiKey', key),
    testConnection: () => electron_1.ipcRenderer.invoke('settings:testConnection'),
    getSetting: (key) => electron_1.ipcRenderer.invoke('settings:get', key),
    setSetting: (key, value) => electron_1.ipcRenderer.invoke('settings:set', key, value),
    listModels: () => electron_1.ipcRenderer.invoke('settings:listModels'),
};
// Orchestrator API
const orchestratorAPI = {
    enable: (sessionId, orchestratorPersonaId) => electron_1.ipcRenderer.invoke('orchestrator:enable', { sessionId, orchestratorPersonaId }),
    disable: (sessionId) => electron_1.ipcRenderer.invoke('orchestrator:disable', sessionId),
    processTurn: (sessionId) => electron_1.ipcRenderer.invoke('orchestrator:processTurn', sessionId),
    resetCircuitBreaker: (sessionId) => electron_1.ipcRenderer.invoke('orchestrator:resetCircuitBreaker', sessionId),
    getBlackboard: (sessionId) => electron_1.ipcRenderer.invoke('orchestrator:getBlackboard', sessionId),
    updateBlackboard: (sessionId, blackboard) => electron_1.ipcRenderer.invoke('orchestrator:updateBlackboard', { sessionId, blackboard }),
};
// Export API
const exportAPI = {
    exportSessionToMarkdown: (sessionId) => electron_1.ipcRenderer.invoke('export:sessionToMarkdown', sessionId),
};
// Expose APIs to renderer
electron_1.contextBridge.exposeInMainWorld('electronDB', dbAPI);
electron_1.contextBridge.exposeInMainWorld('electronLLM', llmAPI);
electron_1.contextBridge.exposeInMainWorld('electronSettings', settingsAPI);
electron_1.contextBridge.exposeInMainWorld('electronOrchestrator', orchestratorAPI);
electron_1.contextBridge.exposeInMainWorld('electronExport', exportAPI);
//# sourceMappingURL=preload.js.map