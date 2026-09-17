/** Up to two initials for an avatar, e.g. "Ada Admin" → "AA". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}
