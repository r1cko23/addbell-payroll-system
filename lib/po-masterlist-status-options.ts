export function withCurrentStatusOption(
  catalog: readonly string[],
  value: string
): string[] {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return [...catalog];
  if (catalog.some((item) => item.toUpperCase() === normalized)) {
    return [...catalog];
  }
  return [normalized, ...catalog];
}
