import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import { buildCouncilViewExitPlan } from "../../../shared/council-view-runtime-guards";
import type { CouncilViewState } from "./councilViewScreenState";

type UseCouncilViewDialogHandlersParams = {
  executeLeave: (params: {
    exitPlan: ReturnType<typeof buildCouncilViewExitPlan>;
  }) => Promise<void>;
  saveCouncilViewMembers: (params: {
    memberAgentIds: ReadonlyArray<string>;
    memberColorsByAgentId: Readonly<Record<string, string>>;
    successMessage: string;
  }) => Promise<void>;
  setAutopilotLimitAction: Dispatch<SetStateAction<AutopilotLimitModalAction | null>>;
  setState: Dispatch<SetStateAction<CouncilViewState>>;
  state: CouncilViewState;
  submitAutopilotLimitModal: (maxTurns: number | null) => Promise<void>;
};

export const useCouncilViewDialogHandlers = ({
  executeLeave,
  saveCouncilViewMembers,
  setAutopilotLimitAction,
  setState,
  state,
  submitAutopilotLimitModal,
}: UseCouncilViewDialogHandlersParams) => {
  const onCancelLeave = useCallback(() => {
    setState((current) =>
      current.status !== "ready" ? current : { ...current, showLeaveDialog: false },
    );
  }, [setState]);

  const onCancelMemberRemove = useCallback(() => {
    setState((current) =>
      current.status !== "ready"
        ? current
        : { ...current, pendingMemberRemovalId: null, showMemberRemoveDialog: false },
    );
  }, [setState]);

  const onCloseAutopilotDialog = useCallback(() => {
    setAutopilotLimitAction(null);
  }, [setAutopilotLimitAction]);

  const onConfirmLeave = useCallback(() => {
    if (state.status !== "ready") {
      return;
    }
    const exitPlan = buildCouncilViewExitPlan(state.source.council, state.source.generation);
    void executeLeave({ exitPlan });
  }, [executeLeave, state]);

  const onConfirmMemberRemove = useCallback(() => {
    if (state.status !== "ready" || state.pendingMemberRemovalId === null) {
      return;
    }
    const memberId = state.pendingMemberRemovalId;
    const nextMemberIds = state.source.council.memberAgentIds.filter((id) => id !== memberId);
    const nextColors = { ...state.source.council.memberColorsByAgentId };
    delete nextColors[memberId];
    void saveCouncilViewMembers({
      memberAgentIds: nextMemberIds,
      memberColorsByAgentId: nextColors,
      successMessage: "Member removed.",
    });
  }, [saveCouncilViewMembers, state]);

  const onSubmitAutopilotDialog = useCallback(
    (maxTurns: number | null) => {
      void submitAutopilotLimitModal(maxTurns);
    },
    [submitAutopilotLimitModal],
  );

  const onRequestRemoveMember = useCallback(
    (memberAgentId: string) => {
      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              pendingMemberRemovalId: memberAgentId,
              showMemberRemoveDialog: true,
            },
      );
    },
    [setState],
  );

  const onSelectTab = useCallback(
    (activeTab: "overview" | "config") => {
      setState((current) => (current.status !== "ready" ? current : { ...current, activeTab }));
    },
    [setState],
  );

  const onConfigEditingChange = useCallback(
    (isConfigEditing: boolean) => {
      setState((current) =>
        current.status !== "ready" ? current : { ...current, isConfigEditing },
      );
    },
    [setState],
  );

  return {
    onCancelLeave,
    onCancelMemberRemove,
    onCloseAutopilotDialog,
    onConfigEditingChange,
    onConfirmLeave,
    onConfirmMemberRemove,
    onRequestRemoveMember,
    onSelectTab,
    onSubmitAutopilotDialog,
  };
};
