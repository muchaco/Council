import { type Result, err, ok } from "neverthrow";

export type ConductorDecision = {
  briefing: string;
  goalReached: boolean;
  nextSpeakerAgentId: string | null;
};

export type ConductorOpeningDecision = {
  openingMessage: string;
  briefing: string;
  goalReached: boolean;
  firstSpeakerAgentId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeJsonResponseText = (text: string): string => {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch?.[1]?.trim() ?? trimmed;
};

export const parseConductorDecision = (params: {
  text: string;
  mode: "manual" | "autopilot";
  eligibleMemberAgentIds: ReadonlyArray<string>;
}): Result<ConductorDecision, string> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonResponseText(params.text));
  } catch {
    return err("Conductor response is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    return err("Conductor response must be an object.");
  }

  const briefing = typeof parsed.briefing === "string" ? parsed.briefing.trim() : "";
  if (briefing.length === 0) {
    return err("Conductor response must include a non-empty briefing.");
  }

  if (typeof parsed.goalReached !== "boolean") {
    return err("Conductor response must include goalReached boolean.");
  }

  const nextSpeaker = parsed.nextSpeakerAgentId;
  if (params.mode === "manual") {
    if (nextSpeaker !== null) {
      return err("Conductor next speaker must be null in manual mode.");
    }
    return ok({
      briefing,
      goalReached: parsed.goalReached,
      nextSpeakerAgentId: null,
    });
  }

  if (typeof nextSpeaker !== "string" || nextSpeaker.length === 0) {
    return err("Conductor response must include nextSpeakerAgentId in autopilot mode.");
  }

  if (!params.eligibleMemberAgentIds.includes(nextSpeaker)) {
    return err("Conductor selected speaker is not in the eligible set.");
  }

  return ok({
    briefing,
    goalReached: parsed.goalReached,
    nextSpeakerAgentId: nextSpeaker,
  });
};

export const parseAutopilotOpeningDecision = (params: {
  text: string;
  memberAgentIds: ReadonlyArray<string>;
}): Result<ConductorOpeningDecision, string> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonResponseText(params.text));
  } catch {
    return err("Conductor opening response is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    return err("Conductor opening response must be an object.");
  }

  const openingMessage =
    typeof parsed.openingMessage === "string" ? parsed.openingMessage.trim() : "";
  if (openingMessage.length === 0) {
    return err("Conductor opening response must include a non-empty openingMessage.");
  }

  const briefing = typeof parsed.briefing === "string" ? parsed.briefing.trim() : "";
  if (briefing.length === 0) {
    return err("Conductor opening response must include a non-empty briefing.");
  }

  if (typeof parsed.goalReached !== "boolean") {
    return err("Conductor opening response must include goalReached boolean.");
  }

  const firstSpeakerAgentId =
    typeof parsed.firstSpeakerAgentId === "string" ? parsed.firstSpeakerAgentId.trim() : "";
  if (firstSpeakerAgentId.length === 0) {
    return err("Conductor opening response must include firstSpeakerAgentId.");
  }

  if (!params.memberAgentIds.includes(firstSpeakerAgentId)) {
    return err("Conductor opening speaker is not in the member set.");
  }

  return ok({
    openingMessage,
    briefing,
    goalReached: parsed.goalReached,
    firstSpeakerAgentId,
  });
};
