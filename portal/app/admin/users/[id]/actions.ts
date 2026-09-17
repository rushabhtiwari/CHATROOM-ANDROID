"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, runAction } from "@/lib/actions";
import { expiryFromDate, parseExceptionChoice, requiredText, text } from "@/lib/forms";
import { identity } from "@/lib/identity";

function refresh(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function saveDepartments(userId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ids = form.getAll("department_id").filter((v): v is string => typeof v === "string");
    await identity.setUserDepartments(userId, ids);
    refresh(userId);
    return { status: "ok", message: "Departments saved." };
  });
}

export async function addException(userId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const choice = parseExceptionChoice(text(form, "choice"));
    await identity.createOverride(userId, {
      ...choice,
      reason: requiredText(form, "reason", "Reason"),
      expires_at: expiryFromDate(text(form, "expires_on")),
    });
    refresh(userId);
    return { status: "ok", message: "Exception added." };
  });
}

export async function removeException(userId: string, overrideId: string): Promise<ActionResult> {
  return runAction(async () => {
    await identity.deleteOverride(overrideId);
    refresh(userId);
    return { status: "ok", message: "Exception removed." };
  });
}

export async function setSuspended(userId: string, suspended: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await identity.updateUser(userId, { status: suspended ? "suspended" : "active" });
    refresh(userId);
    return {
      status: "ok",
      message: suspended ? "Account suspended and signed out everywhere." : "Account reactivated.",
    };
  });
}

export async function setAdmin(userId: string, isAdmin: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await identity.updateUser(userId, { is_admin: isAdmin });
    refresh(userId);
    return { status: "ok", message: isAdmin ? "Admin rights granted." : "Admin rights removed." };
  });
}

export async function signOutEverywhere(userId: string): Promise<ActionResult> {
  return runAction(async () => {
    await identity.signOutUser(userId);
    return { status: "ok", message: "Signed out of every app. Apps notice within 15 minutes." };
  });
}
