import { CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { initials } from "@/lib/people";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/admin";
import { identity } from "@/lib/identity";

const PAGE_SIZE = 50;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function PeoplePage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin();
  const params = await searchParams;
  const query = one(params.query);
  const department = one(params.department);
  const status = one(params.status);
  const offset = Math.max(0, Number(one(params.offset)) || 0);
  const [users, departments] = await Promise.all([
    identity.listUsers({ query, department, status, offset, limit: PAGE_SIZE }),
    identity.listDepartments(),
  ]);
  const names = Object.fromEntries(departments.map((d) => [d.slug, d.name]));
  const pageLink = (nextOffset: number) =>
    `/admin/users?${new URLSearchParams({ query, department, status, offset: String(nextOffset) })}`;
  const hasPrevious = offset > 0;
  const hasNext = users.length === PAGE_SIZE;

  return (
    <>
      <PageHeader
        title="People"
      />
      <div className="card table-card">
        <form className="table-toolbar" role="search" aria-label="Find people">
          <label className="table-filter">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input name="query" defaultValue={query} placeholder="Name or email" aria-label="Name or email" />
          </label>
          <label className="table-select">
            <select name="department" defaultValue={department} aria-label="Department">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="table-select">
            <select name="status" defaultValue={status} aria-label="Status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <button type="submit" className="button button-small">
            Search
          </button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Departments</th>
                <th scope="col">Status</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">
                  <span className="visually-hidden">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="row-link">
                  <td>
                    <div className="cell-app">
                      <span className="avatar" aria-hidden="true">
                        {initials(user.name)}
                      </span>
                      <span>
                        <Link href={`/admin/users/${user.id}`} className="row-link-target">
                          {user.name}
                        </Link>
                        <small>{user.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>{user.department_slugs.map((slug) => names[slug] ?? slug).join(", ") || "None"}</td>
                  <td>
                    <span className="badge-row">
                      {user.status === "suspended" ? (
                        <Badge tone="danger">Suspended</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                      {user.is_admin && <Badge tone="primary">Admin</Badge>}
                    </span>
                  </td>
                  <td className="muted">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleString("en-GB") : "Never"}
                  </td>
                  <td className="cell-chevron" aria-hidden="true">
                    <CaretRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="table-empty">No one matches this search.</p>}
        </div>
        {(hasPrevious || hasNext) && (
          <nav className="table-footer" aria-label="Pages">
            {hasPrevious && (
              <Link href={pageLink(Math.max(0, offset - PAGE_SIZE))} className="button button-small">
                <CaretLeft size={14} aria-hidden="true" />
                Previous page
              </Link>
            )}
            {hasNext && (
              <Link href={pageLink(offset + PAGE_SIZE)} className="button button-small">
                Next page
                <CaretRight size={14} aria-hidden="true" />
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
