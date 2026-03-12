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
    name: "listAgents",
    version: 1,
    category: "read",
    risk: "read",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "List agents using the active list filters.",
    inputSchema: z
      .object({
        searchText: z.string().max(200).optional(),
        archivedFilter: z.enum(["active", "archived", "all"]).optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        total: z.number().int().min(0),
        items: z.array(
          z
            .object({
              id: z.string().uuid(),
              name: z.string().min(1).max(120),
            })
            .strict(),
        ),
      })
      .strict(),
    reconciliation: null,
  }),
];

export const getAssistantToolDefinition = (toolName: string): AssistantToolDefinition | null =>
  ASSISTANT_TOOL_DEFINITIONS.find((definition) => definition.name === toolName) ?? null;
