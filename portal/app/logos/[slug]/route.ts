import { identity } from "@/lib/identity";

/** Passes an app's logo through from the identity service using the signed-in person's token. */
export async function GET(_request: Request, { params }: RouteContext<"/logos/[slug]">) {
  const { slug } = await params;
  const upstream = await identity.logo(slug);
  if (!upstream.ok) return new Response(null, { status: 404 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
