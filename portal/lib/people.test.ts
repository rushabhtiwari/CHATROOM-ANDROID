import { describe, expect, it } from "vitest";

import { initials } from "@/lib/people";

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("ada lovelace byron")).toBe("AL");
    expect(initials("  Sam ")).toBe("S");
    expect(initials("")).toBe("?");
  });
});
