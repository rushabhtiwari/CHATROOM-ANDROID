import { describe, expect, it } from "vitest";

import { accessSummary } from "@/lib/apps";

const dept = (name: string) => ({ slug: name.toLowerCase(), name });

describe("accessSummary", () => {
  it("describes which departments have access", () => {
    expect(accessSummary([], 9)).toBe("None");
    expect(accessSummary([dept("Sales"), dept("Finance")], 9)).toBe("Sales, Finance");
    expect(
      accessSummary(
        Array.from({ length: 9 }, (_, i) => dept(`D${i}`)),
        9,
      ),
    ).toBe("All 9 departments");
  });
});
