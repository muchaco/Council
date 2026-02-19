export type ProviderDraftSnapshot = {
  providerId: string;
  endpointUrl: string;
  apiKey: string;
};

export const fingerprintProviderDraft = (provider: ProviderDraftSnapshot): string =>
  JSON.stringify({
    providerId: provider.providerId,
    endpointUrl: provider.endpointUrl.trim() || null,
    apiKey: provider.apiKey.trim() || null,
  });

export const isProviderDraftChanged = (params: {
  provider: ProviderDraftSnapshot;
  savedFingerprint: string | null;
}): boolean => {
  const { provider, savedFingerprint } = params;
  if (savedFingerprint === null) {
    return true;
  }

  return fingerprintProviderDraft(provider) !== savedFingerprint;
};

export const isProviderConfigured = (provider: {
  hasCredential: boolean;
  lastSavedAtUtc: string | null;
}): boolean => provider.hasCredential || provider.lastSavedAtUtc !== null;
