import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { identity } from "@/lib/identity";

const PAGE_SIZE = 50;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function summarise(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ");
}

export default async function ActivityPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const params = await searchParams;
  const event = one(params.event);
  const from = one(params.from);
  const to = one(params.to);
  const beforeId = one(params.before_id);
  const [entries, users, apps] = await Promise.all([
    identity.listAudit({ event, from, to, before_id: beforeId, limit: PAGE_SIZE }),
    identity.listUsers({ limit: 200 }),
    identity.listApps(),
  ]);
  const person = Object.fromEntries(users.map((u) => [u.id, u.email]));
  const appName = Object.fromEntries(apps.map((a) => [a.id, a.name]));
  const who = (id: string | null) => (id ? (person[id] ?? id.slice(0, 8)) : "");
  const older = entries.length === PAGE_SIZE ? entries[entries.length - 1].id : null;

  return (
    <>
      <h1>Activity log</h1>
      <p className="hint">Sign-ins, refusals and every change made by admins, newest first.</p>

      <form className="form-row" role="search" style={{ marginTop: "1.5rem" }}>
        <label>
          Event
          <input name="event" defaultValue={event} placeholder="access_denied" />
        </label>
        <label>
          From
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          Before
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit" className="button button-quiet">
          Filter
        </button>
      </form>

      <section className="table-wrap">
        {entries.length === 0 ? (
          <p>No activity matches these filters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>By</th>
                <th>Person</th>
                <th>App</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.at).toLocaleString("en-GB")}</td>
                  <td>
                    <code>{entry.event}</code>
                  </td>
                  <td>{who(entry.actor_user_id)}</td>
                  <td>{who(entry.subject_user_id)}</td>
                  <td>{entry.app_id ? (appName[entry.app_id] ?? "") : ""}</td>
                  <td className="hint">{summarise(entry.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {older && (
        <nav className="pager" aria-label="Pages">
          <Link href={`/admin/audit?${new URLSearchParams({ event, from, to, before_id: String(older) })}`}>
            Older activity
          </Link>
        </nav>
      )}
    </>
  );
}
