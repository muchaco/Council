export type Brand<K, T> = K & { readonly __brand: T };

export type AgentId = Brand<string, "AgentId">;
export type CouncilId = Brand<string, "CouncilId">;
export type MessageId = Brand<string, "MessageId">;
export type ProviderId = Brand<string, "ProviderId">;
export type MemberId = Brand<string, "MemberId">;

export const asAgentId = (value: string): AgentId => value as AgentId;
export const asCouncilId = (value: string): CouncilId => value as CouncilId;
export const asMessageId = (value: string): MessageId => value as MessageId;
export const asProviderId = (value: string): ProviderId => value as ProviderId;
export const asMemberId = (value: string): MemberId => value as MemberId;
