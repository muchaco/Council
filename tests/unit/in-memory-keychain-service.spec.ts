import { describe, expect, it } from "vitest";
import { createInMemoryKeychainService } from "../../src/main/services/keychain/in-memory-keychain-service";

describe("in-memory keychain service", () => {
  it("saves credentials through keychain boundary", async () => {
    const service = createInMemoryKeychainService();
    const result = await service.saveSecret({
      account: "provider/gemini",
      secret: "top-secret",
    });

    expect(result.isOk()).toBe(true);
  });
});
