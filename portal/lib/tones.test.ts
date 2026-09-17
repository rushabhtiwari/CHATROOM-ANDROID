import { describe, expect, it } from "vitest";

import { appTone, TONES } from "@/lib/tones";

describe("appTone", () => {
  it("gives each app a stable gradient pair from the palette", () => {
    expect(TONES).toHaveLength(14);
    expect(appTone("dispatch")).toEqual(appTone("dispatch"));
    expect(TONES).toContainEqual(appTone("dispatch"));
    expect(appTone("dispatch")).toEqual({ from: expect.stringMatching(/^#/), to: expect.stringMatching(/^#/) });
  });

  it("spreads the catalog across many colours", () => {
    const slugs = [
      "sales",
      "dispatch",
      "accounts",
      "finance",
      "marketing",
      "purchase",
      "hr",
      "production",
      "quality",
      "requisitions",
      "projects",
      "automation",
      "chat",
    ];
    expect(new Set(slugs.map((slug) => appTone(slug).from)).size).toBeGreaterThanOrEqual(8);
  });
});
