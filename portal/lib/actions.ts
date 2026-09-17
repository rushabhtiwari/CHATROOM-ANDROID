import { ApiError } from "@/lib/api/client";
import { FormError } from "@/lib/forms";

export type ActionResult =
  | { status: "idle" }
  | { status: "ok"; message: string; secret?: { clientId: string; clientSecret: string } }
  | { status: "error"; message: string };

export const idle: ActionResult = { status: "idle" };

/**
 * Runs a server action body, turning expected failures into a message for the form.
 * Anything else (including Next.js redirects) is rethrown.
 */
export async function runAction(body: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ApiError || error instanceof FormError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
