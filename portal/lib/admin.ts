import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { identity } from "@/lib/identity";

/**
 * The signed-in admin, or a 404 for everyone else. Layouts and pages render in parallel,
 * so every admin page awaits this before loading data. Cached per request.
 */
export const requireAdmin = cache(async () => {
  const me = await identity.me();
  if (!me.is_admin) notFound();
  return me;
});
