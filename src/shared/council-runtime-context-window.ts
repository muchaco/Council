export const DEFAULT_CONTEXT_LAST_N = 12;
export const MIN_CONTEXT_LAST_N = 1;
export const MAX_CONTEXT_LAST_N = 200;

export type ContextWindowSelection<T> = {
  messages: ReadonlyArray<T>;
  omittedCount: number;
};

export const normalizeContextLastN = (
  value: number,
  fallback: number = DEFAULT_CONTEXT_LAST_N,
): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.trunc(value);
  if (normalized < MIN_CONTEXT_LAST_N) {
    return MIN_CONTEXT_LAST_N;
  }
  if (normalized > MAX_CONTEXT_LAST_N) {
    return MAX_CONTEXT_LAST_N;
  }
  return normalized;
};

export const selectLastNContextMessages = <T>(
  messages: ReadonlyArray<T>,
  contextLastN: number,
): ContextWindowSelection<T> => {
  const normalizedLastN = normalizeContextLastN(contextLastN);
  if (messages.length <= normalizedLastN) {
    return {
      messages,
      omittedCount: 0,
    };
  }

  return {
    messages: messages.slice(messages.length - normalizedLastN),
    omittedCount: messages.length - normalizedLastN,
  };
};
