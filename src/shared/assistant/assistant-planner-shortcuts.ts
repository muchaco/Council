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

const buildCreateAgentShortcut = (params: {
  sessionId: string;
  userRequest: string;
}): AssistantPlannerShortcutPlan | null => {
  const normalizedRequest = normalizeRequestText(params.userRequest);
  const detailedMatch =
    /^create (?:an|another) agent named (.+?) with system prompt (.+?), (.+?) verbosity, temperature ([0-2](?:\.\d+)?), and tags? (.+?)\.?$/i.exec(
      normalizedRequest,
    );

  if (detailedMatch !== null) {
    const name = detailedMatch[1]?.trim() ?? "";
    const systemPrompt = detailedMatch[2]?.trim() ?? "";
    const verbosity = detailedMatch[3]?.trim() ?? "";
    const temperature = Number.parseFloat(detailedMatch[4] ?? "");
    const tags = normalizeShortcutTags(detailedMatch[5] ?? "");
    if (
      name.length === 0 ||
      systemPrompt.length === 0 ||
      verbosity.length === 0 ||
      Number.isNaN(temperature) ||
      tags === null
    ) {
      return null;
    }

    return {
      summary: `Create agent ${name}.`,
      plannedCalls: [
        {
          callId: `create-agent-${params.sessionId}`,
          toolName: "createAgent",
          rationale: "Create the requested agent with the provided saved fields.",
          input: {
            name,
            systemPrompt,
            tags,
            temperature,
            verbosity,
          },
        },
      ],
    };
  }

  const simpleMatch = /^create (?:an|another) agent named (.+?) with system prompt (.+?)\.?$/i.exec(
    normalizedRequest,
  );
  if (simpleMatch === null) {
    return null;
  }

  const name = simpleMatch[1]?.trim() ?? "";
  const systemPrompt = simpleMatch[2]?.trim() ?? "";
  if (name.length === 0 || systemPrompt.length === 0) {
    return null;
  }

  return {
    summary: `Create agent ${name}.`,
    plannedCalls: [
      {
        callId: `create-agent-${params.sessionId}`,
        toolName: "createAgent",
        rationale: "Create the requested agent with the provided saved fields.",
        input: {
          name,
          systemPrompt,
        },
      },
    ],
  };
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

const buildSaveCurrentDraftShortcut = (params: {
  context: AssistantContextEnvelope;
  sessionId: string;
  userRequest: string;
}): AssistantPlannerShortcutPlan | null => {
  if (!/^save this draft\.?$/i.test(normalizeRequestText(params.userRequest))) {
    return null;
  }

  if (params.context.viewKind === "agentEdit") {
    return {
      summary: "Save the current agent draft.",
      plannedCalls: [
        {
          callId: `save-agent-draft-${params.sessionId}`,
          toolName: "saveAgentDraft",
          rationale: "Save the current visible agent draft through the normal editor flow.",
          input: {
            entityId: params.context.activeEntityId,
          },
        },
      ],
    };
  }

  if (params.context.viewKind === "councilCreate") {
    return {
      summary: "Save the current council draft.",
      plannedCalls: [
        {
          callId: `save-council-draft-${params.sessionId}`,
          toolName: "saveCouncilDraft",
          rationale: "Save the current visible council draft through the normal editor flow.",
          input: {
            entityId: params.context.activeEntityId,
          },
        },
      ],
    };
  }

  return null;
};

const buildCurrentCouncilDraftSaveShortcut = (params: {
  sessionId: string;
  userRequest: string;
}): AssistantPlannerShortcutPlan | null => {
  const match = /^rename this council draft to (.+?) and save it\.?$/i.exec(
    normalizeRequestText(params.userRequest),
  );
  if (match === null) {
    return null;
  }

  const nextTitle = match[1]?.trim() ?? "";
  if (nextTitle.length === 0) {
    return null;
  }

  return {
    summary: `Rename the current council draft to ${nextTitle} and save it.`,
    plannedCalls: [
      {
        callId: `set-council-draft-fields-${params.sessionId}`,
        toolName: "setCouncilDraftFields",
        rationale: "Apply the requested council title change to the current visible draft.",
        input: {
          title: nextTitle,
        },
      },
      {
        callId: `save-council-draft-${params.sessionId}`,
        toolName: "saveCouncilDraft",
        rationale: "Save the current visible council draft after applying the requested title.",
        input: {},
      },
    ],
  };
};

const buildCurrentCouncilRenameShortcut = (params: {
  context: AssistantContextEnvelope;
  sessionId: string;
  userRequest: string;
}): AssistantPlannerShortcutPlan | null => {
  if (params.context.activeEntityId === null) {
    return null;
  }

  const match = /^rename this council to (.+?)\.?$/i.exec(normalizeRequestText(params.userRequest));
  if (match === null) {
    return null;
  }

  const nextTitle = match[1]?.trim() ?? "";
  if (nextTitle.length === 0) {
    return null;
  }

  return {
    summary: `Rename this council to ${nextTitle}.`,
    plannedCalls: [
      {
        callId: `update-council-config-${params.sessionId}`,
        toolName: "updateCouncilConfig",
        rationale: "Update the current council title through the normal saved config flow.",
        input: {
          councilId: params.context.activeEntityId,
          title: nextTitle,
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
  const currentDraftSaveShortcut = buildSaveCurrentDraftShortcut(params);
  if (currentDraftSaveShortcut !== null) {
    return currentDraftSaveShortcut;
  }

  if (params.context.viewKind === "agentEdit") {
    const currentAgentDraftShortcut = buildCurrentAgentDraftShortcut({
      sessionId: params.sessionId,
      userRequest: params.userRequest,
    });
    if (currentAgentDraftShortcut !== null) {
      return currentAgentDraftShortcut;
    }
  }

  if (params.context.viewKind === "councilCreate") {
    const currentCouncilDraftShortcut = buildCurrentCouncilDraftSaveShortcut({
      sessionId: params.sessionId,
      userRequest: params.userRequest,
    });
    if (currentCouncilDraftShortcut !== null) {
      return currentCouncilDraftShortcut;
    }
  }

  if (params.context.viewKind === "councilView") {
    const currentCouncilRenameShortcut = buildCurrentCouncilRenameShortcut(params);
    if (currentCouncilRenameShortcut !== null) {
      return currentCouncilRenameShortcut;
    }
  }

  const createAgentShortcut = buildCreateAgentShortcut({
    sessionId: params.sessionId,
    userRequest: params.userRequest,
  });
  if (createAgentShortcut !== null) {
    return createAgentShortcut;
  }

  return null;
};
