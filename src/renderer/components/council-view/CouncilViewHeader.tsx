import type { JSX } from "react";

import { ChevronLeft } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type RuntimeControlsSnapshot = {
  showTopBarStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStart: boolean;
};

type CouncilViewHeaderProps = {
  assistantLauncher: JSX.Element;
  autopilotLimitModalOpen: boolean;
  canShowRuntimeBlockBadge: boolean;
  invalidConfig: boolean;
  isLeavingView: boolean;
  isPausing: boolean;
  isResuming: boolean;
  isStarting: boolean;
  mode: "autopilot" | "manual";
  onBack: () => void;
  onPause: () => void;
  onResume: () => void;
  onStart: () => void;
  pauseDisabled: boolean;
  paused: boolean;
  pausedNextSpeakerName: string | null;
  resumeDisabledReason?: string;
  runtimeControls: RuntimeControlsSnapshot;
  showTopBarCancel: boolean;
  startDisabled: boolean;
  startDisabledReason?: string;
  started: boolean;
  statusBadgeTitle?: string;
  title: string;
  turnCount: number;
  autopilotTurnsCompleted: number;
  autopilotMaxTurns: number | null;
  onCancelGeneration: () => void;
  cancelDisabled: boolean;
  isCancellingGeneration: boolean;
};

export const CouncilViewHeader = ({
  assistantLauncher,
  autopilotLimitModalOpen,
  autopilotMaxTurns,
  autopilotTurnsCompleted,
  canShowRuntimeBlockBadge,
  cancelDisabled,
  invalidConfig,
  isCancellingGeneration,
  isLeavingView,
  isPausing,
  isResuming,
  isStarting,
  mode,
  onBack,
  onCancelGeneration,
  onPause,
  onResume,
  onStart,
  pauseDisabled,
  paused,
  pausedNextSpeakerName,
  resumeDisabledReason,
  runtimeControls,
  showTopBarCancel,
  startDisabled,
  startDisabledReason,
  started,
  statusBadgeTitle,
  title,
  turnCount,
}: CouncilViewHeaderProps): JSX.Element => (
  <header className="mb-4">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {assistantLauncher}
        <Button className="gap-2" disabled={isLeavingView} onClick={onBack} variant="outline">
          <ChevronLeft className="h-4 w-4" />
          {isLeavingView ? "Leaving..." : "Back"}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {runtimeControls.showTopBarStart ? (
          <Button disabled={startDisabled} onClick={onStart} title={startDisabledReason}>
            {isStarting ? "Starting..." : "Start"}
          </Button>
        ) : null}
        {runtimeControls.canPause ? (
          <Button disabled={pauseDisabled} onClick={onPause} variant="outline">
            {isPausing ? "Pausing..." : "Pause"}
          </Button>
        ) : null}
        {runtimeControls.canResume ? (
          <Button
            disabled={isResuming || startDisabled || autopilotLimitModalOpen}
            onClick={onResume}
            title={resumeDisabledReason}
          >
            {isResuming ? "Resuming..." : "Resume"}
          </Button>
        ) : null}
        {canShowRuntimeBlockBadge ? (
          <Badge title={statusBadgeTitle} variant={invalidConfig ? "destructive" : "outline"}>
            {invalidConfig ? "Invalid config" : "Archived members"}
          </Badge>
        ) : null}
        {showTopBarCancel ? (
          <Button disabled={cancelDisabled} onClick={onCancelGeneration} variant="outline">
            {isCancellingGeneration ? "Cancelling..." : "Cancel"}
          </Button>
        ) : null}
      </div>
    </div>
    <h1 className="mb-2 text-2xl">{title}</h1>
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <Badge className="capitalize" variant="outline">
        {mode}
      </Badge>
      <span>{started ? (paused ? "Paused" : "Running") : "Stopped"}</span>
      <span>Turn {turnCount}</span>
      {mode === "autopilot" ? (
        <span>
          {autopilotTurnsCompleted}/{autopilotMaxTurns ?? "∞"} completed
        </span>
      ) : null}
    </div>
    {pausedNextSpeakerName !== null ? (
      <p className="mt-2 text-sm text-muted-foreground">Next speaker: {pausedNextSpeakerName}</p>
    ) : null}
  </header>
);
