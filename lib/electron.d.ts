// Type declarations for Electron APIs

declare global {
  interface Window {
    electronDB: {
      createPersona: (data: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      getPersonas: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
      getPersona: (id: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      updatePersona: (id: string, data: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      deletePersona: (id: string) => Promise<{ success: boolean; error?: string }>;
      createSession: (data: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      getSessions: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
      getSession: (id: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      updateSession: (id: string, data: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      deleteSession: (id: string) => Promise<{ success: boolean; error?: string }>;
      createMessage: (data: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      getMessages: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      addPersonaToSession: (sessionId: string, personaId: string, isOrchestrator: boolean) => Promise<{ success: boolean; error?: string }>;
      getSessionPersonas: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    };
    electronLLM: {
      chat: (request: unknown) => Promise<{ success: boolean; data?: { content: string; tokenCount: number }; error?: string }>;
    };
    electronSettings: {
      getApiKey: () => Promise<{ success: boolean; data?: string | null; error?: string }>;
      setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
      testConnection: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
      getSetting: (key: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      setSetting: (key: string, value: unknown) => Promise<{ success: boolean; error?: string }>;
      listModels: () => Promise<{ success: boolean; data?: Array<{ name: string; displayName: string; description: string; supportedMethods: string[] }>; error?: string }>;
    };
  }
}

export {};
