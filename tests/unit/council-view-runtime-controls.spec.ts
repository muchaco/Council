import { describe, expect } from "vitest";
import { resolveCouncilViewRuntimeControls } from "../../src/shared/council-view-runtime-controls.js";
import { itReq } from "../helpers/requirement-trace";

describe("council view runtime controls", () => {
  itReq(["U8.9", "U12.1"], "shows Start in empty-state panel before autopilot begins", () => {
    const controls = resolveCouncilViewRuntimeControls({
      mode: "autopilot",
      started: false,
      paused: false,
      archived: false,
      messageCount: 0,
    });

    expect(controls.canStart).toBe(true);
    expect(controls.showEmptyStateStart).toBe(true);
    expect(controls.showTopBarStart).toBe(false);
  });

  itReq(
    ["U8.10", "U12.3"],
    "hides empty-state Start after first message and keeps autopilot controls state-machine driven",
    () => {
      const controls = resolveCouncilViewRuntimeControls({
        mode: "autopilot",
        started: false,
        paused: false,
        archived: false,
        messageCount: 1,
      });

      expect(controls.showEmptyStateStart).toBe(false);
      expect(controls.showTopBarStart).toBe(false);
      expect(controls.canPause).toBe(false);
      expect(controls.canResume).toBe(false);
    },
  );

  itReq(["U12.3"], "surfaces Pause only while autopilot is running", () => {
    const controls = resolveCouncilViewRuntimeControls({
      mode: "autopilot",
      started: true,
      paused: false,
      archived: false,
      messageCount: 1,
    });

    expect(controls.canStart).toBe(false);
    expect(controls.canPause).toBe(true);
    expect(controls.canResume).toBe(false);
  });

  itReq(["U12.3"], "surfaces Resume only while autopilot is paused", () => {
    const controls = resolveCouncilViewRuntimeControls({
      mode: "autopilot",
      started: true,
      paused: true,
      archived: false,
      messageCount: 1,
    });

    expect(controls.canPause).toBe(false);
    expect(controls.canResume).toBe(true);
  });

  itReq(["U8.9"], "keeps manual Start in top controls instead of empty-state panel", () => {
    const controls = resolveCouncilViewRuntimeControls({
      mode: "manual",
      started: false,
      paused: false,
      archived: false,
      messageCount: 0,
    });

    expect(controls.showTopBarStart).toBe(true);
    expect(controls.showEmptyStateStart).toBe(false);
  });
});
