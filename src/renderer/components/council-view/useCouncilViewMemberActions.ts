import type { CouncilViewActionContext } from "./councilViewActionContext";
import { MEMBER_COLOR_PALETTE } from "./councilViewScreenState";

export const useCouncilViewMemberActions = ({
  councilId,
  loadCouncilView,
  pushToast,
  setState,
  state,
}: CouncilViewActionContext) => {
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

  return {
    addCouncilViewMember,
    saveCouncilViewMembers,
    setCouncilViewMemberColor,
  };
};
