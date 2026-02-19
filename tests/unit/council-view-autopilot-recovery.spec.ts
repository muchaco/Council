import { describe, expect } from "vitest";
import {
  buildAutopilotRecoveryNotice,
  buildManualRetryNotice,
} from "../../src/shared/council-view-autopilot-recovery";
import { itReq } from "../helpers/requirement-trace";

describe("council view autopilot recovery", () => {
  itReq(["U12.6"], "returns notice when autopilot is paused with runtime error", () => {
    const notice = buildAutopilotRecoveryNotice({
      council: {
        mode: "autopilot",
        started: true,
        paused: true,
      },
      runtimeMessage: "Message generation failed.",
    });

    expect(notice).toContain("Autopilot paused after an error");
    expect(notice).toContain("Resume to retry");
  });

  itReq(["U12.6"], "returns null when message is empty", () => {
    const notice = buildAutopilotRecoveryNotice({
      council: {
        mode: "autopilot",
        started: true,
        paused: true,
      },
      runtimeMessage: "   ",
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
      runtimeMessage: "Message generation failed.",
    });

    const runningAutopilotNotice = buildAutopilotRecoveryNotice({
      council: {
        mode: "autopilot",
        started: true,
        paused: false,
      },
      runtimeMessage: "Message generation failed.",
    });

    expect(manualNotice).toBeNull();
    expect(runningAutopilotNotice).toBeNull();
  });

  itReq(["U13.4"], "returns manual retry guidance copy for manual runtime errors", () => {
    const notice = buildManualRetryNotice({
      council: {
        mode: "manual",
      },
      runtimeMessage: "Message generation failed.",
    });

    expect(notice).toContain("Message generation failed.");
    expect(notice).toContain("same member or a different member to retry");
  });

  itReq(["U13.4"], "returns null manual retry guidance for non-manual mode or empty text", () => {
    expect(
      buildManualRetryNotice({
        council: {
          mode: "autopilot",
        },
        runtimeMessage: "Message generation failed.",
      }),
    ).toBeNull();
    expect(
      buildManualRetryNotice({
        council: {
          mode: "manual",
        },
        runtimeMessage: "   ",
      }),
    ).toBeNull();
  });
});
