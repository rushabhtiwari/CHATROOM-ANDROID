import Link from "next/link";

import { signOutEverywhere } from "@/app/actions";
import type { Me } from "@/lib/types";

export function TopBar({ me }: { me: Me }) {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        Central
      </Link>
      <nav aria-label="Main">
        <Link href="/">Apps</Link>
        {me.is_admin && <Link href="/admin/users">Admin</Link>}
      </nav>
      <div className="account">
        <span title={me.email}>{me.name}</span>
        <form action={signOutEverywhere}>
          <button type="submit" className="button button-quiet">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
