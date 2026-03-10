import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildInvalidConfigBadgeAriaLabel,
  buildProviderConfiguredBadgeAriaLabel,
  buildProviderConnectionTestButtonAriaLabel,
  buildProviderDisconnectButtonAriaLabel,
  isModelSelectionInCatalog,
  toModelRef,
  toModelSelectionValue,
} from "../../../shared/app-ui-helpers.js";
import type { ProviderId } from "../../../shared/ipc/dto";
import {
  isProviderCardEditable,
  isProviderConfigured,
  isProviderDraftChanged,
  requiresProviderDisconnect,
  shouldShowProviderTestAndSaveActions,
} from "../../../shared/provider-settings-ui.js";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  DEFAULT_SETTINGS_ACCORDION_SECTIONS,
  PROVIDER_LABELS,
  type ProviderDraftState,
  type SettingsAccordionSection,
  type SettingsViewState,
  buildSavedFingerprints,
  isConnectionTestAllowed,
  isSaveAllowed,
  toProviderDraftMap,
} from "./settingsPanelState";
import { useSettingsProviderActions } from "./useSettingsProviderActions";

type SettingsPanelProps = {
  isActive: boolean;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const SettingsPanel = ({ isActive, pushToast }: SettingsPanelProps): JSX.Element => {
  const [settingsViewState, setSettingsViewState] = useState<SettingsViewState>({ status: "idle" });
  const [drafts, setDrafts] = useState<Record<ProviderId, ProviderDraftState> | null>(null);
  const [globalDefaultSelection, setGlobalDefaultSelection] = useState("");
  const [, setRefreshStatus] = useState("Ready");
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [settingsAccordionSections, setSettingsAccordionSections] = useState<
    Array<SettingsAccordionSection>
  >(DEFAULT_SETTINGS_ACCORDION_SECTIONS);
  const [savedDraftFingerprints, setSavedDraftFingerprints] = useState<Record<
    ProviderId,
    string
  > | null>(null);
  const [savedGlobalDefaultSelection, setSavedGlobalDefaultSelection] = useState("");
  const [contextLastNInput, setContextLastNInput] = useState("");
  const [savedContextLastNInput, setSavedContextLastNInput] = useState("");
  const draftsRef = useRef<Record<ProviderId, ProviderDraftState> | null>(null);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    document.title = "Settings";
  }, [isActive]);

  const loadSettingsView = useCallback(
    async (options?: {
      preserveDraftInputs?: boolean;
      preserveVisibleStateOnError?: boolean;
    }): Promise<boolean> => {
      const preserveDraftInputs = options?.preserveDraftInputs ?? false;
      const preserveVisibleStateOnError = options?.preserveVisibleStateOnError ?? false;
      const result = await window.api.settings.getView({ viewKind: "settings" });
      if (!result.ok) {
        if (!preserveVisibleStateOnError) {
          setSettingsViewState({ status: "error", message: result.error.userMessage });
        }
        pushToast("error", result.error.userMessage);
        return false;
      }

      const draftMap = toProviderDraftMap(result.value.providers);
      if (!preserveDraftInputs || draftsRef.current === null) {
        setDrafts(draftMap);
        setGlobalDefaultSelection(toModelSelectionValue(result.value.globalDefaultModelRef));
        setContextLastNInput(String(result.value.contextLastN));
      }

      const nextSelection = toModelSelectionValue(result.value.globalDefaultModelRef);
      setSavedGlobalDefaultSelection(nextSelection);
      const nextContextLastN = String(result.value.contextLastN);
      setSavedContextLastNInput(nextContextLastN);
      setSavedDraftFingerprints(buildSavedFingerprints(draftMap));
      setRefreshStatus("Ready");
      setSettingsViewState({ status: "ready", data: result.value });
      return true;
    },
    [pushToast],
  );

  useEffect(() => {
    void loadSettingsView();
  }, [loadSettingsView]);

  const providerOrder = useMemo(() => {
    if (drafts === null) {
      return [] as ReadonlyArray<ProviderId>;
    }
    return Object.keys(drafts).sort() as ReadonlyArray<ProviderId>;
  }, [drafts]);

  const hasUnsavedSettingsChanges = useMemo(() => {
    if (drafts === null || savedDraftFingerprints === null) {
      return false;
    }
    const currentFingerprints = buildSavedFingerprints(drafts);
    return (
      currentFingerprints.gemini !== savedDraftFingerprints.gemini ||
      currentFingerprints.ollama !== savedDraftFingerprints.ollama ||
      currentFingerprints.openrouter !== savedDraftFingerprints.openrouter ||
      globalDefaultSelection !== savedGlobalDefaultSelection ||
      contextLastNInput.trim() !== savedContextLastNInput.trim()
    );
  }, [
    contextLastNInput,
    drafts,
    globalDefaultSelection,
    savedContextLastNInput,
    savedDraftFingerprints,
    savedGlobalDefaultSelection,
  ]);

  useEffect(() => {
    const beforeUnloadHandler = (event: BeforeUnloadEvent): void => {
      if (!hasUnsavedSettingsChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
  }, [hasUnsavedSettingsChanges]);

  const { disconnectProvider, runConnectionTest, saveProvider, updateProviderDraft } =
    useSettingsProviderActions({
      draftsRef,
      loadSettingsView,
      pushToast,
      savedDraftFingerprints,
      setDrafts,
      settingsViewState,
    });

  const onRefreshModels = async (): Promise<void> => {
    setIsRefreshingModels(true);
    setRefreshStatus("Refreshing models...");
    const result = await window.api.providers.refreshModelCatalog({ viewKind: "settings" });
    if (!result.ok) {
      setRefreshStatus(result.error.userMessage);
      pushToast("error", result.error.userMessage);
      setIsRefreshingModels(false);
      return;
    }
    const loaded = await loadSettingsView({
      preserveDraftInputs: true,
      preserveVisibleStateOnError: true,
    });
    if (!loaded) {
      setIsRefreshingModels(false);
      return;
    }
    setRefreshStatus("Model catalog refreshed.");
    pushToast("info", "Model catalog refreshed.");
    setIsRefreshingModels(false);
  };

  const onSaveGlobalDefault = async (): Promise<void> => {
    const result = await window.api.settings.setGlobalDefaultModel({
      viewKind: "settings",
      modelRefOrNull: toModelRef(globalDefaultSelection),
    });
    if (!result.ok) {
      setRefreshStatus(result.error.userMessage);
      pushToast("error", result.error.userMessage);
      return;
    }
    await loadSettingsView();
    setSavedGlobalDefaultSelection(globalDefaultSelection);
    setRefreshStatus("Global default model saved.");
    pushToast("info", "Global default model saved.");
  };

  const onSaveContextLastN = async (): Promise<void> => {
    const parsed = Number.parseInt(contextLastNInput.trim(), 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
      const message = "Context window size must be a whole number.";
      setRefreshStatus(message);
      pushToast("warning", message);
      return;
    }
    const result = await window.api.settings.setContextLastN({
      viewKind: "settings",
      contextLastN: parsed,
    });
    if (!result.ok) {
      setRefreshStatus(result.error.userMessage);
      pushToast("error", result.error.userMessage);
      return;
    }
    await loadSettingsView();
    const savedValue = String(result.value.contextLastN);
    setContextLastNInput(savedValue);
    setSavedContextLastNInput(savedValue);
    setRefreshStatus("Context window size saved.");
    pushToast("info", "Context window size saved.");
  };

  if (settingsViewState.status === "idle" || drafts === null) {
    return (
      <section
        aria-labelledby="home-tab-settings"
        className="settings-section"
        id="home-panel-settings"
        role="tabpanel"
      />
    );
  }
  if (settingsViewState.status === "error") {
    return (
      <section
        aria-labelledby="home-tab-settings"
        className="settings-section"
        id="home-panel-settings"
        role="tabpanel"
      >
        <h2>Settings</h2>
        <p className="status">Error: {settingsViewState.message}</p>
        <button className="cta" onClick={() => void loadSettingsView()} type="button">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="home-tab-settings"
      className="settings-section"
      id="home-panel-settings"
      role="tabpanel"
    >
      <Accordion
        className="settings-accordion"
        onValueChange={(value) =>
          setSettingsAccordionSections(value as Array<SettingsAccordionSection>)
        }
        type="multiple"
        value={settingsAccordionSections}
      >
        <AccordionItem className="settings-accordion-item" value="providers">
          <AccordionTrigger className="settings-accordion-trigger">
            <div className="settings-accordion-copy">
              <span className="settings-accordion-title">Providers</span>
              <span className="settings-accordion-subtitle">
                Manage provider connections and credentials.
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="settings-accordion-content">
            <div className="settings-provider-grid">
              {providerOrder.map((providerId) => {
                const provider = drafts[providerId];
                const savedProvider = settingsViewState.data.providers.find(
                  (item) => item.providerId === providerId,
                );
                const savedFingerprint =
                  savedDraftFingerprints === null ? null : savedDraftFingerprints[providerId];
                const providerConfigured =
                  savedProvider !== undefined && isProviderConfigured(savedProvider);
                const providerCardEditable = isProviderCardEditable(providerConfigured);
                const requiresDisconnect = requiresProviderDisconnect({
                  provider,
                  savedFingerprint,
                  configured: providerConfigured,
                });
                const connectionTestAllowed = isConnectionTestAllowed({
                  provider,
                  savedFingerprint,
                  requiresDisconnect,
                });
                const showOllamaNote = providerId === "ollama";
                const providerLabel = PROVIDER_LABELS[providerId];
                const shouldShowStatusText = provider.testStatusText !== "Not tested";
                const shouldShowTestAndSaveActions = shouldShowProviderTestAndSaveActions({
                  provider,
                  configured: providerConfigured,
                  requiresDisconnect,
                });

                return (
                  <Card className="settings-provider-card" key={providerId}>
                    <CardHeader className="settings-provider-card-header">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-lg">{providerLabel}</CardTitle>
                        <Badge
                          aria-label={buildProviderConfiguredBadgeAriaLabel({
                            providerLabel,
                            configured: providerConfigured,
                          })}
                          variant={providerConfigured ? "default" : "secondary"}
                        >
                          {providerConfigured ? "Configured" : "Not configured"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${providerId}-endpoint`}>Endpoint URL</Label>
                        <Input
                          id={`${providerId}-endpoint`}
                          onChange={(event) =>
                            updateProviderDraft(providerId, { endpointUrl: event.target.value })
                          }
                          placeholder={
                            providerId === "ollama" ? "http://127.0.0.1:11434" : "Optional endpoint"
                          }
                          readOnly={!providerCardEditable}
                          value={provider.endpointUrl}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${providerId}-key`}>API key</Label>
                        <Input
                          id={`${providerId}-key`}
                          onChange={(event) =>
                            updateProviderDraft(providerId, { apiKey: event.target.value })
                          }
                          placeholder={
                            showOllamaNote ? "Optional for local Ollama" : "Enter API key"
                          }
                          readOnly={!providerCardEditable}
                          type="password"
                          value={provider.apiKey}
                        />
                        {showOllamaNote ? (
                          <p className="text-xs text-muted-foreground">
                            Local Ollama usually does not need an API key.
                          </p>
                        ) : null}
                        {providerConfigured ? (
                          <p className="text-xs text-muted-foreground">
                            Disconnect this provider to edit and test replacement settings.
                          </p>
                        ) : null}
                      </div>
                      <div className="settings-provider-actions">
                        {shouldShowTestAndSaveActions ? (
                          <>
                            <Button
                              aria-label={buildProviderConnectionTestButtonAriaLabel({
                                providerLabel,
                                connectionTestAllowed,
                                requiresDisconnect,
                              })}
                              disabled={!connectionTestAllowed}
                              onClick={() => void runConnectionTest(providerId)}
                              title={
                                requiresDisconnect
                                  ? "Disconnect the saved provider before testing new settings"
                                  : connectionTestAllowed
                                    ? "Test updated provider settings"
                                    : "Edit endpoint or key before running a new test"
                              }
                            >
                              {provider.isTesting ? "Testing..." : "Test connection"}
                            </Button>
                            <Button
                              disabled={!isSaveAllowed(provider)}
                              onClick={() => void saveProvider(providerId)}
                              variant="secondary"
                            >
                              {provider.isSaving ? "Saving..." : "Save"}
                            </Button>
                          </>
                        ) : null}
                        {providerConfigured ? (
                          <Button
                            aria-label={buildProviderDisconnectButtonAriaLabel(providerLabel)}
                            disabled={
                              provider.isDisconnecting || provider.isSaving || provider.isTesting
                            }
                            onClick={() => void disconnectProvider(providerId)}
                            type="button"
                            variant="outline"
                          >
                            {provider.isDisconnecting ? "Disconnecting..." : "Disconnect"}
                          </Button>
                        ) : null}
                      </div>
                      {shouldShowStatusText ? (
                        <p aria-live="polite" className="settings-provider-feedback">
                          {provider.testStatusText}
                        </p>
                      ) : null}
                      {provider.message.length > 0 ? (
                        <p aria-live="polite" className="settings-provider-feedback">
                          {provider.message}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem className="settings-accordion-item" value="general">
          <AccordionTrigger className="settings-accordion-trigger">
            <div className="settings-accordion-copy">
              <span className="settings-accordion-title">General</span>
              <span className="settings-accordion-subtitle">
                Configure fallback model and runtime prompt window.
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="settings-accordion-content">
            <section className="settings-section settings-secondary-grid">
              <Card className="settings-secondary-card">
                <CardHeader className="settings-secondary-card-header">
                  <div>
                    <CardTitle>Global Default Model</CardTitle>
                    <CardDescription>
                      Choose the fallback model used when an item does not set one explicitly.
                    </CardDescription>
                  </div>
                  {settingsViewState.data.globalDefaultModelInvalidConfig ? (
                    <Badge
                      aria-label={buildInvalidConfigBadgeAriaLabel("Global default model")}
                      title="Invalid config"
                      variant="destructive"
                    >
                      Invalid config
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="settings-inline-label-row">
                      <Label htmlFor="global-default-model">Model</Label>
                      <Button
                        aria-label="Refresh global model options"
                        disabled={!settingsViewState.data.canRefreshModels || isRefreshingModels}
                        onClick={() => void onRefreshModels()}
                        size="icon"
                        title="Refresh models"
                        type="button"
                        variant="ghost"
                      >
                        <span className={isRefreshingModels ? "h-4 w-4 animate-spin" : "h-4 w-4"}>
                          ⟳
                        </span>
                      </Button>
                    </div>
                    <Select
                      onValueChange={(value) =>
                        setGlobalDefaultSelection(value === "__none__" ? "" : value)
                      }
                      value={
                        globalDefaultSelection.length > 0 ? globalDefaultSelection : "__none__"
                      }
                    >
                      <SelectTrigger id="global-default-model">
                        <SelectValue placeholder="Unselected" />
                      </SelectTrigger>
                      <SelectContent>
                        {globalDefaultSelection.length > 0 &&
                        !isModelSelectionInCatalog({
                          modelSelection: globalDefaultSelection,
                          modelCatalog: settingsViewState.data.modelCatalog,
                        }) ? (
                          <SelectItem value={globalDefaultSelection}>
                            Unavailable ({globalDefaultSelection})
                          </SelectItem>
                        ) : null}
                        <SelectItem value="__none__">Unselected</SelectItem>
                        {Object.entries(settingsViewState.data.modelCatalog.modelsByProvider).map(
                          ([providerId, models]) => (
                            <SelectGroup key={providerId}>
                              <SelectLabel>{providerId}</SelectLabel>
                              {models.map((modelId) => (
                                <SelectItem
                                  key={`${providerId}:${modelId}`}
                                  value={`${providerId}:${modelId}`}
                                >
                                  {modelId}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="settings-card-actions">
                    <Button
                      onClick={() => void onSaveGlobalDefault()}
                      type="button"
                      variant="secondary"
                    >
                      Save global default
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="settings-secondary-card">
                <CardHeader className="settings-secondary-card-header">
                  <div>
                    <CardTitle>Context Window</CardTitle>
                    <CardDescription>
                      Choose how many recent transcript messages are included in runtime prompts.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="context-last-n">Last N messages</Label>
                    <Input
                      id="context-last-n"
                      min={1}
                      onChange={(event) => setContextLastNInput(event.target.value)}
                      step={1}
                      type="number"
                      value={contextLastNInput}
                    />
                  </div>
                  <div className="settings-card-actions">
                    <Button
                      onClick={() => void onSaveContextLastN()}
                      type="button"
                      variant="secondary"
                    >
                      Save context window
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
};
