import { describe, expect } from "vitest";
import { buildCouncilViewExitPlan } from "../../src/shared/council-view-runtime-guards";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["R3.12"] as const;

describe("council view runtime guards", () => {
  itReq(FILE_REQUIREMENT_IDS, "requires confirmation and pause when autopilot is running", () => {
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

  itReq(
    FILE_REQUIREMENT_IDS,
    "requires confirmation and cancellation when generation is running",
    () => {
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
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "does not require confirmation when autopilot is already paused and idle",
    () => {
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
    },
  );
});
