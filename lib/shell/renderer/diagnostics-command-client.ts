import { getRendererBridge } from './renderer-bridge';

export const openDiagnosticsLogsDirectoryCommand = async (): Promise<{
  success: boolean;
  error?: string;
}> => getRendererBridge().electronDiagnostics.openLogsDirectory();

export const exportDiagnosticsBundleCommand = async (): Promise<{
  success: boolean;
  cancelled?: boolean;
  filePath?: string;
  error?: string;
}> => getRendererBridge().electronDiagnostics.exportBundle();
