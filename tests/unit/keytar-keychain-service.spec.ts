import { describe, expect, it, vi } from "vitest";
import {
  type KeytarClient,
  createKeytarKeychainService,
} from "../../src/main/services/keychain/keytar-keychain-service";

describe("keytar keychain service", () => {
  it("writes credentials via keytar adapter", async () => {
    const setPassword = vi.fn<
      (service: string, account: string, password: string) => Promise<void>
    >(() => Promise.resolve());

    const keytarClient: KeytarClient = {
      setPassword,
    };

    const service = createKeytarKeychainService({
      serviceName: "council3-test",
      keytarClient,
    });

    const result = await service.saveSecret({
      account: "provider/openrouter",
      secret: "super-secret",
    });

    expect(result.isOk()).toBe(true);
    expect(setPassword).toHaveBeenCalledWith(
      "council3-test",
      "provider/openrouter",
      "super-secret",
    );
  });

  it("maps keychain transport failures to unavailable errors", async () => {
    const service = createKeytarKeychainService({
      loadClient: () => Promise.reject(new Error("No such interface 'org.freedesktop.secrets'")),
    });

    const result = await service.saveSecret({
      account: "provider/gemini",
      secret: "secret",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("KeychainUnavailableError");
  });

  it("maps non-availability failures to write errors", async () => {
    const service = createKeytarKeychainService({
      loadClient: () =>
        Promise.resolve({
          setPassword: () => Promise.reject(new Error("Permission denied while writing secret")),
        }),
    });

    const result = await service.saveSecret({
      account: "provider/gemini",
      secret: "secret",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("KeychainWriteError");
  });
});
