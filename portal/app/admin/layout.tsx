import { AdminTabs } from "@/components/AdminTabs";
import { TopBar } from "@/components/TopBar";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await requireAdmin();
  return (
    <>
      <TopBar me={me} />
      <AdminTabs />
      <main className="page admin-page">{children}</main>
    </>
  );
}
