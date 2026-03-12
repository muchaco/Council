import { describe, expect } from "vitest";

import {
  matchesAgentDraftPatch,
  matchesCouncilDraftPatch,
  matchesSavedAgentFields,
  matchesSavedCouncilFields,
  readSavedAgentFields,
  readSavedCouncilFields,
} from "../../src/renderer/components/assistant/assistant-reconciliation-helpers";
import { itReq } from "../helpers/requirement-trace";

describe("assistant reconciliation helpers", () => {
  itReq(
    ["R9.11", "R9.17", "R9.22", "A1", "A3"],
    "requires matching model-only agent draft updates before reconciliation completes",
    () => {
      expect(
        matchesAgentDraftPatch(
          {
            archived: false,
            draft: {
              id: "agent-1",
              modelSelection: "gemini:gemini-1.5-flash",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
            initialDraft: {
              id: "agent-1",
              modelSelection: "",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
          },
          {
            modelRefOrNull: {
              providerId: "gemini",
              modelId: "gemini-1.5-flash",
            },
          },
        ),
      ).toBe(true);

      expect(
        matchesAgentDraftPatch(
          {
            archived: false,
            draft: {
              id: "agent-1",
              modelSelection: "openai:gpt-4.1",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
            initialDraft: {
              id: "agent-1",
              modelSelection: "",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
          },
          {
            modelRefOrNull: {
              providerId: "gemini",
              modelId: "gemini-1.5-flash",
            },
          },
        ),
      ).toBe(false);
    },
  );

  itReq(
    ["R9.17", "R9.18", "R9.22", "A1", "A3"],
    "requires authoritative saved agent model fields to become visible before reconciliation completes",
    () => {
      const savedFields = readSavedAgentFields({
        agentId: "agent-1",
        agentName: "Planner",
        savedFields: {
          name: "Planner",
          modelRefOrNull: {
            providerId: "gemini",
            modelId: "gemini-1.5-flash",
          },
          systemPrompt: "Prompt",
          tags: ["analysis"],
          temperature: 0.4,
          verbosity: "high",
        },
      });

      expect(savedFields).not.toBeNull();
      expect(
        matchesSavedAgentFields(
          {
            archived: false,
            draft: {
              id: "agent-1",
              modelSelection: "gemini:gemini-1.5-flash",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
            initialDraft: {
              id: "agent-1",
              modelSelection: "",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
          },
          savedFields as NonNullable<typeof savedFields>,
        ),
      ).toBe(true);

      expect(
        matchesSavedAgentFields(
          {
            archived: false,
            draft: {
              id: "agent-1",
              modelSelection: "openai:gpt-4.1",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
            initialDraft: {
              id: "agent-1",
              modelSelection: "",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
          },
          savedFields as NonNullable<typeof savedFields>,
        ),
      ).toBe(false);

      expect(
        matchesSavedAgentFields(
          {
            archived: false,
            draft: {
              id: "agent-1",
              modelSelection: "gemini:gemini-1.5-flash",
              name: "Planner Draft",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
            initialDraft: {
              id: "agent-1",
              modelSelection: "",
              name: "Planner",
              systemPrompt: "Prompt",
              tagsInput: "analysis",
              temperature: "0.4",
              verbosity: "high",
            },
          },
          savedFields as NonNullable<typeof savedFields>,
        ),
      ).toBe(false);
    },
  );

  itReq(
    ["R9.11", "R9.17", "R9.22", "A1", "A3"],
    "requires matching council conductor and member updates before reconciliation completes",
    () => {
      expect(
        matchesCouncilDraftPatch(
          {
            archived: false,
            draft: {
              conductorModelSelection: "gemini:gemini-1.5-flash",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-2"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
            initialDraft: {
              conductorModelSelection: "",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-1"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
          },
          {
            conductorModelRefOrNull: {
              providerId: "gemini",
              modelId: "gemini-1.5-flash",
            },
            memberAgentIds: ["agent-2"],
          },
        ),
      ).toBe(true);

      expect(
        matchesCouncilDraftPatch(
          {
            archived: false,
            draft: {
              conductorModelSelection: "gemini:gemini-1.5-flash",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-1"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
            initialDraft: {
              conductorModelSelection: "",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-1"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
          },
          {
            conductorModelRefOrNull: {
              providerId: "gemini",
              modelId: "gemini-1.5-flash",
            },
            memberAgentIds: ["agent-2"],
          },
        ),
      ).toBe(false);
    },
  );

  itReq(
    ["R9.17", "R9.18", "R9.22", "A1", "A3"],
    "requires authoritative saved council conductor and member fields to become visible before reconciliation completes",
    () => {
      const savedFields = readSavedCouncilFields({
        councilId: "council-1",
        councilTitle: "Quarterly Council",
        savedFields: {
          conductorModelRefOrNull: {
            providerId: "gemini",
            modelId: "gemini-1.5-flash",
          },
          goal: "Ship",
          memberAgentIds: ["agent-2"],
          mode: "manual",
          tags: ["analysis"],
          title: "Quarterly Council",
          topic: "Planning",
        },
      });

      expect(savedFields).not.toBeNull();
      expect(
        matchesSavedCouncilFields(
          {
            archived: false,
            draft: {
              conductorModelSelection: "gemini:gemini-1.5-flash",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-2"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
            initialDraft: {
              conductorModelSelection: "",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-1"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
          },
          savedFields as NonNullable<typeof savedFields>,
        ),
      ).toBe(true);

      expect(
        matchesSavedCouncilFields(
          {
            archived: false,
            draft: {
              conductorModelSelection: "gemini:gemini-1.5-flash",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-1"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
            initialDraft: {
              conductorModelSelection: "",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-1"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
          },
          savedFields as NonNullable<typeof savedFields>,
        ),
      ).toBe(false);

      expect(
        matchesSavedCouncilFields(
          {
            archived: false,
            draft: {
              conductorModelSelection: "gemini:gemini-1.5-flash",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-2"],
              tagsInput: "analysis",
              title: "Quarterly Council Draft",
              topic: "Planning",
            },
            initialDraft: {
              conductorModelSelection: "",
              goal: "Ship",
              id: "council-1",
              mode: "manual",
              selectedMemberIds: ["agent-1"],
              tagsInput: "analysis",
              title: "Quarterly Council",
              topic: "Planning",
            },
          },
          savedFields as NonNullable<typeof savedFields>,
        ),
      ).toBe(false);
    },
  );
});
