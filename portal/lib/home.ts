import type { AppCategory, MyApp } from "@/lib/types";

export type HomeTab = "all" | AppCategory;
export type HomeFilters = { query: string; tab: HomeTab; liveOnly: boolean };
export type AppGroup = { category: AppCategory; label: string; description: string; apps: MyApp[] };

const GROUPS: Omit<AppGroup, "apps">[] = [
  { category: "department", label: "Departments", description: "Tools for each team's day-to-day work" },
  { category: "company", label: "Company tools", description: "Shared by everyone across departments" },
];

function matches(app: MyApp, query: string, liveOnly: boolean): boolean {
  if (liveOnly && app.status !== "active") return false;
  const needle = query.trim().toLowerCase();
  return !needle || app.name.toLowerCase().includes(needle) || app.description.toLowerCase().includes(needle);
}

/** Apps to show, grouped (departments first) and sorted by name; empty groups are dropped. */
export function groupApps(apps: MyApp[], { query, tab, liveOnly }: HomeFilters): AppGroup[] {
  const visible = apps.filter((app) => matches(app, query, liveOnly));
  return GROUPS.filter((group) => tab === "all" || tab === group.category)
    .map((group) => ({
      ...group,
      apps: visible.filter((app) => app.category === group.category).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.apps.length > 0);
}

/** How many apps each tab would show under the current search and live-only setting. */
export function tabCounts(apps: MyApp[], query: string, liveOnly: boolean): Record<HomeTab, number> {
  const visible = apps.filter((app) => matches(app, query, liveOnly));
  return {
    all: visible.length,
    department: visible.filter((app) => app.category === "department").length,
    company: visible.filter((app) => app.category === "company").length,
  };
}

export function summarise(apps: MyApp[], departmentCount: number) {
  const live = apps.filter((app) => app.status === "active").length;
  return { total: apps.length, live, soon: apps.length - live, departments: departmentCount };
}

export function firstLiveMatch(groups: AppGroup[]): MyApp | undefined {
  return groups.flatMap((group) => group.apps).find((app) => app.status === "active");
}

export function roleLabel(key: string): string {
  return key ? key[0].toUpperCase() + key.slice(1) : "";
}

/** Time-of-day greeting; `null` (not yet known on the server) gives a neutral greeting. */
export function greetingFor(hour: number | null): string {
  if (hour === null) return "Welcome";
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Thursday, 17 September", built from parts so every runtime formats it the same way. */
export function formatDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  return `${weekday}, ${date.getDate()} ${month}`;
}
