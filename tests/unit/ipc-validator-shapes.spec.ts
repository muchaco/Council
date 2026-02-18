import { describe, expect, it } from "vitest";
import {
  ADVANCE_AUTOPILOT_TURN_REQUEST_SCHEMA,
  CANCEL_COUNCIL_GENERATION_REQUEST_SCHEMA,
  DELETE_AGENT_REQUEST_SCHEMA,
  DELETE_COUNCIL_REQUEST_SCHEMA,
  GENERATE_MANUAL_COUNCIL_TURN_REQUEST_SCHEMA,
  GET_AGENT_EDITOR_VIEW_REQUEST_SCHEMA,
  GET_COUNCIL_EDITOR_VIEW_REQUEST_SCHEMA,
  GET_COUNCIL_VIEW_REQUEST_SCHEMA,
  HEALTH_PING_REQUEST_SCHEMA,
  INJECT_CONDUCTOR_MESSAGE_REQUEST_SCHEMA,
  LIST_AGENTS_REQUEST_SCHEMA,
  LIST_COUNCILS_REQUEST_SCHEMA,
  PAUSE_COUNCIL_AUTOPILOT_REQUEST_SCHEMA,
  RESUME_COUNCIL_AUTOPILOT_REQUEST_SCHEMA,
  SAVE_AGENT_REQUEST_SCHEMA,
  SAVE_COUNCIL_REQUEST_SCHEMA,
  SAVE_PROVIDER_CONFIG_REQUEST_SCHEMA,
  SET_COUNCIL_ARCHIVED_REQUEST_SCHEMA,
  SET_GLOBAL_DEFAULT_MODEL_REQUEST_SCHEMA,
  START_COUNCIL_REQUEST_SCHEMA,
  TEST_PROVIDER_CONNECTION_REQUEST_SCHEMA,
} from "../../src/shared/ipc/validators";

describe("ipc validators", () => {
  it("accepts valid payload", () => {
    const parsed = HEALTH_PING_REQUEST_SCHEMA.safeParse({ message: "ping" });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty payload", () => {
    const parsed = HEALTH_PING_REQUEST_SCHEMA.safeParse({ message: "" });
    expect(parsed.success).toBe(false);
  });

  it("accepts provider test payload", () => {
    const parsed = TEST_PROVIDER_CONNECTION_REQUEST_SCHEMA.safeParse({
      provider: {
        providerId: "gemini",
        endpointUrl: null,
        apiKey: "abc123",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects save payload without test token", () => {
    const parsed = SAVE_PROVIDER_CONFIG_REQUEST_SCHEMA.safeParse({
      provider: {
        providerId: "openrouter",
        endpointUrl: null,
        apiKey: "abc123",
      },
      testToken: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts nullable global default model payload", () => {
    const parsed = SET_GLOBAL_DEFAULT_MODEL_REQUEST_SCHEMA.safeParse({
      viewKind: "settings",
      modelRefOrNull: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts valid list agents payload", () => {
    const parsed = LIST_AGENTS_REQUEST_SCHEMA.safeParse({
      viewKind: "agentsList",
      searchText: "planner",
      tagFilter: "research",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid list agents page", () => {
    const parsed = LIST_AGENTS_REQUEST_SCHEMA.safeParse({
      viewKind: "agentsList",
      searchText: "",
      tagFilter: "",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts save agent payload with nullable model", () => {
    const parsed = SAVE_AGENT_REQUEST_SCHEMA.safeParse({
      viewKind: "agentEdit",
      id: null,
      name: "Researcher",
      systemPrompt: "Find relevant facts",
      verbosity: null,
      temperature: null,
      tags: ["research"],
      modelRefOrNull: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts nullable get editor payload", () => {
    const parsed = GET_AGENT_EDITOR_VIEW_REQUEST_SCHEMA.safeParse({
      viewKind: "agentEdit",
      agentId: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects delete payload with non-uuid id", () => {
    const parsed = DELETE_AGENT_REQUEST_SCHEMA.safeParse({ id: "agent-1" });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid list councils payload", () => {
    const parsed = LIST_COUNCILS_REQUEST_SCHEMA.safeParse({
      viewKind: "councilsList",
      searchText: "strategy",
      tagFilter: "ops",
      archivedFilter: "all",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts valid save council payload", () => {
    const parsed = SAVE_COUNCIL_REQUEST_SCHEMA.safeParse({
      viewKind: "councilCreate",
      id: null,
      title: "Ops Council",
      topic: "Incident reduction",
      goal: "Agree next steps",
      mode: "manual",
      tags: ["ops"],
      memberAgentIds: ["00000000-0000-4000-8000-000000000101"],
      memberColorsByAgentId: {
        "00000000-0000-4000-8000-000000000101": "#2d6cdf",
      },
      conductorModelRefOrNull: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts nullable get council editor payload", () => {
    const parsed = GET_COUNCIL_EDITOR_VIEW_REQUEST_SCHEMA.safeParse({
      viewKind: "councilCreate",
      councilId: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid set archived payload", () => {
    const parsed = SET_COUNCIL_ARCHIVED_REQUEST_SCHEMA.safeParse({
      id: "not-a-uuid",
      archived: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid delete council payload", () => {
    const parsed = DELETE_COUNCIL_REQUEST_SCHEMA.safeParse({ id: "council-1" });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid council view payload", () => {
    const parsed = GET_COUNCIL_VIEW_REQUEST_SCHEMA.safeParse({
      viewKind: "councilView",
      councilId: "00000000-0000-4000-8000-000000000111",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects pause autopilot payload with invalid id", () => {
    const parsed = PAUSE_COUNCIL_AUTOPILOT_REQUEST_SCHEMA.safeParse({
      id: "invalid",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid start and resume council payloads", () => {
    const startParsed = START_COUNCIL_REQUEST_SCHEMA.safeParse({
      viewKind: "councilView",
      id: "00000000-0000-4000-8000-000000000112",
    });
    const resumeParsed = RESUME_COUNCIL_AUTOPILOT_REQUEST_SCHEMA.safeParse({
      viewKind: "councilView",
      id: "00000000-0000-4000-8000-000000000112",
    });
    expect(startParsed.success).toBe(true);
    expect(resumeParsed.success).toBe(true);
  });

  it("accepts manual generation and autopilot advance payloads", () => {
    const manualParsed = GENERATE_MANUAL_COUNCIL_TURN_REQUEST_SCHEMA.safeParse({
      viewKind: "councilView",
      id: "00000000-0000-4000-8000-000000000113",
      memberAgentId: "00000000-0000-4000-8000-000000000101",
    });
    const advanceParsed = ADVANCE_AUTOPILOT_TURN_REQUEST_SCHEMA.safeParse({
      viewKind: "councilView",
      id: "00000000-0000-4000-8000-000000000113",
    });
    expect(manualParsed.success).toBe(true);
    expect(advanceParsed.success).toBe(true);
  });

  it("rejects empty conductor injection content and invalid cancel id", () => {
    const injectParsed = INJECT_CONDUCTOR_MESSAGE_REQUEST_SCHEMA.safeParse({
      viewKind: "councilView",
      id: "00000000-0000-4000-8000-000000000114",
      content: "   ",
    });
    const cancelParsed = CANCEL_COUNCIL_GENERATION_REQUEST_SCHEMA.safeParse({ id: "bad-id" });
    expect(injectParsed.success).toBe(false);
    expect(cancelParsed.success).toBe(false);
  });
});
