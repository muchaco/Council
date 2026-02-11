import type { BlackboardState } from '../types';

interface SessionWithOptionalBlackboard {
  readonly blackboard: BlackboardState | null;
}

const emptyBlackboardState: BlackboardState = {
  consensus: '',
  conflicts: '',
  nextStep: '',
  facts: '',
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

export const mapVoidSuccessResponse = (): { readonly success: true } => ({
  success: true,
});

export const mapErrorFailureResponse = (
  error: unknown
): { readonly success: false; readonly error: string } => ({
  success: false,
  error: toErrorMessage(error),
});

export const mapSessionNotFoundResponse = (): {
  readonly success: false;
  readonly error: 'Session not found';
} => ({
  success: false,
  error: 'Session not found',
});

export const mapBlackboardLookupResponse = (
  session: SessionWithOptionalBlackboard | null
):
  | {
      readonly success: false;
      readonly error: 'Session not found';
    }
  | {
      readonly success: true;
      readonly data: BlackboardState;
    } => {
  if (!session) {
    return mapSessionNotFoundResponse();
  }

  return {
    success: true,
    data: session.blackboard ?? emptyBlackboardState,
  };
};
