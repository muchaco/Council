import type { ModelRef } from "./domain/model-ref.js";
import { type Tag, addTag } from "./domain/tag.js";
import type {
  AgentArchivedFilter,
  AgentDto,
  CouncilDto,
  GetAgentEditorViewResponse,
  GetCouncilEditorViewResponse,
} from "./ipc/dto.js";

export type AutopilotLimitModalAction = "start" | "resume";

export type ToastLevel = "info" | "warning" | "error";

export type ToastState = {
  id: string;
  level: ToastLevel;
  message: string;
};

export type ToastVariant = "default" | "warning" | "error";

export type AutopilotLimitModalState = {
  action: AutopilotLimitModalAction;
  limitTurns: boolean;
  maxTurnsInput: string;
  validationMessage: string;
};

export const AUTOPILOT_MAX_TURNS_MIN = 1;
export const AUTOPILOT_MAX_TURNS_MAX = 200;
export const AUTOPILOT_DEFAULT_MAX_TURNS = "12";
export const COUNCIL_CONFIG_MAX_TAGS = 3;

export const toModelSelectionValue = (modelRefOrNull: ModelRef | null): string =>
  modelRefOrNull === null ? "" : `${modelRefOrNull.providerId}:${modelRefOrNull.modelId}`;

export const toModelRef = (selection: string): ModelRef | null => {
  if (selection.length === 0) {
    return null;
  }

  const [providerId, ...modelIdParts] = selection.split(":");
  const modelId = modelIdParts.join(":");
  if (!providerId || modelId.length === 0) {
    return null;
  }

  return {
    providerId,
    modelId,
  };
};

export const createAutopilotLimitModalState = (
  action: AutopilotLimitModalAction,
): AutopilotLimitModalState => ({
  action,
  limitTurns: false,
  maxTurnsInput: AUTOPILOT_DEFAULT_MAX_TURNS,
  validationMessage: "",
});

export const resolveAutopilotMaxTurns = (
  modalState: AutopilotLimitModalState,
):
  | {
      ok: true;
      maxTurns: number | null;
    }
  | {
      ok: false;
      validationMessage: string;
    } => {
  if (!modalState.limitTurns) {
    return {
      ok: true,
      maxTurns: null,
    };
  }

  const parsed = Number.parseInt(modalState.maxTurnsInput.trim(), 10);
  if (!Number.isInteger(parsed)) {
    return {
      ok: false,
      validationMessage: "Enter a whole number between 1 and 200.",
    };
  }

  if (parsed < AUTOPILOT_MAX_TURNS_MIN || parsed > AUTOPILOT_MAX_TURNS_MAX) {
    return {
      ok: false,
      validationMessage: "Turn limit must be between 1 and 200.",
    };
  }

  return {
    ok: true,
    maxTurns: parsed,
  };
};

export const modelLabel = (agent: AgentDto, globalDefaultModelRef: ModelRef | null): string => {
  if (agent.modelRefOrNull !== null) {
    return `${agent.modelRefOrNull.providerId}:${agent.modelRefOrNull.modelId}`;
  }

  if (globalDefaultModelRef !== null) {
    return `Global default (${globalDefaultModelRef.providerId}:${globalDefaultModelRef.modelId})`;
  }

  return "Global default (unselected)";
};

export const applyAgentArchivedListUpdate = (params: {
  agents: ReadonlyArray<AgentDto>;
  agentId: string;
  archived: boolean;
  archivedFilter: AgentArchivedFilter;
}): ReadonlyArray<AgentDto> => {
  return params.agents.flatMap((agent) => {
    if (agent.id !== params.agentId) {
      return [agent];
    }

    if (params.archivedFilter === "active" && params.archived) {
      return [];
    }

    if (params.archivedFilter === "archived" && !params.archived) {
      return [];
    }

    return [{ ...agent, archived: params.archived } satisfies AgentDto];
  });
};

export const councilModelLabel = (
  council: CouncilDto,
  globalDefaultModelRef: ModelRef | null,
): string => {
  if (council.conductorModelRefOrNull !== null) {
    return `${council.conductorModelRefOrNull.providerId}:${council.conductorModelRefOrNull.modelId}`;
  }

  if (globalDefaultModelRef !== null) {
    return `Global default (${globalDefaultModelRef.providerId}:${globalDefaultModelRef.modelId})`;
  }

  return "Global default (unselected)";
};

export const isAgentDraftInvalidConfig = (params: {
  modelSelection: string;
  modelCatalog: GetAgentEditorViewResponse["modelCatalog"];
  globalDefaultModelRef: ModelRef | null;
}): boolean => {
  const selected = toModelRef(params.modelSelection);
  const resolved = selected ?? params.globalDefaultModelRef;
  if (resolved === null) {
    return true;
  }

  const models = params.modelCatalog.modelsByProvider[resolved.providerId] ?? [];
  return !models.includes(resolved.modelId);
};

export const isCouncilDraftInvalidConfig = (params: {
  conductorModelSelection: string;
  modelCatalog: GetCouncilEditorViewResponse["modelCatalog"];
  globalDefaultModelRef: ModelRef | null;
}): boolean => {
  const selected = toModelRef(params.conductorModelSelection);
  const resolved = selected ?? params.globalDefaultModelRef;
  if (resolved === null) {
    return true;
  }

  const models = params.modelCatalog.modelsByProvider[resolved.providerId] ?? [];
  return !models.includes(resolved.modelId);
};

export const isModelSelectionInCatalog = (params: {
  modelSelection: string;
  modelCatalog: { modelsByProvider: Record<string, ReadonlyArray<string>> };
}): boolean => {
  const selected = toModelRef(params.modelSelection);
  if (selected === null) {
    return true;
  }

  const models = params.modelCatalog.modelsByProvider[selected.providerId] ?? [];
  return models.includes(selected.modelId);
};

export const upsertToast = (params: {
  toasts: ReadonlyArray<ToastState>;
  level: ToastLevel;
  message: string;
  id: string;
  maxToasts: number;
}): ReadonlyArray<ToastState> => {
  const normalizedMessage = params.message.trim();
  if (normalizedMessage.length === 0) {
    return params.toasts;
  }

  const withoutDuplicate = params.toasts.filter(
    (toast) => !(toast.level === params.level && toast.message === normalizedMessage),
  );
  const withInserted = [
    ...withoutDuplicate,
    {
      id: params.id,
      level: params.level,
      message: normalizedMessage,
    },
  ];

  if (withInserted.length <= params.maxToasts) {
    return withInserted;
  }

  return withInserted.slice(withInserted.length - params.maxToasts);
};

export const resolveToastVariant = (level: ToastLevel): ToastVariant => {
  switch (level) {
    case "warning":
      return "warning";
    case "error":
      return "error";
    case "info":
      return "default";
  }
};

export const parseCouncilConfigTags = (draftValue: string): ReadonlyArray<string> =>
  draftValue
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

const toTagValidationMessage = (error: string, maxTags: number): string => {
  if (error === "TagTooShort") {
    return "Each tag must contain at least 1 character.";
  }
  if (error === "TagTooLong") {
    return "Each tag must be 20 characters or fewer.";
  }
  if (error === "TagLimitExceeded") {
    return `Only ${maxTags} tags are allowed.`;
  }
  if (error === "TagDuplicate") {
    return "Tag is already added.";
  }
  return "Tag is invalid.";
};

export const normalizeTagsDraft = (params: {
  tagsInput: string;
  maxTags?: number;
}):
  | {
      ok: true;
      tags: ReadonlyArray<string>;
    }
  | {
      ok: false;
      message: string;
    } => {
  const maxTags = params.maxTags ?? COUNCIL_CONFIG_MAX_TAGS;
  let tags: ReadonlyArray<Tag> = [];
  const parts = params.tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  for (const part of parts) {
    const next = addTag(tags, part);
    if (next.isErr()) {
      return {
        ok: false,
        message: toTagValidationMessage(next.error, maxTags),
      };
    }

    if (next.value.length > maxTags) {
      return {
        ok: false,
        message: toTagValidationMessage("TagLimitExceeded", maxTags),
      };
    }

    tags = next.value;
  }

  return {
    ok: true,
    tags,
  };
};

export const appendCouncilConfigTag = (params: {
  currentTags: ReadonlyArray<string>;
  tagInput: string;
  maxTags?: number;
}):
  | {
      ok: true;
      tags: ReadonlyArray<string>;
    }
  | {
      ok: false;
      message: string;
    } => {
  const maxTags = params.maxTags ?? COUNCIL_CONFIG_MAX_TAGS;
  if (params.tagInput.trim().length === 0) {
    return {
      ok: false,
      message: "Enter a tag first.",
    };
  }

  if (params.tagInput.includes(",")) {
    return {
      ok: false,
      message: "Add one tag at a time.",
    };
  }

  let existingTags: ReadonlyArray<Tag> = [];
  for (const currentTag of params.currentTags) {
    const nextExisting = addTag(existingTags, currentTag);
    if (nextExisting.isErr()) {
      return {
        ok: false,
        message: toTagValidationMessage(nextExisting.error, maxTags),
      };
    }

    existingTags = nextExisting.value;
  }

  const next = addTag(existingTags, params.tagInput);
  if (next.isErr()) {
    return {
      ok: false,
      message: toTagValidationMessage(next.error, maxTags),
    };
  }

  if (next.value.length > maxTags) {
    return {
      ok: false,
      message: toTagValidationMessage("TagLimitExceeded", maxTags),
    };
  }

  return {
    ok: true,
    tags: next.value,
  };
};

export const resolveConfirmDialogKeyboardAction = (key: string): "confirm" | "cancel" | "none" => {
  if (key === "Escape") {
    return "cancel";
  }
  if (key === "Enter") {
    return "confirm";
  }
  return "none";
};

export const resolveDisclosureKeyboardAction = (
  key: string,
): "close" | "openFirstItem" | "openLastItem" | "none" => {
  if (key === "Escape") {
    return "close";
  }
  if (key === "Enter" || key === " " || key === "ArrowDown") {
    return "openFirstItem";
  }
  if (key === "ArrowUp") {
    return "openLastItem";
  }
  return "none";
};

export const buildInvalidConfigBadgeAriaLabel = (subject: string): string =>
  `${subject} has invalid configuration`;

export const buildProviderConfiguredBadgeAriaLabel = (params: {
  providerLabel: string;
  configured: boolean;
}): string =>
  params.configured
    ? `${params.providerLabel} is configured`
    : `${params.providerLabel} is not configured`;

export const buildProviderConnectionTestButtonAriaLabel = (params: {
  providerLabel: string;
  connectionTestAllowed: boolean;
  requiresDisconnect?: boolean;
}): string =>
  params.connectionTestAllowed
    ? `Test ${params.providerLabel} connection`
    : params.requiresDisconnect
      ? `Test ${params.providerLabel} connection disabled until the provider is disconnected`
      : `Test ${params.providerLabel} connection disabled until endpoint or API key changes`;

export const buildProviderDisconnectButtonAriaLabel = (providerLabel: string): string =>
  `Disconnect ${providerLabel} provider`;
