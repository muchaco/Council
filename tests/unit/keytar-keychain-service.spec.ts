import { describe, expect, vi } from "vitest";
import {
  type KeytarClient,
  createKeytarKeychainService,
} from "../../src/main/services/keychain/keytar-keychain-service";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["C1", "C2", "H2"] as const;

describe("keytar keychain service", () => {
  itReq(FILE_REQUIREMENT_IDS, "writes credentials via keytar adapter", async () => {
    const setPassword = vi.fn<
      (service: string, account: string, password: string) => Promise<void>
    >(() => Promise.resolve());
    const getPassword = vi.fn<(service: string, account: string) => Promise<string | null>>(() =>
      Promise.resolve("super-secret"),
    );
    const deletePassword = vi.fn<(service: string, account: string) => Promise<boolean>>(() =>
      Promise.resolve(true),
    );

    const keytarClient: KeytarClient = {
      setPassword,
      deletePassword,
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

    const deleted = await service.deleteSecret({ account: "provider/openrouter" });
    expect(deleted.isOk()).toBe(true);
    expect(deletePassword).toHaveBeenCalledWith("council3-test", "provider/openrouter");
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "maps keychain transport failures to unavailable errors",
    async () => {
      const service = createKeytarKeychainService({
        loadClient: () => Promise.reject(new Error("No such interface 'org.freedesktop.secrets'")),
      });

      const result = await service.saveSecret({
        account: "provider/gemini",
        secret: "secret",
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe("KeychainUnavailableError");
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "maps non-availability failures to write errors", async () => {
    const service = createKeytarKeychainService({
      loadClient: () =>
        Promise.resolve({
          setPassword: () => Promise.reject(new Error("Permission denied while writing secret")),
          deletePassword: () => Promise.resolve(true),
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

  itReq(FILE_REQUIREMENT_IDS, "maps non-availability read failures to read errors", async () => {
    const service = createKeytarKeychainService({
      loadClient: () =>
        Promise.resolve({
          setPassword: () => Promise.resolve(),
          deletePassword: () => Promise.resolve(true),
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
