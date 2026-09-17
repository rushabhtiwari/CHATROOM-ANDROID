import { AdminNav } from "@/components/AdminNav";
import { TopBar } from "@/components/TopBar";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await requireAdmin();
  return (
    <>
      <TopBar me={me} />
      <div className="admin">
        <AdminNav />
        <main className="admin-main">{children}</main>
      </div>
    </>
  );
}
