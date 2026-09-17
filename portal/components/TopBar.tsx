import { SignOut, SquaresFour } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Suspense } from "react";

import { signOutEverywhere } from "@/app/actions";
import { AccountMenu } from "@/components/AccountMenu";
import { GlobalSearch } from "@/components/GlobalSearch";
import { TopTabs } from "@/components/TopTabs";
import type { Me } from "@/lib/types";

export function roleLine(me: Me): string {
  if (me.is_admin) return "Administrator";
  return me.departments.map((d) => d.name).join(", ") || "No department yet";
}

export function TopBar({ me }: { me: Me }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden="true">
          <SquaresFour size={18} weight="duotone" />
        </span>
        Central
      </Link>
      <span className="topbar-divider" aria-hidden="true" />
      <TopTabs isAdmin={me.is_admin} />
      <Suspense fallback={<div className="global-search" />}>
        <GlobalSearch />
      </Suspense>
      <AccountMenu name={me.name} email={me.email} roleLine={roleLine(me)}>
        <form action={signOutEverywhere}>
          <button type="submit" className="button button-secondary button-block">
            <SignOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </AccountMenu>
    </header>
  );
}
