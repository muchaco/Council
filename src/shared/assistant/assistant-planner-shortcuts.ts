import type { AssistantContextEnvelope, AssistantPlannedToolCall } from "../ipc/dto.js";

type AssistantPlannerShortcutPlan = {
  plannedCalls: ReadonlyArray<AssistantPlannedToolCall>;
  summary: string;
};

const normalizeRequestText = (text: string): string => text.trim().replace(/\s+/g, " ");

const normalizeShortcutTags = (text: string): ReadonlyArray<string> | null => {
  const tags = text
    .split(",")
    .map((value) => value.trim())
    .filter((value, index, items) => value.length > 0 && items.indexOf(value) === index);

  if (tags.length === 0 || tags.length > 3) {
    return null;
  }

  return tags;
};

const buildCurrentAgentDraftShortcut = (params: {
  sessionId: string;
  userRequest: string;
}): AssistantPlannerShortcutPlan | null => {
  const match = /^rename this draft to (.+?) and set tags to (.+?) without saving\.?$/i.exec(
    normalizeRequestText(params.userRequest),
  );
  if (match === null) {
    return null;
  }

  const nextName = match[1]?.trim() ?? "";
  const tags = normalizeShortcutTags(match[2] ?? "");
  if (nextName.length === 0 || tags === null) {
    return null;
  }

  return {
    summary: `Rename the current draft to ${nextName} and update its tags.`,
    plannedCalls: [
      {
        callId: `set-agent-draft-fields-${params.sessionId}`,
        toolName: "setAgentDraftFields",
        rationale: "Apply the requested rename and tags to the current visible agent draft.",
        input: {
          name: nextName,
          tags,
        },
      },
    ],
  };
};

export const tryBuildAssistantPlannerShortcut = (params: {
  context: AssistantContextEnvelope;
  sessionId: string;
  userRequest: string;
}): AssistantPlannerShortcutPlan | null => {
  if (params.context.viewKind === "agentEdit") {
    return buildCurrentAgentDraftShortcut({
      sessionId: params.sessionId,
      userRequest: params.userRequest,
    });
  }

  return null;
};
