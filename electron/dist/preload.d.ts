declare const dbAPI: {
    createPersona: (data: unknown) => Promise<any>;
    getPersonas: () => Promise<any>;
    getPersona: (id: string) => Promise<any>;
    updatePersona: (id: string, data: unknown) => Promise<any>;
    deletePersona: (id: string) => Promise<any>;
    createSession: (data: unknown) => Promise<any>;
    getSessions: () => Promise<any>;
    getSession: (id: string) => Promise<any>;
    updateSession: (id: string, data: unknown) => Promise<any>;
    deleteSession: (id: string) => Promise<any>;
    createMessage: (data: unknown) => Promise<any>;
    getMessages: (sessionId: string) => Promise<any>;
    addPersonaToSession: (sessionId: string, personaId: string, isOrchestrator: boolean) => Promise<any>;
    getSessionPersonas: (sessionId: string) => Promise<any>;
};
declare const llmAPI: {
    chat: (request: unknown) => Promise<any>;
};
declare const settingsAPI: {
    getApiKey: () => Promise<any>;
    setApiKey: (key: string) => Promise<any>;
    testConnection: () => Promise<any>;
    getSetting: (key: string) => Promise<any>;
    setSetting: (key: string, value: unknown) => Promise<any>;
};
export type ElectronDB = typeof dbAPI;
export type ElectronLLM = typeof llmAPI;
export type ElectronSettings = typeof settingsAPI;
export {};
//# sourceMappingURL=preload.d.ts.map