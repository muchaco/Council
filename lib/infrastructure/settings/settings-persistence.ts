import type ElectronStore from 'electron-store';

import type { LlmProviderConfig, ProviderId } from '../settings/llm-settings';
import {
  migrateSettings,
  getProviderConfig,
  setProviderConfig,
  getDefaultProvider,
  setDefaultProvider,
} from '../settings/settings-migration';

/**
 * Typed store interface for settings persistence operations.
 */
type TypedStore = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

/**
 * Settings persistence service that handles loading and saving settings
 * with automatic migration from legacy format.
 *
 * This module provides a thin wrapper around the settings-migration module
 * for use in Electron main process contexts.
 */

/**
 * Loads settings with automatic migration from legacy format if needed.
 *
 * @param store - The Electron store instance
 * @returns Object containing migrated providers configuration and default provider
 */
export const loadSettings = (store: TypedStore) => {
  // Ensure settings are migrated on load
  return migrateSettings(store);
};

/**
 * Initializes settings persistence on app startup.
 * This should be called in the Electron app ready handler.
 *
 * @param store - The Electron store instance
 */
export const initializeSettings = (store: TypedStore): void => {
  // Ensure settings are migrated on startup
  const modernSettings = migrateSettings(store);

  // Log migration for debugging (only when actually migrating from legacy)
  const existingProviders = store.get('providers');
  if (!existingProviders) {
    console.log('[Settings] Migrated from legacy format to provider-based config');
  }

  console.log('[Settings] Initialized with default provider:', modernSettings.defaultProvider);
};

/**
 * Gets the API key for a specific provider.
 *
 * @param store - The Electron store instance
 * @param providerId - The provider ID
 * @returns The API key or undefined if not configured
 */
export const getProviderApiKey = (
  store: TypedStore,
  providerId: ProviderId
): string | undefined => {
  const config = getProviderConfig(store, providerId);
  return config?.apiKey;
};

/**
 * Gets the default model for a specific provider.
 *
 * @param store - The Electron store instance
 * @param providerId - The provider ID
 * @returns The default model ID or undefined if not configured
 */
export const getProviderDefaultModel = (
  store: TypedStore,
  providerId: ProviderId
): string | undefined => {
  const config = getProviderConfig(store, providerId);
  return config?.defaultModel;
};

/**
 * Checks if a provider is enabled.
 *
 * @param store - The Electron store instance
 * @param providerId - The provider ID
 * @returns true if the provider is enabled and has an API key
 */
export const isProviderEnabled = (
  store: TypedStore,
  providerId: ProviderId
): boolean => {
  const config = getProviderConfig(store, providerId);
  return config?.isEnabled === true && !!config?.apiKey;
};

/**
 * Lists all configured providers.
 *
 * @param store - The Electron store instance
 * @returns Array of provider IDs that have configurations
 */
export const listConfiguredProviders = (store: TypedStore): ReadonlyArray<ProviderId> => {
  const providers = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
  return providers ? Object.keys(providers) : [];
};

/**
 * Lists all enabled providers (configured and enabled).
 *
 * @param store - The Electron store instance
 * @returns Array of provider IDs that are enabled
 */
export const listEnabledProviders = (store: TypedStore): ReadonlyArray<ProviderId> => {
  const providers = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
  if (!providers) return [];

  return Object.entries(providers)
    .filter(([_, config]) => config.isEnabled && config.apiKey)
    .map(([providerId]) => providerId);
};

// Re-export the core functions for convenience
export {
  migrateSettings,
  getProviderConfig,
  setProviderConfig,
  getDefaultProvider,
  setDefaultProvider,
};
