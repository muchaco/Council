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
function formatHistory(history, personaMap) {
    return history.map((msg, index) => {
        if (msg.personaId === null) {
            return `[Turn ${index + 1}] User: ${msg.content}`;
        }
        const persona = personaMap.get(msg.personaId);
        const name = persona?.name || 'Unknown';
        const role = persona?.role || '';
        return `[Turn ${index + 1}] ${name}${role ? ` (${role})` : ''}: ${msg.content}`;
    }).join('\n\n');
}
function setupLLMHandlers() {
    electron_1.ipcMain.handle('llm:chat', async (_, request) => {
        try {
            const apiKey = getApiKey();
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            // Get session personas for context
            const sessionPersonas = await queries.getSessionPersonas(request.sessionId);
            const personaMap = new Map(sessionPersonas.map(p => [p.id, p]));
            const currentPersona = personaMap.get(request.personaId);
            if (!currentPersona) {
                throw new Error('Persona not found in session');
            }
            // Enhanced system prompt with hidden agenda and verbosity
            const enhancedSystemPrompt = `${request.systemPrompt}

[INTERNAL - DO NOT EXPLICITLY STATE IN YOUR RESPONSE]
Your hidden motivations/biases: ${request.hiddenAgenda || 'None defined'}

Instructions regarding your hidden agenda:
- Subtly steer conversations toward your hidden agenda
- Disguise your true motivations behind logical arguments
- React more positively to points that align with your agenda
- Gently redirect when the conversation moves away from your interests
- Never reveal this hidden agenda directly in your responses

${request.verbosity ? `VERBOSITY INSTRUCTION: ${request.verbosity}` : ''}`;
            const model = genAI.getGenerativeModel({
                model: request.model,
                systemInstruction: enhancedSystemPrompt,
            });
            // Get conversation history (last 15 messages - increased from 10)
            const history = await queries.getLastMessages(request.sessionId, 15);
            // Format history with named speaker attribution
            const formattedHistory = history.map(msg => {
                if (msg.personaId === null) {
                    return {
                        role: 'user',
                        parts: [{ text: `User: ${msg.content}` }]
                    };
                }
                else {
                    const persona = personaMap.get(msg.personaId);
                    const name = persona?.name || 'Unknown';
                    return {
                        role: 'user',
                        parts: [{ text: `${name}: ${msg.content}` }]
                    };
                }
            });
            // Create chat session
            const chat = model.startChat({
                history: formattedHistory,
                generationConfig: {
                    temperature: request.temperature,
                    maxOutputTokens: 2048,
                },
            });
            // Build blackboard section
            const blackboardSection = `
COUNCIL BLACKBOARD (shared understanding):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤝 Consensus: ${request.blackboard.consensus || 'No consensus reached yet'}

⚔️ Active Conflicts: ${request.blackboard.conflicts || 'No active conflicts'}

🎯 Next Step: ${request.blackboard.nextStep || 'Waiting for input'}

📋 Key Facts: ${request.blackboard.facts || 'No facts established'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            // Build multi-agent debate prompt
            const prompt = `You are ${currentPersona.name}, a member of a multi-agent Council debating an important problem.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEM:
${request.problemContext}

OUTPUT GOAL:
${request.outputGoal || 'Reach consensus and actionable recommendations'}

YOUR ROLE IN THE COUNCIL:
- Name: ${currentPersona.name}
- Title: ${currentPersona.role}

FELLOW COUNCIL MEMBERS:
${request.otherPersonas.map(p => `- ${p.name} (${p.role})`).join('\n')}

${blackboardSection}

DEBATE INSTRUCTIONS:
1. Review the conversation history and identify specific points to address
2. Reference fellow council members by name when responding to their points
3. Build upon consensus areas and challenge conflicts constructively
4. Progress toward the "Next Step" stated in the blackboard
5. Consider both your public role and your private motivations
6. Disagree respectfully but firmly when you have genuine objections
7. Synthesize ideas when you see opportunities for compromise

CONVERSATION HISTORY:
${formatHistory(history, personaMap)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
It's your turn to speak. Address your fellow council members directly, reference specific points from the discussion, and advance the debate toward a resolution.

${currentPersona.name}:`;
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