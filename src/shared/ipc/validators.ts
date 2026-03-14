import { z } from "zod";
import { sanitizeAssistantContext, sanitizeAssistantText } from "../assistant/assistant-audit.js";
import {
  ASSISTANT_CONFIRMATION_REQUEST_SCHEMA,
  ASSISTANT_PLANNED_TOOL_CALL_SCHEMA,
  ASSISTANT_TOOL_EXECUTION_ERROR_SCHEMA,
  ASSISTANT_TOOL_EXECUTION_RESULT_SCHEMA,
} from "../assistant/assistant-tool-schemas.js";
import {
  AGENT_ARCHIVED_FILTERS,
  AGENT_SORT_FIELDS,
  COUNCIL_ARCHIVED_FILTERS,
  COUNCIL_MODES,
  COUNCIL_SORT_FIELDS,
  PROVIDER_IDS,
  SORT_DIRECTIONS,
  VIEW_KINDS,
} from "./dto.js";

export const HEALTH_PING_REQUEST_SCHEMA = z.object({
  message: z.string().min(1).max(200),
});

const MODEL_REF_SCHEMA = z.object({
  providerId: z.string().min(1).max(64),
  modelId: z.string().min(1).max(200),
});

const PROVIDER_ID_SCHEMA = z.enum(PROVIDER_IDS);
const VIEW_KIND_SCHEMA = z.enum(VIEW_KINDS);

export const GET_SETTINGS_VIEW_REQUEST_SCHEMA = z.object({
  viewKind: VIEW_KIND_SCHEMA,
});

export const PROVIDER_DRAFT_SCHEMA = z
  .object({
    providerId: PROVIDER_ID_SCHEMA,
    endpointUrl: z.string().url().max(500).nullable(),
    apiKey: z.string().min(1).max(500).nullable(),
  })
  .strict();

export const TEST_PROVIDER_CONNECTION_REQUEST_SCHEMA = z
  .object({
    provider: PROVIDER_DRAFT_SCHEMA,
  })
  .strict();

export const SAVE_PROVIDER_CONFIG_REQUEST_SCHEMA = z
  .object({
    provider: PROVIDER_DRAFT_SCHEMA,
    testToken: z.string().min(1).max(200),
  })
  .strict();

export const DISCONNECT_PROVIDER_REQUEST_SCHEMA = z
  .object({
    providerId: PROVIDER_ID_SCHEMA,
    viewKind: VIEW_KIND_SCHEMA,
  })
  .strict();

export const REFRESH_MODEL_CATALOG_REQUEST_SCHEMA = z.object({
  viewKind: VIEW_KIND_SCHEMA,
});

export const SET_GLOBAL_DEFAULT_MODEL_REQUEST_SCHEMA = z.object({
  viewKind: VIEW_KIND_SCHEMA,
  modelRefOrNull: MODEL_REF_SCHEMA.nullable(),
});

export const SET_CONTEXT_LAST_N_REQUEST_SCHEMA = z.object({
  viewKind: VIEW_KIND_SCHEMA,
  contextLastN: z.number().int().min(1).max(200),
});

const SORT_DIRECTION_SCHEMA = z.enum(SORT_DIRECTIONS);
const AGENT_SORT_FIELD_SCHEMA = z.enum(AGENT_SORT_FIELDS);
const AGENT_ARCHIVED_FILTER_SCHEMA = z.enum(AGENT_ARCHIVED_FILTERS);
const COUNCIL_SORT_FIELD_SCHEMA = z.enum(COUNCIL_SORT_FIELDS);
const COUNCIL_MODE_SCHEMA = z.enum(COUNCIL_MODES);
const COUNCIL_ARCHIVED_FILTER_SCHEMA = z.enum(COUNCIL_ARCHIVED_FILTERS);

export const LIST_AGENTS_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("agentsList"),
  searchText: z.string().max(200),
  tagFilter: z.string().max(200),
  archivedFilter: AGENT_ARCHIVED_FILTER_SCHEMA,
  sortBy: AGENT_SORT_FIELD_SCHEMA,
  sortDirection: SORT_DIRECTION_SCHEMA,
  page: z.number().int().min(1).max(200),
});

export const GET_AGENT_EDITOR_VIEW_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("agentEdit"),
  agentId: z.string().uuid().nullable(),
});

export const SAVE_AGENT_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("agentEdit"),
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  systemPrompt: z.string().trim().min(1).max(10_000),
  verbosity: z.string().trim().max(200).nullable(),
  temperature: z.number().min(0).max(2).nullable(),
  tags: z.array(z.string().trim().min(1).max(20)).max(3),
  modelRefOrNull: MODEL_REF_SCHEMA.nullable(),
});

export const DELETE_AGENT_REQUEST_SCHEMA = z.object({
  id: z.string().uuid(),
});

export const SET_AGENT_ARCHIVED_REQUEST_SCHEMA = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
});

export const LIST_COUNCILS_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("councilsList"),
  searchText: z.string().max(200),
  tagFilter: z.string().max(200),
  archivedFilter: COUNCIL_ARCHIVED_FILTER_SCHEMA,
  sortBy: COUNCIL_SORT_FIELD_SCHEMA,
  sortDirection: SORT_DIRECTION_SCHEMA,
  page: z.number().int().min(1).max(200),
});

export const GET_COUNCIL_EDITOR_VIEW_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("councilCreate"),
  councilId: z.string().uuid().nullable(),
});

export const GET_COUNCIL_VIEW_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("councilView"),
  councilId: z.string().uuid(),
  leaseEpoch: z.number().int().min(0).max(2_147_483_647).optional(),
});

export const SAVE_COUNCIL_REQUEST_SCHEMA = z.object({
  viewKind: z.union([z.literal("councilCreate"), z.literal("councilView")]),
  id: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(10_000),
  goal: z.string().trim().max(5_000).nullable(),
  mode: COUNCIL_MODE_SCHEMA,
  tags: z.array(z.string().trim().min(1).max(20)).max(3),
  memberAgentIds: z.array(z.string().uuid()).min(1).max(20),
  memberColorsByAgentId: z.record(z.string().uuid(), z.string().trim().max(40)),
  conductorModelRefOrNull: MODEL_REF_SCHEMA.nullable(),
});

export const DELETE_COUNCIL_REQUEST_SCHEMA = z.object({
  id: z.string().uuid(),
});

export const SET_COUNCIL_ARCHIVED_REQUEST_SCHEMA = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
});

export const START_COUNCIL_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("councilView"),
  id: z.string().uuid(),
  maxTurns: z.number().int().min(1).max(200).nullable(),
});

export const PAUSE_COUNCIL_AUTOPILOT_REQUEST_SCHEMA = z.object({
  id: z.string().uuid(),
});

export const RESUME_COUNCIL_AUTOPILOT_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("councilView"),
  id: z.string().uuid(),
  maxTurns: z.number().int().min(1).max(200).nullable(),
});

export const GENERATE_MANUAL_COUNCIL_TURN_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("councilView"),
  id: z.string().uuid(),
  memberAgentId: z.string().uuid(),
});

export const INJECT_CONDUCTOR_MESSAGE_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("councilView"),
  id: z.string().uuid(),
  content: z.string().trim().min(1).max(20_000),
});

export const ADVANCE_AUTOPILOT_TURN_REQUEST_SCHEMA = z.object({
  viewKind: z.literal("councilView"),
  id: z.string().uuid(),
});

export const CANCEL_COUNCIL_GENERATION_REQUEST_SCHEMA = z.object({
  id: z.string().uuid(),
});

export const EXPORT_COUNCIL_TRANSCRIPT_REQUEST_SCHEMA = z.object({
  viewKind: z.union([z.literal("councilsList"), z.literal("councilView")]),
  id: z.string().uuid(),
});

const ASSISTANT_LIST_STATE_SCHEMA = z
  .object({
    searchText: z.string().max(200),
    tagFilter: z.string().max(200),
    sortBy: z.string().trim().max(100).nullable(),
    sortDirection: SORT_DIRECTION_SCHEMA.nullable(),
    archivedFilter: z.string().trim().max(100).nullable(),
  })
  .strict();

const ASSISTANT_DRAFT_STATE_SCHEMA = z
  .object({
    entityKind: z.enum(["agent", "council", "settings"]),
    entityId: z.string().uuid().nullable(),
    dirty: z.boolean(),
    changedFields: z.array(z.string().trim().min(1).max(100)).max(50),
    summary: z.string().trim().max(500),
  })
  .strict();

const ASSISTANT_AGENT_DRAFT_EXECUTION_SNAPSHOT_SCHEMA = z
  .object({
    id: z.string().uuid().nullable(),
    modelSelection: z.string().max(300),
    name: z.string().max(120),
    systemPrompt: z.string().max(10_000),
    tagsInput: z.string().max(500),
    temperature: z.string().max(50),
    verbosity: z.string().max(200),
  })
  .strict();

const ASSISTANT_COUNCIL_DRAFT_EXECUTION_SNAPSHOT_SCHEMA = z
  .object({
    conductorModelSelection: z.string().max(300),
    goal: z.string().max(5_000),
    id: z.string().uuid().nullable(),
    mode: z.enum(["autopilot", "manual"]),
    selectedMemberIds: z.array(z.string().uuid()).max(20),
    tagsInput: z.string().max(500),
    title: z.string().max(200),
    topic: z.string().max(10_000),
  })
  .strict();

const ASSISTANT_EXECUTION_SNAPSHOT_SCHEMA = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("agent"),
        draft: ASSISTANT_AGENT_DRAFT_EXECUTION_SNAPSHOT_SCHEMA,
      })
      .strict(),
    z
      .object({
        kind: z.literal("council"),
        draft: ASSISTANT_COUNCIL_DRAFT_EXECUTION_SNAPSHOT_SCHEMA,
      })
      .strict(),
  ])
  .nullable();

const ASSISTANT_RUNTIME_STATE_SCHEMA = z
  .object({
    leaseId: z.string().uuid(),
    councilId: z.string().uuid(),
    leaseEpoch: z.number().int().min(0).max(2_147_483_647).optional(),
    status: z.enum(["idle", "running", "paused"]),
    plannedNextSpeakerAgentId: z.string().uuid().nullable(),
  })
  .strict();

export const ASSISTANT_CONTEXT_ENVELOPE_SCHEMA = z
  .object({
    viewKind: VIEW_KIND_SCHEMA,
    contextLabel: z.string().trim().min(1).max(200),
    activeEntityId: z.string().uuid().nullable(),
    selectionIds: z.array(z.string().uuid()).max(50),
    listState: ASSISTANT_LIST_STATE_SCHEMA.nullable(),
    draftState: ASSISTANT_DRAFT_STATE_SCHEMA.nullable(),
    runtimeState: ASSISTANT_RUNTIME_STATE_SCHEMA.nullable(),
  })
  .strict()
  .transform((context) => sanitizeAssistantContext(context));

const ASSISTANT_USER_TURN_RESPONSE_SCHEMA = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("clarification"),
      text: z
        .string()
        .trim()
        .min(1)
        .max(2_000)
        .transform((value) => sanitizeAssistantText(value)),
    })
    .strict(),
  z
    .object({
      kind: z.literal("confirmation"),
      approved: z.boolean(),
      confirmationToken: z.string().uuid(),
    })
    .strict(),
]);

export const ASSISTANT_CREATE_SESSION_REQUEST_SCHEMA = z
  .object({
    viewKind: VIEW_KIND_SCHEMA,
  })
  .strict();

export const ASSISTANT_SUBMIT_REQUEST_SCHEMA = z
  .object({
    sessionId: z.string().uuid(),
    userRequest: z
      .string()
      .trim()
      .min(1)
      .max(5_000)
      .transform((value) => sanitizeAssistantText(value)),
    context: ASSISTANT_CONTEXT_ENVELOPE_SCHEMA,
    executionSnapshot: ASSISTANT_EXECUTION_SNAPSHOT_SCHEMA.optional(),
    response: ASSISTANT_USER_TURN_RESPONSE_SCHEMA.nullable(),
  })
  .strict();

export const ASSISTANT_CANCEL_SESSION_REQUEST_SCHEMA = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const ASSISTANT_CLOSE_SESSION_REQUEST_SCHEMA = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const ASSISTANT_COMPLETE_RECONCILIATION_REQUEST_SCHEMA = z
  .object({
    sessionId: z.string().uuid(),
    reconciliations: z
      .array(
        z
          .object({
            callId: z.string().trim().min(1).max(200),
            toolName: z.string().trim().min(1).max(200),
            status: z.enum(["completed", "failed"]),
            failureMessage: z.string().trim().min(1).max(500).nullable(),
            completion: z
              .object({
                output: z.record(z.unknown()).nullable(),
                userSummary: z.string().trim().min(1).max(500).nullable(),
              })
              .strict()
              .nullable(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const ASSISTANT_PLAN_RESULT_SCHEMA = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("clarify"),
      sessionId: z.string().uuid(),
      message: z.string().trim().min(1).max(500),
      planSummary: z.null(),
      plannedCalls: z.array(ASSISTANT_PLANNED_TOOL_CALL_SCHEMA).max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal("confirm"),
      sessionId: z.string().uuid(),
      message: z.string().trim().min(1).max(500),
      planSummary: z.string().trim().min(1).max(500),
      confirmationToken: z.string().uuid(),
      plannedCalls: z.array(ASSISTANT_PLANNED_TOOL_CALL_SCHEMA).max(20),
      confirmation: ASSISTANT_CONFIRMATION_REQUEST_SCHEMA,
    })
    .strict(),
  z
    .object({
      kind: z.literal("execute"),
      sessionId: z.string().uuid(),
      message: z.string().trim().min(1).max(500),
      planSummary: z.string().trim().min(1).max(500),
      plannedCalls: z.array(ASSISTANT_PLANNED_TOOL_CALL_SCHEMA).max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal("result"),
      sessionId: z.string().uuid(),
      outcome: z.enum(["success", "partial", "failure", "cancelled"]),
      message: z.string().trim().min(1).max(500),
      planSummary: z.string().trim().min(1).max(500).nullable(),
      plannedCalls: z.array(ASSISTANT_PLANNED_TOOL_CALL_SCHEMA).max(20),
      executionResults: z.array(ASSISTANT_TOOL_EXECUTION_RESULT_SCHEMA).max(20),
      error: ASSISTANT_TOOL_EXECUTION_ERROR_SCHEMA.nullable(),
      requiresUserAction: z.boolean(),
      destinationLabel: z.string().trim().max(200).nullable(),
    })
    .strict(),
]);
