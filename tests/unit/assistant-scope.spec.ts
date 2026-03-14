import { describe, expect } from "vitest";

import { resolveAssistantScopeKey } from "../../src/renderer/components/assistant/assistant-scope";
import { itReq } from "../helpers/requirement-trace";

describe("assistant scope", () => {
  itReq(
    ["R9.17", "R9.18", "R9.22", "U18.10"],
    "keeps council-view scope stable while the active council remains the same",
    () => {
      const beforeLeaseRefresh = resolveAssistantScopeKey({
        homeTab: "councils",
        screen: {
          kind: "councilView",
          councilId: "00000000-0000-4000-8000-000000000010",
        },
      });

      const afterLeaseRefresh = resolveAssistantScopeKey({
        homeTab: "councils",
        screen: {
          kind: "councilView",
          councilId: "00000000-0000-4000-8000-000000000010",
        },
      });

      expect(afterLeaseRefresh).toBe(beforeLeaseRefresh);
      expect(afterLeaseRefresh).toBe("councilView:00000000-0000-4000-8000-000000000010");
    },
  );

  itReq(
    ["R9.17", "R9.18", "R9.22", "U18.10"],
    "changes council-view scope when switching to a different council",
    () => {
      const firstCouncilScope = resolveAssistantScopeKey({
        homeTab: "councils",
        screen: {
          kind: "councilView",
          councilId: "00000000-0000-4000-8000-000000000010",
        },
      });

      const secondCouncilScope = resolveAssistantScopeKey({
        homeTab: "councils",
        screen: {
          kind: "councilView",
          councilId: "00000000-0000-4000-8000-000000000011",
        },
      });

      expect(secondCouncilScope).not.toBe(firstCouncilScope);
      expect(secondCouncilScope).toBe("councilView:00000000-0000-4000-8000-000000000011");
    },
  );
});
