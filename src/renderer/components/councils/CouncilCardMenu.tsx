import type { KeyboardEvent as ReactKeyboardEvent, SyntheticEvent } from "react";

import type { CouncilDto } from "../../../shared/ipc/dto";
import type { HomeTab } from "../navigation/HomeTopBar";

type CouncilCardMenuProps = {
  council: CouncilDto;
  exportingCouncilId: string | null;
  onDelete: (council: CouncilDto) => void;
  onExport: (councilId: string) => void;
  onMenuKeyDown: (event: ReactKeyboardEvent<HTMLDetailsElement>) => void;
  onMenuSummaryKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onMenuToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  onSetArchived: (params: { councilId: string; archived: boolean }) => void;
};

export const CouncilCardMenu = ({
  council,
  exportingCouncilId,
  onDelete,
  onExport,
  onMenuKeyDown,
  onMenuSummaryKeyDown,
  onMenuToggle,
  onSetArchived,
}: CouncilCardMenuProps): JSX.Element => (
  <details
    aria-label={`Actions menu for council ${council.title}`}
    className="council-actions-menu"
    data-card-open-ignore="true"
    onKeyDown={onMenuKeyDown}
    onToggle={onMenuToggle}
  >
    <summary
      aria-label={`Toggle actions for council ${council.title}`}
      className="council-btn-more"
      onKeyDown={onMenuSummaryKeyDown}
    >
      <span className="sr-only">Council actions</span>
      ...
    </summary>
    <div
      aria-label={`Council actions for ${council.title}`}
      className="council-menu-dropdown row-menu-items"
    >
      <button
        className="council-menu-item"
        disabled={exportingCouncilId === council.id}
        onClick={(event) => {
          const details = event.currentTarget.closest("details");
          if (details) {
            details.open = false;
          }
          onExport(council.id);
        }}
        type="button"
      >
        {exportingCouncilId === council.id ? "Exporting..." : "Export transcript"}
      </button>
      <hr className="council-menu-divider" />
      <button
        className="council-menu-item"
        disabled={
          !council.archived && council.mode === "autopilot" && council.started && !council.paused
        }
        onClick={(event) => {
          const details = event.currentTarget.closest("details");
          if (details) {
            details.open = false;
          }
          onSetArchived({ councilId: council.id, archived: !council.archived });
        }}
        title={
          !council.archived && council.mode === "autopilot" && council.started && !council.paused
            ? "Pause Autopilot before archiving"
            : undefined
        }
        type="button"
      >
        {council.archived ? "Restore council" : "Archive council"}
      </button>
      <hr className="council-menu-divider" />
      <button
        className="council-menu-item council-menu-item-danger"
        onClick={(event) => {
          const details = event.currentTarget.closest("details");
          if (details) {
            details.open = false;
          }
          onDelete(council);
        }}
        type="button"
      >
        Delete council
      </button>
    </div>
  </details>
);
