import Link from "next/link";

import { signOutEverywhere } from "@/app/actions";
import { AccountMenu } from "@/components/AccountMenu";
import type { Me } from "@/lib/types";

export function TopBar({ me }: { me: Me }) {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        Central
      </Link>
      <nav aria-label="Main" className="topbar-nav">
        {me.is_admin && <Link href="/admin/users">Admin</Link>}
        <AccountMenu name={me.name} email={me.email}>
          <form action={signOutEverywhere}>
            <button type="submit" className="button button-quiet">
              Sign out
            </button>
          </form>
        </AccountMenu>
      </nav>
    </header>
  );
}
