export const COUNCIL_VIEW_EXIT_CONFIRMATION_MESSAGE =
  "Leaving will pause the Council and cancel generation. Continue?";

export type CouncilViewExitPlan = {
  requiresConfirmation: boolean;
  shouldPauseAutopilot: boolean;
  shouldCancelGeneration: boolean;
};

type CouncilRuntimeSnapshot = {
  mode: "autopilot" | "manual";
  started: boolean;
  paused: boolean;
};

type GenerationRuntimeSnapshot = {
  status: "idle" | "running";
};

export const buildCouncilViewExitPlan = (
  council: CouncilRuntimeSnapshot,
  generation: GenerationRuntimeSnapshot,
): CouncilViewExitPlan => {
  const shouldPauseAutopilot = council.mode === "autopilot" && council.started && !council.paused;
  const shouldCancelGeneration = generation.status === "running";

  return {
    requiresConfirmation: shouldPauseAutopilot || shouldCancelGeneration,
    shouldPauseAutopilot,
    shouldCancelGeneration,
  };
};
