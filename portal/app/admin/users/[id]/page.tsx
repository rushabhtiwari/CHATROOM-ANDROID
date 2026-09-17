import { ActionForm, ActionMessage, SubmitButton } from "@/components/ActionForm";
import { initials } from "@/lib/people";
import { AppMark } from "@/components/AppMark";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { describeAccess } from "@/lib/access";
import { requireAdmin } from "@/lib/admin";
import { roleLabel } from "@/lib/home";
import { identity } from "@/lib/identity";

import { addException, removeException, saveDepartments, setAdmin, setSuspended, signOutEverywhere } from "./actions";

export default async function PersonPage({ params }: PageProps<"/admin/users/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [user, departments, apps] = await Promise.all([
    identity.getUser(id),
    identity.listDepartments(),
    identity.listApps(),
  ]);
  const departmentNames = Object.fromEntries(departments.map((d) => [d.slug, d.name]));
  const memberOf = new Set(user.departments.map((d) => d.id));
  const appById = Object.fromEntries(apps.map((a) => [a.id, a]));
  const assignableApps = apps.filter((app) => !app.is_system);
  const roleName = Object.fromEntries(apps.flatMap((a) => a.roles.map((r) => [r.id, r.label])));
  const active = user.status === "active";

  return (
    <>
      <PageHeader
        title={user.name}
        breadcrumb={{ href: "/admin/users", label: "People" }}
        media={
          <span className="avatar avatar-lg" aria-hidden="true">
            {initials(user.name)}
          </span>
        }
        description={
          <>
            {user.email}
            {active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
            {user.is_admin && <Badge tone="primary">Admin</Badge>}
          </>
        }
      />

      <div className="two-column">
        <div className="stack">
          <Card title="What they can open" description="Worked out from departments, exceptions and admin rights">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">App</th>
                    <th scope="col">Role</th>
                    <th scope="col">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {user.access.map((entry) => {
                    const app = appById[entry.app_id];
                    return (
                      <tr key={entry.app_id}>
                        <td>
                          <div className="cell-app">
                            {app && (
                              <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} size="sm" />
                            )}
                            <span>{entry.app_name}</span>
                          </div>
                        </td>
                        <td>
                          {entry.role ? (
                            <span className="role-text">{roleLabel(entry.role)}</span>
                          ) : (
                            <span className="muted">No access</span>
                          )}
                        </td>
                        <td className="muted">{describeAccess(entry, departmentNames)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <ActionForm action={saveDepartments.bind(null, user.id)} showMessage={false}>
            <Card
              title="Departments"
              description="People get the apps their departments have; the highest role wins"
              footer={
                <>
                  <ActionMessage />
                  <SubmitButton>Save departments</SubmitButton>
                </>
              }
            >
              <fieldset className="card-body chip-group">
                <legend className="visually-hidden">Departments</legend>
                {departments.map((d) => (
                  <label key={d.id} className="chip-option">
                    <input type="checkbox" name="department_id" value={d.id} defaultChecked={memberOf.has(d.id)} />
                    <span>{d.name}</span>
                  </label>
                ))}
              </fieldset>
            </Card>
          </ActionForm>

          <Card title="Exceptions" description="An exception replaces what their departments give for one app">
            {user.overrides.length > 0 && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">App</th>
                      <th scope="col">Effect</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Expires</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.overrides.map((o) => (
                      <tr key={o.id}>
                        <td>{appById[o.app_id]?.name}</td>
                        <td>
                          {o.effect === "deny" ? (
                            <Badge tone="danger">Blocked</Badge>
                          ) : (
                            <Badge tone="success">Granted {roleName[o.app_role_id ?? ""] ?? ""}</Badge>
                          )}
                        </td>
                        <td>{o.reason}</td>
                        <td className="muted">
                          {o.expires_at ? new Date(o.expires_at).toLocaleDateString("en-GB") : "Never"}
                          {!o.active && " (expired)"}
                        </td>
                        <td className="cell-actions">
                          <ActionForm action={removeException.bind(null, user.id, o.id)}>
                            <SubmitButton tone="danger" small>
                              Remove
                            </SubmitButton>
                          </ActionForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ActionForm action={addException.bind(null, user.id)} className="card-body inline-form">
              <label className="field">
                Exception
                <select name="choice" required defaultValue="">
                  <option value="" disabled>
                    Choose an app and effect
                  </option>
                  {assignableApps.map((app) => (
                    <optgroup key={app.id} label={app.name}>
                      {app.roles.map((role) => (
                        <option key={role.id} value={`${app.id}:grant:${role.id}`}>
                          Grant {role.label}
                        </option>
                      ))}
                      <option value={`${app.id}:deny`}>Block access</option>
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="field">
                Reason
                <input name="reason" required placeholder="Covering month-end close" />
              </label>
              <label className="field">
                Expires on
                <input type="date" name="expires_on" />
              </label>
              <SubmitButton tone="quiet">Add exception</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <aside className="stack">
          <Card title="Account">
            <div className="card-body account-actions">
              <div>
                <ActionForm action={setSuspended.bind(null, user.id, active)}>
                  <SubmitButton tone={active ? "danger" : "quiet"}>
                    {active ? "Suspend account" : "Reactivate account"}
                  </SubmitButton>
                </ActionForm>
                <p className="hint">
                  {active
                    ? "Blocks sign-in and signs them out of every app."
                    : "Lets them sign in again with their existing access."}
                </p>
              </div>
              <div>
                <ActionForm action={setAdmin.bind(null, user.id, !user.is_admin)}>
                  <SubmitButton tone="quiet">{user.is_admin ? "Remove admin rights" : "Make admin"}</SubmitButton>
                </ActionForm>
                <p className="hint">
                  {user.is_admin
                    ? "They go back to the access their departments give."
                    : "Admins can open every app and manage access."}
                </p>
              </div>
              <div>
                <ActionForm action={signOutEverywhere.bind(null, user.id)}>
                  <SubmitButton tone="quiet">Sign out everywhere</SubmitButton>
                </ActionForm>
                <p className="hint">Ends their sessions. Apps notice within 15 minutes.</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
