import { describe, expect, it } from "vitest";
import { DOMAIN_ERROR_KINDS, domainError } from "../../src/shared/domain/errors";

describe("domain errors", () => {
  it("exposes stable error kinds", () => {
    expect(DOMAIN_ERROR_KINDS).toEqual([
      "ValidationError",
      "NotFoundError",
      "ConflictError",
      "InvalidConfigError",
      "StateViolationError",
      "ProviderError",
      "InternalError",
    ]);
  });

  it("builds typed error objects", () => {
    const error = domainError("ValidationError", "Missing title", "Please provide a title.", {
      field: "title",
    });

    expect(error.kind).toBe("ValidationError");
    expect(error.devMessage).toBe("Missing title");
    expect(error.userMessage).toBe("Please provide a title.");
    expect(error.details).toEqual({ field: "title" });
  });
});
