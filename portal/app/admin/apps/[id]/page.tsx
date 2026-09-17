import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AppMark } from "@/components/AppMark";
import { IconPicker } from "@/components/IconPicker";
import { requireAdmin } from "@/lib/admin";
import { identity } from "@/lib/identity";

import { addRole, deleteRole, removeLogo, rotateSecret, updateApp, uploadLogo } from "../actions";

export default async function AppPage({ params }: PageProps<"/admin/apps/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const app = await identity.getApp(id);
  const locked = app.is_system;

  return (
    <>
      <h1>{app.name}</h1>
      <p className="hint">
        Client ID <code>{app.client_id}</code>
        {locked && ". The portal's addresses and secret come from its deployment settings."}
      </p>

      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading">Settings</h2>
        <ActionForm action={updateApp.bind(null, app.id, locked)} className="form-grid">
          <label>
            Name
            <input name="name" defaultValue={app.name} required />
          </label>
          {!locked && (
            <label>
              Status
              <select name="status" defaultValue={app.status}>
                <option value="coming_soon">Coming soon</option>
                <option value="active">Live</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          )}
          <label className="wide">
            Description
            <input name="description" defaultValue={app.description} />
          </label>
          {!locked && (
            <>
              <fieldset className="radio-row wide">
                <legend>Group</legend>
                <label>
                  <input
                    type="radio"
                    name="category"
                    value="department"
                    defaultChecked={app.category === "department"}
                  />
                  Departments
                </label>
                <label>
                  <input type="radio" name="category" value="company" defaultChecked={app.category === "company"} />
                  Company tools
                </label>
              </fieldset>
              <div className="wide">
                <IconPicker defaultValue={app.icon} />
              </div>
            </>
          )}
          <label className="wide">
            App address
            <input name="launch_url" type="url" defaultValue={app.launch_url} disabled={locked} />
          </label>
          <label className="wide">
            Sign-in callback URLs, one per line
            <textarea name="redirect_uris" defaultValue={app.redirect_uris.join("\n")} disabled={locked} />
          </label>
          <label className="wide">
            Sign-out return URLs, one per line
            <textarea
              name="post_logout_redirect_uris"
              defaultValue={app.post_logout_redirect_uris.join("\n")}
              disabled={locked}
            />
          </label>
          <div className="wide">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ActionForm>
      </section>

      {!locked && (
        <section aria-labelledby="logo-heading">
          <h2 id="logo-heading">Logo</h2>
          <p className="hint">A PNG, JPEG or WebP image up to 256 KB. It replaces the icon everywhere.</p>
          <div className="logo-field" style={{ marginTop: "0.75rem" }}>
            <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} />
            <ActionForm action={uploadLogo.bind(null, app.id)} className="form-row">
              <label>
                Logo image
                <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required />
              </label>
              <SubmitButton tone="quiet">{app.logo_version === null ? "Upload logo" : "Replace logo"}</SubmitButton>
            </ActionForm>
            {app.logo_version !== null && (
              <ActionForm action={removeLogo.bind(null, app.id)}>
                <SubmitButton tone="danger">Remove logo</SubmitButton>
              </ActionForm>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="roles-heading">
        <h2 id="roles-heading">Roles</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Key sent to the app</th>
                <th>Rank</th>
                {!locked && <th />}
              </tr>
            </thead>
            <tbody>
              {app.roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.label}</td>
                  <td>
                    <code>{role.key}</code>
                  </td>
                  <td>{role.rank}</td>
                  {!locked && (
                    <td>
                      <ActionForm action={deleteRole.bind(null, app.id, role.id)}>
                        <SubmitButton tone="danger">Delete</SubmitButton>
                      </ActionForm>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!locked && (
          <ActionForm action={addRole.bind(null, app.id)} className="form-row">
            <label>
              Key
              <input name="key" required pattern="[a-z][a-z0-9_]{0,63}" placeholder="approver" />
            </label>
            <label>
              Label
              <input name="label" required placeholder="Approver" />
            </label>
            <label>
              Rank
              <input name="rank" type="number" min={0} required placeholder="20" />
            </label>
            <SubmitButton tone="quiet">Add role</SubmitButton>
          </ActionForm>
        )}
      </section>

      <section aria-labelledby="departments-heading">
        <h2 id="departments-heading">Departments with access</h2>
        {app.departments.length === 0 ? (
          <p>
            No department has access yet. Grant it on the <Link href="/admin/departments">Departments</Link> page.
          </p>
        ) : (
          <ul>
            {app.departments.map((grant) => (
              <li key={grant.department_id}>
                {grant.department_name}: {app.roles.find((r) => r.id === grant.app_role_id)?.label ?? grant.role_key}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!locked && (
        <section aria-labelledby="secret-heading">
          <h2 id="secret-heading">Client secret</h2>
          <p className="hint">
            Create a new secret if the current one may have leaked. The app stops signing people in until it uses the
            new secret.
          </p>
          <ActionForm action={rotateSecret.bind(null, app.id)}>
            <SubmitButton tone="danger">Create new secret</SubmitButton>
          </ActionForm>
        </section>
      )}
    </>
  );
}
