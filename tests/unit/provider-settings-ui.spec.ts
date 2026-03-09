import { describe, expect } from "vitest";
import {
  fingerprintProviderDraft,
  isProviderCardEditable,
  isProviderConfigured,
  isProviderDraftChanged,
  isProviderTestable,
  requiresProviderDisconnect,
  shouldShowProviderTestAndSaveActions,
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

  itReq(["U5.2", "U5.12"], "keeps configured provider cards read-only until disconnect", () => {
    expect(isProviderCardEditable(true)).toBe(false);
    expect(isProviderCardEditable(false)).toBe(true);
  });

  itReq(["U5.3", "U5.12"], "treats provider drafts as testable only after input is written", () => {
    expect(
      isProviderTestable({
        providerId: "gemini",
        endpointUrl: "",
        apiKey: "",
      }),
    ).toBe(false);

    expect(
      isProviderTestable({
        providerId: "gemini",
        endpointUrl: "https://example.test",
        apiKey: "",
      }),
    ).toBe(true);
  });

  itReq(["U5.12"], "requires disconnect before testing replacement provider settings", () => {
    const savedFingerprint = fingerprintProviderDraft({
      providerId: "gemini",
      endpointUrl: "",
      apiKey: "",
    });

    expect(
      requiresProviderDisconnect({
        provider: {
          providerId: "gemini",
          endpointUrl: "",
          apiKey: "new-key",
        },
        savedFingerprint,
        configured: true,
      }),
    ).toBe(true);

    expect(
      requiresProviderDisconnect({
        provider: {
          providerId: "gemini",
          endpointUrl: "",
          apiKey: "new-key",
        },
        savedFingerprint,
        configured: false,
      }),
    ).toBe(false);
  });

  itReq(["U5.3", "U5.12"], "shows test and save only while provider is not configured", () => {
    expect(
      shouldShowProviderTestAndSaveActions({
        provider: {
          providerId: "gemini",
          endpointUrl: "",
          apiKey: "",
          testToken: null,
          isTesting: false,
          isSaving: false,
        },
        configured: true,
        requiresDisconnect: false,
      }),
    ).toBe(false);

    expect(
      shouldShowProviderTestAndSaveActions({
        provider: {
          providerId: "gemini",
          endpointUrl: "https://example.test",
          apiKey: "new-key",
          testToken: null,
          isTesting: false,
          isSaving: false,
        },
        configured: false,
        requiresDisconnect: false,
      }),
    ).toBe(true);
  });
});
