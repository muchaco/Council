import {
  COUNCIL_CONFIG_MAX_TAGS,
  normalizeTagsDraft,
  toModelRef,
} from "../../../shared/app-ui-helpers.js";
import type { CouncilDto } from "../../../shared/ipc/dto";
import type { CouncilConfigEditState } from "./ConfigTab";
import type { CouncilViewActionContext } from "./councilViewActionContext";

export const useCouncilViewConfigActions = ({
  councilId,
  loadCouncilView,
  onClose,
  pushToast,
  setState,
  state,
}: CouncilViewActionContext) => {
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
    deleteCouncilFromView,
    exportCouncilTranscript,
    refreshCouncilViewConfigModels,
    saveCouncilConfigEdit,
    setCouncilArchivedFromView,
  };
};
