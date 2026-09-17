"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/users", label: "People" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/apps", label: "Apps" },
  { href: "/admin/audit", label: "Activity log" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
