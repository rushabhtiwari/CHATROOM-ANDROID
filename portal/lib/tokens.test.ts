import { describe, expect, it, vi } from "vitest";

import { needsRefresh, type PortalToken, refreshTokens } from "@/lib/tokens";

const token: PortalToken = {
  sub: "u1",
  accessToken: "old-access",
  refreshToken: "old-refresh",
  idToken: "id",
  expiresAt: 1_000,
};

const config = { tokenEndpoint: "http://idp/token", clientId: "portal", clientSecret: "s3cret", now: () => 2_000 };

describe("needsRefresh", () => {
  it("refreshes inside the skew window", () => {
    expect(needsRefresh(token, 939)).toBe(false);
    expect(needsRefresh(token, 940)).toBe(true);
    expect(needsRefresh(token, 1_500)).toBe(true);
  });
});

describe("refreshTokens", () => {
  it("posts the refresh token with basic auth and stores the rotated tokens", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 900 }),
    );

    const result = await refreshTokens(token, { ...config, fetch });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://idp/token");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("portal:s3cret")}`);
    expect(String(init.body)).toBe("grant_type=refresh_token&refresh_token=old-refresh");
    expect(result).toEqual({
      ...token,
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: 2_900,
      error: undefined,
    });
  });

  it("marks the token as failed when the identity service refuses", async () => {
    const fetch = vi.fn(async () => Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect((await refreshTokens(token, { ...config, fetch })).error).toBe("RefreshTokenError");
  });

  it("marks the token as failed when the identity service is unreachable", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect((await refreshTokens(token, { ...config, fetch })).error).toBe("RefreshTokenError");
  });
});
