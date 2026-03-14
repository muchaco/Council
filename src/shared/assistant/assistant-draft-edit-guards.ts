export type AssistantAgentDraftEditGuardParams = {
  isArchived: boolean;
};

export type AssistantCouncilDraftEditGuardParams = {
  isArchived: boolean;
  isExistingCouncil: boolean;
  patch: {
    mode?: "autopilot" | "manual";
  };
};

export const isAgentEditorReadOnly = (isArchived: boolean): boolean => isArchived;

export const isCouncilEditorReadOnly = (isArchived: boolean): boolean => isArchived;

export const getAgentDraftEditGuardMessage = (
  params: AssistantAgentDraftEditGuardParams,
): string | null => {
  if (isAgentEditorReadOnly(params.isArchived)) {
    return "Archived agents are read-only. Restore the current agent before editing it.";
  }

  return null;
};

export const getCouncilDraftEditGuardMessage = (
  params: AssistantCouncilDraftEditGuardParams,
): string | null => {
  if (isCouncilEditorReadOnly(params.isArchived)) {
    return "Archived councils are read-only. Restore the current council before editing it.";
  }

  if (params.isExistingCouncil && params.patch.mode !== undefined) {
    return "Council mode is locked after creation. Open a new council draft to change the mode.";
  }

  return null;
};
