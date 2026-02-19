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
    const getPassword = vi.fn<(service: string, account: string) => Promise<string | null>>(() =>
      Promise.resolve("super-secret"),
    );

    const keytarClient: KeytarClient = {
      setPassword,
      getPassword,
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

    const loaded = await service.loadSecret({
      account: "provider/openrouter",
    });
    expect(loaded.isOk()).toBe(true);
    expect(loaded._unsafeUnwrap()).toBe("super-secret");
    expect(getPassword).toHaveBeenCalledWith("council3-test", "provider/openrouter");
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
          getPassword: () => Promise.resolve(null),
        }),
    });

    const result = await service.saveSecret({
      account: "provider/gemini",
      secret: "secret",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("KeychainWriteError");
  });

  it("maps non-availability read failures to read errors", async () => {
    const service = createKeytarKeychainService({
      loadClient: () =>
        Promise.resolve({
          setPassword: () => Promise.resolve(),
          getPassword: () => Promise.reject(new Error("Permission denied while reading secret")),
        }),
    });

    const result = await service.loadSecret({
      account: "provider/gemini",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("KeychainReadError");
  });
});
