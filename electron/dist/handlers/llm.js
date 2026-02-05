"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupLLMHandlers = setupLLMHandlers;
const electron_1 = require("electron");
const generative_ai_1 = require("@google/generative-ai");
const electron_store_1 = __importDefault(require("electron-store"));
const settings_js_1 = require("./settings.js");
const queries = __importStar(require("../lib/queries.js"));
const store = new electron_store_1.default({
    name: 'council-settings',
    encryptionKey: process.env.COUNCIL_ENCRYPTION_KEY || 'council-default-key-change-in-production',
});
function getApiKey() {
    const encrypted = store.get('apiKey');
    if (!encrypted) {
        throw new Error('API key not configured');
    }
    return (0, settings_js_1.decrypt)(encrypted);
}
function setupLLMHandlers() {
    electron_1.ipcMain.handle('llm:chat', async (_, request) => {
        try {
            const apiKey = getApiKey();
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: request.model,
                systemInstruction: request.systemPrompt,
            });
            // Get conversation history (last 10 messages)
            const history = await queries.getLastMessages(request.sessionId, 10);
            // Format history for Gemini
            const formattedHistory = history.map(msg => ({
                role: msg.personaId === null ? 'user' : 'model',
                parts: [{ text: msg.content }],
            }));
            // Create chat session
            const chat = model.startChat({
                history: formattedHistory,
                generationConfig: {
                    temperature: request.temperature,
                    maxOutputTokens: 2048,
                },
            });
            // Build the prompt with context
            const prompt = `Context: We are discussing the following problem: ${request.problemContext}

Please provide your perspective and insights on this problem. Consider the previous conversation context and respond accordingly.`;
            // Send message and get response
            const result = await chat.sendMessage(prompt);
            const response = result.response;
            const text = response.text();
            // Estimate token count (rough approximation: ~4 characters per token)
            const estimatedTokens = Math.ceil(text.length / 4);
            return {
                success: true,
                data: {
                    content: text,
                    tokenCount: estimatedTokens,
                },
            };
        }
        catch (error) {
            console.error('Error in LLM chat:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });
}
//# sourceMappingURL=llm.js.map