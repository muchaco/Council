import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE,
  buildCouncilViewExitPlan,
} from "../shared/council-view-runtime-guards";
import type { ModelRef } from "../shared/domain/model-ref";
import type {
  AgentDto,
  AgentSortField,
  CouncilArchivedFilter,
  CouncilDto,
  CouncilMode,
  CouncilSortField,
  GetAgentEditorViewResponse,
  GetCouncilEditorViewResponse,
  GetCouncilViewResponse,
  GetSettingsViewResponse,
  ProviderConfigDto,
  ProviderDraftDto,
  ProviderId,
  SortDirection,
} from "../shared/ipc/dto";

type HomeTab = "councils" | "agents" | "settings";

type ScreenState =
  | { kind: "home" }
  | {
      kind: "agentEditor";
      agentId: string | null;
    }
  | {
      kind: "councilEditor";
      councilId: string | null;
    }
  | {
      kind: "councilView";
      councilId: string;
    };

type ProviderDraftState = {
  providerId: ProviderId;
  endpointUrl: string;
  apiKey: string;
  testToken: string | null;
  testStatusText: string;
  message: string;
  isTesting: boolean;
  isSaving: boolean;
};

type SettingsViewState =
  | { status: "loading" }
  | { status: "ready"; data: GetSettingsViewResponse }
  | { status: "error"; message: string };

type AgentEditorState =
  | { status: "loading" }
  | {
      status: "ready";
      source: GetAgentEditorViewResponse;
      draft: AgentEditorDraft;
      initialFingerprint: string;
      isSaving: boolean;
      isDeleting: boolean;
      isRefreshingModels: boolean;
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

type AgentEditorDraft = {
  id: string | null;
  name: string;
  systemPrompt: string;
  verbosity: string;
  temperature: string;
  tagsInput: string;
  modelSelection: string;
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
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

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

type CouncilViewState =
  | { status: "loading" }
  | {
      status: "ready";
      source: GetCouncilViewResponse;
      isStarting: boolean;
      isPausing: boolean;
      isResuming: boolean;
      isGeneratingManualTurn: boolean;
      isInjectingConductor: boolean;
      isAdvancingAutopilot: boolean;
      isCancellingGeneration: boolean;
      isLeavingView: boolean;
      selectedManualSpeakerId: string | null;
      conductorDraft: string;
      message: string;
    }
  | { status: "error"; message: string };

type ToastLevel = "info" | "warning" | "error";

type ToastState = {
  id: string;
  level: ToastLevel;
  message: string;
};

const TOAST_TIMEOUT_MS = 4200;

const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Gemini",
  ollama: "Ollama",
  openrouter: "OpenRouter",
};

const toInitialDraftState = (provider: ProviderConfigDto): ProviderDraftState => ({
  providerId: provider.providerId,
  endpointUrl: provider.endpointUrl ?? "",
  apiKey: "",
  testToken: null,
  testStatusText: "Not tested",
  message: "",
  isTesting: false,
  isSaving: false,
});

const fingerprintProvider = (provider: ProviderDraftState): string =>
  JSON.stringify({
    providerId: provider.providerId,
    endpointUrl: provider.endpointUrl.trim() || null,
    apiKey: provider.apiKey.trim() || null,
  });

const toProviderDraftDto = (provider: ProviderDraftState): ProviderDraftDto => ({
  providerId: provider.providerId,
  endpointUrl: provider.endpointUrl.trim() || null,
  apiKey: provider.apiKey.trim() || null,
});

const isSaveAllowed = (provider: ProviderDraftState): boolean =>
  provider.testToken !== null && !provider.isTesting && !provider.isSaving;

const sortProviderIds = (providerIds: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...providerIds].sort((a, b) => a.localeCompare(b));

const providerIdsFromState = (
  drafts: Record<ProviderId, ProviderDraftState>,
): ReadonlyArray<ProviderId> =>
  sortProviderIds(Object.keys(drafts) as ReadonlyArray<ProviderId>) as ReadonlyArray<ProviderId>;

const buildSavedFingerprints = (
  drafts: Record<ProviderId, ProviderDraftState>,
): Record<ProviderId, string> => ({
  gemini: fingerprintProvider(drafts.gemini),
  ollama: fingerprintProvider(drafts.ollama),
  openrouter: fingerprintProvider(drafts.openrouter),
});

const toModelSelectionValue = (modelRefOrNull: ModelRef | null): string =>
  modelRefOrNull === null ? "" : `${modelRefOrNull.providerId}:${modelRefOrNull.modelId}`;

const toModelRef = (selection: string): ModelRef | null => {
  if (selection.length === 0) {
    return null;
  }

  const [providerId, ...modelIdParts] = selection.split(":");
  const modelId = modelIdParts.join(":");
  if (!providerId || modelId.length === 0) {
    return null;
  }

  return {
    providerId,
    modelId,
  };
};

const toAgentEditorDraft = (agent: AgentDto | null): AgentEditorDraft => ({
  id: agent?.id ?? null,
  name: agent?.name ?? "",
  systemPrompt: agent?.systemPrompt ?? "",
  verbosity: agent?.verbosity ?? "",
  temperature:
    agent?.temperature === null || agent?.temperature === undefined
      ? ""
      : String(agent.temperature),
  tagsInput: agent?.tags.join(", ") ?? "",
  modelSelection: toModelSelectionValue(agent?.modelRefOrNull ?? null),
});

const toCouncilEditorDraft = (council: CouncilDto | null): CouncilEditorDraft => ({
  id: council?.id ?? null,
  title: council?.title ?? "",
  topic: council?.topic ?? "",
  goal: council?.goal ?? "",
  mode: council?.mode ?? "manual",
  tagsInput: council?.tags.join(", ") ?? "",
  conductorModelSelection: toModelSelectionValue(council?.conductorModelRefOrNull ?? null),
  selectedMemberIds: council?.memberAgentIds ?? [],
});

const modelLabel = (agent: AgentDto, globalDefaultModelRef: ModelRef | null): string => {
  if (agent.modelRefOrNull !== null) {
    return `${agent.modelRefOrNull.providerId}:${agent.modelRefOrNull.modelId}`;
  }

  if (globalDefaultModelRef !== null) {
    return `Global default (${globalDefaultModelRef.providerId}:${globalDefaultModelRef.modelId})`;
  }

  return "Global default (unselected)";
};

const councilModelLabel = (council: CouncilDto, globalDefaultModelRef: ModelRef | null): string => {
  if (council.conductorModelRefOrNull !== null) {
    return `${council.conductorModelRefOrNull.providerId}:${council.conductorModelRefOrNull.modelId}`;
  }

  if (globalDefaultModelRef !== null) {
    return `Global default (${globalDefaultModelRef.providerId}:${globalDefaultModelRef.modelId})`;
  }

  return "Global default (unselected)";
};

const isAgentDraftInvalidConfig = (params: {
  modelSelection: string;
  modelCatalog: GetAgentEditorViewResponse["modelCatalog"];
  globalDefaultModelRef: ModelRef | null;
}): boolean => {
  const selected = toModelRef(params.modelSelection);
  const resolved = selected ?? params.globalDefaultModelRef;
  if (resolved === null) {
    return true;
  }

  const models = params.modelCatalog.modelsByProvider[resolved.providerId] ?? [];
  return !models.includes(resolved.modelId);
};

const isCouncilDraftInvalidConfig = (params: {
  conductorModelSelection: string;
  modelCatalog: GetCouncilEditorViewResponse["modelCatalog"];
  globalDefaultModelRef: ModelRef | null;
}): boolean => {
  const selected = toModelRef(params.conductorModelSelection);
  const resolved = selected ?? params.globalDefaultModelRef;
  if (resolved === null) {
    return true;
  }

  const models = params.modelCatalog.modelsByProvider[resolved.providerId] ?? [];
  return !models.includes(resolved.modelId);
};

export const App = (): JSX.Element => {
  const [homeTab, setHomeTab] = useState<HomeTab>("councils");
  const [screen, setScreen] = useState<ScreenState>({ kind: "home" });

  const [settingsViewState, setSettingsViewState] = useState<SettingsViewState>({
    status: "loading",
  });
  const [drafts, setDrafts] = useState<Record<ProviderId, ProviderDraftState> | null>(null);
  const [globalDefaultSelection, setGlobalDefaultSelection] = useState<string>("");
  const [refreshStatus, setRefreshStatus] = useState("Ready");
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [savedDraftFingerprints, setSavedDraftFingerprints] = useState<Record<
    ProviderId,
    string
  > | null>(null);
  const [savedGlobalDefaultSelection, setSavedGlobalDefaultSelection] = useState("");

  const [agents, setAgents] = useState<ReadonlyArray<AgentDto>>([]);
  const [agentsPage, setAgentsPage] = useState(1);
  const [agentsHasMore, setAgentsHasMore] = useState(false);
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsLoadingMore, setAgentsLoadingMore] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsSortBy, setAgentsSortBy] = useState<AgentSortField>("updatedAt");
  const [agentsSortDirection, setAgentsSortDirection] = useState<SortDirection>("desc");
  const [agentsSearchText, setAgentsSearchText] = useState("");
  const [agentsTagFilter, setAgentsTagFilter] = useState("");
  const [agentsGlobalDefaultModel, setAgentsGlobalDefaultModel] = useState<ModelRef | null>(null);

  const [agentEditorState, setAgentEditorState] = useState<AgentEditorState>({ status: "loading" });

  const [councils, setCouncils] = useState<ReadonlyArray<CouncilDto>>([]);
  const [councilsPage, setCouncilsPage] = useState(1);
  const [councilsHasMore, setCouncilsHasMore] = useState(false);
  const [councilsTotal, setCouncilsTotal] = useState(0);
  const [councilsLoading, setCouncilsLoading] = useState(false);
  const [councilsLoadingMore, setCouncilsLoadingMore] = useState(false);
  const [councilsError, setCouncilsError] = useState<string | null>(null);
  const [councilsSortBy, setCouncilsSortBy] = useState<CouncilSortField>("updatedAt");
  const [councilsSortDirection, setCouncilsSortDirection] = useState<SortDirection>("desc");
  const [councilsSearchText, setCouncilsSearchText] = useState("");
  const [councilsTagFilter, setCouncilsTagFilter] = useState("");
  const [councilsArchivedFilter, setCouncilsArchivedFilter] =
    useState<CouncilArchivedFilter>("all");
  const [councilsGlobalDefaultModel, setCouncilsGlobalDefaultModel] = useState<ModelRef | null>(
    null,
  );
  const [councilEditorState, setCouncilEditorState] = useState<CouncilEditorState>({
    status: "loading",
  });
  const [councilViewState, setCouncilViewState] = useState<CouncilViewState>({ status: "loading" });

  const [toasts, setToasts] = useState<ReadonlyArray<ToastState>>([]);
  const toastTimers = useRef(new Map<string, number>());
  const draftsRef = useRef<Record<ProviderId, ProviderDraftState> | null>(null);

  const pushToast = useCallback((level: ToastLevel, message: string): void => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((current) => [...current, { id, level, message }]);

    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      toastTimers.current.delete(id);
    }, TOAST_TIMEOUT_MS);
    toastTimers.current.set(id, timer);
  }, []);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    return () => {
      for (const timer of toastTimers.current.values()) {
        window.clearTimeout(timer);
      }
      toastTimers.current.clear();
    };
  }, []);

  const loadSettingsView = useCallback(async (): Promise<void> => {
    setSettingsViewState({ status: "loading" });
    const result = await window.api.settings.getView({ viewKind: "settings" });
    if (!result.ok) {
      setSettingsViewState({ status: "error", message: result.error.userMessage });
      pushToast("error", result.error.userMessage);
      return;
    }

    const draftMap = result.value.providers.reduce<Record<ProviderId, ProviderDraftState>>(
      (acc, provider) => {
        acc[provider.providerId] = toInitialDraftState(provider);
        return acc;
      },
      {
        gemini: toInitialDraftState({
          providerId: "gemini",
          endpointUrl: null,
          hasCredential: false,
          lastSavedAtUtc: null,
        }),
        ollama: toInitialDraftState({
          providerId: "ollama",
          endpointUrl: null,
          hasCredential: false,
          lastSavedAtUtc: null,
        }),
        openrouter: toInitialDraftState({
          providerId: "openrouter",
          endpointUrl: null,
          hasCredential: false,
          lastSavedAtUtc: null,
        }),
      },
    );

    setDrafts(draftMap);
    const nextSelection = toModelSelectionValue(result.value.globalDefaultModelRef);
    setGlobalDefaultSelection(nextSelection);
    setSavedGlobalDefaultSelection(nextSelection);
    setSavedDraftFingerprints(buildSavedFingerprints(draftMap));
    setRefreshStatus("Ready");
    setSettingsViewState({ status: "ready", data: result.value });
  }, [pushToast]);

  const loadAgents = useCallback(
    async (params: { page: number; append: boolean }): Promise<void> => {
      if (params.append) {
        setAgentsLoadingMore(true);
      } else {
        setAgentsLoading(true);
      }
      setAgentsError(null);

      const result = await window.api.agents.list({
        viewKind: "agentsList",
        searchText: agentsSearchText,
        tagFilter: agentsTagFilter,
        sortBy: agentsSortBy,
        sortDirection: agentsSortDirection,
        page: params.page,
      });

      if (!result.ok) {
        setAgentsError(result.error.userMessage);
        pushToast("error", result.error.userMessage);
        setAgentsLoading(false);
        setAgentsLoadingMore(false);
        return;
      }

      setAgents((current) =>
        params.append ? [...current, ...result.value.items] : result.value.items,
      );
      setAgentsPage(result.value.page);
      setAgentsHasMore(result.value.hasMore);
      setAgentsTotal(result.value.total);
      setAgentsGlobalDefaultModel(result.value.globalDefaultModelRef);
      setAgentsLoading(false);
      setAgentsLoadingMore(false);
    },
    [agentsSearchText, agentsTagFilter, agentsSortBy, agentsSortDirection, pushToast],
  );

  const loadCouncils = useCallback(
    async (params: { page: number; append: boolean }): Promise<void> => {
      if (params.append) {
        setCouncilsLoadingMore(true);
      } else {
        setCouncilsLoading(true);
      }
      setCouncilsError(null);

      const result = await window.api.councils.list({
        viewKind: "councilsList",
        searchText: councilsSearchText,
        tagFilter: councilsTagFilter,
        archivedFilter: councilsArchivedFilter,
        sortBy: councilsSortBy,
        sortDirection: councilsSortDirection,
        page: params.page,
      });

      if (!result.ok) {
        setCouncilsError(result.error.userMessage);
        pushToast("error", result.error.userMessage);
        setCouncilsLoading(false);
        setCouncilsLoadingMore(false);
        return;
      }

      setCouncils((current) =>
        params.append ? [...current, ...result.value.items] : result.value.items,
      );
      setCouncilsPage(result.value.page);
      setCouncilsHasMore(result.value.hasMore);
      setCouncilsTotal(result.value.total);
      setCouncilsGlobalDefaultModel(result.value.globalDefaultModelRef);
      setCouncilsLoading(false);
      setCouncilsLoadingMore(false);
    },
    [
      councilsSearchText,
      councilsTagFilter,
      councilsArchivedFilter,
      councilsSortBy,
      councilsSortDirection,
      pushToast,
    ],
  );

  useEffect(() => {
    void loadSettingsView();
  }, [loadSettingsView]);

  useEffect(() => {
    if (screen.kind === "home" && homeTab === "agents") {
      void loadAgents({ page: 1, append: false });
    }
  }, [homeTab, screen.kind, loadAgents]);

  useEffect(() => {
    if (screen.kind === "home" && homeTab === "councils") {
      void loadCouncils({ page: 1, append: false });
    }
  }, [homeTab, screen.kind, loadCouncils]);

  const providerOrder = useMemo(() => {
    if (drafts === null) {
      return [] as ReadonlyArray<ProviderId>;
    }
    return providerIdsFromState(drafts);
  }, [drafts]);

  const hasUnsavedSettingsChanges = useMemo(() => {
    if (drafts === null || savedDraftFingerprints === null) {
      return false;
    }

    const currentFingerprints = buildSavedFingerprints(drafts);
    return (
      currentFingerprints.gemini !== savedDraftFingerprints.gemini ||
      currentFingerprints.ollama !== savedDraftFingerprints.ollama ||
      currentFingerprints.openrouter !== savedDraftFingerprints.openrouter ||
      globalDefaultSelection !== savedGlobalDefaultSelection
    );
  }, [drafts, savedDraftFingerprints, globalDefaultSelection, savedGlobalDefaultSelection]);

  const hasUnsavedAgentDraft =
    agentEditorState.status === "ready" &&
    JSON.stringify(agentEditorState.draft) !== agentEditorState.initialFingerprint;

  const hasUnsavedCouncilDraft =
    councilEditorState.status === "ready" &&
    JSON.stringify(councilEditorState.draft) !== councilEditorState.initialFingerprint;

  useEffect(() => {
    const beforeUnloadHandler = (event: BeforeUnloadEvent): void => {
      if (!hasUnsavedSettingsChanges && !hasUnsavedAgentDraft && !hasUnsavedCouncilDraft) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
  }, [hasUnsavedSettingsChanges, hasUnsavedAgentDraft, hasUnsavedCouncilDraft]);

  const updateProviderDraft = (
    providerId: ProviderId,
    updates: Partial<Pick<ProviderDraftState, "endpointUrl" | "apiKey">>,
  ): void => {
    setDrafts((current) => {
      if (current === null) {
        return current;
      }
      const provider = current[providerId];
      const nextProvider: ProviderDraftState = {
        ...provider,
        ...updates,
        testToken: null,
        message: "Connection must be tested again before save.",
      };
      return { ...current, [providerId]: nextProvider };
    });
  };

  const runConnectionTest = async (providerId: ProviderId): Promise<void> => {
    const currentDrafts = draftsRef.current;
    if (currentDrafts === null) {
      return;
    }

    const provider = currentDrafts[providerId];
    const initialFingerprint = fingerprintProvider(provider);
    setDrafts((current) =>
      current === null
        ? current
        : {
            ...current,
            [providerId]: {
              ...current[providerId],
              isTesting: true,
              message: "",
            },
          },
    );

    const result = await window.api.providers.testConnection({
      provider: toProviderDraftDto(provider),
    });

    const latestDraft = draftsRef.current?.[providerId] ?? provider;
    const draftChanged = fingerprintProvider(latestDraft) !== initialFingerprint;
    if (result.ok) {
      const toastMessage = draftChanged
        ? "Draft changed after test. Re-run test before saving."
        : "Connection test successful. You can save now.";
      pushToast(draftChanged ? "warning" : "info", toastMessage);
    } else {
      pushToast("error", result.error.userMessage);
    }

    setDrafts((current) => {
      if (current === null) {
        return current;
      }

      const currentProvider = current[providerId];
      if (result.ok) {
        const message = draftChanged
          ? "Draft changed after test. Re-run test before saving."
          : "Connection test successful. You can save now.";
        return {
          ...current,
          [providerId]: {
            ...currentProvider,
            isTesting: false,
            testToken: draftChanged ? null : result.value.testToken,
            testStatusText: result.value.statusText,
            message,
          },
        };
      }

      return {
        ...current,
        [providerId]: {
          ...currentProvider,
          isTesting: false,
          testToken: null,
          testStatusText: "Connection failed",
          message: result.error.userMessage,
        },
      };
    });
  };

  const saveProvider = async (providerId: ProviderId): Promise<void> => {
    const currentDrafts = draftsRef.current;
    if (currentDrafts === null) {
      return;
    }

    const provider = currentDrafts[providerId];
    if (provider.testToken === null) {
      const warningMessage = "Run a successful connection test before saving.";
      pushToast("warning", warningMessage);
      setDrafts((current) =>
        current === null
          ? current
          : {
              ...current,
              [providerId]: {
                ...current[providerId],
                message: warningMessage,
              },
            },
      );
      return;
    }

    setDrafts((current) =>
      current === null
        ? current
        : {
            ...current,
            [providerId]: {
              ...current[providerId],
              isSaving: true,
              message: "",
            },
          },
    );

    const result = await window.api.providers.saveConfig({
      provider: toProviderDraftDto(provider),
      testToken: provider.testToken,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setDrafts((current) =>
        current === null
          ? current
          : {
              ...current,
              [providerId]: {
                ...current[providerId],
                isSaving: false,
                message: result.error.userMessage,
              },
            },
      );
      return;
    }

    await loadSettingsView();
    pushToast("info", `${PROVIDER_LABELS[providerId]} provider saved.`);
  };

  const onRefreshModels = async (): Promise<void> => {
    setIsRefreshingModels(true);
    setRefreshStatus("Refreshing models...");
    const result = await window.api.providers.refreshModelCatalog({ viewKind: "settings" });
    if (!result.ok) {
      setRefreshStatus(result.error.userMessage);
      pushToast("error", result.error.userMessage);
      setIsRefreshingModels(false);
      return;
    }

    await loadSettingsView();
    setRefreshStatus("Model catalog refreshed.");
    pushToast("info", "Model catalog refreshed.");
    setIsRefreshingModels(false);
  };

  const onSaveGlobalDefault = async (): Promise<void> => {
    const result = await window.api.settings.setGlobalDefaultModel({
      viewKind: "settings",
      modelRefOrNull: toModelRef(globalDefaultSelection),
    });
    if (!result.ok) {
      setRefreshStatus(result.error.userMessage);
      pushToast("error", result.error.userMessage);
      return;
    }

    await loadSettingsView();
    setSavedGlobalDefaultSelection(globalDefaultSelection);
    setRefreshStatus("Global default model saved.");
    pushToast("info", "Global default model saved.");
  };

  const openAgentEditor = async (agentId: string | null): Promise<void> => {
    setScreen({ kind: "agentEditor", agentId });
    setAgentEditorState({ status: "loading" });

    const result = await window.api.agents.getEditorView({
      viewKind: "agentEdit",
      agentId,
    });

    if (!result.ok) {
      setAgentEditorState({ status: "error", message: result.error.userMessage });
      pushToast("error", result.error.userMessage);
      return;
    }

    const draft = toAgentEditorDraft(result.value.agent);
    setAgentEditorState({
      status: "ready",
      source: result.value,
      draft,
      initialFingerprint: JSON.stringify(draft),
      isSaving: false,
      isDeleting: false,
      isRefreshingModels: false,
      message: "",
    });
  };

  const closeAgentEditor = (force = false): void => {
    if (!force && hasUnsavedAgentDraft) {
      const confirmed = window.confirm("Discard unsaved agent changes?");
      if (!confirmed) {
        return;
      }
    }

    setScreen({ kind: "home" });
    setHomeTab("agents");
    void loadAgents({ page: 1, append: false });
  };

  const updateAgentDraft = (patch: Partial<AgentEditorDraft>): void => {
    setAgentEditorState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        draft: {
          ...current.draft,
          ...patch,
        },
      };
    });
  };

  const saveAgent = async (): Promise<void> => {
    if (agentEditorState.status !== "ready") {
      return;
    }

    const normalizedTags = agentEditorState.draft.tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const parsedTemperature =
      agentEditorState.draft.temperature.trim().length === 0
        ? null
        : Number.parseFloat(agentEditorState.draft.temperature);

    if (Number.isNaN(parsedTemperature ?? 0)) {
      pushToast("warning", "Temperature must be a valid number.");
      return;
    }

    setAgentEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isSaving: true,
            message: "",
          },
    );

    const result = await window.api.agents.save({
      viewKind: "agentEdit",
      id: agentEditorState.draft.id,
      name: agentEditorState.draft.name,
      systemPrompt: agentEditorState.draft.systemPrompt,
      verbosity:
        agentEditorState.draft.verbosity.trim().length === 0
          ? null
          : agentEditorState.draft.verbosity,
      temperature: parsedTemperature,
      tags: normalizedTags,
      modelRefOrNull: toModelRef(agentEditorState.draft.modelSelection),
    });

    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setAgentEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isSaving: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Agent saved.");
    closeAgentEditor(true);
  };

  const deleteAgent = async (): Promise<void> => {
    if (agentEditorState.status !== "ready" || agentEditorState.draft.id === null) {
      return;
    }

    const confirmed = window.confirm("Delete this agent permanently?");
    if (!confirmed) {
      return;
    }

    setAgentEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isDeleting: true,
            message: "",
          },
    );

    const result = await window.api.agents.delete({ id: agentEditorState.draft.id });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setAgentEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isDeleting: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Agent deleted.");
    closeAgentEditor(true);
  };

  const refreshAgentModels = async (): Promise<void> => {
    if (agentEditorState.status !== "ready") {
      return;
    }

    setAgentEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isRefreshingModels: true,
            message: "",
          },
    );

    const result = await window.api.agents.refreshModelCatalog({ viewKind: "agentEdit" });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setAgentEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isRefreshingModels: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    const refreshed = await window.api.agents.getEditorView({
      viewKind: "agentEdit",
      agentId: agentEditorState.draft.id,
    });
    if (!refreshed.ok) {
      pushToast("error", refreshed.error.userMessage);
      return;
    }

    setAgentEditorState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        source: refreshed.value,
        isRefreshingModels: false,
        message: "Model options refreshed.",
      };
    });
    pushToast("info", "Agent model options refreshed.");
  };

  const openCouncilEditor = async (councilId: string | null): Promise<void> => {
    setScreen({ kind: "councilEditor", councilId });
    setCouncilEditorState({ status: "loading" });

    const result = await window.api.councils.getEditorView({
      viewKind: "councilCreate",
      councilId,
    });

    if (!result.ok) {
      setCouncilEditorState({ status: "error", message: result.error.userMessage });
      pushToast("error", result.error.userMessage);
      return;
    }

    const draft = toCouncilEditorDraft(result.value.council);
    setCouncilEditorState({
      status: "ready",
      source: result.value,
      draft,
      initialFingerprint: JSON.stringify(draft),
      isSaving: false,
      isDeleting: false,
      isArchiving: false,
      isRefreshingModels: false,
      message: "",
    });
  };

  const loadCouncilView = useCallback(
    async (councilId: string): Promise<void> => {
      setCouncilViewState({ status: "loading" });
      const result = await window.api.councils.getCouncilView({
        viewKind: "councilView",
        councilId,
      });

      if (!result.ok) {
        setCouncilViewState({ status: "error", message: result.error.userMessage });
        pushToast("error", result.error.userMessage);
        return;
      }

      setCouncilViewState({
        status: "ready",
        source: result.value,
        isStarting: false,
        isPausing: false,
        isResuming: false,
        isGeneratingManualTurn: false,
        isInjectingConductor: false,
        isAdvancingAutopilot: false,
        isCancellingGeneration: false,
        isLeavingView: false,
        selectedManualSpeakerId: result.value.council.memberAgentIds[0] ?? null,
        conductorDraft: "",
        message: "",
      });
    },
    [pushToast],
  );

  const openCouncilView = async (councilId: string): Promise<void> => {
    setScreen({ kind: "councilView", councilId });
    await loadCouncilView(councilId);
  };

  const leaveCouncilViewSafely = async (onExit: () => void | Promise<void>): Promise<void> => {
    if (screen.kind !== "councilView") {
      await onExit();
      return;
    }

    if (councilViewState.status !== "ready") {
      await onExit();
      return;
    }

    if (councilViewState.isLeavingView) {
      return;
    }

    const exitPlan = buildCouncilViewExitPlan(
      councilViewState.source.council,
      councilViewState.source.generation,
    );

    if (!exitPlan.requiresConfirmation) {
      await onExit();
      return;
    }

    const confirmed = window.confirm(COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE);
    if (!confirmed) {
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isLeavingView: true,
            message: "",
          },
    );

    if (exitPlan.shouldPauseAutopilot) {
      const pauseResult = await window.api.councils.pauseAutopilot({
        id: screen.councilId,
      });

      if (!pauseResult.ok) {
        pushToast("error", pauseResult.error.userMessage);
        setCouncilViewState((current) =>
          current.status !== "ready"
            ? current
            : {
                ...current,
                isLeavingView: false,
                message: pauseResult.error.userMessage,
              },
        );
        return;
      }
    }

    const cancelResult = await window.api.councils.cancelGeneration({ id: screen.councilId });
    if (!cancelResult.ok) {
      pushToast("error", cancelResult.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isLeavingView: false,
              message: cancelResult.error.userMessage,
            },
      );
      return;
    }

    await onExit();
  };

  const closeCouncilView = async (): Promise<void> => {
    await leaveCouncilViewSafely(async () => {
      setScreen({ kind: "home" });
      setHomeTab("councils");
      await loadCouncils({ page: 1, append: false });
    });
  };

  const startCouncilRuntime = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isStarting: true,
            message: "",
          },
    );

    const result = await window.api.councils.start({
      viewKind: "councilView",
      id: screen.councilId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isStarting: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Council started.");
    await loadCouncilView(screen.councilId);
  };

  const pauseCouncilRuntime = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isPausing: true,
            message: "",
          },
    );

    const result = await window.api.councils.pauseAutopilot({
      id: screen.councilId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isPausing: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Autopilot paused.");
    await loadCouncilView(screen.councilId);
  };

  const resumeCouncilRuntime = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isResuming: true,
            message: "",
          },
    );

    const result = await window.api.councils.resumeAutopilot({
      viewKind: "councilView",
      id: screen.councilId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isResuming: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Autopilot resumed.");
    await loadCouncilView(screen.councilId);
  };

  const generateManualTurn = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }
    if (councilViewState.selectedManualSpeakerId === null) {
      pushToast("warning", "Select a member first.");
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isGeneratingManualTurn: true,
            message: "",
          },
    );

    const result = await window.api.councils.generateManualTurn({
      viewKind: "councilView",
      id: screen.councilId,
      memberAgentId: councilViewState.selectedManualSpeakerId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isGeneratingManualTurn: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Manual turn generated.");
    await loadCouncilView(screen.councilId);
  };

  const injectConductorMessage = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    const content = councilViewState.conductorDraft.trim();
    if (content.length === 0) {
      pushToast("warning", "Conductor message cannot be empty.");
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isInjectingConductor: true,
            message: "",
          },
    );

    const result = await window.api.councils.injectConductorMessage({
      viewKind: "councilView",
      id: screen.councilId,
      content,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isInjectingConductor: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Conductor message added.");
    await loadCouncilView(screen.councilId);
  };

  const advanceAutopilotTurn = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isAdvancingAutopilot: true,
            message: "",
          },
    );

    const result = await window.api.councils.advanceAutopilotTurn({
      viewKind: "councilView",
      id: screen.councilId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isAdvancingAutopilot: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Autopilot turn advanced.");
    await loadCouncilView(screen.councilId);
  };

  const cancelCouncilGeneration = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isCancellingGeneration: true,
          },
    );

    const result = await window.api.councils.cancelGeneration({ id: screen.councilId });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isCancellingGeneration: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast(
      "info",
      result.value.cancelled ? "Generation cancelled." : "No generation in progress.",
    );
    await loadCouncilView(screen.councilId);
  };

  const closeCouncilEditor = (force = false): void => {
    if (!force && hasUnsavedCouncilDraft) {
      const confirmed = window.confirm("Discard unsaved council changes?");
      if (!confirmed) {
        return;
      }
    }

    setScreen({ kind: "home" });
    setHomeTab("councils");
    void loadCouncils({ page: 1, append: false });
  };

  const updateCouncilDraft = (patch: Partial<CouncilEditorDraft>): void => {
    setCouncilEditorState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        draft: {
          ...current.draft,
          ...patch,
        },
      };
    });
  };

  const toggleCouncilMember = (memberAgentId: string): void => {
    setCouncilEditorState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      const selected = current.draft.selectedMemberIds.includes(memberAgentId)
        ? current.draft.selectedMemberIds.filter((id) => id !== memberAgentId)
        : [...current.draft.selectedMemberIds, memberAgentId];

      return {
        ...current,
        draft: {
          ...current.draft,
          selectedMemberIds: selected,
        },
      };
    });
  };

  const saveCouncil = async (): Promise<void> => {
    if (councilEditorState.status !== "ready") {
      return;
    }

    const normalizedTags = councilEditorState.draft.tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    setCouncilEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isSaving: true,
            message: "",
          },
    );

    const result = await window.api.councils.save({
      viewKind: "councilCreate",
      id: councilEditorState.draft.id,
      title: councilEditorState.draft.title,
      topic: councilEditorState.draft.topic,
      goal:
        councilEditorState.draft.goal.trim().length === 0 ? null : councilEditorState.draft.goal,
      mode: councilEditorState.draft.mode,
      tags: normalizedTags,
      memberAgentIds: councilEditorState.draft.selectedMemberIds,
      memberColorsByAgentId: {},
      conductorModelRefOrNull: toModelRef(councilEditorState.draft.conductorModelSelection),
    });

    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isSaving: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Council saved.");
    closeCouncilEditor(true);
  };

  const deleteCouncil = async (): Promise<void> => {
    if (councilEditorState.status !== "ready" || councilEditorState.draft.id === null) {
      return;
    }

    const confirmed = window.confirm("Delete this council permanently?");
    if (!confirmed) {
      return;
    }

    setCouncilEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isDeleting: true,
            message: "",
          },
    );

    const result = await window.api.councils.delete({ id: councilEditorState.draft.id });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isDeleting: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Council deleted.");
    closeCouncilEditor(true);
  };

  const setCouncilArchived = async (archived: boolean): Promise<void> => {
    if (councilEditorState.status !== "ready" || councilEditorState.draft.id === null) {
      return;
    }

    setCouncilEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isArchiving: true,
            message: "",
          },
    );

    const result = await window.api.councils.setArchived({
      id: councilEditorState.draft.id,
      archived,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isArchiving: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    const refreshed = await window.api.councils.getEditorView({
      viewKind: "councilCreate",
      councilId: councilEditorState.draft.id,
    });
    if (!refreshed.ok) {
      pushToast("error", refreshed.error.userMessage);
      return;
    }

    setCouncilEditorState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        source: refreshed.value,
        draft: toCouncilEditorDraft(refreshed.value.council),
        initialFingerprint: JSON.stringify(toCouncilEditorDraft(refreshed.value.council)),
        isArchiving: false,
        message: archived ? "Council archived." : "Council restored.",
      };
    });
    pushToast("info", archived ? "Council archived." : "Council restored.");
  };

  const refreshCouncilModels = async (): Promise<void> => {
    if (councilEditorState.status !== "ready") {
      return;
    }

    setCouncilEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isRefreshingModels: true,
            message: "",
          },
    );

    const result = await window.api.councils.refreshModelCatalog({ viewKind: "councilCreate" });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isRefreshingModels: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    const refreshed = await window.api.councils.getEditorView({
      viewKind: "councilCreate",
      councilId: councilEditorState.draft.id,
    });
    if (!refreshed.ok) {
      pushToast("error", refreshed.error.userMessage);
      return;
    }

    setCouncilEditorState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        source: refreshed.value,
        isRefreshingModels: false,
        message: "Conductor model options refreshed.",
      };
    });
    pushToast("info", "Council model options refreshed.");
  };

  if (screen.kind === "councilView") {
    if (councilViewState.status === "loading") {
      return (
        <main className="shell">
          <header className="section-header">
            <button className="secondary" onClick={() => void closeCouncilView()} type="button">
              Back
            </button>
            <h1>Council View</h1>
          </header>
          <p className="status">Loading council view...</p>
        </main>
      );
    }

    if (councilViewState.status === "error") {
      return (
        <main className="shell">
          <header className="section-header">
            <button className="secondary" onClick={() => void closeCouncilView()} type="button">
              Back
            </button>
            <h1>Council View</h1>
          </header>
          <p className="status">Error: {councilViewState.message}</p>
        </main>
      );
    }

    const council = councilViewState.source.council;
    const memberNameById = new Map(
      councilViewState.source.availableAgents.map((agent) => [agent.id, agent.name]),
    );
    const canStart = !council.started && !council.archived;
    const canPause = council.mode === "autopilot" && council.started && !council.paused;
    const canResume = council.mode === "autopilot" && council.started && council.paused;
    const generationRunning = councilViewState.source.generation.status === "running";
    const canManualGenerate = council.mode === "manual" && council.started && !council.archived;
    const canAdvanceAutopilot = council.mode === "autopilot" && council.started && !council.paused;

    return (
      <main className="shell">
        <header className="section-header">
          <div className="button-row">
            <button
              className="secondary"
              disabled={councilViewState.isLeavingView}
              onClick={() => void closeCouncilView()}
              type="button"
            >
              {councilViewState.isLeavingView ? "Leaving..." : "Back"}
            </button>
            <button
              className="secondary"
              disabled={councilViewState.isLeavingView}
              onClick={() =>
                void leaveCouncilViewSafely(async () => {
                  await openCouncilEditor(council.id);
                })
              }
              type="button"
            >
              Edit config
            </button>
            {canStart ? (
              <button
                className="cta"
                disabled={councilViewState.isStarting}
                onClick={() => void startCouncilRuntime()}
                type="button"
              >
                {councilViewState.isStarting ? "Starting..." : "Start"}
              </button>
            ) : null}
            {canPause ? (
              <button
                className="secondary"
                disabled={councilViewState.isPausing}
                onClick={() => void pauseCouncilRuntime()}
                type="button"
              >
                {councilViewState.isPausing ? "Pausing..." : "Pause"}
              </button>
            ) : null}
            {canResume ? (
              <button
                className="cta"
                disabled={councilViewState.isResuming}
                onClick={() => void resumeCouncilRuntime()}
                type="button"
              >
                {councilViewState.isResuming ? "Resuming..." : "Resume"}
              </button>
            ) : null}
            {canAdvanceAutopilot ? (
              <button
                className="secondary"
                disabled={councilViewState.isAdvancingAutopilot || generationRunning}
                onClick={() => void advanceAutopilotTurn()}
                type="button"
              >
                {councilViewState.isAdvancingAutopilot ? "Generating..." : "Next turn"}
              </button>
            ) : null}
            {generationRunning ? (
              <button
                className="secondary"
                disabled={councilViewState.isCancellingGeneration}
                onClick={() => void cancelCouncilGeneration()}
                type="button"
              >
                {councilViewState.isCancellingGeneration ? "Cancelling..." : "Cancel generation"}
              </button>
            ) : null}
          </div>
          <h1>{council.title}</h1>
          <p>
            Mode: {council.mode} | Started: {council.started ? "yes" : "no"} | Paused:{" "}
            {council.paused ? "yes" : "no"} | Turn count: {council.turnCount}
          </p>
        </header>

        <section className="settings-section">
          <p className="meta">Topic: {council.topic}</p>
          <p className="meta">Goal: {council.goal ?? "None"}</p>
          <p className="meta">
            Conductor: {councilModelLabel(council, councilViewState.source.globalDefaultModelRef)}
          </p>
          <p className="meta">Tags: {council.tags.length > 0 ? council.tags.join(", ") : "None"}</p>
          {council.archived ? (
            <p className="status-line">Archived councils are read-only.</p>
          ) : null}
          {council.invalidConfig ? (
            <p className="status-line">
              Invalid config: start/resume is blocked until model config is fixed.
            </p>
          ) : null}
        </section>

        <section className="settings-section">
          <h2>Members</h2>
          <div className="list-grid">
            {council.memberAgentIds.map((memberAgentId) => (
              <article className="list-row" key={memberAgentId}>
                <div>
                  <h3>{memberNameById.get(memberAgentId) ?? memberAgentId}</h3>
                  <p className="meta">Agent id: {memberAgentId}</p>
                </div>
                {canManualGenerate ? (
                  <button
                    className="secondary"
                    disabled={generationRunning || councilViewState.isGeneratingManualTurn}
                    onClick={() =>
                      setCouncilViewState((current) =>
                        current.status !== "ready"
                          ? current
                          : {
                              ...current,
                              selectedManualSpeakerId: memberAgentId,
                            },
                      )
                    }
                    type="button"
                  >
                    {councilViewState.selectedManualSpeakerId === memberAgentId
                      ? "Selected"
                      : "Select speaker"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
          {canManualGenerate ? (
            <div className="button-row">
              <button
                className="cta"
                disabled={generationRunning || councilViewState.isGeneratingManualTurn}
                onClick={() => void generateManualTurn()}
                type="button"
              >
                {councilViewState.isGeneratingManualTurn
                  ? "Generating..."
                  : "Generate selected member"}
              </button>
              <span className="meta">
                Selected: {councilViewState.selectedManualSpeakerId ?? "None"}
              </span>
            </div>
          ) : null}
          {councilViewState.message.length > 0 ? (
            <p className="status-line">{councilViewState.message}</p>
          ) : null}
        </section>

        <section className="settings-section">
          <h2>Conductor message</h2>
          <textarea
            onChange={(event) =>
              setCouncilViewState((current) =>
                current.status !== "ready"
                  ? current
                  : {
                      ...current,
                      conductorDraft: event.target.value,
                    },
              )
            }
            rows={4}
            value={councilViewState.conductorDraft}
          />
          <div className="button-row">
            <button
              className="secondary"
              disabled={
                councilViewState.isInjectingConductor || generationRunning || council.archived
              }
              onClick={() => void injectConductorMessage()}
              type="button"
            >
              {councilViewState.isInjectingConductor ? "Sending..." : "Send as Conductor"}
            </button>
          </div>
          {councilViewState.source.briefing !== null ? (
            <p className="meta">Briefing: {councilViewState.source.briefing.briefing}</p>
          ) : (
            <p className="meta">Briefing: not generated yet.</p>
          )}
        </section>

        <section className="settings-section">
          <h2>Transcript</h2>
          {councilViewState.source.messages.length === 0 ? (
            <p className="status">No messages yet.</p>
          ) : (
            <div className="list-grid">
              {councilViewState.source.messages.map((message) => (
                <article className="list-row" key={message.id}>
                  <div>
                    <h3>
                      {message.senderName} {message.senderKind === "conductor" ? "(Conductor)" : ""}
                    </h3>
                    <p className="meta">
                      #{message.sequenceNumber} at {message.createdAtUtc}
                    </p>
                    <p className="meta">{message.content}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div aria-live="polite" className="toast-stack">
          {toasts.map((toast) => (
            <div className={`toast toast-${toast.level}`} key={toast.id}>
              {toast.message}
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (screen.kind === "councilEditor") {
    if (councilEditorState.status === "loading") {
      return (
        <main className="shell">
          <header className="section-header">
            <button className="secondary" onClick={() => closeCouncilEditor()} type="button">
              Back
            </button>
            <h1>{screen.councilId === null ? "New Council" : "Edit Council"}</h1>
          </header>
          <p className="status">Loading council editor...</p>
        </main>
      );
    }

    if (councilEditorState.status === "error") {
      return (
        <main className="shell">
          <header className="section-header">
            <button className="secondary" onClick={() => closeCouncilEditor()} type="button">
              Back
            </button>
            <h1>Council Editor</h1>
          </header>
          <p className="status">Error: {councilEditorState.message}</p>
        </main>
      );
    }

    const invalidConfig = isCouncilDraftInvalidConfig({
      conductorModelSelection: councilEditorState.draft.conductorModelSelection,
      modelCatalog: councilEditorState.source.modelCatalog,
      globalDefaultModelRef: councilEditorState.source.globalDefaultModelRef,
    });

    return (
      <main className="shell">
        <header className="section-header">
          <div className="button-row">
            <button className="secondary" onClick={() => closeCouncilEditor()} type="button">
              Back
            </button>
            <button
              className="cta"
              disabled={councilEditorState.isSaving}
              onClick={() => void saveCouncil()}
              type="button"
            >
              {councilEditorState.isSaving ? "Saving..." : "Save"}
            </button>
            {councilEditorState.draft.id !== null ? (
              <>
                <button
                  className="secondary"
                  disabled={
                    councilEditorState.isArchiving ||
                    (councilEditorState.source.council?.mode === "autopilot" &&
                      councilEditorState.source.council.started &&
                      !councilEditorState.source.council.paused)
                  }
                  onClick={() =>
                    void setCouncilArchived(councilEditorState.source.council?.archived !== true)
                  }
                  type="button"
                >
                  {councilEditorState.source.council?.archived ? "Restore" : "Archive"}
                </button>
                <button
                  className="danger"
                  disabled={councilEditorState.isDeleting}
                  onClick={() => void deleteCouncil()}
                  type="button"
                >
                  {councilEditorState.isDeleting ? "Deleting..." : "Delete"}
                </button>
              </>
            ) : null}
          </div>
          <h1>{councilEditorState.draft.id === null ? "New Council" : "Edit Council"}</h1>
          <p>Title, Topic, and at least one Member are required before save.</p>
        </header>

        <section className="settings-section">
          <label className="field" htmlFor="council-title">
            Title
          </label>
          <input
            id="council-title"
            onChange={(event) => updateCouncilDraft({ title: event.target.value })}
            type="text"
            value={councilEditorState.draft.title}
          />

          <label className="field" htmlFor="council-topic">
            Topic
          </label>
          <textarea
            id="council-topic"
            onChange={(event) => updateCouncilDraft({ topic: event.target.value })}
            rows={6}
            value={councilEditorState.draft.topic}
          />

          <label className="field" htmlFor="council-goal">
            Goal (optional)
          </label>
          <textarea
            id="council-goal"
            onChange={(event) => updateCouncilDraft({ goal: event.target.value })}
            rows={4}
            value={councilEditorState.draft.goal}
          />

          <label className="field" htmlFor="council-mode">
            Mode
          </label>
          <select
            id="council-mode"
            disabled={councilEditorState.draft.id !== null}
            onChange={(event) => updateCouncilDraft({ mode: event.target.value as CouncilMode })}
            value={councilEditorState.draft.mode}
          >
            <option value="manual">Manual</option>
            <option value="autopilot">Autopilot</option>
          </select>
          {councilEditorState.draft.id !== null ? (
            <p className="meta">Mode is locked after creation.</p>
          ) : null}

          <label className="field" htmlFor="council-tags">
            Tags (comma-separated, max 3)
          </label>
          <input
            id="council-tags"
            onChange={(event) => updateCouncilDraft({ tagsInput: event.target.value })}
            type="text"
            value={councilEditorState.draft.tagsInput}
          />

          <p className="field">Members</p>
          <div className="list-grid">
            {councilEditorState.source.availableAgents.map((agent) => (
              <label className="list-row" key={agent.id}>
                <div>
                  <strong>{agent.name}</strong>
                  {agent.invalidConfig ? (
                    <p className="meta">Invalid config (can still be selected)</p>
                  ) : null}
                </div>
                <input
                  checked={councilEditorState.draft.selectedMemberIds.includes(agent.id)}
                  onChange={() => toggleCouncilMember(agent.id)}
                  type="checkbox"
                />
              </label>
            ))}
          </div>

          <label className="field" htmlFor="council-conductor-model">
            Conductor model
          </label>
          <div className="button-row">
            <select
              id="council-conductor-model"
              onChange={(event) =>
                updateCouncilDraft({ conductorModelSelection: event.target.value })
              }
              value={councilEditorState.draft.conductorModelSelection}
            >
              <option value="">Global default</option>
              {Object.entries(councilEditorState.source.modelCatalog.modelsByProvider).map(
                ([providerId, modelIds]) => (
                  <optgroup key={providerId} label={providerId}>
                    {modelIds.map((modelId) => (
                      <option key={`${providerId}:${modelId}`} value={`${providerId}:${modelId}`}>
                        {modelId}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </select>
            <button
              className="secondary"
              disabled={
                !councilEditorState.source.canRefreshModels || councilEditorState.isRefreshingModels
              }
              onClick={() => void refreshCouncilModels()}
              type="button"
            >
              {councilEditorState.isRefreshingModels ? "Refreshing..." : "Refresh models"}
            </button>
            {invalidConfig ? (
              <span className="warning-badge" title="Invalid config">
                Invalid config
              </span>
            ) : null}
          </div>

          {councilEditorState.message.length > 0 ? (
            <p className="status-line">{councilEditorState.message}</p>
          ) : null}
          {councilEditorState.source.council?.mode === "autopilot" &&
          councilEditorState.source.council.started &&
          !councilEditorState.source.council.paused ? (
            <p className="status-line">Pause Autopilot in Council View before archiving.</p>
          ) : null}
        </section>

        <div aria-live="polite" className="toast-stack">
          {toasts.map((toast) => (
            <div className={`toast toast-${toast.level}`} key={toast.id}>
              {toast.message}
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (screen.kind === "agentEditor") {
    if (agentEditorState.status === "loading") {
      return (
        <main className="shell">
          <header className="section-header">
            <button className="secondary" onClick={() => closeAgentEditor()} type="button">
              Back
            </button>
            <h1>{screen.agentId === null ? "New Agent" : "Edit Agent"}</h1>
          </header>
          <p className="status">Loading agent editor...</p>
        </main>
      );
    }

    if (agentEditorState.status === "error") {
      return (
        <main className="shell">
          <header className="section-header">
            <button className="secondary" onClick={() => closeAgentEditor()} type="button">
              Back
            </button>
            <h1>Agent Editor</h1>
          </header>
          <p className="status">Error: {agentEditorState.message}</p>
        </main>
      );
    }

    const invalidConfig = isAgentDraftInvalidConfig({
      modelSelection: agentEditorState.draft.modelSelection,
      modelCatalog: agentEditorState.source.modelCatalog,
      globalDefaultModelRef: agentEditorState.source.globalDefaultModelRef,
    });

    return (
      <main className="shell">
        <header className="section-header">
          <div className="button-row">
            <button className="secondary" onClick={() => closeAgentEditor()} type="button">
              Back
            </button>
            <button
              className="cta"
              disabled={agentEditorState.isSaving}
              onClick={() => void saveAgent()}
              type="button"
            >
              {agentEditorState.isSaving ? "Saving..." : "Save"}
            </button>
            {agentEditorState.draft.id !== null ? (
              <button
                className="danger"
                disabled={agentEditorState.isDeleting}
                onClick={() => void deleteAgent()}
                type="button"
              >
                {agentEditorState.isDeleting ? "Deleting..." : "Delete"}
              </button>
            ) : null}
          </div>
          <h1>{agentEditorState.draft.id === null ? "New Agent" : "Edit Agent"}</h1>
          <p>Fields marked required must be completed before save.</p>
        </header>

        <section className="settings-section">
          <label className="field" htmlFor="agent-name">
            Name
          </label>
          <input
            id="agent-name"
            onChange={(event) => updateAgentDraft({ name: event.target.value })}
            type="text"
            value={agentEditorState.draft.name}
          />

          <label className="field" htmlFor="agent-system-prompt">
            System Prompt
          </label>
          <textarea
            id="agent-system-prompt"
            onChange={(event) => updateAgentDraft({ systemPrompt: event.target.value })}
            rows={8}
            value={agentEditorState.draft.systemPrompt}
          />

          <label className="field" htmlFor="agent-verbosity">
            Verbosity (optional)
          </label>
          <input
            id="agent-verbosity"
            onChange={(event) => updateAgentDraft({ verbosity: event.target.value })}
            type="text"
            value={agentEditorState.draft.verbosity}
          />

          <label className="field" htmlFor="agent-temperature">
            Temperature (optional)
          </label>
          <input
            id="agent-temperature"
            onChange={(event) => updateAgentDraft({ temperature: event.target.value })}
            placeholder="0.0 - 2.0"
            type="text"
            value={agentEditorState.draft.temperature}
          />

          <label className="field" htmlFor="agent-tags">
            Tags (comma-separated, max 3)
          </label>
          <input
            id="agent-tags"
            onChange={(event) => updateAgentDraft({ tagsInput: event.target.value })}
            type="text"
            value={agentEditorState.draft.tagsInput}
          />

          <label className="field" htmlFor="agent-model">
            Model
          </label>
          <div className="button-row">
            <select
              id="agent-model"
              onChange={(event) => updateAgentDraft({ modelSelection: event.target.value })}
              value={agentEditorState.draft.modelSelection}
            >
              <option value="">Global default</option>
              {Object.entries(agentEditorState.source.modelCatalog.modelsByProvider).map(
                ([providerId, modelIds]) => (
                  <optgroup key={providerId} label={providerId}>
                    {modelIds.map((modelId) => (
                      <option key={`${providerId}:${modelId}`} value={`${providerId}:${modelId}`}>
                        {modelId}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </select>
            <button
              className="secondary"
              disabled={
                !agentEditorState.source.canRefreshModels || agentEditorState.isRefreshingModels
              }
              onClick={() => void refreshAgentModels()}
              type="button"
            >
              {agentEditorState.isRefreshingModels ? "Refreshing..." : "Refresh models"}
            </button>
            {invalidConfig ? (
              <span className="warning-badge" title="Invalid config">
                Invalid config
              </span>
            ) : null}
          </div>

          {agentEditorState.message.length > 0 ? (
            <p className="status-line">{agentEditorState.message}</p>
          ) : null}
        </section>

        <div aria-live="polite" className="toast-stack">
          {toasts.map((toast) => (
            <div className={`toast toast-${toast.level}`} key={toast.id}>
              {toast.message}
            </div>
          ))}
        </div>
      </main>
    );
  }

  const renderHomeContent = (): JSX.Element => {
    if (homeTab === "councils") {
      return (
        <section className="settings-section">
          <header className="section-header compact">
            <h2>Councils</h2>
            <p>{councilsTotal} total</p>
          </header>
          <div className="agents-controls">
            <input
              aria-label="Search councils"
              onChange={(event) => setCouncilsSearchText(event.target.value)}
              placeholder="Search title or topic"
              type="text"
              value={councilsSearchText}
            />
            <input
              aria-label="Filter councils by tag"
              onChange={(event) => setCouncilsTagFilter(event.target.value)}
              placeholder="Tag filter"
              type="text"
              value={councilsTagFilter}
            />
            <select
              value={councilsArchivedFilter}
              onChange={(event) =>
                setCouncilsArchivedFilter(event.target.value as CouncilArchivedFilter)
              }
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={councilsSortBy}
              onChange={(event) => setCouncilsSortBy(event.target.value as CouncilSortField)}
            >
              <option value="updatedAt">Sort: Modified</option>
              <option value="createdAt">Sort: Created</option>
            </select>
            <select
              value={councilsSortDirection}
              onChange={(event) => setCouncilsSortDirection(event.target.value as SortDirection)}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <button className="cta" onClick={() => void openCouncilEditor(null)} type="button">
              New Council
            </button>
          </div>

          {councilsError !== null ? <p className="status">Error: {councilsError}</p> : null}
          {councilsLoading ? <p className="status">Loading councils...</p> : null}

          {!councilsLoading && councils.length === 0 ? (
            <p className="status">No councils yet. Create your first council.</p>
          ) : null}

          <div className="list-grid">
            {councils.map((council) => (
              <article className="list-row" key={council.id}>
                <div>
                  <h3>{council.title}</h3>
                  <p className="meta">Topic: {council.topic}</p>
                  <p className="meta">Mode: {council.mode}</p>
                  <p className="meta">
                    Runtime:{" "}
                    {council.started ? (council.paused ? "Paused" : "Running") : "Not started"}
                  </p>
                  <p className="meta">
                    Conductor: {councilModelLabel(council, councilsGlobalDefaultModel)}
                  </p>
                  <p className="meta">Turn count: {council.turnCount}</p>
                  <p className="meta">Members: {council.memberAgentIds.length}</p>
                  <p className="meta">
                    Tags: {council.tags.length > 0 ? council.tags.join(", ") : "None"}
                  </p>
                </div>
                <div className="button-row">
                  {council.archived ? (
                    <span className="warning-badge" title="Archived">
                      Archived
                    </span>
                  ) : null}
                  {council.invalidConfig ? (
                    <span className="warning-badge" title="Invalid config">
                      Invalid config
                    </span>
                  ) : null}
                  <button
                    className="cta"
                    onClick={() => void openCouncilView(council.id)}
                    type="button"
                  >
                    Open
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void openCouncilEditor(council.id)}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </article>
            ))}
          </div>

          {councilsHasMore ? (
            <button
              className="secondary"
              disabled={councilsLoadingMore}
              onClick={() => void loadCouncils({ page: councilsPage + 1, append: true })}
              type="button"
            >
              {councilsLoadingMore ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </section>
      );
    }

    if (homeTab === "agents") {
      return (
        <section className="settings-section">
          <header className="section-header compact">
            <h2>Agents</h2>
            <p>{agentsTotal} total</p>
          </header>
          <div className="agents-controls">
            <input
              aria-label="Search agents"
              onChange={(event) => setAgentsSearchText(event.target.value)}
              placeholder="Search name or prompt"
              type="text"
              value={agentsSearchText}
            />
            <input
              aria-label="Filter by tag"
              onChange={(event) => setAgentsTagFilter(event.target.value)}
              placeholder="Tag filter"
              type="text"
              value={agentsTagFilter}
            />
            <select
              value={agentsSortBy}
              onChange={(event) => setAgentsSortBy(event.target.value as AgentSortField)}
            >
              <option value="updatedAt">Sort: Modified</option>
              <option value="createdAt">Sort: Created</option>
            </select>
            <select
              value={agentsSortDirection}
              onChange={(event) => setAgentsSortDirection(event.target.value as SortDirection)}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <button className="cta" onClick={() => void openAgentEditor(null)} type="button">
              New Agent
            </button>
          </div>

          {agentsError !== null ? <p className="status">Error: {agentsError}</p> : null}
          {agentsLoading ? <p className="status">Loading agents...</p> : null}

          {!agentsLoading && agents.length === 0 ? (
            <p className="status">No agents yet. Create your first agent.</p>
          ) : null}

          <div className="list-grid">
            {agents.map((agent) => (
              <article className="list-row" key={agent.id}>
                <div>
                  <h3>{agent.name}</h3>
                  <p className="meta">{agent.systemPrompt}</p>
                  <p className="meta">Model: {modelLabel(agent, agentsGlobalDefaultModel)}</p>
                  <p className="meta">
                    Tags: {agent.tags.length > 0 ? agent.tags.join(", ") : "None"}
                  </p>
                </div>
                <div className="button-row">
                  {agent.invalidConfig ? (
                    <span className="warning-badge" title="Invalid config">
                      Invalid config
                    </span>
                  ) : null}
                  <button
                    className="secondary"
                    onClick={() => void openAgentEditor(agent.id)}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </article>
            ))}
          </div>

          {agentsHasMore ? (
            <button
              className="secondary"
              disabled={agentsLoadingMore}
              onClick={() => void loadAgents({ page: agentsPage + 1, append: true })}
              type="button"
            >
              {agentsLoadingMore ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </section>
      );
    }

    if (settingsViewState.status === "loading" || drafts === null) {
      return (
        <section className="settings-section">
          <h2>Settings</h2>
          <p className="status">Loading settings...</p>
        </section>
      );
    }

    if (settingsViewState.status === "error") {
      return (
        <section className="settings-section">
          <h2>Settings</h2>
          <p className="status">Error: {settingsViewState.message}</p>
          <button className="cta" onClick={() => void loadSettingsView()} type="button">
            Retry
          </button>
        </section>
      );
    }

    return (
      <>
        <section className="settings-section">
          <h2>Providers</h2>
          <div className="provider-grid">
            {providerOrder.map((providerId) => {
              const provider = drafts[providerId];
              const savedProvider = settingsViewState.data.providers.find(
                (item) => item.providerId === providerId,
              );
              const showOllamaNote = providerId === "ollama";

              return (
                <article className="provider-card" key={providerId}>
                  <h3>{PROVIDER_LABELS[providerId]}</h3>
                  <p className="meta">
                    Last saved: {savedProvider?.lastSavedAtUtc ?? "Not saved yet"}
                  </p>

                  <label className="field" htmlFor={`${providerId}-endpoint`}>
                    Endpoint URL
                  </label>
                  <input
                    id={`${providerId}-endpoint`}
                    onChange={(event) =>
                      updateProviderDraft(providerId, { endpointUrl: event.target.value })
                    }
                    placeholder={
                      providerId === "ollama" ? "http://127.0.0.1:11434" : "Optional endpoint"
                    }
                    type="text"
                    value={provider.endpointUrl}
                  />

                  <label className="field" htmlFor={`${providerId}-key`}>
                    API key
                  </label>
                  <input
                    id={`${providerId}-key`}
                    onChange={(event) =>
                      updateProviderDraft(providerId, { apiKey: event.target.value })
                    }
                    placeholder={
                      showOllamaNote
                        ? "Optional for local Ollama, required by some remote endpoints"
                        : "Enter API key"
                    }
                    type="password"
                    value={provider.apiKey}
                  />
                  {showOllamaNote ? (
                    <p className="meta">Local Ollama usually does not need an API key.</p>
                  ) : null}
                  <p className="meta">
                    Credential in keychain: {savedProvider?.hasCredential ? "Saved" : "Not saved"}
                  </p>

                  <div className="button-row">
                    <button
                      className="cta"
                      disabled={provider.isTesting || provider.isSaving}
                      onClick={() => void runConnectionTest(providerId)}
                      type="button"
                    >
                      {provider.isTesting ? "Testing..." : "Test connection"}
                    </button>
                    <button
                      className="secondary"
                      disabled={!isSaveAllowed(provider)}
                      onClick={() => void saveProvider(providerId)}
                      type="button"
                    >
                      {provider.isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>

                  <p className="status-line">Status: {provider.testStatusText}</p>
                  {provider.message.length > 0 ? (
                    <p className="status-line">{provider.message}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="settings-section">
          <h2>Global Default Model</h2>
          <label className="field" htmlFor="global-default-model">
            Model
          </label>
          <select
            id="global-default-model"
            onChange={(event) => setGlobalDefaultSelection(event.target.value)}
            value={globalDefaultSelection}
          >
            <option value="">Unselected</option>
            {Object.entries(settingsViewState.data.modelCatalog.modelsByProvider).map(
              ([providerId, models]) => (
                <optgroup key={providerId} label={providerId}>
                  {models.map((modelId) => (
                    <option key={`${providerId}:${modelId}`} value={`${providerId}:${modelId}`}>
                      {modelId}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
          <div className="button-row">
            <button className="secondary" onClick={() => void onSaveGlobalDefault()} type="button">
              Save global default
            </button>
            {settingsViewState.data.globalDefaultModelInvalidConfig ? (
              <span className="warning-badge" title="Invalid config">
                Invalid config
              </span>
            ) : null}
          </div>
        </section>

        <section className="settings-section">
          <h2>Model Catalog</h2>
          <p className="meta">Snapshot ID: {settingsViewState.data.modelCatalog.snapshotId}</p>
          <button
            className="secondary"
            disabled={!settingsViewState.data.canRefreshModels || isRefreshingModels}
            onClick={() => void onRefreshModels()}
            type="button"
          >
            {isRefreshingModels ? "Refreshing..." : "Refresh models"}
          </button>
          <p className="status-line">{refreshStatus}</p>
        </section>
      </>
    );
  };

  return (
    <main className="shell">
      <header className="section-header">
        <h1>Council</h1>
        <p>Home tabs: Councils, Agents, Settings.</p>
        <div className="tabs">
          <button
            className={homeTab === "councils" ? "tab tab-active" : "tab"}
            onClick={() => setHomeTab("councils")}
            type="button"
          >
            Councils
          </button>
          <button
            className={homeTab === "agents" ? "tab tab-active" : "tab"}
            onClick={() => setHomeTab("agents")}
            type="button"
          >
            Agents
          </button>
          <button
            className={homeTab === "settings" ? "tab tab-active" : "tab"}
            onClick={() => setHomeTab("settings")}
            type="button"
          >
            Settings
          </button>
        </div>
      </header>

      {renderHomeContent()}

      <div aria-live="polite" className="toast-stack">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.level}`} key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
};
