import type { AssistantContextEnvelope, AssistantUserTurnResponse } from "../ipc/dto.js";

const REDACTED_VALUE = "[redacted]";
const SENSITIVE_KEY_PATTERN =
  /(^prompt$|api.?key|secret|credential|token|password|file.?path|path)/i;
const PATH_START_PATTERN = String.raw`(?:~[\\/]|\.{1,2}[\\/]|\/|[A-Za-z]:[\\/])`;
const PATH_TOKEN_PATTERN = String.raw`[^\s,;:!?()[\]{}"'<>]+`;
const PATH_STOP_WORD_PATTERN = String.raw`(?:with|and|or|for|before|after|instead|first|then|from|into|onto|using|via)`;
const RAW_PATH_PATTERN = new RegExp(
  String.raw`${PATH_START_PATTERN}${PATH_TOKEN_PATTERN}(?:\s+(?!${PATH_STOP_WORD_PATTERN}\b)${PATH_TOKEN_PATTERN})*(?=(?:[.,;:!?)]|\s*$|\s${PATH_STOP_WORD_PATTERN}\b))`,
  "g",
);
const PATH_LIKE_TEXT_PATTERN = new RegExp(RAW_PATH_PATTERN.source);
const SECRET_TEXT_PATTERN = /(Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]+)/;
const SECRET_VALUE_PATTERN = /(Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]+)/g;

export type AssistantTextAuditSummary = {
  characterCount: number;
  lineCount: number;
  containsUnsafePathLikeText: boolean;
  containsSecretLikeText: boolean;
};

export type AssistantResponseAuditSummary =
  | {
      kind: "clarification";
      text: AssistantTextAuditSummary;
    }
  | {
      kind: "confirmation";
      approved: boolean;
    };

const createTextAuditSummary = (value: string): AssistantTextAuditSummary => ({
  characterCount: value.length,
  lineCount: value.length === 0 ? 0 : value.split(/\r?\n/u).length,
  containsUnsafePathLikeText: PATH_LIKE_TEXT_PATTERN.test(value),
  containsSecretLikeText: SECRET_TEXT_PATTERN.test(value),
});

export const sanitizeAssistantText = (value: string): string => {
  return value
    .replace(RAW_PATH_PATTERN, REDACTED_VALUE)
    .replace(SECRET_VALUE_PATTERN, REDACTED_VALUE);
};

export const summarizeAssistantUserRequest = (userRequest: string): AssistantTextAuditSummary =>
  createTextAuditSummary(userRequest);

export const summarizeAssistantUserTurnResponse = (
  response: AssistantUserTurnResponse | null,
): AssistantResponseAuditSummary | null => {
  if (response === null) {
    return null;
  }

  if (response.kind === "confirmation") {
    return {
      kind: "confirmation",
      approved: response.approved,
    };
  }

  return {
    kind: "clarification",
    text: createTextAuditSummary(response.text),
  };
};

const sanitizeUnknown = (value: unknown, keyHint?: string): unknown => {
  if (keyHint !== undefined && SENSITIVE_KEY_PATTERN.test(keyHint)) {
    return REDACTED_VALUE;
  }

  if (typeof value === "string") {
    return sanitizeAssistantText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeUnknown(entry));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeUnknown(entry, key)]),
    );
  }

  return value;
};

export const sanitizeAssistantContext = (
  context: AssistantContextEnvelope,
): AssistantContextEnvelope => sanitizeUnknown(context) as AssistantContextEnvelope;

export const sanitizeAssistantPayload = <T>(payload: T): T => sanitizeUnknown(payload) as T;

export const sanitizeAssistantAuditPayload = <T>(payload: T): T =>
  sanitizeAssistantPayload(payload);
