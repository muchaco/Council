export interface ConductorSessionNotFoundError {
  readonly _tag: 'ConductorSessionNotFoundError';
  readonly message: string;
}

export interface ConductorNotEnabledError {
  readonly _tag: 'ConductorNotEnabledError';
  readonly message: string;
}

export interface ConductorPersonaMissingError {
  readonly _tag: 'ConductorPersonaMissingError';
  readonly message: string;
}

export interface ConductorNoPersonasError {
  readonly _tag: 'ConductorNoPersonasError';
  readonly message: string;
}

export interface ConductorSelectedPersonaNotFoundError {
  readonly _tag: 'ConductorSelectedPersonaNotFoundError';
  readonly message: string;
}

export type ConductorDomainError =
  | ConductorSessionNotFoundError
  | ConductorNotEnabledError
  | ConductorPersonaMissingError
  | ConductorNoPersonasError
  | ConductorSelectedPersonaNotFoundError;
