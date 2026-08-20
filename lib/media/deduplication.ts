export function findDuplicateHash(
  contentHash: string,
  existing: Iterable<string>,
) {
  const normalized = contentHash.trim().toLowerCase();
  return (
    [...existing].find((hash) => hash.toLowerCase() === normalized) ?? null
  );
}
