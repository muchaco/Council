export interface CouncilChatPersonaNotFoundError {
  readonly _tag: 'CouncilChatPersonaNotFoundError';
  readonly message: string;
}

export type CouncilChatDomainError = CouncilChatPersonaNotFoundError;
