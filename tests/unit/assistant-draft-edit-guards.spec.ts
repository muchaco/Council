import { describe, expect } from "vitest";

import {
  getAgentDraftEditGuardMessage,
  getCouncilDraftEditGuardMessage,
  isAgentEditorReadOnly,
  isCouncilEditorReadOnly,
} from "../../src/shared/assistant/assistant-draft-edit-guards";
import { itReq } from "../helpers/requirement-trace";

describe("assistant draft edit guards", () => {
  itReq(["R9.11", "R9.14", "R9.22", "A1", "A3"], "blocks archived agent draft edits", () => {
    expect(isAgentEditorReadOnly(true)).toBe(true);
    expect(isAgentEditorReadOnly(false)).toBe(false);

    expect(getAgentDraftEditGuardMessage({ isArchived: true })).toBe(
      "Archived agents are read-only. Restore the current agent before editing it.",
    );
    expect(getAgentDraftEditGuardMessage({ isArchived: false })).toBeNull();
  });

  itReq(
    ["R9.11", "R9.14", "R9.22", "A1", "A3"],
    "blocks archived or mode-locked council draft edits",
    () => {
      expect(isCouncilEditorReadOnly(true)).toBe(true);
      expect(isCouncilEditorReadOnly(false)).toBe(false);

      expect(
        getCouncilDraftEditGuardMessage({
          isArchived: true,
          isExistingCouncil: true,
          patch: {},
        }),
      ).toBe("Archived councils are read-only. Restore the current council before editing it.");

      expect(
        getCouncilDraftEditGuardMessage({
          isArchived: false,
          isExistingCouncil: true,
          patch: { mode: "autopilot" },
        }),
      ).toBe("Council mode is locked after creation. Open a new council draft to change the mode.");

      expect(
        getCouncilDraftEditGuardMessage({
          isArchived: false,
          isExistingCouncil: false,
          patch: { mode: "autopilot" },
        }),
      ).toBeNull();
    },
  );
});
