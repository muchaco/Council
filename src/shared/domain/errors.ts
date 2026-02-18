export const DOMAIN_ERROR_KINDS = [
  "ValidationError",
  "NotFoundError",
  "ConflictError",
  "InvalidConfigError",
  "StateViolationError",
  "ProviderError",
  "InternalError",
] as const;

export type DomainErrorKind = (typeof DOMAIN_ERROR_KINDS)[number];

export type DomainError = {
  kind: DomainErrorKind;
  devMessage: string;
  userMessage: string;
  details?: Record<string, unknown>;
};

export const domainError = (
  kind: DomainErrorKind,
  devMessage: string,
  userMessage: string,
  details?: Record<string, unknown>,
): DomainError => ({
  kind,
  devMessage,
  userMessage,
  details,
});
