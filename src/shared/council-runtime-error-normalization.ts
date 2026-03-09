const COUNCIL_RUNTIME_ERROR_CATEGORIES = [
  "quotaExceeded",
  "rateLimited",
  "authOrConfig",
  "providerUnavailable",
  "networkOrTimeout",
  "invalidModelOrSettings",
  "generationFailed",
] as const;

export type CouncilRuntimeErrorCategory = (typeof COUNCIL_RUNTIME_ERROR_CATEGORIES)[number];

export type CouncilRuntimeErrorDto = {
  category: CouncilRuntimeErrorCategory;
  title: string;
  message: string;
  technicalDetails: string | null;
};

const RUNTIME_ERROR_DETAIL_KEY = "runtimeError";

const includesAny = (text: string, needles: ReadonlyArray<string>): boolean =>
  needles.some((needle) => text.includes(needle));

const classifyRuntimeError = (
  text: string,
): {
  category: CouncilRuntimeErrorCategory;
  signal: string | null;
} => {
  if (
    includesAny(text, [
      "insufficient_quota",
      "quota",
      "billing",
      "credit",
      "credits",
      "payment required",
      "http 402",
    ])
  ) {
    return {
      category: "quotaExceeded",
      signal: "Quota or billing limit reached",
    };
  }

  if (includesAny(text, ["http 429", "rate limit", "too many requests", "rate_limit"])) {
    return {
      category: "rateLimited",
      signal: "HTTP 429 rate limit",
    };
  }

  if (
    includesAny(text, [
      "api key",
      "unauthorized",
      "forbidden",
      "authentication",
      "auth",
      "credential",
      "provider config not found",
      "http 401",
      "http 403",
    ])
  ) {
    return {
      category: "authOrConfig",
      signal: "Authentication or provider configuration issue",
    };
  }

  if (
    includesAny(text, [
      "model configuration is invalid",
      "invalid model",
      "model not found",
      "unsupported model",
      "no resolved model",
      "cannot generate because model configuration is invalid",
    ])
  ) {
    return {
      category: "invalidModelOrSettings",
      signal: "Model selection is unavailable for this runtime",
    };
  }

  if (
    includesAny(text, [
      "service unavailable",
      "temporarily unavailable",
      "bad gateway",
      "gateway timeout",
      "overloaded",
      "http 502",
      "http 503",
      "http 504",
    ])
  ) {
    return {
      category: "providerUnavailable",
      signal: "Provider service unavailable",
    };
  }

  if (
    includesAny(text, [
      "timeout",
      "timed out",
      "network",
      "fetch failed",
      "econn",
      "enotfound",
      "socket",
      "connection reset",
      "dns",
    ])
  ) {
    return {
      category: "networkOrTimeout",
      signal: "Network or timeout failure",
    };
  }

  return {
    category: "generationFailed",
    signal: null,
  };
};

const toRuntimeTitle = (category: CouncilRuntimeErrorCategory): string => {
  switch (category) {
    case "quotaExceeded":
      return "Provider limit reached";
    case "rateLimited":
      return "Provider is rate limiting requests";
    case "authOrConfig":
      return "Check provider settings";
    case "providerUnavailable":
      return "Provider is unavailable";
    case "networkOrTimeout":
      return "Connection to provider failed";
    case "invalidModelOrSettings":
      return "Model settings need attention";
    case "generationFailed":
      return "Generation failed";
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
};

const toRuntimeMessage = (category: CouncilRuntimeErrorCategory): string => {
  switch (category) {
    case "quotaExceeded":
      return "This provider hit its quota. Try another model or check billing before retrying.";
    case "rateLimited":
      return "This provider is busy right now. Wait a moment, then try again or switch models.";
    case "authOrConfig":
      return "This model could not authenticate. Check provider settings or choose another model.";
    case "providerUnavailable":
      return "The provider is unavailable right now. Try again shortly or switch models.";
    case "networkOrTimeout":
      return "The request did not complete. Check connectivity, then try again.";
    case "invalidModelOrSettings":
      return "This council cannot use the selected model right now. Refresh models or choose another one.";
    case "generationFailed":
      return "The model could not generate a response. Try again or choose another model.";
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
};

const buildTechnicalDetails = (params: {
  providerId?: string | null;
  modelId?: string | null;
  signal: string | null;
}): string | null => {
  const lines = [
    params.providerId === undefined || params.providerId === null
      ? null
      : `Provider: ${params.providerId}`,
    params.modelId === undefined || params.modelId === null ? null : `Model: ${params.modelId}`,
    params.signal === null ? null : `Signal: ${params.signal}`,
  ].filter((line): line is string => line !== null);

  return lines.length === 0 ? null : lines.join("\n");
};

export const normalizeCouncilRuntimeError = (params: {
  message: string;
  providerId?: string | null;
  modelId?: string | null;
}): CouncilRuntimeErrorDto => {
  const normalizedMessage = params.message.trim().toLowerCase();
  const classification = classifyRuntimeError(normalizedMessage);

  return {
    category: classification.category,
    title: toRuntimeTitle(classification.category),
    message: toRuntimeMessage(classification.category),
    technicalDetails: buildTechnicalDetails({
      providerId: params.providerId,
      modelId: params.modelId,
      signal: classification.signal,
    }),
  };
};

export const toCouncilRuntimeErrorDetails = (
  runtimeError: CouncilRuntimeErrorDto,
): Record<string, unknown> => ({
  [RUNTIME_ERROR_DETAIL_KEY]: runtimeError,
});

export const readCouncilRuntimeErrorDetails = (
  details: Record<string, unknown> | undefined,
): CouncilRuntimeErrorDto | null => {
  if (details === undefined) {
    return null;
  }

  const candidate = details[RUNTIME_ERROR_DETAIL_KEY];
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }

  const category = "category" in candidate ? candidate.category : undefined;
  const title = "title" in candidate ? candidate.title : undefined;
  const message = "message" in candidate ? candidate.message : undefined;
  const technicalDetails = "technicalDetails" in candidate ? candidate.technicalDetails : undefined;

  if (
    !COUNCIL_RUNTIME_ERROR_CATEGORIES.includes(category as CouncilRuntimeErrorCategory) ||
    typeof title !== "string" ||
    typeof message !== "string" ||
    (technicalDetails !== null && typeof technicalDetails !== "string")
  ) {
    return null;
  }

  return {
    category: category as CouncilRuntimeErrorCategory,
    title,
    message,
    technicalDetails,
  };
};
