export interface CouncilBlackboardSnapshot {
  readonly consensus: string;
  readonly conflicts: string;
  readonly nextStep: string;
  readonly facts: string;
}

export interface CouncilChatPersonaSnapshot {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

export interface CouncilChatMessageSnapshot {
  readonly personaId: string | null;
  readonly content: string;
}

export interface CouncilChatRequest {
  readonly personaId: string;
  readonly sessionId: string;
  readonly model: string;
  readonly systemPrompt: string;
  readonly hiddenAgenda?: string;
  readonly verbosity?: string;
  readonly temperature: number;
  readonly problemContext: string;
  readonly outputGoal: string;
  readonly blackboard: CouncilBlackboardSnapshot;
  readonly otherPersonas: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly role: string;
  }>;
}

export interface CouncilGatewayHistoryMessage {
  readonly role: 'user';
  readonly parts: ReadonlyArray<{
    readonly text: string;
  }>;
}

export interface PreparedCouncilPersonaTurnPrompt {
  readonly model: string;
  readonly temperature: number;
  readonly enhancedSystemPrompt: string;
  readonly chatHistory: readonly CouncilGatewayHistoryMessage[];
  readonly turnPrompt: string;
}
