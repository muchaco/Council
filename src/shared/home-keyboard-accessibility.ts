type HomeTabNavigationKey = "ArrowRight" | "ArrowLeft" | "Home" | "End";

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
