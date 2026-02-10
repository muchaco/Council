import type { DemoGreetingResult, DemoGreetingState } from '../domain/demo-greeting';

export interface LogInfoEffect {
  readonly _tag: 'LogInfo';
  readonly message: string;
}

export type DemoGreetingEffect = LogInfoEffect;

export interface DemoGreetingPlan {
  readonly nextState: DemoGreetingState;
  readonly result: DemoGreetingResult;
  readonly effects: ReadonlyArray<DemoGreetingEffect>;
}
