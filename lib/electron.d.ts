// Type declarations for Electron APIs

interface Tag {
  id: number;
  name: string;
  createdAt: string;
}

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
      getNextTurnNumber: (sessionId: string) => Promise<{ success: boolean; data?: number; error?: string }>;
      addPersonaToSession: (sessionId: string, personaId: string, isConductor: boolean) => Promise<{ success: boolean; error?: string }>;
      getSessionPersonas: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      hushPersona: (sessionId: string, personaId: string, turns: number) => Promise<{ success: boolean; error?: string }>;
      unhushPersona: (sessionId: string, personaId: string) => Promise<{ success: boolean; error?: string }>;
      archiveSession: (id: string) => Promise<{ success: boolean; error?: string }>;
      unarchiveSession: (id: string) => Promise<{ success: boolean; error?: string }>;
      tags: {
        create: (name: string) => Promise<{ success: boolean; data?: Tag; error?: string }>;
        getAll: () => Promise<{ success: boolean; data?: Tag[]; error?: string }>;
        getByName: (name: string) => Promise<{ success: boolean; data?: Tag | null; error?: string }>;
        delete: (id: number) => Promise<{ success: boolean; error?: string }>;
        cleanupOrphaned: () => Promise<{ success: boolean; error?: string }>;
      };
      sessionTags: {
        add: (sessionId: string, tagId: number) => Promise<{ success: boolean; error?: string }>;
        remove: (sessionId: string, tagId: number) => Promise<{ success: boolean; error?: string }>;
        getBySession: (sessionId: string) => Promise<{ success: boolean; data?: string[]; error?: string }>;
      };
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
    electronConductor: {
      enable: (sessionId: string, conductorPersonaId: string) => Promise<{ success: boolean; error?: string }>;
      disable: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
      processTurn: (sessionId: string) => Promise<{ 
        success: boolean; 
        action?: string;
        personaId?: string;
        reasoning?: string;
        blackboardUpdate?: unknown;
        isIntervention?: boolean;
        autoReplyCount?: number;
        warning?: string;
        code?: string;
        error?: string;
      }>;
      resetCircuitBreaker: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
      getBlackboard: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      updateBlackboard: (sessionId: string, blackboard: unknown) => Promise<{ success: boolean; error?: string }>;
    };
    electronExport: {
      exportSessionToMarkdown: (sessionId: string) => Promise<{ 
        success: boolean; 
        filePath?: string; 
        cancelled?: boolean;
        messageCount?: number;
        error?: string;
      }>;
    };
  }
}

export {};
