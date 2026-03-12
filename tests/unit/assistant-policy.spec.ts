import { describe, expect } from "vitest";
import { z } from "zod";
import { resolveAssistantReconciliationState } from "../../src/shared/assistant/assistant-reconciliation";
import {
  classifyDirtyDraftImpact,
  resolveAssistantConfirmationRequirement,
  validateAssistantPlannedCall,
} from "../../src/shared/assistant/assistant-risk-policy";
import { defineAssistantTool } from "../../src/shared/assistant/assistant-tool-definitions";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["R9.9", "R9.11", "R9.13", "R9.14", "R9.22", "A1"] as const;

describe("assistant policy helpers", () => {
  itReq(
    FILE_REQUIREMENT_IDS,
    "validates known assistant tool payloads against shared schemas",
    () => {
      const result = validateAssistantPlannedCall({
        callId: "call-1",
        toolName: "navigateToHomeTab",
        rationale: "Move to the correct screen.",
        input: {
          tab: "agentsList",
        },
      });

      expect(result.ok).toBe(true);
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "rejects unknown assistant tools", () => {
    const result = validateAssistantPlannedCall({
      callId: "call-2",
      toolName: "deleteEverything",
      rationale: "nope",
      input: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe("UnknownToolError");
  });

  itReq(FILE_REQUIREMENT_IDS, "requires confirmation before replacing a dirty draft", () => {
    const tool = defineAssistantTool({
      name: "openAgentEditor",
      version: 1,
      category: "navigation",
      risk: "write",
      requiresConfirmation: false,
      confirmationPolicy: "when-dirty-draft-would-be-replaced",
      description: "Open a different agent editor.",
      inputSchema: z.object({ entityId: z.string().uuid() }).strict(),
      outputSchema: z.object({ entityId: z.string().uuid() }).strict(),
      reconciliation: {
        visibleTarget: "current-draft",
        strategy: "navigate-and-load",
        successCondition: "The requested editor is visible.",
      },
    });

    const context = {
      viewKind: "agentEdit",
      contextLabel: "Agent editor",
      activeEntityId: "00000000-0000-4000-8000-000000000001",
      selectionIds: [],
      listState: null,
      draftState: {
        entityKind: "agent",
        entityId: "00000000-0000-4000-8000-000000000001",
        dirty: true,
        changedFields: ["name"],
        summary: "Unsaved title change",
      },
      runtimeState: null,
    } as const;

    expect(
      classifyDirtyDraftImpact({
        context,
        toolDefinition: tool,
        plannedCall: {
          input: {
            entityId: "00000000-0000-4000-8000-000000000002",
          },
        },
      }),
    ).toBe("replace-current-draft");

    const decision = resolveAssistantConfirmationRequirement({
      context,
      toolDefinition: tool,
      plannedCall: {
        callId: "call-3",
        toolName: tool.name,
        rationale: "Open a different draft.",
        input: {
          entityId: "00000000-0000-4000-8000-000000000002",
        },
      },
    });

    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.reason).toBe("dirty-draft-replacement");
  });

  itReq(FILE_REQUIREMENT_IDS, "treats saving the current dirty draft as an in-place action", () => {
    const tool = defineAssistantTool({
      name: "saveAgentDraft",
      version: 1,
      category: "commit",
      risk: "write",
      requiresConfirmation: false,
      confirmationPolicy: "never",
      description: "Save the current agent draft.",
      inputSchema: z.object({ entityId: z.string().uuid().nullable().optional() }).strict(),
      outputSchema: z
        .object({ agentId: z.string().uuid().nullable(), agentName: z.string().nullable() })
        .strict(),
      reconciliation: {
        visibleTarget: "detail-view",
        strategy: "reload-entity",
        successCondition: "The editor shows saved data.",
      },
    });

    const context = {
      viewKind: "agentEdit",
      contextLabel: "Agent editor",
      activeEntityId: "00000000-0000-4000-8000-000000000001",
      selectionIds: [],
      listState: null,
      draftState: {
        entityKind: "agent",
        entityId: "00000000-0000-4000-8000-000000000001",
        dirty: true,
        changedFields: ["name"],
        summary: "Unsaved name change",
      },
      runtimeState: null,
    } as const;

    expect(
      classifyDirtyDraftImpact({
        context,
        toolDefinition: tool,
        plannedCall: {
          input: {
            entityId: "00000000-0000-4000-8000-000000000001",
          },
        },
      }),
    ).toBe("modify-current-draft");
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "tracks visible reconciliation completion separately from mutation success",
    () => {
      expect(
        resolveAssistantReconciliationState({
          reconciliation: null,
          visibleStateAligned: false,
          followUpRefreshPending: false,
        }),
      ).toBe("not-needed");

      expect(
        resolveAssistantReconciliationState({
          reconciliation: {
            visibleTarget: "detail-view",
            strategy: "reload-entity",
            successCondition: "Detail matches saved entity.",
          },
          visibleStateAligned: false,
          followUpRefreshPending: true,
        }),
      ).toBe("follow-up-refresh-in-progress");
    },
  );
});
