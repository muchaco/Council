import type { CouncilRuntimeErrorDto } from "../../../shared/council-runtime-error-normalization.js";
import type { GetCouncilViewResponse } from "../../../shared/ipc/dto";

export type CouncilViewTab = "overview" | "config";

export type CouncilViewState =
  | { status: "loading" }
  | {
      status: "ready";
      source: GetCouncilViewResponse;
      isStarting: boolean;
      isPausing: boolean;
      isResuming: boolean;
      isGeneratingManualTurn: boolean;
      pendingManualMemberAgentId: string | null;
      isInjectingConductor: boolean;
      isCancellingGeneration: boolean;
      isExportingTranscript: boolean;
      isLeavingView: boolean;
      showLeaveDialog: boolean;
      activeTab: CouncilViewTab;
      isConfigEditing: boolean;
      isSavingMembers: boolean;
      showMemberRemoveDialog: boolean;
      pendingMemberRemovalId: string | null;
      runtimeError: CouncilRuntimeErrorDto | null;
      message: string;
    }
  | { status: "error"; message: string };

export type CouncilViewReadyState = Extract<CouncilViewState, { status: "ready" }>;

export const MEMBER_COLOR_PALETTE: ReadonlyArray<string> = [
  "#0a5c66",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0f766e",
  "#166534",
  "#7c2d12",
];

export const createReadyCouncilViewState = (
  source: GetCouncilViewResponse,
  options?: { activeTab?: CouncilViewTab; runtimeError?: CouncilRuntimeErrorDto | null },
): CouncilViewReadyState => ({
  status: "ready",
  source,
  isStarting: false,
  isPausing: false,
  isResuming: false,
  isGeneratingManualTurn: false,
  pendingManualMemberAgentId: null,
  isInjectingConductor: false,
  isCancellingGeneration: false,
  isExportingTranscript: false,
  isLeavingView: false,
  showLeaveDialog: false,
  activeTab: options?.activeTab ?? "overview",
  isConfigEditing: false,
  isSavingMembers: false,
  showMemberRemoveDialog: false,
  pendingMemberRemovalId: null,
  runtimeError: options?.runtimeError ?? null,
  message: "",
});
