import type { Dispatch, SetStateAction } from "react";

import type { AutopilotLimitModalAction } from "../../../shared/app-ui-helpers.js";
import type { CouncilViewState } from "./councilViewScreenState";
import type { LoadCouncilView } from "./useCouncilViewScreenLifecycle";

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
