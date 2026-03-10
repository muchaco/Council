import {
  type CouncilRuntimeErrorDto,
  readCouncilRuntimeErrorDetails,
} from "../../../shared/council-runtime-error-normalization.js";
import { buildCouncilViewExitPlan } from "../../../shared/council-view-runtime-guards";
import type { CouncilViewActionContext } from "./councilViewActionContext";

export const useCouncilViewRuntimeActions = ({
  autopilotLimitAction,
  councilId,
  loadCouncilView,
  onClose,
  pushToast,
  setAutopilotLimitAction,
  setState,
  state,
}: CouncilViewActionContext) => {
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

  const openAutopilotLimitModal = (action: "start" | "resume"): void => {
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
      const runtimeError: CouncilRuntimeErrorDto | null = readCouncilRuntimeErrorDetails(
        result.error.details,
      );
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

  return {
    cancelCouncilGeneration,
    executeLeave,
    executeStartCouncilRuntime,
    generateManualTurn,
    injectConductorMessage,
    leaveSafely,
    openAutopilotLimitModal,
    pauseCouncilRuntime,
    startCouncilRuntime,
    submitAutopilotLimitModal,
  };
};
