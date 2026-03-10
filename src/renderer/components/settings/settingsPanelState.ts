import type {
  GetSettingsViewResponse,
  ProviderConfigDto,
  ProviderDraftDto,
  ProviderId,
} from "../../../shared/ipc/dto";
import {
  fingerprintProviderDraft,
  isProviderDraftChanged,
  isProviderTestable,
} from "../../../shared/provider-settings-ui.js";

export type SettingsAccordionSection = "providers" | "general";

export type ProviderDraftState = {
  providerId: ProviderId;
  endpointUrl: string;
  apiKey: string;
  testToken: string | null;
  testStatusText: string;
  message: string;
  isTesting: boolean;
  isSaving: boolean;
  isDisconnecting: boolean;
};

export type SettingsViewState =
  | { status: "idle" }
  | { status: "ready"; data: GetSettingsViewResponse }
  | { status: "error"; message: string };

export const DEFAULT_SETTINGS_ACCORDION_SECTIONS: Array<SettingsAccordionSection> = ["providers"];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Gemini",
  ollama: "Ollama",
  openrouter: "OpenRouter",
};

const toInitialDraftState = (provider: ProviderConfigDto): ProviderDraftState => ({
  providerId: provider.providerId,
  endpointUrl: provider.endpointUrl ?? "",
  apiKey: "",
  testToken: null,
  testStatusText: "Not tested",
  message: "",
  isTesting: false,
  isSaving: false,
  isDisconnecting: false,
});

export const toProviderDraftMap = (
  providers: ReadonlyArray<ProviderConfigDto>,
): Record<ProviderId, ProviderDraftState> =>
  providers.reduce<Record<ProviderId, ProviderDraftState>>(
    (acc, provider) => {
      acc[provider.providerId] = toInitialDraftState(provider);
      return acc;
    },
    {
      gemini: toInitialDraftState({
        providerId: "gemini",
        endpointUrl: null,
        hasCredential: false,
        lastSavedAtUtc: null,
      }),
      ollama: toInitialDraftState({
        providerId: "ollama",
        endpointUrl: null,
        hasCredential: false,
        lastSavedAtUtc: null,
      }),
      openrouter: toInitialDraftState({
        providerId: "openrouter",
        endpointUrl: null,
        hasCredential: false,
        lastSavedAtUtc: null,
      }),
    },
  );

export const buildSavedFingerprints = (
  draftMap: Record<ProviderId, ProviderDraftState>,
): Record<ProviderId, string> => ({
  gemini: fingerprintProviderDraft(draftMap.gemini),
  ollama: fingerprintProviderDraft(draftMap.ollama),
  openrouter: fingerprintProviderDraft(draftMap.openrouter),
});

export const toProviderDraftDto = (provider: ProviderDraftState): ProviderDraftDto => ({
  providerId: provider.providerId,
  endpointUrl: provider.endpointUrl.trim() || null,
  apiKey: provider.apiKey.trim() || null,
});

export const isSaveAllowed = (provider: ProviderDraftState): boolean =>
  provider.testToken !== null &&
  !provider.isTesting &&
  !provider.isSaving &&
  !provider.isDisconnecting;

export const isConnectionTestAllowed = (params: {
  provider: ProviderDraftState;
  savedFingerprint: string | null;
  requiresDisconnect: boolean;
}): boolean => {
  const { provider, savedFingerprint, requiresDisconnect } = params;
  if (provider.isTesting || provider.isSaving || provider.isDisconnecting || requiresDisconnect) {
    return false;
  }
  if (!isProviderTestable(provider)) {
    return false;
  }
  return isProviderDraftChanged({ provider, savedFingerprint });
};
