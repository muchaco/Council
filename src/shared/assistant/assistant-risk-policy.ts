import type {
  AssistantContextEnvelope,
  AssistantDraftImpact,
  AssistantPlannedToolCall,
  AssistantToolExecutionError,
} from "../ipc/dto.js";
import {
  type AssistantToolDefinition,
  getAssistantToolDefinition,
} from "./assistant-tool-definitions.js";

export type AssistantConfirmationDecision = {
  requiresConfirmation: boolean;
  reason: "none" | "tool-policy" | "dirty-draft-replacement" | "bulk" | "inferred-scope";
  draftImpact: AssistantDraftImpact;
};

export const classifyDirtyDraftImpact = (params: {
  context: AssistantContextEnvelope;
  toolDefinition: Pick<AssistantToolDefinition, "name" | "reconciliation">;
  plannedCall: Pick<AssistantPlannedToolCall, "input">;
}): AssistantDraftImpact => {
  if (params.context.draftState === null || params.context.draftState.dirty === false) {
    return "none";
  }

  if (
    (params.toolDefinition.name === "saveAgentDraft" &&
      params.context.draftState.entityKind === "agent") ||
    (params.toolDefinition.name === "saveCouncilDraft" &&
      params.context.draftState.entityKind === "council")
  ) {
    const entityId = params.plannedCall.input.entityId;
    if (typeof entityId !== "string" || entityId === params.context.draftState.entityId) {
      return "modify-current-draft";
    }
  }

  if (params.toolDefinition.reconciliation?.visibleTarget === "current-draft") {
    const entityId = params.plannedCall.input.entityId;
    if (typeof entityId !== "string" || entityId === params.context.draftState.entityId) {
      return "modify-current-draft";
    }
  }

  return "replace-current-draft";
};

export const resolveAssistantConfirmationRequirement = (params: {
  context: AssistantContextEnvelope;
  toolDefinition: AssistantToolDefinition;
  plannedCall: AssistantPlannedToolCall;
}): AssistantConfirmationDecision => {
  const draftImpact = classifyDirtyDraftImpact({
    context: params.context,
    toolDefinition: params.toolDefinition,
    plannedCall: params.plannedCall,
  });

  if (
    draftImpact === "replace-current-draft" &&
    params.toolDefinition.confirmationPolicy === "when-dirty-draft-would-be-replaced"
  ) {
    return {
      requiresConfirmation: true,
      reason: "dirty-draft-replacement",
      draftImpact,
    };
  }

  if (params.toolDefinition.confirmationPolicy === "always") {
    return {
      requiresConfirmation: true,
      reason: "tool-policy",
      draftImpact,
    };
  }

  if (
    params.toolDefinition.confirmationPolicy === "when-bulk" &&
    typeof params.plannedCall.input.affectedCount === "number" &&
    params.plannedCall.input.affectedCount > 1
  ) {
    return {
      requiresConfirmation: true,
      reason: "bulk",
      draftImpact,
    };
  }

  if (
    params.toolDefinition.confirmationPolicy === "when-inferred-scope" &&
    params.plannedCall.input.scopeSource === "inferred"
  ) {
    return {
      requiresConfirmation: true,
      reason: "inferred-scope",
      draftImpact,
    };
  }

  return {
    requiresConfirmation: params.toolDefinition.requiresConfirmation,
    reason: params.toolDefinition.requiresConfirmation ? "tool-policy" : "none",
    draftImpact,
  };
};

export const validateAssistantPlannedCall = (
  plannedCall: AssistantPlannedToolCall,
):
  | { ok: true; definition: AssistantToolDefinition }
  | { ok: false; error: AssistantToolExecutionError } => {
  const definition = getAssistantToolDefinition(plannedCall.toolName);
  if (definition === null) {
    return {
      ok: false,
      error: {
        kind: "UnknownToolError",
        userMessage: "That assistant action is not available yet.",
        developerMessage: `Unknown assistant tool: ${plannedCall.toolName}`,
        retryable: false,
        details: null,
      },
    };
  }

  const parsed = definition.inputSchema.safeParse(plannedCall.input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "SchemaError",
        userMessage: "The assistant plan was not valid for execution.",
        developerMessage: `Invalid assistant tool input for ${plannedCall.toolName}`,
        retryable: false,
        details: null,
      },
    };
  }

  return {
    ok: true,
    definition,
  };
};
