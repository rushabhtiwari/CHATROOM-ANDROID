import type { AppCategory, AppStatus } from "@/lib/types";

export const STATUS_LABELS: Record<AppStatus, string> = {
  active: "Live",
  coming_soon: "Coming soon",
  disabled: "Disabled",
};

export const CATEGORY_LABELS: Record<AppCategory, string> = {
  department: "Departments",
  company: "Company tools",
};

/** "All 9 departments", a comma-separated list, or "None". */
export function accessSummary(departments: { name: string }[], departmentCount: number): string {
  if (departments.length === 0) return "None";
  if (departmentCount > 0 && departments.length >= departmentCount) return `All ${departmentCount} departments`;
  return departments.map((department) => department.name).join(", ");
}
