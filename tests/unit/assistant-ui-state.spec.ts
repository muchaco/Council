import { describe, expect } from "vitest";

import {
  applyAssistantPlanResult,
  applyAssistantStopResult,
  beginAssistantPlanning,
  closeAssistantUi,
  createInitialAssistantUiState,
  isAssistantBusy,
  openAssistantForScope,
  rebaseAssistantForScopeChange,
  requiresAssistantCloseConfirmation,
  shouldApplyAssistantAsyncUpdate,
  shouldContinueAssistantPendingRequest,
  shouldSubmitAssistantInput,
} from "../../src/renderer/components/assistant/assistant-ui-state";
import { itReq } from "../helpers/requirement-trace";

describe("assistant ui state", () => {
  itReq(
    ["R9.17", "U18.7", "U18.8", "U18.10", "U18.11", "U18.15"],
    "transitions through clarify confirm and result phases with visible conversation entries",
    () => {
      const planningState = beginAssistantPlanning({
        requestText: "Open the newest council",
        responseLabel: null,
        state: createInitialAssistantUiState(),
        userMessageText: "Open the newest council",
      });

      expect(planningState.phase.status).toBe("planning");
      expect(planningState.messages).toHaveLength(1);

      const clarifyState = applyAssistantPlanResult({
        requestText: "Open the newest council",
        result: {
          kind: "clarify",
          message: "Do you want the newest active or archived council?",
          planSummary: null,
          plannedCalls: [],
          sessionId: "session-1",
        },
        state: planningState,
      });

      expect(clarifyState.phase.status).toBe("clarify");

      const confirmState = applyAssistantPlanResult({
        requestText: "Open the newest council",
        result: {
          confirmation: {
            affectedCount: 1,
            draftImpact: "none",
            examples: ["Quarterly Council"],
            reversible: true,
            scopeDescription: "Open the newest active council.",
            summary: "Open Quarterly Council.",
          },
          kind: "confirm",
          message: "I can open Quarterly Council for you.",
          planSummary: "Open Quarterly Council.",
          plannedCalls: [],
          sessionId: "session-1",
        },
        state: clarifyState,
      });

      expect(confirmState.phase.status).toBe("confirm");

      const resultState = applyAssistantPlanResult({
        requestText: "Open the newest council",
        result: {
          destinationLabel: "Quarterly Council",
          error: null,
          executionResults: [],
          kind: "result",
          message: "Opened Quarterly Council.",
          outcome: "success",
          planSummary: "Open Quarterly Council.",
          plannedCalls: [],
          requiresUserAction: false,
          sessionId: "session-1",
        },
        state: confirmState,
      });

      expect(resultState.phase.status).toBe("success");
      expect(resultState.messages.at(-1)?.text).toBe("Opened Quarterly Council.");
    },
  );

  itReq(
    ["R9.16", "R9.17", "U18.6", "U18.13", "U18.14"],
    "distinguishes active assistant work for keyboard submit and close confirmation behavior",
    () => {
      expect(shouldSubmitAssistantInput({ key: "Enter", shiftKey: false })).toBe(true);
      expect(shouldSubmitAssistantInput({ key: "Enter", shiftKey: true })).toBe(false);

      const planningPhase = beginAssistantPlanning({
        requestText: "Review this draft",
        responseLabel: null,
        state: createInitialAssistantUiState(),
        userMessageText: "Review this draft",
      }).phase;

      expect(isAssistantBusy(planningPhase)).toBe(true);
      expect(requiresAssistantCloseConfirmation(planningPhase)).toBe(true);
      expect(requiresAssistantCloseConfirmation({ status: "idle" })).toBe(false);
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.14"],
    "rebases assistant state to a new scope without replaying stale follow-up work",
    () => {
      const openedState = openAssistantForScope({
        scopeKey: "home:councils",
        state: createInitialAssistantUiState(),
      });

      const confirmState = applyAssistantPlanResult({
        requestText: "Review this council",
        result: {
          confirmation: {
            affectedCount: 1,
            draftImpact: "none",
            examples: ["Quarterly Council"],
            reversible: true,
            scopeDescription: "Open Quarterly Council.",
            summary: "Open Quarterly Council.",
          },
          kind: "confirm",
          message: "I can open Quarterly Council for you.",
          planSummary: "Open Quarterly Council.",
          plannedCalls: [],
          sessionId: "session-1",
        },
        state: {
          ...openedState,
          sessionId: "session-1",
          sessionViewKind: "councilsList",
        },
      });

      const rebasedState = rebaseAssistantForScopeChange({
        scopeKey: "agentEditor:new",
        state: confirmState,
      });

      expect(rebasedState.isOpen).toBe(true);
      expect(rebasedState.messages).toHaveLength(0);
      expect(rebasedState.phase.status).toBe("idle");
      expect(rebasedState.asyncToken).toBe(confirmState.asyncToken + 1);
      expect(rebasedState.scopeKey).toBe("agentEditor:new");
      expect(rebasedState.sessionId).toBeNull();
      expect(
        shouldApplyAssistantAsyncUpdate({
          asyncToken: confirmState.asyncToken,
          requestScopeKey: "home:councils",
          sessionId: "session-1",
          state: rebasedState,
        }),
      ).toBe(false);
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.14"],
    "ignores a stopped-session update after the modal rebases to a different scope",
    () => {
      const planningState = beginAssistantPlanning({
        requestText: "Review this council",
        responseLabel: null,
        state: openAssistantForScope({
          scopeKey: "home:councils",
          state: createInitialAssistantUiState(),
        }),
        userMessageText: "Review this council",
      });

      const stateWithSession = {
        ...planningState,
        scopeKey: "home:councils",
        sessionId: "session-1",
        sessionViewKind: "councilsList" as const,
      };

      const rebasedState = rebaseAssistantForScopeChange({
        scopeKey: "agentEditor:new",
        state: stateWithSession,
      });

      expect(
        applyAssistantStopResult({
          asyncToken: stateWithSession.asyncToken,
          requestScopeKey: "home:councils",
          sessionId: "session-1",
          state: rebasedState,
        }),
      ).toBe(rebasedState);
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.14"],
    "invalidates pending async work immediately when the assistant closes",
    () => {
      const planningState = beginAssistantPlanning({
        requestText: "Review this council",
        responseLabel: null,
        state: openAssistantForScope({
          scopeKey: "home:councils",
          state: createInitialAssistantUiState(),
        }),
        userMessageText: "Review this council",
      });

      const closedState = closeAssistantUi({
        ...planningState,
        sessionId: "session-1",
        sessionViewKind: "councilsList" as const,
      });

      expect(closedState.isOpen).toBe(false);
      expect(closedState.scopeKey).toBeNull();
      expect(closedState.sessionId).toBeNull();
      expect(closedState.asyncToken).toBe(planningState.asyncToken + 1);
      expect(
        shouldContinueAssistantPendingRequest({
          asyncToken: planningState.asyncToken,
          requestScopeKey: "home:councils",
          state: closedState,
        }),
      ).toBe(false);
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.14"],
    "invalidates a cancelled in-flight submit even when the session stays in the same scope",
    () => {
      const planningState = beginAssistantPlanning({
        requestText: "Review this council",
        responseLabel: null,
        state: openAssistantForScope({
          scopeKey: "home:councils",
          state: createInitialAssistantUiState(),
        }),
        userMessageText: "Review this council",
      });

      const stateWithSession = {
        ...planningState,
        scopeKey: "home:councils",
        sessionId: "session-1",
        sessionViewKind: "councilsList" as const,
      };

      const cancelledState = applyAssistantStopResult({
        asyncToken: stateWithSession.asyncToken,
        requestScopeKey: "home:councils",
        sessionId: "session-1",
        state: stateWithSession,
      });

      expect(cancelledState.phase.status).toBe("cancelled");
      expect(cancelledState.asyncToken).toBe(stateWithSession.asyncToken + 1);
      expect(
        shouldApplyAssistantAsyncUpdate({
          asyncToken: stateWithSession.asyncToken,
          requestScopeKey: "home:councils",
          sessionId: "session-1",
          state: cancelledState,
        }),
      ).toBe(false);
      expect(
        shouldApplyAssistantAsyncUpdate({
          asyncToken: cancelledState.asyncToken,
          requestScopeKey: "home:councils",
          sessionId: "session-1",
          state: cancelledState,
        }),
      ).toBe(true);
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.14"],
    "invalidates session setup work after stop before session creation finishes",
    () => {
      const planningState = beginAssistantPlanning({
        requestText: "Review this council",
        responseLabel: null,
        state: openAssistantForScope({
          scopeKey: "home:councils",
          state: createInitialAssistantUiState(),
        }),
        userMessageText: "Review this council",
      });

      expect(
        shouldContinueAssistantPendingRequest({
          asyncToken: planningState.asyncToken,
          requestScopeKey: "home:councils",
          state: planningState,
        }),
      ).toBe(true);

      const cancelledState = applyAssistantStopResult({
        asyncToken: planningState.asyncToken,
        requestScopeKey: "home:councils",
        sessionId: null,
        state: planningState,
      });

      expect(cancelledState.phase.status).toBe("cancelled");
      expect(cancelledState.sessionId).toBeNull();
      expect(cancelledState.asyncToken).toBe(planningState.asyncToken + 1);
      expect(
        shouldContinueAssistantPendingRequest({
          asyncToken: planningState.asyncToken,
          requestScopeKey: "home:councils",
          state: cancelledState,
        }),
      ).toBe(false);
    },
  );
});
