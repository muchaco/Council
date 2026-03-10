import type { Dispatch, SetStateAction } from "react";

import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import type { CouncilRuntimeErrorDto } from "../../../shared/council-runtime-error-normalization.js";
import type { CouncilViewState, CouncilViewTab } from "./councilViewScreenState";

export type LoadCouncilView = (
  nextCouncilId: string,
  options?: {
    preserveActiveTab?: CouncilViewTab;
    runtimeError?: CouncilRuntimeErrorDto | null;
  },
) => Promise<void>;

export type CouncilViewActionContext = {
  autopilotLimitAction: AutopilotLimitModalAction | null;
  councilId: string;
  loadCouncilView: LoadCouncilView;
  onClose: () => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
  setAutopilotLimitAction: Dispatch<SetStateAction<AutopilotLimitModalAction | null>>;
  setState: Dispatch<SetStateAction<CouncilViewState>>;
  state: CouncilViewState;
};
