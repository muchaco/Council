export interface EmptyNameError {
  readonly _tag: 'EmptyNameError';
  readonly message: string;
}

export interface SessionNotFoundError {
  readonly _tag: 'SessionNotFoundError';
  readonly message: string;
}

export interface SessionTagNameEmptyError {
  readonly _tag: 'SessionTagNameEmptyError';
  readonly message: string;
}

export interface SessionTagNameTooLongError {
  readonly _tag: 'SessionTagNameTooLongError';
  readonly message: string;
}

export interface SessionTagAlreadyAssignedError {
  readonly _tag: 'SessionTagAlreadyAssignedError';
  readonly message: string;
}

export interface SessionTagLimitReachedError {
  readonly _tag: 'SessionTagLimitReachedError';
  readonly message: string;
}

export interface SessionTagNotInCatalogError {
  readonly _tag: 'SessionTagNotInCatalogError';
  readonly message: string;
}

export interface SessionTagNotAssignedError {
  readonly _tag: 'SessionTagNotAssignedError';
  readonly message: string;
}

export interface SettingsError {
  readonly _tag: 'SettingsError';
  readonly message: string;
}

export type DomainError =
  | EmptyNameError
  | SessionNotFoundError
  | SessionTagNameEmptyError
  | SessionTagNameTooLongError
  | SessionTagAlreadyAssignedError
  | SessionTagLimitReachedError
  | SessionTagNotInCatalogError
  | SessionTagNotAssignedError
  | SettingsError;
