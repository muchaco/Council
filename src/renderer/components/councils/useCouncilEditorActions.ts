import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  COUNCIL_CONFIG_MAX_TAGS,
  normalizeTagsDraft,
  toModelRef,
} from "../../../shared/app-ui-helpers.js";
import type { CouncilMode } from "../../../shared/ipc/dto";
import type { AssistantDraftReconciliation } from "../assistant/assistant-draft-adapters";
import {
  type CouncilEditorDraft,
  type CouncilEditorState,
  createReadyCouncilEditorState,
  getCouncilEditorDraftFingerprint,
  toCouncilEditorDraft,
} from "./councilEditorScreenState";

type UseCouncilEditorActionsParams = {
  hasUnsavedDraft: boolean;
  onClose: () => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
  setState: Dispatch<SetStateAction<CouncilEditorState>>;
  state: CouncilEditorState;
};

export const useCouncilEditorActions = ({
  hasUnsavedDraft,
  onClose,
  pushToast,
  setState,
  state,
}: UseCouncilEditorActionsParams) => {
  const loadCouncilEditor = useCallback(
    async (nextCouncilId: string | null): Promise<void> => {
      setState({ status: "loading" });
      const result = await window.api.councils.getEditorView({
        viewKind: "councilCreate",
        councilId: nextCouncilId,
      });
      if (!result.ok) {
        setState({ status: "error", message: result.error.userMessage });
        pushToast("error", result.error.userMessage);
        return;
      }
      setState(createReadyCouncilEditorState(result.value));
    },
    [pushToast, setState],
  );

  const close = (force = false): void => {
    if (!force && hasUnsavedDraft) {
      setState((current) =>
        current.status !== "ready" ? current : { ...current, showDiscardDialog: true },
      );
      return;
    }
    onClose();
  };

  const updateDraft = (patch: Partial<CouncilEditorDraft>): void => {
    setState((current) =>
      current.status !== "ready" ? current : { ...current, draft: { ...current.draft, ...patch } },
    );
  };

  const updateMode = (mode: CouncilMode): void => {
    updateDraft({ mode });
  };

  const toggleCouncilMember = (memberAgentId: string): void => {
    setState((current) => {
      if (current.status !== "ready") {
        return current;
      }
      const isSelected = current.draft.selectedMemberIds.includes(memberAgentId);
      if (isSelected) {
        return { ...current, pendingMemberRemovalId: memberAgentId, showRemoveMemberDialog: true };
      }
      return {
        ...current,
        draft: {
          ...current.draft,
          selectedMemberIds: [...current.draft.selectedMemberIds, memberAgentId],
        },
      };
    });
  };

  const confirmCouncilMemberRemoval = (): void => {
    setState((current) => {
      if (current.status !== "ready" || current.pendingMemberRemovalId === null) {
        return current;
      }
      return {
        ...current,
        draft: {
          ...current.draft,
          selectedMemberIds: current.draft.selectedMemberIds.filter(
            (id) => id !== current.pendingMemberRemovalId,
          ),
        },
        pendingMemberRemovalId: null,
        showRemoveMemberDialog: false,
      };
    });
  };

  const cancelCouncilMemberRemoval = (): void => {
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, pendingMemberRemovalId: null, showRemoveMemberDialog: false },
    );
  };

  const openDeleteDialog = (): void => {
    setState((current) =>
      current.status !== "ready" ? current : { ...current, showDeleteDialog: true },
    );
  };

  const closeDeleteDialog = (): void => {
    setState((current) =>
      current.status !== "ready" ? current : { ...current, showDeleteDialog: false },
    );
  };

  const closeDiscardDialog = (): void => {
    setState((current) =>
      current.status !== "ready" ? current : { ...current, showDiscardDialog: false },
    );
  };

  const save = async (options?: {
    closeOnSuccess?: boolean;
    forAssistant?: boolean;
  }): Promise<AssistantDraftReconciliation | undefined> => {
    if (state.status !== "ready") {
      return options?.forAssistant
        ? {
            completion: null,
            failureMessage: "The current council editor is not ready to save yet.",
            status: "failed",
          }
        : undefined;
    }
    if (state.draft.title.trim().length === 0) {
      const message = "Title is required.";
      pushToast("warning", message);
      setState((current) => (current.status !== "ready" ? current : { ...current, message }));
      return options?.forAssistant
        ? {
            completion: null,
            failureMessage: message,
            status: "failed",
          }
        : undefined;
    }
    if (state.draft.topic.trim().length === 0) {
      const message = "Topic is required before saving a council.";
      pushToast("warning", message);
      setState((current) => (current.status !== "ready" ? current : { ...current, message }));
      return options?.forAssistant
        ? {
            completion: null,
            failureMessage: message,
            status: "failed",
          }
        : undefined;
    }
    if (state.draft.selectedMemberIds.length === 0) {
      const message = "Select at least one member before saving.";
      pushToast("warning", message);
      setState((current) => (current.status !== "ready" ? current : { ...current, message }));
      return options?.forAssistant
        ? {
            completion: null,
            failureMessage: message,
            status: "failed",
          }
        : undefined;
    }
    const normalizedTagsResult = normalizeTagsDraft({
      tagsInput: state.draft.tagsInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!normalizedTagsResult.ok) {
      pushToast("warning", normalizedTagsResult.message);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, message: normalizedTagsResult.message },
      );
      return options?.forAssistant
        ? {
            completion: null,
            failureMessage: normalizedTagsResult.message,
            status: "failed",
          }
        : undefined;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isSaving: true, message: "" },
    );
    const result = await window.api.councils.save({
      viewKind: "councilCreate",
      id: state.draft.id,
      title: state.draft.title,
      topic: state.draft.topic,
      goal: state.draft.goal.trim().length === 0 ? null : state.draft.goal,
      mode: state.draft.mode,
      tags: normalizedTagsResult.tags,
      memberAgentIds: state.draft.selectedMemberIds,
      memberColorsByAgentId: {},
      conductorModelRefOrNull: toModelRef(state.draft.conductorModelSelection),
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isSaving: false, message: result.error.userMessage },
      );
      return options?.forAssistant
        ? {
            completion: null,
            failureMessage: result.error.userMessage,
            status: "failed",
          }
        : undefined;
    }

    const closeOnSuccess = options?.closeOnSuccess ?? true;
    if (closeOnSuccess) {
      pushToast("info", "Council saved.");
      close(true);
      return options?.forAssistant
        ? {
            completion: {
              output: {
                councilId: result.value.council.id,
                councilTitle: result.value.council.title,
              },
              userSummary: `Saved ${result.value.council.title}.`,
            },
            failureMessage: null,
            status: "completed",
          }
        : undefined;
    }

    const refreshed = await window.api.councils.getEditorView({
      viewKind: "councilCreate",
      councilId: result.value.council.id,
    });
    if (!refreshed.ok) {
      pushToast("error", refreshed.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isSaving: false, message: refreshed.error.userMessage },
      );
      return options?.forAssistant
        ? {
            completion: null,
            failureMessage: refreshed.error.userMessage,
            status: "failed",
          }
        : undefined;
    }

    const refreshedDraft = toCouncilEditorDraft(refreshed.value.council);
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            source: refreshed.value,
            draft: refreshedDraft,
            initialFingerprint: getCouncilEditorDraftFingerprint(refreshedDraft),
            isSaving: false,
            message: "Council saved.",
          },
    );

    return options?.forAssistant
      ? {
          completion: {
            output: {
              councilId: result.value.council.id,
              councilTitle: result.value.council.title,
            },
            userSummary: `Saved ${result.value.council.title}.`,
          },
          failureMessage: null,
          status: "completed",
        }
      : undefined;
  };

  const remove = async (): Promise<void> => {
    if (state.status !== "ready" || state.draft.id === null) {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, showDeleteDialog: false, isDeleting: true, message: "" },
    );
    const result = await window.api.councils.delete({ id: state.draft.id });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isDeleting: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Council deleted.");
    close(true);
  };

  const setArchived = async (archived: boolean): Promise<void> => {
    if (state.status !== "ready" || state.draft.id === null) {
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isArchiving: true, message: "" },
    );
    const result = await window.api.councils.setArchived({ id: state.draft.id, archived });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isArchiving: false, message: result.error.userMessage },
      );
      return;
    }
    const refreshed = await window.api.councils.getEditorView({
      viewKind: "councilCreate",
      councilId: state.draft.id,
    });
    if (!refreshed.ok) {
      pushToast("error", refreshed.error.userMessage);
      return;
    }
    const refreshedDraft = toCouncilEditorDraft(refreshed.value.council);
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            source: refreshed.value,
            draft: refreshedDraft,
            initialFingerprint: getCouncilEditorDraftFingerprint(refreshedDraft),
            isArchiving: false,
            message: archived ? "Council archived." : "Council restored.",
          },
    );
    pushToast("info", archived ? "Council archived." : "Council restored.");
  };

  const refreshModels = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isRefreshingModels: true, message: "" },
    );
    const result = await window.api.councils.refreshModelCatalog({ viewKind: "councilCreate" });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isRefreshingModels: false, message: result.error.userMessage },
      );
      return;
    }
    const refreshed = await window.api.councils.getEditorView({
      viewKind: "councilCreate",
      councilId: state.draft.id,
    });
    if (!refreshed.ok) {
      pushToast("error", refreshed.error.userMessage);
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            source: refreshed.value,
            isRefreshingModels: false,
            message: "Conductor model options refreshed.",
          },
    );
    pushToast("info", "Council model options refreshed.");
  };

  return {
    cancelCouncilMemberRemoval,
    close,
    closeDeleteDialog,
    closeDiscardDialog,
    confirmCouncilMemberRemoval,
    loadCouncilEditor,
    openDeleteDialog,
    refreshModels,
    remove,
    save,
    setArchived,
    toggleCouncilMember,
    updateDraft,
    updateMode,
  };
};
