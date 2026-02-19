import { describe, expect } from "vitest";
import {
  fingerprintProviderDraft,
  isProviderConfigured,
  isProviderDraftChanged,
} from "../../src/shared/provider-settings-ui.js";
import { itReq } from "../helpers/requirement-trace";

describe("provider settings ui helpers", () => {
  itReq(["U5.3"], "builds stable provider draft fingerprints", () => {
    const first = fingerprintProviderDraft({
      providerId: "gemini",
      endpointUrl: "  https://example.test  ",
      apiKey: "  key-1  ",
    });
    const second = fingerprintProviderDraft({
      providerId: "gemini",
      endpointUrl: "https://example.test",
      apiKey: "key-1",
    });

    expect(first).toBe(second);
  });

  itReq(["U5.3"], "detects provider draft changes against saved fingerprint", () => {
    const savedFingerprint = fingerprintProviderDraft({
      providerId: "openrouter",
      endpointUrl: "https://openrouter.ai/api/v1",
      apiKey: "saved",
    });

    expect(
      isProviderDraftChanged({
        provider: {
          providerId: "openrouter",
          endpointUrl: "https://openrouter.ai/api/v1",
          apiKey: "saved",
        },
        savedFingerprint,
      }),
    ).toBe(false);

    expect(
      isProviderDraftChanged({
        provider: {
          providerId: "openrouter",
          endpointUrl: "https://openrouter.ai/api/v1",
          apiKey: "changed",
        },
        savedFingerprint,
      }),
    ).toBe(true);
  });

  itReq(["U5.2"], "marks provider as configured when saved", () => {
    expect(
      isProviderConfigured({
        hasCredential: true,
        lastSavedAtUtc: null,
      }),
    ).toBe(true);

    expect(
      isProviderConfigured({
        hasCredential: false,
        lastSavedAtUtc: "2026-02-19T00:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      isProviderConfigured({
        hasCredential: false,
        lastSavedAtUtc: null,
      }),
    ).toBe(false);
  });
});
