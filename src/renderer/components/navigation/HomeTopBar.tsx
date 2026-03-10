import { LayoutDashboard, Settings, Users } from "lucide-react";
import type { MutableRefObject, KeyboardEvent as ReactKeyboardEvent } from "react";

import { formatHomeListTotal } from "../../../shared/app-ui-helpers.js";

export type HomeTab = "councils" | "agents" | "settings";

type HomeTopBarProps = {
  activeTab: HomeTab;
  agentsTotal: number;
  councilsTotal: number;
  homeTabButtonRefs: MutableRefObject<Record<HomeTab, HTMLButtonElement | null>>;
  onHomeTabKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, currentTab: HomeTab) => void;
  onTabChange: (tab: HomeTab) => void;
};

export const HomeTopBar = ({
  activeTab,
  agentsTotal,
  councilsTotal,
  homeTabButtonRefs,
  onHomeTabKeyDown,
  onTabChange,
}: HomeTopBarProps): JSX.Element => (
  <header className="home-topbar">
    <nav aria-label="Home sections" className="home-tabs" role="tablist">
      <button
        aria-label={`Councils (${formatHomeListTotal({ total: councilsTotal, singularLabel: "council" })})`}
        aria-controls="home-panel-councils"
        aria-selected={activeTab === "councils"}
        className={activeTab === "councils" ? "home-tab-button active" : "home-tab-button"}
        id="home-tab-councils"
        onClick={() => onTabChange("councils")}
        onKeyDown={(event) => onHomeTabKeyDown(event, "councils")}
        ref={(node) => {
          homeTabButtonRefs.current.councils = node;
        }}
        role="tab"
        type="button"
      >
        <LayoutDashboard />
        <span className="home-tab-label">Councils</span>
        <span aria-hidden="true" className="home-tab-count" data-count={councilsTotal.toString()} />
      </button>
      <button
        aria-label={`Agents (${formatHomeListTotal({ total: agentsTotal, singularLabel: "agent" })})`}
        aria-controls="home-panel-agents"
        aria-selected={activeTab === "agents"}
        className={activeTab === "agents" ? "home-tab-button active" : "home-tab-button"}
        id="home-tab-agents"
        onClick={() => onTabChange("agents")}
        onKeyDown={(event) => onHomeTabKeyDown(event, "agents")}
        ref={(node) => {
          homeTabButtonRefs.current.agents = node;
        }}
        role="tab"
        type="button"
      >
        <Users />
        <span className="home-tab-label">Agents</span>
        <span aria-hidden="true" className="home-tab-count" data-count={agentsTotal.toString()} />
      </button>
      <button
        aria-controls="home-panel-settings"
        aria-selected={activeTab === "settings"}
        className={activeTab === "settings" ? "home-tab-button active" : "home-tab-button"}
        id="home-tab-settings"
        onClick={() => onTabChange("settings")}
        onKeyDown={(event) => onHomeTabKeyDown(event, "settings")}
        ref={(node) => {
          homeTabButtonRefs.current.settings = node;
        }}
        role="tab"
        type="button"
      >
        <Settings />
        <span>Settings</span>
      </button>
    </nav>
  </header>
);
