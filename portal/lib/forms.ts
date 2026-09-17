/** Parsing helpers for admin form submissions. Throws FormError with a user-facing message. */

export class FormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormError";
  }
}

export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function requiredText(form: FormData, name: string, label: string): string {
  const value = text(form, name);
  if (!value) throw new FormError(`${label} is required.`);
  return value;
}

/** One entry per non-empty line. */
export function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export type RoleInput = { key: string; label: string; rank: number };

/** Roles written one per line as `key, Label, rank`, e.g. `viewer, Viewer, 10`. */
export function parseRoles(value: string): RoleInput[] {
  const roles = lines(value).map((line, index) => {
    const [key, label, rank] = line.split(",").map((part) => part.trim());
    const parsedRank = Number(rank);
    if (!key || !label || !Number.isInteger(parsedRank)) {
      throw new FormError(`Role line ${index + 1} must look like "viewer, Viewer, 10".`);
    }
    return { key, label, rank: parsedRank };
  });
  if (roles.length === 0) throw new FormError("Add at least one role.");
  return roles;
}

export type ExceptionChoice =
  { app_id: string; effect: "deny"; app_role_id: null } | { app_id: string; effect: "grant"; app_role_id: string };

/** Values from the exception picker: `<appId>:deny` or `<appId>:grant:<roleId>`. */
export function parseExceptionChoice(value: string): ExceptionChoice {
  const [appId, effect, roleId] = value.split(":");
  if (appId && effect === "deny" && roleId === undefined) {
    return { app_id: appId, effect: "deny", app_role_id: null };
  }
  if (appId && effect === "grant" && roleId) {
    return { app_id: appId, effect: "grant", app_role_id: roleId };
  }
  throw new FormError("Choose what the exception should do.");
}

/** `YYYY-MM-DD` from a date input → end of that day in UTC, or null when empty. */
export function expiryFromDate(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FormError("Expiry must be a date.");
  return `${value}T23:59:59Z`;
}
