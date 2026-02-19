import { describe, expect, it } from "vitest";
import { buildCouncilViewExitPlan } from "../../src/shared/council-view-runtime-guards";

describe("council view runtime guards", () => {
  it("requires confirmation and pause when autopilot is running", () => {
    const plan = buildCouncilViewExitPlan(
      {
        mode: "autopilot",
        started: true,
        paused: false,
      },
      {
        status: "idle",
      },
    );

    expect(plan).toEqual({
      requiresConfirmation: true,
      shouldPauseAutopilot: true,
      shouldCancelGeneration: false,
    });
  });

  it("requires confirmation and cancellation when generation is running", () => {
    const plan = buildCouncilViewExitPlan(
      {
        mode: "manual",
        started: true,
        paused: false,
      },
      {
        status: "running",
      },
    );

    expect(plan).toEqual({
      requiresConfirmation: true,
      shouldPauseAutopilot: false,
      shouldCancelGeneration: true,
    });
  });

  it("does not require confirmation when autopilot is already paused and idle", () => {
    const plan = buildCouncilViewExitPlan(
      {
        mode: "autopilot",
        started: true,
        paused: true,
      },
      {
        status: "idle",
      },
    );

    expect(plan).toEqual({
      requiresConfirmation: false,
      shouldPauseAutopilot: false,
      shouldCancelGeneration: false,
    });
  });
});
