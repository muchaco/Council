import { it } from "vitest";

export type RequirementId = string;

type AsyncOrSyncVoid = void | Promise<void>;

export const itReq = (
  requirementIds: ReadonlyArray<RequirementId>,
  name: string,
  testFn: () => AsyncOrSyncVoid,
): void => {
  void requirementIds;
  it(name, testFn);
};
