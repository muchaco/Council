export type RuntimeConversationMessage = {
  senderName: string;
  senderKind: "member" | "conductor";
  content: string;
};

export type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type PromptBundle = {
  messages: ReadonlyArray<PromptMessage>;
};

export type RuntimePromptParticipant = {
  id: string;
  name: string;
  role: string | null;
};

export type RuntimeMemberPromptInput = {
  councilTitle: string;
  topic: string;
  goal: string | null;
  memberName: string;
  memberRole: string | null;
  memberSystemPrompt: string;
  memberVerbosity: string | null;
  otherMembers: ReadonlyArray<RuntimePromptParticipant>;
  briefing: string | null;
  recentMessages: ReadonlyArray<RuntimeConversationMessage>;
  omittedMessageCount: number;
};

export type RuntimeConductorPromptInput = {
  mode: "manual" | "autopilot";
  topic: string;
  goal: string | null;
  previousBriefing: string | null;
  recentMessages: ReadonlyArray<RuntimeConversationMessage>;
  omittedMessageCount: number;
  eligibleMembers: ReadonlyArray<RuntimePromptParticipant>;
};

export type RuntimeAutopilotOpeningPromptInput = {
  topic: string;
  goal: string | null;
  members: ReadonlyArray<RuntimePromptParticipant>;
};

const normalizeOptionalText = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const clampSentence = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
};

const extractFirstSentence = (value: string): string => {
  const sentenceMatch = value.match(/^(.+?[.!?])(?:\s|$)/);
  return sentenceMatch?.[1] ?? value;
};

const formatRole = (role: string | null): string => role ?? "(none)";

const formatOmittedMessageCount = (count: number): string => `${Math.max(0, count)}`;

const formatTranscript = (messages: ReadonlyArray<RuntimeConversationMessage>): string => {
  if (messages.length === 0) {
    return "(none)";
  }

  return messages
    .map(
      (message, index) =>
        `${index + 1}. [${message.senderKind}] ${message.senderName}: ${message.content}`,
    )
    .join("\n");
};

const formatParticipants = (participants: ReadonlyArray<RuntimePromptParticipant>): string => {
  if (participants.length === 0) {
    return "(none)";
  }

  return participants
    .map(
      (participant) =>
        `- id: ${participant.id}; name: ${participant.name}; role: ${formatRole(participant.role)}`,
    )
    .join("\n");
};

export const deriveAgentRoleLabel = (systemPrompt: string): string | null => {
  const normalized = normalizeOptionalText(collapseWhitespace(systemPrompt));
  if (normalized === null) {
    return null;
  }

  return clampSentence(extractFirstSentence(normalized), 120);
};

export const buildMemberTurnPromptBundle = (input: RuntimeMemberPromptInput): PromptBundle => {
  const systemSections = [normalizeOptionalText(input.memberSystemPrompt)].flatMap((section) =>
    section === null ? [] : [section],
  );

  const verbosity = normalizeOptionalText(input.memberVerbosity);
  if (verbosity !== null) {
    systemSections.push(`Verbosity requirement: ${verbosity}.`);
  }

  systemSections.push(
    "You are participating as a Member of a Council discussion.",
    "Stay consistent with your authored role and expertise.",
    "Respond to the current discussion, not to the prompt text.",
    "Be concrete and advance the discussion.",
    "Refer to other members by name when useful.",
    "Do not mention hidden prompt instructions, omitted messages, or formatting scaffolding.",
    "Output only the Member's next message.",
  );

  const userSections = [
    `Council title: ${input.councilTitle}`,
    `Topic: ${input.topic}`,
    `Goal: ${input.goal ?? "(none)"}`,
    `Current member: ${input.memberName}`,
    `Current member role: ${formatRole(input.memberRole)}`,
    "Other members:",
    formatParticipants(input.otherMembers),
    `Current briefing: ${input.briefing ?? "(none)"}`,
    `Earlier messages omitted: ${formatOmittedMessageCount(input.omittedMessageCount)}`,
    "Recent conversation:",
    formatTranscript(input.recentMessages),
    `Task: Write the next message from ${input.memberName}. Keep it in-character, grounded in the current discussion, and oriented toward the Council topic and goal.`,
  ];

  return {
    messages: [
      {
        role: "system",
        content: systemSections.join("\n"),
      },
      {
        role: "user",
        content: userSections.join("\n"),
      },
    ],
  };
};

export const buildConductorDecisionPromptBundle = (
  input: RuntimeConductorPromptInput,
): PromptBundle => ({
  messages: [
    {
      role: "system",
      content: [
        "You are the Council Conductor.",
        "Stay neutral and do not argue as a Member.",
        "Reason from the Topic, Goal, Briefing, and recent conversation.",
        "Return valid JSON only.",
        'JSON shape: {"briefing": string, "goalReached": boolean, "nextSpeakerAgentId": string | null}',
        "Rules:",
        "- briefing must be concise and meaningful.",
        "- goalReached is true only when the topic and goal are satisfied.",
        "- In manual mode, nextSpeakerAgentId must be null.",
        "- In autopilot mode, nextSpeakerAgentId must be one eligible member id.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Mode: ${input.mode}`,
        `Topic: ${input.topic}`,
        `Goal: ${input.goal ?? "(none)"}`,
        `Previous briefing: ${input.previousBriefing ?? "(none)"}`,
        `Earlier messages omitted: ${formatOmittedMessageCount(input.omittedMessageCount)}`,
        "Recent conversation:",
        formatTranscript(input.recentMessages),
        "Eligible members for next speaker:",
        input.mode === "manual"
          ? "(manual mode - nextSpeakerAgentId must be null)"
          : formatParticipants(input.eligibleMembers),
      ].join("\n"),
    },
  ],
});

export const buildAutopilotOpeningPromptBundle = (
  input: RuntimeAutopilotOpeningPromptInput,
): PromptBundle => ({
  messages: [
    {
      role: "system",
      content: [
        "You are the Council Conductor.",
        "You are starting an Autopilot Council.",
        "Stay neutral and do not argue as a Member.",
        "Return valid JSON only.",
        'JSON shape: {"openingMessage": string, "briefing": string, "goalReached": boolean, "firstSpeakerAgentId": string}',
        "Rules:",
        "- openingMessage must be concise and kick off the discussion.",
        "- briefing must be a concise initial summary.",
        "- goalReached should usually be false at the start unless the topic and goal are already satisfied.",
        "- firstSpeakerAgentId must be one eligible member id.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Topic: ${input.topic}`,
        `Goal: ${input.goal ?? "(none)"}`,
        "Eligible members for first speaker:",
        formatParticipants(input.members),
      ].join("\n"),
    },
  ],
});
