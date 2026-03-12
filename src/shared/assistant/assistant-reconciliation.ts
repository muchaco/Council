import type { AssistantToolReconciliation } from "../ipc/dto.js";

export const isAssistantReconciliationRequired = (
  reconciliation: AssistantToolReconciliation | null,
): boolean => reconciliation !== null;

export const resolveAssistantReconciliationState = (params: {
  reconciliation: AssistantToolReconciliation | null;
  visibleStateAligned: boolean;
  followUpRefreshPending: boolean;
}): "not-needed" | "completed" | "follow-up-refresh-in-progress" => {
  if (params.reconciliation === null) {
    return "not-needed";
  }

  if (params.visibleStateAligned) {
    return "completed";
  }

  return params.followUpRefreshPending ? "follow-up-refresh-in-progress" : "completed";
};
