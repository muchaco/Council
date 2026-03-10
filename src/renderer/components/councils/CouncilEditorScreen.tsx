import { useEffect, useState } from "react";

import {
  COUNCIL_CONFIG_MAX_TAGS,
  buildInvalidConfigBadgeAriaLabel,
  isCouncilDraftInvalidConfig,
  normalizeTagsDraft,
  toModelRef,
} from "../../../shared/app-ui-helpers.js";
import type {
  CouncilDto,
  CouncilMode,
  GetCouncilEditorViewResponse,
} from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { ModelSelectField } from "../shared/ModelSelectField";

type CouncilEditorDraft = {
  id: string | null;
  title: string;
  topic: string;
  goal: string;
  mode: CouncilMode;
  tagsInput: string;
  conductorModelSelection: string;
  selectedMemberIds: ReadonlyArray<string>;
};

type CouncilEditorState =
  | { status: "loading" }
  | {
      status: "ready";
      source: GetCouncilEditorViewResponse;
      draft: CouncilEditorDraft;
      initialFingerprint: string;
      isSaving: boolean;
      isDeleting: boolean;
      isArchiving: boolean;
      isRefreshingModels: boolean;
      showDiscardDialog: boolean;
      showDeleteDialog: boolean;
      showRemoveMemberDialog: boolean;
      pendingMemberRemovalId: string | null;
      message: string;
    }
  | { status: "error"; message: string };

const toCouncilEditorDraft = (council: CouncilDto | null): CouncilEditorDraft => ({
  id: council?.id ?? null,
  title: council?.title ?? "",
  topic: council?.topic ?? "",
  goal: council?.goal ?? "",
  mode: council?.mode ?? "manual",
  tagsInput: council?.tags.join(", ") ?? "",
  conductorModelSelection:
    council?.conductorModelRefOrNull === null || council?.conductorModelRefOrNull === undefined
      ? ""
      : `${council.conductorModelRefOrNull.providerId}:${council.conductorModelRefOrNull.modelId}`,
  selectedMemberIds: council?.memberAgentIds ?? [],
});

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
  const hasUnsavedDraft =
    state.status === "ready" && JSON.stringify(state.draft) !== state.initialFingerprint;

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
    setState({ status: "loading" });
    void window.api.councils
      .getEditorView({ viewKind: "councilCreate", councilId })
      .then((result) => {
        if (!result.ok) {
          setState({ status: "error", message: result.error.userMessage });
          pushToast("error", result.error.userMessage);
          return;
        }
        const draft = toCouncilEditorDraft(result.value.council);
        setState({
          status: "ready",
          source: result.value,
          draft,
          initialFingerprint: JSON.stringify(draft),
          isSaving: false,
          isDeleting: false,
          isArchiving: false,
          isRefreshingModels: false,
          showDiscardDialog: false,
          showDeleteDialog: false,
          showRemoveMemberDialog: false,
          pendingMemberRemovalId: null,
          message: "",
        });
      });
  }, [councilId, isActive, pushToast]);

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

  const save = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    if (state.draft.title.trim().length === 0) {
      pushToast("warning", "Title is required.");
      setState((current) =>
        current.status !== "ready" ? current : { ...current, message: "Title is required." },
      );
      return;
    }
    if (state.draft.topic.trim().length === 0) {
      pushToast("warning", "Topic is required before saving a council.");
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, message: "Topic is required before saving a council." },
      );
      return;
    }
    if (state.draft.selectedMemberIds.length === 0) {
      pushToast("warning", "Select at least one member before saving.");
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, message: "Select at least one member before saving." },
      );
      return;
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
      return;
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
      return;
    }
    pushToast("info", "Council saved.");
    close(true);
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
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            source: refreshed.value,
            draft: toCouncilEditorDraft(refreshed.value.council),
            initialFingerprint: JSON.stringify(toCouncilEditorDraft(refreshed.value.council)),
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

  if (!isActive) {
    return null;
  }
  if (state.status === "loading") {
    return (
      <main className="shell">
        <header className="section-header">
          <button className="secondary" onClick={() => close()} type="button">
            Back
          </button>
          <h1>{councilId === null ? "New Council" : "Edit Council"}</h1>
        </header>
        <p className="status">Loading council editor...</p>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="shell">
        <header className="section-header">
          <button className="secondary" onClick={() => close()} type="button">
            Back
          </button>
          <h1>Council Editor</h1>
        </header>
        <p className="status">Error: {state.message}</p>
      </main>
    );
  }

  const invalidConfig = isCouncilDraftInvalidConfig({
    conductorModelSelection: state.draft.conductorModelSelection,
    modelCatalog: state.source.modelCatalog,
    globalDefaultModelRef: state.source.globalDefaultModelRef,
  });

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
                onClick={() =>
                  setState((current) =>
                    current.status !== "ready" ? current : { ...current, showDeleteDialog: true },
                  )
                }
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
          onChange={(event) => updateDraft({ mode: event.target.value as CouncilMode })}
          value={state.draft.mode}
        >
          <option value="manual">Manual</option>
          <option value="autopilot">Autopilot</option>
        </select>
        {state.draft.id !== null ? (
          <p className="text-sm text-muted-foreground">Mode is locked after creation.</p>
        ) : null}

        <label className="field" htmlFor="council-tags">
          Tags (comma-separated, max 3)
        </label>
        <input
          id="council-tags"
          onChange={(event) => updateDraft({ tagsInput: event.target.value })}
          type="text"
          value={state.draft.tagsInput}
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

      <ConfirmDialog
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        confirmTone="danger"
        message="Your changes will be lost."
        onCancel={() =>
          setState((current) =>
            current.status !== "ready" ? current : { ...current, showDiscardDialog: false },
          )
        }
        onConfirm={() => close(true)}
        open={state.showDiscardDialog}
        title="Discard council changes?"
      />

      <ConfirmDialog
        confirmLabel="Delete"
        confirmTone="danger"
        message={`Delete council "${state.draft.title.trim() || "Untitled council"}" permanently?`}
        onCancel={() =>
          setState((current) =>
            current.status !== "ready" ? current : { ...current, showDeleteDialog: false },
          )
        }
        onConfirm={() => {
          void remove();
        }}
        open={state.showDeleteDialog}
        title="Delete council?"
      />

      <ConfirmDialog
        confirmLabel="Remove"
        confirmTone="danger"
        message={
          state.pendingMemberRemovalId === null
            ? ""
            : `Remove ${state.source.availableAgents.find((agent) => agent.id === state.pendingMemberRemovalId)?.name ?? "this member"}? You can add them again later.`
        }
        onCancel={cancelCouncilMemberRemoval}
        onConfirm={confirmCouncilMemberRemoval}
        open={state.showRemoveMemberDialog}
        title="Remove member?"
      />
    </main>
  );
};
