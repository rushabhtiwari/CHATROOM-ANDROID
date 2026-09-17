import { describe, expect, it } from "vitest";

import { appTone, TONES } from "@/lib/tones";

describe("appTone", () => {
  it("gives each app a stable soft colour pair", () => {
    expect(appTone("dispatch")).toEqual(appTone("dispatch"));
    expect(TONES).toContainEqual(appTone("dispatch"));
  });

  it("spreads the catalog across several tones", () => {
    const slugs = ["sales", "dispatch", "accounts", "finance", "marketing", "purchase", "hr", "production", "quality"];
    expect(new Set(slugs.map((slug) => appTone(slug).background)).size).toBeGreaterThanOrEqual(5);
  });
});
