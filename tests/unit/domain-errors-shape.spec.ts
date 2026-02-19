import { describe, expect } from "vitest";
import { DOMAIN_ERROR_KINDS, domainError } from "../../src/shared/domain/errors";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["E2", "E3"] as const;

describe("domain errors", () => {
  itReq(FILE_REQUIREMENT_IDS, "exposes stable error kinds", () => {
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

  itReq(FILE_REQUIREMENT_IDS, "builds typed error objects", () => {
    const error = domainError("ValidationError", "Missing title", "Please provide a title.", {
      field: "title",
    });

    expect(error.kind).toBe("ValidationError");
    expect(error.devMessage).toBe("Missing title");
    expect(error.userMessage).toBe("Please provide a title.");
    expect(error.details).toEqual({ field: "title" });
  });
});
