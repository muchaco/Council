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

export const buildManualRetryNotice = (params: {
  council: Pick<CouncilRuntimeSnapshot, "mode">;
  runtimeMessage: string | null;
}): string | null => {
  if (params.council.mode !== "manual" || params.runtimeMessage === null) {
    return null;
  }

  const message = params.runtimeMessage.trim();
  if (message.length === 0) {
    return null;
  }

  return `${message} Choose the same member or a different member to retry.`;
};
