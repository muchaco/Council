import { describe, expect } from "vitest";
import { createInMemoryKeychainService } from "../../src/main/services/keychain/in-memory-keychain-service";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["C1"] as const;

describe("in-memory keychain service", () => {
  itReq(FILE_REQUIREMENT_IDS, "saves credentials through keychain boundary", async () => {
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
