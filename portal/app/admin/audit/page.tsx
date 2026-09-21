import { CaretRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AppMark } from "@/components/AppMark";
import { PageHeader } from "@/components/ui/PageHeader";
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
  const appById = Object.fromEntries(apps.map((a) => [a.id, a]));
  const who = (id: string | null) => (id ? (person[id] ?? id.slice(0, 8)) : "");
  const older = entries.length === PAGE_SIZE ? entries[entries.length - 1].id : null;

  return (
    <>
      <PageHeader
        title="Activity log"
      />
      <div className="card table-card">
        <form className="table-toolbar" role="search" aria-label="Filter activity">
          <label className="field field-inline">
            Event
            <input name="event" defaultValue={event} placeholder="access_denied" />
          </label>
          <label className="field field-inline">
            From
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label className="field field-inline">
            Before
            <input type="date" name="to" defaultValue={to} />
          </label>
          <button type="submit" className="button button-small">
            Filter
          </button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Event</th>
                <th scope="col">By</th>
                <th scope="col">Person</th>
                <th scope="col">App</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const app = entry.app_id ? appById[entry.app_id] : undefined;
                return (
                  <tr key={entry.id}>
                    <td className="muted nowrap">{new Date(entry.at).toLocaleString("en-GB")}</td>
                    <td>
                      <code className="event-chip">{entry.event}</code>
                    </td>
                    <td>{who(entry.actor_user_id)}</td>
                    <td>{who(entry.subject_user_id)}</td>
                    <td>
                      {app && (
                        <div className="cell-app">
                          <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} size="sm" />
                          <span>{app.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="muted details-cell">{summarise(entry.detail)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {entries.length === 0 && <p className="table-empty">No activity matches these filters.</p>}
        </div>
        {older && (
          <nav className="table-footer" aria-label="Pages">
            <Link
              href={`/admin/audit?${new URLSearchParams({ event, from, to, before_id: String(older) })}`}
              className="button button-small"
            >
              Older activity
              <CaretRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        )}
      </div>
    </>
  );
}
