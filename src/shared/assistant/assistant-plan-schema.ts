import { z } from "zod";
import type {
  AssistantContextEnvelope,
  AssistantPlanResult,
  AssistantPlannerResponse,
  AssistantUserTurnResponse,
} from "../ipc/dto.js";
import { sanitizeAssistantPayload, sanitizeAssistantText } from "./assistant-audit.js";
import { serializeAssistantContextForPrompt } from "./assistant-context.js";
import { validateAssistantPlannedCall } from "./assistant-risk-policy.js";
import type { AssistantToolDefinition } from "./assistant-tool-definitions.js";
import { ASSISTANT_PLANNED_TOOL_CALL_SCHEMA } from "./assistant-tool-schemas.js";

const ASSISTANT_PLANNER_RESPONSE_SCHEMA = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("clarify"),
      question: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      kind: z.literal("confirm"),
      summary: z.string().trim().min(1).max(500),
      confirmation: z
        .object({
          summary: z.string().trim().min(1).max(500),
          scopeDescription: z.string().trim().min(1).max(500),
          affectedCount: z.number().int().min(0).max(10_000).nullable(),
          examples: z.array(z.string().trim().min(1).max(200)).max(10),
          reversible: z.boolean(),
          draftImpact: z.enum(["none", "modify-current-draft", "replace-current-draft"]),
        })
        .strict(),
      plannedCalls: z.array(ASSISTANT_PLANNED_TOOL_CALL_SCHEMA).max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal("execute"),
      summary: z.string().trim().min(1).max(500),
      plannedCalls: z.array(ASSISTANT_PLANNED_TOOL_CALL_SCHEMA).max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal("result"),
      outcome: z.enum(["success", "partial", "failure", "cancelled"]),
      summary: z.string().trim().min(1).max(500),
    })
    .strict(),
]);

type AssistantPlannerDirective = Exclude<AssistantPlannerResponse, { kind: "result" }>;

const extractPlannerResponseCandidates = (rawText: string): ReadonlyArray<string> => {
  const trimmed = rawText.trim();
  const candidates = new Set<string>();

  if (trimmed.length > 0) {
    candidates.add(trimmed);
  }

  const fencedBlockMatches = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fencedBlockMatches) {
    const block = match[1]?.trim();
    if (typeof block === "string" && block.length > 0) {
      candidates.add(block);
    }
  }

  const firstBraceIndex = trimmed.indexOf("{");
  const lastBraceIndex = trimmed.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    const objectSlice = trimmed.slice(firstBraceIndex, lastBraceIndex + 1).trim();
    if (objectSlice.length > 0) {
      candidates.add(objectSlice);
    }
  }

  return Array.from(candidates);
};

const parseRawPlannerResponse = (rawText: string): unknown | null => {
  for (const candidate of extractPlannerResponseCandidates(rawText)) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  return null;
};

export const parseAssistantPlannerResponse = (
  rawText: string,
): AssistantPlannerDirective | null => {
  const parsed = parseRawPlannerResponse(rawText);
  if (parsed === null) {
    return null;
  }

  const result = ASSISTANT_PLANNER_RESPONSE_SCHEMA.safeParse(parsed);
  if (!result.success) {
    return null;
  }

  switch (result.data.kind) {
    case "clarify":
      return {
        kind: "clarify",
        question: sanitizeAssistantText(result.data.question),
      };
    case "confirm": {
      const plannedCalls = normalizeAssistantPlannedCalls(result.data.plannedCalls);
      if (plannedCalls === null) {
        return null;
      }

      return {
        kind: "confirm",
        summary: sanitizeAssistantText(result.data.summary),
        confirmation: {
          ...result.data.confirmation,
          summary: sanitizeAssistantText(result.data.confirmation.summary),
          scopeDescription: sanitizeAssistantText(result.data.confirmation.scopeDescription),
          examples: result.data.confirmation.examples.map((example) =>
            sanitizeAssistantText(example),
          ),
        },
        plannedCalls,
      };
    }
    case "execute": {
      const plannedCalls = normalizeAssistantPlannedCalls(result.data.plannedCalls);
      if (plannedCalls === null) {
        return null;
      }

      return {
        kind: "execute",
        summary: sanitizeAssistantText(result.data.summary),
        plannedCalls,
      };
    }
    case "result":
      return null;
  }
};

const normalizeAssistantPlannedCalls = (
  plannedCalls: ReadonlyArray<z.infer<typeof ASSISTANT_PLANNED_TOOL_CALL_SCHEMA>>,
): ReadonlyArray<z.infer<typeof ASSISTANT_PLANNED_TOOL_CALL_SCHEMA>> | null => {
  const normalizedCalls: Array<z.infer<typeof ASSISTANT_PLANNED_TOOL_CALL_SCHEMA>> = [];

  for (const plannedCall of plannedCalls) {
    const validated = validateAssistantPlannedCall(plannedCall);
    if (!validated.ok) {
      return null;
    }

    const normalizedInput = normalizeToolPayload({
      schema: validated.definition.inputSchema,
      payload: plannedCall.input,
    });

    if (normalizedInput === null) {
      return null;
    }

    normalizedCalls.push({
      callId: sanitizeAssistantText(plannedCall.callId),
      toolName: validated.definition.name,
      rationale: sanitizeAssistantText(plannedCall.rationale),
      input: normalizedInput,
    });
  }

  return normalizedCalls;
};

const normalizeToolPayload = <TSchema extends z.ZodTypeAny>(params: {
  schema: TSchema;
  payload: unknown;
}): z.infer<TSchema> | null => {
  const parsed = params.schema.safeParse(params.payload);
  if (!parsed.success) {
    return null;
  }

  const sanitized = sanitizeAssistantPayload(parsed.data);
  const reparsed = params.schema.safeParse(sanitized);
  return reparsed.success ? reparsed.data : null;
};

export const buildAssistantPlannerPrompt = (params: {
  userRequest: string;
  response: AssistantUserTurnResponse | null;
  context: AssistantContextEnvelope;
  tools: ReadonlyArray<AssistantToolDefinition>;
}): string => {
  const toolLines =
    params.tools.length === 0
      ? ["- no tools are enabled yet"]
      : params.tools.map((tool) =>
          [
            `- ${tool.name} v${tool.version}`,
            `category=${tool.category}`,
            `risk=${tool.risk}`,
            `confirmation=${tool.confirmationPolicy}`,
            `description=${tool.description}`,
          ].join(" | "),
        );

  return [
    "You are the Council assistant planner.",
    "Return only JSON matching one of these shapes:",
    '- {"kind":"clarify","question":"..."}',
    '- {"kind":"confirm","summary":"...","confirmation":{...},"plannedCalls":[...]}',
    '- {"kind":"execute","summary":"...","plannedCalls":[...]}',
    "Use enabled tools whenever the user asks for current app data or navigation that a tool can verify.",
    "Do not answer from the context summary alone when a read or navigation tool can fetch the visible state directly.",
    "Enabled tools:",
    ...toolLines,
    "Context:",
    serializeAssistantContextForPrompt(params.context),
    "User request:",
    params.userRequest,
    ...(params.response === null
      ? []
      : params.response.kind === "clarification"
        ? ["User clarification:", params.response.text]
        : ["User confirmation response:", params.response.approved ? "approved" : "rejected"]),
  ].join("\n");
};

export const attachAssistantSessionToPlanResult = (params: {
  sessionId: string;
  plannerResponse: AssistantPlannerDirective;
  confirmationToken?: string;
}): AssistantPlanResult => {
  switch (params.plannerResponse.kind) {
    case "clarify":
      return {
        kind: "clarify",
        sessionId: params.sessionId,
        message: params.plannerResponse.question,
        planSummary: null,
        plannedCalls: [],
      };
    case "confirm":
      return {
        kind: "confirm",
        sessionId: params.sessionId,
        message: params.plannerResponse.summary,
        planSummary: params.plannerResponse.summary,
        confirmationToken: params.confirmationToken ?? crypto.randomUUID(),
        plannedCalls: params.plannerResponse.plannedCalls,
        confirmation: params.plannerResponse.confirmation,
      };
    case "execute":
      return {
        kind: "execute",
        sessionId: params.sessionId,
        message: params.plannerResponse.summary,
        planSummary: params.plannerResponse.summary,
        plannedCalls: params.plannerResponse.plannedCalls,
      };
  }
};
