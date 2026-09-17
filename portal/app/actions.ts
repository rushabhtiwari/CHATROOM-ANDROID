"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { env } from "@/lib/env";
import { getIdToken } from "@/lib/session";

/** Ends the portal session, then the identity session (and with it every app's refresh tokens). */
export async function signOutEverywhere() {
  const idToken = await getIdToken();
  await signOut({ redirect: false });
  const logout = new URL("/logout", env.issuer);
  if (idToken) logout.searchParams.set("id_token_hint", idToken);
  logout.searchParams.set("post_logout_redirect_uri", env.portalUrl);
  redirect(logout.toString());
}
