import "server-only";

import { redirect } from "next/navigation";

import { createApiClient } from "@/lib/api/client";
import { env } from "@/lib/env";
import type { RoleInput } from "@/lib/forms";
import { getAccessToken } from "@/lib/session";
import type {
  AppDetail,
  AppSummary,
  AuditEntry,
  ClientSecret,
  DepartmentWithAccess,
  Me,
  MyApp,
  Override,
  Role,
  UserDetail,
  UserSummary,
} from "@/lib/types";

const api = () =>
  createApiClient({
    baseUrl: env.identityApiUrl,
    getAccessToken,
    onUnauthorized: () => redirect("/signin"),
  });

export const identity = {
  me: () => api().get<Me>("/me"),
  myApps: () => api().get<MyApp[]>("/me/apps"),

  listUsers: (query: { query?: string; department?: string; status?: string; offset?: number; limit?: number }) =>
    api().get<UserSummary[]>("/admin/users", query),
  getUser: (id: string) => api().get<UserDetail>(`/admin/users/${id}`),
  updateUser: (id: string, body: { status?: "active" | "suspended"; is_admin?: boolean }) =>
    api().patch<UserDetail>(`/admin/users/${id}`, body),
  setUserDepartments: (id: string, departmentIds: string[]) =>
    api().put<UserDetail>(`/admin/users/${id}/departments`, { department_ids: departmentIds }),
  signOutUser: (id: string) => api().post<void>(`/admin/users/${id}/signout`),
  createOverride: (
    userId: string,
    body: {
      app_id: string;
      effect: "grant" | "deny";
      app_role_id: string | null;
      reason: string;
      expires_at: string | null;
    },
  ) => api().post<Override>(`/admin/users/${userId}/overrides`, body),
  deleteOverride: (id: string) => api().delete(`/admin/overrides/${id}`),

  listDepartments: () => api().get<DepartmentWithAccess[]>("/admin/departments"),
  createDepartment: (body: { slug: string; name: string }) =>
    api().post<DepartmentWithAccess>("/admin/departments", body),
  renameDepartment: (id: string, name: string) =>
    api().patch<DepartmentWithAccess>(`/admin/departments/${id}`, { name }),
  deleteDepartment: (id: string) => api().delete(`/admin/departments/${id}`),
  setDepartmentAccess: (id: string, grants: { app_id: string; app_role_id: string }[]) =>
    api().put<DepartmentWithAccess>(`/admin/departments/${id}/access`, grants),

  listApps: () => api().get<AppSummary[]>("/admin/apps"),
  getApp: (id: string) => api().get<AppDetail>(`/admin/apps/${id}`),
  createApp: (body: {
    slug: string;
    name: string;
    description: string;
    launch_url: string;
    redirect_uris: string[];
    post_logout_redirect_uris: string[];
    roles: RoleInput[];
  }) => api().post<AppSummary & ClientSecret>("/admin/apps", body),
  updateApp: (
    id: string,
    body: Partial<
      Pick<AppSummary, "name" | "description" | "launch_url" | "redirect_uris" | "post_logout_redirect_uris" | "status">
    >,
  ) => api().patch<AppSummary>(`/admin/apps/${id}`, body),
  rotateSecret: (id: string) => api().post<ClientSecret>(`/admin/apps/${id}/rotate-secret`),
  createRole: (appId: string, body: RoleInput) => api().post<Role>(`/admin/apps/${appId}/roles`, body),
  deleteRole: (id: string) => api().delete(`/admin/app-roles/${id}`),

  listAudit: (query: { event?: string; from?: string; to?: string; before_id?: string; limit?: number }) =>
    api().get<AuditEntry[]>("/admin/audit", query),
};
