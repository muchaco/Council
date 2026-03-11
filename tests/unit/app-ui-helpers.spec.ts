import { describe, expect } from "vitest";
import {
  DEFAULT_AGENT_HOME_LIST_FILTERS,
  DEFAULT_COUNCIL_HOME_LIST_FILTERS,
  appendCommittedTagFilter,
  appendCouncilConfigTag,
  appendTagToDraft,
  applyAgentArchivedListUpdate,
  buildInvalidConfigBadgeAriaLabel,
  buildProviderConfiguredBadgeAriaLabel,
  buildProviderConnectionTestButtonAriaLabel,
  buildTagEditorHelperText,
  commitTagFilterDraft,
  formatHomeListTotal,
  hasActiveAgentHomeListFilters,
  hasActiveCouncilHomeListFilters,
  isModelSelectionInCatalog,
  normalizeTagsDraft,
  parseCouncilConfigTags,
  parseTagDraft,
  removeCommittedTagFilter,
  removeTagFromDraft,
  resolveAutopilotMaxTurns,
  resolveConfirmDialogKeyboardAction,
  resolveDisclosureKeyboardAction,
  resolveTagEditorInputKeyAction,
  resolveToastVariant,
  toModelRef,
  toModelSelectionValue,
  upsertToast,
} from "../../src/shared/app-ui-helpers.js";
import * as appUiHelpers from "../../src/shared/app-ui-helpers.js";
import { itReq } from "../helpers/requirement-trace";

describe("app ui helpers", () => {
  itReq(["U5.3"], "round-trips model selection values", () => {
    const modelRef = {
      providerId: "openrouter",
      modelId: "anthropic/claude-3.7:thinking",
    };

    const selection = toModelSelectionValue(modelRef);
    expect(selection).toBe("openrouter:anthropic/claude-3.7:thinking");
    expect(toModelRef(selection)).toEqual(modelRef);
  });

  itReq(["U5.3"], "returns null for invalid model selection values", () => {
    expect(toModelRef("")).toBeNull();
    expect(toModelRef("openrouter:")).toBeNull();
    expect(toModelRef(":model")).toBeNull();
  });

  itReq(["U5.3"], "checks whether selected model exists in catalog", () => {
    const modelCatalog = {
      modelsByProvider: {
        gemini: ["gemini-2.0-flash"],
      },
    };

    expect(isModelSelectionInCatalog({ modelSelection: "", modelCatalog })).toBe(true);
    expect(
      isModelSelectionInCatalog({
        modelSelection: "gemini:gemini-2.0-flash",
        modelCatalog,
      }),
    ).toBe(true);
    expect(isModelSelectionInCatalog({ modelSelection: "gemini:missing", modelCatalog })).toBe(
      false,
    );
  });

  itReq(["U10.8"], "validates autopilot turn limits", () => {
    expect(
      resolveAutopilotMaxTurns({
        action: "start",
        limitTurns: false,
        maxTurnsInput: "",
        validationMessage: "",
      }),
    ).toEqual({
      ok: true,
      maxTurns: null,
    });

    expect(
      resolveAutopilotMaxTurns({
        action: "start",
        limitTurns: true,
        maxTurnsInput: "abc",
        validationMessage: "",
      }),
    ).toEqual({
      ok: false,
      validationMessage: "Enter a whole number between 1 and 200.",
    });

    expect(
      resolveAutopilotMaxTurns({
        action: "resume",
        limitTurns: true,
        maxTurnsInput: "500",
        validationMessage: "",
      }),
    ).toEqual({
      ok: false,
      validationMessage: "Turn limit must be between 1 and 200.",
    });

    expect(
      resolveAutopilotMaxTurns({
        action: "resume",
        limitTurns: true,
        maxTurnsInput: "12",
        validationMessage: "",
      }),
    ).toEqual({
      ok: true,
      maxTurns: 12,
    });
  });

  itReq(["U2.6"], "deduplicates and bounds toast queue entries", () => {
    const first = upsertToast({
      toasts: [],
      level: "info",
      message: " Model catalog refreshed. ",
      id: "t-1",
      maxToasts: 2,
    });
    expect(first).toEqual([
      {
        id: "t-1",
        level: "info",
        message: "Model catalog refreshed.",
      },
    ]);

    const duplicate = upsertToast({
      toasts: first,
      level: "info",
      message: "Model catalog refreshed.",
      id: "t-2",
      maxToasts: 2,
    });
    expect(duplicate).toEqual([
      {
        id: "t-2",
        level: "info",
        message: "Model catalog refreshed.",
      },
    ]);

    const bounded = upsertToast({
      toasts: [
        ...duplicate,
        {
          id: "t-3",
          level: "warning",
          message: "Export cancelled.",
        },
      ],
      level: "error",
      message: "Export failed.",
      id: "t-4",
      maxToasts: 2,
    });
    expect(bounded).toEqual([
      {
        id: "t-3",
        level: "warning",
        message: "Export cancelled.",
      },
      {
        id: "t-4",
        level: "error",
        message: "Export failed.",
      },
    ]);
  });

  itReq(["U2.6"], "maps toast levels to renderer toast variants", () => {
    expect(resolveToastVariant("info")).toBe("default");
    expect(resolveToastVariant("warning")).toBe("warning");
    expect(resolveToastVariant("error")).toBe("error");
  });

  itReq(["U3.3", "U4.2"], "formats home list totals for councils and agents", () => {
    expect(formatHomeListTotal({ total: 0, singularLabel: "council" })).toBe("0 councils");
    expect(formatHomeListTotal({ total: 1, singularLabel: "council" })).toBe("1 council");
    expect(formatHomeListTotal({ total: 14, singularLabel: "agent" })).toBe("14 agents");
  });

  itReq(
    ["R1.20", "R1.21", "R1.22", "R1.24", "R1.27", "U4.2", "U4.5", "U4.6"],
    "applies immediate agent archive list updates for every archived filter state",
    () => {
      const agents = [
        {
          id: "agent-1",
          name: "Archivist",
          systemPrompt: "Prompt",
          verbosity: null,
          temperature: null,
          tags: [],
          modelRefOrNull: null,
          invalidConfig: false,
          archived: false,
          createdAtUtc: "2026-01-01T00:00:00.000Z",
          updatedAtUtc: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "agent-2",
          name: "Partner",
          systemPrompt: "Prompt",
          verbosity: null,
          temperature: null,
          tags: [],
          modelRefOrNull: null,
          invalidConfig: false,
          archived: false,
          createdAtUtc: "2026-01-02T00:00:00.000Z",
          updatedAtUtc: "2026-01-02T00:00:00.000Z",
        },
      ] as const;

      expect(
        applyAgentArchivedListUpdate({
          agents,
          agentId: "agent-1",
          archived: true,
          archivedFilter: "all",
        }),
      ).toEqual([
        {
          ...agents[0],
          archived: true,
        },
        agents[1],
      ]);

      expect(
        applyAgentArchivedListUpdate({
          agents,
          agentId: "agent-1",
          archived: true,
          archivedFilter: "active",
        }),
      ).toEqual([agents[1]]);

      expect(
        applyAgentArchivedListUpdate({
          agents: [{ ...agents[0], archived: true }],
          agentId: "agent-1",
          archived: false,
          archivedFilter: "archived",
        }),
      ).toEqual([]);
    },
  );

  itReq(
    ["R1.17", "R1.19", "R1.22", "R1.27", "U4.2"],
    "resolves agent home-list clear filters state and defaults",
    () => {
      expect(hasActiveAgentHomeListFilters(DEFAULT_AGENT_HOME_LIST_FILTERS)).toBe(false);
      expect(
        hasActiveAgentHomeListFilters({
          ...DEFAULT_AGENT_HOME_LIST_FILTERS,
          searchText: " planner ",
        }),
      ).toBe(true);
      expect(
        hasActiveAgentHomeListFilters({
          ...DEFAULT_AGENT_HOME_LIST_FILTERS,
          tagFilter: "research",
        }),
      ).toBe(true);
      expect(
        hasActiveAgentHomeListFilters({
          ...DEFAULT_AGENT_HOME_LIST_FILTERS,
          archivedFilter: "active",
        }),
      ).toBe(true);
      expect(
        hasActiveAgentHomeListFilters({
          ...DEFAULT_AGENT_HOME_LIST_FILTERS,
          sortBy: "createdAt",
        }),
      ).toBe(true);
      expect(
        hasActiveAgentHomeListFilters({
          ...DEFAULT_AGENT_HOME_LIST_FILTERS,
          sortDirection: "asc",
        }),
      ).toBe(true);
    },
  );

  itReq(
    ["R2.22", "R2.24", "U3.2"],
    "resolves council home-list clear filters state and defaults",
    () => {
      expect(hasActiveCouncilHomeListFilters(DEFAULT_COUNCIL_HOME_LIST_FILTERS)).toBe(false);
      expect(
        hasActiveCouncilHomeListFilters({
          ...DEFAULT_COUNCIL_HOME_LIST_FILTERS,
          searchText: " delivery ",
        }),
      ).toBe(true);
      expect(
        hasActiveCouncilHomeListFilters({
          ...DEFAULT_COUNCIL_HOME_LIST_FILTERS,
          tagFilter: "ops",
        }),
      ).toBe(true);
      expect(
        hasActiveCouncilHomeListFilters({
          ...DEFAULT_COUNCIL_HOME_LIST_FILTERS,
          archivedFilter: "archived",
        }),
      ).toBe(true);
      expect(
        hasActiveCouncilHomeListFilters({
          ...DEFAULT_COUNCIL_HOME_LIST_FILTERS,
          sortBy: "createdAt",
        }),
      ).toBe(true);
      expect(
        hasActiveCouncilHomeListFilters({
          ...DEFAULT_COUNCIL_HOME_LIST_FILTERS,
          sortDirection: "asc",
        }),
      ).toBe(true);
    },
  );

  itReq(["U10.11"], "normalizes council config tags from draft text", () => {
    expect(parseCouncilConfigTags(" strategy, planning ,, execution ")).toEqual([
      "strategy",
      "planning",
      "execution",
    ]);
    expect(parseTagDraft(" alpha, beta ")).toEqual(["alpha", "beta"]);
  });

  itReq(["U10.11"], "appends council config tags with ui-friendly validation", () => {
    expect(
      appendCouncilConfigTag({
        currentTags: ["strategy"],
        tagInput: "planning",
      }),
    ).toEqual({
      ok: true,
      tags: ["strategy", "planning"],
    });

    expect(
      appendCouncilConfigTag({
        currentTags: ["strategy"],
        tagInput: "  ",
      }),
    ).toEqual({
      ok: false,
      message: "Enter a tag first.",
    });

    expect(
      appendCouncilConfigTag({
        currentTags: ["strategy"],
        tagInput: "Strategy",
      }),
    ).toEqual({
      ok: false,
      message: "Tag is already added.",
    });

    expect(
      appendCouncilConfigTag({
        currentTags: ["one", "two", "three"],
        tagInput: "four",
      }),
    ).toEqual({
      ok: false,
      message: "Only 3 tags are allowed.",
    });

    expect(
      appendCouncilConfigTag({
        currentTags: ["strategy"],
        tagInput: "this-tag-is-way-too-long-for-the-rule",
      }),
    ).toEqual({
      ok: false,
      message: "Each tag must be 20 characters or fewer.",
    });
  });

  itReq(["R5.3", "R5.6"], "normalizes renderer tag drafts with shared tag rules", () => {
    expect(normalizeTagsDraft({ tagsInput: " strategy, planning " })).toEqual({
      ok: true,
      tags: ["strategy", "planning"],
    });

    expect(normalizeTagsDraft({ tagsInput: "strategy, Strategy" })).toEqual({
      ok: false,
      message: "Tag is already added.",
    });

    expect(normalizeTagsDraft({ tagsInput: "this-tag-is-way-too-long-for-the-rule" })).toEqual({
      ok: false,
      message: "Each tag must be 20 characters or fewer.",
    });
  });

  itReq(
    ["R1.15", "R2.20", "R5.3", "R5.6", "U10.10", "U10.11"],
    "applies shared chip-editor add and remove helpers across tag surfaces",
    () => {
      expect(
        appendTagToDraft({
          currentDraftValue: "strategy",
          tagInput: "planning",
        }),
      ).toEqual({
        ok: true,
        draftValue: "strategy, planning",
        tags: ["strategy", "planning"],
      });

      expect(
        removeTagFromDraft({
          currentDraftValue: "strategy, planning",
          tagToRemove: "Strategy",
        }),
      ).toEqual({
        draftValue: "planning",
        tags: ["planning"],
      });
    },
  );

  itReq(
    ["R5.7", "R5.8", "U10.11"],
    "resolves inline tag editor keyboard behavior and committed chip helper messaging",
    () => {
      expect(
        resolveTagEditorInputKeyAction({
          key: "Enter",
          draftValue: "ops",
          committedTags: [],
        }),
      ).toBe("submit");
      expect(
        resolveTagEditorInputKeyAction({
          key: "Escape",
          draftValue: "ops",
          committedTags: [],
        }),
      ).toBe("clearDraft");
      expect(
        resolveTagEditorInputKeyAction({
          key: "Backspace",
          draftValue: "",
          committedTags: ["ops"],
        }),
      ).toBe("removeLastTag");
      expect(commitTagFilterDraft("  ops  ")).toBe("ops");
      expect(
        appendCommittedTagFilter({
          currentTagFilter: "ops",
          tagInput: "research",
        }),
      ).toEqual({
        ok: true,
        tagFilter: "ops, research",
        tags: ["ops", "research"],
      });
      expect(
        removeCommittedTagFilter({
          currentTagFilter: "ops, research",
          tagToRemove: "ops",
        }),
      ).toEqual({
        tagFilter: "research",
        tags: ["research"],
      });
      expect(buildTagEditorHelperText({ slotsRemaining: 2 })).toBe(
        "Press Enter or comma to add. Backspace removes the last tag. 2 slots left.",
      );
      expect(buildTagEditorHelperText({ mode: "filter", slotsRemaining: 0 })).toBe(
        "Exact match only. Press Enter or comma to commit the filter.",
      );
    },
  );

  itReq(["U11.2", "U15.2"], "maps confirmation-dialog keyboard actions", () => {
    expect(resolveConfirmDialogKeyboardAction("Enter")).toBe("confirm");
    expect(resolveConfirmDialogKeyboardAction("Escape")).toBe("cancel");
    expect(resolveConfirmDialogKeyboardAction("Tab")).toBe("none");
  });

  itReq(["U15.2"], "maps list disclosure keyboard close action", () => {
    expect(resolveDisclosureKeyboardAction("Escape")).toBe("close");
    expect(resolveDisclosureKeyboardAction("Enter")).toBe("openFirstItem");
    expect(resolveDisclosureKeyboardAction(" ")).toBe("openFirstItem");
    expect(resolveDisclosureKeyboardAction("ArrowDown")).toBe("openFirstItem");
    expect(resolveDisclosureKeyboardAction("ArrowUp")).toBe("openLastItem");
    expect(resolveDisclosureKeyboardAction("Tab")).toBe("none");
  });

  itReq(
    ["U15.3"],
    "builds descriptive accessibility labels for badges and tooltip controls",
    () => {
      expect(buildInvalidConfigBadgeAriaLabel("Agent editor model")).toBe(
        "Agent editor model has invalid configuration",
      );

      expect(
        buildProviderConfiguredBadgeAriaLabel({
          providerLabel: "OpenRouter",
          configured: true,
        }),
      ).toBe("OpenRouter is configured");
      expect(
        buildProviderConfiguredBadgeAriaLabel({
          providerLabel: "OpenRouter",
          configured: false,
        }),
      ).toBe("OpenRouter is not configured");

      expect(
        buildProviderConnectionTestButtonAriaLabel({
          providerLabel: "Gemini",
          connectionTestAllowed: true,
        }),
      ).toBe("Test Gemini connection");
      expect(
        buildProviderConnectionTestButtonAriaLabel({
          providerLabel: "Gemini",
          connectionTestAllowed: false,
        }),
      ).toBe("Test Gemini connection disabled until endpoint or API key changes");
      expect(appUiHelpers.buildProviderDisconnectButtonAriaLabel("Gemini")).toBe(
        "Disconnect Gemini provider",
      );
      expect(
        buildProviderConnectionTestButtonAriaLabel({
          providerLabel: "Gemini",
          connectionTestAllowed: false,
          requiresDisconnect: true,
        }),
      ).toBe("Test Gemini connection disabled until the provider is disconnected");
    },
  );
});
