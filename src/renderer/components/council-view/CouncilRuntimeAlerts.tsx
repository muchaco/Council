import type { JSX } from "react";

type CouncilRuntimeAlertsProps = {
  archived: boolean;
  archivedMemberNames: ReadonlyArray<string>;
  hasArchivedMembers: boolean;
  invalidConfig: boolean;
  message: string;
  showMessage: boolean;
};

export const CouncilRuntimeAlerts = ({
  archived,
  archivedMemberNames,
  hasArchivedMembers,
  invalidConfig,
  message,
  showMessage,
}: CouncilRuntimeAlertsProps): JSX.Element => (
  <>
    {archived ? (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm text-amber-800">Archived councils are read-only.</p>
      </div>
    ) : null}
    {hasArchivedMembers ? (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm text-amber-800">
          This council includes archived members: {archivedMemberNames.join(", ")}. Restore or
          remove them before starting, resuming, or choosing the next speaker.
        </p>
      </div>
    ) : null}
    {invalidConfig ? (
      <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
        <p className="text-sm text-destructive">
          Invalid config: start/resume is blocked until you select an available Conductor model or
          refresh models in Config.
        </p>
      </div>
    ) : null}
    {showMessage ? (
      <div className="mb-4 rounded-lg bg-muted p-3">
        <p className="text-sm">{message}</p>
      </div>
    ) : null}
  </>
);
