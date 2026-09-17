"use client";

import { Buildings, ClockCounterClockwise, SquaresFour, Users } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", label: "People", Icon: Users },
  { href: "/admin/departments", label: "Departments", Icon: Buildings },
  { href: "/admin/apps", label: "Apps", Icon: SquaresFour },
  { href: "/admin/audit", label: "Activity log", Icon: ClockCounterClockwise },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {TABS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
        >
          <Icon size={17} weight="duotone" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
