import { describe, expect } from "vitest";
import { createAssistantAuditService } from "../../src/main/services/assistant/assistant-audit-service";
import {
  sanitizeAssistantAuditPayload,
  sanitizeAssistantContext,
  summarizeAssistantUserRequest,
  summarizeAssistantUserTurnResponse,
} from "../../src/shared/assistant/assistant-audit";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["R9.19", "R9.20", "A3", "F2"] as const;

describe("assistant audit sanitization", () => {
  itReq(
    FILE_REQUIREMENT_IDS,
    "redacts secrets prompts and raw paths from context and audit payloads",
    () => {
      const context = sanitizeAssistantContext({
        viewKind: "settings",
        contextLabel: "Settings /tmp/private notes.txt",
        activeEntityId: null,
        selectionIds: [],
        listState: null,
        draftState: {
          entityKind: "settings",
          entityId: null,
          dirty: true,
          changedFields: ["apiKey", "rawPrompt"],
          summary: "Bearer secret-token and /var/tmp/hidden notes.txt",
        },
        runtimeState: null,
      });

      expect(context.contextLabel).toBe("Settings [redacted]");
      expect(context.draftState?.summary).not.toContain("secret-token");
      expect(context.draftState?.summary).not.toContain("hidden notes.txt");

      const payload = sanitizeAssistantAuditPayload({
        apiKey: "sk-secret",
        nested: {
          filePath: "/tmp/audit logs/latest.log",
          prompt: "raw prompt text",
        },
      });

      expect(payload).toEqual({
        apiKey: "[redacted]",
        nested: {
          filePath: "[redacted]",
          prompt: "[redacted]",
        },
      });
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "fully redacts path-like values that contain spaces", () => {
    expect(
      sanitizeAssistantAuditPayload({
        note: "Inspect ../private folder/notes.md before saving",
        windowsPath: "C:\\Program Files\\Council\\config.json",
        windowsForwardSlashPath: "C:/Program Files/Council/config.json",
      }),
    ).toEqual({
      note: "Inspect [redacted] before saving",
      windowsPath: "[redacted]",
      windowsForwardSlashPath: "[redacted]",
    });
  });

  itReq(FILE_REQUIREMENT_IDS, "logs only sanitized assistant audit payloads", () => {
    const entries: Array<Record<string, unknown>> = [];
    const service = createAssistantAuditService({
      info: () => {},
      error: () => {},
      logWideEvent: (entry) => entries.push(entry),
    });

    service.record({
      eventType: "submit-started",
      sessionId: "00000000-0000-4000-8000-000000000001",
      occurredAtUtc: "2026-03-12T12:00:00.000Z",
      payload: {
        filePath: "/tmp/secret folder/report.txt",
        apiKey: "sk-123",
      },
    });

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry).toBeDefined();
    expect(entry?.payload).toEqual({
      filePath: "[redacted]",
      apiKey: "[redacted]",
    });
  });

  itReq(FILE_REQUIREMENT_IDS, "summarizes assistant request text instead of persisting it", () => {
    const requestSummary = summarizeAssistantUserRequest(
      "Open ../private/plan.md with Bearer top-secret",
    );
    const clarificationSummary = summarizeAssistantUserTurnResponse({
      kind: "clarification",
      text: "Use ~/notes.txt instead",
    });
    const confirmationSummary = summarizeAssistantUserTurnResponse({
      kind: "confirmation",
      approved: true,
    });

    expect(requestSummary).toEqual({
      characterCount: 46,
      lineCount: 1,
      containsUnsafePathLikeText: true,
      containsSecretLikeText: true,
    });
    expect(clarificationSummary).toEqual({
      kind: "clarification",
      text: {
        characterCount: 23,
        lineCount: 1,
        containsUnsafePathLikeText: true,
        containsSecretLikeText: false,
      },
    });
    expect(confirmationSummary).toEqual({
      kind: "confirmation",
      approved: true,
    });
  });
});
