"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, runAction } from "@/lib/actions";
import { FormError, lines, parseCategory, parseRoles, parseStatus, requiredText, text } from "@/lib/forms";
import { identity } from "@/lib/identity";

const MAX_LOGO_BYTES = 256 * 1024;

function refreshApp(id: string) {
  revalidatePath(`/admin/apps/${id}`);
  revalidatePath("/admin/apps");
  revalidatePath("/");
}

export async function registerApp(_: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const created = await identity.createApp({
      slug: requiredText(form, "slug", "Short name"),
      name: requiredText(form, "name", "Name"),
      description: text(form, "description"),
      category: parseCategory(text(form, "category")),
      icon: text(form, "icon"),
      status: parseStatus(text(form, "status")),
      launch_url: text(form, "launch_url"),
      redirect_uris: lines(text(form, "redirect_uris")),
      post_logout_redirect_uris: lines(text(form, "post_logout_redirect_uris")),
      roles: parseRoles(text(form, "roles")),
    });
    revalidatePath("/admin/apps");
    return {
      status: "ok",
      message: `${created.name} registered. Give these credentials to the app's developers.`,
      secret: { clientId: created.client_id, clientSecret: created.client_secret },
      link: { href: `/admin/apps/${created.id}`, label: `Open ${created.name}` },
    };
  });
}

export async function updateAppSettings(
  id: string,
  isSystem: boolean,
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const common = { name: requiredText(form, "name", "Name"), description: text(form, "description") };
    await identity.updateApp(
      id,
      isSystem
        ? common
        : {
            ...common,
            category: parseCategory(text(form, "category")),
            icon: text(form, "icon"),
            status: parseStatus(text(form, "status")),
          },
    );
    refreshApp(id);
    return { status: "ok", message: "Changes saved." };
  });
}

export async function updateAppConnection(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await identity.updateApp(id, {
      launch_url: text(form, "launch_url"),
      redirect_uris: lines(text(form, "redirect_uris")),
      post_logout_redirect_uris: lines(text(form, "post_logout_redirect_uris")),
    });
    refreshApp(id);
    return { status: "ok", message: "Connection saved." };
  });
}

export async function uploadLogo(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const file = form.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new FormError("Choose an image to upload.");
    if (file.size > MAX_LOGO_BYTES) throw new FormError("Logo must be a PNG, JPEG or WebP image up to 256 KB");
    await identity.uploadLogo(id, file);
    refreshApp(id);
    return { status: "ok", message: "Logo saved." };
  });
}

export async function removeLogo(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await identity.removeLogo(id);
    refreshApp(id);
    return { status: "ok", message: "Logo removed." };
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
