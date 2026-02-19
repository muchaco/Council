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

    const loaded = await service.loadSecret({ account: "provider/gemini" });
    expect(loaded.isOk()).toBe(true);
    expect(loaded._unsafeUnwrap()).toBe("top-secret");
  });
});
