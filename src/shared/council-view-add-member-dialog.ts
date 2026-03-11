import type { CouncilAgentOptionDto } from "./ipc/dto.js";

type FilterAddableAgentsParams = {
  availableAgents: ReadonlyArray<CouncilAgentOptionDto>;
  memberAgentIds: ReadonlyArray<string>;
  searchText: string;
};

const normalizeSearchText = (value: string): string => value.trim().toLowerCase();

const matchesAgentSearch = (
  agent: CouncilAgentOptionDto,
  normalizedSearchText: string,
): boolean => {
  if (normalizedSearchText.length === 0) {
    return true;
  }

  return (
    agent.name.toLowerCase().includes(normalizedSearchText) ||
    agent.description.toLowerCase().includes(normalizedSearchText) ||
    agent.tags.some((tag) => tag.toLowerCase().includes(normalizedSearchText))
  );
};

export const filterAddableAgents = ({
  availableAgents,
  memberAgentIds,
  searchText,
}: FilterAddableAgentsParams): ReadonlyArray<CouncilAgentOptionDto> => {
  const normalizedSearchText = normalizeSearchText(searchText);
  const existingMemberIds = new Set(memberAgentIds);

  return availableAgents.filter((agent) => {
    if (existingMemberIds.has(agent.id) || agent.archived) {
      return false;
    }

    return matchesAgentSearch(agent, normalizedSearchText);
  });
};

export const resolveAddableAgentsEmptyStateMessage = (searchText: string): string =>
  normalizeSearchText(searchText).length > 0
    ? "No active agents match that title, description, or tag."
    : "No active agents are available to add.";
