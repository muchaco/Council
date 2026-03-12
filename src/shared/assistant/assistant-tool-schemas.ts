import { z } from "zod";

export const ASSISTANT_TOOL_CATEGORY_VALUES = [
  "read",
  "navigation",
  "draft-edit",
  "commit",
  "runtime",
  "settings",
] as const;

export const ASSISTANT_TOOL_RISK_VALUES = [
  "read",
  "write",
  "destructive",
  "bulk-destructive",
] as const;

export const ASSISTANT_CONFIRMATION_POLICY_VALUES = [
  "never",
  "always",
  "when-inferred-scope",
  "when-dirty-draft-would-be-replaced",
  "when-bulk",
] as const;

export const ASSISTANT_RECONCILIATION_VISIBLE_TARGET_VALUES = [
  "current-draft",
  "current-list",
  "detail-view",
  "runtime-view",
  "settings-view",
] as const;

export const ASSISTANT_RECONCILIATION_STRATEGY_VALUES = [
  "patch-local",
  "refresh-query",
  "reload-entity",
  "navigate-and-load",
] as const;

export const ASSISTANT_RESULT_OUTCOME_VALUES = [
  "success",
  "partial",
  "failure",
  "cancelled",
] as const;

export const ASSISTANT_TOOL_EXECUTION_STATUS_VALUES = [
  "success",
  "failed",
  "cancelled",
  "skipped",
] as const;

export const ASSISTANT_RECONCILIATION_STATE_VALUES = [
  "not-needed",
  "completed",
  "follow-up-refresh-in-progress",
] as const;

export const ASSISTANT_DRAFT_IMPACT_VALUES = [
  "none",
  "modify-current-draft",
  "replace-current-draft",
] as const;

export const ASSISTANT_TOOL_EXECUTION_ERROR_KIND_VALUES = [
  "ValidationError",
  "NotFoundError",
  "ConflictError",
  "InvalidConfigError",
  "StateViolationError",
  "ProviderError",
  "PolicyError",
  "UnknownToolError",
  "SchemaError",
  "InternalError",
] as const;

export const ASSISTANT_TOOL_RECONCILIATION_SCHEMA = z
  .object({
    visibleTarget: z.enum(ASSISTANT_RECONCILIATION_VISIBLE_TARGET_VALUES),
    strategy: z.enum(ASSISTANT_RECONCILIATION_STRATEGY_VALUES),
    successCondition: z.string().trim().min(1).max(500),
  })
  .strict();

export const ASSISTANT_PLANNED_TOOL_CALL_SCHEMA = z
  .object({
    callId: z.string().trim().min(1).max(200),
    toolName: z.string().trim().min(1).max(200),
    rationale: z.string().trim().min(1).max(500),
    input: z.record(z.unknown()),
  })
  .strict();

export const ASSISTANT_CONFIRMATION_REQUEST_SCHEMA = z
  .object({
    summary: z.string().trim().min(1).max(500),
    scopeDescription: z.string().trim().min(1).max(500),
    affectedCount: z.number().int().min(0).max(10_000).nullable(),
    examples: z.array(z.string().trim().min(1).max(200)).max(10),
    reversible: z.boolean(),
    draftImpact: z.enum(ASSISTANT_DRAFT_IMPACT_VALUES),
  })
  .strict();

export const ASSISTANT_TOOL_EXECUTION_ERROR_SCHEMA = z
  .object({
    kind: z.enum(ASSISTANT_TOOL_EXECUTION_ERROR_KIND_VALUES),
    userMessage: z.string().trim().min(1).max(500),
    developerMessage: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
    details: z.record(z.unknown()).nullable(),
  })
  .strict();

const ASSISTANT_TOOL_EXECUTION_SUCCESS_SCHEMA = z
  .object({
    callId: z.string().trim().min(1).max(200),
    toolName: z.string().trim().min(1).max(200),
    status: z.literal("success"),
    output: z.record(z.unknown()),
    userSummary: z.string().trim().min(1).max(500),
    reconciliationState: z.enum(ASSISTANT_RECONCILIATION_STATE_VALUES),
  })
  .strict();

const ASSISTANT_TOOL_EXECUTION_FAILURE_SCHEMA = z
  .object({
    callId: z.string().trim().min(1).max(200),
    toolName: z.string().trim().min(1).max(200),
    status: z.enum(["failed", "cancelled", "skipped"]),
    error: ASSISTANT_TOOL_EXECUTION_ERROR_SCHEMA.nullable(),
    userSummary: z.string().trim().min(1).max(500),
  })
  .strict();

export const ASSISTANT_TOOL_EXECUTION_RESULT_SCHEMA = z.union([
  ASSISTANT_TOOL_EXECUTION_SUCCESS_SCHEMA,
  ASSISTANT_TOOL_EXECUTION_FAILURE_SCHEMA,
]);
