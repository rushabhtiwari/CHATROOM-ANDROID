import type { EffectiveAccess } from "@/lib/types";

/** Plain-language explanation of why a user has (or lacks) access to an app. */
export function describeAccess(entry: EffectiveAccess, departmentNames: Record<string, string> = {}) {
  switch (entry.reason) {
    case "department": {
      const slug = entry.department_slug ?? "";
      return `From the ${departmentNames[slug] ?? slug} department`;
    }
    case "override_grant":
      return "Granted by an exception";
    case "override_deny":
      return "Blocked by an exception";
    case "suspended":
      return "Account suspended";
    case "app_disabled":
      return "App is disabled";
    case "system_app":
      return "Available to everyone";
    case "no_access":
      return "No department gives access";
  }
}
