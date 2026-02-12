import type {
  BlackboardState,
  ConductorFlowState,
  ConductorProcessTurnFailureCode,
  ConductorProcessTurnResponse,
} from '../../types';

interface ConductorStatePatch {
  readonly conductorFlowState?: ConductorFlowState;
}

interface ToastPlan {
  readonly level: 'error' | 'warning' | 'info';
  readonly message: string;
}

interface ConductorTurnPlanBase {
  readonly blackboardUpdate: Partial<BlackboardState>;
  readonly warning?: string;
}

export type ConductorTurnShellPlan =
  | ({
      readonly _tag: 'Failure';
      readonly statePatch: ConductorStatePatch;
      readonly toast: ToastPlan;
    } & ConductorTurnPlanBase)
  | ({
      readonly _tag: 'WaitForUser';
      readonly statePatch: ConductorStatePatch;
      readonly toast: ToastPlan;
      readonly suggestedPersonaId?: string;
      readonly isInterventionSuggestion?: boolean;
    } & ConductorTurnPlanBase)
  | ({
      readonly _tag: 'TriggerPersona';
      readonly personaId: string;
    } & ConductorTurnPlanBase)
  ;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseBlackboardUpdate = (value: unknown): Partial<BlackboardState> => {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return {};
  }

  return {
    ...(typeof value.consensus === 'string' ? { consensus: value.consensus } : {}),
    ...(typeof value.conflicts === 'string' ? { conflicts: value.conflicts } : {}),
    ...(typeof value.nextStep === 'string' ? { nextStep: value.nextStep } : {}),
    ...(typeof value.facts === 'string' ? { facts: value.facts } : {}),
  };
};

const mapFailurePlan = (
  code: ConductorProcessTurnFailureCode | undefined,
  error: string | undefined,
  blackboardUpdate: Partial<BlackboardState>
): ConductorTurnShellPlan => {
  switch (code) {
    case 'CIRCUIT_BREAKER':
      return {
        _tag: 'Failure',
        statePatch: { conductorFlowState: 'blocked' },
        toast: { level: 'warning', message: error || 'Circuit breaker triggered' },
        blackboardUpdate,
      };
    case 'SELECTOR_AGENT_ERROR':
      return {
        _tag: 'Failure',
        statePatch: { conductorFlowState: 'blocked' },
        toast: { level: 'error', message: error || 'Selector agent error' },
        blackboardUpdate,
      };
    case 'API_KEY_NOT_CONFIGURED':
      return {
        _tag: 'Failure',
        statePatch: { conductorFlowState: 'blocked' },
        toast: { level: 'error', message: error || 'API key not configured' },
        blackboardUpdate,
      };
    case 'API_KEY_DECRYPT_FAILED':
      return {
        _tag: 'Failure',
        statePatch: { conductorFlowState: 'blocked' },
        toast: { level: 'error', message: error || 'Failed to decrypt API key' },
        blackboardUpdate,
      };
    case 'SETTINGS_READ_ERROR':
      return {
        _tag: 'Failure',
        statePatch: { conductorFlowState: 'blocked' },
        toast: { level: 'error', message: error || 'Failed to load conductor settings' },
        blackboardUpdate,
      };
    case 'PERSONA_NOT_FOUND':
      return {
        _tag: 'WaitForUser',
        statePatch: { conductorFlowState: 'awaiting_input' },
        toast: { level: 'warning', message: error || 'Selected persona not found - your turn' },
        blackboardUpdate,
      };
    default:
      return {
        _tag: 'Failure',
        statePatch: { conductorFlowState: 'blocked' },
        toast: { level: 'error', message: error || 'Conductor error' },
        blackboardUpdate,
      };
  }
};

export const decideConductorTurnShellPlan = (
  response: ConductorProcessTurnResponse
): ConductorTurnShellPlan => {
  if (!response.success) {
    const blackboardUpdate: Partial<BlackboardState> = {};
    return mapFailurePlan(
      response.code,
      response.error,
      blackboardUpdate
    );
  }

  const blackboardUpdate = parseBlackboardUpdate(response.blackboardUpdate);

  switch (response.action) {
    case 'WAIT_FOR_USER':
      return {
        _tag: 'WaitForUser',
        statePatch: { conductorFlowState: 'awaiting_input' },
        toast: { level: 'info', message: 'Conductor waiting for user input' },
        blackboardUpdate,
        suggestedPersonaId: response.suggestedPersonaId,
        isInterventionSuggestion: response.isInterventionSuggestion,
        warning: response.warning,
      };
    case 'TRIGGER_PERSONA':
      return {
        _tag: 'TriggerPersona',
        personaId: response.personaId,
        blackboardUpdate,
        warning: response.warning,
      };
    default: {
      const _exhaustive: never = response;
      return _exhaustive;
    }
  }
};
