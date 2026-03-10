import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import type { CouncilRuntimeErrorDto } from "../../../shared/council-runtime-error-normalization.js";
import {
  buildAutopilotRecoveryNotice,
  buildManualRetryNotice,
} from "../../../shared/council-view-autopilot-recovery";
import { resolveCouncilViewRuntimeControls } from "../../../shared/council-view-runtime-controls.js";
import {
  resolveThinkingPlaceholderSpeakerId,
  shouldRenderInlineThinkingCancel,
} from "../../../shared/council-view-transcript.js";
import type { CouncilDto, GetCouncilViewResponse } from "../../../shared/ipc/dto";

type CouncilViewScreenDerivedStateParams = {
  autopilotLimitAction: AutopilotLimitModalAction | null;
  availableAgents: GetCouncilViewResponse["availableAgents"];
  council: CouncilDto;
  generation: GetCouncilViewResponse["generation"];
  isConfigEditing: boolean;
  isGeneratingManualTurn: boolean;
  isResuming: boolean;
  isStarting: boolean;
  memberPalette: ReadonlyArray<string>;
  messages: GetCouncilViewResponse["messages"];
  pendingManualMemberAgentId: string | null;
  runtimeError: CouncilRuntimeErrorDto | null;
};

export const deriveCouncilViewScreenState = ({
  autopilotLimitAction,
  availableAgents,
  council,
  generation,
  isConfigEditing,
  isGeneratingManualTurn,
  isResuming,
  isStarting,
  memberPalette,
  messages,
  pendingManualMemberAgentId,
  runtimeError,
}: CouncilViewScreenDerivedStateParams) => {
  const availableAgentById = new Map(availableAgents.map((agent) => [agent.id, agent]));
  const memberNameById = new Map(availableAgents.map((agent) => [agent.id, agent.name]));
  const archivedMemberIds = council.memberAgentIds.filter(
    (memberAgentId) => availableAgentById.get(memberAgentId)?.archived === true,
  );
  const archivedMemberNames = archivedMemberIds.map(
    (memberAgentId) => memberNameById.get(memberAgentId) ?? memberAgentId,
  );
  const hasArchivedMembers = archivedMemberIds.length > 0;
  const runtimeControls = resolveCouncilViewRuntimeControls({
    mode: council.mode,
    started: council.started,
    paused: council.paused,
    archived: council.archived,
    messageCount: messages.length,
  });
  const generationRunning = generation.status === "running";
  const generationActive = generationRunning || isGeneratingManualTurn;
  const manualSpeakerDisabledReason = council.archived
    ? "Archived councils are read-only."
    : hasArchivedMembers
      ? "Restore or remove archived members before selecting the next speaker."
      : !council.started
        ? "Start the council before selecting the next speaker."
        : generationRunning || isGeneratingManualTurn
          ? "Wait for the current generation to finish."
          : null;
  const pausedNextSpeakerId =
    council.mode === "autopilot" && council.paused ? generation.plannedNextSpeakerAgentId : null;
  const pausedNextSpeakerName =
    pausedNextSpeakerId === null
      ? null
      : (memberNameById.get(pausedNextSpeakerId) ?? pausedNextSpeakerId);
  const thinkingSpeakerId = resolveThinkingPlaceholderSpeakerId({
    generation,
    pendingManualMemberAgentId,
  });
  const thinkingSpeakerName =
    thinkingSpeakerId === null
      ? null
      : (memberNameById.get(thinkingSpeakerId) ?? thinkingSpeakerId);
  const thinkingSpeakerColor =
    thinkingSpeakerId === null
      ? null
      : (council.memberColorsByAgentId[thinkingSpeakerId] ?? memberPalette[0] ?? "#0a5c66");
  const showInlineThinkingCancel = shouldRenderInlineThinkingCancel({
    generationActive,
    thinkingSpeakerId,
  });
  const autopilotRecoveryNotice = buildAutopilotRecoveryNotice({
    council: { mode: council.mode, started: council.started, paused: council.paused },
    runtimeError,
  });
  const manualRetryNotice = buildManualRetryNotice({
    council: { mode: council.mode },
    runtimeError,
  });
  const autopilotSubmitLabel =
    autopilotLimitAction === "start"
      ? isStarting
        ? "Starting..."
        : "Start"
      : isResuming
        ? "Resuming..."
        : "Resume";
  const startDisabled =
    isStarting ||
    council.invalidConfig ||
    hasArchivedMembers ||
    autopilotLimitAction !== null ||
    isConfigEditing;
  const startDisabledReason = council.invalidConfig
    ? "Fix the model config before starting."
    : hasArchivedMembers
      ? "Restore or remove archived members before starting."
      : undefined;
  const canEditMembers =
    !council.archived && (!council.started || council.paused || council.mode === "manual");
  const memberIdsWithMessages = new Set(
    messages
      .filter((message) => message.senderKind === "member" && message.senderAgentId !== null)
      .map((message) => message.senderAgentId as string),
  );

  return {
    archivedMemberNames,
    autopilotRecoveryNotice,
    autopilotSubmitLabel,
    canEditMembers,
    generationActive,
    generationRunning,
    hasArchivedMembers,
    manualRetryNotice,
    manualSpeakerDisabledReason,
    memberIdsWithMessages,
    memberNameById,
    pausedNextSpeakerName,
    runtimeControls,
    showInlineThinkingCancel,
    startDisabled,
    startDisabledReason,
    thinkingSpeakerColor,
    thinkingSpeakerName,
  };
};
