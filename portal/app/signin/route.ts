import type { NextRequest } from "next/server";

import { signIn } from "@/auth";

export async function GET(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") ?? "/";
  const target = new URL(callbackUrl, request.nextUrl.origin);
  const redirectTo = target.origin === request.nextUrl.origin ? target.pathname + target.search : "/";
  await signIn("identity", { redirectTo });
}
