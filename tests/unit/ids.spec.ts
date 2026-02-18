import { describe, expect, it } from "vitest";
import {
  asAgentId,
  asCouncilId,
  asMemberId,
  asMessageId,
  asProviderId,
} from "../../src/shared/domain/ids";

describe("id branding helpers", () => {
  it("preserves raw values while branding", () => {
    expect(asAgentId("a-1")).toBe("a-1");
    expect(asCouncilId("c-1")).toBe("c-1");
    expect(asMessageId("m-1")).toBe("m-1");
    expect(asProviderId("p-1")).toBe("p-1");
    expect(asMemberId("member-1")).toBe("member-1");
  });
});
