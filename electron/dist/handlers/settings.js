"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.setupSettingsHandlers = setupSettingsHandlers;
const electron_1 = require("electron");
const electron_store_1 = __importDefault(require("electron-store"));
const crypto_1 = __importDefault(require("crypto"));
const store = new electron_store_1.default({
    name: 'council-settings',
    encryptionKey: process.env.COUNCIL_ENCRYPTION_KEY || 'council-default-key-change-in-production',
});
// Encryption utilities
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
function getEncryptionKey() {
    // In production, this should come from a secure key management system
    // For now, we use a derived key from the machine-specific data
    const machineId = process.env.COUNCIL_ENCRYPTION_KEY || 'council-default-key';
    return crypto_1.default.scryptSync(machineId, 'council-salt', KEY_LENGTH);
}
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const salt = crypto_1.default.randomBytes(SALT_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Combine salt + iv + authTag + encrypted
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}
function decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
    }
    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    const key = getEncryptionKey();
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
let modelCache = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
function getApiKeyHash(apiKey) {
    return crypto_1.default.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
}
async function fetchAvailableModels(apiKey) {
    const apiKeyHash = getApiKeyHash(apiKey);
    const now = Date.now();
    // Check cache
    if (modelCache &&
        modelCache.apiKeyHash === apiKeyHash &&
        now - modelCache.timestamp < CACHE_DURATION_MS) {
        return modelCache.models;
    }
    // Fetch from API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    // Filter and format models
    const models = data.models
        ?.filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
        ?.map((model) => ({
        name: model.name.replace('models/', ''),
        displayName: model.displayName || model.name.replace('models/', ''),
        description: model.description || '',
        supportedMethods: model.supportedGenerationMethods || [],
    }))
        ?.sort((a, b) => a.displayName.localeCompare(b.displayName)) || [];
    // Update cache
    modelCache = {
        models,
        timestamp: now,
        apiKeyHash,
    };
    return models;
}
function setupSettingsHandlers() {
    // Get API Key
    electron_1.ipcMain.handle('settings:getApiKey', () => {
        try {
            const encrypted = store.get('apiKey');
            if (!encrypted) {
                return { success: true, data: null };
            }
            const decrypted = decrypt(encrypted);
            return { success: true, data: decrypted };
        }
        catch (error) {
            console.error('Error decrypting API key:', error);
            return { success: false, error: 'Failed to decrypt API key' };
        }
    });
    // Set API Key
    electron_1.ipcMain.handle('settings:setApiKey', (_, key) => {
        try {
            const encrypted = encrypt(key);
            store.set('apiKey', encrypted);
            return { success: true };
        }
        catch (error) {
            console.error('Error encrypting API key:', error);
            return { success: false, error: 'Failed to encrypt API key' };
        }
    });
    // Test Connection
    electron_1.ipcMain.handle('settings:testConnection', async () => {
        try {
            const encrypted = store.get('apiKey');
            if (!encrypted) {
                return { success: false, error: 'API key not set' };
            }
            const apiKey = decrypt(encrypted);
            // Test the API key with a simple request
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (response.ok) {
                return { success: true, data: true };
            }
            else {
                const error = await response.text();
                return { success: false, error: `API test failed: ${error}` };
            }
        }
        catch (error) {
            console.error('Error testing connection:', error);
            return { success: false, error: error.message };
        }
    });
    // Generic get/set for other settings
    electron_1.ipcMain.handle('settings:get', (_, key) => {
        try {
            const value = store.get(key);
            return { success: true, data: value };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('settings:set', (_, key, value) => {
        try {
            store.set(key, value);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // List available models
    electron_1.ipcMain.handle('settings:listModels', async () => {
        try {
            const encrypted = store.get('apiKey');
            if (!encrypted) {
                return { success: false, error: 'API key not set' };
            }
            const apiKey = decrypt(encrypted);
            const models = await fetchAvailableModels(apiKey);
            return { success: true, data: models };
        }
        catch (error) {
            console.error('Error fetching models:', error);
            return { success: false, error: error.message };
        }
    });
}
//# sourceMappingURL=settings.js.map