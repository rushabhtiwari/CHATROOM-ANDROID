"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const inAdmin = pathname.startsWith("/admin");
  return (
    <nav className="top-tabs" aria-label="Main">
      <Link href="/" aria-current={inAdmin ? undefined : "page"}>
        Home
      </Link>
      {isAdmin && (
        <Link href="/admin/users" aria-current={inAdmin ? "page" : undefined}>
          Admin
        </Link>
      )}
    </nav>
  );
}
