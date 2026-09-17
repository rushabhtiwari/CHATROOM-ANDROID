/** Soft background/foreground pairs for app icons (catalog spec §4.1). */
export const TONES = [
  { background: "#E3F1EE", color: "#1D6B5F" }, // teal
  { background: "#E6EDFB", color: "#3056A8" }, // blue
  { background: "#FBF0DF", color: "#9A6216" }, // amber
  { background: "#F2E8F4", color: "#82408A" }, // plum
  { background: "#E5F2E6", color: "#2F7039" }, // green
  { background: "#FBE9EC", color: "#A63D52" }, // rose
  { background: "#ECEFF3", color: "#47525F" }, // slate
  { background: "#ECEAFB", color: "#4F46A5" }, // indigo
] as const;

export type Tone = (typeof TONES)[number];

/** A stable tone per app, so an app keeps its colour everywhere. */
export function appTone(slug: string): Tone {
  let hash = 2166136261;
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return TONES[hash % TONES.length];
}
