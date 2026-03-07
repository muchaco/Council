type HomeTabNavigationKey = "ArrowRight" | "ArrowLeft" | "Home" | "End";

type ClosestCapableTarget = EventTarget & {
  closest?: (selector: string) => unknown;
};

const CARD_OPEN_IGNORE_SELECTOR = [
  "button",
  "summary",
  "details",
  "input",
  "select",
  "textarea",
  "a",
  "[data-card-open-ignore='true']",
].join(", ");

const isHomeTabNavigationKey = (key: string): key is HomeTabNavigationKey =>
  key === "ArrowRight" || key === "ArrowLeft" || key === "Home" || key === "End";

export const resolveHomeTabFocusIndex = (params: {
  currentIndex: number;
  key: string;
  totalTabs: number;
}): number | null => {
  const { currentIndex, key, totalTabs } = params;
  if (
    !isHomeTabNavigationKey(key) ||
    totalTabs <= 0 ||
    currentIndex < 0 ||
    currentIndex >= totalTabs
  ) {
    return null;
  }

  if (key === "Home") {
    return 0;
  }

  if (key === "End") {
    return totalTabs - 1;
  }

  if (key === "ArrowRight") {
    return currentIndex === totalTabs - 1 ? 0 : currentIndex + 1;
  }

  return currentIndex === 0 ? totalTabs - 1 : currentIndex - 1;
};

export const isListRowOpenKey = (key: string): boolean =>
  key === "Enter" || key === " " || key === "Spacebar";

export const isCardOpenInteractionTarget = (target: EventTarget | null): boolean => {
  if (target === null || typeof target !== "object") {
    return false;
  }

  const maybeElement = target as ClosestCapableTarget;
  if (typeof maybeElement.closest !== "function") {
    return true;
  }

  return maybeElement.closest(CARD_OPEN_IGNORE_SELECTOR) === null;
};
