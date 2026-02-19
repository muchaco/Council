import type { CouncilMode } from "./ipc/dto.js";

export type CouncilViewRuntimeControls = {
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  showTopBarStart: boolean;
  showEmptyStateStart: boolean;
};

export const resolveCouncilViewRuntimeControls = (params: {
  mode: CouncilMode;
  started: boolean;
  paused: boolean;
  archived: boolean;
  messageCount: number;
}): CouncilViewRuntimeControls => {
  const canStart = !params.started && !params.archived;
  const canPause = params.mode === "autopilot" && params.started && !params.paused;
  const canResume = params.mode === "autopilot" && params.started && params.paused;
  const showEmptyStateStart = params.mode === "autopilot" && canStart && params.messageCount === 0;

  return {
    canStart,
    canPause,
    canResume,
    showTopBarStart: canStart && params.mode !== "autopilot",
    showEmptyStateStart,
  };
};
