/** Token lifecycle for the portal's Auth.js JWT session. Pure: no Next.js imports. */

export type PortalToken = {
  sub?: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number; // epoch seconds
  error?: "RefreshTokenError";
};

export type RefreshConfig = {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  now?: () => number; // epoch seconds
};

export const REFRESH_SKEW_SECONDS = 60;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function needsRefresh(token: PortalToken, now: number, skew = REFRESH_SKEW_SECONDS) {
  return token.expiresAt - skew <= now;
}

export async function refreshTokens(token: PortalToken, config: RefreshConfig): Promise<PortalToken> {
  const doFetch = config.fetch ?? fetch;
  const now = config.now ?? nowSeconds;
  try {
    const response = await doFetch(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token.refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return { ...token, error: "RefreshTokenError" };
    const body = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return {
      ...token,
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? token.refreshToken,
      expiresAt: now() + body.expires_in,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshTokenError" };
  }
}
