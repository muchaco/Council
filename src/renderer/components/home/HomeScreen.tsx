import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { resolveHomeTabFocusIndex } from "../../../shared/home-keyboard-accessibility.js";
import { type HomeTab, HomeTopBar } from "../navigation/HomeTopBar";
import { SettingsPanel } from "../settings/SettingsPanel";
import { AgentsPanel } from "./AgentsPanel";
import { CouncilsPanel } from "./CouncilsPanel";

const HOME_TAB_ORDER: ReadonlyArray<HomeTab> = ["councils", "agents", "settings"];

type HomeScreenProps = {
  activeTab: HomeTab;
  isActive: boolean;
  onOpenAgentEditor: (agentId: string | null) => void;
  onOpenCouncilEditor: (councilId: string | null) => void;
  onOpenCouncilView: (councilId: string) => void;
  onTabChange: (tab: HomeTab) => void;
  pushToast: (tone: "warning" | "error" | "info", message: string) => void;
};

export const HomeScreen = ({
  activeTab,
  isActive,
  onOpenAgentEditor,
  onOpenCouncilEditor,
  onOpenCouncilView,
  onTabChange,
  pushToast,
}: HomeScreenProps): JSX.Element => {
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [councilsTotal, setCouncilsTotal] = useState(0);
  const homeTabButtonRefs = useRef<Record<HomeTab, HTMLButtonElement | null>>({
    councils: null,
    agents: null,
    settings: null,
  });

  useEffect(() => {
    if (!isActive) {
      return;
    }
    document.title = activeTab === "settings" ? "Settings" : "Council";
  }, [activeTab, isActive]);

  const handleHomeTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: HomeTab,
  ): void => {
    const currentIndex = HOME_TAB_ORDER.indexOf(currentTab);
    if (currentIndex < 0) {
      return;
    }
    const nextIndex = resolveHomeTabFocusIndex({
      currentIndex,
      key: event.key,
      totalTabs: HOME_TAB_ORDER.length,
    });
    if (nextIndex === null || nextIndex === currentIndex) {
      return;
    }
    event.preventDefault();
    const nextTab = HOME_TAB_ORDER[nextIndex];
    if (nextTab === undefined) {
      return;
    }
    onTabChange(nextTab);
    homeTabButtonRefs.current[nextTab]?.focus();
  };

  return (
    <div className="app-shell" hidden={!isActive}>
      <main className="main-content">
        <div className="main-content-inner">
          <HomeTopBar
            activeTab={activeTab}
            agentsTotal={agentsTotal}
            councilsTotal={councilsTotal}
            homeTabButtonRefs={homeTabButtonRefs}
            onHomeTabKeyDown={handleHomeTabKeyDown}
            onTabChange={onTabChange}
          />

          <CouncilsPanel
            isActive={isActive && activeTab === "councils"}
            onOpenCouncilEditor={() => onOpenCouncilEditor(null)}
            onOpenCouncilView={onOpenCouncilView}
            onTotalChange={setCouncilsTotal}
            pushToast={pushToast}
          />

          <AgentsPanel
            isActive={isActive && activeTab === "agents"}
            onOpenAgentEditor={() => onOpenAgentEditor(null)}
            onOpenAgentFromCard={onOpenAgentEditor}
            onTotalChange={setAgentsTotal}
            pushToast={pushToast}
          />

          {activeTab === "settings" ? (
            <SettingsPanel isActive={isActive && activeTab === "settings"} pushToast={pushToast} />
          ) : null}
        </div>
      </main>
    </div>
  );
};
