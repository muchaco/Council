import type { CouncilMessageDto } from "./ipc/dto.js";

const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

const DEFAULT_MEMBER_ACCENT_COLOR = "#0f766e";
const DEFAULT_CONDUCTOR_ACCENT_COLOR = "#1d4ed8";

export type TranscriptMessageAlignment = "left" | "right";

export type ThinkingPlaceholderSpeakerIdParams = {
  generation: {
    status: "idle" | "running";
    activeMemberAgentId: string | null;
  };
  pendingManualMemberAgentId: string | null;
};

export const resolveTranscriptMessageAlignment = (
  message: Pick<CouncilMessageDto, "senderKind">,
): TranscriptMessageAlignment => (message.senderKind === "conductor" ? "right" : "left");

export const resolveThinkingPlaceholderSpeakerId = (
  params: ThinkingPlaceholderSpeakerIdParams,
): string | null => {
  if (params.generation.status === "running" && params.generation.activeMemberAgentId !== null) {
    return params.generation.activeMemberAgentId;
  }

  return params.pendingManualMemberAgentId;
};

export const shouldRenderInlineThinkingCancel = (params: {
  generationActive: boolean;
  thinkingSpeakerId: string | null;
}): boolean => params.generationActive && params.thinkingSpeakerId !== null;

export const resolveTranscriptAccentColor = (
  message: Pick<CouncilMessageDto, "senderKind" | "senderAgentId">,
  memberColorsByAgentId: Readonly<Record<string, string>>,
): string => {
  if (message.senderKind === "conductor") {
    return DEFAULT_CONDUCTOR_ACCENT_COLOR;
  }

  if (message.senderAgentId !== null) {
    const color = memberColorsByAgentId[message.senderAgentId];
    if (color !== undefined && HEX_COLOR_PATTERN.test(color)) {
      return color;
    }
  }

  return DEFAULT_MEMBER_ACCENT_COLOR;
};

export const resolveTranscriptAvatarInitials = (senderName: string): string => {
  const parts = senderName
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "??";
  }

  const firstPart = parts[0];
  if (firstPart === undefined) {
    return "??";
  }

  if (parts.length === 1) {
    return firstPart.slice(0, 2).toUpperCase();
  }

  const secondPart = parts[1];
  return `${firstPart[0] ?? "?"}${secondPart?.[0] ?? "?"}`.toUpperCase();
};
