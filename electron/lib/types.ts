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

export interface BlackboardState {
  consensus: string;
  conflicts: string;
  nextStep: string;
  facts: string;
}

export interface MessageMetadata {
  isIntervention?: boolean;
  driftDetected?: boolean;
  selectorReasoning?: string;
  isOrchestratorMessage?: boolean;
}

export interface Session {
  id: string;
  title: string;
  problemDescription: string;
  outputGoal: string;
  status: 'active' | 'completed' | 'archived';
  tokenCount: number;
  costEstimate: number;
  orchestratorEnabled: boolean;
  orchestratorPersonaId: string | null;
  blackboard: BlackboardState | null;
  autoReplyCount: number;
  tokenBudget: number;
  summary: string | null;
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
  metadata: MessageMetadata | null;
  createdAt: string;
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
  metadata?: MessageMetadata;
}

export const VALID_GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro'] as const;
export type GeminiModel = typeof VALID_GEMINI_MODELS[number];

export const PERSONA_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Gray', value: '#6B7280' },
] as const;
