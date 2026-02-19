type CouncilRuntimeSnapshot = {
  mode: "autopilot" | "manual";
  started: boolean;
  paused: boolean;
};

export const buildAutopilotRecoveryNotice = (params: {
  council: CouncilRuntimeSnapshot;
  runtimeMessage: string;
}): string | null => {
  if (params.council.mode !== "autopilot" || !params.council.started || !params.council.paused) {
    return null;
  }

  const message = params.runtimeMessage.trim();
  if (message.length === 0) {
    return null;
  }

  return `Autopilot paused after an error: ${message} Fix model/provider settings if needed, then choose Resume to retry.`;
};
