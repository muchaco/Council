import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { CouncilRuntimeErrorDto } from "../../../shared/council-runtime-error-normalization.js";
import { readCouncilRuntimeErrorDetails } from "../../../shared/council-runtime-error-normalization.js";
import type { CouncilViewState, CouncilViewTab } from "./councilViewScreenState";
import { createReadyCouncilViewState } from "./councilViewScreenState";

type UseCouncilViewScreenLifecycleParams = {
  assistantReloadToken: number;
  councilId: string;
  isActive: boolean;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
  setState: Dispatch<SetStateAction<CouncilViewState>>;
  state: CouncilViewState;
};

export type LoadCouncilView = (
  nextCouncilId: string,
  options?: {
    preserveActiveTab?: CouncilViewTab;
    runtimeError?: CouncilRuntimeErrorDto | null;
  },
) => Promise<void>;

export const useCouncilViewScreenLifecycle = ({
  assistantReloadToken,
  councilId,
  isActive,
  pushToast,
  setState,
  state,
}: UseCouncilViewScreenLifecycleParams) => {
  const loadCouncilView = useCallback<LoadCouncilView>(
    async (nextCouncilId, options) => {
      setState({ status: "loading" });
      const result = await window.api.councils.getCouncilView({
        viewKind: "councilView",
        councilId: nextCouncilId,
        leaseEpoch: assistantReloadToken,
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
    [assistantReloadToken, pushToast, setState],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    if (!Number.isInteger(assistantReloadToken)) {
      return;
    }
    void loadCouncilView(councilId);
  }, [assistantReloadToken, councilId, isActive, loadCouncilView]);

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

  return { loadCouncilView };
};
