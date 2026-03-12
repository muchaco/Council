import type { AssistantContextEnvelope } from "../ipc/dto.js";

export const summarizeAssistantContext = (context: AssistantContextEnvelope): string => {
  const parts = [context.contextLabel, `view=${context.viewKind}`];

  if (context.activeEntityId !== null) {
    parts.push(`entity=${context.activeEntityId}`);
  }

  if (context.draftState?.dirty === true) {
    parts.push("draft=dirty");
  }

  if (context.runtimeState !== null) {
    parts.push(`runtime=${context.runtimeState.status}`);
  }

  return parts.join(" | ");
};

export const serializeAssistantContextForPrompt = (context: AssistantContextEnvelope): string => {
  return JSON.stringify(
    {
      viewKind: context.viewKind,
      contextLabel: context.contextLabel,
      activeEntityId: context.activeEntityId,
      selectionIds: context.selectionIds,
      listState: context.listState,
      draftState: context.draftState,
      runtimeState: context.runtimeState,
    },
    null,
    2,
  );
};
