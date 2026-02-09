'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Settings, Save, TestTube, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings';

export default function SettingsPage() {
  const {
    geminiApiKey,
    isConnected,
    isLoading,
    defaultModel,
    availableModels,
    loadApiKey,
    setApiKey,
    testConnection,
    loadDefaultModel,
    setDefaultModel,
    fetchAvailableModels,
    invalidateModelCache,
  } = useSettingsStore();
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadApiKey();
    loadDefaultModel();
  }, [loadApiKey, loadDefaultModel]);

  // Use a separate effect to sync the input with the loaded API key
  // This runs only when geminiApiKey changes and input is empty
  useEffect(() => {
    if (geminiApiKey && apiKeyInput === '' && !hasChanges) {
      setApiKeyInput(geminiApiKey);
    }
  }, [geminiApiKey]);

  const handleSaveApiKey = async () => {
    const success = await setApiKey(apiKeyInput);
    if (success) {
      setHasChanges(false);
    }
  };

  const handleTestConnection = async () => {
    await testConnection();
  };

  const handleApiKeyChange = (value: string) => {
    setApiKeyInput(value);
    setHasChanges(true);
  };

  const handleModelChange = (model: string) => {
    setDefaultModel(model);
  };

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-8 h-8" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your Council preferences and API integrations
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto max-w-2xl">
        <div className="space-y-6">
          {/* API Configuration */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">API Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Gemini API Key</label>
                <div className="relative mt-1">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="bg-input border-border text-foreground pr-10"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your API key is encrypted and stored securely
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveApiKey}
                  disabled={!hasChanges || isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save API Key
                </Button>
                <Button
                  onClick={handleTestConnection}
                  disabled={!geminiApiKey || isLoading}
                  variant="outline"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                  Test Connection
                </Button>
              </div>
              
              {isConnected && (
                <div className="p-3 bg-secondary border rounded text-sm text-secondary-foreground">
                  ✓ Connected to Gemini API
                </div>
              )}
            </div>
          </Card>

          {/* Default Model */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Default Model</h2>
            <div>
              <label className="text-sm font-medium text-foreground">Default Gemini Model</label>
              {!geminiApiKey ? (
                <div className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded text-muted-foreground text-sm">
                  Configure LLM provider
                </div>
              ) : availableModels.length === 0 ? (
                <div className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded text-muted-foreground text-sm">
                  Loading available models...
                </div>
              ) : (
                <select
                  value={defaultModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-input border border-border rounded text-foreground text-sm"
                >
                  {/* Show unavailable model if current model is not in available list */}
                  {defaultModel && !availableModels.find(m => m.name === defaultModel) && (
                    <option value={defaultModel} disabled>
                      {defaultModel} (unavailable - select a new model)
                    </option>
                  )}
                  {/* Show available models */}
                  {availableModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">
                  {availableModels.length > 0
                    ? `${availableModels.length} models available`
                    : 'Add API key to see available models'}
                </p>
                {geminiApiKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      invalidateModelCache();
                      fetchAvailableModels();
                    }}
                    disabled={isLoading}
                    className="h-6 px-2 text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh
                  </Button>
                )}
              </div>
              {defaultModel && !availableModels.find(m => m.name === defaultModel) && (
                <p className="text-xs text-amber-500 mt-1">
                  Current model is unavailable. Please select a different model.
                </p>
              )}
            </div>
          </Card>

          {/* About */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">About</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Council</strong> - AI Strategic Summit</p>
              <p>Version 0.1.0</p>
              <p>Transform solitary brainstorming into high-level strategic summits with AI agents.</p>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
