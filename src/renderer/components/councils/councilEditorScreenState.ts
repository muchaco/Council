import type {
  CouncilDto,
  CouncilMode,
  GetCouncilEditorViewResponse,
} from "../../../shared/ipc/dto";

export type CouncilEditorDraft = {
  id: string | null;
  title: string;
  topic: string;
  goal: string;
  mode: CouncilMode;
  tagsInput: string;
  conductorModelSelection: string;
  selectedMemberIds: ReadonlyArray<string>;
};

export type CouncilEditorState =
  | { status: "loading" }
  | {
      status: "ready";
      source: GetCouncilEditorViewResponse;
      draft: CouncilEditorDraft;
      initialFingerprint: string;
      isSaving: boolean;
      isDeleting: boolean;
      isArchiving: boolean;
      isRefreshingModels: boolean;
      showDiscardDialog: boolean;
      showDeleteDialog: boolean;
      showRemoveMemberDialog: boolean;
      pendingMemberRemovalId: string | null;
      message: string;
    }
  | { status: "error"; message: string };

export type CouncilEditorReadyState = Extract<CouncilEditorState, { status: "ready" }>;

export const toCouncilEditorDraft = (council: CouncilDto | null): CouncilEditorDraft => ({
  id: council?.id ?? null,
  title: council?.title ?? "",
  topic: council?.topic ?? "",
  goal: council?.goal ?? "",
  mode: council?.mode ?? "manual",
  tagsInput: council?.tags.join(", ") ?? "",
  conductorModelSelection:
    council?.conductorModelRefOrNull === null || council?.conductorModelRefOrNull === undefined
      ? ""
      : `${council.conductorModelRefOrNull.providerId}:${council.conductorModelRefOrNull.modelId}`,
  selectedMemberIds: council?.memberAgentIds ?? [],
});

export const createReadyCouncilEditorState = (
  source: GetCouncilEditorViewResponse,
): CouncilEditorReadyState => {
  const draft = toCouncilEditorDraft(source.council);
  return {
    status: "ready",
    source,
    draft,
    initialFingerprint: JSON.stringify(draft),
    isSaving: false,
    isDeleting: false,
    isArchiving: false,
    isRefreshingModels: false,
    showDiscardDialog: false,
    showDeleteDialog: false,
    showRemoveMemberDialog: false,
    pendingMemberRemovalId: null,
    message: "",
  };
};

export const getCouncilEditorDraftFingerprint = (draft: CouncilEditorDraft): string =>
  JSON.stringify(draft);
