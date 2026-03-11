import type { JSX } from "react";

import { Button } from "../ui/button";

type CouncilViewTabsProps = {
  activeTab: "overview" | "config";
  disableConfigTab: boolean;
  disableOverviewTab: boolean;
  onSelectTab: (tab: "overview" | "config") => void;
};

export const CouncilViewTabs = ({
  activeTab,
  disableConfigTab,
  disableOverviewTab,
  onSelectTab,
}: CouncilViewTabsProps): JSX.Element => (
  <div
    aria-label="Council view left panel tabs"
    className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
    role="tablist"
  >
    <Button
      aria-controls="council-view-panel-overview"
      aria-selected={activeTab === "overview"}
      className="flex-1"
      data-state={activeTab === "overview" ? "active" : "inactive"}
      disabled={disableOverviewTab}
      id="council-view-tab-overview"
      onClick={() => onSelectTab("overview")}
      role="tab"
      variant={activeTab === "overview" ? "secondary" : "ghost"}
    >
      Overview
    </Button>
    <Button
      aria-controls="council-view-panel-config"
      aria-selected={activeTab === "config"}
      className="flex-1"
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
