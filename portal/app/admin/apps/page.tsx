import { Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AppsTable } from "@/components/admin/AppsTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/admin";
import { identity } from "@/lib/identity";

export default async function AppsPage() {
  await requireAdmin();
  const [apps, departments] = await Promise.all([identity.listApps(), identity.listDepartments()]);
  return (
    <>
      <PageHeader
        title="Apps"
        actions={
          <Link href="/admin/apps/new" className="button button-primary">
            <Plus size={16} weight="bold" aria-hidden="true" />
            Register app
          </Link>
        }
      />
      <AppsTable apps={apps} departmentCount={departments.length} />
    </>
  );
}
