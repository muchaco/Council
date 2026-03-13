import { describe, expect } from "vitest";
import {
  ASSISTANT_CANCEL_SESSION_REQUEST_SCHEMA,
  ASSISTANT_CONTEXT_ENVELOPE_SCHEMA,
  ASSISTANT_CREATE_SESSION_REQUEST_SCHEMA,
  ASSISTANT_PLAN_RESULT_SCHEMA,
  ASSISTANT_SUBMIT_REQUEST_SCHEMA,
} from "../../src/shared/ipc/validators";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["R9.4", "R9.11", "R9.17", "R9.19", "A3"] as const;

describe("assistant ipc validators", () => {
  itReq(FILE_REQUIREMENT_IDS, "accepts valid assistant session and submit payloads", () => {
    expect(
      ASSISTANT_CREATE_SESSION_REQUEST_SCHEMA.safeParse({
        viewKind: "agentsList",
      }).success,
    ).toBe(true);

    expect(
      ASSISTANT_SUBMIT_REQUEST_SCHEMA.safeParse({
        sessionId: "00000000-0000-4000-8000-000000000001",
        userRequest: "Open the agents tab",
        context: {
          viewKind: "agentsList",
          contextLabel: "Agents",
          activeEntityId: null,
          selectionIds: [],
          listState: {
            searchText: "planner",
            tagFilter: "ops",
            sortBy: "updatedAt",
            sortDirection: "desc",
            archivedFilter: "all",
          },
          draftState: null,
          runtimeState: null,
        },
        response: null,
      }).success,
    ).toBe(true);

    expect(
      ASSISTANT_SUBMIT_REQUEST_SCHEMA.safeParse({
        sessionId: "00000000-0000-4000-8000-000000000001",
        userRequest: "Pause this council runtime",
        context: {
          viewKind: "councilView",
          contextLabel: "Council view / Runtime",
          activeEntityId: "00000000-0000-4000-8000-000000000111",
          selectionIds: [],
          listState: null,
          draftState: null,
          runtimeState: {
            leaseId: "00000000-0000-4000-8000-000000000112",
            councilId: "00000000-0000-4000-8000-000000000111",
            plannedNextSpeakerAgentId: null,
            status: "running",
          },
        },
        response: null,
      }).success,
    ).toBe(true);
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "rejects assistant payloads with invalid ids and unknown fields",
    () => {
      expect(
        ASSISTANT_CANCEL_SESSION_REQUEST_SCHEMA.safeParse({
          sessionId: "not-a-uuid",
        }).success,
      ).toBe(false);

      expect(
        ASSISTANT_CONTEXT_ENVELOPE_SCHEMA.safeParse({
          viewKind: "agentsList",
          contextLabel: "Agents",
          activeEntityId: null,
          selectionIds: [],
          listState: null,
          draftState: null,
          runtimeState: null,
          secret: "leak",
        }).success,
      ).toBe(false);
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "normalizes unsafe assistant context strings before they cross ipc",
    () => {
      const parsed = ASSISTANT_CONTEXT_ENVELOPE_SCHEMA.safeParse({
        viewKind: "agentsList",
        contextLabel: "Agents /tmp/private notes.txt",
        activeEntityId: null,
        selectionIds: [],
        listState: {
          searchText: "../secret folder/notes.txt",
          tagFilter: "ops",
          sortBy: "updatedAt",
          sortDirection: "desc",
          archivedFilter: "all",
        },
        draftState: {
          entityKind: "settings",
          entityId: null,
          dirty: true,
          changedFields: ["endpointUrl"],
          summary: "See ~/private notes/notes.md",
        },
        runtimeState: null,
      });

      expect(parsed.success).toBe(true);
      if (!parsed.success) {
        return;
      }

      expect(parsed.data.contextLabel).toContain("[redacted]");
      expect(parsed.data.listState?.searchText).toBe("[redacted]");
      expect(parsed.data.draftState?.summary).toContain("[redacted]");
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "sanitizes assistant submit text before it reaches main", () => {
    const parsed = ASSISTANT_SUBMIT_REQUEST_SCHEMA.safeParse({
      sessionId: "00000000-0000-4000-8000-000000000001",
      userRequest: "Open /tmp/private notes.txt with Bearer top-secret",
      context: {
        viewKind: "agentsList",
        contextLabel: "Agents",
        activeEntityId: null,
        selectionIds: [],
        listState: null,
        draftState: null,
        runtimeState: null,
      },
      response: {
        kind: "clarification",
        text: "Use ../secret notes/notes.md instead",
      },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.userRequest).toBe("Open [redacted] with [redacted]");
    expect(parsed.data.response).toEqual({
      kind: "clarification",
      text: "Use [redacted] instead",
    });
  });

  itReq(FILE_REQUIREMENT_IDS, "accepts normalized assistant result states", () => {
    const parsed = ASSISTANT_PLAN_RESULT_SCHEMA.safeParse({
      kind: "result",
      sessionId: "00000000-0000-4000-8000-000000000001",
      outcome: "failure",
      message: "Assistant planning is not enabled yet.",
      planSummary: null,
      plannedCalls: [],
      executionResults: [],
      error: {
        kind: "PolicyError",
        userMessage: "Assistant planning is not enabled yet.",
        developerMessage: "Assistant planning is not enabled yet.",
        retryable: false,
        details: null,
      },
      requiresUserAction: false,
      destinationLabel: null,
    });

    expect(parsed.success).toBe(true);
  });
});
