import type { AppCategory, MyApp } from "@/lib/types";

export type AppGroup = { category: AppCategory; label: string; apps: MyApp[] };

const GROUPS: { category: AppCategory; label: string }[] = [
  { category: "department", label: "Departments" },
  { category: "company", label: "Company tools" },
];

/** Apps matching the search (name or description, case-insensitive), grouped and sorted by name. */
export function groupApps(apps: MyApp[], query: string): AppGroup[] {
  const needle = query.trim().toLowerCase();
  const matches = apps.filter(
    (app) => !needle || app.name.toLowerCase().includes(needle) || app.description.toLowerCase().includes(needle),
  );
  return GROUPS.map((group) => ({
    ...group,
    apps: matches.filter((app) => app.category === group.category).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.apps.length > 0);
}

export function firstLiveMatch(groups: AppGroup[]): MyApp | undefined {
  return groups.flatMap((group) => group.apps).find((app) => app.status === "active");
}

/** Time-of-day greeting; `null` (not yet known on the server) gives a neutral greeting. */
export function greetingFor(hour: number | null): string {
  if (hour === null) return "Welcome";
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}
