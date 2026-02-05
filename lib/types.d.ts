export interface Persona {
    id: string;
    name: string;
    role: string;
    systemPrompt: string;
    geminiModel: string;
    temperature: number;
    color: string;
    hiddenAgenda?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Session {
    id: string;
    title: string;
    problemDescription: string;
    outputGoal: string;
    status: 'active' | 'completed' | 'archived';
    tokenCount: number;
    costEstimate: number;
    createdAt: string;
    updatedAt: string;
}
export interface Message {
    id: string;
    sessionId: string;
    personaId: string | null;
    content: string;
    turnNumber: number;
    tokenCount: number;
    createdAt: string;
}
export interface SessionPersona {
    sessionId: string;
    personaId: string;
    isOrchestrator: boolean;
}
export interface PersonaInput {
    name: string;
    role: string;
    systemPrompt: string;
    geminiModel: string;
    temperature: number;
    color: string;
    hiddenAgenda?: string;
}
export interface SessionInput {
    title: string;
    problemDescription: string;
    outputGoal: string;
}
export interface MessageInput {
    sessionId: string;
    personaId: string | null;
    content: string;
    turnNumber: number;
    tokenCount?: number;
}
export declare const VALID_GEMINI_MODELS: readonly ["gemini-1.5-flash", "gemini-1.5-pro"];
export type GeminiModel = typeof VALID_GEMINI_MODELS[number];
export declare const PERSONA_COLORS: readonly [{
    readonly name: "Blue";
    readonly value: "#3B82F6";
}, {
    readonly name: "Emerald";
    readonly value: "#10B981";
}, {
    readonly name: "Red";
    readonly value: "#EF4444";
}, {
    readonly name: "Purple";
    readonly value: "#8B5CF6";
}, {
    readonly name: "Orange";
    readonly value: "#F97316";
}, {
    readonly name: "Pink";
    readonly value: "#EC4899";
}, {
    readonly name: "Cyan";
    readonly value: "#06B6D4";
}, {
    readonly name: "Amber";
    readonly value: "#F59E0B";
}, {
    readonly name: "Gray";
    readonly value: "#6B7280";
}];
//# sourceMappingURL=types.d.ts.map