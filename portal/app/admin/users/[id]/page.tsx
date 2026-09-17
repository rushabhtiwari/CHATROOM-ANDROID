import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { describeAccess } from "@/lib/access";
import { requireAdmin } from "@/lib/admin";
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
  const assignableApps = apps.filter((app) => !app.is_system);
  const appName = Object.fromEntries(apps.map((a) => [a.id, a.name]));
  const roleLabel = Object.fromEntries(apps.flatMap((a) => a.roles.map((r) => [r.id, r.label])));

  return (
    <>
      <h1>{user.name}</h1>
      <p className="hint">
        {user.email}
        {user.is_admin && ", admin"}
        {user.status === "suspended" && ", suspended"}
      </p>

      <section aria-labelledby="access-heading">
        <h2 id="access-heading">What they can open</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>Role</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {user.access.map((entry) => (
                <tr key={entry.app_id}>
                  <td>{entry.app_name}</td>
                  <td>{entry.role ?? "No access"}</td>
                  <td>{describeAccess(entry, departmentNames)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="departments-heading">
        <h2 id="departments-heading">Departments</h2>
        <ActionForm action={saveDepartments.bind(null, user.id)}>
          <fieldset className="checkbox-list">
            <legend className="hint">People get the apps their departments have. The highest role wins.</legend>
            {departments.map((d) => (
              <label key={d.id}>
                <input type="checkbox" name="department_id" value={d.id} defaultChecked={memberOf.has(d.id)} />
                {d.name}
              </label>
            ))}
          </fieldset>
          <SubmitButton>Save departments</SubmitButton>
        </ActionForm>
      </section>

      <section aria-labelledby="exceptions-heading">
        <h2 id="exceptions-heading">Exceptions</h2>
        <p className="hint">An exception replaces what their departments give for one app.</p>
        {user.overrides.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>App</th>
                  <th>Effect</th>
                  <th>Reason</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {user.overrides.map((o) => (
                  <tr key={o.id}>
                    <td>{appName[o.app_id]}</td>
                    <td>{o.effect === "deny" ? "Blocked" : `Granted ${roleLabel[o.app_role_id ?? ""] ?? ""}`}</td>
                    <td>{o.reason}</td>
                    <td>
                      {o.expires_at ? new Date(o.expires_at).toLocaleDateString("en-GB") : "Never"}
                      {!o.active && " (expired)"}
                    </td>
                    <td>
                      <ActionForm action={removeException.bind(null, user.id, o.id)}>
                        <SubmitButton tone="danger">Remove</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ActionForm action={addException.bind(null, user.id)} className="form-grid">
          <label>
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
          <label>
            Reason
            <input name="reason" required placeholder="Covering month-end close" />
          </label>
          <label>
            Expires on (optional)
            <input type="date" name="expires_on" />
          </label>
          <div className="wide">
            <SubmitButton>Add exception</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby="account-heading">
        <h2 id="account-heading">Account</h2>
        <div className="form-row">
          <ActionForm action={setSuspended.bind(null, user.id, user.status === "active")}>
            <SubmitButton tone={user.status === "active" ? "danger" : "quiet"}>
              {user.status === "active" ? "Suspend account" : "Reactivate account"}
            </SubmitButton>
          </ActionForm>
          <ActionForm action={setAdmin.bind(null, user.id, !user.is_admin)}>
            <SubmitButton tone="quiet">{user.is_admin ? "Remove admin rights" : "Make admin"}</SubmitButton>
          </ActionForm>
          <ActionForm action={signOutEverywhere.bind(null, user.id)}>
            <SubmitButton tone="quiet">Sign out everywhere</SubmitButton>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
