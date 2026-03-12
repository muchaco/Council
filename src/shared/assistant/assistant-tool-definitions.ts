import { type ZodTypeAny, z } from "zod";
import type {
  AssistantToolCategory,
  AssistantToolConfirmationPolicy,
  AssistantToolReconciliation,
  AssistantToolRisk,
} from "../ipc/dto.js";

export type AssistantToolDefinition<
  InputSchema extends ZodTypeAny = ZodTypeAny,
  OutputSchema extends ZodTypeAny = ZodTypeAny,
> = {
  name: string;
  version: number;
  category: AssistantToolCategory;
  risk: AssistantToolRisk;
  requiresConfirmation: boolean;
  confirmationPolicy: AssistantToolConfirmationPolicy;
  description: string;
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  reconciliation: AssistantToolReconciliation | null;
};

export const defineAssistantTool = <
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny,
>(
  definition: AssistantToolDefinition<InputSchema, OutputSchema>,
) => definition;

export const ASSISTANT_TOOL_DEFINITIONS: ReadonlyArray<AssistantToolDefinition> = [
  defineAssistantTool({
    name: "navigateToHomeTab",
    version: 1,
    category: "navigation",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Navigate to a Home tab and wait for it to load.",
    inputSchema: z
      .object({
        tab: z.enum(["settings", "agentsList", "councilsList"]),
      })
      .strict(),
    outputSchema: z
      .object({
        tab: z.enum(["settings", "agentsList", "councilsList"]),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "current-list",
      strategy: "navigate-and-load",
      successCondition: "The requested Home tab is visible with loaded data.",
    },
  }),
  defineAssistantTool({
    name: "openAgentEditor",
    version: 1,
    category: "navigation",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Open an agent editor and wait for its data to load.",
    inputSchema: z
      .object({
        agentId: z.string().uuid(),
      })
      .strict(),
    outputSchema: z
      .object({
        agentId: z.string().uuid(),
        agentName: z.string().trim().min(1).max(120),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "detail-view",
      strategy: "navigate-and-load",
      successCondition: "The requested agent editor is visible with the agent loaded.",
    },
  }),
  defineAssistantTool({
    name: "openCouncilEditor",
    version: 1,
    category: "navigation",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Open a council editor and wait for its data to load.",
    inputSchema: z
      .object({
        councilId: z.string().uuid(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "detail-view",
      strategy: "navigate-and-load",
      successCondition: "The requested council editor is visible with the council loaded.",
    },
  }),
  defineAssistantTool({
    name: "openCouncilView",
    version: 1,
    category: "navigation",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Open a council view and wait for runtime data to load.",
    inputSchema: z
      .object({
        councilId: z.string().uuid(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "runtime-view",
      strategy: "navigate-and-load",
      successCondition: "The requested council view is visible with stable runtime data.",
    },
  }),
  defineAssistantTool({
    name: "listAgents",
    version: 1,
    category: "read",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "List agents using the active list filters.",
    inputSchema: z
      .object({
        tagFilter: z.string().max(200).optional(),
        searchText: z.string().max(200).optional(),
        archivedFilter: z.enum(["active", "archived", "all"]).optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        archivedFilter: z.enum(["active", "archived", "all"]),
        searchText: z.string().max(200),
        tagFilter: z.string().max(200),
        total: z.number().int().min(0),
        items: z.array(
          z
            .object({
              archived: z.boolean(),
              id: z.string().uuid(),
              name: z.string().min(1).max(120),
              invalidConfig: z.boolean(),
              tags: z.array(z.string().min(1).max(20)).max(3),
            })
            .strict(),
        ),
      })
      .strict(),
    reconciliation: null,
  }),
  defineAssistantTool({
    name: "listCouncils",
    version: 1,
    category: "read",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "List councils using the active list filters.",
    inputSchema: z
      .object({
        tagFilter: z.string().max(200).optional(),
        searchText: z.string().max(200).optional(),
        archivedFilter: z.enum(["active", "archived", "all"]).optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        archivedFilter: z.enum(["active", "archived", "all"]),
        searchText: z.string().max(200),
        tagFilter: z.string().max(200),
        total: z.number().int().min(0),
        items: z.array(
          z
            .object({
              archived: z.boolean(),
              id: z.string().uuid(),
              invalidConfig: z.boolean(),
              mode: z.enum(["autopilot", "manual"]),
              title: z.string().min(1).max(200),
            })
            .strict(),
        ),
      })
      .strict(),
    reconciliation: null,
  }),
  defineAssistantTool({
    name: "getAgent",
    version: 1,
    category: "read",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Read the current details for a specific agent.",
    inputSchema: z
      .object({
        agentId: z.string().uuid(),
      })
      .strict(),
    outputSchema: z
      .object({
        agentId: z.string().uuid(),
        archived: z.boolean(),
        invalidConfig: z.boolean(),
        modelRefLabel: z.string().trim().max(260).nullable(),
        name: z.string().trim().min(1).max(120),
        tags: z.array(z.string().min(1).max(20)).max(3),
        temperature: z.number().min(0).max(2).nullable(),
        verbosity: z.string().trim().max(200).nullable(),
      })
      .strict(),
    reconciliation: null,
  }),
  defineAssistantTool({
    name: "getCouncil",
    version: 1,
    category: "read",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Read the current details for a specific council.",
    inputSchema: z
      .object({
        councilId: z.string().uuid(),
      })
      .strict(),
    outputSchema: z
      .object({
        archived: z.boolean(),
        councilId: z.string().uuid(),
        invalidConfig: z.boolean(),
        memberCount: z.number().int().min(0).max(20),
        mode: z.enum(["autopilot", "manual"]),
        paused: z.boolean(),
        started: z.boolean(),
        title: z.string().trim().min(1).max(200),
        turnCount: z.number().int().min(0),
      })
      .strict(),
    reconciliation: null,
  }),
  defineAssistantTool({
    name: "getCouncilRuntimeState",
    version: 1,
    category: "read",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Read the current runtime state for a specific council.",
    inputSchema: z
      .object({
        councilId: z.string().uuid(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        messageCount: z.number().int().min(0),
        paused: z.boolean(),
        plannedNextSpeakerAgentId: z.string().uuid().nullable(),
        runtimeStatus: z.enum(["idle", "running", "paused"]),
        started: z.boolean(),
        turnCount: z.number().int().min(0),
      })
      .strict(),
    reconciliation: null,
  }),
];

export const getAssistantToolDefinition = (toolName: string): AssistantToolDefinition | null =>
  ASSISTANT_TOOL_DEFINITIONS.find((definition) => definition.name === toolName) ?? null;
