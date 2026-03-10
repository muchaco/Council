import { useEffect, useRef, useState } from "react";

import { AgentEditorScreen } from "./components/agents/AgentEditorScreen";
import { CouncilViewScreen } from "./components/council-view/CouncilViewScreen";
import { CouncilEditorScreen } from "./components/councils/CouncilEditorScreen";
import { HomeScreen } from "./components/home/HomeScreen";
import type { HomeTab } from "./components/navigation/HomeTopBar";
import { useToastQueue } from "./use-toast-queue";

type ScreenState =
  | { kind: "home" }
  | { kind: "agentEditor"; agentId: string | null }
  | { kind: "councilEditor"; councilId: string | null }
  | { kind: "councilView"; councilId: string };

export const App = (): JSX.Element => {
  const [homeTab, setHomeTab] = useState<HomeTab>("councils");
  const [screen, setScreen] = useState<ScreenState>({ kind: "home" });
  const homeTabAtDetailOpenRef = useRef<HomeTab>("councils");
  const { pushToast } = useToastQueue();

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;

    const applyTheme = (isDark: boolean): void => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    applyTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent): void => {
      applyTheme(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const openAgentEditor = (agentId: string | null): void => {
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
    setScreen({ kind: "agentEditor", agentId });
  };

  const openCouncilEditor = (councilId: string | null): void => {
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
    setScreen({ kind: "councilEditor", councilId });
  };

  const openCouncilView = (councilId: string): void => {
    if (screen.kind === "home") {
      homeTabAtDetailOpenRef.current = homeTab;
    }
    setScreen({ kind: "councilView", councilId });
  };

  const closeToHome = (nextTab?: HomeTab): void => {
    setScreen({ kind: "home" });
    setHomeTab(nextTab ?? homeTabAtDetailOpenRef.current);
  };

  return (
    <>
      <HomeScreen
        activeTab={homeTab}
        isActive={screen.kind === "home"}
        onOpenAgentEditor={openAgentEditor}
        onOpenCouncilEditor={openCouncilEditor}
        onOpenCouncilView={openCouncilView}
        onTabChange={setHomeTab}
        pushToast={pushToast}
      />

      <AgentEditorScreen
        agentId={screen.kind === "agentEditor" ? screen.agentId : null}
        isActive={screen.kind === "agentEditor"}
        onClose={(tab) => closeToHome(tab)}
        pushToast={pushToast}
      />

      <CouncilEditorScreen
        councilId={screen.kind === "councilEditor" ? screen.councilId : null}
        isActive={screen.kind === "councilEditor"}
        onClose={() => closeToHome("councils")}
        pushToast={pushToast}
      />

      <CouncilViewScreen
        councilId={screen.kind === "councilView" ? screen.councilId : ""}
        isActive={screen.kind === "councilView"}
        onClose={() => closeToHome()}
        pushToast={pushToast}
      />
    </>
  );
};
