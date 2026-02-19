import { describe, expect } from "vitest";
import { buildAutopilotRecoveryNotice } from "../../src/shared/council-view-autopilot-recovery";
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
});
