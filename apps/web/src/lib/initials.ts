/**
 * Derives up to two initials from a display name. Falls back to '?' rather than
 * returning an empty string, so a missing name renders as visibly missing instead of
 * as an empty circle.
 */
export function initialsOf(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
