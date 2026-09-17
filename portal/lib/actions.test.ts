import { describe, expect, it } from "vitest";

import { runAction } from "@/lib/actions";
import { ApiError } from "@/lib/api/client";
import { FormError } from "@/lib/forms";

describe("runAction", () => {
  it("passes results through", async () => {
    await expect(runAction(async () => ({ status: "ok", message: "Saved" }))).resolves.toEqual({
      status: "ok",
      message: "Saved",
    });
  });

  it("turns API and form errors into messages", async () => {
    await expect(runAction(async () => Promise.reject(new ApiError(409, "Already exists")))).resolves.toEqual({
      status: "error",
      message: "Already exists",
    });
    await expect(runAction(async () => Promise.reject(new FormError("Name is required.")))).resolves.toEqual({
      status: "error",
      message: "Name is required.",
    });
  });

  it("rethrows anything else, such as redirects", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/signin" });
    await expect(runAction(async () => Promise.reject(redirect))).rejects.toBe(redirect);
  });
});
