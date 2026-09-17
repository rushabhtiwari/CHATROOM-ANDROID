import { describe, expect, it } from "vitest";

import { describeAccess } from "@/lib/access";
import type { EffectiveAccess } from "@/lib/types";

const base: EffectiveAccess = {
  app_id: "a",
  app_slug: "crm",
  app_name: "CRM",
  role: null,
  reason: "no_access",
  department_slug: null,
  override_id: null,
};

describe("describeAccess", () => {
  it.each([
    [{ reason: "department", role: "manager", department_slug: "sales" }, "From the Sales department"],
    [{ reason: "override_grant", role: "viewer" }, "Granted by an exception"],
    [{ reason: "override_deny" }, "Blocked by an exception"],
    [{ reason: "suspended" }, "Account suspended"],
    [{ reason: "app_disabled" }, "App is disabled"],
    [{ reason: "no_access" }, "No department gives access"],
  ] as const)("%o → %s", (patch, expected) => {
    expect(describeAccess({ ...base, ...patch } as EffectiveAccess, { sales: "Sales" })).toBe(expected);
  });

  it("falls back to the slug when the department name is unknown", () => {
    expect(describeAccess({ ...base, reason: "department", department_slug: "ops" })).toBe("From the ops department");
  });
});
