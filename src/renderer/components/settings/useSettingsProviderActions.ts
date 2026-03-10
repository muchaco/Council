import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { ProviderId } from "../../../shared/ipc/dto";
import {
  fingerprintProviderDraft,
  isProviderConfigured,
  isProviderDraftChanged,
  requiresProviderDisconnect,
} from "../../../shared/provider-settings-ui.js";
import {
  PROVIDER_LABELS,
  type ProviderDraftState,
  type SettingsViewState,
  toProviderDraftDto,
} from "./settingsPanelState";

type UseSettingsProviderActionsParams = {
  draftsRef: MutableRefObject<Record<ProviderId, ProviderDraftState> | null>;
  loadSettingsView: (options?: {
    preserveDraftInputs?: boolean;
    preserveVisibleStateOnError?: boolean;
  }) => Promise<boolean>;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
  savedDraftFingerprints: Record<ProviderId, string> | null;
  setDrafts: Dispatch<SetStateAction<Record<ProviderId, ProviderDraftState> | null>>;
  settingsViewState: SettingsViewState;
};

export const useSettingsProviderActions = ({
  draftsRef,
  loadSettingsView,
  pushToast,
  savedDraftFingerprints,
  setDrafts,
  settingsViewState,
}: UseSettingsProviderActionsParams) => {
  const updateProviderDraft = (
    providerId: ProviderId,
    updates: Partial<Pick<ProviderDraftState, "endpointUrl" | "apiKey">>,
  ): void => {
    setDrafts((current) => {
      if (current === null) {
        return current;
      }
      return {
        ...current,
        [providerId]: {
          ...current[providerId],
          ...updates,
          testToken: null,
          message: "Connection must be tested again before save.",
          testStatusText: "Not tested",
        },
      };
    });
  };

  const runConnectionTest = async (providerId: ProviderId): Promise<void> => {
    const currentDrafts = draftsRef.current;
    if (currentDrafts === null) {
      return;
    }
    const provider = currentDrafts[providerId];
    const savedFingerprint = savedDraftFingerprints?.[providerId] ?? null;
    const savedProvider =
      settingsViewState.status === "ready"
        ? settingsViewState.data.providers.find((item) => item.providerId === providerId)
        : undefined;
    const needsDisconnect =
      savedProvider !== undefined &&
      requiresProviderDisconnect({
        provider,
        savedFingerprint,
        configured: isProviderConfigured(savedProvider),
      });
    if (needsDisconnect) {
      const warningMessage = "Disconnect the saved provider before testing new settings.";
      pushToast("warning", warningMessage);
      setDrafts((current) =>
        current === null
          ? current
          : {
              ...current,
              [providerId]: {
                ...current[providerId],
                testToken: null,
                testStatusText: "Not tested",
                message: warningMessage,
              },
            },
      );
      return;
    }
    if (!isProviderDraftChanged({ provider, savedFingerprint })) {
      const infoMessage = "No provider changes to test. Edit endpoint or key first.";
      pushToast("info", infoMessage);
      setDrafts((current) =>
        current === null
          ? current
          : { ...current, [providerId]: { ...current[providerId], message: infoMessage } },
      );
      return;
    }

    const initialFingerprint = fingerprintProviderDraft(provider);
    setDrafts((current) =>
      current === null
        ? current
        : {
            ...current,
            [providerId]: {
              ...current[providerId],
              isTesting: true,
              isDisconnecting: false,
              message: "",
            },
          },
    );

    const result = await window.api.providers.testConnection({
      provider: toProviderDraftDto(provider),
    });
    const latestDraft = draftsRef.current?.[providerId] ?? provider;
    const draftChanged = fingerprintProviderDraft(latestDraft) !== initialFingerprint;
    if (result.ok) {
      pushToast(
        draftChanged ? "warning" : "info",
        draftChanged
          ? "Draft changed after test. Re-run test before saving."
          : "Connection test successful. You can save now.",
      );
    } else {
      pushToast("error", result.error.userMessage);
    }

    setDrafts((current) => {
      if (current === null) {
        return current;
      }
      if (result.ok) {
        return {
          ...current,
          [providerId]: {
            ...current[providerId],
            isTesting: false,
            isDisconnecting: false,
            testToken: draftChanged ? null : result.value.testToken,
            testStatusText: result.value.statusText,
            message: "",
          },
        };
      }
      return {
        ...current,
        [providerId]: {
          ...current[providerId],
          isTesting: false,
          isDisconnecting: false,
          testToken: null,
          testStatusText: "Connection failed",
          message: result.error.userMessage,
        },
      };
    });
  };

  const saveProvider = async (providerId: ProviderId): Promise<void> => {
    const currentDrafts = draftsRef.current;
    if (currentDrafts === null) {
      return;
    }
    const provider = currentDrafts[providerId];
    if (provider.testToken === null) {
      const warningMessage = "Run a successful connection test before saving.";
      pushToast("warning", warningMessage);
      setDrafts((current) =>
        current === null
          ? current
          : {
              ...current,
              [providerId]: {
                ...current[providerId],
                isDisconnecting: false,
                message: warningMessage,
              },
            },
      );
      return;
    }

    setDrafts((current) =>
      current === null
        ? current
        : {
            ...current,
            [providerId]: {
              ...current[providerId],
              isSaving: true,
              isDisconnecting: false,
              message: "",
            },
          },
    );
    const result = await window.api.providers.saveConfig({
      provider: toProviderDraftDto(provider),
      testToken: provider.testToken,
    });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setDrafts((current) =>
        current === null
          ? current
          : {
              ...current,
              [providerId]: {
                ...current[providerId],
                isSaving: false,
                isDisconnecting: false,
                message: result.error.userMessage,
              },
            },
      );
      return;
    }
    await loadSettingsView();
    pushToast("info", `${PROVIDER_LABELS[providerId]} provider saved.`);
  };

  const disconnectProvider = async (providerId: ProviderId): Promise<void> => {
    setDrafts((current) =>
      current === null
        ? current
        : {
            ...current,
            [providerId]: {
              ...current[providerId],
              isTesting: false,
              isSaving: false,
              isDisconnecting: true,
              testToken: null,
              testStatusText: "Not tested",
              message: "",
            },
          },
    );

    const result = await window.api.providers.disconnect({ providerId, viewKind: "settings" });
    if (!result.ok) {
      pushToast("error", result.error.userMessage);
      setDrafts((current) =>
        current === null
          ? current
          : {
              ...current,
              [providerId]: {
                ...current[providerId],
                isDisconnecting: false,
                message: result.error.userMessage,
              },
            },
      );
      return;
    }

    setDrafts((current) =>
      current === null
        ? current
        : {
            ...current,
            [providerId]: {
              ...current[providerId],
              isTesting: false,
              isSaving: false,
              isDisconnecting: false,
              testToken: null,
              testStatusText: "Not tested",
              message: "Provider disconnected. Test connection before saving new settings.",
            },
          },
    );
    const loaded = await loadSettingsView({
      preserveDraftInputs: true,
      preserveVisibleStateOnError: true,
    });
    if (!loaded) {
      return;
    }
    pushToast("info", `${PROVIDER_LABELS[providerId]} provider disconnected.`);
  };

  return {
    disconnectProvider,
    runConnectionTest,
    saveProvider,
    updateProviderDraft,
  };
};
