"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, runAction } from "@/lib/actions";
import { lines, parseRoles, requiredText, text } from "@/lib/forms";
import { identity } from "@/lib/identity";

export async function registerApp(_: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const created = await identity.createApp({
      slug: requiredText(form, "slug", "Short name"),
      name: requiredText(form, "name", "Name"),
      description: text(form, "description"),
      launch_url: requiredText(form, "launch_url", "App address"),
      redirect_uris: lines(text(form, "redirect_uris")),
      post_logout_redirect_uris: lines(text(form, "post_logout_redirect_uris")),
      roles: parseRoles(text(form, "roles")),
    });
    revalidatePath("/admin/apps");
    return {
      status: "ok",
      message: `${created.name} registered. Give these credentials to the app's developers.`,
      secret: { clientId: created.client_id, clientSecret: created.client_secret },
    };
  });
}

export async function updateApp(id: string, isSystem: boolean, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const common = { name: requiredText(form, "name", "Name"), description: text(form, "description") };
    await identity.updateApp(
      id,
      isSystem
        ? common
        : {
            ...common,
            launch_url: requiredText(form, "launch_url", "App address"),
            redirect_uris: lines(text(form, "redirect_uris")),
            post_logout_redirect_uris: lines(text(form, "post_logout_redirect_uris")),
            status: text(form, "status") === "disabled" ? "disabled" : "active",
          },
    );
    revalidatePath(`/admin/apps/${id}`);
    revalidatePath("/admin/apps");
    return { status: "ok", message: "Changes saved." };
  });
}

export async function rotateSecret(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const secret = await identity.rotateSecret(id);
    return {
      status: "ok",
      message: "New secret created. The old one stops working now.",
      secret: { clientId: secret.client_id, clientSecret: secret.client_secret },
    };
  });
}

export async function addRole(appId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const [role] = parseRoles(`${text(form, "key")}, ${text(form, "label")}, ${text(form, "rank")}`);
    await identity.createRole(appId, role);
    revalidatePath(`/admin/apps/${appId}`);
    return { status: "ok", message: `Role ${role.label} added.` };
  });
}

export async function deleteRole(appId: string, roleId: string): Promise<ActionResult> {
  return runAction(async () => {
    await identity.deleteRole(roleId);
    revalidatePath(`/admin/apps/${appId}`);
    return { status: "ok", message: "Role deleted." };
  });
}
