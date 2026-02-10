export interface DemoGreetingInput {
  readonly name: string;
}

export interface DemoGreetingState {
  readonly greetingCount: number;
}

export interface DemoGreetingResult {
  readonly normalizedName: string;
  readonly greetingMessage: string;
}
