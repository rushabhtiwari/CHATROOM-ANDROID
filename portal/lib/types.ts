/** Shapes returned by the identity service (identity/app/admin/schemas.py, identity/app/routes/me.py). */

export type Department = { id: string; slug: string; name: string };

export type Me = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
  departments: Department[];
};

export type AppStatus = "active" | "coming_soon" | "disabled";
export type AppCategory = "department" | "company";

export type MyApp = {
  slug: string;
  name: string;
  description: string;
  category: AppCategory;
  status: Exclude<AppStatus, "disabled">;
  icon: string;
  logo_version: number | null;
  launch_url: string;
  role: string;
};

export type Role = { id: string; key: string; label: string; rank: number };

export type AppSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  launch_url: string;
  client_id: string;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  status: AppStatus;
  is_system: boolean;
  category: AppCategory;
  logo_version: number | null;
  roles: Role[];
};

export type AppDetail = AppSummary & {
  departments: {
    department_id: string;
    department_slug: string;
    department_name: string;
    app_role_id: string;
    role_key: string;
  }[];
};

export type ClientSecret = { client_id: string; client_secret: string };

export type AccessReason =
  "suspended" | "app_disabled" | "system_app" | "override_deny" | "override_grant" | "department" | "no_access";

export type EffectiveAccess = {
  app_id: string;
  app_slug: string;
  app_name: string;
  role: string | null;
  reason: AccessReason;
  department_slug: string | null;
  override_id: string | null;
};

export type Override = {
  id: string;
  app_id: string;
  effect: "grant" | "deny";
  app_role_id: string | null;
  reason: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  active: boolean;
};

export type UserSummary = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: "active" | "suspended";
  is_admin: boolean;
  last_login_at: string | null;
  department_slugs: string[];
};

export type UserDetail = UserSummary & {
  departments: Department[];
  overrides: Override[];
  access: EffectiveAccess[];
};

export type DepartmentWithAccess = Department & {
  member_count: number;
  access: { app_id: string; app_slug: string; app_role_id: string; role_key: string }[];
};

export type AuditEntry = {
  id: number;
  at: string;
  event: string;
  actor_user_id: string | null;
  subject_user_id: string | null;
  app_id: string | null;
  detail: Record<string, unknown>;
  request_id: string | null;
  ip: string | null;
};
