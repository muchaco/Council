import { sanitizeAssistantAuditPayload } from "../../../shared/assistant/assistant-audit.js";
import type { Logger } from "../../logging/index.js";

export type AssistantAuditEventType =
  | "session-created"
  | "submit-started"
  | "planner-returned"
  | "execution-started"
  | "execution-finished"
  | "submit-finished"
  | "session-cancelled"
  | "session-closed";

export type AssistantAuditService = {
  record: (event: {
    eventType: AssistantAuditEventType;
    sessionId: string;
    occurredAtUtc: string;
    payload: Record<string, unknown>;
  }) => void;
};

export const createAssistantAuditService = (logger: Logger): AssistantAuditService => ({
  record: (event): void => {
    logger.logWideEvent({
      timestamp: event.occurredAtUtc,
      level: "info",
      component: "assistant-audit",
      operation: event.eventType,
      assistantSessionId: event.sessionId,
      payload: sanitizeAssistantAuditPayload(event.payload),
    });
  },
});
