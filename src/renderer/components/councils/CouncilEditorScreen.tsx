import { useEffect, useState } from "react";

import {
  COUNCIL_CONFIG_MAX_TAGS,
  appendTagToDraft,
  isCouncilDraftInvalidConfig,
  parseTagDraft,
  removeTagFromDraft,
} from "../../../shared/app-ui-helpers.js";
import {
  getCouncilDraftEditGuardMessage,
  isCouncilEditorReadOnly,
} from "../../../shared/assistant/assistant-draft-edit-guards.js";
import {
  filterAddableAgents,
  resolveAddableAgentsEmptyStateMessage,
} from "../../../shared/council-view-add-member-dialog.js";
import type { CouncilMode } from "../../../shared/ipc/dto";
import type { AssistantCouncilEditorSnapshot } from "../assistant/assistant-context-builders";
import type {
  AssistantCouncilDraftAdapter,
  AssistantCouncilDraftPatch,
  AssistantCouncilSaveAdapter,
  AssistantDraftReconciliation,
} from "../assistant/assistant-draft-adapters";
import { AddMemberDialog } from "../council-view/AddMemberDialog";
import { DetailScreenShell } from "../shared/DetailScreenShell";
import { ModelSelectField } from "../shared/ModelSelectField";
import { TagsEditor } from "../shared/TagsEditor";
import { CouncilEditorDialogs } from "./CouncilEditorDialogs";
import {
  type CouncilEditorState,
  getCouncilEditorDraftFingerprint,
  toCouncilEditorDraft,
} from "./councilEditorScreenState";
import { useCouncilEditorActions } from "./useCouncilEditorActions";

type CouncilEditorScreenProps = {
  assistantLauncher: JSX.Element;
  councilId: string | null;
  isActive: boolean;
  onAssistantContextChange: (snapshot: AssistantCouncilEditorSnapshot | null) => void;
  onAssistantDraftAdapterChange: (adapter: AssistantCouncilDraftAdapter | null) => void;
  onAssistantSaveAdapterChange: (adapter: AssistantCouncilSaveAdapter | null) => void;
  onClose: () => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const CouncilEditorScreen = ({
  assistantLauncher,
  councilId,
  isActive,
  onAssistantContextChange,
  onAssistantDraftAdapterChange,
  onAssistantSaveAdapterChange,
  onClose,
  pushToast,
}: CouncilEditorScreenProps): JSX.Element | null => {
  const [state, setState] = useState<CouncilEditorState>({ status: "loading" });
  const [tagInput, setTagInput] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [memberSearchText, setMemberSearchText] = useState("");
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const hasUnsavedDraft =
    state.status === "ready" &&
    getCouncilEditorDraftFingerprint(state.draft) !== state.initialFingerprint;

  const {
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
  } = useCouncilEditorActions({
    hasUnsavedDraft,
    onClose,
    pushToast,
    setState,
    state,
  });

  useEffect(() => {
    if (!isActive) {
      return;
    }
    document.title =
      councilId === null
        ? "New Council"
        : `Council: ${state.status === "ready" ? state.draft.title.trim() || "Council" : "Council"}`;
  }, [councilId, isActive, state]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const beforeUnloadHandler = (event: BeforeUnloadEvent): void => {
      if (!hasUnsavedDraft) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [hasUnsavedDraft, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    setTagInput("");
    setTagMessage("");
    setMemberSearchText("");
    setShowAddMemberDialog(false);
    void loadCouncilEditor(councilId);
  }, [councilId, isActive, loadCouncilEditor]);

  useEffect(() => {
    if (!isActive || state.status !== "ready") {
      onAssistantContextChange(null);
      return;
    }

    onAssistantContextChange({
      archived: state.source.council?.archived === true,
      draft: state.draft,
      initialDraft: JSON.parse(state.initialFingerprint) as typeof state.draft,
    });
  }, [isActive, onAssistantContextChange, state]);

  useEffect(() => {
    if (!isActive || state.status !== "ready") {
      onAssistantDraftAdapterChange(null);
      return;
    }

    const toAppliedFieldLabels = (patch: AssistantCouncilDraftPatch): ReadonlyArray<string> => {
      const labels: Array<string> = [];
      if (patch.title !== undefined) {
        labels.push("title");
      }
      if (patch.topic !== undefined) {
        labels.push("topic");
      }
      if (patch.goal !== undefined) {
        labels.push("goal");
      }
      if (patch.mode !== undefined) {
        labels.push("mode");
      }
      if (patch.tags !== undefined) {
        labels.push("tags");
      }
      if (patch.memberAgentIds !== undefined) {
        labels.push("members");
      }
      if (patch.conductorModelRefOrNull !== undefined) {
        labels.push("conductor model");
      }
      return labels;
    };

    onAssistantDraftAdapterChange(async (params) => {
      if (params.entityId !== null && params.entityId !== state.draft.id) {
        return {
          completion: null,
          failureMessage: "The current visible council draft does not match the requested target.",
          status: "failed",
        };
      }

      const guardMessage = getCouncilDraftEditGuardMessage({
        isArchived: state.source.council?.archived === true,
        isExistingCouncil: state.source.council !== null,
        patch: params.patch,
      });
      if (guardMessage !== null) {
        return {
          completion: null,
          failureMessage: guardMessage,
          status: "failed",
        };
      }

      const normalizedPatch = {
        ...(params.patch.title === undefined ? {} : { title: params.patch.title }),
        ...(params.patch.topic === undefined ? {} : { topic: params.patch.topic }),
        ...(params.patch.goal === undefined ? {} : { goal: params.patch.goal ?? "" }),
        ...(params.patch.mode === undefined ? {} : { mode: params.patch.mode }),
        ...(params.patch.tags === undefined ? {} : { tagsInput: params.patch.tags.join(", ") }),
        ...(params.patch.memberAgentIds === undefined
          ? {}
          : { selectedMemberIds: [...params.patch.memberAgentIds] }),
        ...(params.patch.conductorModelRefOrNull === undefined
          ? {}
          : {
              conductorModelSelection:
                params.patch.conductorModelRefOrNull === null
                  ? ""
                  : `${params.patch.conductorModelRefOrNull.providerId}:${params.patch.conductorModelRefOrNull.modelId}`,
            }),
      };
      const appliedFieldLabels = toAppliedFieldLabels(params.patch);

      updateDraft(normalizedPatch);

      return {
        completion: {
          output: {
            appliedFieldLabels,
            entityId: state.draft.id,
            patch: params.patch,
          },
          userSummary: `Updated the current council draft ${appliedFieldLabels.join(", ")}.`,
        },
        failureMessage: null,
        status: "completed",
      };
    });

    return () => {
      onAssistantDraftAdapterChange(null);
    };
  }, [isActive, onAssistantDraftAdapterChange, state, updateDraft]);

  useEffect(() => {
    if (!isActive || state.status !== "ready") {
      onAssistantSaveAdapterChange(null);
      return;
    }

    onAssistantSaveAdapterChange(async (params) => {
      if (params.entityId !== null && params.entityId !== state.draft.id) {
        return {
          completion: null,
          failureMessage: "The current visible council draft does not match the requested target.",
          status: "failed",
        };
      }

      const refreshed = await window.api.councils.getEditorView({
        viewKind: "councilCreate",
        councilId: params.entityId,
      });
      if (!refreshed.ok) {
        pushToast("error", refreshed.error.userMessage);
        setState((current) =>
          current.status !== "ready"
            ? current
            : { ...current, isSaving: false, message: refreshed.error.userMessage },
        );
        return {
          completion: null,
          failureMessage: refreshed.error.userMessage,
          status: "failed",
        };
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

      return {
        completion: null,
        failureMessage: null,
        status: "completed",
      };
    });

    return () => {
      onAssistantSaveAdapterChange(null);
    };
  }, [isActive, onAssistantSaveAdapterChange, pushToast, state]);

  const addTag = (): void => {
    if (state.status !== "ready") {
      return;
    }
    const result = appendTagToDraft({
      currentDraftValue: state.draft.tagsInput,
      tagInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!result.ok) {
      setTagMessage(result.message);
      return;
    }
    updateDraft({ tagsInput: result.draftValue });
    setTagInput("");
    setTagMessage("");
  };

  const removeTag = (tagToRemove: string): void => {
    if (state.status !== "ready") {
      return;
    }
    const result = removeTagFromDraft({
      currentDraftValue: state.draft.tagsInput,
      tagToRemove,
    });
    updateDraft({ tagsInput: result.draftValue });
    setTagMessage("");
  };

  const removeLastTag = (): void => {
    if (state.status !== "ready") {
      return;
    }
    const lastTag = parseTagDraft(state.draft.tagsInput).at(-1);
    if (lastTag === undefined) {
      return;
    }
    removeTag(lastTag);
  };

  if (!isActive) {
    return null;
  }
  if (state.status === "loading") {
    return (
      <DetailScreenShell
        assistantLauncher={assistantLauncher}
        onBack={() => close()}
        statusMessage="Loading council editor..."
        title={councilId === null ? "New Council" : "Edit Council"}
      />
    );
  }
  if (state.status === "error") {
    return (
      <DetailScreenShell
        assistantLauncher={assistantLauncher}
        onBack={() => close()}
        statusMessage={`Error: ${state.message}`}
        title="Council Editor"
      />
    );
  }

  const invalidConfig = isCouncilDraftInvalidConfig({
    conductorModelSelection: state.draft.conductorModelSelection,
    modelCatalog: state.source.modelCatalog,
    globalDefaultModelRef: state.source.globalDefaultModelRef,
  });
  const draftTags = parseTagDraft(state.draft.tagsInput);
  const availableAgentById = new Map(
    state.source.availableAgents.map((agent) => [agent.id, agent]),
  );
  const addableAgents = filterAddableAgents({
    availableAgents: state.source.availableAgents,
    memberAgentIds: state.draft.selectedMemberIds,
    searchText: memberSearchText,
  });
  const addableAgentsEmptyStateMessage = resolveAddableAgentsEmptyStateMessage(memberSearchText);
  const archived = isCouncilEditorReadOnly(state.source.council?.archived === true);

  return (
    <main className="shell">
      <header className="section-header">
        <div className="button-row">
          {assistantLauncher}
          <button className="secondary" onClick={() => close()} type="button">
            Back
          </button>
          <button
            className="cta"
            disabled={state.isSaving || archived}
            onClick={() => void save()}
            type="button"
          >
            {state.isSaving ? "Saving..." : "Save"}
          </button>
          {state.draft.id !== null ? (
            <>
              <button
                className="secondary"
                disabled={
                  state.isArchiving ||
                  (state.source.council?.mode === "autopilot" &&
                    state.source.council.started &&
                    !state.source.council.paused)
                }
                onClick={() => void setArchived(state.source.council?.archived !== true)}
                type="button"
              >
                {state.source.council?.archived ? "Restore" : "Archive"}
              </button>
              <button
                className="danger"
                disabled={state.isDeleting}
                onClick={openDeleteDialog}
                type="button"
              >
                {state.isDeleting ? "Deleting..." : "Delete"}
              </button>
            </>
          ) : null}
        </div>
        <h1>{state.draft.id === null ? "New Council" : "Edit Council"}</h1>
        <p>Title, Topic, and at least one Member are required before save.</p>
      </header>

      {archived ? (
        <p className="status-line">This council is archived and read-only. Restore it to edit.</p>
      ) : null}

      <section className="settings-section">
        <label className="field" htmlFor="council-title">
          Title
        </label>
        <input
          disabled={archived}
          id="council-title"
          onChange={(event) => updateDraft({ title: event.target.value })}
          type="text"
          value={state.draft.title}
        />

        <label className="field" htmlFor="council-topic">
          Topic
        </label>
        <textarea
          disabled={archived}
          id="council-topic"
          onChange={(event) => updateDraft({ topic: event.target.value })}
          rows={6}
          value={state.draft.topic}
        />

        <label className="field" htmlFor="council-goal">
          Goal (optional)
        </label>
        <textarea
          disabled={archived}
          id="council-goal"
          onChange={(event) => updateDraft({ goal: event.target.value })}
          rows={4}
          value={state.draft.goal}
        />

        <label className="field" htmlFor="council-mode">
          Mode
        </label>
        <select
          disabled={archived || state.draft.id !== null}
          id="council-mode"
          onChange={(event) => updateMode(event.target.value as CouncilMode)}
          value={state.draft.mode}
        >
          <option value="manual">Manual</option>
          <option value="autopilot">Autopilot</option>
        </select>
        {state.draft.id !== null ? (
          <p className="text-sm text-muted-foreground">Mode is locked after creation.</p>
        ) : null}

        <label className="field" htmlFor="council-tags-input">
          Tags
        </label>
        <TagsEditor
          disabled={archived}
          errorText={tagMessage || undefined}
          inputId="council-tags-input"
          inputPlaceholder="Add tag"
          inputValue={tagInput}
          maxTags={COUNCIL_CONFIG_MAX_TAGS}
          onAdd={addTag}
          onInputChange={setTagInput}
          onInputEscape={() => {
            setTagInput("");
            setTagMessage("");
          }}
          onRemoveLastTag={removeLastTag}
          onRemoveTag={removeTag}
          tags={draftTags}
        />

        <div className="field flex items-center justify-between gap-3">
          <span>Members</span>
          <button
            className="secondary"
            disabled={archived || state.showRemoveMemberDialog}
            onClick={() => setShowAddMemberDialog(true)}
            type="button"
          >
            Add Member
          </button>
        </div>
        <AddMemberDialog
          addableAgents={addableAgents}
          canEditMembers={!archived && !state.showRemoveMemberDialog}
          emptyStateMessage={addableAgentsEmptyStateMessage}
          isOpen={showAddMemberDialog}
          isSavingMembers={false}
          onAddMember={(memberAgentId) => {
            toggleCouncilMember(memberAgentId);
            setMemberSearchText("");
            setShowAddMemberDialog(false);
          }}
          onOpenChange={(open) => {
            setShowAddMemberDialog(open);
            if (!open) {
              setMemberSearchText("");
            }
          }}
          onSearchTextChange={setMemberSearchText}
          searchText={memberSearchText}
        />
        <div className="list-grid">
          {state.draft.selectedMemberIds.map((memberAgentId) => {
            const agent = availableAgentById.get(memberAgentId);
            const memberName = agent?.name ?? memberAgentId;

            return (
              <div className="list-row" key={memberAgentId}>
                <div>
                  <strong>{memberName}</strong>
                  {agent?.archived ? (
                    <p className="text-sm text-amber-700">
                      Archived - cannot be kept for new saves.
                    </p>
                  ) : null}
                  {agent?.invalidConfig ? (
                    <p className="text-sm text-muted-foreground">
                      Invalid config (can still be selected)
                    </p>
                  ) : null}
                </div>
                <button
                  className="secondary"
                  disabled={archived || state.showRemoveMemberDialog}
                  onClick={() => toggleCouncilMember(memberAgentId)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            );
          })}
          {state.draft.selectedMemberIds.length === 0 ? (
            <p className="status-line">No members selected yet.</p>
          ) : null}
        </div>

        <ModelSelectField
          canRefresh={state.source.canRefreshModels}
          disabled={archived}
          emptyLabel="Global default"
          id="council-conductor-model"
          invalidConfig={invalidConfig}
          invalidConfigLabel="Council editor conductor model"
          isRefreshing={state.isRefreshingModels}
          label="Conductor model"
          modelCatalog={state.source.modelCatalog}
          onChange={(value) => updateDraft({ conductorModelSelection: value })}
          onRefresh={() => void refreshModels()}
          refreshAriaLabel="Refresh council conductor model options"
          value={state.draft.conductorModelSelection}
        />

        {state.message.length > 0 ? (
          <p aria-live="polite" className="status-line">
            {state.message}
          </p>
        ) : null}
        {state.source.council?.mode === "autopilot" &&
        state.source.council.started &&
        !state.source.council.paused ? (
          <p className="status-line">Pause Autopilot in Council View before archiving.</p>
        ) : null}
      </section>

      <CouncilEditorDialogs
        onCancelDelete={closeDeleteDialog}
        onCancelDiscard={closeDiscardDialog}
        onCancelMemberRemove={cancelCouncilMemberRemoval}
        onConfirmDelete={() => {
          void remove();
        }}
        onConfirmDiscard={() => close(true)}
        onConfirmMemberRemove={confirmCouncilMemberRemoval}
        state={state}
      />
    </main>
  );
};
