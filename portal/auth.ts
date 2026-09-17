import NextAuth from "next-auth";

import { env, PORTAL_CLIENT_ID } from "@/lib/env";
import { needsRefresh, nowSeconds, type PortalToken, refreshTokens } from "@/lib/tokens";

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: [
    {
      id: "identity",
      name: "Company account",
      type: "oidc",
      issuer: env.issuer,
      clientId: PORTAL_CLIENT_ID,
      clientSecret: env.clientSecret,
      checks: ["pkce", "state", "nonce"],
      authorization: { params: { scope: "openid email profile" } },
    },
  ],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          expiresAt: account.expires_at,
        };
      }
      const current = token as unknown as PortalToken;
      if (current.error || !needsRefresh(current, nowSeconds())) return token;
      const refreshed = await refreshTokens(current, {
        tokenEndpoint: `${env.issuer}/token`,
        clientId: PORTAL_CLIENT_ID,
        clientSecret: env.clientSecret,
      });
      return { ...token, ...refreshed };
    },
    session({ session, token }) {
      return { ...session, error: (token as unknown as PortalToken).error };
    },
    authorized({ auth: session }) {
      return Boolean(session?.user) && !(session as { error?: string }).error;
    },
  },
}));
