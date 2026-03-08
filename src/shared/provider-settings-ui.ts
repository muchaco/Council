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

export const requiresProviderDisconnect = (params: {
  provider: ProviderDraftSnapshot;
  savedFingerprint: string | null;
  configured: boolean;
}): boolean =>
  params.configured &&
  isProviderDraftChanged({
    provider: params.provider,
    savedFingerprint: params.savedFingerprint,
  });

export const shouldShowProviderTestAndSaveActions = (params: {
  provider: ProviderDraftSnapshot & {
    testToken: string | null;
    isTesting: boolean;
    isSaving: boolean;
  };
  configured: boolean;
  requiresDisconnect: boolean;
}): boolean => {
  const { configured, provider, requiresDisconnect } = params;
  if (!configured || requiresDisconnect || provider.testToken !== null) {
    return true;
  }

  if (provider.isTesting || provider.isSaving) {
    return true;
  }

  return provider.endpointUrl.trim().length > 0 || provider.apiKey.trim().length > 0;
};

export const isProviderConfigured = (provider: {
  hasCredential: boolean;
  lastSavedAtUtc: string | null;
}): boolean => provider.hasCredential || provider.lastSavedAtUtc !== null;
