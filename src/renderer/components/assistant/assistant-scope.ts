type AssistantHomeTab = "councils" | "agents" | "settings";

type AssistantScopeScreenState =
  | { kind: "home" }
  | { kind: "agentEditor"; agentId: string | null }
  | { kind: "councilEditor"; councilId: string | null }
  | { kind: "councilView"; councilId: string };

export const resolveAssistantScopeKey = (params: {
  homeTab: AssistantHomeTab;
  screen: AssistantScopeScreenState;
}): string => {
  switch (params.screen.kind) {
    case "home":
      return `home:${params.homeTab}`;
    case "agentEditor":
      return `agentEditor:${params.screen.agentId ?? "new"}`;
    case "councilEditor":
      return `councilEditor:${params.screen.councilId ?? "new"}`;
    case "councilView":
      return `councilView:${params.screen.councilId}`;
  }
};
