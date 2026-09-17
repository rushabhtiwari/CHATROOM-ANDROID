import { describe, expect, it } from "vitest";

import { expiryFromDate, FormError, lines, parseExceptionChoice, parseRoles, requiredText } from "@/lib/forms";

describe("form parsing", () => {
  it("reads required text", () => {
    const form = new FormData();
    form.set("name", "  Sales ");
    expect(requiredText(form, "name", "Name")).toBe("Sales");
    expect(() => requiredText(form, "slug", "Slug")).toThrow(new FormError("Slug is required."));
  });

  it("splits lines", () => {
    expect(lines("https://a/cb\r\n\n  https://b/cb  ")).toEqual(["https://a/cb", "https://b/cb"]);
  });

  it("parses roles", () => {
    expect(parseRoles("viewer, Viewer, 10\nmanager,Manager,30")).toEqual([
      { key: "viewer", label: "Viewer", rank: 10 },
      { key: "manager", label: "Manager", rank: 30 },
    ]);
    expect(() => parseRoles("viewer, Viewer")).toThrow('Role line 1 must look like "viewer, Viewer, 10".');
    expect(() => parseRoles("  ")).toThrow("Add at least one role.");
  });

  it("parses exception choices", () => {
    expect(parseExceptionChoice("app1:deny")).toEqual({ app_id: "app1", effect: "deny", app_role_id: null });
    expect(parseExceptionChoice("app1:grant:role9")).toEqual({ app_id: "app1", effect: "grant", app_role_id: "role9" });
    expect(() => parseExceptionChoice("")).toThrow("Choose what the exception should do.");
  });

  it("turns a date into an end-of-day expiry", () => {
    expect(expiryFromDate("")).toBeNull();
    expect(expiryFromDate("2026-11-30")).toBe("2026-11-30T23:59:59Z");
    expect(() => expiryFromDate("30/11/2026")).toThrow("Expiry must be a date.");
  });
});
