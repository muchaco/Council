import { describe, expect, it } from "vitest";
import {
  DELETE_AGENT_REQUEST_SCHEMA,
  DELETE_COUNCIL_REQUEST_SCHEMA,
  GET_AGENT_EDITOR_VIEW_REQUEST_SCHEMA,
  GET_COUNCIL_EDITOR_VIEW_REQUEST_SCHEMA,
  HEALTH_PING_REQUEST_SCHEMA,
  LIST_AGENTS_REQUEST_SCHEMA,
  LIST_COUNCILS_REQUEST_SCHEMA,
  SAVE_AGENT_REQUEST_SCHEMA,
  SAVE_COUNCIL_REQUEST_SCHEMA,
  SAVE_PROVIDER_CONFIG_REQUEST_SCHEMA,
  SET_COUNCIL_ARCHIVED_REQUEST_SCHEMA,
  SET_GLOBAL_DEFAULT_MODEL_REQUEST_SCHEMA,
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
});
