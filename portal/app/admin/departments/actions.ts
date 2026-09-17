"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, runAction } from "@/lib/actions";
import { requiredText, text } from "@/lib/forms";
import { identity } from "@/lib/identity";

export async function createDepartment(_: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const name = requiredText(form, "name", "Name");
    await identity.createDepartment({ slug: requiredText(form, "slug", "Short name"), name });
    revalidatePath("/admin/departments");
    return { status: "ok", message: `${name} created.` };
  });
}

export async function renameDepartment(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await identity.renameDepartment(id, requiredText(form, "name", "Name"));
    revalidatePath("/admin/departments");
    return { status: "ok", message: "Renamed." };
  });
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await identity.deleteDepartment(id);
    revalidatePath("/admin/departments");
    return { status: "ok", message: "Department deleted." };
  });
}

/** Form fields are named `app:<appId>` with a role id value, or empty for no access. */
export async function saveDepartmentAccess(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const grants = [...form.keys()]
      .filter((key) => key.startsWith("app:"))
      .map((key) => ({ app_id: key.slice(4), app_role_id: text(form, key) }))
      .filter((grant) => grant.app_role_id);
    await identity.setDepartmentAccess(id, grants);
    revalidatePath("/admin/departments");
    revalidatePath("/admin/users", "layout");
    return { status: "ok", message: "Access saved. People get the change within 15 minutes." };
  });
}
