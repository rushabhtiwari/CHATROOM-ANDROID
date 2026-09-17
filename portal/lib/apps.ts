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
