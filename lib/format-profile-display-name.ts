function toTitleCase(value: string): string {
  const lower = value.trim().toLowerCase();
  if (!lower) return "";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Header / account menu: first name + last name, title case (e.g. Jericko Razal). */
export function formatProfileDisplayName(
  fullName: string | null | undefined
): string {
  if (!fullName?.trim()) return "";

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return toTitleCase(parts[0]);

  return `${toTitleCase(parts[0])} ${toTitleCase(parts[parts.length - 1])}`;
}
