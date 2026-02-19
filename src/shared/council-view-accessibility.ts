import type { CouncilMessageDto } from "./ipc/dto.js";

type TranscriptNavigationKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

export type InlineConfigEditKeyboardAction = "save" | "cancel" | "none";

const isTranscriptNavigationKey = (key: string): key is TranscriptNavigationKey =>
  key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End";

export const resolveTranscriptFocusIndex = (params: {
  currentIndex: number;
  key: string;
  totalItems: number;
}): number | null => {
  const { currentIndex, key, totalItems } = params;
  if (!isTranscriptNavigationKey(key) || totalItems <= 0) {
    return null;
  }

  if (key === "Home") {
    return 0;
  }

  if (key === "End") {
    return totalItems - 1;
  }

  if (key === "ArrowDown") {
    return Math.min(currentIndex + 1, totalItems - 1);
  }

  return Math.max(currentIndex - 1, 0);
};

export const buildTranscriptMessageAriaLabel = (message: CouncilMessageDto): string => {
  const senderRole = message.senderKind === "conductor" ? "Conductor" : "Member";
  return `${message.senderName}, ${senderRole}, message ${message.sequenceNumber}, ${message.createdAtUtc}. ${message.content}`;
};

export const resolveInlineConfigEditKeyboardAction = (params: {
  key: string;
  shiftKey: boolean;
}): InlineConfigEditKeyboardAction => {
  if (params.key === "Escape") {
    return "cancel";
  }

  if (params.key === "Enter" && !params.shiftKey) {
    return "save";
  }

  return "none";
};
