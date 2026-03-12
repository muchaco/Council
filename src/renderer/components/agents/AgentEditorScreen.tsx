import { useEffect, useState } from "react";

import {
  COUNCIL_CONFIG_MAX_TAGS,
  appendTagToDraft,
  isAgentDraftInvalidConfig,
  normalizeTagsDraft,
  parseTagDraft,
  removeTagFromDraft,
  toModelRef,
} from "../../../shared/app-ui-helpers.js";
import type { GetAgentEditorViewResponse } from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import type { AssistantAgentEditorSnapshot } from "../assistant/assistant-context-builders";
import { DetailScreenShell } from "../shared/DetailScreenShell";
import { ModelSelectField } from "../shared/ModelSelectField";
import { TagsEditor } from "../shared/TagsEditor";
import { Button } from "../ui/button";

type AgentEditorDraft = {
  id: string | null;
  name: string;
  systemPrompt: string;
  verbosity: string;
  temperature: string;
  tagsInput: string;
  modelSelection: string;
};

type AgentEditorState =
  | { status: "loading" }
  | {
      status: "ready";
      source: GetAgentEditorViewResponse;
      draft: AgentEditorDraft;
      initialFingerprint: string;
      isSaving: boolean;
      isDeleting: boolean;
      isArchiving: boolean;
      isRefreshingModels: boolean;
      showDiscardDialog: boolean;
      showDeleteDialog: boolean;
      message: string;
    }
  | { status: "error"; message: string };

const toAgentEditorDraft = (agent: GetAgentEditorViewResponse["agent"]): AgentEditorDraft => ({
  id: agent?.id ?? null,
  name: agent?.name ?? "",
  systemPrompt: agent?.systemPrompt ?? "",
  verbosity: agent?.verbosity ?? "",
  temperature: agent?.temperature?.toString() ?? "",
  tagsInput: agent?.tags.join(", ") ?? "",
  modelSelection:
    agent?.modelRefOrNull === null || agent?.modelRefOrNull === undefined
      ? ""
      : `${agent.modelRefOrNull.providerId}:${agent.modelRefOrNull.modelId}`,
});

type AgentEditorScreenProps = {
  agentId: string | null;
  assistantLauncher: JSX.Element;
  isActive: boolean;
  onAssistantContextChange: (snapshot: AssistantAgentEditorSnapshot | null) => void;
  onClose: (tab?: "agents") => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const AgentEditorScreen = ({
  agentId,
  assistantLauncher,
  isActive,
  onAssistantContextChange,
  onClose,
  pushToast,
}: AgentEditorScreenProps): JSX.Element | null => {
  const [state, setState] = useState<AgentEditorState>({ status: "loading" });
  const [tagInput, setTagInput] = useState("");
  const [tagMessage, setTagMessage] = useState("");

  const hasUnsavedDraft =
    state.status === "ready" && JSON.stringify(state.draft) !== state.initialFingerprint;

  useEffect(() => {
    if (!isActive) {
      return;
    }
    document.title = `Agent: ${state.status === "ready" ? state.draft.name.trim() || "New Agent" : agentId === null ? "New Agent" : "Agent"}`;
  }, [agentId, isActive, state]);

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
    void window.api.agents.getEditorView({ viewKind: "agentEdit", agentId }).then((result) => {
      if (!result.ok) {
        setState({ status: "error", message: result.error.userMessage });
        pushToast("error", result.error.userMessage);
        return;
      }
      const draft = toAgentEditorDraft(result.value.agent);
      setTagInput("");
      setTagMessage("");
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
        message: "",
      });
    });
  }, [agentId, isActive, pushToast]);

  useEffect(() => {
    if (!isActive || state.status !== "ready") {
      onAssistantContextChange(null);
      return;
    }

    onAssistantContextChange({
      archived: state.source.agent?.archived === true,
      draft: state.draft,
      initialDraft: JSON.parse(state.initialFingerprint) as AgentEditorDraft,
    });
  }, [isActive, onAssistantContextChange, state]);

  const close = (force = false): void => {
    if (!force && hasUnsavedDraft) {
      setState((current) =>
        current.status !== "ready" ? current : { ...current, showDiscardDialog: true },
      );
      return;
    }
    onClose("agents");
  };

  const updateDraft = (patch: Partial<AgentEditorDraft>): void => {
    if (Object.hasOwn(patch, "tagsInput")) {
      setTagMessage("");
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, draft: { ...current.draft, ...patch } },
    );
  };

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
    const currentTags = parseTagDraft(state.draft.tagsInput);
    const lastTag = currentTags.at(-1);
    if (lastTag === undefined) {
      return;
    }
    removeTag(lastTag);
  };

  const save = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    const normalizedTagsResult = normalizeTagsDraft({
      tagsInput: state.draft.tagsInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!normalizedTagsResult.ok) {
      pushToast("warning", normalizedTagsResult.message);
      setTagMessage(normalizedTagsResult.message);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, message: normalizedTagsResult.message },
      );
      return;
    }
    const parsedTemperature =
      state.draft.temperature.trim().length === 0
        ? null
        : Number.parseFloat(state.draft.temperature);
    if (Number.isNaN(parsedTemperature ?? 0)) {
      pushToast("warning", "Temperature must be a valid number.");
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isSaving: true, message: "" },
    );
    const result = await window.api.agents.save({
      viewKind: "agentEdit",
      id: state.draft.id,
      name: state.draft.name,
      systemPrompt: state.draft.systemPrompt,
      verbosity: state.draft.verbosity.trim().length === 0 ? null : state.draft.verbosity,
      temperature: parsedTemperature,
      tags: normalizedTagsResult.tags,
      modelRefOrNull: toModelRef(state.draft.modelSelection),
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
    setTagMessage("");
    pushToast("info", "Agent saved.");
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
    const result = await window.api.agents.delete({ id: state.draft.id });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isDeleting: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Agent deleted.");
    close(true);
  };

  const setArchived = async (archived: boolean): Promise<void> => {
    if (state.status !== "ready" || state.draft.id === null) {
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isArchiving: true, message: "" },
    );
    const result = await window.api.agents.setArchived({ id: state.draft.id, archived });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isArchiving: false, message: result.error.userMessage },
      );
      return;
    }
    const refreshed = await window.api.agents.getEditorView({
      viewKind: "agentEdit",
      agentId: state.draft.id,
    });
    if (!refreshed.ok) {
      pushToast("error", refreshed.error.userMessage);
      return;
    }
    const draft = toAgentEditorDraft(refreshed.value.agent);
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            source: refreshed.value,
            draft,
            initialFingerprint: JSON.stringify(draft),
            isArchiving: false,
            message: archived ? "Agent archived." : "Agent restored.",
          },
    );
    pushToast("info", archived ? "Agent archived." : "Agent restored.");
  };

  const refreshModels = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isRefreshingModels: true, message: "" },
    );
    const result = await window.api.agents.refreshModelCatalog({ viewKind: "agentEdit" });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isRefreshingModels: false, message: result.error.userMessage },
      );
      return;
    }
    const refreshed = await window.api.agents.getEditorView({
      viewKind: "agentEdit",
      agentId: state.draft.id,
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
            message: "Model options refreshed.",
          },
    );
    pushToast("info", "Agent model options refreshed.");
  };

  if (!isActive) {
    return null;
  }
  if (state.status === "loading") {
    return (
      <DetailScreenShell
        assistantLauncher={assistantLauncher}
        onBack={() => close()}
        statusMessage="Loading agent editor..."
        title={agentId === null ? "New Agent" : "Edit Agent"}
      />
    );
  }
  if (state.status === "error") {
    return (
      <DetailScreenShell
        assistantLauncher={assistantLauncher}
        onBack={() => close()}
        statusMessage={`Error: ${state.message}`}
        title="Agent Editor"
      />
    );
  }

  const invalidConfig = isAgentDraftInvalidConfig({
    modelSelection: state.draft.modelSelection,
    modelCatalog: state.source.modelCatalog,
    globalDefaultModelRef: state.source.globalDefaultModelRef,
  });
  const archived = state.source.agent?.archived === true;
  const draftTags = parseTagDraft(state.draft.tagsInput);

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
                disabled={state.isArchiving}
                onClick={() => void setArchived(!archived)}
                type="button"
              >
                {archived ? "Restore" : "Archive"}
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
        <h1>{state.draft.id === null ? "New Agent" : "Edit Agent"}</h1>
        <p>Fields marked required must be completed before save.</p>
      </header>

      {archived ? (
        <p className="status-line">This agent is archived and read-only. Restore it to edit.</p>
      ) : null}

      <section className="settings-section">
        <label className="field" htmlFor="agent-name">
          Name
        </label>
        <input
          disabled={archived}
          id="agent-name"
          onChange={(event) => updateDraft({ name: event.target.value })}
          type="text"
          value={state.draft.name}
        />

        <label className="field" htmlFor="agent-system-prompt">
          System Prompt
        </label>
        <textarea
          disabled={archived}
          id="agent-system-prompt"
          onChange={(event) => updateDraft({ systemPrompt: event.target.value })}
          rows={8}
          value={state.draft.systemPrompt}
        />

        <label className="field" htmlFor="agent-verbosity">
          Verbosity (optional)
        </label>
        <input
          disabled={archived}
          id="agent-verbosity"
          onChange={(event) => updateDraft({ verbosity: event.target.value })}
          type="text"
          value={state.draft.verbosity}
        />

        <label className="field" htmlFor="agent-temperature">
          Temperature (optional)
        </label>
        <input
          disabled={archived}
          id="agent-temperature"
          onChange={(event) => updateDraft({ temperature: event.target.value })}
          placeholder="0.0 - 2.0"
          type="text"
          value={state.draft.temperature}
        />

        <label className="field" htmlFor="agent-tags-input">
          Tags
        </label>
        <TagsEditor
          disabled={archived}
          errorText={tagMessage || undefined}
          inputId="agent-tags-input"
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

        <ModelSelectField
          canRefresh={state.source.canRefreshModels}
          disabled={archived}
          emptyLabel="Global default"
          id="agent-model"
          invalidConfig={invalidConfig}
          invalidConfigLabel="Agent editor model"
          isRefreshing={state.isRefreshingModels}
          label="Model"
          modelCatalog={state.source.modelCatalog}
          onChange={(value) => updateDraft({ modelSelection: value })}
          onRefresh={() => void refreshModels()}
          refreshAriaLabel="Refresh agent model options"
          value={state.draft.modelSelection}
        />

        {state.message.length > 0 ? (
          <p aria-live="polite" className="status-line">
            {state.message}
          </p>
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
        title="Discard agent changes?"
      />

      <ConfirmDialog
        confirmLabel="Delete"
        confirmTone="danger"
        message="Delete this agent permanently?"
        onCancel={() =>
          setState((current) =>
            current.status !== "ready" ? current : { ...current, showDeleteDialog: false },
          )
        }
        onConfirm={() => {
          void remove();
        }}
        open={state.showDeleteDialog}
        title="Delete agent?"
      />
    </main>
  );
};
