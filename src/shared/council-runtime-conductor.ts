import { type Result, err, ok } from "neverthrow";

export type RuntimeConversationMessage = {
  senderName: string;
  senderKind: "member" | "conductor";
  content: string;
};

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

export const buildAutopilotOpeningPrompt = (params: {
  topic: string;
  goal: string | null;
  memberAgentIds: ReadonlyArray<string>;
}): string => {
  const goalSection = params.goal === null ? "(none)" : params.goal;
  const membersSection =
    params.memberAgentIds.length === 0 ? "(none)" : params.memberAgentIds.join(",");

  return [
    "You are the Council Conductor.",
    "You are starting an Autopilot council.",
    "Respond with strict JSON only and no markdown.",
    'JSON shape: {"openingMessage": string, "briefing": string, "goalReached": boolean, "firstSpeakerAgentId": string}',
    "Rules:",
    "- openingMessage must be concise and kick off the discussion.",
    "- briefing must be a concise initial TL;DR state.",
    "- goalReached should usually be false at start unless topic/goal is already satisfied.",
    "- firstSpeakerAgentId must be one of eligible member ids.",
    `Topic: ${params.topic}`,
    `Goal: ${goalSection}`,
    `Eligible members for first speaker: ${membersSection}`,
  ].join("\n");
};

export const buildConductorDecisionPrompt = (params: {
  mode: "manual" | "autopilot";
  topic: string;
  goal: string | null;
  previousBriefing: string | null;
  messages: ReadonlyArray<RuntimeConversationMessage>;
  omittedMessageCount: number;
  eligibleMemberAgentIds: ReadonlyArray<string>;
}): string => {
  const goalSection = params.goal === null ? "(none)" : params.goal;
  const briefingSection = params.previousBriefing ?? "(none)";
  const messagesSection =
    params.messages.length === 0
      ? "(none)"
      : params.messages
          .map(
            (message, index) =>
              `${index + 1}. [${message.senderKind}] ${message.senderName}: ${message.content}`,
          )
          .join("\n");
  const eligibleSection =
    params.mode === "autopilot"
      ? params.eligibleMemberAgentIds.length === 0
        ? "(none)"
        : params.eligibleMemberAgentIds.join(",")
      : "(manual mode - must return null)";

  return [
    "You are the Council Conductor.",
    "Respond with strict JSON only and no markdown.",
    'JSON shape: {"briefing": string, "goalReached": boolean, "nextSpeakerAgentId": string | null}',
    "Rules:",
    "- briefing must be concise and meaningful.",
    "- goalReached must be true only if topic/goal has been satisfied.",
    "- In manual mode, nextSpeakerAgentId must be null.",
    "- In autopilot mode, nextSpeakerAgentId must be one of eligible member ids.",
    `Mode: ${params.mode}`,
    `Topic: ${params.topic}`,
    `Goal: ${goalSection}`,
    `Previous briefing: ${briefingSection}`,
    `Earlier messages omitted: ${params.omittedMessageCount}`,
    "Conversation:",
    messagesSection,
    `Eligible members for next speaker: ${eligibleSection}`,
  ].join("\n");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseConductorDecision = (params: {
  text: string;
  mode: "manual" | "autopilot";
  eligibleMemberAgentIds: ReadonlyArray<string>;
}): Result<ConductorDecision, string> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(params.text);
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
    parsed = JSON.parse(params.text);
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
