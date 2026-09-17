import "server-only";

import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { env, PORTAL_CLIENT_ID } from "@/lib/env";
import { nowSeconds, type PortalToken, refreshTokens } from "@/lib/tokens";

async function readToken(): Promise<PortalToken | null> {
  const secureCookie = env.portalUrl.startsWith("https://");
  const token = await getToken({
    req: { headers: await headers() },
    secret: process.env.AUTH_SECRET,
    secureCookie,
    salt: secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token",
  });
  return token as unknown as PortalToken | null;
}

/** Access token for calling the identity API; the proxy keeps the cookie fresh. */
export async function getAccessToken(): Promise<string> {
  let token = await readToken();
  if (!token || token.error) redirect("/signin");
  if (token.expiresAt <= nowSeconds() + 5) {
    token = await refreshTokens(token, {
      tokenEndpoint: `${env.issuer}/token`,
      clientId: PORTAL_CLIENT_ID,
      clientSecret: env.clientSecret,
    });
    if (token.error) redirect("/signin");
  }
  return token.accessToken;
}

export async function getIdToken(): Promise<string | undefined> {
  return (await readToken())?.idToken;
}
