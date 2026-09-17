import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, errorMessage } from "@/lib/api/client";

function client(response: Response) {
  const fetch = vi.fn(async () => response);
  const onUnauthorized = vi.fn(() => {
    throw new Error("redirected to sign-in");
  });
  const api = createApiClient({
    baseUrl: "http://idp",
    getAccessToken: async () => "tok",
    onUnauthorized: onUnauthorized as unknown as () => never,
    fetch,
  });
  return { api, fetch, onUnauthorized };
}

describe("createApiClient", () => {
  it("sends the bearer token, JSON body and query string", async () => {
    const { api, fetch } = client(Response.json({ ok: true }));

    await api.patch("/admin/users/1", { status: "suspended" });
    await api.get("/admin/users", { query: "sam", department: "", limit: 50 });

    const [patchUrl, patchInit] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(patchUrl)).toBe("http://idp/admin/users/1");
    expect(patchInit.method).toBe("PATCH");
    expect(patchInit.headers).toEqual({ Authorization: "Bearer tok", "Content-Type": "application/json" });
    expect(patchInit.body).toBe('{"status":"suspended"}');
    expect(String(fetch.mock.calls[1][0 as never])).toBe("http://idp/admin/users?query=sam&limit=50");
  });

  it("returns undefined for 204 responses", async () => {
    const { api } = client(new Response(null, { status: 204 }));
    await expect(api.delete("/admin/overrides/1")).resolves.toBeUndefined();
  });

  it("sends people back to sign in on 401", async () => {
    const { api, onUnauthorized } = client(Response.json({ detail: "Invalid token" }, { status: 401 }));
    await expect(api.get("/me")).rejects.toThrow("redirected to sign-in");
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("throws ApiError with the service's message", async () => {
    const { api } = client(Response.json({ detail: "Department still has members; move them first" }, { status: 409 }));
    const error = await api.delete("/admin/departments/1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "Department still has members; move them first" });
  });
});

describe("errorMessage", () => {
  it("joins FastAPI validation errors by field", () => {
    const body = {
      detail: [
        { loc: ["body", "slug"], msg: "String should match pattern" },
        { loc: ["body"], msg: "Value error, role ranks must be unique" },
      ],
    };
    expect(errorMessage(422, body)).toBe("slug: String should match pattern; role ranks must be unique");
  });

  it("falls back to a generic message", () => {
    expect(errorMessage(500, null)).toBe("The identity service returned an error (500).");
  });
});
