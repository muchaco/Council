import type { JSX } from "react";

import { Button } from "../ui/button";

type CouncilViewTabsProps = {
  activeTab: "discussion" | "config";
  disableConfigTab: boolean;
  disableDiscussionTab: boolean;
  onSelectTab: (tab: "discussion" | "config") => void;
};

export const CouncilViewTabs = ({
  activeTab,
  disableConfigTab,
  disableDiscussionTab,
  onSelectTab,
}: CouncilViewTabsProps): JSX.Element => (
  <div
    aria-label="Council view tabs"
    className="mt-6 flex items-center gap-1 border-b"
    role="tablist"
  >
    <Button
      aria-controls="council-view-panel-discussion"
      aria-selected={activeTab === "discussion"}
      data-state={activeTab === "discussion" ? "active" : "inactive"}
      disabled={disableDiscussionTab}
      id="council-view-tab-discussion"
      onClick={() => onSelectTab("discussion")}
      role="tab"
      variant={activeTab === "discussion" ? "secondary" : "ghost"}
    >
      Discussion
    </Button>
    <Button
      aria-controls="council-view-panel-config"
      aria-selected={activeTab === "config"}
      data-state={activeTab === "config" ? "active" : "inactive"}
      disabled={disableConfigTab}
      id="council-view-tab-config"
      onClick={() => onSelectTab("config")}
      role="tab"
      variant={activeTab === "config" ? "secondary" : "ghost"}
    >
      Config
    </Button>
  </div>
);
