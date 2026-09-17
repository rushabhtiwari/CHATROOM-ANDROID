import { describe, expect, it } from "vitest";

import { firstLiveMatch, formatDate, greetingFor, groupApps, roleLabel, summarise, tabCounts } from "@/lib/home";
import type { MyApp } from "@/lib/types";

function app(slug: string, patch: Partial<MyApp> = {}): MyApp {
  return {
    slug,
    name: slug[0].toUpperCase() + slug.slice(1),
    description: `${slug} description`,
    category: "department",
    status: "active",
    icon: "",
    logo_version: null,
    launch_url: `https://${slug}.yourco.com`,
    role: "member",
    ...patch,
  };
}

const APPS = [
  app("sales", { status: "coming_soon", launch_url: "" }),
  app("chat", { category: "company", description: "Channels and messages" }),
  app("accounts"),
  app("projects", { category: "company", status: "coming_soon", launch_url: "" }),
];

const slugs = (groups: ReturnType<typeof groupApps>) => groups.map((g) => [g.category, g.apps.map((a) => a.slug)]);

describe("groupApps", () => {
  it("puts departments first, company tools second, sorted by name", () => {
    expect(slugs(groupApps(APPS, { query: "", tab: "all", liveOnly: false }))).toEqual([
      ["department", ["accounts", "sales"]],
      ["company", ["chat", "projects"]],
    ]);
  });

  it("filters by tab, live-only and search, dropping empty groups", () => {
    expect(slugs(groupApps(APPS, { query: "", tab: "company", liveOnly: false }))).toEqual([
      ["company", ["chat", "projects"]],
    ]);
    expect(slugs(groupApps(APPS, { query: "", tab: "all", liveOnly: true }))).toEqual([
      ["department", ["accounts"]],
      ["company", ["chat"]],
    ]);
    expect(slugs(groupApps(APPS, { query: " MESSAGES ", tab: "all", liveOnly: false }))).toEqual([
      ["company", ["chat"]],
    ]);
    expect(groupApps(APPS, { query: "payroll", tab: "all", liveOnly: false })).toEqual([]);
  });
});

describe("tabCounts", () => {
  it("counts what each tab would show under the current search and live-only setting", () => {
    expect(tabCounts(APPS, "", false)).toEqual({ all: 4, department: 2, company: 2 });
    expect(tabCounts(APPS, "", true)).toEqual({ all: 2, department: 1, company: 1 });
    expect(tabCounts(APPS, "sales", false)).toEqual({ all: 1, department: 1, company: 0 });
  });
});

describe("summarise", () => {
  it("counts apps, live, coming soon and the person's departments", () => {
    expect(summarise(APPS, 2)).toEqual({ total: 4, live: 2, soon: 2, departments: 2 });
  });
});

describe("firstLiveMatch", () => {
  it("skips coming-soon apps", () => {
    expect(firstLiveMatch(groupApps(APPS, { query: "s", tab: "all", liveOnly: false }))?.slug).toBe("accounts");
    expect(firstLiveMatch(groupApps(APPS, { query: "sales", tab: "all", liveOnly: false }))).toBeUndefined();
  });
});

describe("labels", () => {
  it("formats role keys, greetings and dates", () => {
    expect(roleLabel("manager")).toBe("Manager");
    expect(roleLabel("")).toBe("");
    expect(greetingFor(8)).toBe("Good morning");
    expect(greetingFor(13)).toBe("Good afternoon");
    expect(greetingFor(20)).toBe("Good evening");
    expect(greetingFor(null)).toBe("Welcome");
    expect(formatDate(new Date(2026, 8, 17))).toBe("Thursday, 17 September");
  });
});
