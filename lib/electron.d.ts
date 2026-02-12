// Type declarations for Electron APIs

import type { ConductorProcessTurnResponse } from './types';

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
      getApiKeyStatus: () => Promise<{ success: boolean; data?: { configured: boolean }; error?: string }>;
      setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
      testConnection: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
      getDefaultModel: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
      setDefaultModel: (defaultModel: string) => Promise<{ success: boolean; error?: string }>;
      getModelCatalog: () => Promise<{
        success: boolean;
        data?: {
          configured: boolean;
          models: Array<{ name: string; displayName: string; description: string; supportedMethods: string[] }>;
          fetchedAtEpochMs: number | null;
        };
        error?: string;
      }>;
      listModels: () => Promise<{ success: boolean; data?: Array<{ name: string; displayName: string; description: string; supportedMethods: string[] }>; error?: string }>;
    };
    electronConductor: {
      enable: (sessionId: string, mode: 'automatic' | 'manual') => Promise<{ success: boolean; error?: string }>;
      disable: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
      processTurn: (sessionId: string) => Promise<ConductorProcessTurnResponse>;
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
    electronSessionCommand: {
      createFull: (command: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      update: (sessionId: string, input: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      delete: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
      archive: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
      unarchive: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    };
    electronSessionQuery: {
      list: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
      get: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      getParticipants: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      loadSnapshot: (sessionId: string) => Promise<{
        success: boolean;
        data?: {
          session: unknown;
          messages: unknown;
          participants: unknown;
          tags: unknown;
        } | null;
        error?: string;
      }>;
    };
  }
}

export {};
