import type {
  CouncilRuntimeErrorCategory,
  CouncilRuntimeErrorDto,
} from "./council-runtime-error-normalization.js";

type CouncilRuntimeSnapshot = {
  mode: "autopilot" | "manual";
  started: boolean;
  paused: boolean;
};

export type CouncilRuntimeNotice = {
  title: string;
  body: string;
  technicalDetails: string | null;
};

const buildAutopilotGuidance = (category: CouncilRuntimeErrorCategory): string => {
  switch (category) {
    case "quotaExceeded":
      return "Check billing or switch models, then choose Resume to retry.";
    case "rateLimited":
      return "Wait a moment, then choose Resume or switch models.";
    case "authOrConfig":
      return "After fixing provider settings, choose Resume to retry.";
    case "providerUnavailable":
    case "networkOrTimeout":
      return "Try again shortly, then choose Resume.";
    case "invalidModelOrSettings":
      return "Refresh models or choose another model, then choose Resume.";
    case "generationFailed":
      return "Choose Resume to retry or try another model.";
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
};

const buildManualGuidance = (category: CouncilRuntimeErrorCategory): string => {
  switch (category) {
    case "quotaExceeded":
      return "Choose the same member or a different member to retry, or switch models.";
    case "rateLimited":
      return "Wait a moment, then choose the same member or another member to retry.";
    case "authOrConfig":
      return "After fixing provider settings, retry with the same member or a different one.";
    case "providerUnavailable":
    case "networkOrTimeout":
      return "Try again shortly, then choose the same member or a different member to retry.";
    case "invalidModelOrSettings":
      return "Refresh models or choose another one, then retry with the same member or a different one.";
    case "generationFailed":
      return "Choose the same member or a different member to retry.";
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
};

export const buildAutopilotRecoveryNotice = (params: {
  council: CouncilRuntimeSnapshot;
  runtimeError: CouncilRuntimeErrorDto | null;
}): CouncilRuntimeNotice | null => {
  if (params.council.mode !== "autopilot" || !params.council.started || !params.council.paused) {
    return null;
  }

  if (params.runtimeError === null) {
    return null;
  }

  return {
    title: "Autopilot paused",
    body: `${params.runtimeError.message} ${buildAutopilotGuidance(params.runtimeError.category)}`,
    technicalDetails: params.runtimeError.technicalDetails,
  };
};

export const buildManualRetryNotice = (params: {
  council: Pick<CouncilRuntimeSnapshot, "mode">;
  runtimeError: CouncilRuntimeErrorDto | null;
}): CouncilRuntimeNotice | null => {
  if (params.council.mode !== "manual" || params.runtimeError === null) {
    return null;
  }

  return {
    title: "Turn failed",
    body: `${params.runtimeError.message} ${buildManualGuidance(params.runtimeError.category)}`,
    technicalDetails: params.runtimeError.technicalDetails,
  };
};
