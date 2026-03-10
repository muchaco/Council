import type { Dispatch, SetStateAction } from "react";

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
import { buildCouncilViewExitPlan } from "../../../shared/council-view-runtime-guards";
import type { CouncilDto } from "../../../shared/ipc/dto";
import type { CouncilConfigEditState } from "./ConfigTab";
import {
  type CouncilViewState,
  type CouncilViewTab,
  MEMBER_COLOR_PALETTE,
} from "./councilViewScreenState";

type LoadCouncilView = (
  nextCouncilId: string,
  options?: {
    preserveActiveTab?: CouncilViewTab;
    runtimeError?: CouncilRuntimeErrorDto | null;
  },
) => Promise<void>;

type UseCouncilViewActionsParams = {
  autopilotLimitAction: AutopilotLimitModalAction | null;
  councilId: string;
  loadCouncilView: LoadCouncilView;
  onClose: () => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
  setAutopilotLimitAction: Dispatch<SetStateAction<AutopilotLimitModalAction | null>>;
  setState: Dispatch<SetStateAction<CouncilViewState>>;
  state: CouncilViewState;
};

export const useCouncilViewActions = ({
  autopilotLimitAction,
  councilId,
  loadCouncilView,
  onClose,
  pushToast,
  setAutopilotLimitAction,
  setState,
  state,
}: UseCouncilViewActionsParams) => {
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

  return {
    addCouncilViewMember,
    cancelCouncilGeneration,
    deleteCouncilFromView,
    executeLeave,
    executeStartCouncilRuntime,
    exportCouncilTranscript,
    generateManualTurn,
    injectConductorMessage,
    leaveSafely,
    openAutopilotLimitModal,
    pauseCouncilRuntime,
    refreshCouncilViewConfigModels,
    saveCouncilConfigEdit,
    saveCouncilViewMembers,
    setCouncilArchivedFromView,
    setCouncilViewMemberColor,
    startCouncilRuntime,
    submitAutopilotLimitModal,
  };
};
