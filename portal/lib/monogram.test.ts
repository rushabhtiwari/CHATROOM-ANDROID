import { describe, expect, it } from "vitest";

import { monogram, tileColor } from "@/lib/monogram";

describe("monogram", () => {
  it("uses initials of the first two words, or the first two letters", () => {
    expect(monogram("Example App")).toBe("EA");
    expect(monogram("invoicing")).toBe("IN");
    expect(monogram("  ")).toBe("?");
  });

  it("picks a stable colour per key", () => {
    expect(tileColor("crm")).toBe(tileColor("crm"));
    expect(tileColor("crm")).toMatch(/^#[0-9A-F]{6}$/);
  });
});
