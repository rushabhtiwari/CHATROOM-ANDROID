/** Gradient pairs for app icon tiles (workspace spec §3.2). */
export const TONES = [
  { from: "#22C55E", to: "#047857" }, // green
  { from: "#3B82F6", to: "#1D4ED8" }, // blue
  { from: "#F59E0B", to: "#C2410C" }, // amber
  { from: "#8B5CF6", to: "#5B21B6" }, // violet
  { from: "#F43F5E", to: "#BE123C" }, // rose
  { from: "#14B8A6", to: "#0F766E" }, // teal
  { from: "#EC4899", to: "#A21CAF" }, // pink
  { from: "#64748B", to: "#334155" }, // slate
  { from: "#06B6D4", to: "#0E7490" }, // cyan
  { from: "#10B981", to: "#065F46" }, // emerald
  { from: "#F97316", to: "#C2410C" }, // orange
  { from: "#EAB308", to: "#A16207" }, // yellow
  { from: "#6366F1", to: "#4338CA" }, // indigo
  { from: "#94A3B8", to: "#475569" }, // grey
] as const;

export type Tone = (typeof TONES)[number];

/** A stable tone per app, so an app keeps its colour everywhere. */
export function appTone(slug: string): Tone {
  let hash = 2166136261;
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return TONES[hash % TONES.length];
}
