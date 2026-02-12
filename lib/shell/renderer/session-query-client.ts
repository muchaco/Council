import { getRendererBridge } from './renderer-bridge';

export interface SessionSnapshotQueryResult {
  readonly sessionResult: { success: boolean; data?: unknown; error?: string };
  readonly messagesResult: { success: boolean; data?: unknown; error?: string };
  readonly participantsResult: { success: boolean; data?: unknown; error?: string };
  readonly tagsResult: { success: boolean; data?: unknown; error?: string };
}

export const loadSessionsQuery = async (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  getRendererBridge().electronSessionQuery.list();

export const loadSessionSnapshotQuery = async (
  sessionId: string
): Promise<SessionSnapshotQueryResult> => {
  const snapshotResult = await getRendererBridge().electronSessionQuery.loadSnapshot(sessionId);

  if (!snapshotResult.success || snapshotResult.data === null || snapshotResult.data === undefined) {
    return {
      sessionResult: { success: false, error: snapshotResult.error },
      messagesResult: { success: false, error: snapshotResult.error },
      participantsResult: { success: false, error: snapshotResult.error },
      tagsResult: { success: false, error: snapshotResult.error },
    };
  }

  return {
    sessionResult: { success: true, data: snapshotResult.data.session },
    messagesResult: { success: true, data: snapshotResult.data.messages },
    participantsResult: { success: true, data: snapshotResult.data.participants },
    tagsResult: { success: true, data: snapshotResult.data.tags },
  };
};

export const loadSessionByIdQuery = async (
  sessionId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  getRendererBridge().electronSessionQuery.get(sessionId);

export const loadSessionParticipantsQuery = async (
  sessionId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  getRendererBridge().electronSessionQuery.getParticipants(sessionId);

export const loadAllTagsQuery = async (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  getRendererBridge().electronDB.tags.getAll();
