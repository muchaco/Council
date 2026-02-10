export interface SessionTagCatalogEntry {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
}

export interface SessionTagDecisionContext {
  readonly sessionId: string;
  readonly assignedTagNames: readonly string[];
  readonly availableTagNames: readonly string[];
}

export interface SessionTagPolicy {
  readonly maxTagsPerSession: number;
  readonly maxTagLength: number;
}

export interface AssignSessionTagCommand {
  readonly requestedTagName: string;
}

export interface RemoveSessionTagCommand {
  readonly requestedTagName: string;
}

export const defaultSessionTagPolicy: SessionTagPolicy = {
  maxTagsPerSession: 3,
  maxTagLength: 20,
};
