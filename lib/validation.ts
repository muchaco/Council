// Tag validation pure functions - Functional Core
// These functions contain no side effects and are fully testable

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalizedTag?: string;
}

/**
 * Validates a tag input according to FR-1.1, FR-1.3, FR-1.4, FR-1.9
 * - Max 20 characters (FR-1.1)
 * - No duplicates (case-insensitive) (FR-1.3)
 * - Normalized to lowercase (FR-1.4)
 * - Reject empty/whitespace-only (FR-1.9)
 */
export function validateTagInput(
  input: string,
  existingTags: string[]
): ValidationResult {
  const trimmed = input.trim();
  
  // FR-1.9: Reject if only whitespace
  if (!trimmed) {
    return { valid: false, error: 'Tag cannot be empty' };
  }
  
  // FR-1.1: Max 20 characters
  if (trimmed.length > 20) {
    return { valid: false, error: 'Tag must be 20 characters or less' };
  }
  
  // FR-1.4: Normalize to lowercase
  const normalized = trimmed.toLowerCase();
  
  // FR-1.3: No duplicates (case-insensitive)
  if (existingTags.some(tag => tag.toLowerCase() === normalized)) {
    return { valid: false, error: 'Tag already exists' };
  }
  
  return { valid: true, normalizedTag: normalized };
}

/**
 * Checks if a tag can be added to a session
 * FR-1.2: Max 3 tags per session
 */
export function canAddTag(currentTags: string[]): boolean {
  return currentTags.length < 3;
}

/**
 * Sanitizes a tag string
 * FR-1.4: Normalize to lowercase
 * FR-1.18: Trim whitespace
 */
export function sanitizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}
