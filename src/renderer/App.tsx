import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  AUTOPILOT_MAX_TURNS_MAX,
  AUTOPILOT_MAX_TURNS_MIN,
  type AutopilotLimitModalAction,
  type AutopilotLimitModalState,
  COUNCIL_CONFIG_MAX_TAGS,
  appendCouncilConfigTag,
  buildInvalidConfigBadgeAriaLabel,
  buildProviderConfiguredBadgeAriaLabel,
  buildProviderConnectionTestButtonAriaLabel,
  councilModelLabel,
  createAutopilotLimitModalState,
  isAgentDraftInvalidConfig,
  isCouncilDraftInvalidConfig,
  isModelSelectionInCatalog,
  modelLabel,
  normalizeTagsDraft,
  parseCouncilConfigTags,
  resolveAutopilotMaxTurns,
  resolveDisclosureKeyboardAction,
  toModelRef,
  toModelSelectionValue,
} from "../shared/app-ui-helpers.js";
import {
  buildManualSpeakerSelectionAriaLabel,
  buildTranscriptMessageAriaLabel,
  resolveInlineConfigEditKeyboardAction,
  resolveTranscriptFocusIndex,
} from "../shared/council-view-accessibility.js";
import {
  buildAutopilotRecoveryNotice,
  buildManualRetryNotice,
} from "../shared/council-view-autopilot-recovery";
import { resolveCouncilViewRuntimeControls } from "../shared/council-view-runtime-controls.js";
import {
  COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE,
  buildCouncilViewExitPlan,
} from "../shared/council-view-runtime-guards";
import {
  resolveThinkingPlaceholderSpeakerId,
  resolveTranscriptAccentColor,
  resolveTranscriptAvatarInitials,
  resolveTranscriptMessageAlignment,
  shouldRenderInlineThinkingCancel,
} from "../shared/council-view-transcript.js";
import type { ModelRef } from "../shared/domain/model-ref";
import { resolveHomeTabFocusIndex } from "../shared/home-keyboard-accessibility.js";
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
import {
  fingerprintProviderDraft,
  isProviderConfigured,
  isProviderDraftChanged,
} from "../shared/provider-settings-ui.js";
import { ConfirmDialog } from "./ConfirmDialog";
import { ToastStack } from "./ToastStack";
import { ColorPicker } from "./components/ColorPicker";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { useToastQueue } from "./use-toast-queue";

type HomeTab = "councils" | "agents" | "settings";
type CouncilViewTab = "discussion" | "config";
type CouncilConfigField = "topic" | "goal" | "tags" | "conductorModel";

type CouncilConfigEditState = {
  field: CouncilConfigField;
  draftValue: string;
};

const HOME_TAB_ORDER: ReadonlyArray<HomeTab> = ["councils", "agents", "settings"];

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
      showDiscardDialog: boolean;
      showDeleteDialog: boolean;
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
      showDiscardDialog: boolean;
      showDeleteDialog: boolean;
      showRemoveMemberDialog: boolean;
      pendingMemberRemovalId: string | null;
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
      pendingManualMemberAgentId: string | null;
      isInjectingConductor: boolean;
      isAdvancingAutopilot: boolean;
      isCancellingGeneration: boolean;
      isExportingTranscript: boolean;
      isLeavingView: boolean;
      showLeaveDialog: boolean;
      activeTab: CouncilViewTab;
      configEdit: CouncilConfigEditState | null;
      configTagInput: string;
      showConfigDiscardDialog: boolean;
      showConfigDeleteDialog: boolean;
      isSavingConfigField: boolean;
      isRefreshingConfigModels: boolean;
      isSavingMembers: boolean;
      showAddMemberPanel: boolean;
      addMemberSearchText: string;
      showMemberRemoveDialog: boolean;
      pendingMemberRemovalId: string | null;
      conductorDraft: string;
      manualTurnRetryMessage: string | null;
      message: string;
    }
  | { status: "error"; message: string };

const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Gemini",
  ollama: "Ollama",
  openrouter: "OpenRouter",
};

const MEMBER_COLOR_PALETTE: ReadonlyArray<string> = [
  "#0a5c66",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0f766e",
  "#166534",
  "#7c2d12",
];

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

const toProviderDraftDto = (provider: ProviderDraftState): ProviderDraftDto => ({
  providerId: provider.providerId,
  endpointUrl: provider.endpointUrl.trim() || null,
  apiKey: provider.apiKey.trim() || null,
});

const isSaveAllowed = (provider: ProviderDraftState): boolean =>
  provider.testToken !== null && !provider.isTesting && !provider.isSaving;

const isConnectionTestAllowed = (params: {
  provider: ProviderDraftState;
  savedFingerprint: string | null;
}): boolean => {
  const { provider, savedFingerprint } = params;
  if (provider.isTesting || provider.isSaving) {
    return false;
  }

  return isProviderDraftChanged({
    provider,
    savedFingerprint,
  });
};

const resolveMemberRemoveDisabledReason = (params: {
  archived: boolean;
  canEditMembers: boolean;
  memberHasMessages: boolean;
  memberCount: number;
  isSavingMembers: boolean;
  started: boolean;
  paused: boolean;
  mode: CouncilMode;
}): string | null => {
  const {
    archived,
    canEditMembers,
    memberHasMessages,
    memberCount,
    isSavingMembers,
    started,
    paused,
    mode,
  } = params;

  if (memberHasMessages) {
    return "Cannot remove members who already sent messages in this council.";
  }

  if (memberCount <= 1) {
    return "At least one member is required.";
  }

  if (isSavingMembers) {
    return "Saving member changes...";
  }

  if (!canEditMembers) {
    if (archived) {
      return "Archived councils are read-only.";
    }
    if (mode === "autopilot" && started && !paused) {
      return "Pause Autopilot before editing members.";
    }
    return "Member changes are currently unavailable.";
  }

  return null;
};

const sortProviderIds = (providerIds: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...providerIds].sort((a, b) => a.localeCompare(b));

const providerIdsFromState = (
  drafts: Record<ProviderId, ProviderDraftState>,
): ReadonlyArray<ProviderId> =>
  sortProviderIds(Object.keys(drafts) as ReadonlyArray<ProviderId>) as ReadonlyArray<ProviderId>;

const buildSavedFingerprints = (
  drafts: Record<ProviderId, ProviderDraftState>,
): Record<ProviderId, string> => ({
  gemini: fingerprintProviderDraft(drafts.gemini),
  ollama: fingerprintProviderDraft(drafts.ollama),
  openrouter: fingerprintProviderDraft(drafts.openrouter),
});

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

const toCouncilConfigFieldDisplayValue = (params: {
  council: CouncilDto;
  field: CouncilConfigField;
}): string => {
  if (params.field === "topic") {
    return params.council.topic;
  }
  if (params.field === "goal") {
    return params.council.goal ?? "";
  }
  if (params.field === "tags") {
    return params.council.tags.join(", ");
  }
  return toModelSelectionValue(params.council.conductorModelRefOrNull);
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
  const [contextLastNInput, setContextLastNInput] = useState("");
  const [savedContextLastNInput, setSavedContextLastNInput] = useState("");

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
  const [exportingCouncilId, setExportingCouncilId] = useState<string | null>(null);
  const [pendingCouncilListDelete, setPendingCouncilListDelete] = useState<CouncilDto | null>(null);
  const [pendingAgentListDelete, setPendingAgentListDelete] = useState<AgentDto | null>(null);
  const [councilEditorState, setCouncilEditorState] = useState<CouncilEditorState>({
    status: "loading",
  });
  const [councilViewState, setCouncilViewState] = useState<CouncilViewState>({ status: "loading" });
  const [autopilotLimitModal, setAutopilotLimitModal] = useState<AutopilotLimitModalState | null>(
    null,
  );

  const { toasts, pushToast } = useToastQueue();
  const draftsRef = useRef<Record<ProviderId, ProviderDraftState> | null>(null);
  const autopilotModalDialogRef = useRef<HTMLDialogElement | null>(null);
  const transcriptRowRefs = useRef<Array<HTMLElement | null>>([]);
  const homeTabButtonRefs = useRef<Record<HomeTab, HTMLButtonElement | null>>({
    councils: null,
    agents: null,
    settings: null,
  });
  const councilConfigEditContainerRef = useRef<HTMLDivElement | null>(null);
  const councilConfigEditInputRef = useRef<HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const homeTabAtDetailOpenRef = useRef<HomeTab>("councils");

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (autopilotLimitModal === null) {
      return;
    }

    const dialog = autopilotModalDialogRef.current;
    if (dialog === null) {
      return;
    }

    const focusTarget = dialog.querySelector<HTMLElement>(
      "#autopilot-max-turns-input:not(:disabled), #autopilot-limit-toggle",
    );
    focusTarget?.focus();
  }, [autopilotLimitModal]);

  useEffect(() => {
    if (councilViewState.status !== "ready" || councilViewState.configEdit === null) {
      return;
    }

    councilConfigEditInputRef.current?.focus();
  }, [councilViewState]);

  useEffect(() => {
    if (screen.kind === "home") {
      document.title = homeTab === "settings" ? "Settings" : "Council";
      return;
    }

    if (screen.kind === "councilView") {
      const title =
        councilViewState.status === "ready"
          ? councilViewState.source.council.title
          : "Council View";
      document.title = `Council: ${title}`;
      return;
    }

    if (screen.kind === "agentEditor") {
      const title =
        agentEditorState.status === "ready"
          ? agentEditorState.draft.name.trim() || "New Agent"
          : screen.agentId === null
            ? "New Agent"
            : "Agent";
      document.title = `Agent: ${title}`;
      return;
    }

    if (screen.kind === "councilEditor") {
      if (screen.councilId === null) {
        document.title = "New Council";
        return;
      }

      const fallbackTitle = "Council";
      const title =
        councilEditorState.status === "ready"
          ? councilEditorState.draft.title.trim() || fallbackTitle
          : fallbackTitle;
      document.title = `Council: ${title}`;
    }
  }, [screen, homeTab, councilViewState, agentEditorState, councilEditorState]);

  useEffect(() => {
    if (
      councilViewState.status !== "ready" ||
      councilViewState.activeTab !== "config" ||
      councilViewState.configEdit === null ||
      councilViewState.showConfigDiscardDialog
    ) {
      return;
    }

    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (councilConfigEditContainerRef.current?.contains(target) === true) {
        return;
      }

      closeCouncilConfigEdit(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [councilViewState]);

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
    const nextContextLastN = String(result.value.contextLastN);
    setContextLastNInput(nextContextLastN);
    setSavedContextLastNInput(nextContextLastN);
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

  // Close council menu dropdowns when clicking outside
  useEffect(() => {
    if (screen.kind !== "home" || homeTab !== "councils") {
      return;
    }

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const openMenus = document.querySelectorAll<HTMLDetailsElement>(
        ".council-actions-menu[open]",
      );

      for (const menu of openMenus) {
        if (!menu.contains(target)) {
          menu.open = false;
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [screen.kind, homeTab]);

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
      globalDefaultSelection !== savedGlobalDefaultSelection ||
      contextLastNInput.trim() !== savedContextLastNInput.trim()
    );
  }, [
    drafts,
    savedDraftFingerprints,
    globalDefaultSelection,
    savedGlobalDefaultSelection,
    contextLastNInput,
    savedContextLastNInput,
  ]);

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
    const savedFingerprint = savedDraftFingerprints?.[providerId] ?? null;
    if (!isProviderDraftChanged({ provider, savedFingerprint })) {
      const infoMessage = "No provider changes to test. Edit endpoint or key first.";
      pushToast("info", infoMessage);
      setDrafts((current) =>
        current === null
          ? current
          : {
              ...current,
              [providerId]: {
                ...current[providerId],
                message: infoMessage,
              },
            },
      );
      return;
    }

    const initialFingerprint = fingerprintProviderDraft(provider);
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
    const draftChanged = fingerprintProviderDraft(latestDraft) !== initialFingerprint;
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

  const onSaveContextLastN = async (): Promise<void> => {
    const parsed = Number.parseInt(contextLastNInput.trim(), 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
      const message = "Context window size must be a whole number.";
      setRefreshStatus(message);
      pushToast("warning", message);
      return;
    }

    const result = await window.api.settings.setContextLastN({
      viewKind: "settings",
      contextLastN: parsed,
    });
    if (!result.ok) {
      setRefreshStatus(result.error.userMessage);
      pushToast("error", result.error.userMessage);
      return;
    }

    await loadSettingsView();
    const savedValue = String(result.value.contextLastN);
    setContextLastNInput(savedValue);
    setSavedContextLastNInput(savedValue);
    setRefreshStatus("Context window size saved.");
    pushToast("info", "Context window size saved.");
  };

  const openAgentEditor = async (agentId: string | null): Promise<void> => {
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
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
      showDiscardDialog: false,
      showDeleteDialog: false,
      message: "",
    });
  };

  const closeAgentEditor = (force = false): void => {
    if (!force && hasUnsavedAgentDraft) {
      setAgentEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              showDiscardDialog: true,
            },
      );
      return;
    }

    setScreen({ kind: "home" });
    setHomeTab(homeTabAtDetailOpenRef.current);
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

    const normalizedTagsResult = normalizeTagsDraft({
      tagsInput: agentEditorState.draft.tagsInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!normalizedTagsResult.ok) {
      pushToast("warning", normalizedTagsResult.message);
      setAgentEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              message: normalizedTagsResult.message,
            },
      );
      return;
    }

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
      tags: normalizedTagsResult.tags,
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

    setAgentEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            showDeleteDialog: false,
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
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
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
      showDiscardDialog: false,
      showDeleteDialog: false,
      showRemoveMemberDialog: false,
      pendingMemberRemovalId: null,
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
        pendingManualMemberAgentId: null,
        isInjectingConductor: false,
        isAdvancingAutopilot: false,
        isCancellingGeneration: false,
        isExportingTranscript: false,
        isLeavingView: false,
        showLeaveDialog: false,
        activeTab: "discussion",
        configEdit: null,
        configTagInput: "",
        showConfigDiscardDialog: false,
        showConfigDeleteDialog: false,
        isSavingConfigField: false,
        isRefreshingConfigModels: false,
        isSavingMembers: false,
        showAddMemberPanel: false,
        addMemberSearchText: "",
        showMemberRemoveDialog: false,
        pendingMemberRemovalId: null,
        conductorDraft: "",
        manualTurnRetryMessage: null,
        message: "",
      });
    },
    [pushToast],
  );

  const openCouncilView = async (councilId: string): Promise<void> => {
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
    setScreen({ kind: "councilView", councilId });
    await loadCouncilView(councilId);
  };

  const completeCouncilViewClose = async (): Promise<void> => {
    setAutopilotLimitModal(null);
    setScreen({ kind: "home" });
    setHomeTab(homeTabAtDetailOpenRef.current);
    await loadCouncils({ page: 1, append: false });
  };

  const executeCouncilViewLeave = async (params: {
    exitPlan: ReturnType<typeof buildCouncilViewExitPlan>;
  }): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      await completeCouncilViewClose();
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isLeavingView: true,
            showLeaveDialog: false,
            message: "",
          },
    );

    if (params.exitPlan.shouldPauseAutopilot) {
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

    if (params.exitPlan.shouldCancelGeneration) {
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
    }

    await completeCouncilViewClose();
  };

  const leaveCouncilViewSafely = async (): Promise<void> => {
    if (screen.kind !== "councilView") {
      await completeCouncilViewClose();
      return;
    }

    if (councilViewState.status !== "ready") {
      await completeCouncilViewClose();
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
      await executeCouncilViewLeave({ exitPlan });
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            showLeaveDialog: true,
          },
    );
  };

  const closeCouncilView = async (): Promise<void> => {
    await leaveCouncilViewSafely();
  };

  const confirmLeaveCouncilView = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    const exitPlan = buildCouncilViewExitPlan(
      councilViewState.source.council,
      councilViewState.source.generation,
    );
    await executeCouncilViewLeave({ exitPlan });
  };

  const openAutopilotLimitModal = (action: AutopilotLimitModalAction): void => {
    setAutopilotLimitModal(createAutopilotLimitModalState(action));
  };

  const closeAutopilotLimitModal = (): void => {
    setAutopilotLimitModal(null);
  };

  const executeStartCouncilRuntime = async (maxTurns: number | null): Promise<void> => {
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
      maxTurns,
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

  const startCouncilRuntime = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    if (councilViewState.source.council.mode === "autopilot") {
      openAutopilotLimitModal("start");
      return;
    }

    await executeStartCouncilRuntime(null);
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

    openAutopilotLimitModal("resume");
  };

  const executeResumeCouncilRuntime = async (maxTurns: number | null): Promise<void> => {
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
      maxTurns,
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

  const submitAutopilotLimitModal = async (): Promise<void> => {
    if (
      autopilotLimitModal === null ||
      screen.kind !== "councilView" ||
      councilViewState.status !== "ready"
    ) {
      return;
    }

    const resolved = resolveAutopilotMaxTurns(autopilotLimitModal);
    if (!resolved.ok) {
      setAutopilotLimitModal((current) =>
        current === null
          ? current
          : {
              ...current,
              validationMessage: resolved.validationMessage,
            },
      );
      return;
    }

    const action = autopilotLimitModal.action;
    closeAutopilotLimitModal();
    if (action === "start") {
      await executeStartCouncilRuntime(resolved.maxTurns);
      return;
    }

    await executeResumeCouncilRuntime(resolved.maxTurns);
  };

  const handleAutopilotModalKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAutopilotLimitModal();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void submitAutopilotLimitModal();
    }
  };

  const handleTranscriptRowKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    currentIndex: number,
    totalRows: number,
  ): void => {
    const nextIndex = resolveTranscriptFocusIndex({
      currentIndex,
      key: event.key,
      totalItems: totalRows,
    });
    if (nextIndex === null || nextIndex === currentIndex) {
      return;
    }

    event.preventDefault();
    transcriptRowRefs.current[nextIndex]?.focus();
  };

  const handleHomeTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: HomeTab,
  ): void => {
    const currentIndex = HOME_TAB_ORDER.indexOf(currentTab);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = resolveHomeTabFocusIndex({
      currentIndex,
      key: event.key,
      totalTabs: HOME_TAB_ORDER.length,
    });
    if (nextIndex === null || nextIndex === currentIndex) {
      return;
    }

    event.preventDefault();
    const nextTab = HOME_TAB_ORDER[nextIndex];
    if (nextTab === undefined) {
      return;
    }
    setHomeTab(nextTab);
    homeTabButtonRefs.current[nextTab]?.focus();
  };

  const handleCouncilRowMenuKeyDown = (event: ReactKeyboardEvent<HTMLDetailsElement>): void => {
    const action = resolveDisclosureKeyboardAction(event.key);
    if (action !== "close" || !event.currentTarget.open) {
      return;
    }

    event.preventDefault();
    event.currentTarget.open = false;
    const summary = event.currentTarget.querySelector("summary");
    if (summary instanceof HTMLElement) {
      summary.focus();
    }
  };

  const handleCouncilMenuToggle = (event: React.SyntheticEvent<HTMLDetailsElement>): void => {
    const details = event.currentTarget;
    const dropdown = details.querySelector(".council-menu-dropdown") as HTMLElement | null;
    if (!dropdown || !details.open) {
      return;
    }

    // Check if there's enough space below; if not, position above
    const rect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.top;
    const dropdownHeight = rect.height;

    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      dropdown.classList.add("council-menu-dropdown-up");
    } else {
      dropdown.classList.remove("council-menu-dropdown-up");
    }
  };

  const handleAgentMenuToggle = (event: React.SyntheticEvent<HTMLDetailsElement>): void => {
    const details = event.currentTarget;
    const dropdown = details.querySelector(".agent-menu-dropdown") as HTMLElement | null;
    if (!dropdown || !details.open) {
      return;
    }

    // Check if there's enough space below; if not, position above
    const rect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.top;
    const dropdownHeight = rect.height;

    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      dropdown.classList.add("agent-menu-dropdown-up");
    } else {
      dropdown.classList.remove("agent-menu-dropdown-up");
    }
  };

  const focusCouncilRowMenuAction = (
    detailsElement: HTMLDetailsElement,
    position: "first" | "last",
  ): void => {
    const actionButtons = Array.from(
      detailsElement.querySelectorAll<HTMLButtonElement>(".row-menu-items button:not(:disabled)"),
    );
    if (actionButtons.length === 0) {
      return;
    }

    const target =
      position === "first" ? actionButtons[0] : actionButtons[actionButtons.length - 1];
    target?.focus();
  };

  const handleCouncilRowMenuSummaryKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const action = resolveDisclosureKeyboardAction(event.key);
    if (action === "none") {
      return;
    }

    const detailsElement = event.currentTarget.closest("details");
    if (!(detailsElement instanceof HTMLDetailsElement)) {
      return;
    }

    if (action === "close") {
      if (!detailsElement.open) {
        return;
      }
      event.preventDefault();
      detailsElement.open = false;
      event.currentTarget.focus();
      return;
    }

    event.preventDefault();
    detailsElement.open = true;
    focusCouncilRowMenuAction(detailsElement, action === "openFirstItem" ? "first" : "last");
  };

  const openCouncilConfigEdit = (field: CouncilConfigField): void => {
    setCouncilViewState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        configEdit: {
          field,
          draftValue: toCouncilConfigFieldDisplayValue({
            council: current.source.council,
            field,
          }),
        },
        configTagInput: "",
        showConfigDiscardDialog: false,
      };
    });
  };

  const hasConfigEditChanges = (
    current: Extract<CouncilViewState, { status: "ready" }>,
  ): boolean => {
    if (current.configEdit === null) {
      return false;
    }

    return (
      current.configEdit.draftValue !==
      toCouncilConfigFieldDisplayValue({
        council: current.source.council,
        field: current.configEdit.field,
      })
    );
  };

  const closeCouncilConfigEdit = (forceDiscard: boolean): void => {
    setCouncilViewState((current) => {
      if (current.status !== "ready" || current.configEdit === null) {
        return current;
      }

      if (!forceDiscard && hasConfigEditChanges(current)) {
        return {
          ...current,
          showConfigDiscardDialog: true,
        };
      }

      return {
        ...current,
        configEdit: null,
        configTagInput: "",
        showConfigDiscardDialog: false,
      };
    });
  };

  const saveCouncilConfigEdit = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }
    if (councilViewState.configEdit === null || councilViewState.isSavingConfigField) {
      return;
    }

    const currentCouncil = councilViewState.source.council;
    const configEdit = councilViewState.configEdit;
    const nextTopic = configEdit.field === "topic" ? configEdit.draftValue : currentCouncil.topic;
    const nextGoal =
      configEdit.field === "goal" ? configEdit.draftValue : (currentCouncil.goal ?? "");
    const nextTagsInput =
      configEdit.field === "tags" ? configEdit.draftValue : currentCouncil.tags.join(", ");
    const nextModelSelection =
      configEdit.field === "conductorModel"
        ? configEdit.draftValue
        : toModelSelectionValue(currentCouncil.conductorModelRefOrNull);

    const normalizedTagsResult = normalizeTagsDraft({
      tagsInput: nextTagsInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!normalizedTagsResult.ok) {
      pushToast("warning", normalizedTagsResult.message);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              message: normalizedTagsResult.message,
            },
      );
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isSavingConfigField: true,
            message: "",
          },
    );

    const result = await window.api.councils.save({
      viewKind: "councilView",
      id: currentCouncil.id,
      title: currentCouncil.title,
      topic: nextTopic,
      goal: nextGoal.trim().length === 0 ? null : nextGoal,
      mode: currentCouncil.mode,
      tags: normalizedTagsResult.tags,
      memberAgentIds: currentCouncil.memberAgentIds,
      memberColorsByAgentId: currentCouncil.memberColorsByAgentId,
      conductorModelRefOrNull: toModelRef(nextModelSelection),
    });

    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isSavingConfigField: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Council config saved.");
    await loadCouncilView(screen.councilId);
    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            activeTab: "config",
            configEdit: null,
            configTagInput: "",
            showConfigDiscardDialog: false,
            isSavingConfigField: false,
          },
    );
  };

  const addTagToCouncilConfigEdit = (): void => {
    if (councilViewState.status !== "ready" || councilViewState.configEdit?.field !== "tags") {
      return;
    }

    const currentTags = parseCouncilConfigTags(councilViewState.configEdit.draftValue);
    const result = appendCouncilConfigTag({
      currentTags,
      tagInput: councilViewState.configTagInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });

    if (!result.ok) {
      pushToast("warning", result.message);
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready" || current.configEdit?.field !== "tags"
        ? current
        : {
            ...current,
            configEdit: {
              ...current.configEdit,
              draftValue: result.tags.join(", "),
            },
            configTagInput: "",
          },
    );
  };

  const removeTagFromCouncilConfigEdit = (tagToRemove: string): void => {
    setCouncilViewState((current) => {
      if (current.status !== "ready" || current.configEdit?.field !== "tags") {
        return current;
      }

      const nextTags = parseCouncilConfigTags(current.configEdit.draftValue).filter(
        (tag) => tag.toLowerCase() !== tagToRemove.toLowerCase(),
      );

      return {
        ...current,
        configEdit: {
          ...current.configEdit,
          draftValue: nextTags.join(", "),
        },
      };
    });
  };

  const refreshCouncilViewConfigModels = async (): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isRefreshingConfigModels: true,
            message: "",
          },
    );

    const result = await window.api.councils.refreshModelCatalog({ viewKind: "councilView" });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isRefreshingConfigModels: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Council model options refreshed.");
    await loadCouncilView(screen.councilId);
    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            activeTab: "config",
            isRefreshingConfigModels: false,
          },
    );
  };

  const saveCouncilViewMembers = async (params: {
    memberAgentIds: ReadonlyArray<string>;
    memberColorsByAgentId: Readonly<Record<string, string>>;
    successMessage: string;
    keepAddPanelOpen?: boolean;
  }): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    const currentCouncil = councilViewState.source.council;
    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isSavingMembers: true,
            message: "",
          },
    );

    const result = await window.api.councils.save({
      viewKind: "councilView",
      id: currentCouncil.id,
      title: currentCouncil.title,
      topic: currentCouncil.topic,
      goal: currentCouncil.goal,
      mode: currentCouncil.mode,
      tags: currentCouncil.tags,
      memberAgentIds: params.memberAgentIds,
      memberColorsByAgentId: params.memberColorsByAgentId,
      conductorModelRefOrNull: currentCouncil.conductorModelRefOrNull,
    });

    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isSavingMembers: false,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", params.successMessage);
    await loadCouncilView(screen.councilId);
    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            activeTab: "discussion",
            isSavingMembers: false,
            showAddMemberPanel: params.keepAddPanelOpen ?? false,
            showMemberRemoveDialog: false,
            pendingMemberRemovalId: null,
          },
    );
  };

  const setCouncilViewMemberColor = async (params: {
    memberAgentId: string;
    color: string;
  }): Promise<void> => {
    if (councilViewState.status !== "ready") {
      return;
    }

    const nextColors = {
      ...councilViewState.source.council.memberColorsByAgentId,
      [params.memberAgentId]: params.color,
    };
    await saveCouncilViewMembers({
      memberAgentIds: councilViewState.source.council.memberAgentIds,
      memberColorsByAgentId: nextColors,
      successMessage: "Member color updated.",
      keepAddPanelOpen: councilViewState.showAddMemberPanel,
    });
  };

  const addCouncilViewMember = async (memberAgentId: string): Promise<void> => {
    if (councilViewState.status !== "ready") {
      return;
    }

    const currentCouncil = councilViewState.source.council;
    const currentMembers = currentCouncil.memberAgentIds;
    if (currentMembers.includes(memberAgentId)) {
      return;
    }

    const usedColors = new Set(Object.values(currentCouncil.memberColorsByAgentId));
    const defaultColor = MEMBER_COLOR_PALETTE.find((color) => !usedColors.has(color)) ?? "#0a5c66";

    await saveCouncilViewMembers({
      memberAgentIds: [...currentMembers, memberAgentId],
      memberColorsByAgentId: {
        ...currentCouncil.memberColorsByAgentId,
        [memberAgentId]: defaultColor,
      },
      successMessage: "Member added.",
      keepAddPanelOpen: true,
    });
  };

  const requestCouncilViewMemberRemoval = (memberAgentId: string): void => {
    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            pendingMemberRemovalId: memberAgentId,
            showMemberRemoveDialog: true,
          },
    );
  };

  const cancelCouncilViewMemberRemoval = (): void => {
    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            pendingMemberRemovalId: null,
            showMemberRemoveDialog: false,
          },
    );
  };

  const confirmCouncilViewMemberRemoval = async (): Promise<void> => {
    if (councilViewState.status !== "ready" || councilViewState.pendingMemberRemovalId === null) {
      return;
    }

    const memberId = councilViewState.pendingMemberRemovalId;
    const nextMemberIds = councilViewState.source.council.memberAgentIds.filter(
      (id) => id !== memberId,
    );
    const nextColors = { ...councilViewState.source.council.memberColorsByAgentId };
    delete nextColors[memberId];

    await saveCouncilViewMembers({
      memberAgentIds: nextMemberIds,
      memberColorsByAgentId: nextColors,
      successMessage: "Member removed.",
    });
  };

  const handleCouncilConfigEditorKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLSelectElement>,
  ): void => {
    const action = resolveInlineConfigEditKeyboardAction({
      key: event.key,
      shiftKey: event.shiftKey,
    });
    if (action === "none") {
      return;
    }

    event.preventDefault();
    if (action === "save") {
      void saveCouncilConfigEdit();
      return;
    }

    closeCouncilConfigEdit(false);
  };

  const generateManualTurn = async (memberAgentId: string): Promise<void> => {
    if (screen.kind !== "councilView" || councilViewState.status !== "ready") {
      return;
    }

    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isGeneratingManualTurn: true,
            pendingManualMemberAgentId: memberAgentId,
            manualTurnRetryMessage: null,
            message: "",
          },
    );

    const result = await window.api.councils.generateManualTurn({
      viewKind: "councilView",
      id: screen.councilId,
      memberAgentId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isGeneratingManualTurn: false,
              pendingManualMemberAgentId: null,
              manualTurnRetryMessage: result.error.userMessage,
              message: "",
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

  const exportCouncilTranscript = async (params: {
    viewKind: "councilsList" | "councilView";
    councilId: string;
  }): Promise<void> => {
    if (params.viewKind === "councilView") {
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isExportingTranscript: true,
              message: "",
            },
      );
    } else {
      setExportingCouncilId(params.councilId);
    }

    const result = await window.api.councils.exportTranscript({
      viewKind: params.viewKind,
      id: params.councilId,
    });

    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      if (params.viewKind === "councilView") {
        setCouncilViewState((current) =>
          current.status !== "ready"
            ? current
            : {
                ...current,
                isExportingTranscript: false,
                message: result.error.userMessage,
              },
        );
      } else {
        setExportingCouncilId(null);
      }
      return;
    }

    if (params.viewKind === "councilView") {
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isExportingTranscript: false,
            },
      );
    } else {
      setExportingCouncilId(null);
    }

    if (result.value.status === "cancelled") {
      pushToast("warning", "Export cancelled.");
      return;
    }

    pushToast("info", `Transcript exported to ${result.value.filePath}`);
  };

  const setCouncilArchivedFromList = async (params: {
    councilId: string;
    archived: boolean;
  }): Promise<void> => {
    const result = await window.api.councils.setArchived({
      id: params.councilId,
      archived: params.archived,
    });

    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }

    pushToast("info", params.archived ? "Council archived." : "Council restored.");
    await loadCouncils({ page: 1, append: false });
  };

  const deleteCouncilFromList = async (council: CouncilDto): Promise<void> => {
    setPendingCouncilListDelete(council);
  };

  const confirmDeleteCouncilFromList = async (): Promise<void> => {
    if (pendingCouncilListDelete === null) {
      return;
    }

    const result = await window.api.councils.delete({ id: pendingCouncilListDelete.id });
    setPendingCouncilListDelete(null);
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }

    pushToast("info", "Council deleted.");
    await loadCouncils({ page: 1, append: false });
  };

  const deleteAgentFromList = async (agent: AgentDto): Promise<void> => {
    setPendingAgentListDelete(agent);
  };

  const confirmDeleteAgentFromList = async (): Promise<void> => {
    if (pendingAgentListDelete === null) {
      return;
    }

    const result = await window.api.agents.delete({ id: pendingAgentListDelete.id });
    setPendingAgentListDelete(null);
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      return;
    }

    pushToast("info", "Agent deleted.");
    await loadAgents({ page: 1, append: false });
  };

  const setCouncilArchivedFromView = async (
    council: CouncilDto,
    archived: boolean,
  ): Promise<void> => {
    const result = await window.api.councils.setArchived({
      id: council.id,
      archived,
    });

    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", archived ? "Council archived." : "Council restored.");
    if (screen.kind === "councilView") {
      await loadCouncilView(screen.councilId);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              activeTab: "config",
            },
      );
    }
  };

  const deleteCouncilFromView = async (council: CouncilDto): Promise<void> => {
    setCouncilViewState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            showConfigDeleteDialog: false,
          },
    );

    const result = await window.api.councils.delete({ id: council.id });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setCouncilViewState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              message: result.error.userMessage,
            },
      );
      return;
    }

    pushToast("info", "Council deleted.");
    setScreen({ kind: "home" });
    setHomeTab(homeTabAtDetailOpenRef.current);
    await loadCouncils({ page: 1, append: false });
  };

  const closeCouncilEditor = (force = false): void => {
    if (!force && hasUnsavedCouncilDraft) {
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              showDiscardDialog: true,
            },
      );
      return;
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

      const isSelected = current.draft.selectedMemberIds.includes(memberAgentId);
      if (isSelected) {
        return {
          ...current,
          pendingMemberRemovalId: memberAgentId,
          showRemoveMemberDialog: true,
        };
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
    setCouncilEditorState((current) => {
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
    setCouncilEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            pendingMemberRemovalId: null,
            showRemoveMemberDialog: false,
          },
    );
  };

  const saveCouncil = async (): Promise<void> => {
    if (councilEditorState.status !== "ready") {
      return;
    }

    if (councilEditorState.draft.title.trim().length === 0) {
      const message = "Title is required.";
      pushToast("warning", message);
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              message,
            },
      );
      return;
    }

    if (councilEditorState.draft.topic.trim().length === 0) {
      const message = "Topic is required before saving a council.";
      pushToast("warning", message);
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              message,
            },
      );
      return;
    }

    if (councilEditorState.draft.selectedMemberIds.length === 0) {
      const message = "Select at least one member before saving.";
      pushToast("warning", message);
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              message,
            },
      );
      return;
    }

    const normalizedTagsResult = normalizeTagsDraft({
      tagsInput: councilEditorState.draft.tagsInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!normalizedTagsResult.ok) {
      pushToast("warning", normalizedTagsResult.message);
      setCouncilEditorState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              message: normalizedTagsResult.message,
            },
      );
      return;
    }

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
      tags: normalizedTagsResult.tags,
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

    setCouncilEditorState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            showDeleteDialog: false,
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
    const runtimeControls = resolveCouncilViewRuntimeControls({
      mode: council.mode,
      started: council.started,
      paused: council.paused,
      archived: council.archived,
      messageCount: councilViewState.source.messages.length,
    });
    const canStart = runtimeControls.canStart;
    const canPause = runtimeControls.canPause;
    const canResume = runtimeControls.canResume;
    const showTopBarStart = runtimeControls.showTopBarStart;
    const showEmptyStateStart = runtimeControls.showEmptyStateStart;
    const generationRunning = councilViewState.source.generation.status === "running";
    const generationActive = generationRunning || councilViewState.isGeneratingManualTurn;
    const canManualGenerate = council.mode === "manual" && council.started && !council.archived;
    const manualSpeakerDisabledReason = council.archived
      ? "Archived councils are read-only."
      : !council.started
        ? "Start the council before selecting the next speaker."
        : generationRunning || councilViewState.isGeneratingManualTurn
          ? "Wait for the current generation to finish."
          : null;
    const canAdvanceAutopilot = council.mode === "autopilot" && council.started && !council.paused;
    const generation = councilViewState.source.generation;
    const pausedNextSpeakerId =
      council.mode === "autopilot" && council.paused ? generation.plannedNextSpeakerAgentId : null;
    const pausedNextSpeakerName =
      pausedNextSpeakerId === null
        ? null
        : (memberNameById.get(pausedNextSpeakerId) ?? pausedNextSpeakerId);
    const thinkingSpeakerId = resolveThinkingPlaceholderSpeakerId({
      generation,
      pendingManualMemberAgentId: councilViewState.pendingManualMemberAgentId,
    });
    const thinkingSpeakerName =
      thinkingSpeakerId === null
        ? null
        : (memberNameById.get(thinkingSpeakerId) ?? thinkingSpeakerId);
    const thinkingSpeakerColor =
      thinkingSpeakerId === null
        ? null
        : (council.memberColorsByAgentId[thinkingSpeakerId] ??
          MEMBER_COLOR_PALETTE[0] ??
          "#0a5c66");
    const showInlineThinkingCancel = shouldRenderInlineThinkingCancel({
      generationActive,
      thinkingSpeakerId,
    });
    const autopilotRecoveryNotice = buildAutopilotRecoveryNotice({
      council: {
        mode: council.mode,
        started: council.started,
        paused: council.paused,
      },
      runtimeMessage: councilViewState.message,
    });
    const manualRetryNotice = buildManualRetryNotice({
      council: {
        mode: council.mode,
      },
      runtimeMessage: councilViewState.manualTurnRetryMessage,
    });
    const isAutopilotModalOpen = autopilotLimitModal !== null;
    const autopilotSubmitLabel =
      autopilotLimitModal?.action === "start"
        ? councilViewState.isStarting
          ? "Starting..."
          : "Start"
        : councilViewState.isResuming
          ? "Resuming..."
          : "Resume";
    const autopilotDialogTitle =
      autopilotLimitModal?.action === "start" ? "Start Autopilot" : "Resume Autopilot";
    const startDisabled =
      councilViewState.isStarting ||
      council.invalidConfig ||
      isAutopilotModalOpen ||
      councilViewState.configEdit !== null;
    const startDisabledReason = council.invalidConfig
      ? "Start is disabled until model config is fixed."
      : undefined;
    const transcriptRowCount =
      councilViewState.source.messages.length + (thinkingSpeakerName === null ? 0 : 1);
    const configEditField = councilViewState.configEdit?.field ?? null;
    const configEditDraftValue = councilViewState.configEdit?.draftValue ?? "";
    const configEditTags =
      configEditField === "tags" ? parseCouncilConfigTags(configEditDraftValue) : [];
    const hasUnavailableConductorSelectionInView = !isModelSelectionInCatalog({
      modelSelection:
        configEditField === "conductorModel"
          ? configEditDraftValue
          : toModelSelectionValue(council.conductorModelRefOrNull),
      modelCatalog: councilViewState.source.modelCatalog,
    });
    const runtimeBriefing = councilViewState.source.briefing;
    const canEditMembers =
      !council.archived && (!council.started || council.paused || council.mode === "manual");
    const memberIdsWithMessages = new Set(
      councilViewState.source.messages
        .filter((message) => message.senderKind === "member" && message.senderAgentId !== null)
        .map((message) => message.senderAgentId as string),
    );
    const addMemberSearch = councilViewState.addMemberSearchText.trim().toLowerCase();
    const addableAgents = councilViewState.source.availableAgents.filter((agent) => {
      if (council.memberAgentIds.includes(agent.id)) {
        return false;
      }
      if (addMemberSearch.length === 0) {
        return true;
      }
      return (
        agent.name.toLowerCase().includes(addMemberSearch) ||
        agent.id.toLowerCase().includes(addMemberSearch)
      );
    });

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
            {showTopBarStart ? (
              <button
                className="cta"
                disabled={startDisabled}
                onClick={() => void startCouncilRuntime()}
                title={startDisabledReason}
                type="button"
              >
                {councilViewState.isStarting ? "Starting..." : "Start"}
              </button>
            ) : null}
            {canPause ? (
              <button
                className="secondary"
                disabled={councilViewState.isPausing || councilViewState.configEdit !== null}
                onClick={() => void pauseCouncilRuntime()}
                type="button"
              >
                {councilViewState.isPausing ? "Pausing..." : "Pause"}
              </button>
            ) : null}
            {canResume ? (
              <button
                className="cta"
                disabled={
                  councilViewState.isResuming ||
                  council.invalidConfig ||
                  isAutopilotModalOpen ||
                  councilViewState.configEdit !== null
                }
                onClick={() => void resumeCouncilRuntime()}
                title={
                  council.invalidConfig
                    ? "Resume is disabled until model config is fixed."
                    : undefined
                }
                type="button"
              >
                {councilViewState.isResuming ? "Resuming..." : "Resume"}
              </button>
            ) : null}
            {canAdvanceAutopilot ? (
              <button
                className="secondary"
                disabled={
                  councilViewState.isAdvancingAutopilot ||
                  generationRunning ||
                  councilViewState.configEdit !== null
                }
                onClick={() => void advanceAutopilotTurn()}
                type="button"
              >
                {councilViewState.isAdvancingAutopilot ? "Generating..." : "Next turn"}
              </button>
            ) : null}
            {(canStart || canResume) && council.invalidConfig ? (
              <span
                aria-label="Invalid configuration"
                className="warning-badge"
                title="Resolved conductor model is unavailable in this view's model catalog snapshot."
              >
                Invalid config
              </span>
            ) : null}
            {generationActive && !showInlineThinkingCancel ? (
              <button
                className="secondary"
                disabled={
                  councilViewState.isCancellingGeneration || councilViewState.configEdit !== null
                }
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
            {council.mode === "autopilot"
              ? ` | Turn limit: ${council.autopilotMaxTurns ?? "none"} (${council.autopilotTurnsCompleted} completed)`
              : ""}
          </p>
          {pausedNextSpeakerName !== null ? (
            <p className="meta">Paused next speaker: {pausedNextSpeakerName}</p>
          ) : null}
          <div aria-label="Council view tabs" className="tabs" role="tablist">
            <button
              aria-controls="council-view-panel-discussion"
              aria-selected={councilViewState.activeTab === "discussion"}
              className={councilViewState.activeTab === "discussion" ? "tab tab-active" : "tab"}
              disabled={
                councilViewState.configEdit !== null && councilViewState.activeTab !== "discussion"
              }
              id="council-view-tab-discussion"
              onClick={() =>
                setCouncilViewState((current) =>
                  current.status !== "ready"
                    ? current
                    : {
                        ...current,
                        activeTab: "discussion",
                      },
                )
              }
              role="tab"
              type="button"
            >
              Discussion
            </button>
            <button
              aria-controls="council-view-panel-config"
              aria-selected={councilViewState.activeTab === "config"}
              className={councilViewState.activeTab === "config" ? "tab tab-active" : "tab"}
              disabled={
                councilViewState.configEdit !== null && councilViewState.activeTab !== "config"
              }
              id="council-view-tab-config"
              onClick={() =>
                setCouncilViewState((current) =>
                  current.status !== "ready"
                    ? current
                    : {
                        ...current,
                        activeTab: "config",
                      },
                )
              }
              role="tab"
              type="button"
            >
              Config
            </button>
          </div>
        </header>

        {council.archived ? <p className="status-line">Archived councils are read-only.</p> : null}
        {council.invalidConfig ? (
          <p className="status-line">
            Invalid config: start/resume is blocked until you select an available Conductor model or
            refresh models in Config.
          </p>
        ) : null}
        {councilViewState.message.length > 0 && autopilotRecoveryNotice === null ? (
          <p className="status-line">{councilViewState.message}</p>
        ) : null}

        {councilViewState.activeTab === "discussion" ? (
          <section
            aria-labelledby="council-view-tab-discussion"
            className="council-view-grid"
            id="council-view-panel-discussion"
            role="tabpanel"
          >
            <div className="council-view-left-column">
              <section className="settings-section council-view-section">
                <h2>Transcript</h2>
                {autopilotRecoveryNotice !== null ? (
                  <p className="status status-error">{autopilotRecoveryNotice}</p>
                ) : null}
                {manualRetryNotice !== null ? (
                  <p className="status status-error">{manualRetryNotice}</p>
                ) : null}
                {councilViewState.source.messages.length === 0 && thinkingSpeakerName === null ? (
                  <div className="status">
                    <p>
                      {council.mode === "manual"
                        ? "No messages yet. Choose the next speaker from Members."
                        : "No messages yet."}
                    </p>
                    {showEmptyStateStart ? (
                      <div className="button-row">
                        <button
                          className="cta"
                          disabled={startDisabled}
                          onClick={() => void startCouncilRuntime()}
                          title={startDisabledReason}
                          type="button"
                        >
                          {councilViewState.isStarting ? "Starting..." : "Start"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="list-grid transcript-scroll-panel">
                    {councilViewState.source.messages.map((message, index) => (
                      <button
                        aria-label={buildTranscriptMessageAriaLabel(message)}
                        className={`transcript-row ${
                          resolveTranscriptMessageAlignment(message) === "right"
                            ? "transcript-row-conductor"
                            : "transcript-row-member"
                        }`}
                        data-transcript-row-index={index}
                        key={message.id}
                        onKeyDown={(event) =>
                          handleTranscriptRowKeyDown(event, index, transcriptRowCount)
                        }
                        ref={(element) => {
                          transcriptRowRefs.current[index] = element;
                        }}
                        type="button"
                      >
                        <div
                          className="transcript-message"
                          style={
                            {
                              "--transcript-accent": resolveTranscriptAccentColor(message),
                            } as CSSProperties
                          }
                        >
                          <span aria-hidden="true" className="transcript-avatar">
                            {resolveTranscriptAvatarInitials(message.senderName)}
                          </span>
                          <div className="transcript-bubble">
                            <p className="meta transcript-sender-name">
                              {message.senderName}
                              {message.senderKind === "conductor" ? " (Conductor)" : ""}
                            </p>
                            <p className="transcript-content">{message.content}</p>
                            <p className="meta transcript-timestamp" title={message.createdAtUtc}>
                              #{message.sequenceNumber} at {message.createdAtUtc}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {thinkingSpeakerName !== null ? (
                      <div className="thinking-row-group">
                        <button
                          aria-label={`${thinkingSpeakerName}, member, thinking placeholder.`}
                          className="thinking-row transcript-row transcript-row-member"
                          data-transcript-row-index={councilViewState.source.messages.length}
                          onKeyDown={(event) =>
                            handleTranscriptRowKeyDown(
                              event,
                              councilViewState.source.messages.length,
                              transcriptRowCount,
                            )
                          }
                          ref={(element) => {
                            transcriptRowRefs.current[councilViewState.source.messages.length] =
                              element;
                          }}
                          type="button"
                        >
                          <div
                            className="transcript-message"
                            style={
                              {
                                "--transcript-accent": thinkingSpeakerColor ?? "#0a5c66",
                              } as CSSProperties
                            }
                          >
                            <span aria-hidden="true" className="transcript-avatar">
                              {resolveTranscriptAvatarInitials(thinkingSpeakerName)}
                            </span>
                            <div className="transcript-bubble">
                              <p className="meta transcript-sender-name">{thinkingSpeakerName}</p>
                              <p className="transcript-content">...</p>
                              <p className="meta transcript-timestamp">Thinking...</p>
                            </div>
                          </div>
                        </button>
                        {showInlineThinkingCancel ? (
                          <button
                            className="secondary thinking-cancel-button"
                            disabled={
                              councilViewState.isCancellingGeneration ||
                              councilViewState.configEdit !== null
                            }
                            onClick={() => void cancelCouncilGeneration()}
                            type="button"
                          >
                            {councilViewState.isCancellingGeneration
                              ? "Cancelling..."
                              : "Cancel generation"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="settings-section council-view-section">
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
              </section>
            </div>

            <aside className="council-view-right-column">
              <section className="settings-section council-view-section">
                <h2>Briefing</h2>
                {runtimeBriefing === null ? (
                  <p className="meta">Briefing not generated yet.</p>
                ) : (
                  <>
                    <p className="meta">TLDR</p>
                    <p className="status-line">{runtimeBriefing.briefing}</p>
                    <p className="meta">
                      Goal status: {runtimeBriefing.goalReached ? "Reached" : "In progress"}
                    </p>
                    {runtimeBriefing.goalReached ? (
                      <div className="briefing-goal-callout">
                        <p className="briefing-goal-callout-title">Goal reached</p>
                        <p className="briefing-goal-callout-body">
                          The latest briefing reports this council has reached its stated goal.
                        </p>
                      </div>
                    ) : null}
                    <p className="meta">Last updated: {runtimeBriefing.updatedAtUtc}</p>
                  </>
                )}
              </section>

              <section className="settings-section council-view-section">
                <div className="button-row">
                  <h2>Members</h2>
                  <button
                    className="secondary"
                    disabled={!canEditMembers || councilViewState.isSavingMembers}
                    onClick={() =>
                      setCouncilViewState((current) =>
                        current.status !== "ready"
                          ? current
                          : {
                              ...current,
                              showAddMemberPanel: !current.showAddMemberPanel,
                            },
                      )
                    }
                    type="button"
                  >
                    {councilViewState.showAddMemberPanel ? "Close add" : "Add member"}
                  </button>
                </div>
                {councilViewState.showAddMemberPanel ? (
                  <div className="status">
                    <label className="field" htmlFor="council-view-add-member-search">
                      Search agents
                    </label>
                    <input
                      id="council-view-add-member-search"
                      onChange={(event) =>
                        setCouncilViewState((current) =>
                          current.status !== "ready"
                            ? current
                            : {
                                ...current,
                                addMemberSearchText: event.target.value,
                              },
                        )
                      }
                      placeholder="Search by name"
                      value={councilViewState.addMemberSearchText}
                    />
                    <div className="list-grid">
                      {addableAgents.map((agent) => (
                        <article className="list-row" key={agent.id}>
                          <div>
                            <h3>{agent.name}</h3>
                            <p className="meta">{agent.id}</p>
                          </div>
                          <button
                            className="secondary"
                            disabled={!canEditMembers || councilViewState.isSavingMembers}
                            onClick={() => void addCouncilViewMember(agent.id)}
                            type="button"
                          >
                            Add
                          </button>
                        </article>
                      ))}
                      {addableAgents.length === 0 ? (
                        <p className="meta">No matching agents available.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="list-grid">
                  {council.memberAgentIds.map((memberAgentId) => {
                    const memberName = memberNameById.get(memberAgentId) ?? memberAgentId;
                    const memberHasMessages = memberIdsWithMessages.has(memberAgentId);
                    const memberColor =
                      council.memberColorsByAgentId[memberAgentId] ??
                      MEMBER_COLOR_PALETTE[0] ??
                      "#0a5c66";
                    const removeDisabledReason = resolveMemberRemoveDisabledReason({
                      archived: council.archived,
                      canEditMembers,
                      memberHasMessages,
                      memberCount: council.memberAgentIds.length,
                      isSavingMembers: councilViewState.isSavingMembers,
                      started: council.started,
                      paused: council.paused,
                      mode: council.mode,
                    });
                    const removeReasonId = `member-remove-reason-${memberAgentId}`;
                    return (
                      <article className="list-row member-row" key={memberAgentId}>
                        <div>
                          <h3>{memberName}</h3>
                          <p className="meta">Agent id: {memberAgentId}</p>
                        </div>
                        <div className="member-row-actions">
                          <span aria-hidden="true" className="member-avatar">
                            {memberName.slice(0, 2).toUpperCase()}
                          </span>
                          <ColorPicker
                            colors={MEMBER_COLOR_PALETTE}
                            id={`member-color-${memberAgentId}`}
                            label="Color"
                            value={memberColor}
                            disabled={!canEditMembers || councilViewState.isSavingMembers}
                            onChange={(color) =>
                              void setCouncilViewMemberColor({
                                memberAgentId,
                                color,
                              })
                            }
                          />
                          {council.mode === "manual" ? (
                            <button
                              aria-label={buildManualSpeakerSelectionAriaLabel(memberName)}
                              className="secondary"
                              disabled={manualSpeakerDisabledReason !== null}
                              onClick={() => void generateManualTurn(memberAgentId)}
                              title={manualSpeakerDisabledReason ?? undefined}
                              type="button"
                            >
                              {councilViewState.isGeneratingManualTurn
                                ? "Generating..."
                                : "Select to speak"}
                            </button>
                          ) : null}
                          <button
                            aria-describedby={
                              removeDisabledReason === null ? undefined : removeReasonId
                            }
                            className="danger member-remove-button"
                            disabled={removeDisabledReason !== null}
                            onClick={() => requestCouncilViewMemberRemoval(memberAgentId)}
                            title={removeDisabledReason ?? undefined}
                            type="button"
                          >
                            Remove
                          </button>
                          {removeDisabledReason === null ? null : (
                            <p className="meta member-remove-reason" id={removeReasonId}>
                              {removeDisabledReason}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </aside>
          </section>
        ) : (
          <section
            aria-labelledby="council-view-tab-config"
            className="settings-section"
            id="council-view-panel-config"
            role="tabpanel"
          >
            <h2>Config</h2>
            <div className="config-grid">
              <div className="config-row">
                <p className="field">Topic</p>
                {configEditField === "topic" ? (
                  <div className="config-editor" ref={councilConfigEditContainerRef}>
                    <textarea
                      onChange={(event) =>
                        setCouncilViewState((current) =>
                          current.status !== "ready" || current.configEdit === null
                            ? current
                            : {
                                ...current,
                                configEdit: {
                                  ...current.configEdit,
                                  draftValue: event.target.value,
                                },
                              },
                        )
                      }
                      onKeyDown={handleCouncilConfigEditorKeyDown}
                      ref={(element) => {
                        councilConfigEditInputRef.current = element;
                      }}
                      rows={4}
                      value={configEditDraftValue}
                    />
                    <div className="button-row">
                      <button
                        className="cta"
                        onClick={() => void saveCouncilConfigEdit()}
                        type="button"
                      >
                        {councilViewState.isSavingConfigField ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="config-value-row">
                    <p className="meta config-value">{council.topic}</p>
                    <button
                      aria-label="Edit topic"
                      className="icon-button"
                      disabled={councilViewState.configEdit !== null || council.archived}
                      onClick={() => openCouncilConfigEdit("topic")}
                      type="button"
                    >
                      ✎
                    </button>
                  </div>
                )}
              </div>

              <div className="config-row">
                <p className="field">Goal</p>
                {configEditField === "goal" ? (
                  <div className="config-editor" ref={councilConfigEditContainerRef}>
                    <textarea
                      onChange={(event) =>
                        setCouncilViewState((current) =>
                          current.status !== "ready" || current.configEdit === null
                            ? current
                            : {
                                ...current,
                                configEdit: {
                                  ...current.configEdit,
                                  draftValue: event.target.value,
                                },
                              },
                        )
                      }
                      onKeyDown={handleCouncilConfigEditorKeyDown}
                      ref={(element) => {
                        councilConfigEditInputRef.current = element;
                      }}
                      rows={3}
                      value={configEditDraftValue}
                    />
                    <div className="button-row">
                      <button
                        className="cta"
                        onClick={() => void saveCouncilConfigEdit()}
                        type="button"
                      >
                        {councilViewState.isSavingConfigField ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="config-value-row">
                    <p className="meta config-value">{council.goal ?? "None"}</p>
                    <button
                      aria-label="Edit goal"
                      className="icon-button"
                      disabled={councilViewState.configEdit !== null || council.archived}
                      onClick={() => openCouncilConfigEdit("goal")}
                      type="button"
                    >
                      ✎
                    </button>
                  </div>
                )}
              </div>

              <div className="config-row">
                <p className="field">Tags</p>
                {configEditField === "tags" ? (
                  <div className="config-editor" ref={councilConfigEditContainerRef}>
                    {configEditTags.length > 0 ? (
                      <ul className="config-tag-list">
                        {configEditTags.map((tag) => (
                          <li className="config-tag-chip" key={tag}>
                            <span>{tag}</span>
                            <button
                              aria-label={`Remove tag ${tag}`}
                              className="icon-button chip-remove-button"
                              onClick={() => removeTagFromCouncilConfigEdit(tag)}
                              type="button"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="meta">No tags yet.</p>
                    )}
                    <div className="button-row config-tag-editor-row">
                      <input
                        onChange={(event) =>
                          setCouncilViewState((current) =>
                            current.status !== "ready"
                              ? current
                              : {
                                  ...current,
                                  configTagInput: event.target.value,
                                },
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addTagToCouncilConfigEdit();
                            return;
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            closeCouncilConfigEdit(false);
                          }
                        }}
                        placeholder="Add tag"
                        type="text"
                        value={councilViewState.configTagInput}
                      />
                      <button
                        className="secondary"
                        onClick={addTagToCouncilConfigEdit}
                        type="button"
                      >
                        Add tag
                      </button>
                    </div>
                    <textarea
                      onChange={(event) =>
                        setCouncilViewState((current) =>
                          current.status !== "ready" || current.configEdit === null
                            ? current
                            : {
                                ...current,
                                configEdit: {
                                  ...current.configEdit,
                                  draftValue: event.target.value,
                                },
                              },
                        )
                      }
                      onKeyDown={handleCouncilConfigEditorKeyDown}
                      ref={(element) => {
                        councilConfigEditInputRef.current = element;
                      }}
                      aria-label="Tags draft"
                      rows={3}
                      value={configEditDraftValue}
                    />
                    <p className="meta">Use chips to add/remove tags. Max 3 tags.</p>
                    <div className="button-row">
                      <button
                        className="cta"
                        onClick={() => void saveCouncilConfigEdit()}
                        type="button"
                      >
                        {councilViewState.isSavingConfigField ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="config-value-row">
                    <p className="meta config-value">
                      {council.tags.length > 0 ? council.tags.join(", ") : "None"}
                    </p>
                    <button
                      aria-label="Edit tags"
                      className="icon-button"
                      disabled={councilViewState.configEdit !== null || council.archived}
                      onClick={() => openCouncilConfigEdit("tags")}
                      type="button"
                    >
                      ✎
                    </button>
                  </div>
                )}
              </div>

              <div className="config-row">
                <p className="field">Conductor model</p>
                {configEditField === "conductorModel" ? (
                  <div className="config-editor" ref={councilConfigEditContainerRef}>
                    <div className="button-row">
                      <select
                        onChange={(event) =>
                          setCouncilViewState((current) =>
                            current.status !== "ready" || current.configEdit === null
                              ? current
                              : {
                                  ...current,
                                  configEdit: {
                                    ...current.configEdit,
                                    draftValue: event.target.value,
                                  },
                                },
                          )
                        }
                        onKeyDown={handleCouncilConfigEditorKeyDown}
                        ref={(element) => {
                          councilConfigEditInputRef.current = element;
                        }}
                        value={configEditDraftValue}
                      >
                        {hasUnavailableConductorSelectionInView ? (
                          <option value={configEditDraftValue}>
                            Unavailable ({configEditDraftValue})
                          </option>
                        ) : null}
                        <option value="">Global default</option>
                        {Object.entries(councilViewState.source.modelCatalog.modelsByProvider).map(
                          ([providerId, modelIds]) => (
                            <optgroup key={providerId} label={providerId}>
                              {modelIds.map((modelId) => (
                                <option
                                  key={`${providerId}:${modelId}`}
                                  value={`${providerId}:${modelId}`}
                                >
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
                          councilViewState.isRefreshingConfigModels ||
                          !councilViewState.source.canRefreshModels
                        }
                        onClick={() => void refreshCouncilViewConfigModels()}
                        type="button"
                      >
                        {councilViewState.isRefreshingConfigModels
                          ? "Refreshing..."
                          : "Refresh models"}
                      </button>
                    </div>
                    <div className="button-row">
                      <button
                        className="cta"
                        onClick={() => void saveCouncilConfigEdit()}
                        type="button"
                      >
                        {councilViewState.isSavingConfigField ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="config-value-row">
                    <p className="meta config-value">
                      {councilModelLabel(council, councilViewState.source.globalDefaultModelRef)}
                    </p>
                    {council.invalidConfig ? (
                      <span
                        aria-label="Invalid configuration"
                        className="warning-badge"
                        title="Resolved conductor model is unavailable in this view's model catalog snapshot."
                      >
                        Invalid config
                      </span>
                    ) : null}
                    <button
                      aria-label="Edit conductor model"
                      className="icon-button"
                      disabled={councilViewState.configEdit !== null || council.archived}
                      onClick={() => openCouncilConfigEdit("conductorModel")}
                      type="button"
                    >
                      ✎
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="button-row">
              <button
                className="secondary"
                disabled={
                  councilViewState.configEdit !== null || councilViewState.isExportingTranscript
                }
                onClick={() =>
                  void exportCouncilTranscript({
                    viewKind: "councilView",
                    councilId: council.id,
                  })
                }
                type="button"
              >
                {councilViewState.isExportingTranscript ? "Exporting..." : "Export"}
              </button>
              <button
                className="secondary"
                disabled={
                  councilViewState.configEdit !== null ||
                  (!council.archived &&
                    council.mode === "autopilot" &&
                    council.started &&
                    !council.paused)
                }
                onClick={() => void setCouncilArchivedFromView(council, !council.archived)}
                title={
                  !council.archived &&
                  council.mode === "autopilot" &&
                  council.started &&
                  !council.paused
                    ? "Pause Autopilot before archiving this council."
                    : undefined
                }
                type="button"
              >
                {council.archived ? "Restore" : "Archive"}
              </button>
              <button
                className="danger"
                disabled={councilViewState.configEdit !== null}
                onClick={() =>
                  setCouncilViewState((current) =>
                    current.status !== "ready"
                      ? current
                      : {
                          ...current,
                          showConfigDeleteDialog: true,
                        },
                  )
                }
                type="button"
              >
                Delete
              </button>
            </div>
          </section>
        )}

        <ConfirmDialog
          cancelLabel="Stay"
          confirmLabel="Leave"
          confirmTone="danger"
          message={COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE}
          onCancel={() =>
            setCouncilViewState((current) =>
              current.status !== "ready"
                ? current
                : {
                    ...current,
                    showLeaveDialog: false,
                  },
            )
          }
          onConfirm={() => {
            void confirmLeaveCouncilView();
          }}
          open={councilViewState.showLeaveDialog}
          title="Leave Council View?"
        />

        <ConfirmDialog
          cancelLabel="Keep editing"
          confirmLabel="Discard"
          confirmTone="danger"
          message="Your changes will be lost."
          onCancel={() => {
            setCouncilViewState((current) =>
              current.status !== "ready"
                ? current
                : {
                    ...current,
                    showConfigDiscardDialog: false,
                  },
            );
            window.setTimeout(() => {
              councilConfigEditInputRef.current?.focus();
            }, 0);
          }}
          onConfirm={() => {
            closeCouncilConfigEdit(true);
          }}
          open={councilViewState.showConfigDiscardDialog}
          title="Discard changes?"
        />

        <ConfirmDialog
          confirmLabel="Remove"
          confirmTone="danger"
          message={
            councilViewState.pendingMemberRemovalId === null
              ? ""
              : `Remove ${memberNameById.get(councilViewState.pendingMemberRemovalId) ?? "this member"}? You can add them again later.`
          }
          onCancel={cancelCouncilViewMemberRemoval}
          onConfirm={() => {
            void confirmCouncilViewMemberRemoval();
          }}
          open={councilViewState.showMemberRemoveDialog}
          title="Remove member?"
        />

        <ConfirmDialog
          confirmLabel="Delete"
          confirmTone="danger"
          message={`Delete council "${council.title}" permanently?`}
          onCancel={() =>
            setCouncilViewState((current) =>
              current.status !== "ready"
                ? current
                : {
                    ...current,
                    showConfigDeleteDialog: false,
                  },
            )
          }
          onConfirm={() => {
            void deleteCouncilFromView(council);
          }}
          open={councilViewState.showConfigDeleteDialog}
          title="Delete council?"
        />

        <Dialog open={autopilotLimitModal !== null} onOpenChange={() => closeAutopilotLimitModal()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{autopilotDialogTitle}</DialogTitle>
              <DialogDescription>Set an optional turn limit for this run.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autopilot-limit-toggle"
                  checked={autopilotLimitModal?.limitTurns ?? false}
                  onChange={(event) =>
                    setAutopilotLimitModal((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            limitTurns: event.target.checked,
                            validationMessage: "",
                          },
                    )
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="autopilot-limit-toggle">Limit turns</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="autopilot-max-turns-input">
                  Max turns ({AUTOPILOT_MAX_TURNS_MIN}-{AUTOPILOT_MAX_TURNS_MAX})
                </Label>
                <Input
                  id="autopilot-max-turns-input"
                  type="number"
                  disabled={!(autopilotLimitModal?.limitTurns ?? false)}
                  min={AUTOPILOT_MAX_TURNS_MIN}
                  placeholder="e.g. 12"
                  value={autopilotLimitModal?.maxTurnsInput ?? ""}
                  onChange={(event) =>
                    setAutopilotLimitModal((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            maxTurnsInput: event.target.value,
                            validationMessage: "",
                          },
                    )
                  }
                />
              </div>
              {autopilotLimitModal?.validationMessage &&
              autopilotLimitModal.validationMessage.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {autopilotLimitModal.validationMessage}
                </p>
              ) : null}
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="secondary" onClick={closeAutopilotLimitModal}>
                Cancel
              </Button>
              <Button onClick={() => void submitAutopilotLimitModal()}>
                {autopilotSubmitLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ToastStack toasts={toasts} />
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
    const hasUnavailableConductorSelection = !isModelSelectionInCatalog({
      modelSelection: councilEditorState.draft.conductorModelSelection,
      modelCatalog: councilEditorState.source.modelCatalog,
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
                  onClick={() =>
                    setCouncilEditorState((current) =>
                      current.status !== "ready"
                        ? current
                        : {
                            ...current,
                            showDeleteDialog: true,
                          },
                    )
                  }
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
                  disabled={councilEditorState.showRemoveMemberDialog}
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
              {hasUnavailableConductorSelection ? (
                <option value={councilEditorState.draft.conductorModelSelection}>
                  Unavailable ({councilEditorState.draft.conductorModelSelection})
                </option>
              ) : null}
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
              <span
                aria-label={buildInvalidConfigBadgeAriaLabel("Council editor conductor model")}
                className="warning-badge"
                title="Invalid config"
              >
                Invalid config
              </span>
            ) : null}
          </div>

          {councilEditorState.message.length > 0 ? (
            <p aria-live="polite" className="status-line">
              {councilEditorState.message}
            </p>
          ) : null}
          {councilEditorState.source.council?.mode === "autopilot" &&
          councilEditorState.source.council.started &&
          !councilEditorState.source.council.paused ? (
            <p className="status-line">Pause Autopilot in Council View before archiving.</p>
          ) : null}
        </section>

        <ConfirmDialog
          cancelLabel="Keep editing"
          confirmLabel="Discard"
          confirmTone="danger"
          message="Your changes will be lost."
          onCancel={() =>
            setCouncilEditorState((current) =>
              current.status !== "ready"
                ? current
                : {
                    ...current,
                    showDiscardDialog: false,
                  },
            )
          }
          onConfirm={() => closeCouncilEditor(true)}
          open={councilEditorState.showDiscardDialog}
          title="Discard council changes?"
        />

        <ConfirmDialog
          confirmLabel="Delete"
          confirmTone="danger"
          message={`Delete council "${councilEditorState.draft.title.trim() || "Untitled council"}" permanently?`}
          onCancel={() =>
            setCouncilEditorState((current) =>
              current.status !== "ready"
                ? current
                : {
                    ...current,
                    showDeleteDialog: false,
                  },
            )
          }
          onConfirm={() => {
            void deleteCouncil();
          }}
          open={councilEditorState.showDeleteDialog}
          title="Delete council?"
        />

        <ConfirmDialog
          confirmLabel="Remove"
          confirmTone="danger"
          message={
            councilEditorState.pendingMemberRemovalId === null
              ? ""
              : `Remove ${councilEditorState.source.availableAgents.find((agent) => agent.id === councilEditorState.pendingMemberRemovalId)?.name ?? "this member"}? You can add them again later.`
          }
          onCancel={cancelCouncilMemberRemoval}
          onConfirm={confirmCouncilMemberRemoval}
          open={councilEditorState.showRemoveMemberDialog}
          title="Remove member?"
        />

        <ToastStack toasts={toasts} />
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
    const hasUnavailableAgentSelection = !isModelSelectionInCatalog({
      modelSelection: agentEditorState.draft.modelSelection,
      modelCatalog: agentEditorState.source.modelCatalog,
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
                onClick={() =>
                  setAgentEditorState((current) =>
                    current.status !== "ready"
                      ? current
                      : {
                          ...current,
                          showDeleteDialog: true,
                        },
                  )
                }
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
              {hasUnavailableAgentSelection ? (
                <option value={agentEditorState.draft.modelSelection}>
                  Unavailable ({agentEditorState.draft.modelSelection})
                </option>
              ) : null}
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
              <span
                aria-label={buildInvalidConfigBadgeAriaLabel("Agent editor model")}
                className="warning-badge"
                title="Invalid config"
              >
                Invalid config
              </span>
            ) : null}
          </div>

          {agentEditorState.message.length > 0 ? (
            <p aria-live="polite" className="status-line">
              {agentEditorState.message}
            </p>
          ) : null}
        </section>

        <ConfirmDialog
          cancelLabel="Keep editing"
          confirmLabel="Discard"
          confirmTone="danger"
          message="Your changes will be lost."
          onCancel={() =>
            setAgentEditorState((current) =>
              current.status !== "ready"
                ? current
                : {
                    ...current,
                    showDiscardDialog: false,
                  },
            )
          }
          onConfirm={() => closeAgentEditor(true)}
          open={agentEditorState.showDiscardDialog}
          title="Discard agent changes?"
        />

        <ConfirmDialog
          confirmLabel="Delete"
          confirmTone="danger"
          message="Delete this agent permanently?"
          onCancel={() =>
            setAgentEditorState((current) =>
              current.status !== "ready"
                ? current
                : {
                    ...current,
                    showDeleteDialog: false,
                  },
            )
          }
          onConfirm={() => {
            void deleteAgent();
          }}
          open={agentEditorState.showDeleteDialog}
          title="Delete agent?"
        />

        <ToastStack toasts={toasts} />
      </main>
    );
  }

  const renderHomeContent = (): JSX.Element => {
    if (homeTab === "councils") {
      return (
        <section
          aria-labelledby="home-tab-councils"
          className="settings-section"
          id="home-panel-councils"
          role="tabpanel"
        >
          <header className="section-header compact council-header">
            <div className="council-header-main">
              <div>
                <h2>Councils</h2>
                <p className="council-count">{councilsTotal} total</p>
              </div>
              <button
                className="cta new-council-btn"
                onClick={() => void openCouncilEditor(null)}
                type="button"
              >
                <span className="new-council-icon">+</span>
                New Council
              </button>
            </div>
          </header>
          <div className="councils-toolbar">
            <div className="councils-search-group">
              <input
                aria-label="Search councils"
                className="councils-search-input"
                onChange={(event) => setCouncilsSearchText(event.target.value)}
                placeholder="Search title or topic"
                type="text"
                value={councilsSearchText}
              />
              <input
                aria-label="Filter councils by tag"
                className="councils-tag-input"
                onChange={(event) => setCouncilsTagFilter(event.target.value)}
                placeholder="Filter by tag"
                type="text"
                value={councilsTagFilter}
              />
            </div>
            <div className="councils-filter-group">
              <select
                className="councils-filter-select"
                value={councilsArchivedFilter}
                onChange={(event) =>
                  setCouncilsArchivedFilter(event.target.value as CouncilArchivedFilter)
                }
              >
                <option value="all">All councils</option>
                <option value="active">Active only</option>
                <option value="archived">Archived only</option>
              </select>
              <select
                className="councils-filter-select"
                value={councilsSortBy}
                onChange={(event) => setCouncilsSortBy(event.target.value as CouncilSortField)}
              >
                <option value="updatedAt">Last modified</option>
                <option value="createdAt">Date created</option>
              </select>
              <select
                className="councils-filter-select"
                value={councilsSortDirection}
                onChange={(event) => setCouncilsSortDirection(event.target.value as SortDirection)}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>
          </div>

          {councilsError !== null ? <p className="status">Error: {councilsError}</p> : null}
          {councilsLoading ? <p className="status">Loading councils...</p> : null}

          {!councilsLoading && councils.length === 0 ? (
            <p className="status">No councils yet. Create your first council.</p>
          ) : null}

          <div className="councils-grid">
            {councils.map((council) => {
              const runtimeStatus = council.started
                ? council.paused
                  ? "paused"
                  : "running"
                : "stopped";
              return (
                <article
                  className={`council-card ${council.archived ? "council-card-archived" : ""}`}
                  key={council.id}
                >
                  <div className="council-card-header">
                    <div className="council-card-title-row">
                      <h3 className="council-card-title">{council.title}</h3>
                      <div className="council-card-badges">
                        {council.archived ? (
                          <span className="council-badge council-badge-archived">Archived</span>
                        ) : null}
                        {council.invalidConfig ? (
                          <span className="council-badge council-badge-error">Config Error</span>
                        ) : null}
                        <span
                          className={`council-badge council-badge-status council-status-${runtimeStatus}`}
                        >
                          {runtimeStatus === "running"
                            ? "● Running"
                            : runtimeStatus === "paused"
                              ? "⏸ Paused"
                              : "○ Stopped"}
                        </span>
                      </div>
                    </div>
                    <p className="council-card-topic" title={council.topic}>
                      {council.topic}
                    </p>
                  </div>

                  <div className="council-card-stats">
                    <div className="council-stat">
                      <span className="council-stat-value">{council.memberAgentIds.length}</span>
                      <span className="council-stat-label">
                        {council.memberAgentIds.length === 1 ? "member" : "members"}
                      </span>
                    </div>
                    <div className="council-stat-divider" />
                    <div className="council-stat">
                      <span className="council-stat-value">{council.turnCount}</span>
                      <span className="council-stat-label">
                        {council.turnCount === 1 ? "turn" : "turns"}
                      </span>
                    </div>
                    <div className="council-stat-divider" />
                    <div className="council-stat">
                      <span className="council-stat-value council-mode-badge">{council.mode}</span>
                    </div>
                  </div>

                  {council.tags.length > 0 ? (
                    <div className="council-card-tags">
                      {council.tags.slice(0, 3).map((tag) => (
                        <span className="council-tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                      {council.tags.length > 3 ? (
                        <span className="council-tag council-tag-more">
                          +{council.tags.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="council-card-actions">
                    <button
                      className="council-btn-open"
                      onClick={() => void openCouncilView(council.id)}
                      type="button"
                    >
                      Open Council
                    </button>
                    <details
                      aria-label={`Actions menu for council ${council.title}`}
                      className="council-actions-menu"
                      onKeyDown={handleCouncilRowMenuKeyDown}
                      onToggle={handleCouncilMenuToggle}
                    >
                      <summary
                        aria-label={`Toggle actions for council ${council.title}`}
                        className="council-btn-more"
                        onKeyDown={handleCouncilRowMenuSummaryKeyDown}
                      >
                        <svg
                          aria-hidden="true"
                          fill="none"
                          height="16"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          width="16"
                        >
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="19" cy="12" r="1" />
                          <circle cx="5" cy="12" r="1" />
                        </svg>
                      </summary>
                      <div
                        aria-label={`Council actions for ${council.title}`}
                        className="council-menu-dropdown"
                      >
                        <button
                          className="council-menu-item"
                          disabled={exportingCouncilId === council.id}
                          onClick={(event) => {
                            const details = event.currentTarget.closest("details");
                            if (details) {
                              details.open = false;
                            }
                            void exportCouncilTranscript({
                              viewKind: "councilsList",
                              councilId: council.id,
                            });
                          }}
                          type="button"
                        >
                          {exportingCouncilId === council.id ? "Exporting..." : "Export transcript"}
                        </button>
                        <button
                          className="council-menu-item"
                          disabled={
                            !council.archived &&
                            council.mode === "autopilot" &&
                            council.started &&
                            !council.paused
                          }
                          onClick={(event) => {
                            const details = event.currentTarget.closest("details");
                            if (details) {
                              details.open = false;
                            }
                            void setCouncilArchivedFromList({
                              councilId: council.id,
                              archived: !council.archived,
                            });
                          }}
                          title={
                            !council.archived &&
                            council.mode === "autopilot" &&
                            council.started &&
                            !council.paused
                              ? "Pause Autopilot before archiving"
                              : undefined
                          }
                          type="button"
                        >
                          {council.archived ? "Restore council" : "Archive council"}
                        </button>
                        <hr className="council-menu-divider" />
                        <button
                          className="council-menu-item council-menu-item-danger"
                          onClick={(event) => {
                            const details = event.currentTarget.closest("details");
                            if (details) {
                              details.open = false;
                            }
                            void deleteCouncilFromList(council);
                          }}
                          type="button"
                        >
                          Delete council
                        </button>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
            {councilsHasMore ? (
              <div className="councils-load-more">
                <button
                  className="secondary"
                  disabled={councilsLoadingMore}
                  onClick={() => void loadCouncils({ page: councilsPage + 1, append: true })}
                  type="button"
                >
                  {councilsLoadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    if (homeTab === "agents") {
      return (
        <section
          aria-labelledby="home-tab-agents"
          className="settings-section"
          id="home-panel-agents"
          role="tabpanel"
        >
          <header className="section-header compact">
            <div className="council-header-main">
              <div>
                <h2>Agents</h2>
                <p className="council-count">{agentsTotal} total</p>
              </div>
              <button
                className="cta new-council-btn"
                onClick={() => void openAgentEditor(null)}
                type="button"
              >
                <span className="new-council-icon" aria-hidden="true">
                  +
                </span>
                New Agent
              </button>
            </div>
          </header>

          <div className="agents-toolbar">
            <div className="agents-search-group">
              <input
                aria-label="Search agents"
                className="agents-search-input"
                onChange={(event) => setAgentsSearchText(event.target.value)}
                placeholder="Search name or prompt"
                type="text"
                value={agentsSearchText}
              />
              <input
                aria-label="Filter by tag"
                className="agents-tag-input"
                onChange={(event) => setAgentsTagFilter(event.target.value)}
                placeholder="Filter by tag"
                type="text"
                value={agentsTagFilter}
              />
            </div>
            <div className="agents-filter-group">
              <select
                className="agents-filter-select"
                value={agentsSortBy}
                onChange={(event) => setAgentsSortBy(event.target.value as AgentSortField)}
              >
                <option value="updatedAt">Sort: Modified</option>
                <option value="createdAt">Sort: Created</option>
              </select>
              <select
                className="agents-filter-select"
                value={agentsSortDirection}
                onChange={(event) => setAgentsSortDirection(event.target.value as SortDirection)}
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>

          {agentsError !== null ? <p className="status">Error: {agentsError}</p> : null}
          {agentsLoading ? <p className="status">Loading agents...</p> : null}

          {!agentsLoading && agents.length === 0 ? (
            <p className="status">No agents yet. Create your first agent.</p>
          ) : null}

          <div className="agents-grid">
            {agents.map((agent) => (
              <article className="agent-card" key={agent.id}>
                <div className="agent-card-header">
                  <h3 className="agent-card-title">{agent.name}</h3>
                  <div className="agent-card-badges">
                    {agent.invalidConfig ? (
                      <span
                        aria-label="Invalid configuration"
                        className="council-badge council-badge-error"
                        title="Invalid config"
                      >
                        Invalid config
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="agent-card-prompt">{agent.systemPrompt}</p>

                <div className="agent-card-stats">
                  <div className="agent-stat">
                    <span className="agent-stat-label">Model:</span>
                    <span className="agent-stat-value">
                      {modelLabel(agent, agentsGlobalDefaultModel)}
                    </span>
                  </div>
                </div>

                {agent.tags.length > 0 ? (
                  <div className="agent-card-tags">
                    {agent.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="agent-tag">
                        {tag}
                      </span>
                    ))}
                    {agent.tags.length > 3 ? (
                      <span className="agent-tag council-tag-more">+{agent.tags.length - 3}</span>
                    ) : null}
                  </div>
                ) : null}

                <div className="agent-card-actions">
                  <details
                    aria-label={`Actions menu for agent ${agent.name}`}
                    className="agent-actions-menu"
                    onToggle={handleAgentMenuToggle}
                  >
                    <summary
                      aria-label={`Toggle actions for agent ${agent.name}`}
                      className="agent-btn-more"
                    >
                      <svg
                        aria-hidden="true"
                        fill="none"
                        height="16"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="16"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </summary>
                    <div
                      aria-label={`Agent actions for ${agent.name}`}
                      className="agent-menu-dropdown"
                    >
                      <button
                        className="agent-menu-item"
                        onClick={(event) => {
                          const details = event.currentTarget.closest("details");
                          if (details) {
                            details.open = false;
                          }
                          void openAgentEditor(agent.id);
                        }}
                        type="button"
                      >
                        Edit agent
                      </button>
                      <hr className="agent-menu-divider" />
                      <button
                        className="agent-menu-item agent-menu-item-danger"
                        onClick={(event) => {
                          const details = event.currentTarget.closest("details");
                          if (details) {
                            details.open = false;
                          }
                          void deleteAgentFromList(agent);
                        }}
                        type="button"
                      >
                        Delete agent
                      </button>
                    </div>
                  </details>
                </div>
              </article>
            ))}
            {agentsHasMore ? (
              <div className="agents-load-more">
                <button
                  className="secondary"
                  disabled={agentsLoadingMore}
                  onClick={() => void loadAgents({ page: agentsPage + 1, append: true })}
                  type="button"
                >
                  {agentsLoadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    if (settingsViewState.status === "loading" || drafts === null) {
      return (
        <section
          aria-labelledby="home-tab-settings"
          className="settings-section"
          id="home-panel-settings"
          role="tabpanel"
        >
          <h2>Settings</h2>
          <p className="status">Loading settings...</p>
        </section>
      );
    }

    if (settingsViewState.status === "error") {
      return (
        <section
          aria-labelledby="home-tab-settings"
          className="settings-section"
          id="home-panel-settings"
          role="tabpanel"
        >
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
        <section
          aria-labelledby="home-tab-settings"
          className="settings-section"
          id="home-panel-settings"
          role="tabpanel"
        >
          <h2>Providers</h2>
          <div className="provider-grid">
            {providerOrder.map((providerId) => {
              const provider = drafts[providerId];
              const savedProvider = settingsViewState.data.providers.find(
                (item) => item.providerId === providerId,
              );
              const savedFingerprint =
                savedDraftFingerprints === null ? null : savedDraftFingerprints[providerId];
              const connectionTestAllowed = isConnectionTestAllowed({
                provider,
                savedFingerprint,
              });
              const providerConfigured =
                savedProvider !== undefined && isProviderConfigured(savedProvider);
              const showOllamaNote = providerId === "ollama";
              const providerLabel = PROVIDER_LABELS[providerId];

              return (
                <Card key={providerId} className="provider-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{providerLabel}</CardTitle>
                      <Badge
                        aria-label={buildProviderConfiguredBadgeAriaLabel({
                          providerLabel,
                          configured: providerConfigured,
                        })}
                        variant={providerConfigured ? "default" : "secondary"}
                      >
                        {providerConfigured ? "Configured" : "Not configured"}
                      </Badge>
                    </div>
                    <CardDescription>
                      Last saved: {savedProvider?.lastSavedAtUtc ?? "Not saved yet"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${providerId}-endpoint`}>Endpoint URL</Label>
                      <Input
                        id={`${providerId}-endpoint`}
                        onChange={(event) =>
                          updateProviderDraft(providerId, { endpointUrl: event.target.value })
                        }
                        placeholder={
                          providerId === "ollama" ? "http://127.0.0.1:11434" : "Optional endpoint"
                        }
                        value={provider.endpointUrl}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${providerId}-key`}>API key</Label>
                      <Input
                        id={`${providerId}-key`}
                        type="password"
                        onChange={(event) =>
                          updateProviderDraft(providerId, { apiKey: event.target.value })
                        }
                        placeholder={showOllamaNote ? "Optional for local Ollama" : "Enter API key"}
                        value={provider.apiKey}
                      />
                      {showOllamaNote ? (
                        <p className="text-xs text-muted-foreground">
                          Local Ollama usually does not need an API key.
                        </p>
                      ) : null}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Credential in keychain: {savedProvider?.hasCredential ? "Saved" : "Not saved"}
                    </p>

                    <div className="flex gap-2 pt-2">
                      <Button
                        aria-label={buildProviderConnectionTestButtonAriaLabel({
                          providerLabel,
                          connectionTestAllowed,
                        })}
                        disabled={!connectionTestAllowed}
                        onClick={() => void runConnectionTest(providerId)}
                        title={
                          connectionTestAllowed
                            ? "Test updated provider settings"
                            : "Edit endpoint or key before running a new test"
                        }
                      >
                        {provider.isTesting ? "Testing..." : "Test connection"}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!isSaveAllowed(provider)}
                        onClick={() => void saveProvider(providerId)}
                      >
                        {provider.isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>

                    <p aria-live="polite" className="text-sm text-muted-foreground">
                      Status: {provider.testStatusText}
                    </p>
                    {provider.message.length > 0 ? (
                      <p aria-live="polite" className="text-sm text-muted-foreground">
                        {provider.message}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
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
              <span
                aria-label={buildInvalidConfigBadgeAriaLabel("Global default model")}
                className="warning-badge"
                title="Invalid config"
              >
                Invalid config
              </span>
            ) : null}
          </div>
        </section>

        <section className="settings-section">
          <h2>Context Window</h2>
          <label className="field" htmlFor="context-last-n">
            Last N messages
          </label>
          <input
            id="context-last-n"
            min={1}
            onChange={(event) => setContextLastNInput(event.target.value)}
            step={1}
            type="number"
            value={contextLastNInput}
          />
          <p className="meta">Runtime prompts include briefing + last N transcript messages.</p>
          <div className="button-row">
            <button className="secondary" onClick={() => void onSaveContextLastN()} type="button">
              Save context window
            </button>
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
        <div aria-label="Home tabs" className="tabs" role="tablist">
          <button
            aria-controls="home-panel-councils"
            aria-selected={homeTab === "councils"}
            className={homeTab === "councils" ? "tab tab-active" : "tab"}
            id="home-tab-councils"
            onKeyDown={(event) => handleHomeTabKeyDown(event, "councils")}
            onClick={() => setHomeTab("councils")}
            ref={(element) => {
              homeTabButtonRefs.current.councils = element;
            }}
            role="tab"
            tabIndex={homeTab === "councils" ? 0 : -1}
            type="button"
          >
            Councils
          </button>
          <button
            aria-controls="home-panel-agents"
            aria-selected={homeTab === "agents"}
            className={homeTab === "agents" ? "tab tab-active" : "tab"}
            id="home-tab-agents"
            onKeyDown={(event) => handleHomeTabKeyDown(event, "agents")}
            onClick={() => setHomeTab("agents")}
            ref={(element) => {
              homeTabButtonRefs.current.agents = element;
            }}
            role="tab"
            tabIndex={homeTab === "agents" ? 0 : -1}
            type="button"
          >
            Agents
          </button>
          <button
            aria-controls="home-panel-settings"
            aria-selected={homeTab === "settings"}
            className={homeTab === "settings" ? "tab tab-active" : "tab"}
            id="home-tab-settings"
            onKeyDown={(event) => handleHomeTabKeyDown(event, "settings")}
            onClick={() => setHomeTab("settings")}
            ref={(element) => {
              homeTabButtonRefs.current.settings = element;
            }}
            role="tab"
            tabIndex={homeTab === "settings" ? 0 : -1}
            type="button"
          >
            Settings
          </button>
        </div>
      </header>

      {renderHomeContent()}

      <ConfirmDialog
        confirmLabel="Delete"
        confirmTone="danger"
        message={
          pendingCouncilListDelete === null
            ? ""
            : `Delete council "${pendingCouncilListDelete.title}" permanently?`
        }
        onCancel={() => setPendingCouncilListDelete(null)}
        onConfirm={() => {
          void confirmDeleteCouncilFromList();
        }}
        open={pendingCouncilListDelete !== null}
        title="Delete council?"
      />

      <ConfirmDialog
        confirmLabel="Delete"
        message={
          pendingAgentListDelete === null
            ? ""
            : `Delete agent "${pendingAgentListDelete.name}" permanently?`
        }
        onCancel={() => setPendingAgentListDelete(null)}
        onConfirm={() => {
          void confirmDeleteAgentFromList();
        }}
        open={pendingAgentListDelete !== null}
        title="Delete agent?"
      />

      <ToastStack toasts={toasts} />
    </main>
  );
};
