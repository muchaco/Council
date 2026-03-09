import { describe, expect } from "vitest";
import { normalizeCouncilRuntimeError } from "../../src/shared/council-runtime-error-normalization.js";
import {
  buildAutopilotRecoveryNotice,
  buildManualRetryNotice,
} from "../../src/shared/council-view-autopilot-recovery";
import { itReq } from "../helpers/requirement-trace";

describe("council view autopilot recovery", () => {
  itReq(
    ["R3.24", "U12.6"],
    "builds autopilot recovery notice from normalized runtime error",
    () => {
      const notice = buildAutopilotRecoveryNotice({
        council: {
          mode: "autopilot",
          started: true,
          paused: true,
        },
        runtimeError: normalizeCouncilRuntimeError({
          message: "HTTP 429 rate limit exceeded",
          providerId: "gemini",
          modelId: "gemini-1.5-flash",
        }),
      });

      expect(notice?.title).toBe("Autopilot paused");
      expect(notice?.body).toContain("Resume");
      expect(notice?.technicalDetails).toContain("Provider: gemini");
    },
  );

  itReq(["U12.6"], "returns null when message is empty", () => {
    const notice = buildAutopilotRecoveryNotice({
      council: {
        mode: "autopilot",
        started: true,
        paused: true,
      },
      runtimeError: null,
    });

    expect(notice).toBeNull();
  });

  itReq(["U12.6"], "returns null when council is not paused autopilot", () => {
    const manualNotice = buildAutopilotRecoveryNotice({
      council: {
        mode: "manual",
        started: true,
        paused: false,
      },
      runtimeError: normalizeCouncilRuntimeError({ message: "Message generation failed." }),
    });

    const runningAutopilotNotice = buildAutopilotRecoveryNotice({
      council: {
        mode: "autopilot",
        started: true,
        paused: false,
      },
      runtimeError: normalizeCouncilRuntimeError({ message: "Message generation failed." }),
    });

    expect(manualNotice).toBeNull();
    expect(runningAutopilotNotice).toBeNull();
  });

  itReq(["R3.28", "U13.4"], "builds manual retry notice from normalized runtime error", () => {
    const notice = buildManualRetryNotice({
      council: {
        mode: "manual",
      },
      runtimeError: normalizeCouncilRuntimeError({
        message: "API key not found",
        providerId: "openrouter",
        modelId: "openai/gpt-4.1-mini",
      }),
    });

    expect(notice?.title).toBe("Turn failed");
    expect(notice?.body).toContain("Check provider settings or choose another model");
    expect(notice?.body).toContain("same member or a different");
    expect(notice?.technicalDetails).toContain("Provider: openrouter");
  });

  itReq(["U13.4"], "returns null manual retry guidance for non-manual mode or empty text", () => {
    expect(
      buildManualRetryNotice({
        council: {
          mode: "autopilot",
        },
        runtimeError: normalizeCouncilRuntimeError({ message: "Message generation failed." }),
      }),
    ).toBeNull();
    expect(
      buildManualRetryNotice({
        council: {
          mode: "manual",
        },
        runtimeError: null,
      }),
    ).toBeNull();
  });
});
