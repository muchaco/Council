import { describe, expect } from "vitest";
import {
  TAG_MAX_PER_OBJECT,
  addTag,
  createTag,
  tagMatchesFilter,
} from "../../src/shared/domain/tag";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["R5.6", "R5.7", "E1", "E2"] as const;

describe("tag value object", () => {
  itReq(FILE_REQUIREMENT_IDS, "accepts valid tags and trims whitespace", () => {
    const result = createTag("  alpha  ");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("alpha");
  });

  itReq(FILE_REQUIREMENT_IDS, "rejects duplicate tags case-insensitively", () => {
    const first = createTag("Alpha")._unsafeUnwrap();
    const result = addTag([first], "alpha");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("TagDuplicate");
  });

  itReq(FILE_REQUIREMENT_IDS, "rejects too-short and too-long tags", () => {
    const shortResult = createTag("   ");
    const longResult = createTag("x".repeat(21));

    expect(shortResult.isErr()).toBe(true);
    expect(shortResult._unsafeUnwrapErr()).toBe("TagTooShort");
    expect(longResult.isErr()).toBe(true);
    expect(longResult._unsafeUnwrapErr()).toBe("TagTooLong");
  });

  itReq(FILE_REQUIREMENT_IDS, "enforces max tags per object", () => {
    const tags = ["a", "b", "c"].map((item) => createTag(item)._unsafeUnwrap());
    expect(tags).toHaveLength(TAG_MAX_PER_OBJECT);
    const result = addTag(tags, "d");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("TagLimitExceeded");
  });

  itReq(FILE_REQUIREMENT_IDS, "returns createTag validation failures through addTag", () => {
    const result = addTag([], "   ");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("TagTooShort");
  });

  itReq(FILE_REQUIREMENT_IDS, "matches exact filter case-insensitively", () => {
    const tag = createTag("Autopilot")._unsafeUnwrap();
    expect(tagMatchesFilter(tag, "autopilot")).toBe(true);
    expect(tagMatchesFilter(tag, "pilot")).toBe(false);
  });

  itReq(FILE_REQUIREMENT_IDS, "treats empty filter as match", () => {
    const tag = createTag("Manual")._unsafeUnwrap();
    expect(tagMatchesFilter(tag, "   ")).toBe(true);
  });
});
