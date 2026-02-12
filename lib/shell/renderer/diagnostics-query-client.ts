import { getRendererBridge } from './renderer-bridge';

export const loadDiagnosticsStatusQuery = async (): Promise<{
  success: boolean;
  data?: {
    sessionId: string;
    logDirectoryPath: string;
    logFilePath: string;
  };
  error?: string;
}> => getRendererBridge().electronDiagnostics.getStatus();

export const loadDiagnosticsSummaryQuery = async (): Promise<{
  success: boolean;
  data?: { summary: string };
  error?: string;
}> => getRendererBridge().electronDiagnostics.getSummary();
