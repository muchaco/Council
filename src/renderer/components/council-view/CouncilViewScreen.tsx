import { useCallback, useEffect, useState } from "react";

import {
  type AutopilotLimitModalAction,
  COUNCIL_CONFIG_MAX_TAGS,
  normalizeTagsDraft,
  toModelRef,
} from "../../../shared/app-ui-helpers.js";
import {
  type CouncilRuntimeErrorDto,
  readCouncilRuntimeErrorDetails,
} from "../../../shared/council-runtime-error-normalization.js";
import {
  buildAutopilotRecoveryNotice,
  buildManualRetryNotice,
} from "../../../shared/council-view-autopilot-recovery";
import { resolveCouncilViewRuntimeControls } from "../../../shared/council-view-runtime-controls.js";
import {
  COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE,
  buildCouncilViewExitPlan,
} from "../../../shared/council-view-runtime-guards";
import {
  resolveThinkingPlaceholderSpeakerId,
  shouldRenderInlineThinkingCancel,
} from "../../../shared/council-view-transcript.js";
import type { CouncilDto, GetCouncilViewResponse } from "../../../shared/ipc/dto";
import { ConfirmDialog } from "../../ConfirmDialog";
import { AutopilotLimitDialog } from "./AutopilotLimitDialog";
import { ConfigTab, type CouncilConfigEditState } from "./ConfigTab";
import { CouncilRuntimeAlerts } from "./CouncilRuntimeAlerts";
import { CouncilViewHeader } from "./CouncilViewHeader";
import { CouncilViewTabs } from "./CouncilViewTabs";
import { DiscussionTab } from "./DiscussionTab";

type CouncilViewTab = "discussion" | "config";

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
      isCancellingGeneration: boolean;
      isExportingTranscript: boolean;
      isLeavingView: boolean;
      showLeaveDialog: boolean;
      activeTab: CouncilViewTab;
      isConfigEditing: boolean;
      isSavingMembers: boolean;
      showMemberRemoveDialog: boolean;
      pendingMemberRemovalId: string | null;
      runtimeError: CouncilRuntimeErrorDto | null;
      message: string;
    }
  | { status: "error"; message: string };

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

const createReadyCouncilViewState = (
  source: GetCouncilViewResponse,
  options?: { activeTab?: CouncilViewTab; runtimeError?: CouncilRuntimeErrorDto | null },
): Extract<CouncilViewState, { status: "ready" }> => ({
  status: "ready",
  source,
  isStarting: false,
  isPausing: false,
  isResuming: false,
  isGeneratingManualTurn: false,
  pendingManualMemberAgentId: null,
  isInjectingConductor: false,
  isCancellingGeneration: false,
  isExportingTranscript: false,
  isLeavingView: false,
  showLeaveDialog: false,
  activeTab: options?.activeTab ?? "discussion",
  isConfigEditing: false,
  isSavingMembers: false,
  showMemberRemoveDialog: false,
  pendingMemberRemovalId: null,
  runtimeError: options?.runtimeError ?? null,
  message: "",
});

type CouncilViewScreenProps = {
  councilId: string;
  isActive: boolean;
  onClose: () => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const CouncilViewScreen = ({
  councilId,
  isActive,
  onClose,
  pushToast,
}: CouncilViewScreenProps): JSX.Element | null => {
  const [state, setState] = useState<CouncilViewState>({ status: "loading" });
  const [autopilotLimitAction, setAutopilotLimitAction] =
    useState<AutopilotLimitModalAction | null>(null);

  const loadCouncilView = useCallback(
    async (
      nextCouncilId: string,
      options?: {
        preserveActiveTab?: CouncilViewTab;
        runtimeError?: CouncilRuntimeErrorDto | null;
      },
    ): Promise<void> => {
      setState({ status: "loading" });
      const result = await window.api.councils.getCouncilView({
        viewKind: "councilView",
        councilId: nextCouncilId,
      });
      if (!result.ok) {
        setState({ status: "error", message: result.error.userMessage });
        pushToast("error", result.error.userMessage);
        return;
      }
      setState(
        createReadyCouncilViewState(result.value, {
          activeTab: options?.preserveActiveTab,
          runtimeError: options?.runtimeError ?? null,
        }),
      );
    },
    [pushToast],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadCouncilView(councilId);
  }, [councilId, isActive, loadCouncilView]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    document.title = `Council: ${state.status === "ready" ? state.source.council.title : "Council View"}`;
  }, [isActive, state]);

  useEffect(() => {
    if (!isActive || state.status !== "ready") {
      return;
    }
    const council = state.source.council;
    const generation = state.source.generation;
    if (
      council.mode !== "autopilot" ||
      !council.started ||
      council.paused ||
      council.archived ||
      generation.status === "running" ||
      state.isConfigEditing
    ) {
      return;
    }
    window.api.councils
      .advanceAutopilotTurn({ viewKind: "councilView", id: councilId })
      .then((result) => {
        if (!result.ok) {
          pushToast("error", result.error.userMessage);
          const runtimeError = readCouncilRuntimeErrorDetails(result.error.details);
          return loadCouncilView(councilId, { preserveActiveTab: state.activeTab, runtimeError });
        }
        return loadCouncilView(councilId);
      })
      .catch(() => {
        pushToast("error", "Autopilot encountered an error. Check console for details.");
      });
  }, [councilId, isActive, loadCouncilView, pushToast, state]);

  const completeClose = async (): Promise<void> => {
    setAutopilotLimitAction(null);
    onClose();
  };

  const executeLeave = async (params: {
    exitPlan: ReturnType<typeof buildCouncilViewExitPlan>;
  }): Promise<void> => {
    if (state.status !== "ready") {
      await completeClose();
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isLeavingView: true, showLeaveDialog: false, message: "" },
    );
    if (params.exitPlan.shouldPauseAutopilot) {
      const pauseResult = await window.api.councils.pauseAutopilot({ id: councilId });
      if (!pauseResult.ok) {
        pushToast("error", pauseResult.error.userMessage);
        setState((current) =>
          current.status !== "ready"
            ? current
            : { ...current, isLeavingView: false, message: pauseResult.error.userMessage },
        );
        return;
      }
    }
    if (params.exitPlan.shouldCancelGeneration) {
      const cancelResult = await window.api.councils.cancelGeneration({ id: councilId });
      if (!cancelResult.ok) {
        pushToast("error", cancelResult.error.userMessage);
        setState((current) =>
          current.status !== "ready"
            ? current
            : { ...current, isLeavingView: false, message: cancelResult.error.userMessage },
        );
        return;
      }
    }
    await completeClose();
  };

  const leaveSafely = async (): Promise<void> => {
    if (state.status !== "ready") {
      await completeClose();
      return;
    }
    if (state.isLeavingView) {
      return;
    }
    const exitPlan = buildCouncilViewExitPlan(state.source.council, state.source.generation);
    if (!exitPlan.requiresConfirmation) {
      await executeLeave({ exitPlan });
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, showLeaveDialog: true },
    );
  };

  const openAutopilotLimitModal = (action: AutopilotLimitModalAction): void => {
    setAutopilotLimitAction(action);
  };

  const executeStartCouncilRuntime = async (maxTurns: number | null): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isStarting: true, runtimeError: null, message: "" },
    );
    const result = await window.api.councils.start({
      viewKind: "councilView",
      id: councilId,
      maxTurns,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isStarting: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Council started.");
    await loadCouncilView(councilId);
  };

  const pauseCouncilRuntime = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isPausing: true, runtimeError: null, message: "" },
    );
    const result = await window.api.councils.pauseAutopilot({ id: councilId });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isPausing: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Autopilot paused.");
    await loadCouncilView(councilId);
  };

  const executeResumeCouncilRuntime = async (maxTurns: number | null): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isResuming: true, runtimeError: null, message: "" },
    );
    const result = await window.api.councils.resumeAutopilot({
      viewKind: "councilView",
      id: councilId,
      maxTurns,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isResuming: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Autopilot resumed.");
    await loadCouncilView(councilId);
  };

  const submitAutopilotLimitModal = async (maxTurns: number | null): Promise<void> => {
    if (autopilotLimitAction === null) {
      return;
    }
    const action = autopilotLimitAction;
    setAutopilotLimitAction(null);
    if (action === "start") {
      await executeStartCouncilRuntime(maxTurns);
      return;
    }
    await executeResumeCouncilRuntime(maxTurns);
  };

  const startCouncilRuntime = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    if (state.source.council.mode === "autopilot") {
      openAutopilotLimitModal("start");
      return;
    }
    await executeStartCouncilRuntime(null);
  };

  const saveCouncilConfigEdit = async (configEdit: CouncilConfigEditState): Promise<boolean> => {
    if (state.status !== "ready") {
      return false;
    }
    const currentCouncil = state.source.council;
    const nextTopic = configEdit.field === "topic" ? configEdit.draftValue : currentCouncil.topic;
    const nextGoal =
      configEdit.field === "goal" ? configEdit.draftValue : (currentCouncil.goal ?? "");
    const nextTagsInput =
      configEdit.field === "tags" ? configEdit.draftValue : currentCouncil.tags.join(", ");
    const nextModelSelection =
      configEdit.field === "conductorModel"
        ? configEdit.draftValue
        : currentCouncil.conductorModelRefOrNull === null
          ? ""
          : `${currentCouncil.conductorModelRefOrNull.providerId}:${currentCouncil.conductorModelRefOrNull.modelId}`;
    const normalizedTagsResult = normalizeTagsDraft({
      tagsInput: nextTagsInput,
      maxTags: COUNCIL_CONFIG_MAX_TAGS,
    });
    if (!normalizedTagsResult.ok) {
      pushToast("warning", normalizedTagsResult.message);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, message: normalizedTagsResult.message },
      );
      return false;
    }
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
      setState((current) =>
        current.status !== "ready" ? current : { ...current, message: result.error.userMessage },
      );
      return false;
    }
    pushToast("info", "Council config saved.");
    await loadCouncilView(councilId, { preserveActiveTab: "config" });
    return true;
  };

  const refreshCouncilViewConfigModels = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    const result = await window.api.councils.refreshModelCatalog({ viewKind: "councilView" });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready" ? current : { ...current, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Council model options refreshed.");
    await loadCouncilView(councilId, { preserveActiveTab: "config" });
  };

  const saveCouncilViewMembers = async (params: {
    memberAgentIds: ReadonlyArray<string>;
    memberColorsByAgentId: Readonly<Record<string, string>>;
    successMessage: string;
  }): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    const currentCouncil = state.source.council;
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isSavingMembers: true, message: "" },
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
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isSavingMembers: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", params.successMessage);
    await loadCouncilView(councilId);
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            activeTab: "discussion",
            isSavingMembers: false,
            showMemberRemoveDialog: false,
            pendingMemberRemovalId: null,
          },
    );
  };

  const setCouncilViewMemberColor = async (params: {
    memberAgentId: string;
    color: string;
  }): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    await saveCouncilViewMembers({
      memberAgentIds: state.source.council.memberAgentIds,
      memberColorsByAgentId: {
        ...state.source.council.memberColorsByAgentId,
        [params.memberAgentId]: params.color,
      },
      successMessage: "Member color updated.",
    });
  };

  const addCouncilViewMember = async (memberAgentId: string): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    const currentCouncil = state.source.council;
    if (currentCouncil.memberAgentIds.includes(memberAgentId)) {
      return;
    }
    const usedColors = new Set(Object.values(currentCouncil.memberColorsByAgentId));
    const defaultColor = MEMBER_COLOR_PALETTE.find((color) => !usedColors.has(color)) ?? "#0a5c66";
    await saveCouncilViewMembers({
      memberAgentIds: [...currentCouncil.memberAgentIds, memberAgentId],
      memberColorsByAgentId: {
        ...currentCouncil.memberColorsByAgentId,
        [memberAgentId]: defaultColor,
      },
      successMessage: "Member added.",
    });
  };

  const generateManualTurn = async (memberAgentId: string): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : {
            ...current,
            isGeneratingManualTurn: true,
            pendingManualMemberAgentId: memberAgentId,
            runtimeError: null,
            message: "",
          },
    );
    const result = await window.api.councils.generateManualTurn({
      viewKind: "councilView",
      id: councilId,
      memberAgentId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      const runtimeError = readCouncilRuntimeErrorDetails(result.error.details);
      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              isGeneratingManualTurn: false,
              pendingManualMemberAgentId: null,
              runtimeError,
              message: "",
            },
      );
      return;
    }
    pushToast("info", "Manual turn generated.");
    await loadCouncilView(councilId);
  };

  const injectConductorMessage = async (content: string): Promise<boolean> => {
    if (state.status !== "ready") {
      return false;
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      pushToast("warning", "Conductor message cannot be empty.");
      return false;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isInjectingConductor: true, runtimeError: null, message: "" },
    );
    const result = await window.api.councils.injectConductorMessage({
      viewKind: "councilView",
      id: councilId,
      content: trimmedContent,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isInjectingConductor: false, message: result.error.userMessage },
      );
      return false;
    }
    pushToast("info", "Conductor message added.");
    await loadCouncilView(councilId);
    return true;
  };

  const cancelCouncilGeneration = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isCancellingGeneration: true },
    );
    const result = await window.api.councils.cancelGeneration({ id: councilId });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isCancellingGeneration: false, message: result.error.userMessage },
      );
      return;
    }
    pushToast(
      "info",
      result.value.cancelled ? "Generation cancelled." : "No generation in progress.",
    );
    await loadCouncilView(councilId);
  };

  const exportCouncilTranscript = async (): Promise<void> => {
    if (state.status !== "ready") {
      return;
    }
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, isExportingTranscript: true, message: "" },
    );
    const result = await window.api.councils.exportTranscript({
      viewKind: "councilView",
      id: councilId,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready"
          ? current
          : { ...current, isExportingTranscript: false, message: result.error.userMessage },
      );
      return;
    }
    setState((current) =>
      current.status !== "ready" ? current : { ...current, isExportingTranscript: false },
    );
    if (result.value.status === "cancelled") {
      pushToast("warning", "Export cancelled.");
      return;
    }
    pushToast("info", `Transcript exported to ${result.value.filePath}`);
  };

  const setCouncilArchivedFromView = async (
    council: CouncilDto,
    archived: boolean,
  ): Promise<void> => {
    const result = await window.api.councils.setArchived({ id: council.id, archived });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready" ? current : { ...current, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", archived ? "Council archived." : "Council restored.");
    await loadCouncilView(councilId, { preserveActiveTab: "config" });
  };

  const deleteCouncilFromView = async (council: CouncilDto): Promise<void> => {
    const result = await window.api.councils.delete({ id: council.id });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setState((current) =>
        current.status !== "ready" ? current : { ...current, message: result.error.userMessage },
      );
      return;
    }
    pushToast("info", "Council deleted.");
    onClose();
  };

  if (!isActive) {
    return null;
  }
  if (state.status === "loading") {
    return (
      <main className="shell">
        <header className="section-header">
          <button className="secondary" onClick={() => void leaveSafely()} type="button">
            Back
          </button>
          <h1>Council View</h1>
        </header>
        <p className="status">Loading council view...</p>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="shell">
        <header className="section-header">
          <button className="secondary" onClick={() => void leaveSafely()} type="button">
            Back
          </button>
          <h1>Council View</h1>
        </header>
        <p className="status">Error: {state.message}</p>
      </main>
    );
  }

  const council = state.source.council;
  const availableAgentById = new Map(
    state.source.availableAgents.map((agent) => [agent.id, agent]),
  );
  const memberNameById = new Map(
    state.source.availableAgents.map((agent) => [agent.id, agent.name]),
  );
  const archivedMemberIds = council.memberAgentIds.filter(
    (memberAgentId) => availableAgentById.get(memberAgentId)?.archived === true,
  );
  const hasArchivedMembers = archivedMemberIds.length > 0;
  const archivedMemberNames = archivedMemberIds.map(
    (memberAgentId) => memberNameById.get(memberAgentId) ?? memberAgentId,
  );
  const runtimeControls = resolveCouncilViewRuntimeControls({
    mode: council.mode,
    started: council.started,
    paused: council.paused,
    archived: council.archived,
    messageCount: state.source.messages.length,
  });
  const generationRunning = state.source.generation.status === "running";
  const generationActive = generationRunning || state.isGeneratingManualTurn;
  const manualSpeakerDisabledReason = council.archived
    ? "Archived councils are read-only."
    : hasArchivedMembers
      ? "Restore or remove archived members before selecting the next speaker."
      : !council.started
        ? "Start the council before selecting the next speaker."
        : generationRunning || state.isGeneratingManualTurn
          ? "Wait for the current generation to finish."
          : null;
  const pausedNextSpeakerId =
    council.mode === "autopilot" && council.paused
      ? state.source.generation.plannedNextSpeakerAgentId
      : null;
  const pausedNextSpeakerName =
    pausedNextSpeakerId === null
      ? null
      : (memberNameById.get(pausedNextSpeakerId) ?? pausedNextSpeakerId);
  const thinkingSpeakerId = resolveThinkingPlaceholderSpeakerId({
    generation: state.source.generation,
    pendingManualMemberAgentId: state.pendingManualMemberAgentId,
  });
  const thinkingSpeakerName =
    thinkingSpeakerId === null
      ? null
      : (memberNameById.get(thinkingSpeakerId) ?? thinkingSpeakerId);
  const thinkingSpeakerColor =
    thinkingSpeakerId === null
      ? null
      : (council.memberColorsByAgentId[thinkingSpeakerId] ?? MEMBER_COLOR_PALETTE[0] ?? "#0a5c66");
  const showInlineThinkingCancel = shouldRenderInlineThinkingCancel({
    generationActive,
    thinkingSpeakerId,
  });
  const autopilotRecoveryNotice = buildAutopilotRecoveryNotice({
    council: { mode: council.mode, started: council.started, paused: council.paused },
    runtimeError: state.runtimeError,
  });
  const manualRetryNotice = buildManualRetryNotice({
    council: { mode: council.mode },
    runtimeError: state.runtimeError,
  });
  const autopilotSubmitLabel =
    autopilotLimitAction === "start"
      ? state.isStarting
        ? "Starting..."
        : "Start"
      : state.isResuming
        ? "Resuming..."
        : "Resume";
  const startDisabled =
    state.isStarting ||
    council.invalidConfig ||
    hasArchivedMembers ||
    autopilotLimitAction !== null ||
    state.isConfigEditing;
  const startDisabledReason = council.invalidConfig
    ? "Fix the model config before starting."
    : hasArchivedMembers
      ? "Restore or remove archived members before starting."
      : undefined;
  const runtimeBriefing = state.source.briefing;
  const canEditMembers =
    !council.archived && (!council.started || council.paused || council.mode === "manual");
  const memberIdsWithMessages = new Set(
    state.source.messages
      .filter((message) => message.senderKind === "member" && message.senderAgentId !== null)
      .map((message) => message.senderAgentId as string),
  );

  return (
    <main className="main-content">
      <div className="main-content-inner">
        <CouncilViewHeader
          autopilotLimitModalOpen={autopilotLimitAction !== null}
          autopilotMaxTurns={council.autopilotMaxTurns}
          autopilotTurnsCompleted={council.autopilotTurnsCompleted}
          cancelDisabled={state.isCancellingGeneration || state.isConfigEditing}
          canShowRuntimeBlockBadge={
            (runtimeControls.canStart || runtimeControls.canResume) &&
            (council.invalidConfig || hasArchivedMembers)
          }
          invalidConfig={council.invalidConfig}
          isCancellingGeneration={state.isCancellingGeneration}
          isLeavingView={state.isLeavingView}
          isPausing={state.isPausing}
          isResuming={state.isResuming}
          isStarting={state.isStarting}
          mode={council.mode}
          onBack={() => void leaveSafely()}
          onCancelGeneration={() => void cancelCouncilGeneration()}
          onPause={() => void pauseCouncilRuntime()}
          onResume={() => openAutopilotLimitModal("resume")}
          onStart={() => void startCouncilRuntime()}
          pauseDisabled={state.isPausing || state.isConfigEditing}
          paused={council.paused}
          pausedNextSpeakerName={pausedNextSpeakerName}
          resumeDisabledReason={
            council.invalidConfig
              ? "Fix the model config before resuming."
              : hasArchivedMembers
                ? "Restore or remove archived members before resuming."
                : undefined
          }
          runtimeControls={runtimeControls}
          showTopBarCancel={generationActive && !showInlineThinkingCancel}
          startDisabled={startDisabled}
          startDisabledReason={startDisabledReason}
          started={council.started}
          statusBadgeTitle={
            council.invalidConfig
              ? "Resolved conductor model is unavailable in this view's model catalog snapshot."
              : "One or more council members are archived."
          }
          title={council.title}
          turnCount={council.turnCount}
        />
        <CouncilViewTabs
          activeTab={state.activeTab}
          disableConfigTab={state.isConfigEditing && state.activeTab !== "config"}
          disableDiscussionTab={state.isConfigEditing && state.activeTab !== "discussion"}
          onSelectTab={(activeTab) =>
            setState((current) =>
              current.status !== "ready" ? current : { ...current, activeTab },
            )
          }
        />

        <CouncilRuntimeAlerts
          archived={council.archived}
          archivedMemberNames={archivedMemberNames}
          hasArchivedMembers={hasArchivedMembers}
          invalidConfig={council.invalidConfig}
          message={state.message}
          showMessage={state.message.length > 0 && autopilotRecoveryNotice === null}
        />

        {state.activeTab === "discussion" ? (
          <DiscussionTab
            autopilotRecoveryNotice={autopilotRecoveryNotice}
            availableAgents={state.source.availableAgents}
            briefing={runtimeBriefing}
            canEditMembers={canEditMembers}
            conductorDisabled={generationRunning || council.archived}
            council={council}
            isCancellingGeneration={state.isCancellingGeneration}
            isConfigEditing={state.isConfigEditing}
            isGeneratingManualTurn={state.isGeneratingManualTurn}
            isInjectingConductor={state.isInjectingConductor}
            isSavingMembers={state.isSavingMembers}
            isStarting={state.isStarting}
            manualRetryNotice={manualRetryNotice}
            manualSpeakerDisabledReason={manualSpeakerDisabledReason}
            memberIdsWithMessages={memberIdsWithMessages}
            memberNameById={memberNameById}
            memberPalette={MEMBER_COLOR_PALETTE}
            messages={state.source.messages}
            onAddMember={(memberAgentId) => void addCouncilViewMember(memberAgentId)}
            onCancelGeneration={() => void cancelCouncilGeneration()}
            onGenerateManualTurn={(memberAgentId) => void generateManualTurn(memberAgentId)}
            onMemberColorChange={(params) => void setCouncilViewMemberColor(params)}
            onRequestRemoveMember={(memberAgentId) =>
              setState((current) =>
                current.status !== "ready"
                  ? current
                  : {
                      ...current,
                      pendingMemberRemovalId: memberAgentId,
                      showMemberRemoveDialog: true,
                    },
              )
            }
            onStartDiscussion={() => void startCouncilRuntime()}
            onSubmitConductor={injectConductorMessage}
            showEmptyStateStart={runtimeControls.showEmptyStateStart}
            showInlineThinkingCancel={showInlineThinkingCancel}
            startDisabled={startDisabled}
            startDisabledReason={startDisabledReason}
            thinkingSpeakerColor={thinkingSpeakerColor}
            thinkingSpeakerName={thinkingSpeakerName}
          />
        ) : (
          <ConfigTab
            archiveDisabled={
              !council.archived &&
              council.mode === "autopilot" &&
              council.started &&
              !council.paused
            }
            archiveDisabledReason={
              !council.archived &&
              council.mode === "autopilot" &&
              council.started &&
              !council.paused
                ? "Pause Autopilot before archiving this council."
                : undefined
            }
            canRefreshModels={state.source.canRefreshModels}
            council={council}
            globalDefaultModelRef={state.source.globalDefaultModelRef}
            isExportingTranscript={state.isExportingTranscript}
            modelCatalog={state.source.modelCatalog}
            onDeleteCouncil={() => deleteCouncilFromView(council)}
            onEditingChange={(isConfigEditing) =>
              setState((current) =>
                current.status !== "ready" ? current : { ...current, isConfigEditing },
              )
            }
            onExportTranscript={exportCouncilTranscript}
            onRefreshModelCatalog={refreshCouncilViewConfigModels}
            onSaveField={saveCouncilConfigEdit}
            onToggleArchived={(archived) => setCouncilArchivedFromView(council, archived)}
          />
        )}

        <ConfirmDialog
          cancelLabel="Stay"
          confirmLabel="Leave"
          confirmTone="danger"
          message={COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE}
          onCancel={() =>
            setState((current) =>
              current.status !== "ready" ? current : { ...current, showLeaveDialog: false },
            )
          }
          onConfirm={() => {
            const exitPlan = buildCouncilViewExitPlan(
              state.source.council,
              state.source.generation,
            );
            void executeLeave({ exitPlan });
          }}
          open={state.showLeaveDialog}
          title="Leave Council View?"
        />
        <ConfirmDialog
          confirmLabel="Remove"
          confirmTone="danger"
          message={
            state.pendingMemberRemovalId === null
              ? ""
              : `Remove ${memberNameById.get(state.pendingMemberRemovalId) ?? "this member"}? You can add them again later.`
          }
          onCancel={() =>
            setState((current) =>
              current.status !== "ready"
                ? current
                : { ...current, pendingMemberRemovalId: null, showMemberRemoveDialog: false },
            )
          }
          onConfirm={() => {
            if (state.pendingMemberRemovalId === null) {
              return;
            }
            const memberId = state.pendingMemberRemovalId;
            const nextMemberIds = state.source.council.memberAgentIds.filter(
              (id) => id !== memberId,
            );
            const nextColors = { ...state.source.council.memberColorsByAgentId };
            delete nextColors[memberId];
            void saveCouncilViewMembers({
              memberAgentIds: nextMemberIds,
              memberColorsByAgentId: nextColors,
              successMessage: "Member removed.",
            });
          }}
          open={state.showMemberRemoveDialog}
          title="Remove member?"
        />

        <AutopilotLimitDialog
          action={autopilotLimitAction}
          onClose={() => setAutopilotLimitAction(null)}
          onSubmit={(maxTurns) => void submitAutopilotLimitModal(maxTurns)}
          submitLabel={autopilotSubmitLabel}
        />
      </div>
    </main>
  );
};
