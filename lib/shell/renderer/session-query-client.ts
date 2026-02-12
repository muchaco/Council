export interface SessionSnapshotQueryResult {
  readonly sessionResult: { success: boolean; data?: unknown; error?: string };
  readonly messagesResult: { success: boolean; data?: unknown; error?: string };
  readonly participantsResult: { success: boolean; data?: unknown; error?: string };
  readonly tagsResult: { success: boolean; data?: unknown; error?: string };
}

export const loadSessionsQuery = async (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  window.electronDB.getSessions();

export const loadSessionSnapshotQuery = async (
  sessionId: string
): Promise<SessionSnapshotQueryResult> => {
  const [sessionResult, messagesResult, participantsResult, tagsResult] = await Promise.all([
    window.electronDB.getSession(sessionId),
    window.electronDB.getMessages(sessionId),
    window.electronDB.getSessionPersonas(sessionId),
    window.electronDB.sessionTags.getBySession(sessionId),
  ]);

  return {
    sessionResult,
    messagesResult,
    participantsResult,
    tagsResult,
  };
};

export const loadSessionByIdQuery = async (
  sessionId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> => window.electronDB.getSession(sessionId);

export const loadSessionParticipantsQuery = async (
  sessionId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> => window.electronDB.getSessionPersonas(sessionId);

export const loadAllTagsQuery = async (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  window.electronDB.tags.getAll();
