/**
 * Normalizes input string by splitting by newlines, commas, or tabs,
 * trimming whitespace, and removing empty entries.
 */
export const parseInput = (input: string): string[] => {
  if (!input) return [];
  // Split by newline, comma, or tab
  return input
    .split(/[\n,\t]/)
    .map(id => id.trim())
    .filter(id => id.length > 0);
};

/**
 * Removes duplicates from an array of IDs using case-insensitive comparison.
 * Preserves the first occurrence's casing if possible, or just unique-fies.
 * Since the requirement is case-insensitive, we'll use a Map to keep track.
 */
export const makeUnique = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const uniqueIds: string[] = [];
  
  for (const id of ids) {
    const lowerId = id.toLowerCase();
    if (!seen.has(lowerId)) {
      seen.add(lowerId);
      uniqueIds.push(id);
    }
  }
  
  return uniqueIds;
};

/**
 * Compares two sets of IDs and returns the diffs.
 */
export const compareSets = (leftIds: string[], rightIds: string[]) => {
  const leftNormalized = new Map(leftIds.map(id => [id.toLowerCase(), id]));
  const rightNormalized = new Map(rightIds.map(id => [id.toLowerCase(), id]));

  const leftSet = new Set(leftNormalized.keys());
  const rightSet = new Set(rightNormalized.keys());

  const onlyLeft: string[] = [];
  const onlyRight: string[] = [];
  const both: string[] = [];

  leftNormalized.forEach((original, lower) => {
    if (rightSet.has(lower)) {
      both.push(original);
    } else {
      onlyLeft.push(original);
    }
  });

  rightNormalized.forEach((original, lower) => {
    if (!leftSet.has(lower)) {
      onlyRight.push(original);
    }
  });

  return {
    onlyLeft,
    onlyRight,
    both
  };
};
