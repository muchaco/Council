import type { CouncilMessageDto } from "./ipc/dto.js";

const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

const DEFAULT_MEMBER_ACCENT_COLOR = "#0f766e";
const DEFAULT_CONDUCTOR_ACCENT_COLOR = "#1d4ed8";

export type TranscriptMessageAlignment = "left" | "right";

export const resolveTranscriptMessageAlignment = (
  message: Pick<CouncilMessageDto, "senderKind">,
): TranscriptMessageAlignment => (message.senderKind === "conductor" ? "right" : "left");

export const resolveTranscriptAccentColor = (
  message: Pick<CouncilMessageDto, "senderKind" | "senderColor">,
): string => {
  if (message.senderColor !== null && HEX_COLOR_PATTERN.test(message.senderColor)) {
    return message.senderColor;
  }

  return message.senderKind === "conductor"
    ? DEFAULT_CONDUCTOR_ACCENT_COLOR
    : DEFAULT_MEMBER_ACCENT_COLOR;
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
