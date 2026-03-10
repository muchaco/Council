import type { CouncilViewActionContext } from "./councilViewActionContext";
import { useCouncilViewConfigActions } from "./useCouncilViewConfigActions";
import { useCouncilViewMemberActions } from "./useCouncilViewMemberActions";
import { useCouncilViewRuntimeActions } from "./useCouncilViewRuntimeActions";

export const useCouncilViewActions = ({
  autopilotLimitAction,
  councilId,
  loadCouncilView,
  onClose,
  pushToast,
  setAutopilotLimitAction,
  setState,
  state,
}: CouncilViewActionContext) => {
  const runtimeActions = useCouncilViewRuntimeActions({
    autopilotLimitAction,
    councilId,
    loadCouncilView,
    onClose,
    pushToast,
    setAutopilotLimitAction,
    setState,
    state,
  });
  const configActions = useCouncilViewConfigActions({
    autopilotLimitAction,
    councilId,
    loadCouncilView,
    onClose,
    pushToast,
    setAutopilotLimitAction,
    setState,
    state,
  });
  const memberActions = useCouncilViewMemberActions({
    autopilotLimitAction,
    councilId,
    loadCouncilView,
    onClose,
    pushToast,
    setAutopilotLimitAction,
    setState,
    state,
  });

  return {
    ...runtimeActions,
    ...configActions,
    ...memberActions,
  };
};
