import Link from "next/link";

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

  return (
    <>
      <h1>People</h1>
      <p className="hint">Everyone who has signed in. New people have no access until you add them to a department.</p>

      <form className="form-row" role="search" style={{ marginTop: "1.5rem" }}>
        <label>
          Name or email
          <input name="query" defaultValue={query} />
        </label>
        <label>
          Department
          <select name="department" defaultValue={department}>
            <option value="">Any</option>
            {departments.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <button type="submit" className="button button-quiet">
          Search
        </button>
      </form>

      <section className="table-wrap">
        {users.length === 0 ? (
          <p>No one matches this search.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Departments</th>
                <th>Status</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link href={`/admin/users/${user.id}`}>{user.name}</Link>
                    <div className="hint">
                      {user.email}
                      {user.is_admin && ", admin"}
                    </div>
                  </td>
                  <td>{user.department_slugs.map((slug) => names[slug] ?? slug).join(", ") || "None"}</td>
                  <td className={`status status-${user.status}`}>
                    {user.status === "active" ? "Active" : "Suspended"}
                  </td>
                  <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString("en-GB") : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <nav className="pager" aria-label="Pages">
        {offset > 0 && <Link href={pageLink(Math.max(0, offset - PAGE_SIZE))}>Previous page</Link>}
        {users.length === PAGE_SIZE && <Link href={pageLink(offset + PAGE_SIZE)}>Next page</Link>}
      </nav>
    </>
  );
}
