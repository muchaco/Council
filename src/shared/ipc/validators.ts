import { z } from "zod";
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
