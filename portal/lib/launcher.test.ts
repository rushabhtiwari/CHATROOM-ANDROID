import { describe, expect, it } from "vitest";

import { firstLiveMatch, greetingFor, groupApps } from "@/lib/launcher";
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

describe("groupApps", () => {
  it("puts departments first, company tools second, sorted by name", () => {
    expect(groupApps(APPS, "").map((g) => [g.label, g.apps.map((a) => a.slug)])).toEqual([
      ["Departments", ["accounts", "sales"]],
      ["Company tools", ["chat", "projects"]],
    ]);
  });

  it("filters by name or description, ignoring case, and drops empty groups", () => {
    expect(groupApps(APPS, "MESSAGES").map((g) => [g.label, g.apps.map((a) => a.slug)])).toEqual([
      ["Company tools", ["chat"]],
    ]);
    expect(groupApps(APPS, "  sal ").flatMap((g) => g.apps.map((a) => a.slug))).toEqual(["sales"]);
    expect(groupApps(APPS, "nothing like this")).toEqual([]);
  });
});

describe("firstLiveMatch", () => {
  it("skips coming-soon apps", () => {
    expect(firstLiveMatch(groupApps(APPS, "s"))?.slug).toBe("accounts");
    expect(firstLiveMatch(groupApps(APPS, "sales"))).toBeUndefined();
  });
});

describe("greetingFor", () => {
  it.each([
    [0, "Good evening"],
    [5, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good evening"],
    [null, "Welcome"],
  ])("hour %s → %s", (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});
