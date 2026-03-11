import { type Result, err, ok } from "neverthrow";

export const TAG_MIN_LENGTH = 1;
export const TAG_MAX_LENGTH = 20;
export const TAG_MAX_PER_OBJECT = 3;

export type Tag = string & { readonly __brand: "Tag" };

export type TagValidationError = "TagTooShort" | "TagTooLong" | "TagLimitExceeded" | "TagDuplicate";

const normalizeTag = (input: string): string => input.trim();

export const createTag = (input: string): Result<Tag, TagValidationError> => {
  const normalized = normalizeTag(input);
  if (normalized.length < TAG_MIN_LENGTH) {
    return err("TagTooShort");
  }
  if (normalized.length > TAG_MAX_LENGTH) {
    return err("TagTooLong");
  }
  return ok(normalized as Tag);
};

export const addTag = (
  existing: ReadonlyArray<Tag>,
  candidateRaw: string,
): Result<ReadonlyArray<Tag>, TagValidationError> => {
  const candidateResult = createTag(candidateRaw);
  if (candidateResult.isErr()) {
    return err(candidateResult.error);
  }

  const candidate = candidateResult.value;
  const duplicate = existing.some((item) => item.toLowerCase() === candidate.toLowerCase());
  if (duplicate) {
    return err("TagDuplicate");
  }

  if (existing.length >= TAG_MAX_PER_OBJECT) {
    return err("TagLimitExceeded");
  }

  return ok([...existing, candidate]);
};

export const tagMatchesFilter = (tag: Tag, filterRaw: string): boolean => {
  const normalizedFilter = normalizeTag(filterRaw).toLowerCase();
  if (normalizedFilter.length === 0) {
    return true;
  }
  return tag.toLowerCase() === normalizedFilter;
};

export const parseTagFilterValues = (filterRaw: string): ReadonlyArray<string> =>
  filterRaw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, allValues) => value.length > 0 && allValues.indexOf(value) === index);

export const tagsMatchAllFilters = (tags: ReadonlyArray<Tag>, filterRaw: string): boolean => {
  const filters = parseTagFilterValues(filterRaw);
  if (filters.length === 0) {
    return true;
  }

  return filters.every((filter) => tags.some((tag) => tag.toLowerCase() === filter));
};
