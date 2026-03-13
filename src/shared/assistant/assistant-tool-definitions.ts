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

const MODEL_REF_SCHEMA = z
  .object({
    providerId: z.string().trim().min(1).max(50),
    modelId: z.string().trim().min(1).max(200),
  })
  .strict();

const SAVED_AGENT_FIELDS_SCHEMA = z
  .object({
    name: z.string().trim().min(1).max(120),
    modelRefOrNull: MODEL_REF_SCHEMA.nullable(),
    systemPrompt: z.string().trim().min(1).max(10_000),
    tags: z.array(z.string().trim().min(1).max(20)).max(3),
    temperature: z.number().min(0).max(2).nullable(),
    verbosity: z.string().trim().max(200).nullable(),
  })
  .strict();

const SAVED_COUNCIL_FIELDS_SCHEMA = z
  .object({
    conductorModelRefOrNull: MODEL_REF_SCHEMA.nullable(),
    goal: z.string().trim().max(5_000).nullable(),
    memberAgentIds: z.array(z.string().uuid()).min(1).max(20),
    mode: z.enum(["autopilot", "manual"]),
    tags: z.array(z.string().trim().min(1).max(20)).max(3),
    title: z.string().trim().min(1).max(200),
    topic: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const ASSISTANT_TOOL_DEFINITIONS: ReadonlyArray<AssistantToolDefinition> = [
  defineAssistantTool({
    name: "setAgentDraftFields",
    version: 1,
    category: "draft-edit",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "when-dirty-draft-would-be-replaced",
    description:
      "Patch the current visible agent draft fields in place. Omit entityId to target the currently open editor.",
    inputSchema: z
      .object({
        entityId: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(120).optional(),
        systemPrompt: z.string().trim().min(1).max(10_000).optional(),
        verbosity: z.string().trim().max(200).nullable().optional(),
        temperature: z.number().min(0).max(2).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
        modelRefOrNull: z
          .object({
            providerId: z.string().trim().min(1).max(50),
            modelId: z.string().trim().min(1).max(200),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict()
      .refine(
        (value) =>
          value.name !== undefined ||
          value.systemPrompt !== undefined ||
          value.verbosity !== undefined ||
          value.temperature !== undefined ||
          value.tags !== undefined ||
          value.modelRefOrNull !== undefined,
        "At least one draft field must be provided.",
      ),
    outputSchema: z
      .object({
        appliedFieldLabels: z.array(z.string().trim().min(1).max(50)).min(1).max(5),
        entityId: z.string().uuid().nullable(),
        patch: z
          .object({
            name: z.string().trim().min(1).max(120).optional(),
            systemPrompt: z.string().trim().min(1).max(10_000).optional(),
            verbosity: z.string().trim().max(200).nullable().optional(),
            temperature: z.number().min(0).max(2).nullable().optional(),
            tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
            modelRefOrNull: z
              .object({
                providerId: z.string().trim().min(1).max(50),
                modelId: z.string().trim().min(1).max(200),
              })
              .strict()
              .nullable()
              .optional(),
          })
          .strict(),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "current-draft",
      strategy: "patch-local",
      successCondition: "The current visible agent draft shows the requested field changes.",
    },
  }),
  defineAssistantTool({
    name: "setCouncilDraftFields",
    version: 1,
    category: "draft-edit",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "when-dirty-draft-would-be-replaced",
    description:
      "Patch the current visible council draft fields in place. Omit entityId to target the currently open editor.",
    inputSchema: z
      .object({
        entityId: z.string().uuid().nullable().optional(),
        title: z.string().trim().min(1).max(200).optional(),
        topic: z.string().trim().min(1).max(10_000).optional(),
        goal: z.string().trim().max(5_000).nullable().optional(),
        mode: z.enum(["autopilot", "manual"]).optional(),
        tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
        memberAgentIds: z.array(z.string().uuid()).min(1).max(20).optional(),
        conductorModelRefOrNull: z
          .object({
            providerId: z.string().trim().min(1).max(50),
            modelId: z.string().trim().min(1).max(200),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict()
      .refine(
        (value) =>
          value.title !== undefined ||
          value.topic !== undefined ||
          value.goal !== undefined ||
          value.mode !== undefined ||
          value.tags !== undefined ||
          value.memberAgentIds !== undefined ||
          value.conductorModelRefOrNull !== undefined,
        "At least one draft field must be provided.",
      ),
    outputSchema: z
      .object({
        appliedFieldLabels: z.array(z.string().trim().min(1).max(50)).min(1).max(5),
        entityId: z.string().uuid().nullable(),
        patch: z
          .object({
            title: z.string().trim().min(1).max(200).optional(),
            topic: z.string().trim().min(1).max(10_000).optional(),
            goal: z.string().trim().max(5_000).nullable().optional(),
            mode: z.enum(["autopilot", "manual"]).optional(),
            tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
            memberAgentIds: z.array(z.string().uuid()).min(1).max(20).optional(),
            conductorModelRefOrNull: z
              .object({
                providerId: z.string().trim().min(1).max(50),
                modelId: z.string().trim().min(1).max(200),
              })
              .strict()
              .nullable()
              .optional(),
          })
          .strict(),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "current-draft",
      strategy: "patch-local",
      successCondition: "The current visible council draft shows the requested field changes.",
    },
  }),
  defineAssistantTool({
    name: "saveAgentDraft",
    version: 1,
    category: "commit",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description:
      "Save the current visible agent draft through the normal editor save flow. Omit entityId to target the open editor.",
    inputSchema: z
      .object({
        entityId: z.string().uuid().nullable().optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        agentId: z.string().uuid().nullable(),
        agentName: z.string().trim().min(1).max(120).nullable(),
        savedFields: SAVED_AGENT_FIELDS_SCHEMA,
      })
      .strict(),
    reconciliation: {
      visibleTarget: "detail-view",
      strategy: "reload-entity",
      successCondition:
        "The current visible agent editor shows the saved data and no dirty draft remains.",
    },
  }),
  defineAssistantTool({
    name: "saveCouncilDraft",
    version: 1,
    category: "commit",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description:
      "Save the current visible council draft through the normal editor save flow. Omit entityId to target the open editor.",
    inputSchema: z
      .object({
        entityId: z.string().uuid().nullable().optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid().nullable(),
        councilTitle: z.string().trim().min(1).max(200).nullable(),
        savedFields: SAVED_COUNCIL_FIELDS_SCHEMA,
      })
      .strict(),
    reconciliation: {
      visibleTarget: "detail-view",
      strategy: "reload-entity",
      successCondition:
        "The current visible council editor shows the saved data and no dirty draft remains.",
    },
  }),
  defineAssistantTool({
    name: "createAgent",
    version: 1,
    category: "commit",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "when-dirty-draft-would-be-replaced",
    description:
      "Create a new agent when the request is not about the current open draft. Prefer saveAgentDraft for the visible editor.",
    inputSchema: z
      .object({
        name: z.string().trim().min(1).max(120),
        systemPrompt: z.string().trim().min(1).max(10_000),
        verbosity: z.string().trim().max(200).nullable().optional(),
        temperature: z.number().min(0).max(2).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
        modelRefOrNull: z
          .object({
            providerId: z.string().trim().min(1).max(50),
            modelId: z.string().trim().min(1).max(200),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        agentId: z.string().uuid(),
        agentName: z.string().trim().min(1).max(120),
        savedFields: SAVED_AGENT_FIELDS_SCHEMA,
      })
      .strict(),
    reconciliation: {
      visibleTarget: "detail-view",
      strategy: "navigate-and-load",
      successCondition: "The created agent editor is visible with the saved data loaded.",
    },
  }),
  defineAssistantTool({
    name: "createCouncil",
    version: 1,
    category: "commit",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "when-dirty-draft-would-be-replaced",
    description:
      "Create a new council when the request is not about the current open draft. Prefer saveCouncilDraft for the visible editor.",
    inputSchema: z
      .object({
        title: z.string().trim().min(1).max(200),
        topic: z.string().trim().min(1).max(10_000),
        goal: z.string().trim().max(5_000).nullable().optional(),
        mode: z.enum(["autopilot", "manual"]).optional(),
        tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
        memberAgentIds: z.array(z.string().uuid()).min(1).max(20),
        conductorModelRefOrNull: z
          .object({
            providerId: z.string().trim().min(1).max(50),
            modelId: z.string().trim().min(1).max(200),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        savedFields: SAVED_COUNCIL_FIELDS_SCHEMA,
      })
      .strict(),
    reconciliation: {
      visibleTarget: "detail-view",
      strategy: "navigate-and-load",
      successCondition: "The created council editor is visible with the saved data loaded.",
    },
  }),
  defineAssistantTool({
    name: "updateAgent",
    version: 1,
    category: "commit",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "when-dirty-draft-would-be-replaced",
    description:
      "Update a saved agent outside the current editor draft. Prefer patching the current draft in place when that draft is open.",
    inputSchema: z
      .object({
        agentId: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        systemPrompt: z.string().trim().min(1).max(10_000).optional(),
        verbosity: z.string().trim().max(200).nullable().optional(),
        temperature: z.number().min(0).max(2).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
        modelRefOrNull: z
          .object({
            providerId: z.string().trim().min(1).max(50),
            modelId: z.string().trim().min(1).max(200),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict()
      .refine(
        (value) =>
          value.name !== undefined ||
          value.systemPrompt !== undefined ||
          value.verbosity !== undefined ||
          value.temperature !== undefined ||
          value.tags !== undefined ||
          value.modelRefOrNull !== undefined,
        "At least one agent field must be provided.",
      ),
    outputSchema: z
      .object({
        agentId: z.string().uuid(),
        agentName: z.string().trim().min(1).max(120),
        savedFields: SAVED_AGENT_FIELDS_SCHEMA,
      })
      .strict(),
    reconciliation: {
      visibleTarget: "detail-view",
      strategy: "reload-entity",
      successCondition: "The updated agent is visibly loaded in the editor with saved data.",
    },
  }),
  defineAssistantTool({
    name: "updateCouncilConfig",
    version: 1,
    category: "commit",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "when-dirty-draft-would-be-replaced",
    description:
      "Update a saved council outside the current editor draft. Prefer patching the current draft in place when that draft is open.",
    inputSchema: z
      .object({
        councilId: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        topic: z.string().trim().min(1).max(10_000).optional(),
        goal: z.string().trim().max(5_000).nullable().optional(),
        mode: z.enum(["autopilot", "manual"]).optional(),
        tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
        memberAgentIds: z.array(z.string().uuid()).min(1).max(20).optional(),
        conductorModelRefOrNull: z
          .object({
            providerId: z.string().trim().min(1).max(50),
            modelId: z.string().trim().min(1).max(200),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict()
      .refine(
        (value) =>
          value.title !== undefined ||
          value.topic !== undefined ||
          value.goal !== undefined ||
          value.mode !== undefined ||
          value.tags !== undefined ||
          value.memberAgentIds !== undefined ||
          value.conductorModelRefOrNull !== undefined,
        "At least one council field must be provided.",
      ),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        savedFields: SAVED_COUNCIL_FIELDS_SCHEMA,
      })
      .strict(),
    reconciliation: {
      visibleTarget: "detail-view",
      strategy: "reload-entity",
      successCondition: "The updated council is visibly loaded in the editor with saved data.",
    },
  }),
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
  defineAssistantTool({
    name: "startCouncil",
    version: 1,
    category: "runtime",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Start the active council runtime from the current council view lease.",
    inputSchema: z
      .object({
        councilId: z.string().uuid().optional(),
        maxTurns: z.number().int().min(1).max(200).nullable().optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        messageCount: z.number().int().min(0),
        paused: z.boolean(),
        runtimeStatus: z.enum(["idle", "running", "paused"]),
        started: z.boolean(),
        turnCount: z.number().int().min(0),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "runtime-view",
      strategy: "reload-entity",
      successCondition:
        "The active council runtime view shows the started runtime controls and state.",
    },
  }),
  defineAssistantTool({
    name: "pauseCouncil",
    version: 1,
    category: "runtime",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Pause autopilot in the active council runtime view.",
    inputSchema: z
      .object({
        councilId: z.string().uuid().optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        messageCount: z.number().int().min(0),
        paused: z.boolean(),
        runtimeStatus: z.enum(["idle", "running", "paused"]),
        started: z.boolean(),
        turnCount: z.number().int().min(0),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "runtime-view",
      strategy: "reload-entity",
      successCondition: "The active council runtime view shows autopilot paused.",
    },
  }),
  defineAssistantTool({
    name: "resumeCouncil",
    version: 1,
    category: "runtime",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Resume autopilot in the active council runtime view.",
    inputSchema: z
      .object({
        councilId: z.string().uuid().optional(),
        maxTurns: z.number().int().min(1).max(200).nullable().optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        messageCount: z.number().int().min(0),
        paused: z.boolean(),
        runtimeStatus: z.enum(["idle", "running", "paused"]),
        started: z.boolean(),
        turnCount: z.number().int().min(0),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "runtime-view",
      strategy: "reload-entity",
      successCondition: "The active council runtime view shows autopilot resumed.",
    },
  }),
  defineAssistantTool({
    name: "cancelCouncilGeneration",
    version: 1,
    category: "runtime",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Cancel in-flight council generation for the active runtime view.",
    inputSchema: z
      .object({
        councilId: z.string().uuid().optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        cancelled: z.boolean(),
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        messageCount: z.number().int().min(0),
        paused: z.boolean(),
        runtimeStatus: z.enum(["idle", "running", "paused"]),
        started: z.boolean(),
        turnCount: z.number().int().min(0),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "runtime-view",
      strategy: "reload-entity",
      successCondition:
        "The active council runtime view no longer shows a running generation spinner.",
    },
  }),
  defineAssistantTool({
    name: "selectManualSpeaker",
    version: 1,
    category: "runtime",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Run one manual council turn for the selected speaker in the active runtime view.",
    inputSchema: z
      .object({
        councilId: z.string().uuid().optional(),
        memberAgentId: z.string().uuid(),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        memberAgentId: z.string().uuid(),
        messageCount: z.number().int().min(0),
        messageId: z.string().uuid(),
        paused: z.boolean(),
        runtimeStatus: z.enum(["idle", "running", "paused"]),
        started: z.boolean(),
        turnCount: z.number().int().min(0),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "runtime-view",
      strategy: "reload-entity",
      successCondition:
        "The active council runtime view shows the new manual turn message and updated turn count.",
    },
  }),
  defineAssistantTool({
    name: "sendConductorMessage",
    version: 1,
    category: "runtime",
    risk: "write",
    requiresConfirmation: false,
    confirmationPolicy: "never",
    description: "Send a conductor message in the active council runtime view.",
    inputSchema: z
      .object({
        councilId: z.string().uuid().optional(),
        content: z.string().trim().min(1).max(20_000),
      })
      .strict(),
    outputSchema: z
      .object({
        councilId: z.string().uuid(),
        councilTitle: z.string().trim().min(1).max(200),
        messageCount: z.number().int().min(0),
        messageId: z.string().uuid(),
        paused: z.boolean(),
        runtimeStatus: z.enum(["idle", "running", "paused"]),
        started: z.boolean(),
        turnCount: z.number().int().min(0),
      })
      .strict(),
    reconciliation: {
      visibleTarget: "runtime-view",
      strategy: "reload-entity",
      successCondition:
        "The active council runtime view shows the new conductor message and updated briefing context.",
    },
  }),
];

export const getAssistantToolDefinition = (toolName: string): AssistantToolDefinition | null =>
  ASSISTANT_TOOL_DEFINITIONS.find((definition) => definition.name === toolName) ?? null;
