import type { BlackboardState } from '../../types';

interface RendererBridge {
  readonly electronDB: {
    readonly hushPersona: (
      sessionId: string,
      personaId: string,
      turns: number
    ) => Promise<{ success: boolean; error?: string }>;
    readonly unhushPersona: (
      sessionId: string,
      personaId: string
    ) => Promise<{ success: boolean; error?: string }>;
    readonly getNextTurnNumber: (
      sessionId: string
    ) => Promise<{ success: boolean; data?: number; error?: string }>;
    readonly createMessage: (
      data: unknown
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    readonly tags: {
      readonly getAll: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
    };
  };
  readonly electronConductor: {
    readonly enable: (
      sessionId: string,
      mode: 'automatic' | 'manual'
    ) => Promise<{ success: boolean; error?: string }>;
    readonly disable: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    readonly resetCircuitBreaker: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    readonly processTurn: (sessionId: string) => Promise<unknown>;
    readonly updateBlackboard: (
      sessionId: string,
      blackboard: BlackboardState
    ) => Promise<{ success: boolean; error?: string }>;
  };
  readonly electronExport: {
    readonly exportSessionToMarkdown: (sessionId: string) => Promise<unknown>;
  };
  readonly electronSessionCommand: {
    readonly createFull: (command: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    readonly update: (
      sessionId: string,
      input: unknown
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    readonly delete: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    readonly archive: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    readonly unarchive: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  };
  readonly electronSessionQuery: {
    readonly list: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
    readonly get: (sessionId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    readonly getParticipants: (
      sessionId: string
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    readonly loadSnapshot: (sessionId: string) => Promise<{
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
  readonly electronSettings: {
    readonly setApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
    readonly testConnection: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
    readonly setDefaultModel: (defaultModel: string) => Promise<{ success: boolean; error?: string }>;
    readonly getApiKeyStatus: () => Promise<{
      success: boolean;
      data?: { configured: boolean };
      error?: string;
    }>;
    readonly getDefaultModel: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
    readonly getModelCatalog: () => Promise<{
      success: boolean;
      data?: {
        configured: boolean;
        models: Array<{
          name: string;
          displayName: string;
          description: string;
          supportedMethods: string[];
        }>;
        fetchedAtEpochMs: number | null;
      };
      error?: string;
    }>;
    // Provider abstraction methods
    readonly setProviderConfig: (config: {
      providerId: string;
      apiKey: string;
      defaultModel: string;
      isEnabled: boolean;
    }) => Promise<{ success: boolean; error?: string }>;
    readonly setDefaultProvider: (providerId: string) => Promise<{ success: boolean; error?: string }>;
    readonly getProviderConfig: (providerId: string) => Promise<{
      success: boolean;
      data?: {
        providerId: string;
        apiKey: string;
        defaultModel: string;
        isEnabled: boolean;
      };
      error?: string;
    }>;
    readonly getDefaultProvider: () => Promise<{
      success: boolean;
      data?: string;
      error?: string;
    }>;
    readonly listAvailableModels: (providerId: string) => Promise<{
      success: boolean;
      data?: {
        configured: boolean;
        models: Array<{
          name: string;
          displayName: string;
          description: string;
          supportedMethods: string[];
        }>;
        fetchedAtEpochMs: number | null;
      };
      error?: string;
    }>;
  };
  readonly electronDiagnostics: {
    readonly getStatus: () => Promise<{
      success: boolean;
      data?: {
        sessionId: string;
        logDirectoryPath: string;
        logFilePath: string;
      };
      error?: string;
    }>;
    readonly openLogsDirectory: () => Promise<{ success: boolean; error?: string }>;
    readonly getSummary: () => Promise<{
      success: boolean;
      data?: { summary: string };
      error?: string;
    }>;
    readonly exportBundle: () => Promise<{
      success: boolean;
      cancelled?: boolean;
      filePath?: string;
      error?: string;
    }>;
  };
}

export const getRendererBridge = (): RendererBridge => globalThis as unknown as RendererBridge;
