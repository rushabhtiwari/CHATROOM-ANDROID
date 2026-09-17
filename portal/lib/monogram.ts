/** Deterministic tile colour and initials for an app, so each app is recognisable at a glance. */

const PALETTE = ["#0F6E6E", "#3B5BA9", "#8A4B9A", "#A6532A", "#2F7D4A", "#7A6A1F", "#9C3D54", "#44617A"];

export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function tileColor(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
