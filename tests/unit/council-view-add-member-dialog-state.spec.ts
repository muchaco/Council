import { describe, expect } from "vitest";

import {
  filterAddableAgents,
  resolveAddableAgentsEmptyStateMessage,
} from "../../src/shared/council-view-add-member-dialog.js";
import { itReq } from "../helpers/requirement-trace";

describe("council view add-member dialog state", () => {
  const availableAgents = [
    {
      id: "agent-1",
      name: "Planner",
      description: "Turns rough ideas into structured project plans.",
      tags: ["planning", "delivery"],
      invalidConfig: false,
      archived: false,
    },
    {
      id: "agent-2",
      name: "Researcher",
      description: "Finds evidence, quotes, and source-backed counterpoints.",
      tags: ["research", "evidence"],
      invalidConfig: false,
      archived: false,
    },
    {
      id: "agent-3",
      name: "Archivist",
      description: "Keeps long-term memory and prior decisions organized.",
      tags: ["memory"],
      invalidConfig: false,
      archived: true,
    },
  ] as const;

  itReq(["U7.1", "U9.7"], "filters addable council members by title description and tags", () => {
    expect(
      filterAddableAgents({
        availableAgents,
        memberAgentIds: ["agent-1"],
        searchText: "evidence",
      }).map((agent) => agent.id),
    ).toEqual(["agent-2"]);

    expect(
      filterAddableAgents({
        availableAgents,
        memberAgentIds: ["agent-1"],
        searchText: "planner",
      }).map((agent) => agent.id),
    ).toEqual([]);

    expect(
      filterAddableAgents({
        availableAgents,
        memberAgentIds: ["agent-1"],
        searchText: "research",
      }).map((agent) => agent.id),
    ).toEqual(["agent-2"]);
  });

  itReq(["U9.7"], "excludes archived agents and resolves modal empty-state copy", () => {
    expect(
      filterAddableAgents({
        availableAgents,
        memberAgentIds: [],
        searchText: "archivist",
      }),
    ).toEqual([]);

    expect(resolveAddableAgentsEmptyStateMessage("research")).toBe(
      "No active agents match that title, description, or tag.",
    );
    expect(resolveAddableAgentsEmptyStateMessage("")).toBe(
      "No active agents are available to add.",
    );
  });
});
