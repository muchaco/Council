import { useEffect, useState } from "react";

import {
  COUNCIL_CONFIG_MAX_TAGS,
  appendTagToDraft,
  isCouncilDraftInvalidConfig,
  parseTagDraft,
  removeTagFromDraft,
} from "../../../shared/app-ui-helpers.js";
import type { CouncilMode } from "../../../shared/ipc/dto";
import { DetailScreenShell } from "../shared/DetailScreenShell";
import { ModelSelectField } from "../shared/ModelSelectField";
import { TagsEditor } from "../shared/TagsEditor";
import { CouncilEditorDialogs } from "./CouncilEditorDialogs";
import {
  type CouncilEditorState,
  getCouncilEditorDraftFingerprint,
} from "./councilEditorScreenState";
import { useCouncilEditorActions } from "./useCouncilEditorActions";

type CouncilEditorScreenProps = {
  councilId: string | null;
  isActive: boolean;
  onClose: () => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const CouncilEditorScreen = ({
  councilId,
  isActive,
  onClose,
  pushToast,
}: CouncilEditorScreenProps): JSX.Element | null => {
  const [state, setState] = useState<CouncilEditorState>({ status: "loading" });
  const [tagInput, setTagInput] = useState("");
  const [tagMessage, setTagMessage] = useState("");
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
    void loadCouncilEditor(councilId);
  }, [councilId, isActive, loadCouncilEditor]);

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
        onBack={() => close()}
        statusMessage="Loading council editor..."
        title={councilId === null ? "New Council" : "Edit Council"}
      />
    );
  }
  if (state.status === "error") {
    return (
      <DetailScreenShell
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

  return (
    <main className="shell">
      <header className="section-header">
        <div className="button-row">
          <button className="secondary" onClick={() => close()} type="button">
            Back
          </button>
          <button
            className="cta"
            disabled={state.isSaving}
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

      <section className="settings-section">
        <label className="field" htmlFor="council-title">
          Title
        </label>
        <input
          id="council-title"
          onChange={(event) => updateDraft({ title: event.target.value })}
          type="text"
          value={state.draft.title}
        />

        <label className="field" htmlFor="council-topic">
          Topic
        </label>
        <textarea
          id="council-topic"
          onChange={(event) => updateDraft({ topic: event.target.value })}
          rows={6}
          value={state.draft.topic}
        />

        <label className="field" htmlFor="council-goal">
          Goal (optional)
        </label>
        <textarea
          id="council-goal"
          onChange={(event) => updateDraft({ goal: event.target.value })}
          rows={4}
          value={state.draft.goal}
        />

        <label className="field" htmlFor="council-mode">
          Mode
        </label>
        <select
          disabled={state.draft.id !== null}
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

        <p className="field">Members</p>
        <div className="list-grid">
          {state.source.availableAgents.map((agent) => (
            <label className="list-row" key={agent.id}>
              <div>
                <strong>{agent.name}</strong>
                {agent.archived ? (
                  <p className="text-sm text-amber-700">
                    Archived - cannot be added as a new member.
                  </p>
                ) : null}
                {agent.invalidConfig ? (
                  <p className="text-sm text-muted-foreground">
                    Invalid config (can still be selected)
                  </p>
                ) : null}
              </div>
              <input
                checked={state.draft.selectedMemberIds.includes(agent.id)}
                disabled={
                  state.showRemoveMemberDialog ||
                  (agent.archived && !state.draft.selectedMemberIds.includes(agent.id))
                }
                onChange={() => toggleCouncilMember(agent.id)}
                type="checkbox"
              />
            </label>
          ))}
        </div>

        <ModelSelectField
          canRefresh={state.source.canRefreshModels}
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
